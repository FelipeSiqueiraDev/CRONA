/**
 * Os joguinhos do fliperama (08/10), no jeito do Atari: tela de 160 × 192 pixels, cores chapadas,
 * letra de 3 × 5 e bipes de onda quadrada. Tudo desenhado por código, sem arte.
 *
 * - PONG (1972): a raquete da direita é a sua, a da esquerda é a máquina; quem fizer 7 vence.
 * - ATRAVESSA (o Freeway, 1981): o agente atravessa as dez faixas da avenida; 90 segundos, cada
 *   travessia é um ponto, e o carro empurra de volta.
 * - PULA-PULA: o agente pula sozinho de plataforma em plataforma, subindo; a verde é firme, a azul
 *   anda, a marrom quebra, a mola joga longe. Caiu, acabou.
 *
 * Em DUPLA (dois agentes na mesma máquina, cada um no seu celular): o PONG é um contra o outro (o
 * celular de quem convidou faz as contas e manda a bola; o outro manda a raquete); no ATRAVESSA os
 * dois agentes correm lado a lado na mesma avenida (o trânsito sai da mesma semente); no PULA-PULA
 * cada um sobe as mesmas plataformas e vence quem for mais alto.
 */
import { bar } from '@crona/shared';
import { sfx } from './sfx';

/** Jogando em dupla: a semente da partida, o lado (0 = quem convidou) e o nome do outro. */
export interface Dupla {
  semente: number;
  lado: number;
  outro: string;
}

/** O primeiro nome, curto, para o placar ("CATARINA"). */
export const curto = (nome: string) => semAcento(nome.split(/\s+/)[0] ?? nome).replace(/[^A-Z0-9.-]/g, '').slice(0, 8);

export const W = 160;
export const H = 192;

export type Botao = 'cima' | 'baixo' | 'esq' | 'dir' | 'a';
/** A dificuldade (09/10): 0 fácil, 1 normal, 2 difícil. */
export type Nivel = 0 | 1 | 2;

/** O que o jogador fez neste passo: o que está segurando, o que acabou de apertar e o dedo na tela. */
export interface Entrada {
  segura: Set<Botao>;
  apertou: Set<Botao>;
  /** o dedo na tela, em pixels do jogo (null = sem dedo) */
  dedo: { x: number; y: number } | null;
  /** o dedo acabou de encostar */
  tocou: boolean;
  /**
   * Para onde e com que força (de -1 a 1 em cada eixo, já com a sensibilidade): a alavanca é analógica (pouca inclinação,
   * pouca velocidade); no teclado, o máximo da sensibilidade. É o que move o agente e a raquete.
   */
  eixo: { x: number; y: number };
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
/** O outro agente, em dupla: de terno vinho e gravata amarela. */
const CORES_OUTRO = { h: '#1a1412', s: '#f3d2b3', b: '#6a1e2e', w: COR.branco, r: COR.amarelo };
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

// ---------------------------------------------------------------- os efeitos (o "suco" dos jogos)

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  cor: string;
  peso: number;
}

/**
 * Faíscas, poeira, confete, o textinho que sobe ("+1"), o tremor da tela e o clarão. Os jogos chamam
 * (`fx.faiscas(...)`) e o gabinete desenha por cima do jogo e treme a tela inteira.
 */
export class Efeitos {
  private particulas: Particula[] = [];
  private textos: { x: number; y: number; t: string; vida: number; cor: string }[] = [];
  tremor = 0;
  private clarao = 0;
  private corClarao = COR.branco;

  /** Pedacinhos saindo de (x, y) para todo lado; `peso` puxa para baixo (poeira, cacos). */
  faiscas(x: number, y: number, cor: string | string[], n = 8, vel = 1.4, peso = 0.04, vida = 26) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = vel * (0.4 + Math.random() * 0.8);
      const c = Array.isArray(cor) ? cor[i % cor.length] : cor;
      const max = vida * (0.6 + Math.random() * 0.6);
      this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: max, max, cor: c, peso });
    }
  }

  texto(x: number, y: number, t: string, cor: string = COR.amarelo) {
    this.textos.push({ x, y, t, vida: 50, cor });
  }

  tremer(n: number) {
    this.tremor = Math.max(this.tremor, n);
  }

  piscar(cor: string, n = 6) {
    this.corClarao = cor;
    this.clarao = n;
  }

  limpar() {
    this.particulas = [];
    this.textos = [];
    this.tremor = 0;
    this.clarao = 0;
  }

  passo() {
    for (const p of this.particulas) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.peso;
      p.vx *= 0.97;
      p.vida--;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);
    for (const t of this.textos) (t.y -= 0.4), t.vida--;
    this.textos = this.textos.filter((t) => t.vida > 0);
    this.tremor = this.tremor < 0.2 ? 0 : this.tremor * 0.86;
    if (this.clarao > 0) this.clarao--;
  }

  desenhar(g: CanvasRenderingContext2D) {
    for (const p of this.particulas) {
      // nasce de 2 pixels e vira 1; pisca no fim
      if (p.vida < 6 && p.vida % 2) continue;
      const tam = p.vida > p.max * 0.6 ? 2 : 1;
      g.fillStyle = p.cor;
      g.fillRect(Math.round(p.x), Math.round(p.y), tam, tam);
    }
    for (const t of this.textos) if (t.vida > 10 || t.vida % 2) texto(g, t.t, t.x, t.y, t.cor, 1, 'meio');
    if (this.clarao > 0) {
      g.globalAlpha = this.clarao / 16;
      g.fillStyle = this.corClarao;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }
}

export const fx = new Efeitos();
const CONFETE = [COR.vermelho, COR.amarelo, COR.verde, COR.azulClaro, COR.rosa, COR.ouro];

// ---------------------------------------------------------------- PONG

export class Pong implements Jogo {
  pontos = 0;
  fim = false;
  deles = 0;
  /** em dupla, quem convidou: onde o outro quer a raquete dele (a da esquerda) */
  remoto: number | null = null;
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

  /**
   * `papel`: sem dupla, contra a máquina; 'dono' (quem convidou) faz as contas, com a raquete do outro
   * vindo de `remoto`; 'convidado' só mexe a própria raquete e desenha o que o dono manda (`aplicar`),
   * do ponto de vista dele (a raquete dele também à direita).
   */
  constructor(
    private papel: 'sozinho' | 'dono' | 'convidado' = 'sozinho',
    private nivel: Nivel = 1,
  ) {}

  /** A raquete de quem joga deste celular (o convidado manda essa para o dono). */
  get minhaRaquete() {
    return this.eu;
  }

  passo(e: Entrada) {
    if (this.fim) return;
    this.q++;
    // a sua raquete: as setas, ou segue o dedo
    if (e.dedo) {
      const alvo = e.dedo.y - this.RH / 2;
      this.eu += Math.max(-4.5, Math.min(4.5, alvo - this.eu));
    } else this.eu += 2.8 * e.eixo.y;
    this.eu = Math.max(this.topo, Math.min(this.base - this.RH, this.eu));
    const b = this.bola;
    if (this.papel === 'convidado') {
      // entre um recado e outro do dono, a bola segue andando
      if (this.espera === 0) (b.x += b.vx), (b.y += b.vy);
      return;
    }
    if (this.papel === 'dono') {
      if (this.remoto !== null) this.eles += Math.max(-4.5, Math.min(4.5, this.remoto - this.eles));
    } else {
      // a máquina: olha a bola de tempos em tempos, erra um pouco e fica mais esperta quando você pontua
      if (this.q % 7 === 0) this.alvoEles = b.vx < 0 ? b.y - this.RH / 2 + aleat(-7, 7) : (this.topo + this.base) / 2 - this.RH / 2;
      const vel = [1.0, 1.35, 1.8][this.nivel] + this.pontos * 0.12;
      this.eles += Math.max(-vel, Math.min(vel, this.alvoEles - this.eles));
    }
    this.eles = Math.max(this.topo, Math.min(this.base - this.RH, this.eles));

    if (this.espera > 0) {
      b.x = W / 2 - 1;
      b.y = (this.topo + this.base) / 2;
      if (--this.espera === 0) {
        const saque = [1.15, 1.4, 1.7][this.nivel];
        b.vx = this.saqueParaMim ? saque : -saque;
        b.vy = aleat(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1);
      }
      return;
    }
    b.x += b.vx;
    b.y += b.vy;
    if (b.y < this.topo) (b.y = this.topo), (b.vy = Math.abs(b.vy)), sfx.chip(330, 330, 0.035), fx.faiscas(b.x + 1, b.y, COR.claro, 3, 0.7, 0.02, 12);
    if (b.y > this.base - 3) (b.y = this.base - 3), (b.vy = -Math.abs(b.vy)), sfx.chip(330, 330, 0.035), fx.faiscas(b.x + 1, b.y + 3, COR.claro, 3, 0.7, -0.02, 12);
    const bate = (x: number, y: number) => b.x + 3 >= x && b.x <= x + this.RW && b.y + 3 >= y && b.y <= y + this.RH;
    const rebate = (y: number, lado: number) => {
      const rel = (b.y + 1.5 - (y + this.RH / 2)) / (this.RH / 2);
      const v = Math.min([2.7, 3.3, 3.9][this.nivel], Math.abs(b.vx) + 0.12);
      b.vx = v * lado;
      b.vy = Math.max(-2.4, Math.min(2.4, rel * 2.3));
      sfx.chip(lado < 0 ? 523 : 440, lado < 0 ? 523 : 440, 0.05);
      // a raquete solta faíscas da cor dela, mais quanto mais rápida a bola
      fx.faiscas(b.x + 1, b.y + 1, lado < 0 ? COR.verde : COR.laranja, 4 + Math.round(v * 2), 0.8 + v * 0.4, 0, 18);
      if (v > 2.6) fx.tremer(1.5);
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
      sfx.ruido(0.25, meu ? 2400 : 500, 0.12, meu ? 4000 : 200);
      fx.tremer(4);
      fx.piscar(meu ? COR.verde : COR.laranja, 7);
      fx.faiscas(meu ? 4 : W - 4, Math.max(this.topo, Math.min(this.base, b.y)), meu ? CONFETE : COR.laranja, 18, 2.2, 0.03, 34);
      if (this.pontos >= 7 || this.deles >= 7) this.fim = true;
    }
  }

  /** O que o dono manda ao convidado (a cada dois quadros). */
  estado(): number[] {
    const b = this.bola;
    const r = (n: number) => Math.round(n * 100) / 100;
    return [r(b.x), r(b.y), r(b.vx), r(b.vy), r(this.eu), this.pontos, this.deles, this.espera, this.fim ? 1 : 0];
  }

  /** O convidado recebe o estado do dono e vira para o lado dele (espelhado: ele também fica à direita). */
  aplicar(s: unknown) {
    if (!Array.isArray(s) || s.length < 9 || !s.every((n) => typeof n === 'number')) return;
    const [bx, by, vx, vy, raqueteDono, pontosDono, pontosMeus, espera, fim] = s as number[];
    const b = this.bola;
    b.x = W - bx - 3;
    b.y = by;
    b.vx = -vx;
    b.vy = vy;
    this.eles = raqueteDono;
    if (pontosMeus > this.pontos) sfx.chip(660, 990, 0.22), fx.tremer(4), fx.piscar(COR.verde, 7), fx.faiscas(4, b.y, CONFETE, 18, 2.2, 0.03, 34);
    if (pontosDono > this.deles) sfx.chip(180, 90, 0.22), fx.tremer(4), fx.piscar(COR.laranja, 7);
    this.pontos = pontosMeus;
    this.deles = pontosDono;
    this.espera = espera;
    this.fim = fim === 1;
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
    if (this.papel !== 'sozinho') return `${this.pontos} A ${this.deles}`;
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
  /** em dupla: o outro agente (a altura e os pontos que o celular dele manda) */
  outro: { y: number; p: number; passos: number } | null = null;
  private xOutro = 0;

  constructor(
    private dupla?: Dupla,
    nivel: Nivel = 1,
  ) {
    const rnd = bar.sorteio(dupla?.semente ?? bar.novaSemente());
    const aleat = (a: number, b: number) => a + rnd() * (b - a);
    if (dupla) {
      // como no Freeway: o de quem convidou à esquerda, o outro à direita
      this.x = dupla.lado === 0 ? 44 : 108;
      this.xOutro = dupla.lado === 0 ? 108 : 44;
      this.outro = { y: 186, p: 0, passos: 0 };
    }
    // o nível: menos carros e mais devagar (fácil), ou mais cheio e mais rápido (difícil)
    const ritmo = [0.72, 1, 1.3][nivel];
    const vels = [0.55, 0.8, 1.1, 1.45, 1.9, 2.1, 1.6, 1.25, 0.9, 0.6].map((v) => v * ritmo);
    const quantos = [
      [1, 2],
      [2, 3],
      [3, 4],
    ][nivel];
    for (let i = 0; i < 10; i++) {
      const n = quantos[i % 3 === 0 ? 0 : 1];
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
    if (this.tempo === 600) sfx.arpejo([880, 660], 0.12), fx.texto(W / 2, 30, '10 SEGUNDOS!', COR.vermelho);
    if (this.tempo < 600 && this.tempo % 60 === 0) sfx.chip(1200, 1200, 0.03, 0.05);
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
    // a força da alavanca dá o passo (o A e o dedo andam no máximo)
    const forte = e.segura.has('a') || !!e.dedo;
    const sobe = forte ? 1 : Math.max(0, -e.eixo.y);
    const desce = forte ? 0 : Math.max(0, e.eixo.y);
    if (sobe > 0.02) (this.y -= 0.85 * sobe), this.passos++;
    else if (desce > 0.02 && this.y < 186) (this.y = Math.min(186, this.y + 0.85 * desce)), this.passos++;
    if (this.y <= 20) {
      this.pontos++;
      fx.faiscas(this.x + 3, 18, CONFETE, 22, 2, 0.06, 40);
      fx.texto(this.x + 3, 10, '+1', COR.amarelo);
      fx.piscar(COR.amarelo, 4);
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
          sfx.ruido(0.2, 900, 0.15, 200);
          fx.tremer(5);
          fx.faiscas(this.x + 3, this.y - 5, [c.cor, COR.branco, COR.amarelo], 14, 1.8, 0.05, 24);
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
    // o outro agente (em dupla), de terno vinho
    if (this.outro) boneco(g, [...AGENTE, ...PERNAS[(this.outro.passos >> 3) % 2]], this.xOutro, this.outro.y - 9, CORES_OUTRO);
    // o agente (pisca quando o carro pega)
    if (this.atropelado === 0 || (quadro >> 2) % 2 === 0) {
      const p = PERNAS[(this.passos >> 3) % 2];
      boneco(g, [...AGENTE, ...p], this.x, this.y - 9, CORES_AGENTE);
    }
    // o placar e o relógio
    const s = Math.ceil(this.tempo / 60);
    const pouco = s <= 10;
    const relogio = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (this.dupla && this.outro) {
      const esq = this.dupla.lado === 0;
      texto(g, String(this.pontos), esq ? 6 : W - 6, 3, COR.amarelo, 2, esq ? 'esq' : 'dir');
      texto(g, String(this.outro.p), esq ? W - 6 : 6, 3, COR.rosa, 2, esq ? 'dir' : 'esq');
      if (!pouco || (quadro >> 4) % 2 === 0) texto(g, relogio, W / 2, 3, pouco ? COR.vermelho : COR.branco, 2, 'meio');
      return;
    }
    texto(g, String(this.pontos), 6, 3, COR.amarelo, 2);
    if (!pouco || (quadro >> 4) % 2 === 0) texto(g, relogio, W - 6, 3, pouco ? COR.vermelho : COR.branco, 2, 'dir');
  }

  /** O que vai para o celular do outro (em dupla). */
  posicao() {
    return { y: Math.round(this.y * 10) / 10, p: this.pontos, passos: this.passos };
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
    if (this.outro) return `${this.pontos} A ${this.outro.p}`;
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
  /** no DIFÍCIL (09/10): quantos pulos ela ainda aguenta (racha a cada um e quebra no último); sem limite, null */
  pulos: number | null;
}

/** Quantos pulos cada plataforma aguenta, por nível: só o difícil tem limite. */
const PULOS_POR_NIVEL: (number | null)[] = [null, null, 3];

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
  private rnd: () => number;
  private estrelas: { x: number; y: number; cor: string }[];
  /** em dupla: os pontos do outro e se ele ainda está pulando */
  outro: { p: number; vivo: boolean } | null = null;

  constructor(
    private dupla?: Dupla,
    private nivel: Nivel = 1,
  ) {
    this.rnd = bar.sorteio(dupla?.semente ?? bar.novaSemente());
    this.estrelas = Array.from({ length: 34 }, () => ({ x: Math.floor(this.al(0, W)), y: this.al(0, H), cor: this.rnd() < 0.3 ? COR.amarelo : COR.claro }));
    if (dupla) this.outro = { p: 0, vivo: true };
    this.plats.push({ x: W / 2 - 14, y: 176, w: 28, tipo: 'firme', vx: 0, mola: false, quebrada: false, pulos: PULOS_POR_NIVEL[this.nivel] });
    this.gerar();
  }

  private al(a: number, b: number) {
    return a + this.rnd() * (b - a);
  }

  /** Mais alto, mais difícil: de 0 a 1. */
  private dificuldade() {
    const subida = (168 - this.alto) / 5000;
    return Math.min(1, [subida * 0.6, subida, 0.15 + subida * 1.3][this.nivel]);
  }

  private gerar() {
    while (this.proxY > this.camY - 40) {
      const d = this.dificuldade();
      // o pulo alcança 66 pixels; o vão maior fica em 54
      const vao = this.al(16, 26 + d * 28);
      this.proxY -= vao;
      const anda = this.rnd() < 0.08 + d * 0.32;
      const w = Math.round(22 - d * 4) + [4, 0, -3][this.nivel];
      this.plats.push({ x: this.al(0, W - w), y: this.proxY, w, tipo: anda ? 'anda' : 'firme', vx: anda ? this.al(0.5, 0.9 + d) * (this.rnd() < 0.5 ? -1 : 1) : 0, mola: !anda && this.rnd() < 0.06, quebrada: false, pulos: PULOS_POR_NIVEL[this.nivel] });
      // a que quebra é de enfeite: nunca é o único caminho
      if (this.rnd() < 0.1 + d * 0.2) this.plats.push({ x: this.al(0, W - w), y: this.proxY + vao / 2, w, tipo: 'quebra', vx: 0, mola: false, quebrada: false, pulos: null });
    }
  }

  passo(e: Entrada) {
    if (this.fim) return;
    // a força da alavanca dá a velocidade (o dedo, numa metade da tela, vai no máximo)
    const forca = e.dedo ? (e.dedo.x < W / 2 ? -1 : 1) : e.eixo.x;
    if (Math.abs(forca) > 0.02) {
      const alvo = 2.1 * forca;
      this.vx += Math.max(-0.3, Math.min(0.3, alvo - this.vx));
      this.lado = forca < 0 ? -1 : 1;
    } else this.vx *= 0.82;
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
          sfx.ruido(0.12, 600, 0.1);
          fx.faiscas(p.x + p.w / 2, p.y - this.camY + 1, [COR.marrom, COR.marromEscuro], 10, 1.2, 0.12, 28);
          continue;
        }
        this.y = p.y;
        // no difícil, cada pulo racha a plataforma; no último ela quebra e cai (o pulo ainda vale)
        if (p.pulos !== null) {
          p.pulos--;
          if (p.pulos <= 0) {
            p.quebrada = true;
            sfx.chip(220, 50, 0.18);
            sfx.ruido(0.16, 700, 0.12);
            fx.faiscas(p.x + p.w / 2, p.y - this.camY + 1, [p.tipo === 'anda' ? COR.azul : COR.verde, COR.claro], 14, 1.4, 0.12, 30);
            fx.tremer(1.5);
          } else sfx.ruido(0.05, 1800, 0.05);
        }
        const mola = p.mola && Math.abs(this.x - (p.x + p.w / 2)) < 5;
        this.vy = mola ? -7.6 : -4.6;
        if (mola) sfx.chip(300, 1300, 0.22), fx.faiscas(this.x, p.y - this.camY - 3, [COR.amarelo, COR.branco], 12, 1.8, 0.02, 26), fx.tremer(2);
        else sfx.chip(260, 620, 0.08, 0.06), fx.faiscas(this.x, p.y - this.camY, COR.claro, 4, 0.7, 0.03, 12);
        break;
      }
    this.alto = Math.min(this.alto, this.y);
    const antes100 = Math.floor(this.pontos / 100);
    this.pontos = Math.floor((168 - this.alto) / 3);
    // a cada 100: a comemoração
    if (Math.floor(this.pontos / 100) > antes100) {
      fx.texto(this.x, this.y - this.camY - 16, `${Math.floor(this.pontos / 100) * 100}!`, COR.amarelo);
      fx.faiscas(this.x, this.y - this.camY - 6, CONFETE, 16, 1.8, 0.04, 34);
      sfx.arpejo([784, 988, 1175], 0.05, 0.06);
    }
    if (this.y - this.camY < 72) this.camY = this.y - 72;
    this.gerar();
    this.plats = this.plats.filter((p) => p.y - this.camY < H + 24);
    if (this.y - this.camY > H + 12) {
      this.fim = true;
      sfx.chip(700, 70, 0.7, 0.08);
      fx.tremer(6);
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
      let x = Math.round(p.x);
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
      // a que já quebrou (no difícil) cai em dois pedaços, na cor dela
      if (p.quebrada) {
        g.fillStyle = p.tipo === 'anda' ? COR.azul : COR.verde;
        g.fillRect(x, y + 1, p.w / 2 - 1, 3);
        g.fillRect(x + p.w / 2 + 1, y + 2, p.w / 2 - 1, 3);
        continue;
      }
      // na última, treme um pixel para avisar
      const xt = p.pulos === 1 && (quadro >> 2) % 2 === 0 ? x + 1 : x;
      g.fillStyle = p.tipo === 'anda' ? COR.azul : COR.verde;
      g.fillRect(xt, y, p.w, 4);
      g.fillStyle = p.tipo === 'anda' ? COR.azulClaro : COR.verdeClaro;
      g.fillRect(xt, y, p.w, 1);
      if (p.pulos !== null) {
        // as rachaduras (uma a cada pulo já dado) e as bolinhas do que falta
        const dados = (PULOS_POR_NIVEL[this.nivel] ?? 0) - p.pulos;
        g.fillStyle = COR.preto;
        for (let k = 0; k < dados; k++) {
          const rx = xt + Math.round(((k + 1) * p.w) / (dados + 2));
          g.fillRect(rx, y + 1, 1, 2);
          g.fillRect(rx + 1, y + 2, 1, 2);
        }
        g.fillStyle = p.pulos === 1 ? COR.vermelho : COR.amarelo;
        for (let k = 0; k < p.pulos; k++) g.fillRect(xt + Math.round(p.w / 2) - p.pulos + k * 2, y + 5, 1, 1);
      }
      x = xt;
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
    // em dupla: os pontos do outro, no canto
    if (this.dupla && this.outro) {
      texto(g, curto(this.dupla.outro), W - 5, 4, COR.rosa, 1, 'dir');
      texto(g, this.outro.vivo ? String(this.outro.p) : `${this.outro.p} CAIU`, W - 5, 11, this.outro.vivo ? COR.rosa : COR.cinza, 1, 'dir');
    }
  }

  resumo() {
    if (this.outro) return `${this.pontos} A ${this.outro.p}`;
    return 'CAIU LA DE CIMA';
  }
}

export const JOGOS = [
  { id: 'pong', nome: 'PONG', dica: 'PRIMEIRO A 7 VENCE', toque: 'O DEDO NA TELA MOVE A RAQUETE', recorde: false, novo: (_d?: Dupla, n?: Nivel) => new Pong('sozinho', n) },
  { id: 'atravessa', nome: 'ATRAVESSA', dica: '90 SEGUNDOS NA AVENIDA', toque: 'SEGURE A TELA PARA ANDAR', recorde: true, novo: (d?: Dupla, n?: Nivel) => new Atravessa(d, n) },
  { id: 'pula', nome: 'PULA-PULA', dica: 'SOBE SEM CAIR', toque: 'TOQUE NA ESQUERDA OU NA DIREITA', recorde: true, novo: (d?: Dupla, n?: Nivel) => new PulaPula(d, n) },
] as const;
