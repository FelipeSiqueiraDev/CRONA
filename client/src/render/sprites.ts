import {
  PORTRAIT_STATES,
  portraitState,
  sheetDirFor,
  TICK_MS,
  type AnimDirecao,
  type AnimKey,
  type AnimTabuleiro,
  type AnimTira,
  type BonecoClipe,
  type BonecoTabuleiro,
  type CharacterDef,
  type PortraitState,
} from '@crona/shared';

/** Quadro pronto para desenhar. w/h/ax/ay em pixels de mundo (zoom 1). */
export interface SpriteFrame {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** âncora (pés) dentro do quadro */
  ax: number;
  ay: number;
  /** pixel art: aumentando, desenha sem suavizar e no pixel inteiro da tela */
  pixel?: boolean;
  /** meia largura dos pés, em pixels de mundo (a sombra acompanha) */
  pes?: number;
  /**
   * Onde cada pé toca o chão, em relação à âncora (pixels de mundo): numa pose de três quartos,
   * o pé de trás fica mais alto na tela e precisa da sombra dele, senão parece flutuar.
   */
  pesPontos?: [number, number][];
  /**
   * A âncora está no meio dos dois pés (e não embaixo do corpo): é esse ponto que pisa no meio da
   * casa, com um pé de cada lado do anel.
   */
  noMeioDosPes?: boolean;
}

export interface LoadedChar {
  /** chave "anim:dir", ex.: "idle:sw", "walk:ne" */
  frames: Record<string, SpriteFrame[]>;
  /** folha já sem fundo, para pré-visualização */
  sheet: HTMLCanvasElement;
}

/** Poses do tabuleiro prontas: um quadro por "estado:direção" (ex.: "armado:se"), e os quadros de andar. */
export interface LoadedPoses {
  frames: Record<string, SpriteFrame>;
  /** quadros de andar por "estado:direção", em ordem (um ciclo = dois passos) */
  passos: Record<string, SpriteFrame[]>;
}

/** Até esta altura (em pixels da imagem), a pose é pixel art: vai sem cortar e sem reescalar. */
const ALTURA_PIXEL_ART = 200;

/** Superamostragem para ficar nítido no zoom 2 / telas retina. */
const RES = 2.5;
/** Nas poses: a arte em 32 bits tem mais detalhe que a folha. */
const RES_POSE = 4;


function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Falha ao carregar ' + src));
    img.src = src;
  });
}

/**
 * Remove o fundo (normalmente branco) por flood fill a partir das bordas,
 * sem apagar partes claras do personagem que estão cercadas pelo contorno.
 */
export function removeBackground(img: ImageData) {
  const { width: w, height: h, data: d } = img;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  if (corners.filter((i) => d[i * 4 + 3] < 16).length >= 3) return; // já tem transparência
  const bg = [0, 0, 0];
  for (const i of corners) for (let k = 0; k < 3; k++) bg[k] += d[i * 4 + k] / 4;
  const diff = (i: number) => {
    const p = i * 4;
    return Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2]);
  };
  const N = w * h;
  const mask = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const TOL = 66;
  const tryPush = (i: number) => {
    if (!mask[i] && diff(i) <= TOL) {
      mask[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    tryPush(x);
    tryPush((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    tryPush(y * w);
    tryPush(y * w + w - 1);
  }
  while (sp) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) tryPush(i - 1);
    if (x < w - 1) tryPush(i + 1);
    if (i >= w) tryPush(i - w);
    if (i < N - w) tryPush(i + w);
  }
  // Bolsões fechados de fundo puro (entre braço e corpo, por exemplo).
  const seen = new Uint8Array(N);
  const region: number[] = [];
  for (let s = 0; s < N; s++) {
    if (mask[s] || seen[s] || diff(s) > 20) continue;
    region.length = 0;
    seen[s] = 1;
    stack[0] = s;
    sp = 1;
    while (sp) {
      const i = stack[--sp];
      region.push(i);
      const x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of nb) {
        if (j < 0 || j >= N || seen[j] || mask[j] || diff(j) > 20) continue;
        seen[j] = 1;
        stack[sp++] = j;
      }
    }
    if (region.length >= 14) for (const i of region) mask[i] = 1;
  }
  for (let i = 0; i < N; i++) if (mask[i]) d[i * 4 + 3] = 0;
  // Suaviza o halo claro na borda.
  for (let i = 0; i < N; i++) {
    if (mask[i]) continue;
    const x = i % w;
    const edge = (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (i >= w && mask[i - w]) || (i < N - w && mask[i + w]);
    if (!edge) continue;
    const df = diff(i);
    if (df < 150) d[i * 4 + 3] = Math.min(d[i * 4 + 3], Math.round((df / 150) * 255));
  }
}

function scaleCanvas(src: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number) {
  let cur: CanvasImageSource = src;
  let cx = sx;
  let cy = sy;
  let cw = sw;
  let ch = sh;
  // reduz em etapas de no máximo 2x para manter qualidade
  while (cw / 2 > dw && ch / 2 > dh) {
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(cw / 2));
    tmp.height = Math.max(1, Math.round(ch / 2));
    const t = tmp.getContext('2d')!;
    t.imageSmoothingQuality = 'high';
    t.drawImage(cur, cx, cy, cw, ch, 0, 0, tmp.width, tmp.height);
    cur = tmp;
    cx = 0;
    cy = 0;
    cw = tmp.width;
    ch = tmp.height;
  }
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(dw));
  out.height = Math.max(1, Math.round(dh));
  const o = out.getContext('2d')!;
  o.imageSmoothingQuality = 'high';
  o.drawImage(cur, cx, cy, cw, ch, 0, 0, out.width, out.height);
  return out;
}

async function processCharacter(def: CharacterDef): Promise<LoadedChar> {
  const img = await loadImage(def.sheet);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  const sx = sheet.getContext('2d', { willReadFrequently: true })!;
  sx.drawImage(img, 0, 0);
  const data = sx.getImageData(0, 0, W, H);
  if (def.removeBg) {
    removeBackground(data);
    sx.putImageData(data, 0, 0);
  }
  const d = data.data;
  const cw = W / def.cols;
  const ch = H / def.rows;
  const cells: (Caixa & { row: number; col: number })[] = [];
  for (let row = 0; row < def.rows; row++)
    for (let col = 0; col < def.cols; col++) {
      const b = caixa(d, W, Math.floor(col * cw), Math.floor(row * ch), Math.floor((col + 1) * cw), Math.floor((row + 1) * ch));
      if (b) cells.push({ row, col, ...b });
    }
  if (!cells.length) throw new Error('Folha vazia');
  // a escala vem só das linhas de idle (sentado é mais baixo)
  const idleCells = cells.filter((c) => (def.anims?.[c.row] ?? 'idle') === 'idle');
  const s = def.height / mediana((idleCells.length ? idleCells : cells).map((c) => c.y1 - c.y0 + 1));
  const frames: Record<string, SpriteFrame[]> = {};
  for (let row = 0; row < def.rows; row++) {
    const dir = def.dirs[row];
    const key = `${def.anims?.[row] ?? 'idle'}:${dir}`;
    if (!dir || frames[key]) continue;
    const list = cells
      .filter((q) => q.row === row)
      .sort((a, b) => a.col - b.col)
      .map((c) => quadro(sheet, c, s, RES));
    if (list.length) frames[key] = list;
  }
  return { frames, sheet };
}

/** Caixa dos pixels opacos de uma área da imagem e o x dos pés. */
interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  fx: number;
}

/** Caixa dos pixels opacos entre (X0, Y0) e (X1, Y1), sem incluir estes. null = área vazia. */
function caixa(d: Uint8ClampedArray, W: number, X0: number, Y0: number, X1: number, Y1: number): Caixa | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++)
      if (d[(y * W + x) * 4 + 3] > 96) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  // pés: média dos pixels opacos na faixa de baixo
  const band = Math.max(2, Math.round((y1 - y0) * 0.08));
  let sum = 0;
  let n = 0;
  for (let y = y1 - band; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (d[(y * W + x) * 4 + 3] > 96) {
        sum += x;
        n++;
      }
  return { x0, y0, x1, y1, fx: n ? sum / n : (x0 + x1) / 2 };
}

function mediana(v: number[]) {
  const o = [...v].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

/** Recorta a caixa de `src` na escala `s` (superamostrada em `res`), com a âncora nos pés. */
function quadro(src: HTMLCanvasElement, b: Caixa, s: number, res: number): SpriteFrame {
  const bw = b.x1 - b.x0 + 1;
  const bh = b.y1 - b.y0 + 1;
  const canvas = scaleCanvas(src, b.x0, b.y0, bw, bh, bw * s * res, bh * s * res);
  return { canvas, w: bw * s, h: bh * s, ax: (b.fx - b.x0 + 0.5) * s, ay: bh * s };
}

/**
 * Arruma o alfa da pose: o quase transparente (halo em volta) some e o quase
 * opaco (corpo com alfa 253) fica opaco, para o chão não aparecer através dele.
 */
function limparAlfa(d: Uint8ClampedArray) {
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] <= 8) d[i] = 0;
    else if (d[i] >= 240) d[i] = 255;
  }
}

interface PoseLida {
  key: string;
  /** -1 = a pose parada; 0, 1, 2... = quadro de andar */
  n: number;
  machucado: boolean;
  canvas: HTMLCanvasElement;
  b: Caixa;
}

/** Carrega a imagem num canvas, com o alfa arrumado, e acha a caixa do corpo. */
async function lerPose(p: { key: string; n: number; url: string; machucado: boolean }): Promise<PoseLida> {
  const img = await loadImage(p.url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const x = canvas.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, canvas.width, canvas.height);
  limparAlfa(data.data);
  x.putImageData(data, 0, 0);
  const b = caixa(data.data, canvas.width, 0, 0, canvas.width, canvas.height);
  if (!b) throw new Error('Pose vazia: ' + p.url);
  return { key: p.key, n: p.n, machucado: p.machucado, canvas, b };
}

/**
 * Os pés na imagem: em cada coluna, o pixel mais baixo do corpo na faixa de baixo (as botas); as
 * colunas vizinhas formam um pé. Devolve até dois pés (os mais largos): [x do meio, y da sola].
 */
function pontosPes(c: HTMLCanvasElement, b: Caixa): [number, number][] {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const band = Math.max(3, Math.round((b.y1 - b.y0) * 0.14));
  const baixo: number[] = [];
  for (let x = b.x0; x <= b.x1; x++) {
    let achou = -1;
    for (let y = b.y1; y >= b.y1 - band; y--)
      if (d[(y * c.width + x) * 4 + 3] > 96) {
        achou = y;
        break;
      }
    baixo.push(achou);
  }
  // colunas seguidas (tolera um buraco de 2) viram um pé
  const pes: { x0: number; x1: number; y: number }[] = [];
  let atual: { x0: number; x1: number; y: number } | null = null;
  let buraco = 0;
  baixo.forEach((y, i) => {
    const x = b.x0 + i;
    if (y >= 0) {
      if (atual && buraco <= 2) (atual.x1 = x), (atual.y = Math.max(atual.y, y));
      else pes.push((atual = { x0: x, x1: x, y }));
      buraco = 0;
    } else buraco++;
  });
  const minimo = Math.max(2, (b.x1 - b.x0) * 0.06);
  return pes
    .filter((p) => p.x1 - p.x0 + 1 >= minimo)
    .sort((a, z) => z.x1 - z.x0 - (a.x1 - a.x0))
    .slice(0, 2)
    .map((p) => [(p.x0 + p.x1 + 1) / 2, p.y + 1]);
}

/** Meia largura dos pés (a faixa de baixo do corpo), em pixels da imagem. */
function meiaLarguraPes(c: HTMLCanvasElement, b: Caixa): number {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const band = Math.max(2, Math.round((b.y1 - b.y0) * 0.06));
  let x0 = Infinity;
  let x1 = -1;
  for (let y = b.y1 - band; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++)
      if (d[(y * c.width + x) * 4 + 3] > 96) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  return x1 < 0 ? (b.x1 - b.x0) / 2 : (x1 - x0 + 1) / 2;
}

/**
 * Poses do tabuleiro (CharacterDef.poses e .passos): uma imagem por estado e
 * direção, e os quadros de andar, todos na mesma escala e com os pés no mesmo
 * ponto. Dois jeitos:
 * - pixel art (imagens pequenas, até ALTURA_PIXEL_ART): a imagem vai inteira,
 *   numa escala inteira (cada pixel da arte vira 1, 2... pixels de mundo), e a
 *   âncora é a da pose parada da direção, também nos quadros de andar (que têm
 *   o mesmo tamanho);
 * - arte grande (as poses realistas do Tepes): recortada no corpo e reduzida,
 *   com a escala das poses sem machucado (a machucada pode curvar o corpo).
 */
async function processPoses(def: CharacterDef): Promise<LoadedPoses> {
  const pedidos: { key: string; n: number; url: string; machucado: boolean }[] = [];
  for (const [estado, dirs] of Object.entries(def.poses ?? {}))
    for (const [dir, url] of Object.entries(dirs ?? {})) if (url) pedidos.push({ key: `${estado}:${dir}`, n: -1, url, machucado: estado.endsWith('machucado') });
  for (const [estado, dirs] of Object.entries(def.passos ?? {}))
    for (const [dir, urls] of Object.entries(dirs ?? {})) (urls ?? []).forEach((url, n) => pedidos.push({ key: `${estado}:${dir}`, n, url, machucado: estado.endsWith('machucado') }));
  const lidas = await Promise.allSettled(pedidos.map(lerPose));
  const todas: PoseLida[] = [];
  for (const r of lidas) {
    if (r.status === 'fulfilled') todas.push(r.value);
    else console.warn('[sprites]', r.reason);
  }
  const poses = todas.filter((p) => p.n < 0);
  if (!poses.length) throw new Error('Nenhuma pose carregou');
  const inteiras = poses.filter((p) => !p.machucado);
  const altura = mediana((inteiras.length ? inteiras : poses).map((p) => p.b.y1 - p.b.y0 + 1));
  const frames: Record<string, SpriteFrame> = {};
  const passos: Record<string, SpriteFrame[]> = {};
  if (altura <= ALTURA_PIXEL_ART) {
    // pixel art: escala inteira, a imagem inteira, a âncora da pose parada
    const s = Math.max(1, Math.round(def.height / altura));
    const ancora = new Map<string, { ax: number; ay: number; pes: number; noMeioDosPes: boolean }>();
    const ancoraDe = (p: PoseLida) => {
      // com os dois pés à vista, a âncora fica no meio deles (é ali que a peça pisa); senão, embaixo do corpo
      const pp = pontosPes(p.canvas, p.b);
      const meio = pp.length === 2;
      const ax = meio ? Math.round(((pp[0][0] + pp[1][0]) / 2) * s) : (p.b.fx + 0.5) * s;
      const ay = meio ? Math.round(((pp[0][1] + pp[1][1]) / 2) * s) : (p.b.y1 + 1) * s;
      return { ax, ay, pes: meiaLarguraPes(p.canvas, p.b) * s, noMeioDosPes: meio };
    };
    for (const p of poses) ancora.set(p.key, ancoraDe(p));
    // os quadros de andar usam a âncora da pose parada (o corpo não escorrega); os pés, cada um os seus
    const inteiro = (p: PoseLida): SpriteFrame => {
      const a = ancora.get(p.key) ?? ancoraDe(p);
      const pesPontos = pontosPes(p.canvas, p.b).map(([x, y]): [number, number] => [x * s - a.ax, y * s - a.ay]);
      return { canvas: p.canvas, w: p.canvas.width * s, h: p.canvas.height * s, ...a, pesPontos, pixel: true };
    };
    for (const p of poses) frames[p.key] = inteiro(p);
    for (const p of todas.filter((x) => x.n >= 0).sort((a, b) => a.n - b.n)) (passos[p.key] ??= []).push(inteiro(p));
  } else {
    const s = def.height / altura;
    const grande = (p: PoseLida, parada: boolean): SpriteFrame => {
      const f = quadro(p.canvas, p.b, s, RES_POSE);
      f.pes = meiaLarguraPes(p.canvas, p.b) * s;
      const pp = pontosPes(p.canvas, p.b).map(([x, y]): [number, number] => [(x - p.b.x0) * s, (y - p.b.y0) * s]);
      // parada e com os dois pés à vista: a âncora vai para o meio deles (é ali que a peça pisa, no meio da
      // casa); o quadro de andar fica com a de baixo do corpo (cada um é recortado sozinho)
      if (parada && pp.length === 2) {
        f.ax = (pp[0][0] + pp[1][0]) / 2;
        f.ay = (pp[0][1] + pp[1][1]) / 2;
        f.noMeioDosPes = true;
      }
      f.pesPontos = pp.map(([x, y]): [number, number] => [x - f.ax, y - f.ay]);
      return f;
    };
    for (const p of poses) frames[p.key] = grande(p, true);
    for (const p of todas.filter((x) => x.n >= 0).sort((a, b) => a.n - b.n)) (passos[p.key] ??= []).push(grande(p, false));
  }
  return { frames, passos };
}

/** Uma direção do boneco animado, com os quadros já cortados das tiras. */
export interface BonecoDir {
  info: AnimDirecao;
  parado: SpriteFrame[];
  andar: SpriteFrame[];
  /** os mesmos quadros de olhos fechados (para piscar); null se a direção não mostra os olhos */
  paradoFechado: SpriteFrame[] | null;
  andarFechado: SpriteFrame[] | null;
}

/** O boneco animado do tabuleiro carregado: por "estado:direção". */
export interface LoadedAnim {
  anim: AnimTabuleiro;
  dirs: Record<string, BonecoDir>;
}

/** Corta a tira em quadros (uma linha de olhos abertos e, se houver, uma de fechados). */
async function cortarTira(tira: AnimTira, info: AnimDirecao): Promise<SpriteFrame[][]> {
  const img = await loadImage(tira.url);
  const linhas = Math.max(1, Math.round(img.naturalHeight / info.h));
  const out: SpriteFrame[][] = [];
  for (let r = 0; r < linhas; r++) {
    const qs: SpriteFrame[] = [];
    for (let i = 0; i < tira.quadros; i++) {
      const c = document.createElement('canvas');
      c.width = info.w;
      c.height = info.h;
      c.getContext('2d')!.drawImage(img, i * info.w, r * info.h, info.w, info.h, 0, 0, info.w, info.h);
      qs.push({ canvas: c, w: info.w, h: info.h, ax: info.ax, ay: info.ay, pixel: true });
    }
    out.push(qs);
  }
  return out;
}

async function processAnim(anim: AnimTabuleiro): Promise<LoadedAnim> {
  const dirs: Record<string, BonecoDir> = {};
  const pedidos: Promise<void>[] = [];
  for (const [estado, porDir] of Object.entries(anim.estados))
    for (const [dir, info] of Object.entries(porDir ?? {})) {
      if (!info) continue;
      pedidos.push(
        Promise.all([cortarTira(info.parado, info), cortarTira(info.andar, info)]).then(([p, a]) => {
          dirs[`${estado}:${dir}`] = {
            info,
            parado: p[0],
            andar: a[0],
            paradoFechado: info.olhos && p[1] ? p[1] : null,
            andarFechado: info.olhos && a[1] ? a[1] : null,
          };
        }),
      );
    }
  const r = await Promise.allSettled(pedidos);
  for (const x of r) if (x.status === 'rejected') console.warn('[sprites]', x.reason);
  if (!Object.keys(dirs).length) throw new Error('Nenhuma direção do boneco carregou');
  return { anim, dirs };
}

/**
 * A direção do boneco para o estado e a direção da peça: sem o estado, o mais
 * parecido (como no retrato); sem a direção, a vizinha (ver sheetDirFor).
 */
export function bonecoFor(la: LoadedAnim, estado: PortraitState, dir: number): BonecoDir | null {
  const armado = estado.startsWith('armado');
  const machucado = estado.endsWith('machucado');
  for (const e of [estado, portraitState(armado, false), portraitState(!armado, machucado), ...PORTRAIT_STATES]) {
    const k = sheetDirFor(dir, (d) => !!la.dirs[`${e}:${d}`]);
    if (k) return la.dirs[`${e}:${k}`];
  }
  return null;
}

/** Desenha um quadro do boneco com os pés (a âncora) em (x, y). sit = abaixa e esconde as pernas atrás do assento. */
export function drawBoneco(ctx: CanvasRenderingContext2D, q: SpriteFrame, x: number, y: number, sit = false, alpha = 1, luz?: LuzNaPeca | null) {
  paint(ctx, q, x, y, sit, alpha, luz);
}

/** Uma animação do boneco filmado em 3D, com os quadros já cortados da tira. */
export interface ClipeCarregado {
  clipe: BonecoClipe;
  quadros: SpriteFrame[];
}

/** O boneco filmado em 3D carregado: por "estado:direção", as animações. */
export interface BonecoCarregado {
  boneco: BonecoTabuleiro;
  dirs: Record<string, Record<string, ClipeCarregado>>;
}

async function cortarClipe(c: BonecoClipe, escala: number): Promise<SpriteFrame[]> {
  const img = await loadImage(c.url);
  const out: SpriteFrame[] = [];
  for (let i = 0; i < c.quadros; i++) {
    const cv = document.createElement('canvas');
    cv.width = c.w;
    cv.height = c.h;
    cv.getContext('2d')!.drawImage(img, i * c.w, 0, c.w, c.h, 0, 0, c.w, c.h);
    // a escala do boneco: quantos pixels do tabuleiro (no zoom 1) vale cada pixel da arte
    out.push({ canvas: cv, w: c.w * escala, h: c.h * escala, ax: c.ax * escala, ay: c.ay * escala, pixel: true });
  }
  return out;
}

async function processBoneco(b: BonecoTabuleiro): Promise<BonecoCarregado> {
  const dirs: Record<string, Record<string, ClipeCarregado>> = {};
  const pedidos: Promise<void>[] = [];
  for (const [estado, porDir] of Object.entries(b.estados))
    for (const [dir, clipes] of Object.entries(porDir ?? {}))
      for (const [nome, clipe] of Object.entries(clipes ?? {}))
        pedidos.push(
          cortarClipe(clipe, b.escala).then((quadros) => {
            (dirs[`${estado}:${dir}`] ??= {})[nome] = { clipe, quadros };
          }),
        );
  const r = await Promise.allSettled(pedidos);
  for (const x of r) if (x.status === 'rejected') console.warn('[sprites]', x.reason);
  if (!Object.keys(dirs).length) throw new Error('Nenhuma animação do boneco carregou');
  return { boneco: b, dirs };
}

/**
 * As animações do boneco para o estado e a direção da peça: sem o estado, o mais
 * parecido (como no retrato); sem a direção, a vizinha (ver sheetDirFor).
 */
export function bonecoDir(bc: BonecoCarregado, estado: PortraitState, dir: number): Record<string, ClipeCarregado> | null {
  const armado = estado.startsWith('armado');
  const machucado = estado.endsWith('machucado');
  for (const e of [estado, portraitState(armado, false), portraitState(!armado, machucado), ...PORTRAIT_STATES]) {
    const k = sheetDirFor(dir, (d) => !!bc.dirs[`${e}:${d}`]?.parado);
    if (k) return bc.dirs[`${e}:${k}`];
  }
  return null;
}

export function spriteKey(def: CharacterDef) {
  return [def.sheet, def.cols, def.rows, def.height, def.removeBg, def.dirs.join(''), (def.anims ?? []).join('')].join('|');
}

class SpriteStore {
  private defs = new Map<number, CharacterDef>();
  private cache = new Map<string, LoadedChar | 'loading' | 'error'>();
  onLoad: (() => void) | null = null;

  setDefs(list: CharacterDef[]) {
    this.defs = new Map(list.map((d) => [d.id, d]));
    // as poses e o boneco do tabuleiro começam a carregar antes de a cena pedir
    for (const d of list) {
      this.poses(d);
      this.anim(d);
      this.boneco(d);
    }
  }

  def(id: number | null | undefined) {
    return id ? this.defs.get(id) : undefined;
  }

  all() {
    return [...this.defs.values()];
  }

  get(id: number | null | undefined): { def: CharacterDef; lc: LoadedChar } | null {
    const def = this.def(id);
    if (!def) return null;
    const key = spriteKey(def);
    const c = this.cache.get(key);
    if (c && c !== 'loading' && c !== 'error') return { def, lc: c };
    if (!c) {
      this.cache.set(key, 'loading');
      processCharacter(def)
        .then((lc) => {
          this.cache.set(key, lc);
          this.onLoad?.();
        })
        .catch((e) => {
          console.warn('[sprites]', e);
          this.cache.set(key, 'error');
        });
    }
    return null;
  }

  private bonecoCache = new Map<string, BonecoCarregado | 'loading' | 'error'>();

  /** O boneco filmado em 3D do personagem; null enquanto carrega (ou se ele não tem). */
  boneco(def: CharacterDef): BonecoCarregado | null {
    if (!def.boneco) return null;
    const key = JSON.stringify(def.boneco);
    const c = this.bonecoCache.get(key);
    if (c && c !== 'loading' && c !== 'error') return c;
    if (!c) {
      this.bonecoCache.set(key, 'loading');
      processBoneco(def.boneco)
        .then((bc) => {
          this.bonecoCache.set(key, bc);
          this.onLoad?.();
        })
        .catch((e) => {
          console.warn('[sprites]', e);
          this.bonecoCache.set(key, 'error');
        });
    }
    return null;
  }

  private animCache = new Map<string, LoadedAnim | 'loading' | 'error'>();

  /** O boneco animado do personagem; null enquanto carrega (ou se ele não tem). */
  anim(def: CharacterDef): LoadedAnim | null {
    if (!def.anim) return null;
    const key = JSON.stringify(def.anim);
    const c = this.animCache.get(key);
    if (c && c !== 'loading' && c !== 'error') return c;
    if (!c) {
      this.animCache.set(key, 'loading');
      processAnim(def.anim)
        .then((la) => {
          this.animCache.set(key, la);
          this.onLoad?.();
        })
        .catch((e) => {
          console.warn('[sprites]', e);
          this.animCache.set(key, 'error');
        });
    }
    return null;
  }

  private poseCache = new Map<string, LoadedPoses | 'loading' | 'error'>();

  /** Poses do tabuleiro do personagem; null enquanto carregam (ou se ele não tem). */
  poses(def: CharacterDef): LoadedPoses | null {
    if (!def.poses) return null;
    const key = JSON.stringify([def.poses, def.passos ?? null, def.height]);
    const c = this.poseCache.get(key);
    if (c && c !== 'loading' && c !== 'error') return c;
    if (!c) {
      this.poseCache.set(key, 'loading');
      processPoses(def)
        .then((lp) => {
          this.poseCache.set(key, lp);
          this.onLoad?.();
        })
        .catch((e) => {
          console.warn('[sprites]', e);
          this.poseCache.set(key, 'error');
        });
    }
    return null;
  }

  /** Espera carregar (para prévias na interface). */
  async load(def: CharacterDef): Promise<LoadedChar | null> {
    const key = spriteKey(def);
    const c = this.cache.get(key);
    if (c && c !== 'loading' && c !== 'error') return c;
    try {
      const lc = await processCharacter(def);
      this.cache.set(key, lc);
      return lc;
    } catch {
      return null;
    }
  }
}

export const sprites = new SpriteStore();

/**
 * Quadros para a direção e animação. Folha de 8 direções: a linha da própria
 * direção; de 4: a diagonal mais próxima (ver sheetDirFor). null = a folha não
 * tem essa animação (quem chama cai para idle).
 */
export function framesFor(lc: LoadedChar, dir: number, anim: AnimKey = 'idle'): SpriteFrame[] | null {
  const key = sheetDirFor(dir, (k) => !!lc.frames[`${anim}:${k}`]?.length);
  return key ? lc.frames[`${anim}:${key}`] : null;
}

export type SpritePose = 'stand' | 'walk' | 'sit';

/** A luz do cenário que bate na peça: a cor (média das luzes por perto) e o quanto pesa (0..1). */
export interface LuzNaPeca {
  rgb: [number, number, number];
  forca: number;
}

/** O quadro da folha que vai à tela agora, quanto ele sobe e se é o sentado improvisado. */
export function quadroDaFolha(def: CharacterDef, lc: LoadedChar, dir: number, t: number, phase: number, pose: SpritePose): { q: SpriteFrame; dy: number; sit: boolean } | null {
  // linhas próprias de andar/sentar, se a folha tiver
  const own = pose === 'stand' ? null : framesFor(lc, dir, pose);
  const frames = own ?? framesFor(lc, dir);
  if (!frames) return null;
  let f: SpriteFrame;
  if (own) {
    // animação dedicada: toca os quadros em ordem (andar ~8 qps)
    const fps = pose === 'walk' ? 8 : def.fps;
    f = own[Math.floor((t / 1000 + phase) * fps) % own.length];
  } else {
    const seq = def.sequence.length ? def.sequence : [0];
    const fps = pose === 'walk' ? def.fps * 1.5 : def.fps;
    const idx = seq[Math.floor((t / 1000 + phase) * fps) % seq.length] % frames.length;
    f = frames[idx] ?? frames[0];
  }
  return { q: f, dy: pose === 'walk' && !own ? balanco(t) : 0, sit: pose === 'sit' && !own };
}

/** Desenha o personagem com os pés em (x, y). Retorna a altura desenhada. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  lc: LoadedChar,
  dir: number,
  x: number,
  y: number,
  t: number,
  phase: number,
  pose: SpritePose,
  alpha = 1,
  luz?: LuzNaPeca | null,
): number {
  const r = quadroDaFolha(def, lc, dir, t, phase, pose);
  if (!r) return 0;
  paint(ctx, r.q, x, y + r.dy, r.sit, alpha, luz);
  return r.q.h;
}

/**
 * Quadro da pose do tabuleiro para o estado e a direção da peça. Sem a imagem
 * do estado, a mais parecida (como no retrato); sem a direção, a vizinha (ver sheetDirFor).
 */
export function poseFor(lp: LoadedPoses, estado: PortraitState, dir: number): SpriteFrame | null {
  const armado = estado.startsWith('armado');
  const machucado = estado.endsWith('machucado');
  for (const e of [estado, portraitState(armado, false), portraitState(!armado, machucado), ...PORTRAIT_STATES]) {
    const k = sheetDirFor(dir, (d) => !!lp.frames[`${e}:${d}`]);
    if (k) return lp.frames[`${e}:${k}`];
  }
  return null;
}

/**
 * Quadros de andar para o estado e a direção, do mesmo jeito que a pose parada
 * (poseFor) escolhe: o estado mais parecido e a direção vizinha. null = sem
 * quadros de andar nessa direção (a pose parada desliza com o balanço).
 */
export function passosFor(lp: LoadedPoses, estado: PortraitState, dir: number): SpriteFrame[] | null {
  const armado = estado.startsWith('armado');
  const machucado = estado.endsWith('machucado');
  for (const e of [estado, portraitState(armado, false), portraitState(!armado, machucado), ...PORTRAIT_STATES]) {
    // a direção dos passos é a mesma da pose parada desse estado
    const k = sheetDirFor(dir, (d) => !!lp.frames[`${e}:${d}`]);
    if (!k) continue;
    const q = lp.passos[`${e}:${k}`];
    return q?.length ? q : null;
  }
  return null;
}

/**
 * Um ciclo de andar são dois passos, e são dois passos por casa (como no Habbo): cada quadro dura
 * 1 casa ÷ quadros. Com um passo só por casa, o pé que apoia escorregava no chão junto com o corpo.
 */
export const passoMs = (quadros: number) => TICK_MS / Math.max(1, quadros);

/**
 * Desenha a pose do tabuleiro com os pés em (x, y). Andando, toca os quadros
 * de andar (`passos`) desde `andando` ms; sem eles, balança como a folha sem
 * quadros de andar.
 */
export function drawPose(
  ctx: CanvasRenderingContext2D,
  f: SpriteFrame,
  x: number,
  y: number,
  t: number,
  pose: SpritePose,
  alpha = 1,
  passos?: SpriteFrame[] | null,
  andando = 0,
  luz?: LuzNaPeca | null,
): number {
  const { q, dy } = quadroDaPose(f, t, pose, passos, andando);
  paint(ctx, q, x, y + dy, pose === 'sit', alpha, luz);
  return q.h;
}

/** O quadro da pose que vai à tela agora (andando, o do passo) e quanto ele sobe. */
export function quadroDaPose(f: SpriteFrame, t: number, pose: SpritePose, passos?: SpriteFrame[] | null, andando = 0): { q: SpriteFrame; dy: number } {
  if (pose === 'walk' && passos?.length) return { q: passos[Math.floor(andando / passoMs(passos.length)) % passos.length], dy: 0 };
  return { q: f, dy: pose === 'walk' ? balanco(t) : 0 };
}

/** Sobe e desce do passo, sem quadros de andar: pequeno, para não parecer que flutua. */
const balanco = (t: number) => -Math.abs(Math.sin((t * Math.PI) / 250)) * 1.4;

const pesNoChao = new WeakMap<SpriteFrame, HTMLCanvasElement>();

/**
 * O quadro com os pés escurecendo perto do chão (o próprio corpo e o chão tapam
 * a luz ali): a peça assenta no piso em vez de parecer colada por cima. Na pixel
 * art, em degraus de linha inteira; na arte grande, em degradê.
 */
function comPesNoChao(f: SpriteFrame): HTMLCanvasElement {
  let c = pesNoChao.get(f);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = f.canvas.width;
  c.height = f.canvas.height;
  const g = c.getContext('2d')!;
  g.drawImage(f.canvas, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  // em pixels do canvas: a linha dos pés e a faixa que escurece (12% da altura do corpo)
  const k = f.canvas.height / f.h;
  const base = Math.round(f.ay * k);
  const faixa = f.ay * 0.12 * k;
  if (f.pixel) {
    const passo = Math.max(1, Math.round(faixa / 3));
    const tons = [0.09, 0.17, 0.26];
    tons.forEach((a, i) => {
      g.fillStyle = `rgba(0,0,0,${a})`;
      // o último degrau vai até embaixo: o pé que pisa à frente desce um pouco da linha
      const y0 = base - (3 - i) * passo;
      g.fillRect(0, y0, c!.width, i === tons.length - 1 ? c!.height - y0 : passo);
    });
  } else {
    const gr = g.createLinearGradient(0, base - faixa, 0, base);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.26)');
    g.fillStyle = gr;
    g.fillRect(0, base - faixa, c.width, c.height - (base - faixa));
  }
  pesNoChao.set(f, c);
  return c;
}

/** Telas de rascunho para tingir o quadro, uma por tamanho. */
const rascunhos = new Map<string, HTMLCanvasElement>();

/**
 * O quadro tingido pela luz que bate na peça (perto das velas, o branco fica
 * creme): a peça fica com a luz do cômodo, e não com a da arte. Sem luz por
 * perto (null), só os pés no chão; fora do tabuleiro (undefined: as prévias da
 * interface), o quadro como é.
 */
function comLuz(f: SpriteFrame, luz: LuzNaPeca | null | undefined): HTMLCanvasElement {
  if (luz === undefined) return f.canvas;
  const base = comPesNoChao(f);
  if (!luz || luz.forca < 0.02) return base;
  const chave = `${base.width}x${base.height}`;
  let c = rascunhos.get(chave);
  if (!c) {
    c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height;
    rascunhos.set(chave, c);
  }
  const g = c.getContext('2d')!;
  const k = 0.32 * Math.min(1, luz.forca);
  const [r, gg, b] = luz.rgb.map((v) => Math.round(255 + (v - 255) * k));
  g.globalCompositeOperation = 'copy';
  g.drawImage(base, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${r},${gg},${b})`;
  g.fillRect(0, 0, c.width, c.height);
  // o multiplicar pinta também o fundo transparente: volta o recorte do corpo
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(base, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return c;
}

const silhuetas = new WeakMap<SpriteFrame, HTMLCanvasElement>();

/** A silhueta preta do quadro, fechada nos pés e mais clara para a cabeça (a sombra some longe do corpo). */
function silhueta(f: SpriteFrame): HTMLCanvasElement {
  let c = silhuetas.get(f);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = f.canvas.width;
  c.height = f.canvas.height;
  const g = c.getContext('2d')!;
  g.drawImage(f.canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  const gr = g.createLinearGradient(0, f.ay * (f.canvas.height / f.h), 0, 0);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  silhuetas.set(f, c);
  return c;
}

/**
 * Sombra projetada no chão: a silhueta do quadro deitada a partir dos pés em
 * (x, y). `lado` é para onde vai a largura do corpo e `comprimento`, a altura
 * (vetores na tela, por pixel do quadro).
 */
export function drawSombraProjetada(ctx: CanvasRenderingContext2D, f: SpriteFrame, x: number, y: number, lado: [number, number], comprimento: [number, number], alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.transform(lado[0], lado[1], -comprimento[0], -comprimento[1], x, y);
  ctx.drawImage(silhueta(f), -f.ax, -f.ay, f.w, f.h);
  ctx.restore();
}

const ampliacoes = new Map<string, HTMLCanvasElement>();

/** O quadro ampliado `n` vezes sem suavizar (num rascunho por tamanho: vale até o próximo desenho). */
function ampliado(img: HTMLCanvasElement, n: number): HTMLCanvasElement {
  const w = img.width * n;
  const h = img.height * n;
  const chave = `${w}x${h}`;
  let c = ampliacoes.get(chave);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    ampliacoes.set(chave, c);
  }
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'copy';
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return c;
}

/** Pinta o quadro com os pés em (x, y). sit = sem quadro de sentado: abaixa o corpo e esconde as pernas atrás do assento. */
function paint(ctx: CanvasRenderingContext2D, f: SpriteFrame, x: number, y: number, sit: boolean, alpha: number, luz?: LuzNaPeca | null) {
  const img = comLuz(f, luz);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (f.pixel) {
    const m = ctx.getTransform();
    // pixel art: numa escala inteira (cada pixel da arte vira 1, 2, 3 pixels da tela), sem suavizar; diminuindo,
    // suaviza; aumentando numa escala quebrada (1,6×, 2,4×), amplia inteiro sem suavizar e só o resto é suave:
    // o pixel continua nítido e nenhum sai maior que o outro (a peça não "treme")
    const ef = Math.abs(m.a) * (f.w / f.canvas.width);
    const inteira = ef >= 0.999 && Math.abs(ef - Math.round(ef)) <= 0.02;
    ctx.imageSmoothingEnabled = !inteira;
    if (!sit && !m.b && !m.c) {
      // no pixel inteiro da tela: andando, a peça não treme nem borra
      const px = Math.round(m.a * (x - f.ax) + m.e);
      const py = Math.round(m.d * (y - f.ay) + m.f);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const fonte = !inteira && ef > 1 ? ampliado(img, Math.ceil(ef)) : img;
      ctx.drawImage(fonte, px, py, Math.round(f.w * m.a), Math.round(f.h * m.d));
      ctx.restore();
      return;
    }
  }
  if (sit) {
    // o quadril (uns 45% da altura) cai no assento; as pernas ficam escondidas, como quem está sentado
    const drop = f.h * 0.4;
    ctx.beginPath();
    ctx.rect(x - f.w * 2, y - f.h * 2, f.w * 4, f.h * 2 + 4);
    ctx.clip();
    ctx.drawImage(img, x - f.ax, y - f.ay + drop, f.w, f.h);
  } else ctx.drawImage(img, x - f.ax, y - f.ay, f.w, f.h);
  ctx.restore();
}

/**
 * Um quadro parado do boneco de um personagem, virado para `dir` (para desenhar pequeno fora do tabuleiro, como na van
 * da tela de viagem): o boneco filmado, o animado, a pose do tabuleiro ou a folha, o que existir. null enquanto carrega.
 */
export function quadroDoBoneco(charId: number | null, dir: number): SpriteFrame | null {
  const def = sprites.def(charId);
  if (!def) return null;
  const bc = sprites.boneco(def);
  const bd = bc ? bonecoDir(bc, 'desarmado', dir) : null;
  if (bd?.parado?.quadros[0]) return bd.parado.quadros[0];
  const la = sprites.anim(def);
  const ba = la ? bonecoFor(la, 'desarmado', dir) : null;
  if (ba?.parado[0]) return ba.parado[0];
  const lp = sprites.poses(def);
  const pf = lp ? poseFor(lp, 'desarmado', dir) : null;
  if (pf) return pf;
  const sp = charId ? sprites.get(charId) : null;
  return sp ? (framesFor(sp.lc, dir)?.[0] ?? null) : null;
}
