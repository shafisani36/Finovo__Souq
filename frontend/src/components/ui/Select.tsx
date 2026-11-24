import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when no option is chosen; also added as the first option that clears the value */
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: 'sm' | 'md';
  /** "bare" drops the field border, for selects placed inside another control such as the search bar */
  variant?: 'field' | 'bare';
  icon?: ReactNode;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

const MENU_MAX_HEIGHT = 280;
const MENU_GAP = 6;

/**
 * Accessible custom dropdown (listbox pattern) that replaces the native select,
 * so the open menu matches the rest of the design on every browser.
 * The menu is rendered in a portal with fixed position so tables, cards and modals never clip it.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  id,
  name,
  disabled = false,
  invalid = false,
  size = 'md',
  variant = 'field',
  icon,
  className,
  ...aria
}: SelectProps) {
  const autoId = useId();
  const buttonId = id ?? `${autoId}-button`;
  const listId = `${autoId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [openUp, setOpenUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const allOptions: SelectOption[] = placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : options;
  const selected = allOptions.find((o) => o.value === value);
  const showPlaceholder = !selected || selected.value === '';

  const close = useCallback(() => setOpen(false), []);

  const openMenu = () => {
    if (disabled) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = spaceBelow < MENU_MAX_HEIGHT && rect.top > spaceBelow;
      const width = Math.max(rect.width, 200);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setOpenUp(up);
      setMenuStyle({
        position: 'fixed',
        left: Math.max(8, left),
        width,
        maxHeight: Math.min(MENU_MAX_HEIGHT, (up ? rect.top : spaceBelow) - MENU_GAP - 8),
        ...(up ? { bottom: window.innerHeight - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }),
      });
    }
    setActiveIndex(Math.max(0, allOptions.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = allOptions[index];
    if (!option) return;
    if (option.value !== value) onChange(option.value);
    setOpen(false);
  };

  // Close on outside click, and when the page scrolls or resizes (the menu is fixed to the screen)
  useEffect(() => {
    if (!open) return undefined;
    const isInside = (target: EventTarget | null) =>
      target instanceof Node && (rootRef.current?.contains(target) || listRef.current?.contains(target));
    const handlePointer = (event: MouseEvent) => {
      if (!isInside(event.target)) close();
    };
    const handleScroll = (event: Event) => {
      if (!isInside(event.target)) close();
    };
    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  // Keep the highlighted option visible while moving with the keyboard
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const last = allOptions.length - 1;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          openMenu();
          return;
        }
        setActiveIndex((i) => (event.key === 'ArrowDown' ? Math.min(last, i + 1) : Math.max(0, i - 1)));
        return;
      }
      case 'Home':
      case 'End':
        if (open) {
          event.preventDefault();
          setActiveIndex(event.key === 'Home' ? 0 : last);
        }
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) choose(activeIndex);
        else openMenu();
        return;
      case 'Escape':
        if (open) {
          // Close only the dropdown, not a modal around it
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        // Type the first letters of an option to jump to it
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const state = typeahead.current;
          window.clearTimeout(state.timer);
          state.text += event.key.toLowerCase();
          state.timer = window.setTimeout(() => (state.text = ''), 600);
          const match = allOptions.findIndex((o) => o.label.toLowerCase().startsWith(state.text));
          if (match >= 0) {
            if (open) setActiveIndex(match);
            else if (allOptions[match].value !== value) onChange(allOptions[match].value);
          }
        }
    }
  };

  return (
    <div
      ref={rootRef}
      className={['dropdown-select', `dropdown-select--${size}`, `dropdown-select--${variant}`, open && 'is-open', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        id={buttonId}
        name={name}
        className="dropdown-select__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        {...aria}
      >
        {icon && <span className="dropdown-select__icon">{icon}</span>}
        <span className={`dropdown-select__value${showPlaceholder ? ' is-placeholder' : ''}`}>{selected?.label ?? placeholder ?? ''}</span>
        <ChevronDown size={16} className="dropdown-select__chevron" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
        <ul ref={listRef} id={listId} role="listbox" aria-labelledby={buttonId} className={`dropdown-select__menu${openUp ? ' is-up' : ''}`} style={menuStyle} tabIndex={-1}>
          {allOptions.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value || '__empty'}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={['dropdown-select__option', index === activeIndex && 'is-active', isSelected && 'is-selected', option.value === '' && 'is-reset'].filter(Boolean).join(' ')}
                onMouseEnter={() => setActiveIndex(index)}
                // mousedown keeps focus on the trigger button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={15} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>,
          document.body,
        )}
    </div>
  );
}
