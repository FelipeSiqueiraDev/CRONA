import { BANCOS_VAN, CENARIOS_VIAGEM, HORAS_VIAGEM, VELOCIDADES_VIAGEM, type PartyMember, type ViagemInfo } from '@crona/shared';
import { portraitCanvas } from '../render/portrait';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { ic } from './icons';
import { sfx } from './sfx';

/**
 * A Viagem (docs/VIAGEM.md): o mestre põe os agentes na van, escolhe o banco de cada um, o cenário, a hora
 * e a velocidade, e parte. A van fica parada na tela e o mundo passa; dentro da viagem um painel mexe no
 * cenário e na velocidade, e "Chegamos" leva todos a uma cena. Fica na viagem até o mestre decidir sair.
 */

const rotulo = (b: (typeof BANCOS_VAN)[number]) => b.nome;

/** A janela de partir: quem vai, em que banco, e o jeito da viagem. */
export function abrirViagem(app: App, party: PartyMember[]) {
  if (!app.state.room?.isOwner) return;
  const agentes = party.filter((p) => p.id);
  if (!agentes.length) return;
  // banco -> peça; começa com todos nos primeiros bancos, na ordem da lista
  const noBanco = new Map<number, number>();
  agentes.slice(0, BANCOS_VAN.length).forEach((p, i) => noBanco.set(BANCOS_VAN[i].id, p.id!));
  let escolhido: number | null = null;
  const j = janela('VIAGEM', 'correr', () => {}, 78);

  const bancoDe = (idPeca: number) => [...noBanco].find(([, v]) => v === idPeca)?.[0];
  const quem = h('div', { class: 'vg-quem' });
  const van = h('div', { class: 'vg-van', role: 'group', 'aria-label': 'Os bancos da van' });

  const desenhar = () => {
    quem.replaceChildren(
      h('p', { class: 'vg-dica' }, escolhido === null ? 'Toque num agente e depois no banco dele.' : 'Agora toque no banco.'),
      ...agentes.map((p) => {
        const b = bancoDe(p.id!);
        return h(
          'button',
          {
            class: `vg-ag${escolhido === p.id ? ' on' : ''}${b === undefined ? ' fora' : ''}`,
            type: 'button',
            'aria-pressed': String(escolhido === p.id),
            onclick: () => {
              sfx.click();
              escolhido = escolhido === p.id ? null : p.id!;
              desenhar();
            },
          },
          h('span', { class: 'vg-foto' }, portraitCanvas(p.look, 56, { dir: 2 })),
          h('span', { class: 'vg-nome' }, h('b', null, p.name.split(' ')[0]), h('small', null, b === undefined ? 'fica' : rotulo(BANCOS_VAN[b]))),
        );
      }),
    );
    // a van vista de cima: a frente à direita; três colunas de bancos (fila 3, fila 2, frente) em três linhas (janela, meio, porta)
    van.replaceChildren(
      h('span', { class: 'vg-frente' }, 'FRENTE ▸'),
      ...[0, 1, 2].flatMap((linha) =>
        [2, 4, 6].map((x) => {
          const banco = BANCOS_VAN.find((b) => b.x === x && b.y === linha);
          if (!banco) return h('span', { class: 'vg-vazio', style: `grid-column:${(x - 2) / 2 + 1};grid-row:${linha + 1}`, 'aria-hidden': 'true' }, 'console');
          const dono = noBanco.get(banco.id);
          const peca = agentes.find((p) => p.id === dono);
          return h(
            'button',
            {
              class: `vg-banco${peca ? ' ocupado' : ''}`,
              style: `grid-column:${(x - 2) / 2 + 1};grid-row:${linha + 1}`,
              type: 'button',
              title: banco.nome,
              onclick: () => {
                sfx.click();
                if (escolhido !== null) {
                  // quem estava neste banco volta para a fila; quem vai sai do banco antigo
                  const antigo = bancoDe(escolhido);
                  if (antigo !== undefined) noBanco.delete(antigo);
                  noBanco.set(banco.id, escolhido);
                  escolhido = null;
                } else if (dono !== undefined) {
                  // tocar num banco ocupado pega o agente para pôr em outro
                  noBanco.delete(banco.id);
                  escolhido = dono;
                }
                desenhar();
              },
            },
            peca ? portraitCanvas(peca.look, 48, { dir: 2 }) : h('span', { class: 'vg-mais' }, '+'),
            h('small', null, banco.nome.replace('Fila ', 'F')),
          );
        }),
      ),
    );
  };

  const cenario = h('select', { class: 'fx-inp', 'aria-label': 'Cenário' }, ...CENARIOS_VIAGEM.map((c) => h('option', { value: c.id }, c.nome))) as HTMLSelectElement;
  const hora = h('select', { class: 'fx-inp', 'aria-label': 'Hora do dia' }, ...HORAS_VIAGEM.map((x) => h('option', { value: x.id }, x.nome))) as HTMLSelectElement;
  const vel = h('select', { class: 'fx-inp', 'aria-label': 'Velocidade' }, ...VELOCIDADES_VIAGEM.map((x) => h('option', { value: String(x.v), selected: x.v === 0.7 }, x.nome))) as HTMLSelectElement;
  const destino = h('input', { class: 'fx-inp', maxlength: 60, placeholder: 'Ex.: Rumo a Santo Berço', 'aria-label': 'Destino' }) as HTMLInputElement;
  const campo = (nome: string, el: HTMLElement) => h('label', { class: 'vg-campo' }, h('span', null, nome), el);

  const partir = botao('Partir', 'correr', 'forte', () => {
    const bancos = [...noBanco].map(([banco, tokenId]) => ({ tokenId, banco }));
    if (!bancos.length) return;
    app.net.send({ t: 'viagem', acao: 'iniciar', bancos, cenario: cenario.value, hora: hora.value, velocidade: Number(vel.value), destino: destino.value.trim() });
    j.fechar();
  });
  const auto = botao('Preencher na ordem', 'pessoa', 'claro', () => {
    noBanco.clear();
    agentes.slice(0, BANCOS_VAN.length).forEach((p, i) => noBanco.set(BANCOS_VAN[i].id, p.id!));
    escolhido = null;
    desenhar();
  });
  const cancelar = botao('Cancelar', 'fechar', 'claro', () => j.fechar());

  j.corpo.append(h('div', { class: 'vg' }, quem, h('div', { class: 'vg-meio' }, h('h4', null, 'A van'), van), h('div', { class: 'vg-opcoes' }, h('h4', null, 'A viagem'), campo('Cenário', cenario), campo('Hora do dia', hora), campo('Velocidade', vel), campo('Destino (texto)', destino))));
  j.rodape.append(cancelar, auto, partir);
  desenhar();
}

/** Escolher onde chegam: a lista das cenas do jogo, com busca. */
export function abrirChegada(app: App) {
  if (!app.state.room?.viagem) return;
  const j = janela('CHEGAMOS', 'bandeira', () => {}, 52);
  const busca = h('input', { class: 'fx-inp', placeholder: 'Procurar a cena…', 'aria-label': 'Procurar a cena' }) as HTMLInputElement;
  const lista = h('div', { class: 'vg-cenas cb-rola' });
  // as cenas de viagem não são destino
  const cenas = app.state.rooms.filter((r) => r.id !== app.state.room?.id && !/(^|·\s*)Viagem$/.test(r.name));
  const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const desenhar = () => {
    const q = semAcento(busca.value.trim());
    lista.replaceChildren(
      ...cenas
        .filter((r) => !q || semAcento(r.name).includes(q))
        .map((r) =>
          h(
            'button',
            {
              class: 'vg-cena',
              type: 'button',
              onclick: () => {
                sfx.click();
                app.net.send({ t: 'viagem', acao: 'chegar', roomId: r.id });
                j.fechar();
              },
            },
            h('b', null, r.name.split('·').pop()?.trim() ?? r.name),
            h('small', null, r.name.includes('·') ? r.name.split('·')[0].trim() : ''),
          ),
        ),
    );
  };
  busca.addEventListener('input', desenhar);
  j.corpo.append(h('p', { class: 'vg-dica' }, 'Todos descem na cena que você escolher, na porta dela.'), busca, lista);
  j.rodape.append(botao('Continuar viajando', 'fechar', 'claro', () => j.fechar()));
  desenhar();
  setTimeout(() => busca.focus(), 50);
}

/** O painel de dentro da viagem (só o mestre): cenário, hora, velocidade, destino e o botão de chegar. */
export class ViagemPainel {
  readonly el = h('div', { class: 'vg-painel hidden' });
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
    const ajustar = (patch: Partial<Pick<ViagemInfo, 'cenario' | 'hora' | 'velocidade' | 'destino'>> & { destino?: string }) => this.app.net.send({ t: 'viagem', acao: 'ajustar', ...patch });
    const destino = h('input', { class: 'fx-inp vg-destino', value: v.destino ?? '', maxlength: 60, placeholder: 'Destino (texto)', 'aria-label': 'Destino' }) as HTMLInputElement;
    destino.addEventListener('change', () => ajustar({ destino: destino.value.trim() }));
    destino.addEventListener('keydown', (e) => e.key === 'Enter' && destino.blur());
    this.el.replaceChildren(
      h('span', { class: 'vg-titulo' }, ic('correr'), h('b', null, 'VIAGEM')),
      h('div', { class: 'vg-grupo', role: 'group', 'aria-label': 'Velocidade' }, ...VELOCIDADES_VIAGEM.map((x) => h('button', { class: `vg-bt${Math.abs(x.v - v.velocidade) < 0.01 ? ' on' : ''}`, type: 'button', onclick: () => (sfx.click(), ajustar({ velocidade: x.v })) }, x.nome))),
      h('div', { class: 'vg-grupo', role: 'group', 'aria-label': 'Hora do dia' }, ...HORAS_VIAGEM.map((x) => h('button', { class: `vg-bt${x.id === v.hora ? ' on' : ''}`, type: 'button', onclick: () => (sfx.click(), ajustar({ hora: x.id })) }, x.nome))),
      h('div', { class: 'vg-grupo', role: 'group', 'aria-label': 'Cenário' }, ...CENARIOS_VIAGEM.map((x) => h('button', { class: `vg-bt${x.id === v.cenario ? ' on' : ''}`, type: 'button', onclick: () => (sfx.click(), ajustar({ cenario: x.id })) }, x.nome))),
      destino,
      botao('Chegamos…', 'bandeira', 'forte', () => abrirChegada(this.app)),
    );
  }
}
