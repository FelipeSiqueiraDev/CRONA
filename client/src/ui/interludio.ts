import { regras, type FichaSalva, type PartyMember, type SceneInfo } from '@crona/shared';
import type { App } from './app';
import { portraitCanvas } from '../render/portrait';
import { h, toast } from './dom';
import { arteOu, ic, type NomeIcone } from './icons';
import { askNote } from './note';
import { sfx } from './sfx';

/**
 * A aba INTERLÚDIO do MAPA (LR p. 92–93), só do mestre: o lugar do descanso e, para cada agente,
 * as duas ações. A prévia mostra o que cada um recupera; "Concluir interlúdio" manda tudo de uma
 * vez (o relaxar conta quem relaxa junto) e o servidor aplica nas fichas. Os +1d6 guardados ficam
 * embaixo de cada um, para gastar na hora do teste e zerar no fim da missão.
 */
/** os nomes curtos das ações, para caberem na coluna */
const CURTO: Record<regras.AcaoInterludio, string> = { dormir: 'Dormir', relaxar: 'Relaxar', alimentar: 'Comer', exercitar: 'Exercício', ler: 'Ler', manutencao: 'Consertar', revisar: 'Revisar' };

/** o ícone de cada ação: o pintado (il-<ação>.png, PROMPT-ICONES-E-LOGO) e, até chegar, um de linha */
const ICONE: Record<regras.AcaoInterludio, NomeIcone> = { dormir: 'lua', relaxar: 'coracao', alimentar: 'frasco', exercitar: 'peso', ler: 'livro', manutencao: 'engrenagem', revisar: 'lupa' };
const icAcao = (a: regras.AcaoInterludio) => arteOu([`/arte/icones/il-${a}.png`], ic(ICONE[a]));

export class AbaInterludio {
  private app: App;
  private lugar: regras.LugarDescanso = 'normal';
  /** o rascunho das ações, por ficha */
  private escolhas = new Map<number, regras.EscolhaInterludio>();

  constructor(app: App) {
    this.app = app;
  }

  render(body: HTMLElement, party: PartyMember[], fichas: FichaSalva[], gm: boolean, redesenhar: () => void, cenas: SceneInfo[] = []) {
    // os agentes desta campanha que têm ficha
    const agentes = party
      .map((p) => ({ p, f: fichas.find((f) => f.personagem !== undefined && f.personagem === p.look?.charId) }))
      .filter((x): x is { p: PartyMember; f: FichaSalva } => !!x.f);
    if (!agentes.length) {
      body.append(h('p', { class: 'empty' }, 'Nenhum agente com ficha nesta campanha.'));
      return;
    }
    const nos: regras.NoInterludio[] = agentes.map(({ f }) => {
      const c = regras.calcular(f.ficha);
      const a = f.atual ?? { pv: c.pv, pe: c.pe, san: c.san };
      return {
        id: f.id,
        limitePe: c.limitePe,
        vigor: c.atributos.vig,
        intelecto: c.atributos.int,
        atual: { pv: Math.min(a.pv, c.pv), pe: Math.min(a.pe, c.pe), san: Math.min(a.san, c.san) },
        max: { pv: c.pv, pe: c.pe, san: c.san },
        bonus: { exercicio: f.bonus?.exercicio ?? 0, leitura: f.bonus?.leitura ?? 0 },
        escolha: this.escolhas.get(f.id) ?? { acoes: [] },
        // no quarto (do hotel, da pousada): a condição dele, como o servidor faz
        lugar: cenas.find((s) => s.id === agentes.find((x) => x.f === f)?.p.roomId)?.descanso,
      };
    });
    const previa = new Map(regras.resolverInterludio(this.lugar, nos).map((r) => [r.id, r]));
    const mudou = () => (sfx.click(), redesenhar());

    // o lugar do descanso
    const lugar = h(
      'div',
      { class: 'il-lugar', role: 'radiogroup', 'aria-label': 'Condição do descanso' },
      ...regras.LUGARES_DESCANSO.map((l) =>
        h(
          'button',
          { class: `il-chip${l.id === this.lugar ? ' on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(l.id === this.lugar), title: `${l.exemplo} (recuperação ×${String(l.vezes).replace('.', ',')})`, disabled: !gm, onclick: () => ((this.lugar = l.id), mudou()) },
          // o pintado da condição (il-<lugar>.png): a barraca, a cama simples, o quarto bom, a suíte
          arteOu([`/arte/icones/il-${l.id}.png`], h('span')),
          l.nome,
        ),
      ),
    );

    const cartoes = agentes.map(({ p, f }) => {
      const n = nos.find((x) => x.id === f.id)!;
      const e = n.escolha;
      const r = previa.get(f.id)!;
      const marcar = (a: regras.AcaoInterludio) => {
        const atual = this.escolhas.get(f.id) ?? { acoes: [] };
        const acoes = atual.acoes.includes(a) ? atual.acoes.filter((x) => x !== a) : [...atual.acoes, a].slice(-2);
        // cada um faz até duas ações (LR p. 92): a terceira troca a mais antiga, e o mestre fica sabendo
        if (!atual.acoes.includes(a) && atual.acoes.length >= 2) toast('Só duas ações por interlúdio: a mais antiga saiu.', 'info');
        const nova: regras.EscolhaInterludio = { acoes };
        if (acoes.includes('alimentar')) nova.prato = atual.prato;
        this.escolhas.set(f.id, nova);
        mudou();
      };
      const acoes = h(
        'div',
        { class: 'il-acoes' },
        ...regras.ACOES_INTERLUDIO.map((a) =>
          h('button', { class: `il-chip il-acao${e.acoes.includes(a.id) ? ' on' : ''}`, type: 'button', 'aria-pressed': String(e.acoes.includes(a.id)), 'aria-label': a.nome, title: `${a.nome}: ${a.resumo}`, disabled: !gm, onclick: () => marcar(a.id) }, icAcao(a.id), h('span', null, CURTO[a.id])),
        ),
      );
      const prato = e.acoes.includes('alimentar')
        ? (() => {
            const sel = h('select', { class: 'il-prato', disabled: !gm }, h('option', { value: '' }, 'Escolha o prato…'), ...regras.PRATOS.map((x) => h('option', { value: x.id, selected: e.prato === x.id, title: x.resumo }, `${x.nome}: ${x.resumo}`))) as HTMLSelectElement;
            sel.addEventListener('change', () => (this.escolhas.set(f.id, { ...e, prato: (sel.value || undefined) as regras.Prato | undefined }), mudou()));
            return sel;
          })()
        : null;
      // o valor da regra inteiro; se bater no máximo, quanto entra de fato
      const ganho = (k: 'pv' | 'pe' | 'san', nome: string) => (r.total[k] ? (r[k] < r.total[k] ? `+${r.total[k]} ${nome} (entra ${r[k]}, máx.)` : `+${r.total[k]} ${nome}`) : null);
      const ganhos = [ganho('pv', 'PV'), ganho('pe', 'PE'), ganho('san', 'SAN')].filter(Boolean) as string[];
      const guardados = (tipo: 'exercicio' | 'leitura', nome: string, attr: string, max: number) => {
        const v = n.bonus[tipo];
        return h(
          'span',
          { class: `il-bonus${v ? ' tem' : ''}`, title: `+1d6 num teste de ${attr} até o fim da missão (até ${max})` },
          arteOu([`/arte/icones/il-bonus-${tipo}.png`], h('span')),
          `${nome} ${v}`,
          gm && v ? h('button', { class: 'il-usar', type: 'button', title: 'Gastar um (o jogador usou num teste)', 'aria-label': `Gastar um bônus de ${nome}`, onclick: () => (sfx.click(), this.app.net.send({ t: 'bonusInterludio', fichaId: f.id, tipo, delta: -1 })) }, ic('menos')) : null,
        );
      };
      return h(
        'div',
        { class: 'il-agente', style: `--cor:${p.color}` },
        h(
          'div',
          { class: 'il-cab' },
          h('span', { class: 'il-foto' }, portraitCanvas(p.look, 44, { dir: 2 })),
          h('b', null, f.nome || p.name),
          h('span', { class: 'il-vit' }, `PV ${n.atual.pv}/${n.max.pv} · PE ${n.atual.pe}/${n.max.pe} · SAN ${n.atual.san}/${n.max.san}`),
          // dormindo num quarto (hotel, pousada): a condição do quarto vale no lugar da do grupo
          n.lugar ? h('span', { class: 'il-quarto', title: 'Está num quarto: descansa na condição dele, não na do grupo.' }, `No quarto: condição ${regras.LUGARES_DESCANSO.find((l) => l.id === n.lugar)?.nome.toLowerCase()}`) : null,
        ),
        acoes,
        prato,
        h(
          'div',
          { class: 'il-pe' },
          r.erros.length ? h('span', { class: 'il-erro' }, ic('alerta'), r.erros[0]) : h('span', { class: ganhos.length ? 'il-ganho' : 'il-nada' }, ganhos.length ? ganhos.join(' · ') : e.acoes.length ? 'nada a recuperar' : 'sem ação'),
          h('span', { class: 'il-guardados' }, guardados('exercicio', 'Exercício', 'Agilidade, Força ou Vigor', n.vigor), guardados('leitura', 'Leitura', 'Intelecto ou Presença', n.intelecto)),
        ),
      );
    });

    const algum = [...this.escolhas.values()].some((e) => e.acoes.length);
    const erro = [...previa.values()].find((r) => r.erros.length);
    const concluir = h(
      'button',
      {
        class: 'fx-bt forte il-concluir',
        type: 'button',
        disabled: !gm || !algum || !!erro,
        onclick: () => {
          sfx.paper();
          this.app.net.send({
            t: 'interludio',
            lugar: this.lugar,
            escolhas: agentes.map(({ f }) => ({ fichaId: f.id, ...(this.escolhas.get(f.id) ?? { acoes: [] }) })).filter((x) => x.acoes.length),
          });
          this.escolhas.clear();
          redesenhar();
        },
      },
      'Concluir interlúdio',
    );
    const zerar = h(
      'button',
      {
        class: 'fx-bt il-zerar',
        type: 'button',
        disabled: !gm || !nos.some((n) => n.bonus.exercicio || n.bonus.leitura),
        title: 'Os +1d6 guardados valem até o fim da missão',
        onclick: async () => {
          if (!(await askNote('FIM DA MISSÃO?', 'Os bônus de exercício e de leitura guardados de todos os agentes somem.', 'Zerar os bônus', true))) return;
          for (const { f } of agentes) if (f.bonus) this.app.net.send({ t: 'bonusInterludio', fichaId: f.id, tipo: 'todos', delta: -10 });
        },
      },
      'Fim da missão',
    );
    body.append(
      h('div', { class: 'il' }, h('p', { class: 'il-dica' }, 'Cada agente faz até duas ações; dormir e relaxar, uma vez (LR p. 92).'), lugar, h('div', { class: 'il-lista' }, ...cartoes), h('div', { class: 'il-rodape' }, zerar, concluir)),
    );
  }
}
