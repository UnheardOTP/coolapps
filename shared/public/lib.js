// Tiny client helpers shared by every app.
// The API lives next to the page: /<id>/api/items in the hub, /api/items when an app runs alone.
const BASE = location.pathname.replace(/\/[^/]*$/, '') + '/api/items';
const J = { 'Content-Type': 'application/json' };
const api = {
  list: () => fetch(BASE).then(r => r.json()),
  add: d => fetch(BASE, { method: 'POST', headers: J, body: JSON.stringify(d) }).then(r => r.json()),
  upd: (id, d) => fetch(BASE + '/' + id, { method: 'PATCH', headers: J, body: JSON.stringify(d) }).then(r => r.json()),
  del: id => fetch(BASE + '/' + id, { method: 'DELETE' }),
};
const $ = (s, r = document) => r.querySelector(s);
// Escape user text before putting it in innerHTML.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Delegate clicks on [data-act] buttons inside a container: handler(act, id, element).
const onAct = (root, fn) => root.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) fn(b.dataset.act, b.closest('[data-id]')?.dataset.id, b);
});
