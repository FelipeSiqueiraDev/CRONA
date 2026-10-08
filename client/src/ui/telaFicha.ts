/**
 * Tela do jogador (link ?ficha=CHAVE que o mestre manda, ou a conta dele): abre no modo jogo
 * (TelaJogador: Agente, Mochila, Poderes, Rituais, Docs, Notas), pensado para o celular; a ficha
 * inteira fica na engrenagem. NEX e pontos de prestígio ficam com o mestre.
 */
import type { FichaSalva } from '@crona/shared';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { FichaCelular } from './fichaCelular';
import { Fliperama } from './fliperama';
import { TelaJogador } from './jogador';
import { sfx } from './sfx';

const CHAVE = 'crona.fichaKey';

/** Chave do link da ficha (?ficha=...), guardada para abrir de novo sem o link. */
export function lerChaveFicha(): string | null {
  const q = new URLSearchParams(location.search);
  const daUrl = q.get('ficha');
  try {
    if (daUrl) localStorage.setItem(CHAVE, daUrl);
    return daUrl || (q.has('ficha') ? localStorage.getItem(CHAVE) : null);
  } catch {
    return daUrl;
  }
}

/** Guarda a chave da ficha que a conta do jogador trouxe (abre com ?ficha, sem o link). */
export function guardarChaveFicha(chave: string) {
  try {
    localStorage.setItem(CHAVE, chave);
  } catch {
    /* sem armazenamento */
  }
}

export function esquecerChaveFicha() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento */
  }
}

export class TelaFicha {
  readonly el: HTMLElement;
  /** o modo jogo (abre nele); a ficha fica na engrenagem */
  readonly jogo: TelaJogador;
  readonly ficha: FichaCelular;
  private aviso: HTMLElement;
  /** o fliperama do bar (o mestre manda o agente jogar) */
  private flip: Fliperama | null = null;

  constructor(
    private app: App,
    sair: () => void,
  ) {
    this.jogo = new TelaJogador(app, { fichaCompleta: () => this.verFicha(true), menu: () => this.menu(), sair });
    this.ficha = new FichaCelular(app, () => this.verFicha(false), (uid) => this.jogo.abrirItem(uid));
    this.aviso = h('div', { class: 'tf-aviso hidden' });
    this.el = h('div', { class: 'tela-ficha hidden' }, this.jogo.el, this.ficha.el, this.aviso);
  }

  /** A ficha chegou (só a dele) e a equipe, para entregar itens. */
  setFichas(fichas: FichaSalva[], _nova?: number, equipe?: { id: number; nome: string }[]) {
    this.jogo.setFicha(fichas[0] ?? null);
    this.ficha.setFicha(fichas[0] ?? null);
    if (equipe) this.jogo.setEquipe(equipe);
  }

  private verFicha(sim: boolean) {
    sfx.paper();
    this.ficha.el.classList.toggle('hidden', !sim);
    this.jogo.el.classList.toggle('hidden', sim);
  }

  /** O mestre mandou jogar (ligado) ou chamou de volta. */
  fliperama(ligado: boolean, nome = '') {
    if (ligado) {
      this.flip ??= new Fliperama((recorde) => this.app.net.send({ t: 'fliperamaSair', ...(recorde ? { recorde } : {}) }));
      void this.flip.abrir(nome);
    } else void this.flip?.fechar(false, 'O mestre chamou de volta para a mesa.');
  }

  /** A engrenagem: a ficha e o som. */
  private menu() {
    const naFicha = !this.ficha.el.classList.contains('hidden');
    const j = janela('MENU', 'engrenagem', () => {}, 30);
    const som = botao(sfx.enabled ? 'Sons: ligados' : 'Sons: desligados', 'sol', '', () => {
      sfx.setEnabled(!sfx.enabled);
      som.querySelector('span')!.textContent = sfx.enabled ? 'Sons: ligados' : 'Sons: desligados';
    });
    j.el.classList.add('tela-toda');
    j.corpo.append(h('div', { class: 'tf-menu' }, botao(naFicha ? 'Voltar ao jogo' : 'Ver a ficha', naFicha ? 'esquerda' : 'ficha', 'forte', () => (j.fechar(), this.verFicha(!naFicha))), som));
  }

  show() {
    this.el.classList.remove('hidden');
    this.aviso.classList.add('hidden');
  }

  /** Link inválido ou conexão perdida. */
  erro(msg: string) {
    this.el.classList.remove('hidden');
    this.aviso.replaceChildren(h('p', null, msg));
    this.aviso.classList.remove('hidden');
  }
}
