import { VAN, Z_PER_M, type ViagemInfo } from '@crona/shared';
import { hash, shade } from './color';
import { iso, unIso, Z_PX } from './iso';
import { imagemDoMapa } from './mapaImagem';
import { texturaPiso } from './texturas';

/**
 * O mundo da Viagem (07/10), desenhado em código (a arte do Códex entra depois): a van fica parada na
 * tela e o chão, a estrada e o que está na beira passam por baixo dela, de +x para -x. Tudo em casas
 * (0,75 m); a van ocupa x de 0 a 8 e y de 0 a 3 (VAN). O mundo se desenha em três passadas, na câmera do
 * tabuleiro: `chao` (a estrada, a beira e o que passa lá no fundo), `casco` (o casco da van que fica atrás
 * das peças) e `frente` (o que passa na frente: a beirada da van, o brilho dos faróis).
 */

/** O chão fica um pouco abaixo do piso da van (a espessura da laje). */
const CHAO_Z = -0.5;
/** Casas por segundo com a velocidade em 1 (o mundo passando). Devagar de propósito (07/10): é a ilustração de um momento, leve e suave. */
const CASAS_POR_S = 5;

/** Quanto o piso da van fica acima do chão (debaixo das rodas), em metros: o desenho do casco tem a base lá embaixo. */
const PISO_NA_ARTE_M = 0.45;
const ALTURA_CASCO = 1.7;
const ASFALTO = '#2b2d33';
const FAIXA_AMARELA = '#d8b43a';
const FAIXA_BRANCA = '#cfd2d4';

/** A estrada: a faixa da van vai de y = -0.75 a 3.75; a outra, do outro lado da linha amarela. */
const PISTA = { y0: -5.25, y1: 5.25, centro: -0.75 };

const aleat = (...n: number[]) => hash(...n);

function caixa(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cor: string, brilho = 0.12) {
  const top = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)];
  const fy = [iso(x0, y1, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x0, y1, z1)];
  const fx = [iso(x1, y0, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x1, y0, z1)];
  const quad = (pts: [number, number][], c: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(8,6,8,0.8)';
    ctx.stroke();
  };
  quad(fy, shade(cor, 0));
  quad(fx, shade(cor, -0.28));
  quad(top, shade(cor, brilho));
}

export class MundoViagem {
  /** quanto o mundo andou (casas) */
  private pos = 0;
  /** a velocidade de agora (0 a 1), que vai atrás da pedida, para o arranque e a parada serem suaves */
  private vel = 0;
  private ultimo = 0;
  private asfalto: HTMLCanvasElement | null = null;
  /** a arte da viagem (public/arte/viagem): o casco, a árvore, o poste e os veículos, com a âncora de cada um */
  private pecas: Record<string, { arquivo: string; ax: number; ay: number; escala: number }> | null = null;
  private pedido = false;

  private arte(nome: string) {
    if (!this.pecas) {
      if (!this.pedido) {
        this.pedido = true;
        fetch('/arte/viagem/viagem.json')
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => (this.pecas = j ?? {}))
          .catch(() => (this.pecas = {}));
      }
      return null;
    }
    const m = this.pecas[nome];
    const img = m ? imagemDoMapa(`/arte/viagem/${m.arquivo}`) : null;
    return m && img ? { ...m, img } : null;
  }

  /** Uma peça de arte no chão (x, y em casas): o ponto de apoio dela cai nele. */
  private peca(ctx: CanvasRenderingContext2D, nome: string, x: number, y: number, z = CHAO_Z) {
    const a = this.arte(nome);
    if (!a) return false;
    const [bx, by] = iso(x, y, z);
    ctx.drawImage(a.img, bx - a.ax * a.escala, by - a.ay * a.escala, a.img.naturalWidth * a.escala, a.img.naturalHeight * a.escala);
    return true;
  }

  /** Anda o mundo: chamado uma vez por quadro. */
  atualizar(now: number, v: ViagemInfo) {
    const dt = this.ultimo ? Math.min(0.1, (now - this.ultimo) / 1000) : 0;
    this.ultimo = now;
    this.vel += (v.velocidade - this.vel) * Math.min(1, dt * 1.6);
    this.pos += this.vel * CASAS_POR_S * dt;
  }

  get velocidade() {
    return this.vel;
  }

  /** O balanço da van na estrada, em px de tela (zoom 1): sobe e desce de leve, mais com a velocidade. */
  balanco(now: number): number {
    const k = 0.25 + this.vel * 0.9;
    return (Math.sin(now / 173) * 0.5 + Math.sin(now / 71 + 1.3) * 0.3) * k;
  }

  private padraoAsfalto(ctx: CanvasRenderingContext2D): CanvasPattern | string {
    if (!this.asfalto) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      g.fillStyle = ASFALTO;
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        const r = aleat(i, 1);
        g.fillStyle = r < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
        g.fillRect(Math.floor(aleat(i, 2) * 128), Math.floor(aleat(i, 3) * 128), r < 0.12 ? 2 : 1, 1);
      }
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        let x = aleat(i, 9) * 128;
        let y = aleat(i, 10) * 128;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) g.lineTo((x += (aleat(i, k, 11) - 0.5) * 30), (y += (aleat(i, k, 12) - 0.5) * 30));
        g.stroke();
      }
      this.asfalto = c;
    }
    return ctx.createPattern(this.asfalto, 'repeat') ?? ASFALTO;
  }

  /** A caixa visível do canvas, em casas, no plano do chão. */
  private visivel(ctx: CanvasRenderingContext2D) {
    const inv = ctx.getTransform().inverse();
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [px, py] of [[0, 0], [w, 0], [w, h], [0, h]]) {
      const p = inv.transformPoint({ x: px, y: py });
      const [cx, cy] = unIso(p.x, p.y, CHAO_Z);
      x0 = Math.min(x0, cx);
      x1 = Math.max(x1, cx);
      y0 = Math.min(y0, cy);
      y1 = Math.max(y1, cy);
    }
    return { x0: Math.floor(x0) - 4, x1: Math.ceil(x1) + 4, y0: Math.floor(y0) - 4, y1: Math.ceil(y1) + 4 };
  }

  // ---------------------------------------------------------------- o que passa por baixo e lá no fundo

  chao(ctx: CanvasRenderingContext2D, v: ViagemInfo) {
    const b = this.visivel(ctx);
    ctx.save();
    // o plano do chão: a casa (x, y) vai para o losango dela, um pouco abaixo do piso da van
    ctx.translate(0, -CHAO_Z * Z_PX);
    ctx.transform(32, 16, -32, 16, 0, 0);
    const terra = v.cenario === 'terra';
    // a beira: grama (e, na estrada de terra, o leito de terra batida)
    const grama = texturaPiso('grama');
    const padGrama = grama?.img.complete && grama.img.naturalWidth ? ctx.createPattern(grama.img, 'repeat') : null;
    if (padGrama) padGrama.setTransform(new DOMMatrix().translate(-this.pos, 0).scale(grama!.casas / grama!.img.naturalWidth));
    ctx.fillStyle = padGrama ?? '#4d6a2e';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    // a pista
    if (terra) {
      const t = texturaPiso('estrada');
      const pad = t?.img.complete && t.img.naturalWidth ? ctx.createPattern(t.img, 'repeat') : null;
      if (pad) pad.setTransform(new DOMMatrix().translate(-this.pos, 0).scale(t!.casas / t!.img.naturalWidth));
      ctx.fillStyle = pad ?? '#86663f';
      ctx.fillRect(b.x0, PISTA.y0 + 1.5, b.x1 - b.x0, PISTA.y1 - PISTA.y0 - 3);
      // as marcas de roda: duas trilhas mais escuras
      ctx.fillStyle = 'rgba(40,24,10,0.22)';
      for (const yc of [-2.9, 0.5, 2.7]) ctx.fillRect(b.x0, yc - 0.35, b.x1 - b.x0, 0.7);
    } else {
      const pad = this.padraoAsfalto(ctx);
      if (typeof pad !== 'string') pad.setTransform(new DOMMatrix().translate(-this.pos, 0).scale(4 / 128));
      ctx.fillStyle = pad;
      ctx.fillRect(b.x0, PISTA.y0, b.x1 - b.x0, PISTA.y1 - PISTA.y0);
      this.faixas(ctx, b);
    }
    this.farois(ctx, v);
    // a sombra da van no chão: uma mancha macia debaixo do casco, um pouco para o lado da luz (baixo e à direita)
    ctx.save();
    ctx.translate(VAN.comprimento / 2 + 0.1, VAN.largura / 2 + 0.25);
    ctx.scale(VAN.comprimento / 2 + 0.9, VAN.largura / 2 + 0.75);
    const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    sombra.addColorStop(0, 'rgba(0,0,0,0.55)');
    sombra.addColorStop(0.6, 'rgba(0,0,0,0.36)');
    sombra.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sombra;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    ctx.restore();
    this.fundo(ctx, v, b);
  }

  /** As linhas da rodovia: a amarela dupla no meio e as brancas nas bordas, andando com o mundo. */
  private faixas(ctx: CanvasRenderingContext2D, b: { x0: number; x1: number }) {
    // a amarela do meio é tracejada: é ela que mostra o mundo passando (uma linha corrida parece parada)
    ctx.fillStyle = FAIXA_AMARELA;
    const passo = 4;
    for (let x = Math.floor((b.x0 + this.pos) / passo) * passo - this.pos; x < b.x1; x += passo) ctx.fillRect(x, PISTA.centro - 0.08, 2, 0.16);
    ctx.fillStyle = FAIXA_BRANCA;
    ctx.fillRect(b.x0, PISTA.y1 - 0.45, b.x1 - b.x0, 0.12);
    ctx.fillRect(b.x0, PISTA.y0 + 0.35, b.x1 - b.x0, 0.12);
  }

  private farois(ctx: CanvasRenderingContext2D, v: ViagemInfo) {
    if (v.hora === 'dia') return;
    const f = v.hora === 'noite' ? 0.5 : 0.22;
    for (const y of [0.6, 2.4]) {
      const g = ctx.createLinearGradient(VAN.comprimento + 0.2, 0, VAN.comprimento + 14, 0);
      g.addColorStop(0, `rgba(255,236,180,${f})`);
      g.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(VAN.comprimento + 0.2, y - 0.2);
      ctx.lineTo(VAN.comprimento + 14, y - 2.2);
      ctx.lineTo(VAN.comprimento + 14, y + 2.2);
      ctx.lineTo(VAN.comprimento + 0.2, y + 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Lá no fundo (y negativo, atrás da van): uma árvore de vez em quando, um poste mais raro e um carro que passa. Pouca coisa de propósito. */
  private fundo(ctx: CanvasRenderingContext2D, v: ViagemInfo, b: { x0: number; x1: number }) {
    const passo = 14;
    const primeiro = Math.floor((b.x0 + this.pos) / passo) - 1;
    const ultimo = Math.ceil((b.x1 + this.pos) / passo) + 1;
    for (let i = primeiro; i <= ultimo; i++) {
      const x = i * passo - this.pos;
      if (aleat(i, 5) > 0.35) this.peca(ctx, 'arvore', x + aleat(i, 7) * 6, -9.5 - aleat(i, 6) * 3);
      // o poste de luz da rodovia, na beira de lá, a cada quatro
      if (v.cenario === 'rodovia' && i % 4 === 0) this.peca(ctx, 'poste', x + 3, -6.6);
    }
    this.carros(ctx, v);
  }

  /** Um veículo de cada vez, na outra mão, e raro: o sedan e o caminhão se revezam. */
  private carros(ctx: CanvasRenderingContext2D, v: ViagemInfo) {
    if (this.vel < 0.05) return;
    const periodo = 190;
    const n = Math.floor((this.pos * 1.9 + 60) / periodo);
    const x = periodo - (((this.pos * 1.9 + 60) % periodo) + periodo) % periodo - 40;
    // o centro do veículo na mão de lá (y = -3): a imagem se apoia na quina de baixo, então o centro é recuado
    const [nome, L, W] = n % 2 ? (['caminhao', 8, 2.5] as const) : (['sedan', 4.4, 1.8] as const);
    const d = (L + W) / 4 / 0.75;
    this.peca(ctx, nome, x + d, -3.0 + d);
    void v;
  }

  private arvore(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, seed: number) {
    const [bx, by] = iso(x, y, CHAO_Z);
    const alto = h * Z_PX * 0.9;
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(bx - 3, by - alto * 0.55, 6, alto * 0.55);
    const folhas = ['#2f5a2c', '#3c7034', '#497f3a'];
    for (let i = 0; i < 4; i++) {
      const cx = bx + (aleat(seed, i, 1) - 0.5) * 26;
      const cy = by - alto * (0.55 + i * 0.13) - aleat(seed, i, 2) * 6;
      const r = 17 + aleat(seed, i, 3) * 7;
      ctx.fillStyle = folhas[i % 3];
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private poste(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const [bx, by] = iso(x, y, CHAO_Z);
    ctx.strokeStyle = '#4c4f56';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - 150);
    ctx.lineTo(bx + 26, by - 156);
    ctx.stroke();
    ctx.fillStyle = '#e8e2c8';
    ctx.fillRect(bx + 22, by - 158, 12, 4);
  }

  // ---------------------------------------------------------------- o casco da van, atrás das peças

  casco(ctx: CanvasRenderingContext2D, v: ViagemInfo) {
    // a arte: o casco cortado, com a base debaixo das rodas (o piso da van fica PISO_NA_ARTE_M acima dela)
    if (this.peca(ctx, 'van-casco', 0, 0, -PISO_NA_ARTE_M * Z_PER_M)) return;
    const L = VAN.comprimento;
    const W = VAN.largura;
    const H = ALTURA_CASCO;
    const t = 0.16;
    const corpo = '#17181c';
    const interior = '#2b2c33';
    // a traseira: o para-choque e a parede de trás (com os vidros das portas)
    caixa(ctx, -0.7, -0.2, 0.1, W - 0.1, 0, 0.45, '#101114');
    this.parede(ctx, 'x', 0, -t, 0, W, H, corpo, interior, [[0.3, 1.25], [1.75, 2.7]]);
    // a lateral de lá, com os vidros (por onde se vê o mundo)
    this.parede(ctx, 'y', 0, -t, 0, L, H, corpo, interior, [[0.5, 2.3], [2.8, 4.6], [5.1, 6.9]]);
    // o capô e a frente (o para-brisa não existe: a van é aberta para a câmera)
    caixa(ctx, L, L + 2.5, 0.15, W - 0.15, 0, 0.62, corpo, 0.2);
    caixa(ctx, L + 2.5, L + 2.75, 0.2, W - 0.2, 0, 0.4, '#0d0e10');
    const farol = v.hora === 'dia' ? '#d8d6c4' : '#fff2bf';
    for (const y of [0.35, W - 0.55]) caixa(ctx, L + 2.5, L + 2.62, y, y + 0.3, 0.18, 0.34, farol, 0.3);
    // as rodas, de fora do casco
    for (const x of [1.6, 6.7]) {
      this.roda(ctx, x, W + 0.05);
      this.roda(ctx, x, -0.05);
    }
  }

  /** O que fica na frente das peças: a beirada de perto da van (baixa, para não esconder ninguém). */
  frente(ctx: CanvasRenderingContext2D) {
    // com a arte, a beirada de perto já está no desenho
    if (this.arte('van-casco')) return;
    const L = VAN.comprimento;
    const W = VAN.largura;
    caixa(ctx, 0, L, W, W + 0.12, 0, 0.3, '#17181c', 0.2);
    caixa(ctx, L, L + 0.12, 0, W + 0.12, 0, 0.3, '#17181c', 0.2);
  }

  /** Uma parede de casco: o painel de cor `corpo` por fora, `interior` por dentro, com os vidros (janelas) vazados. */
  private parede(ctx: CanvasRenderingContext2D, eixo: 'x' | 'y', fixo: number, grossura: number, a0: number, a1: number, h: number, corpo: string, interior: string, janelas: [number, number][]) {
    const pt = (a: number, z: number): [number, number] => (eixo === 'y' ? iso(a, fixo, z) : iso(fixo, a, z));
    // o lado de dentro (o que se vê)
    ctx.beginPath();
    const quad = (x0: number, x1: number, z0: number, z1: number) => {
      const p = [pt(x0, z0), pt(x1, z0), pt(x1, z1), pt(x0, z1)];
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
    };
    quad(a0, a1, 0, h * Z_PER_M);
    for (const [j0, j1] of janelas) quad(j0, j1, 0.95 * Z_PER_M, 1.55 * Z_PER_M);
    ctx.fillStyle = interior;
    ctx.fill('evenodd');
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(8,6,8,0.85)';
    ctx.stroke();
    // o brilho do vidro, bem leve, e o reflexo
    for (const [j0, j1] of janelas) {
      ctx.beginPath();
      const p = [pt(j0, 0.95 * Z_PER_M), pt(j1, 0.95 * Z_PER_M), pt(j1, 1.55 * Z_PER_M), pt(j0, 1.55 * Z_PER_M)];
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(150,185,225,0.07)';
      ctx.fill();
    }
    // o topo da parede, na espessura
    const zt = h * Z_PER_M;
    const top = eixo === 'y' ? [iso(a0, fixo + grossura, zt), iso(a1, fixo + grossura, zt), iso(a1, fixo, zt), iso(a0, fixo, zt)] : [iso(fixo + grossura, a0, zt), iso(fixo + grossura, a1, zt), iso(fixo, a1, zt), iso(fixo, a0, zt)];
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(top[i][0], top[i][1]);
    ctx.closePath();
    ctx.fillStyle = shade(corpo, 0.22);
    ctx.fill();
  }

  private roda(ctx: CanvasRenderingContext2D, cx: number, y: number) {
    const r = 0.42;
    const pts: [number, number][] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      pts.push(iso(cx + (Math.cos(a) * r) / 0.75, y, CHAO_Z + 0.25 + Math.sin(a) * r * Z_PER_M + r * Z_PER_M * 0.4));
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = '#0c0c0e';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#2b2c31';
    ctx.stroke();
    const [hx, hy] = iso(cx, y, CHAO_Z + 0.25 + r * Z_PER_M * 0.4);
    ctx.fillStyle = '#6c7078';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------- o clima, por cima de tudo

  /** A chuva (traços na diagonal), o relâmpago da tempestade e a neblina, em cima da cena inteira. `dpr`: pixels por pixel de tela. */
  clima(ctx: CanvasRenderingContext2D, v: ViagemInfo, now: number, dpr: number) {
    const c = v.clima ?? 'limpo';
    if (c === 'limpo') return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (c === 'neblina') {
      ctx.fillStyle = 'rgba(176,186,198,0.2)';
      ctx.fillRect(0, 0, w, h);
      // mantas de névoa andando devagar, mais densas embaixo
      for (let i = 0; i < 5; i++) {
        const cx = (((now / (90 + i * 25)) * dpr + i * w * 0.37) % (w * 1.6)) - w * 0.3;
        const cy = h * (0.25 + i * 0.17);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.42);
        g.addColorStop(0, 'rgba(200,208,218,0.26)');
        g.addColorStop(1, 'rgba(200,208,218,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
      return;
    }
    // a chuva: cada gota cai na vertical (com o vento puxando para trás) e recomeça em cima
    const forte = c === 'tempestade';
    const n = Math.round((forte ? 300 : 150) * Math.min(2.2, (w * h) / (dpr * dpr * 1280 * 720)));
    ctx.strokeStyle = forte ? 'rgba(205,220,238,0.42)' : 'rgba(205,220,238,0.32)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.lineCap = 'round';
    const vel = (forte ? 1250 : 950) * dpr;
    const vento = forte ? 0.42 : 0.26;
    const tam = (forte ? 26 : 19) * dpr;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const fase = aleat(i, 41);
      const y = (((now / 1000) * vel * (0.85 + aleat(i, 43) * 0.3) + fase * (h + tam * 2)) % (h + tam * 2)) - tam;
      const x = ((aleat(i, 42) * (w + h * vento) - y * vento) % (w + h * vento)) - (h * vento) / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x - tam * vento, y + tam);
    }
    ctx.stroke();
    // o céu fecha com a chuva
    ctx.fillStyle = forte ? 'rgba(18,24,38,0.28)' : 'rgba(30,38,52,0.14)';
    ctx.fillRect(0, 0, w, h);
    if (forte) {
      // o relâmpago: um clarão duplo, de tempos em tempos
      const ciclo = Math.floor(now / 8000);
      const t = now - (ciclo * 8000 + aleat(ciclo, 44) * 5500);
      if (t >= 0 && t < 420) {
        const a = t < 110 ? 0.45 : t < 200 ? 0.08 : t < 300 ? 0.38 * (1 - (t - 200) / 100) : 0;
        if (a > 0) {
          ctx.fillStyle = `rgba(225,232,255,${a})`;
          ctx.fillRect(0, 0, w, h);
        }
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- o que passa na frente da van

  /** Beirada da pista de perto (baixa): a mureta, os postes de sinalização e os arbustos, andando com o mundo. */
  proximo(ctx: CanvasRenderingContext2D, v: ViagemInfo) {
    // a viagem é minimalista (07/10): nada passa na frente da van
    if (this.arte('van-casco')) return;
    const b = this.visivel(ctx);
    const passo = 4;
    const primeiro = Math.floor((b.x0 + this.pos) / passo) - 1;
    const ultimo = Math.ceil((b.x1 + this.pos) / passo) + 1;
    for (let i = primeiro; i <= ultimo; i++) {
      const x = i * passo - this.pos;
      const y = 7.2;
      const [bx, by] = iso(x, y, CHAO_Z);
      if (v.cenario === 'rodovia') {
        // o poste da mureta de proteção e a placa de quilômetro de vez em quando
        ctx.fillStyle = '#9fa3a8';
        ctx.fillRect(bx - 2, by - 18, 4, 18);
        if (i % 7 === 0) {
          ctx.fillStyle = '#2a7a46';
          ctx.fillRect(bx - 10, by - 44, 20, 12);
          ctx.fillStyle = '#d8d8d8';
          ctx.fillRect(bx - 8, by - 41, 16, 2);
        }
      } else if (aleat(i, 31) > 0.45) {
        // os arbustos da beira da estrada de terra
        ctx.fillStyle = '#3c6c30';
        ctx.beginPath();
        ctx.ellipse(bx, by - 8, 14 + aleat(i, 32) * 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(bx - 4, by - 11, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (v.cenario === 'rodovia') {
      // a mureta: um trilho corrido na altura do joelho
      const [x0, y0] = iso(b.x0 + 4 - ((this.pos % passo) + passo) % passo, 7.2, CHAO_Z + 0.35);
      const [x1, y1] = iso(b.x1, 7.2, CHAO_Z + 0.35);
      ctx.strokeStyle = '#b4b8bd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
}
