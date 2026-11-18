// Steam library comparison API, mounted by server.js at /steamcompare/api.
// Each visitor supplies their own Steam Web API key (https://steamcommunity.com/dev/apikey) in the X-Steam-Key
// header; the server never stores or logs it. Errors come back as HTTP 200 {error} so the page can show them.
const express = require('express');

async function steam(pathAndQuery) {
  const r = await fetch('https://api.steampowered.com' + pathAndQuery);
  if (r.status === 401 || r.status === 403) throw new Error('Steam rejected the API key');
  if (!r.ok) throw new Error('Steam API error ' + r.status);
  return r.json();
}

// Accepts a 17-digit ID, a /profiles/<id> URL, a /id/<vanity> URL, or a bare vanity name.
async function resolveId(input, key) {
  input = String(input || '').trim();
  if (!input) throw new Error('Enter both profiles');
  let m = input.match(/(\d{17})/);
  if (m) return m[1];
  m = input.match(/steamcommunity\.com\/id\/([^/?#]+)/i) || input.match(/^([A-Za-z0-9_-]{2,32})$/);
  if (!m) throw new Error('Unrecognised profile: ' + input.slice(0, 60));
  const j = await steam(`/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(m[1])}`);
  if (j.response.success !== 1) throw new Error('Vanity URL not found: ' + m[1]);
  return j.response.steamid;
}

async function loadProfile(input, key) {
  const id = await resolveId(input, key);
  const [sum, own] = await Promise.all([
    steam(`/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${id}`),
    steam(`/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${id}&include_appinfo=1&include_played_free_games=1`),
  ]);
  const p = sum.response.players[0];
  if (!p) throw new Error('No such Steam profile: ' + id);
  if (!own.response || own.response.games === undefined)
    throw new Error(`${p.personaname}'s game details are private (set Privacy > Game details to Public)`);
  return {
    id, name: p.personaname, avatar: p.avatarfull, url: p.profileurl,
    games: own.response.games.map(g => ({ appid: g.appid, name: g.name || 'App ' + g.appid, minutes: g.playtime_forever || 0 })),
  };
}

const router = express.Router();

router.get('/compare', async (req, res) => {
  try {
    const key = String(req.get('x-steam-key') || '').trim();
    if (!key) throw new Error('A Steam Web API key is required (https://steamcommunity.com/dev/apikey)');
    if (!/^[A-Za-z0-9]{16,64}$/.test(key)) throw new Error('That does not look like a Steam API key');
    const [a, b] = await Promise.all([loadProfile(req.query.a, key), loadProfile(req.query.b, key)]);
    if (a.id === b.id) throw new Error('Please enter two different profiles');
    const bm = new Map(b.games.map(g => [g.appid, g]));
    const shared = a.games.filter(g => bm.has(g.appid)).map(g => ({
      appid: g.appid, name: g.name, minutesA: g.minutes, minutesB: bm.get(g.appid).minutes,
    })).sort((x, y) => x.name.localeCompare(y.name));
    const strip = ({ games, ...p }) => ({ ...p, total: games.length });
    res.json({ a: strip(a), b: strip(b), shared });
  } catch (e) { res.json({ error: e.message }); }
});

module.exports = router;
