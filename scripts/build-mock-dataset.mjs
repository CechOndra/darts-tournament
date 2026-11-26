// Builds local-data/mock-dataset.json (git-ignored) for the admin "Load mock dataset" button.
//
//   node scripts/build-mock-dataset.mjs
//
// Teams: names + logos are fetched once from univerzitnihokej.cz (robots.txt allows everything but /admin),
// cached in local-data/logos/, 8 requests, 0.5 s apart. Logos belong to the teams: local testing only.
// Players: optional local-data/players/players.json = [{ "name": "...", "nickname": "...", "photo": "file.jpg" }, ...]
// with the photo files next to it (first 16 are used, 2 per team). Missing ones are filled with random Czech
// names in the browser. Nothing under local-data/ is ever committed (see .gitignore).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const BASE = 'https://www.univerzitnihokej.cz';
const TEAMS = [
  ['boostrava', 18], ['engineersprague', 20], ['czufarmers', 26], ['hcmuni', 21],
  ['unitedhk', 36], ['hcnorthwings', 32], ['ukpraha.hockey', 23], ['ridersupce', 34],
];
const ROOT = 'local-data';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (path) => fetch(BASE + path, { headers: { 'User-Agent': 'darts-tournament-local-test/1.0' } });
const dataUrl = (file, mime) => `data:${mime};base64,${readFileSync(file).toString('base64')}`;

mkdirSync(join(ROOT, 'logos'), { recursive: true });
mkdirSync(join(ROOT, 'players'), { recursive: true });

const teams = [];
for (const [slug, id] of TEAMS) {
  const cache = join(ROOT, 'logos', `${id}.json`);
  if (!existsSync(cache)) {
    const html = await (await get(`/${slug}`)).text();
    const title = html.match(/<title>([^<|]*)/i)?.[1]?.trim();
    const logo = await get(`/photo/team/team_${id}.png`);
    if (!title || !logo.ok) throw new Error(`Could not fetch team ${slug}`);
    writeFileSync(join(ROOT, 'logos', `${id}.png`), Buffer.from(await logo.arrayBuffer()));
    writeFileSync(cache, JSON.stringify({ name: title }));
    await sleep(500);
  }
  const { name } = JSON.parse(readFileSync(cache, 'utf8'));
  teams.push({ name, logo: dataUrl(join(ROOT, 'logos', `${id}.png`), 'image/png'), players: [] });
}

const profiles = join(ROOT, 'players', 'players.json');
const people = existsSync(profiles) ? JSON.parse(readFileSync(profiles, 'utf8')).slice(0, 16) : [];
people.forEach((p, i) => {
  const photoFile = p.photo ? join(ROOT, 'players', p.photo) : null;
  teams[Math.floor(i / 2)].players.push({
    name: p.name || undefined,
    nickname: p.nickname || undefined,
    photo: photoFile && existsSync(photoFile) ? dataUrl(photoFile, MIME[extname(photoFile).toLowerCase()] ?? 'image/jpeg') : undefined,
  });
});

writeFileSync(join(ROOT, 'mock-dataset.json'), JSON.stringify({ teams }));
console.log(`local-data/mock-dataset.json: ${teams.length} teams, ${people.length} player profiles`);
