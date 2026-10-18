import { DEGRAUS_DA_CHAMA, paletaDaChama, ventoDaChama, type ChamaCriatura, type CorDaChama } from '@crona/shared';
import { fogoVivo } from './lighting';
import type { SpriteFrame } from './sprites';

/**
 * A chama fantasmagórica das criaturas (17/10, o Felipe: o Anfitrião do livro, com fogo azul e roxo saindo dele todo).
 * Pixel art por código, no mesmo princípio da chama das velas (particles.ts): uma grade de calor que queima sozinha,
 * pintada pixel a pixel, sem suavizar, 12 quadros por segundo. Diferenças para a vela:
 *  - o fogo nasce da SILHUETA do boneco (a máscara do quadro que está na tela agora), então a chama gira com as 8
 *    direções e sai do corpo todo: mais da borda, um pouco do miolo, e forte nos pés;
 *  - a grade é fixa no mundo, não na peça: quando a peça anda, o que já queimou fica para trás (o rastro), e o vento
 *    (`ventoDaChama`) inclina e encurta a chama contra o sentido do passo; parada, ela sobe reta e alta;
 *  - duas camadas: atrás do corpo (a chama inteira) e por cima dele (só a ponta mais quente, rala), para o fogo lamber
 *    o terno em vez de ficar só de moldura;
 *  - o custo é um ImageData pequeno por peça refeito 12 vezes por segundo, e duas imagens por quadro na tela.
 * A tabela de quem tem chama e as cores estão em `shared/src/chama.ts` (o campo `chama` da criatura).
 */

const FPS = 12;
const MARGEM_LADO = 22;
const MARGEM_TOPO = 40;
const MARGEM_BAIXO = 10;
/** quanto do deslocamento da peça a grade acompanha: 1 deixa o rastro inteiro no chão; menos, mais colado nela */
const ARRASTO = 0.72;
/** a ponta quente por cima do corpo: do degrau tal para cima, nesta opacidade */
const FRENTE_DEGRAU = 7;
const FRENTE_ALFA = 0.5;

interface Mascara {
  corpo: Uint8Array;
  /** índices das casas do corpo que fazem borda, do miolo e dos pés */
  borda: Uint32Array;
  miolo: Uint32Array;
  pes: Uint32Array;
}

interface Estado {
  w: number;
  h: number;
  calor: Uint8Array;
  tras: HTMLCanvasElement;
  frente: HTMLCanvasElement;
  ctxTras: CanvasRenderingContext2D;
  ctxFrente: CanvasRenderingContext2D;
  dadosTras: ImageData;
  dadosFrente: ImageData;
  quadro: number;
  /** a posição (mundo) dos pés no último quadro da tela, e o que sobrou do deslocamento em fração de pixel */
  x: number;
  y: number;
  restoX: number;
  restoY: number;
  vistoEm: number;
  vx: number;
  vy: number;
  /** há calor na grade (se não, e a peça não solta chama, nem desenha) */
  vivo: boolean;
  chave: string;
  pal: Uint32Array;
  palToque: Uint32Array;
  temToque: boolean;
}

export interface EntradaChama {
  /** a peça (o id do token) */
  id: number;
  chama: ChamaCriatura;
  /** o quadro do boneco que vai à tela agora (a silhueta de onde o fogo nasce) */
  quadro: SpriteFrame;
  /** onde os pés pisam no mundo (px) */
  x: number;
  y: number;
  /** a escala do boneco no tabuleiro (ESCALA_ARTE_PESSOA) e a achatada na vertical (agachado, sob a mesa) */
  escala: number;
  escalaY: number;
  /** solta chama (falso: deitada; a que já queimava se apaga sozinha) */
  ativa: boolean;
  now: number;
  /** a fase própria da peça (as chamas não respiram juntas) */
  fase: number;
}

export interface CamadasChama {
  tras: HTMLCanvasElement;
  frente: HTMLCanvasElement;
  /** o canto de cima à esquerda da grade, no mundo */
  x: number;
  y: number;
  /** a altura do corpo na tela (para o brilho em volta) */
  h: number;
}

const mascaras = new WeakMap<HTMLCanvasElement, Map<string, Mascara>>();

/** "#rrggbb" ou a cor da paleta como um número de pixel (RGBA em little-endian, como o ImageData guarda). */
const empacota = (c: CorDaChama, alfa = 1) => ((Math.round(c[3] * alfa) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;

/** A máscara do corpo na grade da chama: onde o quadro tem pixel, e dali quais são borda, miolo e pés. */
function mascaraDoQuadro(q: SpriteFrame, w: number, h: number, escala: number, escalaY: number): Mascara {
  let por = mascaras.get(q.canvas);
  if (!por) mascaras.set(q.canvas, (por = new Map()));
  const chave = `${w}x${h}:${escala.toFixed(3)}:${escalaY.toFixed(2)}`;
  const guardada = por.get(chave);
  if (guardada) return guardada;
  const cw = q.canvas.width;
  const ch = q.canvas.height;
  let alfa: Uint8ClampedArray | null = null;
  try {
    alfa = q.canvas.getContext('2d')!.getImageData(0, 0, cw, ch).data;
  } catch {
    alfa = null;
  }
  const corpo = new Uint8Array(w * h);
  const k = cw / (q.w || cw);
  const pesY = h - MARGEM_BAIXO;
  if (alfa)
    for (let gy = 0; gy < h; gy++)
      for (let gx = 0; gx < w; gx++) {
        const ox = gx - w / 2 + 0.5;
        const oy = gy - pesY + 0.5;
        const ax = Math.floor((q.ax + ox / escala) * k);
        const ay = Math.floor((q.ay + oy / (escala * escalaY)) * k);
        if (ax >= 0 && ay >= 0 && ax < cw && ay < ch && alfa[(ay * cw + ax) * 4 + 3] > 48) corpo[gy * w + gx] = 1;
      }
  const borda: number[] = [];
  const miolo: number[] = [];
  const pes: number[] = [];
  let baixo = 0;
  for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) if (corpo[gy * w + gx]) baixo = Math.max(baixo, gy);
  const tem = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && corpo[y * w + x] === 1;
  for (let gy = 0; gy < h; gy++)
    for (let gx = 0; gx < w; gx++) {
      if (!corpo[gy * w + gx]) continue;
      const i = gy * w + gx;
      // a borda: perto do vazio (2 px); os pés: a faixa de baixo do corpo
      if (!tem(gx - 2, gy) || !tem(gx + 2, gy) || !tem(gx, gy - 2) || !tem(gx, gy + 2)) borda.push(i);
      else miolo.push(i);
      if (gy >= baixo - 6) pes.push(i);
    }
  const m: Mascara = { corpo, borda: Uint32Array.from(borda), miolo: Uint32Array.from(miolo), pes: Uint32Array.from(pes) };
  por.set(chave, m);
  return m;
}

function novoEstado(w: number, h: number, chama: ChamaCriatura): Estado {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    return { c, g, d: g.createImageData(w, h) };
  };
  const a = mk();
  const b = mk();
  const { corpo, toque } = paletaDaChama(chama.cor, chama.acento, chama.toque);
  return {
    w,
    h,
    calor: new Uint8Array(w * h),
    tras: a.c,
    frente: b.c,
    ctxTras: a.g,
    ctxFrente: b.g,
    dadosTras: a.d,
    dadosFrente: b.d,
    quadro: -1,
    x: NaN,
    y: NaN,
    restoX: 0,
    restoY: 0,
    vistoEm: 0,
    vx: 0,
    vy: 0,
    vivo: false,
    chave: chaveDaChama(chama),
    pal: Uint32Array.from(corpo.map((c) => empacota(c))),
    palToque: Uint32Array.from(toque.map((c) => empacota(c))),
    temToque: !!chama.toque,
  };
}

const chaveDaChama = (c: ChamaCriatura) => `${c.cor}|${c.acento ?? ''}|${c.toque ?? ''}`;

/** Um passo do fogo: o calor sobe (cada casa pega o de baixo, um pouco para o lado), esfria e nasce no corpo. */
function queimar(e: Estado, m: Mascara | null, chama: ChamaCriatura, inclina: number, encolhe: number, respiro: number, ativa: boolean) {
  const { w, h, calor } = e;
  const topo = DEGRAUS_DA_CHAMA - 1;
  const forca = Math.max(0.2, chama.intensidade);
  // quanto o calor perde por linha: mais forte e parada = mais alta; andando, encolhe; a respiração mexe um pouco
  const perde = (0.36 / Math.sqrt(forca)) * (1 + encolhe * 1.5) * (1.12 - 0.24 * respiro);
  const vento = Math.abs(inclina);
  const empurra = inclina < 0 ? 1 : -1;
  for (let y = 0; y < h - 1; y++) {
    const linha = y * w;
    const de = (y + 1) * w;
    for (let x = 0; x < w; x++) {
      let dx = ((Math.random() * 3) | 0) - 1;
      if (vento > 0.05 && Math.random() < vento * 0.85) dx = empurra;
      const sx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
      let v = calor[de + sx];
      if (v > 0 && Math.random() < perde) v--;
      // a ponta que se solta: de vez em quando perde mais de um degrau (a chama rala e esfiapa)
      if (v > 2 && Math.random() < perde * 0.18) v--;
      calor[linha + x] = v;
    }
  }
  calor.fill(0, (h - 1) * w);
  if (!ativa || !m) return;
  // o corpo solta fogo: forte na borda, fraco no miolo, mais ainda nos pés
  const pBorda = Math.min(0.95, 0.5 * forca) * (0.86 + 0.14 * respiro);
  const pMiolo = Math.min(0.5, 0.07 * forca);
  const pPes = Math.min(0.97, 0.78 * forca);
  const nasce = (i: number, base: number) => {
    const v = Math.min(topo, Math.round(base + Math.random() * 3.2));
    if (v > calor[i]) calor[i] = v;
  };
  for (const i of m.borda) if (Math.random() < pBorda) nasce(i, 7.2);
  for (const i of m.miolo) if (Math.random() < pMiolo) nasce(i, 6);
  for (const i of m.pes) if (Math.random() < pPes) nasce(i, 7.6);
}

/** Passa o calor da grade para as duas imagens (atrás do corpo e a ponta por cima dele). */
function pintar(e: Estado, m: Mascara | null, tick: number) {
  const { w, h, calor, pal, palToque } = e;
  const a = new Uint32Array(e.dadosTras.data.buffer);
  const b = new Uint32Array(e.dadosFrente.data.buffer);
  const frente = (c: number) => (((c >>> 24) * FRENTE_ALFA) << 24) | (c & 0xffffff);
  let vivo = false;
  const grupo = tick >> 1;
  for (let i = 0, n = w * h; i < n; i++) {
    const v = calor[i];
    if (v < 2) {
      a[i] = 0;
      b[i] = 0;
      continue;
    }
    vivo = true;
    // o toque da outra cor: pontos soltos no meio do fogo, que mudam a cada dois quadros
    const x = i % w;
    const y = (i / w) | 0;
    const sorteio = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(grupo, 83492791)) >>> 0;
    const cor = e.temToque && v >= 4 && v <= 9 && sorteio % 9 === 0 ? palToque[v] : pal[v];
    a[i] = cor;
    b[i] = m && m.corpo[i] && v >= FRENTE_DEGRAU ? frente(cor) >>> 0 : 0;
  }
  e.vivo = vivo;
  e.ctxTras.putImageData(e.dadosTras, 0, 0);
  e.ctxFrente.putImageData(e.dadosFrente, 0, 0);
}

export class ChamasDasPecas {
  private estados = new Map<number, Estado>();
  private limpou = 0;

  /**
   * Avança a chama da peça até `now` e devolve as camadas para desenhar (atrás do corpo e por cima dele), ou null se
   * não há fogo nem o que apagar. Chamado uma vez por quadro de tela por peça visível.
   */
  camadas(a: EntradaChama): CamadasChama | null {
    this.limpar(a.now);
    const q = a.quadro;
    const larg = Math.ceil(q.w * a.escala) + MARGEM_LADO * 2;
    const alto = Math.ceil((q.h * a.escala * a.escalaY) + MARGEM_TOPO + MARGEM_BAIXO);
    let e = this.estados.get(a.id);
    const chave = chaveDaChama(a.chama);
    // a grade cresce com o maior quadro visto e é refeita se a cor da chama mudou (o mestre editou a criatura)
    if (!e || e.chave !== chave || larg > e.w || alto > e.h) {
      if (!a.ativa) return null;
      const w = Math.max(larg, e?.w ?? 0, 72);
      const h = Math.max(alto, e?.h ?? 0, 110);
      e = novoEstado(w, h, a.chama);
      this.estados.set(a.id, e);
    }
    const dt = Math.max(0.001, Math.min(0.25, (a.now - (e.vistoEm || a.now)) / 1000));
    const faltou = e.vistoEm > 0 && a.now - e.vistoEm > 600;
    e.vistoEm = a.now;
    // a grade é do mundo: a peça andou, o que queimou fica para trás (um pouco acompanha, ARRASTO)
    if (Number.isNaN(e.x) || faltou) {
      e.restoX = e.restoY = 0;
      if (faltou) e.calor.fill(0);
    } else {
      e.restoX += (a.x - e.x) * ARRASTO;
      e.restoY += (a.y - e.y) * ARRASTO;
      const ix = Math.trunc(e.restoX);
      const iy = Math.trunc(e.restoY);
      if (ix || iy) {
        e.restoX -= ix;
        e.restoY -= iy;
        desloca(e, -ix, -iy);
      }
      // a velocidade da peça em px por segundo (suavizada), que é o que empurra a chama
      const suave = Math.min(1, dt * 8);
      e.vx += ((a.x - e.x) / dt - e.vx) * suave;
      e.vy += ((a.y - e.y) / dt - e.vy) * suave;
    }
    e.x = a.x;
    e.y = a.y;
    const m = a.ativa ? mascaraDoQuadro(q, e.w, e.h, a.escala, a.escalaY) : null;
    const quadro = Math.floor(a.now / (1000 / FPS));
    if (quadro !== e.quadro) {
      const passos = e.quadro < 0 ? 16 : Math.min(2, quadro - e.quadro);
      const { inclina, encolhe } = ventoDaChama(e.vx, e.vy);
      const respiro = 0.5 + 0.5 * Math.sin(a.now / 780 + a.fase * 2.3);
      // o fôlego do fogo: o mesmo tremor das velas (lighting.ts), cada peça no seu tempo
      const tremor = fogoVivo(a.now, a.fase).f;
      for (let i = 0; i < passos; i++) queimar(e, m, a.chama, inclina, encolhe, respiro * 0.7 + tremor * 0.3, a.ativa);
      e.quadro = quadro;
      pintar(e, m, quadro);
    }
    if (!e.vivo && !a.ativa) return null;
    return { tras: e.tras, frente: e.frente, x: Math.round(a.x - e.w / 2), y: Math.round(a.y - (e.h - MARGEM_BAIXO)), h: q.h * a.escala * a.escalaY };
  }

  /** Esquece as peças que não aparecem há 3 s (saíram da cena ou da tela). */
  private limpar(now: number) {
    if (now - this.limpou < 2000) return;
    this.limpou = now;
    for (const [id, e] of this.estados) if (now - e.vistoEm > 3000) this.estados.delete(id);
  }
}

/** Anda com o conteúdo da grade (dx, dy) casas: o que sai pela borda se perde, o que entra é vazio. */
function desloca(e: Estado, dx: number, dy: number) {
  const { w, h, calor } = e;
  if (Math.abs(dx) >= w || Math.abs(dy) >= h) {
    calor.fill(0);
    return;
  }
  if (dy) {
    if (dy > 0) {
      calor.copyWithin(dy * w, 0, (h - dy) * w);
      calor.fill(0, 0, dy * w);
    } else {
      calor.copyWithin(0, -dy * w);
      calor.fill(0, (h + dy) * w);
    }
  }
  if (dx) {
    for (let y = 0; y < h; y++) {
      const r = y * w;
      if (dx > 0) {
        calor.copyWithin(r + dx, r, r + w - dx);
        calor.fill(0, r, r + dx);
      } else {
        calor.copyWithin(r, r - dx, r + w);
        calor.fill(0, r + w + dx, r + w);
      }
    }
  }
}

/** Desenha uma camada da chama (a grade já vem pronta, sem suavizar: pixel de verdade). */
export function desenharCamadaChama(ctx: CanvasRenderingContext2D, c: CamadasChama, qual: 'tras' | 'frente') {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qual === 'tras' ? c.tras : c.frente, c.x, c.y);
  ctx.restore();
}

/** O brilho macio em volta do corpo (é luz, não desenho): soma a cor da chama, respirando. */
export function desenharBrilhoChama(ctx: CanvasRenderingContext2D, chama: ChamaCriatura, x: number, y: number, alturaCorpo: number, now: number, fase: number) {
  const vivo = fogoVivo(now, fase);
  const r = alturaCorpo * 0.8;
  const cx = x;
  const cy = y - alturaCorpo * 0.5;
  const a = Math.min(0.3, 0.17 * chama.intensidade) * (0.6 + 0.4 * vivo.f);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const [R, G, B] = [parseInt(chama.cor.slice(1, 3), 16), parseInt(chama.cor.slice(3, 5), 16), parseInt(chama.cor.slice(5, 7), 16)];
  g.addColorStop(0, `rgba(${R},${G},${B},${a})`);
  g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}
