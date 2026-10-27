import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RecentSearchStore } from './recent-store.js';
import { searchCommons } from './search.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDist = path.resolve(here, '../dist');

function normalizePage(rawPage) {
  if (rawPage === undefined) return 1;
  if (!/^\d+$/.test(rawPage)) return null;
  const page = Number(rawPage);
  return Number.isSafeInteger(page) && page > 0 && page <= 10_000 ? page : null;
}

export function createApp({ search = searchCommons, store = new RecentSearchStore(), distDir = defaultDist } = {}) {
  const app = express();
  app.disable('x-powered-by');

  const serveSearch = async (req, res) => {
    const term = req.params.term.trim();
    const page = normalizePage(req.query.page);
    if (!term) return res.status(400).json({ error: 'A search term is required.' });
    if (!page) return res.status(400).json({ error: 'page must be a positive integer.' });

    try {
      const results = await search(term, { page });
      await store.add(term);
      return res.json(results);
    } catch (error) {
      return res.status(502).json({ error: error.message || 'Image search is temporarily unavailable.' });
    }
  };

  app.get('/query/:term', serveSearch);
  app.get('/api/imagesearch/:term', serveSearch);

  const serveRecent = async (_req, res) => {
    try {
      return res.json(await store.list());
    } catch {
      return res.status(500).json({ error: 'Recent searches could not be loaded.' });
    }
  };
  app.get(['/recent', '/recent/', '/api/latest/imagesearch'], serveRecent);

  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res, next) => {
    res.sendFile(path.join(distDir, 'index.html'), (error) => {
      if (error) next();
    });
  });

  return app;
}

export { normalizePage };
