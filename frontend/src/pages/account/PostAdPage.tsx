import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, ImagePlus, MapPin, Send, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { CategoryIcon } from '../../components/listings/CategoryIcon';
import { ListingImage } from '../../components/listings/ListingImage';
import { ListingStatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { LISTING_PHOTO_LIMITS, SAUDI_CITIES } from '../../config/app.config';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { categoriesService } from '../../services/categories.service';
import { listingsService } from '../../services/listings.service';
import type { Category, Listing, ListingDraftPayload, ListingType } from '../../types';
import { formatNumber, formatPrice, LISTING_TYPE_LABELS } from '../../utils/format';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Category', 'Details', 'Photos', 'Preview'];

interface FormState {
  categoryId: string;
  listingType: ListingType;
  title: string;
  description: string;
  price: string;
  city: string;
  district: string;
  attributes: Record<string, string>;
}

interface NewPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const EMPTY_FORM: FormState = { categoryId: '', listingType: 'sale', title: '', description: '', price: '', city: '', district: '', attributes: {} };

function allowedTypes(category: Category | undefined): ListingType[] {
  if (!category) return ['sale'];
  if (category.slug === 'property') return ['sale', 'rent'];
  if (category.slug === 'services') return ['service'];
  return ['sale'];
}

function formFromListing(l: Listing): FormState {
  return {
    categoryId: l.categoryId,
    listingType: l.listingType,
    title: l.title,
    description: l.description,
    price: String(l.price),
    city: l.city,
    district: l.district,
    attributes: Object.fromEntries(Object.entries(l.attributes).map(([k, v]) => [k, String(v)])),
  };
}

function validateDetails(form: FormState, category: Category | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = form.title.trim();
  if (title.length < 10) errors.title = 'Use at least 10 characters so buyers know what it is.';
  if (title.length > 90) errors.title = 'Keep the title under 90 characters.';
  const price = Number(form.price);
  if (!form.price || !Number.isFinite(price) || price <= 0) errors.price = 'Enter a price greater than 0.';
  else if (price > 100_000_000) errors.price = 'Check the price; it looks too high.';
  if (!form.city) errors.city = 'Choose a city.';
  if (!form.district.trim()) errors.district = 'Enter the district or area.';
  if (form.description.trim().length < 30) errors.description = 'Describe the item in at least 30 characters.';
  category?.fields.forEach((field) => {
    const value = form.attributes[field.fieldKey]?.trim() ?? '';
    if (field.required && !value) errors[`attributes.${field.fieldKey}`] = `${field.label} is required.`;
    if (value && field.inputType === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) errors[`attributes.${field.fieldKey}`] = `${field.label} must be a positive number.`;
      if (field.fieldKey === 'year' && (n < 1950 || n > new Date().getFullYear() + 1)) errors[`attributes.${field.fieldKey}`] = 'Enter a valid year.';
    }
  });
  return errors;
}

function toPayload(form: FormState, category: Category): ListingDraftPayload {
  const attributes: Record<string, string | number> = {};
  category.fields.forEach((field) => {
    const value = form.attributes[field.fieldKey]?.trim();
    if (value) attributes[field.fieldKey] = field.inputType === 'number' ? Number(value) : value;
  });
  return {
    categoryId: category.id,
    listingType: form.listingType,
    title: form.title.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    city: form.city,
    district: form.district.trim(),
    attributes,
  };
}

export function PostAdPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit ad' : 'Post an ad');
  const categories = useAsync(() => categoriesService.list(), []);
  const existing = useAsync(() => (id ? listingsService.getById(id) : Promise.resolve(null)), [id]);

  if (categories.isLoading || (isEdit && existing.isLoading)) return <LoadingState label="Loading..." />;
  if (categories.error || !categories.data) return <ErrorState error={categories.error} onRetry={categories.reload} />;
  if (isEdit && (existing.error || !existing.data)) return <ErrorState error={existing.error} onRetry={existing.reload} title="We could not load this ad" />;
  if (existing.data && !['draft', 'changes_required', 'published', 'pending_review'].includes(existing.data.status)) {
    return (
      <div className="card">
        <EmptyState title="This ad cannot be edited" text="Withdrawn, hidden or rejected ads cannot be changed. You can post a new ad instead." action={<ButtonLink to="/account/listings/new" variant="primary">Post a new ad</ButtonLink>} />
      </div>
    );
  }

  return <PostAdForm key={id ?? 'new'} categories={categories.data} existing={existing.data ?? null} />;
}

function PostAdForm({ categories, existing }: { categories: Category[]; existing: Listing | null }) {
  const isEdit = Boolean(existing);
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<Step>(existing ? 1 : 0);
  const [form, setForm] = useState<FormState>(() => (existing ? formFromListing(existing) : EMPTY_FORM));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<NewPhoto[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null);
  const [result, setResult] = useState<Listing | null>(null);
  const [formError, setFormError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Preview URLs are released when the page closes
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const category = categories.find((c) => c.id === form.categoryId);
  const existingPhotoCount = existing?.photos.length ?? 0;
  const totalPhotos = existingPhotoCount + photos.length;
  const photosRequired = category?.slug !== 'services';

  const previewListing = useMemo(
    () => ({ photos: photos.map((p, i) => ({ id: p.id, url: p.previewUrl, position: i })), categorySlug: category?.slug ?? '', title: form.title }),
    [photos, category?.slug, form.title],
  );

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const setAttribute = (key: string, value: string) => {
    setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));
    setErrors((e) => ({ ...e, [`attributes.${key}`]: '' }));
  };

  const chooseCategory = (c: Category) => {
    setForm((f) => ({ ...EMPTY_FORM, ...f, categoryId: c.id, listingType: allowedTypes(c)[0], attributes: f.categoryId === c.id ? f.attributes : {} }));
    setStep(1);
  };

  const goToPhotos = () => {
    const next = validateDetails(form, category);
    setErrors(next);
    if (Object.keys(next).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStep(2);
  };

  const goToPreview = () => {
    if (photosRequired && totalPhotos === 0) {
      setPhotoError('Add at least one photo. Ads with photos get far more replies.');
      return;
    }
    setStep(3);
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const problems: string[] = [];
    const accepted: NewPhoto[] = [];
    let slots = LISTING_PHOTO_LIMITS.maxCount - totalPhotos;
    files.forEach((file) => {
      if (!(LISTING_PHOTO_LIMITS.acceptedTypes as readonly string[]).includes(file.type)) problems.push(`${file.name}: use JPG, PNG or WebP.`);
      else if (file.size > LISTING_PHOTO_LIMITS.maxSizeBytes) problems.push(`${file.name}: larger than ${LISTING_PHOTO_LIMITS.maxSizeBytes / 1024 / 1024} MB.`);
      else if (slots <= 0) problems.push(`Only ${LISTING_PHOTO_LIMITS.maxCount} photos are allowed.`);
      else {
        accepted.push({ id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`, file, previewUrl: URL.createObjectURL(file) });
        slots -= 1;
      }
    });
    setPhotos((p) => [...p, ...accepted]);
    setPhotoError([...new Set(problems)].join(' '));
  };

  const removePhoto = (photoId: string) => {
    setPhotos((list) => {
      const target = list.find((p) => p.id === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return list.filter((p) => p.id !== photoId);
    });
  };

  const save = async (mode: 'draft' | 'submit') => {
    if (!category) return;
    setSubmitting(mode);
    setFormError('');
    try {
      const payload = toPayload(form, category);
      let listing = existing ? await listingsService.update(existing.id, payload) : await listingsService.createDraft(payload);
      if (photos.length) await listingsService.uploadPhotos(listing.id, photos.map((p) => p.file));
      if (mode === 'submit' && (listing.status === 'draft' || listing.status === 'changes_required')) {
        listing = await listingsService.submit(listing.id);
      }
      setResult(listing);
      toast.show({ title: mode === 'draft' ? 'Draft saved' : 'Ad sent for review' });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
        setStep(1);
      }
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(null);
    }
  };

  if (result) {
    const inReview = result.status === 'pending_review';
    return (
      <div className="card post-result">
        <EmptyState
          icon={inReview ? <Clock size={26} /> : <CheckCircle2 size={26} />}
          title={inReview ? 'Your ad is in review' : 'Draft saved'}
          text={
            inReview
              ? 'Our team checks every ad before it goes live. You will get a notification as soon as it is approved or if anything needs changing.'
              : 'You can finish and submit it any time from My ads.'
          }
          action={
            <div className="post-result__actions">
              <ButtonLink to="/account/listings" variant="primary">
                Go to my ads
              </ButtonLink>
              {!isEdit && (
                <Button
                  onClick={() => {
                    setResult(null);
                    setForm(EMPTY_FORM);
                    setPhotos([]);
                    setStep(0);
                  }}
                >
                  Post another ad
                </Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  const typeOptions = allowedTypes(category);

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit ad' : 'Post an ad'}
        subtitle={
          isEdit && existing ? (
            <>
              Current status: <ListingStatusBadge status={existing.status} />
              {existing.status === 'published' && ' Changing a live ad sends it back for review.'}
            </>
          ) : (
            'Free to post. Every ad is reviewed before it goes live.'
          )
        }
      />

      <ol className="stepper" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className={`stepper__item${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`} aria-current={index === step ? 'step' : undefined}>
            <span className="stepper__dot">{index < step ? <CheckCircle2 size={16} /> : index + 1}</span>
            <span className="stepper__label">{label}</span>
          </li>
        ))}
      </ol>

      {existing?.moderationNote && existing.status === 'changes_required' && (
        <div className="alert alert--warning" style={{ marginBottom: 'var(--space-5)' }}>
          <strong>Moderator note:</strong>&nbsp;{existing.moderationNote}
        </div>
      )}
      {formError && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          {formError}
        </div>
      )}

      {step === 0 && (
        <section className="card">
          <h2 className="card-title">What are you posting?</h2>
          <p className="card-subtitle">The category decides which details buyers can filter by.</p>
          <div className="category-picker">
            {categories.map((c) => (
              <button key={c.id} type="button" className={`category-picker__item${form.categoryId === c.id ? ' is-selected' : ''}`} onClick={() => chooseCategory(c)}>
                <span className="category-tile__icon">
                  <CategoryIcon icon={c.icon} size={24} strokeWidth={1.8} />
                </span>
                <strong>{c.name}</strong>
                <span className="text-muted">{c.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && category && (
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Ad details</h2>
              <p className="card-subtitle">
                Category: <strong>{category.name}</strong>
                {!isEdit && (
                  <button type="button" className="link link--button" onClick={() => setStep(0)} style={{ marginInlineStart: 8 }}>
                    Change
                  </button>
                )}
              </p>
            </div>
          </div>
          <div className="form-grid">
            {typeOptions.length > 1 && (
              <div className="field form-grid__full">
                <span className="field__label">Ad type</span>
                <div className="segmented" role="radiogroup" aria-label="Ad type">
                  {typeOptions.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={form.listingType === t} aria-pressed={form.listingType === t} className="segmented__item" onClick={() => setField('listingType', t)}>
                      {LISTING_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <InputField
              wrapperClassName="form-grid__full"
              label="Title"
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              error={errors.title}
              maxLength={90}
              hint={`${form.title.trim().length}/90 - include brand, model and key detail`}
              placeholder={category.slug === 'cars' ? 'e.g. Toyota Camry GLE 2022, single owner' : 'A short, clear title'}
            />
            <InputField
              label={form.listingType === 'rent' ? 'Rent per year (SAR)' : category.slug === 'services' ? 'Price (SAR)' : 'Price (SAR)'}
              required
              type="number"
              inputMode="numeric"
              min={1}
              value={form.price}
              onChange={(e) => setField('price', e.target.value)}
              error={errors.price}
            />
            <SelectField label="City" required value={form.city} onChange={(city) => setField('city', city)} placeholder="Choose city" options={SAUDI_CITIES.map((c) => ({ value: c, label: c }))} error={errors.city} />
            <InputField label="District / area" required value={form.district} onChange={(e) => setField('district', e.target.value)} error={errors.district} maxLength={60} icon={<MapPin size={16} />} />
            {category.fields.map((field) =>
              field.inputType === 'select' ? (
                <SelectField
                  key={field.fieldKey}
                  label={field.label}
                  required={field.required}
                  value={form.attributes[field.fieldKey] ?? ''}
                  onChange={(next) => setAttribute(field.fieldKey, next)}
                  placeholder={`Choose ${field.label.toLowerCase()}`}
                  options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                  error={errors[`attributes.${field.fieldKey}`]}
                />
              ) : (
                <InputField
                  key={field.fieldKey}
                  label={field.unit ? `${field.label} (${field.unit})` : field.label}
                  required={field.required}
                  type={field.inputType === 'number' ? 'number' : 'text'}
                  inputMode={field.inputType === 'number' ? 'numeric' : undefined}
                  min={field.inputType === 'number' ? 0 : undefined}
                  value={form.attributes[field.fieldKey] ?? ''}
                  onChange={(e) => setAttribute(field.fieldKey, e.target.value)}
                  error={errors[`attributes.${field.fieldKey}`]}
                  maxLength={80}
                />
              ),
            )}
            <TextareaField
              wrapperClassName="form-grid__full"
              label="Description"
              required
              rows={6}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              error={errors.description}
              maxLength={4000}
              hint="Condition, history, what is included and how to view it. Do not add phone numbers; buyers message you here."
            />
          </div>
          <div className="wizard-actions">
            {!isEdit ? (
              <Button icon={<ArrowLeft size={16} />} onClick={() => setStep(0)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={goToPhotos}>
              Continue <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h2 className="card-title">Photos</h2>
          <p className="card-subtitle">
            Up to {LISTING_PHOTO_LIMITS.maxCount} photos, JPG, PNG or WebP, max {LISTING_PHOTO_LIMITS.maxSizeBytes / 1024 / 1024} MB each. The first photo is the cover.
          </p>
          <div className="photo-grid">
            {existing?.photos.map((p) => (
              <div key={p.id} className="photo-grid__item">
                <img src={p.url} alt="" />
                <span className="photo-grid__tag">Saved</span>
              </div>
            ))}
            {photos.map((p, index) => (
              <div key={p.id} className="photo-grid__item">
                <img src={p.previewUrl} alt={`New photo ${index + 1}`} />
                {existingPhotoCount === 0 && index === 0 && <span className="photo-grid__tag">Cover</span>}
                <button type="button" className="icon-btn icon-btn--sm photo-grid__remove" onClick={() => removePhoto(p.id)} aria-label={`Remove photo ${index + 1}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {totalPhotos < LISTING_PHOTO_LIMITS.maxCount && (
              <button type="button" className="photo-grid__add" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={26} />
                <span>Add photos</span>
                <span className="text-muted tabular">
                  {totalPhotos}/{LISTING_PHOTO_LIMITS.maxCount}
                </span>
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept={LISTING_PHOTO_LIMITS.acceptedTypes.join(',')} multiple hidden onChange={addFiles} />
          {photoError && (
            <p className="field__error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
              {photoError}
            </p>
          )}
          <div className="wizard-actions">
            <Button icon={<ArrowLeft size={16} />} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" onClick={goToPreview}>
              Preview <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && category && (
        <section className="card">
          <h2 className="card-title">Preview</h2>
          <p className="card-subtitle">This is how buyers will see your ad once it is approved.</p>
          <div className="ad-preview">
            <div className="ad-preview__media">
              <ListingImage listing={photos.length ? previewListing : { ...previewListing, photos: existing?.photos ?? [] }} iconSize={72} />
            </div>
            <div className="ad-preview__body">
              <span className="badge badge--primary">
                {category.name} - {LISTING_TYPE_LABELS[form.listingType]}
              </span>
              <h3 className="detail__title">{form.title}</h3>
              <p className="detail__price tabular">{formatPrice(Number(form.price), form.listingType)}</p>
              <p className="text-muted">
                <MapPin size={14} /> {form.district}, {form.city}
              </p>
              <dl className="spec-grid spec-grid--compact">
                {category.fields.map((f) =>
                  form.attributes[f.fieldKey] ? (
                    <div key={f.fieldKey}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.inputType === 'number' && f.fieldKey !== 'year' ? formatNumber(Number(form.attributes[f.fieldKey])) : form.attributes[f.fieldKey]}
                        {f.unit ? ` ${f.unit}` : ''}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
              <p className="detail__description">{form.description}</p>
            </div>
          </div>
          <div className="wizard-actions">
            <Button icon={<ArrowLeft size={16} />} onClick={() => setStep(2)} disabled={Boolean(submitting)}>
              Back
            </Button>
            <div className="wizard-actions__group">
              {(!existing || existing.status === 'draft') && (
                <Button onClick={() => save('draft')} isLoading={submitting === 'draft'} disabled={Boolean(submitting)}>
                  Save as draft
                </Button>
              )}
              <Button variant="primary" icon={<Send size={16} />} onClick={() => save('submit')} isLoading={submitting === 'submit'} disabled={Boolean(submitting)}>
                {existing?.status === 'pending_review' ? 'Save changes' : 'Submit for review'}
              </Button>
            </div>
          </div>
        </section>
      )}

      {step > 0 && !isEdit && (
        <p className="text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          Leaving this page discards unsaved changes.
          <button type="button" className="link link--button" style={{ marginInlineStart: 6 }} onClick={() => navigate('/account/listings')}>
            Cancel
          </button>
        </p>
      )}
    </>
  );
}
