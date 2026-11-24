import { useMemo, useState, type FormEvent } from 'react';
import { BookmarkPlus, ChevronRight, LayoutGrid, MapPin, SearchX, SlidersHorizontal, Wallet, X } from 'lucide-react';
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
import type { ListingSearchParams, ListingSort } from '../../types';
import { formatNumber, formatPrice } from '../../utils/format';

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
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
  };
}

interface FilterValues {
  city: string;
  minPrice: string;
  maxPrice: string;
}

const PRICE_PRESETS: { label: string; min: string; max: string }[] = [
  { label: 'Under 1,000', min: '', max: '1000' },
  { label: '1,000 - 10,000', min: '1000', max: '10000' },
  { label: '10,000 - 100,000', min: '10000', max: '100000' },
  { label: 'Over 100,000', min: '100000', max: '' },
];

interface FilterPanelProps {
  initial: FilterValues;
  hasFilters: boolean;
  onApply: (values: FilterValues) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Filter values are drafts until the form is submitted */
function FilterPanel({ initial, hasFilters, onApply, onClear, onClose }: FilterPanelProps) {
  const [draft, setDraft] = useState(initial);
  const [priceError, setPriceError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const min = toNumber(draft.minPrice);
    const max = toNumber(draft.maxPrice);
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('Minimum price cannot be higher than maximum price.');
      return;
    }
    setPriceError('');
    onApply(draft);
  };

  return (
    <form className="filters" onSubmit={submit} aria-label="Filters">
      <div className="filters__head">
        <span className="filters__head-icon" aria-hidden="true">
          <SlidersHorizontal size={16} />
        </span>
        <h2 className="filters__title">Filters</h2>
        {hasFilters && (
          <button type="button" className="filters__clear" onClick={onClear}>
            Clear all
          </button>
        )}
        <button type="button" className="icon-btn icon-btn--sm show-md" onClick={onClose} aria-label="Close filters">
          <X size={16} />
        </button>
      </div>

      <div className="filters__group">
        <p className="filters__label">
          <MapPin size={15} aria-hidden="true" /> Location
        </p>
        <Select
          value={draft.city}
          onChange={(city) => setDraft({ ...draft, city })}
          placeholder="All cities"
          options={[{ value: '', label: 'All cities' }, ...SAUDI_CITIES.map((c) => ({ value: c, label: c }))]}
          aria-label="City"
        />
      </div>

      <fieldset className="filters__group">
        <legend className="filters__label">
          <Wallet size={15} aria-hidden="true" /> Price (SAR)
        </legend>
        <div className="filters__price-row">
          <InputField
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            aria-label="Minimum price"
            value={draft.minPrice}
            onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
          />
          <span className="filters__dash" aria-hidden="true" />
          <InputField
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max"
            aria-label="Maximum price"
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

      <Button type="submit" variant="primary" block>
        Apply filters
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
  const activeCategory = categories.data?.find((c) => c.slug === params.category);
  useDocumentTitle(activeCategory ? activeCategory.name : params.q ? `Results for "${params.q}"` : 'All ads');

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
    });
    setFiltersOpen(false);
  };

  // Removable pills for everything that narrows the results
  const activePills = [
    params.q && { key: 'q', label: `"${params.q}"` },
    params.city && { key: 'city', label: params.city },
    (params.minPrice !== undefined || params.maxPrice !== undefined) && {
      key: 'price',
      label:
        params.minPrice !== undefined && params.maxPrice !== undefined
          ? `SAR ${formatNumber(params.minPrice)} - ${formatNumber(params.maxPrice)}`
          : params.minPrice !== undefined
            ? `From ${formatPrice(params.minPrice, 'sale')}`
            : `Up to ${formatPrice(params.maxPrice ?? 0, 'sale')}`,
    },
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
    const query = next.toString();
    return `/search${query ? `?${query}` : ''}`;
  };

  const totalAds = categories.data?.reduce((sum, c) => sum + c.listingCount, 0);
  const title = activeCategory?.name ?? (params.q ? `Results for "${params.q}"` : 'All ads');

  const clearAll = () => {
    setSearchParams(new URLSearchParams());
    setFiltersOpen(false);
  };

  const hasFilters = Boolean(params.q || params.city || params.category || params.minPrice || params.maxPrice);
  const canSaveSearch = hasPermission(user?.role, 'searches:save');

  const openSaveSearch = () => {
    const parts = [params.q && `"${params.q}"`, activeCategory?.name, params.city && `in ${params.city}`].filter(Boolean);
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
        title: 'Search saved',
        message: 'Find it any time in your dashboard.',
      });
      setSaveOpen(false);
    } catch (error) {
      toast.show({
        title: 'Could not save search',
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
          <nav className="page-hero__crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={14} aria-hidden="true" />
            {activeCategory ? (
              <>
                <Link to={categoryLink()}>Browse ads</Link>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">{activeCategory.name}</span>
              </>
            ) : (
              <span aria-current="page">Browse ads</span>
            )}
          </nav>
          <div className="browse-hero__row">
            <div>
              <h1 className="browse-hero__title">{title}</h1>
              <p className="browse-hero__text">
                {results.data ? `${formatNumber(results.data.total)} ${results.data.total === 1 ? 'ad' : 'ads'}` : 'Searching...'}
                {params.city ? ` in ${params.city}` : ' across Saudi Arabia'}, every one checked before it went live.
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

      <nav className="browse-cats" aria-label="Categories">
        <div className="container browse-cats__row">
          <Link to={categoryLink()} className={`browse-cat${!params.category ? ' is-active' : ''}`} aria-current={!params.category ? 'page' : undefined}>
            <span className="browse-cat__icon">
              <LayoutGrid size={18} />
            </span>
            <span>
              <strong>All ads</strong>
              {totalAds !== undefined && <span className="tabular">{formatNumber(totalAds)} ads</span>}
            </span>
          </Link>
          {categories.data?.map((c) => (
            <Link key={c.id} to={categoryLink(c.slug)} className={`browse-cat${params.category === c.slug ? ' is-active' : ''}`} aria-current={params.category === c.slug ? 'page' : undefined}>
              <span className="browse-cat__icon">
                <CategoryIcon icon={c.icon} size={18} />
              </span>
              <span>
                <strong>{c.name}</strong>
                <span className="tabular">{formatNumber(c.listingCount)} ads</span>
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
              key={`${params.city ?? ''}|${params.minPrice ?? ''}|${params.maxPrice ?? ''}`}
              initial={{
                city: params.city ?? '',
                minPrice: params.minPrice?.toString() ?? '',
                maxPrice: params.maxPrice?.toString() ?? '',
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
                <strong className="tabular">{results.data ? formatNumber(results.data.total) : '–'}</strong> {results.data?.total === 1 ? 'ad found' : 'ads found'}
                {activePills.map((pill) => (
                  <span key={pill.key} className="filter-pill">
                    {pill.label}
                    <button type="button" onClick={() => removePill(pill.key)} aria-label={`Remove filter ${pill.label}`}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="browse-toolbar__actions">
                <Button size="sm" className="show-md" icon={<SlidersHorizontal size={16} />} onClick={() => setFiltersOpen(true)}>
                  Filters
                </Button>
                {canSaveSearch && hasFilters && (
                  <Button size="sm" icon={<BookmarkPlus size={16} />} onClick={openSaveSearch}>
                    Save search
                  </Button>
                )}
                <Select
                  size="sm"
                  id="sort"
                  className="browse-toolbar__sort"
                  value={params.sort ?? 'newest'}
                  onChange={(next) => update({ sort: next === 'newest' ? undefined : next })}
                  options={SORT_OPTIONS}
                  aria-label="Sort by"
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
                  title="No ads match your search"
                  text="Try a different keyword, another city, or widen the price range."
                  action={hasFilters ? <Button onClick={clearAll}>Clear filters</Button> : undefined}
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
          title="Save this search"
          description="Come back to these filters any time from your dashboard."
          onClose={() => setSaveOpen(false)}
          footer={
            <>
              <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
              <Button variant="primary" isLoading={saving} disabled={!saveLabel.trim()} onClick={saveSearch}>
                Save search
              </Button>
            </>
          }
        >
          <InputField label="Name" value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} maxLength={80} required />
        </Modal>
      </div>
    </>
  );
}
