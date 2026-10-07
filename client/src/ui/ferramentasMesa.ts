import { contarNevoa, NEVOA_RAIO_MAX, NEVOA_RAIO_PADRAO, type CorGiz, type FormaTraco } from '@crona/shared';
import type { FerramentaMesa } from '../room/RoomView';
import type { App } from './app';
import { h } from './dom';
import { arteOu, ic } from './icons';
import { abrirMapaImprovisado } from './mapaImprovisado';
import { sfx } from './sfx';

/**
 * As ferramentas do mestre para mostrar a cena na mesa (docs/FERRAMENTAS-DA-MESA.md), no canto de
 * cima do tabuleiro: Apontar (P), Desenhar (D) e Névoa (N). A ligada mostra as opções dela do lado.
 */
type Tipo = FerramentaMesa['tipo'];

/** A névoa revelada aos poucos aparece na barra? (docs/FERRAMENTAS-DA-MESA.md) */
export const NEVOA_NA_TELA = false;

const FORMAS: { id: FormaTraco; nome: string; icone: string }[] = [
  { id: 'livre', nome: 'À mão livre', icone: 'rabisco' },
  { id: 'seta', nome: 'Seta', icone: 'seta' },
  { id: 'circulo', nome: 'Círculo', icone: 'circulo' },
];
const CORES: { id: CorGiz; nome: string }[] = [
  { id: 'giz', nome: 'Giz branco' },
  { id: 'sangue', nome: 'Vermelho' },
  { id: 'ouro', nome: 'Dourado' },
];
/** o tamanho do pincel da névoa: o raio, em casas */
const PINCEIS = [
  { raio: 0, nome: 'Uma casa' },
  { raio: 1, nome: 'Pequeno' },
  { raio: 3, nome: 'Grande' },
];

export class FerramentasMesa {
  readonly el: HTMLElement;
  private app: App;
  private botoes = new Map<Tipo, HTMLButtonElement>();
  private opcoes: HTMLElement;
  private forma: FormaTraco = 'seta';
  private cor: CorGiz = 'giz';
  private pincelVista = true;
  private pincelRaio = 1;
  private sig = '';
  /** a ferramenta ligada mudou (a aba COMBATE marca os botões dela) */
  aoMudar: ((tipo: Tipo | null) => void) | null = null;
  /** o botão VIAGEM: a janela de partir (a Shell sabe quem são os agentes) */
  aoViagem: (() => void) | null = null;

  constructor(app: App) {
    this.app = app;
    // o ícone pintado (arte/icones/mesa-<nome>.png); sem ele, o de linha
    // a arte própria da ferramenta (mesa-<nome>.png, quando chegar) e, até lá, a pintada do kit que serve
    const RESERVA: Record<string, string> = { desenhar: 'botao-editar', apontar: 'tabuleiro-alcance', mapa: 'topo-mapa' };
    const pintado = (nome: string, icone: string) =>
      arteOu([`/arte/icones/mesa-${nome}.png`, ...(RESERVA[nome] ? [`/arte/icones/${RESERVA[nome]}.png`] : [])], ic(icone));
    const botao = (tipo: Tipo, icone: string, nome: string, tecla: string, dica: string) => {
      const b = h('button', { class: 'bv', type: 'button', title: `${dica} (${tecla})`, 'aria-label': nome, 'aria-pressed': 'false', onclick: () => this.alternar(tipo) }, pintado(nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), icone), h('span', null, nome.toUpperCase()));
      this.botoes.set(tipo, b);
      return b;
    };
    this.opcoes = h('div', { class: 'bm-opcoes hidden' });
    this.el = h(
      'div',
      { class: 'board-mesa', role: 'toolbar', 'aria-label': 'Ferramentas para mostrar na mesa' },
      h(
        'div',
        { class: 'bm-botoes' },
        botao('ponto', 'apontar', 'Apontar', 'P', 'Apontar: clique num lugar e a mesa pisca ali. Alt + clique aponta sem ligar'),
        botao('traco', 'giz', 'Desenhar', 'D', 'Desenhar: arraste no tabuleiro uma seta, um círculo ou um traço; some sozinho'),
        // a Névoa fica pronta no código, mas fora da tela (o Felipe, 06/10: com as salas pequenas, não faz sentido por enquanto)
        ...(NEVOA_NA_TELA ? [botao('nevoa', 'nevoa', 'Névoa', 'N', 'Névoa: esconda a sala da mesa e vá mostrando aos poucos')] : []),
        h(
          'button',
          { class: 'bv', type: 'button', title: 'Mapa improvisado: suba uma imagem e ela vira uma cena vista de cima', 'aria-label': 'Mapa improvisado', onclick: () => (sfx.click(), abrirMapaImprovisado(app)) },
          pintado('mapa', 'imagem'),
          h('span', null, 'MAPA'),
        ),
        h(
          'button',
          { class: 'bv', type: 'button', title: 'Viagem: os agentes na van, a estrada passando; fica até você decidir chegar', 'aria-label': 'Viagem', onclick: () => (sfx.click(), this.aoViagem?.()) },
          arteOu(['/arte/icones/mesa-viagem.png'], ic('van')),
          h('span', null, 'VIAGEM'),
        ),
      ),
      this.opcoes,
    );
    const v = app.view;
    v.aoMarcar = (marca) => {
      sfx.tick();
      app.net.send({ t: 'marca', marca });
    };
    v.aoPintarNevoa = (casas, vista) => app.net.send({ t: 'nevoa', acao: 'pintar', casas: casas.map((c) => [c.x, c.y]), vista });
  }

  /** Liga a ferramenta (ou desliga, se já estava ligada). */
  alternar(tipo: Tipo, som = true) {
    if (!this.app.state.room?.isOwner) return;
    if (som) sfx.click();
    const atual = this.app.view.ferramenta?.tipo;
    this.app.view.ferramenta = atual === tipo ? null : this.montar(tipo);
    this.atualizar(true);
  }

  /** Desliga a ferramenta (Esc). Devolve se tinha uma ligada. */
  desligar(): boolean {
    if (!this.app.view.ferramenta) return false;
    this.app.view.ferramenta = null;
    this.atualizar(true);
    return true;
  }

  private montar(tipo: Tipo): FerramentaMesa {
    if (tipo === 'traco') return { tipo, forma: this.forma, cor: this.cor };
    if (tipo === 'nevoa') return { tipo, vista: this.pincelVista, raio: this.pincelRaio };
    return { tipo };
  }

  /** Os botões e as opções mostram o que está ligado e a névoa da cena. */
  atualizar(forcar = false) {
    const room = this.app.state.room;
    const f = this.app.view.ferramenta;
    const n = room?.nevoa;
    const sig = JSON.stringify([room?.id, room?.isOwner, f, n ? [n.auto, n.raio, n.vista.length, this.contagem()] : null]);
    if (!forcar && sig === this.sig) return;
    this.sig = sig;
    this.aoMudar?.(f?.tipo ?? null);
    this.el.classList.toggle('hidden', !room?.isOwner);
    for (const [tipo, b] of this.botoes) {
      b.classList.toggle('on', f?.tipo === tipo);
      b.setAttribute('aria-pressed', String(f?.tipo === tipo));
    }
    // a névoa ligada na cena: o botão fica marcado mesmo sem o pincel
    this.botoes.get('nevoa')?.classList.toggle('tem', !!n);
    this.opcoes.classList.toggle('hidden', !f || f.tipo === 'ponto');
    this.opcoes.replaceChildren(...(f?.tipo === 'traco' ? this.opcoesDesenho() : f?.tipo === 'nevoa' ? this.opcoesNevoa() : []));
  }

  private contagem() {
    const room = this.app.state.room;
    const map = this.app.view.map;
    if (!room?.nevoa || !map) return null;
    return contarNevoa(room.nevoa, (x, y) => map.floorHeight(x, y) !== null);
  }

  private chip(on: boolean, titulo: string, conteudo: (Node | string)[], acao: () => void, extra = '') {
    return h('button', { class: `bm-chip${on ? ' on' : ''}${extra}`, type: 'button', title: titulo, 'aria-label': titulo, 'aria-pressed': String(on), onclick: () => (sfx.click(), acao(), this.atualizar(true)) }, ...conteudo);
  }

  private opcoesDesenho(): Node[] {
    const v = this.app.view;
    const usar = () => (v.ferramenta = this.montar('traco'));
    return [
      h('div', { class: 'bm-grupo' }, ...FORMAS.map((x) => this.chip(this.forma === x.id, x.nome, [ic(x.icone)], () => ((this.forma = x.id), usar())))),
      h('div', { class: 'bm-grupo' }, ...CORES.map((x) => this.chip(this.cor === x.id, x.nome, [h('i', { class: `bm-cor ${x.id}` })], () => ((this.cor = x.id), usar())))),
      h('div', { class: 'bm-grupo' }, this.chip(false, 'Apagar os desenhos da tela', [ic('lixo'), h('span', null, 'Apagar')], () => this.app.net.send({ t: 'marca', marca: { tipo: 'apagar' } }))),
    ];
  }

  private opcoesNevoa(): Node[] {
    const room = this.app.state.room;
    const n = room?.nevoa;
    const v = this.app.view;
    const enviar = (m: Parameters<App['net']['send']>[0]) => this.app.net.send(m);
    if (!n)
      return [
        h('p', { class: 'bm-texto' }, 'A mesa vê a sala inteira.'),
        h('div', { class: 'bm-grupo' }, this.chip(false, 'Cobrir a sala: a mesa só vê em volta dos agentes', [ic('nevoa'), h('span', null, 'Cobrir a sala')], () => enviar({ t: 'nevoa', acao: 'ligar' }), ' forte')),
      ];
    const usar = () => (v.ferramenta = this.montar('nevoa'));
    const c = this.contagem();
    const pct = c && c.total ? Math.round((c.vistas / c.total) * 100) : 0;
    const raio = n.raio ?? NEVOA_RAIO_PADRAO;
    return [
      h('p', { class: 'bm-texto' }, `A mesa vê ${pct}% da sala.`),
      h(
        'div',
        { class: 'bm-grupo' },
        this.chip(this.pincelVista, 'Pincel que mostra', [ic('olho'), h('span', null, 'Mostrar')], () => ((this.pincelVista = true), usar())),
        this.chip(!this.pincelVista, 'Pincel que esconde', [ic('olhoFechado'), h('span', null, 'Esconder')], () => ((this.pincelVista = false), usar())),
      ),
      h('div', { class: 'bm-grupo' }, ...PINCEIS.map((p) => this.chip(this.pincelRaio === p.raio, `Pincel: ${p.nome.toLowerCase()}`, [h('i', { class: `bm-pincel r${p.raio}` })], () => ((this.pincelRaio = p.raio), usar())))),
      h(
        'div',
        { class: 'bm-grupo' },
        this.chip(false, 'Mostrar a sala inteira', [h('span', null, 'Mostrar tudo')], () => enviar({ t: 'nevoa', acao: 'tudo' })),
        this.chip(false, 'Esconder a sala inteira', [h('span', null, 'Esconder tudo')], () => enviar({ t: 'nevoa', acao: 'nada' })),
      ),
      h(
        'div',
        { class: 'bm-grupo' },
        this.chip(!!n.auto, `Abre sozinha em volta dos agentes, ${raio} casas (${(raio * 0.75).toLocaleString('pt-BR')} m)`, [ic('correr'), h('span', null, 'Abre sozinha')], () => enviar({ t: 'nevoa', acao: 'auto', auto: !n.auto })),
        n.auto ? this.chip(false, 'Raio menor', [ic('menos')], () => enviar({ t: 'nevoa', acao: 'auto', auto: true, raio: Math.max(1, raio - 1) }), ' quadrado') : null,
        n.auto ? h('span', { class: 'bm-raio', title: 'Raio, em casas' }, String(raio)) : null,
        n.auto ? this.chip(false, 'Raio maior', [ic('mais')], () => enviar({ t: 'nevoa', acao: 'auto', auto: true, raio: Math.min(NEVOA_RAIO_MAX, raio + 1) }), ' quadrado') : null,
      ),
      h('div', { class: 'bm-grupo' }, this.chip(false, 'Tirar a névoa: a mesa volta a ver a sala inteira', [ic('fechar'), h('span', null, 'Tirar a névoa')], () => enviar({ t: 'nevoa', acao: 'desligar' }))),
    ];
  }
}
