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
  // quem vai (todos, de começo) e em que banco senta: na ordem, o primeiro ao volante; o mestre arrasta para trocar
  const assento = new Map<number, number>();
  const livre = () => BANCOS_VAN.find((b) => ![...assento.values()].includes(b.id))?.id;
  for (const p of agentes.slice(0, BANCOS_VAN.length)) assento.set(p.id!, livre()!);
  const j = janela('VIAGEM', 'correr', () => {}, 70);
  const quem = h('div', { class: 'vg-quem' });
  const desenho = desenhoDaVan();
  desenho.classList.add('vg-van-arte');
  const bancos = h('div', { class: 'vg-van-bancos' });
  const van = h('div', { class: 'vg-van', role: 'img', 'aria-label': 'A van, com quem vai sentado' }, desenho, bancos);
  const aviso = h('p', { class: 'vg-aviso', role: 'status' });
  const quemNoBanco = (bancoId: number) => [...assento].find(([, b]) => b === bancoId)?.[0];
  /** o meio do banco, em % da van */
  const ondeFica = (bancoId: number) => {
    const b = BANCOS_VAN.find((x) => x.id === bancoId)!;
    const [mx, my] = meioDoBanco(b.x, b.y);
    return [(mx / VAN_W) * 100, (my / VAN_H) * 100];
  };
  /** senta no banco; se tinha alguém nele, os dois trocam de lugar */
  const sentar = (tokenId: number, bancoId: number) => {
    const de = assento.get(tokenId);
    const outro = quemNoBanco(bancoId);
    if (outro !== undefined && outro !== tokenId) {
      if (de === undefined) assento.delete(outro);
      else assento.set(outro, de);
    }
    assento.set(tokenId, bancoId);
  };
  // o banco escolhido num clique (sem arrastar): o próximo clique noutro banco troca os dois
  let escolhido: number | null = null;

  /** arrasta a bolinha do agente pela van; solta perto de um banco, senta nele (ou troca com quem estava) */
  const arrastar = (ev: PointerEvent, el: HTMLElement, tokenId: number) => {
    ev.preventDefault();
    const caixa = van.getBoundingClientRect();
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    let moveu = false;
    el.setPointerCapture(ev.pointerId);
    const mover = (e: PointerEvent) => {
      if (!moveu && Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
      moveu = true;
      van.classList.add('arrastando');
      el.classList.add('pego');
      el.style.left = `${((e.clientX - caixa.left) / caixa.width) * 100}%`;
      el.style.top = `${((e.clientY - caixa.top) / caixa.height) * 100}%`;
    };
    const soltar = (e: PointerEvent) => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      van.classList.remove('arrastando');
      if (!moveu) {
        // clique: escolhe este banco; com outro já escolhido, os dois trocam
        const meu = assento.get(tokenId)!;
        if (escolhido === null) escolhido = meu;
        else if (escolhido === meu) escolhido = null;
        else {
          sentar(tokenId, escolhido);
          escolhido = null;
        }
        sfx.click();
        return desenhar();
      }
      const px = ((e.clientX - caixa.left) / caixa.width) * 100;
      const py = ((e.clientY - caixa.top) / caixa.height) * 100;
      let melhor: number | null = null;
      let perto = 12;
      for (const b of BANCOS_VAN) {
        const [bx, by] = ondeFica(b.id);
        const d = Math.hypot(bx - px, (by - py) * (VAN_H / VAN_W));
        if (d < perto) [melhor, perto] = [b.id, d];
      }
      if (melhor !== null) {
        sentar(tokenId, melhor);
        sfx.click();
      }
      escolhido = null;
      desenhar();
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  };

  const desenhar = () => {
    quem.replaceChildren(
      h('p', { class: 'vg-dica' }, 'Toque para tirar ou pôr na van. Na van, arraste para trocar de banco.'),
      ...agentes.map((p) => {
        const dentro = assento.has(p.id!);
        return h(
          'button',
          {
            class: `vg-ag${dentro ? ' on' : ' fora'}`,
            type: 'button',
            'aria-pressed': String(dentro),
            onclick: () => {
              sfx.click();
              if (dentro) assento.delete(p.id!);
              else {
                const b = livre();
                if (b !== undefined) assento.set(p.id!, b);
              }
              escolhido = null;
              desenhar();
            },
          },
          h('span', { class: 'vg-foto' }, portraitCanvas(p.look, 56, { dir: 2 })),
          h('span', { class: 'vg-nome' }, h('b', null, p.name.split(' ')[0]), h('small', null, dentro ? (assento.get(p.id!) === 0 ? 'dirige' : 'vai') : 'fica')),
        );
      }),
    );
    bancos.replaceChildren(
      ...BANCOS_VAN.map((banco) => {
        const [x, y] = ondeFica(banco.id);
        const pecaId = quemNoBanco(banco.id);
        const p = pecaId === undefined ? undefined : agentes.find((a) => a.id === pecaId);
        if (!p) {
          // o banco vazio: aparece enquanto se arrasta (onde dá para soltar) ou com um banco escolhido no clique
          return h('span', {
            class: `vg-banco vazio${banco.id === 0 ? ' volante' : ''}`,
            style: `left:${x}%;top:${y}%`,
            title: banco.nome,
            onclick: () => {
              if (escolhido === null) return;
              const quemEra = quemNoBanco(escolhido);
              if (quemEra !== undefined) sentar(quemEra, banco.id);
              escolhido = null;
              sfx.click();
              desenhar();
            },
          });
        }
        const el = h(
          'span',
          { class: `vg-banco ocupado${escolhido === banco.id ? ' escolhendo' : ''}`, style: `left:${x}%;top:${y}%`, title: `${p.name} · ${banco.nome}` },
          portraitCanvas(p.look, 48, { dir: 2 }),
        );
        el.addEventListener('pointerdown', (ev) => arrastar(ev, el, p.id!));
        return el;
      }),
    );
    van.classList.toggle('escolhendo', escolhido !== null);
    // sem ninguém ao volante, a van não sai
    const semMotorista = assento.size > 0 && quemNoBanco(0) === undefined;
    partir.disabled = !assento.size || semMotorista;
    aviso.textContent = semMotorista ? 'Falta alguém no banco do motorista.' : '';
  };

  /** Parte para o lugar escolhido: o cenário sai do destino (a estrada de terra para o campo, a rodovia para a cidade). */
  const partirPara = (l: LugarInfo) => {
    const bancosEscolhidos = [...assento].map(([tokenId, banco]) => ({ tokenId, banco }));
    if (!bancosEscolhidos.length || quemNoBanco(0) === undefined) return;
    app.net.send({ t: 'viagem', acao: 'iniciar', bancos: bancosEscolhidos, destinoId: l.entrada });
    j.fechar();
  };
  const partir = botao('Partir', 'correr', 'forte', () => {
    if (!assento.size || quemNoBanco(0) === undefined) return;
    if (destinoInicial) return partirPara(destinoInicial);
    abrirMapaMundi(app, { escolher: partirPara, titulo: 'PARA ONDE VAMOS?', rotulo: 'Partir para cá' });
  });
  const cancelar = botao('Cancelar', 'fechar', 'claro', () => j.fechar());

  j.corpo.append(h('div', { class: 'vg' }, quem, h('div', { class: 'vg-meio' }, h('h4', null, destinoInicial ? `Rumo a ${destinoInicial.nome}` : 'Quem vai na van'), van, aviso)));
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
