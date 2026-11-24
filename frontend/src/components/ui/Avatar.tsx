import { initials } from '../../utils/format';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar${size === 'md' ? '' : ` avatar--${size}`}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
