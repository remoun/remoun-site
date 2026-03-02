import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const slugs = posts.map(post => post.slug);
  return new Response(JSON.stringify(slugs), {
    headers: { 'Content-Type': 'application/json' }
  });
}
