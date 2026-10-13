// Mostra uma cena do jogo com a arte nova de pixel art SEM mexer no jogo: o navegador troca, só nesta visita, os
// móveis pelos de uma pasta exportada (exportar_px.py --destino) e liga o chão e a parede em pixel num estilo de piso.
//
// uso (com o `npm run dev` no ar):
//   ARTE=<pasta exportada>/ PX=<pasta de texturas px> ESTILO=<estilo do piso> node scripts/3d/estilo/ver_no_jogo.mjs saida.png "Fazenda · Cozinha"
//   ARTE: a pasta com o moveis.json e as imagens de exportar_px.py (com a barra no fim); vazio = a arte do jogo
//   PX: o nome da pasta em client/public/arte/texturas/px/ (p.ex. cozinha_fazenda); ESTILO: o floorStyle da cena (p.ex. ladrilho)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(path.join(REPO, 'package.json'));
const pw = require('playwright');
const [, , saida = 'jogo.png', cena = 'Fazenda · Cozinha'] = process.argv;
const ARTE = process.env.ARTE;
const URL_JOGO = process.env.URL_JOGO || 'http://localhost:5173/?auto';

const opcoes = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await pw.chromium.launch(opcoes);
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 2 });
if (ARTE) {
  const novo = JSON.parse(fs.readFileSync(path.join(ARTE, 'moveis.json'), 'utf8'));
  await page.route('**/arte/mobiliario/**', async (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^.*\/arte\/mobiliario\//, ''));
    if (rel === 'moveis.json') {
      const atual = await (await route.fetch()).json();
      for (const [k, v] of Object.entries(novo)) atual[k] = v;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atual) });
    }
    const f = path.join(ARTE, rel.replace(/\.webp$/, '.png'));
    if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(f) });
    return route.continue();
  });
}
if (process.env.PX && process.env.ESTILO) {
  await page.route('**/arte/texturas/texturas.json', async (route) => {
    const j = await (await route.fetch()).json();
    j[process.env.ESTILO] = { ...(j[process.env.ESTILO] || {}), px: process.env.PX };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
}
await page.goto(URL_JOGO, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__crona?.state?.rooms?.length, null, { timeout: 30000 });
await page.evaluate((nome) => {
  const r = window.__crona.state.rooms.find((x) => x.name.endsWith(nome));
  if (r) window.__crona.net.send({ t: 'join', roomId: r.id });
}, cena);
await page.waitForTimeout(4500);
await page.screenshot({ path: saida, clip: { x: 400, y: 95, width: 890, height: 580 } });
await browser.close();
console.log('ok', saida);
