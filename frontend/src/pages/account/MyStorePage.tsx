import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { BadgeCheck, Camera, Clock, ExternalLink, ShieldAlert, Store as StoreIcon } from 'lucide-react';
import { ApiError, getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Button, ButtonLink } from '../../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../../components/ui/Field';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { SAUDI_CITIES } from '../../config/app.config';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { storesService } from '../../services/stores.service';
import type { Store, StorePayload } from '../../types';
import { t } from '../../i18n';

type Errors = Partial<Record<keyof StorePayload | 'logo', string>>;

const toForm = (store: Store | null): StorePayload => ({
  name: store?.name ?? '',
  description: store?.description ?? '',
  city: store?.city ?? '',
  commercialRegistration: store?.commercialRegistration ?? '',
});

/** Status banner: what the seller should expect or do next */
function StoreStatusNote({ store }: { store: Store }) {
  if (store.status === 'verified') {
    return (
      <div className="alert alert--success" role="status">
        <BadgeCheck size={18} />
        <span>
          {t('Your store is live with a')} <strong>{t('Verified business')}</strong> {t('badge on all your ads.')}{' '}
          <a href={`/stores/${store.slug}`} target="_blank" rel="noreferrer">
            {t('View store')} <ExternalLink size={13} />
          </a>
        </span>
      </div>
    );
  }
  if (store.status === 'pending') {
    return (
      <div className="alert alert--warning" role="status">
        <Clock size={18} />
        <span>{t('Our team is checking your commercial registration. This usually takes one working day. Your store page goes live once it is verified.')}</span>
      </div>
    );
  }
  return (
    <div className="alert alert--danger" role="status">
      <ShieldAlert size={18} />
      <span>
        {store.status === 'rejected' ? t('Your store was not verified. ') : t('Your store is suspended. ')}
        {store.reviewNote && <strong>{store.reviewNote} </strong>}
        {store.status === 'rejected' ? t('Fix the details below and save to send it again.') : t('Contact us to restore it.')}
      </span>
    </div>
  );
}

/** Sellers open a business page here; it shows after our team checks the commercial registration */
export function MyStorePage() {
  useDocumentTitle(t('My store'));
  const toast = useToast();
  const store = useAsync(() => storesService.mine(), []);
  const [form, setForm] = useState<StorePayload | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  if (store.isLoading) return <LoadingState label={t('Loading your store...')} />;
  if (store.error) return <ErrorState error={store.error} onRetry={store.reload} />;

  const current = store.data ?? null;
  const values = form ?? toForm(current);
  const locked = current?.status === 'suspended';
  const set = (patch: Partial<StorePayload>) => {
    setForm({ ...values, ...patch });
    setErrors({});
  };

  const validate = () => {
    const next: Errors = {};
    if (values.name.trim().length < 2) next.name = t('Enter your business name.');
    if (!/^\d{10}$/.test(values.commercialRegistration.replace(/\s/g, ''))) next.commercialRegistration = t('Enter the 10-digit commercial registration number.');
    if (values.description.length > 1000) next.description = t('Keep the description under 1,000 characters.');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      city: values.city || null,
      commercialRegistration: values.commercialRegistration.replace(/\s/g, ''),
    };
    try {
      const saved = current ? await storesService.update(payload) : await storesService.create(payload);
      store.setData(() => saved);
      setForm(null);
      toast.show({ title: current ? t('Store saved') : t('Store sent for verification'), message: saved.status === 'pending' ? t('Our team will check your details soon.') : undefined });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else toast.show({ title: t('Could not save store'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const changeLogo = async (action: () => Promise<Store>, done: string) => {
    setLogoBusy(true);
    try {
      const updated = await action();
      store.setData(() => updated);
      toast.show({ title: done });
    } catch (error) {
      toast.show({ title: t('Could not update logo'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setLogoBusy(false);
    }
  };

  const pickLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void changeLogo(() => storesService.uploadLogo(file), 'Logo updated');
  };

  return (
    <>
      <PageHeader
        title={t('My store')}
        subtitle={t('A business page for shops, showrooms and agencies, with a Verified business badge on every ad.')}
        actions={
          current?.status === 'verified' ? (
            <ButtonLink to={`/stores/${current.slug}`} icon={<StoreIcon size={16} />}>
              {t('View store')}
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="dash-grid">
        <section className="card span-8">
          {current ? (
            <StoreStatusNote store={current} />
          ) : (
            <p className="text-secondary" style={{ marginTop: 0 }}>
              {t(
                'Personal sellers do not need a store: posting ads is always free. Open one if you sell as a registered business. We check your commercial registration (CR) before the page goes live; the number is never shown to buyers.',
              )}
            </p>
          )}
          <form className="form-grid store-form" onSubmit={save} noValidate>
            <InputField label={t('Business name')} value={values.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} maxLength={60} required disabled={locked} />
            <InputField
              label={t('Commercial registration number')}
              inputMode="numeric"
              value={values.commercialRegistration}
              onChange={(e) => set({ commercialRegistration: e.target.value.replace(/[^\d\s]/g, '') })}
              error={errors.commercialRegistration}
              hint={t('10 digits, as on your CR certificate. Changing it sends your store for checking again.')}
              maxLength={12}
              required
              disabled={locked}
            />
            <SelectField
              label={t('City')}
              value={values.city ?? ''}
              onChange={(city) => set({ city })}
              placeholder={t('Choose city')}
              options={SAUDI_CITIES.map((c) => ({ value: c, label: t(c) }))}
              disabled={locked}
            />
            <TextareaField
              label={t('About your business')}
              value={values.description}
              onChange={(e) => set({ description: e.target.value })}
              error={errors.description}
              maxLength={1000}
              rows={5}
              hint={t('What you sell, opening hours, warranty or delivery you offer.')}
              disabled={locked}
              wrapperClassName="form-grid__full"
            />
            <div className="form-grid__full">
              <Button type="submit" variant="primary" isLoading={saving} disabled={locked || (Boolean(current) && !form)}>
                {current ? t('Save changes') : t('Send for verification')}
              </Button>
            </div>
          </form>
        </section>

        {current && (
          <section className="card span-4 store-logo">
            <h2 className="card-title">{t('Logo')}</h2>
            <div className="avatar-edit">
              <Avatar name={current.name} src={current.logoUrl} size="xl" />
              <button type="button" className="avatar-edit__button" onClick={() => logoInput.current?.click()} disabled={logoBusy || locked} aria-label={t('Change logo')}>
                {logoBusy ? <span className="btn__spinner" /> : <Camera size={15} />}
              </button>
              <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickLogo} />
            </div>
            <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
              {t('Square image, JPG, PNG or WebP, up to 5 MB.')}
            </p>
            {current.logoUrl && (
              <button type="button" className="link-button" onClick={() => void changeLogo(() => storesService.removeLogo(), 'Logo removed')} disabled={logoBusy || locked}>
                {t('Remove logo')}
              </button>
            )}
          </section>
        )}
      </div>
    </>
  );
}
