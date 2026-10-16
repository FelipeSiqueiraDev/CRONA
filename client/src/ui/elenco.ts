import { combate, criaturaDoLivro, type CharacterDef, type Criatura, type Npc } from '@crona/shared';
import { drawPixelAvatar } from '../render/avatarPixel';
import type { App } from './app';
import { abrirBestiario } from './bestiario';
import { h } from './dom';
import { ic } from './icons';
import { sfx } from './sfx';
import './elenco.css';

/**
 * A janela ELENCO (16/10, o Felipe: "uma aba pra NPCs ... os monstros por aba de elemento com nome e VD e as versões em
 * sequência, tipo uma pokedex, e aí eu só clico em usar e boa"): quem o mestre puxa para a mesa, rápido.
 *
 * - NPCs: a gente da história (shared/src/npcs.ts), com a arte das 8 direções; "Usar" põe um na cena.
 * - Ameaças: as 74 do livro (LR p. 182–289), por elemento (e as mundanas: animais e pessoas), na ordem do livro, com as
 *   versões juntas (Zumbi de Sangue › Bestial › Colossal). "Usar" põe uma peça na porta da cena; a criatura entra no
 *   bestiário sozinha na primeira vez (a ficha do livro), e as do mestre (aparências, PV) continuam valendo.
 * - Clicar no card mostra o detalhe ao lado (quantas, qual aparência, a ficha); "Usar" fecha a janela (com Shift, fica).
 */

type Aba = 'npcs' | 'ameacas';
type Grupo = 'sangue' | 'morte' | 'conhecimento' | 'energia' | 'medo' | 'mundanas' | 'mestre';
const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: 'sangue', nome: 'Sangue' },
  { id: 'morte', nome: 'Morte' },
  { id: 'conhecimento', nome: 'Conhecimento' },
  { id: 'energia', nome: 'Energia' },
  { id: 'medo', nome: 'Medo' },
  { id: 'mundanas', nome: 'Mundanas' },
  { id: 'mestre', nome: 'Do mestre' },
];

/** Uma ameaça na lista: do livro (com ou sem criatura no bestiário) ou só do mestre. */
interface Entrada {
  chave: string;
  nome: string;
  vd?: number;
  elemento?: string;
  outros?: string[];
  tipo: string;
  pagina?: number;
  livroId?: string;
  criatura?: Criatura;
}

const LEMBRA = 'crona.elenco';
function lembrado(): { aba?: Aba; grupo?: Grupo } {
  try {
    return JSON.parse(localStorage.getItem(LEMBRA) ?? '{}');
  } catch {
    return {};
  }
}
function lembrar(v: { aba: Aba; grupo: Grupo }) {
  try {
    localStorage.setItem(LEMBRA, JSON.stringify(v));
  } catch {
    /* sem armazenamento: abre na primeira aba */
  }
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function abrirElenco(app: App) {
  const mem = lembrado();
  let aba: Aba = mem.aba ?? 'npcs';
  let grupo: Grupo = mem.grupo ?? 'sangue';
  let sel: string | null = null;
  let busca = '';
  let quantidade = 1;
  let aparencia = 'variadas';

  // ---------- a janela do HUD ----------
  const fechar = () => {
    document.removeEventListener('keydown', tecla, true);
    app.off('bestiario', desenhar);
    app.off('characters', desenhar);
    fundo.classList.add('saindo');
    setTimeout(() => fundo.remove(), 140);
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    fechar();
  };
  const abas = h('nav', { class: 'el-abas', role: 'tablist' });
  const campoBusca = h('input', { class: 'el-busca', type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar no elenco' }) as HTMLInputElement;
  campoBusca.addEventListener('input', () => ((busca = semAcento(campoBusca.value.trim())), desenhar()));
  const chips = h('div', { class: 'el-chips' });
  const grade = h('div', { class: 'el-grade' });
  const detalhe = h('aside', { class: 'el-detalhe' });
  const caixa = h(
    'section',
    { class: 'mm-janela el-janela', role: 'dialog', 'aria-label': 'Elenco' },
    h(
      'header',
      null,
      ic('pessoa'),
      h('h3', null, 'Elenco'),
      campoBusca,
      h('button', { class: 'mm-bt', type: 'button', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: () => fechar() }, ic('fechar')),
    ),
    abas,
    chips,
    h('div', { class: 'el-corpo' }, grade, detalhe),
  );
  const fundo = h('div', { class: 'mm-janela-fundo el-fundo' }, caixa);
  fundo.addEventListener('pointerdown', (e) => e.target === fundo && fechar());
  document.addEventListener('keydown', tecla, true);
  document.body.append(fundo);

  // ---------- a arte de cada um ----------
  const charDaArte = (arte?: string): CharacterDef | undefined => (arte ? app.state.characters.find((ch) => ch.sheet.includes(`/personagens/${arte}/`)) : undefined);
  /** A figura do card: a pose de frente (as 8 direções) ou o retrato; sem arte, o boneco de pixel; sem nada, o selo do elemento. */
  const figura = (o: { arte?: string; look?: Npc['look']; elemento?: string; nome: string; livroId?: string }) => {
    const ch = charDaArte(o.arte);
    const pose = ch?.poses?.desarmado?.s ?? ch?.poses?.desarmado?.sw;
    const retrato = ch?.portraits?.desarmado?.open;
    const selo = () => h('span', { class: `el-selo el-${o.elemento ?? 'mundanas'}` }, o.nome.replace(/^(O|A) /, '').slice(0, 1));
    // a ameaça: o retrato vem antes (o da arte dela, ou o pintado pelo Códex em arte/ameacas/<id>.png); sem nenhum, o selo
    if (o.livroId || (retrato && !o.look)) {
      if (retrato) return h('img', { class: 'el-retrato', src: retrato, alt: o.nome, decoding: 'async', loading: 'lazy' });
      const img = h('img', { class: 'el-retrato', src: `/arte/ameacas/${o.livroId}.png`, alt: o.nome, decoding: 'async', loading: 'lazy' }) as HTMLImageElement;
      img.addEventListener('error', () => img.replaceWith(pose ? h('img', { class: 'el-pose', src: pose, alt: o.nome }) : selo()), { once: true });
      return img;
    }
    if (pose) return h('img', { class: 'el-pose', src: pose, alt: o.nome, decoding: 'async', loading: 'lazy' });
    if (retrato) return h('img', { class: 'el-retrato', src: retrato, alt: o.nome, decoding: 'async', loading: 'lazy' });
    if (o.look) {
      const cv = h('canvas', { class: 'el-pixel', width: 72, height: 96 }) as HTMLCanvasElement;
      const g = cv.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      drawPixelAvatar(g, { ...o.look, charId: null }, 36, 92, 2, 2, { pose: 'stand', frame: 0, wave: false, dance: false, blink: false });
      return cv;
    }
    return selo();
  };

  // ---------- as ameaças: do livro, na ordem dele, com as versões juntas ----------
  const entradas = (): Entrada[] => {
    const cs = app.state.bestiario;
    const out: Entrada[] = [];
    for (const a of combate.AMEACAS_LIVRO)
      out.push({ chave: `livro:${a.id}`, nome: a.nome, vd: a.vd, elemento: a.elemento, outros: a.outrosElementos, tipo: a.tipo, pagina: a.pagina, livroId: a.id, criatura: cs.find((c) => c.ficha.livro === a.id) });
    // as do mestre que não vieram do livro (e as cópias de uma do livro com outro nome)
    for (const c of cs)
      if (!out.some((e) => e.criatura === c)) out.push({ chave: `cr:${c.id}`, nome: c.nome, vd: c.ficha.vd, elemento: c.ficha.elemento, tipo: c.ficha.tipo, criatura: c });
    return out;
  };
  /** As famílias: a primeira de cada nome e as versões dela em seguida (o nome dela + mais alguma coisa). */
  const familias = (lista: Entrada[]): Entrada[][] => {
    const fams: Entrada[][] = [];
    for (const e of lista) {
      const f = fams.find((x) => e.nome.startsWith(`${x[0].nome} `) && x[0].livroId && e.livroId);
      if (f) f.push(e);
      else fams.push([e]);
    }
    return fams;
  };
  const grupoDe = (e: Entrada): Grupo => (!e.livroId ? 'mestre' : ((e.elemento as Grupo | undefined) ?? 'mundanas'));

  const colocarAmeaca = (e: Entrada, n: number, ap: string) => {
    let c = e.criatura;
    if (!c && e.livroId) {
      let uid = e.livroId;
      for (let k = 2; app.state.bestiario.some((x) => x.id === uid); k++) uid = `${e.livroId}-${k}`;
      c = criaturaDoLivro(e.livroId, uid) ?? undefined;
      if (!c) return;
      app.net.send({ t: 'criaturaSalvar', criatura: c });
    }
    if (c) app.net.send({ t: 'criaturaColocar', criaturaId: c.id, aparencia: ap, quantidade: n });
  };
  const colocarNpc = (n: Npc) => app.net.send({ t: 'npcColocar', npcId: n.id });

  /** O "Usar": põe na mesa e fecha (com Shift, a janela fica aberta para pôr mais). */
  const usar = (ev: Event, faz: () => void) => {
    ev.stopPropagation();
    sfx.click();
    faz();
    if (!(ev as MouseEvent).shiftKey) fechar();
  };

  const card = (o: { chave: string; nome: string; linha: string; figura: Node; usar: (ev: Event) => void; cls?: string }) =>
    h(
      'article',
      {
        class: `el-card${sel === o.chave ? ' escolhido' : ''} ${o.cls ?? ''}`,
        tabindex: '0',
        onclick: () => ((sel = o.chave), (aparencia = 'variadas'), (quantidade = 1), sfx.click(), desenhar()),
        onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && ((sel = o.chave), desenhar()),
      },
      h('span', { class: 'el-quadro' }, o.figura),
      h('b', { class: 'el-nome' }, o.nome),
      h('small', { class: 'el-linha' }, o.linha),
      h('button', { class: 'el-usar', type: 'button', title: 'Pôr na mesa (Shift: sem fechar a janela)', onclick: o.usar }, 'Usar'),
    );

  const linhaAmeaca = (e: Entrada) => [e.vd !== undefined ? `VD ${e.vd}` : null, e.criatura && e.criatura.aparencias.length > 1 ? `${e.criatura.aparencias.length} caras` : null, e.tipo !== 'Criatura' ? e.tipo : null].filter(Boolean).join(' · ');

  // ---------- desenho ----------
  const desenhar = () => {
    lembrar({ aba, grupo });
    const npcs = app.state.npcs;
    const todas = entradas();
    abas.replaceChildren(
      ...([
        ['npcs', `NPCs`, npcs.length],
        ['ameacas', 'Ameaças', todas.length],
      ] as const).map(([id, nome, n]) =>
        h('button', { class: `el-aba${aba === id ? ' ativa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(aba === id), onclick: () => ((aba = id), (sel = null), sfx.click(), desenhar()) }, nome, h('small', null, String(n))),
      ),
    );
    if (aba === 'npcs') {
      chips.replaceChildren();
      const lista = npcs.filter((n) => !busca || semAcento(n.nome).includes(busca) || semAcento(n.nota ?? '').includes(busca));
      grade.replaceChildren(
        ...lista.map((n) => card({ chave: `npc:${n.id}`, nome: n.nome, linha: n.nota ?? (charDaArte(n.arte) ? '8 direções' : 'boneco de pixel'), figura: figura({ ...n }), usar: (ev) => usar(ev, () => colocarNpc(n)) })),
        h('article', { class: `el-card el-novo${sel === 'novo-npc' ? ' escolhido' : ''}`, tabindex: '0', onclick: () => ((sel = 'novo-npc'), sfx.click(), desenhar()) }, h('span', { class: 'el-quadro' }, ic('mais')), h('b', { class: 'el-nome' }, 'Novo NPC'), h('small', { class: 'el-linha' }, 'nome e quem é')),
      );
      const n = npcs.find((x) => `npc:${x.id}` === sel);
      detalhe.replaceChildren(...(sel === 'novo-npc' ? detalheNovoNpc() : n ? detalheNpc(n) : [h('p', { class: 'el-vazio' }, 'Escolha um NPC para ver; "Usar" põe ele na porta da cena.')]));
      return;
    }
    // ameaças: as famílias (a primeira e as versões) ficam juntas no grupo da primeira (a Degolificada é de Medo, e as
    // versões dela, de cada elemento, vêm com ela); a busca passa por todos
    const fams = familias(todas);
    const porGrupo = new Map<Grupo, Entrada[][]>();
    for (const f of fams) {
      const g = grupoDe(f[0]);
      porGrupo.set(g, [...(porGrupo.get(g) ?? []), f]);
    }
    chips.replaceChildren(
      ...GRUPOS.filter((g) => porGrupo.has(g.id)).map((g) =>
        h('button', { class: `el-chip el-${g.id}${!busca && grupo === g.id ? ' ativa' : ''}`, type: 'button', onclick: () => ((grupo = g.id), (busca = ''), (campoBusca.value = ''), (sel = null), sfx.click(), desenhar()) }, h('i', null), g.nome, h('small', null, String(porGrupo.get(g.id)!.flat().length))),
      ),
    );
    const visiveis = busca ? fams.filter((f) => f.some((e) => semAcento(e.nome).includes(busca))) : (porGrupo.get(grupo) ?? []);
    grade.replaceChildren(
      ...visiveis.map((f) =>
        h(
          'div',
          { class: `el-familia${f.length > 1 ? ' versoes' : ''}` },
          ...f.flatMap((e, i) => [
            i > 0 ? h('span', { class: 'el-seta', 'aria-hidden': 'true' }, '›') : null,
            card({ chave: e.chave, nome: i > 0 ? e.nome.slice(f[0].nome.length).trim() || e.nome : e.nome, linha: linhaAmeaca(e), figura: figura({ arte: e.criatura?.aparencias[0]?.arte, elemento: e.elemento, nome: e.nome, livroId: e.livroId }), usar: (ev) => usar(ev, () => colocarAmeaca(e, 1, 'variadas')), cls: `el-de-${e.elemento ?? 'mundanas'}` }),
          ]),
        ),
      ),
    );
    if (!visiveis.length) grade.append(h('p', { class: 'el-vazio' }, 'Nada com esse nome.'));
    const e = todas.find((x) => x.chave === sel);
    detalhe.replaceChildren(...(e ? detalheAmeaca(e) : [h('p', { class: 'el-vazio' }, 'Escolha uma ameaça para ver a ficha, as caras e quantas pôr; "Usar" põe uma na porta da cena.')]));
  };

  // ---------- o detalhe ao lado ----------
  const detalheNpc = (n: Npc): Node[] => [
    h('div', { class: 'el-d-figura' }, figura({ ...n })),
    h('h4', null, n.nome),
    h('label', { class: 'el-d-campo' }, h('small', null, 'Quem é'), h('input', { value: n.nota ?? '', maxlength: '120', placeholder: 'o irmão da Catarina, o dono do bar…', onchange: (ev: Event) => app.net.send({ t: 'npcSalvar', npc: { ...n, nota: (ev.target as HTMLInputElement).value } }) })),
    h('small', { class: 'el-d-info' }, charDaArte(n.arte) ? 'Arte nas 8 direções (anda deslizando, como os agentes).' : n.arte ? 'A arte ainda não chegou: entra como boneco de pixel.' : 'Sem arte: entra como boneco de pixel.'),
    h('div', { class: 'el-d-acoes' }, h('button', { class: 'el-usar grande', type: 'button', onclick: (ev: Event) => usar(ev, () => colocarNpc(n)) }, 'Usar'), h('button', { class: 'el-apagar', type: 'button', title: 'Tirar do elenco (as peças já em campo ficam)', onclick: () => confirm(`Tirar ${n.nome} do elenco? As peças em campo ficam.`) && (app.net.send({ t: 'npcApagar', id: n.id }), (sel = null)) }, ic('lixo'))),
  ];

  const detalheNovoNpc = (): Node[] => {
    const nome = h('input', { maxlength: '40', placeholder: 'Nome do NPC' }) as HTMLInputElement;
    const nota = h('input', { maxlength: '120', placeholder: 'Quem é (opcional)' }) as HTMLInputElement;
    // a arte: uma pasta de personagem que ninguém do elenco usa (as que o Claude prepara pelo Códex)
    const usadas = new Set([...app.state.npcs.map((x) => x.arte), ...app.state.bestiario.flatMap((c) => c.aparencias.map((a) => a.arte))].filter(Boolean));
    const pastas = app.state.characters
      .map((ch) => /\/personagens\/([a-z0-9-]+)\//.exec(ch.sheet)?.[1])
      .filter((p): p is string => !!p && !usadas.has(p) && !['tepes', 'catarina', 'alosi', 'cora-falcao'].includes(p));
    const arte = h('select', null, h('option', { value: '' }, 'Sem arte (boneco de pixel)'), ...pastas.map((p) => h('option', { value: p }, p))) as HTMLSelectElement;
    const criar = () => {
      if (!nome.value.trim()) return nome.focus();
      app.net.send({ t: 'npcSalvar', npc: { id: '', nome: nome.value.trim(), nota: nota.value.trim() || undefined, arte: arte.value || undefined, look: { skin: '#e0b896', hair: '#3a2a1c', hairStyle: 0, top: '#3a3a42', pants: '#26262c', shoes: '#18161a', outfit: 0, extra: 0, charId: null } } });
      sel = null;
      sfx.click();
    };
    nome.addEventListener('keydown', (e) => e.key === 'Enter' && criar());
    return [
      h('h4', null, 'Novo NPC'),
      h('label', { class: 'el-d-campo' }, h('small', null, 'Nome'), nome),
      h('label', { class: 'el-d-campo' }, h('small', null, 'Quem é'), nota),
      h('label', { class: 'el-d-campo' }, h('small', null, 'Arte'), arte),
      h('small', { class: 'el-d-info' }, 'A arte das 8 direções vem pelo Códex: mande a imagem do personagem para o Claude, e ela aparece aqui.'),
      h('div', { class: 'el-d-acoes' }, h('button', { class: 'el-usar grande', type: 'button', onclick: criar }, 'Criar')),
    ];
  };

  const detalheAmeaca = (e: Entrada): Node[] => {
    const c = e.criatura;
    const f = c?.ficha;
    const livro = e.livroId ? combate.AMEACAS_LIVRO.find((a) => a.id === e.livroId) : undefined;
    const elementos = [e.elemento, ...(e.outros ?? [])].filter(Boolean) as string[];
    if (c && aparencia !== 'variadas' && !c.aparencias.some((a) => a.id === aparencia)) aparencia = 'variadas';
    const dado = (rot: string, val: string) => h('span', { class: 'el-d-dado' }, h('small', null, rot), h('b', null, val));
    const nos: (Node | null)[] = [
      h('div', { class: 'el-d-figura' }, figura({ arte: c?.aparencias[0]?.arte, elemento: e.elemento, nome: e.nome, livroId: e.livroId })),
      h('h4', null, e.nome),
      h('div', { class: 'el-d-elementos' }, ...elementos.map((x) => h('span', { class: `el-tag el-${x}` }, combate.NOME_ELEMENTO[x as keyof typeof combate.NOME_ELEMENTO] ?? x)), h('span', { class: 'el-tag' }, e.tipo)),
      h('div', { class: 'el-d-dados' }, dado('VD', String(e.vd ?? '—')), dado('PV', String(c?.pv ?? livro?.pv ?? '—')), dado('Defesa', String(f?.defesa ?? livro?.defesa ?? '—')), e.pagina ? dado('Livro', `p. ${e.pagina}`) : null),
      c && c.aparencias.length > 1
        ? h(
            'div',
            { class: 'el-d-caras' },
            h('small', null, 'Aparência'),
            ...[{ id: 'variadas', nome: 'Variadas' }, ...c.aparencias].map((a) => h('button', { class: `el-cara${aparencia === a.id ? ' ativa' : ''}`, type: 'button', onclick: () => ((aparencia = a.id), desenhar()) }, a.nome)),
          )
        : null,
      h(
        'div',
        { class: 'el-d-qtd' },
        h('small', null, 'Quantas'),
        h('button', { type: 'button', 'aria-label': 'Menos', onclick: () => ((quantidade = Math.max(1, quantidade - 1)), desenhar()) }, '−'),
        h('b', null, String(quantidade)),
        h('button', { type: 'button', 'aria-label': 'Mais', onclick: () => ((quantidade = Math.min(20, quantidade + 1)), desenhar()) }, '+'),
      ),
      h(
        'div',
        { class: 'el-d-acoes' },
        h('button', { class: 'el-usar grande', type: 'button', onclick: (ev: Event) => usar(ev, () => colocarAmeaca(e, quantidade, aparencia)) }, quantidade > 1 ? `Usar ${quantidade}` : 'Usar'),
        c ? h('button', { class: 'el-editar', type: 'button', title: 'Editar as caras, os PV e a ficha (o bestiário)', onclick: () => (fechar(), abrirBestiario(app, c.id)) }, ic('lapis')) : null,
      ),
      h('small', { class: 'el-d-info' }, c ? 'Cada peça tem os próprios PV; os ataques saem da mesma ficha.' : 'Ainda não foi usada: na primeira vez, entra com a ficha do livro.'),
    ];
    return nos.filter((x): x is Node => !!x);
  };

  app.on('bestiario', desenhar);
  app.on('characters', desenhar);
  app.net.send({ t: 'bestiario' });
  desenhar();
  campoBusca.focus();
}
