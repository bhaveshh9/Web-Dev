import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// Shared navbar shell (brand + collapse toggler). Each page passes its own <ul> items.
// Includes the "scrolled" toggle from main.js.
export default function Navbar({ children, brandTo = '/', collapsible = true, right }) {
  useEffect(() => {
    const navbar = document.querySelector('.gt-navbar');
    if (!navbar) return undefined;
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="navbar navbar-expand-lg gt-navbar fixed-top">
      <div className="container">
        <Link className="navbar-brand gt-logo" to={brandTo}>
          <span className="gt-logo-mark"><i className="bi bi-mortarboard-fill"></i></span>
          GemmaTutor AI
        </Link>
        {collapsible ? (
          <>
            <button
              className="navbar-toggler border-0"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#gtNav"
            >
              <i className="bi bi-list fs-2" style={{ color: 'var(--color-navy)' }}></i>
            </button>
            <div className="collapse navbar-collapse" id="gtNav">
              {children}
            </div>
          </>
        ) : (
          right
        )}
      </div>
    </nav>
  );
}
