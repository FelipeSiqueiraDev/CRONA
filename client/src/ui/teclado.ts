import type { FloorItem } from '@crona/shared';
import type { App } from './app';
import { h } from './dom';
import { existeArte } from './icons';
import { reduced, shake } from './motion';
import { sfx } from './sfx';

/**
 * O teclado de senha de um mobi com fechadura (a geladeira amarela do bar), grande no meio
 * do tabuleiro, como num jogo: o tabuleiro fica desfocado atrás, o visor mostra os números,
 * as teclas fazem bipe e a resposta acende a luzinha verde ou a vermelha. Só o mestre abre
 * (os jogadores dizem a senha, ele digita). Teclado do computador também vale: números,
 * Backspace apaga, Enter confirma, Esc cancela.
 *
 * A arte (pasta /arte/interface/teclado-geladeira/) entra sozinha quando chegar: a chapa
 * amarela, as teclas em branco (o jogo escreve os números), as teclas de cancelar e de
 * confirmar e as duas luzes. Sem ela, o desenho é por CSS. A senha não aparece em lugar
 * nenhum: quem não sabe, não entra.
 */
const PASTA = '/arte/interface/teclado-geladeira/';
const ARTE = {
  painel: 'painel.png',
  tecla: 'tecla.png',
  teclaAp: 'tecla-apertada.png',
  cancelar: 'tecla-cancelar.png',
  cancelarAp: 'tecla-cancelar-apertada.png',
  confirmar: 'tecla-confirmar.png',
  confirmarAp: 'tecla-confirmar-apertada.png',
  ledVerde: 'led-verde.png',
  ledVermelho: 'led-vermelho.png',
} as const;

type Estado = 'digitando' | 'certa' | 'errada';

export class TecladoSenha {
  readonly el: HTMLElement;
  private painel: HTMLElement;
  private casas: HTMLElement;
  private aviso: HTMLElement;
  private ledVerde: HTMLElement;
  private ledVermelho: HTMLElement;
  private teclas = new Map<string, HTMLButtonElement>();
  private item: FloorItem | null = null;
  private digitado = '';
  private tamanho = 4;
  private estado: Estado = 'digitando';
  private enviando = false;
  private timer = 0;

  constructor(private app: App) {
    this.casas = h('div', { class: 'tsg-casas', 'aria-live': 'polite', 'aria-label': 'Senha digitada' });
    this.aviso = h('div', { class: 'tsg-aviso' });
    this.ledVermelho = h('span', { class: 'tsg-led vermelho', 'aria-hidden': 'true' });
    this.ledVerde = h('span', { class: 'tsg-led verde', 'aria-hidden': 'true' });
    const tecla = (rotulo: string, valor: string, cls = '', titulo = rotulo) => {
      const b = h('button', { class: `tsg-tecla${cls}`, type: 'button', title: titulo, 'aria-label': titulo, onclick: () => this.apertar(valor) }, h('span', null, rotulo));
      this.teclas.set(valor, b);
      return b;
    };
    const grade = h(
      'div',
      { class: 'tsg-grade' },
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => tecla(d, d)),
      tecla('C', 'limpar', ' fn', 'Limpar'),
      tecla('0', '0'),
      tecla('←', 'apagar', ' fn', 'Apagar'),
    );
    const largas = h('div', { class: 'tsg-largas' }, tecla('CANCELAR', 'cancelar', ' larga cancelar'), tecla('CONFIRMAR', 'confirmar', ' larga confirmar'));
    const parafusos = ['a', 'b', 'c', 'd'].map((p) => h('i', { class: `tsg-parafuso ${p}`, 'aria-hidden': 'true' }));
    this.painel = h(
      'div',
      { class: 'tsg-painel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Senha da passagem' },
      ...parafusos,
      h('div', { class: 'tsg-luzes' }, this.ledVermelho, this.ledVerde),
      h('div', { class: 'tsg-visor' }, this.casas, this.aviso),
      grade,
      largas,
    );
    this.el = h('div', { class: 'tsg hidden', onclick: (e: MouseEvent) => e.target === this.el && this.fechar() }, this.painel);
    document.addEventListener('keydown', (e) => this.tecladoDoPc(e));
    void this.carregarArte();
  }

  get aberto() {
    return !!this.item;
  }

  /** Abre o teclado para este mobi (com a fechadura ainda trancada). */
  abrir(it: FloorItem) {
    if (!it.lock || it.lock.open) return;
    const novo = this.item?.id !== it.id;
    this.item = it;
    this.tamanho = Math.max(1, Math.min(8, it.lock.code?.length || 4));
    if (novo) this.digitado = '';
    this.estado = 'digitando';
    this.enviando = false;
    this.mostrar();
    if (!this.el.classList.contains('hidden')) return;
    this.el.classList.remove('hidden');
    sfx.paper();
    if (reduced()) return;
    this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    this.painel.animate(
      [
        { transform: 'translateY(3rem) scale(0.9)', opacity: 0 },
        { transform: 'translateY(-0.4rem) scale(1.01)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }

  fechar() {
    if (!this.item) return;
    this.item = null;
    clearTimeout(this.timer);
    if (reduced()) return this.el.classList.add('hidden');
    const a = this.painel.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'translateY(2rem) scale(0.94)', opacity: 0 }], { duration: 180, easing: 'ease-in' });
    this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in' });
    a.onfinish = () => !this.item && this.el.classList.add('hidden');
  }

  /** A resposta do servidor. true se era deste teclado (aberto). */
  resultado(m: { id: number; ok: boolean; reason?: string }): boolean {
    if (!this.item || this.item.id !== m.id) return false;
    this.enviando = false;
    clearTimeout(this.timer);
    if (m.ok) {
      this.estado = 'certa';
      sfx.granted();
      this.mostrar();
      this.timer = window.setTimeout(() => this.fechar(), 1300);
    } else {
      this.estado = 'errada';
      sfx.denied();
      this.mostrar(m.reason);
      shake(this.painel, 0.7);
      this.timer = window.setTimeout(() => {
        this.digitado = '';
        this.estado = 'digitando';
        this.mostrar();
      }, 1100);
    }
    return true;
  }

  private apertar(valor: string) {
    if (!this.item || this.estado === 'certa') return;
    this.acender(valor);
    if (valor === 'cancelar') return (sfx.click(), this.fechar());
    if (this.enviando) return;
    if (this.estado === 'errada') {
      clearTimeout(this.timer);
      this.digitado = '';
      this.estado = 'digitando';
    }
    if (valor === 'limpar') {
      this.digitado = '';
      sfx.click();
    } else if (valor === 'apagar') {
      this.digitado = this.digitado.slice(0, -1);
      sfx.click();
    } else if (valor === 'confirmar') {
      return this.enviar();
    } else {
      if (this.digitado.length >= this.tamanho) return;
      this.digitado += valor;
      sfx.beep(Number(valor));
      // casas cheias: espera o CONFIRMAR (ou o Enter); a passagem não abre sozinha (o Felipe, 14/10)
    }
    this.mostrar();
  }

  private enviar() {
    if (!this.item || !this.digitado || this.enviando) return;
    this.enviando = true;
    this.mostrar();
    this.app.net.send({ t: 'unlock', id: this.item.id, code: this.digitado });
  }

  /** A tecla afunda um instante (no clique e no teclado do computador). */
  private acender(valor: string) {
    const b = this.teclas.get(valor);
    if (!b) return;
    b.classList.add('apertada');
    window.setTimeout(() => b.classList.remove('apertada'), 130);
  }

  private tecladoDoPc(e: KeyboardEvent) {
    if (!this.item || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    let valor = '';
    if (/^[0-9]$/.test(k)) valor = k;
    else if (k === 'Backspace') valor = 'apagar';
    else if (k === 'Delete') valor = 'limpar';
    else if (k === 'Enter') valor = 'confirmar';
    else if (k === 'Escape') valor = 'cancelar';
    if (!valor) return;
    e.preventDefault();
    e.stopPropagation();
    this.apertar(valor);
  }

  private mostrar(motivo?: string) {
    const v = this.digitado;
    this.casas.replaceChildren(...Array.from({ length: this.tamanho }, (_, i) => h('span', { class: `tsg-casa${v[i] ? ' cheia' : ''}` }, v[i] ?? '')));
    const texto = this.estado === 'certa' ? 'ACESSO LIBERADO' : this.estado === 'errada' ? (motivo ? 'NÃO ABRE' : 'SENHA ERRADA') : this.enviando ? 'CONFERINDO…' : 'DIGITE A SENHA';
    this.aviso.textContent = texto;
    this.el.dataset.estado = this.estado;
    this.ledVerde.classList.toggle('aceso', this.estado === 'certa');
    this.ledVermelho.classList.toggle('aceso', this.estado !== 'certa');
    this.ledVermelho.classList.toggle('pisca', this.estado === 'errada');
  }

  /** A arte que já chegou entra no lugar do desenho por CSS (cada peça por si). */
  private async carregarArte() {
    const s = this.el.style;
    const usar = async (nome: string, varCss: string, classe: string) => {
      if (!(await existeArte(PASTA + nome))) return false;
      s.setProperty(varCss, `url("${PASTA}${nome}")`);
      this.el.classList.add(classe);
      return true;
    };
    await usar(ARTE.painel, '--tsg-painel', 'arte-painel');
    if (await usar(ARTE.tecla, '--tsg-tecla', 'arte-tecla')) await usar(ARTE.teclaAp, '--tsg-tecla-ap', 'arte-tecla-ap');
    if (await usar(ARTE.cancelar, '--tsg-cancelar', 'arte-cancelar')) await usar(ARTE.cancelarAp, '--tsg-cancelar-ap', 'arte-cancelar-ap');
    if (await usar(ARTE.confirmar, '--tsg-confirmar', 'arte-confirmar')) await usar(ARTE.confirmarAp, '--tsg-confirmar-ap', 'arte-confirmar-ap');
    await usar(ARTE.ledVerde, '--tsg-led-verde', 'arte-led-verde');
    await usar(ARTE.ledVermelho, '--tsg-led-vermelho', 'arte-led-vermelho');
  }
}
