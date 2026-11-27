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
import { t, tn } from '../../i18n';

type Tab = 'general' | 'announcement' | 'ads' | 'promotions' | 'pages';
type Errors = Record<string, string>;

const TABS: { value: Tab; label: string }[] = [
  { value: 'general', label: t('Contact & social') },
  { value: 'announcement', label: t('Announcement') },
  { value: 'ads', label: t('Ads') },
  { value: 'promotions', label: t('Paid promotion') },
  { value: 'pages', label: t('Pages') },
];

const SOCIAL: { key: SocialNetwork; label: string; placeholder: string }[] = [
  { key: 'x', label: t('X (Twitter)'), placeholder: 'https://x.com/finovosouq' },
  { key: 'instagram', label: t('Instagram'), placeholder: 'https://instagram.com/finovosouq' },
  { key: 'facebook', label: t('Facebook'), placeholder: 'https://facebook.com/finovosouq' },
  { key: 'tiktok', label: t('TikTok'), placeholder: 'https://tiktok.com/@finovosouq' },
  { key: 'youtube', label: t('YouTube'), placeholder: 'https://youtube.com/@finovosouq' },
];

const PROMOTION_DAYS = [3, 7, 14, 30];

const PAGES: { value: LegalPageSlug; label: string }[] = [
  { value: 'help', label: t('Help centre') },
  { value: 'safety', label: t('Safety tips') },
  { value: 'terms', label: t('Terms of use') },
  { value: 'privacy', label: t('Privacy policy') },
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
          {t('Save changes')}
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
  const [promotionsOn, setPromotionsOn] = useState(initial.promotions.enabled);
  // One row per package length; an empty price means the package is not offered
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(PROMOTION_DAYS.map((days) => [days, String(initial.promotions.packages.find((p) => p.days === days)?.price ?? '')])),
  );
  const [pages, setPages] = useState(initial.pages);
  const [pageSlug, setPageSlug] = useState<LegalPageSlug>('help');
  const [previewing, setPreviewing] = useState(false);
  const [pageLanguage, setPageLanguage] = useState<'en' | 'ar'>('en');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const page = pages[pageSlug];

  const save = async (request: () => Promise<void>, message: string) => {
    setSaving(true);
    setErrors({});
    try {
      await request();
      toast.show({ title: t(message) });
    } catch (error) {
      setErrors(toErrors(error));
    } finally {
      setSaving(false);
    }
  };

  const savePage = () =>
    save(async () => {
      const saved = await settingsService.adminSavePage(pageSlug, { title: page.title, body: page.body, titleAr: page.titleAr ?? '', bodyAr: page.bodyAr ?? '' });
      setPages((p) => ({ ...p, [pageSlug]: saved }));
    }, 'Page published');

  const switchTab = (next: Tab) => {
    setTab(next);
    setErrors({});
  };

  return (
    <>
      <div className="segmented segmented--scroll settings-tabs" role="tablist" aria-label={t('Settings sections')}>
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className="segmented__item" onClick={() => switchTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Section
          title={t('Contact & social')}
          text={t('Shown in the footer, on the Contact page and in the FAQ.')}
          onSave={() => save(() => settingsService.adminSave({ contact, social }), 'Contact details saved')}
          saving={saving}
          errors={errors}
        >
          <div className="form-grid">
            <InputField label={t('Support email')} required type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} error={errors['contact.email']} />
            <InputField
              label={t('Support phone')}
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              error={errors['contact.phone']}
              placeholder="+966 11 000 0000"
              hint={t('Leave empty to hide it.')}
            />
            <InputField label={t('Support hours')} value={contact.hours} onChange={(e) => setContact({ ...contact, hours: e.target.value })} error={errors['contact.hours']} maxLength={80} />
            <InputField label={t('Office city')} value={t(contact.city)} onChange={(e) => setContact({ ...contact, city: e.target.value })} error={errors['contact.city']} maxLength={60} />
          </div>
          <h3 className="settings-section__subtitle">{t('Social links')}</h3>
          <div className="form-grid">
            {SOCIAL.map((s) => (
              <InputField
                key={s.key}
                label={s.label}
                type="url"
                value={social[s.key]}
                onChange={(e) => setSocial({ ...social, [s.key]: e.target.value })}
                error={errors[`social.${s.key}`]}
                placeholder={s.placeholder}
              />
            ))}
          </div>
        </Section>
      )}

      {tab === 'announcement' && (
        <Section
          title={t('Announcement bar')}
          text={t('A short message at the top of every public page, for example a holiday notice or a new feature.')}
          onSave={() => save(() => settingsService.adminSave({ announcement }), 'Announcement saved')}
          saving={saving}
          errors={errors}
        >
          <label className="checkbox">
            <input type="checkbox" checked={announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} />
            {t('Show the announcement')}
          </label>
          <div className="form-grid">
            <TextareaField
              wrapperClassName="form-grid__full"
              label={t('Message')}
              rows={2}
              value={announcement.text}
              onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })}
              error={errors['announcement.text']}
              maxLength={200}
              hint={`${announcement.text.length}/200`}
            />
            <SelectField
              label={t('Style')}
              value={announcement.tone}
              onChange={(tone) => setAnnouncement({ ...announcement, tone: tone as 'info' | 'warning' })}
              options={[
                { value: 'info', label: t('Information (purple)') },
                { value: 'warning', label: t('Warning (amber)') },
              ]}
            />
            <InputField
              label={t('Link (optional)')}
              value={announcement.link}
              onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
              error={errors['announcement.link']}
              placeholder="/safety or https://..."
            />
          </div>
          {announcement.text.trim() && (
            <div className="settings-preview">
              <p className="field__label">{t('Preview')}</p>
              <div className={`announcement announcement--${announcement.tone}`}>
                <div className="announcement__inner">
                  <Megaphone size={16} aria-hidden="true" />
                  <p>
                    {announcement.text}
                    {announcement.link && <span className="announcement__link">{t('Learn more')}</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {tab === 'ads' && (
        <Section
          title={t('Ads')}
          text={t('Rules for every new ad and photo upload.')}
          onSave={() => save(() => settingsService.adminSave({ listings: { maxPhotos: Number(maxPhotos), expiryDays: Number(expiryDays) } }), 'Ad settings saved')}
          saving={saving}
          errors={errors}
        >
          <div className="form-grid">
            <InputField
              label={t('Photos per ad')}
              type="number"
              min={1}
              max={20}
              value={maxPhotos}
              onChange={(e) => setMaxPhotos(e.target.value)}
              error={errors['listings.maxPhotos']}
              hint={t('Between 1 and 20. Existing ads keep their photos.')}
            />
            <InputField
              label={t('Days an ad stays live')}
              type="number"
              min={7}
              max={180}
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              error={errors['listings.expiryDays']}
              hint={t('Between 7 and 180. Sellers get a reminder 3 days before and can renew with one click.')}
            />
          </div>
        </Section>
      )}

      {tab === 'promotions' && (
        <Section
          title={t('Paid promotion')}
          text={t('Sellers pay by card to show an ad at the top of search and on the home page. Prices are in riyals and include any tax.')}
          onSave={() =>
            save(
              () =>
                settingsService.adminSave({
                  promotions: {
                    enabled: promotionsOn,
                    packages: PROMOTION_DAYS.filter((days) => prices[days].trim()).map((days) => ({ days, price: Number(prices[days]) })),
                  },
                }),
              'Promotion prices saved',
            )
          }
          saving={saving}
          errors={errors}
        >
          {!initial.promotions.paymentsConfigured && (
            <div className="alert alert--warning" role="status">
              {t('Card payments are not set up on the server yet (STRIPE_SECRET_KEY), so sellers cannot buy a promotion. You can still feature ads for free from Promotions.')}
            </div>
          )}
          <label className="checkbox">
            <input type="checkbox" checked={promotionsOn} onChange={(e) => setPromotionsOn(e.target.checked)} />
            {t('Let sellers buy a promotion')}
          </label>
          {errors['promotions.packages'] && <p className="field__error">{errors['promotions.packages']}</p>}
          <div className="form-grid">
            {PROMOTION_DAYS.map((days) => (
              <InputField
                key={days}
                label={tn(days, '{count} day', '{count} days')}
                type="number"
                inputMode="numeric"
                min={5}
                max={5000}
                suffix={<span className="text-muted">{t('SAR')}</span>}
                placeholder={t('Not offered')}
                value={prices[days]}
                onChange={(e) => setPrices((p) => ({ ...p, [days]: e.target.value }))}
                error={errors[`promotions.price${days}`]}
              />
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
            {t('Leave a price empty to stop offering that package. A new purchase adds its days after any promotion the ad already has.')}
          </p>
        </Section>
      )}

      {tab === 'pages' && (
        <Section title={t('Pages')} text={t('Help centre, safety tips, terms and privacy policy, shown to every visitor.')} onSave={savePage} saving={saving} errors={errors}>
          <div className="settings-pages__bar">
            <div className="segmented" role="tablist" aria-label={t('Page')}>
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
            <div className="segmented" role="tablist" aria-label={t('Language')}>
              {(['en', 'ar'] as const).map((lang) => (
                <button key={lang} type="button" role="tab" aria-selected={pageLanguage === lang} className="segmented__item" onClick={() => setPageLanguage(lang)}>
                  {lang === 'en' ? 'English' : 'العربية'}
                </button>
              ))}
            </div>
            <div className="settings-pages__tools">
              <span className="text-muted">
                {t('Updated')} {formatDate(page.updatedAt)}
              </span>
              <Button size="sm" icon={previewing ? <Pencil size={14} /> : <Eye size={14} />} onClick={() => setPreviewing((v) => !v)}>
                {previewing ? t('Edit') : t('Preview')}
              </Button>
              <Link to={`/${pageSlug}`} target="_blank" className="link settings-pages__open">
                {t('Open page')} <ExternalLink size={13} />
              </Link>
            </div>
          </div>
          {pageLanguage === 'ar' && <p className="text-muted settings-pages__note">{t('Leave the Arabic version empty to show the English page on the Arabic site.')}</p>}
          <InputField
            label={pageLanguage === 'ar' ? t('Arabic title') : t('Title')}
            dir={pageLanguage === 'ar' ? 'rtl' : 'ltr'}
            value={(pageLanguage === 'ar' ? page.titleAr : page.title) ?? ''}
            onChange={(e) => setPages({ ...pages, [pageSlug]: { ...page, [pageLanguage === 'ar' ? 'titleAr' : 'title']: e.target.value } })}
            error={pageLanguage === 'ar' ? errors.titleAr : errors.title}
            maxLength={80}
          />
          {previewing ? (
            <div className="settings-preview settings-preview--page" dir={pageLanguage === 'ar' ? 'rtl' : 'ltr'}>
              <RichText text={(pageLanguage === 'ar' ? page.bodyAr : page.body) ?? ''} />
            </div>
          ) : (
            <TextareaField
              label={pageLanguage === 'ar' ? t('Arabic content') : t('Content')}
              rows={18}
              dir={pageLanguage === 'ar' ? 'rtl' : 'ltr'}
              className="settings-pages__editor"
              value={(pageLanguage === 'ar' ? page.bodyAr : page.body) ?? ''}
              onChange={(e) => setPages({ ...pages, [pageSlug]: { ...page, [pageLanguage === 'ar' ? 'bodyAr' : 'body']: e.target.value } })}
              error={pageLanguage === 'ar' ? errors.bodyAr : errors.body}
              maxLength={20000}
              hint={t('Start a line with "## " for a heading and "- " for a list item. Wrap words in **double stars** for bold. Leave an empty line between paragraphs.')}
            />
          )}
        </Section>
      )}
    </>
  );
}

export function SettingsPage() {
  useDocumentTitle(t('Settings'));
  const settings = useAsync(() => settingsService.adminGet(), []);

  return (
    <>
      <PageHeader title={t('Settings')} subtitle={t('Site-wide details that change without a new release.')} />
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={settings.reload} />
      ) : settings.isLoading || !settings.data ? (
        <SkeletonBlock height={420} />
      ) : (
        <SettingsForm initial={settings.data} />
      )}
    </>
  );
}
