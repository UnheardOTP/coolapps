// Shared bits for the browser tests: Playwright loader and launch options (CHROME=/path overrides the browser binary).
const pw = (() => { try { return require('playwright'); } catch { return require('playwright-core'); } })();
const launch = () => pw.chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const BASE = process.env.BASE || 'http://localhost:4100';
module.exports = { launch, BASE };
