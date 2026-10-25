// One server for every app.
//   Hub mode (default):  /               landing page listing apps/*/app.json
//                        /<id>/           the app's static files
//                        /<id>/api/items  that app's CRUD API (database named <id>)
//   Single mode (SINGLE_APP=<id>): the same app served at / with /api/items — used by graduated apps.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const APPS = process.env.APPS_DIR || path.join(__dirname, '..', 'apps');
const SINGLE = process.env.SINGLE_APP;
const PORT = process.env.PORT || 3000;
const client = new MongoClient(process.env.MONGO_URL || 'mongodb://mongo:27017');

// Strip client-supplied identity fields so only app data is written.
const clean = ({ _id, id, ...rest }) => rest;
const out = ({ _id, ...rest }) => ({ id: String(_id), ...rest });

// Collection endpoints for one app: list (newest first), create, partial update, delete.
function itemsRouter(id) {
  const items = client.db(id).collection('items'), r = express.Router();
  r.get('/items', async (_req, res) => res.json((await items.find().sort({ createdAt: -1 }).toArray()).map(out)));
  r.post('/items', async (req, res) => {
    const doc = { ...clean(req.body), createdAt: Date.now() };
    const { insertedId } = await items.insertOne(doc);
    res.status(201).json(out({ ...doc, _id: insertedId }));
  });
  r.patch('/items/:id', async (req, res) => {
    const doc = await items.findOneAndUpdate({ _id: new ObjectId(req.params.id) }, { $set: clean(req.body) }, { returnDocument: 'after' });
    doc ? res.json(out(doc)) : res.sendStatus(404);
  });
  r.delete('/items/:id', async (req, res) => { await items.deleteOne({ _id: new ObjectId(req.params.id) }); res.sendStatus(204); });
  return r;
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.get('/favicon.ico', (_req, res) => res.sendStatus(204));
app.use('/shared', express.static(path.join(__dirname, 'public')));

if (SINGLE) {
  app.use('/api', itemsRouter(SINGLE));
  app.use(express.static(path.join(APPS, SINGLE)));
} else {
  // Apps are discovered on every request, so a new folder in apps/ is live immediately.
  const dirOf = id => /^[a-z0-9-]+$/.test(id) && fs.existsSync(path.join(APPS, id, 'index.html')) ? path.join(APPS, id) : null;
  const routers = {}, statics = {};

  app.get('/api/apps', (_req, res) => {
    const list = fs.readdirSync(APPS, { withFileTypes: true }).filter(d => d.isDirectory() && dirOf(d.name)).map(d => {
      let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(APPS, d.name, 'app.json'), 'utf8')); } catch {}
      return { id: d.name, title: d.name, description: '', ...meta };
    });
    res.json(list.sort((a, b) => a.title.localeCompare(b.title)));
  });
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'landing.html')));

  app.use('/:id/api', (req, res, next) => dirOf(req.params.id) ? (routers[req.params.id] ||= itemsRouter(req.params.id))(req, res, next) : next());
  app.use('/:id', (req, res, next) => {
    const dir = dirOf(req.params.id);
    dir ? (statics[dir] ||= express.static(dir))(req, res, next) : next();
  });
}

client.connect().then(() => app.listen(PORT, () => console.log(SINGLE ? `${SINGLE} on :${PORT}` : `hub on :${PORT}`)));
