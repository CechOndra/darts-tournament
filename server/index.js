/**
 * Optional <10 ms LAN relay for VITE_TRANSPORT_MODE=local.
 *
 *   npm run build && npm run server      ->  http://<laptop-ip>:3000/#/scorer
 *
 * Express + Socket.io bound to 0.0.0.0:3000. Implements the same protocol as
 * src/services/transport/protocol.ts (SOCKET_EVENTS) and persists every accepted
 * snapshot + dart log atomically (write tmp file -> rename) to server/data/.
 * Also serves the built app from dist/ so the whole stack runs offline.
 */
import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const EVENTS = {
  JOIN: 'session:join',
  STATE_PUSH: 'state:push',
  STATE_SYNC: 'state:sync',
  LIVE_EMIT: 'live:emit',
  LIVE_EVENT: 'live:event',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_SYNC: 'presence:sync',
  THROWS_APPEND: 'throws:append',
  PING: 'latency:ping',
  CONTROL_RPC: 'control:rpc',
  CONTROL_ACTIVE: 'control:active',
};

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 3000);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, 'data');
const DIST_DIR = join(ROOT, '..', 'dist');
const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024; // snapshots may carry compressed player photos

mkdirSync(DATA_DIR, { recursive: true });

const safeId = (id) => String(id ?? 'main').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'main';
const roomOf = (tournamentId) => `tournament:${safeId(tournamentId)}`;

// ------------------------------------------------------------------ persistence
/** tournamentId -> { envelope, throws: Map<id, entry> } */
const tournaments = new Map();

function load(tournamentId) {
  const id = safeId(tournamentId);
  if (tournaments.has(id)) return tournaments.get(id);
  const record = { envelope: null, throws: new Map() };
  const file = join(DATA_DIR, `${id}.json`);
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      record.envelope = parsed.envelope ?? null;
      for (const t of parsed.throws ?? []) record.throws.set(t.id, t);
    } catch (err) {
      console.error(`[relay] could not read ${file}:`, err.message);
    }
  }
  tournaments.set(id, record);
  return record;
}

const writeTimers = new Map();
const writeChains = new Map();

/** Throttled atomic write: tmp file + rename, serialized per tournament. */
function schedulePersist(tournamentId) {
  const id = safeId(tournamentId);
  if (writeTimers.has(id)) return;
  writeTimers.set(
    id,
    setTimeout(() => {
      writeTimers.delete(id);
      const record = load(id);
      const file = join(DATA_DIR, `${id}.json`);
      const tmp = `${file}.${process.pid}.tmp`;
      const body = JSON.stringify({ envelope: record.envelope, throws: [...record.throws.values()] });
      const prev = writeChains.get(id) ?? Promise.resolve();
      const next = prev
        .then(() => writeFile(tmp, body, 'utf8'))
        .then(() => rename(tmp, file))
        .catch((err) => console.error(`[relay] persist failed for ${id}:`, err.message));
      writeChains.set(id, next);
    }, 250),
  );
}

function isNewer(candidate, current) {
  if (!current) return true;
  if (candidate.version !== current.version) return candidate.version > current.version;
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt;
  return candidate.originClientId > current.originClientId;
}

// ------------------------------------------------------------------ control (host account, directory, PINs)
// Mirrors the SECURITY DEFINER RPCs of supabase/schema.sql. Persisted to data/_control.json.
const CONTROL_FILE = join(DATA_DIR, '_control.json');
const SESSION_MS = 24 * 60 * 60 * 1000;

function loadControl() {
  try {
    if (existsSync(CONTROL_FILE)) return JSON.parse(readFileSync(CONTROL_FILE, 'utf8'));
  } catch (err) {
    console.error('[relay] could not read control file:', err.message);
  }
  return { host: null, sessions: {}, tournaments: {}, activeId: null };
}
const control = loadControl();
let controlChain = Promise.resolve();
function saveControl() {
  const body = JSON.stringify(control);
  const tmp = `${CONTROL_FILE}.${process.pid}.tmp`;
  controlChain = controlChain
    .then(() => writeFile(tmp, body, 'utf8'))
    .then(() => rename(tmp, CONTROL_FILE))
    .catch((err) => console.error('[relay] control persist failed:', err.message));
}

function hashSecret(secret, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(secret), salt, 32).toString('hex') };
}
function verifySecret(secret, stored) {
  if (!stored) return false;
  const a = Buffer.from(hashSecret(secret, stored.salt).hash, 'hex');
  const b = Buffer.from(stored.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

class RpcError extends Error {}
const fail = (code) => {
  throw new RpcError(code);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function newSession(role, tournamentId = null, pinVersion = null) {
  const token = randomBytes(18).toString('hex');
  control.sessions[token] = { role, tournamentId, pinVersion, expiresAt: Date.now() + SESSION_MS };
  return token;
}
function hostSession(token) {
  const s = control.sessions[token];
  return s && s.role === 'admin' && s.expiresAt > Date.now() ? s : null;
}
/** Host session, or scorer session of this tournament with the current pinVersion. */
function sessionFor(token, tournamentId) {
  const s = control.sessions[token];
  if (!s || s.expiresAt <= Date.now()) return null;
  if (s.role === 'admin') return s;
  const tid = safeId(tournamentId);
  const t = control.tournaments[tid];
  return s.tournamentId === tid && t && t.pinVersion === s.pinVersion ? s : null;
}
const requireHost = (token) => hostSession(token) ?? fail('unauthorized');
const validPin = (pin) => /^[0-9]{4}$/.test(String(pin ?? ''));

function setActive(id) {
  control.activeId = id;
  io.emit(EVENTS.CONTROL_ACTIVE, id);
}

const rpc = {
  hostStatus: () => ({ claimed: !!control.host }),
  claimHost: ({ username, password }) => {
    if (control.host) fail('host_already_claimed');
    if (String(username ?? '').trim().length < 3) fail('invalid_username');
    if (String(password ?? '').length < 6) fail('weak_password');
    control.host = { username: String(username).trim(), secret: hashSecret(password) };
    return newSession('admin');
  },
  hostLogin: async ({ username, password }) => {
    const h = control.host;
    if (!h || h.username.toLowerCase() !== String(username ?? '').trim().toLowerCase() || !verifySecret(password, h.secret)) {
      await sleep(600);
      fail('invalid_credentials');
    }
    return newSession('admin');
  },
  updateHostCredentials: ({ token, username, password }) => {
    requireHost(token);
    if (String(username ?? '').trim().length < 3 || String(password ?? '').length < 6) fail('invalid_credentials_format');
    control.host = { username: String(username).trim(), secret: hashSecret(password) };
    for (const [tok, s] of Object.entries(control.sessions)) if (s.role === 'admin' && tok !== token) delete control.sessions[tok];
    return true;
  },
  logout: ({ token }) => {
    delete control.sessions[token];
    return true;
  },
  validateSession: ({ token, tournamentId }) => {
    const s = tournamentId ? sessionFor(token, tournamentId) : hostSession(token);
    return s ? { valid: true, role: s.role, pinVersion: s.pinVersion } : { valid: false };
  },
  listTournaments: () =>
    Object.entries(control.tournaments)
      .map(([id, t]) => ({ id, name: t.name, archived: t.archived, createdAt: t.createdAt, updatedAt: t.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt),
  getActiveTournamentId: () => control.activeId,
  createTournament: ({ token, id, name, scorerPin, state, clientId }) => {
    requireHost(token);
    const tid = safeId(id);
    if (control.tournaments[tid]) fail('tournament_exists');
    if (!validPin(scorerPin)) fail('invalid_pin');
    const now = Date.now();
    control.tournaments[tid] = {
      name: String(name ?? '').trim() || 'Tournament',
      archived: false,
      createdAt: now,
      updatedAt: now,
      pin: hashSecret(scorerPin),
      pinVersion: 1,
    };
    const record = load(tid);
    record.envelope = { tournamentId: tid, version: 1, updatedAt: now, originClientId: clientId ?? 'relay', state };
    record.throws = new Map();
    schedulePersist(tid);
    return true;
  },
  updateTournamentMeta: ({ token, id, name, archived }) => {
    requireHost(token);
    const t = control.tournaments[safeId(id)] ?? fail('not_found');
    if (String(name ?? '').trim()) t.name = String(name).trim();
    if (typeof archived === 'boolean') t.archived = archived;
    t.updatedAt = Date.now();
    if (archived && control.activeId === safeId(id)) setActive(null);
    return true;
  },
  setActiveTournament: ({ token, id }) => {
    requireHost(token);
    if (id && !control.tournaments[safeId(id)]) fail('not_found');
    if (id) control.tournaments[safeId(id)].archived = false;
    setActive(id ? safeId(id) : null);
    return true;
  },
  deleteTournament: ({ token, id }) => {
    requireHost(token);
    const tid = safeId(id);
    delete control.tournaments[tid];
    for (const [tok, s] of Object.entries(control.sessions)) if (s.tournamentId === tid) delete control.sessions[tok];
    tournaments.delete(tid);
    const file = join(DATA_DIR, `${tid}.json`);
    if (existsSync(file)) unlinkSync(file);
    if (control.activeId === tid) setActive(null);
    return true;
  },
  scorerLogin: async ({ tournamentId, pin }) => {
    const t = control.tournaments[safeId(tournamentId)];
    if (!t || !verifySecret(pin, t.pin)) {
      await sleep(600);
      fail('invalid_pin');
    }
    return { token: newSession('scorer', safeId(tournamentId), t.pinVersion), pinVersion: t.pinVersion };
  },
  rotateScorerPin: ({ token, tournamentId, newPin }) => {
    requireHost(token);
    const tid = safeId(tournamentId);
    const t = control.tournaments[tid] ?? fail('not_found');
    if (!validPin(newPin)) fail('invalid_pin');
    t.pin = hashSecret(newPin);
    t.pinVersion += 1;
    for (const [tok, s] of Object.entries(control.sessions)) {
      if (s.role === 'scorer' && s.tournamentId === tid) delete control.sessions[tok];
    }
    return t.pinVersion;
  },
};

const READ_ONLY_RPCS = new Set(['hostStatus', 'listTournaments', 'getActiveTournamentId', 'validateSession']);

// ------------------------------------------------------------------ server
const app = express();
app.get('/health', (_req, res) => res.json({ ok: true, tournaments: tournaments.size }));
if (existsSync(DIST_DIR)) app.use(express.static(DIST_DIR));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true }, maxHttpBufferSize: MAX_PAYLOAD_BYTES });

/** socket.id -> { tournamentId, meta } */
const sessions = new Map();

function broadcastPresence(tournamentId) {
  const peers = [];
  for (const s of sessions.values()) if (s.tournamentId === tournamentId && s.meta) peers.push(s.meta);
  io.to(roomOf(tournamentId)).emit(EVENTS.PRESENCE_SYNC, peers);
}

io.on('connection', (socket) => {
  socket.on(EVENTS.JOIN, ({ tournamentId, presence } = {}, ack) => {
    const id = safeId(tournamentId);
    const previous = sessions.get(socket.id);
    if (previous && previous.tournamentId !== id) socket.leave(roomOf(previous.tournamentId));
    socket.join(roomOf(id));
    sessions.set(socket.id, { tournamentId: id, meta: presence ?? null });
    const peers = [...sessions.values()].filter((s) => s.tournamentId === id && s.meta).map((s) => s.meta);
    if (typeof ack === 'function') ack({ envelope: load(id).envelope, peers });
    broadcastPresence(id);
  });

  socket.on(EVENTS.STATE_PUSH, ({ envelope, token } = {}, ack) => {
    const reply = typeof ack === 'function' ? ack : () => undefined;
    const session = sessions.get(socket.id);
    if (!session || !envelope || safeId(envelope.tournamentId) !== session.tournamentId) {
      return reply({ ok: false, reason: 'not_joined', current: null });
    }
    const record = load(session.tournamentId);
    if (!sessionFor(token, session.tournamentId)) {
      return reply({ ok: false, reason: 'unauthorized', current: record.envelope });
    }
    if (!isNewer(envelope, record.envelope)) {
      return reply({ ok: false, reason: 'stale_version', current: record.envelope });
    }
    record.envelope = envelope;
    const meta = control.tournaments[session.tournamentId];
    if (meta) {
      meta.updatedAt = Date.now();
      if (envelope.state?.meta?.name) meta.name = String(envelope.state.meta.name);
      saveControl();
    }
    schedulePersist(session.tournamentId);
    socket.to(roomOf(session.tournamentId)).emit(EVENTS.STATE_SYNC, envelope);
    reply({ ok: true });
  });

  socket.on(EVENTS.LIVE_EMIT, (event) => {
    const session = sessions.get(socket.id);
    if (session && event) io.to(roomOf(session.tournamentId)).emit(EVENTS.LIVE_EVENT, event);
  });

  socket.on(EVENTS.PRESENCE_UPDATE, (meta) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    session.meta = meta;
    broadcastPresence(session.tournamentId);
  });

  socket.on(EVENTS.THROWS_APPEND, ({ tournamentId, entries, token } = {}, ack) => {
    if (!sessionFor(token, tournamentId)) {
      if (typeof ack === 'function') ack({ ok: false, reason: 'unauthorized' });
      return;
    }
    const record = load(tournamentId);
    for (const entry of Array.isArray(entries) ? entries : []) if (entry?.id) record.throws.set(entry.id, entry);
    schedulePersist(tournamentId);
    if (typeof ack === 'function') ack({ ok: true, count: record.throws.size });
  });

  socket.on(EVENTS.CONTROL_RPC, async ({ method, params } = {}, ack) => {
    const reply = typeof ack === 'function' ? ack : () => undefined;
    const fn = Object.hasOwn(rpc, method) ? rpc[method] : null;
    if (!fn) return reply({ ok: false, error: 'unknown_method' });
    try {
      const data = await fn(params ?? {});
      if (!READ_ONLY_RPCS.has(method)) saveControl();
      reply({ ok: true, data: data ?? null });
    } catch (err) {
      reply({ ok: false, error: err instanceof RpcError ? err.message : 'internal_error' });
      if (!(err instanceof RpcError)) console.error('[relay] rpc error', method, err);
    }
  });

  socket.on(EVENTS.PING, (_nonce, ack) => {
    if (typeof ack === 'function') ack(Date.now());
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    sessions.delete(socket.id);
    if (session) broadcastPresence(session.tournamentId);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[relay] Darts LAN relay listening on http://${HOST}:${PORT}`);
  console.log(`[relay] data dir: ${DATA_DIR}`);
  if (!existsSync(DIST_DIR)) console.log('[relay] dist/ not found — run "npm run build" to serve the app from this relay');
});
