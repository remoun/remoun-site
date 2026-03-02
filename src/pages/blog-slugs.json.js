import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const projects = await getCollection('projects');

  const postSlugs = posts.map(post => post.slug);
  const tags = new Set([
    ...posts.flatMap(p => p.data.tags),
    ...projects.flatMap(p => p.data.tags),
  ]);
  const tagSlugs = [...tags].map(tag => `tag/${tag}`);

  return new Response(JSON.stringify([...postSlugs, ...tagSlugs]), {
    headers: { 'Content-Type': 'application/json' }
  });
}
