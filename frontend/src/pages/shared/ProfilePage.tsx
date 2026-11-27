import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { BadgeCheck, CalendarDays, Camera, Mail, MapPin, Phone, Save, Trash2, Undo2 } from 'lucide-react';
import { ApiError, getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/toast-context';
import { SAUDI_CITIES } from '../../config/app.config';
import { useAuth } from '../../features/auth/context/useAuth';
import { normalizeSaudiPhone } from '../../features/auth/validation';
import { ROLE_LABELS } from '../../features/auth/rbac';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { authService } from '../../services/auth.service';
import type { User } from '../../types';
import { formatDate } from '../../utils/format';
import { t } from '../../i18n';

export function ProfilePage() {
  useDocumentTitle(t('Profile'));
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', city: user?.city ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const dirty = form.name !== user.name || form.phone !== (user.phone ?? '') || form.city !== (user.city ?? '');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = t('Enter your full name.');
    if (form.phone.trim() && !normalizeSaudiPhone(form.phone)) next.phone = t('Enter a Saudi mobile number, e.g. 05XXXXXXXX.');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const updated = await authService.updateMe({ name: form.name.trim(), phone: normalizeSaudiPhone(form.phone), city: form.city || null });
      setUser(updated);
      toast.show({ title: t('Profile updated') });
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      toast.show({ title: t('Could not save profile'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (request: () => Promise<User>, done: string) => {
    setAvatarBusy(true);
    try {
      setUser(await request());
      toast.show({ title: done });
    } catch (error) {
      toast.show({ title: t('Could not update photo'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.show({ title: t('Choose a JPG, PNG or WebP photo up to 5 MB'), tone: 'error' });
      return;
    }
    void changeAvatar(() => authService.uploadAvatar(file), 'Profile photo updated');
  };

  const changeDeletion = async (request: () => Promise<void>, done: { title: string; message?: string }, failed: string) => {
    setDeleting(true);
    try {
      await request();
      setUser(await authService.getProfile());
      toast.show(done);
      setDeleteOpen(false);
    } catch (error) {
      toast.show({ title: failed, message: getErrorMessage(error), tone: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const requestDeletion = () =>
    changeDeletion(
      () => authService.requestDeletion(deleteReason.trim()),
      { title: t('Request received'), message: t('Our team will delete your account within 30 days. You can cancel until then.') },
      'Could not send request',
    );

  const cancelDeletion = () => changeDeletion(() => authService.cancelDeletion(), { title: t('Deletion request cancelled') }, 'Could not cancel the request');

  return (
    <>
      <PageHeader title={t('Profile and settings')} subtitle={t('Your public name and city are shown on your ads.')} />
      <div className="dash-grid">
        <section className="card span-4 profile-card">
          <div className="profile-card__cover" aria-hidden="true" />
          <div className="profile-card__head">
            <div className="avatar-edit">
              <Avatar name={user.name} src={user.avatarUrl} size="xl" />
              <button type="button" className="avatar-edit__button" onClick={() => avatarInput.current?.click()} disabled={avatarBusy} aria-label={t('Change profile photo')}>
                {avatarBusy ? <span className="btn__spinner" /> : <Camera size={15} />}
              </button>
              <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickAvatar} />
            </div>
            <div>
              <h2 className="profile-card__name">{user.name}</h2>
              <Badge tone="primary">{ROLE_LABELS[user.role]}</Badge>
              {user.avatarUrl && (
                <button type="button" className="link-button" onClick={() => void changeAvatar(() => authService.removeAvatar(), 'Profile photo removed')} disabled={avatarBusy}>
                  {t('Remove photo')}
                </button>
              )}
            </div>
          </div>
          <ul className="profile-card__rows">
            <li>
              <span className="profile-card__icon">
                <Phone size={16} />
              </span>
              <span className="profile-card__text">
                <span>{t('Phone')}</span>
                <strong className="tabular" dir="ltr">
                  {user.phone ?? t('Not added')}
                </strong>
              </span>
            </li>
            <li>
              <span className="profile-card__icon">
                <Mail size={16} />
              </span>
              <span className="profile-card__text">
                <span>{t('Email')}</span>
                <strong>{user.email}</strong>
              </span>
              {user.isEmailVerified && (
                <Badge tone="success" icon={<BadgeCheck size={12} />}>
                  {t('Verified')}
                </Badge>
              )}
            </li>
            <li>
              <span className="profile-card__icon">
                <MapPin size={16} />
              </span>
              <span className="profile-card__text">
                <span>{t('City')}</span>
                <strong>{user.city ? t(user.city) : t('Not set')}</strong>
              </span>
            </li>
            <li>
              <span className="profile-card__icon">
                <CalendarDays size={16} />
              </span>
              <span className="profile-card__text">
                <span>{t('Member since')}</span>
                <strong>{formatDate(user.createdAt)}</strong>
              </span>
            </li>
          </ul>
        </section>

        <section className="card span-8">
          <h2 className="card-title">{t('Account details')}</h2>
          <p className="card-subtitle">{t('Update how your name and location appear to others.')}</p>
          <form className="form-grid" style={{ marginTop: 'var(--space-5)' }} onSubmit={save} noValidate>
            <InputField label={t('Full name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={80} />
            <InputField
              label={t('Phone number')}
              type="tel"
              inputMode="tel"
              placeholder="05XXXXXXXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              error={errors.phone}
            />
            <SelectField
              label={t('City')}
              value={form.city}
              onChange={(city) => setForm({ ...form, city })}
              placeholder={t('Choose city')}
              options={SAUDI_CITIES.map((c) => ({ value: c, label: t(c) }))}
            />
            <InputField label={t('Email')} value={user.email} disabled hint={t('You sign in with this email, so it cannot be changed here.')} />
            <div className="form-grid__full wizard-actions" style={{ marginTop: 0 }}>
              <span />
              <Button type="submit" variant="primary" icon={<Save size={16} />} isLoading={saving} disabled={!dirty}>
                {t('Save changes')}
              </Button>
            </div>
          </form>
        </section>

        {user.role !== 'admin' && (
          <section className="card span-12 danger-zone">
            {user.deletionRequestedAt ? (
              <>
                <div>
                  <h2 className="card-title">{t('Deletion requested')}</h2>
                  <p className="card-subtitle">
                    {t('You asked on')} {formatDate(user.deletionRequestedAt)} {t('for your account to be deleted. Our team will process it within 30 days; you can cancel until then.')}
                  </p>
                </div>
                <Button icon={<Undo2 size={16} />} isLoading={deleting} onClick={() => void cancelDeletion()}>
                  {t('Cancel request')}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <h2 className="card-title">{t('Delete account')}</h2>
                  <p className="card-subtitle">{t('Send a request to delete your account and ads. This cannot be undone once processed.')}</p>
                </div>
                <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
                  {t('Request deletion')}
                </Button>
              </>
            )}
          </section>
        )}
      </div>

      <Modal
        open={deleteOpen}
        title={t('Request account deletion?')}
        description={t('Your ads will be removed and you will lose your messages and saved items.')}
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{t('Cancel')}</Button>
            <Button variant="danger" isLoading={deleting} onClick={() => void requestDeletion()}>
              {t('Send request')}
            </Button>
          </>
        }
      >
        <TextareaField label={t('Reason (optional)')} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} maxLength={500} />
      </Modal>
    </>
  );
}
