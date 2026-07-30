import { NextRequest, NextResponse } from 'next/server';

// This type mirrors the `PostHogExperiment` type exported by
// sanity-plugin-posthog-ab-testing. It is declared locally on purpose:
// server code must not import from a Studio plugin package. If the plugin's
// exported type ever changes, this route must change with it.
type PostHogExperiment = {
  id: number;
  name: string;
  featureFlagKey: string;
  status: 'draft' | 'running' | 'paused' | 'exposure_frozen' | 'complete';
  variants: { key: string; label?: string; rolloutPercentage?: number }[];
};

const KNOWN_STATUSES = new Set(['draft', 'running', 'paused', 'exposure_frozen', 'complete']);

function allowedOrigins(): Set<string> {
  return new Set(
    (process.env.SANITY_STUDIO_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && allowedOrigins().has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }
  return {};
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

/**
 * Normalise PostHog's status to the plugin's 5-state enum.
 * PostHog documents both `stopped` and `complete` as "ended" — map stopped
 * to complete. If the response carries no usable status field, derive it
 * from the experiment dates instead.
 */
function normaliseStatus(exp: {
  status?: unknown;
  start_date?: string | null;
  end_date?: string | null;
}): PostHogExperiment['status'] {
  if (exp.status === 'stopped') return 'complete';
  if (typeof exp.status === 'string' && KNOWN_STATUSES.has(exp.status)) {
    return exp.status as PostHogExperiment['status'];
  }
  // Fallback mapping when no status field is present:
  if (exp.end_date) return 'complete';
  if (exp.start_date) return 'running';
  return 'draft';
}

/**
 * Proxy for the PostHog Experiments API, used by the Sanity Studio plugin.
 * Deliberately NO status filter — the plugin's ended-experiment warning needs
 * completed experiments in the list. Archived experiments are excluded.
 */
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'));
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    return NextResponse.json(
      { error: 'POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be configured' },
      { status: 500, headers: cors },
    );
  }

  // PostHog has separate hosts: us.i.posthog.com (ingestion) vs us.posthog.com
  // (API). The experiments API lives on the API host.
  const apiHost = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';
  const url = `${apiHost}/api/projects/${projectId}/experiments/?limit=100&archived=false`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`PostHog API ${res.status} for ${url}:`, text);
      return NextResponse.json(
        { error: `PostHog API error: ${res.status}`, details: text },
        { status: res.status, headers: cors },
      );
    }

    const data = await res.json();

    const experiments: PostHogExperiment[] = (data.results ?? [])
      .filter((exp: any) => !exp.archived)
      .map((exp: any) => ({
        id: exp.id,
        name: exp.name,
        featureFlagKey: exp.feature_flag_key,
        status: normaliseStatus(exp),
        variants:
          exp.parameters?.feature_flag_variants?.map((v: any) => ({
            key: v.key,
            ...(v.name ? { label: v.name } : {}),
            ...(typeof v.rollout_percentage === 'number'
              ? { rolloutPercentage: v.rollout_percentage }
              : {}),
          })) ?? [],
      }));

    return NextResponse.json(experiments, { headers: cors });
  } catch (err) {
    console.error('Failed to fetch PostHog experiments:', err);
    return NextResponse.json(
      { error: 'Failed to fetch PostHog experiments' },
      { status: 500, headers: cors },
    );
  }
}
