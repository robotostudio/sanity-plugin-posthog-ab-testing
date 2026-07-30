'use client';

import { useEffect, useId, useState } from 'react';

/**
 * Page chrome mirroring the Roboto Studio proposals app (EdgeFrame + TopBar):
 * fixed hairline borders down both edges of the 1280px column and along the
 * bottom, and a header sandwich — 1rem spacer strip, rule, 4rem row with the
 * logo cell left and the system/light/dark theme toggle right, rule, spacer.
 * Print/DocuSign actions from the original are intentionally omitted.
 *
 * Theming: the resolved theme lives on <html data-theme="light|dark"> (set
 * before paint by the inline script in app/layout.tsx); the chosen mode
 * persists in localStorage under 'demo-theme'.
 */

type ThemeMode = 'system' | 'light' | 'dark';

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('demo-theme');
    } catch {}
    setMode(stored === 'light' || stored === 'dark' ? stored : 'system');
  }, []);

  // Follow OS changes live while in system mode.
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const select = (next: ThemeMode) => {
    setMode(next);
    try {
      localStorage.setItem('demo-theme', next);
    } catch {}
    applyTheme(next);
  };

  return (
    <div className="theme-toggle">
      <button
        type="button"
        title="System theme"
        data-active={mode === 'system'}
        onClick={() => select('system')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <title>System theme</title>
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </button>
      <button
        type="button"
        title="Light theme"
        data-active={mode === 'light'}
        onClick={() => select('light')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <title>Light theme</title>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      </button>
      <button
        type="button"
        title="Dark theme"
        data-active={mode === 'dark'}
        onClick={() => select('dark')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <title>Dark theme</title>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>
    </div>
  );
}

function RobotoStudioLogo() {
  const clipPathId = useId();
  return (
    <svg
      width="182"
      height="18"
      viewBox="0 0 182 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Roboto Studio"
    >
      <title>Roboto Studio</title>
      <g clipPath={`url(#${clipPathId})`}>
        <path d="M102.556 3.6H113.028H119.889V0H102.556V3.6Z" fill="currentColor" />
        <path d="M109.417 18H113.028V3.6L109.417 7.2V18Z" fill="currentColor" />
        <path d="M16.25 12.24L19.1389 9.36V3.6L15.5278 0H7.22222L3.61111 3.6H15.5278V9.36H7.18972L5.05555 11.4876H3.61111V3.6L0 7.2V18H3.61111V12.2076H10.0822L15.5278 18H19.8611L14.8056 12.24H16.25Z" fill="currentColor" />
        <path d="M28.8889 18H38.2778L41.8889 14.4H28.8889V18Z" fill="currentColor" />
        <path d="M41.8889 0H32.5L28.8889 3.6H41.8889V0Z" fill="currentColor" />
        <path d="M25.2778 7.2V14.4L28.8889 14.4V3.6L25.2778 7.2Z" fill="currentColor" />
        <path d="M41.8889 14.4L45.5 10.8V3.6H41.8889V14.4Z" fill="currentColor" />
        <path d="M94.6111 0H85.2222L81.6111 3.6H94.6111V0Z" fill="currentColor" />
        <path d="M78 7.2V14.4H81.6111V3.6L78 7.2Z" fill="currentColor" />
        <path d="M81.6111 18H91L94.6111 14.4L81.6111 14.4V18Z" fill="currentColor" />
        <path d="M94.6111 14.4L98.2222 10.8V3.6H94.6111V14.4Z" fill="currentColor" />
        <path d="M122.778 7.2V14.4H126.389V3.6L122.778 7.2Z" fill="currentColor" />
        <path d="M126.389 18H135.778L139.389 14.4L126.389 14.4V18Z" fill="currentColor" />
        <path d="M139.389 3.6L139.389 14.4L143 10.8V3.6H139.389Z" fill="currentColor" />
        <path d="M139.389 0H130L126.389 3.6H139.389L139.389 0Z" fill="currentColor" />
        <path d="M58.5 0L54.8889 3.6H68.6111V7.56H57.9222L56.1889 9.72H54.8889V3.6L51.2778 7.2V14.4H54.8889V10.44H68.6111V14.4H54.8889V18H68.6111L72.2222 14.4V10.8H69.3333V9.72L72.2222 6.84V3.6L68.6111 0H58.5Z" fill="currentColor" />
        <g opacity="0.7" fill="currentColor">
          <path d="M151.269 15.1187L150.776 15.0048C150.259 14.891 150.045 14.7046 150.045 14.3665C150.045 14.0076 150.342 13.7833 150.817 13.7833C151.293 13.7833 151.59 14.0248 151.624 14.4217H152.514C152.483 13.5625 151.811 13 150.804 13C149.797 13 149.103 13.5694 149.103 14.4631C149.103 15.1739 149.528 15.6329 150.397 15.8295L150.897 15.9469C151.452 16.0711 151.666 16.2436 151.666 16.568C151.666 16.9579 151.335 17.2063 150.817 17.2063C150.273 17.2063 149.931 16.9683 149.89 16.5507H149C149.034 17.4479 149.714 17.9896 150.804 17.9896C151.893 17.9896 152.604 17.4168 152.604 16.4679C152.604 15.7329 152.197 15.3154 151.269 15.1118V15.1187Z" fill="currentColor" />
          <path d="M154.818 13.9144H156.19V17.8999H157.135V13.9144H158.508V13.0966H154.818V13.9144Z" fill="currentColor" />
          <path d="M163.374 16.1435C163.374 16.7888 163.074 17.1442 162.536 17.1442C161.998 17.1442 161.698 16.7888 161.698 16.1435V13.1001H160.75V16.2022C160.75 17.334 161.412 18 162.536 18C163.66 18 164.322 17.334 164.322 16.2022V13.1001H163.374V16.1435Z" fill="currentColor" />
          <path d="M168.247 13.0966H166.709V17.8999H168.247C169.599 17.8999 170.292 17.0752 170.292 15.4638C170.292 13.8523 169.592 13.0966 168.247 13.0966ZM168.116 17.0856H167.65V13.9144H168.116C168.933 13.9144 169.326 14.4251 169.326 15.481C169.326 16.5369 168.947 17.0856 168.116 17.0856Z" fill="currentColor" />
          <path d="M172.816 13.911H173.809V17.089H172.816V17.8999H175.751V17.089H174.754V13.911H175.751V13.0966H172.816V13.911Z" fill="currentColor" />
          <path d="M180.155 13.0035C179.003 13.0035 178.31 13.7971 178.31 15.1325V15.8675C178.31 17.2029 179.007 17.9965 180.155 17.9965C181.303 17.9965 182 17.2029 182 15.8675V15.1325C182 13.7971 181.307 13.0035 180.155 13.0035ZM181.041 15.8571C181.041 16.7233 180.734 17.158 180.155 17.158C179.576 17.158 179.269 16.7233 179.269 15.8571V15.1429C179.269 14.2767 179.576 13.842 180.155 13.842C180.734 13.842 181.041 14.2767 181.041 15.1429V15.8571Z" fill="currentColor" />
        </g>
      </g>
      <defs>
        <clipPath id={clipPathId}>
          <rect width="182" height="18" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function SiteChrome() {
  return (
    <>
      {/* Fixed vertical borders down both edges of the column */}
      <div className="edge-frame">
        <div className="edge-frame-inner">
          <div className="edge-frame-borders" />
        </div>
      </div>

      {/* Fixed bottom border */}
      <div className="edge-frame-bottom" />

      <header className="site-header">
        <section className="header-band">
          <div className="header-spacer" />
        </section>
        <hr className="header-rule" />
        <section className="header-band">
          <div className="header-row">
            <div className="header-logo">
              <a href="https://robotostudio.com" aria-label="Roboto Studio">
                <RobotoStudioLogo />
              </a>
            </div>
            <ThemeToggle />
          </div>
        </section>
        <hr className="header-rule" />
        <section className="header-band">
          <div className="header-spacer" />
        </section>
      </header>
    </>
  );
}
