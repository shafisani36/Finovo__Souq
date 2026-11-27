import { Languages } from 'lucide-react';
import { language, setLanguage } from '../../i18n';

/** Switches between English and Arabic; the page reloads in the chosen language and direction */
export function LanguageSwitch({ dark = false }: { dark?: boolean }) {
  const next = language === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      className={`lang-switch${dark ? ' lang-switch--dark' : ''}`}
      onClick={() => setLanguage(next)}
      lang={next}
      aria-label={next === 'ar' ? 'عرض الموقع بالعربية' : 'View the site in English'}
    >
      <Languages size={16} aria-hidden="true" />
      <span>{next === 'ar' ? 'العربية' : 'English'}</span>
    </button>
  );
}
