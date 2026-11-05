# Spindle Frontend

Merchandiser UI for Spindle. Vite + React app that lets merchandisers review emails, confirm extracted fields, and work style cards.

The Vite dev server proxies `/api` and `/health` to the backend at `http://127.0.0.1:4000`.

## Run

```bash
npm install
npm run dev
```

The app is at [http://127.0.0.1:5173](http://127.0.0.1:5173). Start `spindle-backend` on port 4000 first so API calls succeed.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on `:5173` |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
