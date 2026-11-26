import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ApiError, getErrorMessage } from '../../api/errors';
import { CATEGORY_ICON_KEYS, type AdminCategory, type CategoryField, type CategoryPayload, type ListingType } from '../../types';
import { LISTING_TYPE_LABELS } from '../../utils/format';
import { CategoryIcon } from '../listings/CategoryIcon';
import { Button } from '../ui/Button';
import { InputField, SelectField, TextareaField } from '../ui/Field';

const MAX_DEPTH = 4;
const LISTING_TYPES: ListingType[] = ['sale', 'rent', 'service'];
const INPUT_TYPES = [
  { value: 'select', label: 'List of options' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Free text' },
];

/** Field row while editing: options and limits stay strings until the form is saved */
interface FieldDraft {
  uid: string;
  fieldKey: string;
  label: string;
  inputType: CategoryField['inputType'];
  required: boolean;
  filterable: boolean;
  options: string;
  unit: string;
  min: string;
  max: string;
}

const toDraft = (f: CategoryField): FieldDraft => ({
  uid: crypto.randomUUID(),
  fieldKey: f.fieldKey,
  label: f.label,
  inputType: f.inputType,
  required: f.required,
  filterable: f.filterable,
  options: (f.options ?? []).join('\n'),
  unit: f.unit ?? '',
  min: f.min?.toString() ?? '',
  max: f.max?.toString() ?? '',
});

const fromDraft = (d: FieldDraft): CategoryField => ({
  fieldKey: d.fieldKey.trim(),
  label: d.label.trim(),
  inputType: d.inputType,
  required: d.required,
  filterable: d.inputType !== 'text' && d.filterable,
  ...(d.inputType === 'select' && { options: d.options.split('\n').map((o) => o.trim()).filter(Boolean) }),
  ...(d.inputType === 'number' && {
    ...(d.unit.trim() && { unit: d.unit.trim() }),
    ...(d.min !== '' && { min: Number(d.min) }),
    ...(d.max !== '' && { max: Number(d.max) }),
  }),
});

/** "Fuel type" -> "fuelType", so admins rarely need to type a key by hand */
const keyFromLabel = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ''))
    .replace(/^[^a-z]+/, '')
    .slice(0, 30);

interface CategoryFormProps {
  categories: AdminCategory[];
  /** Category being edited, or null to create one */
  category: AdminCategory | null;
  defaultParentId: string | null;
  onSubmit: (payload: CategoryPayload) => Promise<void>;
  onCancel: () => void;
}

export function CategoryForm({ categories, category, defaultParentId, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [parentId, setParentId] = useState(category ? (category.parentId ?? '') : (defaultParentId ?? ''));
  const [description, setDescription] = useState(category?.description ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [listingTypes, setListingTypes] = useState<ListingType[]>(category?.listingTypes ?? []);
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [fields, setFields] = useState<FieldDraft[]>(() => (category?.fields ?? []).map(toDraft));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const parent = categories.find((c) => c.id === parentId);
  const inherited = category ? category.inheritedFields : (parent ? [...parent.inheritedFields.filter((f) => !parent.fields.some((o) => o.fieldKey === f.fieldKey)), ...parent.fields] : []);
  const inheritedTypes = parent?.effectiveListingTypes ?? ['sale'];

  // A category cannot move under itself or its own subcategories, nor too deep, nor under a category that holds ads
  const height = category ? Math.max(0, ...categories.filter((c) => c.path.includes(category.id)).map((c) => c.depth - category.depth)) : 0;
  const parentOptions = categories.filter(
    (c) => !(category && c.path.includes(category.id)) && c.depth + 1 + height < MAX_DEPTH && (c.directListings === 0 || c.id === category?.parentId),
  );

  const updateField = (uid: string, changes: Partial<FieldDraft>) => setFields((list) => list.map((f) => (f.uid === uid ? { ...f, ...changes } : f)));
  const moveField = (index: number, by: number) =>
    setFields((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const addField = () => setFields((list) => [...list, { uid: crypto.randomUUID(), fieldKey: '', label: '', inputType: 'select', required: false, filterable: true, options: '', unit: '', min: '', max: '' }]);

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      await onSubmit({
        name: name.trim(),
        ...(category && slug.trim() !== category.slug && { slug: slug.trim() }),
        parentId: parentId || null,
        description: description.trim(),
        icon: (icon || null) as CategoryPayload['icon'],
        listingTypes,
        isActive,
        fields: fields.map(fromDraft),
      });
    } catch (error) {
      setErrors(error instanceof ApiError && Object.keys(error.fieldErrors).length ? error.fieldErrors : { form: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="category-form">
      {errors.form && (
        <div className="alert alert--danger" role="alert">
          {errors.form}
        </div>
      )}

      <div className="form-grid">
        <InputField label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} placeholder="e.g. Motorcycles" />
        <SelectField
          label="Parent category"
          value={parentId}
          onChange={setParentId}
          error={errors.parentId}
          options={[{ value: '', label: 'None (top level)' }, ...parentOptions.map((c) => ({ value: c.id, label: `${' '.repeat(c.depth)}${c.name}` }))]}
          hint="Categories that already hold ads cannot get subcategories."
        />
        {category && <InputField label="Web address (slug)" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} error={errors.slug} hint="Changing it breaks old links and saved searches." />}
        <TextareaField wrapperClassName="form-grid__full" label="Short description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={160} />
      </div>

      <div className="category-form__section">
        <p className="field__label">Icon</p>
        <div className="icon-grid" role="radiogroup" aria-label="Icon">
          <button type="button" role="radio" aria-checked={!icon} className="icon-grid__item icon-grid__item--text" onClick={() => setIcon('')}>
            {parentId ? 'Same as parent' : 'Default'}
          </button>
          {CATEGORY_ICON_KEYS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={icon === key} aria-label={key} title={key} className="icon-grid__item" onClick={() => setIcon(key)}>
              <CategoryIcon icon={key} size={18} />
            </button>
          ))}
        </div>
        {errors.icon && <span className="field__error">{errors.icon}</span>}
      </div>

      <div className="category-form__section">
        <p className="field__label">Ad types</p>
        <div className="category-form__checks">
          {LISTING_TYPES.map((type) => (
            <label key={type} className="checkbox">
              <input type="checkbox" checked={listingTypes.includes(type)} onChange={(e) => setListingTypes((list) => (e.target.checked ? [...list, type] : list.filter((t) => t !== type)))} />
              {LISTING_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
        <span className="field__hint">{listingTypes.length ? 'Only these types are allowed here.' : `None ticked: same as the parent (${inheritedTypes.map((t) => LISTING_TYPE_LABELS[t]).join(', ')}).`}</span>
        {errors.listingTypes && <span className="field__error">{errors.listingTypes}</span>}
      </div>

      <div className="category-form__section">
        <div className="category-form__fields-head">
          <div>
            <p className="field__label">Ad details</p>
            <span className="field__hint">Questions sellers answer in this category and every subcategory. Filterable ones become search filters.</span>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={addField}>
            Add detail
          </Button>
        </div>

        {inherited.length > 0 && (
          <p className="category-form__inherited">
            Inherited from parent: {inherited.map((f) => f.label).join(', ')}. Add a detail with the same key to change one here.
          </p>
        )}
        {errors.fields && <span className="field__error">{errors.fields}</span>}

        {fields.map((f, index) => {
          const err = (name: string) => errors[`fields.${index}.${name}`];
          return (
            <fieldset key={f.uid} className="field-editor">
              <legend className="sr-only">Detail {index + 1}</legend>
              <div className="field-editor__row">
                <InputField
                  label="Label"
                  value={f.label}
                  onChange={(e) => updateField(f.uid, { label: e.target.value, ...(f.fieldKey === keyFromLabel(f.label) && { fieldKey: keyFromLabel(e.target.value) }) })}
                  error={err('label')}
                  placeholder="e.g. Fuel type"
                />
                <InputField label="Key" value={f.fieldKey} onChange={(e) => updateField(f.uid, { fieldKey: e.target.value })} error={err('fieldKey')} placeholder="fuelType" />
                <SelectField label="Answer type" value={f.inputType} onChange={(value) => updateField(f.uid, { inputType: value as FieldDraft['inputType'] })} options={INPUT_TYPES} error={err('inputType')} />
                <div className="field-editor__tools">
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Move up">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Move down">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => setFields((list) => list.filter((x) => x.uid !== f.uid))} aria-label="Remove detail">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {f.inputType === 'select' && (
                <TextareaField label="Options (one per line)" rows={3} value={f.options} onChange={(e) => updateField(f.uid, { options: e.target.value })} error={err('options')} />
              )}
              {f.inputType === 'number' && (
                <div className="field-editor__row field-editor__row--numbers">
                  <InputField label="Unit" value={f.unit} onChange={(e) => updateField(f.uid, { unit: e.target.value })} maxLength={10} placeholder="km, m²" />
                  <InputField label="Minimum" type="number" value={f.min} onChange={(e) => updateField(f.uid, { min: e.target.value })} error={err('min')} />
                  <InputField label="Maximum" type="number" value={f.max} onChange={(e) => updateField(f.uid, { max: e.target.value })} error={err('max')} />
                </div>
              )}

              <div className="category-form__checks">
                <label className="checkbox">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.uid, { required: e.target.checked })} />
                  Required
                </label>
                {f.inputType !== 'text' && (
                  <label className="checkbox">
                    <input type="checkbox" checked={f.filterable} onChange={(e) => updateField(f.uid, { filterable: e.target.checked })} />
                    Show as a search filter
                  </label>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Visible to everyone (unticking hides this category and all its subcategories)
      </label>

      <div className="category-form__actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" isLoading={saving} onClick={() => void submit()}>
          {category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </div>
  );
}
