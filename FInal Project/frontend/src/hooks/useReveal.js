import { useEffect } from 'react';

// Port of the .gt-reveal IntersectionObserver from main.js.
// Pass a dependency (e.g. the loaded data) so late-rendered elements are observed too.
export default function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll('.gt-reveal:not(.is-visible)');
    if (!els.length) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}
