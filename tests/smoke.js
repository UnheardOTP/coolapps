// Loads every app (or the ids passed as arguments), types plausible values into inputs and clicks every button,
// and fails on any uncaught error or console error. Usage: node tests/smoke.js [id ...]
const fs = require('fs'), path = require('path'), { launch, BASE } = require('./lib');
const ids = process.argv.length > 2 ? process.argv.slice(2) : fs.readdirSync(path.join(__dirname, '..', 'apps')).sort();
(async () => {
  const b = await launch(); let bad = 0;
  for (const id of ids) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } }), errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    p.on('console', m => m.type() === 'error' && !/favicon/.test(m.text()) && errs.push(m.text().slice(0, 140)));
    p.on('requestfailed', r => errs.push('request failed ' + r.url())); p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/${id}/`); await p.waitForTimeout(400);
    try {
      for (const i of await p.locator('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=date]):not([type=datetime-local]):not([type=time]),textarea').all()) {
        if (!(await i.isVisible()) || await i.isDisabled() || await i.getAttribute('readonly') !== null) continue;
        await i.fill((await i.getAttribute('type')) === 'number' ? '42' : 'test 123, a=1&b=2').catch(() => {});
      }
      for (const btn of (await p.locator('button:visible').all()).slice(0, 25)) await btn.click({ timeout: 700 }).catch(() => {});
      for (const sel of await p.locator('select:visible').all()) { const n = await sel.locator('option').count(); if (n > 1) await sel.selectOption({ index: n - 1 }).catch(() => {}); }
    } catch (e) { errs.push('interaction: ' + e.message.slice(0, 80)); }
    await p.waitForTimeout(250);
    if (errs.length) { bad++; console.log('FAIL', id, [...new Set(errs)].slice(0, 4)); }
    await p.close();
  }
  console.log(`smoke: ${ids.length} apps, ${bad} failing`); await b.close(); process.exit(bad ? 1 : 0);
})();
