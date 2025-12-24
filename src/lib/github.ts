const GITHUB_API = 'https://api.github.com';

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  download_url: string | null;
}

export interface PostFile {
  slug: string;
  path: string;
  sha: string;
}

export interface PostContent {
  slug: string;
  path: string;
  sha: string;
  content: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    updated?: string;
    draft?: boolean;
    tags?: string[];
  };
  body: string;
}

function getToken(): string | null {
  return localStorage.getItem('github_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  localStorage.removeItem('github_token');
}

async function githubFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }

  return response;
}

export async function getUser(): Promise<{ login: string; avatar_url: string }> {
  const response = await githubFetch('/user');
  return response.json();
}

export async function listPosts(
  owner: string,
  repo: string
): Promise<PostFile[]> {
  const response = await githubFetch(
    `/repos/${owner}/${repo}/contents/src/content/posts`
  );
  const files: GitHubFile[] = await response.json();

  return files
    .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
    .map((f) => ({
      slug: f.name.replace(/\.md$/, ''),
      path: f.path,
      sha: f.sha,
    }));
}

export async function getPost(
  owner: string,
  repo: string,
  slug: string
): Promise<PostContent> {
  const path = `src/content/posts/${slug}.md`;
  const response = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`);
  const data = await response.json();

  const content = atob(data.content);
  const { frontmatter, body } = parseFrontmatter(content);

  return {
    slug,
    path,
    sha: data.sha,
    content,
    frontmatter,
    body,
  };
}

export async function createPost(
  owner: string,
  repo: string,
  slug: string,
  frontmatter: PostContent['frontmatter'],
  body: string
): Promise<{ sha: string }> {
  const path = `src/content/posts/${slug}.md`;
  const content = serializePost(frontmatter, body);

  const response = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Create post: ${frontmatter.title}`,
      content: btoa(unescape(encodeURIComponent(content))),
    }),
  });

  const data = await response.json();
  return { sha: data.content.sha };
}

export async function updatePost(
  owner: string,
  repo: string,
  slug: string,
  sha: string,
  frontmatter: PostContent['frontmatter'],
  body: string
): Promise<{ sha: string }> {
  const path = `src/content/posts/${slug}.md`;
  const content = serializePost(frontmatter, body);

  const response = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Update post: ${frontmatter.title}`,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
    }),
  });

  const data = await response.json();
  return { sha: data.content.sha };
}

export async function deletePost(
  owner: string,
  repo: string,
  slug: string,
  sha: string
): Promise<void> {
  const path = `src/content/posts/${slug}.md`;

  await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `Delete post: ${slug}`,
      sha,
    }),
  });
}

function parseFrontmatter(content: string): {
  frontmatter: PostContent['frontmatter'];
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      },
      body: content,
    };
  }

  const [, frontmatterStr, body] = match;
  const frontmatter: PostContent['frontmatter'] = {
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  };

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'title':
        frontmatter.title = value;
        break;
      case 'description':
        frontmatter.description = value;
        break;
      case 'date':
        frontmatter.date = value;
        break;
      case 'updated':
        frontmatter.updated = value;
        break;
      case 'draft':
        frontmatter.draft = value === 'true';
        break;
      case 'tags':
        // Parse YAML array: [tag1, tag2] or - tag1
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter.tags = value
            .slice(1, -1)
            .split(',')
            .map((t) => t.trim());
        }
        break;
    }
  }

  return { frontmatter, body: body.trim() };
}

function serializePost(
  frontmatter: PostContent['frontmatter'],
  body: string
): string {
  const lines = [
    '---',
    `title: "${frontmatter.title}"`,
    `description: "${frontmatter.description}"`,
    `date: ${frontmatter.date}`,
  ];

  if (frontmatter.updated) {
    lines.push(`updated: ${frontmatter.updated}`);
  }

  if (frontmatter.draft !== undefined) {
    lines.push(`draft: ${frontmatter.draft}`);
  }

  if (frontmatter.tags && frontmatter.tags.length > 0) {
    lines.push(`tags: [${frontmatter.tags.join(', ')}]`);
  }

  lines.push('---', '', body);

  return lines.join('\n');
}
