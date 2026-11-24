import { useEffect } from 'react';

/**
 * Fades elements marked with data-reveal into view as they scroll in.
 * Content that loads later is picked up as well. Visitors who prefer reduced motion,
 * and browsers without IntersectionObserver, see everything straight away.
 */
export function useScrollReveal(rootId: string, key: string): void {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
      return undefined;
    }

    document.documentElement.classList.add('reveal-on');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const observeNew = () => root.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => observer.observe(el));
    observeNew();
    const mutations = new MutationObserver(observeNew);
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [rootId, key]);
}
