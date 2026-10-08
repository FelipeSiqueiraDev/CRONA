/**
 * Os joguinhos do fliperama (08/10), no jeito do Atari: tela de 160 × 192 pixels, cores chapadas,
 * letra de 3 × 5 e bipes de onda quadrada. Tudo desenhado por código, sem arte.
 *
 * - PONG (1972): a raquete da direita é a sua, a da esquerda é a máquina; quem fizer 7 vence.
 * - ATRAVESSA (o Freeway, 1981): o agente atravessa as dez faixas da avenida; 90 segundos, cada
 *   travessia é um ponto, e o carro empurra de volta.
 * - PULA-PULA: o agente pula sozinho de plataforma em plataforma, subindo; a verde é firme, a azul
 *   anda, a marrom quebra, a mola joga longe. Caiu, acabou.
 */
import { sfx } from './sfx';

export const W = 160;
export const H = 192;

export type Botao = 'cima' | 'baixo' | 'esq' | 'dir' | 'a';

/** O que o jogador fez neste passo: o que está segurando, o que acabou de apertar e o dedo na tela. */
export interface Entrada {
  segura: Set<Botao>;
  apertou: Set<Botao>;
  /** o dedo na tela, em pixels do jogo (null = sem dedo) */
  dedo: { x: number; y: number } | null;
  /** o dedo acabou de encostar */
  tocou: boolean;
}

export interface Jogo {
  pontos: number;
  fim: boolean;
  passo(e: Entrada): void;
  desenhar(g: CanvasRenderingContext2D, quadro: number): void;
  /** a linha da tela de fim ("VOCE VENCEU 7 A 4") */
  resumo(): string;
}

/** A paleta, tirada da do Atari 2600 (NTSC). */
export const COR = {
  preto: '#000000',
  branco: '#ececec',
  claro: '#bcbcbc',
  cinza: '#8e8e8e',
  medio: '#6c6c6c',
  escuro: '#404040',
  vermelho: '#d84848',
  laranja: '#e0803c',
  ouro: '#e8b040',
  amarelo: '#ecec68',
  verde: '#5cba5c',
  verdeClaro: '#9cec9c',
  azul: '#5878e8',
  azulClaro: '#a8d0fc',
  roxo: '#9c5cd8',
  rosa: '#e070b0',
  marrom: '#9c6c34',
  marromEscuro: '#5c3c14',
  pele: '#e8b98f',
  cabelo: '#3a2414',
  terno: '#1a1a2c',
};

// ---------------------------------------------------------------- a letra de 3 × 5

/** Cada letra: 5 linhas de 3 bits (o bit da esquerda é o mais alto). */
const FONTE: Record<string, number[]> = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 3, 1, 7], '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], ' ': [0, 0, 0, 0, 0], '-': [0, 0, 7, 0, 0], ':': [0, 2, 0, 2, 0], '.': [0, 0, 0, 0, 2],
  '!': [2, 2, 2, 0, 2], '?': [7, 1, 2, 0, 2], '>': [4, 2, 1, 2, 4], '<': [1, 2, 4, 2, 1], '/': [1, 1, 2, 4, 4],
  '*': [0, 5, 2, 5, 0], '+': [0, 2, 7, 2, 0], '=': [0, 7, 0, 7, 0], ',': [0, 0, 0, 2, 4], "'": [2, 2, 0, 0, 0],
};

/** Sem acento e em maiúsculas: a letra do Atari não tem acento. */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** A largura do texto, em pixels do jogo. */
export const larguraTexto = (s: string, esc = 1) => Math.max(0, s.length * 4 * esc - esc);

export function texto(g: CanvasRenderingContext2D, s: string, x: number, y: number, cor: string, esc = 1, alinha: 'esq' | 'meio' | 'dir' = 'esq') {
  const t = semAcento(s);
  const larg = larguraTexto(t, esc);
  let cx = Math.round(alinha === 'meio' ? x - larg / 2 : alinha === 'dir' ? x - larg : x);
  const cy = Math.round(y);
  g.fillStyle = cor;
  for (const ch of t) {
    const gl = FONTE[ch] ?? FONTE['?'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if ((gl[r] >> (2 - c)) & 1) g.fillRect(cx + c * esc, cy + r * esc, esc, esc);
    cx += 4 * esc;
  }
}

/** Desenha um bonequinho de linhas de texto ('.' = vazio; cada letra é uma cor do mapa). */
function boneco(g: CanvasRenderingContext2D, linhas: string[], x: number, y: number, cores: Record<string, string>, espelho = false) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  linhas.forEach((l, r) => {
    for (let c = 0; c < l.length; c++) {
      const cor = cores[l[c]];
      if (!cor) continue;
      g.fillStyle = cor;
      g.fillRect(x0 + (espelho ? l.length - 1 - c : c), y0 + r, 1, 1);
    }
  });
}

const CORES_AGENTE = { h: COR.cabelo, s: COR.pele, b: COR.terno, w: COR.branco, r: COR.vermelho };
/** O agente de terno, de frente (7 × 9), com as duas pernas de andar. */
const AGENTE = ['..hhh..', '.hsss..', '..sss..', '.bbwbb.', 'bbbrbbb', 'b.bbb.b', '..bbb..'];
const PERNAS = [
  ['..b.b..', '..b.b..'],
  ['.b...b.', '.b...b.'],
];
/** O agente de lado, pulando (8 × 10): braços para cima subindo, para baixo caindo. */
const PULANDO = ['...hhh..', '..hssss.', '...sss..', '..bbwb..', '.bbbrbb.', '.bbbbbb.', '..bbbb..', '..bbbb..', '..b..b..', '.bb..bb.'];
const SUBINDO = ['b..hhh.b', 'b.hssssb', '.b.sss.b', '..bbwbb.', '..bbrb..', '..bbbb..', '..bbbb..', '..bbbb..', '..b..b..', '..b..b..'];

const aleat = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- PONG

export class Pong implements Jogo {
  pontos = 0;
  fim = false;
  private deles = 0;
  private readonly topo = 24;
  private readonly base = H - 6;
  private readonly RH = 18;
  private readonly RW = 3;
  private readonly xEles = 10;
  private readonly xEu = W - 13;
  private eu = (24 + H - 6) / 2 - 9;
  private eles = (24 + H - 6) / 2 - 9;
  private alvoEles = this.eles;
  private bola = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  private espera = 70;
  private saqueParaMim = Math.random() < 0.5;
  private q = 0;

  passo(e: Entrada) {
    if (this.fim) return;
    this.q++;
    // a sua raquete: as setas, ou segue o dedo
    if (e.dedo) {
      const alvo = e.dedo.y - this.RH / 2;
      this.eu += Math.max(-4.5, Math.min(4.5, alvo - this.eu));
    } else if (e.segura.has('cima')) this.eu -= 2.6;
    else if (e.segura.has('baixo')) this.eu += 2.6;
    this.eu = Math.max(this.topo, Math.min(this.base - this.RH, this.eu));
    // a máquina: olha a bola de tempos em tempos, erra um pouco e fica mais esperta quando você pontua
    const b = this.bola;
    if (this.q % 7 === 0) this.alvoEles = b.vx < 0 ? b.y - this.RH / 2 + aleat(-7, 7) : (this.topo + this.base) / 2 - this.RH / 2;
    const vel = 1.35 + this.pontos * 0.12;
    this.eles += Math.max(-vel, Math.min(vel, this.alvoEles - this.eles));
    this.eles = Math.max(this.topo, Math.min(this.base - this.RH, this.eles));

    if (this.espera > 0) {
      b.x = W / 2 - 1;
      b.y = (this.topo + this.base) / 2;
      if (--this.espera === 0) {
        b.vx = this.saqueParaMim ? 1.4 : -1.4;
        b.vy = aleat(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1);
      }
      return;
    }
    b.x += b.vx;
    b.y += b.vy;
    if (b.y < this.topo) (b.y = this.topo), (b.vy = Math.abs(b.vy)), sfx.chip(330, 330, 0.035);
    if (b.y > this.base - 3) (b.y = this.base - 3), (b.vy = -Math.abs(b.vy)), sfx.chip(330, 330, 0.035);
    const bate = (x: number, y: number) => b.x + 3 >= x && b.x <= x + this.RW && b.y + 3 >= y && b.y <= y + this.RH;
    const rebate = (y: number, lado: number) => {
      const rel = (b.y + 1.5 - (y + this.RH / 2)) / (this.RH / 2);
      const v = Math.min(3.3, Math.abs(b.vx) + 0.12);
      b.vx = v * lado;
      b.vy = Math.max(-2.4, Math.min(2.4, rel * 2.3));
      sfx.chip(lado < 0 ? 523 : 440, lado < 0 ? 523 : 440, 0.05);
    };
    if (b.vx > 0 && bate(this.xEu, this.eu)) (b.x = this.xEu - 3), rebate(this.eu, -1);
    if (b.vx < 0 && bate(this.xEles, this.eles)) (b.x = this.xEles + this.RW), rebate(this.eles, 1);
    if (b.x < -6 || b.x > W + 6) {
      const meu = b.x < 0;
      if (meu) this.pontos++;
      else this.deles++;
      this.saqueParaMim = !meu;
      this.espera = 55;
      sfx.chip(meu ? 660 : 180, meu ? 990 : 90, 0.22);
      if (this.pontos >= 7 || this.deles >= 7) this.fim = true;
    }
  }

  desenhar(g: CanvasRenderingContext2D, quadro: number) {
    g.fillStyle = COR.preto;
    g.fillRect(0, 0, W, H);
    g.fillStyle = COR.claro;
    g.fillRect(0, this.topo - 3, W, 2);
    g.fillRect(0, this.base + 1, W, 2);
    g.fillStyle = COR.escuro;
    for (let y = this.topo; y < this.base; y += 8) g.fillRect(W / 2 - 1, y, 2, 4);
    texto(g, String(this.deles), W / 2 - 20, 4, COR.laranja, 3, 'meio');
    texto(g, String(this.pontos), W / 2 + 20, 4, COR.verde, 3, 'meio');
    g.fillStyle = COR.laranja;
    g.fillRect(this.xEles, Math.round(this.eles), this.RW, this.RH);
    g.fillStyle = COR.verde;
    g.fillRect(this.xEu, Math.round(this.eu), this.RW, this.RH);
    // a bola pisca antes do saque
    if (this.espera === 0 || (quadro >> 3) % 2 === 0) {
      g.fillStyle = COR.branco;
      g.fillRect(Math.round(this.bola.x), Math.round(this.bola.y), 3, 3);
    }
  }

  resumo() {
    return this.pontos > this.deles ? `VOCE VENCEU ${this.pontos} A ${this.deles}` : `A MAQUINA VENCEU ${this.deles} A ${this.pontos}`;
  }
}

// ---------------------------------------------------------------- ATRAVESSA

interface Carro {
  x: number;
  w: number;
  cor: string;
}

const CORES_CARRO = [COR.vermelho, COR.amarelo, COR.azulClaro, COR.rosa, COR.laranja, COR.verde, COR.roxo, COR.branco];
const FAIXA_H = 15;
const FAIXA_0 = 163;
const VOLTA = W + 48;

export class Atravessa implements Jogo {
  pontos = 0;
  fim = false;
  private readonly total = 90 * 60;
  private tempo = this.total;
  private x = W / 2 - 4;
  private y = 186;
  private passos = 0;
  private atropelado = 0;
  private faixas: { y: number; vel: number; dir: number; carros: Carro[] }[] = [];

  constructor() {
    const vels = [0.55, 0.8, 1.1, 1.45, 1.9, 2.1, 1.6, 1.25, 0.9, 0.6];
    for (let i = 0; i < 10; i++) {
      const n = i % 3 === 0 ? 2 : 3;
      const caminhao = i === 2 || i === 7;
      const carros: Carro[] = [];
      for (let k = 0; k < n; k++) carros.push({ x: -24 + (k * VOLTA) / n + aleat(0, 16), w: caminhao && k === 0 ? 22 : 12, cor: CORES_CARRO[(i * 3 + k) % CORES_CARRO.length] });
      this.faixas.push({ y: FAIXA_0 - i * FAIXA_H, vel: vels[i], dir: i < 5 ? 1 : -1, carros });
    }
  }

  passo(e: Entrada) {
    if (this.fim) return;
    if (--this.tempo <= 0) {
      this.fim = true;
      return;
    }
    if (this.tempo === 600) sfx.arpejo([880, 660], 0.12);
    // o trânsito aperta com o tempo
    const pressa = 1 + 0.5 * (1 - this.tempo / this.total);
    for (const f of this.faixas)
      for (const c of f.carros) {
        c.x += f.vel * f.dir * pressa;
        if (f.dir > 0 && c.x > W + 24) c.x -= VOLTA;
        if (f.dir < 0 && c.x < -24) c.x += VOLTA;
      }
    if (this.atropelado > 0) {
      this.atropelado--;
      this.y = Math.min(186, this.y + 1.1);
      return;
    }
    const sobe = e.segura.has('cima') || e.segura.has('a') || !!e.dedo;
    const desce = e.segura.has('baixo');
    if (sobe) (this.y -= 0.85), this.passos++;
    else if (desce && this.y < 186) (this.y = Math.min(186, this.y + 0.85)), this.passos++;
    if (this.y <= 20) {
      this.pontos++;
      this.y = 186;
      sfx.arpejo([523, 659, 784, 1046], 0.06);
      return;
    }
    // o carro: o agente ocupa x..x+7 e y-9..y
    for (const f of this.faixas) {
      if (this.y - 8 > f.y + 12 || this.y < f.y + 4) continue;
      for (const c of f.carros)
        if (this.x + 6 > c.x && this.x + 1 < c.x + c.w) {
          this.atropelado = 18;
          sfx.chip(320, 70, 0.3, 0.1);
          return;
        }
    }
  }

  desenhar(g: CanvasRenderingContext2D, quadro: number) {
    // a calçada de cima e a de baixo, a avenida entre elas
    g.fillStyle = COR.preto;
    g.fillRect(0, 0, W, 16);
    g.fillStyle = COR.claro;
    g.fillRect(0, 16, W, FAIXA_0 - 9 * FAIXA_H - 16);
    g.fillRect(0, FAIXA_0 + FAIXA_H, W, H - FAIXA_0 - FAIXA_H);
    g.fillStyle = COR.cinza;
    for (let x = 0; x < W; x += 8) g.fillRect(x, 16, 1, FAIXA_0 - 9 * FAIXA_H - 16), g.fillRect(x + 4, FAIXA_0 + FAIXA_H, 1, H - FAIXA_0 - FAIXA_H);
    g.fillStyle = COR.medio;
    g.fillRect(0, FAIXA_0 - 9 * FAIXA_H, W, 10 * FAIXA_H);
    for (let i = 1; i < 10; i++) {
      const y = FAIXA_0 - (i - 1) * FAIXA_H;
      if (i === 5) {
        g.fillStyle = COR.amarelo;
        g.fillRect(0, y - 1, W, 1);
        g.fillRect(0, y + 1, W, 1);
        continue;
      }
      g.fillStyle = COR.claro;
      for (let x = 0; x < W; x += 12) g.fillRect(x, y, 6, 1);
    }
    for (const f of this.faixas) for (const c of f.carros) this.carro(g, c, f.y, f.dir);
    // o agente (pisca quando o carro pega)
    if (this.atropelado === 0 || (quadro >> 2) % 2 === 0) {
      const p = PERNAS[(this.passos >> 3) % 2];
      boneco(g, [...AGENTE, ...p], this.x, this.y - 9, CORES_AGENTE);
    }
    // o placar e o relógio
    texto(g, String(this.pontos), 6, 3, COR.amarelo, 2);
    const s = Math.ceil(this.tempo / 60);
    const pouco = s <= 10;
    if (!pouco || (quadro >> 4) % 2 === 0) texto(g, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, W - 6, 3, pouco ? COR.vermelho : COR.branco, 2, 'dir');
  }

  private carro(g: CanvasRenderingContext2D, c: Carro, y: number, dir: number) {
    const x = Math.round(c.x);
    const frente = dir > 0 ? x + c.w - 4 : x;
    g.fillStyle = COR.preto;
    g.fillRect(x + 1, y + 3, 3, 2);
    g.fillRect(x + c.w - 4, y + 3, 3, 2);
    g.fillRect(x + 1, y + 11, 3, 2);
    g.fillRect(x + c.w - 4, y + 11, 3, 2);
    g.fillStyle = c.cor;
    g.fillRect(x, y + 4, c.w, 8);
    if (c.w > 12) {
      // o caminhão: a cabine na frente, o baú atrás
      g.fillStyle = COR.branco;
      g.fillRect(dir > 0 ? x : x + 6, y + 4, c.w - 6, 8);
      g.fillStyle = COR.claro;
      g.fillRect(dir > 0 ? x : x + 6, y + 11, c.w - 6, 1);
      g.fillStyle = COR.azulClaro;
      g.fillRect(frente, y + 6, 4, 4);
      return;
    }
    g.fillStyle = COR.azulClaro;
    g.fillRect(frente, y + 6, 4, 4);
    g.fillStyle = COR.preto;
    g.fillRect(x + 4, y + 7, c.w - 8, 2);
  }

  resumo() {
    return this.pontos ? 'O TEMPO ACABOU' : 'NENHUMA TRAVESSIA';
  }
}

// ---------------------------------------------------------------- PULA-PULA

interface Plataforma {
  x: number;
  y: number;
  w: number;
  tipo: 'firme' | 'anda' | 'quebra';
  vx: number;
  mola: boolean;
  quebrada: boolean;
}

/** O céu escurece conforme sobe: do azul ao preto das estrelas. */
const CEU = ['#2c3c9c', '#34308c', '#2c1c64', '#180c34', '#000000'];

export class PulaPula implements Jogo {
  pontos = 0;
  fim = false;
  private x = W / 2;
  private y = 168;
  private vx = 0;
  private vy = -4.6;
  private lado = 1;
  private camY = 0;
  private alto = 168;
  private plats: Plataforma[] = [];
  private proxY = 176;
  private estrelas = Array.from({ length: 34 }, () => ({ x: Math.floor(aleat(0, W)), y: aleat(0, H), cor: Math.random() < 0.3 ? COR.amarelo : COR.claro }));

  constructor() {
    this.plats.push({ x: W / 2 - 14, y: 176, w: 28, tipo: 'firme', vx: 0, mola: false, quebrada: false });
    this.gerar();
  }

  /** Mais alto, mais difícil: de 0 a 1. */
  private dificuldade() {
    return Math.min(1, (168 - this.alto) / 5000);
  }

  private gerar() {
    while (this.proxY > this.camY - 40) {
      const d = this.dificuldade();
      // o pulo alcança 66 pixels; o vão maior fica em 54
      const vao = aleat(16, 26 + d * 28);
      this.proxY -= vao;
      const anda = Math.random() < 0.08 + d * 0.32;
      const w = Math.round(22 - d * 4);
      this.plats.push({ x: aleat(0, W - w), y: this.proxY, w, tipo: anda ? 'anda' : 'firme', vx: anda ? aleat(0.5, 0.9 + d) * (Math.random() < 0.5 ? -1 : 1) : 0, mola: !anda && Math.random() < 0.06, quebrada: false });
      // a que quebra é de enfeite: nunca é o único caminho
      if (Math.random() < 0.1 + d * 0.2) this.plats.push({ x: aleat(0, W - w), y: this.proxY + vao / 2, w, tipo: 'quebra', vx: 0, mola: false, quebrada: false });
    }
  }

  passo(e: Entrada) {
    if (this.fim) return;
    const esq = e.segura.has('esq') || (!!e.dedo && e.dedo.x < W / 2);
    const dir = e.segura.has('dir') || (!!e.dedo && e.dedo.x >= W / 2);
    if (esq && !dir) (this.vx = Math.max(-2.1, this.vx - 0.3)), (this.lado = -1);
    else if (dir && !esq) (this.vx = Math.min(2.1, this.vx + 0.3)), (this.lado = 1);
    else this.vx *= 0.82;
    this.x += this.vx;
    if (this.x < -4) this.x = W + 4;
    if (this.x > W + 4) this.x = -4;
    const antes = this.y;
    this.vy = Math.min(5, this.vy + 0.16);
    this.y += this.vy;
    for (const p of this.plats) {
      if (p.tipo === 'anda') {
        p.x += p.vx;
        if (p.x < 0 || p.x > W - p.w) p.vx = -p.vx;
      }
      if (p.quebrada) p.y += 2.2;
    }
    if (this.vy > 0)
      for (const p of this.plats) {
        if (p.quebrada || antes > p.y || this.y < p.y || this.x + 3 < p.x || this.x - 3 > p.x + p.w) continue;
        if (p.tipo === 'quebra') {
          p.quebrada = true;
          sfx.chip(160, 60, 0.12);
          continue;
        }
        this.y = p.y;
        const mola = p.mola && Math.abs(this.x - (p.x + p.w / 2)) < 5;
        this.vy = mola ? -7.6 : -4.6;
        if (mola) sfx.chip(300, 1300, 0.22);
        else sfx.chip(260, 620, 0.08, 0.06);
        break;
      }
    this.alto = Math.min(this.alto, this.y);
    this.pontos = Math.floor((168 - this.alto) / 3);
    if (this.y - this.camY < 72) this.camY = this.y - 72;
    this.gerar();
    this.plats = this.plats.filter((p) => p.y - this.camY < H + 24);
    if (this.y - this.camY > H + 12) {
      this.fim = true;
      sfx.chip(700, 70, 0.7, 0.08);
    }
  }

  desenhar(g: CanvasRenderingContext2D, quadro: number) {
    const faixa = Math.min(CEU.length - 1, Math.floor((168 - this.alto) / 700));
    g.fillStyle = CEU[faixa];
    g.fillRect(0, 0, W, H);
    if (faixa >= 2)
      for (const s of this.estrelas) {
        const y = (((s.y - this.camY * 0.25) % H) + H) % H;
        if ((quadro + s.x) % 90 < 84) {
          g.fillStyle = s.cor;
          g.fillRect(s.x, Math.floor(y), 1, 1);
        }
      }
    for (const p of this.plats) {
      const x = Math.round(p.x);
      const y = Math.round(p.y - this.camY);
      if (p.tipo === 'quebra') {
        g.fillStyle = COR.marrom;
        if (p.quebrada) {
          g.fillRect(x, y + 1, p.w / 2 - 1, 3);
          g.fillRect(x + p.w / 2 + 1, y + 2, p.w / 2 - 1, 3);
        } else {
          g.fillRect(x, y, p.w, 4);
          g.fillStyle = COR.marromEscuro;
          g.fillRect(x + 6, y + 1, 1, 2);
          g.fillRect(x + 7, y + 2, 1, 2);
          g.fillRect(x + p.w - 7, y, 1, 2);
        }
        continue;
      }
      g.fillStyle = p.tipo === 'anda' ? COR.azul : COR.verde;
      g.fillRect(x, y, p.w, 4);
      g.fillStyle = p.tipo === 'anda' ? COR.azulClaro : COR.verdeClaro;
      g.fillRect(x, y, p.w, 1);
      if (p.mola) {
        const mx = x + Math.floor(p.w / 2) - 2;
        g.fillStyle = COR.claro;
        g.fillRect(mx + 1, y - 3, 3, 1);
        g.fillRect(mx, y - 2, 3, 1);
        g.fillRect(mx + 1, y - 1, 3, 1);
        g.fillStyle = COR.vermelho;
        g.fillRect(mx - 1, y - 5, 6, 2);
      }
    }
    boneco(g, this.vy < 0 ? SUBINDO : PULANDO, this.x - 4, this.y - this.camY - 10, CORES_AGENTE, this.lado < 0);
    texto(g, String(this.pontos), 5, 4, COR.branco, 2);
  }

  resumo() {
    return 'CAIU LA DE CIMA';
  }
}

export const JOGOS = [
  { id: 'pong', nome: 'PONG', dica: 'PRIMEIRO A 7 VENCE', toque: 'O DEDO NA TELA MOVE A RAQUETE', recorde: false, novo: () => new Pong() },
  { id: 'atravessa', nome: 'ATRAVESSA', dica: '90 SEGUNDOS NA AVENIDA', toque: 'SEGURE A TELA PARA ANDAR', recorde: true, novo: () => new Atravessa() },
  { id: 'pula', nome: 'PULA-PULA', dica: 'SOBE SEM CAIR', toque: 'TOQUE NA ESQUERDA OU NA DIREITA', recorde: true, novo: () => new PulaPula() },
] as const;
