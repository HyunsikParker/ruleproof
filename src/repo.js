// Public GitHub repository check: visibility and required files.

export function parseRepoUrl(url) {
  const m = String(url).trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/[^\s]*)?\/?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export async function checkRepo(owner, repo, fetchFn = fetch) {
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = { Accept: 'application/vnd.github+json' };
  let res;
  try {
    res = await fetchFn(api, { headers });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (isRateLimited(res)) return { ok: false, reason: 'rate_limited' };
  if (res.status === 404) return { ok: false, reason: 'not_found' };
  if (!res.ok) return { ok: false, reason: 'network' };
  const meta = await res.json();

  let treeRes;
  try {
    treeRes = await fetchFn(`${api}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`, { headers });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (isRateLimited(treeRes)) return { ok: false, reason: 'rate_limited' };
  if (treeRes.status === 409 || treeRes.status === 404) {
    // Empty repository: readable, but no files yet.
    return { ok: true, public: !meta.private, defaultBranch: meta.default_branch, createdAt: meta.created_at, paths: [], truncated: false };
  }
  if (!treeRes.ok) return { ok: false, reason: 'network' };
  const tree = await treeRes.json();
  const paths = (tree.tree || []).filter((e) => e.type === 'blob').map((e) => e.path);
  return {
    ok: true,
    public: !meta.private,
    defaultBranch: meta.default_branch,
    createdAt: meta.created_at,
    paths,
    truncated: Boolean(tree.truncated),
  };
}

function isRateLimited(res) {
  if (res.status !== 403 && res.status !== 429) return false;
  const remaining = res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-ratelimit-remaining') : null;
  return res.status === 429 || remaining === '0';
}

// For each required name, the shortest repository path whose file name
// matches (case-insensitive). "README" matches README.md, readme.txt, etc.
export function matchFiles(paths, names) {
  const result = {};
  for (const name of names) {
    const want = name.toLowerCase();
    const bare = !want.includes('.');
    const hits = paths.filter((p) => {
      const base = p.split('/').pop().toLowerCase();
      return bare ? base === want || base.startsWith(want + '.') : base === want;
    });
    hits.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
    result[name] = hits[0] || null;
  }
  return result;
}
