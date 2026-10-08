/**
 * O fliperama do bar no celular do jogador (08/10). O mestre escolhe o agente no tabuleiro, escolhe
 * o fliperama e usa: a peça vai até ele e a tela do jogador se desfaz em pixels e vira o gabinete,
 * com a tela do Atari (fliperamaJogos.ts), o direcional e o botão A. Sair devolve a ficha; o mestre
 * fica sabendo (e do recorde). O mestre também chama de volta, usando o fliperama de novo.
 *
 * Os recordes ficam neste aparelho, com as três letras de quem jogou, como no fliperama de verdade.
 */
import { h, toast } from './dom';
import { COR, H, JOGOS, semAcento, texto, W, type Botao, type Entrada, type Jogo } from './fliperamaJogos';
import { sfx } from './sfx';

const PASSO = 1000 / 60;
const CHAVE = 'crona.fliperama.recordes';
const MAX_RECORDES = 5;
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

type Recorde = { n: string; p: number };
type Estado = 'menu' | 'jogo' | 'fim' | 'nome' | 'tabela';

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

const reduzido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const esperar = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export class Fliperama {
  private el: HTMLElement | null = null;
  private gabinete!: HTMLElement;
  private tela!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private pixels!: HTMLCanvasElement;
  private aberto = false;
  private saindo = false;
  private raf = 0;
  private ultimo = 0;
  private acum = 0;
  private quadro = 0;
  // o que o jogador faz
  private segura = new Set<Botao>();
  private apertou = new Set<Botao>();
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

  constructor(private aoSair: (recorde?: { jogo: string; pontos: number }) => void) {}

  /** Abre o fliperama (o mestre mandou): a tela se desfaz em pixels e o gabinete aparece. */
  async abrir(nome: string) {
    if (this.aberto) return;
    this.aberto = true;
    this.saindo = false;
    this.montar();
    const letras = semAcento(nome).replace(/[^A-Z]/g, '');
    this.iniciais = (letras + 'AAA').slice(0, 3);
    this.estado = 'menu';
    this.melhor = null;
    this.el!.classList.add('some');
    document.body.append(this.el!);
    window.addEventListener('keydown', this.tecla);
    window.addEventListener('keyup', this.tecla);
    sfx.arpejo([392, 523, 659, 784, 1046], 0.06);
    await this.desfazer(true);
    this.ultimo = 0;
    this.raf = requestAnimationFrame(this.laco);
  }

  /** Fecha: o gabinete se desfaz e a ficha volta. `avisar` = foi o jogador que saiu (o mestre fica sabendo). */
  async fechar(avisar: boolean, aviso?: string) {
    if (!this.aberto || this.saindo) return;
    this.saindo = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.tecla);
    window.removeEventListener('keyup', this.tecla);
    this.segura.clear();
    sfx.arpejo([784, 659, 523, 392], 0.06);
    await this.desfazer(false);
    this.el?.remove();
    this.aberto = false;
    this.saindo = false;
    if (avisar) this.aoSair(this.melhor ?? undefined);
    if (aviso) toast(aviso);
  }

  // ---------------------------------------------------------------- o gabinete

  private montar() {
    if (this.el) return;
    this.tela = h('canvas', { class: 'flip-tela', width: W, height: H, 'aria-label': 'Tela do fliperama' }) as HTMLCanvasElement;
    this.g = this.tela.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
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

    const seta = (b: Botao, rotulo: string) => this.botao(h('button', { class: `flip-seta s-${b}`, type: 'button', 'aria-label': rotulo }, h('i')), b);
    const pequeno = (rotulo: string, fazer: () => void) =>
      h('button', { class: 'flip-mini', type: 'button', onclick: () => (sfx.click(), fazer()) }, h('i'), h('span', null, rotulo));

    this.gabinete = h(
      'div',
      { class: 'flip-gabinete' },
      h('header', { class: 'flip-letreiro' }, h('b', null, 'FLIPERAMA'), h('span', null, 'Suvaco Seco · Crédito 1'), h('div', { class: 'flip-listras', 'aria-hidden': 'true' })),
      h('div', { class: 'flip-moldura' }, this.tela, h('div', { class: 'flip-crt', 'aria-hidden': 'true' })),
      h(
        'div',
        { class: 'flip-controles' },
        h('div', { class: 'flip-dpad' }, seta('cima', 'Cima'), seta('esq', 'Esquerda'), seta('dir', 'Direita'), seta('baixo', 'Baixo'), h('span', { class: 'flip-dpad-meio' })),
        h('div', { class: 'flip-meio' }, pequeno('Menu', () => this.voltarAoMenu()), pequeno('Sair', () => void this.fechar(true))),
        this.botao(h('button', { class: 'flip-a', type: 'button', 'aria-label': 'Botão A' }, h('span', null, 'A')), 'a'),
      ),
    );
    this.pixels = h('canvas', { class: 'flip-pixels', 'aria-hidden': 'true' }) as HTMLCanvasElement;
    this.el = h('div', { class: 'flip', role: 'dialog', 'aria-label': 'Fliperama' }, this.gabinete, this.pixels);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
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

  private tecla = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && e.type === 'keydown') return this.voltarAoMenu();
    const b = TECLAS[e.code];
    if (!b) return;
    e.preventDefault();
    if (e.type === 'keyup') return void this.segura.delete(b);
    if (!e.repeat) this.apertou.add(b);
    this.segura.add(b);
  };

  /**
   * A transição de pixels: a tela vira blocos coloridos do Atari, que escurecem e somem revelando o
   * gabinete (entrando) ou a ficha (saindo).
   */
  private async desfazer(entrando: boolean) {
    const el = this.el!;
    if (reduzido()) {
      this.gabinete.classList.toggle('hidden', !entrando);
      el.classList.toggle('some', !entrando);
      await esperar(entrando ? 0 : 200);
      return;
    }
    // blocos quadrados: 14 na largura da coluna do celular
    const bloco = Math.min(innerWidth, 480) / 14;
    const cols = Math.ceil(innerWidth / bloco);
    const linhas = Math.ceil(innerHeight / bloco);
    const cv = this.pixels;
    cv.width = cols;
    cv.height = linhas;
    cv.style.width = `${cols * bloco}px`;
    cv.style.height = `${linhas * bloco}px`;
    const g = cv.getContext('2d')!;
    const casas = Array.from({ length: cols * linhas }, (_, i) => i).sort(() => Math.random() - 0.5);
    const cores = [COR.laranja, COR.ouro, COR.vermelho, COR.roxo, COR.azul, COR.verde, COR.rosa];
    const fase = async (ms: number, pinta: (i: number) => void) => {
      const t0 = performance.now();
      let feitas = 0;
      while (feitas < casas.length) {
        await new Promise(requestAnimationFrame);
        const alvo = Math.min(casas.length, Math.ceil(((performance.now() - t0) / ms) * casas.length));
        for (; feitas < alvo; feitas++) pinta(casas[feitas]);
      }
    };
    const casa = (i: number, cor: string | null) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      if (cor) (g.fillStyle = cor), g.fillRect(x, y, 1, 1);
      else g.clearRect(x, y, 1, 1);
    };
    g.clearRect(0, 0, cols, linhas);
    if (entrando) this.gabinete.classList.add('hidden');
    // cobre com blocos coloridos, escurece e revela
    await fase(entrando ? 420 : 320, (i) => casa(i, cores[i % cores.length]));
    casas.sort(() => Math.random() - 0.5);
    await fase(260, (i) => casa(i, '#050b14'));
    this.gabinete.classList.toggle('hidden', !entrando);
    el.classList.toggle('some', !entrando);
    casas.sort(() => Math.random() - 0.5);
    await fase(entrando ? 420 : 320, (i) => casa(i, null));
  }

  // ---------------------------------------------------------------- o laço do jogo

  private laco = (t: number) => {
    if (!this.aberto || this.saindo) return;
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
    return { segura: this.segura, apertou: this.apertou, dedo: this.dedo, tocou: this.tocou };
  }

  private passo() {
    this.quadro++;
    const e = this.entrada();
    const a = e.apertou.has('a') || e.tocou;
    switch (this.estado) {
      case 'menu': {
        if (e.apertou.has('cima') || e.apertou.has('baixo')) {
          this.sel = (this.sel + (e.apertou.has('cima') ? JOGOS.length - 1 : 1)) % JOGOS.length;
          sfx.chip(660, 660, 0.04);
        }
        // o dedo: toca no jogo para escolher, toca de novo para começar
        if (e.tocou && e.dedo) {
          const i = Math.floor((e.dedo.y - 62) / 22);
          if (i >= 0 && i < JOGOS.length && i !== this.sel) {
            this.sel = i;
            sfx.chip(660, 660, 0.04);
            break;
          }
        }
        if (a) this.comecar();
        break;
      }
      case 'jogo':
        this.jogo!.passo(e);
        if (this.jogo!.fim) {
          this.estado = 'fim';
          this.espera = 50;
          const j = JOGOS[this.sel];
          if (j.recorde && this.jogo!.pontos > (this.melhor?.pontos ?? 0)) this.melhor = { jogo: j.nome, pontos: this.jogo!.pontos };
          // o PULA-PULA já tem o som da queda
          if (j.id !== 'pula') sfx.arpejo([659, 523, 392, 262], 0.12);
        }
        break;
      case 'fim':
        if (this.espera > 0) this.espera--;
        else if (a) {
          if (this.entraNoRecorde()) {
            this.estado = 'nome';
            this.letra = 0;
            sfx.arpejo([523, 659, 784, 1046, 784, 1046], 0.08);
          } else this.estado = 'menu';
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
    this.apertou.clear();
    this.tocou = false;
  }

  private comecar() {
    this.jogo = JOGOS[this.sel].novo();
    this.estado = 'jogo';
    this.quadro = 0;
    sfx.arpejo([523, 784, 1046], 0.07);
  }

  private voltarAoMenu() {
    if (this.estado === 'menu') return;
    this.jogo = null;
    this.estado = 'menu';
    sfx.chip(440, 220, 0.1);
  }

  private lista(): Recorde[] {
    return this.recordes[JOGOS[this.sel].id] ?? [];
  }

  private entraNoRecorde() {
    const j = JOGOS[this.sel];
    const p = this.jogo?.pontos ?? 0;
    const l = this.lista();
    return j.recorde && p > 0 && (l.length < MAX_RECORDES || p > l[l.length - 1].p);
  }

  private gravar() {
    const p = this.jogo?.pontos ?? 0;
    const l = [...this.lista(), { n: this.iniciais, p }].sort((x, y) => y.p - x.p).slice(0, MAX_RECORDES);
    this.destaque = l.findIndex((r) => r.n === this.iniciais && r.p === p);
    this.recordes = { ...lerRecordes(), [JOGOS[this.sel].id]: l };
    gravarRecordes(this.recordes);
    this.estado = 'tabela';
    this.espera = 40;
  }

  // ---------------------------------------------------------------- desenhar

  private desenhar() {
    const g = this.g;
    const q = this.quadro;
    const pisca = (q >> 4) % 2 === 0;
    if (this.estado === 'jogo' || this.estado === 'fim') {
      this.jogo!.desenhar(g, q);
      // o jeito de jogar com o dedo, no começo
      if (this.estado === 'jogo' && q < 150 && pisca) {
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(0, H - 22, W, 11);
        texto(g, JOGOS[this.sel].toque, W / 2, H - 19, COR.amarelo, 1, 'meio');
      }
      if (this.estado === 'fim') this.caixaFim(g, pisca);
      return;
    }
    g.fillStyle = COR.preto;
    g.fillRect(0, 0, W, H);
    if (this.estado === 'menu') return this.menu(g, pisca);
    if (this.estado === 'nome') return this.nome(g, pisca);
    this.tabela(g, pisca);
  }

  /** As listras do Atari embaixo do título. */
  private listras(g: CanvasRenderingContext2D, y: number) {
    [COR.vermelho, COR.laranja, COR.ouro, COR.amarelo].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(14, y + i * 3, W - 28, 2);
    });
  }

  private menu(g: CanvasRenderingContext2D, pisca: boolean) {
    texto(g, 'FLIPERAMA', W / 2, 8, COR.ouro, 2, 'meio');
    texto(g, 'SUVACO SECO', W / 2, 22, COR.cinza, 1, 'meio');
    this.listras(g, 32);
    JOGOS.forEach((j, i) => {
      const y = 62 + i * 22;
      const on = i === this.sel;
      if (on) {
        g.fillStyle = COR.escuro;
        g.fillRect(10, y - 4, W - 20, 18);
        if (pisca) texto(g, '>', 16, y, COR.amarelo, 2);
      }
      texto(g, j.nome, W / 2, y, on ? COR.branco : COR.cinza, 2, 'meio');
    });
    const j = JOGOS[this.sel];
    texto(g, j.dica, W / 2, 132, COR.verde, 1, 'meio');
    if (j.recorde) {
      const l = this.lista();
      if (!l.length) texto(g, 'SEM RECORDE AINDA', W / 2, 146, COR.medio, 1, 'meio');
      l.slice(0, 3).forEach((r, i) => texto(g, `${i + 1} ${r.n} ${String(r.p).padStart(5, ' ')}`, W / 2, 146 + i * 8, i === 0 ? COR.amarelo : COR.claro, 1, 'meio'));
    } else texto(g, 'CONTRA A MAQUINA', W / 2, 146, COR.medio, 1, 'meio');
    if (pisca) texto(g, 'APERTE A', W / 2, 178, COR.branco, 1, 'meio');
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
