import type { ViagemInfo } from '@crona/shared';

/**
 * O dioraminha da viagem (07/10), em pixel art, no estilo das referências do Felipe: um bloco pequeno de estrada
 * flutuando no céu, com as bordas de terra aparentes, a van preta no meio (sobe e desce de leve, as rodas giram de
 * verdade) e o mundo passando em cima do bloco: árvores, postes, arbustos e um carro de vez em quando na outra mão.
 * Desenhado em código numa tela pequena e ampliado com pixels grandes; a arte do Códex (a van e os carros com as rodas
 * à parte) entra depois no lugar do desenho.
 */

/** o bloco: o comprimento (ao longo da estrada) e a largura, em unidades; cada unidade anda (K, K/2) na tela */
const LX = 34;
const LY = 18;
const K = 3;
/** a espessura do bloco (a terra aparente embaixo), em px */
const BOLO = 14;
/** unidades por segundo com a velocidade em 1 */
const UNID_POR_S = 7;

const CONTORNO = '#17121c';

type Pt = [number, number];

const aleat = (n: number, s = 0) => {
  const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const CEUS: Record<string, [string, string, string]> = {
  dia: ['#7fcfee', '#bfe9f6', '#ffffff'],
  entardecer: ['#e9845a', '#f6c27a', '#ffe7c4'],
  noite: ['#141c3a', '#2b3a72', '#a9b6e8'],
};

export class DioramaViagem {
  private pos = 0;
  private vel = 0;
  private ultimo = 0;
  /** o canto de trás do bloco na tela (muda com o tamanho da tela e com o sobe-desce) */
  private ox = 0;
  private oy = 0;

  private p(x: number, y: number, z = 0): Pt {
    return [Math.round(this.ox + (x - y) * K), Math.round(this.oy + ((x + y) * K) / 2 - z)];
  }

  private poli(ctx: CanvasRenderingContext2D, pts: Pt[], cor: string, contorno = false) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    if (contorno) {
      ctx.strokeStyle = CONTORNO;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Uma caixa de x0..x1, y0..y1, z0..z1 (z em px): as faces que a câmera vê (a de +y e a de +x) e o topo. */
  private caixa(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, topo: string, lado: string, frente: string) {
    this.poli(ctx, [this.p(x0, y1, z0), this.p(x1, y1, z0), this.p(x1, y1, z1), this.p(x0, y1, z1)], lado, true);
    this.poli(ctx, [this.p(x1, y0, z0), this.p(x1, y1, z0), this.p(x1, y1, z1), this.p(x1, y0, z1)], frente, true);
    this.poli(ctx, [this.p(x0, y0, z1), this.p(x1, y0, z1), this.p(x1, y1, z1), this.p(x0, y1, z1)], topo, true);
  }

  /** Um retângulo na face de +y (y fixo) de x0..x1, z0..z1. */
  private naLateral(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, z0: number, z1: number, cor: string) {
    this.poli(ctx, [this.p(x0, y, z0), this.p(x1, y, z0), this.p(x1, y, z1), this.p(x0, y, z1)], cor);
  }

  /** Um retângulo na face da frente (x fixo) de y0..y1, z0..z1. */
  private naFrente(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, z0: number, z1: number, cor: string) {
    this.poli(ctx, [this.p(x, y0, z0), this.p(x, y1, z0), this.p(x, y1, z1), this.p(x, y0, z1)], cor);
  }

  /** A roda na lateral de +y: o pneu, o aro e dois raios que giram (`ang`, em radianos). */
  private roda(ctx: CanvasRenderingContext2D, cx: number, y: number, zc: number, ang: number) {
    const R = 1.3;
    const RZ = 3.8;
    const pt = (a: number, f: number): Pt => {
      const [x, yy] = this.p(cx + Math.cos(a) * R * f, y, zc + Math.sin(a) * RZ * f);
      return [x, yy];
    };
    const circ = (f: number) => Array.from({ length: 14 }, (_, i) => pt((i / 14) * Math.PI * 2, f));
    this.poli(ctx, circ(1), '#1d1d23', true);
    this.poli(ctx, circ(0.55), '#8d929c');
    ctx.fillStyle = '#3a3a44';
    for (const a of [ang, ang + Math.PI]) {
      const [x0, y0] = pt(a, 0.1);
      const [x1, y1] = pt(a, 0.55);
      ctx.fillRect(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), 1, 1);
      ctx.fillRect(x1, y1, 1, 1);
    }
    const [hx, hy] = pt(0, 0);
    ctx.fillStyle = '#c9ccd2';
    ctx.fillRect(hx, hy, 1, 1);
  }

  private arvore(ctx: CanvasRenderingContext2D, x: number, y: number, tam: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(bx - 3, by, 7, 2);
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(bx, by - 5 * tam, 2, 5 * tam);
    const copa: [number, number, number, string][] = [
      [0, -9, 6, noite ? '#1e4a33' : '#2f8a3b'],
      [-2, -11, 4, noite ? '#25583c' : '#3fa54a'],
      [2, -12, 3.5, noite ? '#2c6545' : '#5fcf63'],
    ];
    for (const [dx, dy, r, c] of copa) {
      ctx.fillStyle = CONTORNO;
      ctx.beginPath();
      ctx.arc(bx + 1 + dx, by + dy * tam, r * tam + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [dx, dy, r, c] of copa) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(bx + 1 + dx, by + dy * tam, r * tam, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private poste(ctx: CanvasRenderingContext2D, x: number, y: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 22, 3, 22);
    ctx.fillStyle = '#7a7f8a';
    ctx.fillRect(bx, by - 21, 1, 21);
    ctx.fillRect(bx, by - 22, 5, 1);
    ctx.fillStyle = noite ? '#ffe9a0' : '#d8d6c4';
    ctx.fillRect(bx + 4, by - 21, 2, 1);
    if (noite) {
      ctx.fillStyle = 'rgba(255,233,160,0.18)';
      ctx.beginPath();
      ctx.moveTo(bx + 5, by - 20);
      ctx.lineTo(bx + 14, by + 4);
      ctx.lineTo(bx - 4, by + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  private arbusto(ctx: CanvasRenderingContext2D, x: number, y: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
    const bolas: [number, number, number][] = [[-2, -2, 3], [2, -2, 3], [0, -4, 3]];
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
    ctx.fillStyle = noite ? '#2f6a48' : '#62c561';
    ctx.fillRect(bx - 1, by - 6, 2, 1);
  }

  /** A van preta, parada no meio do bloco (o mundo é que anda), com as rodas girando. */
  private van(ctx: CanvasRenderingContext2D, now: number, noite: boolean) {
    const x0 = 12;
    const x1 = 21;
    const y0 = 9.2;
    const y1 = 12.8;
    // a trepidação do motor: um pixel, de vez em quando
    const z = 3 + (Math.sin(now / 90) > 0.6 ? 1 : 0);
    // a sombra na estrada
    this.poli(ctx, [this.p(x0 - 0.5, y0 + 0.6, 0), this.p(x1 + 3, y0 + 0.6, 0), this.p(x1 + 3, y1 + 1.2, 0), this.p(x0 - 0.5, y1 + 1.2, 0)], 'rgba(0,0,0,0.3)');
    // os faróis à noite: o facho na estrada, à frente
    if (noite)
      this.poli(ctx, [this.p(x1 + 2.6, y0 + 0.4, 0), this.p(x1 + 11, y0 - 1.2, 0), this.p(x1 + 11, y1 + 1.2, 0), this.p(x1 + 2.6, y1 - 0.4, 0)], 'rgba(255,236,170,0.22)');
    // o corpo e o capô
    this.caixa(ctx, x0, x1, y0, y1, z, z + 14, '#4a4a58', '#2c2c36', '#25252e');
    this.caixa(ctx, x1, x1 + 2.6, y0 + 0.2, y1 - 0.2, z, z + 8, '#3c3c48', '#2c2c36', '#202028');
    // o brilho da lataria na beira do teto
    this.naLateral(ctx, y1, x0, x1, z + 13, z + 14, '#5a5a6a');
    // o para-brisa, as janelas e a porta de correr
    this.naFrente(ctx, x1, y0 + 0.6, y1 - 0.6, z + 9, z + 14, noite ? '#3b5a78' : '#7fb2cf');
    for (const [a, b] of [[12.8, 15], [15.6, 17.8], [18.4, 20.6]] as const) {
      this.naLateral(ctx, y1, a, b, z + 7, z + 12, noite ? '#36506a' : '#8cc4de');
      this.naLateral(ctx, y1, a, a + 0.5, z + 8, z + 12, noite ? '#4a6a88' : '#c4e6f4');
    }
    // a porta de correr e a maçaneta, e o retrovisor
    this.naLateral(ctx, y1, 15.3, 15.4, z + 1, z + 12, '#1a1a20');
    this.naLateral(ctx, y1, 16.2, 16.9, z + 6, z + 6.6, '#9a9aa6');
    this.naLateral(ctx, y1 + 0.4, x1 - 0.4, x1 + 0.3, z + 9, z + 11, '#1a1a20');
    // os faróis e a grade
    this.naFrente(ctx, x1 + 2.6, y0 + 0.5, y0 + 1.2, z + 4, z + 6, '#f2d77a');
    this.naFrente(ctx, x1 + 2.6, y1 - 1.2, y1 - 0.5, z + 4, z + 6, '#f2d77a');
    this.naFrente(ctx, x1 + 2.6, y0 + 1.5, y1 - 1.5, z + 3, z + 5, '#15151a');
    // a lanterna de trás (aparece na quina)
    this.naLateral(ctx, y1, x0, x0 + 0.4, z + 7, z + 10, '#c8322a');
    // as rodas de perto, girando com o chão
    const ang = -this.pos / 1.3;
    this.roda(ctx, 14.2, y1, 3.6, ang);
    this.roda(ctx, 21.4, y1, 3.6, ang);
  }

  /** Um carro na outra mão, de vez em quando, indo para o outro lado. */
  private carro(ctx: CanvasRenderingContext2D, noite: boolean) {
    const ciclo = 70;
    const t = (this.pos * 1.9) % ciclo;
    const n = Math.floor((this.pos * 1.9) / ciclo);
    const x0 = LX - t;
    const len = 7;
    if (x0 < 0.5 || x0 + len > LX - 0.5) return;
    const cores = ['#d8473c', '#f0c33c', '#eef0f2', '#3f6fd8'];
    const cor = cores[n % cores.length];
    const y0 = 4;
    const y1 = 7;
    const z = 2;
    this.poli(ctx, [this.p(x0, y0 + 0.5, 0), this.p(x0 + len, y0 + 0.5, 0), this.p(x0 + len, y1 + 0.8, 0), this.p(x0, y1 + 0.8, 0)], 'rgba(0,0,0,0.28)');
    this.caixa(ctx, x0, x0 + len, y0, y1, z, z + 5, cor, cor, cor);
    this.caixa(ctx, x0 + 1.6, x0 + 5, y0 + 0.3, y1 - 0.3, z + 5, z + 9, '#d9dde2', noite ? '#36506a' : '#7fb2cf', noite ? '#36506a' : '#7fb2cf');
    const ang = (this.pos * 0.9) / 1.0;
    for (const x of [x0 + 1.6, x0 + 5.4]) {
      const [bx, by] = this.p(x, y1, z);
      ctx.fillStyle = '#1d1d23';
      ctx.fillRect(bx - 2, by - 2, 4, 3);
      ctx.fillStyle = '#8d929c';
      ctx.fillRect(bx - 1 + (Math.floor(ang * 2) % 2), by - 1, 1, 1);
    }
  }

  /** Desenha a cena inteira (o céu, as nuvens e o bloco) numa tela pequena de `w` × `h`. */
  desenhar(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, v: ViagemInfo) {
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
      for (let i = 0; i < 40; i++) if (Math.sin(now / 700 + i) > -0.6) ctx.fillRect(Math.floor(aleat(i, 1) * w), Math.floor(aleat(i, 2) * h * 0.7), 1, 1);
    }
    // as nuvens de trás, passando devagar
    for (let i = 0; i < 6; i++) this.nuvem(ctx, ((aleat(i, 3) * w - now / (110 + i * 30)) % (w + 40) + w + 40) % (w + 40) - 20, 10 + aleat(i, 4) * h * 0.75, nuv, 0.55);
    // o bloco: o meio dele no meio da tela, subindo e descendo devagar
    const bob = Math.round(Math.sin(now / 1100) * 2);
    this.ox = Math.round(w / 2 - (LX - LY) * K * 0.5);
    this.oy = Math.round(h / 2 - ((LX + LY) * K) / 4 - 6 + bob);
    this.bloco(ctx, v, noite);
    // as nuvens da frente, poucas
    for (let i = 0; i < 2; i++) this.nuvem(ctx, ((aleat(i, 9) * w - now / (70 + i * 25)) % (w + 40) + w + 40) % (w + 40) - 20, h * (0.72 + i * 0.12), nuv, 0.9);
  }

  private nuvem(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, a: number) {
    const bx = Math.round(x);
    const by = Math.round(y);
    ctx.globalAlpha = a;
    ctx.fillStyle = cor;
    ctx.fillRect(bx - 8, by, 17, 3);
    ctx.fillRect(bx - 5, by - 3, 11, 3);
    ctx.fillRect(bx - 2, by - 5, 5, 2);
    ctx.globalAlpha = 1;
  }

  private bloco(ctx: CanvasRenderingContext2D, v: ViagemInfo, noite: boolean) {
    const terra = v.cenario === 'terra';
    const gr = noite ? ['#2f6a3c', '#3b7d47'] : ['#5fbf4f', '#77d063'];
    // a terra aparente embaixo do bloco: a face da frente e a do lado, mais escuras para baixo
    const ladoY: Pt[] = [this.p(0, LY, 0), this.p(LX, LY, 0), this.p(LX, LY, -BOLO), this.p(0, LY, -BOLO)];
    const ladoX: Pt[] = [this.p(LX, 0, 0), this.p(LX, LY, 0), this.p(LX, LY, -BOLO), this.p(LX, 0, -BOLO)];
    this.poli(ctx, ladoY, noite ? '#4a3a52' : '#8a6a55', true);
    this.poli(ctx, ladoX, noite ? '#3a2c44' : '#6e5444', true);
    // as camadas de pedra na terra
    ctx.fillStyle = noite ? '#3a2e44' : '#5e4636';
    for (let i = 0; i < 26; i++) {
      const [px, py] = this.p(aleat(i, 5) * LX, LY, -3 - aleat(i, 6) * (BOLO - 5));
      ctx.fillRect(px, py, 3, 1);
    }
    for (let i = 0; i < 14; i++) {
      const [px, py] = this.p(LX, aleat(i, 7) * LY, -3 - aleat(i, 8) * (BOLO - 5));
      ctx.fillRect(px, py, 2, 1);
    }
    // a grama em cima, com a beira mais clara
    this.poli(ctx, [this.p(0, 0), this.p(LX, 0), this.p(LX, LY), this.p(0, LY)], gr[0], true);
    ctx.fillStyle = gr[1];
    for (let i = 0; i < 40; i++) {
      const x = (((aleat(i, 10) * LX - this.pos) % LX) + LX) % LX;
      const y = aleat(i, 11) * LY;
      if ((y > 3 && y < 14) || x < 0.5 || x > LX - 1) continue;
      const [px, py] = this.p(x, y);
      ctx.fillRect(px, py, 2, 1);
    }
    // a estrada: asfalto com a faixa amarela tracejada, ou terra batida com as marcas das rodas
    this.poli(ctx, [this.p(0, 3.2), this.p(LX, 3.2), this.p(LX, 14), this.p(0, 14)], terra ? (noite ? '#6a5236' : '#b0895a') : noite ? '#23252c' : '#3a3d45', true);
    if (terra) {
      for (const y of [5.2, 6.4, 10, 11.6]) this.poli(ctx, [this.p(0, y), this.p(LX, y), this.p(LX, y + 0.5), this.p(0, y + 0.5)], noite ? '#5c4630' : '#9a754a');
    } else {
      const passo = 5;
      for (let x = -((this.pos % passo) + passo) % passo; x < LX; x += passo) {
        const a = Math.max(0, x);
        const b = Math.min(LX, x + 2.4);
        if (b > a) this.poli(ctx, [this.p(a, 8.4), this.p(b, 8.4), this.p(b, 8.9), this.p(a, 8.9)], '#f0c33c');
      }
      this.poli(ctx, [this.p(0, 13.3), this.p(LX, 13.3), this.p(LX, 13.6), this.p(0, 13.6)], '#d9dbde');
      this.poli(ctx, [this.p(0, 3.6), this.p(LX, 3.6), this.p(LX, 3.9), this.p(0, 3.9)], '#d9dbde');
    }
    // o que passa, de trás para a frente: as árvores e os postes do lado de lá, o carro, a van, os arbustos de cá
    const passa = (n: number, passo: number, f: (x: number) => void) => {
      for (let i = 0; i < n; i++) {
        const x = (((i * passo + aleat(i, 12) * 3 - this.pos) % (n * passo)) + n * passo) % (n * passo);
        if (x > 1 && x < LX - 1.5) f(x);
      }
    };
    passa(5, 8, (x) => this.arvore(ctx, x, 1.2 + aleat(Math.floor(x), 13) * 0.8, 1, noite));
    if (!terra) passa(3, 13, (x) => this.poste(ctx, x, 2.6, noite));
    else passa(9, 4, (x) => this.cerca(ctx, x, 2.4, noite));
    this.carro(ctx, noite);
    this.van(ctx, performance.now(), noite);
    passa(4, 9, (x) => this.arbusto(ctx, x, 16, noite));
    passa(3, 12, (x) => this.arvore(ctx, x, 16.4, 0.7, noite));
  }

  private cerca(ctx: CanvasRenderingContext2D, x: number, y: number, noite: boolean) {
    const [bx, by] = this.p(x, y, 0);
    ctx.fillStyle = CONTORNO;
    ctx.fillRect(bx - 1, by - 7, 3, 7);
    ctx.fillStyle = noite ? '#5a4232' : '#8a6a44';
    ctx.fillRect(bx, by - 6, 1, 6);
    ctx.fillRect(bx - 5, by - 5, 11, 1);
  }
}
