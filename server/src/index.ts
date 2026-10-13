import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { WebSocketServer } from 'ws';
import { abrirBanco } from './banco';
import { fecharBanco, UPLOAD_DIR } from './db';
import { Hotel } from './hotel';

// server/.env (fora do git): CRONA_DB_URL e afins. Ver server/.env.example.
try {
  process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'));
} catch {
  /* sem .env: usa server/data/db.json */
}

// Em desenvolvimento o Vite usa PORT; o servidor fica na 3001 (ou CRONA_PORT).
// Com --prod (npm start) respeita PORT, como a maioria das hospedagens espera.
const PROD = process.argv.includes('--prod');
const PORT = Number(process.env.CRONA_PORT ?? (PROD ? process.env.PORT : undefined) ?? 3001);
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const ARTE_FONTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public/arte');
const MAX_UPLOAD = 12 * 1024 * 1024;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

await abrirBanco();
const hotel = new Hotel();

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** Texto que vale comprimir (o JS de 1 MB vira ~300 kB). */
const COMPRIME = new Set(['.js', '.css', '.html', '.json', '.svg', '.txt']);
/** O arquivo já comprimido, por caminho e data (o build não muda com o jogo no ar). */
const gzCache = new Map<string, { mtime: number; buf: Buffer }>();

/**
 * Entrega um arquivo com ETag (o navegador pergunta "mudou?" e ganha um 304 vazio, sem baixar de
 * novo) e com gzip nos textos. `cache`: o arquivo nunca muda (o nome tem o hash) e fica um ano.
 * A arte (`/arte`) fica uma hora sem nem perguntar, e depois pergunta; o resto sempre pergunta.
 */
function serveFile(res: http.ServerResponse, file: string, cache = false, req?: http.IncomingMessage) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end('Não encontrado');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const arte = file.includes(`${path.sep}arte${path.sep}`);
    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': cache ? 'public, max-age=31536000, immutable' : arte ? 'public, max-age=3600' : 'no-cache',
      ETag: etag,
    };
    // a cópia em WebP da arte (scripts/webp.mjs), para o navegador que aceita: bem menor que o PNG
    // (a pasta espelho arte-leve/, com o mesmo caminho e .webp no lugar de .png)
    if (arte && ext === '.png' && /image\/webp/.test(String(req?.headers.accept ?? ''))) {
      const i = file.lastIndexOf(`${path.sep}arte${path.sep}`);
      const leve = `${file.slice(0, i)}${path.sep}arte-leve${path.sep}${file.slice(i + 6, -4)}.webp`;
      if (fs.existsSync(leve)) {
        res.setHeader('Vary', 'Accept');
        return serveFile(res, leve, cache, req);
      }
    }
    if (req?.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const gz = COMPRIME.has(ext) && /gzip/.test(String(req?.headers['accept-encoding'] ?? ''));
    if (gz) {
      let c = gzCache.get(file);
      if (!c || c.mtime !== st.mtimeMs) {
        c = { mtime: st.mtimeMs, buf: zlib.gzipSync(fs.readFileSync(file)) };
        gzCache.set(file, c);
      }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': c.buf.length, Vary: 'Accept-Encoding' });
      res.end(c.buf);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

/** Detecta o formato pela assinatura do arquivo (não confia na extensão enviada). */
function imageExt(buf: Buffer): '.png' | '.jpg' | '.webp' | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null;
}

/** Imagem enviada pelo mestre: a folha de um personagem (vira personagem) ou a de um mapa improvisado (devolve a url). */
function handleUpload(req: http.IncomingMessage, res: http.ServerResponse, url: URL, mapa = false) {
  const client = hotel.clientByToken(url.searchParams.get('token') ?? '');
  if (!client?.name) return sendJson(res, 401, { error: 'Entre no hotel antes de enviar.' });
  if (client.role !== 'gm') return sendJson(res, 403, { error: mapa ? 'Só o mestre envia mapas.' : 'Só o mestre envia sprites.' });
  const chunks: Buffer[] = [];
  let size = 0;
  let aborted = false;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > MAX_UPLOAD) {
      aborted = true;
      sendJson(res, 413, { error: 'Imagem grande demais (máx. 12 MB).' });
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (aborted) return;
    const buf = Buffer.concat(chunks);
    const ext = imageExt(buf);
    if (!ext) return sendJson(res, 400, { error: 'Envie uma imagem PNG, JPG ou WEBP.' });
    try {
      const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20);
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, `${hash}${ext}`), buf);
      if (mapa) return sendJson(res, 200, { url: `/uploads/${hash}${ext}` });
      const name = (url.searchParams.get('name') ?? '').replace(/[\u0000-\u001f]/g, '').trim();
      const def = hotel.addCharacter(client, `/uploads/${hash}${ext}`, name);
      sendJson(res, 200, { id: def.id });
    } catch (e) {
      console.error('[upload]', e);
      sendJson(res, 500, { error: 'Falha ao salvar a imagem.' });
    }
  });
}

/**
 * Lista da arte que existe (client/public/arte, ou a cópia do build). A tela
 * só pede uma imagem que está na lista: sem arte, fica o desenho padrão, sem
 * pedido perdido no console.
 */
let arteCache: { em: number; lista: string[] } | null = null;
function listarArte(): string[] {
  if (arteCache && Date.now() - arteCache.em < 5000) return arteCache.lista;
  const raiz = fs.existsSync(ARTE_FONTE) ? ARTE_FONTE : path.join(CLIENT_DIST, 'arte');
  const lista: string[] = [];
  const andar = (dir: string, rel: string, fundo: number) => {
    if (fundo > 5) return;
    let itens: fs.Dirent[];
    try {
      itens = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of itens) {
      if (it.name.startsWith('.')) continue;
      if (it.isDirectory()) andar(path.join(dir, it.name), `${rel}/${it.name}`, fundo + 1);
      else if (/\.(png|webp|jpe?g|svg)$/i.test(it.name)) lista.push(`/arte${rel}/${it.name}`);
    }
  };
  andar(raiz, '', 0);
  arteCache = { em: Date.now(), lista };
  return lista;
}

function atender(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    route(req, res);
  } catch (e) {
    console.error('[http]', e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}
const server = http.createServer(atender);

function route(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/characters' && req.method === 'POST') return handleUpload(req, res, url);
  if (url.pathname === '/api/mapas' && req.method === 'POST') return handleUpload(req, res, url, true);
  if (url.pathname.startsWith('/uploads/')) {
    const file = path.join(UPLOAD_DIR, path.basename(url.pathname));
    return serveFile(res, file, true, req);
  }
  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
  if (url.pathname === '/api/arte') return sendJson(res, 200, { arquivos: listarArte() });

  // Cliente compilado (npm run build). Em desenvolvimento o Vite serve o cliente.
  if (!fs.existsSync(CLIENT_DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor CRONA rodando. Em desenvolvimento, abra o cliente do Vite (npm run dev).');
    return;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  // normaliza como caminho absoluto de URL antes de juntar (".." nunca sobe acima da raiz)
  let file = path.resolve(CLIENT_DIST, '.' + path.posix.normalize('/' + decoded.replace(/\\/g, '/')));
  if (file !== CLIENT_DIST && !file.startsWith(CLIENT_DIST + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(CLIENT_DIST, 'index.html');
  serveFile(res, file, file.includes(`${path.sep}assets${path.sep}`), req);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * A conexão vem deste computador? Em desenvolvimento o Vite repassa as
 * conexões e informa a origem em x-forwarded-for (a última entrada é a real).
 */
function isLocal(req: http.IncomingMessage) {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return false;
  const fwd = req.headers['x-forwarded-for'];
  const list = (Array.isArray(fwd) ? fwd.join(',') : (fwd ?? '')).split(',').map((s) => s.trim()).filter(Boolean);
  return !list.length || LOOPBACK.has(list[list.length - 1]);
}

/** Endereço deste computador na rede (para o link do tablet). No Docker, quem diz é o CRONA_IP. */
function lanAddress() {
  if (process.env.CRONA_IP) return process.env.CRONA_IP;
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return 'localhost';
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
wss.on('connection', (ws, req) => hotel.connect(ws, isLocal(req)));

/**
 * No Docker, toda conexão chega pelo mesmo endereço interno e não dá para saber quem é este
 * computador. Então há uma segunda porta, CRONA_PORTA_LOCAL, que o docker-compose publica só em
 * 127.0.0.1: quem chega por ela é este computador (o mestre, sem senha). A porta de sempre fica
 * para a rede (o tablet, os celulares).
 */
const PORTA_LOCAL = Number(process.env.CRONA_PORTA_LOCAL) || 0;
if (PORTA_LOCAL) {
  const local = http.createServer(atender);
  const wssLocal = new WebSocketServer({ server: local, path: '/ws', maxPayload: 256 * 1024 });
  wssLocal.on('connection', (ws) => hotel.connect(ws, true));
  local.listen(PORTA_LOCAL);
}

server.listen(PORT, () => {
  console.log(`[crona] servidor em http://localhost:${PORT}`);
  // em desenvolvimento a página vem do Vite (5173); em produção, deste servidor
  const port = PROD ? Number(process.env.CRONA_PORTA_REDE) || PORT : 5173;
  const lan = lanAddress();
  const portaMestre = Number(process.env.CRONA_PORTA_MESTRE) || (PORTA_LOCAL ? PORTA_LOCAL : port);
  console.log(`[crona] mestre (este computador): http://localhost:${portaMestre}`);
  console.log(`[crona] mesa (tablet):            http://${lan}:${port}/?mesa`);
  console.log(`[crona] mestre em outro aparelho: http://${lan}:${port}/?mestre=${hotel.gmKey}`);
});

let desligando = false;
async function shutdown() {
  if (desligando) return;
  desligando = true;
  try {
    await fecharBanco(hotel.db);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
