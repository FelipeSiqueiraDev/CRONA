/**
 * Resolução da manobra na aba COMBATE (regras em docs/COMBATE.md, seção 9; LR
 * p. 85–86, 90, 179): 1. Manobra, 2. Teste oposto, 3. Rolagem e 4. Efeito.
 * Os dados são físicos: o mestre digita o d20 que ficou de cada lado. As contas
 * saem de @crona/shared (combate/manobra.ts); o servidor aplica a condição, o
 * dano e o registro quando o mestre confirma, e a tela move a peça empurrada.
 */
import { combate as cb, regras } from '@crona/shared';
import { campoDado, type AlvoAtaque, type ArmaOpcao, type TabuleiroAtaque } from './combateAtaque';
import { h } from './dom';
import { textoTeste } from './fichaRegras';
import { ic, type NomeIcone } from './icons';
import { sfx } from './sfx';

/** Luta de quem resiste à manobra, e de onde veio o número. */
export interface TesteLuta {
  dados: number;
  bonus: number;
  /** d20 perdidos (0 ou negativo) */
  penalidade?: number;
  origem: string;
}

export interface CtxManobra {
  combate: cb.Combate;
  ator: cb.Participante;
  condicoesAtor: string[];
  /** os ataques de quem age (o teste de manobra é um ataque corpo a corpo) */
  armas: ArmaOpcao[];
  tamanhoAtor: cb.Tamanho;
  /** o alvo escolhido no tabuleiro ou na ordem */
  alvo: AlvoAtaque | null;
  /** quem o ator agarra e quem agarra o ator (esmagar e soltar-se vão contra eles) */
  agarra: AlvoAtaque | null;
  agarradoPor: AlvoAtaque | null;
  lutaDe: (p: cb.Participante) => TesteLuta | null;
  tamanhoDe: (p: cb.Participante) => cb.Tamanho;
  tabDe: (p: cb.Participante) => TabuleiroAtaque | null;
  acoes: cb.AcoesTurno;
  enviar: (a: cb.AcaoCombate) => void;
  /** empurra a peça do alvo para longe de quem age */
  empurrar: (alvo: number, casas: number) => void;
  mudou: () => void;
}

export const PASSOS_MANOBRA = ['Ação', 'Manobra', 'Alvo', 'Teste oposto', 'Efeito', 'Confirmar'];

const ICONE: Record<cb.ManobraId, NomeIcone> = { agarrar: 'mao', derrubar: 'deitado', desarmar: 'faca', empurrar: 'avancar', quebrar: 'raio', atropelar: 'correr', soltarse: 'sair', esmagar: 'punho' };

/** Um modificador do teste de manobra; `auto` = veio da ficha, da condição ou do tabuleiro (começa ligado). */
interface Mod {
  id: string;
  nome: string;
  dados?: number;
  bonus?: number;
  auto: boolean;
}

interface Estado {
  chave: string;
  manobra: cb.ManobraId;
  arma: number;
  /** chaves que o mestre mudou (id do modificador → ligado) */
  manual: Record<string, boolean>;
  outrosA: number;
  outrosB: number;
  /** Luta digitada para quem resiste sem ficha */
  lutaDados: number | null;
  lutaBonus: number | null;
  /** atropelar durante a investida: ação livre */
  livre: boolean;
  d20a: number | null;
  d20b: number | null;
  mover: boolean;
  objeto: string;
  soma: number | null;
}

const novo = (chave: string, manobra: cb.ManobraId = 'derrubar'): Estado => ({
  chave,
  manobra,
  arma: 0,
  manual: {},
  outrosA: 0,
  outrosB: 0,
  lutaDados: null,
  lutaBonus: null,
  livre: false,
  d20a: null,
  d20b: null,
  mover: true,
  objeto: 'arma-metal-uma',
  soma: null,
});

const nomeCond = (id: string) => regras.catalogo.condicao(id)?.nome ?? id;

/** Número com sinal digitado à mão (bônus e penalidades que a tela não conhece). */
function campoSinal(rotulo: string, valor: number, fn: (n: number) => void, foco: string): HTMLElement {
  const inp = h('input', { class: 'cb-dado cb-mais', type: 'text', inputmode: 'numeric', maxlength: 3, value: valor ? cb.sinal(valor) : '', placeholder: '±0', 'data-foco': foco, 'aria-label': rotulo });
  inp.addEventListener('change', () => {
    const n = Number(inp.value.trim().replace('−', '-').replace(',', '.'));
    fn(Number.isFinite(n) ? Math.max(-30, Math.min(30, Math.round(n))) : 0);
  });
  inp.addEventListener('keydown', (ev) => ev.key === 'Enter' && inp.blur());
  return h('label', { class: 'cb-caixa-dado mini' }, h('small', null, rotulo), inp);
}

export class ResolucaoManobra {
  private e: Estado = novo('');

  /** Zera a rolagem quando muda quem age, o alvo ou a rodada. */
  private sincronizar(x: CtxManobra) {
    const chave = `${x.combate.rodada}|${x.combate.vez}|${x.ator.id}|${x.alvo?.p.id ?? 0}`;
    if (chave === this.e.chave && this.disponivel(x, this.e.manobra)) return;
    const m = this.e.manobra;
    this.e = novo(chave, this.disponivel(x, m) ? m : 'derrubar');
  }

  /** Soltar-se e esmagar só aparecem para quem está agarrado ou agarrando. */
  private disponivel(x: CtxManobra, id: cb.ManobraId) {
    const d = cb.manobra(id);
    if (!d) return false;
    return d.quem === 'agarrado' ? !!x.agarradoPor : d.quem === 'agarrando' ? !!x.agarra : true;
  }

  /** Contra quem vai a manobra escolhida (a tela usa para a mira no tabuleiro). */
  alvoEscolhido(x: CtxManobra): AlvoAtaque | null {
    this.sincronizar(x);
    const m = this.e.manobra;
    return m === 'soltarse' ? x.agarradoPor : m === 'esmagar' ? x.agarra : x.alvo;
  }

  /** Armas do teste: as de corpo a corpo; agarrar e esmagar, só o desarmado (LR p. 85). */
  private armasDa(x: CtxManobra): ArmaOpcao[] {
    const corpo = x.armas.filter((a) => !a.faixa);
    if (this.e.manobra !== 'agarrar' && this.e.manobra !== 'esmagar') return corpo;
    const desarmado = corpo.filter((a) => /desarmad/i.test(a.nome));
    return desarmado.length ? desarmado : corpo.slice(0, 1);
  }

  /** Modificadores das condições que pesam no próprio teste (caído, ofuscado, agarrado). */
  private modsCondicao(condicoes: string[], lado: string): Mod[] {
    const out: Mod[] = [];
    for (const c of condicoes) {
      const s = cb.SITUACAO_DA_CONDICAO.atacante[c];
      const d = s ? cb.situacao(s).dados : undefined;
      if (d) out.push({ id: `${lado}:${c}`, nome: `${nomeCond(c)} ${d < 0 ? '−' : '+'}${Math.abs(d)}d20`, dados: d, auto: true });
    }
    return out;
  }

  private conta(x: CtxManobra) {
    const def = cb.manobra(this.e.manobra)!;
    const armas = this.armasDa(x);
    const arma = armas[Math.min(this.e.arma, Math.max(0, armas.length - 1))] ?? null;
    const alvo = this.alvoEscolhido(x);
    const tab = alvo ? x.tabDe(alvo.p) : null;
    const on = (m: Mod) => this.e.manual[m.id] ?? m.auto;
    // quem faz: arma, tamanho, corrente, condições e o tabuleiro
    const modsA: Mod[] = [];
    const tA = cb.MOD_TAMANHO[x.tamanhoAtor];
    if (tA) modsA.push({ id: 'a:tam', nome: `${cb.NOME_TAMANHO[x.tamanhoAtor]} ${cb.sinal(tA)}`, bonus: tA, auto: true });
    if ((def.id === 'desarmar' || def.id === 'derrubar') && arma && /corrente/i.test(arma.nome)) modsA.push({ id: 'a:corrente', nome: 'Corrente +2', bonus: 2, auto: true });
    modsA.push(...this.modsCondicao(x.condicoesAtor, 'a'));
    modsA.push({ id: 'a:flanq', nome: 'Flanqueando +1d20', dados: 1, auto: !!tab?.flanqueia });
    modsA.push({ id: 'a:elev', nome: 'Posição elevada +1d20', dados: 1, auto: !!tab?.elevado });
    const base = arma ?? null;
    // dados ganhos e perdidos separados: a conta de "menos de 1 dado" usa os dois (LR p. 11)
    const ganhos = (ms: Mod[]) => ms.filter(on).reduce((t, m) => t + Math.max(0, m.dados ?? 0), 0);
    const perdidos = (ms: Mod[]) => ms.filter(on).reduce((t, m) => t + Math.min(0, m.dados ?? 0), 0);
    const dadosA = (base?.dados ?? 1) + ganhos(modsA);
    const penalidadeA = (base?.penalidade ?? 0) + perdidos(modsA);
    const bonusA = (base?.bonus ?? 0) + modsA.filter(on).reduce((t, m) => t + (m.bonus ?? 0), 0) + this.e.outrosA;
    // quem resiste: Luta, tamanho e condições
    const luta = alvo ? x.lutaDe(alvo.p) : null;
    const lutaUsada = luta ?? (this.e.lutaDados !== null && this.e.lutaBonus !== null ? { dados: this.e.lutaDados, bonus: this.e.lutaBonus, origem: 'digitada' } : null);
    const modsB: Mod[] = [];
    if (alvo) {
      const tam = x.tamanhoDe(alvo.p);
      const tB = cb.MOD_TAMANHO[tam];
      if (tB) modsB.push({ id: 'b:tam', nome: `${cb.NOME_TAMANHO[tam]} ${cb.sinal(tB)}`, bonus: tB, auto: true });
      modsB.push(...this.modsCondicao(alvo.condicoes, 'b'));
    }
    const dadosB = lutaUsada ? lutaUsada.dados + ganhos(modsB) : null;
    const penalidadeB = lutaUsada ? (lutaUsada.penalidade ?? 0) + perdidos(modsB) : 0;
    const bonusB = lutaUsada ? lutaUsada.bonus + modsB.filter(on).reduce((t, m) => t + (m.bonus ?? 0), 0) + this.e.outrosB : null;
    const op = alvo && bonusB !== null && this.e.d20a !== null && this.e.d20b !== null ? cb.resolverOposto({ d20: this.e.d20a, bonus: bonusA }, { d20: this.e.d20b, bonus: bonusB }) : null;
    const venceu = op?.vencedor === 'a';
    // empurrão: empurrar sempre; derrubar vencendo por 5
    const empurrao = !venceu || !op ? 0 : def.id === 'empurrar' ? cb.casasEmpurrao(op.diferenca) : def.id === 'derrubar' && cb.empurraUmQuadrado(op.diferenca) ? 2 : 0;
    // dano: esmagar (no alvo) e quebrar (no objeto)
    const precisaDano = venceu && (def.id === 'esmagar' || def.id === 'quebrar') && !!arma;
    let dano: { partes: cb.PartesDano; conta: cb.ContaDano; previa: ReturnType<typeof cb.previaDano>; naoLetal: boolean } | null = null;
    let objeto: { o: cb.Objeto; r: ReturnType<typeof cb.danoNoObjeto>; total: number } | null = null;
    if (precisaDano && this.e.soma !== null && arma && alvo) {
      const partes = cb.lerDano(arma.dano);
      if (def.id === 'esmagar') {
        const conta = cb.contaDano({ soma: this.e.soma, fixo: partes.fixo, tipo: arma.tipo, rd: alvo.rd, imunidades: alvo.imunidades, vulnerabilidades: alvo.vulnerabilidades });
        const naoLetal = arma.notas.some((n) => /não letal/i.test(n));
        dano = { partes, conta, previa: cb.previaDano(alvo.vitais, conta.final, { tipo: arma.tipo, naoLetal, naoLetalAntes: alvo.p.naoLetal, agente: alvo.agente }), naoLetal };
      } else {
        const o = cb.objeto(this.e.objeto) ?? cb.OBJETOS[0];
        const total = Math.max(0, this.e.soma + partes.fixo);
        objeto = { o, r: cb.danoNoObjeto(total, o), total };
      }
    }
    const semAcao = x.acoes.completa || (x.acoes.padrao && !(def.id === 'atropelar' && this.e.livre));
    return { def, armas, arma, alvo, tab, modsA, modsB, on, dadosA, penalidadeA, bonusA, luta, lutaUsada, dadosB, penalidadeB, bonusB, op, venceu, empurrao, precisaDano, dano, objeto, semAcao };
  }

  /** Em que passo está (para a barra de passos). */
  passo(x: CtxManobra): number {
    const k = this.conta(x);
    if (!k.alvo) return 2;
    if (!k.op || k.op.vencedor === 'empate') return 3;
    if (k.precisaDano && this.e.soma === null) return 4;
    return 5;
  }

  // ---------------------------------------------------------------- desenho

  montar(x: CtxManobra): HTMLElement {
    this.sincronizar(x);
    const k = this.conta(x);
    return h('div', { class: 'cb-atk cb-man' }, this.colManobra(x, k), this.colTeste(x, k), this.colRolagem(x, k), this.linhaEfeito(x, k));
  }

  private colManobra(x: CtxManobra, k: ReturnType<ResolucaoManobra['conta']>): HTMLElement {
    const cards = cb.MANOBRAS.filter((m) => this.disponivel(x, m.id)).map((m) =>
      h(
        'button',
        {
          class: `cb-arma${m.id === this.e.manobra ? ' on' : ''}`,
          type: 'button',
          'aria-pressed': String(m.id === this.e.manobra),
          title: `${m.nome}: ${m.efeito} (LR p. ${m.pagina})`,
          onclick: () => {
            sfx.click();
            this.e = { ...novo(this.e.chave, m.id), outrosA: this.e.outrosA, outrosB: this.e.outrosB };
            x.mudou();
          },
        },
        h('span', { class: 'cb-arma-ic' }, ic(ICONE[m.id])),
        h('span', { class: 'cb-arma-txt' }, h('b', null, m.nome), h('small', null, m.efeito)),
      ),
    );
    const extra: HTMLElement[] = [];
    if (this.e.manobra === 'atropelar')
      extra.push(
        h(
          'label',
          { class: 'cb-dlg-check cb-man-check' },
          h('input', { type: 'checkbox', class: 'cb-check', checked: this.e.livre, onchange: (ev: Event) => ((this.e.livre = (ev.target as HTMLInputElement).checked), x.mudou()) }),
          h('span', null, 'Na investida: ação livre (LR p. 86)'),
        ),
      );
    if (x.agarra)
      extra.push(
        h(
          'button',
          {
            class: 'cb-bt claro cb-man-soltar',
            type: 'button',
            title: 'Soltar é ação livre (LR p. 85)',
            onclick: () => {
              sfx.click();
              x.enviar({ tipo: 'soltar', id: x.ator.id });
            },
          },
          ic('mao'),
          h('span', null, `Soltar ${x.agarra.p.nome} (livre)`),
        ),
      );
    return h(
      'section',
      { class: 'cb-col cb-col-arma' },
      h('h4', null, h('span', null, '1.'), ' MANOBRA'),
      h('div', { class: 'cb-col-lista cb-rola' }, ...cards),
      ...(extra.length ? [h('div', { class: 'cb-man-extra' }, ...extra)] : []),
    );
  }

  private chaves(mods: Mod[], k: ReturnType<ResolucaoManobra['conta']>, x: CtxManobra): HTMLElement[] {
    return mods.map((m) =>
      h(
        'label',
        { class: `cb-sit${k.on(m) ? ' on' : ''}`, title: m.nome },
        h('span', { class: 'cb-sit-ic' }, ic(m.dados ? 'dados' : 'mais')),
        h('span', { class: 'cb-sit-txt' }, m.nome),
        m.auto ? h('i', { class: 'cb-visto', title: 'Visto na ficha, na condição ou no tabuleiro' }, ic('olho')) : h('i', { class: 'cb-visto vazio' }),
        h('input', {
          type: 'checkbox',
          class: 'cb-chave',
          checked: k.on(m),
          'aria-label': m.nome,
          onchange: (ev: Event) => {
            const v = (ev.target as HTMLInputElement).checked;
            if (v === m.auto) delete this.e.manual[m.id];
            else this.e.manual[m.id] = v;
            this.e.d20a = this.e.d20b = null;
            x.mudou();
          },
        }),
      ),
    );
  }

  private colTeste(x: CtxManobra, k: ReturnType<ResolucaoManobra['conta']>): HTMLElement {
    const alvo = k.alvo;
    // quem faz: a arma do teste (o teste de manobra é um ataque corpo a corpo) e o que pesa
    const armaEl =
      k.armas.length > 1
        ? h(
            'select',
            {
              class: 'fx-inp cb-man-sel',
              'aria-label': 'Arma do teste de manobra',
              onchange: (ev: Event) => {
                this.e.arma = Number((ev.target as HTMLSelectElement).value);
                this.e.d20a = this.e.d20b = this.e.soma = null;
                x.mudou();
              },
            },
            ...k.armas.map((a, i) => h('option', { value: String(i), selected: a === k.arma }, `${a.nome} · ${textoTeste(a.dados, a.bonus, a.penalidade)}`)),
          )
        : h('small', null, k.arma ? `Luta com ${k.arma.nome}: ${textoTeste(k.arma.dados, k.arma.bonus, k.arma.penalidade)}` : 'Sem ataque corpo a corpo: use os outros.');
    const cab = (nome: string, outros: HTMLElement) => h('div', { class: 'cb-man-cab' }, h('b', null, nome), outros);
    const colA = h(
      'div',
      { class: 'cb-man-col cb-rola' },
      h('div', { class: 'cb-man-lado' }, cab(x.ator.nome, campoSinal('outros', this.e.outrosA, (n) => ((this.e.outrosA = n), (this.e.d20a = this.e.d20b = null), x.mudou()), 'man:oa')), armaEl),
      ...this.chaves(k.modsA, k, x),
    );
    // quem resiste: Luta, tamanho e condições
    const colB = h('div', { class: 'cb-man-col cb-rola' });
    if (!alvo) colB.append(h('p', { class: 'cb-vazio' }, this.e.manobra === 'soltarse' ? 'Ninguém agarra quem age.' : 'Escolha o alvo: clique na peça ou no nome da ordem.'));
    else {
      const luta = k.luta
        ? h('small', null, `Luta ${textoTeste(k.luta.dados, k.luta.bonus, k.luta.penalidade)} (${k.luta.origem})`)
        : h(
            'div',
            { class: 'cb-man-luta', title: 'Sem Luta na ficha: digite quantos d20 e o bônus' },
            h('small', null, 'Luta'),
            campoDado('d20', this.e.lutaDados, 9, (n) => ((this.e.lutaDados = n), x.mudou()), 'man:ld'),
            campoDado('bônus', this.e.lutaBonus, 99, (n) => ((this.e.lutaBonus = n), x.mudou()), 'man:lb'),
          );
      colB.append(
        h('div', { class: 'cb-man-lado' }, cab(alvo.p.nome, campoSinal('outros', this.e.outrosB, (n) => ((this.e.outrosB = n), (this.e.d20a = this.e.d20b = null), x.mudou()), 'man:ob')), luta),
        ...this.chaves(k.modsB, k, x),
      );
    }
    const t = k.tab;
    const longe = !!alvo && !!t && t.metros !== null && !t.adjacente;
    return h(
      'section',
      { class: 'cb-col cb-col-sit' },
      h('h4', null, h('span', null, '2.'), ' TESTE OPOSTO'),
      h('div', { class: 'cb-man-lados' }, colA, colB),
      longe
        ? h('small', { class: 'cb-col-pe alerta' }, `Fora do corpo a corpo (${cb.textoMetros(t!.metros!)}): a manobra pede alvo adjacente.`)
        : h('small', { class: 'cb-col-pe' }, 'Luta contra Luta, mesmo com arma de disparo (LR p. 85).'),
    );
  }

  private colRolagem(x: CtxManobra, k: ReturnType<ResolucaoManobra['conta']>): HTMLElement {
    const corpo: (HTMLElement | null)[] = [];
    const alvo = k.alvo;
    if (!alvo) corpo.push(h('p', { class: 'cb-vazio' }, 'Escolha o alvo.'));
    else if (k.dadosB === null || k.bonusB === null) corpo.push(h('p', { class: 'cb-vazio' }, `Digite a Luta de ${alvo.p.nome}.`));
    else {
      // cada lado: o que rolar e o d20 que ficou, na mesma linha
      const lado = (nome: string, dados: number, penalidade: number, bonus: number, valor: number | null, fn: (n: number | null) => void, foco: string) =>
        h(
          'div',
          { class: 'cb-man-rol' },
          h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, h('b', null, nome), h('br'), cb.textoRolagem(dados, bonus, penalidade))),
          campoDado('d20', valor, 20, fn, foco, true),
        );
      corpo.push(
        lado(x.ator.nome, k.dadosA, k.penalidadeA, k.bonusA, this.e.d20a, (n) => ((this.e.d20a = n && n >= 1 ? n : null), (this.e.soma = null), x.mudou()), 'man:a'),
        lado(alvo.p.nome, k.dadosB, k.penalidadeB, k.bonusB, this.e.d20b, (n) => ((this.e.d20b = n && n >= 1 ? n : null), (this.e.soma = null), x.mudou()), 'man:b'),
      );
      const op = k.op;
      if (op) {
        const texto = op.vencedor === 'empate' ? 'EMPATE' : op.vencedor === 'a' ? `VENCEU POR ${op.diferenca}` : 'RESISTIU';
        corpo.push(
          h(
            'div',
            { class: 'cb-man-res' },
            h('span', { class: `cb-carimbo ${op.vencedor === 'a' ? 'acerto' : 'erro'}`, role: 'status' }, h('span', null, texto)),
            h('p', { class: 'cb-total' }, `Total ${op.totalA} contra ${op.totalB}${op.vencedor === 'empate' ? ': rolem de novo (LR p. 75)' : ''}`),
          ),
        );
      }
    }
    return h('section', { class: 'cb-col cb-col-rol' }, h('h4', null, h('span', null, '3.'), ' ROLAGEM'), h('div', { class: 'cb-col-corpo cb-rola' }, ...corpo));
  }

  private linhaEfeito(x: CtxManobra, k: ReturnType<ResolucaoManobra['conta']>): HTMLElement {
    const alvo = k.alvo;
    const partes: HTMLElement[] = [];
    let instrucao: HTMLElement | null = null;
    let pronto = false;
    const op = k.op;
    if (!alvo || !op || op.vencedor === 'empate') partes.push(h('p', { class: 'cb-vazio' }, 'O efeito aparece depois da rolagem.'));
    else if (!k.venceu) {
      pronto = true;
      partes.push(h('p', { class: 'cb-dano-conta' }, h('b', null, k.def.id === 'atropelar' ? `${alvo.p.nome} fica de pé e impede o avanço.` : `${alvo.p.nome} resistiu: nada acontece.`)));
    } else {
      const nome = alvo.p.nome;
      const linhas: HTMLElement[] = [];
      const metros = cb.textoMetros(k.empurrao * cb.METROS_POR_CASA);
      switch (k.def.id) {
        case 'agarrar':
          linhas.push(h('b', null, `${nome} fica agarrado: desprevenido e imóvel, só ataca com arma leve e sofre −1d20 nos ataques.`), h('span', null, `${x.ator.nome} fica com uma mão ocupada e anda à metade.`));
          break;
        case 'derrubar':
          linhas.push(h('b', null, `${nome} fica caído${k.empurrao ? ` e é empurrado ${metros}` : ''}.`));
          break;
        case 'desarmar':
          linhas.push(h('b', null, cb.empurraUmQuadrado(op.diferenca) ? `O item de ${nome} vai 1 quadrado adiante.` : `O item de ${nome} cai na casa dele.`), h('span', null, 'Tire o item da mão na ficha.'));
          break;
        case 'empurrar':
          linhas.push(h('b', null, `${nome} é empurrado ${metros}.`), h('span', null, `${x.ator.nome} pode gastar uma ação de movimento para ir junto.`));
          break;
        case 'atropelar':
          linhas.push(h('b', null, `${nome} cai, e ${x.ator.nome} passa.`));
          break;
        case 'soltarse':
          linhas.push(h('b', null, `${x.ator.nome} se solta de ${nome}.`));
          break;
        case 'esmagar':
        case 'quebrar': {
          if (!k.arma) break;
          instrucao = h('div', { class: 'cb-instrucao' }, ic('dados'), h('span', null, cb.textoDano(k.arma.dano)));
          if (k.def.id === 'quebrar')
            partes.push(
              h(
                'label',
                { class: 'cb-man-arma' },
                h('small', null, 'Objeto'),
                h(
                  'select',
                  { class: 'fx-inp', onchange: (ev: Event) => ((this.e.objeto = (ev.target as HTMLSelectElement).value), x.mudou()) },
                  ...cb.OBJETOS.map((o) => h('option', { value: o.id, selected: o.id === this.e.objeto }, `${o.nome} · RD ${o.rd} · ${o.pv} PV`)),
                ),
              ),
            );
          partes.push(campoDado('soma dos dados', this.e.soma, 999, (n) => ((this.e.soma = n), x.mudou()), 'man:dano', true));
          if (k.dano) {
            linhas.push(h('span', null, k.dano.conta.conta));
            if (k.dano.previa) linhas.push(h('span', { class: 'alerta' }, `${nome}: ${k.dano.previa.texto}`));
          }
          if (k.objeto) linhas.push(h('span', null, `${k.objeto.o.nome}: ${k.objeto.r.conta}`), h('span', { class: 'alerta' }, k.objeto.r.quebrou ? 'Quebrou.' : 'Aguentou.'));
          break;
        }
      }
      if (k.empurrao)
        partes.push(
          h(
            'label',
            { class: 'cb-dlg-check cb-man-check' },
            h('input', { type: 'checkbox', class: 'cb-check', checked: this.e.mover, onchange: (ev: Event) => ((this.e.mover = (ev.target as HTMLInputElement).checked), x.mudou()) }),
            h('span', null, 'Mover a peça no tabuleiro'),
          ),
        );
      partes.push(h('div', { class: 'cb-dano-conta' }, ...linhas));
      pronto = !k.precisaDano || this.e.soma !== null;
    }
    const desfazer = h(
      'button',
      {
        class: 'cb-bt claro',
        type: 'button',
        disabled: this.e.d20a === null && this.e.d20b === null && this.e.soma === null,
        title: 'Volta um passo da rolagem',
        onclick: () => {
          sfx.click();
          if (this.e.soma !== null) this.e.soma = null;
          else if (this.e.d20b !== null) this.e.d20b = null;
          else this.e.d20a = null;
          x.mudou();
        },
      },
      ic('girarE'),
      h('span', null, 'Desfazer'),
    );
    const confirmar = h(
      'button',
      {
        class: 'cb-bt forte',
        type: 'button',
        disabled: !pronto || k.semAcao,
        title: k.semAcao ? 'A ação padrão deste turno já foi usada' : 'Escreve no registro e aplica o efeito',
        onclick: () => {
          if (!alvo || !op || op.vencedor === 'empate' || k.bonusB === null || k.dadosB === null) return;
          sfx.click();
          const nomes = (mods: Mod[], prefixo: string) => mods.filter(k.on).map((m) => `${prefixo}${m.nome}`);
          const outros = (n: number, prefixo: string) => (n ? [`${prefixo}outros ${cb.sinal(n)}`] : []);
          const m: cb.ManobraConfirmada = {
            quem: x.ator.id,
            alvo: alvo.p.id,
            manobra: k.def.id,
            qual: k.def.id === 'atropelar' && this.e.livre ? 'livre' : 'padrao',
            ...(k.arma ? { arma: k.arma.nome } : {}),
            teste: {
              quem: { dados: k.dadosA, bonus: k.bonusA, d20: this.e.d20a!, total: op.totalA },
              alvo: { dados: k.dadosB, bonus: k.bonusB, d20: this.e.d20b!, total: op.totalB },
            },
            venceu: k.venceu,
            diferenca: op.diferenca,
            modificadores: [...nomes(k.modsA, ''), ...outros(this.e.outrosA, ''), ...nomes(k.modsB, `${alvo.p.nome}: `), ...outros(this.e.outrosB, `${alvo.p.nome}: `)],
            ...(k.def.id === 'empurrar' && k.venceu ? { empurrao: k.empurrao } : {}),
            ...(k.dano
              ? {
                  dano: {
                    formula: k.arma ? cb.textoFormula(cb.lerDano(k.arma.dano)) : '',
                    soma: this.e.soma!,
                    total: k.dano.conta.total,
                    tipo: k.arma?.tipo ?? 'impacto',
                    conta: k.dano.conta.conta,
                    final: k.dano.conta.final,
                    ...(k.dano.naoLetal ? { naoLetal: true } : {}),
                  },
                }
              : {}),
            ...(k.objeto
              ? {
                  objeto: { nome: k.objeto.o.nome, pv: k.objeto.o.pv, quebrou: k.objeto.r.quebrou },
                  dano: { formula: k.arma ? cb.textoFormula(cb.lerDano(k.arma.dano)) : '', soma: this.e.soma!, total: k.objeto.total, tipo: k.arma?.tipo ?? 'impacto', conta: k.objeto.r.conta, final: k.objeto.r.final },
                }
              : {}),
          };
          x.enviar({ tipo: 'manobra', manobra: m });
          if (k.venceu && k.empurrao && this.e.mover) x.empurrar(alvo.p.id, k.empurrao);
          this.e.d20a = this.e.d20b = this.e.soma = null;
          this.e.manual = {};
          x.mudou();
        },
      },
      ic('ok'),
      h('span', null, 'Confirmar ação'),
    );
    // o resultado em destaque (17/10, o Felipe: "melhorar essa tela"; "oia que trem feio"): o carimbo de quem venceu e
    // o placar em cima, o efeito no meio e os botões no rodapé
    const placar =
      alvo && op && op.vencedor !== 'empate'
        ? h(
            'div',
            { class: 'cb-efe-placar' },
            h('span', { class: `cb-carimbo ${k.venceu ? 'acerto' : 'erro'}`, role: 'status' }, h('span', null, k.venceu ? `VENCEU POR ${op.diferenca}` : 'RESISTIU')),
            h('small', null, `${x.ator.nome} ${op.totalA} contra ${op.totalB} de ${alvo.p.nome}`),
          )
        : null;
    return h(
      'section',
      { class: 'cb-dano cb-efeito' },
      h('div', { class: 'cb-dano-cab' }, h('h4', null, h('span', null, '4.'), ' EFEITO'), instrucao),
      h('div', { class: 'cb-dano-corpo' }, placar, ...partes),
      h('div', { class: 'cb-dano-botoes' }, desfazer, confirmar),
    );
  }
}
