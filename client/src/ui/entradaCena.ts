/**
 * O fundo vivo da tela de entrada (entrada.ts): a mesma arte, mas cada visita é uma cena sorteada.
 *
 * - **A hora de verdade:** de dia o céu da janela fica azul, com sol e nuvens, e a sala clareia; no
 *   fim da tarde e de manhãzinha, dourado; de noite, a arte como foi desenhada (lua e estrelas).
 * - **O clima:** limpo, nuvens, chuva, neblina, neve ou tempestade.
 * - **O universo:** fantasia, horror ou cyberpunk. Muda a imagem (cada um tem a sua, pintada pelo
 *   Códex), a cor da chama, o clima mais provável e o que brilha no ar.
 * - **A vela:** acesa ou apagada (apagada à noite, a sala fica no luar e sobe um fio de fumaça).
 * - **O monstro:** às vezes, olhos no escuro, lá fora ou no canto da sala.
 * - **A imagem do universo:** cada universo pode ter a sua (a mesma sala, com outra mesa e outra
 *   vista na janela), pintada pelo Códex; sem ela, fica a de hoje (docs/TELA-ENTRADA.md).
 *
 * Tudo em pixels do palco (a arte de 1672×941 ou 941×1672). Para ver uma cena de propósito:
 * `?hora=14.5`, `?hora=ciclo` (o dia inteiro em um minuto), `?universo=horror`, `?clima=chuva`,
 * `?vela=apagada`, `?monstro=sim`.
 */

export type Universo = 'fantasia' | 'horror' | 'cyberpunk';
export type Clima = 'limpo' | 'nuvens' | 'chuva' | 'neblina' | 'tempestade' | 'neve';
export type LayoutNome = 'computador' | 'celular';

type Rgb = [number, number, number];
type Ret4 = [number, number, number, number];
/** um polígono: lista de pontos x, y */
export type Pol = [number, number][];

/** o caminho de uma lista de polígonos */
function caminho(pols: Pol[]): Path2D {
  const p = new Path2D();
  for (const pol of pols) {
    pol.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
  }
  return p;
}

/** o ponto está dentro de algum dos polígonos? */
function dentroDe(pols: Pol[], x: number, y: number): boolean {
  for (const pol of pols) {
    let dentro = false;
    for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      const [xi, yi] = pol[i];
      const [xj, yj] = pol[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    if (dentro) return true;
  }
  return false;
}

/** o ponto está a menos de `m` da caixa de algum polígono? */
function pertoDe(pols: Pol[], x: number, y: number, m: number): boolean {
  return pols.some((pol) => {
    const xs = pol.map((q) => q[0]);
    const ys = pol.map((q) => q[1]);
    return x > Math.min(...xs) - m && x < Math.max(...xs) + m && y > Math.min(...ys) - m && y < Math.max(...ys) + m;
  });
}

/** As medidas da arte que a cena usa (uma por tamanho). */
export interface CenaLayout {
  nome: LayoutNome;
  w: number;
  h: number;
  /** x0, y0, x1, y1: a janela (o céu fica aqui) */
  janela: Ret4;
  /** onde o horizonte fica (o sol nasce e se põe aqui) e de onde a onde o sol anda */
  sol: { x0: number; x1: number; horizonte: number; alto: number };
  /** a lua desenhada: x, y e raio do disco */
  lua: [number, number, number];
  /** a chama da vela: x, y (o pavio fica logo abaixo), meia largura e meia altura */
  chama: [number, number, number, number];
  /** retângulos que a lua evita (os botões da tela por cima da janela): x0, y0, x1, y1 */
  evitar: Ret4[];
  /** o contorno do painel (a moldura, o emblema por cima e o enfeite de baixo): não é céu, mesmo azul-escuro,
   * e a luz do tempo não passa por cima dele (o mesmo contorno do `entrada-fundos.mjs`) */
  painel: Pol[];
  /** cantos escuros da sala, onde olhos podem aparecer */
  cantos: [number, number][];
  /** onde os raios de sol caem (x do topo e x do pé, para a esquerda) */
  raios: { y0: number; y1: number; xs: number[]; desvio: number; largura: number };
  /** onde a paisagem fica atrás de uma janela em magenta: x, y e largura (a altura segue a imagem) */
  paisagem: { x: number; y: number; w: number };
  /** a névoa no chão da sala: faixa y e de x0 a x1 */
  nevoa: [number, number, number, number];
  /** tamanho do pixel da arte */
  px: number;
}

/** a cidade lá fora recortada no tamanho da janela, em três luzes, com as marcas de cor acesas */
interface Paisagem {
  noite: HTMLCanvasElement;
  dourado: HTMLCanvasElement;
  dia: HTMLCanvasElement;
  /** os letreiros de neon (pintados em ciano puro), acesos, e o brilho deles */
  neon: HTMLCanvasElement | null;
  neonBrilho: HTMLCanvasElement | null;
  /** a lâmpada do farol (pintada em amarelo puro), em pixels da janela */
  farol: [number, number] | null;
}

export interface DefUniverso {
  nome: string;
  /** a chama recolorida (escuro, meio, claro); null = a chama da arte */
  chama: [Rgb, Rgb, Rgb] | null;
  /** a cor da luz da vela (os brilhos em CSS) */
  luz: Rgb;
  climas: Partial<Record<Clima, number>>;
  /** chance do monstro aparecer */
  monstro: number;
  /** aurora no céu da noite */
  aurora?: Rgb;
  /** névoa dentro da sala (cor) */
  nevoaSala?: Rgb;
  /** a poeira que brilha de outra cor (magia) */
  magia?: Rgb;
  /** cor dos olhos do monstro */
  olhos: Rgb;
  /** a luz da mesa é uma lâmpada (neon), não uma vela: sempre acesa, sem estalo */
  luzFixa?: boolean;
  /** o brilho colorido da cidade no horizonte, de noite */
  neon?: Rgb;
}

export const UNIVERSOS: Record<Universo, DefUniverso> = {
  fantasia: {
    nome: 'Fantasia',
    chama: null,
    luz: [255, 170, 80],
    climas: { limpo: 4, nuvens: 3, chuva: 1, neblina: 1, neve: 1 },
    monstro: 0.2,
    magia: [140, 210, 255],
    olhos: [255, 200, 60],
  },
  horror: {
    nome: 'Horror cósmico',
    chama: [
      [10, 50, 28],
      [70, 200, 110],
      [215, 255, 180],
    ],
    luz: [110, 255, 160],
    climas: { neblina: 4, chuva: 2, nuvens: 1, tempestade: 1, neve: 1 },
    monstro: 0.5,
    aurora: [80, 255, 150],
    nevoaSala: [120, 190, 150],
    olhos: [150, 255, 120],
  },
  cyberpunk: {
    nome: 'Cyberpunk',
    // a luz é um abajur neon pintado na imagem: não acende nem apaga, e não tem chama para recolorir
    chama: null,
    luz: [255, 70, 200],
    climas: { chuva: 4, neblina: 2, limpo: 1, nuvens: 1 },
    monstro: 0.45,
    luzFixa: true,
    // o brilho da cidade de neon no horizonte, de noite
    neon: [255, 60, 190],
    // a poeira vira faísca digital
    magia: [90, 235, 255],
    olhos: [255, 40, 60],
  },
};

/** O que esta visita sorteou. */
export interface Sorteio {
  universo: Universo;
  clima: Clima;
  vela: boolean;
  monstro: boolean;
}

const ULTIMO = 'crona.entrada.universo';

/** De onde vêm os pedidos de cena (`?hora=`, `?universo=`...): o endereço, ou uma prévia que troque. */
export const pedidos = { ler: (chave: string): string | null => new URLSearchParams(location.search).get(chave) };

function sortearPeso<T extends string>(pesos: Partial<Record<T, number>>): T {
  const itens = Object.entries(pesos) as [T, number][];
  let r = Math.random() * itens.reduce((s, [, p]) => s + p, 0);
  for (const [k, p] of itens) if ((r -= p) <= 0) return k;
  return itens[0][0];
}

/** Sorteia a cena desta visita (o universo não repete o da última vez). */
export function sortearCena(hora: number): Sorteio {
  const q = { get: pedidos.ler };
  let ultimo: string | null = null;
  try {
    ultimo = localStorage.getItem(ULTIMO);
  } catch {
    /* sem storage */
  }
  const pedido = q.get('universo') as Universo | null;
  const opcoes = (Object.keys(UNIVERSOS) as Universo[]).filter((u) => u !== ultimo);
  const universo = pedido && pedido in UNIVERSOS ? pedido : opcoes[Math.floor(Math.random() * opcoes.length)];
  try {
    localStorage.setItem(ULTIMO, universo);
  } catch {
    /* sem storage */
  }
  const def = UNIVERSOS[universo];
  const climaPedido = q.get('clima') as Clima | null;
  const clima = climaPedido && ['limpo', 'nuvens', 'chuva', 'neblina', 'tempestade', 'neve'].includes(climaPedido) ? climaPedido : sortearPeso(def.climas);
  const { noite } = pesosDaHora(hora);
  const velaPedida = q.get('vela');
  // de noite a vela quase sempre está acesa; de dia, quase sempre apagada
  const vela = def.luzFixa ? true : velaPedida ? velaPedida !== 'apagada' : Math.random() < 0.3 + 0.55 * noite;
  const monstroPedido = q.get('monstro');
  const monstro = monstroPedido ? monstroPedido === 'sim' : Math.random() < def.monstro;
  return { universo, clima, vela, monstro };
}

// ---------------------------------------------------------------- a hora

/** A hora do relógio (0..24), ou a pedida no endereço (`?hora=14.5`; `?hora=ciclo` corre o dia). */
export function lerHora(inicio: number): number {
  const q = pedidos.ler('hora');
  if (q === 'ciclo') return (((performance.now() - inicio) / 60000) * 24 + 5) % 24;
  const n = q === null ? NaN : Number(q.replace(',', '.'));
  if (Number.isFinite(n)) return ((n % 24) + 24) % 24;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Quanto é noite, dourado (amanhecer e entardecer) e dia, somando 1. */
const CHAVES: [number, number, number, number][] = [
  // hora, noite, dourado, dia
  [0, 1, 0, 0],
  [4.8, 1, 0, 0],
  [5.9, 0.35, 0.65, 0],
  [6.8, 0, 0.55, 0.45],
  [7.8, 0, 0, 1],
  [16.3, 0, 0, 1],
  [17.3, 0, 0.55, 0.45],
  [18.3, 0.3, 0.7, 0],
  [19.4, 1, 0, 0],
  [24, 1, 0, 0],
];
export function pesosDaHora(hora: number) {
  for (let i = 1; i < CHAVES.length; i++) {
    const a = CHAVES[i - 1];
    const b = CHAVES[i];
    if (hora <= b[0]) {
      const t = (hora - a[0]) / (b[0] - a[0] || 1);
      const s = t * t * (3 - 2 * t);
      return { noite: a[1] + (b[1] - a[1]) * s, dourado: a[2] + (b[2] - a[2]) * s, dia: a[3] + (b[3] - a[3]) * s };
    }
  }
  return { noite: 1, dourado: 0, dia: 0 };
}

// ---------------------------------------------------------------- cores

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c: Rgb, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/** O céu (topo, meio, horizonte) de cada parte do dia. */
const CEU = {
  noite: [
    [8, 12, 34],
    [16, 24, 60],
    [30, 42, 88],
  ] as Rgb[],
  dourado: [
    [44, 46, 110],
    [196, 96, 120],
    [255, 186, 110],
  ] as Rgb[],
  dia: [
    [52, 112, 200],
    [104, 168, 228],
    [178, 220, 244],
  ] as Rgb[],
};
/** O céu fechado (chuva, tempestade) puxa para o cinza. */
const CINZA = { noite: [18, 20, 28] as Rgb, dia: [96, 104, 116] as Rgb };
/** o céu de tempestade de dia: cinza-chumbo (puxa mais que a chuva comum) */
const CHUMBO: Rgb = [58, 64, 78];

/** Ordem do Bayer 4×4: o degradê do céu vira faixas pontilhadas, como em pixel art. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

interface Nuvem {
  x: number;
  y: number;
  v: number;
  bolhas: [number, number, number][];
}
interface Gota {
  x: number;
  y: number;
  v: number;
}
interface Voador {
  x: number;
  y: number;
  v: number;
  fase: number;
  tipo: 'passaro' | 'morcego';
}

// ---------------------------------------------------------------- a cena

export class Cena {
  /** o céu: atrás da arte, só na janela */
  readonly ceu: HTMLCanvasElement;
  /** a arte reiluminada, com o céu recortado */
  readonly arte: HTMLCanvasElement;
  /** por cima da arte: raios de sol, névoa da sala, olhos, relâmpago */
  readonly luz: HTMLCanvasElement;
  sorteio: Sorteio;
  /** a imagem é a do universo (a chama já vem pintada na cor dele) */
  fundoProprio = false;
  private L: CenaLayout | null = null;
  private baixo: HTMLCanvasElement; // o céu em baixa resolução (um pixel da arte)
  private sobre: HTMLCanvasElement; // nuvens, chuva, raio: por cima da lua da arte
  private noiteCeu: HTMLCanvasElement | null = null; // o céu da arte (lua e estrelas)
  /** os vidros da janela vieram em magenta (a imagem do tema): o céu é todo do código */
  private ceuChroma = false;
  /** a paisagem lá fora, na noite, no dourado e no dia (só com a janela em magenta) */
  private paisagens: Paisagem | null = null;
  /** a mesma cidade com neve nos telhados: aparece aos poucos quando o clima vira neve */
  private paisagensNeve: Paisagem | null = null;
  private neveMix = 0;
  /** onde a lua fica (um pedaço de céu livre da janela, longe do skyline e do painel) e onde há céu livre */
  private luaPos: [number, number] | null = null;
  private ceuLivre: { dados: Uint8Array; w: number; h: number } | null = null;
  /** cantos escuros da sala achados na própria imagem (onde os olhos aparecem) */
  private cantosAchados: [number, number][] = [];
  /** as estrelas do céu do código (pixel, x e y no céu baixo, fase do piscar) */
  private estrelas: [number, number, number][] = [];
  private imagens: { noite: HTMLCanvasElement; luar: HTMLCanvasElement; dourado: HTMLCanvasElement; dia: HTMLCanvasElement } | null = null;
  /** o contorno macio do painel (só a transparência importa) e o painel como foi desenhado, recortado por ele */
  private painelAlfa: HTMLCanvasElement | null = null;
  private painelNoite: HTMLCanvasElement | null = null;
  private painelPol: Pol[] | null = null;
  private ultimoPeso = '';
  /** a imagem de fundo num canvas (para refazer a luz quando a vela muda) */
  private fonteCanvas: HTMLCanvasElement | null = null;
  private inicio = performance.now();
  private nuvens: Nuvem[] = [];
  private gotas: Gota[] = [];
  private voadores: Voador[] = [];
  private cadente: { x: number; y: number; vx: number; vy: number; vida: number } | null = null;
  private proximaCadente = 4000;
  private relampago = 0; // brilho do relâmpago (1 → 0)
  private raio: [number, number][] | null = null;
  private proximoRelampago = 3000;
  private olhos: { x: number; y: number; escala: number; piscar: number; abertos: number; dentro: boolean }[] = [];
  private proximaPiscada = 0;
  /** o pedaço da arte que a tela mostra (x0, y0, x1, y1), posto pela entrada a cada ajuste */
  visivel: Ret4 | null = null;
  /** O ponto aparece nesta tela (com folga)? */
  private naTela(x: number, y: number, folga = 0) {
    const v = this.visivel;
    return !v || (x >= v[0] + folga && x <= v[2] - folga && y >= v[1] + folga && y <= v[3] - folga);
  }
  /** a hora usada no último quadro */
  hora = 12;
  pesos = { noite: 1, dourado: 0, dia: 0 };
  /** para o CSS: quando a hora ou o relâmpago mudam */
  aoMudar: (c: Cena) => void = () => {};
  /** cai um raio (o som do trovão) */
  aoRelampago: () => void = () => {};

  constructor() {
    this.ceu = document.createElement('canvas');
    this.ceu.className = 'ent-ceu';
    this.arte = document.createElement('canvas');
    this.arte.className = 'ent-arte';
    this.luz = document.createElement('canvas');
    this.luz.className = 'ent-luz';
    this.baixo = document.createElement('canvas');
    this.sobre = document.createElement('canvas');
    this.hora = lerHora(this.inicio);
    this.pesos = pesosDaHora(this.hora);
    this.sorteio = sortearCena(this.hora);
  }

  get pronta() {
    return !!this.imagens;
  }

  /** Prepara a cena para a arte deste tamanho (a imagem já carregada). */
  async montar(L: CenaLayout, img: HTMLImageElement, paisagem: HTMLImageElement | null = null, neve: HTMLImageElement | null = null) {
    this.L = L;
    this.imagens = null;
    const [x0, y0, x1, y1] = L.janela;
    this.ceu.width = x1 - x0;
    this.ceu.height = y1 - y0;
    Object.assign(this.ceu.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    this.baixo.width = Math.ceil((x1 - x0) / L.px);
    this.baixo.height = Math.ceil((y1 - y0) / L.px);
    this.sobre.width = this.baixo.width;
    this.sobre.height = this.baixo.height;
    this.arte.width = this.luz.width = L.w;
    this.arte.height = this.luz.height = L.h;
    this.fonteCanvas = this.fonte(L, img);
    this.preparar(L, this.fonteCanvas);
    this.luaPos = null;
    this.ceuLivre = null;
    this.paisagens = this.ceuChroma && paisagem ? this.prepararPaisagem(L, paisagem, true) : null;
    this.paisagensNeve = this.paisagens && neve ? this.prepararPaisagem(L, neve, false) : null;
    this.neveMix = this.sorteio.clima === 'neve' && this.paisagensNeve ? 1 : 0;
    if (this.ceuChroma) this.luaPos = this.acharLua(L);
    this.estrelas = [];
    this.criarClima(L);
    this.ultimoPeso = '';
  }

  /**
   * Muda a cena sem montar de novo: o clima (nuvens, chuva, neve, raio), a vela (acesa ou apagada,
   * o que refaz a luz da arte) e o monstro (os olhos no escuro). A hora é o relógio.
   */
  mudar(op: { clima?: Clima; vela?: boolean; monstro?: boolean }) {
    const s = this.sorteio;
    const fixa = !!UNIVERSOS[s.universo].luzFixa;
    const velaMudou = op.vela !== undefined && op.vela !== s.vela && !fixa;
    if (op.clima) {
      s.clima = op.clima;
      // a tempestade que começa ao vivo já abre com um raio, em poucos segundos
      this.proximoRelampago = Math.min(this.proximoRelampago, 1800);
    }
    if (op.monstro !== undefined) s.monstro = op.monstro;
    if (velaMudou) s.vela = op.vela!;
    const L = this.L;
    if (!L || !this.imagens) return;
    if (velaMudou && this.fonteCanvas) {
      this.preparar(L, this.fonteCanvas);
      this.ultimoPeso = '';
    }
    this.criarClima(L);
  }

  /** A arte num canvas, para ler os pixels. */
  private fonte(L: CenaLayout, img: HTMLImageElement): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = L.w;
    c.height = L.h;
    c.getContext('2d')!.drawImage(img, 0, 0, L.w, L.h);
    return c;
  }

  /**
   * As quatro versões da arte, feitas uma vez: a noite (como foi desenhada, com a chama do
   * universo), o luar (a vela apagada de noite), o dourado e o dia. Em todas, o céu sai recortado.
   */
  private preparar(L: CenaLayout, fonte: HTMLCanvasElement) {
    const W = L.w;
    const H = L.h;
    const ctx = fonte.getContext('2d', { willReadFrequently: true })!;
    const base = ctx.getImageData(0, 0, W, H);
    const d = base.data;
    const [jx0, jy0, jx1, jy1] = L.janela;
    const noPainel = (x: number, y: number) => dentroDe(L.painel, x, y);
    const [lx, ly, lr] = L.lua;

    // ---- o céu: azul-escuro dentro da janela (e a lua), fora do painel
    const ceu = new Uint8Array(W * H);
    const luzes = new Uint8Array(W * H);
    let magenta = 0;
    for (let y = jy0; y < jy1; y++)
      for (let x = jx0; x < jx1; x++) {
        const i = y * W + x;
        const r = d[i * 4];
        const g = d[i * 4 + 1];
        const b = d[i * 4 + 2];
        // os vidros em magenta (a imagem do tema): céu do código, até perto do painel (magenta nunca
        // é o painel)
        if (r > 150 && g < 120 && b > 150 && r - g > 80 && b - g > 80) {
          ceu[i] = 1;
          magenta++;
          continue;
        }
        if (noPainel(x, y)) continue;
        const naLua = (x - lx) ** 2 + (y - ly) ** 2 < (lr * 1.25) ** 2;
        if (naLua || (b > 34 && b - r > 16 && b - g > 6)) ceu[i] = 1;
        else if (r > 105 && r - b > 40 && g > 45) luzes[i] = 1;
      }
    this.ceuChroma = magenta > 1500;
    // a borda do magenta (misturada com a moldura) também sai, para não ficar um contorno rosa
    if (this.ceuChroma)
      for (let passo = 0; passo < 2; passo++) {
        const add: number[] = [];
        for (let y = jy0 + 1; y < jy1 - 1; y++)
          for (let x = jx0 + 1; x < jx1 - 1; x++) {
            const i = y * W + x;
            if (ceu[i] || !(ceu[i - 1] || ceu[i + 1] || ceu[i - W] || ceu[i + W])) continue;
            const o = i * 4;
            if (d[o] - d[o + 1] > 35 && d[o + 2] - d[o + 1] > 35) add.push(i);
          }
        for (const i of add) ceu[i] = 1;
      }
    // as estrelas e os pontinhos no meio do céu também são céu (vizinhança quase toda de céu)
    for (let passo = 0; passo < 2; passo++) {
      const add: number[] = [];
      for (let y = jy0 + 2; y < jy1 - 2; y++)
        for (let x = jx0 + 2; x < jx1 - 2; x++) {
          const i = y * W + x;
          if (ceu[i]) continue;
          let n = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) n += ceu[i + dy * W + dx];
          if (n >= 15) add.push(i);
        }
      for (const i of add) ceu[i] = 1, (luzes[i] = 0);
    }

    // ---- a chama: os pixels claros e quentes em volta do pavio. Nas imagens de cada universo a
    // vela pode ter mudado um pouco de lugar: o miolo da chama (o mais claro) diz onde ela está.
    let [cx, cy] = L.chama;
    const [, , cw, ch] = L.chama;
    {
      let sx = 0;
      let sy = 0;
      let n = 0;
      // só acima do pavio (a cera acesa, logo abaixo, também é clara)
      for (let y = Math.max(0, cy - 60); y < Math.min(H, cy + ch * 0.6); y++)
        for (let x = Math.max(0, cx - 50); x < Math.min(W, cx + 50); x++) {
          const o = (y * W + x) * 4;
          if (d[o] > 235 && d[o + 1] > 200 && d[o] - d[o + 2] > 30) (sx += x), (sy += y), n++;
        }
      if (n > 12) (cx = Math.round(sx / n)), (cy = Math.round(sy / n));
    }
    const chama = new Uint8Array(W * H);
    for (let y = Math.max(0, cy - ch); y < Math.min(H, cy + ch); y++)
      for (let x = Math.max(0, cx - cw); x < Math.min(W, cx + cw); x++) {
        const i = y * W + x;
        const r = d[i * 4];
        const g = d[i * 4 + 1];
        const b = d[i * 4 + 2];
        // elipse em volta da chama, para não pegar a cera acesa embaixo
        if (((x - cx) / cw) ** 2 + ((y - cy) / ch) ** 2 > 1) continue;
        if (r > 170 && g > 100 && r - b > 45) chama[i] = 1;
      }

    // a vela apagada: a chama vira o fundo dos lados e o halo escurece
    if (!this.sorteio.vela) {
      for (let y = cy - ch; y < cy + ch; y++) {
        let x = cx - cw;
        while (x < cx + cw) {
          if (!chama[y * W + x]) {
            x++;
            continue;
          }
          let x2 = x;
          while (x2 < cx + cw && chama[y * W + x2]) x2++;
          const a = (y * W + x - 3) * 4;
          const b = (y * W + x2 + 2) * 4;
          for (let k = x; k < x2; k++) {
            const t = (k - x + 1) / (x2 - x + 1);
            const o = (y * W + k) * 4;
            for (let c = 0; c < 3; c++) d[o + c] = d[a + c] + (d[b + c] - d[a + c]) * t;
          }
          x = x2;
        }
      }
      const hw = cw * 3;
      const hh = ch * 1.7;
      for (let y = Math.max(0, cy - hh) | 0; y < cy + ch * 0.85; y++)
        for (let x = Math.max(0, cx - hw) | 0; x < Math.min(W, cx + hw); x++) {
          const dist = Math.hypot((x - cx) / hw, (y - cy) / hh);
          if (dist >= 1) continue;
          const o = (y * W + x) * 4;
          const quente = clamp((d[o] - d[o + 2]) / 110);
          const k = 1 - 0.8 * Math.pow(1 - dist, 0.6) * quente;
          // sem a chama, o halo vira a madeira escura de trás
          const l = (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) * k;
          d[o] = (d[o] * k + l * 0.5) / 1.5 + 6;
          d[o + 1] = (d[o + 1] * k + l * 0.5) / 1.5 + 3;
          d[o + 2] = (d[o + 2] * k + l * 0.5) / 1.5;
        }
      chama.fill(0);
    }

    const def = UNIVERSOS[this.sorteio.universo];
    // a chama do universo: o brilho da chama vira o degradê da cor nova
    if (def.chama && !this.fundoProprio)
      for (let i = 0; i < W * H; i++) {
        if (!chama[i]) continue;
        const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
        const [c0, c1, c2] = def.chama;
        const c = l < 0.6 ? mix(c0, c1, l / 0.6) : mix(c1, c2, (l - 0.6) / 0.4);
        d[i * 4] = c[0];
        d[i * 4 + 1] = c[1];
        d[i * 4 + 2] = c[2];
      }

    const noite = new ImageData(new Uint8ClampedArray(d), W, H);
    const luar = new ImageData(new Uint8ClampedArray(d), W, H);
    const dourado = new ImageData(new Uint8ClampedArray(d), W, H);
    const dia = new ImageData(new Uint8ClampedArray(d), W, H);
    const nd = noite.data;
    const ld = luar.data;
    const gd = dourado.data;
    const dd = dia.data;

    // as curvas de clarear, em tabela (1,5 milhão de pixels)
    const curva = (g: number) => Float32Array.from({ length: 256 }, (_, v) => 255 * Math.pow(v / 255, g));
    const g58 = curva(0.5);
    const g60 = curva(0.5);
    const g78 = curva(0.78);
    const g80 = curva(0.8);
    // a luz da vela na arte: quanto mais perto da chama e mais quente o pixel, mais ela pesa
    const [vx, vy] = [cx, cy + ch];
    const alcance = Math.hypot(W, H) * 0.55;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const o = i * 4;
        const r = d[o];
        const g = d[o + 1];
        const b = d[o + 2];
        const l = r * 0.3 + g * 0.59 + b * 0.11;
        const quente = clamp((r - b) / 140);
        const perto = clamp(1 - Math.hypot(x - vx, (y - vy) * 1.2) / alcance);
        const vela = quente * (0.35 + 0.65 * perto);
        if (ceu[i]) {
          ld[o + 3] = gd[o + 3] = dd[o + 3] = nd[o + 3] = 0;
          continue;
        }
        // luar: a luz da vela some, fica o azul frio e escuro
        {
          const k = 1 - vela * 0.62;
          const m = l * k;
          ld[o] = m * 0.62 + r * 0.12 * k;
          ld[o + 1] = m * 0.74 + g * 0.1 * k;
          ld[o + 2] = m * 1.05 + 10 * (1 - perto);
        }
        // dia: as sombras abrem, a luz fica neutra (o laranja da vela perde força)
        {
          // a arte inteira é quente (a vela pintada): de dia o laranja perde força em tudo,
          // mais perto da vela
          const sat = 1 - 0.38 * vela - 0.3 * quente;
          let rr = l + (r - l) * sat;
          let gg = l + (g - l) * sat;
          let bb = l + (b - l) * sat;
          // luz do dia: mais clara e levemente fria (o laranja da vela pintado sai de vez)
          rr = g58[rr | 0] * 0.93;
          gg = g58[gg | 0] * 0.98;
          bb = g60[bb | 0] * 1.1;
          dd[o] = rr;
          dd[o + 1] = gg;
          dd[o + 2] = bb;
          if (luzes[i]) {
            // as janelas do castelo apagam de dia: viram vidro escuro
            const v = 40 + l * 0.18;
            dd[o] = v;
            dd[o + 1] = v * 1.02;
            dd[o + 2] = v * 1.12;
          }
        }
        // dourado: um pouco mais claro e alaranjado-rosado
        {
          gd[o] = g78[r] * 1.06;
          gd[o + 1] = g80[g] * 0.96;
          gd[o + 2] = g80[b] * 0.9;
        }
      }
    // o painel desenhado na arte não muda com a hora (o painel de verdade fica em cima dele): em volta
    // dele, a mistura com a noite segue o contorno, com a borda macia
    this.criarMascaraPainel(L);
    this.cantosAchados = this.acharCantos(L, d);
    const pa = this.painelAlfa!.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) {
      const t = pa[i * 4 + 3] / 255;
      if (t <= 0) continue;
      const o = i * 4;
      for (const arr of [ld, gd, dd]) for (let k = 0; k < 3; k++) arr[o + k] += (nd[o + k] - arr[o + k]) * t;
    }
    // o céu da arte (lua e estrelas) fica à parte, para ficar atrás das nuvens
    const ceuArte = document.createElement('canvas');
    ceuArte.width = jx1 - jx0;
    ceuArte.height = jy1 - jy0;
    const cd = ctx.getImageData(jx0, jy0, jx1 - jx0, jy1 - jy0);
    for (let y = 0; y < cd.height; y++)
      for (let x = 0; x < cd.width; x++) if (!ceu[(y + jy0) * W + x + jx0]) cd.data[(y * cd.width + x) * 4 + 3] = 0;
    ceuArte.getContext('2d')!.putImageData(cd, 0, 0);
    this.noiteCeu = this.ceuChroma ? null : ceuArte;

    const tela = (dados: ImageData) => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      c.getContext('2d')!.putImageData(dados, 0, 0);
      return c;
    };
    this.imagens = { noite: tela(noite), luar: tela(luar), dourado: tela(dourado), dia: tela(dia) };
    // o painel como foi desenhado (a noite recortada pelo contorno macio)
    const pn = document.createElement('canvas');
    pn.width = W;
    pn.height = H;
    const px = pn.getContext('2d')!;
    px.drawImage(this.imagens.noite, 0, 0);
    px.globalCompositeOperation = 'destination-in';
    px.drawImage(this.painelAlfa!, 0, 0);
    this.painelNoite = pn;
  }

  /**
   * O contorno do painel como máscara: opaca dentro e com a borda macia (2 px). A luz do tempo, o véu e o
   * clarão do relâmpago saem por ela, em vez de um retângulo em volta do painel.
   */
  private criarMascaraPainel(L: CenaLayout) {
    if (this.painelAlfa && this.painelPol === L.painel) return;
    this.painelPol = L.painel;
    const c = document.createElement('canvas');
    c.width = L.w;
    c.height = L.h;
    const x = c.getContext('2d')!;
    const p = caminho(L.painel);
    x.fillStyle = '#000';
    x.fill(p);
    x.strokeStyle = '#000';
    x.lineJoin = 'round';
    // só 2 px de borda macia (a sombra em volta do painel já está na imagem e acompanha a luz da hora)
    x.globalAlpha = 0.3;
    for (const k of [2, 1]) {
      x.lineWidth = k * 2;
      x.stroke(p);
    }
    this.painelAlfa = c;
  }

  /**
   * A paisagem atrás da janela em magenta (pintada com luz neutra, céu em magenta e as janelas das
   * casas em verde): recortada no tamanho da janela, em três luzes. De noite as janelas acendem;
   * de dia viram vidro escuro.
   */
  private prepararPaisagem(L: CenaLayout, img: HTMLImageElement, principal: boolean): Paisagem {
    const [jx0, jy0, jx1, jy1] = L.janela;
    const jw = jx1 - jx0;
    const jh = jy1 - jy0;
    const { y, w } = L.paisagem;
    let x = L.paisagem.x;
    // a tela estreita corta as laterais: a cidade se desloca até o castelo (a parte da direita) ficar à vista
    const vis = this.visivel;
    if (vis && vis[2] < x + w) x = Math.max(vis[2] - w, jx0 - w * 0.35);
    const hgt = Math.round((w * img.height) / img.width);
    // as pontas da cidade que ficam dentro do vidro esmaecem no céu (não termina num corte reto)
    const ex0 = x - jx0;
    const ex1 = x + w - jx0;
    const suave = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c * c * (3 - 2 * c);
    };
    // o letreiro de neon é do cyberpunk e o farol, do horror (a cidade das outras não tem marcas de cor
    // a acender: qualquer pixel azul-claro ali é neve, água ou vidro)
    const universo = this.sorteio.universo;
    const temNeon = !!UNIVERSOS[universo].neon;
    const temFarol = universo === 'horror';
    const livre = principal ? new Uint8Array(jw * jh) : null;
    const c = document.createElement('canvas');
    c.width = jw;
    c.height = jh;
    const cx = c.getContext('2d', { willReadFrequently: true })!;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, x - jx0, y - jy0, w, hgt);
    const base = cx.getImageData(0, 0, jw, jh);
    const d = base.data;
    const versoes = { noite: new ImageData(jw, jh), dourado: new ImageData(jw, jh), dia: new ImageData(jw, jh) };
    const neon = new ImageData(jw, jh);
    let neonPx = 0;
    let fx = 0;
    let fy = 0;
    let fn = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      let a = d[i + 3];
      const px = (i / 4) % jw;
      // o céu em magenta sai (a borda misturada sai pela metade)
      const mg = Math.min(r - g, b - g);
      if (mg > 80 && r > 140 && b > 140) a = 0;
      else if (mg > 40) a = Math.round(a * (1 - (mg - 40) / 40));
      if (livre) livre[i / 4] = a > 24 ? 1 : 0;
      a = Math.round(a * Math.min(suave((px - ex0) / 70), suave((ex1 - px) / 70)));
      const janela = g > 150 && g - r > 60 && g - b > 60;
      const por = (v: ImageData, cor: Rgb) => ((v.data[i] = cor[0]), (v.data[i + 1] = cor[1]), (v.data[i + 2] = cor[2]), (v.data[i + 3] = a));
      // o letreiro de neon (ciano puro): de dia, placa apagada; de noite, aceso em rosa ou ciano
      // (a cor muda em faixas, para a cidade não ficar de uma cor só)
      if (temNeon && g > 150 && b > 150 && r < 110 && g - r > 70 && b - r > 70) {
        const rosa = Math.floor(px / 37) % 3 !== 0;
        por(versoes.noite, [40, 34, 52]);
        por(versoes.dourado, [70, 66, 80]);
        por(versoes.dia, [96, 100, 112]);
        const cor: Rgb = rosa ? [255, 70, 200] : [80, 240, 255];
        neon.data[i] = cor[0];
        neon.data[i + 1] = cor[1];
        neon.data[i + 2] = cor[2];
        neon.data[i + 3] = a;
        neonPx++;
        continue;
      }
      // a lâmpada do farol (amarelo puro): acesa de noite, apagada de dia; o facho gira em volta
      if (temFarol && r > 235 && g > 230 && b < 60) {
        fx += (i / 4) % jw;
        fy += Math.floor(i / 4 / jw);
        fn++;
        por(versoes.noite, [255, 240, 170]);
        por(versoes.dourado, [255, 220, 140]);
        por(versoes.dia, [210, 200, 160]);
        continue;
      }
      if (janela) {
        por(versoes.noite, [255, 196, 110]);
        por(versoes.dourado, [235, 160, 90]);
        por(versoes.dia, [42, 48, 60]);
        continue;
      }
      por(versoes.noite, [r * 0.34, g * 0.4, b * 0.66]);
      por(versoes.dourado, [r * 1.02, g * 0.8, b * 0.68]);
      por(versoes.dia, [r, g, b]);
    }
    const tela = (v: ImageData) => {
      const t = document.createElement('canvas');
      t.width = jw;
      t.height = jh;
      t.getContext('2d')!.putImageData(v, 0, 0);
      return t;
    };
    let neonTela: HTMLCanvasElement | null = null;
    let neonBrilho: HTMLCanvasElement | null = null;
    // só vale como letreiro e como farol uma mancha de verdade (não uns pixels soltos)
    if (neonPx > 30) {
      neonTela = tela(neon);
      // o brilho do neon: o mesmo desenho, borrado (feito uma vez só)
      neonBrilho = document.createElement('canvas');
      neonBrilho.width = jw;
      neonBrilho.height = jh;
      const nb = neonBrilho.getContext('2d')!;
      nb.filter = 'blur(6px)';
      nb.drawImage(neonTela, 0, 0);
      nb.drawImage(neonTela, 0, 0);
    }
    if (livre) this.ceuLivre = { dados: livre, w: jw, h: jh };
    return {
      noite: tela(versoes.noite),
      dourado: tela(versoes.dourado),
      dia: tela(versoes.dia),
      neon: neonTela,
      neonBrilho,
      farol: fn > 40 ? ([fx / fn, fy / fn] as [number, number]) : null,
    };
  }

  /** O céu está livre (sem cidade) num raio `r` em volta do ponto (em pixels da arte)? */
  private ceuLivreEm(x: number, y: number, r: number): boolean {
    const c = this.ceuLivre;
    if (!c) return true;
    const [jx0, jy0] = this.L!.janela;
    for (let k = 0; k < 9; k++) {
      const px = Math.round(x - jx0 + (k === 0 ? 0 : Math.cos((k / 8) * Math.PI * 2) * r));
      const py = Math.round(y - jy0 + (k === 0 ? 0 : Math.sin((k / 8) * Math.PI * 2) * r));
      if (px < 0 || py < 0 || px >= c.w || py >= c.h) return false;
      if (!c.dados[py * c.w + px]) continue;
      return false;
    }
    return true;
  }

  /**
   * Onde a lua fica: um pedaço de céu livre da janela (longe da cidade, do painel e dos botões da
   * tela), do lado direito e no alto, dentro do que esta tela mostra.
   */
  private acharLua(L: CenaLayout): [number, number] | null {
    const [jx0, jy0, jx1] = L.janela;
    let melhor: [number, number] | null = null;
    let nota = -1;
    for (let y = jy0 + 24; y < L.sol.horizonte - 30; y += 6)
      for (let x = jx0 + 30; x < jx1 - 30; x += 6) {
        if (!this.naTela(x, y, 30) || pertoDe(L.painel, x, y, 26) || L.evitar.some(([a, b, c, e]) => x > a - 30 && x < c + 30 && y > b - 30 && y < e + 30)) continue;
        if (!this.ceuLivreEm(x, y, 34) || !this.ceuLivreEm(x, y, 16)) continue;
        const n = (x - jx0) / (jx1 - jx0) + (1 - y / L.sol.horizonte) * 0.6;
        if (n > nota) (nota = n), (melhor = [x, y]);
      }
    return melhor;
  }

  /**
   * Os cantos escuros da sala, achados na própria imagem: blocos bem escuros e lisos, fora do painel,
   * da janela e do que a tela corta, bem espalhados (é onde os olhos aparecem).
   */
  private acharCantos(L: CenaLayout, d: Uint8ClampedArray): [number, number][] {
    const W = L.w;
    const H = L.h;
    const [jx0, jy0, jx1, jy1] = L.janela;
    const bloco = 22;
    const achados: { x: number; y: number; nota: number }[] = [];
    for (let y = 40; y < H - 60; y += bloco)
      for (let x = 20; x < W - 40; x += bloco) {
        const cx = x + bloco / 2;
        const cy = y + bloco / 2;
        if (!this.naTela(cx, cy, 20) || pertoDe(L.painel, cx, cy, 50)) continue;
        if (cx > jx0 - 20 && cx < jx1 + 20 && cy < jy1 + 30) continue;
        let soma = 0;
        let soma2 = 0;
        let n = 0;
        let maximo = 0;
        for (let yy = y; yy < y + bloco; yy += 2)
          for (let xx = x; xx < x + bloco; xx += 2) {
            const o = (yy * W + xx) * 4;
            const l = d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11;
            soma += l;
            soma2 += l * l;
            maximo = Math.max(maximo, l);
            n++;
          }
        const media = soma / n;
        const desvio = Math.sqrt(Math.max(0, soma2 / n - media * media));
        if (media < 34 && maximo < 80 && desvio < 12) achados.push({ x: cx, y: cy, nota: media + desvio });
      }
    achados.sort((a, b) => a.nota - b.nota);
    const fora: [number, number][] = [];
    for (const c of achados) {
      if (fora.every(([x, y]) => Math.hypot(x - c.x, y - c.y) > 170)) fora.push([c.x, c.y]);
      if (fora.length >= 6) break;
    }
    return fora;
  }

  // ---------------------------------------------------------------- clima

  private criarClima(L: CenaLayout) {
    const bw = this.baixo.width;
    const bh = this.baixo.height;
    const { clima } = this.sorteio;
    const quantas = { limpo: 2, nuvens: 6, chuva: 9, neblina: 4, tempestade: 11, neve: 7 }[clima];
    const hz = Math.max(8, (L.sol.horizonte - L.janela[1]) / L.px);
    this.nuvens = Array.from({ length: quantas }, () => this.novaNuvem(bw, hz, Math.random() * bw * 1.4 - bw * 0.2));
    this.gotas =
      clima === 'chuva' || clima === 'tempestade' || clima === 'neve'
        ? Array.from({ length: Math.round(bw * bh * (clima === 'neve' ? 0.009 : clima === 'tempestade' ? 0.045 : 0.03)) }, () => ({ x: Math.random() * bw, y: Math.random() * bh, v: 0.9 + Math.random() * 0.6 }))
        : [];
    this.voadores = [];
    // as estrelas ficam no lugar quando só o clima muda
    if (!this.estrelas.length) this.estrelas = Array.from({ length: Math.round(bw * bh * 0.006) }, () => [Math.floor(Math.random() * bw), Math.floor(Math.random() * hz * 0.85), Math.random() * 6]);
    // os olhos: lá fora, na janela (de noite), e no canto escuro da sala
    this.olhos = [];
    if (this.sorteio.monstro) {
      // só onde aparece: fora do painel e dentro do pedaço da arte que esta tela mostra
      // (o celular estreito corta as laterais)
      const livre = (x: number, y: number) => this.naTela(x, y, 24) && !pertoDe(L.painel, x, y, 20);
      const [jx0, jy0, jx1] = L.janela;
      for (let k = 0; k < 80; k++) {
        const x = jx0 + 20 + Math.random() * (jx1 - jx0 - 50);
        const y = jy0 + 18 + Math.random() * (L.sol.horizonte - jy0 - 40);
        if (!livre(x, y) || !this.ceuLivreEm(x, y, 14)) continue;
        this.olhos.push({ x, y, escala: 1.4, piscar: 0, abertos: 0, dentro: false });
        break;
      }
      const cantos = (this.cantosAchados.length ? this.cantosAchados : L.cantos).filter(([x, y]) => livre(x, y));
      const canto = cantos[Math.floor(Math.random() * cantos.length)];
      if (canto) this.olhos.push({ x: canto[0], y: canto[1], escala: 1, piscar: 0, abertos: 0, dentro: true });
    }
  }

  private novaNuvem(bw: number, bh: number, x: number): Nuvem {
    const larg = 10 + Math.random() * 18;
    const bolhas: [number, number, number][] = [];
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) bolhas.push([(i / (n - 1) - 0.5) * larg, -Math.random() * 3, 2.5 + Math.random() * 3.5]);
    return { x, y: bh * (0.12 + Math.random() * 0.5), v: (0.006 + Math.random() * 0.01) * (Math.random() < 0.5 ? 1 : 0.7), bolhas };
  }

  // ---------------------------------------------------------------- o quadro

  /** Desenha um quadro. `dt` em ms. */
  passo(agora: number, dt: number) {
    const L = this.L;
    const im = this.imagens;
    if (!L || !im) return;
    this.hora = lerHora(this.inicio);
    const p = pesosDaHora(this.hora);
    this.pesos = p;
    const chave = `${p.noite.toFixed(3)}|${p.dourado.toFixed(3)}`;
    if (chave !== this.ultimoPeso) {
      this.ultimoPeso = chave;
      this.desenharArte();
      this.aoMudar(this);
    }
    this.desenharCeu(L, agora, dt);
    this.desenharLuz(L, agora, dt);
  }

  /** A arte reiluminada: a noite (ou o luar), o dourado e o dia misturados pelo peso da hora. */
  private desenharArte() {
    const im = this.imagens!;
    const ctx = this.arte.getContext('2d')!;
    const { noite, dourado, dia } = this.pesos;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(this.sorteio.vela ? im.noite : im.luar, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (dourado > 0.001) {
      ctx.globalAlpha = dourado / (noite + dourado || 1);
      ctx.drawImage(im.dourado, 0, 0);
    }
    if (dia > 0.001) {
      ctx.globalAlpha = dia;
      ctx.drawImage(im.dia, 0, 0);
    }
    // o tempo fechado apaga a luz do dia: um véu frio e escuro sobre a sala (só de dia)
    const { clima } = this.sorteio;
    const fecho = { limpo: 0, nuvens: 0.06, chuva: 0.22, neblina: 0.14, tempestade: 0.36, neve: 0.12 }[clima] * (dia + dourado * 0.6);
    if (fecho > 0.005) {
      // (source-atop: só onde a arte é opaca; os vidros da janela são buracos e não podem ser pintados)
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(22, 32, 54, ${Math.min(1, fecho * 1.15)})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // o painel desenhado na arte não muda com a hora nem com o tempo: volta como foi desenhado, com a
    // borda macia (sem retângulo em volta)
    if (this.painelNoite) ctx.drawImage(this.painelNoite, 0, 0);
  }

  /** O céu da janela: degradê, sol, a lua da arte, nuvens, chuva, raio, estrela cadente... */
  private desenharCeu(L: CenaLayout, agora: number, dt: number) {
    const b = this.baixo;
    const bw = b.width;
    const bh = b.height;
    const ctx = b.getContext('2d')!;
    const { noite, dourado, dia } = this.pesos;
    const { clima, universo } = this.sorteio;
    const def = UNIVERSOS[universo];
    const fechado = { limpo: 0, nuvens: 0.25, chuva: 0.7, neblina: 0.45, tempestade: 0.9, neve: 0.55 }[clima];
    const cinza = mix(CINZA.noite, CINZA.dia, dia + dourado * 0.5);
    const corDe = (k: number) => {
      let c = mix(mix(CEU.noite[k], CEU.dourado[k], dourado / (noite + dourado || 1)), CEU.dia[k], dia);
      c = mix(c, cinza, fechado * 0.85);
      if (clima === 'tempestade') c = mix(c, CHUMBO, 0.55 * (dia + dourado * 0.7));
      // a cidade de neon acende o horizonte de noite
      if (def.neon && k > 0) c = mix(c, def.neon, (k === 2 ? 0.38 : 0.14) * noite);
      return c;
    };
    const topo = corDe(0);
    const meio = corDe(1);
    const baixoCor = corDe(2);
    // o degradê em faixas pontilhadas, do topo da janela até o horizonte da cidade (abaixo dele a
    // cidade cobre o céu)
    const [jx0, jy0] = L.janela;
    const hz = Math.max(8, (L.sol.horizonte - jy0) / L.px);
    const img = ctx.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) {
      const t = Math.min(1, y / hz);
      const faixas = 7;
      for (let x = 0; x < bw; x++) {
        const tq = Math.min(1, Math.floor(t * faixas + BAYER[(y & 3) * 4 + (x & 3)]) / faixas);
        const c = tq < 0.55 ? mix(topo, meio, tq / 0.55) : mix(meio, baixoCor, (tq - 0.55) / 0.45);
        const o = (y * bw + x) * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const bx = (x: number) => (x - jx0) / L.px;
    const by = (y: number) => (y - jy0) / L.px;

    // o sol: das 6h às 18h30, do horizonte ao alto e de volta
    const ts = (this.hora - 6) / 12.5;
    if (ts > -0.05 && ts < 1.05 && noite < 0.98) {
      // o caminho do sol fica no pedaço da janela que esta tela mostra
      const v = this.visivel;
      const s0 = v ? Math.max(L.sol.x0, v[0] + 30) : L.sol.x0;
      const s1 = v ? Math.max(s0, Math.min(L.sol.x1, v[2] - 30)) : L.sol.x1;
      const sx = bx(s0 + (s1 - s0) * ts);
      const sy = by(L.sol.horizonte - Math.sin(Math.PI * clamp(ts)) * (L.sol.horizonte - L.sol.alto));
      const cor = mix([255, 170, 90], [255, 246, 214], dia);
      const forca = (1 - noite) * (1 - fechado * 0.8);
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
      halo.addColorStop(0, rgb(cor, 0.55 * forca));
      halo.addColorStop(1, rgb(cor, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(sx - 22, sy - 22, 44, 44);
      ctx.fillStyle = rgb(cor, forca);
      disco(ctx, sx, sy, 4.5);
    }
    // o céu da arte (lua e estrelas), de noite e com o tempo aberto
    const ceuArte = this.noiteCeu;
    const c2 = this.ceu.getContext('2d')!;
    c2.imageSmoothingEnabled = false;
    // com a janela em magenta, a lua e as estrelas são do código
    if (this.ceuChroma && noite > 0.02) {
      const aberto = noite * (1 - fechado * 0.85);
      for (const [x, y, f] of this.estrelas) {
        const a = aberto * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(agora / 700 + f * 3)));
        ctx.fillStyle = `rgba(255, 244, 205, ${a})`;
        ctx.fillRect(x, y, 1, 1);
      }
      const [lx, ly] = this.luaPos ?? L.lua;
      const mx = bx(lx);
      const my = by(ly);
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 16);
      halo.addColorStop(0, `rgba(255, 226, 150, ${0.35 * aberto})`);
      halo.addColorStop(1, 'rgba(255, 226, 150, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(mx - 16, my - 16, 32, 32);
      ctx.fillStyle = `rgba(255, 232, 160, ${aberto})`;
      disco(ctx, mx, my, 4.5);
      ctx.fillStyle = `rgba(226, 196, 120, ${aberto})`;
      ctx.fillRect(Math.round(mx - 1), Math.round(my - 2), 2, 1);
      ctx.fillRect(Math.round(mx + 1), Math.round(my + 1), 1, 1);
    }

    // nuvens, névoa, aurora, chuva, raio: na camada de cima (desenhadas por cima da lua)
    const sobre = this.sobre;
    const s = sobre.getContext('2d')!;
    s.clearRect(0, 0, bw, bh);
    // com a paisagem lá fora, aurora, estrela cadente e nuvens ficam atrás dela (no céu)
    const atras = this.paisagens ? ctx : s;
    // aurora (horror, de noite)
    if (def.aurora && noite > 0.2) {
      for (let x = 0; x < bw; x++) {
        const onda = Math.sin(x * 0.09 + agora / 2400) * 0.5 + Math.sin(x * 0.031 - agora / 3700) * 0.5;
        const alto = hz * (0.25 + 0.18 * onda);
        const a = (0.1 + 0.12 * (0.5 + 0.5 * Math.sin(x * 0.2 + agora / 900))) * noite;
        const g = atras.createLinearGradient(0, alto, 0, alto + hz * 0.45);
        g.addColorStop(0, rgb(def.aurora, 0));
        g.addColorStop(0.3, rgb(def.aurora, a));
        g.addColorStop(1, rgb(def.aurora, 0));
        atras.fillStyle = g;
        atras.fillRect(x, alto, 1, hz * 0.45);
      }
    }
    // a estrela cadente (noite, céu aberto)
    this.proximaCadente -= dt;
    if (!this.cadente && this.proximaCadente <= 0 && noite > 0.7 && fechado < 0.5) {
      this.cadente = { x: bw * (0.2 + Math.random() * 0.7), y: hz * Math.random() * 0.3, vx: -(0.09 + Math.random() * 0.05), vy: 0.04, vida: 1 };
      this.proximaCadente = 6000 + Math.random() * 14000;
    }
    if (this.cadente) {
      const c = this.cadente;
      c.x += c.vx * dt * 0.6;
      c.y += c.vy * dt * 0.6;
      c.vida -= dt / 900;
      for (let k = 0; k < 8; k++) {
        atras.fillStyle = `rgba(255, 246, 210, ${clamp(c.vida) * (1 - k / 8)})`;
        atras.fillRect(Math.round(c.x - c.vx * k * 18), Math.round(c.y - c.vy * k * 18), 1, 1);
      }
      if (c.vida <= 0 || c.x < 0) this.cadente = null;
    }
    // nuvens
    let corNuvem = mix(mix([34, 38, 62], [236, 150, 140], dourado / (noite + dourado || 1)), [246, 248, 252], dia);
    if (clima === 'tempestade') corNuvem = mix(corNuvem, [52, 58, 74], 0.7);
    else if (clima === 'chuva') corNuvem = mix(corNuvem, [128, 136, 150], 0.5);
    const sombraNuvem = mix(corNuvem, mix([14, 16, 30], [120, 130, 156], dia + dourado * 0.5), 0.6 + fechado * 0.2);
    for (const n of this.nuvens) {
      n.x += n.v * dt * (clima === 'tempestade' ? 2.2 : 1);
      if (n.x - 20 > bw) Object.assign(n, this.novaNuvem(bw, bh, -30));
      const alfa = clima === 'neblina' ? 0.55 : 0.92;
      atras.fillStyle = rgb(sombraNuvem, alfa);
      for (const [dx, dy, r] of n.bolhas) disco(atras, n.x + dx, n.y + dy + 1.5, r);
      atras.fillStyle = rgb(corNuvem, alfa);
      for (const [dx, dy, r] of n.bolhas) disco(atras, n.x + dx, n.y + dy, r - 0.8);
    }
    // a neblina no horizonte
    if (clima === 'neblina' || def.nevoaSala) {
      const cor = mix(mix([60, 66, 90], [200, 205, 215], dia), def.nevoaSala ?? [180, 180, 190], 0.3);
      for (let k = 0; k < 3; k++) {
        const y = hz * (0.8 + k * 0.18);
        const desl = Math.sin(agora / (5000 + k * 1700) + k) * 8;
        const g = s.createLinearGradient(0, y - 6, 0, y + 6);
        g.addColorStop(0, rgb(cor, 0));
        g.addColorStop(0.5, rgb(cor, (clima === 'neblina' ? 0.42 : 0.18) * (1 - k * 0.2)));
        g.addColorStop(1, rgb(cor, 0));
        s.fillStyle = g;
        s.fillRect(desl - 10, y - 6, bw + 20, 12);
      }
    }
    // os olhos lá fora (só de noite ou no entardecer)
    const fora = this.olhos.find((o) => !o.dentro);
    if (fora && noite + dourado * 0.5 > 0.5) this.desenharOlhos(s, bx(fora.x), by(fora.y), fora, def.olhos, 1, true);
    // pássaros de dia, morcegos de noite
    // pássaros de dia (bem mais no sol), morcegos de noite
    const sol = dia > 0.5 && (clima === 'limpo' || clima === 'nuvens');
    if (this.voadores.length < (sol ? 9 : 3) && Math.random() < dt / (sol ? 3500 : 9000) && clima !== 'tempestade') {
      const n = 2 + Math.floor(Math.random() * 3);
      const tipo = noite > 0.5 ? 'morcego' : 'passaro';
      const y = hz * (0.15 + Math.random() * 0.5);
      for (let i = 0; i < n; i++) this.voadores.push({ x: -4 - i * (3 + Math.random() * 3), y: y + (Math.random() - 0.5) * 6, v: 0.012 + Math.random() * 0.004, fase: Math.random() * 6, tipo });
    }
    s.fillStyle = noite > 0.5 ? 'rgba(6, 6, 12, 0.95)' : 'rgba(30, 30, 40, 0.85)';
    this.voadores = this.voadores.filter((v) => {
      v.x += v.v * dt;
      v.fase += dt / (v.tipo === 'morcego' ? 90 : 160);
      const cima = Math.sin(v.fase) > 0;
      const x = Math.round(v.x);
      const y = Math.round(v.y + Math.sin(v.fase * 0.3) * 1.5);
      s.fillRect(x, y, 1, 1);
      if (v.tipo === 'passaro') {
        // um "v" que bate as asas: para cima e para baixo
        s.fillRect(x - 1, y + (cima ? -1 : 0), 1, 1);
        s.fillRect(x + 1, y + (cima ? -1 : 0), 1, 1);
        s.fillRect(x - 2, y + (cima ? -2 : 1), 1, 1);
        s.fillRect(x + 2, y + (cima ? -2 : 1), 1, 1);
      } else {
        const asa = cima ? -1 : 0;
        s.fillRect(x - 1, y + asa, 1, 1);
        s.fillRect(x + 1, y + asa, 1, 1);
        s.fillRect(x - 2, y + asa + 1, 1, 1);
        s.fillRect(x + 2, y + asa + 1, 1, 1);
      }
      return v.x < bw + 6;
    });
    // neve: flocos de um pixel, devagar e balançando
    if (clima === 'neve') {
      s.fillStyle = dia > 0.4 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(215, 225, 245, 0.8)';
      for (const g of this.gotas) {
        g.y += g.v * dt * 0.006;
        g.x += Math.sin((agora / 900) * g.v + g.y * 0.3) * dt * 0.004;
        if (g.y > bh) (g.y = -1), (g.x = Math.random() * bw);
        s.fillRect(Math.round(g.x), Math.round(g.y), 1, 1);
      }
    }
    // chuva
    else if (this.gotas.length) {
      // de noite, a chuva do cyberpunk reflete o neon
      s.fillStyle = def.neon && noite > 0.5 ? 'rgba(255, 150, 235, 0.45)' : dia > 0.5 ? 'rgba(220, 230, 245, 0.45)' : 'rgba(150, 170, 210, 0.4)';
      const forte = clima === 'tempestade';
      for (const g of this.gotas) {
        g.y += g.v * dt * (forte ? 0.11 : 0.085);
        g.x -= g.v * dt * (forte ? 0.045 : 0.024);
        if (g.y > bh) (g.y = -3), (g.x = Math.random() * bw * 1.3);
        const x = Math.round(g.x);
        const y = Math.round(g.y);
        s.fillRect(x, y, 1, 3);
        s.fillRect(x + 1, y + 3, 1, 1);
      }
    }
    // o relâmpago
    if (clima === 'tempestade') {
      this.proximoRelampago -= dt;
      if (this.proximoRelampago <= 0) {
        this.relampago = 1;
        this.proximoRelampago = 4000 + Math.random() * 9000;
        let x = bw * (0.15 + Math.random() * 0.7);
        const pts: [number, number][] = [[x, 0]];
        for (let y = 0; y < hz * 0.95; ) {
          y += 2 + Math.random() * 3;
          x += (Math.random() - 0.5) * 5;
          pts.push([x, y]);
        }
        // um galho saindo do meio
        const meio = pts[Math.floor(pts.length * (0.3 + Math.random() * 0.3))];
        if (meio) {
          let [gx, gy] = meio;
          const lado = Math.random() < 0.5 ? -1 : 1;
          this.raio = pts;
          const galho: [number, number][] = [];
          for (let k = 0; k < 5; k++) galho.push([(gx += lado * (1 + Math.random() * 3)), (gy += 2 + Math.random() * 2)]);
          this.raio = [...pts, ...galho.length ? [[NaN, NaN] as [number, number], meio, ...galho] : []];
        } else this.raio = pts;
        this.aoRelampago();
        this.aoMudar(this);
      }
    }
    if (this.relampago > 0) {
      const a = this.relampago;
      s.fillStyle = rgb([220, 230, 255], 0.35 * a);
      s.fillRect(0, 0, bw, bh);
      if (this.raio && a > 0.35) {
        s.strokeStyle = rgb([250, 250, 255], a);
        s.lineWidth = 1.4;
        s.beginPath();
        let novo = true;
        for (const [x, y] of this.raio) {
          if (Number.isNaN(x)) {
            novo = true;
            continue;
          }
          if (novo) s.moveTo(x, y), (novo = false);
          else s.lineTo(x, y);
        }
        s.stroke();
      }
      this.relampago = Math.max(0, a - dt / 520);
      if (!this.relampago) this.aoMudar(this);
    }

    // junta: o degradê e o sol, a lua da arte, e a camada de cima
    c2.clearRect(0, 0, this.ceu.width, this.ceu.height);
    c2.drawImage(b, 0, 0, bw * L.px, bh * L.px);
    if (ceuArte) {
      c2.globalAlpha = clamp(noite * (1 - fechado) + noite * 0.12);
      c2.drawImage(ceuArte, 0, 0);
      c2.globalAlpha = 1;
    }
    // a paisagem lá fora, na luz da hora (a noite, o dourado e o dia misturados); com neve, a cidade dos
    // telhados brancos aparece aos poucos por cima
    const p = this.paisagens;
    if (p) {
      c2.imageSmoothingEnabled = true;
      const alvoNeve = clima === 'neve' && this.paisagensNeve ? 1 : 0;
      const passoNeve = dt / 3000;
      this.neveMix += Math.max(-passoNeve, Math.min(passoNeve, alvoNeve - this.neveMix));
      const cidade = (q: Paisagem, alfa: number) => {
        c2.globalAlpha = alfa;
        c2.drawImage(q.noite, 0, 0);
        if (dourado > 0.001) {
          c2.globalAlpha = alfa * (dourado / (noite + dourado || 1));
          c2.drawImage(q.dourado, 0, 0);
        }
        if (dia > 0.001) {
          c2.globalAlpha = alfa * dia;
          c2.drawImage(q.dia, 0, 0);
        }
      };
      cidade(p, 1);
      if (this.paisagensNeve && this.neveMix > 0.002) cidade(this.paisagensNeve, this.neveMix);
      c2.globalAlpha = 1;
      // os letreiros de neon acesos, piscando de vez em quando (mais fortes com a noite)
      const acesos = noite + dourado * 0.4;
      if (p.neon && acesos > 0.05) {
        const pisca = (Math.sin(agora / 97) > 0.92 || Math.sin(agora / 1310 + 1) > 0.985 ? 0.35 : 1) * (1 - this.neveMix * 0.4);
        c2.globalCompositeOperation = 'lighter';
        c2.globalAlpha = 0.55 * acesos * pisca;
        c2.drawImage(p.neonBrilho!, 0, 0);
        c2.globalCompositeOperation = 'source-over';
        c2.globalAlpha = acesos * pisca;
        c2.drawImage(p.neon, 0, 0);
        c2.globalAlpha = 1;
      }
      // o facho do farol girando (de noite)
      if (p.farol && acesos > 0.1) {
        const [fx, fy] = p.farol;
        const ang = (agora / 2600) % (Math.PI * 2);
        // o facho é mais visível quando aponta de lado (para a câmera ele "passa")
        const lado = Math.abs(Math.cos(ang));
        const alcance = 260;
        const abre = 0.09;
        c2.globalCompositeOperation = 'lighter';
        for (const sentido of [0, Math.PI]) {
          const a0 = ang + sentido;
          const g = c2.createRadialGradient(fx, fy, 0, fx, fy, alcance);
          g.addColorStop(0, `rgba(255, 236, 170, ${0.4 * acesos * lado})`);
          g.addColorStop(1, 'rgba(255, 236, 170, 0)');
          c2.fillStyle = g;
          c2.beginPath();
          c2.moveTo(fx, fy);
          c2.lineTo(fx + Math.cos(a0 - abre) * alcance, fy + Math.sin(a0 - abre) * alcance * 0.35);
          c2.lineTo(fx + Math.cos(a0 + abre) * alcance, fy + Math.sin(a0 + abre) * alcance * 0.35);
          c2.closePath();
          c2.fill();
        }
        const brilho = c2.createRadialGradient(fx, fy, 0, fx, fy, 18);
        brilho.addColorStop(0, `rgba(255, 240, 190, ${0.7 * acesos})`);
        brilho.addColorStop(1, 'rgba(255, 240, 190, 0)');
        c2.fillStyle = brilho;
        c2.fillRect(fx - 18, fy - 18, 36, 36);
        c2.globalCompositeOperation = 'source-over';
      }
      c2.imageSmoothingEnabled = false;
    }
    c2.drawImage(sobre, 0, 0, bw * L.px, bh * L.px);
  }

  /** Por cima da arte: os raios de sol, a névoa da sala, os olhos no canto e o clarão. */
  private desenharLuz(L: CenaLayout, agora: number, dt: number) {
    const ctx = this.luz.getContext('2d')!;
    ctx.clearRect(0, 0, L.w, L.h);
    const { noite, dourado, dia } = this.pesos;
    const { clima, universo } = this.sorteio;
    const def = UNIVERSOS[universo];
    const fechado = { limpo: 0, nuvens: 0.3, chuva: 0.75, neblina: 0.55, tempestade: 0.9, neve: 0.6 }[clima];
    // os raios de sol entrando pela janela
    const forca = (dia + dourado * 0.8) * (1 - fechado);
    if (forca > 0.02) {
      ctx.globalCompositeOperation = 'screen';
      const cor = mix([255, 170, 100], [255, 240, 205], dia);
      const R = L.raios;
      R.xs.forEach((x, k) => {
        const tremor = 0.75 + 0.25 * Math.sin(agora / (2600 + k * 700) + k * 2);
        const g = ctx.createLinearGradient(0, R.y0, 0, R.y1);
        g.addColorStop(0, rgb(cor, 0.22 * forca * tremor));
        g.addColorStop(1, rgb(cor, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, R.y0);
        ctx.lineTo(x + R.largura * (0.6 + (k % 2) * 0.5), R.y0);
        ctx.lineTo(x + R.largura * 2.2 - R.desvio, R.y1);
        ctx.lineTo(x - R.desvio, R.y1);
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    // a névoa que corre pelo chão da sala
    if (def.nevoaSala || clima === 'neblina') {
      const cor = def.nevoaSala ?? [190, 190, 205];
      const [x0, y0, x1, y1] = L.nevoa;
      const forcaN = (clima === 'neblina' ? 0.16 : 0.09) * (0.5 + 0.5 * noite);
      for (let k = 0; k < 7; k++) {
        const t = agora / (16000 + k * 3100) + k * 1.7;
        const x = x0 + ((Math.sin(t) * 0.5 + 0.5) * (x1 - x0));
        const y = y0 + (y1 - y0) * ((k % 3) / 3 + 0.15);
        const r = (x1 - x0) * (0.16 + (k % 3) * 0.05);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgb(cor, forcaN));
        g.addColorStop(1, rgb(cor, 0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.35);
        ctx.translate(-x, -y);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
      }
    }
    // os olhos no canto escuro (mais fortes com a sala escura)
    const dentro = this.olhos.find((o) => o.dentro);
    const escuro = noite * (this.sorteio.vela ? 0.75 : 1) + dourado * 0.3;
    if (dentro && escuro > 0.3) this.desenharOlhos(ctx, dentro.x, dentro.y, dentro, def.olhos, L.px, false, escuro);
    // o piscar dos olhos
    this.proximaPiscada -= dt;
    if (this.proximaPiscada <= 0) {
      this.proximaPiscada = 2500 + Math.random() * 4000;
      const o = this.olhos[Math.floor(Math.random() * this.olhos.length)];
      if (o) o.piscar = 1;
    }
    for (const o of this.olhos) {
      o.abertos = Math.min(1, o.abertos + dt / 2500);
      if (o.piscar > 0) o.piscar = Math.max(0, o.piscar - dt / 260);
    }
    // o clarão do relâmpago na sala
    if (this.relampago > 0) {
      // o raio pisca duas vezes (um pico, um vão, um segundo pico menor) e some devagar
      const r = this.relampago;
      const tremor = r > 0.82 ? 1 : r > 0.7 ? 0.25 : r > 0.55 ? 0.8 : r;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rgb([205, 220, 255], 0.5 * tremor);
      ctx.fillRect(0, 0, L.w, L.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // nada disso pinta o painel (o painel de verdade fica por cima e não muda): a luz sai em volta dele,
    // pelo contorno e com a borda macia
    if (this.painelAlfa) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(this.painelAlfa, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Dois olhos que brilham e piscam. `px` = tamanho de um pixel. */
  private desenharOlhos(ctx: CanvasRenderingContext2D, x: number, y: number, o: { escala: number; piscar: number; abertos: number }, cor: Rgb, px: number, baixo: boolean, forca = 1) {
    const aberto = o.abertos * (1 - Math.sin(o.piscar * Math.PI));
    if (aberto <= 0.02) return;
    const e = o.escala;
    const sep = (baixo ? 4 : 5) * e * px;
    const a = aberto * forca;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, sep * 2.4);
    halo.addColorStop(0, rgb(cor, 0.22 * a));
    halo.addColorStop(1, rgb(cor, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - sep * 2.4, y - sep * 2.4, sep * 4.8, sep * 4.8);
    ctx.fillStyle = rgb(mix(cor, [255, 255, 255], 0.35), a);
    const ow = Math.max(1, Math.round(2 * e)) * px;
    const oh = Math.max(px, Math.round(aberto * 1.4 * e) * px);
    for (const lado of [-1, 1]) ctx.fillRect(Math.round(x + lado * sep * 0.5 - ow / 2), Math.round(y - oh / 2), ow, oh);
  }
}

/** Disco cheio, em pixels inteiros (o desenho fica pixelado ao ampliar). */
function disco(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  if (r <= 0) return;
  for (let y = Math.floor(-r); y <= Math.ceil(r); y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    if (w <= 0 && Math.abs(y) > r - 0.5) continue;
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
