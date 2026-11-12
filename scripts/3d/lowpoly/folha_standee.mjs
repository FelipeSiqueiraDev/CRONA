// Recorta uma folha de vistas (fundo branco) em standees por direção: tira o fundo por inundação a partir das bordas.
// uso: node scripts/3d/lowpoly/folha_standee.mjs <folha> <pastaSaida> <prefixo> dir:x0:x1 [dir:x0:x1 ...]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const [, , folha, saida, prefixo, ...cortes] = process.argv;
mkdirSync(saida, { recursive: true });
const ALT = 474;
for (const c of cortes) {
  const [dir, x0, x1] = c.split(':');
  const meta = await sharp(folha).metadata();
  const left = +x0, width = Math.min(meta.width, +x1) - left;
  const { data, info } = await sharp(folha).extract({ left, top: 0, width, height: meta.height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const fundo = (i) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= 247;
  const visto = new Uint8Array(W * H);
  const pilha = [];
  for (let x = 0; x < W; x++) pilha.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) pilha.push(y * W, y * W + W - 1);
  while (pilha.length) {
    const i = pilha.pop();
    if (visto[i] || !fundo(i)) continue;
    visto[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) pilha.push(i - 1);
    if (x < W - 1) pilha.push(i + 1);
    if (y > 0) pilha.push(i - W);
    if (y < H - 1) pilha.push(i + W);
  }
  // a borda: o pixel claro colado no fundo fica meio transparente (tira o halo branco)
  for (let i = 0; i < W * H; i++) {
    if (visto[i]) continue;
    const x = i % W, y = (i / W) | 0;
    const viz = (x > 0 && visto[i - 1]) || (x < W - 1 && visto[i + 1]) || (y > 0 && visto[i - W]) || (y < H - 1 && visto[i + W]);
    if (viz && Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= 200) data[i * 4 + 3] = 0;
  }
  const img = sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim();
  const buf = await img.png().toBuffer();
  const out = `${saida}/${prefixo}-${dir}.png`;
  await sharp(buf).resize({ height: ALT, kernel: 'lanczos3' }).png().toFile(out);
  console.log(out, (await sharp(out).metadata()).width + 'x' + ALT);
}
