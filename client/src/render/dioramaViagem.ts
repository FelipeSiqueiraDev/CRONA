import type { ViagemInfo } from '@crona/shared';
import type { SpriteFrame } from './sprites';

/**
 * O dioraminha da viagem (07/10), em pixel art, no estilo das referências do Felipe: uma ilha de formato irregular
 * flutuando no céu, com a terra em camadas aparecendo embaixo e umas pedrinhas soltas, e a estrada atravessando a ilha
 * de ponta a ponta. A van preta fica no meio, ABERTA por cima, com os agentes sentados lá dentro (sobe e desce de leve,
 * as rodas giram) e o mundo passa em cima da ilha: árvores, postes, cercas, arbustos e um carro de vez em quando na outra
 * mão. Desenhado em código numa tela pequena e ampliado com pixels grandes; a arte do Códex entra depois.
 */

/** a ilha: o comprimento (ao longo da estrada) e a largura, em unidades; cada unidade anda (K, K/2) na tela */
const LX = 38;
const LY = 22;
const K = 3;
/** a espessura da ilha (a terra aparente embaixo), em px */
const BOLO = 16;
/** unidades por segundo com a velocidade em 1 */
const UNID_POR_S = 7;
/** a estrada (em y) e a faixa do meio */
const ESTRADA: [number, number] = [4.2, 17.2];
const MEIO = 10.2;

const CONTORNO = '#17121c';

type Pt = [number, number];

const aleat = (n: number, s = 0) => {
  const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const CEUS: Record<string, [string, string, string]> = {
  dia: ['#7fcfee', '#c4ebf7', '#ffffff'],
  entardecer: ['#e9845a', '#f6c27a', '#ffe7c4'],
  noite: ['#141c3a', '#2b3a72', '#a9b6e8'],
};

/** O contorno da ilha (em unidades): um retângulo de cantos redondos, limpo. */
const ILHA: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const r = 3.2;
  const x0 = -1;
  const y0 = -1;
  const x1 = LX + 1;
  const y1 = LY + 1;
  const canto = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  canto(x1 - r, y1 - r, 0);
  canto(x0 + r, y1 - r, Math.PI / 2);
  canto(x0 + r, y0 + r, Math.PI);
  canto(x1 - r, y0 + r, (Math.PI * 3) / 2);
  return pts;
})();

function dentro(x: number, y: number): boolean {
  let d = false;
  for (let i = 0, j = ILHA.length - 1; i < ILHA.length; j = i++) {
    const [xi, yi] = ILHA[i];
    const [xj, yj] = ILHA[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

export class DioramaViagem {
  private pos = 0;
  private vel = 0;
  private ultimo = 0;
  /** o canto (0, 0) da ilha na tela (muda com o tamanho da tela e com o sobe-desce) */
  private ox = 0;
  private oy = 0;

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

  /** A roda na lateral de +y: o pneu, o aro e dois raios que giram (`ang`, em radianos). */
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

  private arvore(ctx: CanvasRenderingContext2D, x: number, y: number, tam: number, noite: boolean, tipo: number) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(bx - 4, by, 9, 2);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 6 * tam, 4, 6 * tam + 1);
    ctx.fillStyle = '#6a4632';
    ctx.fillRect(bx, by - 6 * tam, 2, 6 * tam);
    const ipe = tipo === 2;
    const cores = noite ? ['#1e4a33', '#25583c', '#2c6545'] : ipe ? ['#d99a1e', '#f0c33c', '#ffe27a'] : tipo === 1 ? ['#2a7a3a', '#3a9a46', '#5fbf5a'] : ['#2f8a3b', '#3fa54a', '#6fd06a'];
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
    // o brilho da copa
    ctx.fillStyle = noite ? '#356f4e' : ipe ? '#fff1b0' : '#9be38a';
    ctx.fillRect(bx - 1, Math.round(by - 17 * tam), 2, 1);
  }

  private poste(ctx: CanvasRenderingContext2D, x: number, y: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 26, 3, 26);
    ctx.fillRect(bx - 1, by - 27, 8, 3);
    ctx.fillStyle = '#7a7f8a';
    ctx.fillRect(bx, by - 25, 1, 25);
    ctx.fillRect(bx, by - 26, 6, 1);
    ctx.fillStyle = noite ? '#ffe9a0' : '#d8d6c4';
    ctx.fillRect(bx + 5, by - 25, 2, 1);
    if (noite) {
      ctx.fillStyle = 'rgba(255,233,160,0.16)';
      ctx.beginPath();
      ctx.moveTo(bx + 6, by - 24);
      ctx.lineTo(bx + 16, by + 4);
      ctx.lineTo(bx - 4, by + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  private arbusto(ctx: CanvasRenderingContext2D, x: number, y: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
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
    ctx.fillStyle = noite ? '#24563a' : '#3c9a46';
    for (const [dx, dy, r] of bolas) {
      ctx.beginPath();
      ctx.arc(bx + dx, by + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = noite ? '#2f6a48' : '#7fd26e';
    ctx.fillRect(bx - 1, by - 6, 2, 1);
    if (!noite) {
      ctx.fillStyle = '#ffd1e0';
      ctx.fillRect(bx + 2, by - 3, 1, 1);
    }
  }

  private cerca(ctx: CanvasRenderingContext2D, x: number, y: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 8, 3, 8);
    ctx.fillStyle = noite ? '#5a4232' : '#9a7448';
    ctx.fillRect(bx, by - 7, 1, 7);
    ctx.fillRect(bx - 6, by - 6, 13, 1);
    ctx.fillRect(bx - 6, by - 3, 13, 1);
  }

  /**
   * A van preta, ABERTA por cima, parada no meio da ilha (o mundo é que anda): o piso, as paredes de dentro, os bancos
   * com os agentes sentados (os retratos), a lateral de perto mais baixa (para ver quem está dentro), a cabine com o
   * para-brisa, o capô e as rodas girando.
   */
  private van(ctx: CanvasRenderingContext2D, now: number, noite: boolean, figuras: (SpriteFrame | null)[]) {
    const x0 = 10.5;
    const x1 = 23;
    const y0 = 10.8;
    const y1 = 16.2;
    // a trepidação do motor: um pixel, de vez em quando
    const z = 4 + (Math.sin(now / 90) > 0.6 ? 1 : 0);
    const alto = 15;
    const lataria = '#2c2c36';
    const dentro = noite ? '#34343f' : '#4a4d58';
    // a sombra na estrada e o facho dos faróis à noite
    this.chao(ctx, x0 - 0.4, x1 + 3.6, y0 + 0.8, y1 + 1.4, 0, 'rgba(0,0,0,0.3)');
    if (noite) this.poli(ctx, [this.p(x1 + 3.2, y0 + 0.6, 0), this.p(x1 + 13, y0 - 1.6, 0), this.p(x1 + 13, y1 + 1.4, 0), this.p(x1 + 3.2, y1 - 0.6, 0)], 'rgba(255,236,170,0.22)');
    // o piso
    this.chao(ctx, x0, x1, y0, y1, z, dentro, true);
    // a parede de lá (vista por dentro) e a de trás (por dentro), com as janelas
    this.faceY(ctx, y0, x0, x1, z, z + alto, '#3a3b46', true);
    for (const [a, b] of [[11.6, 14.8], [15.6, 18.8], [19.6, 22.4]] as const) this.faceY(ctx, y0, a, b, z + 8, z + 13, noite ? '#2a3f58' : '#7fb2cf');
    this.faceX(ctx, x0, y0, y1, z, z + alto, '#33343e', true);
    this.faceX(ctx, x0, y0 + 0.8, y1 - 0.8, z + 8, z + 13, noite ? '#2a3f58' : '#7fb2cf');
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
          // o agente sentado: o boneco do tabuleiro, pequeno, com o quadril no assento e as pernas escondidas
          const [px, py] = this.p(fx + 0.9, fy + 0.1, z + 4);
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
      }
    // o painel e o volante, na frente do motorista
    this.caixa(ctx, x1 - 1.2, x1, y0, y1, z, z + 7, '#3a3a46', '#2a2a33', '#24242c');
    // a lateral de perto, mais baixa, para ver quem está dentro, com a porta de correr e a maçaneta
    this.faceY(ctx, y1, x0, x1, z, z + 7, lataria, true);
    this.chao(ctx, x0, x1, y1, y1 + 0.4, z + 7, '#5a5a6a', true);
    this.faceY(ctx, y1, 15.3, 15.45, z + 1, z + 7, '#17171c');
    this.faceY(ctx, y1, 16.3, 17.1, z + 4, z + 4.7, '#9a9aa6');
    this.faceY(ctx, y1, x0, x0 + 0.5, z + 3, z + 6, '#c8322a');
    // a cabine: a coluna, o para-brisa (aberto em cima, só a moldura) e o retrovisor
    this.faceX(ctx, x1, y0, y1, z, z + alto, lataria, true);
    this.faceX(ctx, x1, y0 + 0.6, y1 - 0.6, z + 8, z + alto - 1, noite ? '#3b5a78' : '#9cc9de', true);
    this.faceX(ctx, x1, y0 + 1.2, y0 + 2, z + 9, z + alto - 2, noite ? '#4a6a88' : '#d4ecf6');
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

  /** Um carro na outra mão, de vez em quando, indo para o outro lado. */
  private carro(ctx: CanvasRenderingContext2D, noite: boolean) {
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
    this.caixa(ctx, x0, x0 + len, y0, y1, z, z + 6, cor, cor, cor);
    this.caixa(ctx, x0 + 1.8, x0 + 5.4, y0 + 0.4, y1 - 0.4, z + 6, z + 10, '#e6e8ec', noite ? '#36506a' : '#8cc4de', noite ? '#36506a' : '#8cc4de');
    // a lanterna de trás (o carro vai para lá: a traseira fica para cá)
    this.faceX(ctx, x0 + len, y0 + 0.4, y0 + 1.2, z + 3, z + 5, '#c8322a');
    this.faceX(ctx, x0 + len, y1 - 1.2, y1 - 0.4, z + 3, z + 5, '#c8322a');
    const ang = this.pos * 0.9;
    for (const x of [x0 + 1.7, x0 + 5.8]) this.roda(ctx, x, y1, 3.3, ang);
  }

  /** Desenha a cena inteira (o céu, as nuvens e a ilha) numa tela pequena de `w` × `h`. */
  desenhar(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, v: ViagemInfo, figuras: (SpriteFrame | null)[] = []) {
    const dt = this.ultimo ? Math.min(0.1, (now - this.ultimo) / 1000) : 0;
    this.ultimo = now;
    this.vel += (Math.max(0.35, v.velocidade) - this.vel) * Math.min(1, dt * 1.5);
    this.pos += this.vel * UNID_POR_S * dt;
    const noite = v.hora === 'noite';
    const [c0, c1, nuv] = CEUS[v.hora] ?? CEUS.dia;
    ctx.imageSmoothingEnabled = false;
    // o céu
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (noite) {
      ctx.fillStyle = '#e8ecff';
      for (let i = 0; i < 50; i++) if (Math.sin(now / 700 + i) > -0.6) ctx.fillRect(Math.floor(aleat(i, 1) * w), Math.floor(aleat(i, 2) * h * 0.8), 1, 1);
    }
    // as nuvens de trás, passando devagar
    for (let i = 0; i < 7; i++) this.nuvem(ctx, ((aleat(i, 3) * w - now / (120 + i * 30)) % (w + 40) + w + 40) % (w + 40) - 20, 8 + aleat(i, 4) * h * 0.8, nuv, 0.5);
    // a ilha: o meio dela no meio da tela, subindo e descendo devagar
    const bob = Math.round(Math.sin(now / 1200) * 2);
    this.ox = Math.round(w / 2 - (LX - LY) * K * 0.5);
    this.oy = Math.round(h / 2 - ((LX + LY) * K) / 4 - 4 + bob);
    this.pedrinhas(ctx, now, noite);
    this.ilha(ctx, v, noite, now, figuras);
    // as nuvens da frente, poucas
    for (let i = 0; i < 2; i++) this.nuvem(ctx, ((aleat(i, 9) * w - now / (80 + i * 25)) % (w + 40) + w + 40) % (w + 40) - 20, h * (0.76 + i * 0.1), nuv, 0.9);
  }

  private nuvem(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, a: number) {
    const bx = Math.round(x);
    const by = Math.round(y);
    ctx.globalAlpha = a;
    ctx.fillStyle = cor;
    ctx.fillRect(bx - 9, by, 19, 3);
    ctx.fillRect(bx - 6, by - 3, 13, 3);
    ctx.fillRect(bx - 2, by - 5, 6, 2);
    ctx.globalAlpha = 1;
  }

  /** As pedrinhas soltas embaixo da ilha, cada uma subindo e descendo no seu tempo. */
  private pedrinhas(ctx: CanvasRenderingContext2D, now: number, noite: boolean) {
    const [bx, by] = this.p(LX / 2, LY / 2, -BOLO);
    const pedras: [number, number, number][] = [
      [-38, 22, 5],
      [30, 30, 4],
      [-8, 40, 3],
      [52, 12, 3],
    ];
    pedras.forEach(([dx, dy, r], i) => {
      const y = by + dy + Math.round(Math.sin(now / (900 + i * 170) + i) * 2);
      const x = bx + dx;
      ctx.fillStyle = CONTORNO;
      ctx.fillRect(x - r - 1, y - 1, r * 2 + 2, r + 2);
      ctx.fillStyle = noite ? '#4a3a52' : '#8a6a55';
      ctx.fillRect(x - r, y, r * 2, r);
      ctx.fillStyle = noite ? '#2f6a3c' : '#5fbf4f';
      ctx.fillRect(x - r, y - 1, r * 2, 1);
    });
  }

  private ilha(ctx: CanvasRenderingContext2D, v: ViagemInfo, noite: boolean, now: number, figuras: (SpriteFrame | null)[]) {
    const terra = v.cenario === 'terra';
    const topo: Pt[] = ILHA.map(([x, y]) => this.p(x, y));
    // a terra aparente: o contorno repetido para baixo, em faixas limpas (a grama na beira, as camadas de terra e a base escura)
    const faixa = (d: number) => {
      if (d <= 2) return noite ? '#2a5a34' : '#4aa040';
      if (d >= BOLO - 1) return noite ? '#241b2c' : '#4a3426';
      const k = Math.floor((d - 3) / 4) % 2;
      return noite ? (k ? '#3c2f46' : '#46384f') : k ? '#8a6650' : '#9c7759';
    };
    for (let d = BOLO; d >= 1; d--) {
      this.caminho(ctx, topo.map(([x, y]) => [x, y + d] as Pt));
      ctx.fillStyle = faixa(d);
      ctx.fill();
    }
    this.caminho(ctx, topo.map(([x, y]) => [x, y + BOLO + 1] as Pt));
    ctx.strokeStyle = CONTORNO;
    ctx.lineWidth = 1;
    ctx.stroke();
    // umas pedras encravadas, espaçadas, nas duas faces que aparecem
    ctx.fillStyle = noite ? '#2c2236' : '#6a4c3a';
    for (let k = 0; k < 9; k++) {
      const [px, py] = this.p(2 + k * 4.1, LY + 1, 0);
      ctx.fillRect(px, py + 6 + (k % 2) * 4, 3, 2);
    }
    for (let k = 0; k < 5; k++) {
      const [px, py] = this.p(LX + 1, 2 + k * 4.3, 0);
      ctx.fillRect(px, py + 8 - (k % 2) * 3, 2, 2);
    }
    // a grama: o topo, com a beira de cima mais clara
    const gr = noite ? ['#2f6a3c', '#3b7d47', '#4a8f56'] : ['#5fbf4f', '#77d063', '#9be38a'];
    this.caminho(ctx, topo);
    ctx.fillStyle = gr[0];
    ctx.fill();
    ctx.strokeStyle = CONTORNO;
    ctx.stroke();
    ctx.save();
    this.caminho(ctx, topo);
    ctx.clip();
    // tufos de grama mais clara, andando com o mundo
    ctx.fillStyle = gr[1];
    for (let i = 0; i < 70; i++) {
      const x = (((aleat(i, 10) * (LX + 4) - this.pos) % (LX + 4)) + LX + 4) % (LX + 4) - 2;
      const y = aleat(i, 11) * LY;
      if (y > ESTRADA[0] - 0.3 && y < ESTRADA[1] + 0.3) continue;
      const [px, py] = this.p(x, y);
      ctx.fillRect(px, py, 2, 1);
      if (aleat(i, 12) < 0.2) {
        ctx.fillStyle = noite ? '#7a86b0' : aleat(i, 13) < 0.5 ? '#ffffff' : '#ffd1e0';
        ctx.fillRect(px + 1, py - 1, 1, 1);
        ctx.fillStyle = gr[1];
      }
    }
    // a estrada atravessando a ilha de ponta a ponta
    const [e0, e1] = ESTRADA;
    if (terra) {
      this.chao(ctx, -4, LX + 4, e0, e1, 0, noite ? '#6a5236' : '#b48d5c');
      for (const y of [6.4, 7.8, 12.4, 14]) this.chao(ctx, -4, LX + 4, y, y + 0.6, 0, noite ? '#5c4630' : '#9a754a');
      // pedrinhas da terra batida, andando com o mundo
      ctx.fillStyle = noite ? '#4c3a28' : '#8a6a42';
      for (let i = 0; i < 26; i++) {
        const x = (((aleat(i, 14) * (LX + 8) - this.pos) % (LX + 8)) + LX + 8) % (LX + 8) - 4;
        const [px, py] = this.p(x, e0 + 0.5 + aleat(i, 15) * (e1 - e0 - 1));
        ctx.fillRect(px, py, 1, 1);
      }
    } else {
      this.chao(ctx, -4, LX + 4, e0, e1, 0, noite ? '#23252c' : '#3e414a');
      // a beira branca e a faixa amarela tracejada do meio
      this.chao(ctx, -4, LX + 4, e0 + 0.3, e0 + 0.6, 0, '#d9dbde');
      this.chao(ctx, -4, LX + 4, e1 - 0.6, e1 - 0.3, 0, '#d9dbde');
      const passo = 5;
      for (let x = -4 - ((this.pos % passo) + passo) % passo; x < LX + 4; x += passo) this.chao(ctx, x, x + 2.4, MEIO - 0.25, MEIO + 0.25, 0, '#f0c33c');
    }
    ctx.restore();
    // o que passa, de trás para a frente: árvores e postes (ou a cerca) de lá, o carro, a van, os arbustos e árvores de cá
    const passa = (n: number, passo: number, y: number, f: (x: number, i: number) => void) => {
      for (let i = 0; i < n; i++) {
        const x = (((i * passo + aleat(i, y) * 3 - this.pos) % (n * passo)) + n * passo) % (n * passo) - 2;
        if (dentro(x, y) && dentro(x + 1.5, y) && dentro(x - 1.5, y)) f(x, i);
      }
    };
    passa(6, 8, 1.6, (x, i) => this.arvore(ctx, x, 1.6 + aleat(i, 40) * 0.6, 1, noite, i % 3));
    if (!terra) passa(3, 14, 3.4, (x) => this.poste(ctx, x, 3.4, noite));
    else passa(10, 4, 3.3, (x) => this.cerca(ctx, x, 3.3, noite));
    this.carro(ctx, noite);
    this.van(ctx, now, noite, figuras);
    passa(5, 8, 19, (x) => this.arbusto(ctx, x, 19, noite));
    passa(3, 13, 20.2, (x, i) => this.arvore(ctx, x, 20.2, 0.75, noite, (i + 1) % 3));
  }
}
