/**
 * O fliperama do bar (08/10): o gabinete com a tela do Atari (fliperamaJogos.ts), o direcional e o
 * botão A. Abre pelo barJogos.ts (no celular do jogador, ou na janelinha do mestre quando um NPC joga).
 *
 * Dois na mesma máquina jogam em DUPLA: no menu, "dupla" e A manda o convite; o outro aceita com A
 * (ou recusa com Menu) e os dois começam juntos. As jogadas vão de um aparelho para o outro pelo
 * servidor, sem ficar guardadas (é tudo na hora).
 *
 * Os recordes (sozinho) ficam neste aparelho, com as três letras de quem jogou, como no fliperama de
 * verdade.
 */
import { bar } from '@crona/shared';
import type { Dados, Mesa, TelaDoBar } from './barJogos';
import { h } from './dom';
import { musica, type NomeMusica } from './chiptune';
import { Atravessa, COR, curto, fx, H, JOGOS as JOGOS_BASE, larguraTexto, Pong, PulaPula, semAcento, texto, W, type Botao, type Entrada, type Jogo, type Nivel } from './fliperamaJogos';
import { Invasores } from './fliperamaInvasores';
import { sfx } from './sfx';
import { vestirComArte } from './arteBar';

/** Os jogos do menu: os de dupla (fliperamaJogos.ts) e o INVASORES (15/10), que é só sozinho. */
const JOGOS = [
  ...JOGOS_BASE,
  { id: 'invasores', nome: 'INVASORES', dica: 'A ATIRA, TEM CHEFE', toque: 'O DEDO LEVA A NAVE E ATIRA', recorde: true, soSozinho: true, novo: (_d?: unknown, n?: Nivel) => new Invasores(undefined, n) as Jogo },
] as const;
/** A altura de cada jogo no menu (quatro cabem acima dos ajustes). */
const yDoJogo = (i: number) => 40 + i * 14;

const PASSO = 1000 / 60;
/** a tela de verdade: 4 pixels de tela para cada pixel do jogo (o brilho e o rastro do tubo precisam de espaço) */
const ESC = 4;
/** o letreiro que corre embaixo do menu */
const LETREIRO = 'SUVACO SECO  *  O CHOPP MAIS GELADO DA REGIAO  *  DESDE 1987  *  A FICHA E NO BALCAO  *  ';
const CHAVE = 'crona.fliperama.recordes';
const MAX_RECORDES = 5;
/** O recorde de lenda (09/10, o Felipe): AON, 99999, sempre no topo de todo jogo do Feliperama. Não é gravado: só aparece. */
const LENDA = { n: 'AON', p: 99999 };
const ehLenda = (r: { n: string; p: number }) => r.n === LENDA.n && r.p === LENDA.p;
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** A sensibilidade da alavanca (09/10: rápido demais; 15/10: lento demais, então o padrão é ALTA): o quanto da velocidade máxima. O teclado não usa. */
const SENSIBILIDADES = [
  { nome: 'BAIXA', k: 0.5 },
  { nome: 'MEDIA', k: 0.72 },
  { nome: 'ALTA', k: 1 },
];
const NIVEIS = ['FACIL', 'NORMAL', 'DIFICIL'];
const CHAVE_AJUSTES = 'crona.fliperama.ajustes';
/** a zona morta da alavanca (do raio) e a curva da força: pouca inclinação, bem pouca velocidade */
const ZONA_MORTA = 0.12;
const CURVA = 1.2;
function lerAjustes(): { nivel: Nivel; sens: number } {
  try {
    const a = JSON.parse(localStorage.getItem(CHAVE_AJUSTES) ?? '{}') as { nivel?: number; sens?: number };
    return { nivel: (a.nivel === 0 || a.nivel === 2 ? a.nivel : 1) as Nivel, sens: a.sens === 0 || a.sens === 1 || a.sens === 2 ? a.sens : 2 };
  } catch {
    return { nivel: 1, sens: 2 };
  }
}

type Recorde = { n: string; p: number };
type Estado = 'boot' | 'menu' | 'jogo' | 'fim' | 'nome' | 'tabela' | 'esperando' | 'convite';

const TECLAS: Record<string, Botao> = {
  ArrowUp: 'cima',
  KeyW: 'cima',
  ArrowDown: 'baixo',
  KeyS: 'baixo',
  ArrowLeft: 'esq',
  KeyA: 'esq',
  ArrowRight: 'dir',
  KeyD: 'dir',
  Space: 'a',
  Enter: 'a',
  KeyZ: 'a',
  KeyX: 'a',
};

function lerRecordes(): Record<string, Recorde[]> {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Record<string, Recorde[]>;
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}

function gravarRecordes(r: Record<string, Recorde[]>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    /* sem armazenamento: o recorde vale só agora */
  }
}

/** O dedo fica preso ao botão (ou à tela) até soltar, mesmo escorregando para fora. */
function prender(el: Element, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* o ponteiro já foi embora */
  }
}

/** A partida em dupla: o jogo, o meu lado (0 = quem convidou) e o que o outro mandou no fim. */
interface Partida {
  jogo: number;
  lado: number;
  outro: string;
  /** os pontos finais do outro (quando ele terminou) */
  fimOutro: number | null;
}

export class Fliperama implements TelaDoBar {
  readonly el: HTMLElement;
  /** a tela que aparece (4x) e o que fica por trás dela: o jogo em 160 × 192, o brilho, o rastro e o chiado */
  private tela: HTMLCanvasElement;
  private d: CanvasRenderingContext2D;
  private jogoCv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private brilho: CanvasRenderingContext2D;
  private rastro: CanvasRenderingContext2D;
  private ruido: HTMLCanvasElement;
  private somBt: HTMLButtonElement;
  /** a falha do tubo (raríssima), a persiana entre as telas, o boot e a música de agora */
  private falha = 0;
  private cortina = 0;
  private bootQ = 0;
  private trilhaAtual = '';
  private estrelas = Array.from({ length: 42 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.08 + Math.random() * 0.4 }));
  private m: Mesa | null = null;
  private ligado = false;
  private teclas: EventTarget | null = null;
  private raf = 0;
  private ultimo = 0;
  private acum = 0;
  private quadro = 0;
  // o que o jogador faz
  private segura = new Set<Botao>();
  private apertou = new Set<Botao>();
  /** as direções que a alavanca está segurando (soltar a alavanca só larga estas, não as do teclado) */
  private alavanca = new Set<Botao>();
  /** a alavanca agora (do meio até a borda, de -1 a 1), ou null solta */
  private joyEixo: { x: number; y: number } | null = null;
  /** a dificuldade e a sensibilidade escolhidas no menu (guardadas no aparelho) */
  private nivel: Nivel = lerAjustes().nivel;
  private sens = lerAjustes().sens;
  /** a linha do menu onde está o cursor: os jogos, a dupla (com alguém na máquina), o nível e a sensibilidade */
  private linha = 0;
  /** o nível que veio no convite (em dupla vale o de quem chamou) */
  private conviteNivel: Nivel = 1;
  private dedo: { x: number; y: number } | null = null;
  private tocou = false;
  // o que está na tela
  private estado: Estado = 'menu';
  private sel = 0;
  private jogo: Jogo | null = null;
  private espera = 0;
  private iniciais = 'AAA';
  private letra = 0;
  private recordes = lerRecordes();
  private destaque = -1;
  /** o melhor de cada jogo nesta vez no fliperama (vai para o mestre ao sair) */
  private melhor: { jogo: string; pontos: number } | null = null;
  // a dupla
  private dupla = true;
  private partida: Partida | null = null;
  private convite: number | null = null;
  /** o recado que aparece no menu um tempo ("CATARINA RECUSOU") */
  private recado = '';
  private recadoAte = 0;
  /** o quadro em que a partida acabou aqui */
  private fimEm = 0;

  constructor() {
    this.tela = h('canvas', { class: 'flip-tela', width: W * ESC, height: H * ESC, 'aria-label': 'Tela do Feliperama' }) as HTMLCanvasElement;
    this.d = this.tela.getContext('2d')!;
    this.jogoCv = h('canvas', { width: W, height: H }) as HTMLCanvasElement;
    this.g = this.jogoCv.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.brilho = (h('canvas', { width: W / 4, height: H / 4 }) as HTMLCanvasElement).getContext('2d')!;
    this.rastro = (h('canvas', { width: W * ESC, height: H * ESC }) as HTMLCanvasElement).getContext('2d')!;
    this.ruido = h('canvas', { class: 'flip-ruido', width: 80, height: 96, 'aria-hidden': 'true' }) as HTMLCanvasElement;
    this.somBt = h(
      'button',
      {
        class: `flip-som${musica.ligada ? '' : ' off'}`,
        type: 'button',
        title: 'Música do Feliperama',
        'aria-label': 'Música do Feliperama',
        onclick: () => {
          const on = musica.alternar();
          this.somBt.classList.toggle('off', !on);
          sfx.chip(on ? 880 : 440, on ? 1320 : 220, 0.08);
        },
      },
      '♪',
    ) as HTMLButtonElement;
    this.tela.addEventListener('pointerdown', (e) => {
      prender(this.tela, e.pointerId);
      this.dedo = this.noJogo(e);
      this.tocou = true;
    });
    this.tela.addEventListener('pointermove', (e) => {
      if (this.dedo) this.dedo = this.noJogo(e);
    });
    const soltar = () => (this.dedo = null);
    this.tela.addEventListener('pointerup', soltar);
    this.tela.addEventListener('pointercancel', soltar);

    const pequeno = (rotulo: string, fazer: () => void) =>
      h('button', { class: 'flip-mini', type: 'button', onclick: () => (sfx.click(), fazer()) }, h('i'), h('span', null, rotulo));

    this.el = h(
      'div',
      { class: 'flip' },
      h(
        'div',
        { class: 'flip-gabinete' },
        h(
          'header',
          { class: 'flip-letreiro' },
          h('div', { class: 'flip-lampadas', 'aria-hidden': 'true' }, ...Array.from({ length: 13 }, (_, i) => h('i', { style: `--i:${i}` }))),
          h('b', null, 'FELIPERAMA'),
          h('span', null, 'Suvaco Seco · Crédito 1'),
          h('div', { class: 'flip-listras', 'aria-hidden': 'true' }),
          this.somBt,
        ),
        h('div', { class: 'flip-moldura' }, this.tela, this.ruido, h('div', { class: 'flip-crt', 'aria-hidden': 'true' }), h('div', { class: 'flip-vidro', 'aria-hidden': 'true' })),
        h(
          'div',
          { class: 'flip-controles' },
          this.joystick(),
          h('div', { class: 'flip-meio' }, pequeno('Menu', () => this.voltarAoMenu()), pequeno('Sair', () => this.m?.sair(this.melhor))),
          this.botao(h('button', { class: 'flip-a', type: 'button', 'aria-label': 'Botão A' }, h('span', null, 'A')), 'a'),
        ),
      ),
    );
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    // o gabinete pintado (arte/bar/fliperama-*.png), peça por peça, quando o Códex entregar
    void vestirComArte(this.el, {
      corpo: ['fliperama-corpo'],
      moldura: ['fliperama-moldura'],
      letreiro: ['fliperama-letreiro'],
      painel: ['fliperama-painel'],
      botao: ['fliperama-botao', 'fliperama-botao-apertado'],
      alavanca: ['fliperama-alavanca-centro', 'fliperama-alavanca-cima', 'fliperama-alavanca-baixo', 'fliperama-alavanca-esq', 'fliperama-alavanca-dir'],
      mini: ['fliperama-mini', 'fliperama-mini-apertado'],
    });
  }

  // ---------------------------------------------------------------- a mesa

  mesa(m: Mesa) {
    const antes = this.m;
    this.m = m;
    const meu = m.jogadores[m.eu[0]] ?? '';
    if (!antes) {
      const letras = semAcento(meu).replace(/[^A-Z]/g, '');
      this.iniciais = (letras + 'AAA').slice(0, 3);
    }
    // alguém entrou ou saiu: a partida em dupla acaba
    if (antes && antes.jogadores.join('|') !== m.jogadores.join('|')) {
      if (this.partida || this.estado === 'esperando' || this.estado === 'convite') {
        const saiu = antes.jogadores.find((n) => !m.jogadores.includes(n));
        this.avisar(saiu ? `${curto(saiu)} SAIU` : 'A DUPLA MUDOU');
        this.partida = null;
        this.jogo = null;
        this.estado = 'menu';
      }
      if (m.jogadores.length > antes.jogadores.length) this.avisar(`${curto(m.jogadores.at(-1)!)} CHEGOU`), (this.dupla = true);
    }
  }

  /** O outro da dupla (ou null, sozinho). */
  private outro(): { lugar: number; nome: string } | null {
    const m = this.m;
    if (!m || m.jogadores.length < 2) return null;
    const lugar = m.jogadores.findIndex((_, i) => i !== m.eu[0]);
    return lugar < 0 ? null : { lugar, nome: m.jogadores[lugar] };
  }

  private enviar(dados: Dados) {
    this.m?.enviar(dados);
  }

  private avisar(texto: string) {
    this.recado = texto;
    this.recadoAte = this.quadro + 180;
  }

  jogada(_de: number, d: Dados) {
    const outro = this.outro();
    switch (d.tipo) {
      case 'convite':
        if (typeof d.jogo !== 'number' || !JOGOS[d.jogo]) return;
        this.convite = d.jogo;
        this.conviteNivel = (d.nivel === 0 || d.nivel === 2 ? d.nivel : 1) as Nivel;
        this.partida = null;
        this.jogo = null;
        this.estado = 'convite';
        sfx.arpejo([784, 988, 784, 988], 0.08);
        navigator.vibrate?.([30, 40, 30]);
        return;
      case 'cancela':
        if (this.estado === 'convite') (this.estado = 'menu'), this.avisar(`${curto(outro?.nome ?? '')} DESISTIU`);
        return;
      case 'recusa':
        if (this.estado === 'esperando') (this.estado = 'menu'), this.avisar(`${curto(outro?.nome ?? '')} RECUSOU`);
        return;
      case 'aceita':
        if (this.estado === 'esperando' && typeof d.jogo === 'number' && typeof d.semente === 'number') this.comecarDupla(d.jogo, d.semente, 0, this.nivel);
        return;
      case 'desistiu':
        if (this.partida) (this.partida = null), (this.jogo = null), (this.estado = 'menu'), this.avisar(`${curto(outro?.nome ?? '')} LARGOU A PARTIDA`);
        return;
    }
    const p = this.partida;
    const j = this.jogo;
    if (!p || !j) return;
    if (d.tipo === 'pong' && j instanceof Pong) j.aplicar(d.s);
    else if (d.tipo === 'raquete' && j instanceof Pong && typeof d.y === 'number') j.remoto = d.y;
    else if (d.tipo === 'pos' && j instanceof Atravessa && typeof d.y === 'number' && typeof d.p === 'number') j.outro = { y: d.y, p: d.p, passos: typeof d.passos === 'number' ? d.passos : 0 };
    else if (d.tipo === 'pos' && j instanceof PulaPula && typeof d.p === 'number') j.outro = { p: d.p, vivo: true };
    else if (d.tipo === 'fim' && typeof d.p === 'number') {
      p.fimOutro = d.p;
      if (j instanceof PulaPula) j.outro = { p: d.p, vivo: false };
      if (j instanceof Atravessa && j.outro) j.outro.p = d.p;
    }
  }

  // ---------------------------------------------------------------- ligar e desligar

  ligar(teclas: EventTarget) {
    if (this.ligado) return;
    this.ligado = true;
    this.el.classList.remove('apagando');
    // liga como fliperama de verdade: o sistema, a ficha caindo, o crédito
    this.estado = 'boot';
    this.bootQ = 0;
    this.trilhaAtual = '';
    fx.limpar();
    this.teclas = teclas;
    teclas.addEventListener('keydown', this.tecla as EventListener);
    teclas.addEventListener('keyup', this.tecla as EventListener);
    // perdeu o foco (trocou de aba, clicou fora): solta tudo, senão a seta fica "apertada" e a peça anda sozinha
    window.addEventListener('blur', this.soltarTudo);
    document.addEventListener('visibilitychange', this.soltarTudo);
    this.ultimo = 0;
    this.raf = requestAnimationFrame(this.laco);
  }

  desligar() {
    this.ligado = false;
    cancelAnimationFrame(this.raf);
    this.teclas?.removeEventListener('keydown', this.tecla as EventListener);
    this.teclas?.removeEventListener('keyup', this.tecla as EventListener);
    window.removeEventListener('blur', this.soltarTudo);
    document.removeEventListener('visibilitychange', this.soltarTudo);
    this.segura.clear();
    musica.parar();
    if (this.partida) this.enviar({ tipo: 'desistiu' });
  }

  /** Desliga como TV velha: a imagem vira uma linha, a linha vira um ponto e some. */
  async apagar() {
    this.el.classList.add('apagando');
    musica.parar();
    sfx.chip(1600, 50, 0.4, 0.05);
    await new Promise((r) => window.setTimeout(r, 520));
  }

  /**
   * A alavanca vista de cima (09/10, o Felipe: "o dedão na bolinha vermelha, ela vai acompanhando"): a bola segue o dedo
   * dentro da base e a direção vira as setas do jogo (com diagonal); solta, ela volta ao meio. As setinhas de ouro em
   * volta acendem na direção.
   */
  private joystick(): HTMLElement {
    const bola = h('i', { class: 'flip-joy-bola' });
    const setas = (['cima', 'baixo', 'esq', 'dir'] as Botao[]).map((b) => h('i', { class: `flip-joy-seta s-${b}`, 'data-b': b }));
    const el = h('div', { class: 'flip-dpad flip-joy', role: 'application', 'aria-label': 'Alavanca: arraste para os lados' }, h('span', { class: 'flip-joy-base' }), ...setas, bola);
    const ZONA = 0.3;
    const aplicar = (dx: number, dy: number) => {
      const novo = new Set<Botao>();
      if (dy < -ZONA) novo.add('cima');
      if (dy > ZONA) novo.add('baixo');
      if (dx < -ZONA) novo.add('esq');
      if (dx > ZONA) novo.add('dir');
      for (const b of ['cima', 'baixo', 'esq', 'dir'] as Botao[]) {
        if (novo.has(b) && !this.alavanca.has(b)) {
          this.segura.add(b);
          this.apertou.add(b);
          navigator.vibrate?.(5);
        } else if (!novo.has(b) && this.alavanca.has(b)) this.segura.delete(b);
      }
      this.alavanca = novo;
      for (const sb of setas) sb.classList.toggle('on', novo.has(sb.dataset.b as Botao));
    };
    const mover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const raio = r.width * 0.32;
      let dx = (e.clientX - (r.left + r.width / 2)) / raio;
      let dy = (e.clientY - (r.top + r.height / 2)) / raio;
      const d = Math.hypot(dx, dy);
      if (d > 1) (dx /= d), (dy /= d);
      bola.style.translate = `${dx * raio}px ${dy * raio}px`;
      this.joyEixo = { x: dx, y: dy };
      aplicar(dx, dy);
    };
    let dedo: number | null = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      prender(el, e.pointerId);
      dedo = e.pointerId;
      el.classList.add('pegando');
      mover(e);
    });
    el.addEventListener('pointermove', (e) => e.pointerId === dedo && mover(e));
    const solta = () => {
      dedo = null;
      el.classList.remove('pegando');
      bola.style.translate = '';
      this.joyEixo = null;
      aplicar(0, 0);
    };
    el.addEventListener('pointerup', solta);
    el.addEventListener('pointercancel', solta);
    el.addEventListener('lostpointercapture', solta);
    return el;
  }

  /** O botão do controle: segurar vale enquanto o dedo estiver nele. */
  private botao(el: HTMLElement, b: Botao): HTMLElement {
    const solta = () => {
      this.segura.delete(b);
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      prender(el, e.pointerId);
      this.segura.add(b);
      this.apertou.add(b);
      el.classList.add('on');
      navigator.vibrate?.(6);
    });
    el.addEventListener('pointerup', solta);
    el.addEventListener('pointercancel', solta);
    el.addEventListener('lostpointercapture', solta);
    return el;
  }

  private noJogo(e: PointerEvent) {
    const r = this.tela.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  private soltarTudo = () => {
    this.segura.clear();
    this.apertou.clear();
    this.alavanca = new Set<Botao>();
    this.joyEixo = null;
  };

  /** quando a última repetição de tecla valeu (no menu e nas iniciais, segurar a seta rola, sem disparar rápido demais) */
  private ultRepeticao = 0;

  private tecla = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && e.type === 'keydown') return this.voltarAoMenu();
    const b = TECLAS[e.code];
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'keyup') return void this.segura.delete(b);
    if (!e.repeat) this.apertou.add(b);
    else if ((this.estado === 'menu' || this.estado === 'nome') && e.timeStamp - this.ultRepeticao > 110) (this.apertou.add(b), (this.ultRepeticao = e.timeStamp));
    this.segura.add(b);
  };

  // ---------------------------------------------------------------- o laço do jogo

  private laco = (t: number) => {
    if (!this.ligado) return;
    this.raf = requestAnimationFrame(this.laco);
    const dt = this.ultimo ? Math.min(100, t - this.ultimo) : PASSO;
    this.ultimo = t;
    this.acum += dt;
    let passos = 0;
    while (this.acum >= PASSO && passos < 5) {
      this.passo();
      this.acum -= PASSO;
      passos++;
    }
    if (passos) this.desenhar();
  };

  private entrada(): Entrada {
    return { segura: this.segura, apertou: this.apertou, dedo: this.dedo, tocou: this.tocou, eixo: this.eixo() };
  }

  /** A força de cada eixo: a alavanca analógica (com a zona morta e a curva) ou o teclado; vezes a sensibilidade. */
  private eixo() {
    const k = SENSIBILIDADES[this.sens].k;
    const j = this.joyEixo;
    if (j) {
      const d = Math.hypot(j.x, j.y);
      if (d <= ZONA_MORTA) return { x: 0, y: 0 };
      const m = ((Math.min(1, d) - ZONA_MORTA) / (1 - ZONA_MORTA)) ** CURVA;
      return { x: (j.x / d) * m * k, y: (j.y / d) * m * k };
    }
    const s = this.segura;
    // o teclado é tudo ou nada: a sensibilidade (15/10, "tudo muito lento") vale só para a alavanca analógica
    return { x: (s.has('dir') ? 1 : 0) - (s.has('esq') ? 1 : 0), y: (s.has('baixo') ? 1 : 0) - (s.has('cima') ? 1 : 0) };
  }

  /** As linhas do menu, de cima para baixo, com a altura de cada uma na tela do jogo. */
  private linhasDoMenu(): { id: string; y: number }[] {
    const l = JOGOS.map((_, i) => ({ id: `j${i}`, y: yDoJogo(i) }));
    if (this.outro()) l.push({ id: 'dupla', y: 98 });
    l.push({ id: 'nivel', y: 110 }, { id: 'sens', y: 122 });
    return l;
  }

  /** Mexe no ajuste da linha (para a direita ou a esquerda) e guarda no aparelho. */
  private ajustar(id: string, passo: number) {
    if (id === 'dupla') this.dupla = !this.dupla;
    else if (id === 'nivel') this.nivel = (((this.nivel + passo) % 3) + 3) % 3 as Nivel;
    else if (id === 'sens') this.sens = (((this.sens + passo) % 3) + 3) % 3;
    else return;
    sfx.chip(880, 880, 0.04);
    try {
      localStorage.setItem(CHAVE_AJUSTES, JSON.stringify({ nivel: this.nivel, sens: this.sens }));
    } catch {
      /* sem armazenamento */
    }
  }

  private passo() {
    this.quadro++;
    const e = this.entrada();
    const a = e.apertou.has('a') || e.tocou;
    const outro = this.outro();
    const antes = this.estado;
    fx.passo();
    if (this.cortina > 0) this.cortina--;
    if (this.falha > 0) this.falha--;
    // o tubo falha de vez em quando (uma vez a cada meio minuto, mais ou menos)
    else if (Math.random() < 1 / 1800) (this.falha = 7 + Math.floor(Math.random() * 6)), sfx.ruido(0.1, 3000, 0.03);
    switch (this.estado) {
      case 'boot':
        this.bootQ++;
        if (this.bootQ === 18 || this.bootQ === 42 || this.bootQ === 62) sfx.chip(1200, 1200, 0.03, 0.05);
        if (this.bootQ === 116) sfx.arpejo([988, 1319], 0.09, 0.1), sfx.ruido(0.12, 4000, 0.04);
        if (this.bootQ >= 170 || (a && this.bootQ > 10)) this.estado = 'menu';
        break;
      case 'menu': {
        const linhas = this.linhasDoMenu();
        this.linha = Math.min(this.linha, linhas.length - 1);
        if (e.apertou.has('cima') || e.apertou.has('baixo')) {
          this.linha = (this.linha + (e.apertou.has('cima') ? linhas.length - 1 : 1)) % linhas.length;
          if (this.linha < JOGOS.length) this.sel = this.linha;
          sfx.chip(660, 660, 0.04);
        }
        const aqui = linhas[this.linha].id;
        if (e.apertou.has('esq') || e.apertou.has('dir')) this.ajustar(aqui, e.apertou.has('esq') ? -1 : 1);
        // o dedo: toca no jogo para escolher, toca de novo para começar; num ajuste, troca o valor
        let tocouNoVazio = false;
        if (e.tocou && e.dedo) {
          const i = linhas.findIndex((l) => Math.abs(e.dedo!.y + 1 - (l.y + 2)) <= 7);
          tocouNoVazio = i < 0;
          if (i >= JOGOS.length) {
            this.linha = i;
            this.ajustar(linhas[i].id, e.dedo.x < W / 2 ? -1 : 1);
            break;
          }
          if (i >= 0 && i !== this.sel) {
            this.linha = this.sel = i;
            sfx.chip(660, 660, 0.04);
            break;
          }
          if (i >= 0) this.linha = i;
        }
        if (a && this.linha >= JOGOS.length && !e.tocou) {
          this.ajustar(aqui, 1);
          break;
        }
        // (um toque em espaço vazio do menu, fora das linhas, não começa o jogo)
        if (a && !tocouNoVazio) {
          if (outro && this.dupla && !('soSozinho' in JOGOS[this.sel])) {
            this.enviar({ tipo: 'convite', jogo: this.sel, nivel: this.nivel });
            this.estado = 'esperando';
            sfx.chip(660, 880, 0.12);
          } else this.comecar();
        }
        break;
      }
      case 'esperando':
        break;
      case 'convite':
        if (a && this.convite !== null) {
          const semente = bar.novaSemente();
          this.enviar({ tipo: 'aceita', jogo: this.convite, semente });
          this.comecarDupla(this.convite, semente, 1, this.conviteNivel);
        }
        break;
      case 'jogo':
        this.jogo!.passo(e);
        if (this.partida) this.rede();
        if (this.jogo!.fim) {
          this.estado = 'fim';
          this.espera = 50;
          this.fimEm = this.quadro;
          const j = JOGOS[this.sel];
          if (this.partida) {
            this.enviar({ tipo: 'fim', p: this.jogo!.pontos });
            if (this.jogo instanceof Pong && this.partida.lado === 0) this.enviar({ tipo: 'pong', s: this.jogo.estado() });
          } else if (j.recorde && this.jogo!.pontos > (this.melhor?.pontos ?? 0)) this.melhor = { jogo: j.nome, pontos: this.jogo!.pontos };
          // o PULA-PULA já tem o som da queda
          if (j.id !== 'pula') sfx.arpejo([659, 523, 392, 262], 0.12);
        }
        break;
      case 'fim':
        // em dupla, o PULA-PULA de quem caiu primeiro continua mostrando o outro
        if (this.espera > 0) this.espera--;
        else if (a && !this.esperandoOutro()) {
          if (!this.partida && this.ehNovoRecorde()) {
            // novo recorde: aí sim, as três letras
            this.estado = 'nome';
            this.letra = 0;
            sfx.arpejo([523, 659, 784, 1046, 784, 1046], 0.08);
          } else {
            // entrou na tabela sem ser o melhor: grava com as letras de quem joga, sem perguntar nada
            if (!this.partida && this.entraNoRecorde()) this.gravar(false);
            this.voltarAoMenu();
          }
        }
        break;
      case 'nome': {
        const l = LETRAS.indexOf(this.iniciais[this.letra]);
        const troca = (d: number) => {
          const nova = LETRAS[(l + d + LETRAS.length) % LETRAS.length];
          this.iniciais = this.iniciais.slice(0, this.letra) + nova + this.iniciais.slice(this.letra + 1);
          sfx.chip(660, 660, 0.03);
        };
        if (e.apertou.has('cima')) troca(1);
        if (e.apertou.has('baixo')) troca(-1);
        if (e.apertou.has('esq') && this.letra > 0) this.letra--;
        if (e.apertou.has('dir') && this.letra < 2) this.letra++;
        // o dedo: em cima da letra sobe, embaixo desce, no OK confirma
        if (e.tocou && e.dedo && e.dedo.y > 70 && e.dedo.y < 118) {
          const i = Math.floor((e.dedo.x - (W / 2 - 36)) / 24);
          if (i >= 0 && i < 3) {
            this.letra = i;
            troca(e.dedo.y < 94 ? 1 : -1);
          }
          break;
        }
        if (e.apertou.has('a') || (e.tocou && e.dedo && e.dedo.y >= 118)) {
          sfx.chip(880, 880, 0.05);
          if (this.letra < 2 && e.apertou.has('a')) this.letra++;
          else this.gravar();
        }
        break;
      }
      case 'tabela':
        if (this.espera > 0) this.espera--;
        else if (a) this.estado = 'menu';
        break;
    }
    // trocou de tela: a persiana, como nos jogos de Atari
    if (this.estado !== antes && (this.estado === 'jogo' || this.estado === 'menu' || this.estado === 'convite')) this.cortina = 14;
    if (this.estado === 'jogo' && antes !== 'jogo') fx.limpar();
    this.trilha();
    this.apertou.clear();
    this.tocou = false;
  }

  /** A música de cada tela: a do menu, a de cada jogo, a fanfarra do recorde e a vinheta do fim. */
  private trilha() {
    // no menu (e no convite), o tema do jogo marcado: trocar de jogo troca a música
    let alvo: NomeMusica | '' = JOGOS[this.estado === 'convite' && this.convite !== null ? this.convite : this.sel].id as NomeMusica;
    if (this.estado === 'boot') alvo = '';
    else if (this.estado === 'jogo') alvo = (this.jogo?.musica?.() ?? JOGOS[this.sel].id) as NomeMusica;
    else if (this.estado === 'nome') alvo = 'recorde';
    else if (this.estado === 'fim') {
      const r = this.resultado();
      alvo = r === null ? '' : r ? 'vitoria' : 'derrota';
    }
    if (alvo === this.trilhaAtual) return;
    // a vinheta toca uma vez e fica o silêncio até a próxima tela
    if (this.trilhaAtual === 'vitoria' || this.trilhaAtual === 'derrota') if (this.estado === 'fim') return;
    this.trilhaAtual = alvo;
    if (alvo) musica.tocar(alvo);
    else musica.parar();
  }

  /** Ganhou (true), perdeu (false) ou ainda não se sabe (null, esperando o outro). */
  private resultado(): boolean | null {
    const j = this.jogo;
    if (!j) return false;
    if (j instanceof Pong) return j.pontos > j.deles;
    const p = this.partida;
    if (p) {
      if (this.esperandoOutro()) return null;
      const dele = p.fimOutro ?? (j instanceof Atravessa ? (j.outro?.p ?? 0) : j instanceof PulaPula ? (j.outro?.p ?? 0) : 0);
      return j.pontos >= dele;
    }
    return this.ehNovoRecorde();
  }

  /** O que vai para o outro celular durante a partida em dupla. */
  private rede() {
    const j = this.jogo!;
    const p = this.partida!;
    if (j instanceof Pong) {
      if (this.quadro % 2) return;
      if (p.lado === 0) this.enviar({ tipo: 'pong', s: j.estado() });
      else this.enviar({ tipo: 'raquete', y: Math.round(j.minhaRaquete * 10) / 10 });
    } else if (this.quadro % 6 === 0) {
      if (j instanceof Atravessa) this.enviar({ tipo: 'pos', ...j.posicao() });
      else if (j instanceof PulaPula) this.enviar({ tipo: 'pos', p: j.pontos });
    }
  }

  /** Em dupla, ainda falta o outro terminar (o PULA-PULA de quem caiu primeiro, o fim do ATRAVESSA). */
  private esperandoOutro() {
    const p = this.partida;
    if (!p || this.jogo instanceof Pong) return false;
    // o ATRAVESSA termina junto (o relógio é o mesmo): espera uns segundos pelo número final
    if (this.jogo instanceof Atravessa) return p.fimOutro === null && this.quadro - this.fimEm < 180;
    return p.fimOutro === null;
  }

  private comecar() {
    this.jogo = JOGOS[this.sel].novo(undefined, this.nivel);
    this.dedo = null;
    this.partida = null;
    this.estado = 'jogo';
    this.quadro = 0;
    sfx.arpejo([523, 784, 1046], 0.07);
  }

  private comecarDupla(jogo: number, semente: number, lado: number, nivel: Nivel) {
    const outro = this.outro();
    this.sel = jogo;
    this.partida = { jogo, lado, outro: outro?.nome ?? '', fimOutro: null };
    const d = { semente, lado, outro: outro?.nome ?? '' };
    this.jogo = JOGOS[jogo].id === 'pong' ? new Pong(lado === 0 ? 'dono' : 'convidado', nivel) : JOGOS[jogo].id === 'atravessa' ? new Atravessa(d, nivel) : new PulaPula(d, nivel);
    this.convite = null;
    this.estado = 'jogo';
    this.quadro = 0;
    sfx.arpejo([523, 659, 784, 1046], 0.07);
  }

  private voltarAoMenu() {
    if (this.estado === 'menu') return;
    if (this.estado === 'boot') return void (this.estado = 'menu');
    if (this.estado === 'esperando') this.enviar({ tipo: 'cancela' });
    if (this.estado === 'convite') this.enviar({ tipo: 'recusa' });
    if (this.partida && this.estado === 'jogo') this.enviar({ tipo: 'desistiu' });
    this.jogo = null;
    this.partida = null;
    this.convite = null;
    this.estado = 'menu';
    sfx.chip(440, 220, 0.1);
  }

  /** A tabela do jogo marcado: a lenda (AON 99999) no topo e os recordes do aparelho embaixo. */
  private lista(): Recorde[] {
    const guardados = (this.recordes[JOGOS[this.sel].id] ?? []).filter((r) => !ehLenda(r));
    return [LENDA, ...guardados].slice(0, MAX_RECORDES);
  }

  /** A pontuação fica na tabela do aparelho (as 5 melhores, fora a lenda)? */
  private entraNoRecorde() {
    const j = JOGOS[this.sel];
    const p = this.jogo?.pontos ?? 0;
    const l = this.lista();
    return j.recorde && p > 0 && (l.length < MAX_RECORDES || p > l[l.length - 1].p);
  }

  /** NOVO RECORDE (15/10, o Felipe: só aí pede o nome): passou a melhor pontuação deste aparelho, ou foi a primeira. */
  private ehNovoRecorde() {
    const j = JOGOS[this.sel];
    const p = this.jogo?.pontos ?? 0;
    const guardados = (this.recordes[j.id] ?? []).filter((r) => !ehLenda(r));
    return j.recorde && p > 0 && (!guardados.length || p > Math.max(...guardados.map((r) => r.p)));
  }

  /** `mostrar` = abre a tabela com o destaque (novo recorde); sem ele, só guarda e segue. */
  private gravar(mostrar = true) {
    const p = this.jogo?.pontos ?? 0;
    const l = [...this.lista(), { n: this.iniciais, p }].sort((x, y) => y.p - x.p).slice(0, MAX_RECORDES);
    this.destaque = l.findIndex((r) => r.n === this.iniciais && r.p === p);
    this.recordes = { ...lerRecordes(), [JOGOS[this.sel].id]: l.filter((r) => !ehLenda(r)) };
    gravarRecordes(this.recordes);
    if (!mostrar) return;
    this.estado = 'tabela';
    this.espera = 40;
  }

  // ---------------------------------------------------------------- desenhar

  private desenhar() {
    this.desenharJogo();
    // a persiana entre as telas: faixas de 8 linhas que abrem de cima para baixo
    if (this.cortina > 0) {
      const g = this.g;
      const n = Math.ceil((this.cortina / 14) * 8);
      g.fillStyle = COR.preto;
      for (let y = 0; y < H; y += 8) g.fillRect(0, y + 8 - n, W, n);
    }
    this.compor();
    if (this.quadro % 2 === 0) this.chiado();
  }

  /**
   * O tubo: a imagem do jogo ampliada, com o rastro do fósforo (o que se mexe deixa um fantasma que
   * apaga devagar), o brilho em volta do que é claro, a tela tremendo quando o jogo pede e, de vez em
   * quando, uma falha que arrasta umas faixas para o lado.
   */
  private compor() {
    const d = this.d;
    const w = W * ESC;
    const hh = H * ESC;
    const tr = fx.tremor;
    const sx = tr ? Math.round((Math.random() * 2 - 1) * tr * 1.6) : 0;
    const sy = tr ? Math.round((Math.random() * 2 - 1) * tr * 1.2) : 0;
    d.globalCompositeOperation = 'source-over';
    d.globalAlpha = 1;
    d.imageSmoothingEnabled = false;
    if (sx || sy) (d.fillStyle = '#000'), d.fillRect(0, 0, w, hh);
    d.drawImage(this.jogoCv, sx, sy, w, hh);
    // o rastro: o quadro de antes, mais fraco, por baixo do que for mais claro
    d.globalCompositeOperation = 'lighten';
    d.globalAlpha = 0.4;
    d.drawImage(this.rastro.canvas, 0, 0);
    this.rastro.globalCompositeOperation = 'copy';
    this.rastro.drawImage(this.tela, 0, 0);
    // o brilho: o jogo em miniatura, ampliado e borrado, somado por cima
    const b = this.brilho;
    b.imageSmoothingEnabled = true;
    b.clearRect(0, 0, W / 4, H / 4);
    b.drawImage(this.jogoCv, 0, 0, W / 4, H / 4);
    d.globalCompositeOperation = 'lighter';
    d.globalAlpha = 0.26;
    d.imageSmoothingEnabled = true;
    d.drawImage(b.canvas, sx - 14, sy - 14, w + 28, hh + 28);
    d.globalCompositeOperation = 'source-over';
    d.globalAlpha = 1;
    // a falha: faixas arrastadas e riscos de estática
    if (this.falha > 0) {
      d.imageSmoothingEnabled = false;
      for (let i = 0; i < 3; i++) {
        const y = Math.floor(Math.random() * hh);
        const alto = 8 + Math.floor(Math.random() * 40);
        const dx = Math.round((Math.random() * 2 - 1) * 24);
        d.drawImage(this.tela, 0, y, w, alto, dx, y, w, alto);
      }
      d.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 6; i++) d.fillRect(0, Math.floor(Math.random() * hh), w, 1 + Math.floor(Math.random() * 3));
    }
  }

  /** O chiado do tubo: um granulado que muda a cada dois quadros (bem fraco, por cima). */
  private chiado() {
    const c = this.ruido.getContext('2d')!;
    const img = c.createImageData(80, 96);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.random() * 255;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }

  private desenharJogo() {
    const g = this.g;
    const q = this.quadro;
    const pisca = (q >> 4) % 2 === 0;
    if (this.estado === 'boot') return this.boot(g);
    if (this.estado === 'jogo' || this.estado === 'fim') {
      this.jogo!.desenhar(g, q);
      fx.desenhar(g);
      // o jeito de jogar com o dedo, no começo
      if (this.estado === 'jogo' && q < 240 && pisca) {
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(0, H - 22, W, 11);
        texto(g, JOGOS[this.sel].toque, W / 2, H - 19, COR.amarelo, 1, 'meio');
        texto(g, 'SETAS OU WASD MOVEM', W / 2, H - 28, COR.claro, 1, 'meio');
      }
      if (this.estado === 'fim') {
        if (this.partida) this.caixaDupla(g, pisca);
        else this.caixaFim(g, pisca);
      }
      return;
    }
    g.fillStyle = COR.preto;
    g.fillRect(0, 0, W, H);
    if (this.estado === 'menu') return this.menu(g, pisca);
    if (this.estado === 'nome') return this.nome(g, pisca);
    if (this.estado === 'esperando' || this.estado === 'convite') return this.chamado(g, pisca);
    this.tabela(g, pisca);
  }

  /** As listras do Atari embaixo do título (as cores andam devagar). */
  private listras(g: CanvasRenderingContext2D, y: number) {
    const cores = [COR.vermelho, COR.laranja, COR.ouro, COR.amarelo];
    const k = (this.quadro >> 3) % 4;
    cores.forEach((_, i) => {
      g.fillStyle = cores[(i + k) % 4];
      g.fillRect(14, y + i * 3, W - 28, 2);
    });
  }

  /** O sistema ligando: as linhas do teste, a ficha caindo no cofre e o crédito. */
  private boot(g: CanvasRenderingContext2D) {
    const q = this.bootQ;
    g.fillStyle = COR.preto;
    g.fillRect(0, 0, W, H);
    const pontos = (n: number) => '.'.repeat(Math.max(0, Math.min(8, n)));
    if (q > 8) texto(g, 'CRONA ARCADE SYSTEM', 10, 14, COR.claro);
    if (q > 14) texto(g, 'SUVACO SECO LTDA  1987', 10, 22, COR.medio);
    if (q > 18) texto(g, `MEMORIA ${pontos((q - 18) >> 1)}${q > 36 ? ' OK' : ''}`, 10, 40, COR.verde);
    if (q > 42) texto(g, `VIDEO   ${pontos((q - 42) >> 1)}${q > 58 ? ' OK' : ''}`, 10, 48, COR.verde);
    if (q > 62) texto(g, `SOM     ${pontos((q - 62) >> 1)}${q > 78 ? ' OK' : ''}`, 10, 56, COR.verde);
    // o cofre e a ficha caindo
    if (q > 84) {
      if (q < 116 && (q >> 3) % 2 === 0) texto(g, 'INSIRA A FICHA', W / 2, 92, COR.amarelo, 1, 'meio');
      g.fillStyle = COR.escuro;
      g.fillRect(W / 2 - 10, 132, 20, 14);
      g.fillStyle = COR.preto;
      g.fillRect(W / 2 - 1, 134, 2, 8);
      g.fillStyle = q > 112 && q < 124 ? COR.vermelho : '#5a1010';
      g.fillRect(W / 2 - 8, 143, 3, 2);
      g.fillRect(W / 2 + 5, 143, 3, 2);
      if (q > 92 && q < 116) {
        const y = 100 + ((q - 92) / 24) * 34;
        // a ficha girando: larga, fina, larga
        const larg = [5, 3, 1, 3][(q >> 2) % 4];
        g.fillStyle = COR.ouro;
        g.fillRect(Math.round(W / 2 - larg / 2), Math.round(y), larg, 5);
        g.fillStyle = COR.amarelo;
        g.fillRect(Math.round(W / 2 - larg / 2), Math.round(y), Math.max(1, larg - 2), 1);
      }
    }
    if (q > 118) texto(g, 'CREDITO 01', W / 2, 106, (q >> 2) % 2 ? COR.branco : COR.verde, 2, 'meio');
    if (q > 140) texto(g, 'BOA SORTE, AGENTE', W / 2, 160, COR.rosa, 1, 'meio');
  }

  /** O fundo do menu: as estrelas descendo devagar, em duas camadas. */
  private ceu(g: CanvasRenderingContext2D) {
    for (const s of this.estrelas) {
      s.y += s.v;
      if (s.y > H) (s.y = 0), (s.x = Math.random() * W);
      g.fillStyle = s.v > 0.34 ? COR.claro : s.v > 0.2 ? COR.medio : COR.escuro;
      g.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }
  }

  /** O título: as letras ondulando e um brilho correndo por elas. */
  private titulo(g: CanvasRenderingContext2D, y: number) {
    const t = 'FELIPERAMA';
    const x0 = W / 2 - larguraTexto(t, 2) / 2;
    const brilho = (this.quadro >> 2) % 30;
    for (let i = 0; i < t.length; i++) {
      const dy = Math.round(Math.sin(this.quadro * 0.08 + i * 0.7) * 1.5);
      const cor = i === brilho ? COR.branco : i === brilho - 1 || i === brilho + 1 ? COR.amarelo : COR.ouro;
      // a sombra dura de pixel
      texto(g, t[i], x0 + i * 8 + 1, y + dy + 1, '#5a3010', 2);
      texto(g, t[i], x0 + i * 8, y + dy, cor, 2);
    }
  }

  /** Um gostinho de cada jogo, ao lado do escolhido. */
  private previa(g: CanvasRenderingContext2D, id: string, y: number) {
    const q = this.quadro;
    const x = 128;
    if (id === 'pong') {
      const bx = x + 2 + Math.abs(((q * 0.6) % 36) - 18);
      g.fillStyle = COR.laranja;
      g.fillRect(x, y + 1 + Math.round(Math.sin(q * 0.1) * 2), 1, 5);
      g.fillStyle = COR.verde;
      g.fillRect(x + 22, y + 1 + Math.round(Math.cos(q * 0.1) * 2), 1, 5);
      g.fillStyle = COR.branco;
      g.fillRect(Math.round(bx), y + 3 + Math.round(Math.sin(q * 0.17) * 2), 2, 2);
    } else if (id === 'invasores') {
      // a nave e a frota que anda de lado
      const ax = x - 2 + Math.abs(((q * 0.4) % 20) - 10);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = [COR.rosa, COR.verdeClaro, COR.azulClaro][k];
        g.fillRect(Math.round(ax) + k * 8, y + 1, 5, 3);
        g.fillRect(Math.round(ax) + k * 8 + 1, y + 4, 3, 1);
      }
      g.fillStyle = COR.verdeClaro;
      g.fillRect(x + 10, y + 8, 5, 2);
      g.fillRect(x + 12, y + 7, 1, 1);
    } else if (id === 'atravessa') {
      g.fillStyle = COR.medio;
      g.fillRect(x - 2, y + 6, 26, 1);
      const cx = x - 2 + ((q * 0.5) % 30);
      g.fillStyle = COR.vermelho;
      g.fillRect(Math.round(cx), y + 2, 6, 3);
      g.fillStyle = COR.azulClaro;
      g.fillRect(Math.round(cx) + 4, y + 3, 2, 1);
    } else {
      const pulo = Math.abs(Math.sin(q * 0.09)) * 6;
      g.fillStyle = COR.verde;
      g.fillRect(x + 6, y + 8, 10, 1);
      g.fillStyle = COR.pele;
      g.fillRect(x + 10, Math.round(y + 1 - pulo), 2, 2);
      g.fillStyle = COR.azul;
      g.fillRect(x + 10, Math.round(y + 3 - pulo), 2, 3);
    }
  }

  private menu(g: CanvasRenderingContext2D, pisca: boolean) {
    const outro = this.outro();
    this.ceu(g);
    this.titulo(g, 6);
    texto(g, 'SUVACO SECO', W / 2, 20, COR.cinza, 1, 'meio');
    this.listras(g, 30);
    const linhas = this.linhasDoMenu();
    const cursor = linhas[Math.min(this.linha, linhas.length - 1)]?.id;
    const seta = 14 + Math.round(Math.sin(this.quadro * 0.2) * 1.5);
    JOGOS.forEach((j, i) => {
      const y = yDoJogo(i);
      const on = i === this.sel;
      const aqui = cursor === `j${i}`;
      if (on) {
        g.fillStyle = aqui ? COR.escuro : '#202028';
        g.fillRect(10, y - 3, W - 20, 13);
        this.previa(g, j.id, y - 1);
      }
      // o cursor anda de leve para a frente e para trás
      if (aqui) texto(g, '>', seta, y, pisca ? COR.amarelo : COR.ouro, 2);
      texto(g, j.nome, W / 2 - (on ? 8 : 0), y, on ? COR.branco : COR.cinza, 2, 'meio');
    });
    const j = JOGOS[this.sel];
    // os ajustes: a dupla (com alguém na máquina), o nível e a sensibilidade, com < > em volta do valor
    const ajuste = (id: string, y: number, rotulo: string, valor: string, cor: string) => {
      const aqui = cursor === id;
      if (aqui) {
        g.fillStyle = COR.escuro;
        g.fillRect(10, y - 2, W - 20, 9);
        texto(g, '>', seta, y, pisca ? COR.amarelo : COR.ouro, 1);
      }
      texto(g, rotulo, 24, y, aqui ? COR.branco : COR.cinza, 1);
      texto(g, aqui ? `< ${valor} >` : valor, W - 22, y, cor, 1, 'dir');
    };
    if (outro) ajuste('dupla', 98, 'JOGAR', this.dupla && !('soSozinho' in j) ? `DUPLA ${curto(outro.nome)}` : 'SOZINHO', this.dupla && !('soSozinho' in j) ? COR.rosa : COR.claro);
    ajuste('nivel', 110, 'NIVEL', NIVEIS[this.nivel], [COR.verde, COR.amarelo, COR.vermelho][this.nivel]);
    ajuste('sens', 122, 'ALAVANCA', SENSIBILIDADES[this.sens].nome, COR.azulClaro);
    texto(g, this.dupla && outro && !('soSozinho' in j) ? (j.id === 'pong' ? 'UM CONTRA O OUTRO' : j.id === 'atravessa' ? 'LADO A LADO NA AVENIDA' : 'QUEM SUBIR MAIS VENCE') : j.dica, W / 2, 136, COR.verde, 1, 'meio');
    if (this.dupla && outro && !('soSozinho' in j)) texto(g, 'A CHAMA PARA JOGAR', W / 2, 148, COR.medio, 1, 'meio');
    else if (j.recorde) {
      const l = this.lista();
      l.slice(0, 3).forEach((r, i) => texto(g, `${i + 1} ${r.n} ${String(r.p).padStart(5, ' ')}`, W / 2, 146 + i * 8, i === 0 ? COR.amarelo : COR.claro, 1, 'meio'));
    } else {
      // o PONG não tem tabela, mas a lenda aparece mesmo assim
      texto(g, 'CONTRA A MAQUINA', W / 2, 146, COR.medio, 1, 'meio');
      texto(g, `1 ${LENDA.n} ${LENDA.p}`, W / 2, 156, COR.amarelo, 1, 'meio');
    }
    if (this.quadro < this.recadoAte) {
      g.fillStyle = COR.vermelho;
      g.fillRect(0, 170, W, 12);
      texto(g, this.recado, W / 2, 173, COR.branco, 1, 'meio');
    } else if (pisca) texto(g, 'APERTE A', W / 2, 174, COR.branco, 1, 'meio');
    // o letreiro correndo embaixo
    g.fillStyle = '#0c0c18';
    g.fillRect(0, 184, W, 8);
    const larg = larguraTexto(LETREIRO) + 4;
    const x = -((this.quadro * 0.5) % larg);
    texto(g, LETREIRO, x, 186, COR.medio);
    texto(g, LETREIRO, x + larg, 186, COR.medio);
  }

  /** O convite: esperando o outro, ou o outro chamando. */
  private chamado(g: CanvasRenderingContext2D, pisca: boolean) {
    const outro = curto(this.outro()?.nome ?? '');
    this.listras(g, 20);
    if (this.estado === 'esperando') {
      texto(g, 'CHAMANDO', W / 2, 50, COR.cinza, 1, 'meio');
      texto(g, outro, W / 2, 62, COR.rosa, 2, 'meio');
      texto(g, `PARA O ${JOGOS[this.sel].nome}`, W / 2, 84, COR.branco, 1, 'meio');
      const pontos = '.'.repeat(1 + ((this.quadro >> 4) % 3));
      texto(g, `ESPERANDO${pontos}`, W / 2 - 18, 110, COR.amarelo, 1);
      texto(g, 'MENU CANCELA', W / 2, 170, COR.medio, 1, 'meio');
      return;
    }
    texto(g, outro, W / 2, 46, COR.rosa, 2, 'meio');
    texto(g, 'CHAMOU PARA JOGAR', W / 2, 66, COR.branco, 1, 'meio');
    texto(g, JOGOS[this.convite ?? 0].nome, W / 2, 84, COR.ouro, 2, 'meio');
    if (pisca) texto(g, 'A ACEITA', W / 2, 130, COR.verde, 2, 'meio');
    texto(g, 'MENU RECUSA', W / 2, 160, COR.medio, 1, 'meio');
  }

  private caixaFim(g: CanvasRenderingContext2D, pisca: boolean) {
    g.fillStyle = 'rgba(0,0,0,0.78)';
    g.fillRect(8, 60, W - 16, 72);
    g.fillStyle = COR.ouro;
    g.fillRect(8, 60, W - 16, 1);
    g.fillRect(8, 131, W - 16, 1);
    texto(g, 'FIM DE JOGO', W / 2, 70, COR.ouro, 2, 'meio');
    texto(g, this.jogo!.resumo(), W / 2, 92, COR.branco, 1, 'meio');
    if (JOGOS[this.sel].recorde) texto(g, `${this.jogo!.pontos} PONTOS`, W / 2, 104, COR.amarelo, 1, 'meio');
    if (this.espera === 0 && pisca) texto(g, 'APERTE A', W / 2, 118, COR.claro, 1, 'meio');
  }

  /** O fim da partida em dupla: o placar dos dois e quem venceu. */
  private caixaDupla(g: CanvasRenderingContext2D, pisca: boolean) {
    const j = this.jogo!;
    const p = this.partida!;
    const eu = curto(this.m?.jogadores[this.m.eu[0]] ?? '');
    const ele = curto(p.outro);
    const meus = j.pontos;
    const dele = j instanceof Pong ? j.deles : (p.fimOutro ?? (j instanceof Atravessa ? (j.outro?.p ?? 0) : j instanceof PulaPula ? (j.outro?.p ?? 0) : 0));
    const espera = this.esperandoOutro();
    g.fillStyle = 'rgba(0,0,0,0.8)';
    g.fillRect(6, 52, W - 12, 88);
    g.fillStyle = COR.rosa;
    g.fillRect(6, 52, W - 12, 1);
    g.fillRect(6, 139, W - 12, 1);
    texto(g, 'FIM DE JOGO', W / 2, 60, COR.ouro, 2, 'meio');
    texto(g, `${eu} ${meus}`, W / 2 - 6, 84, COR.amarelo, 1, 'dir');
    texto(g, 'X', W / 2, 84, COR.cinza, 1, 'meio');
    texto(g, `${dele} ${ele}`, W / 2 + 6, 84, COR.rosa, 1);
    if (espera) {
      texto(g, `ESPERANDO ${ele}${'.'.repeat(1 + ((this.quadro >> 4) % 3))}`, W / 2, 104, COR.claro, 1, 'meio');
      return;
    }
    const placar = meus === dele ? 'EMPATE' : meus > dele ? 'VOCE VENCEU!' : `${ele} VENCEU`;
    texto(g, placar, W / 2, 102, meus > dele ? COR.verde : meus === dele ? COR.branco : COR.vermelho, 2, 'meio');
    if (this.espera === 0 && pisca) texto(g, 'APERTE A', W / 2, 126, COR.claro, 1, 'meio');
  }

  private nome(g: CanvasRenderingContext2D, pisca: boolean) {
    texto(g, 'NOVO RECORDE!', W / 2, 16, pisca ? COR.amarelo : COR.ouro, 2, 'meio');
    texto(g, `${this.jogo?.pontos ?? 0} PONTOS`, W / 2, 36, COR.branco, 1, 'meio');
    texto(g, 'SUAS INICIAIS', W / 2, 54, COR.cinza, 1, 'meio');
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 36 + i * 24 + 12;
      const on = i === this.letra;
      texto(g, '+', x, 74, on ? COR.verde : COR.escuro, 1, 'meio');
      texto(g, this.iniciais[i], x, 84, on ? COR.branco : COR.claro, 3, 'meio');
      if (on && pisca) (g.fillStyle = COR.amarelo), g.fillRect(x - 6, 101, 12, 2);
      texto(g, '-', x, 108, on ? COR.verde : COR.escuro, 1, 'meio');
    }
    g.fillStyle = COR.escuro;
    g.fillRect(W / 2 - 20, 124, 40, 15);
    texto(g, 'OK', W / 2, 129, COR.amarelo, 1, 'meio');
    texto(g, 'CIMA E BAIXO TROCAM A LETRA', W / 2, 160, COR.medio, 1, 'meio');
    texto(g, 'A PASSA PARA A PROXIMA', W / 2, 170, COR.medio, 1, 'meio');
  }

  private tabela(g: CanvasRenderingContext2D, pisca: boolean) {
    texto(g, JOGOS[this.sel].nome, W / 2, 14, COR.ouro, 2, 'meio');
    texto(g, 'RECORDES', W / 2, 32, COR.cinza, 1, 'meio');
    this.listras(g, 42);
    this.lista().forEach((r, i) => {
      const on = i === this.destaque;
      if (on && !pisca) return;
      texto(g, `${i + 1}  ${r.n}  ${String(r.p).padStart(5, ' ')}`, W / 2, 68 + i * 16, on ? COR.amarelo : COR.branco, 2, 'meio');
    });
    if (this.espera === 0 && pisca) texto(g, 'APERTE A', W / 2, 178, COR.claro, 1, 'meio');
  }
}
