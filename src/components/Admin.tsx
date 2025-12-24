import { useState, useEffect, useCallback } from 'react';
import {
  isAuthenticated,
  logout,
  getUser,
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  type PostFile,
  type PostContent,
} from '../lib/github';
import { Editor } from './Editor';

// Configure these for your repo
const OWNER = 'remoun';
const REPO = 'remoun-site';
const OAUTH_URL = 'https://oauth.remoun.workers.dev/auth'; // Your OAuth worker URL

type View = 'list' | 'edit' | 'new';

interface User {
  login: string;
  avatar_url: string;
}

export function Admin() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>('list');
  const [posts, setPosts] = useState<PostFile[]>([]);
  const [currentPost, setCurrentPost] = useState<PostContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch user info on mount
  useEffect(() => {
    if (authenticated) {
      getUser()
        .then(setUser)
        .catch((e) => {
          console.error('Failed to get user:', e);
          setAuthenticated(false);
          logout();
        });
    }
  }, [authenticated]);

  // Fetch posts when authenticated
  useEffect(() => {
    if (authenticated && view === 'list') {
      loadPosts();
    }
  }, [authenticated, view]);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPosts(OWNER, REPO);
      setPosts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    // Open OAuth flow in popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      OAUTH_URL,
      'github-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setUser(null);
    setPosts([]);
    setCurrentPost(null);
    setView('list');
  };

  const handleEditPost = async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const post = await getPost(OWNER, REPO, slug);
      setCurrentPost(post);
      setView('edit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPost = () => {
    setCurrentPost({
      slug: '',
      path: '',
      sha: '',
      content: '',
      frontmatter: {
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        draft: true,
        tags: [],
      },
      body: '',
    });
    setView('new');
  };

  const handleSave = async (
    frontmatter: PostContent['frontmatter'],
    body: string,
    slug: string
  ) => {
    setSaving(true);
    setError(null);
    try {
      if (view === 'new') {
        await createPost(OWNER, REPO, slug, frontmatter, body);
      } else if (currentPost) {
        const newFrontmatter = {
          ...frontmatter,
          updated: new Date().toISOString().split('T')[0],
        };
        await updatePost(OWNER, REPO, currentPost.slug, currentPost.sha, newFrontmatter, body);
      }
      setView('list');
      setCurrentPost(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPost || !confirm('Are you sure you want to delete this post?')) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deletePost(OWNER, REPO, currentPost.slug, currentPost.sha);
      setView('list');
      setCurrentPost(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete post');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setView('list');
    setCurrentPost(null);
    setError(null);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Admin</h1>
          <p className="text-stone-600 mb-6">Sign in with GitHub to manage your posts.</p>
          <button
            onClick={handleLogin}
            className="px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('list')}
              className="text-lg font-medium hover:text-stone-600"
            >
              Admin
            </button>
            {view !== 'list' && (
              <span className="text-stone-400">
                / {view === 'new' ? 'New Post' : currentPost?.frontmatter.title || 'Edit'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm text-stone-600">{user.login}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {view === 'list' ? (
          <PostList
            posts={posts}
            loading={loading}
            onEdit={handleEditPost}
            onNew={handleNewPost}
          />
        ) : (
          <PostEditor
            post={currentPost!}
            isNew={view === 'new'}
            saving={saving}
            onSave={handleSave}
            onDelete={handleDelete}
            onCancel={handleCancel}
          />
        )}
      </main>
    </div>
  );
}

function PostList({
  posts,
  loading,
  onEdit,
  onNew,
}: {
  posts: PostFile[];
  loading: boolean;
  onEdit: (slug: string) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-medium">Posts</h2>
        <button
          onClick={onNew}
          className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
        >
          New Post
        </button>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-stone-500">No posts yet. Create your first post!</div>
      ) : (
        <ul className="divide-y divide-stone-200 border border-stone-200 rounded-lg bg-white">
          {posts.map((post) => (
            <li key={post.slug}>
              <button
                onClick={() => onEdit(post.slug)}
                className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors"
              >
                <span className="font-medium">{post.slug}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostEditor({
  post,
  isNew,
  saving,
  onSave,
  onDelete,
  onCancel,
}: {
  post: PostContent;
  isNew: boolean;
  saving: boolean;
  onSave: (frontmatter: PostContent['frontmatter'], body: string, slug: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState(post.slug);
  const [title, setTitle] = useState(post.frontmatter.title);
  const [description, setDescription] = useState(post.frontmatter.description);
  const [date, setDate] = useState(post.frontmatter.date);
  const [draft, setDraft] = useState(post.frontmatter.draft ?? false);
  const [tags, setTags] = useState(post.frontmatter.tags?.join(', ') ?? '');
  const [body, setBody] = useState(post.body);

  // Auto-generate slug from title for new posts
  useEffect(() => {
    if (isNew && title) {
      const newSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(newSlug);
    }
  }, [isNew, title]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !title) {
      alert('Title is required');
      return;
    }
    onSave(
      {
        title,
        description,
        date,
        draft,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      },
      body,
      slug
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Metadata */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500"
              required
            />
          </div>

          {isNew && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500 font-mono text-sm"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500"
                placeholder="tag1, tag2"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="draft"
              checked={draft}
              onChange={(e) => setDraft(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="draft" className="text-sm text-stone-700">
              Draft (won't appear on site)
            </label>
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <Editor
            initialContent={body}
            onChange={setBody}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : isNew ? 'Create Post' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-stone-600 hover:text-stone-800"
            >
              Cancel
            </button>
          </div>

          {!isNew && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="px-4 py-2 text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
