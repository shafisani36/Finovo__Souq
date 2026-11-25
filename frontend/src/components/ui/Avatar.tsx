import { useState } from 'react';
import { initials } from '../../utils/format';

/** Profile photo, or the person's initials when there is none (or it fails to load) */
export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const [failed, setFailed] = useState(false);
  const className = `avatar${size === 'md' ? '' : ` avatar--${size}`}`;
  if (src && !failed) return <img className={`${className} avatar--photo`} src={src} alt="" aria-hidden="true" onError={() => setFailed(true)} />;
  return (
    <span className={className} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
