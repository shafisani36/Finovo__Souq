import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

function classes(variant: Variant, size: Size, block?: boolean, extra?: string) {
  return [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  isLoading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'default', size = 'md', block, isLoading, icon, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes(variant, size, block, className)} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...rest}>
      {isLoading ? <span className="btn__spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

export function ButtonLink({ variant = 'default', size = 'md', block, icon, children, className, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
