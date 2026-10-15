/**
 * Aba ITENS da tela MAPA (referência docs/ref-itens.jpg, fora do git): a
 * mochila de cada agente, pela ficha (um inventário só, docs/REGRAS.md).
 * Escolha do agente, carga e mãos, os tipos de item, o que está equipado
 * (nas mãos e vestido), a mochila em grade e o item selecionado, com Usar,
 * Entregar para…, Mover e Descartar. Cada ação vai para o servidor (`mochila`).
 */
import { opcoesMelhoria } from './melhorias';
import { escolher } from './fichaModal';
import { regras, vitalConditions, type AcaoMochila, type FichaSalva, type LootKind, type PartyMember } from '@crona/shared';
import { portraitCanvas } from '../render/portrait';
import type { App } from './app';
import { arteDoItem } from './arteItem';
import { abrirRequisicao } from './requisicao';
import { h, trocarFilhos } from './dom';
import { infoItem, romano, textoRef } from './fichaRegras';
import { arteOu, ic } from './icons';
import { lootIcon } from './lootIcons';
import { askNote } from './note';
import { sfx } from './sfx';

const cat = regras.catalogo;

interface Agente {
  p: PartyMember;
  f: FichaSalva | null;
  c: regras.Calculado | null;
}

/** Os três tipos contados no topo, como na referência. */
const TIPOS: { nome: string; icone: () => Element; conta: (it: regras.ItemFicha) => boolean }[] = [
  { nome: 'Consumíveis', icone: () => arteOu(['/arte/icones/cat-medicamento.png'], lootIcon('potion', 26)), conta: (it) => regras.consumivel(it) },
  { nome: 'Chaves', icone: () => arteOu(['/arte/icones/chave.png', '/arte/icones/cadeado.png'], lootIcon('key', 26)), conta: (it) => (it.tipo === 'cena' && it.tipoCena === 'key') || it.id === 'chaves' },
  { nome: 'Ritualísticos', icone: () => arteOu(['/arte/icones/cat-paranormal.png'], ic('pentagrama')), conta: (it) => it.tipo === 'amaldicoado' || (it.tipo === 'equipamento' && cat.equipamento(it.id)?.grupo === 'paranormal') },
];

const LUGAR: Record<regras.LugarItem, string> = { mao: 'Na mão', vestido: 'Vestido', mochila: 'Na mochila' };

/** Item que se lê: o documento, a carta e a mídia achados no cenário. */
export const ehDocumento = (it: regras.ItemFicha) => it.tipo === 'cena' && ['document', 'letter', 'tape'].includes(it.tipoCena ?? '');

/** O papel da inspeção (o mesmo do Examinar das pistas). */
export type AbrirItem = (o: { titulo: string; rotulo: string; icone: Element; texto: string; linhas?: Node[] }) => void;

/** "a, b e c" */
const lista = (nomes: string[]) => (nomes.length < 2 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

export class AbaItens {
  private app: App;
  /** agente escolhido (id da peça na campanha) */
  private agenteId: number | null = null;
  /** item escolhido (uid) */
  private sel: number | null = null;
  private calcs = new WeakMap<regras.Ficha, regras.Calculado | null>();
  private ultimo: { el: HTMLElement; party: PartyMember[]; fichas: FichaSalva[]; gm: boolean } | null = null;
  private menu: HTMLElement | null = null;
  private abrirItem: AbrirItem;

  constructor(app: App, abrirItem: AbrirItem) {
    this.app = app;
    this.abrirItem = abrirItem;
  }

  /** Abre na mochila deste agente (id da peça). */
  escolher(agenteId: number) {
    if (agenteId !== this.agenteId) this.sel = null;
    this.agenteId = agenteId;
  }

  private calc(f: FichaSalva): regras.Calculado | null {
    let c = this.calcs.get(f.ficha);
    if (c === undefined) {
      try {
        c = regras.calcular(f.ficha);
      } catch {
        c = null;
      }
      this.calcs.set(f.ficha, c);
    }
    return c;
  }

  /** Desenha a aba em `el` (o corpo da coluna da direita). */
  render(el: HTMLElement, party: PartyMember[], fichas: FichaSalva[], gm: boolean) {
    this.ultimo = { el, party, fichas, gm };
    this.fecharMenu();
    const ags: Agente[] = party
      .filter((p) => p.id)
      .map((p) => {
        const f = fichas.find((x) => x.personagem && x.personagem === p.look?.charId) ?? null;
        return { p, f, c: f ? this.calc(f) : null };
      });
    if (!ags.some((a) => a.p.id === this.agenteId)) this.agenteId = ags.find((a) => a.f)?.p.id ?? ags[0]?.p.id ?? null;
    const ag = ags.find((a) => a.p.id === this.agenteId);
    trocarFilhos(
      el,
      h('h3', { class: 'insp-cab it-cab' }, 'MOCHILA / ITENS'),
      h(
        'div',
        { class: 'it-ags', role: 'tablist', 'aria-label': 'Agentes' },
        ...ags.map((a) =>
          h(
            'button',
            {
              class: `it-ag${a === ag ? ' on' : ''}`,
              type: 'button',
              // o elemento do agente (o tema da ficha): a cor e o sigilo da carta
              'data-tema': a.f?.tema ?? 'ordem',
              role: 'tab',
              'aria-selected': String(a === ag),
              title: a.p.name,
              onclick: () => {
                if (a === ag) return;
                sfx.paper();
                this.agenteId = a.p.id;
                this.sel = null;
                this.redesenhar();
              },
            },
            portraitCanvas(a.p.look, 52, { dir: 2, armed: !!a.p.armed, hurt: vitalConditions(a.p.vitals).machucado }),
            h('span', null, a.p.name.split(' ')[0]),
          ),
        ),
      ),
    );
    if (!ag) {
      el.append(h('p', { class: 'empty' }, 'Nenhum personagem nesta campanha.'));
      return;
    }
    if (!ag.f || !ag.c) {
      el.append(h('p', { class: 'empty' }, `${ag.p.name} não tem ficha: os itens dele ficam no cenário. Crie a ficha na aba FICHAS e ligue ao personagem.`));
      return;
    }
    this.desenharAgente(el, ag, ags, gm);
  }

  private redesenhar() {
    const u = this.ultimo;
    if (u) this.render(u.el, u.party, u.fichas, u.gm);
  }

  private desenharAgente(el: HTMLElement, a: Agente, ags: Agente[], gm: boolean) {
    const f = a.f!;
    const c = a.c!;
    const inv = f.ficha.inventario;
    if (this.sel !== null && !inv.some((it) => it.uid === this.sel)) this.sel = null;
    const naMao = inv.filter((it) => regras.lugarDoItem(it) === 'mao');
    const vestidos = inv.filter((it) => regras.lugarDoItem(it) === 'vestido');
    const mochila = inv.filter((it) => regras.lugarDoItem(it) === 'mochila');
    // carga e mãos
    const ratio = c.carga.espacos ? c.carga.usados / c.carga.espacos : 0;
    const maos = naMao.length
      ? lista(naMao.map((it) => regras.nomeDoItem(it) + (regras.maosDoItem(it) === 2 ? ' (as duas)' : '')))
      : 'livres';
    const avisos = c.problemas.filter((p) => p.onde === 'Mochila').slice(0, 2);
    el.append(
      h(
        'div',
        { class: 'it-card' },
        h('div', { class: 'it-foto' }, portraitCanvas(a.p.look, 132, { dir: 2, armed: !!a.p.armed, hurt: vitalConditions(a.p.vitals).machucado })),
        h(
          'div',
          { class: 'it-info' },
          h('b', { class: 'it-nome-ag' }, f.ficha.nome || a.p.name),
          h('div', { class: 'it-carga' }, h('span', null, 'Carga'), h('span', { class: 'it-num' }, `${fmt(c.carga.usados)} / ${c.carga.espacos}`)),
          h('div', { class: `it-barra${c.carga.sobrecarregado ? ' passou' : ratio >= 0.75 ? ' quase' : ''}`, role: 'meter', 'aria-valuenow': String(c.carga.usados), 'aria-valuemax': String(c.carga.espacos), 'aria-label': 'Carga' }, h('i', { style: `--w:${Math.min(100, ratio * 100)}%` })),
          h('div', { class: 'it-maos' }, h('span', null, 'Mãos:'), h('span', null, maos)),
          ...avisos.map((p) => h('div', { class: `it-aviso${p.severidade === 'erro' ? ' erro' : ''}` }, ic('alerta'), h('span', null, p.texto))),
        ),
      ),
      h(
        'div',
        { class: 'it-tipos' },
        ...TIPOS.map((t) => {
          const n = inv.filter(t.conta).reduce((s, it) => s + (it.qtd ?? 1), 0);
          return h('div', { class: `it-tipo${n ? '' : ' zero'}`, title: `${t.nome}: ${n}` }, h('span', { class: 'it-tipo-ic' }, t.icone()), h('span', null, t.nome), h('b', null, String(n)));
        }),
      ),
      h('h4', { class: 'insp-cab it-sec' }, 'EQUIPADO'),
      h(
        'div',
        { class: 'it-grade equipado' },
        ...naMao.map((it) => this.slot(a, it)),
        ...Array.from({ length: Math.max(0, regras.MAOS - regras.maosOcupadas(inv)) }, () => h('div', { class: 'it-slot vazio', title: 'Mão livre' }, h('span', { class: 'it-arte' }, arteOu(['/arte/icones/mao-livre.png'], ic('mao'))), h('span', { class: 'it-nome' }, 'Mão livre'))),
        ...vestidos.map((it) => this.slot(a, it)),
      ),
      h('h4', { class: 'insp-cab it-sec' }, 'MOCHILA'),
      h(
        'div',
        { class: 'it-grade' },
        ...mochila.map((it) => this.slot(a, it)),
        gm ? h('button', { class: 'it-slot mais', type: 'button', title: 'Adicionar item do catálogo', 'aria-label': 'Adicionar item do catálogo', onclick: () => this.adicionar(f) }, ic('mais')) : null,
      ),
      h('h4', { class: 'insp-cab it-sec' }, 'ITEM SELECIONADO'),
      this.detalhe(a, ags, gm),
    );
  }

  /**
   * Arte do item: a pintada da aba ITENS (itens/pintados/), depois o ícone da
   * FICHAS (itens/), e sem arte o desenho de linha. O item do cenário procura
   * pelo nome ("chave-do-arsenal") e, depois, pelo tipo ("tipo-chave").
   */
  private arteDoItem(it: regras.ItemFicha, icone: string) {
    return arteDoItem(it, icone, 'ic it-ic');
  }

  private slot(a: Agente, it: regras.ItemFicha) {
    const inf = infoItem(it, a.c);
    const lugar = regras.lugarDoItem(it);
    const on = this.sel === it.uid;
    return h(
      'button',
      {
        class: `it-slot${on ? ' on' : ''}${lugar === 'mao' ? ' mao' : ''}`,
        type: 'button',
        title: `${inf.nome} · ${inf.espacos} esp. · ${LUGAR[lugar]}`,
        'aria-pressed': String(on),
        onclick: () => {
          sfx.click();
          this.sel = on ? null : (it.uid ?? null);
          this.redesenhar();
        },
      },
      h('span', { class: 'it-arte' }, this.arteDoItem(it, inf.icone)),
      h('span', { class: 'it-nome' }, inf.nome),
      lugar === 'mochila' ? h('small', { class: 'it-qtd' }, `x${it.qtd ?? 1}`) : null,
    );
  }

  private detalhe(a: Agente, ags: Agente[], gm: boolean) {
    const f = a.f!;
    const it = f.ficha.inventario.find((x) => x.uid === this.sel);
    if (!it) return h('p', { class: 'empty it-vazio' }, 'Clique num item para ver e usar.');
    const inf = infoItem(it, a.c);
    const lugar = regras.lugarDoItem(it);
    const base = it.tipo === 'cena' ? undefined : (regras.baseDoItem(it) as { resumo?: string } | undefined);
    const resumo = it.descricao || base?.resumo || '';
    // como na referência: dois campos (o tipo e o quanto ocupa); embaixo, a categoria do livro, o lugar e a página
    const meta = [it.tipo === 'cena' ? 'achado na missão' : `categoria ${romano(inf.categoria)}${it.achado ? ' (achado)' : ''}`, LUGAR[lugar].toLowerCase(), inf.ref ? textoRef(inf.ref) : ''].filter(Boolean);
    const caixa = h(
      'div',
      { class: 'it-det' },
      h('button', { class: 'it-det-arte', type: 'button', title: 'Inspecionar', 'aria-label': `Inspecionar ${inf.nome}`, onclick: () => (sfx.paper(), this.inspecionar(it, inf, lugar)) }, this.arteDoItem(it, inf.icone)),
      h(
        'div',
        { class: 'it-det-txt' },
        h('b', null, inf.nome),
        resumo ? h('p', null, resumo) : null,
        it.tipo === 'arma' || it.tipo === 'protecao' ? h('p', { class: 'it-efeito' }, [inf.efeito, inf.obs].filter((x) => x && x !== '—').join(' · ')) : null,
        h(
          'div',
          { class: 'it-campos' },
          h('span', null, h('span', { class: 'it-rot' }, 'Tipo:'), ` ${inf.tipo}`),
          h('span', null, ic('peso'), h('span', { class: 'it-rot' }, 'Espaços:'), ` ${fmt(inf.espacos * (it.qtd ?? 1))}`),
        ),
        h('div', { class: 'it-meta' }, meta.join(' · ')),
      ),
    );
    if (!gm) return caixa;
    const outros = ags.filter((x) => x !== a && x.f);
    const enviar = (acao: AcaoMochila, extra: { para?: number; trocar?: boolean } = {}) => this.app.net.send({ t: 'mochila', fichaId: f.id, uid: it.uid!, acao, ...extra });
    const bt = (rotulo: string, icone: string, onclick: (e: MouseEvent) => void, extra = '', desligado = false) =>
      h('button', { class: `it-bt${extra}`, type: 'button', title: rotulo, disabled: desligado, onclick }, ic(icone), h('span', null, rotulo));
    const principal = this.acaoPrincipal(f, it, inf, lugar, enviar);
    const acoes = h(
      'div',
      { class: 'it-acoes' },
      bt(principal.rotulo, principal.icone, () => (sfx.click(), principal.fazer()), ' forte'),
      bt('Entregar para…', 'pessoa', (e) => this.abrirMenu(e.currentTarget as HTMLElement, outros.map((o) => ({ rotulo: o.f!.ficha.nome || o.p.name, fazer: () => enviar('entregar', { para: o.f!.id }) }))), '', !outros.length),
      bt('Mover', 'mover', (e) => this.abrirMenu(e.currentTarget as HTMLElement, this.opcoesMover(f, it, enviar))),
      // modificações e maldições (o motor diz o que cabe; o mestre passa por cima)
      it.tipo === 'cena' || it.tipo === 'amaldicoado' ? null : bt('Modificar', 'engrenagem', () => (sfx.click(), this.modificar(f, it))),
      bt('Descartar', 'lixo', async () => {
        sfx.click();
        if (await askNote(`LARGAR ${inf.nome.toUpperCase()}?`, `Fica no chão do cômodo, onde ${f.ficha.nome || a.p.name} está. Qualquer um pode pegar de volta.`, 'Largar no chão', true)) enviar('largar');
      }),
    );
    return h('div', { class: 'it-sel' }, caixa, acoes);
  }

  /** Modificações e maldições do item: liga e desliga cada uma, e o servidor guarda. */
  private modificar(f: FichaSalva, it: regras.ItemFicha) {
    const i = f.ficha.inventario.indexOf(it);
    const tem = [...(it.modificacoes ?? []).map((m) => `modificacao:${m}`), ...(it.maldicoes ?? []).map((m) => `maldicao:${m}`)];
    void escolher(
      {
        titulo: `Modificar: ${regras.nomeDoItem(it)}`,
        dica: 'Cada modificação sobe a categoria em I; a primeira maldição em II, as outras em I (LR p. 60 e 144).',
        qtd: 20,
        podeVazio: true,
        opcoes: () => opcoesMelhoria(f.ficha, i, 'todas', true),
        atual: () => tem,
        aplicar: (ids) => {
          for (const id of new Set([...tem, ...ids])) {
            const por = ids.includes(id);
            if (por === tem.includes(id)) continue;
            const [tipo, mid] = id.split(':') as ['modificacao' | 'maldicao', string];
            this.app.net.send({ t: 'mochilaMelhorar', fichaId: f.id, uid: it.uid!, tipo, id: mid, por });
          }
        },
      },
      () => {},
    );
  }

  /**
   * O botão vermelho faz o que o item pede: a arma vai para a mão (e aparece no
   * personagem), o documento abre, o consumível gasta, a roupa veste; o resto, inspeciona.
   */
  private acaoPrincipal(f: FichaSalva, it: regras.ItemFicha, inf: ReturnType<typeof infoItem>, lugar: regras.LugarItem, enviar: (acao: AcaoMochila, extra?: { trocar?: boolean }) => void): { rotulo: string; icone: string; fazer: () => void } {
    if (ehDocumento(it)) return { rotulo: 'Abrir', icone: 'documento', fazer: () => this.abrirDocumento(f, it, inf) };
    if (regras.consumivel(it)) return { rotulo: 'Usar', icone: 'engrenagem', fazer: () => enviar('usar') };
    if (regras.maosDoItem(it)) return lugar === 'mao' ? { rotulo: 'Guardar', icone: 'mochila', fazer: () => enviar('guardar') } : { rotulo: 'Empunhar', icone: 'mao', fazer: () => enviar('empunhar', { trocar: true }) };
    if (regras.vestivel(it)) return lugar === 'vestido' ? { rotulo: 'Tirar', icone: 'mochila', fazer: () => enviar('tirar') } : { rotulo: 'Vestir', icone: 'colete', fazer: () => enviar('vestir') };
    return { rotulo: 'Inspecionar', icone: 'lupa', fazer: () => this.inspecionar(it, inf, lugar) };
  }

  /** Lê o documento: o texto que o mestre escreveu, no papel da inspeção. */
  private abrirDocumento(f: FichaSalva, it: regras.ItemFicha, inf: ReturnType<typeof infoItem>) {
    sfx.paper();
    this.abrirItem({ titulo: inf.nome, rotulo: `${inf.tipo} · com ${f.ficha.nome}`, icone: lootIcon((it.tipoCena as LootKind) || 'document', 26), texto: it.descricao || 'Não há nada escrito que dê para ler.' });
  }

  /** O que o item é: tipo, categoria, espaços, números do livro e o texto do mestre. */
  private inspecionar(it: regras.ItemFicha, inf: ReturnType<typeof infoItem>, lugar: regras.LugarItem) {
    const base = it.tipo === 'cena' ? undefined : (regras.baseDoItem(it) as { resumo?: string; especial?: string[] } | undefined);
    const linhas: Node[] = [];
    const linha = (rot: string, txt: string) => txt && linhas.push(h('p', { class: 'dossier-linha' }, h('b', null, `${rot} `), txt));
    linha('Tipo:', inf.tipo);
    if (it.tipo !== 'cena') linha('Categoria:', `${romano(inf.categoria)}${it.achado ? ' (achado na missão: não ocupa vaga da patente)' : ''}`);
    linha('Espaços:', fmt(inf.espacos * (it.qtd ?? 1)));
    linha('Onde está:', LUGAR[lugar]);
    if (it.tipo === 'arma' || it.tipo === 'protecao') linha(it.tipo === 'arma' ? 'Ataque:' : 'Proteção:', [inf.efeito, inf.obs].filter((x) => x && x !== '—').join(' · '));
    if (base?.especial?.length) linha('Regras:', base.especial.join(' · '));
    if (inf.ref) linha('Livro:', textoRef(inf.ref));
    this.abrirItem({ titulo: inf.nome, rotulo: 'Item', icone: this.arteDoItem(it, inf.icone), texto: it.descricao || base?.resumo || '', linhas });
  }

  /** O que dá para fazer com o item: na mão, vestido ou guardado. */
  private opcoesMover(f: FichaSalva, it: regras.ItemFicha, enviar: (acao: AcaoMochila, extra?: { trocar?: boolean }) => void) {
    const lugar = regras.lugarDoItem(it);
    const out: { rotulo: string; fazer: () => void; dica?: string }[] = [];
    const maos = regras.maosDoItem(it);
    if (maos) {
      if (lugar === 'mao') out.push({ rotulo: 'Guardar na mochila', fazer: () => enviar('guardar') });
      else if (regras.MAOS - regras.maosOcupadas(f.ficha.inventario) >= maos) out.push({ rotulo: maos === 2 ? 'Empunhar (as duas mãos)' : 'Empunhar', fazer: () => enviar('empunhar') });
      else {
        // o que sai da mão: a mesma conta do servidor
        const inv = f.ficha.inventario;
        const r = regras.empunhar(inv, it.uid!, true);
        const sai = r.ok ? inv.filter((x) => regras.lugarDoItem(x) === 'mao' && x.uid !== it.uid && r.inventario.some((y) => y.uid === x.uid && regras.lugarDoItem(y) !== 'mao')) : [];
        out.push({ rotulo: 'Trocar e empunhar', dica: `Guarda ${lista(sai.map((x) => regras.nomeDoItem(x)))}`, fazer: () => enviar('empunhar', { trocar: true }) });
      }
    }
    if (regras.vestivel(it)) out.push(lugar === 'vestido' ? { rotulo: 'Tirar e guardar', fazer: () => enviar('tirar') } : { rotulo: 'Vestir', fazer: () => enviar('vestir') });
    if (!out.length) out.push({ rotulo: 'Fica na mochila', fazer: () => {}, dica: 'Não se empunha nem se veste.' });
    return out;
  }

  /** Menu pequeno embaixo do botão. */
  private abrirMenu(ancora: HTMLElement, opcoes: { rotulo: string; fazer: () => void; dica?: string }[]) {
    const ja = this.menu?.dataset.de === ancora.textContent;
    this.fecharMenu();
    if (ja || !opcoes.length) return;
    sfx.paper();
    const r = ancora.getBoundingClientRect();
    const menu = h(
      'div',
      { class: 'it-menu', role: 'menu', 'data-de': ancora.textContent ?? '' },
      ...opcoes.map((o) =>
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            onclick: () => {
              sfx.click();
              this.fecharMenu();
              o.fazer();
            },
          },
          h('span', null, o.rotulo),
          o.dica ? h('small', null, o.dica) : null,
        ),
      ),
    );
    menu.style.left = `${Math.round(r.left)}px`;
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.minWidth = `${Math.round(r.width)}px`;
    document.body.append(menu);
    // não sai da tela: abre para cima ou para a esquerda quando falta lugar
    const m = menu.getBoundingClientRect();
    if (m.bottom > innerHeight - 8) menu.style.top = `${Math.round(r.top - m.height - 4)}px`;
    if (m.right > innerWidth - 8) menu.style.left = `${Math.round(innerWidth - m.width - 8)}px`;
    this.menu = menu;
    const fora = (e: Event) => {
      if (!menu.contains(e.target as Node) && e.target !== ancora && !ancora.contains(e.target as Node)) this.fecharMenu();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && this.fecharMenu();
    setTimeout(() => {
      document.addEventListener('pointerdown', fora, true);
      document.addEventListener('keydown', esc, true);
    });
    menu.addEventListener('menufechou', () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', esc, true);
    });
  }

  private fecharMenu() {
    if (!this.menu) return;
    this.menu.dispatchEvent(new Event('menufechou'));
    this.menu.remove();
    this.menu = null;
  }

  /** "+": o catálogo do livro; cada escolha entra na mochila na hora (requisitada à Ordem). */
  private adicionar(f: FichaSalva) {
    abrirRequisicao({
      ficha: structuredClone(f.ficha),
      nome: f.ficha.nome,
      tema: f.tema,
      mestre: true,
      aoAdicionar: (it) => it.tipo !== 'cena' && this.app.net.send({ t: 'mochilaNova', fichaId: f.id, tipo: it.tipo, id: it.id, escolha: it.escolha }),
      aoFechar: () => {},
    });
  }
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
