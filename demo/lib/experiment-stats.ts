import { unstable_cache } from 'next/cache';

/**
 * Server-only: live per-variant stats for the demo-button-color experiment,
 * fetched from PostHog's HogQL query API.
 *
 * Requires POSTHOG_PERSONAL_API_KEY with the `query:read` scope. The SQL was
 * verified against project 535024; if the key lacks the scope the API returns
 * 403 and we return null (the UI shows a "warming up" note instead).
 */

const FLAG_KEY = 'demo-button-color';

/**
 * One combined query (halves our /query rate-limit spend): exposure rows are
 * unique persons served each variant; click rows are total clicks + unique
 * clickers per variant, attributed via the flag property posthog-js stamps on
 * every event. Columns: kind, variant, a, b.
 */
const STATS_SQL = `SELECT 'exposure' AS kind, properties.$feature_flag_response AS variant, count(DISTINCT distinct_id) AS a, 0 AS b FROM events WHERE event = '$feature_flag_called' AND properties.$feature_flag = '${FLAG_KEY}' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY variant UNION ALL SELECT 'click' AS kind, properties['$feature/${FLAG_KEY}'] AS variant, count() AS a, count(DISTINCT distinct_id) AS b FROM events WHERE event = 'demo_button_clicked' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY variant`;

export type VariantStats = {
  exposures: number;
  clicks: number;
  clickers: number;
};

export type ExperimentStats = {
  control: VariantStats;
  blue: VariantStats;
};

async function runHogQL(sql: string): Promise<unknown[][] | null> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) return null;
  const host = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
      // POST fetches sit outside Next's fetch cache — unstable_cache below
      // provides the ~60s cache, so skip the per-request store entirely.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json: { results?: unknown[][] } = await res.json();
    return Array.isArray(json.results) ? json.results : null;
  } catch {
    return null;
  }
}

function emptyStats(): ExperimentStats {
  return {
    control: { exposures: 0, clicks: 0, clickers: 0 },
    blue: { exposures: 0, clicks: 0, clickers: 0 },
  };
}

function variantOf(value: unknown): keyof ExperimentStats | null {
  return value === 'control' || value === 'blue' ? value : null;
}

async function fetchExperimentStats(): Promise<ExperimentStats | null> {
  const rows = await runHogQL(STATS_SQL);
  if (!rows) return null;

  const stats = emptyStats();
  for (const [kind, variant, a, b] of rows) {
    const key = variantOf(variant);
    if (!key) continue;
    if (kind === 'exposure') {
      stats[key].exposures = Number(a) || 0;
    } else if (kind === 'click') {
      stats[key].clicks = Number(a) || 0;
      stats[key].clickers = Number(b) || 0;
    }
  }
  return stats;
}

/**
 * Cached ~15s, shared by SSR and the /api/experiment-stats polling route, so
 * any number of visitors costs at most ~240 PostHog queries/hour — inside the
 * /query endpoint's documented 1200/hour limit.
 */
export const getExperimentStats = unstable_cache(
  fetchExperimentStats,
  ['experiment-stats', FLAG_KEY],
  { revalidate: 15 },
);
