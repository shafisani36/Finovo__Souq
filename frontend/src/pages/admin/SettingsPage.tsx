import { useState, type ReactNode } from 'react';
import { Eye, ExternalLink, Megaphone, Pencil, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../../components/ui/Field';
import { RichText } from '../../components/ui/RichText';
import { ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { settingsService } from '../../services/settings.service';
import type { AdminSettings, LegalPageSlug, SocialNetwork } from '../../types';
import { formatDate } from '../../utils/format';

type Tab = 'general' | 'announcement' | 'ads' | 'pages';
type Errors = Record<string, string>;

const TABS: { value: Tab; label: string }[] = [
  { value: 'general', label: 'Contact & social' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'ads', label: 'Ads' },
  { value: 'pages', label: 'Pages' },
];

const SOCIAL: { key: SocialNetwork; label: string; placeholder: string }[] = [
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/finovosouq' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/finovosouq' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/finovosouq' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@finovosouq' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@finovosouq' },
];

const PAGES: { value: LegalPageSlug; label: string }[] = [
  { value: 'help', label: 'Help centre' },
  { value: 'safety', label: 'Safety tips' },
  { value: 'terms', label: 'Terms of use' },
  { value: 'privacy', label: 'Privacy policy' },
];

const toErrors = (error: unknown): Errors => (error instanceof ApiError && Object.keys(error.fieldErrors).length ? error.fieldErrors : { form: getErrorMessage(error) });

function Section({ title, text, children, onSave, saving, errors }: { title: string; text: string; children: ReactNode; onSave: () => void; saving: boolean; errors: Errors }) {
  return (
    <section className="card settings-section">
      <div className="settings-section__head">
        <h2 className="card-title">{title}</h2>
        <p className="card-subtitle">{text}</p>
      </div>
      {errors.form && (
        <div className="alert alert--danger" role="alert">
          {errors.form}
        </div>
      )}
      {children}
      <div className="settings-section__actions">
        <Button variant="primary" icon={<Save size={16} />} isLoading={saving} onClick={onSave}>
          Save changes
        </Button>
      </div>
    </section>
  );
}

/** The editable copy of the settings; reset from the server each time the page opens */
function SettingsForm({ initial }: { initial: AdminSettings }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('general');
  const [contact, setContact] = useState(initial.contact);
  const [social, setSocial] = useState(initial.social);
  const [announcement, setAnnouncement] = useState(initial.announcement);
  const [maxPhotos, setMaxPhotos] = useState(String(initial.listings.maxPhotos));
  const [expiryDays, setExpiryDays] = useState(String(initial.listings.expiryDays ?? 30));
  const [pages, setPages] = useState(initial.pages);
  const [pageSlug, setPageSlug] = useState<LegalPageSlug>('help');
  const [previewing, setPreviewing] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const page = pages[pageSlug];

  const save = async (request: () => Promise<void>, message: string) => {
    setSaving(true);
    setErrors({});
    try {
      await request();
      toast.show({ title: message });
    } catch (error) {
      setErrors(toErrors(error));
    } finally {
      setSaving(false);
    }
  };

  const savePage = () =>
    save(async () => {
      const saved = await settingsService.adminSavePage(pageSlug, { title: page.title, body: page.body });
      setPages((p) => ({ ...p, [pageSlug]: saved }));
    }, 'Page published');

  const switchTab = (next: Tab) => {
    setTab(next);
    setErrors({});
  };

  return (
    <>
      <div className="segmented segmented--scroll settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className="segmented__item" onClick={() => switchTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Section title="Contact & social" text="Shown in the footer, on the Contact page and in the FAQ." onSave={() => save(() => settingsService.adminSave({ contact, social }), 'Contact details saved')} saving={saving} errors={errors}>
          <div className="form-grid">
            <InputField label="Support email" required type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} error={errors['contact.email']} />
            <InputField label="Support phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} error={errors['contact.phone']} placeholder="+966 11 000 0000" hint="Leave empty to hide it." />
            <InputField label="Support hours" value={contact.hours} onChange={(e) => setContact({ ...contact, hours: e.target.value })} error={errors['contact.hours']} maxLength={80} />
            <InputField label="Office city" value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} error={errors['contact.city']} maxLength={60} />
          </div>
          <h3 className="settings-section__subtitle">Social links</h3>
          <div className="form-grid">
            {SOCIAL.map((s) => (
              <InputField key={s.key} label={s.label} type="url" value={social[s.key]} onChange={(e) => setSocial({ ...social, [s.key]: e.target.value })} error={errors[`social.${s.key}`]} placeholder={s.placeholder} />
            ))}
          </div>
        </Section>
      )}

      {tab === 'announcement' && (
        <Section title="Announcement bar" text="A short message at the top of every public page, for example a holiday notice or a new feature." onSave={() => save(() => settingsService.adminSave({ announcement }), 'Announcement saved')} saving={saving} errors={errors}>
          <label className="checkbox">
            <input type="checkbox" checked={announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} />
            Show the announcement
          </label>
          <div className="form-grid">
            <TextareaField wrapperClassName="form-grid__full" label="Message" rows={2} value={announcement.text} onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })} error={errors['announcement.text']} maxLength={200} hint={`${announcement.text.length}/200`} />
            <SelectField label="Style" value={announcement.tone} onChange={(tone) => setAnnouncement({ ...announcement, tone: tone as 'info' | 'warning' })} options={[{ value: 'info', label: 'Information (purple)' }, { value: 'warning', label: 'Warning (amber)' }]} />
            <InputField label="Link (optional)" value={announcement.link} onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })} error={errors['announcement.link']} placeholder="/safety or https://..." />
          </div>
          {announcement.text.trim() && (
            <div className="settings-preview">
              <p className="field__label">Preview</p>
              <div className={`announcement announcement--${announcement.tone}`}>
                <div className="announcement__inner">
                  <Megaphone size={16} aria-hidden="true" />
                  <p>
                    {announcement.text}
                    {announcement.link && <span className="announcement__link">Learn more</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {tab === 'ads' && (
        <Section title="Ads" text="Rules for every new ad and photo upload." onSave={() => save(() => settingsService.adminSave({ listings: { maxPhotos: Number(maxPhotos), expiryDays: Number(expiryDays) } }), 'Ad settings saved')} saving={saving} errors={errors}>
          <div className="form-grid">
            <InputField label="Photos per ad" type="number" min={1} max={20} value={maxPhotos} onChange={(e) => setMaxPhotos(e.target.value)} error={errors['listings.maxPhotos']} hint="Between 1 and 20. Existing ads keep their photos." />
            <InputField label="Days an ad stays live" type="number" min={7} max={180} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} error={errors['listings.expiryDays']} hint="Between 7 and 180. Sellers get a reminder 3 days before and can renew with one click." />
          </div>
        </Section>
      )}

      {tab === 'pages' && (
        <Section title="Pages" text="Help centre, safety tips, terms and privacy policy, shown to every visitor." onSave={savePage} saving={saving} errors={errors}>
          <div className="settings-pages__bar">
            <div className="segmented" role="tablist" aria-label="Page">
              {PAGES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="tab"
                  aria-selected={pageSlug === p.value}
                  className="segmented__item"
                  onClick={() => {
                    setPageSlug(p.value);
                    setErrors({});
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="settings-pages__tools">
              <span className="text-muted">Updated {formatDate(page.updatedAt)}</span>
              <Button size="sm" icon={previewing ? <Pencil size={14} /> : <Eye size={14} />} onClick={() => setPreviewing((v) => !v)}>
                {previewing ? 'Edit' : 'Preview'}
              </Button>
              <Link to={`/${pageSlug}`} target="_blank" className="link settings-pages__open">
                Open page <ExternalLink size={13} />
              </Link>
            </div>
          </div>
          <InputField label="Title" value={page.title} onChange={(e) => setPages({ ...pages, [pageSlug]: { ...page, title: e.target.value } })} error={errors.title} maxLength={80} />
          {previewing ? (
            <div className="settings-preview settings-preview--page">
              <RichText text={page.body} />
            </div>
          ) : (
            <TextareaField
              label="Content"
              rows={18}
              className="settings-pages__editor"
              value={page.body}
              onChange={(e) => setPages({ ...pages, [pageSlug]: { ...page, body: e.target.value } })}
              error={errors.body}
              maxLength={20000}
              hint='Start a line with "## " for a heading and "- " for a list item. Wrap words in **double stars** for bold. Leave an empty line between paragraphs.'
            />
          )}
        </Section>
      )}
    </>
  );
}

export function SettingsPage() {
  useDocumentTitle('Settings');
  const settings = useAsync(() => settingsService.adminGet(), []);

  return (
    <>
      <PageHeader title="Settings" subtitle="Site-wide details that change without a new release." />
      {settings.error ? <ErrorState error={settings.error} onRetry={settings.reload} /> : settings.isLoading || !settings.data ? <SkeletonBlock height={420} /> : <SettingsForm initial={settings.data} />}
    </>
  );
}
