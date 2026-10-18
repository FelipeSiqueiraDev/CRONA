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
import { BarJogos } from './barJogos';
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
  /** os jogos do bar (o mestre manda o agente jogar): o fliperama, os dardos, a sinuca */
  readonly bar: BarJogos;
  private fichaAtual: FichaSalva | null = null;

  constructor(app: App, sair: () => void) {
    this.jogo = new TelaJogador(app, { fichaCompleta: () => this.verFicha(true), menu: () => this.menu(), sair });
    this.ficha = new FichaCelular(app, () => this.verFicha(false), (uid) => this.jogo.abrirItem(uid));
    this.aviso = h('div', { class: 'tf-aviso hidden' });
    this.el = h('div', { class: 'tela-ficha hidden' }, this.jogo.el, this.ficha.el, this.aviso);
    // a mão firme nos dardos vem da Agilidade (0 treme muito; 5 quase nada)
    this.bar = new BarJogos(app, 'celular', () => Math.max(0, Math.min(1, 0.15 + 0.17 * (this.fichaAtual?.ficha.atributos.agi ?? 1))));
  }

  /** A ficha chegou (só a dele) e a equipe, para entregar itens. */
  setFichas(fichas: FichaSalva[], _nova?: number, equipe?: { id: number; nome: string }[]) {
    this.fichaAtual = fichas[0] ?? null;
    this.jogo.setFicha(fichas[0] ?? null);
    this.ficha.setFicha(fichas[0] ?? null);
    if (equipe) this.jogo.setEquipe(equipe);
    this.mostrarAvisos(fichas[0] ?? null);
  }

  /** Os avisos do mestre na ficha: uma janela na primeira vez que o jogador abre a ficha com eles (por aparelho). */
  private mostrarAvisos(fs: FichaSalva | null) {
    const avisos = fs?.ficha.avisos ?? [];
    if (!fs || !avisos.length) return;
    const chave = `crona.avisos.${fs.id}`;
    const marca = avisos.join('|');
    try {
      if (localStorage.getItem(chave) === marca) return;
    } catch {
      /* sem armazenamento: mostra de novo */
    }
    const j = janela('AVISOS DA SUA FICHA', 'alerta', () => {
      try {
        localStorage.setItem(chave, marca);
      } catch {
        /* sem armazenamento */
      }
    }, 46);
    j.el.classList.add('tf-avisos');
    j.corpo.append(
      h('p', { class: 'tf-avisos-intro' }, 'O mestre conferiu a sua ficha com a do C.R.I.S. O que estava diferente do livro:'),
      h('ul', { class: 'tf-avisos-lista' }, ...avisos.map((t) => h('li', null, t))),
    );
    j.rodape.append(botao('Entendi', 'ok', 'forte', () => j.fechar()));
  }

  private verFicha(sim: boolean) {
    sfx.paper();
    this.ficha.el.classList.toggle('hidden', !sim);
    this.jogo.el.classList.toggle('hidden', sim);
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
