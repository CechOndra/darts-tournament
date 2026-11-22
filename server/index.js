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
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

  socket.on(EVENTS.STATE_PUSH, (envelope, ack) => {
    const reply = typeof ack === 'function' ? ack : () => undefined;
    const session = sessions.get(socket.id);
    if (!session || !envelope || safeId(envelope.tournamentId) !== session.tournamentId) {
      return reply({ ok: false, reason: 'not_joined', current: null });
    }
    const record = load(session.tournamentId);
    if (!isNewer(envelope, record.envelope)) {
      return reply({ ok: false, reason: 'stale_version', current: record.envelope });
    }
    record.envelope = envelope;
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

  socket.on(EVENTS.THROWS_APPEND, ({ tournamentId, entries } = {}, ack) => {
    const record = load(tournamentId);
    for (const entry of Array.isArray(entries) ? entries : []) if (entry?.id) record.throws.set(entry.id, entry);
    schedulePersist(tournamentId);
    if (typeof ack === 'function') ack({ ok: true, count: record.throws.size });
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
