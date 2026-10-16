import { useEffect, useRef, useState } from 'react';

// Port of the animated stat counters (dashboard.js / index.html inline script).
export default function CountUp({ to, suffix = '', duration = 1100, threshold = 0.4 }) {
  const ref = useRef(null);
  const [text, setText] = useState('0');

  useEffect(() => {
    const target = parseFloat(to);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;

    const animate = () => {
      if (reduceMotion) {
        setText(target + suffix);
        return;
      }
      let start = null;
      const step = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = target % 1 === 0 ? Math.round(eased * target) : (eased * target).toFixed(1);
        setText(value + suffix);
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window && ref.current) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animate();
              io.unobserve(entry.target);
            }
          });
        },
        { threshold }
      );
      io.observe(ref.current);
      return () => {
        io.disconnect();
        cancelAnimationFrame(raf);
      };
    }
    animate();
    return () => cancelAnimationFrame(raf);
  }, [to, suffix, duration, threshold]);

  return (
    <span ref={ref} className="gt-stat-num">
      {text}
    </span>
  );
}
