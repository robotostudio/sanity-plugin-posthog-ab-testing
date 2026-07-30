import { NextResponse } from 'next/server';
import { getExperimentStats } from '@/lib/experiment-stats';

/**
 * Polling endpoint for the live stats cards. Executes per request (never
 * statically cached) but reads through the shared 15s unstable_cache, so
 * client polling doesn't multiply PostHog /query spend.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = await getExperimentStats();
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
