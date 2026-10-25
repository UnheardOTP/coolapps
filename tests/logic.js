// Numeric/logic spot-checks. Each case in logic.json: [app, JS expression evaluated in that app's page, expected, tolerance?].
const fs = require('fs'), path = require('path'), { launch, BASE } = require('./lib');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'logic.json'), 'utf8'));
(async () => {
  const b = await launch(); let bad = 0;
  for (const [app, expr, want, tol = 0.01] of cases) {
    const p = await b.newPage(); await p.goto(`${BASE}/${app}/`); await p.waitForTimeout(300);
    let got; try { got = await p.evaluate(expr); } catch (e) { got = 'ERR ' + e.message.slice(0, 60); }
    const ok = typeof want === 'number' ? Math.abs(got - want) <= tol : JSON.stringify(got) === JSON.stringify(want);
    if (!ok) { bad++; console.log('FAIL', app, expr.slice(0, 70), '=>', JSON.stringify(got), 'want', JSON.stringify(want)); } await p.close();
  }
  console.log(`logic: ${cases.length} checks, ${bad} failing`); await b.close(); process.exit(bad ? 1 : 0);
})();
