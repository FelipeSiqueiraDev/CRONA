import { combate, criaturaDoLivro, GRUPO_SEM, GRUPOS_NPC_PADRAO, grupoDoNpc, gruposDoElenco, type CharacterDef, type Criatura, type MarcadoNoJogo, type Npc } from '@crona/shared';
import { fundoDoElemento } from './elencoFundo';
import { confirmar } from './fichaModal';
import { caberNumaLinha } from './jogador';
import { drawPixelAvatar } from '../render/avatarPixel';
import type { App } from './app';
import { abrirBestiario } from './bestiario';
import { h } from './dom';
import { arteCarregada, atualizarArte, ic, type NomeIcone } from './icons';
import { sfx } from './sfx';
import './elenco.css';

/**
 * A janela ELENCO (16/10, o Felipe: "uma aba pra NPCs ... os monstros por aba de elemento com nome e VD e as versões em
 * sequência, tipo uma pokedex, e aí eu só clico em usar e boa"): quem o mestre puxa para a mesa, rápido.
 *
 * - NPCs: a gente da história (shared/src/npcs.ts), com a arte das 8 direções; "Usar" põe um na cena.
 * - Ameaças: as 74 do livro (LR p. 182–289), por elemento (e as mundanas: animais e pessoas), com as versões em
 *   seguida da primeira (Zumbi de Sangue, Zumbi de Sangue Bestial, Zumbi de Sangue Colossal). "Usar" põe uma peça na porta da cena; a criatura entra no
 *   bestiário sozinha na primeira vez (a ficha do livro), e as do mestre (aparências, PV) continuam valendo.
 * - Clicar no card mostra o detalhe ao lado (quantas, qual aparência, a ficha); "Usar" fecha a janela (com Shift, fica).
 * - Sub-abas que abrem e fecham (17/10, o Felipe): os NPCs por grupo e as ameaças por elemento, da de VD mais baixo
 *   para a mais alta. O que fica aberto é lembrado no navegador. Os grupos ficam no servidor, na ordem (`npcGrupos`:
 *   Ordo Realitas, Lotus Branca, Panacea e um por cidade), mesmo vazios; o mestre escolhe o grupo de cada NPC numa
 *   lista e cria grupo novo nela ("Criar novo grupo").
 * - O card do NPC mostra a imagem do Felipe que deu origem a ele (`arte/personagens/<arte>/foto.jpg`), no lugar da pose
 *   do tabuleiro (17/10, o Felipe: "ao invés dos bonequinhos ali pra fazer escolha, a foto deles"), no recorte do rosto
 *   (`rosto.jpg`, os olhos no meio); sem foto, a pose.
 */

type Aba = 'marcados' | 'npcs' | 'ameacas';
type Grupo = 'sangue' | 'morte' | 'conhecimento' | 'energia' | 'medo' | 'mundanas' | 'mestre';
// o ícone de cada elemento (17/10, o Felipe: "iconezinhos nas abas de grupo"): ícones próprios do jogo, nunca o
// símbolo oficial do elemento
const GRUPOS: { id: Grupo; nome: string; icone: NomeIcone }[] = [
  { id: 'sangue', nome: 'Sangue', icone: 'gota' },
  { id: 'morte', nome: 'Morte', icone: 'espiral' },
  { id: 'conhecimento', nome: 'Conhecimento', icone: 'olho' },
  { id: 'energia', nome: 'Energia', icone: 'raio' },
  { id: 'medo', nome: 'Medo', icone: 'fantasma' },
  { id: 'mundanas', nome: 'Mundanas', icone: 'pata' },
  { id: 'mestre', nome: 'Do mestre', icone: 'pena' },
];
/** O ícone de cada grupo de NPC: os que o jogo traz e, para o grupo novo, a bandeira. */
const ICONE_GRUPO_NPC: Record<string, NomeIcone> = {
  'Ordo Realitas': 'escudoEstrela',
  'Lotus Branca': 'lua',
  Panacea: 'frasco',
  Tiradentes: 'pino',
  'Igarapé': 'pino',
  'Santo Berço': 'pino',
  'Santa Amália': 'pino',
  'Fazenda Olhos de Águia': 'mapa',
  'Novos (sem nome)': 'pessoa',
  'Do mestre': 'pena',
};
const iconeDoGrupo = (g: string): NomeIcone => ICONE_GRUPO_NPC[g] ?? 'bandeira';

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
/** O que o navegador lembra: a aba, os grupos de NPC fechados (abrem por padrão) e os elementos abertos (fecham). */
interface Lembrado {
  aba?: Aba;
  npcsFechados?: string[];
  ameacasAbertas?: string[];
}
function lembrado(): Lembrado {
  try {
    return JSON.parse(localStorage.getItem(LEMBRA) ?? '{}');
  } catch {
    return {};
  }
}
function lembrar(v: Lembrado) {
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
  const npcsFechados = new Set(mem.npcsFechados ?? []);
  /** os grupos vazios que o mestre abriu (começam fechados; não ficam lembrados) */
  const vaziosAbertos = new Set<string>();
  /** o que já foi escrito no "Novo NPC" (o servidor manda o elenco de novo a cada mudança e a tela se refaz) */
  const rascunho = { nome: '', nota: '', grupo: undefined as string | undefined, arte: '' };
  /** o campo do "Novo grupo" (no alto, na aba dos NPCs) está aberto */
  let criandoGrupo = false;
  const ameacasAbertas = new Set(mem.ameacasAbertas ?? ['sangue']);
  let arquivos: Set<string> | null = null;
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
  /**
   * Já tem peça para pôr no tabuleiro? (17/10, o Felipe: "deixa marcado quais a gente já tem peça e quais ainda não, uma
   * fitinha vermelha nos que não tem"): as 8 direções do personagem na pasta da arte. Antes de a lista da arte chegar,
   * ninguém leva a fita (não pisca vermelha à toa).
   */
  const temPeca = (arte?: string) => !!arte && !!arquivos?.has(`/arte/personagens/${arte}/tabuleiro-32bits/idle-desarmado-s.png`);
  const semPeca = (...artes: (string | undefined)[]) => arquivos !== null && !artes.some(temPeca);
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

  /**
   * O card (17/10, o Felipe: "nem parece que é o CRONA"): a carta pintada dos agentes (a moldura das cartas do MAPA), a
   * figura na janela dela com o nome por cima, num degradê preto que some para cima (para ler bem); a plaquinha de couro
   * inteira da carta é o botão Usar. Sem linha embaixo (a nota fica no detalhe). `duasLinhas` põe o nome em cima e o
   * sobrenome embaixo (os NPCs).
   */
  /** O portador de relíquia que já está em campo (17/10: como os NPCs, apagado e "Em cena", sem etiqueta). */
  const emCampoReliquia = (e: Entrada) => !!e.livroId && combate.ehPortadorDeReliquia(e.livroId) && app.state.reliquiasEmCampo.includes(e.livroId);
  const card = (o: { chave: string; nome: string; linha: string; figura: Node; usar: (ev: Event) => void; cls?: string; duasLinhas?: boolean; emCena?: boolean; semPeca?: boolean }) => {
    const [primeiro, ...resto] = o.nome.split(' ');
    const nome = o.duasLinhas ? [h('span', null, primeiro), h('span', null, resto.join(' ') || ' ')] : [o.nome];
    return h(
      'article',
      {
        class: `el-card${sel === o.chave ? ' escolhido' : ''}${o.emCena ? ' em-cena' : ''}${o.semPeca ? ' sem-peca' : ''} ${o.cls ?? ''}`,
        tabindex: '0',
        onclick: () => ((sel = o.chave), (aparencia = 'variadas'), (quantidade = 1), sfx.click(), desenhar()),
        onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && ((sel = o.chave), desenhar()),
      },
      h(
        'span',
        { class: 'el-carta' },
        h('span', { class: 'el-quadro' }, o.figura),
        o.semPeca ? h('span', { class: 'el-fita', title: 'Ainda sem peça no tabuleiro: a arte nas 8 direções não chegou (entra como boneco de pixel)' }, h('span', null, 'sem peça')) : null,
        h('b', { class: `el-nome${o.duasLinhas ? ' duas' : ''}` }, ...nome),
        // o NPC já em cena (todo NPC é único): a plaquinha diz "Em cena" e não põe outro
        o.emCena
          ? h('span', { class: 'el-placa em-cena', title: 'Já está em alguma cena desta campanha' }, h('span', null, 'Em cena'))
          : h('button', { class: 'el-placa', type: 'button', title: o.linha ? `${o.linha} · pôr na mesa (Shift: sem fechar a janela)` : 'Pôr na mesa (Shift: sem fechar a janela)', onclick: o.usar }, h('span', null, 'Usar')),
      ),
    );
  };

  /** Um botão do alto (Novo grupo, Novo NPC, Nova ameaça): o botão de borda do HUD, com o + de ouro. */
  const botaoTopo = (rotulo: string, faz: () => void, ativo = false, titulo?: string) =>
    h('button', { class: `el-topo-bt${ativo ? ' ativo' : ''}`, type: 'button', title: titulo ?? rotulo, onclick: () => (sfx.click(), faz()) }, h('b', null, '+'), rotulo);
  /** O "Novo grupo": o botão e, aberto, o campo do nome logo embaixo (Enter cria; Esc fecha). */
  const novoGrupo = () => {
    const campo = h('input', { class: 'el-sel-campo', maxlength: '40', placeholder: 'Nome do grupo' }) as HTMLInputElement;
    const criar = () => {
      const g = campo.value.replace(/\s+/g, ' ').trim();
      if (!g) return campo.focus();
      app.net.send({ t: 'npcGrupoCriar', nome: g });
      criandoGrupo = false;
      sfx.click();
      desenhar();
    };
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') criar();
      if (e.key === 'Escape') (e.stopPropagation(), (criandoGrupo = false), desenhar());
    });
    if (criandoGrupo) setTimeout(() => campo.focus());
    return h(
      'div',
      { class: 'el-topo-grupo' },
      botaoTopo('Novo grupo', () => ((criandoGrupo = !criandoGrupo), desenhar()), criandoGrupo),
      criandoGrupo ? h('div', { class: 'el-topo-pop' }, campo, h('button', { class: 'el-sel-ok', type: 'button', title: 'Criar o grupo', onclick: criar }, '✓')) : null,
    );
  };

  /** Uma sub-aba que abre e fecha: o cabeçalho (seta, cor, nome, quantos) e, aberta, a grade dela. */
  const secao = (o: { nome: string; n: number; cls?: string; icone: NomeIcone; aberta: boolean; alternar: () => void; filhos: Node[]; apagar?: () => void }) =>
    h(
      'section',
      { class: `el-secao ${o.cls ?? ''}${o.aberta ? ' aberta' : ''}` },
      h(
        'button',
        { class: 'el-secao-cab', type: 'button', 'aria-expanded': String(o.aberta), onclick: () => (o.alternar(), sfx.click(), desenhar()) },
        h('span', { class: 'el-secao-seta', 'aria-hidden': 'true' }, o.aberta ? '▾' : '▸'),
        h('span', { class: 'el-secao-ic', 'aria-hidden': 'true' }, ic(o.icone)),
        o.nome,
        h('small', null, String(o.n)),
      ),
      // o grupo criado pelo mestre tem a lixeira ao lado do número (o cabeçalho é um botão: ela fica por cima, à parte)
      o.apagar ? h('button', { class: 'el-secao-apagar', type: 'button', title: 'Excluir o grupo', 'aria-label': `Excluir o grupo ${o.nome}`, onclick: o.apagar }, ic('lixo')) : null,
      o.aberta ? h('div', { class: 'el-secao-grade' }, ...o.filhos) : null,
    );
  /** Exclui um grupo criado pelo mestre, depois de perguntar (os NPCs dele voltam para o grupo de antes). */
  const apagarGrupo = (g: string, n: number) => () =>
    void confirmar(
      'Excluir grupo',
      n ? `Excluir o grupo "${g}"? ${n === 1 ? 'O NPC dele volta' : `Os ${n} NPCs dele voltam`} para o grupo de antes (ou "Do mestre"); nenhum NPC é apagado.` : `Excluir o grupo "${g}"? Ele está vazio.`,
      'Excluir',
      true,
    ).then((sim) => sim && (app.net.send({ t: 'npcGrupoApagar', nome: g }), sfx.click()));
  const alterna = (conj: Set<string>, k: string) => () => void (conj.has(k) ? conj.delete(k) : conj.add(k));
  /** O menor VD de uma família (as versões vêm depois da primeira); sem VD, no fim. */
  const vdDa = (f: Entrada[]) => Math.min(...f.map((e) => e.vd ?? 999));

  const linhaAmeaca = (e: Entrada) => [e.vd !== undefined ? `VD ${e.vd}` : null, e.criatura && e.criatura.aparencias.length > 1 ? `${e.criatura.aparencias.length} caras` : null, e.tipo !== 'Criatura' ? e.tipo : null].filter(Boolean).join(' · ');

  // ---------- desenho ----------
  const desenhar = () => {
    lembrar({ aba, npcsFechados: [...npcsFechados], ameacasAbertas: [...ameacasAbertas] });
    const npcs = app.state.npcs;
    const todas = entradas();
    abas.replaceChildren(
      ...([
        ['marcados', 'Marcados', app.state.marcados.length],
        ['npcs', `NPCs`, npcs.length],
        ['ameacas', 'Ameaças', todas.length],
      ] as const).map(([id, nome, n]) =>
        h('button', { class: `el-aba${aba === id ? ' ativa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(aba === id), onclick: () => ((aba = id), (sel = null), (criandoGrupo = false), sfx.click(), desenhar()) }, nome, h('small', null, String(n))),
      ),
      // os botões de criar, no alto à direita, em cima do detalhe (17/10, o Felipe: "poderiam ficar ali")
      h('div', { class: 'el-topo-acoes' }, ...(aba === 'npcs' ? [novoGrupo(), botaoTopo('Novo NPC', () => ((sel = 'novo-npc'), (criandoGrupo = false), desenhar()), sel === 'novo-npc')] : [botaoTopo('Nova ameaça', () => (fechar(), abrirBestiario(app)), false, 'Abre o bestiário: uma ameaça nova a partir do livro, com as caras e a ficha')])),
    );
    if (aba === 'marcados') {
      // os Marcados (19/10): o mesmo card das outras abas, com o retrato; cada um é uma peça só. Na cena do mestre não
      // puxa; de outra cena, vem de lá; a lixeira (no detalhe) tira do tabuleiro
      chips.replaceChildren();
      const aqui = app.state.room?.id;
      const pastaDe = (personagem: number) => app.state.characters.find((ch) => ch.id === personagem)?.poses?.desarmado?.sw?.match(/\/arte\/personagens\/([^/]+)\//)?.[1];
      const trazer = (x: MarcadoNoJogo) => app.net.send({ t: 'marcadoColocar', fichaId: x.fichaId });
      const lista = app.state.marcados.filter((x) => !busca || semAcento(x.nome).includes(busca));
      // os companheiros (a Camarilla do Tepes, 19/10): o NPC do Elenco com o nome do companheiro da ficha, com a foto dela
      const comps = app.state.marcados
        .filter((x) => x.companheiro)
        .map((x) => ({ x, n: app.state.npcs.find((n) => semAcento(n.nome) === semAcento(x.companheiro!.nome)) }))
        .filter((c): c is { x: MarcadoNoJogo; n: Npc } => !!c.n && (!busca || semAcento(c.n.nome).includes(busca)));
      const cardComp = ({ x, n }: { x: MarcadoNoJogo; n: Npc }) =>
        card({
          chave: `npc:${n.id}`,
          nome: n.nome,
          linha: `de ${x.nome}`,
          duasLinhas: true,
          emCena: app.state.npcsEmCampo.includes(n.id),
          figura: x.companheiro?.imagem ? h('img', { class: 'el-foto', src: `/arte/companheiros/${x.companheiro.imagem}`, alt: n.nome, decoding: 'async', loading: 'lazy' }) : figura({ ...n }),
          usar: (ev) => usar(ev, () => colocarNpc(n)),
        });
      const nComp = app.state.npcs.find((n) => `npc:${n.id}` === sel && comps.some((c) => c.n === n));
      grade.replaceChildren(
        secao({
          nome: 'Marcados',
          n: lista.length,
          icone: 'pessoa',
          cls: 'el-mestre',
          aberta: true,
          alternar: () => {},
          filhos: lista.map((x) => {
            const nesta = x.cena !== undefined && x.cena === aqui;
            return card({
              chave: `marcado:${x.fichaId}`,
              nome: x.nome,
              linha: x.cena === undefined ? 'Fora do tabuleiro' : (x.cenaNome ?? ''),
              duasLinhas: true,
              emCena: nesta,
              figura: figura({ arte: pastaDe(x.personagem), nome: x.nome }),
              usar: (ev) => (nesta ? ev.stopPropagation() : usar(ev, () => trazer(x))),
            });
          }),
        }),
        ...(comps.length ? [secao({ nome: 'Companheiros', n: comps.length, icone: 'pata', cls: 'el-mestre', aberta: true, alternar: () => {}, filhos: comps.map(cardComp) })] : []),
      );
      if (nComp) {
        detalhe.replaceChildren(...detalheNpc(nComp));
        return;
      }
      const x = app.state.marcados.find((m) => `marcado:${m.fichaId}` === sel);
      if (!x) {
        detalhe.replaceChildren(h('p', { class: 'el-vazio' }, 'Os Marcados são os agentes dos jogadores: cada um é uma peça só. "Usar" põe na cena em que você está (se estiver em outra, sai de lá).'));
        return;
      }
      const nesta = x.cena !== undefined && x.cena === aqui;
      detalhe.replaceChildren(
        h('h4', { class: 'el-d-nome' }, x.nome),
        h('p', { class: 'el-d-nota' }, x.cena === undefined ? 'Fora do tabuleiro.' : nesta ? 'Nesta cena.' : `Em ${x.cenaNome}.`),
        h(
          'div',
          { class: 'el-d-acoes' },
          nesta || aqui === undefined
            ? h('button', { class: 'el-usar grande', type: 'button', disabled: true, title: 'Já está nesta cena' }, 'Em cena')
            : h('button', { class: 'el-usar grande', type: 'button', title: x.cena === undefined ? 'Põe na porta desta cena' : `Traz de ${x.cenaNome}`, onclick: (ev: Event) => usar(ev, () => trazer(x)) }, x.cena === undefined ? 'Usar' : 'Trazer para cá'),
          x.cena !== undefined ? h('button', { class: 'el-apagar', type: 'button', title: 'Tirar do tabuleiro (a peça fica guardada como está)', onclick: () => (sfx.click(), app.net.send({ t: 'marcadoTirar', fichaId: x.fichaId })) }, ic('lixo')) : null,
        ),
      );
      return;
    }
    if (aba === 'npcs') {
      chips.replaceChildren();
      // os companheiros dos Marcados ficam na aba Marcados (19/10)
      const deComp = new Set(app.state.marcados.map((x) => x.companheiro && semAcento(x.companheiro.nome)).filter(Boolean));
      const lista = npcs.filter((n) => !deComp.has(semAcento(n.nome)) && (!busca || semAcento(n.nome).includes(busca) || semAcento(n.nota ?? '').includes(busca) || semAcento(grupoDoNpc(n)).includes(busca)));
      // os grupos na ordem guardada (os vazios também, fechados); na busca, só os que têm alguém, abertos
      const grupos = gruposDoElenco(app.state.npcGrupos, npcs)
        .map((g) => [g, lista.filter((n) => grupoDoNpc(n) === g)] as const)
        .filter(([, ns]) => !busca || ns.length);
      grade.replaceChildren(
        ...grupos.map(([g, ns]) =>
          secao({
            nome: g,
            n: ns.length,
            icone: iconeDoGrupo(g),
            apagar: app.state.npcGrupos.includes(g) && !GRUPOS_NPC_PADRAO.includes(g) ? apagarGrupo(g, ns.length) : undefined,
            cls: `el-mestre${ns.length ? '' : ' vazia'}`,
            aberta: !!busca || (ns.length ? !npcsFechados.has(g) : vaziosAbertos.has(g)),
            alternar: alterna(ns.length ? npcsFechados : vaziosAbertos, g),
            filhos: !ns.length ? [h('p', { class: 'el-vazio' }, 'Nenhum NPC neste grupo ainda.')] : ns.map((n) => card({ chave: `npc:${n.id}`, nome: n.nome, linha: n.nota ?? (charDaArte(n.arte) ? '8 direções' : 'boneco de pixel'), duasLinhas: true, emCena: app.state.npcsEmCampo.includes(n.id), semPeca: semPeca(n.arte), figura: fotoDe(n.arte) ? h('img', { class: 'el-foto', src: fotoDe(n.arte)!, alt: n.nome, decoding: 'async', loading: 'lazy' }) : figura({ ...n }), usar: (ev) => usar(ev, () => colocarNpc(n)) })),
          }),
        ),
      );
      const n = npcs.find((x) => `npc:${x.id}` === sel);
      detalhe.replaceChildren(...(sel === 'novo-npc' ? detalheNovoNpc() : n ? detalheNpc(n) : [h('p', { class: 'el-vazio' }, 'Escolha um NPC para ver; "Usar" põe ele na porta da cena.')]));
      return;
    }
    // ameaças: as famílias (a primeira e as versões) ficam juntas no grupo da primeira (a Degolificada é de Medo, e as
    // versões dela, de cada elemento, vêm com ela), da de VD mais baixo para a mais alta; a busca passa por todos e abre
    chips.replaceChildren();
    const fams = familias(todas).filter((f) => !busca || f.some((e) => semAcento(e.nome).includes(busca)));
    const porGrupo = new Map<Grupo, Entrada[][]>();
    for (const f of fams) {
      const g = grupoDe(f[0]);
      porGrupo.set(g, [...(porGrupo.get(g) ?? []), f]);
    }
    for (const lista of porGrupo.values()) lista.sort((a, b) => vdDa(a) - vdDa(b));
    // as versões seguem a primeira, cada uma num card igual aos outros (17/10, o Felipe: sem setas, nada assimétrico)
    const cardAmeaca = (e: Entrada) =>
      card({ chave: e.chave, nome: e.nome, linha: linhaAmeaca(e), emCena: emCampoReliquia(e), semPeca: semPeca(e.livroId, ...(e.criatura?.aparencias.map((a) => a.arte) ?? [])), figura: figura({ arte: e.criatura?.aparencias[0]?.arte, elemento: e.elemento, nome: e.nome, livroId: e.livroId }), usar: (ev) => usar(ev, () => colocarAmeaca(e, 1, 'variadas')), cls: `el-de-${e.elemento ?? 'mundanas'}` });
    grade.replaceChildren(
      ...GRUPOS.filter((g) => porGrupo.has(g.id)).map((g) =>
        secao({ nome: g.nome, n: porGrupo.get(g.id)!.flat().length, icone: g.icone, cls: `el-${g.id}`, aberta: !!busca || ameacasAbertas.has(g.id), alternar: alterna(ameacasAbertas, g.id), filhos: porGrupo.get(g.id)!.flat().map(cardAmeaca) }),
      ),
    );
    if (!fams.length) grade.append(h('p', { class: 'el-vazio' }, 'Nada com esse nome.'));
    const e = todas.find((x) => x.chave === sel);
    detalhe.replaceChildren(...(e ? detalheAmeaca(e) : [h('p', { class: 'el-vazio' }, 'Escolha uma ameaça para ver a ficha, as caras e quantas pôr; "Usar" põe uma na porta da cena.')]));
  };

  // ---------- o detalhe ao lado ----------
  /** A imagem do Felipe que deu origem ao NPC: o rosto recortado dela (rosto.jpg, os olhos no meio) ou a foto inteira. */
  const fotoDe = (arte?: string) =>
    arte && arquivos ? ['rosto.jpg', 'foto.jpg', 'foto.webp', 'foto.png'].map((x) => `/arte/personagens/${arte}/${x}`).find((u) => arquivos!.has(u)) : undefined;
  /**
   * A escolha do grupo (17/10, o Felipe: "um dropdown bonitinho pra escolher os existentes, e um botão 'Criar novo
   * grupo'"): o botão mostra o grupo de agora; aberto, a lista dos grupos guardados (o atual marcado) e, no fim, o
   * "Criar novo grupo", que vira um campo com o nome (Enter cria e já escolhe).
   */
  const seletorGrupo = (atual: string | undefined, escolher: (g: string | undefined) => void): HTMLElement => {
    const caixa = h('div', { class: 'el-sel' });
    let aberto = false;
    let criando = false;
    const fora = (e: Event) => !caixa.contains(e.target as Node) && fechar();
    const fechar = () => {
      aberto = criando = false;
      document.removeEventListener('pointerdown', fora, true);
      montar();
    };
    const abrir = () => {
      aberto = true;
      document.addEventListener('pointerdown', fora, true);
      montar();
    };
    const criar = (nome: string) => {
      const g = nome.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!g) return;
      app.net.send({ t: 'npcGrupoCriar', nome: g });
      sfx.click();
      fechar();
      escolher(g);
    };
    const montar = () => {
      const grupos = gruposDoElenco(app.state.npcGrupos, app.state.npcs).filter((g) => g !== GRUPO_SEM);
      const campo = h('input', { class: 'el-sel-campo', maxlength: '40', placeholder: 'Nome do grupo' }) as HTMLInputElement;
      campo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') criar(campo.value);
        if (e.key === 'Escape') (e.stopPropagation(), fechar());
      });
      caixa.classList.toggle('aberto', aberto);
      caixa.replaceChildren(
        h(
          'button',
          { class: 'el-sel-atual', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': String(aberto), onclick: () => (aberto ? fechar() : abrir(), sfx.click()) },
          h('i', null),
          h('span', null, atual ?? 'Sem grupo'),
          h('b', { class: 'el-sel-seta', 'aria-hidden': 'true' }, '▾'),
        ),
        ...(aberto
          ? [
              h(
                'div',
                { class: 'el-sel-lista', role: 'listbox' },
                ...grupos.map((g) =>
                  h('button', { class: `el-sel-op${g === atual ? ' ativa' : ''}`, type: 'button', role: 'option', 'aria-selected': String(g === atual), onclick: () => (sfx.click(), fechar(), escolher(g)) }, h('i', null), h('span', null, g), g === atual ? h('b', null, '✓') : null),
                ),
                criando
                  ? h('div', { class: 'el-sel-novo' }, campo, h('button', { class: 'el-sel-ok', type: 'button', title: 'Criar o grupo', onclick: () => criar(campo.value) }, '✓'))
                  : h('button', { class: 'el-sel-criar', type: 'button', onclick: () => ((criando = true), montar(), campo.focus()) }, h('b', null, '+'), 'Criar novo grupo'),
              ),
            ]
          : []),
      );
      if (criando) setTimeout(() => campo.focus());
    };
    montar();
    return caixa;
  };
  const detalheNpc = (n: Npc): Node[] => [
    h('div', { class: 'el-d-figura' }, figura({ ...n })),
    h('h4', null, n.nome),
    // o nome se troca aqui (17/10: o Felipe escrevia os nomes no "Quem é", que era o único campo)
    h('label', { class: 'el-d-campo' }, h('small', null, 'Nome'), h('input', { value: n.nome, maxlength: '40', placeholder: 'Nome e sobrenome', onchange: (ev: Event) => { const v = (ev.target as HTMLInputElement).value.trim(); if (v && v !== n.nome) app.net.send({ t: 'npcSalvar', npc: { ...n, nome: v } }); } })),
    h('label', { class: 'el-d-campo' }, h('small', null, 'Quem é'), h('input', { value: n.nota ?? '', maxlength: '120', placeholder: 'o irmão da Catarina, o dono do bar…', onchange: (ev: Event) => app.net.send({ t: 'npcSalvar', npc: { ...n, nota: (ev.target as HTMLInputElement).value } }) })),
    h('div', { class: 'el-d-campo' }, h('small', null, 'Grupo'), seletorGrupo(grupoDoNpc(n) === GRUPO_SEM ? undefined : grupoDoNpc(n), (g) => app.net.send({ t: 'npcSalvar', npc: { ...n, grupo: g } }))),
    h('small', { class: 'el-d-info' }, charDaArte(n.arte) ? 'Arte nas 8 direções (anda deslizando, como os agentes).' : n.arte ? 'A arte ainda não chegou: entra como boneco de pixel.' : 'Sem arte: entra como boneco de pixel.'),
    h('div', { class: 'el-d-acoes' }, app.state.npcsEmCampo.includes(n.id) ? h('button', { class: 'el-usar grande', type: 'button', disabled: true, title: 'Já está em alguma cena desta campanha' }, 'Em cena') : h('button', { class: 'el-usar grande', type: 'button', onclick: (ev: Event) => usar(ev, () => colocarNpc(n)) }, 'Usar'), h('button', { class: 'el-apagar', type: 'button', title: 'Tirar do elenco (as peças já em campo ficam)', onclick: () => confirm(`Tirar ${n.nome} do elenco? As peças em campo ficam.`) && (app.net.send({ t: 'npcApagar', id: n.id }), (sel = null)) }, ic('lixo'))),
  ];

  const detalheNovoNpc = (): Node[] => {
    const nome = h('input', { maxlength: '40', placeholder: 'Nome do NPC', value: rascunho.nome, oninput: () => (rascunho.nome = nome.value) }) as HTMLInputElement;
    const nota = h('input', { maxlength: '120', placeholder: 'Quem é (opcional)', value: rascunho.nota, oninput: () => (rascunho.nota = nota.value) }) as HTMLInputElement;
    // a arte: uma pasta de personagem que ninguém do elenco usa (as que o Claude prepara pelo Códex)
    const usadas = new Set([...app.state.npcs.map((x) => x.arte), ...app.state.bestiario.flatMap((c) => c.aparencias.map((a) => a.arte))].filter(Boolean));
    const pastas = app.state.characters
      .map((ch) => /\/personagens\/([a-z0-9-]+)\//.exec(ch.sheet)?.[1])
      .filter((p): p is string => !!p && !usadas.has(p) && !['tepes', 'catarina', 'alosi', 'cora-falcao'].includes(p));
    const arte = h('select', { onchange: () => (rascunho.arte = arte.value) }, h('option', { value: '' }, 'Sem arte (boneco de pixel)'), ...pastas.map((p) => h('option', { value: p }, p))) as HTMLSelectElement;
    arte.value = rascunho.arte;
    const criar = () => {
      if (!nome.value.trim()) return nome.focus();
      app.net.send({ t: 'npcSalvar', npc: { id: '', nome: nome.value.trim(), nota: nota.value.trim() || undefined, grupo: rascunho.grupo, arte: arte.value || undefined, look: { skin: '#e0b896', hair: '#3a2a1c', hairStyle: 0, top: '#3a3a42', pants: '#26262c', shoes: '#18161a', outfit: 0, extra: 0, charId: null } } });
      sel = null;
      Object.assign(rascunho, { nome: '', nota: '', grupo: undefined, arte: '' });
      sfx.click();
    };
    nome.addEventListener('keydown', (e) => e.key === 'Enter' && criar());
    return [
      h('h4', null, 'Novo NPC'),
      h('label', { class: 'el-d-campo' }, h('small', null, 'Nome'), nome),
      h('label', { class: 'el-d-campo' }, h('small', null, 'Quem é'), nota),
      h('div', { class: 'el-d-campo' }, h('small', null, 'Grupo'), seletorGrupo(rascunho.grupo, (g) => ((rascunho.grupo = g), desenhar()))),
      h('label', { class: 'el-d-campo' }, h('small', null, 'Arte'), arte),
      h('small', { class: 'el-d-info' }, 'A arte das 8 direções vem pelo Códex: mande a imagem do personagem para o Claude, e ela aparece aqui.'),
      h('div', { class: 'el-d-acoes' }, h('button', { class: 'el-usar grande', type: 'button', onclick: criar }, 'Criar')),
    ];
  };

  /** O fundo vivo do retrato fica o mesmo enquanto a ameaça escolhida é a mesma (a tela se refaz a cada clique). */
  let fundoGuardado: { chave: string; el: HTMLCanvasElement } | null = null;
  const fundoDe = (e: Entrada) => {
    if (fundoGuardado?.chave !== e.chave) fundoGuardado = { chave: e.chave, el: fundoDoElemento(e.livroId || e.elemento ? e.elemento : 'mestre') };
    return fundoGuardado.el;
  };
  const dadoTeste = (t?: combate.TesteAmeaca) => (t ? `${t.dados}d20${t.bonus ? (t.bonus > 0 ? `+${t.bonus}` : `${t.bonus}`) : ''}` : '—');
  const nomeDano = (t: string) => (combate.NOME_TIPO_DANO as Record<string, string>)[t] ?? (t === 'todos' ? 'todo dano' : t);
  const NOME_ACAO: Record<string, string> = { padrao: 'Padrão', movimento: 'Movimento', completa: 'Completa', livre: 'Livre', reacao: 'Reação' };

  /**
   * O detalhe da ameaça (17/10, o Felipe: "espação em branco ... muito mal distribuído; vamos fazer um trem bonito igual
   * na aba de ficha"): o retrato sempre à vista em cima, com o fundo vivo do elemento e a página do livro num cantinho;
   * no meio, rolando, a ficha que interessa ao mestre (números, testes, ataques, ações, defesas, habilidades); embaixo,
   * fixos, Quantas e Usar.
   */
  const detalheAmeaca = (e: Entrada): Node[] => {
    const c = e.criatura;
    const f = c?.ficha;
    const livro = e.livroId ? combate.AMEACAS_LIVRO.find((a) => a.id === e.livroId) : undefined;
    const fx = livro ?? f;
    const elementos = [e.elemento, ...(e.outros ?? [])].filter(Boolean) as string[];
    const unico = combate.ehPortadorDeReliquia(e.livroId);
    if (c && aparencia !== 'variadas' && !c.aparencias.some((a) => a.id === aparencia)) aparencia = 'variadas';
    if (unico) quantidade = 1;
    const bloco = (titulo: string, ...filhos: (Node | null)[]) => {
      const fs = filhos.filter((x): x is Node => !!x);
      return fs.length ? h('section', { class: 'el-dam-bloco' }, h('h5', null, titulo), ...fs) : null;
    };
    const num = (rot: string, val: string) => h('span', { class: 'el-dam-num' }, h('small', null, rot), caberNumaLinha(h('b', null, val)));
    const teste = (rot: string, t?: combate.TesteAmeaca) => (t ? h('span', { class: 'el-dam-teste' }, h('small', null, rot), h('b', null, dadoTeste(t))) : null);
    const tamanho = livro?.tamanho ?? f?.tamanho;
    // os números grandes
    const numeros = h(
      'div',
      { class: 'el-dam-nums' },
      num('VD', String(e.vd ?? '—')),
      num('PV', String(c?.pv ?? livro?.pv ?? '—')),
      num('Defesa', String(fx?.defesa ?? '—')),
      num('Desloc.', livro?.deslocamento ? `${livro.deslocamento} m` : '—'),
    );
    const testes = fx
      ? bloco('Testes', h('div', { class: 'el-dam-testes' }, teste('Fortitude', fx.fortitude), teste('Reflexos', fx.reflexos), teste('Vontade', fx.vontade), teste('Percepção', livro?.percepcao), teste('Iniciativa', livro?.iniciativa)))
      : null;
    const ataques = fx?.ataques.length
      ? bloco(
          'Ataques',
          ...fx.ataques.map((a) =>
            h(
              'div',
              { class: 'el-dam-ataque' },
              h('b', null, a.nome, a.vezes && a.vezes > 1 ? h('em', null, ` ×${a.vezes}`) : null),
              h('span', null, `${a.pericia === 'luta' ? 'Luta' : 'Pontaria'} ${dadoTeste(a)}`),
              h('span', null, `${a.dano} ${nomeDano(a.tipo)}${a.extra ? ` + ${a.extra.dano} ${nomeDano(a.extra.tipo)}` : ''}`),
              h('small', null, `crítico ${a.margem}/×${a.multiplicador}${a.alcance ? ` · alcance ${a.alcance}` : ' · corpo a corpo'}`),
            ),
          ),
        )
      : null;
    const acoes = livro?.acoes.length
      ? bloco(
          'Ações',
          ...livro.acoes.map((a) =>
            h(
              'div',
              { class: 'el-dam-acao' },
              h('span', { class: `el-dam-tipo t-${a.acao}` }, NOME_ACAO[a.acao] ?? a.acao),
              h('b', null, a.nome),
              h('small', null, [a.teste ? dadoTeste(a.teste) : '', a.dt ? `DT ${a.dt}` : '', a.dano ? `${a.dano}${a.tipoDano ? ` ${nomeDano(a.tipoDano)}` : ''}` : '', a.resistencia ?? ''].filter(Boolean).join(' · ')),
            ),
          ),
        )
      : null;
    const linhaDef = (rot: string, txt: string) => (txt ? h('div', { class: 'el-dam-def' }, h('small', null, rot), h('span', null, txt)) : null);
    const rd = fx ? Object.entries(fx.rd ?? {}).map(([k, v]) => `${nomeDano(k)} ${v}`).join(', ') : '';
    const defesas = fx
      ? bloco(
          'Defesas',
          linhaDef('Resistência', rd),
          linhaDef('Imune', [...fx.imunidades.map(nomeDano), ...(livro?.imunidadesOutras ?? [])].join(', ') + (livro?.enigma ? ' (até o enigma de medo)' : '')),
          linhaDef('Vulnerável', fx.vulnerabilidades.map(nomeDano).join(', ')),
          linhaDef('Sentidos', livro?.sentidos.join(', ') ?? ''),
          fx.presenca ? linhaDef('Presença', `DT ${fx.presenca.dt} · ${fx.presenca.dano} mental · imune com NEX ${fx.presenca.nex}%`) : null,
        )
      : null;
    const passivas = livro?.passivas.length ? bloco('Habilidades', h('div', { class: 'el-dam-chips' }, ...livro.passivas.map((n) => h('span', null, n)))) : null;
    const caras =
      c && c.aparencias.length > 1
        ? bloco('Aparência', h('div', { class: 'el-dam-chips caras' }, ...[{ id: 'variadas', nome: 'Variadas' }, ...c.aparencias].map((a) => h('button', { class: `el-cara${aparencia === a.id ? ' ativa' : ''}`, type: 'button', onclick: () => ((aparencia = a.id), desenhar()) }, a.nome))))
        : null;
    const nome = caberNumaLinha(h('h4', null, e.nome), 0.7);
    return [
      h(
        'div',
        { class: `el-dam el-de-${e.elemento ?? 'mundanas'}` },
        h(
          'div',
          { class: 'el-dam-topo' },
          h(
            'div',
            { class: 'el-dam-figura' },
            fundoDe(e),
            figura({ arte: c?.aparencias[0]?.arte, elemento: e.elemento, nome: e.nome, livroId: e.livroId }),
            e.pagina ? h('span', { class: 'el-dam-pagina', title: 'Página do livro de regras' }, `LR p. ${e.pagina}`) : null,
          ),
          nome,
          h(
            'div',
            { class: 'el-d-elementos' },
            ...elementos.map((x) => h('span', { class: `el-tag el-${x}` }, combate.NOME_ELEMENTO[x as keyof typeof combate.NOME_ELEMENTO] ?? x)),
            h('span', { class: 'el-tag' }, e.tipo),
            tamanho ? h('span', { class: 'el-tag' }, combate.NOME_TAMANHO[tamanho]) : null,
          ),
        ),
        h('div', { class: 'el-dam-rolar' }, numeros, ...[testes, ataques, acoes, defesas, passivas, caras].filter((x): x is HTMLElement => !!x)),
        h(
          'div',
          { class: 'el-dam-pe' },
          unico
            ? null
            : h(
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
            emCampoReliquia(e)
              ? h('button', { class: 'el-usar grande', type: 'button', disabled: true, title: 'Portador de relíquia: só existe um, e já está em alguma cena desta campanha' }, 'Em cena')
              : h('button', { class: 'el-usar grande', type: 'button', title: unico ? 'Portador de relíquia: só existe um na campanha (Shift: sem fechar a janela)' : 'Põe na porta da cena; cada peça com os próprios PV (Shift: sem fechar a janela)', onclick: (ev: Event) => usar(ev, () => colocarAmeaca(e, quantidade, aparencia)) }, quantidade > 1 ? `Usar ${quantidade}` : 'Usar'),
            c ? h('button', { class: 'el-editar', type: 'button', title: 'Editar as caras, os PV e a ficha (o bestiário)', onclick: () => (fechar(), abrirBestiario(app, c.id)) }, ic('lapis')) : null,
          ),
        ),
      ),
    ];
  };

  app.on('bestiario', desenhar);
  app.on('characters', desenhar);
  app.net.send({ t: 'bestiario' });
  desenhar();
  void arteCarregada.then((lista) => ((arquivos = lista), desenhar()));
  // e de novo, para a arte que chegou depois que a página abriu (a foto nova de um NPC)
  void atualizarArte().then((lista) => ((arquivos = lista), desenhar()));
  campoBusca.focus();
}
