import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const DIST = resolve('dist');
const POSTS_DIR = resolve('src/content/posts');
const PROJECTS_DIR = resolve('src/content/projects');

// --- Helpers ---

function parseFrontmatter(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (key === 'draft') fm.draft = raw.trim() === 'true';
    if (key === 'title') fm.title = raw.replace(/^["']|["']$/g, '').trim();
    if (key === 'tags') {
      const tagMatch = raw.match(/\[([^\]]*)\]/);
      fm.tags = tagMatch
        ? tagMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        : [];
    }
  }
  return fm;
}

function walkHtml(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(full));
    else if (entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md')).map(f => join(dir, f));
}

function slug(filePath) {
  return filePath.split('/').pop().replace(/\.md$/, '');
}

// --- Checks ---

function checkDrafts() {
  const drafts = mdFiles(POSTS_DIR)
    .map(f => ({ slug: slug(f), ...parseFrontmatter(f) }))
    .filter(p => p.draft);

  const leaked = drafts.filter(d => existsSync(join(DIST, d.slug, 'index.html')));

  if (leaked.length === 0) {
    return {
      passed: true,
      message: `No draft posts in build output (${drafts.length} draft${drafts.length !== 1 ? 's' : ''} checked)`,
    };
  }
  return {
    passed: false,
    message: 'Draft posts leaked into build output',
    errors: leaked.map(d => `/${d.slug}/ exists in dist but is marked draft`),
  };
}

function checkRss() {
  const rssPath = join(DIST, 'rss.xml');
  if (!existsSync(rssPath)) {
    return { passed: false, message: 'RSS feed missing', errors: ['dist/rss.xml not found'] };
  }

  const rss = readFileSync(rssPath, 'utf-8');
  const items = rss.match(/<item>/g);
  if (!items || items.length === 0) {
    return { passed: false, message: 'RSS feed has no items', errors: ['No <item> elements found'] };
  }

  const drafts = mdFiles(POSTS_DIR)
    .map(f => ({ slug: slug(f), ...parseFrontmatter(f) }))
    .filter(p => p.draft);

  // Match exact <link> elements to avoid partial slug matches
  // RSS generates links as /${post.slug}/ (see rss.xml.js line 16)
  const leaked = drafts.filter(d => rss.includes(`/${d.slug}/</link>`));

  if (leaked.length > 0) {
    return {
      passed: false,
      message: 'RSS feed contains draft posts',
      errors: leaked.map(d => `Draft "/${d.slug}/" found in rss.xml`),
    };
  }

  return { passed: true, message: `RSS feed valid (${items.length} entries, no drafts)` };
}

function checkTagPages() {
  const tags = new Set();

  // Non-draft posts only (matches tag/[tag].astro behavior)
  for (const f of mdFiles(POSTS_DIR)) {
    const fm = parseFrontmatter(f);
    if (fm.draft) continue;
    for (const tag of (fm.tags || [])) tags.add(tag);
  }

  // All projects
  for (const f of mdFiles(PROJECTS_DIR)) {
    const fm = parseFrontmatter(f);
    for (const tag of (fm.tags || [])) tags.add(tag);
  }

  const missing = [...tags].filter(
    tag => !existsSync(join(DIST, 'tag', tag, 'index.html'))
  );

  if (missing.length === 0) {
    return { passed: true, message: `Tag pages valid (${tags.size} tags, all have pages)` };
  }
  return {
    passed: false,
    message: `Tag pages — missing pages for: ${JSON.stringify(missing)}`,
    errors: missing.map(t => `dist/tag/${t}/index.html not found`),
  };
}

function resolveHref(href) {
  // Strip leading slash (path.join treats absolute segments as root)
  // and trailing slash, then resolve against DIST
  const p = href.replace(/^\//, '').replace(/\/$/, '');
  if (!p) return existsSync(join(DIST, 'index.html')); // root "/"
  const candidates = [
    join(DIST, p, 'index.html'),
    join(DIST, p + '.html'),
    join(DIST, p),
  ];
  return candidates.some(c => existsSync(c));
}

function checkInternalLinks() {
  const htmlFiles = walkHtml(DIST);
  const hrefRegex = /href="(\/[^"]*?)"/g;
  const checked = new Set();
  const broken = [];

  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
      const href = match[1].split('#')[0]; // strip fragment
      if (!href || href === '/') continue;
      if (checked.has(href)) continue;
      checked.add(href);

      if (!resolveHref(href)) {
        broken.push(href);
      }
    }
  }

  if (broken.length === 0) {
    return { passed: true, message: `Internal links valid (${checked.size} links checked)` };
  }
  return {
    passed: false,
    message: `Internal links — ${broken.length} broken`,
    errors: broken.map(h => `${h} does not resolve to any file in dist/`),
  };
}

// --- Runner ---

function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ not found. Run `astro build` first.');
    process.exit(1);
  }

  const checks = [
    checkDrafts,
    checkRss,
    checkTagPages,
    checkInternalLinks,
  ];

  console.log('\nSmoke Tests');
  console.log('──────────────────────────');

  let failed = 0;
  for (const check of checks) {
    const result = check();
    if (result.passed) {
      console.log(`✓ ${result.message}`);
    } else {
      console.log(`✗ ${result.message}`);
      for (const err of result.errors) console.log(`  ${err}`);
      failed++;
    }
  }

  console.log();
  if (failed > 0) {
    console.log(`${failed} check${failed > 1 ? 's' : ''} failed.`);
    process.exit(1);
  } else {
    console.log('All checks passed.');
  }
}

main();
