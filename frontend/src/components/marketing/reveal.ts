import type { CSSProperties } from 'react';

/** Staggers scroll-reveal animations: the nth item starts a little after the one before it */
export function revealDelay(index: number, stepMs = 90): CSSProperties {
  return { '--reveal-delay': `${index * stepMs}ms` } as CSSProperties;
}
