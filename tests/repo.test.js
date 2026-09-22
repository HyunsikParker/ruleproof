import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoUrl, checkRepo, matchFiles } from '../src/repo.js';

test('repo URLs in common shapes', () => {
  assert.deepEqual(parseRepoUrl('https://github.com/octo/hello'), { owner: 'octo', repo: 'hello' });
  assert.deepEqual(parseRepoUrl('https://github.com/octo/hello.git'), { owner: 'octo', repo: 'hello' });
  assert.deepEqual(parseRepoUrl('github.com/octo/hello/tree/main/src'), { owner: 'octo', repo: 'hello' });
  assert.deepEqual(parseRepoUrl('https://github.com/octo/my.repo/'), { owner: 'octo', repo: 'my.repo' });
  assert.equal(parseRepoUrl('https://gitlab.com/octo/hello'), null);
  assert.equal(parseRepoUrl('not a url'), null);
});

test('file matching is case-insensitive and prefers the shallowest path', () => {
  const paths = ['devpost/scope.md', 'docs/old/scope.md', 'README.md', 'src/app.js'];
  assert.deepEqual(matchFiles(paths, ['scope.md', 'readme', 'spec.md']), {
    'scope.md': 'devpost/scope.md',
    readme: 'README.md',
    'spec.md': null,
  });
});

function fakeFetch(routes) {
  return async (url) => {
    for (const [pattern, response] of routes) {
      if (url.includes(pattern)) {
        if (response instanceof Error) throw response;
        return {
          status: response.status,
          ok: response.status >= 200 && response.status < 300,
          headers: { get: (k) => (response.headers || {})[k.toLowerCase()] ?? null },
          json: async () => response.body,
        };
      }
    }
    throw new Error('unexpected ' + url);
  };
}

test('public repo with files', async () => {
  const fetchFn = fakeFetch([
    ['/git/trees/', { status: 200, body: { tree: [{ path: 'devpost/spec.md', type: 'blob' }, { path: 'devpost', type: 'tree' }], truncated: false } }],
    ['/repos/octo/hello', { status: 200, body: { private: false, default_branch: 'main', created_at: '2026-09-22T18:00:00Z' } }],
  ]);
  const r = await checkRepo('octo', 'hello', fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.public, true);
  assert.deepEqual(r.paths, ['devpost/spec.md']);
});

test('missing or private repo', async () => {
  const r = await checkRepo('octo', 'secret', fakeFetch([['/repos/octo/secret', { status: 404, body: {} }]]));
  assert.deepEqual(r, { ok: false, reason: 'not_found' });
});

test('rate limit', async () => {
  const r = await checkRepo('octo', 'hello', fakeFetch([['/repos/octo/hello', { status: 403, headers: { 'x-ratelimit-remaining': '0' }, body: {} }]]));
  assert.deepEqual(r, { ok: false, reason: 'rate_limited' });
});

test('network failure', async () => {
  const r = await checkRepo('octo', 'hello', fakeFetch([['/repos/octo/hello', new Error('offline')]]));
  assert.deepEqual(r, { ok: false, reason: 'network' });
});

test('empty repository is readable with no files', async () => {
  const fetchFn = fakeFetch([
    ['/git/trees/', { status: 409, body: {} }],
    ['/repos/octo/empty', { status: 200, body: { private: false, default_branch: 'main', created_at: '2026-09-22T18:00:00Z' } }],
  ]);
  const r = await checkRepo('octo', 'empty', fetchFn);
  assert.equal(r.ok, true);
  assert.deepEqual(r.paths, []);
});
