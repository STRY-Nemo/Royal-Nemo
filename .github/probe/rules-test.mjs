// Replays every request the game (current and older versions) and the admin
// dashboard make against the Firebase Realtime Database emulator running
// database.rules.json, plus the requests the rules exist to stop. Exits
// non-zero if any outcome is wrong.
import fs from 'node:fs';

const NS = process.env.NS || 'demo-royal-nemo-default-rtdb';
const BASE = process.env.EMU || 'http://127.0.0.1:9000';
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
const key = res => res.json && res.json.name;

// Owner access stands in for the dashboard's ?auth=<database secret>; both bypass the rules.
expect('publish rules as the owner', await req('PUT', '/.settings/rules.json', rules, true), true);

console.log('\n-- the game, current version (public, no key) --');
expect('read the leaderboard', await req('GET', '/scores.json'), true);
const mine = await req('POST', '/scores.json', { name: 'Nemo', score: 42, ts: Date.now(), pid: 'dev1' });
expect('save a score', mine, true);
const k = key(mine);
expect('save the winning score (150)', await req('POST', '/scores.json', { name: 'Nemo', score: 150, ts: Date.now(), pid: 'dev1' }), true);
expect('backfill a score', await req('POST', '/scores.json', { name: 'Nemo', score: 7, ts: Date.now(), pid: 'dev1', backfill: true }), true);
expect('rename own scores (multi-path PATCH)', await req('PATCH', '/scores.json', { [`${k}/name`]: 'King' }), true);
expect('log a play', await req('POST', '/plays.json', { name: 'King', ts: Date.now(), v: 'v29', score: 42, lvl: 2 }), true);

console.log('\n-- older game versions still in players\' browsers --');
expect('v8-v24 score (no device id)', await req('POST', '/scores.json', { name: 'Old', score: 9, ts: Date.now() }), true);
expect('v19 play (no score or level)', await req('POST', '/plays.json', { name: 'Old', ts: Date.now(), v: 'v19' }), true);
const seeded = await req('POST', '/scores.json', { name: 'Legacy', score: 3 }, true);
expect('rename a legacy entry with no device id or timestamp', await req('PATCH', '/scores.json', { [`${key(seeded)}/name`]: 'Leg' }), true);

console.log('\n-- a vandal (public, no key) --');
expect('read the private play log', await req('GET', '/plays.json'), false);
expect('wipe the whole leaderboard', await req('PUT', '/scores.json', {}), false);
expect('delete a score', await req('DELETE', `/scores/${k}.json`), false);
expect('delete a score by writing null', await req('PUT', `/scores/${k}.json`, 'null'), false);
expect('change an existing score', await req('PATCH', '/scores.json', { [`${k}/score`]: 150 }), false);
expect('reset every score at once', await req('PATCH', '/scores.json', { [`${k}/score`]: 0, [`${key(seeded)}/score`]: 0 }), false);
expect('replace an entry wholesale', await req('PUT', `/scores/${k}.json`, { name: 'x', score: 1 }), false);
expect('move an entry to another device', await req('PATCH', '/scores.json', { [`${k}/pid`]: 'evil' }), false);
expect('detach an entry from its device', await req('DELETE', `/scores/${k}/pid.json`), false);
expect('save a score with no name', await req('POST', '/scores.json', { score: 5 }), false);
expect('save a negative score', await req('POST', '/scores.json', { name: 'x', score: -1 }), false);
expect('save an impossible score (151)', await req('POST', '/scores.json', { name: 'x', score: 151 }), false);
expect('save a fractional score', await req('POST', '/scores.json', { name: 'x', score: 3.5 }), false);
expect('save a 30-character name', await req('POST', '/scores.json', { name: 'x'.repeat(30), score: 1 }), false);
expect('rename a score to blank', await req('PATCH', '/scores.json', { [`${k}/name`]: '' }), false);
expect('attach an extra field to a score', await req('POST', '/scores.json', { name: 'x', score: 1, junk: 'y'.repeat(5000) }), false);
expect('save a score with a text timestamp', await req('POST', '/scores.json', { name: 'x', score: 1, ts: 'abc' }), false);
expect('save a score under a script-bearing key', await req('PUT', '/scores/' + encodeURIComponent('"><img src=x onerror=alert(1)>') + '.json', { name: 'x', score: 1 }), false);
expect('log a play with markup as its level', await req('POST', '/plays.json', { name: 'a', ts: 1, lvl: '<img src=x onerror=alert(1)>' }), false);
expect('log a play with an extra field', await req('POST', '/plays.json', { name: 'a', ts: 1, junk: 1 }), false);
expect('log a play with no timestamp', await req('POST', '/plays.json', { name: 'a' }), false);
const play = await req('POST', '/plays.json', { name: 'a', ts: 1 });
expect('overwrite a logged play', await req('PUT', `/plays/${key(play)}.json`, { name: 'b', ts: 2 }), false);
expect('wipe the play log', await req('DELETE', '/plays.json'), false);

console.log('\n-- the admin dashboard (with the key) --');
expect('read the play log', await req('GET', '/plays.json', undefined, true), true);
expect('rename one entry', await req('PATCH', `/scores/${k}.json`, { name: 'Nemo' }, true), true);
expect('bulk rename', await req('PATCH', '/scores.json', { [`${k}/name`]: 'Nemo' }, true), true);
expect('delete an entry', await req('DELETE', `/scores/${k}.json`, undefined, true), true);

console.log(failed ? `\n${failed} RULE CHECK(S) FAILED` : '\nALL RULE CHECKS PASSED');
process.exit(failed ? 1 : 0);
