'use client';

import { DemoPushButton } from '@/components/page-view';
import { ExperimentStatsCards } from '@/components/experiment-stats-cards';
import type { ExperimentStats } from '@/lib/experiment-stats';
import type { Page } from '@/sanity/lib/fetch';

/**
 * The editorial page layout: left-aligned copy with inline borderless stats,
 * framed button stage on the right. Reuses DemoPushButton (capture + confetti
 * + window event) and ExperimentStatsCards (optimistic bumps). Styling lives
 * in globals.css (.edit-* rules) — Roboto Studio identity: monochrome zinc,
 * hairline rules, Geist / Geist Mono, mono uppercase eyebrows, sharp edges.
 */
export function EditorialLayout({
  page,
  stats,
}: {
  page: Page;
  stats: ExperimentStats | null;
}) {
  const color = page.buttonColor ?? 'white';
  return (
    <main className="page-main">
      <div className="page-inner edit-grid">
        <div className="edit-copy">
          <span className="demo-eyebrow">
            You got the {page.buttonLabel ?? 'A'} page, lucky you
          </span>
          <h1 className="edit-headline">One button. Two colors. Real data.</h1>
          <p className="edit-sub">
            Every press feeds a live PostHog experiment run from Sanity. You were
            assigned the {color} variant — press it and watch the numbers move.
          </p>
          <div className="edit-stats">
            <ExperimentStatsCards stats={stats} currentVariant={page.buttonColor ?? null} />
          </div>
        </div>
        <div className="edit-stage">
          <DemoPushButton page={page} />
        </div>
      </div>
    </main>
  );
}
