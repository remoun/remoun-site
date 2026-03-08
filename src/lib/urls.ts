const isDev = import.meta.env.DEV;

/** URL for a blog page. No args = blog index. Pass a slug or path for individual pages. */
export function blogUrl(path = ''): string {
  if (isDev) return path ? `/${path}` : '/blog';
  return path ? `https://remoun.blog/${path}` : 'https://remoun.blog';
}

/** URL for a main site page (portfolio, resume, etc). */
export function siteUrl(path: string): string {
  return isDev ? path : `https://remoun.me${path}`;
}
