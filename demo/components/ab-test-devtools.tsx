'use client';

import { useCallback, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import {
  CONTROL_VARIANT_KEY,
  PH_BOOTSTRAP_COOKIE,
  getPostHogCookieName,
} from '@/lib/ab-testing';

interface ABTestInfo {
  distinctId: string | null;
  flags: Record<string, string>;
  posthogLoaded: boolean;
  activeTest: { flagKey: string; variant: string } | null;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? match.split('=')[1] : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

const panel: React.CSSProperties = {
  background: '#1a1a2e',
  color: '#e0e0e0',
  border: '1px solid #333',
  borderRadius: 12,
  padding: 16,
  width: 360,
  maxHeight: '90vh',
  overflowY: 'auto',
  fontFamily: 'monospace',
  fontSize: 13,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};
const label: React.CSSProperties = { color: '#888', marginBottom: 4, fontSize: 11 };
const section: React.CSSProperties = { marginBottom: 12 };
const mono: React.CSSProperties = {
  fontSize: 11,
  wordBreak: 'break-all',
  background: '#111',
  padding: 6,
  borderRadius: 4,
};
const input: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid #444',
  fontSize: 12,
  fontFamily: 'monospace',
  background: '#111',
  color: '#e0e0e0',
};
const btn = (background: string): React.CSSProperties => ({
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  background,
  color: 'white',
  padding: '6px 12px',
  flex: 1,
});

export function ABTestDevtools() {
  const [isOpen, setIsOpen] = useState(false);
  const [info, setInfo] = useState<ABTestInfo>({
    distinctId: null,
    flags: {},
    posthogLoaded: false,
    activeTest: null,
  });
  const [overrideFlag, setOverrideFlag] = useState('');
  const [overrideVariant, setOverrideVariant] = useState('');

  useEffect(() => {
    // Read distinct_id from PostHog's own cookie
    let distinctId: string | null = null;
    const phCookie = getCookie(getPostHogCookieName());
    if (phCookie) {
      try {
        distinctId = JSON.parse(decodeURIComponent(phCookie)).distinct_id;
      } catch {}
    }

    // Read bootstrapped flags from the proxy cookie
    const bootstrapCookie = getCookie(PH_BOOTSTRAP_COOKIE);
    const flags: Record<string, string> = {};
    try {
      if (bootstrapCookie) {
        const parsed = JSON.parse(decodeURIComponent(bootstrapCookie));
        for (const [key, value] of Object.entries(parsed.featureFlags ?? {})) {
          if (typeof value === 'string') flags[key] = value;
        }
      }
    } catch {}

    // Check for an active test from super properties
    const superProps = posthog.__loaded ? (posthog.persistence?.properties?.() ?? {}) : {};
    const activeTest =
      superProps.ab_test_flag && superProps.ab_variant
        ? { flagKey: superProps.ab_test_flag, variant: superProps.ab_variant }
        : null;

    setInfo({ distinctId, flags, posthogLoaded: !!posthog.__loaded, activeTest });
  }, []);

  const handleOverride = useCallback(() => {
    if (!overrideFlag || !overrideVariant || !posthog.__loaded) return;
    posthog.featureFlags.override({ [overrideFlag]: overrideVariant });
    window.location.reload();
  }, [overrideFlag, overrideVariant]);

  const handleClearFlags = () => {
    if (posthog.__loaded) posthog.featureFlags.override(false);
    deleteCookie(PH_BOOTSTRAP_COOKIE);
    window.location.reload();
  };

  const handleResetIdentity = () => {
    deleteCookie(getPostHogCookieName());
    deleteCookie(PH_BOOTSTRAP_COOKIE);
    if (posthog.__loaded) posthog.reset();
    window.location.reload();
  };

  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 99999 }}>
        <button onClick={() => setIsOpen(true)} style={{ ...panel, width: 'auto', padding: '8px 12px', cursor: 'pointer' }}>
          A/B [{info.activeTest?.variant ?? '—'}]
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 99999 }}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>A/B Test Devtools</strong>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
          >
            x
          </button>
        </div>

        <div style={{ ...label, marginBottom: 10 }}>
          PostHog: {info.posthogLoaded ? 'Connected' : 'Not loaded'}
        </div>

        <div style={section}>
          <div style={label}>Distinct ID</div>
          <div style={mono}>{info.distinctId || '—'}</div>
        </div>

        {info.activeTest ? (
          <div style={{ ...section, ...mono, padding: 12 }}>
            <div style={label}>Active Experiment</div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{info.activeTest.flagKey}</div>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontWeight: 'bold',
                background:
                  info.activeTest.variant === CONTROL_VARIANT_KEY ? '#4a3a2d' : '#2d4a2d',
                color: info.activeTest.variant === CONTROL_VARIANT_KEY ? '#cfaa6f' : '#6fcf6f',
              }}
            >
              {info.activeTest.variant}
            </span>
          </div>
        ) : (
          <div style={{ ...section, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
            No active A/B test on this page
          </div>
        )}

        {Object.keys(info.flags).length > 0 && (
          <div style={section}>
            <div style={label}>PostHog Feature Flags</div>
            <div style={{ ...mono, padding: 8 }}>
              {Object.entries(info.flags).map(([key, value]) => (
                <div key={key} style={{ marginBottom: 2 }}>
                  <span style={{ color: '#6fcf6f' }}>{key}</span>: {value}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #333', marginBottom: 12, paddingTop: 12 }}>
          <strong style={{ fontSize: 11, color: '#aaa' }}>CONTROLS</strong>
        </div>

        <div style={section}>
          <div style={label}>Override Feature Flag</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              type="text"
              value={overrideFlag}
              onChange={(e) => setOverrideFlag(e.target.value)}
              placeholder="flag-key"
              style={input}
            />
            <input
              type="text"
              value={overrideVariant}
              onChange={(e) => setOverrideVariant(e.target.value)}
              placeholder="variant"
              style={input}
            />
          </div>
          <button onClick={handleOverride} style={{ ...btn('#2563eb'), width: '100%' }}>
            Override & Reload
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleClearFlags} style={btn('#7c3aed')}>
            Clear Flag Overrides
          </button>
          <button onClick={handleResetIdentity} style={btn('#dc2626')}>
            Reset Identity
          </button>
        </div>
      </div>
    </div>
  );
}
