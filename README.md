# Stillframe

A full-stack image-search app built with React, Vite, and Express. It searches Wikimedia Commons, returns direct image thumbnails with descriptions and source-page URLs, supports page offsets, and stores a recent-search list on the server.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173` and proxies API requests to Express on port 3001. `npm start` serves the production build from Express on port 3001.

## API

```text
GET /query/:term?page=1
GET /recent/
```

Search results contain `url`, `description`, `page`, and `title` fields. The freeCodeCamp-compatible aliases are also available:

```text
GET /api/imagesearch/:term?page=1
GET /api/latest/imagesearch
```

Searches use the Wikimedia Commons API and image URLs point to Commons thumbnails. Recent searches are deduplicated by term (case-insensitive), newest first, and capped at 20 entries.

## Checks

```sh
npm test
npm run build
```

## Deploy

The included `render.yaml` is a Render Blueprint for a Node web service. Connect this repository in Render and deploy the Blueprint. The JSON search history is stored on the service filesystem; free hosting filesystems may reset when the service restarts.
