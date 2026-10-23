/**
 * O Felipe's Fight (23/10), o fliperama de luta da Sala de Jogos: só abre a luta com dois na máquina. As contas ficam em
 * shared/src/bar/luta.ts; quem tem o primeiro lugar é o anfitrião (avança a luta e manda a fotografia 30 vezes por
 * segundo), o outro manda os comandos e desenha o que recebe. Com os dois lugares no mesmo aparelho (o mestre com dois
 * NPCs), tudo roda aqui: o primeiro no WASD + J K L, o segundo nas setas + 1 2 3.
 *
 * No celular: o direcional à esquerda e SOCO, CHUTE e ESPECIAL à direita. No teclado: WASD ou as setas, J/Z soco,
 * K/X chute, L/C especial. A arena é desenhada por código, em pixels do jogo (192 × 120), como o Feliperama.
 */
import { bar } from '@crona/shared';
import type { Dados, Mesa, TelaDoBar } from './barJogos';
import { musica } from './chiptune';
import { h } from './dom';
import { COR, curto, texto } from './fliperamaJogos';
import { sfx } from './sfx';
import './luta.css';

const L = bar.luta;
type Luta_ = bar.luta.Luta;
type Lutador = bar.luta.Lutador;
type Evento = bar.luta.Evento;
const B = L.B;
const GW = L.ARENA;
const GH = 120;
const CHAO = 102;
const PASSO = 1000 / L.QUADROS_POR_SEGUNDO;

/** as cores de cada lutador: o quimono, a faixa, o cabelo, a pele */
const ROUPAS = [
  { roupa: '#d84848', sombra: '#8a2424', faixa: '#1a1a1a', cabelo: '#3a2414', pele: '#e8b98f', fita: '#ececec' },
  { roupa: '#4a6ae0', sombra: '#26357a', faixa: '#ecec68', cabelo: '#e8b040', pele: '#d89a6a', fita: '#d84848' },
];

/** as teclas: o primeiro lugar deste aparelho (ou o único) e o segundo, quando o aparelho joga pelos dois */
const TECLAS_1: Record<string, number> = { KeyA: B.esq, KeyD: B.dir, KeyW: B.cima, KeyS: B.baixo, KeyJ: B.soco, KeyK: B.chute, KeyL: B.especial };
const TECLAS_SO: Record<string, number> = { ...TECLAS_1, ArrowLeft: B.esq, ArrowRight: B.dir, ArrowUp: B.cima, ArrowDown: B.baixo, KeyZ: B.soco, KeyX: B.chute, KeyC: B.especial, Space: B.cima };
const TECLAS_2: Record<string, number> = { ArrowLeft: B.esq, ArrowRight: B.dir, ArrowUp: B.cima, ArrowDown: B.baixo, Digit1: B.soco, Digit2: B.chute, Digit3: B.especial, Numpad1: B.soco, Numpad2: B.chute, Numpad3: B.especial };

interface Faisca {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  cor: string;
}

const arred = (v: number) => Math.round(v * 10) / 10;

export class Luta implements TelaDoBar {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private m: Mesa | null = null;
  private luta: Luta_ = L.nova();
  private ligado = false;
  private raf = 0;
  private t0 = 0;
  private acc = 0;
  private quadro = 0;
  /** os comandos: do teclado (por lugar deste aparelho), dos botões da tela e os que chegaram do outro aparelho */
  private teclas = new Set<string>();
  private toque = 0;
  private remoto: [number, number] = [0, 0];
  private antes: [number, number] = [0, 0];
  private enviado = -1;
  private enviadoEm = 0;
  private pendentes: Evento[] = [];
  private faiscas: Faisca[] = [];
  private tremor = 0;
  private clarao = 0;
  private alvoTeclas: EventTarget | null = null;
  private faseMusica = '';

  constructor() {
    this.cv = h('canvas', { class: 'lu-tela', width: String(GW), height: String(GH), 'aria-label': "Felipe's Fight" }) as HTMLCanvasElement;
    this.g = this.cv.getContext('2d')!;
    const bt = (rot: string, bit: number, cls: string) => {
      const b = h('button', { class: `lu-bt ${cls}`, type: 'button', 'aria-label': rot }, rot) as HTMLButtonElement;
      const solta = () => ((this.toque &= ~bit), b.classList.remove('on'));
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* sem captura */
        }
        this.toque |= bit;
        b.classList.add('on');
        navigator.vibrate?.(8);
      });
      b.addEventListener('pointerup', solta);
      b.addEventListener('pointercancel', solta);
      b.addEventListener('lostpointercapture', solta);
      return b;
    };
    this.el = h(
      'div',
      { class: 'bj lu' },
      h('div', { class: 'lu-letreiro' }, h('b', null, "FELIPE'S FIGHT"), h('span', null, 'só em dupla · melhor de três')),
      h('div', { class: 'lu-moldura' }, this.cv),
      h(
        'div',
        { class: 'lu-controles' },
        h('div', { class: 'lu-dpad' }, bt('▲', B.cima, 'cima'), bt('◀', B.esq, 'esq'), bt('▼', B.baixo, 'baixo'), bt('▶', B.dir, 'dir')),
        h('div', { class: 'lu-botoes' }, bt('SOCO', B.soco, 'soco'), bt('CHUTE', B.chute, 'chute'), bt('ESPECIAL', B.especial, 'especial')),
      ),
      h('footer', { class: 'bj-rodape' }, h('small', { class: 'lu-dica' }, 'Teclado: WASD ou setas · J soco · K chute · L especial'), h('button', { class: 'bj-bt sair', type: 'button', onclick: () => this.m?.sair() }, 'Sair')),
    );
  }

  // ---------------------------------------------------------------- a mesa e as jogadas

  mesa(m: Mesa) {
    const mudou = !this.m || this.m.jogadores.join('|') !== m.jogadores.join('|');
    this.m = m;
    if (mudou) {
      this.luta = L.nova();
      this.remoto = [0, 0];
      this.antes = [0, 0];
    }
  }

  private get anfitriao() {
    return !!this.m?.eu.includes(0);
  }

  jogada(de: number, d: Dados) {
    if (d.tipo === 'in' && this.anfitriao && (de === 0 || de === 1) && typeof d.b === 'number') this.remoto[de] = d.b & 127;
    else if (d.tipo === 'st' && !this.anfitriao && d.s && typeof d.s === 'object') {
      this.luta = d.s as Luta_;
      if (Array.isArray(d.ev)) for (const e of d.ev as Evento[]) this.efeito(e);
    }
  }

  /** Os comandos de agora do lugar `i` deste aparelho. */
  private local(i: number): number {
    const m = this.m;
    if (!m) return 0;
    const dois = m.eu.length > 1;
    const mapa = !dois ? TECLAS_SO : i === m.eu[0] ? TECLAS_1 : TECLAS_2;
    let b = 0;
    for (const k of this.teclas) b |= mapa[k] ?? 0;
    if (i === m.eu[0]) b |= this.toque;
    return b;
  }

  // ---------------------------------------------------------------- o laço

  ligar(teclas: EventTarget) {
    this.ligado = true;
    this.alvoTeclas = teclas;
    teclas.addEventListener('keydown', this.desce as EventListener);
    teclas.addEventListener('keyup', this.sobe as EventListener);
    window.addEventListener('blur', this.limpa);
    this.t0 = performance.now();
    const laco = (agora: number) => {
      if (!this.ligado) return;
      this.raf = requestAnimationFrame(laco);
      this.tique(agora);
      this.desenhar();
    };
    this.raf = requestAnimationFrame(laco);
  }

  desligar() {
    this.ligado = false;
    cancelAnimationFrame(this.raf);
    this.alvoTeclas?.removeEventListener('keydown', this.desce as EventListener);
    this.alvoTeclas?.removeEventListener('keyup', this.sobe as EventListener);
    window.removeEventListener('blur', this.limpa);
    musica.parar();
  }

  private desce = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!(e.code in TECLAS_SO) && !(e.code in TECLAS_2)) return;
    e.preventDefault();
    this.teclas.add(e.code);
  };
  private sobe = (e: KeyboardEvent) => void this.teclas.delete(e.code);
  private limpa = () => (this.teclas.clear(), (this.toque = 0));

  private tique(agora: number) {
    const m = this.m;
    if (!m) return;
    const dt = Math.max(0, Math.min(250, agora - this.t0));
    this.t0 = agora;
    if (this.anfitriao) {
      this.acc += dt;
      while (this.acc >= PASSO) {
        this.acc -= PASSO;
        const ent: [number, number] = [0, 1].map((i) => (m.eu.includes(i) ? this.local(i) : m.jogadores.length > 1 ? this.remoto[i] : 0)) as [number, number];
        // sozinho na máquina, a luta não começa
        if (m.jogadores.length < 2) ent[1] = 0;
        const ev = m.jogadores.length < 2 && this.luta.fase === 'espera' ? [] : L.passo(this.luta, ent, this.antes);
        this.antes = ent;
        for (const e of ev) this.efeito(e);
        this.pendentes.push(...ev);
        this.quadro++;
        if (this.quadro % 2 === 0 && m.jogadores.length > 1 && m.eu.length < 2) {
          m.enviar({ tipo: 'st', s: this.fotografia(), ev: this.pendentes.slice(0, 20) }, false, 0);
          this.pendentes = [];
        }
      }
    } else {
      const eu = m.eu[0];
      const b = this.local(eu);
      if (b !== this.enviado || agora - this.enviadoEm > 200) {
        m.enviar({ tipo: 'in', b }, false, eu);
        this.enviado = b;
        this.enviadoEm = agora;
      }
    }
    this.musicaDaFase();
  }

  /** A luta em números curtos, para mandar. */
  private fotografia(): Luta_ {
    const p = this.luta;
    const f = (x: Lutador): Lutador => ({ ...x, x: arred(x.x), y: arred(x.y), vx: arred(x.vx), vy: arred(x.vy) });
    return { ...p, l: [f(p.l[0]), f(p.l[1])], bolas: p.bolas.map((b) => ({ ...b, x: arred(b.x) })) };
  }

  private musicaDaFase() {
    const p = this.luta;
    const fase = p.fase === 'luta' || p.fase === 'apresenta' || p.fase === 'ko' ? 'luta' : p.fase;
    if (fase === this.faseMusica) return;
    this.faseMusica = fase;
    if (fase === 'luta') musica.tocar('invasoresChefe');
    else if (fase === 'fim') musica.tocar(this.m?.eu.includes(p.vencedor) ? 'vitoria' : 'derrota');
    else musica.tocar('menu');
  }

  /** O som e o brilho de cada coisa que aconteceu. */
  private efeito(e: Evento) {
    const cores = e.tipo === 'defesa' ? ['#a8d0fc', '#ececec'] : e.tipo === 'bola' ? ['#ecec68', '#e8b040'] : ['#ffffff', '#ecec68', '#e0803c'];
    const n = e.tipo === 'acerto' ? (e.forte ? 16 : 10) : e.tipo === 'defesa' ? 8 : e.tipo === 'ko' ? 28 : e.tipo === 'bola' ? 6 : 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.6 + Math.random() * (e.tipo === 'ko' ? 2.6 : 1.6);
      this.faiscas.push({ x: e.x, y: CHAO - e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, vida: 14 + Math.random() * 12, cor: cores[i % cores.length] });
    }
    if (e.tipo === 'acerto') {
      sfx.chip(e.forte ? 160 : 220, 60, e.forte ? 0.16 : 0.1, 0.12);
      this.tremor = e.forte ? 4 : 2;
      navigator.vibrate?.(e.forte ? 30 : 15);
    } else if (e.tipo === 'defesa') sfx.chip(900, 600, 0.05, 0.06);
    else if (e.tipo === 'golpe') sfx.chip(500, 300, 0.04, 0.03);
    else if (e.tipo === 'pulo') sfx.chip(300, 600, 0.06, 0.04);
    else if (e.tipo === 'bola') sfx.chip(200, 900, 0.22, 0.08);
    else if (e.tipo === 'ko') (sfx.arpejo([523, 392, 262, 196], 0.12), (this.tremor = 7), (this.clarao = 1));
    else if (e.tipo === 'round') sfx.arpejo([392, 523, 659], 0.08);
    else if (e.tipo === 'lute') (sfx.arpejo([659, 880, 1046], 0.05), (this.clarao = 0.6));
    else if (e.tipo === 'tempo') sfx.arpejo([440, 330], 0.15);
  }

  // ---------------------------------------------------------------- desenhar

  private desenhar() {
    const g = this.g;
    const m = this.m;
    const p = this.luta;
    const agora = performance.now();
    g.save();
    if (this.tremor > 0.3) g.translate(Math.round((Math.random() - 0.5) * this.tremor), Math.round((Math.random() - 0.5) * this.tremor));
    this.tremor *= 0.85;
    this.arena(g, agora);
    // as bolas de energia
    for (const b of p.bolas) {
      const x = Math.round(b.x);
      const y = CHAO - Math.round(b.y);
      const pulsa = Math.floor(agora / 60) % 2;
      g.fillStyle = 'rgba(236, 236, 104, 0.35)';
      g.fillRect(x - 5 - pulsa, y - 5 - pulsa, 10 + pulsa * 2, 10 + pulsa * 2);
      g.fillStyle = COR.ouro;
      g.fillRect(x - 3, y - 3, 6, 6);
      g.fillStyle = '#ffffff';
      g.fillRect(x - 1, y - 2, 3, 3);
      g.fillStyle = 'rgba(232, 176, 64, 0.5)';
      g.fillRect(x - Math.sign(b.vx) * 9, y - 1, 5, 2);
    }
    // os dois lutadores (o atingido por cima)
    const ordem = p.l[0].estado === 'atingido' ? [1, 0] : [0, 1];
    for (const i of ordem) this.lutador(g, p.l[i], i);
    // as faíscas
    for (const f of this.faiscas) {
      f.x += f.vx;
      f.y += f.vy;
      f.vy += 0.08;
      f.vida--;
      g.fillStyle = f.cor;
      g.fillRect(Math.round(f.x), Math.round(f.y), f.vida > 8 ? 2 : 1, f.vida > 8 ? 2 : 1);
    }
    this.faiscas = this.faiscas.filter((f) => f.vida > 0);
    g.restore();
    this.hud(g, agora);
    if (m) this.letreiros(g, m, agora);
    if (this.clarao > 0.02) {
      g.fillStyle = `rgba(255, 255, 255, ${this.clarao * 0.5})`;
      g.fillRect(0, 0, GW, GH);
      this.clarao *= 0.85;
    }
  }

  /** A arena: o telhado de um prédio à noite, a cidade com as janelas acesas, a lua e o letreiro de neon. */
  private arena(g: CanvasRenderingContext2D, agora: number) {
    const ceu = ['#1a0c2a', '#24103a', '#34164a', '#4a1e52', '#6a2a5a'];
    ceu.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, i * 14, GW, 14);
    });
    g.fillStyle = '#6a2a5a';
    g.fillRect(0, 70, GW, CHAO - 70);
    // a lua
    g.fillStyle = '#f4ecd4';
    g.fillRect(166, 30, 12, 12);
    g.fillRect(165, 32, 14, 8);
    g.fillStyle = '#d8ccb0';
    g.fillRect(169, 33, 3, 2);
    g.fillRect(173, 37, 2, 2);
    // as estrelas
    g.fillStyle = '#ececec';
    for (let i = 0; i < 18; i++) if ((Math.floor(agora / 500) + i) % 7) g.fillRect((i * 53) % GW, (i * 29) % 30 + 28, 1, 1);
    // os prédios do fundo, com as janelas
    const predios = [
      [0, 52, 22], [20, 40, 18], [36, 58, 26], [60, 34, 16], [74, 48, 22], [94, 62, 20], [112, 44, 18], [128, 56, 24], [150, 38, 16], [164, 50, 28],
    ];
    for (const [x, alto, larg] of predios) {
      const y = CHAO - 8 - alto;
      g.fillStyle = '#140a1e';
      g.fillRect(x, y, larg, alto + 8);
      for (let wy = y + 4; wy < CHAO - 12; wy += 6)
        for (let wx = x + 3; wx < x + larg - 3; wx += 5) {
          const aceso = ((wx * 7 + wy * 13) % 5 === 0) !== (Math.floor(agora / 4000 + wx) % 9 === 0);
          g.fillStyle = aceso ? '#e8b040' : '#24163a';
          g.fillRect(wx, wy, 2, 3);
        }
    }
    // o letreiro de neon piscando no prédio do meio (formas, sem letra)
    const neon = Math.floor(agora / 700) % 6 !== 0;
    g.fillStyle = neon ? '#e070b0' : '#5a2a4a';
    g.fillRect(98, CHAO - 66, 12, 2);
    g.fillRect(98, CHAO - 62, 12, 2);
    g.fillStyle = neon ? '#5ad8ff' : '#2a4a5a';
    g.fillRect(100, CHAO - 58, 8, 2);
    // o chão do telhado: o concreto em placas, a mureta e a sombra
    g.fillStyle = '#3a3448';
    g.fillRect(0, CHAO, GW, GH - CHAO);
    g.fillStyle = '#4a4458';
    g.fillRect(0, CHAO, GW, 2);
    g.fillStyle = '#2a2436';
    for (let x = 0; x < GW; x += 24) g.fillRect(x, CHAO + 2, 1, GH - CHAO);
    g.fillRect(0, CHAO + 9, GW, 1);
    g.fillStyle = '#5a5468';
    g.fillRect(0, CHAO - 4, GW, 4);
    g.fillStyle = '#6a6478';
    g.fillRect(0, CHAO - 4, GW, 1);
  }

  /** O lutador, em retângulos de pixel: as pernas, o quimono, a faixa, a cabeça e os braços, na pose do estado. */
  private lutador(g: CanvasRenderingContext2D, f: Lutador, i: number) {
    const c = ROUPAS[i];
    const s = f.face;
    const x = Math.round(f.x);
    const y = CHAO - Math.round(f.y);
    const px = (dx: number, dy: number, w: number, hh: number, cor: string) => {
      g.fillStyle = cor;
      const xa = s === 1 ? x + dx : x - dx - w;
      g.fillRect(xa, y + dy, w, hh);
    };
    // a sombra no chão
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    const sw = Math.max(6, 14 - Math.round(f.y / 6));
    g.fillRect(x - sw / 2, CHAO, sw, 2);
    const pisca = f.estado === 'atingido' && f.t < 4;
    const roupa = pisca ? '#ffffff' : c.roupa;
    const sombra = pisca ? '#dddddd' : c.sombra;
    if (f.estado === 'caido' && f.y <= 0.5) {
      // deitado no chão
      px(-12, -5, 8, 5, c.pele);
      px(-13, -6, 4, 3, c.cabelo);
      px(-4, -5, 12, 5, roupa);
      px(-4, -2, 12, 1, sombra);
      px(8, -4, 9, 4, sombra);
      px(1, -6, 1, 6, c.faixa);
      return;
    }
    const agach = f.estado === 'defesa' ? 5 : 0;
    const recua = f.estado === 'atingido' || f.estado === 'defendeu' ? -2 : f.estado === 'chute' ? -1 : 0;
    const passo = f.estado === 'andando' ? Math.round(Math.sin(f.t / 4) * 2) : 0;
    // as pernas
    if (f.estado === 'chute' && f.t >= 4) {
      px(-4, -10, 3, 10, sombra);
      px(-1, -15, 18, 4, roupa);
      px(17, -15, 3, 4, c.pele);
    } else if (f.estado === 'voadora') {
      px(-3, -12, 3, 8, sombra);
      px(0, -10, 14, 4, roupa);
      px(14, -10, 3, 4, c.pele);
    } else if (f.estado === 'pulo') {
      px(-4, -13, 4, 7, sombra);
      px(1, -13, 4, 7, roupa);
    } else {
      px(-4 + passo, -10 + agach, 3, 10 - agach, sombra);
      px(1 - passo, -10 + agach, 3, 10 - agach, roupa);
      px(-5 + passo, -1, 4, 1, c.pele);
      px(1 - passo, -1, 4, 1, c.pele);
    }
    const yt = -22 + agach;
    // o quimono, a faixa e a gola
    px(-5 + recua, yt, 10, 12, roupa);
    px(-5 + recua, yt, 2, 12, sombra);
    px(-5 + recua, yt + 10, 10, 2, c.faixa);
    px(0 + recua, yt, 2, 4, c.pele);
    // a cabeça: o rosto, o cabelo, a fita da testa e o olho
    const yc = yt - 8;
    px(-3 + recua, yc, 7, 8, c.pele);
    px(-4 + recua, yc - 1, 8, 3, c.cabelo);
    px(-4 + recua, yc + 2, 8, 1, c.fita);
    px(-6 + recua, yc + 2, 2, 3, c.fita);
    px(2 + recua, yc + 4, 1, 1, '#1a1a1a');
    // os braços
    if (f.estado === 'soco' && f.t >= 3 && f.t < 9) {
      px(3, yt + 2, 12, 3, roupa);
      px(15, yt + 1, 4, 4, c.pele);
      px(-3, yt + 4, 4, 3, sombra);
    } else if (f.estado === 'especial') {
      const brilho = f.t >= 6 && f.t < 14;
      px(3, yt + 3, 7, 3, roupa);
      px(10, yt + 2, 4, 5, brilho ? '#ecec68' : c.pele);
      if (brilho) px(14, yt + 1, 2, 7, 'rgba(236,236,104,0.6)');
    } else if (f.estado === 'defesa' || f.estado === 'defendeu') {
      px(3, yt - 1, 3, 9, roupa);
      px(5, yt - 3, 3, 4, c.pele);
      px(1, yt + 1, 3, 7, sombra);
    } else if (f.estado === 'vitoria') {
      px(2 + recua, yt - 10, 3, 10, roupa);
      px(2 + recua, yt - 13, 3, 3, c.pele);
    } else {
      // a guarda
      px(3 + recua, yt + 2, 5, 3, roupa);
      px(7 + recua, yt, 3, 3, c.pele);
      px(-1 + recua, yt + 4, 4, 3, sombra);
      px(2 + recua, yt + 3, 3, 2, c.pele);
    }
  }

  /** As barras de vida e de energia, o relógio e as bolinhas dos rounds. */
  private hud(g: CanvasRenderingContext2D, agora: number) {
    const m = this.m;
    const p = this.luta;
    const nomes = [0, 1].map((i) => curto(m?.jogadores[i] ?? (i ? 'P2' : 'P1')));
    for (const i of [0, 1]) {
      const f = p.l[i];
      const w = 76;
      const x0 = i === 0 ? 6 : GW - 6 - w;
      g.fillStyle = '#000000';
      g.fillRect(x0 - 1, 5, w + 2, 7);
      g.fillStyle = '#8a2424';
      g.fillRect(x0, 6, w, 5);
      const v = Math.max(0, Math.round((f.vida / L.VIDA) * w));
      g.fillStyle = f.vida < 30 && Math.floor(agora / 200) % 2 ? '#ececec' : COR.amarelo;
      if (i === 0) g.fillRect(x0 + w - v, 6, v, 5);
      else g.fillRect(x0, 6, v, 5);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x0, 6, w, 1);
      // a energia
      const e = Math.round((f.energia / L.ENERGIA) * (w - 20));
      g.fillStyle = '#1a1a2c';
      g.fillRect(i === 0 ? x0 + 20 : x0, 14, w - 20, 3);
      g.fillStyle = f.energia >= L.CUSTO_ESPECIAL ? (Math.floor(agora / 150) % 2 ? '#5ad8ff' : COR.azulClaro) : COR.azul;
      if (i === 0) g.fillRect(x0 + w - e, 14, e, 3);
      else g.fillRect(x0, 14, e, 3);
      texto(g, nomes[i], i === 0 ? x0 : x0 + w, 20, '#ececec', 1, i === 0 ? 'esq' : 'dir');
      // os rounds ganhos
      for (let k = 0; k < L.ROUNDS_PARA_VENCER; k++) {
        g.fillStyle = k < f.rounds ? COR.ouro : '#404040';
        g.fillRect(i === 0 ? x0 + w - 4 - k * 6 : x0 + k * 6, 20, 4, 4);
      }
    }
    // o relógio
    const seg = Math.ceil(p.relogio / L.QUADROS_POR_SEGUNDO);
    g.fillStyle = '#000000';
    g.fillRect(GW / 2 - 9, 3, 18, 12);
    texto(g, String(Math.max(0, seg)).padStart(2, '0'), GW / 2, 5, seg <= 10 && p.fase === 'luta' ? COR.vermelho : '#ececec', 2, 'meio');
  }

  /** Os letreiros grandes: o título na espera, ROUND e LUTE!, K.O., o vencedor. */
  private letreiros(g: CanvasRenderingContext2D, m: Mesa, agora: number) {
    const p = this.luta;
    const pisca = Math.floor(agora / 400) % 2 === 0;
    const faixa = (y: number, hh: number) => {
      g.fillStyle = 'rgba(0, 0, 0, 0.6)';
      g.fillRect(0, y, GW, hh);
    };
    const titulo = (t: string, y: number, cor: string, esc = 3) => {
      texto(g, t, GW / 2 + 1, y + 1, '#000000', esc, 'meio');
      texto(g, t, GW / 2, y, cor, esc, 'meio');
    };
    if (m.jogadores.length < 2) {
      faixa(32, 50);
      titulo("FELIPE'S FIGHT", 38, COR.laranja, 2);
      texto(g, 'SO FUNCIONA EM DUPLA', GW / 2, 56, '#ececec', 1, 'meio');
      if (pisca) texto(g, 'ESPERANDO O SEGUNDO JOGADOR', GW / 2, 66, COR.amarelo, 1, 'meio');
      return;
    }
    if (p.fase === 'espera' || p.fase === 'fim') {
      faixa(30, 58);
      if (p.fase === 'fim') titulo(`${curto(m.jogadores[p.vencedor] ?? '')} VENCEU!`, 36, COR.amarelo, 2);
      else titulo("FELIPE'S FIGHT", 36, COR.laranja, 2);
      texto(g, p.fase === 'fim' ? 'SOCO: REVANCHE' : 'APERTE SOCO PARA ENTRAR', GW / 2, 54, '#ececec', 1, 'meio');
      for (const i of [0, 1]) {
        const ok = p.pronto[i];
        texto(g, `${curto(m.jogadores[i])} ${ok ? 'PRONTO' : '...'}`, i === 0 ? 40 : GW - 40, 68, ok ? COR.verdeClaro : pisca ? '#bcbcbc' : '#6c6c6c', 1, 'meio');
      }
      return;
    }
    if (p.fase === 'apresenta') {
      faixa(40, 26);
      if (p.t < 66) titulo(`ROUND ${p.round}`, 46, '#ececec');
      else titulo('LUTE!', 46, COR.vermelho);
      return;
    }
    if (p.fase === 'ko') {
      faixa(36, 34);
      titulo(p.relogio <= 0 ? 'TEMPO!' : 'K.O.!', 40, p.relogio <= 0 ? COR.amarelo : COR.vermelho);
      if (p.t > 50) texto(g, p.levou < 0 ? 'EMPATE' : `${curto(m.jogadores[p.levou])} LEVOU O ROUND`, GW / 2, 60, '#ececec', 1, 'meio');
    }
  }
}
