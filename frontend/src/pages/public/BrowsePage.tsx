import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, BookmarkPlus, ChevronRight, LayoutGrid, ListFilter, MapPin, SearchX, SlidersHorizontal, Wallet, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { CategoryIcon } from '../../components/listings/CategoryIcon';
import { ListingCard, ListingCardSkeleton } from '../../components/listings/ListingCard';
import { SearchBar } from '../../components/listings/SearchBar';
import { revealDelay } from '../../components/marketing/reveal';
import { Button } from '../../components/ui/Button';
import { InputField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { DEFAULT_PAGE_SIZE, SAUDI_CITIES } from '../../config/app.config';
import { useAuth } from '../../features/auth/context/useAuth';
import { hasPermission } from '../../features/auth/rbac';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { categoriesService } from '../../services/categories.service';
import { listingsService } from '../../services/listings.service';
import { savedService } from '../../services/saved.service';
import type { Category, CategoryField, ListingSearchParams, ListingSort } from '../../types';
import { childrenOf, filterKeysOf, trailOf } from '../../utils/categories';
import { formatNumber, formatPrice } from '../../utils/format';
import { t, tn } from '../../i18n';

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'newest', label: t('Newest first') },
  { value: 'price_asc', label: t('Price: low to high') },
  { value: 'price_desc', label: t('Price: high to low') },
];

function toNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function readParams(sp: URLSearchParams): ListingSearchParams {
  const sort = sp.get('sort');
  return {
    q: sp.get('q') ?? undefined,
    city: sp.get('city') ?? undefined,
    category: sp.get('category') ?? undefined,
    minPrice: toNumber(sp.get('minPrice')),
    maxPrice: toNumber(sp.get('maxPrice')),
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as ListingSort) : 'newest',
    page: Math.max(1, toNumber(sp.get('page')) ?? 1),
    // Category detail filters; the API ignores any that the category does not offer
    ...Object.fromEntries([...sp.entries()].filter(([key, value]) => key.startsWith('f_') && value)),
  };
}

interface FilterValues {
  city: string;
  minPrice: string;
  maxPrice: string;
  /** f_<key> values for the active category's filters */
  details: Record<string, string>;
}

/** Filter label for an applied detail filter, such as "Year from 2018" or "Toyota" */
function detailPillLabel(field: CategoryField, key: string, value: string): string {
  const amount = `${formatNumber(Number(value))}${field.unit ? ` ${t(field.unit)}` : ''}`;
  if (key.endsWith('_min')) return t('{label} from {amount}', { label: t(field.label), amount });
  if (key.endsWith('_max')) return t('{label} up to {amount}', { label: t(field.label), amount });
  return t(value);
}

const PRICE_PRESETS: { label: string; min: string; max: string }[] = [
  { label: t('Under 1,000'), min: '', max: '1000' },
  { label: '1,000 - 10,000', min: '1000', max: '10000' },
  { label: '10,000 - 100,000', min: '10000', max: '100000' },
  { label: t('Over 100,000'), min: '100000', max: '' },
];

interface FilterPanelProps {
  initial: FilterValues;
  /** Filterable details of the active category */
  fields: CategoryField[];
  hasFilters: boolean;
  onApply: (values: FilterValues) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Filter values are drafts until the form is submitted */
function FilterPanel({ initial, fields, hasFilters, onApply, onClear, onClose }: FilterPanelProps) {
  const [draft, setDraft] = useState(initial);
  const [priceError, setPriceError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const min = toNumber(draft.minPrice);
    const max = toNumber(draft.maxPrice);
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError(t('Minimum price cannot be higher than maximum price.'));
      return;
    }
    setPriceError('');
    onApply(draft);
  };

  const setDetail = (key: string, value: string) => setDraft({ ...draft, details: { ...draft.details, [key]: value } });

  return (
    <form className="filters" onSubmit={submit} aria-label={t('Filters')}>
      <div className="filters__head">
        <span className="filters__head-icon" aria-hidden="true">
          <SlidersHorizontal size={16} />
        </span>
        <h2 className="filters__title">{t('Filters')}</h2>
        {hasFilters && (
          <button type="button" className="filters__clear" onClick={onClear}>
            {t('Clear all')}
          </button>
        )}
        <button type="button" className="icon-btn icon-btn--sm show-md" onClick={onClose} aria-label={t('Close filters')}>
          <X size={16} />
        </button>
      </div>

      <div className="filters__group">
        <p className="filters__label">
          <MapPin size={15} aria-hidden="true" /> {t('Location')}
        </p>
        <Select
          value={draft.city}
          onChange={(city) => setDraft({ ...draft, city })}
          placeholder={t('All cities')}
          options={[{ value: '', label: t('All cities') }, ...SAUDI_CITIES.map((c) => ({ value: c, label: t(c) }))]}
          aria-label={t('City')}
        />
      </div>

      <fieldset className="filters__group">
        <legend className="filters__label">
          <Wallet size={15} aria-hidden="true" /> {t('Price (SAR)')}
        </legend>
        <div className="filters__price-row">
          <InputField
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('Min')}
            aria-label={t('Minimum price')}
            value={draft.minPrice}
            onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
          />
          <span className="filters__dash" aria-hidden="true" />
          <InputField
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('Max')}
            aria-label={t('Maximum price')}
            value={draft.maxPrice}
            onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
          />
        </div>
        <div className="filters__presets">
          {PRICE_PRESETS.map((preset) => {
            const active = draft.minPrice === preset.min && draft.maxPrice === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                className={`chip${active ? ' chip--active' : ''}`}
                aria-pressed={active}
                onClick={() =>
                  setDraft(
                    active
                      ? { ...draft, minPrice: '', maxPrice: '' }
                      : {
                          ...draft,
                          minPrice: preset.min,
                          maxPrice: preset.max,
                        },
                  )
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {priceError && <span className="field__error">{priceError}</span>}
      </fieldset>

      {fields.map((field) =>
        field.inputType === 'select' ? (
          <div key={field.fieldKey} className="filters__group">
            <p className="filters__label">
              <ListFilter size={15} aria-hidden="true" /> {field.label}
            </p>
            <Select
              value={draft.details[`f_${field.fieldKey}`] ?? ''}
              onChange={(value) => setDetail(`f_${field.fieldKey}`, value)}
              placeholder={t('Any {value}', {
                value: field.label.toLowerCase(),
              })}
              options={[
                {
                  value: '',
                  label: t('Any {value}', {
                    value: field.label.toLowerCase(),
                  }),
                },
                ...(field.options ?? []).map((o) => ({ value: o, label: t(o) })),
              ]}
              aria-label={field.label}
            />
          </div>
        ) : (
          <fieldset key={field.fieldKey} className="filters__group">
            <legend className="filters__label">
              <ListFilter size={15} aria-hidden="true" /> {field.label}
              {field.unit ? ` (${field.unit})` : ''}
            </legend>
            <div className="filters__price-row">
              <InputField
                type="number"
                inputMode="numeric"
                min={field.min ?? 0}
                placeholder={t('Min')}
                aria-label={t('Minimum {value}', {
                  value: field.label.toLowerCase(),
                })}
                value={draft.details[`f_${field.fieldKey}_min`] ?? ''}
                onChange={(e) => setDetail(`f_${field.fieldKey}_min`, e.target.value)}
              />
              <span className="filters__dash" aria-hidden="true" />
              <InputField
                type="number"
                inputMode="numeric"
                min={field.min ?? 0}
                placeholder={t('Max')}
                aria-label={t('Maximum {value}', {
                  value: field.label.toLowerCase(),
                })}
                value={draft.details[`f_${field.fieldKey}_max`] ?? ''}
                onChange={(e) => setDetail(`f_${field.fieldKey}_max`, e.target.value)}
              />
            </div>
          </fieldset>
        ),
      )}

      <Button type="submit" variant="primary" block>
        {t('Apply filters')}
      </Button>
    </form>
  );
}

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);
  const { user } = useAuth();
  const toast = useToast();
  const categories = useAsync(() => categoriesService.list(), []);
  const allCategories = categories.data ?? [];
  const activeCategory = allCategories.find((c) => c.slug === params.category);
  const activeTrail = trailOf(allCategories, activeCategory);
  const detailFields = activeCategory?.fields.filter((f) => f.filterable) ?? [];
  const detailKeys = filterKeysOf(activeCategory);
  const appliedDetails = Object.fromEntries(detailKeys.filter((k) => searchParams.get(k)).map((k) => [k, searchParams.get(k) as string]));
  // Chips show the next level down; on a final category they show its siblings so the visitor can switch
  const chipParent: Category | undefined = activeCategory?.isLeaf ? allCategories.find((c) => c.id === activeCategory.parentId) : activeCategory;
  const chipCategories = childrenOf(allCategories, chipParent?.id ?? null);
  useDocumentTitle(
    activeCategory
      ? activeCategory.name
      : params.q
        ? t('Results for "{q}"', {
            q: params.q,
          })
        : t('All ads'),
  );

  const results = useAsync(() => listingsService.search({ ...params, pageSize: DEFAULT_PAGE_SIZE }), [searchParams.toString()]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (changes: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  const applyFilters = (values: FilterValues) => {
    update({
      city: values.city,
      minPrice: toNumber(values.minPrice)?.toString(),
      maxPrice: toNumber(values.maxPrice)?.toString(),
      ...Object.fromEntries(detailKeys.map((key) => [key, values.details[key] || undefined])),
    });
    setFiltersOpen(false);
  };

  // Removable pills for everything that narrows the results
  const activePills = [
    params.q && { key: 'q', label: `"${params.q}"` },
    params.city && { key: 'city', label: t(params.city) },
    (params.minPrice !== undefined || params.maxPrice !== undefined) && {
      key: 'price',
      label:
        params.minPrice !== undefined && params.maxPrice !== undefined
          ? t('SAR {minPrice} - {maxPrice}', {
              minPrice: formatNumber(params.minPrice),
              maxPrice: formatNumber(params.maxPrice),
            })
          : params.minPrice !== undefined
            ? t('From {minPrice}', {
                minPrice: formatPrice(params.minPrice, 'sale'),
              })
            : t('Up to {maxPrice}', {
                maxPrice: formatPrice(params.maxPrice ?? 0, 'sale'),
              }),
    },
    ...Object.entries(appliedDetails).map(([key, value]) => {
      const field = detailFields.find((f) => key === `f_${f.fieldKey}` || key === `f_${f.fieldKey}_min` || key === `f_${f.fieldKey}_max`);
      return field && { key, label: detailPillLabel(field, key, value) };
    }),
  ].filter(Boolean) as { key: string; label: string }[];

  const removePill = (key: string) => {
    if (key === 'price') update({ minPrice: undefined, maxPrice: undefined });
    else update({ [key]: undefined });
  };

  const categoryLink = (slug?: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set('category', slug);
    else next.delete('category');
    next.delete('page');
    // Detail filters belong to the previous category
    [...next.keys()].filter((key) => key.startsWith('f_')).forEach((key) => next.delete(key));
    const query = next.toString();
    return `/search${query ? `?${query}` : ''}`;
  };

  const totalAds = categories.data ? childrenOf(allCategories, null).reduce((sum, c) => sum + c.listingCount, 0) : undefined;
  const title =
    activeCategory?.name ??
    (params.q
      ? t('Results for "{q}"', {
          q: params.q,
        })
      : t('All ads'));

  const clearAll = () => {
    setSearchParams(new URLSearchParams());
    setFiltersOpen(false);
  };

  const hasFilters = Boolean(params.q || params.city || params.category || params.minPrice || params.maxPrice || Object.keys(appliedDetails).length);
  const canSaveSearch = hasPermission(user?.role, 'searches:save');

  const openSaveSearch = () => {
    const parts = [params.q && `"${params.q}"`, activeCategory?.name, params.city && t('in {city}', { city: t(params.city) })].filter(Boolean);
    setSaveLabel(parts.join(' ') || 'My search');
    setSaveOpen(true);
  };

  const saveSearch = async () => {
    if (!saveLabel.trim()) return;
    setSaving(true);
    try {
      const { page: _page, ...criteria } = params;
      void _page;
      await savedService.saveSearch(saveLabel.trim(), criteria);
      toast.show({
        title: t('Search saved'),
        message: t('Find it any time in your dashboard.'),
      });
      setSaveOpen(false);
    } catch (error) {
      toast.show({
        title: t('Could not save search'),
        message: getErrorMessage(error),
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="browse-hero" data-header-dark>
        <div className="container">
          <nav className="page-hero__crumbs" aria-label={t('Breadcrumb')}>
            <Link to="/">{t('Home')}</Link>
            <ChevronRight size={14} aria-hidden="true" />
            {activeCategory ? (
              <>
                <Link to={categoryLink()}>{t('Browse ads')}</Link>
                {activeTrail.map((c) => (
                  <Fragment key={c.id}>
                    <ChevronRight size={14} aria-hidden="true" />
                    {c.id === activeCategory.id ? <span aria-current="page">{c.name}</span> : <Link to={categoryLink(c.slug)}>{c.name}</Link>}
                  </Fragment>
                ))}
              </>
            ) : (
              <span aria-current="page">{t('Browse ads')}</span>
            )}
          </nav>
          <div className="browse-hero__row">
            <div>
              <h1 className="browse-hero__title">{title}</h1>
              <p className="browse-hero__text">
                {results.data ? tn(results.data.total, '{count} ad', '{count} ads', { count: formatNumber(results.data.total) }) : t('Searching...')}
                {params.city ? ` ${t('in {city}', { city: t(params.city) })}` : ` ${t('across Saudi Arabia')}`}
                {t(', every one checked before it went live.')}
              </p>
            </div>
          </div>
          <div className="browse-hero__search">
            <SearchBar
              key={searchParams.toString()}
              variant="hero"
              showCategory={false}
              categories={categories.data ?? []}
              initial={{
                q: params.q,
                city: params.city,
                category: params.category,
              }}
              keepParams={{
                minPrice: params.minPrice?.toString(),
                maxPrice: params.maxPrice?.toString(),
                sort: params.sort === 'newest' ? undefined : params.sort,
              }}
            />
          </div>
        </div>
      </section>

      <nav className="browse-cats" aria-label={t('Categories')}>
        <div className="container browse-cats__row">
          {chipParent ? (
            <Link to={categoryLink(chipParent.parentId ? allCategories.find((c) => c.id === chipParent.parentId)?.slug : undefined)} className="browse-cat">
              <span className="browse-cat__icon">
                <ArrowLeft size={18} />
              </span>
              <span>
                <strong>{t('Back')}</strong>
                <span>{chipParent.parentId ? allCategories.find((c) => c.id === chipParent.parentId)?.name : t('All ads')}</span>
              </span>
            </Link>
          ) : null}
          <Link
            to={categoryLink(chipParent?.slug)}
            className={`browse-cat${(chipParent ? params.category === chipParent.slug : !params.category) ? ' is-active' : ''}`}
            aria-current={(chipParent ? params.category === chipParent.slug : !params.category) ? 'page' : undefined}
          >
            <span className="browse-cat__icon">{chipParent ? <CategoryIcon icon={chipParent.icon} size={18} /> : <LayoutGrid size={18} />}</span>
            <span>
              <strong>
                {chipParent
                  ? t('All in {name}', {
                      name: chipParent.name,
                    })
                  : t('All ads')}
              </strong>
              {chipParent ? (
                <span className="tabular">
                  {tn(chipParent.listingCount, '{count} ad', '{count} ads', { count: formatNumber(chipParent.listingCount) })}
                </span>
              ) : (
                totalAds !== undefined && (
                  <span className="tabular">
                    {tn(totalAds, '{count} ad', '{count} ads', { count: formatNumber(totalAds) })}
                  </span>
                )
              )}
            </span>
          </Link>
          {chipCategories.map((c) => (
            <Link key={c.id} to={categoryLink(c.slug)} className={`browse-cat${params.category === c.slug ? ' is-active' : ''}`} aria-current={params.category === c.slug ? 'page' : undefined}>
              <span className="browse-cat__icon">
                <CategoryIcon icon={c.icon} size={18} />
              </span>
              <span>
                <strong>{c.name}</strong>
                <span className="tabular">
                  {tn(c.listingCount, '{count} ad', '{count} ads', { count: formatNumber(c.listingCount) })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="container browse">
        <div className="browse__layout">
          <div className={`browse__filters${filtersOpen ? ' browse__filters--open' : ''}`}>
            {/* Remounts when the URL filters change so the form always starts from the applied values */}
            <FilterPanel
              key={`${params.category ?? ''}|${params.city ?? ''}|${params.minPrice ?? ''}|${params.maxPrice ?? ''}|${JSON.stringify(appliedDetails)}`}
              fields={detailFields}
              initial={{
                city: params.city ?? '',
                minPrice: params.minPrice?.toString() ?? '',
                maxPrice: params.maxPrice?.toString() ?? '',
                details: appliedDetails,
              }}
              hasFilters={hasFilters}
              onApply={applyFilters}
              onClear={clearAll}
              onClose={() => setFiltersOpen(false)}
            />
          </div>
          {filtersOpen && <div className="sidebar-backdrop show-md" onClick={() => setFiltersOpen(false)} aria-hidden="true" />}
          <section className="browse__results" aria-live="polite" aria-busy={results.isLoading}>
            <div className="browse-toolbar">
              <div className="browse-toolbar__info">
                <strong className="tabular">{results.data ? formatNumber(results.data.total) : '–'}</strong> {results.data?.total === 1 ? t('ad found') : t('ads found')}
                {activePills.map((pill) => (
                  <span key={pill.key} className="filter-pill">
                    {pill.label}
                    <button
                      type="button"
                      onClick={() => removePill(pill.key)}
                      aria-label={t('Remove filter {label}', {
                        label: pill.label,
                      })}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="browse-toolbar__actions">
                <Button size="sm" className="show-md" icon={<SlidersHorizontal size={16} />} onClick={() => setFiltersOpen(true)}>
                  {t('Filters')}
                </Button>
                {canSaveSearch && hasFilters && (
                  <Button size="sm" icon={<BookmarkPlus size={16} />} onClick={openSaveSearch}>
                    {t('Save search')}
                  </Button>
                )}
                <Select
                  size="sm"
                  id="sort"
                  className="browse-toolbar__sort"
                  value={params.sort ?? 'newest'}
                  onChange={(next) => update({ sort: next === 'newest' ? undefined : next })}
                  options={SORT_OPTIONS}
                  aria-label={t('Sort by')}
                />
              </div>
            </div>
            {results.error ? (
              <ErrorState error={results.error} onRetry={results.reload} />
            ) : results.isLoading || !results.data ? (
              <div className="listing-grid listing-grid--3">
                {Array.from({ length: 6 }, (_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : results.data.items.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<SearchX size={26} />}
                  title={t('No ads match your search')}
                  text={t('Try a different keyword, another city, or widen the price range.')}
                  action={hasFilters ? <Button onClick={clearAll}>{t('Clear filters')}</Button> : undefined}
                />
              </div>
            ) : (
              <>
                <div className="listing-grid listing-grid--3">
                  {results.data.items.map((listing, i) => (
                    <div key={listing.id} data-reveal style={revealDelay(i % 3)}>
                      <ListingCard listing={listing} />
                    </div>
                  ))}
                </div>
                <Pagination
                  page={results.data.page}
                  totalPages={results.data.totalPages}
                  onChange={(page) => {
                    update({ page: page > 1 ? String(page) : undefined }, false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </>
            )}
          </section>
        </div>

        <Modal
          open={saveOpen}
          title={t('Save this search')}
          description={t('Come back to these filters any time from your dashboard.')}
          onClose={() => setSaveOpen(false)}
          footer={
            <>
              <Button onClick={() => setSaveOpen(false)}>{t('Cancel')}</Button>
              <Button variant="primary" isLoading={saving} disabled={!saveLabel.trim()} onClick={saveSearch}>
                {t('Save search')}
              </Button>
            </>
          }
        >
          <InputField label={t('Name')} value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} maxLength={80} required />
        </Modal>
      </div>
    </>
  );
}
