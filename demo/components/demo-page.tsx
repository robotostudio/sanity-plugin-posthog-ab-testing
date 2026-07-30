import { getExperimentStats } from '@/lib/experiment-stats';
import { EditorialLayout } from '@/components/page-layouts';
import type { Page } from '@/sanity/lib/fetch';

/**
 * Server component shared by both routes — the "exact component tree" the
 * normal page route and the variant route render. Fetches the cached stats
 * once and hands them to the editorial layout.
 */
export async function DemoPage({ page }: { page: Page }) {
  const stats = await getExperimentStats();
  return <EditorialLayout page={page} stats={stats} />;
}
