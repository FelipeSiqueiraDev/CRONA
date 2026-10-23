/**
 * Os jogos do bar na tela de quem joga (08/10): o fliperama, os dardos e a sinuca. O servidor diz de
 * que mesa a pessoa faz parte (`bar`), passa as jogadas dos outros (`barJogo`) e fecha (`barFechar`).
 *
 * - No CELULAR do jogador, o jogo toma a tela inteira: a ficha se desfaz em pixels e o jogo aparece.
 * - Na tela do MESTRE (quando um NPC joga), o jogo abre numa janelinha do tamanho de um celular, no
 *   canto, para ele jogar pelo NPC sem perder o tabuleiro. Dois NPCs na mesma mesa: a mesma janela
 *   joga pelos dois (na vez de cada um).
 *
 * Cada jogo é uma `TelaDoBar` (fliperama.ts, dardos.ts, sinuca.ts, vinteum.ts).
 */
import { bar, type ServerMsg } from '@crona/shared';
import type { App } from './app';
import { h, toast } from './dom';
import { COR } from './fliperamaJogos';
import { Fliperama } from './fliperama';
import { Dardos } from './dardos';
import { Sinuca } from './sinuca';
import { Vinteum } from './vinteum';
import { Luta } from './luta';
import { sfx } from './sfx';

export type Dados = Record<string, unknown>;
export type Recorde = { jogo: string; pontos: number };

/** A mesa, para a tela do jogo: quem joga, quais lugares são deste aparelho e como falar com os outros. */
export interface Mesa {
  id: number;
  tipo: bar.TipoJogoBar;
  jogadores: string[];
  npc: boolean[];
  /** os lugares que este aparelho joga (o jogador: o dele; o mestre: os dos NPCs) */
  eu: number[];
  mestre: boolean;
  /** firmeza da mão (de 0 a 1), da Agilidade da ficha: o dardo treme menos */
  firmeza: number;
  /** manda uma jogada aos outros; `de` = o lugar que joga (o mestre com vários NPCs); `registrar` = guardar para quem reconectar */
  enviar(dados: Dados, registrar?: boolean, de?: number): void;
  /** sai da mesa (o botão Sair) */
  sair(recorde?: Recorde | null): void;
}

export interface TelaDoBar {
  readonly el: HTMLElement;
  /** começa (o laço, o teclado); `teclas` = onde ouvir o teclado */
  ligar(teclas: EventTarget): void;
  desligar(): void;
  /** a animação de desligar, antes de a tela sumir (o fliperama apaga como TV velha) */
  apagar?(): Promise<void>;
  /** quem está na mesa (de novo, quando muda) e as jogadas guardadas desde o começo da partida */
  mesa(m: Mesa, log: { de: number; dados: Dados }[]): void;
  /** a jogada de outro lugar */
  jogada(de: number, dados: Dados): void;
}

const reduzido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const NOME: Record<bar.TipoJogoBar, string> = { fliperama: 'Feliperama', dardos: 'Dardos', sinuca: 'Sinuca', vinteum: '21', luta: "Felipe's Fight" };

interface Aberta {
  tipo: bar.TipoJogoBar;
  tela: TelaDoBar;
  caixa: HTMLElement;
  titulo: HTMLElement | null;
  mesa: Mesa | null;
  saindo: boolean;
  /** enquanto fecha: termina quando a tela some (quem abrir a mesma mesa de novo espera) */
  fechou?: Promise<void>;
}

export class BarJogos {
  private abertas = new Map<number, Aberta>();

  /** `modo`: 'celular' (tela cheia) ou 'mestre' (janelinha); `firmeza`: a da ficha do jogador. */
  constructor(
    private app: App,
    private modo: 'celular' | 'mestre',
    private firmeza: () => number = () => 0.5,
  ) {
    this.travarZoom();
  }

  /**
   * Sem zoom com um joguinho aberto (15/10, o Felipe): a roda e o beliscar não aproximam o tabuleiro nem a página
   * (o zoom do mapa também fica travado em `zoomTravado`), e Ctrl + / - / 0 não mexem no zoom do navegador.
   */
  private travarZoom() {
    const jogando = () => this.abertas.size > 0;
    const nele = (e: Event) => e.target instanceof Element && !!e.target.closest('canvas, .bar-janela, .bar-tela');
    window.addEventListener(
      'wheel',
      (e) => {
        if (jogando() && (e.ctrlKey || nele(e))) e.preventDefault();
      },
      { passive: false, capture: true },
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (jogando() && (e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault();
      },
      { capture: true },
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        if (jogando() && e.touches.length > 1) e.preventDefault();
      },
      { passive: false, capture: true },
    );
    for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (e) => jogando() && e.preventDefault());
  }

  /** O tabuleiro só aceita zoom quando não há joguinho aberto. */
  private atualizarTrava() {
    this.app.view.zoomTravado = this.abertas.size > 0;
  }

  receber(m: ServerMsg) {
    if (m.t === 'bar') void this.abrir(m);
    else if (m.t === 'barFechar') void this.fechar(m.mesa, m.aviso);
    else if (m.t === 'barJogo') this.abertas.get(m.mesa)?.tela.jogada(m.de, m.dados);
  }

  private async abrir(m: Extract<ServerMsg, { t: 'bar' }>) {
    let a = this.abertas.get(m.mesa);
    // a mesma mesa fechando (o servidor tirou e pôs de novo, ex.: a peça já estava sentada nela): espera a tela
    // velha sumir e abre outra; sem isso, o fechamento levava a tela nova junto e só o F5 trazia o jogo
    while (a?.saindo) {
      await a.fechou;
      a = this.abertas.get(m.mesa);
    }
    if (a && a.tipo !== m.tipo) {
      await this.fechar(m.mesa);
      a = undefined;
    }
    const nova = !a;
    if (!a) {
      const tela: TelaDoBar = m.tipo === 'fliperama' ? new Fliperama() : m.tipo === 'dardos' ? new Dardos() : m.tipo === 'vinteum' ? new Vinteum() : m.tipo === 'luta' ? new Luta() : new Sinuca();
      const titulo = this.modo === 'mestre' ? h('b', null, '') : null;
      const caixa =
        this.modo === 'mestre'
          ? h(
              'section',
              { class: 'bar-janela', tabindex: '-1', role: 'dialog' },
              h('header', { class: 'bar-janela-topo' }, titulo, h('button', { class: 'bar-janela-x', type: 'button', title: 'Os NPCs saem do jogo', onclick: () => this.abertas.get(m.mesa)?.mesa?.sair() }, '×')),
              h('div', { class: 'bar-conteudo' }, tela.el),
            )
          : h('div', { class: 'bar-tela some', role: 'dialog' }, h('div', { class: 'bar-conteudo' }, tela.el), h('canvas', { class: 'bar-pixels', 'aria-hidden': 'true' }));
      a = { tipo: m.tipo, tela, caixa, titulo, mesa: null, saindo: false };
      this.abertas.set(m.mesa, a);
      this.atualizarTrava();
      if (this.modo === 'mestre') {
        // as janelas abertas ficam uma do lado da outra
        caixa.style.setProperty('--n', String(this.abertas.size - 1));
        caixa.addEventListener('pointerdown', () => caixa.focus({ preventScroll: true }));
      }
    }
    const aberta = a;
    const mesa: Mesa = {
      id: m.mesa,
      tipo: m.tipo,
      jogadores: m.jogadores,
      npc: m.npc,
      eu: m.eu,
      mestre: this.modo === 'mestre',
      firmeza: this.modo === 'mestre' ? 0.6 : this.firmeza(),
      enviar: (dados, registrar, de) => this.app.net.send({ t: 'barJogo', mesa: m.mesa, dados, ...(registrar ? { registrar: true } : {}), ...(this.modo === 'mestre' ? { de: de ?? mesa.eu[0] } : {}) }),
      sair: (recorde) => void this.sair(m.mesa, recorde ?? undefined),
    };
    aberta.mesa = mesa;
    if (aberta.titulo) aberta.titulo.textContent = `${m.eu.map((i) => m.jogadores[i]).join(' e ')} · ${NOME[m.tipo]}`;
    aberta.tela.mesa(
      mesa,
      m.log.map((x) => x as { de: number; dados: Dados }),
    );
    if (!nova) return;
    document.body.append(aberta.caixa);
    sfx.arpejo([392, 523, 659, 784, 1046], 0.06);
    if (this.modo === 'celular') await this.pixels(aberta, true);
    aberta.tela.ligar(this.modo === 'mestre' ? aberta.caixa : window);
    if (this.modo === 'mestre') aberta.caixa.focus({ preventScroll: true });
  }

  /** O botão Sair: avisa o servidor e fecha na hora (o mestre do NPC tira todos os lugares dele, do último para o primeiro). */
  private async sair(id: number, recorde?: Recorde) {
    const a = this.abertas.get(id);
    if (!a?.mesa) return;
    if (this.modo === 'mestre') for (const lugar of [...a.mesa.eu].sort((x, y) => y - x)) this.app.net.send({ t: 'barSair', mesa: id, lugar });
    else this.app.net.send({ t: 'barSair', mesa: id, ...(recorde ? { recorde } : {}) });
    await this.fechar(id);
  }

  private async fechar(id: number, aviso?: string) {
    const a = this.abertas.get(id);
    if (!a || a.saindo) return a?.fechou;
    a.saindo = true;
    a.fechou = (async () => {
      sfx.arpejo([784, 659, 523, 392], 0.06);
      await a.tela.apagar?.();
      a.tela.desligar();
      if (this.modo === 'celular') await this.pixels(a, false);
      a.caixa.remove();
      if (this.abertas.get(id) === a) (this.abertas.delete(id), this.atualizarTrava());
      if (aviso) toast(aviso);
    })();
    return a.fechou;
  }

  /**
   * A transição de pixels do celular: a tela vira blocos coloridos do Atari, que escurecem e somem
   * revelando o jogo (entrando) ou a ficha (saindo).
   */
  private async pixels(a: Aberta, entrando: boolean) {
    const el = a.caixa;
    const conteudo = el.querySelector('.bar-conteudo') as HTMLElement;
    // sem animação com a tela escondida (o celular apagado): o requestAnimationFrame para e a troca ficaria presa
    if (reduzido() || document.hidden) {
      conteudo.classList.toggle('hidden', !entrando);
      el.classList.toggle('some', !entrando);
      return;
    }
    const cv = el.querySelector('.bar-pixels') as HTMLCanvasElement;
    // blocos quadrados: 14 na largura da coluna do celular
    const bloco = Math.min(innerWidth, 480) / 14;
    const cols = Math.ceil(innerWidth / bloco);
    const linhas = Math.ceil(innerHeight / bloco);
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
    if (entrando) conteudo.classList.add('hidden');
    await fase(entrando ? 420 : 320, (i) => casa(i, cores[i % cores.length]));
    casas.sort(() => Math.random() - 0.5);
    await fase(260, (i) => casa(i, '#050b14'));
    conteudo.classList.toggle('hidden', !entrando);
    el.classList.toggle('some', !entrando);
    casas.sort(() => Math.random() - 0.5);
    await fase(entrando ? 420 : 320, (i) => casa(i, null));
  }
}
