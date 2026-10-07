// As imagens da tela de entrada, uma por universo (fantasia, horror, cyberpunk): o Códex edita a
// imagem de hoje, mantendo o enquadramento e o painel, e o jogo escolhe pela cena sorteada
// (client/src/ui/entrada.ts; o pedido é o docs/PROMPT-ENTRADA.txt).
//
//   node scripts/entrada-fundos.mjs bases <pasta>
//     A imagem de hoje no tamanho que o gerador devolve (1536×1024 no computador, 1024×1536 no
//     celular), com uma faixa de sobra em volta: base-computador.png e base-celular.png. É ela que
//     vai anexada no pedido, para o Códex editar.
//
//   node scripts/entrada-fundos.mjs paisagem <entrega.png> <universo> [neve]
//     A cidade lá fora do tema (vista pela janela em magenta da imagem do tema).
//
//   node scripts/entrada-fundos.mjs encaixar <entrega.png> <universo> <computador|celular>
//     A imagem que voltou vira a do universo: tira a faixa de sobra, volta ao tamanho da tela
//     (1672×941 ou 941×1672) e recebe o painel da arte de hoje por cima (o painel é a parte que os
//     campos de verdade cobrem: tem que bater no pixel). Grava
//     client/public/arte/login/fundo-<tela>-<universo>.webp e, ao lado da entrega,
//     previa-<tela>-<universo>.png, para conferir.
//
// Precisa do sharp: npm i --no-save sharp
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const RAIZ = path.resolve(import.meta.dirname, '..');
const LOGIN = path.join(RAIZ, 'client/public/arte/login');
const TELAS = {
  // tamanho da tela, tamanho do gerador, onde a tela ficava dentro da base (x, y: a faixa de sobra
  // em volta, que o gerador continua com a cena) e o recorte que vira a tela (cx, cy): alinhado ao
  // topo no computador e à direita no celular, onde a janela mostra mais vidro (o recorte de antes,
  // centrado, cortava a janela, que continua para cima e para a direita)
  computador: { w: 1672, h: 941, gw: 1536, gh: 1024, x: 0, y: 80, iw: 1536, ih: 864, cx: 0, cy: 0 },
  celular: { w: 941, h: 1672, gw: 1024, gh: 1536, x: 80, y: 0, iw: 864, ih: 1536, cx: 160, cy: 0 },
};
/**
 * o painel em cada tela (client/src/ui/entradaPainel.json, que o jogo também usa):
 *   contorno: a moldura dourada com os cantos cortados e o enfeite de baixo (o jogo não ilumina o que está
 *             dentro dele); o emblema não entra, ele sobe por cima do painel na imagem da logo
 *   apagar:   o que tirar do painel desenhado de hoje (o emblema e as letras do CRONA, que agora são a logo
 *             nova, uma imagem por cima): cada retângulo é refeito repetindo, na horizontal, uma faixa limpa
 *             do painel (`larg` colunas a partir de `origem`) na mesma altura
 */
const PAINEL = JSON.parse(fs.readFileSync(path.join(RAIZ, 'client/src/ui/entradaPainel.json'), 'utf8'));
const UNIVERSOS = ['fantasia', 'horror', 'cyberpunk'];

async function bases(pasta) {
  fs.mkdirSync(pasta, { recursive: true });
  for (const [tela, T] of Object.entries(TELAS)) {
    const dentro = await sharp(path.join(LOGIN, `fundo-${tela}.webp`)).resize(T.iw, T.ih, { kernel: 'lanczos3' }).png().toBuffer();
    const arq = path.join(pasta, `base-${tela}.png`);
    await sharp(dentro)
      .extend({ top: T.y, bottom: T.gh - T.ih - T.y, left: T.x, right: T.gw - T.iw - T.x, extendWith: 'copy' })
      .png()
      .toFile(arq);
    console.log(`${path.relative(process.cwd(), arq)}  (${T.gw}×${T.gh})`);
  }
}

/** a máscara do painel (branco = painel), com a borda suavizada; `sombra`: a mesma forma, mais baixa e borrada */
function mascara(tela, sombra = false) {
  const T = TELAS[tela];
  const dy = sombra ? 7 : 0;
  const poligonos = PAINEL[tela].contorno.map((p) => `<polygon points="${p.map(([x, y]) => `${x},${y + dy}`).join(' ')}" fill="#fff"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${T.w}" height="${T.h}"><rect width="100%" height="100%" fill="#000"/>${poligonos}</svg>`;
  return sharp(Buffer.from(svg)).blur(sombra ? 9 : 1).toColourspace('b-w').raw().toBuffer();
}

async function encaixar(entrega, universo, tela) {
  if (!UNIVERSOS.includes(universo)) throw new Error(`universo "${universo}": use ${UNIVERSOS.join(', ')}`);
  const T = TELAS[tela];
  if (!T) throw new Error(`tela "${tela}": use computador ou celular`);
  // (o sharp faz um resize por vez: cada passo sai num buffer)
  const cheia = await sharp(entrega).resize(T.gw, T.gh, { fit: 'fill' }).png().toBuffer();
  const meio = await sharp(cheia).extract({ left: T.cx, top: T.cy, width: T.iw, height: T.ih }).png().toBuffer();
  const corpo = await sharp(meio).resize(T.w, T.h, { kernel: 'lanczos3', fit: 'fill' }).removeAlpha().raw().toBuffer();
  const hoje = await sharp(path.join(LOGIN, `fundo-${tela}.webp`)).removeAlpha().raw().toBuffer();
  for (const { x0, y0, x1, y1, origem, larg } of PAINEL[tela].apagar) {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        for (let c = 0; c < 3; c++) hoje[(y * T.w + x) * 3 + c] = hoje[(y * T.w + origem + ((x - x0) % larg)) * 3 + c];
  }
  const m = await mascara(tela);
  const sombra = await mascara(tela, true);
  const saida = Buffer.alloc(T.w * T.h * 3);
  for (let i = 0; i < T.w * T.h; i++) {
    const a = m[i] / 255;
    // o painel assenta na mesa: uma sombra suave em volta, que tira o ar de caixa colada
    const escuro = 1 - 0.55 * (sombra[i] / 255) * (1 - a);
    for (let c = 0; c < 3; c++) saida[i * 3 + c] = Math.round(corpo[i * 3 + c] * escuro * (1 - a) + hoje[i * 3 + c] * a);
  }
  const img = sharp(saida, { raw: { width: T.w, height: T.h, channels: 3 } });
  const destino = path.join(LOGIN, `fundo-${tela}-${universo}.webp`);
  await img.clone().webp({ quality: 95 }).toFile(destino);
  const previa = path.join(path.dirname(entrega), `previa-${tela}-${universo}.png`);
  await img.clone().png().toFile(previa);
  console.log(`${path.relative(process.cwd(), destino)}\n  conferir: ${path.relative(process.cwd(), previa)}`);
}

/**
 * A paisagem lá fora de um tema (o céu em magenta, as janelas das casas em verde): vai sem perda
 * (o jogo tira o magenta e acende o verde pela cor exata) para client/public/arte/login/
 * paisagem-<tema>.webp, ou paisagem-<tema>-neve.webp na versão com neve.
 */
async function paisagem(entrega, tema, neve) {
  if (!UNIVERSOS.includes(tema)) throw new Error(`tema "${tema}": use ${UNIVERSOS.join(', ')}`);
  const destino = path.join(LOGIN, `paisagem-${tema}${neve ? '-neve' : ''}.webp`);
  // no tamanho em que aparece na janela (mais leve para o celular)
  await sharp(entrega).resize(1024, 683, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 90, effort: 6 }).toFile(destino);
  console.log(path.relative(process.cwd(), destino));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'bases' && args[0]) await bases(args[0]);
else if (cmd === 'encaixar' && args.length === 3) await encaixar(...args);
else if (cmd === 'paisagem' && (args.length === 2 || (args.length === 3 && args[2] === 'neve'))) await paisagem(args[0], args[1], args[2] === 'neve');
else {
  console.log('uso:\n  node scripts/entrada-fundos.mjs bases <pasta>\n  node scripts/entrada-fundos.mjs encaixar <entrega.png> <fantasia|horror|cyberpunk> <computador|celular>\n  node scripts/entrada-fundos.mjs paisagem <entrega.png> <fantasia|horror|cyberpunk> [neve]');
  process.exit(1);
}
