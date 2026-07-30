import { notFound } from 'next/navigation';
import { PageView } from '@/components/page-view';
import { fetchPageBySlug } from '@/sanity/lib/fetch';

type Params = { slug: string[] };

export default async function SanityPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const page = await fetchPageBySlug(params.slug.join('/'));
  if (!page) notFound();
  return <PageView page={page} />;
}
