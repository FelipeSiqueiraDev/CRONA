import type { ViagemInfo } from '@crona/shared';
import type { SpriteFrame } from './sprites';

/**
 * O dioraminha da viagem (07/10), em pixel art, no estilo das referências do Felipe: uma ilha flutuando no céu, de
 * contorno orgânico (arredondado, com reentrâncias e saliências feitas à mão), a grama com a beira clara, a terra em
 * camadas com pedras encaixadas e o fundo afinando como ilha flutuante, umas pedrinhas soltas embaixo. A estrada atravessa
 * a ilha de ponta a ponta. A van preta fica no meio, ABERTA por cima, com os agentes sentados lá dentro (sobe e desce de
 * leve, as rodas giram) e o mundo passa em cima da ilha: árvores, postes, cercas, arbustos e um carro na outra mão.
 * Os momentos do dia (amanhecer, dia, entardecer, noite, madrugada) mudam o céu, o sol ou a lua e a luz da ilha; os climas
 * (nublado, chuva, tempestade, neblina) são desenhados em pixel por cima. A ilha é pintada uma vez (a terra, as pedras, a
 * grama) e o que se mexe é desenhado a cada quadro, numa tela pequena ampliada com pixels grandes.
 */

/** a ilha: o comprimento (ao longo da estrada) e a largura, em unidades; cada unidade anda (K, K/2) na tela */
const LX = 38;
const LY = 22;
const K = 3;
/** a espessura da terra na beira e quanto o fundo afina para baixo no meio (px) */
const BOLO = 14;
const PONTA = 16;
/** unidades por segundo com a velocidade em 1 */
const UNID_POR_S = 7;
/** a estrada (em y) e a faixa do meio */
const ESTRADA: [number, number] = [4.2, 17.2];
const MEIO = 10.2;

const CONTORNO = '#17121c';

type Pt = [number, number];
type Rgb = [number, number, number];

const aleat = (n: number, s = 0) => {
  const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** O contorno da ilha (em unidades), desenhado à mão e arredondado (Chaikin): saliências e reentrâncias suaves. */
const ILHA: Pt[] = (() => {
  let pts: Pt[] = [
    [-0.8, 3.5], [0.6, -0.6], [4, -1.6], [8.5, -1.2], [11.5, -2.2], [15, -1.4], [20, -1.8], [24, -0.9], [27.5, -2], [32, -1.5],
    [36.5, -1], [39.3, 0.6], [40.3, 4], [39.6, 7.5], [40.6, 11], [40, 15], [40.8, 18.5], [39.5, 21.8], [36.5, 23.4],
    [32, 23], [28, 24.2], [23.5, 23.4], [19, 24.3], [14, 23.5], [9.5, 24.2], [5, 23.4], [1.4, 22.8], [-0.9, 20.6],
    [-1.6, 16.5], [-0.7, 12.5], [-1.5, 8],
  ];
  for (let it = 0; it < 2; it++) {
    const novo: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      novo.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = novo;
  }
  return pts;
})();

/**
 * A arte em pixel do Códex (09/10, `arte/viagem/pixel/`, seção 1 do pedido): entregue em escala 4 (cada pixel da arte é
 * um bloco 4 × 4) e reduzida aqui para a escala 1, a da ilha. Peça que não chegou: o desenho em código continua.
 */
const PASTA_PIXEL = '/arte/viagem/pixel/';
const pixelArte = new Map<string, HTMLCanvasElement | null>();
let existentes: Set<string> | null = null;
fetch('/api/arte')
  .then((r) => r.json() as Promise<{ arquivos: string[] }>)
  .then((j) => (existentes = new Set(j.arquivos)))
  .catch(() => (existentes = new Set()));
function pixel(nome: string): HTMLCanvasElement | null {
  if (pixelArte.has(nome)) return pixelArte.get(nome)!;
  if (!existentes) return null;
  pixelArte.set(nome, null);
  const url = `${PASTA_PIXEL}${nome}.png`;
  if (!existentes.has(url)) return null;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth / 4);
    c.height = Math.round(img.naturalHeight / 4);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, c.width, c.height);
    pixelArte.set(nome, c);
  };
  img.src = url;
  return null;
}
/** a van: os dois eixos de cá, o meio deles, o encaixe da roda e o meio de cada banco (escala 1, do LEIA-ME do Códex) */
const VAN = {
  eixos: [
    [9, 22],
    [33, 34],
  ] as Pt[],
  meio: [21, 28] as Pt,
  roda: [4, 5] as Pt,
  bancos: [
    [19, 13],
    [14, 16],
    [27, 18],
    [23, 21],
    [36, 22],
    [31, 25],
  ] as Pt[],
};
/** os carros da outra mão: os eixos (o meio deles fica no meio das rodas de cá) e qual roda usam */
const CARROS: { nome: string; eixos: [Pt, Pt]; roda: 'carro' | 'caminhao' }[] = [
  { nome: 'sedan-vermelho', eixos: [[5, 12], [17, 18]], roda: 'carro' },
  { nome: 'taxi-amarelo', eixos: [[5, 12], [17, 18]], roda: 'carro' },
  { nome: 'sedan-branco', eixos: [[6, 12], [18, 18]], roda: 'carro' },
  { nome: 'picape-azul', eixos: [[7, 13], [19, 19]], roda: 'carro' },
  { nome: 'caminhaozinho', eixos: [[9, 22], [29, 32]], roda: 'caminhao' },
];
const ENCAIXE_RODA = { carro: [2, 3] as Pt, caminhao: [4, 5] as Pt };
/** a beira da estrada: o ponto da peça que pisa no chão (escala 1) */
const PE_BEIRA: Record<string, Pt> = { arvore: [10, 28], arbusto: [6, 6], poste: [4, 26], cerca: [11, 8], placa: [7, 14], pedras: [3, 3], flores: [3, 3] };

function dentro(x: number, y: number): boolean {
  let d = false;
  for (let i = 0, j = ILHA.length - 1; i < ILHA.length; j = i++) {
    const [xi, yi] = ILHA[i];
    const [xj, yj] = ILHA[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** O céu de cada momento do dia (em cima, embaixo), a cor das nuvens e a luz que tinge a ilha. */
const HORAS: Record<string, { ceu: [string, string]; nuvem: string; tinta: string | null; escuro: boolean }> = {
  amanhecer: { ceu: ['#f2a0a8', '#ffd9a8'], nuvem: '#ffe4dc', tinta: 'rgba(255,150,120,0.16)', escuro: false },
  dia: { ceu: ['#7fcfee', '#c4ebf7'], nuvem: '#ffffff', tinta: null, escuro: false },
  entardecer: { ceu: ['#e2775a', '#f7c47a'], nuvem: '#ffe2c0', tinta: 'rgba(255,120,40,0.2)', escuro: false },
  noite: { ceu: ['#121a38', '#2b3a72'], nuvem: '#6f7bb4', tinta: 'rgba(18,28,88,0.5)', escuro: true },
  madrugada: { ceu: ['#06091b', '#1b2350'], nuvem: '#4e5890', tinta: 'rgba(8,12,50,0.6)', escuro: true },
};
/** O que o clima faz no céu (de dia e de noite) e na luz da ilha. */
const CLIMAS: Record<string, { dia: [string, string]; noite: [string, string]; nuvem: string; tinta: string; nuvens: number } | null> = {
  limpo: null,
  nublado: { dia: ['#93a3b3', '#c8d1d9'], noite: ['#161b2b', '#2a3246'], nuvem: '#d7dde3', tinta: 'rgba(90,100,120,0.16)', nuvens: 14 },
  chuva: { dia: ['#5a687a', '#8794a3'], noite: ['#0e121d', '#1d2433'], nuvem: '#9aa3ad', tinta: 'rgba(40,55,80,0.3)', nuvens: 16 },
  tempestade: { dia: ['#353d4b', '#58626f'], noite: ['#090b13', '#151925'], nuvem: '#6d7580', tinta: 'rgba(24,28,48,0.42)', nuvens: 18 },
  neblina: { dia: ['#bcc6cf', '#e2e7eb'], noite: ['#283042', '#465066'], nuvem: '#eef1f4', tinta: 'rgba(205,212,222,0.2)', nuvens: 6 },
};

export class DioramaViagem {
  private pos = 0;
  private vel = 0;
  private ultimo = 0;
  /** o canto (0, 0) da ilha na tela (muda com o tamanho da tela e com o sobe-desce) */
  private ox = 0;
  private oy = 0;
  /** a ilha pintada (a terra, as pedras e a grama), feita uma vez; e onde fica o (0, 0) dela dentro da pintura */
  private base: HTMLCanvasElement | null = null;
  private baseO: Pt = [0, 0];
  /** a tela do mundo (a ilha e o que passa), para a luz da hora tingir só ela */
  private mundo = document.createElement('canvas');
  /** as luzes (faróis, postes) desenhadas depois da tinta, para brilharem no escuro */
  private luzes: (() => void)[] = [];

  private p(x: number, y: number, z = 0): Pt {
    return [Math.round(this.ox + (x - y) * K), Math.round(this.oy + ((x + y) * K) / 2 - z)];
  }

  private caminho(ctx: CanvasRenderingContext2D, pts: Pt[]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
  }

  private poli(ctx: CanvasRenderingContext2D, pts: Pt[], cor: string, contorno = false) {
    this.caminho(ctx, pts);
    ctx.fillStyle = cor;
    ctx.fill();
    if (contorno) {
      ctx.strokeStyle = CONTORNO;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Um retângulo na face de y fixo (olha para +y) de x0..x1, z0..z1. */
  private faceY(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, z0: number, z1: number, cor: string, contorno = false) {
    this.poli(ctx, [this.p(x0, y, z0), this.p(x1, y, z0), this.p(x1, y, z1), this.p(x0, y, z1)], cor, contorno);
  }

  /** Um retângulo na face de x fixo (olha para +x) de y0..y1, z0..z1. */
  private faceX(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, z0: number, z1: number, cor: string, contorno = false) {
    this.poli(ctx, [this.p(x, y0, z0), this.p(x, y1, z0), this.p(x, y1, z1), this.p(x, y0, z1)], cor, contorno);
  }

  /** Um retângulo deitado (z fixo). */
  private chao(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, z: number, cor: string, contorno = false) {
    this.poli(ctx, [this.p(x0, y0, z), this.p(x1, y0, z), this.p(x1, y1, z), this.p(x0, y1, z)], cor, contorno);
  }

  /** Uma caixa: a face de +y, a de +x e o topo. */
  private caixa(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, topo: string, lado: string, frente: string) {
    this.faceY(ctx, y1, x0, x1, z0, z1, lado, true);
    this.faceX(ctx, x1, y0, y1, z0, z1, frente, true);
    this.chao(ctx, x0, x1, y0, y1, z1, topo, true);
  }

  /** A roda na lateral de +y: o pneu, o aro e três parafusos que giram (`ang`, em radianos). */
  private roda(ctx: CanvasRenderingContext2D, cx: number, y: number, zc: number, ang: number) {
    const R = 1.5;
    const RZ = 4.5;
    const pt = (a: number, f: number): Pt => this.p(cx + Math.cos(a) * R * f, y, zc + Math.sin(a) * RZ * f);
    const circ = (f: number) => Array.from({ length: 16 }, (_, i) => pt((i / 16) * Math.PI * 2, f));
    this.poli(ctx, circ(1), '#1d1d23', true);
    this.poli(ctx, circ(0.55), '#8d929c');
    ctx.fillStyle = '#3a3a44';
    for (const a of [ang, ang + (Math.PI * 2) / 3, ang + (Math.PI * 4) / 3]) {
      const [x1, y1] = pt(a, 0.5);
      ctx.fillRect(x1, y1, 1, 1);
    }
    const [hx, hy] = pt(0, 0);
    ctx.fillStyle = '#d8dbe0';
    ctx.fillRect(hx, hy, 1, 1);
  }

  private arvore(ctx: CanvasRenderingContext2D, x: number, y: number, tam: number, tipo: number, escuro = false) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(bx - 4, by, 9, 2);
    const arte = (escuro && pixel(`arvore-noite-${tipo + 1}`)) || pixel(`arvore-${tipo + 1}`);
    if (arte) return void ctx.drawImage(arte, bx - PE_BEIRA.arvore[0], by - PE_BEIRA.arvore[1]);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 6 * tam, 4, 6 * tam + 1);
    ctx.fillStyle = '#6a4632';
    ctx.fillRect(bx, by - 6 * tam, 2, 6 * tam);
    const ipe = tipo === 2;
    const cores = ipe ? ['#d99a1e', '#f0c33c', '#ffe27a'] : tipo === 1 ? ['#2a7a3a', '#3a9a46', '#5fbf5a'] : ['#2f8a3b', '#3fa54a', '#6fd06a'];
    const copa: [number, number, number][] = [
      [0, -11, 6.5],
      [-3, -13, 4.5],
      [3, -14, 4],
      [1, -16, 3.5],
    ];
    ctx.fillStyle = CONTORNO;
    for (const [dx, dy, r] of copa) {
      ctx.beginPath();
      ctx.arc(bx + 1 + dx, by + dy * tam, r * tam + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    copa.forEach(([dx, dy, r], i) => {
      ctx.fillStyle = cores[Math.min(2, i)];
      ctx.beginPath();
      ctx.arc(bx + 1 + dx, by + dy * tam, r * tam, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = ipe ? '#fff1b0' : '#9be38a';
    ctx.fillRect(bx - 1, Math.round(by - 17 * tam), 2, 1);
  }

  private poste(ctx: CanvasRenderingContext2D, x: number, y: number, aceso: boolean) {
    const [bx, by] = this.p(x, y, 0);
    const arte = (aceso && pixel('poste-aceso')) || pixel('poste');
    if (arte) {
      ctx.drawImage(arte, bx - PE_BEIRA.poste[0], by - PE_BEIRA.poste[1]);
      if (aceso)
        this.luzes.push(() => {
          // depois da tinta da noite: a lâmpada acesa de novo por cima e o cone de luz no chão
          ctx.drawImage(arte, bx - PE_BEIRA.poste[0], by - PE_BEIRA.poste[1]);
          ctx.fillStyle = 'rgba(255,233,160,0.2)';
          ctx.beginPath();
          ctx.moveTo(bx + 2, by - 23);
          ctx.lineTo(bx + 13, by + 4);
          ctx.lineTo(bx - 9, by + 4);
          ctx.closePath();
          ctx.fill();
        });
      return;
    }
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 26, 3, 26);
    ctx.fillRect(bx - 1, by - 27, 8, 3);
    ctx.fillStyle = '#7a7f8a';
    ctx.fillRect(bx, by - 25, 1, 25);
    ctx.fillRect(bx, by - 26, 6, 1);
    ctx.fillStyle = '#d8d6c4';
    ctx.fillRect(bx + 5, by - 25, 2, 1);
    if (aceso)
      this.luzes.push(() => {
        ctx.fillStyle = '#fff2b8';
        ctx.fillRect(bx + 5, by - 25, 2, 1);
        ctx.fillStyle = 'rgba(255,233,160,0.2)';
        ctx.beginPath();
        ctx.moveTo(bx + 6, by - 24);
        ctx.lineTo(bx + 17, by + 4);
        ctx.lineTo(bx - 5, by + 4);
        ctx.closePath();
        ctx.fill();
      });
  }

  private arbusto(ctx: CanvasRenderingContext2D, x: number, y: number, i = 0) {
    const [bx, by] = this.p(x, y, 0);
    const arte = pixel(`arbusto-${(i % 2) + 1}`);
    if (arte) return void ctx.drawImage(arte, bx - PE_BEIRA.arbusto[0], by - PE_BEIRA.arbusto[1]);
    const bolas: [number, number, number][] = [
      [-3, -2, 3],
      [3, -2, 3],
      [0, -4, 3.5],
    ];
    ctx.fillStyle = CONTORNO;
    for (const [dx, dy, r] of bolas) {
      ctx.beginPath();
      ctx.arc(bx + dx, by + dy, r + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3c9a46';
    for (const [dx, dy, r] of bolas) {
      ctx.beginPath();
      ctx.arc(bx + dx, by + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7fd26e';
    ctx.fillRect(bx - 1, by - 6, 2, 1);
    ctx.fillStyle = '#ffd1e0';
    ctx.fillRect(bx + 2, by - 3, 1, 1);
  }

  private cerca(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const [bx, by] = this.p(x, y, 0);
    const arte = pixel('cerca');
    if (arte) return void ctx.drawImage(arte, bx - PE_BEIRA.cerca[0], by - PE_BEIRA.cerca[1]);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 8, 3, 8);
    ctx.fillStyle = '#9a7448';
    ctx.fillRect(bx, by - 7, 1, 7);
    ctx.fillRect(bx - 6, by - 6, 13, 1);
    ctx.fillRect(bx - 6, by - 3, 13, 1);
  }

  /** Uma peça pequena da beira (a placa, as pedras, as flores): só com a arte; sem ela, nada. */
  private detalhe(ctx: CanvasRenderingContext2D, nome: string, x: number, y: number) {
    const arte = pixel(nome);
    if (!arte) return;
    const [bx, by] = this.p(x, y, 0);
    const pe = PE_BEIRA[nome] ?? [0, 0];
    ctx.drawImage(arte, bx - pe[0], by - pe[1]);
  }

  /**
   * A van preta, ABERTA por cima, parada no meio da ilha (o mundo é que anda): o piso, as paredes de dentro, os bancos
   * com os agentes sentados (o boneco de cada um), a lateral de perto mais baixa (para ver quem está dentro), a cabine
   * com o para-brisa, o capô e as rodas girando.
   */
  private van(ctx: CanvasRenderingContext2D, now: number, escuro: boolean, figuras: (SpriteFrame | null)[]) {
    const x0 = 10.5;
    const x1 = 23;
    const y0 = 10.8;
    const y1 = 16.2;
    // a trepidação do motor: um pixel, de vez em quando
    const z = 4 + (Math.sin(now / 90) > 0.6 ? 1 : 0);
    const alto = 15;
    const lataria = '#2c2c36';
    // a sombra na estrada e o facho dos faróis no escuro
    this.chao(ctx, x0 - 0.4, x1 + 3.6, y0 + 0.8, y1 + 1.4, 0, 'rgba(0,0,0,0.3)');
    if (escuro)
      this.luzes.push(() => {
        this.poli(ctx, [this.p(x1 + 3.2, y0 + 0.6, 0), this.p(x1 + 14, y0 - 1.8, 0), this.p(x1 + 14, y1 + 1.6, 0), this.p(x1 + 3.2, y1 - 0.6, 0)], 'rgba(255,236,170,0.24)');
        this.faceX(ctx, x1 + 3.2, y0 + 0.8, y0 + 1.7, z + 4, z + 6, '#fff6c8');
        this.faceX(ctx, x1 + 3.2, y1 - 1.7, y1 - 0.8, z + 4, z + 6, '#fff6c8');
      });
    // a van pintada (arte/viagem/pixel/van-corpo.png e as 4 rodas): as rodas primeiro, o corpo por cima (o para-lama
    // cobre o pneu) e os agentes nos bancos dela; o corpo treme com o motor, as rodas não
    const corpo = (escuro && pixel('van-noite')) || pixel('van-corpo');
    const rodas = [1, 2, 3, 4].map((i) => pixel(`roda-${i}`));
    if (corpo && rodas.every(Boolean)) {
      const [mx, my] = this.p(18, y1, 4.6);
      const ox = mx - VAN.meio[0];
      const oy = my - VAN.meio[1];
      const roda = rodas[((Math.floor(this.pos * 1.4) % 4) + 4) % 4]!;
      for (const [ex, ey] of VAN.eixos) ctx.drawImage(roda, ox + ex - VAN.roda[0], oy + ey - VAN.roda[1]);
      const sobe = z - 4;
      ctx.drawImage(corpo, ox, oy - sobe);
      VAN.bancos.forEach(([bx, by], k) => {
        const q = figuras[k];
        if (q) this.sentado(ctx, q, ox + bx, oy + by - sobe);
      });
      return;
    }
    // o piso
    this.chao(ctx, x0, x1, y0, y1, z, '#4a4d58', true);
    // a parede de lá (vista por dentro) e a de trás (por dentro), com as janelas
    this.faceY(ctx, y0, x0, x1, z, z + alto, '#3a3b46', true);
    for (const [a, b] of [[11.6, 14.8], [15.6, 18.8], [19.6, 22.4]] as const) this.faceY(ctx, y0, a, b, z + 8, z + 13, '#7fb2cf');
    this.faceX(ctx, x0, y0, y1, z, z + alto, '#33343e', true);
    this.faceX(ctx, x0, y0 + 0.8, y1 - 0.8, z + 8, z + 13, '#7fb2cf');
    // a beira de cima das paredes (a lataria cortada)
    this.chao(ctx, x0, x1, y0 - 0.4, y0, z + alto, '#5a5a6a', true);
    this.chao(ctx, x0 - 0.4, x0, y0 - 0.4, y1, z + alto, '#5a5a6a', true);
    // os bancos e quem vai sentado: três fileiras de dois, da de trás para a da frente; em cada fileira, primeiro o de lá
    const fileiras = [12.2, 15.6, 19.0];
    const colunas = [y0 + 1.5, y0 + 3.6];
    let k = 0;
    for (const fx of fileiras)
      for (const fy of colunas) {
        // o assento e o encosto
        this.caixa(ctx, fx, fx + 1.8, fy - 0.8, fy + 0.9, z, z + 4, '#5d5d6e', '#44444f', '#3a3a44');
        this.caixa(ctx, fx - 0.5, fx, fy - 0.8, fy + 0.9, z, z + 10, '#5d5d6e', '#44444f', '#3a3a44');
        const q = figuras[k++];
        if (q) {
          const [px, py] = this.p(fx + 0.9, fy + 0.1, z + 4);
          this.sentado(ctx, q, px, py);
        }
      }
    // o painel na frente dos bancos da frente
    this.caixa(ctx, x1 - 1.2, x1, y0, y1, z, z + 7, '#3a3a46', '#2a2a33', '#24242c');
    // a lateral de perto, mais baixa, para ver quem está dentro, com a porta de correr e a maçaneta
    this.faceY(ctx, y1, x0, x1, z, z + 7, lataria, true);
    this.chao(ctx, x0, x1, y1, y1 + 0.4, z + 7, '#5a5a6a', true);
    this.faceY(ctx, y1, 15.3, 15.45, z + 1, z + 7, '#17171c');
    this.faceY(ctx, y1, 16.3, 17.1, z + 4, z + 4.7, '#9a9aa6');
    this.faceY(ctx, y1, x0, x0 + 0.5, z + 3, z + 6, '#c8322a');
    // a cabine: a coluna, o para-brisa (aberto em cima, só a moldura) e o retrovisor
    this.faceX(ctx, x1, y0, y1, z, z + alto, lataria, true);
    this.faceX(ctx, x1, y0 + 0.6, y1 - 0.6, z + 8, z + alto - 1, '#9cc9de', true);
    this.faceX(ctx, x1, y0 + 1.2, y0 + 2, z + 9, z + alto - 2, '#d4ecf6');
    this.faceY(ctx, y1 + 0.5, x1 - 0.5, x1 + 0.3, z + 10, z + 12, CONTORNO);
    // o capô, a grade e os faróis
    this.caixa(ctx, x1, x1 + 3.2, y0 + 0.3, y1 - 0.3, z, z + 8, '#3c3c48', lataria, '#202028');
    this.faceX(ctx, x1 + 3.2, y0 + 0.8, y0 + 1.7, z + 4, z + 6, '#f2d77a');
    this.faceX(ctx, x1 + 3.2, y1 - 1.7, y1 - 0.8, z + 4, z + 6, '#f2d77a');
    this.faceX(ctx, x1 + 3.2, y0 + 2.1, y1 - 2.1, z + 3, z + 6, '#15151a');
    // as rodas de perto, girando com o chão
    const ang = -this.pos / 1.5;
    this.roda(ctx, 13.4, y1, 4.6, ang);
    this.roda(ctx, 22.6, y1, 4.6, ang);
  }

  /** O agente sentado: o boneco do tabuleiro, pequeno, com o quadril no assento (px, py) e as pernas escondidas. */
  private sentado(ctx: CanvasRenderingContext2D, q: SpriteFrame, px: number, py: number) {
    const alturaPessoa = 19;
    const e = alturaPessoa / Math.max(1, q.ay);
    const pes = py + Math.round(alturaPessoa * 0.42);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px - 20, pes - alturaPessoa - 20, 40, alturaPessoa + 20 - Math.round(alturaPessoa * 0.42) + 1);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(q.canvas, px - q.ax * e, pes - q.ay * e, q.w * e, q.h * e);
    ctx.restore();
  }

  /** Um carro na outra mão, de vez em quando, indo para o outro lado. */
  private carro(ctx: CanvasRenderingContext2D, escuro: boolean) {
    const ciclo = 80;
    const t = (this.pos * 1.9) % ciclo;
    const n = Math.floor((this.pos * 1.9) / ciclo);
    const len = 7.5;
    const x0 = LX + 2 - t;
    const y0 = 5.4;
    const y1 = 8.8;
    if (!dentro(x0, y0) || !dentro(x0 + len, y1) || !dentro(x0, y1) || !dentro(x0 + len, y0)) return;
    const cores = ['#d8473c', '#f0c33c', '#eef0f2', '#3f6fd8'];
    const cor = cores[n % cores.length];
    const z = 3;
    this.chao(ctx, x0 - 0.3, x0 + len + 0.6, y0 + 0.5, y1 + 0.9, 0, 'rgba(0,0,0,0.28)');
    // o carro pintado (arte/viagem/pixel/): um por vez, em rodízio; as rodas por cima do corpo, nos eixos dele
    const c = CARROS[n % CARROS.length];
    const corpoArte = pixel(c.nome);
    const rodasArte = [1, 2, 3, 4].map((i) => pixel(`roda-${c.roda}-${i}`));
    if (corpoArte && rodasArte.every(Boolean)) {
      const [mx, my] = this.p(x0 + len / 2, y1, 3.3);
      const ox = Math.round(mx - (c.eixos[0][0] + c.eixos[1][0]) / 2);
      const oy = Math.round(my - (c.eixos[0][1] + c.eixos[1][1]) / 2);
      ctx.drawImage(corpoArte, ox, oy);
      const r = rodasArte[((Math.floor(this.pos * 1.9) % 4) + 4) % 4]!;
      const enc = ENCAIXE_RODA[c.roda];
      for (const [ex, ey] of c.eixos) ctx.drawImage(r, ox + ex - enc[0], oy + ey - enc[1]);
      return;
    }
    this.caixa(ctx, x0, x0 + len, y0, y1, z, z + 6, cor, cor, cor);
    this.caixa(ctx, x0 + 1.8, x0 + 5.4, y0 + 0.4, y1 - 0.4, z + 6, z + 10, '#e6e8ec', '#8cc4de', '#8cc4de');
    // as lanternas de trás (o carro vai para lá: a traseira fica para cá), acesas no escuro
    const lanterna = () => {
      this.faceX(ctx, x0 + len, y0 + 0.4, y0 + 1.2, z + 3, z + 5, escuro ? '#ff5a4a' : '#c8322a');
      this.faceX(ctx, x0 + len, y1 - 1.2, y1 - 0.4, z + 3, z + 5, escuro ? '#ff5a4a' : '#c8322a');
    };
    lanterna();
    if (escuro) this.luzes.push(lanterna);
    const ang = this.pos * 0.9;
    for (const x of [x0 + 1.7, x0 + 5.8]) this.roda(ctx, x, y1, 3.3, ang);
  }

  /**
   * A ilha pintada uma vez, pixel a pixel: a grama (com a beira clara e o contorno escuro), a terra em faixas embaixo da
   * beira de cá, afinando para baixo no meio como ilha flutuante, com pedras encaixadas e a pontinha de baixo.
   */
  private pintarBase(): HTMLCanvasElement {
    // o (0, 0) da ilha dentro da pintura, com folga em volta
    const ox = (LY + 3) * K;
    const oy = 4 * K;
    const W = (LX + LY + 6) * K;
    const H = ((LX + LY + 6) * K) / 2 + BOLO + PONTA + 10;
    const salvo: Pt = [this.ox, this.oy];
    this.ox = ox;
    this.oy = oy;
    const m = document.createElement('canvas');
    m.width = W;
    m.height = H;
    const mc = m.getContext('2d')!;
    this.caminho(mc, ILHA.map(([x, y]) => this.p(x, y)));
    mc.fillStyle = '#fff';
    mc.fill();
    this.ox = salvo[0];
    this.oy = salvo[1];
    const mask = mc.getImageData(0, 0, W, H).data;
    const topo = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[(y * W + x) * 4 + 3] > 120;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const pinta = (x: number, y: number, cor: Rgb) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      d[i] = cor[0];
      d[i + 1] = cor[1];
      d[i + 2] = cor[2];
      d[i + 3] = 255;
    };
    // as colunas da ilha: onde começa e termina a grama em cada uma
    let xMin = W;
    let xMax = 0;
    const cima = new Int32Array(W).fill(-1);
    const baixo = new Int32Array(W).fill(-1);
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++)
        if (topo(x, y)) {
          if (cima[x] < 0) cima[x] = y;
          baixo[x] = y;
          xMin = Math.min(xMin, x);
          xMax = Math.max(xMax, x);
        }
    const terra = [rgb('#a27c5c'), rgb('#8f6b50'), rgb('#7b5b44'), rgb('#664a37')];
    const gramaBeira = rgb('#3f8f3a');
    const raiz = rgb('#5a3f2e');
    const escuro = rgb(CONTORNO);
    // a terra: cada coluna desce da beira de baixo da grama; mais funda no meio (a ponta da ilha flutuante)
    const fundo = new Int32Array(W).fill(0);
    for (let x = xMin; x <= xMax; x++) {
      if (baixo[x] < 0) continue;
      const t = (x - xMin) / Math.max(1, xMax - xMin);
      const prof = Math.round(BOLO + PONTA * Math.pow(Math.sin(Math.PI * t), 1.6) + Math.sin(x * 0.31) * 1.2 + (aleat(x, 3) < 0.15 ? 1 : 0));
      fundo[x] = prof;
      for (let r = 1; r <= prof; r++) {
        const y = baixo[x] + r;
        if (r <= 2) {
          pinta(x, y, gramaBeira);
          continue;
        }
        // as faixas da terra, onduladas, mais escuras para baixo
        const faixa = Math.floor((r + Math.round(Math.sin(x * 0.18) * 1.5)) / 4);
        const tom = Math.min(3, Math.floor((r / prof) * 3.2));
        pinta(x, y, terra[Math.min(3, tom + (faixa % 2 ? 1 : 0))]);
      }
      // o contorno escuro embaixo e as raizinhas penduradas
      pinta(x, baixo[x] + prof + 1, escuro);
      if (aleat(x, 9) < 0.08) {
        const n = 1 + Math.floor(aleat(x, 10) * 3);
        for (let k = 1; k <= n; k++) pinta(x, baixo[x] + prof + 1 + k, raiz);
      }
    }
    // as bordas laterais da terra (a coluna vizinha mais rasa deixa ver a quina)
    for (let x = xMin; x <= xMax; x++) {
      if (!fundo[x]) continue;
      for (const v of [x - 1, x + 1]) {
        if (v < 0 || v >= W || fundo[v]) continue;
        for (let r = 1; r <= fundo[x]; r++) pinta(x, baixo[x] + r, escuro);
      }
    }
    // as pedras encaixadas na terra: blocos claros com o brilho em cima e a sombra embaixo
    const pedra = rgb('#b48e6c');
    const brilho = rgb('#d0a982');
    const sombra = rgb('#5e4434');
    for (let x = xMin + 3, i = 0; x < xMax - 3; i++) {
      const larg = 3 + Math.floor(aleat(i, 11) * 4);
      const alt = 2 + Math.floor(aleat(i, 12) * 2);
      if (baixo[x] >= 0 && fundo[x] > 8) {
        const r0 = 4 + Math.floor(aleat(i, 13) * Math.max(1, fundo[x] - alt - 7));
        for (let dx = 0; dx < larg; dx++) {
          const xx = x + dx;
          if (baixo[xx] < 0 || fundo[xx] < r0 + alt + 2) continue;
          for (let dy = 0; dy < alt; dy++) pinta(xx, baixo[xx] + r0 + dy, dy === 0 ? brilho : pedra);
          pinta(xx, baixo[xx] + r0 + alt, sombra);
        }
      }
      x += larg + 2 + Math.floor(aleat(i, 14) * 5);
    }
    // a grama: o topo, com a beira de cima clara, umas manchas e o contorno escuro
    const g0 = rgb('#5fbf4f');
    const g1 = rgb('#70cb5c');
    const gClaro = rgb('#9be38a');
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!topo(x, y)) continue;
        const borda = !topo(x - 1, y) || !topo(x + 1, y) || !topo(x, y - 1) || !topo(x, y + 1);
        if (borda) pinta(x, y, !topo(x, y - 1) ? gClaro : escuro);
        else pinta(x, y, aleat(x * 7 + y, 15) < 0.1 ? g1 : g0);
      }
    ctx.putImageData(img, 0, 0);
    this.baseO = [ox, oy];
    return c;
  }

  /** Desenha a cena inteira (o céu, as nuvens e a ilha) numa tela pequena de `w` × `h`. */
  desenhar(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, v: ViagemInfo, figuras: (SpriteFrame | null)[] = []) {
    const dt = this.ultimo ? Math.min(0.1, (now - this.ultimo) / 1000) : 0;
    this.ultimo = now;
    this.vel += (Math.max(0.35, v.velocidade) - this.vel) * Math.min(1, dt * 1.5);
    this.pos += this.vel * UNID_POR_S * dt;
    const hora = HORAS[v.hora] ?? HORAS.dia;
    const clima = CLIMAS[v.clima ?? 'limpo'] ?? null;
    const escuro = hora.escuro || v.clima === 'tempestade';
    const [c0, c1] = clima ? (hora.escuro ? clima.noite : clima.dia) : hora.ceu;
    const corNuvem = clima ? (hora.escuro ? hora.nuvem : clima.nuvem) : hora.nuvem;
    ctx.imageSmoothingEnabled = false;
    // o céu
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (hora.escuro && (!clima || v.clima === 'nublado')) {
      ctx.fillStyle = '#e8ecff';
      const n = v.hora === 'madrugada' ? 90 : 55;
      for (let i = 0; i < n; i++) if (Math.sin(now / 700 + i) > -0.6) ctx.fillRect(Math.floor(aleat(i, 1) * w), Math.floor(aleat(i, 2) * h * 0.85), 1, 1);
    }
    if (!clima || v.clima === 'nublado') this.astro(ctx, w, h, v.hora);
    // as nuvens de trás, passando devagar (mais e mais escuras com o tempo fechado)
    const nNuvens = clima?.nuvens ?? 7;
    for (let i = 0; i < nNuvens; i++) this.nuvem(ctx, ((aleat(i, 3) * w - now / (120 + i * 30)) % (w + 40) + w + 40) % (w + 40) - 20, 8 + aleat(i, 4) * h * 0.8, corNuvem, clima ? 0.75 : 0.5, aleat(i, 5) < 0.4);
    // o mundo (a ilha e o que passa) numa tela só, para a luz da hora tingir só ele
    if (this.mundo.width !== w || this.mundo.height !== h) {
      this.mundo.width = w;
      this.mundo.height = h;
    }
    const mc = this.mundo.getContext('2d')!;
    mc.imageSmoothingEnabled = false;
    mc.clearRect(0, 0, w, h);
    const bob = Math.round(Math.sin(now / 1200) * 2);
    this.ox = Math.round(w / 2 - (LX - LY) * K * 0.5);
    this.oy = Math.round(h / 2 - ((LX + LY) * K) / 4 - 10 + bob);
    this.luzes = [];
    this.pedrinhas(mc, now);
    this.base ??= this.pintarBase();
    mc.drawImage(this.base, this.ox - this.baseO[0], this.oy - this.baseO[1]);
    this.emCima(mc, v, now, figuras, escuro);
    // a luz da hora e do clima, só no mundo
    mc.globalCompositeOperation = 'source-atop';
    for (const t of [hora.tinta, clima?.tinta]) {
      if (!t) continue;
      mc.fillStyle = t;
      mc.fillRect(0, 0, w, h);
    }
    mc.globalCompositeOperation = 'source-over';
    for (const l of this.luzes) l();
    if (v.clima === 'chuva' || v.clima === 'tempestade') this.respingos(mc, now);
    ctx.drawImage(this.mundo, 0, 0);
    // as nuvens da frente, poucas
    for (let i = 0; i < 2; i++) this.nuvem(ctx, ((aleat(i, 9) * w - now / (80 + i * 25)) % (w + 40) + w + 40) % (w + 40) - 20, h * (0.8 + i * 0.09), corNuvem, 0.9, false);
    // o clima por cima de tudo, em pixel
    if (v.clima === 'chuva' || v.clima === 'tempestade') this.chuva(ctx, w, h, now, v.clima === 'tempestade');
    if (v.clima === 'neblina') this.neblina(ctx, w, h, now, hora.escuro);
  }

  /** O sol ou a lua, conforme a hora. */
  private astro(ctx: CanvasRenderingContext2D, w: number, h: number, hora: string) {
    const disco = (x: number, y: number, r: number, cor: string, borda: string) => {
      ctx.fillStyle = borda;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (hora === 'dia') disco(Math.round(w * 0.82), Math.round(h * 0.16), 7, '#fff3a8', 'rgba(255,243,168,0.35)');
    else if (hora === 'amanhecer') disco(Math.round(w * 0.8), Math.round(h * 0.62), 10, '#ffd27a', 'rgba(255,210,122,0.35)');
    else if (hora === 'entardecer') disco(Math.round(w * 0.18), Math.round(h * 0.55), 12, '#ff9a4a', 'rgba(255,154,74,0.35)');
    else {
      // a lua minguante: um disco claro com um pedaço do céu por cima
      const [x, y] = hora === 'noite' ? [Math.round(w * 0.8), Math.round(h * 0.18)] : [Math.round(w * 0.22), Math.round(h * 0.3)];
      disco(x, y, 7, '#eef0ff', 'rgba(220,226,255,0.2)');
      ctx.fillStyle = hora === 'noite' ? '#18224a' : '#0a0f28';
      ctx.beginPath();
      ctx.arc(x + 4, y - 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private nuvem(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, a: number, grande: boolean) {
    const bx = Math.round(x);
    const by = Math.round(y);
    const k = grande ? 2 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = cor;
    ctx.fillRect(bx - 9 * k, by, 19 * k, 3 * k);
    ctx.fillRect(bx - 6 * k, by - 3 * k, 13 * k, 3 * k);
    ctx.fillRect(bx - 2 * k, by - 5 * k, 6 * k, 2 * k);
    ctx.globalAlpha = 1;
  }

  /** A chuva em pixel: traços curtos na diagonal; na tempestade, mais forte e com o relâmpago. */
  private chuva(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, forte: boolean) {
    const n = Math.round(((w * h) / 900) * (forte ? 2.2 : 1.2));
    ctx.fillStyle = forte ? 'rgba(210,225,255,0.7)' : 'rgba(210,225,255,0.55)';
    const vel = forte ? 0.32 : 0.22;
    for (let i = 0; i < n; i++) {
      const y = Math.floor((now * vel * (0.8 + aleat(i, 21) * 0.4) + aleat(i, 22) * (h + 10)) % (h + 10)) - 5;
      const x = Math.floor((aleat(i, 23) * (w + h * 0.4) - y * 0.4) % (w + 10));
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x - 1, y + 2, 1, 1);
      ctx.fillRect(x - 1, y + 3, 1, 1);
    }
    if (!forte) return;
    // o relâmpago: um clarão duplo de tempos em tempos, com o raio no céu
    const ciclo = Math.floor(now / 7000);
    const t = now - (ciclo * 7000 + aleat(ciclo, 24) * 4500);
    if (t < 0 || t > 380) return;
    const a = t < 90 ? 0.55 : t < 170 ? 0.1 : t < 260 ? 0.45 : 0;
    if (!a) return;
    ctx.fillStyle = `rgba(230,236,255,${a})`;
    ctx.fillRect(0, 0, w, h);
    let x = Math.floor(w * (0.15 + aleat(ciclo, 25) * 0.7));
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < h * 0.35; y += 2) {
      x += Math.floor((aleat(ciclo, y) - 0.5) * 4);
      ctx.fillRect(x, y, 1, 2);
    }
  }

  /** Os respingos da chuva no chão da ilha. */
  private respingos(ctx: CanvasRenderingContext2D, now: number) {
    ctx.fillStyle = 'rgba(220,235,255,0.7)';
    const quadro = Math.floor(now / 120);
    for (let i = 0; i < 26; i++) {
      const x = aleat(i, quadro) * LX;
      const y = aleat(i + 50, quadro) * LY;
      if (!dentro(x, y)) continue;
      const [px, py] = this.p(x, y);
      ctx.fillRect(px - 1, py, 1, 1);
      ctx.fillRect(px + 1, py, 1, 1);
    }
  }

  /** A neblina em pixel: faixas claras de bordas recortadas, passando devagar por cima e em volta da ilha. */
  private neblina(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, escuro: boolean) {
    const cor = escuro ? '180,190,215' : '235,240,245';
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(h * (0.18 + i * 0.09) + Math.sin(now / 2500 + i) * 3);
      const larg = Math.floor(w * (0.35 + aleat(i, 31) * 0.4));
      const x = Math.floor(((aleat(i, 32) * w + now / (60 + i * 18)) % (w + larg)) - larg);
      const alto = 3 + Math.floor(aleat(i, 33) * 4);
      ctx.fillStyle = `rgba(${cor},${0.18 + aleat(i, 34) * 0.16})`;
      ctx.fillRect(x, y, larg, alto);
      ctx.fillRect(x + 4, y - 1, larg - 10, 1);
      ctx.fillRect(x + 6, y + alto, larg - 14, 1);
    }
    ctx.fillStyle = `rgba(${cor},0.14)`;
    ctx.fillRect(0, 0, w, h);
  }

  /** As pedrinhas soltas embaixo da ilha, cada uma subindo e descendo no seu tempo. */
  private pedrinhas(ctx: CanvasRenderingContext2D, now: number) {
    const [bx, by] = this.p(LX / 2, LY / 2, -BOLO);
    const pedras: [number, number, number][] = [
      [-46, 26, 5],
      [38, 34, 4],
      [-14, 50, 3],
      [58, 14, 3],
      [12, 58, 2],
    ];
    pedras.forEach(([dx, dy, r], i) => {
      const y = by + dy + Math.round(Math.sin(now / (900 + i * 170) + i) * 2);
      const x = bx + dx;
      ctx.fillStyle = CONTORNO;
      ctx.fillRect(x - r - 1, y - 1, r * 2 + 2, r + 3);
      ctx.fillStyle = '#8f6b50';
      ctx.fillRect(x - r, y, r * 2, r + 1);
      ctx.fillStyle = '#b48e6c';
      ctx.fillRect(x - r, y, r * 2, 1);
      ctx.fillStyle = '#5fbf4f';
      ctx.fillRect(x - r, y - 1, r * 2, 1);
    });
  }

  /** O que fica em cima da ilha: a estrada, os tufos, e o que passa (com a van no meio). */
  private emCima(ctx: CanvasRenderingContext2D, v: ViagemInfo, now: number, figuras: (SpriteFrame | null)[], escuro: boolean) {
    const terra = v.cenario === 'terra';
    const topo: Pt[] = ILHA.map(([x, y]) => this.p(x, y));
    ctx.save();
    this.caminho(ctx, topo);
    ctx.clip();
    // tufos de grama mais clara e florzinhas, andando com o mundo
    for (let i = 0; i < 70; i++) {
      const x = (((aleat(i, 10) * (LX + 4) - this.pos) % (LX + 4)) + LX + 4) % (LX + 4) - 2;
      const y = aleat(i, 11) * LY;
      if (y > ESTRADA[0] - 0.3 && y < ESTRADA[1] + 0.3) continue;
      const [px, py] = this.p(x, y);
      ctx.fillStyle = '#86d670';
      ctx.fillRect(px, py, 2, 1);
      if (aleat(i, 12) < 0.2) {
        ctx.fillStyle = aleat(i, 13) < 0.5 ? '#ffffff' : '#ffd1e0';
        ctx.fillRect(px + 1, py - 1, 1, 1);
      }
    }
    // a estrada atravessando a ilha de ponta a ponta
    const [e0, e1] = ESTRADA;
    if (terra) {
      this.chao(ctx, -4, LX + 4, e0, e1, 0, '#b48d5c');
      for (const y of [6.4, 7.8, 12.4, 14]) this.chao(ctx, -4, LX + 4, y, y + 0.6, 0, '#9a754a');
      ctx.fillStyle = '#8a6a42';
      for (let i = 0; i < 26; i++) {
        const x = (((aleat(i, 14) * (LX + 8) - this.pos) % (LX + 8)) + LX + 8) % (LX + 8) - 4;
        const [px, py] = this.p(x, e0 + 0.5 + aleat(i, 15) * (e1 - e0 - 1));
        ctx.fillRect(px, py, 1, 1);
      }
    } else {
      this.chao(ctx, -4, LX + 4, e0, e1, 0, '#3e414a');
      this.chao(ctx, -4, LX + 4, e0 + 0.3, e0 + 0.6, 0, '#d9dbde');
      this.chao(ctx, -4, LX + 4, e1 - 0.6, e1 - 0.3, 0, '#d9dbde');
      const passo = 5;
      for (let x = -4 - ((this.pos % passo) + passo) % passo; x < LX + 4; x += passo) this.chao(ctx, x, x + 2.4, MEIO - 0.25, MEIO + 0.25, 0, '#f0c33c');
      // o asfalto molhado brilha com a chuva
      if (v.clima === 'chuva' || v.clima === 'tempestade')
        for (let x = -4 - ((this.pos * 0.5) % 9 + 9) % 9; x < LX + 4; x += 9) this.chao(ctx, x, x + 3, e0 + 2, e0 + 2.6, 0, 'rgba(200,215,240,0.18)');
    }
    // a beira da estrada: a grama gasta encostando no asfalto
    ctx.restore();
    // o que passa, de trás para a frente: árvores e postes (ou a cerca) de lá, o carro, a van, os arbustos e árvores de cá
    const passa = (n: number, passo: number, y: number, f: (x: number, i: number) => void) => {
      for (let i = 0; i < n; i++) {
        const x = (((i * passo + aleat(i, y) * 3 - this.pos) % (n * passo)) + n * passo) % (n * passo) - 2;
        if (dentro(x, y) && dentro(x + 1.5, y) && dentro(x - 1.5, y)) f(x, i);
      }
    };
    passa(6, 8, 1.6, (x, i) => this.arvore(ctx, x, 1.6 + aleat(i, 40) * 0.6, 1, i % 3, escuro));
    if (!terra) passa(3, 14, 3.4, (x) => this.poste(ctx, x, 3.4, escuro));
    else passa(10, 4, 3.3, (x) => this.cerca(ctx, x, 3.3));
    // a placa verde da estrada, de vez em quando (só com a arte)
    if (!terra) passa(1, 46, 3.9, (x) => this.detalhe(ctx, 'placa', x, 3.9));
    this.carro(ctx, escuro);
    this.van(ctx, now, escuro, figuras);
    // pedrinhas e flores na grama de cá (só com a arte)
    passa(6, 7, 18.4, (x, i) => this.detalhe(ctx, i % 2 ? 'flores' : 'pedras', x, 18.4 + aleat(i, 41) * 0.8));
    passa(5, 8, 19.4, (x, i) => this.arbusto(ctx, x, 19.4, i));
    passa(3, 13, 20.6, (x, i) => this.arvore(ctx, x, 20.6, 0.75, (i + 1) % 3, escuro));
  }
}
