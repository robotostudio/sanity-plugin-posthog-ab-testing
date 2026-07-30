'use client';

import posthog from 'posthog-js';
import type { Page } from '@/sanity/lib/fetch';

const EXPERIMENT_URL = 'https://us.posthog.com/project/535024/experiments/393767';

/**
 * The demo page renderer — the "exact component tree" both the normal page
 * route and the variant route render. One big button whose color and label
 * come from the Sanity page document.
 */
export function PageView({ page }: { page: Page }) {
  const background = page.buttonColor === 'blue' ? '#2563eb' : '#dc2626';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <button
        type="button"
        data-button-color={page.buttonColor ?? 'red'}
        onClick={() => posthog.capture('demo_button_clicked')}
        style={{
          width: 320,
          height: 320,
          borderRadius: 24,
          border: 'none',
          cursor: 'pointer',
          background,
          color: 'white',
          fontSize: 120,
          fontWeight: 800,
        }}
      >
        {page.buttonLabel ?? '?'}
      </button>
      <p style={{ fontSize: 16, color: '#555' }}>
        This page is part of a live A/B test —{' '}
        <a href={EXPERIMENT_URL} style={{ color: '#2563eb' }}>
          {EXPERIMENT_URL}
        </a>
      </p>
    </main>
  );
}
