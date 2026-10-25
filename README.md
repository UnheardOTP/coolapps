# Cool Apps hub

One Node server + one MongoDB serve every app. Open http://localhost:4100 for the index.

```bash
docker compose up -d --build     # start (hub + mongo)
docker compose down              # stop (data is kept in the mongo-data volume)
```

## Layout

- `apps/<id>/index.html` — an app (single page). `app.json` holds its title, description and tile color.
- `shared/server.js` — serves `/` (index), `/<id>/` (the app) and `/<id>/api/items` (that app's CRUD API).
  Each app stores its data in its own MongoDB database named `<id>`.
- `shared/public/lib.js` — the `api` client (`list/add/upd/del`) every app uses; `style.css` is optional.

## Utilities and shared helpers

`shared/public/util.css` gives utility apps a consistent light/dark look (set `--a` for the accent color); `util.js`
adds `copy()`, `remember()` (restore inputs marked `data-keep`), `savedBar()` (named presets), `ymd()` date math and
`compile()`, a safe expression parser used by the calculator and function plotter. `app.json` takes an optional
`"cat": "Utilities" | "Play"` that drives the tabs on the index page.

## Add an app (live immediately, no rebuild)

```bash
scripts/new-app.sh recipes "Recipes" "Save and browse recipes" "#10b981"
```

## Roll out a winner as its own project

```bash
scripts/graduate.sh constellation ../constellation 3010
```

Creates a standalone folder (app + server + Dockerfile + its own MongoDB). The script prints the
`mongodump | mongorestore` one-liner to bring that app's data along.

## CI & deploy (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push and pull request:

1. `tests/static.py` — manifests, ids and every inline script's syntax.
2. Starts the stack with Docker Compose, then `tests/logic.js` (numeric spot-checks listed in `tests/logic.json`)
   and `tests/smoke.js` (loads every app in headless Chromium, types and clicks, fails on any console error).

Pushes to `main` then deploy to the home server **if the repo variable `DEPLOY_ENABLED` is `true`**: the job joins the
tailnet (`TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`), copies the files over SSH (`DEPLOY_SSH_PASSWORD`), rebuilds the image,
restarts, checks `/api/apps` reports every app, and rolls back to the previous image if it does not. Data lives in a
Docker volume and is never touched. Run the same checks locally with `node tests/smoke.js` and `node tests/logic.js`
(`cd tests && npm install` first; set `CHROME=/path/to/chrome` to use an existing browser).
