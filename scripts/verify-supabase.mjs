/**
 * End-to-end check of supabase/schema.sql against the configured project.
 *
 *   node scripts/verify-supabase.mjs
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local (or env).
 * If the host account is NOT yet claimed it runs the full write flow with a
 * temporary host, then deletes the test tournament and releases the host again,
 * leaving the database exactly as it was. If a host already exists it only runs
 * read-only / negative checks.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2];
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const ok = (label) => console.log(`  PASS  ${label}`);
const bad = (label, detail) => {
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};
async function rpc(fn, params) {
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data;
}
async function expectError(label, fn, code) {
  try {
    await fn();
    bad(label, 'expected an error');
  } catch (e) {
    if (String(e.message).includes(code)) ok(label);
    else bad(label, e.message);
  }
}
async function check(label, fn) {
  try {
    const r = await fn();
    if (r === false) bad(label);
    else ok(label);
  } catch (e) {
    bad(label, e.message);
  }
}

console.log(`Supabase: ${url}`);
console.log('\nRead-only & security checks');
await check('tournaments readable', async () => !(await sb.from('tournaments').select('id').limit(1)).error);
await check('app_settings readable', async () => !(await sb.from('app_settings').select('active_tournament_id').maybeSingle()).error);
await check('app_host NOT readable', async () => !!(await sb.from('app_host').select('*').limit(1)).error);
await check('tournament_secrets NOT readable', async () => !!(await sb.from('tournament_secrets').select('*').limit(1)).error);
await check('tournament_sessions NOT readable', async () => !!(await sb.from('tournament_sessions').select('*').limit(1)).error);
await check('direct insert blocked', async () => !!(await sb.from('tournaments').insert({ id: 'hack', state: {} })).error);
await expectError('bogus token rejected', () => rpc('create_tournament', { p_token: 'nope', p_id: 'x', p_name: 'x', p_scorer_pin: '1234', p_state: {}, p_client_id: null }), 'unauthorized');

let status;
try {
  status = await rpc('host_status', {});
  ok(`host_status (claimed: ${status.claimed})`);
} catch (e) {
  bad('host_status', `${e.message} — has schema v2 been run?`);
  process.exit(1);
}

if (status.claimed) {
  console.log('\nHost already claimed: skipping write-flow checks.');
} else {
  console.log('\nFull write flow (temporary host, cleaned up afterwards)');
  const user = `verify_${randomBytes(3).toString('hex')}`;
  const pass = randomBytes(12).toString('hex');
  const tid = `verify-${randomBytes(4).toString('hex')}`;
  let host;
  try {
    host = await rpc('claim_host', { p_username: user, p_password: pass });
    ok('claim_host');
    await expectError('second claim refused', () => rpc('claim_host', { p_username: 'x'.repeat(5), p_password: 'y'.repeat(8) }), 'host_already_claimed');
    await expectError('wrong host password refused', () => rpc('host_login', { p_username: user, p_password: 'wrong-pass' }), 'invalid_credentials');
    const host2 = await rpc('host_login', { p_username: user.toUpperCase(), p_password: pass });
    ok('host_login (case-insensitive username)');

    const state = { schemaVersion: 2, meta: { id: tid, name: 'Verify Cup', createdAt: 1 }, security: { pinVersion: 1 } };
    await rpc('create_tournament', { p_token: host, p_id: tid, p_name: 'Verify Cup', p_scorer_pin: '1234', p_state: state, p_client_id: 'verify' });
    ok('create_tournament');
    await expectError('duplicate id refused', () => rpc('create_tournament', { p_token: host, p_id: tid, p_name: 'x', p_scorer_pin: '1234', p_state: state, p_client_id: null }), 'tournament_exists');

    await rpc('set_active_tournament', { p_token: host, p_id: tid });
    const { data: settings } = await sb.from('app_settings').select('active_tournament_id').maybeSingle();
    settings?.active_tournament_id === tid ? ok('set_active_tournament') : bad('set_active_tournament', JSON.stringify(settings));

    await expectError('wrong scorer PIN refused', () => rpc('scorer_login', { p_id: tid, p_pin: '0000' }), 'invalid_pin');
    const scorer = await rpc('scorer_login', { p_id: tid, p_pin: '1234' });
    scorer?.token && scorer.pinVersion === 1 ? ok('scorer_login') : bad('scorer_login', JSON.stringify(scorer));

    const save = await rpc('save_tournament_state', { p_token: scorer.token, p_id: tid, p_state: { ...state, meta: { ...state.meta, name: 'Renamed Cup' } }, p_version: 2, p_updated_at_ms: Date.now(), p_client_id: 'verify' });
    save.ok ? ok('scorer can save state') : bad('scorer save', JSON.stringify(save));
    const stale = await rpc('save_tournament_state', { p_token: host2, p_id: tid, p_state: state, p_version: 2, p_updated_at_ms: Date.now(), p_client_id: 'verify' });
    stale.reason === 'stale_version' ? ok('stale version rejected') : bad('stale version', JSON.stringify(stale));
    const { data: row } = await sb.from('tournaments').select('name, version').eq('id', tid).maybeSingle();
    row?.name === 'Renamed Cup' && Number(row.version) === 2 ? ok('name synced from snapshot') : bad('name sync', JSON.stringify(row));
    const { data: head } = await sb.from('tournament_heads').select('version').eq('id', tid).maybeSingle();
    Number(head?.version) === 2 ? ok('tournament_heads mirrored') : bad('heads', JSON.stringify(head));

    const n = await rpc('append_dart_throws', { p_token: scorer.token, p_id: tid, p_throws: [{ id: 'd1', matchId: 'match_01', timestamp: 1 }] });
    n === 1 ? ok('append_dart_throws') : bad('append_dart_throws', String(n));

    const v = await rpc('rotate_scorer_pin', { p_token: host, p_id: tid, p_new_pin: '5678' });
    v === 2 ? ok('rotate_scorer_pin') : bad('rotate_scorer_pin', String(v));
    const after = await rpc('validate_session', { p_token: scorer.token, p_id: tid });
    after.valid === false ? ok('old scorer session kicked out') : bad('kickout', JSON.stringify(after));
    const kicked = await rpc('save_tournament_state', { p_token: scorer.token, p_id: tid, p_state: state, p_version: 3, p_updated_at_ms: Date.now(), p_client_id: 'verify' });
    kicked.reason === 'unauthorized' ? ok('kicked scorer cannot write') : bad('kicked write', JSON.stringify(kicked));
    await expectError('old PIN refused', () => rpc('scorer_login', { p_id: tid, p_pin: '1234' }), 'invalid_pin');
    await check('new PIN accepted', async () => !!(await rpc('scorer_login', { p_id: tid, p_pin: '5678' })).token);

    await rpc('update_tournament_meta', { p_token: host, p_id: tid, p_name: null, p_archived: true });
    const { data: s2 } = await sb.from('app_settings').select('active_tournament_id').maybeSingle();
    s2?.active_tournament_id === null ? ok('archiving the live tournament clears it') : bad('archive', JSON.stringify(s2));

    await rpc('logout', { p_token: host2 });
    const lo = await rpc('validate_session', { p_token: host2, p_id: null });
    lo.valid === false ? ok('logout revokes session') : bad('logout', JSON.stringify(lo));
  } catch (e) {
    bad('write flow aborted', e.message);
  } finally {
    if (host) {
      try {
        await rpc('delete_tournament', { p_token: host, p_id: tid });
        const { data } = await sb.from('tournaments').select('id').eq('id', tid);
        data?.length === 0 ? ok('cleanup: test tournament deleted') : bad('cleanup delete');
        await rpc('release_host', { p_token: host });
        const st = await rpc('host_status', {});
        st.claimed === false ? ok('cleanup: host released (ready for you to claim)') : bad('cleanup release');
      } catch (e) {
        bad('cleanup', e.message);
      }
    }
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
