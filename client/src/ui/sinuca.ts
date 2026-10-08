/**
 * A sinuca do bar (08/10), no celular de quem joga (ou na janelinha do mestre, pelo NPC). A mesa vista
 * de cima, em pé. Na sua vez: encoste na mesa para mirar (o taco gira em volta da branca, com a linha
 * até a primeira bola e para onde ela vai), segure TACADA para carregar a força e solte para bater.
 *
 * A física e a regra ficam em shared/src/bar/sinuca.ts e dão o mesmo resultado em todo celular: quem
 * bate manda só a direção e a força (guardadas, para quem reconectar), e cada celular roda as bolas.
 * Enquanto alguém mira, os outros veem o taco dele se mexendo.
 *
 * Com vida de bar: a luz do lustre balançando em cima do pano, o taco avançando na tacada com o pó do
 * giz, o estalo das bolas pela força da batida, o baque na tabela, a bola sumindo na caçapa, a bandeja
 * com as encaçapadas, a faixa de quem joga, a falta em vermelho, o confete de quem vence e a bossinha
 * do jukebox. Desenhado por código até chegar a arte do Códex (a mesa, as bolas e o taco).
 */
import { bar } from '@crona/shared';
import { faixa, Festa } from './barFx';
import type { Dados, Mesa, TelaDoBar } from './barJogos';
import { musica } from './chiptune';
import { botaoMusica } from './dardos';
import { h } from './dom';
import { sfx } from './sfx';

const S = bar.sinuca;
const curto = (n: string) => n.split(/\s+/)[0] ?? n;
/** a borda de madeira em volta do pano, em unidades da mesa */
const BORDA = 9;
/** quantos passos de física por quadro (240 por segundo de verdade, um pouco mais rápido) */
const PASSOS_QUADRO = 6;
/** o taco avançando até a branca, antes de ela sair */
const ESTOCADA = 120;
/** a bola entrando na caçapa */
const QUEDA = 260;

/** Uma semente que todo celular calcula igual: a da mesa e de quem está nela. */
function sementeDaMesa(m: Mesa) {
  let x = 5381 + m.id;
  for (const ch of m.jogadores.join('|')) x = (Math.imul(x, 33) + ch.charCodeAt(0)) >>> 0;
  return x;
}

/** A bolinha da bandeja (as encaçapadas), com a faixa nas listradas. */
function bolinha(n: number, nova: boolean) {
  const cor = S.corDa(n);
  const fundo = n >= 9 ? `linear-gradient(#f4f1e6 0 28%, ${cor} 28% 72%, #f4f1e6 72%)` : cor;
  return h('i', { class: `bj-bola${nova ? ' nova' : ''}`, style: `background:${fundo}`, title: `Bola ${n}` }, h('b', null, String(n)));
}

export class Sinuca implements TelaDoBar {
  readonly el: HTMLElement;
  private placar = h('div', { class: 'bj-placar' });
  private bandeja = h('div', { class: 'bj-bandeja' });
  private aviso = h('p', { class: 'bj-aviso' });
  private palco: HTMLElement;
  private forcaEl = h('i');
  private botaoTacada: HTMLButtonElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private m: Mesa | null = null;
  private e: bar.sinuca.Estado = S.novo(1, 1);
  /** a tacada rodando (as bolas andando) e quem bateu */
  private rodando: { mundo: bar.sinuca.Mundo; de: number } | null = null;
  /** o taco avançando (a tacada ainda vai sair) */
  private estocada: { mundo: bar.sinuca.Mundo; de: number; t0: number; dir: { x: number; y: number }; forca: number } | null = null;
  /** as bolas entrando na caçapa agora */
  private caindo: { n: number; x: number; y: number; cx: number; cy: number; t0: number }[] = [];
  private ligado = false;
  private raf = 0;
  /** a direção do taco (unitária) e a força carregando (de 0 a 1) */
  private mira = { x: 0, y: -1 };
  private carregando: number | null = null;
  private forca = 0;
  private forcaTique = 0;
  /** o taco de quem está mirando em outro aparelho */
  private miraOutro: { x: number; y: number; f: number } | null = null;
  private miraEnviada = 0;
  private recado = '';
  private festa = new Festa();
  private ultimoEstalo = 0;
  private ultimaTabela = 0;
  /** as encaçapadas que a bandeja já mostrou (para a nova "cair" nela) */
  private naBandeja = new Set<number>();
  private vezAnunciada = -1;

  constructor() {
    this.cv = h('canvas', { class: 'bj-canvas', 'aria-label': 'Mesa de sinuca' }) as HTMLCanvasElement;
    this.g = this.cv.getContext('2d')!;
    this.botaoTacada = h('button', { class: 'bj-bt forte bj-tacada', type: 'button' }, h('span', { class: 'bj-forca' }, this.forcaEl), h('b', null, 'Tacada')) as HTMLButtonElement;
    this.botaoTacada.addEventListener('pointerdown', (e) => {
      if (!this.podeBater()) return;
      e.preventDefault();
      try {
        this.botaoTacada.setPointerCapture(e.pointerId);
      } catch {
        /* sem captura */
      }
      this.carregando = performance.now();
      sfx.giz();
    });
    this.botaoTacada.addEventListener('pointerup', () => this.bater());
    this.botaoTacada.addEventListener('pointercancel', () => (this.carregando = null));
    this.palco = h('div', { class: 'bj-palco' }, this.cv);
    this.el = h(
      'div',
      { class: 'bj bj-sinuca' },
      h('header', { class: 'bj-topo' }, h('b', null, 'SINUCA'), h('span', null, 'bola 8 · lisas contra listradas'), botaoMusica()),
      this.placar,
      this.bandeja,
      this.palco,
      this.aviso,
      h(
        'footer',
        { class: 'bj-rodape' },
        h('button', { class: 'bj-bt', type: 'button', onclick: () => this.novaPartida() }, 'Nova partida'),
        this.botaoTacada,
        h('button', { class: 'bj-bt sair', type: 'button', onclick: () => this.m?.sair() }, 'Sair'),
      ),
    );
    const mirar = (e: PointerEvent) => {
      if (!this.podeBater()) return;
      const p = this.naMesa(e);
      const b = this.branca();
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) this.mira = { x: dx / d, y: dy / d };
    };
    this.cv.addEventListener('pointerdown', (e) => {
      try {
        this.cv.setPointerCapture(e.pointerId);
      } catch {
        /* sem captura */
      }
      mirar(e);
      this.cv.dataset.mirando = '1';
    });
    this.cv.addEventListener('pointermove', (e) => {
      if (this.cv.dataset.mirando) mirar(e);
    });
    const solta = () => delete this.cv.dataset.mirando;
    this.cv.addEventListener('pointerup', solta);
    this.cv.addEventListener('pointercancel', solta);
  }

  // ---------------------------------------------------------------- a mesa e as jogadas

  mesa(m: Mesa, log: { de: number; dados: Dados }[]) {
    const mudou = !this.m || this.m.jogadores.join('|') !== m.jogadores.join('|');
    this.m = m;
    if (mudou || log.length) {
      // a partida desde o começo: a da mesa nova, refeita com as tacadas guardadas (na hora, sem animar)
      this.e = S.novo(m.jogadores.length, sementeDaMesa(m));
      this.rodando = null;
      this.estocada = null;
      this.caindo = [];
      for (const { de, dados } of log) this.aplicar(de, dados, false);
      this.naBandeja = new Set(this.e.bolas.filter((b) => b.fora && b.n !== 0).map((b) => b.n));
      this.vezAnunciada = -1;
    }
    this.render();
    if (this.ligado) this.anunciar();
  }

  jogada(de: number, dados: Dados) {
    if (dados.tipo === 'mira' && typeof dados.x === 'number' && typeof dados.y === 'number') {
      this.miraOutro = { x: dados.x, y: dados.y, f: typeof dados.f === 'number' ? dados.f : 0 };
      return;
    }
    this.aplicar(de, dados, true);
  }

  private aplicar(de: number, d: Dados, animar: boolean) {
    if (d.tipo === 'comecar' && typeof d.semente === 'number') {
      this.e = S.novo(this.m?.jogadores.length ?? 1, d.semente);
      this.rodando = null;
      this.estocada = null;
      this.caindo = [];
      this.naBandeja.clear();
      this.vezAnunciada = -1;
      this.recado = animar ? 'Nova partida!' : '';
      if (animar) {
        musica.tocar('bar');
        sfx.ruido(0.3, 700, 0.08, 300);
        this.anunciar();
      }
    } else if (d.tipo === 'tacada' && typeof d.vx === 'number' && typeof d.vy === 'number') {
      // a tacada anterior ainda rodando aqui: termina na hora
      this.acabarJa();
      const mundo = S.tacar(this.e.bolas, d.vx, d.vy);
      const v = Math.sqrt(d.vx * d.vx + d.vy * d.vy) || 1;
      this.miraOutro = null;
      if (animar) this.estocada = { mundo, de, t0: performance.now(), dir: { x: d.vx / v, y: d.vy / v }, forca: v / S.VMAX };
      else this.terminar(S.ateParar(mundo), false);
    }
    this.render();
  }

  /** Termina na hora a tacada que estiver andando aqui (chegou outra, ou a mesa mudou). */
  private acabarJa() {
    const r = this.estocada ?? this.rodando;
    this.estocada = null;
    if (r) this.terminar(S.ateParar(r.mundo), false);
  }

  private terminar(m: bar.sinuca.Mundo, animar: boolean) {
    const antes = this.e;
    this.e = S.resolver(this.e, m);
    this.rodando = null;
    this.recado = this.e.aviso;
    if (animar) {
      const nome = curto(this.m?.jogadores[antes.vez] ?? '');
      if (this.e.vencedor !== null) {
        const ganhou = this.m?.eu.includes(this.e.vencedor);
        sfx.arpejo([523, 659, 784, 1046, 1318], 0.09);
        this.festa.confete(this.cv.width, 90);
        this.festa.piscar('#ffd27a', 18);
        faixa(this.palco, this.e.jogadores === 1 ? 'MESA LIMPA!' : `${curto(this.m?.jogadores[this.e.vencedor] ?? '').toUpperCase()} VENCEU!`, 'festa');
        musica.tocar(ganhou || this.e.jogadores === 1 ? 'vitoria' : 'derrota');
        window.setTimeout(() => this.ligado && musica.tocar('bar'), 3200);
      } else if (this.e.aviso.startsWith('FALTA')) {
        sfx.chip(300, 80, 0.4, 0.08);
        this.festa.piscar('#f0503f', 16);
        this.festa.tremer(5);
        faixa(this.palco, `FALTA DE ${nome.toUpperCase()}`, 'ruim');
        window.setTimeout(() => this.anunciar(), 1500);
      } else if (this.e.aviso.includes('JOGA DE NOVO')) {
        sfx.arpejo([659, 784, 988], 0.06, 0.06);
        if (this.e.grupos[antes.vez] && !antes.grupos[antes.vez]) faixa(this.palco, `${nome.toUpperCase()}: ${this.e.grupos[antes.vez] === 'lisas' ? 'LISAS' : 'LISTRADAS'}`, 'minha');
      } else this.anunciar();
    }
    this.render();
  }

  /** A faixa "SUA VEZ" ou "VEZ DE CATARINA", quando a vez muda. */
  private anunciar() {
    const m = this.m;
    if (!m || this.e.vencedor !== null || this.vezAnunciada === this.e.vez || m.jogadores.length < 2 || this.rodando || this.estocada) return;
    this.vezAnunciada = this.e.vez;
    const minha = this.minhaVez();
    faixa(this.palco, minha && m.eu.length === 1 ? 'SUA VEZ!' : `VEZ DE ${curto(m.jogadores[this.e.vez]).toUpperCase()}`, minha ? 'minha' : 'vez');
    if (minha) sfx.arpejo([659, 880], 0.07, 0.06), navigator.vibrate?.([20, 40, 20]);
  }

  private novaPartida() {
    if (!this.m) return;
    sfx.click();
    const semente = bar.novaSemente();
    this.m.enviar({ tipo: 'comecar', semente }, true, this.m.eu[0]);
    this.aplicar(this.m.eu[0], { tipo: 'comecar', semente }, true);
  }

  private minhaVez() {
    return !!this.m && this.m.eu.includes(this.e.vez);
  }

  private podeBater() {
    return this.minhaVez() && !this.rodando && !this.estocada && this.e.vencedor === null;
  }

  private branca() {
    return this.e.bolas.find((b) => b.n === 0)!;
  }

  /** Força de 0 a 1, indo e voltando enquanto segura (1,6 s de ida e volta). */
  private forcaAgora(agora: number) {
    if (this.carregando === null) return 0;
    const t = ((agora - this.carregando) / 1600) % 1;
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }

  private bater() {
    const f = this.forcaAgora(performance.now());
    this.carregando = null;
    if (!this.podeBater() || !this.m) return;
    const forca = Math.max(0.08, f);
    // arredondada antes de mandar: todos rodam a mesma tacada
    const vx = Math.round(this.mira.x * forca * S.VMAX * 1000) / 1000;
    const vy = Math.round(this.mira.y * forca * S.VMAX * 1000) / 1000;
    const de = this.e.vez;
    this.m.enviar({ tipo: 'tacada', vx, vy }, true, de);
    this.estocada = { mundo: S.tacar(this.e.bolas, vx, vy), de, t0: performance.now(), dir: { ...this.mira }, forca };
    this.recado = '';
    navigator.vibrate?.(15);
    this.render();
  }

  // ---------------------------------------------------------------- o laço

  ligar() {
    this.ligado = true;
    this.el.classList.add('entra');
    musica.tocar('bar');
    window.setTimeout(() => this.anunciar(), 600);
    const laco = () => {
      if (!this.ligado) return;
      this.raf = requestAnimationFrame(laco);
      this.quadro();
    };
    this.raf = requestAnimationFrame(laco);
  }

  desligar() {
    this.ligado = false;
    cancelAnimationFrame(this.raf);
    musica.parar();
  }

  private quadro() {
    const agora = performance.now();
    // o taco chegou na branca: a tacada sai
    const est = this.estocada;
    if (est && agora - est.t0 >= ESTOCADA) {
      this.estocada = null;
      this.rodando = { mundo: est.mundo, de: est.de };
      sfx.taco(est.forca);
      const b = this.branca();
      const { k, ox, oy } = this.geo();
      this.festa.faiscas(ox + (b.x - est.dir.x * S.RAIO) * k, oy + (b.y - est.dir.y * S.RAIO) * k, ['#6aa8ff', '#cfe2ff'], 8, 1.6, 0.02, 20, 2);
      if (est.forca > 0.8) this.festa.tremer(2);
    }
    const r = this.rodando;
    if (r) {
      for (let i = 0; i < PASSOS_QUADRO && !r.mundo.parado; i++) S.passo(r.mundo);
      this.sons(r.mundo, agora);
      if (r.mundo.parado && !this.caindo.length) this.terminar(r.mundo, true);
    }
    // a força carregando: a barra e um tique subindo
    this.forca = this.forcaAgora(agora);
    this.forcaEl.style.transform = `scaleX(${this.forca})`;
    if (this.carregando !== null && agora - this.forcaTique > 110) {
      this.forcaTique = agora;
      sfx.chip(240 + this.forca * 700, 240 + this.forca * 700, 0.025, 0.025);
    }
    if (this.podeBater() && this.m && agora - this.miraEnviada > 120) {
      this.miraEnviada = agora;
      this.m.enviar({ tipo: 'mira', x: Math.round(this.mira.x * 1000) / 1000, y: Math.round(this.mira.y * 1000) / 1000, f: Math.round(this.forca * 100) / 100 }, false, this.e.vez);
    }
    this.desenhar(agora);
  }

  /** Os sons do que aconteceu neste quadro (o mais forte de cada tipo) e as bolas que caíram. */
  private sons(m: bar.sinuca.Mundo, agora: number) {
    let bola = 0;
    let tabela = 0;
    for (const b of m.batidas) {
      if (b.tipo === 'bola') bola = Math.max(bola, b.forca);
      else tabela = Math.max(tabela, b.forca);
    }
    m.batidas.length = 0;
    if (bola > 0.01 && agora - this.ultimoEstalo > 35) (this.ultimoEstalo = agora), sfx.bolaNaBola(Math.min(1, bola * 1.8));
    if (tabela > 0.02 && agora - this.ultimaTabela > 50) (this.ultimaTabela = agora), sfx.tabela(Math.min(1, tabela * 2));
    for (const q of m.quedas) {
      this.caindo.push({ ...q, t0: agora });
      sfx.cacapa();
      const { k, ox, oy } = this.geo();
      const px = ox + Math.max(-1, Math.min(S.LARGURA + 1, q.cx)) * k;
      const py = oy + Math.max(-1, Math.min(S.COMPRIMENTO + 1, q.cy)) * k;
      const minha = this.e.grupos[this.e.vez] && S.grupoDa(q.n) === this.e.grupos[this.e.vez];
      if (q.n === 0) this.festa.texto(px, py + (py < oy + 10 ? 30 : -30) * this.festa.k, 'BRANCA!', '#ff8a73', 16);
      else if (q.n === 8) this.festa.texto(px, py + (py < oy + 10 ? 30 : -30) * this.festa.k, 'A 8!', '#ffd27a', 20);
      else this.festa.texto(px, py + (py < oy + 10 ? 30 : -30) * this.festa.k, minha || this.e.jogadores === 1 ? 'BOA!' : String(q.n), minha || this.e.jogadores === 1 ? '#79d98f' : '#f3e9d8', 16);
      this.festa.faiscas(px, py, [S.corDa(q.n), '#ffffff'], 10, 2.2, 0, 22, 2.5);
    }
    m.quedas.length = 0;
    this.caindo = this.caindo.filter((c) => agora - c.t0 < QUEDA);
  }

  // ---------------------------------------------------------------- desenhar

  /** A escala da mesa na tela (a mesa em pé, com a borda) e a origem do pano. */
  private geo() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr);
    const hh = Math.round(r.height * dpr);
    if (w && hh && (this.cv.width !== w || this.cv.height !== hh)) (this.cv.width = w), (this.cv.height = hh);
    const k = Math.min(this.cv.width / (S.LARGURA + BORDA * 2), this.cv.height / (S.COMPRIMENTO + BORDA * 2));
    const ox = (this.cv.width - S.LARGURA * k) / 2;
    const oy = (this.cv.height - S.COMPRIMENTO * k) / 2;
    this.festa.k = dpr;
    return { k, ox, oy, dpr };
  }

  private naMesa(e: PointerEvent) {
    const r = this.cv.getBoundingClientRect();
    const { k, ox, oy, dpr } = this.geo();
    return { x: ((e.clientX - r.left) * dpr - ox) / k, y: ((e.clientY - r.top) * dpr - oy) / k };
  }

  private desenhar(agora: number) {
    const g = this.g;
    const { k, ox, oy, dpr } = this.geo();
    const W = this.cv.width;
    const H = this.cv.height;
    const X = (x: number) => ox + x * k;
    const Y = (y: number) => oy + y * k;
    this.festa.passo();
    g.clearRect(0, 0, W, H);
    const s = this.festa.sacode();
    g.save();
    g.translate(s.x, s.y);
    // a madeira, o pano e as caçapas
    const bw = BORDA * k;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath();
    g.roundRect(ox - bw + 4 * dpr, oy - bw + 8 * dpr, S.LARGURA * k + bw * 2, S.COMPRIMENTO * k + bw * 2, bw * 0.8);
    g.fill();
    const madeira = g.createLinearGradient(ox - bw, 0, ox + S.LARGURA * k + bw, 0);
    madeira.addColorStop(0, '#4a2a12');
    madeira.addColorStop(0.5, '#6a3c1c');
    madeira.addColorStop(1, '#4a2a12');
    g.fillStyle = madeira;
    g.beginPath();
    g.roundRect(ox - bw, oy - bw, S.LARGURA * k + bw * 2, S.COMPRIMENTO * k + bw * 2, bw * 0.8);
    g.fill();
    g.strokeStyle = '#2a1608';
    g.lineWidth = 2 * dpr;
    g.stroke();
    const pano = g.createRadialGradient(X(50), Y(100), 10 * k, X(50), Y(100), 120 * k);
    pano.addColorStop(0, '#2f9a4a');
    pano.addColorStop(1, '#1b6330');
    g.fillStyle = pano;
    g.fillRect(ox, oy, S.LARGURA * k, S.COMPRIMENTO * k);
    // a sombra da tabela em cima do pano
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 3 * dpr;
    g.strokeRect(ox + 1.5 * dpr, oy + 1.5 * dpr, S.LARGURA * k - 3 * dpr, S.COMPRIMENTO * k - 3 * dpr);
    // os losangos da madeira e a linha da cabeça
    g.fillStyle = '#e8d8b0';
    for (const f of [0.25, 0.5, 0.75]) {
      g.fillRect(X(S.LARGURA * f) - 1.5 * dpr, oy - bw / 2 - 1.5 * dpr, 3 * dpr, 3 * dpr);
      g.fillRect(X(S.LARGURA * f) - 1.5 * dpr, Y(S.COMPRIMENTO) + bw / 2 - 1.5 * dpr, 3 * dpr, 3 * dpr);
    }
    for (const f of [0.125, 0.25, 0.375, 0.625, 0.75, 0.875]) {
      g.fillRect(ox - bw / 2 - 1.5 * dpr, Y(S.COMPRIMENTO * f) - 1.5 * dpr, 3 * dpr, 3 * dpr);
      g.fillRect(X(S.LARGURA) + bw / 2 - 1.5 * dpr, Y(S.COMPRIMENTO * f) - 1.5 * dpr, 3 * dpr, 3 * dpr);
    }
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 1 * dpr;
    g.beginPath();
    g.moveTo(ox, Y(S.CABECA.y));
    g.lineTo(X(S.LARGURA), Y(S.CABECA.y));
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.arc(X(S.PE.x), Y(S.PE.y), 1.2 * dpr, 0, Math.PI * 2);
    g.fill();
    for (const c of S.CACAPAS) {
      const cx = X(Math.max(-1, Math.min(S.LARGURA + 1, c.x)));
      const cy = Y(Math.max(-1, Math.min(S.COMPRIMENTO + 1, c.y)));
      const boca = g.createRadialGradient(cx, cy, 0, cx, cy, c.r * k * 0.85);
      boca.addColorStop(0, '#000');
      boca.addColorStop(0.75, '#0a0a0a');
      boca.addColorStop(1, '#2a1a0c');
      g.fillStyle = boca;
      g.beginPath();
      g.arc(cx, cy, c.r * k * 0.82, 0, Math.PI * 2);
      g.fill();
    }
    const bolas = this.rodando ? this.rodando.mundo.bolas : this.estocada ? this.estocada.mundo.bolas : this.e.bolas;
    // a mira: a linha até a primeira bola, a bola fantasma e para onde a bola acertada vai
    const parado = !this.rodando && !this.estocada && this.e.vencedor === null;
    const minha = parado && this.minhaVez();
    const dir = minha ? this.mira : parado ? this.miraOutro : null;
    if (dir) this.linhaDeMira(g, bolas, dir, X, Y, k, dpr, agora);
    // as bolas entrando na caçapa: vão para o centro dela, encolhendo e escurecendo
    for (const c of this.caindo) {
      const t = Math.min(1, (agora - c.t0) / QUEDA);
      const x = c.x + (Math.max(-1, Math.min(S.LARGURA + 1, c.cx)) - c.x) * t;
      const y = c.y + (Math.max(-1, Math.min(S.COMPRIMENTO + 1, c.cy)) - c.y) * t;
      g.globalAlpha = 1 - t * 0.7;
      this.bola(g, c.n, X(x), Y(y), S.RAIO * k * (1 - t * 0.55), dpr);
      g.globalAlpha = 1;
    }
    for (const b of bolas) if (!b.fora) this.bola(g, b.n, X(b.x), Y(b.y), S.RAIO * k, dpr);
    // o taco: mirando, recuando com a força, ou avançando na estocada
    const est = this.estocada;
    if (est) {
      const t = Math.min(1, (agora - est.t0) / ESTOCADA);
      this.taco(g, X(this.branca().x), Y(this.branca().y), est.dir, est.forca * (1 - t * t), k, dpr);
    } else if (dir) this.taco(g, X(this.branca().x), Y(this.branca().y), dir, minha ? this.forca : (this.miraOutro?.f ?? 0), k, dpr);
    // a luz do lustre em cima da mesa, balançando devagar
    const lx = X(50) + Math.sin(agora / 2600) * 6 * k;
    const ly = Y(100) + Math.cos(agora / 3400) * 4 * k;
    const luz = g.createRadialGradient(lx, ly, 20 * k, lx, ly, 150 * k);
    luz.addColorStop(0, 'rgba(255, 236, 190, 0.13)');
    luz.addColorStop(0.5, 'rgba(255, 220, 160, 0.03)');
    luz.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    g.fillStyle = luz;
    g.fillRect(-20 * dpr, -20 * dpr, W + 40 * dpr, H + 40 * dpr);
    g.restore();
    this.festa.desenhar(g, W, H);
  }

  private linhaDeMira(g: CanvasRenderingContext2D, bolas: bar.sinuca.Bola[], d: { x: number; y: number }, X: (x: number) => number, Y: (y: number) => number, k: number, dpr: number, agora: number) {
    const b = this.branca();
    const R = S.RAIO;
    // a primeira bola no caminho (onde a branca encosta nela)
    let t = Infinity;
    let alvo: bar.sinuca.Bola | null = null;
    for (const o of bolas) {
      if (o.fora || o.n === 0) continue;
      const fx = o.x - b.x;
      const fy = o.y - b.y;
      const proj = fx * d.x + fy * d.y;
      if (proj <= 0) continue;
      const perp2 = fx * fx + fy * fy - proj * proj;
      if (perp2 > 4 * R * R) continue;
      const ti = proj - Math.sqrt(4 * R * R - perp2);
      if (ti < t) (t = ti), (alvo = o);
    }
    // sem bola: até a tabela
    const tx = d.x > 0 ? (S.LARGURA - R - b.x) / d.x : d.x < 0 ? (R - b.x) / d.x : Infinity;
    const ty = d.y > 0 ? (S.COMPRIMENTO - R - b.y) / d.y : d.y < 0 ? (R - b.y) / d.y : Infinity;
    const tParede = Math.min(tx, ty);
    const fim = Math.min(t, tParede);
    const gx = b.x + d.x * fim;
    const gy = b.y + d.y * fim;
    g.save();
    // a linha "anda" (os tracinhos correm para a frente)
    g.setLineDash([4 * dpr, 4 * dpr]);
    g.lineDashOffset = -agora / 40;
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.4 * dpr;
    g.beginPath();
    g.moveTo(X(b.x), Y(b.y));
    g.lineTo(X(gx), Y(gy));
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(X(gx), Y(gy), R * k, 0, Math.PI * 2);
    g.stroke();
    if (alvo && t <= tParede) {
      // a bola acertada sai na linha dos centros
      const nx = alvo.x - gx;
      const ny = alvo.y - gy;
      const n = Math.sqrt(nx * nx + ny * ny) || 1;
      g.strokeStyle = 'rgba(255, 220, 120, 0.85)';
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.moveTo(X(alvo.x), Y(alvo.y));
      g.lineTo(X(alvo.x + (nx / n) * 22), Y(alvo.y + (ny / n) * 22));
      g.stroke();
    }
    g.restore();
  }

  private bola(g: CanvasRenderingContext2D, n: number, x: number, y: number, r: number, dpr: number) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.arc(x + r * 0.25, y + r * 0.3, r, 0, Math.PI * 2);
    g.fill();
    const cor = S.corDa(n);
    const listrada = n >= 9;
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = listrada ? '#f4f1e6' : cor;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    if (listrada) {
      g.fillStyle = cor;
      g.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1);
    }
    // o brilho
    const brilho = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
    brilho.addColorStop(0, 'rgba(255,255,255,0.55)');
    brilho.addColorStop(0.35, 'rgba(255,255,255,0)');
    brilho.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = brilho;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    if (n > 0 && r > 5 * dpr) {
      g.fillStyle = '#f4f1e6';
      g.beginPath();
      g.arc(x, y, r * 0.45, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#141414';
      g.font = `700 ${Math.round(r * 0.62)}px 'Roboto Condensed', sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), x, y + r * 0.04);
    }
  }

  /** O taco atrás da branca, recuando com a força. */
  private taco(g: CanvasRenderingContext2D, bx: number, by: number, d: { x: number; y: number }, forca: number, k: number, dpr: number) {
    const recuo = (S.RAIO + 1 + forca * 16) * k;
    const comp = 120 * k;
    const x0 = bx - d.x * recuo;
    const y0 = by - d.y * recuo;
    const x1 = x0 - d.x * comp;
    const y1 = y0 - d.y * comp;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 4 * dpr;
    g.beginPath();
    g.moveTo(x0 + 3 * dpr, y0 + 4 * dpr);
    g.lineTo(x1 + 3 * dpr, y1 + 4 * dpr);
    g.stroke();
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, '#f4ead0');
    grad.addColorStop(0.04, '#3a7ad8');
    grad.addColorStop(0.07, '#e8c48a');
    grad.addColorStop(0.7, '#b07a3a');
    grad.addColorStop(1, '#2a1608');
    g.strokeStyle = grad;
    g.lineWidth = 3.4 * dpr;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------- o placar

  private render() {
    const m = this.m;
    if (!m) return;
    const e = this.e;
    const restam = (grupo: bar.sinuca.Grupo | null) => e.bolas.filter((b) => !b.fora && b.n !== 0 && b.n !== 8 && (!grupo || S.grupoDa(b.n) === grupo)).length;
    this.placar.replaceChildren(
      ...m.jogadores.map((nome, i) => {
        const grupo = e.grupos[i] ?? null;
        return h(
          'div',
          { class: `bj-chip${i === e.vez && e.vencedor === null ? ' on' : ''}${e.vencedor === i ? ' venceu' : ''}`, style: `--cor:${i ? '#4f9bff' : '#e9a944'}` },
          h('span', null, curto(nome), m.npc[i] ? h('small', null, ' (NPC)') : m.eu.includes(i) ? h('small', null, ' (você)') : null),
          h('b', null, m.jogadores.length === 1 ? `${e.tacadas[0]} tacadas` : grupo ? `${grupo === 'lisas' ? 'Lisas' : 'Listradas'} · ${restam(grupo)}` : '—'),
        );
      }),
    );
    // a bandeja: as encaçapadas, a nova caindo nela
    const fora = e.bolas.filter((b) => b.fora && b.n !== 0).map((b) => b.n);
    this.bandeja.replaceChildren(...(fora.length ? fora.map((n) => bolinha(n, !this.naBandeja.has(n))) : [h('small', null, 'As encaçapadas vêm para cá')]));
    this.naBandeja = new Set(fora);
    const vez = curto(m.jogadores[e.vez] ?? '');
    const recado = this.recado ? `${this.recado.charAt(0)}${this.recado.slice(1).toLowerCase()} · ` : '';
    this.aviso.textContent =
      e.vencedor !== null
        ? m.jogadores.length === 1
          ? `Mesa limpa em ${e.tacadas[0]} tacadas!`
          : `${recado}${curto(m.jogadores[e.vencedor])} venceu!`
        : this.rodando || this.estocada
          ? 'As bolas estão rolando…'
          : this.minhaVez()
            ? `${recado}${m.eu.length > 1 ? `Vez de ${vez}: ` : 'Sua vez: '}encoste na mesa para mirar e segure Tacada para dar força.`
            : `${recado}Vez de ${vez}.`;
    this.botaoTacada.disabled = !this.podeBater();
    this.el.classList.toggle('minha-vez', this.podeBater());
  }
}
