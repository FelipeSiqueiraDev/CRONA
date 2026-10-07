// A arte mais leve para quem joga de fora (pelo link): cada PNG de <pasta> (a arte) ganha uma cópia
// em WebP numa pasta espelho ao lado, `arte-leve/` (o mesmo caminho, com .webp no lugar de .png),
// umas 4 vezes menor; o servidor manda a cópia para o navegador que aceita WebP
// (server/src/index.ts). Assim a pasta da arte fica só com as imagens de verdade.
// Roda no `node scripts/jogo.mjs atualizar` e na montagem da imagem do Docker (Dockerfile).
//
//   node scripts/webp.mjs <pasta>     (precisa do sharp: npm i --no-save sharp)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const raiz = process.argv[2];
if (!raiz || !fs.existsSync(raiz)) throw new Error('uso: node scripts/webp.mjs <pasta>');

const leve = path.join(path.dirname(path.resolve(raiz)), 'arte-leve');
/** a cópia leve de um PNG da arte */
const copia = (p) => path.join(leve, path.relative(raiz, p)).replace(/\.png$/i, '.webp');

const pngs = [];
const andar = (dir) => {
  for (const it of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) andar(p);
    else if (/\.png$/i.test(it.name)) pngs.push(p);
    // as cópias antigas, de quando ficavam ao lado do PNG: vão para a pasta espelho
    else if (/\.png\.webp$/i.test(it.name)) {
      const novo = copia(p.slice(0, -5));
      fs.mkdirSync(path.dirname(novo), { recursive: true });
      fs.renameSync(p, novo);
    }
  }
};
andar(raiz);

let antes = 0;
let depois = 0;
let feitos = 0;
const fila = [...pngs];
async function trabalhar() {
  for (let p = fila.shift(); p; p = fila.shift()) {
    try {
      // já convertido e mais novo que o PNG: pula (a segunda vez é rápida)
      const destino = copia(p);
      if (fs.existsSync(destino) && fs.statSync(destino).mtimeMs >= fs.statSync(p).mtimeMs) continue;
      const buf = await sharp(p).webp({ quality: 88, alphaQuality: 100, effort: 4 }).toBuffer();
      const tam = fs.statSync(p).size;
      antes += tam;
      // só vale a cópia se ela for bem menor
      if (buf.length < tam * 0.9) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, buf);
        depois += buf.length;
        feitos++;
      } else depois += tam;
    } catch (e) {
      console.warn(`[webp] pulei ${p}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, trabalhar));
console.log(`[webp] ${feitos} de ${pngs.length} PNGs: ${(antes / 1048576).toFixed(0)} MB -> ${(depois / 1048576).toFixed(0)} MB`);
