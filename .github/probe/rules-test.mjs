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
const run = { name: 'Nemo', score: 33, ts: 1791439617207, pid: 'dev1' };
const runKey = '-0muz4w793vpwzmxfr43'; // the game derives this from the device id and the run's timestamp
expect('save a run under its own key', await req('PUT', `/scores/${runKey}.json`, run), true);
expect('re-send the same run (second tab, lost reply)', await req('PUT', `/scores/${runKey}.json`, run), true);
expect('re-send the same run under a new name', await req('PUT', `/scores/${runKey}.json`, { ...run, name: 'King' }), true);
expect('re-send the run with a different score', await req('PUT', `/scores/${runKey}.json`, { ...run, score: 34 }), false);
expect('re-send the run flagged as restored', await req('PUT', `/scores/${runKey}.json`, { ...run, backfill: true }), false);
expect('name with an emoji family (zero-width joiners)', await req('POST', '/scores.json', { name: '👨‍👩‍👧 Fam', score: 4, ts: Date.now(), pid: 'dev1' }), true);
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
await req('PUT', '/scores/oldkey.json', { name: 'Junk' }, true); // legacy junk: no score, non-push key
expect('rename a legacy entry with no score under an old-style key', await req('PATCH', '/scores.json', { 'oldkey/name': 'Fixed', [`${key(seeded)}/name`]: 'Leg2' }), true);

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
expect('change an entry\'s timestamp', await req('PATCH', '/scores.json', { [`${k}/ts`]: 1e300 }), false);
expect('forge the restored flag on an entry', await req('PATCH', '/scores.json', { [`${k}/backfill`]: true }), false);
expect('hide an entry', await req('PATCH', '/scores.json', { [`${k}/hidden`]: true }), false);
expect('save a score pre-marked as moderated', await req('POST', '/scores.json', { name: 'x', score: 1, mod: true }), false);
expect('hide a score with a priority payload', await req('PUT', `/scores/${k}/.priority.json`, 'x'.repeat(1000)), false);
expect('save a score carrying a priority', await req('POST', '/scores.json', { name: 'x', score: 1, '.priority': 'y'.repeat(1000) }), false);
expect('log a play carrying a priority', await req('POST', '/plays.json', { ts: 1, '.priority': 'y' }), false);
expect('a blank-looking name (a space)', await req('POST', '/scores.json', { name: ' ', score: 1 }), false);
expect('a name with a trailing space', await req('POST', '/scores.json', { name: 'Eve ', score: 1 }), false);
expect('an invisible name (zero-width space)', await req('POST', '/scores.json', { name: '\u200b', score: 1 }), false);
expect('a name that flips text direction', await req('POST', '/scores.json', { name: '\u202eEve', score: 1 }), false);
expect('a score dated two days ahead', await req('POST', '/scores.json', { name: 'x', score: 1, ts: Date.now() + 2 * 864e5 }), false);
expect('a play dated two days ahead', await req('POST', '/plays.json', { name: 'a', ts: Date.now() + 2 * 864e5 }), false);
expect('a play with an impossible score', await req('POST', '/plays.json', { name: 'a', ts: 1, score: 151 }), false);
expect('a play on level 6', await req('POST', '/plays.json', { name: 'a', ts: 1, lvl: 6 }), false);

console.log('\n-- the admin dashboard (with the key) --');
expect('read the play log', await req('GET', '/plays.json', undefined, true), true);
expect('rename one entry (marked moderated)', await req('PATCH', `/scores/${k}.json`, { name: 'Nemo', mod: true }, true), true);
expect('hide an entry', await req('PATCH', `/scores/${runKey}.json`, { hidden: true }, true), true);
expect('game: re-send a hidden run (stays hidden)', await req('PUT', `/scores/${runKey}.json`, run), false);
expect('game: rename a moderated entry\'s sibling fields untouched', await req('PATCH', '/scores.json', { [`${k}/name`]: 'Again' }), true);
expect('unhide an entry', await req('PATCH', `/scores/${runKey}.json`, { hidden: null }, true), true);
expect('bulk rename', await req('PATCH', '/scores.json', { [`${k}/name`]: 'Nemo' }, true), true);
expect('delete an entry', await req('DELETE', `/scores/${k}.json`, undefined, true), true);

console.log('\n-- two-phone duels (public, no key) --');
const room = '/duels/KXTP';
const me = { n: 'Nemo', rd: 1 };
expect('look up a room that does not exist yet', await req('GET', `${room}.json`), true);
expect('host opens a room', await req('PATCH', `${room}.json`, { ts: { '.sv': 'timestamp' }, seed: 0, go: 0, p1: me, p2: null }), true);
expect('guest joins', await req('PUT', `${room}/p2.json`, { n: 'Bubbles', rd: 1 }), true);
expect('host starts round 1', await req('PATCH', `${room}.json`, { seed: 4123456789, go: 1 }), true);
expect('a player reports position', await req('PUT', `${room}/p1.json`, { ...me, g: 1, y: 0.42, s: 3, d: 0 }), true);
expect('a player reports being out', await req('PUT', `${room}/p2.json`, { n: 'Bubbles', rd: 1, g: 1, y: 0.87, s: 3, d: 1 }), true);
expect('a player asks for a rematch', await req('PUT', `${room}/p2.json`, { n: 'Bubbles', rd: 2 }), true);
expect('read the room', await req('GET', `${room}.json`), true);
expect('a player leaves', await req('DELETE', `${room}/p2.json`), true);
expect('host reopens a stale room', await req('PATCH', `${room}.json`, { ts: { '.sv': 'timestamp' }, seed: 0, go: 0, p1: me, p2: null }), true);

console.log('\n-- a vandal in the duel rooms (public, no key) --');
expect('list every room', await req('GET', '/duels.json'), false);
expect('read a room with a malformed code', await req('GET', '/duels/abcd.json'), false);
expect('open a room with a lowercase code', await req('PATCH', '/duels/abcd.json', { ts: { '.sv': 'timestamp' }, seed: 0, go: 0, p1: me }), false);
expect('join a room with a long code', await req('PUT', '/duels/ABCDE/p1.json', me), false);
expect('overwrite a whole room', await req('PUT', `${room}.json`, { go: 5, p1: me }), false);
expect('delete a whole room', await req('DELETE', `${room}.json`), false);
expect('a third player', await req('PUT', `${room}/p3.json`, me), false);
expect('an unknown room field', await req('PATCH', `${room}.json`, { junk: 'x'.repeat(1000) }), false);
expect('a room dated long ago', await req('PATCH', `${room}.json`, { ts: 1 }), false);
expect('a fractional round number', await req('PATCH', `${room}.json`, { go: 1.5 }), false);
expect('a player with an unknown field', await req('PUT', `${room}/p1.json`, { ...me, junk: 1 }), false);
expect('a player with a huge name', await req('PUT', `${room}/p1.json`, { n: 'x'.repeat(25), rd: 1 }), false);
expect('a player without a name', await req('PUT', `${room}/p1.json`, { rd: 1 }), false);
expect('a player far off screen', await req('PUT', `${room}/p1.json`, { ...me, y: 99 }), false);
expect('a player with a text score', await req('PUT', `${room}/p1.json`, { ...me, s: 'lots' }), false);
expect('a player carrying a priority', await req('PUT', `${room}/p1.json`, { ...me, '.priority': 'y'.repeat(1000) }), false);

console.log('\n-- the daily course (public, no key) --');
const dn = Math.floor(Date.now() / 86400000);
const day = { name: 'Nemo', score: 12, dn, ts: Date.now(), g: '0aZ9kk' };
expect('read today\'s board', await req('GET', '/daily.json'), true);
expect('save a first daily run', await req('PUT', '/daily/dev1.json', day), true);
expect('improve the daily run', await req('PUT', '/daily/dev1.json', { ...day, score: 20 }), true);
expect('re-send the same daily run', await req('PUT', '/daily/dev1.json', { ...day, score: 20 }), true);
expect('rename on the daily board', await req('PUT', '/daily/dev1.json', { ...day, score: 20, name: 'King' }), true);
expect('a daily run from just before midnight (yesterday)', await req('PUT', '/daily/dev2.json', { ...day, dn: dn - 1 }), true);
expect('the next day\'s first run replaces a higher old score', await req('PUT', '/daily/dev2.json', { ...day, score: 1 }), true);
expect('a daily run with no ghost path', await req('PUT', '/daily/dev3.json', { name: 'Nemo', score: 3, dn }), true);

console.log('\n-- a vandal on the daily board (public, no key) --');
expect('lower someone\'s daily score', await req('PUT', '/daily/dev1.json', { ...day, score: 5 }), false);
expect('wipe a daily entry', await req('DELETE', '/daily/dev1.json'), false);
expect('wipe the whole daily board', await req('DELETE', '/daily.json'), false);
expect('overwrite the whole daily board', await req('PUT', '/daily.json', { dev1: day }), false);
expect('a daily score above the winning score', await req('PUT', '/daily/dev4.json', { ...day, score: 151 }), false);
expect('a daily run dated next week', await req('PUT', '/daily/dev4.json', { ...day, dn: dn + 7 }), false);
expect('a daily run dated last week', await req('PUT', '/daily/dev4.json', { ...day, dn: dn - 7 }), false);
expect('pull a daily entry back to an earlier day', await req('PUT', '/daily/dev1.json', { ...day, dn: dn - 1, score: 150 }), false);
expect('a huge ghost path', await req('PUT', '/daily/dev4.json', { ...day, g: 'a'.repeat(701) }), false);
expect('a ghost path with markup in it', await req('PUT', '/daily/dev4.json', { ...day, g: '<img>' }), false);
expect('a daily entry under a strange device id', await req('PUT', '/daily/dev.4$.json', day), false);
expect('a daily entry with an unknown field', await req('PUT', '/daily/dev4.json', { ...day, junk: 1 }), false);
expect('a daily entry with an invisible name', await req('PUT', '/daily/dev4.json', { ...day, name: '​' }), false);
expect('a daily entry carrying a priority', await req('PUT', '/daily/dev4.json', { ...day, '.priority': 'y'.repeat(1000) }), false);

console.log(failed ? `\n${failed} RULE CHECK(S) FAILED` : '\nALL RULE CHECKS PASSED');
process.exit(failed ? 1 : 0);
