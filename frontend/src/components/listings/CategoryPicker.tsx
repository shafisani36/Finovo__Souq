import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import type { Category } from '../../types';
import { childrenOf, trailOf } from '../../utils/categories';
import { CategoryIcon } from './CategoryIcon';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onSelect: (category: Category) => void;
}

/**
 * OLX-style drill-down: pick a top-level category, then a subcategory, until a final one is reached.
 * Only final categories can be selected, because ads live there.
 */
export function CategoryPicker({ categories, value, onSelect }: CategoryPickerProps) {
  const selected = categories.find((c) => c.id === value);
  const [parentId, setParentId] = useState<string | null>(selected?.parentId ?? null);
  const parent = categories.find((c) => c.id === parentId);
  const options = childrenOf(categories, parentId);

  const open = (category: Category) => (category.isLeaf ? onSelect(category) : setParentId(category.id));

  return (
    <div className="category-drill">
      <nav className="category-drill__trail" aria-label="Category path">
        {parent ? (
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => setParentId(parent.parentId)} aria-label="Back">
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <button type="button" className="category-drill__crumb" onClick={() => setParentId(null)} disabled={!parent}>
          All categories
        </button>
        {trailOf(categories, parent).map((c) => (
          <span key={c.id} className="category-drill__step">
            <ChevronRight size={14} aria-hidden="true" />
            <button type="button" className="category-drill__crumb" onClick={() => setParentId(c.id)} disabled={c.id === parentId}>
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      {options.length === 0 ? (
        <p className="text-muted">No subcategories are available here yet.</p>
      ) : (
        <div className="category-picker">
          {options.map((c) => {
            const isSelected = c.id === value || selected?.path.includes(c.id);
            const subCount = childrenOf(categories, c.id).length;
            return (
              <button key={c.id} type="button" className={`category-picker__item${isSelected ? ' is-selected' : ''}`} onClick={() => open(c)}>
                <span className="category-picker__top">
                  <span className="category-tile__icon">
                    <CategoryIcon icon={c.icon} size={24} strokeWidth={1.8} />
                  </span>
                  {c.isLeaf ? isSelected && <Check size={18} className="category-picker__mark" /> : <ChevronRight size={18} className="category-picker__mark" />}
                </span>
                <strong>{c.name}</strong>
                <span className="text-muted">{c.isLeaf ? c.description || 'Post your ad here' : `${subCount} ${subCount === 1 ? 'subcategory' : 'subcategories'}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
