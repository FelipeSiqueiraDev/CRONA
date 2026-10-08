/**
 * Os dardos do bar (08/10), no celular de quem joga (ou na janelinha do mestre, pelo NPC). O alvo de
 * frente, grande: encostar o dedo mostra a mira (um pouco acima do dedo, para o dedo não tapar), que
 * treme como a mão de verdade; soltar arremessa. Quem tem mais Agilidade na ficha treme menos, e a
 * mão cansa se ficar mirando muito tempo.
 *
 * O jogo é o 301 (shared/src/bar/dardos.ts). A partida começa sozinha quando a mesa muda; "Nova
 * partida" recomeça para todos. Quem arremessa calcula o lance e manda pronto (guardado, para quem
 * reconectar refazer a partida).
 *
 * Com vida de bar: a luz da luminária em cima do alvo, o dardo voando em arco com rastro, o alvo
 * balançando na batida, o pó do sisal, o valor subindo do lugar, a faixa de quem joga, o confete de
 * quem fecha e uma bossinha de jukebox (chiptune.ts). Desenhado por código até chegar a arte do Códex.
 */
import { bar } from '@crona/shared';
import { faixa, Festa } from './barFx';
import type { Dados, Mesa, TelaDoBar } from './barJogos';
import { musica } from './chiptune';
import { h } from './dom';
import { sfx } from './sfx';

const D = bar.dardos;
/** a cor das penas do dardo de cada lugar */
const CORES = ['#e9a944', '#4f9bff', '#f0503f', '#79d98f'];
const curto = (n: string) => n.split(/\s+/)[0] ?? n;
/** quanto tempo o dardo leva da mão até o alvo */
const VOO = 340;

interface Voando {
  lance: bar.dardos.Lance;
  de: number;
  t0: number;
}

/** O botão ♪ da música, igual no fliperama, nos dardos e na sinuca. */
export function botaoMusica(): HTMLButtonElement {
  const b = h(
    'button',
    {
      class: `bj-som${musica.ligada ? '' : ' off'}`,
      type: 'button',
      title: 'Música',
      'aria-label': 'Música',
      onclick: () => {
        const on = musica.alternar();
        b.classList.toggle('off', !on);
        sfx.click();
      },
    },
    '♪',
  ) as HTMLButtonElement;
  return b;
}

export class Dardos implements TelaDoBar {
  readonly el: HTMLElement;
  private placar = h('div', { class: 'bj-placar' });
  private aviso = h('p', { class: 'bj-aviso' });
  private palco: HTMLElement;
  private nova: HTMLButtonElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private m: Mesa | null = null;
  private p: bar.dardos.Partida = D.nova(1);
  private ligado = false;
  private raf = 0;
  /** os dardos cravados no alvo agora (os da vez, ou os da vez que acabou) e quem jogou */
  private cravados: { lance: bar.dardos.Lance; de: number; t0: number }[] = [];
  private voando: Voando | null = null;
  /** a mira: onde o dedo aponta (em raios do alvo) e desde quando */
  private mira: { x: number; y: number; desde: number } | null = null;
  private recado = '';
  private recadoAte = 0;
  private festa = new Festa();
  /** o alvo balançando depois da batida (de 1 a 0) */
  private balanco = 0;
  /** os números do placar da última vez (para o número "pular" quando muda) */
  private mostrados: number[] = [];
  private vezAnunciada = -1;

  constructor() {
    this.cv = h('canvas', { class: 'bj-canvas', 'aria-label': 'Alvo de dardos' }) as HTMLCanvasElement;
    this.g = this.cv.getContext('2d')!;
    this.nova = h('button', { class: 'bj-bt', type: 'button', onclick: () => this.novaPartida() }, 'Nova partida') as HTMLButtonElement;
    this.palco = h('div', { class: 'bj-palco' }, this.cv);
    this.el = h(
      'div',
      { class: 'bj bj-dardos' },
      h('header', { class: 'bj-topo' }, h('b', null, 'DARDOS'), h('span', null, '301 · três por vez · zere para vencer'), botaoMusica()),
      this.placar,
      this.palco,
      this.aviso,
      h('footer', { class: 'bj-rodape' }, this.nova, h('button', { class: 'bj-bt sair', type: 'button', onclick: () => this.m?.sair() }, 'Sair')),
    );
    this.cv.addEventListener('pointerdown', (e) => {
      if (!this.minhaVez() || this.voando || this.p.vencedor !== null) return;
      try {
        this.cv.setPointerCapture(e.pointerId);
      } catch {
        /* sem captura */
      }
      const a = this.noAlvo(e);
      this.mira = { ...a, desde: performance.now() };
      sfx.chip(520, 520, 0.02, 0.03);
    });
    this.cv.addEventListener('pointermove', (e) => {
      if (this.mira) Object.assign(this.mira, this.noAlvo(e));
    });
    this.cv.addEventListener('pointerup', () => this.arremessar());
    this.cv.addEventListener('pointercancel', () => (this.mira = null));
  }

  // ---------------------------------------------------------------- a mesa e as jogadas

  mesa(m: Mesa, log: { de: number; dados: Dados }[]) {
    const n = m.jogadores.length;
    const mudou = !this.m || this.m.jogadores.join('|') !== m.jogadores.join('|');
    this.m = m;
    if (mudou || log.length) {
      // a partida desde o começo: a da mesa nova, refeita com as jogadas guardadas
      this.p = D.nova(n);
      this.cravados = [];
      for (const { de, dados } of log) this.aplicar(de, dados, false);
      this.mostrados = [];
      this.vezAnunciada = -1;
    }
    this.render();
    if (this.ligado) this.anunciar();
  }

  jogada(de: number, dados: Dados) {
    this.aplicar(de, dados, true);
  }

  private aplicar(de: number, d: Dados, animar: boolean) {
    if (d.tipo === 'comecar') {
      this.p = D.nova(this.m?.jogadores.length ?? 1);
      this.cravados = [];
      this.vezAnunciada = -1;
      if (animar) {
        this.avisar('Nova partida!');
        musica.tocar('bar');
        this.anunciar();
      }
    } else if (d.tipo === 'dardo' && typeof d.x === 'number' && typeof d.y === 'number' && typeof d.valor === 'number') {
      const lance: bar.dardos.Lance = { x: d.x, y: d.y, valor: d.valor, mult: typeof d.mult === 'number' ? d.mult : 1, rotulo: typeof d.rotulo === 'string' ? d.rotulo : String(d.valor) };
      if (animar) {
        this.voando = { lance, de, t0: performance.now() };
        sfx.dardoVoa();
      } else this.cravar(lance, de, false);
    }
    this.render();
  }

  /** O dardo chegou no alvo: conta, festeja e passa a vez se for o caso. */
  private cravar(lance: bar.dardos.Lance, de: number, animar: boolean) {
    if (this.p.lances.length === 0) this.cravados = [];
    this.cravados.push({ lance, de, t0: performance.now() });
    const antes = this.p;
    this.p = D.lancar(this.p, lance);
    if (!animar) return;
    const { cx, cy, raio } = this.geo();
    const x = cx + lance.x * raio;
    const y = cy + lance.y * raio;
    const k = this.festa.k;
    sfx.dardoCrava(lance.valor > 0);
    this.balanco = 1;
    // o pó do sisal (ou as lascas da parede, fora do alvo)
    this.festa.faiscas(x, y, lance.valor ? ['#e8dcc0', '#c9b98f'] : ['#8a5a2a', '#5a3a1a'], 9, 2.2, 0.12, 22, 2.5);
    const cor = lance.valor === 50 ? '#ff6a5a' : lance.mult === 3 ? '#ffd27a' : lance.mult === 2 ? '#79d98f' : lance.valor ? '#f3e9d8' : '#a3978a';
    const grande = lance.valor === 50 || lance.mult === 3;
    this.festa.texto(x, y - 26 * k, lance.valor ? (lance.mult > 1 && lance.valor !== 50 ? `${lance.rotulo} +${lance.valor}` : `+${lance.valor}`) : 'FORA', cor, grande ? 26 : 18);
    const nome = curto(this.m?.jogadores[de] ?? '');
    const estourou = this.p.historico.length > antes.historico.length && this.p.historico.at(-1)!.estourou;
    if (this.p.vencedor !== null) {
      sfx.arpejo([523, 659, 784, 1046, 1318], 0.09);
      this.avisar(`${nome} fechou! ${nome} venceu!`);
      this.festa.confete(this.cv.width, 90);
      this.festa.piscar('#ffd27a', 18);
      faixa(this.palco, `${nome.toUpperCase()} VENCEU!`, 'festa');
      musica.tocar(this.m?.eu.includes(this.p.vencedor) ? 'vitoria' : 'derrota');
      window.setTimeout(() => this.ligado && this.p.vencedor !== null && musica.tocar('bar'), 3200);
    } else if (estourou) {
      sfx.chip(300, 80, 0.4, 0.08);
      this.avisar(`${nome} estourou!`);
      this.festa.piscar('#f0503f', 16);
      this.festa.tremer(6);
      faixa(this.palco, 'ESTOUROU!', 'ruim');
    } else if (lance.valor === 50) {
      sfx.arpejo([784, 1046, 1318], 0.06);
      this.festa.faiscas(x, y, ['#ffd27a', '#ffffff', '#ff6a5a'], 30, 5, 0.06, 40);
      this.festa.tremer(4);
      this.avisar('Na mosca!');
    } else if (lance.mult === 3) {
      sfx.arpejo([784, 1046], 0.06);
      this.festa.faiscas(x, y, ['#ffd27a', '#ffffff'], 18, 4, 0.08, 32);
      this.avisar(`Triplo ${lance.valor / 3}!`);
    }
    this.render();
    // a vez mudou: a faixa de quem joga (depois de ver onde caiu o último)
    if (!estourou && this.p.vencedor === null) window.setTimeout(() => this.anunciar(), 700);
    else if (estourou) window.setTimeout(() => this.anunciar(), 1500);
  }

  /** A faixa "SUA VEZ" ou "VEZ DE CATARINA", quando a vez muda. */
  private anunciar() {
    const m = this.m;
    if (!m || this.p.vencedor !== null || this.vezAnunciada === this.p.vez || m.jogadores.length < 2) return;
    this.vezAnunciada = this.p.vez;
    const minha = this.minhaVez();
    faixa(this.palco, minha && m.eu.length === 1 ? 'SUA VEZ!' : `VEZ DE ${curto(m.jogadores[this.p.vez]).toUpperCase()}`, minha ? 'minha' : 'vez');
    if (minha) sfx.arpejo([659, 880], 0.07, 0.06), navigator.vibrate?.([20, 30, 20]);
  }

  private novaPartida() {
    if (!this.m) return;
    sfx.click();
    this.m.enviar({ tipo: 'comecar' }, true, this.m.eu[0]);
    this.aplicar(this.m.eu[0], { tipo: 'comecar' }, true);
  }

  private minhaVez() {
    return !!this.m && this.m.eu.includes(this.p.vez);
  }

  private avisar(t: string) {
    this.recado = t;
    this.recadoAte = performance.now() + 2200;
    this.render();
  }

  // ---------------------------------------------------------------- mirar e arremessar

  /** Quanto a mão treme agora (em raios do alvo): menos com firmeza, mais com o tempo mirando. */
  private tremor(agora: number) {
    const firmeza = this.m?.firmeza ?? 0.5;
    const cansa = this.mira ? Math.max(0, (agora - this.mira.desde) / 1000 - 2.5) * 0.35 : 0;
    return (0.035 + 0.11 * (1 - firmeza)) * (1 + cansa);
  }

  private oscila(agora: number) {
    const t = agora / 1000;
    const a = this.tremor(agora);
    return { x: a * (Math.sin(t * 2.3) + 0.45 * Math.sin(t * 5.7 + 1.3)), y: a * (Math.cos(t * 1.9) + 0.45 * Math.sin(t * 4.9 + 0.4)) };
  }

  private arremessar() {
    const mira = this.mira;
    this.mira = null;
    if (!mira || !this.m || !this.minhaVez()) return;
    const agora = performance.now();
    const o = this.oscila(agora);
    const a = this.tremor(agora) * 0.35;
    const x = mira.x + o.x + (Math.random() - 0.5) * a;
    const y = mira.y + o.y + (Math.random() - 0.5) * a;
    const lance = D.pontuar(x, y);
    const de = this.p.vez;
    this.m.enviar({ tipo: 'dardo', ...lance }, true, de);
    this.voando = { lance, de, t0: agora };
    sfx.dardoVoa();
    navigator.vibrate?.(12);
  }

  // ---------------------------------------------------------------- desenhar

  ligar() {
    this.ligado = true;
    this.el.classList.add('entra');
    musica.tocar('bar');
    window.setTimeout(() => this.anunciar(), 600);
    const laco = () => {
      if (!this.ligado) return;
      this.raf = requestAnimationFrame(laco);
      this.desenhar();
    };
    this.raf = requestAnimationFrame(laco);
  }

  desligar() {
    this.ligado = false;
    cancelAnimationFrame(this.raf);
    musica.parar();
  }

  /** O raio do alvo na tela e o centro (o canvas acompanha o tamanho da caixa). */
  private geo() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr);
    const hh = Math.round(r.height * dpr);
    if (w && hh && (this.cv.width !== w || this.cv.height !== hh)) (this.cv.width = w), (this.cv.height = hh);
    const raio = Math.min(this.cv.width, this.cv.height) * 0.4;
    this.festa.k = dpr;
    return { cx: this.cv.width / 2, cy: this.cv.height / 2, raio, dpr };
  }

  private noAlvo(e: PointerEvent) {
    const r = this.cv.getBoundingClientRect();
    const { cx, cy, raio, dpr } = this.geo();
    // a mira fica um dedo acima do toque
    const acima = 46 * dpr;
    return { x: ((e.clientX - r.left) * dpr - cx) / raio, y: ((e.clientY - r.top) * dpr - acima - cy) / raio };
  }

  private desenhar() {
    const g = this.g;
    const { cx, cy, raio, dpr } = this.geo();
    const W = this.cv.width;
    const H = this.cv.height;
    const agora = performance.now();
    this.festa.passo();
    if (this.balanco > 0.01) this.balanco *= 0.9;
    else this.balanco = 0;
    g.clearRect(0, 0, W, H);
    const s = this.festa.sacode();
    g.save();
    g.translate(s.x, s.y);
    // a luz da luminária, cintilando de leve
    const luz = 0.9 + 0.05 * Math.sin(agora / 700) + 0.03 * Math.sin(agora / 97);
    const lampada = g.createRadialGradient(cx, cy - raio * 0.9, raio * 0.1, cx, cy, raio * 1.9);
    lampada.addColorStop(0, `rgba(255, 214, 150, ${0.22 * luz})`);
    lampada.addColorStop(0.55, `rgba(255, 190, 120, ${0.08 * luz})`);
    lampada.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = lampada;
    g.fillRect(0, 0, W, H);
    // o alvo (e os dardos cravados nele) balança junto na batida
    g.save();
    const bal = this.balanco;
    g.translate(cx, cy);
    g.rotate(Math.sin(agora / 40) * 0.012 * bal);
    g.scale(1 + 0.015 * bal, 1 + 0.015 * bal);
    g.translate(-cx, -cy);
    // a sombra do alvo na parede
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(cx + raio * 0.05, cy + raio * 0.08, raio * 1.24, 0, Math.PI * 2);
    g.fill();
    this.alvo(g, cx, cy, raio, dpr);
    for (const c of this.cravados) {
      // o dardo cravado ainda vibra um instante
      const vib = Math.max(0, 1 - (agora - c.t0) / 450);
      this.dardo(g, cx + c.lance.x * raio, cy + c.lance.y * raio, CORES[c.de % 4], 1, dpr, 0, Math.sin(agora / 18) * 0.12 * vib);
    }
    g.restore();
    // o dardo voando: sai de baixo (a mão), sobe em arco e encolhe até cravar, com rastro
    const v = this.voando;
    if (v) {
      const t = Math.min(1, (agora - v.t0) / VOO);
      const pos = (k: number) => {
        const x1 = cx + v.lance.x * raio;
        const y1 = cy + v.lance.y * raio;
        const x0 = cx + (x1 - cx) * 0.3;
        const y0 = H + 60 * dpr;
        return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * raio * 0.35, e: 1 + (1 - k) * 2.6 };
      };
      for (let i = 4; i >= 1; i--) {
        const k = Math.max(0, t - i * 0.05);
        const p = pos(k);
        g.globalAlpha = 0.12 * (5 - i);
        this.dardo(g, p.x, p.y, CORES[v.de % 4], p.e, dpr, 0);
      }
      g.globalAlpha = 1;
      const p = pos(t);
      this.dardo(g, p.x, p.y, CORES[v.de % 4], p.e, dpr, 0);
      if (t >= 1) {
        this.voando = null;
        this.cravar(v.lance, v.de, true);
      }
    }
    // a mira, tremendo, com o círculo de onde o dardo pode cair
    if (this.mira) {
      const o = this.oscila(agora);
      const x = cx + (this.mira.x + o.x) * raio;
      const y = cy + (this.mira.y + o.y) * raio;
      const zona = this.tremor(agora) * raio * 1.1;
      g.fillStyle = 'rgba(255, 240, 200, 0.08)';
      g.strokeStyle = 'rgba(255, 240, 200, 0.35)';
      g.lineWidth = 1 * dpr;
      g.beginPath();
      g.arc(cx + this.mira.x * raio, cy + this.mira.y * raio, zona, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      const pulso = 1 + Math.sin(agora / 90) * 0.12;
      g.strokeStyle = 'rgba(255, 240, 200, 0.95)';
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.arc(x, y, 9 * dpr * pulso, 0, Math.PI * 2);
      g.moveTo(x - 16 * dpr, y);
      g.lineTo(x - 5 * dpr, y);
      g.moveTo(x + 5 * dpr, y);
      g.lineTo(x + 16 * dpr, y);
      g.moveTo(x, y - 16 * dpr);
      g.lineTo(x, y - 5 * dpr);
      g.moveTo(x, y + 5 * dpr);
      g.lineTo(x, y + 16 * dpr);
      g.stroke();
      g.fillStyle = '#f0503f';
      g.fillRect(x - 1.5 * dpr, y - 1.5 * dpr, 3 * dpr, 3 * dpr);
    }
    g.restore();
    this.festa.desenhar(g, W, H);
    if (agora > this.recadoAte && this.recado) {
      this.recado = '';
      this.render();
    }
  }

  /** O alvo de verdade: os setores pretos e creme, os anéis vermelhos e verdes e os números em volta. */
  private alvo(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dpr: number) {
    const A = bar.dardos.ANEL;
    // a borda preta com os números
    g.fillStyle = '#141414';
    g.beginPath();
    g.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#6b6b6b';
    g.lineWidth = 2 * dpr;
    g.stroke();
    const fatia = (Math.PI * 2) / 20;
    const anel = (r0: number, r1: number, cor: (i: number) => string) => {
      for (let i = 0; i < 20; i++) {
        const a0 = -Math.PI / 2 - fatia / 2 + i * fatia;
        g.beginPath();
        g.arc(cx, cy, r1 * r, a0, a0 + fatia);
        g.arc(cx, cy, r0 * r, a0 + fatia, a0, true);
        g.closePath();
        g.fillStyle = cor(i);
        g.fill();
      }
    };
    anel(A.triploFora, A.duploDentro, (i) => (i % 2 ? '#e8dcc0' : '#1a1a1a'));
    anel(A.centro, A.triploDentro, (i) => (i % 2 ? '#e8dcc0' : '#1a1a1a'));
    anel(A.duploDentro, A.duploFora, (i) => (i % 2 ? '#2a8a4a' : '#c8302a'));
    anel(A.triploDentro, A.triploFora, (i) => (i % 2 ? '#2a8a4a' : '#c8302a'));
    g.fillStyle = '#2a8a4a';
    g.beginPath();
    g.arc(cx, cy, A.centro * r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8302a';
    g.beginPath();
    g.arc(cx, cy, A.mosca * r, 0, Math.PI * 2);
    g.fill();
    // os arames
    g.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    g.lineWidth = 1 * dpr;
    for (const k of [A.duploFora, A.duploDentro, A.triploFora, A.triploDentro, A.centro]) {
      g.beginPath();
      g.arc(cx, cy, k * r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 - fatia / 2 + i * fatia;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * A.centro * r, cy + Math.sin(a) * A.centro * r);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.stroke();
    }
    // a luz batendo de cima no alvo
    const brilho = g.createLinearGradient(cx, cy - r * 1.2, cx, cy + r * 1.2);
    brilho.addColorStop(0, 'rgba(255, 220, 160, 0.14)');
    brilho.addColorStop(0.5, 'rgba(255, 220, 160, 0)');
    brilho.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    g.fillStyle = brilho;
    g.beginPath();
    g.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
    g.fill();
    // os números
    g.fillStyle = '#f3e9d8';
    g.font = `700 ${Math.round(r * 0.13)}px 'Pixel Numeros', 'Pixelify Sans', monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    bar.dardos.SETORES.forEach((n, i) => {
      const a = -Math.PI / 2 + i * fatia;
      g.fillText(String(n), cx + Math.cos(a) * r * 1.11, cy + Math.sin(a) * r * 1.11);
    });
  }

  /** O dardo cravado: a ponta no lugar, o corpo e as penas na cor de quem jogou. */
  private dardo(g: CanvasRenderingContext2D, x: number, y: number, cor: string, escala: number, dpr: number, alfa = 0, giro = 0) {
    const k = escala * dpr;
    g.save();
    g.translate(x, y);
    if (giro) g.rotate(giro);
    g.globalAlpha *= 1 - alfa * 0.3;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(3 * k, 3 * k, 4 * k, 2 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c9c9c9';
    g.lineWidth = 1.6 * k;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(9 * k, -9 * k);
    g.stroke();
    g.strokeStyle = '#2b2a30';
    g.lineWidth = 3.4 * k;
    g.beginPath();
    g.moveTo(8 * k, -8 * k);
    g.lineTo(17 * k, -17 * k);
    g.stroke();
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(16 * k, -16 * k);
    g.lineTo(27 * k, -21 * k);
    g.lineTo(22 * k, -22 * k);
    g.lineTo(21 * k, -27 * k);
    g.closePath();
    g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- o placar

  private render() {
    const m = this.m;
    if (!m) return;
    const p = this.p;
    const soma = D.somaDaVez(p);
    const valores = m.jogadores.map((_, i) => (i === p.vez && p.vencedor === null ? p.restam[i] - soma : p.restam[i]));
    this.placar.replaceChildren(
      ...m.jogadores.map((nome, i) =>
        h(
          'div',
          { class: `bj-chip${i === p.vez && p.vencedor === null ? ' on' : ''}${p.vencedor === i ? ' venceu' : ''}`, style: `--cor:${CORES[i % 4]}` },
          h('span', null, curto(nome), m.npc[i] ? h('small', null, ' (NPC)') : m.eu.includes(i) ? h('small', null, ' (você)') : null),
          // o número pula quando muda
          h('b', { class: this.mostrados[i] !== undefined && this.mostrados[i] !== valores[i] ? 'muda' : '' }, String(valores[i])),
        ),
      ),
    );
    this.mostrados = valores;
    const vez = curto(m.jogadores[p.vez] ?? '');
    const lances = p.lances.map((l) => l.rotulo).join(' + ');
    const texto =
      this.recado ||
      (p.vencedor !== null
        ? `${curto(m.jogadores[p.vencedor])} venceu em ${p.rodada} rodada${p.rodada > 1 ? 's' : ''}!`
        : this.minhaVez()
          ? `${m.eu.length > 1 ? `Vez de ${vez}: ` : 'Sua vez: '}encoste no alvo para mirar e solte para arremessar (dardo ${p.lances.length + 1} de 3)${lances ? ` · ${lances}` : ''}`
          : `Vez de ${vez}${lances ? ` · ${lances}` : ''}`);
    this.aviso.textContent = m.jogadores.length === 1 && p.vencedor === null && !this.recado ? `${texto} · rodada ${p.rodada}` : texto;
    this.el.classList.toggle('minha-vez', this.minhaVez() && p.vencedor === null);
  }
}
