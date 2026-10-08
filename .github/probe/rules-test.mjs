// Replays every request the game and the admin dashboard make against the
// Firebase Realtime Database emulator running database.rules.json, plus the
// requests the rules exist to stop. Exits non-zero if any outcome is wrong.
import fs from 'node:fs';

const NS = process.env.NS;
const BASE = 'http://127.0.0.1:9000';
const OWNER = { Authorization: 'Bearer owner' };
const rules = fs.readFileSync('database.rules.json', 'utf8');
let failed = 0;

async function req(method, path, body, admin) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${BASE}${path}${sep}ns=${NS}`, {
    method,
    headers: admin ? OWNER : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, json };
}
function expect(desc, res, allowed) {
  const pass = res.ok === allowed;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${allowed ? 'allow' : 'deny '}  ${desc}  (HTTP ${res.status})`);
}

// published exactly the way the dashboard's Revive button does it
expect('publish rules as the owner', await req('PUT', '/.settings/rules.json', rules, true), true);

console.log('\n-- the game (public, no key) --');
expect('read the leaderboard', await req('GET', '/scores.json'), true);
const saved = await req('POST', '/scores.json', { name: 'Nemo', score: 42, ts: Date.now(), pid: 'dev1' });
expect('save a score', saved, true);
const key = saved.json && saved.json.name;
expect('backfill a score', await req('POST', '/scores.json', { name: 'Nemo', score: 7, ts: Date.now(), pid: 'dev1', backfill: true }), true);
expect('rename own scores (multi-path PATCH)', await req('PATCH', '/scores.json', { [`${key}/name`]: 'King' }), true);
expect('log a play', await req('POST', '/plays.json', { name: 'King', ts: Date.now(), v: 'v29', score: 42, lvl: 2 }), true);

console.log('\n-- a vandal (public, no key) --');
expect('read the private play log', await req('GET', '/plays.json'), false);
expect('wipe the whole leaderboard', await req('PUT', '/scores.json', {}), false);
expect('delete a score', await req('DELETE', `/scores/${key}.json`), false);
expect('delete a score by writing null', await req('PUT', `/scores/${key}.json`, 'null'), false);
expect('save a score with no name', await req('POST', '/scores.json', { score: 5 }), false);
expect('save a negative score', await req('POST', '/scores.json', { name: 'x', score: -1 }), false);
expect('save an absurd score', await req('POST', '/scores.json', { name: 'x', score: 999999 }), false);
expect('save a 30-character name', await req('POST', '/scores.json', { name: 'x'.repeat(30), score: 1 }), false);
expect('rename a score to blank', await req('PATCH', '/scores.json', { [`${key}/name`]: '' }), false);
const play = await req('POST', '/plays.json', { name: 'a', ts: 1 });
expect('overwrite a logged play', await req('PUT', `/plays/${play.json && play.json.name}.json`, { name: 'b' }), false);
expect('wipe the play log', await req('DELETE', '/plays.json'), false);

console.log('\n-- the admin dashboard (with the key) --');
expect('read the play log', await req('GET', '/plays.json', undefined, true), true);
expect('rename one entry', await req('PATCH', `/scores/${key}.json`, { name: 'Nemo' }, true), true);
expect('bulk rename', await req('PATCH', '/scores.json', { [`${key}/name`]: 'Nemo' }, true), true);
expect('delete an entry', await req('DELETE', `/scores/${key}.json`, undefined, true), true);

console.log(failed ? `\n${failed} RULE CHECK(S) FAILED` : '\nALL RULE CHECKS PASSED');
process.exit(failed ? 1 : 0);
