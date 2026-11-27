import { useState, type FormEvent } from 'react';
import { LayoutGrid, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SAUDI_CITIES } from '../../config/app.config';
import type { Category } from '../../types';
import { Select } from '../ui/Select';
import { t } from '../../i18n';

interface SearchBarProps {
  categories: Category[];
  initial?: { q?: string; city?: string; category?: string };
  /** "hero": one white bar with a small caption above every field, for the landing page */
  variant?: 'default' | 'hero';
  /** Hide the category picker when the page has its own (the browse page category chips) */
  showCategory?: boolean;
  /** Other query values to keep when searching again, e.g. price filters and sort order */
  keepParams?: Record<string, string | undefined>;
}

/** Keyword, city and category search that opens the results page */
export function SearchBar({ categories, initial, variant = 'default', showCategory = true, keepParams }: SearchBarProps) {
  const hero = variant === 'hero';
  const navigate = useNavigate();
  const [q, setQ] = useState(initial?.q ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(keepParams ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (q.trim()) params.set('q', q.trim());
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    navigate(`/search${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <form className={`searchbar${hero ? ' searchbar--hero' : ''}`} role="search" onSubmit={handleSubmit}>
      <label className="searchbar__field searchbar__field--grow">
        <Search size={18} aria-hidden="true" />
        <span className="searchbar__body">
          {hero ? <span className="searchbar__caption">{t('Keyword')}</span> : <span className="sr-only">{t('What are you looking for?')}</span>}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={hero ? t('Car, flat, phone, sofa...') : t('What are you looking for?')} maxLength={100} />
        </span>
      </label>
      <div className="searchbar__field searchbar__field--select">
        {hero && (
          <span className="searchbar__caption" aria-hidden="true">
            {t('City')}
          </span>
        )}
        <Select
          variant="bare"
          value={city}
          onChange={setCity}
          placeholder={t('All cities')}
          options={SAUDI_CITIES.map((c) => ({ value: c, label: t(c) }))}
          icon={<MapPin size={18} />}
          aria-label={t('City')}
        />
      </div>
      {showCategory && (
        <div className="searchbar__field searchbar__field--select">
          {hero && (
            <span className="searchbar__caption" aria-hidden="true">
              {t('Category')}
            </span>
          )}
          <Select
            variant="bare"
            value={category}
            onChange={setCategory}
            placeholder={t('All categories')}
            options={categories.filter((c) => c.depth < 2).map((c) => ({ value: c.slug, label: c.depth ? `\u2003${c.name}` : c.name }))}
            icon={<LayoutGrid size={18} />}
            aria-label={t('Category')}
          />
        </div>
      )}
      <button type="submit" className="btn btn--primary searchbar__submit">
        <Search size={18} aria-hidden="true" />
        {t('Search')}
      </button>
    </form>
  );
}
