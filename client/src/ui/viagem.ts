import { BANCOS_VAN, CENARIOS_VIAGEM, CLIMAS_VIAGEM, HORAS_VIAGEM, type LugarInfo, type PartyMember, type ViagemInfo } from '@crona/shared';
import { portraitCanvas } from '../render/portrait';
import { desenhoDaVan, meioDoBanco, VAN_H, VAN_W } from '../render/vanDeCima';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { ic } from './icons';
import { abrirMapaMundi } from './mapaMundi';
import { sfx } from './sfx';

/**
 * A Viagem (docs/VIAGEM.md): o mestre escolhe quem vai e em que banco senta, clica em Partir e escolhe o destino no
 * mapa-múndi (o lugar onde estão aparece marcado). A van fica parada na tela e o mundo passa; dentro da viagem um painel
 * mexe na velocidade, na hora, no clima e no cenário, e "Chegamos" leva todos à entrada do lugar escolhido.
 */

const rotulo = (b: (typeof BANCOS_VAN)[number]) => b.nome;

/** A janela de partir: quem vai e em que banco senta, na van vista de cima. Partir abre o mapa para escolher o destino. */
export function abrirViagem(app: App, party: PartyMember[], destinoInicial?: LugarInfo) {
  if (!app.state.room?.isOwner) return;
  const agentes = party.filter((p) => p.id);
  if (!agentes.length) return;
  // quem vai (todos, de começo); cada um senta num banco, na ordem
  const vai = new Set(agentes.slice(0, BANCOS_VAN.length).map((p) => p.id!));
  const j = janela('VIAGEM', 'correr', () => {}, 70);
  const quem = h('div', { class: 'vg-quem' });
  const desenho = desenhoDaVan();
  desenho.classList.add('vg-van-arte');
  const bancos = h('div', { class: 'vg-van-bancos' });
  const van = h('div', { class: 'vg-van', role: 'img', 'aria-label': 'A van, com quem vai sentado' }, desenho, bancos);
  const noBanco = () => {
    const m = new Map<number, number>();
    agentes.filter((p) => vai.has(p.id!)).forEach((p, i) => m.set(BANCOS_VAN[i].id, p.id!));
    return m;
  };

  const desenhar = () => {
    const sentados = noBanco();
    quem.replaceChildren(
      h('p', { class: 'vg-dica' }, 'Toque para tirar ou pôr na van.'),
      ...agentes.map((p) => {
        const dentro = vai.has(p.id!);
        return h(
          'button',
          {
            class: `vg-ag${dentro ? ' on' : ' fora'}`,
            type: 'button',
            'aria-pressed': String(dentro),
            onclick: () => {
              sfx.click();
              if (dentro) vai.delete(p.id!);
              else if (vai.size < BANCOS_VAN.length) vai.add(p.id!);
              desenhar();
            },
          },
          h('span', { class: 'vg-foto' }, portraitCanvas(p.look, 56, { dir: 2 })),
          h('span', { class: 'vg-nome' }, h('b', null, p.name.split(' ')[0]), h('small', null, dentro ? 'vai' : 'fica')),
        );
      }),
    );
    bancos.replaceChildren(
      ...[...sentados].map(([bancoId, pecaId]) => {
        const banco = BANCOS_VAN.find((b) => b.id === bancoId)!;
        const [mx, my] = meioDoBanco(banco.x, banco.y);
        const p = agentes.find((x) => x.id === pecaId)!;
        return h('span', { class: 'vg-banco ocupado', style: `left:${(mx / VAN_W) * 100}%;top:${(my / VAN_H) * 100}%`, title: `${p.name} · ${banco.nome}` }, portraitCanvas(p.look, 48, { dir: 2 }));
      }),
    );
  };

  /** Parte para o lugar escolhido: o cenário sai do destino (a estrada de terra para o campo, a rodovia para a cidade). */
  const partirPara = (l: LugarInfo) => {
    const bancosEscolhidos = [...noBanco()].map(([banco, tokenId]) => ({ tokenId, banco }));
    if (!bancosEscolhidos.length) return;
    app.net.send({ t: 'viagem', acao: 'iniciar', bancos: bancosEscolhidos, destinoId: l.entrada });
    j.fechar();
  };
  const partir = botao('Partir', 'correr', 'forte', () => {
    if (!vai.size) return;
    if (destinoInicial) return partirPara(destinoInicial);
    abrirMapaMundi(app, { escolher: partirPara, titulo: 'PARA ONDE VAMOS?', rotulo: 'Partir para cá' });
  });
  const cancelar = botao('Cancelar', 'fechar', 'claro', () => j.fechar());

  j.corpo.append(h('div', { class: 'vg' }, quem, h('div', { class: 'vg-meio' }, h('h4', null, destinoInicial ? `Rumo a ${destinoInicial.nome}` : 'Quem vai na van'), van)));
  j.rodape.append(cancelar, partir);
  desenhar();
}

/** Chegamos: com destino escolhido, todos descem na entrada dele; sem, abre o mapa para escolher onde. */
export function abrirChegada(app: App) {
  const v = app.state.room?.viagem;
  if (!v) return;
  if (v.destinoId !== undefined && app.state.rooms.some((r) => r.id === v.destinoId)) {
    app.net.send({ t: 'viagem', acao: 'chegar', roomId: v.destinoId });
    return;
  }
  abrirMapaMundi(app, { escolher: (l) => app.net.send({ t: 'viagem', acao: 'chegar', roomId: l.entrada }), titulo: 'ONDE CHEGARAM?', rotulo: 'Chegamos aqui' });
}

/**
 * O painel de dentro da viagem (só o mestre): velocidade, hora, cenário, destino e o botão de chegar. Fica na coluna
 * da esquerda, no lugar da planta (que na viagem não serve), e não por cima do tabuleiro.
 */
export class ViagemPainel {
  readonly el = h('section', { class: 'vg-painel hidden' });
  private sig = '';

  constructor(private app: App) {}

  atualizar() {
    const r = this.app.state.room;
    const v = r?.viagem;
    const mostrar = !!v && !!r?.isOwner;
    this.el.classList.toggle('hidden', !mostrar);
    if (!mostrar || !v) {
      this.sig = '';
      return;
    }
    const sig = JSON.stringify(v);
    if (sig === this.sig) return;
    this.sig = sig;
    const ajustar = (patch: Partial<Pick<ViagemInfo, 'clima' | 'hora' | 'cenario'>>) => this.app.net.send({ t: 'viagem', acao: 'ajustar', ...patch });
    const secao = (nome: string, ...filhos: Node[]) => h('div', { class: 'vg-secao' }, h('small', null, nome), ...filhos);
    const grupo = <T extends { id: string; nome: string }>(nome: string, itens: readonly T[], atual: string, f: (id: T['id']) => void) =>
      secao(nome, h('div', { class: 'vg-grupo', role: 'group', 'aria-label': nome }, ...itens.map((x) => h('button', { class: `vg-bt${x.id === atual ? ' on' : ''}`, type: 'button', onclick: () => (sfx.click(), f(x.id)) }, x.nome))));
    this.el.replaceChildren(
      h('header', { class: 'vg-titulo' }, ic('correr'), h('b', null, 'VIAGEM'), v.destino ? h('small', null, `rumo a ${v.destino}`) : null),
      grupo('Hora do dia', HORAS_VIAGEM, v.hora, (hora) => ajustar({ hora })),
      grupo('Clima', CLIMAS_VIAGEM, v.clima ?? 'limpo', (clima) => ajustar({ clima })),
      grupo('Estrada', CENARIOS_VIAGEM, v.cenario, (cenario) => ajustar({ cenario })),
      botao(v.destino ? `Chegamos: ${v.destino}` : 'Chegamos…', 'bandeira', 'forte', () => abrirChegada(this.app)),
    );
  }
}
