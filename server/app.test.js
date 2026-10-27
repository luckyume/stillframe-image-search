import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from './app.js';
import { RecentSearchStore } from './recent-store.js';
import { searchCommons } from './search.js';

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('search route decodes terms, forwards page, and returns images', async () => {
  const calls = [];
  const app = createApp({
    search: async (term, options) => {
      calls.push({ term, ...options });
      return [{ url: 'https://images.example/cat.jpg', description: 'A funny cat', page: 'https://commons.example/cat' }];
    },
    store: { add: async () => {}, list: async () => [] },
    distDir: '/tmp/no-client-build',
  });

  await withServer(app, async (base) => {
    const response = await fetch(`${base}/query/lolcats%20funny?page=2`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ url: 'https://images.example/cat.jpg', description: 'A funny cat', page: 'https://commons.example/cat' }]);
  });
  assert.deepEqual(calls, [{ term: 'lolcats funny', page: 2 }]);
});

test('freeCodeCamp-compatible route aliases share the same API behavior', async () => {
  const app = createApp({
    search: async (term) => [{ url: 'https://images.example/one.jpg', description: term, page: 'https://commons.example/one' }],
    store: { add: async () => {}, list: async () => [{ term: 'cats', when: '2026-10-27T00:00:00.000Z' }] },
    distDir: '/tmp/no-client-build',
  });

  await withServer(app, async (base) => {
    const images = await fetch(`${base}/api/imagesearch/cats`).then((res) => res.json());
    const recent = await fetch(`${base}/api/latest/imagesearch`).then((res) => res.json());
    assert.equal(images[0].description, 'cats');
    assert.deepEqual(recent, [{ term: 'cats', when: '2026-10-27T00:00:00.000Z' }]);
  });
});

test('recent route returns an empty list before any searches', async () => {
  const app = createApp({ search: async () => [], store: { list: async () => [] }, distDir: '/tmp/no-client-build' });
  await withServer(app, async (base) => {
    assert.deepEqual(await fetch(`${base}/recent/`).then((res) => res.json()), []);
  });
});

test('invalid page values are rejected without searching', async () => {
  let calls = 0;
  const app = createApp({
    search: async () => { calls += 1; return []; },
    store: { add: async () => {}, list: async () => [] },
    distDir: '/tmp/no-client-build',
  });
  await withServer(app, async (base) => {
    for (const page of ['0', '-2', 'one', '10001']) {
      const response = await fetch(`${base}/query/cats?page=${page}`);
      assert.equal(response.status, 400);
    }
  });
  assert.equal(calls, 0);
});

test('recent store persists, deduplicates case-insensitively, and caps its history', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'stillframe-'));
  const store = new RecentSearchStore(path.join(directory, 'recent.json'), 2);
  try {
    await store.add('cats', '2026-10-25T00:00:00.000Z');
    await store.add('dogs', '2026-10-26T00:00:00.000Z');
    await store.add('CATS', '2026-10-27T00:00:00.000Z');
    assert.deepEqual(await store.list(), [
      { term: 'CATS', when: '2026-10-27T00:00:00.000Z' },
      { term: 'dogs', when: '2026-10-26T00:00:00.000Z' },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Commons mapper returns a thumbnail, readable description, and source page URL', async () => {
  let requestUrl;
  const fetchImpl = async (url) => {
    requestUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: {
            12: {
              title: 'File:Orange_cat.jpg',
              imageinfo: [{
                url: 'https://upload.wikimedia.org/original.jpg',
                thumburl: 'https://upload.wikimedia.org/thumb.jpg',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Orange_cat.jpg',
                extmetadata: { ImageDescription: { value: '<p>A &amp; orange cat.</p>' } },
              }],
            },
          },
        },
      }),
    };
  };
  const results = await searchCommons('orange cats', { page: 3, fetchImpl });
  assert.deepEqual(results[0], {
    url: 'https://upload.wikimedia.org/thumb.jpg',
    description: 'A & orange cat.',
    page: 'https://commons.wikimedia.org/wiki/File:Orange_cat.jpg',
    title: 'Orange_cat.jpg',
  });
  assert.equal(requestUrl.searchParams.get('gsroffset'), '40');
  assert.equal(requestUrl.searchParams.get('gsrsearch'), 'orange cats');
});
