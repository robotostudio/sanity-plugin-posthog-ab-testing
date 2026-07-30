'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEMO_BUTTON_CLICK_EVENT,
  type DemoButtonClickDetail,
} from '@/lib/demo-button-click';
import type { ExperimentStats, VariantStats } from '@/lib/experiment-stats';

/**
 * Client half of the live results panel: renders the two variant cards and
 * keeps them fresh by polling /api/experiment-stats (served through a 15s
 * shared server cache). The visitor's own presses (announced via a window
 * event from DemoPushButton) bump the numbers optimistically.
 *
 * The optimistic deltas — and the server snapshot they were computed against —
 * persist in localStorage, so a hard refresh right after clicking still shows
 * the clicks while PostHog ingestion catches up. Each fresh server payload
 * absorbs the deltas by however much the server caught up (clamped at zero),
 * so displayed numbers never dip below what the visitor already saw.
 *
 * Variant KEYS ('control' / 'blue') are the PostHog flag keys and must not
 * change; only the visual color ('white' / 'black') did.
 */

const CARDS = [
  { key: 'control', color: 'white', title: 'White "A" (control)' },
  { key: 'blue', color: 'black', title: 'Black "B"' },
] as const;

const POLL_MS = 20_000;
const POST_CLICK_FETCH_MS = 4_000;
const STORAGE_KEY = 'demo-stat-deltas';

type Delta = { clicks: number; clickers: number };
type Deltas = { control: Delta; blue: Delta };
type StoredDeltas = { baseline: ExperimentStats; deltas: Deltas };

const ZERO_DELTAS: Deltas = {
  control: { clicks: 0, clickers: 0 },
  blue: { clicks: 0, clickers: 0 },
};

const KEY_BY_COLOR = { white: 'control', black: 'blue' } as const;

function ctr(stats: VariantStats): string {
  if (stats.exposures === 0) return '—';
  // Optimistic bumps can momentarily outrun the exposure count; a >100% CTR
  // reads as broken, so cap the display.
  return `${(Math.min(1, stats.clickers / stats.exposures) * 100).toFixed(1)}%`;
}

function share(stats: VariantStats, total: number): string {
  if (total === 0) return '—';
  return `${((stats.exposures / total) * 100).toFixed(0)}%`;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-value">{value}</span>
    </div>
  );
}

function readStored(): StoredDeltas | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDeltas;
    return parsed?.baseline && parsed?.deltas ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(baseline: ExperimentStats | null, deltas: Deltas) {
  try {
    if (!baseline) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseline, deltas }));
  } catch {}
}

export function ExperimentStatsCards({
  stats,
  currentVariant,
}: {
  stats: ExperimentStats | null;
  currentVariant: 'white' | 'black' | null;
}) {
  const [serverStats, setServerStats] = useState(stats);
  const [deltas, setDeltas] = useState<Deltas>(ZERO_DELTAS);
  // Server snapshot the current deltas were computed against.
  const baselineRef = useRef<ExperimentStats | null>(stats);
  const deltasRef = useRef<Deltas>(ZERO_DELTAS);
  deltasRef.current = deltas;

  /** Fold a fresh server payload in: shrink deltas by the server's growth. */
  const absorb = useCallback((fresh: ExperimentStats) => {
    const base = baselineRef.current;
    const d = deltasRef.current;
    const next: Deltas = !base
      ? d
      : {
          control: {
            clicks: Math.max(0, base.control.clicks + d.control.clicks - fresh.control.clicks),
            clickers: Math.max(0, base.control.clickers + d.control.clickers - fresh.control.clickers),
          },
          blue: {
            clicks: Math.max(0, base.blue.clicks + d.blue.clicks - fresh.blue.clicks),
            clickers: Math.max(0, base.blue.clickers + d.blue.clickers - fresh.blue.clickers),
          },
        };
    baselineRef.current = fresh;
    writeStored(fresh, next);
    setServerStats(fresh);
    setDeltas(next);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/experiment-stats', { cache: 'no-store' });
      if (!res.ok) return;
      const fresh = (await res.json()) as ExperimentStats | null;
      if (fresh) absorb(fresh);
    } catch {}
  }, [absorb]);

  // Restore persisted deltas from a previous visit, then poll while visible.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      baselineRef.current = stored.baseline;
      setDeltas(stored.deltas);
    }
    refetch();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refetch();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refetch]);

  // Optimistic bump on button press, plus a quick follow-up fetch.
  useEffect(() => {
    let burstTimer: ReturnType<typeof setTimeout> | null = null;
    const onClick = (event: Event) => {
      const { color } = (event as CustomEvent<DemoButtonClickDetail>).detail;
      const key = KEY_BY_COLOR[color];
      // "Unique clickers" only grows the first time this visitor EVER clicks —
      // persisted so remounts and revisits don't re-bump someone the server
      // already counts as a clicker.
      let firstClick = false;
      try {
        firstClick = !localStorage.getItem('demo-has-clicked');
        if (firstClick) localStorage.setItem('demo-has-clicked', '1');
      } catch {}
      setDeltas((d) => {
        const next = {
          ...d,
          [key]: {
            clicks: d[key].clicks + 1,
            clickers: d[key].clickers + (firstClick ? 1 : 0),
          },
        };
        writeStored(baselineRef.current, next);
        return next;
      });
      if (burstTimer) clearTimeout(burstTimer);
      burstTimer = setTimeout(refetch, POST_CLICK_FETCH_MS);
    };
    window.addEventListener(DEMO_BUTTON_CLICK_EVENT, onClick);
    return () => {
      window.removeEventListener(DEMO_BUTTON_CLICK_EVENT, onClick);
      if (burstTimer) clearTimeout(burstTimer);
    };
  }, [refetch]);

  if (!serverStats) {
    return <p className="stats-warming">Stats warming up — check back soon.</p>;
  }

  const totalExposures = serverStats.control.exposures + serverStats.blue.exposures;

  return (
    <div className="stats-grid">
      {CARDS.map((card) => {
        const v = serverStats[card.key];
        const d = deltas[card.key];
        const merged: VariantStats = {
          exposures: v.exposures,
          clicks: v.clicks + d.clicks,
          clickers: v.clickers + d.clickers,
        };
        const isCurrent = currentVariant === card.color;
        return (
          <div key={card.key} className="stat-card" data-current={isCurrent}>
            <div className="stat-card-head">
              <strong className="stat-card-title">
                <span className="stat-swatch" data-color={card.color} />
                {card.title}
              </strong>
            </div>
            {isCurrent && <span className="stat-current-tag">you&apos;re seeing this one</span>}
            <Row label="Share of visitors" value={share(merged, totalExposures)} />
            <Row label="Unique exposures" value={merged.exposures} />
            <Row label="Total clicks" value={merged.clicks} />
            <Row label="Unique clickers" value={merged.clickers} />
            <Row label="Click-through rate" value={ctr(merged)} />
          </div>
        );
      })}
    </div>
  );
}
