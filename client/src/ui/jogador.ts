/**
 * A tela do jogador no celular ("modo jogo", referências docs/ref-jogador-*.webp; o plano em
 * docs/TELA-DO-JOGADOR.md). Em cima, quem ele é, PV/PE/SAN (com − e +, ele mexe nos dele) e os
 * números da rodada; embaixo, as abas: Agente (os atributos, os números e o Armado),
 * Mochila, Poderes, Rituais, Docs (o que o mestre entregou) e Notas. A ficha inteira fica na
 * engrenagem.
 *
 * Tudo que muda a ficha vai pelo `fichaSalvar` (o servidor confere o que o jogador pode); a
 * mochila e o Armado, pelo `mochila`; os documentos, por `docMarcar` e `docEquipe`.
 */
import {
  documentoParaJogador,
  nomeTipoDocumento,
  regras,
  vitalConditions,
  type AcaoMochila,
  type AvatarLook,
  type Documento,
  type FichaSalva,
  type GrupoDocumento,
  type NotaDiario,
  type TipoDocumento,
} from '@crona/shared';
import { portraitCanvas } from '../render/portrait';
import { sprites } from '../render/sprites';
import type { App } from './app';
import { arteDoItem } from './arteItem';
import { h, toast } from './dom';
import { botao, confirmar, escolher, janela } from './fichaModal';
import { opcoesMelhoria } from './melhorias';
import { infoItem, NOME_ELEMENTO, textoRef } from './fichaRegras';
import { arteOu, ic, type NomeIcone } from './icons';
import { sfx } from './sfx';
import { vestirTema } from './temaUi';

type Calc = regras.Calculado;
type Aba = 'agente' | 'mochila' | 'ataques' | 'poderes' | 'rituais' | 'docs' | 'notas';
const cat = regras.catalogo;

const ABAS: { id: Aba; rotulo: string; icone: NomeIcone; pintado?: string }[] = [
  { id: 'agente', rotulo: 'Agente', icone: 'pessoa', pintado: 'titulo-atributos' },
  { id: 'mochila', rotulo: 'Mochila', icone: 'mochila', pintado: 'titulo-inventario' },
  { id: 'ataques', rotulo: 'Ataques', icone: 'espadas', pintado: 'combate-atacar' },
  { id: 'poderes', rotulo: 'Poderes', icone: 'estrela', pintado: 'titulo-poderes' },
  { id: 'rituais', rotulo: 'Rituais', icone: 'pentagrama', pintado: 'titulo-rituais' },
  { id: 'docs', rotulo: 'Docs', icone: 'documento', pintado: 'topo-registro' },
  { id: 'notas', rotulo: 'Notas', icone: 'pena', pintado: 'titulo-anotacoes' },
];


const ICONE_DOC: Record<TipoDocumento, NomeIcone> = { relatorio: 'documento', mapa: 'mapa', comunicacao: 'email', registro: 'livro', foto: 'imagem', objeto: 'caixa', outro: 'documento' };
const COR_ELEMENTO: Record<regras.Elemento, string> = { sangue: '#d9302c', morte: '#8d8d93', conhecimento: '#e2b53a', energia: '#a45cff', medo: '#f1efe9' };
const NOME_TIPO_PODER: Record<regras.OrigemPoder, string> = { classe: 'Poder de classe', habilidade: 'Habilidade de classe', trilha: 'Trilha', origem: 'Origem', paranormal: 'Poder paranormal' };

type FiltroPoder = 'classe' | 'trilha' | 'origem' | 'paranormal';
const FILTROS_PODER: { id: FiltroPoder; rotulo: string; icone: NomeIcone; pintado: string; tipos: regras.OrigemPoder[] }[] = [
  { id: 'classe', rotulo: 'Classe', icone: 'espadas', pintado: 'poder-classe', tipos: ['classe', 'habilidade'] },
  { id: 'trilha', rotulo: 'Trilha', icone: 'pino', pintado: 'poder-trilha', tipos: ['trilha'] },
  { id: 'origem', rotulo: 'Origem', icone: 'ficha', pintado: 'poder-origem', tipos: ['origem'] },
  { id: 'paranormal', rotulo: 'Paranormal', icone: 'olho', pintado: 'poder-paranormal', tipos: ['paranormal'] },
];

const agora = () => new Date().toISOString();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const numero = (n: number) => String(n).replace('.', ',');

function lookDe(charId: number | undefined): AvatarLook | null {
  if (!charId) return null;
  return { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId };
}

/** "Hoje, 21:14", "Ontem, 9:02" ou "12/10, 20:41". */
function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86_400_000);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return `Hoje, ${hora}`;
  if (mesmoDia(d, ontem)) return `Ontem, ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
}

/** O ícone pintado do kit (arte/icones/<nome>.png), com o de linha enquanto não chega. */
/**
 * Os atributos, no mesmo jeito dos números: o ícone, o valor (quantos d20 rola, LR p. 11) e o nome.
 * Com `dica`, o toque passa o brilho e diz só os dados ("4D20"; com 0 ou menos, rola dois e fica o
 * menor). Sem `dica` (dentro de um cartão que já é botão, na ficha), é só a faixa.
 */
export function faixaAtributos(atributos: Record<regras.AtributoId, number>, dica = true): HTMLElement {
  const atr = (a: regras.AtributoId, i: number) => {
    const v = atributos[a];
    const dados = v > 0 ? `${v}D20` : '2D20';
    const rola = v > 0 ? `rola ${v}d20, fica o maior` : 'rola 2d20, fica o menor';
    const el = h(
      dica ? 'button' : 'div',
      {
        class: `jg-num jg-atr a-${a}`,
        style: `--i:${i}`,
        type: dica ? 'button' : undefined,
        'aria-label': `${regras.NOME_ATRIBUTO[a]} ${v}: ${rola}`,
        onclick: dica
          ? () => {
              sfx.click();
              el.classList.remove('rola');
              void el.offsetWidth;
              el.classList.add('rola');
              el.querySelector('.jg-atr-dica')?.remove();
              const d = h('span', { class: 'jg-atr-dica' }, h('b', null, dados), v > 0 ? null : h('small', null, 'fica com o menor'));
              el.append(d);
              window.setTimeout(() => d.remove(), 2600);
            }
          : undefined,
      },
      h('span', { class: 'jg-atr-brilho', 'aria-hidden': 'true' }),
      h('span', { class: 'jg-num-ic' }, pintado(a, 'pulso')),
      h('b', null, String(v)),
      h('span', { class: 'jg-num-n' }, regras.NOME_ATRIBUTO[a]),
    ) as HTMLElement;
    return el;
  };
  return h('div', { class: 'jg-numeros jg-atrs' }, ...(['agi', 'for', 'int', 'pre', 'vig'] as const).map(atr));
}

const pintado = (nome: string | string[] | undefined, icone: NomeIcone) =>
  nome ? arteOu((Array.isArray(nome) ? nome : [nome]).map((n) => `/arte/icones/${n}.png`), ic(icone)) : ic(icone);
/** Os ícones pintados que ainda vão chegar (o pedido ao Códex), com o mais parecido de hoje enquanto isso. */
const IC = {
  armado: ['armado', 'combate-atacar'],
  desarmado: ['desarmado', 'combate-manobra'],
  docsTodos: ['docs-todos', 'topo-registro'],
  docsPistas: ['docs-pistas', 'topo-mapa'],
  notasRecentes: ['notas-recentes', 'combate-atrasar'],
  carga: ['carga', 'combate-item'],
  docsEvidencias: ['docs-evidencias', 'pre'],
  notasFixadas: ['notas-fixadas', 'titulo-anotacoes'],
};

export class TelaJogador {
  readonly el: HTMLElement;
  private fs: FichaSalva | null = null;
  private calc: Calc | null = null;
  private equipe: { id: number; nome: string }[] = [];
  private docs: Documento[] = [];
  private aba: Aba = 'agente';
  private timer = 0;
  /** onde cada barra estava (para animar a mudança) */
  private pctAntes: Partial<Record<'pv' | 'pe' | 'san', number>> = {};
  private retratoTimer = 0;
  // o que fica escolhido em cada aba
  private filtroPoder: FiltroPoder = 'classe';
  private poderSel: string | null = null;
  private ritualSel: string | null = null;
  private filtroDoc: GrupoDocumento | 'todos' = 'todos';
  private docSel: number | null = null;
  private soFixadas = false;
  private notaSel: string | null = null;
  /** o detalhe acabou de abrir: a lista rola até ele */
  private focarDetalhe = false;
  // as partes da tela
  private perfil = h('section', { class: 'jg-perfil' });
  private vitais = h('section', { class: 'jg-vitais' });
  private numeros = h('section', { class: 'jg-numeros' });
  private conteudo = h('main', { class: 'jg-conteudo' });
  private nav = h('nav', { class: 'jg-nav', role: 'tablist' });

  constructor(
    private app: App,
    private acoes: { fichaCompleta: () => void; menu: () => void; sair: () => void },
  ) {
    const topo = h(
      'header',
      { class: 'jg-topo' },
      h('div', { class: 'jg-marca' }, h('b', null, 'ORDO REALITAS'), h('span', null, 'Sede da Ordem')),
      h(
        'div',
        { class: 'jg-topo-bts' },
        h('button', { class: 'jg-topo-bt', type: 'button', title: 'Menu e ficha completa', 'aria-label': 'Menu', onclick: () => (sfx.click(), acoes.menu()) }, pintado('topo-config', 'engrenagem')),
        h('button', { class: 'jg-topo-bt sair', type: 'button', title: 'Sair', 'aria-label': 'Sair', onclick: () => acoes.sair() }, pintado('topo-sair', 'sair')),
      ),
    );
    this.el = h('div', { class: 'jg' }, topo, this.perfil, this.vitais, this.conteudo, this.nav);
    this.renderNav();
  }

  setFicha(fs: FichaSalva | null) {
    // a mudança que o jogador ainda não mandou vale mais que a cópia do servidor
    if (this.timer && this.fs && fs && fs.id === this.fs.id) return;
    this.fs = fs ? clone(fs) : null;
    // escrevendo uma nota: o resto da tela atualiza, o campo fica como está
    const foco = document.activeElement;
    this.render(!(foco && this.conteudo.contains(foco) && /^(INPUT|TEXTAREA)$/.test(foco.tagName)));
  }

  setEquipe(equipe: { id: number; nome: string }[]) {
    this.equipe = equipe;
  }

  setDocs(docs: Documento[]) {
    this.docs = this.fs ? docs.map((d) => documentoParaJogador(d, this.fs!.id)) : docs;
    if (this.aba === 'docs') this.renderConteudo();
  }

  // ---------------------------------------------------------------- guardar

  /** A ficha mudou aqui: tela na hora, servidor logo depois (um envio só para vários toques). */
  private mudar(fn: (fs: FichaSalva) => void, redesenhar = true) {
    const fs = this.fs;
    if (!fs) return;
    fn(fs);
    fs.atualizadaEm = agora();
    if (redesenhar) this.render();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.app.net.send({ t: 'fichaSalvar', ficha: fs });
    }, 450);
  }

  private mochila(uid: number, acao: AcaoMochila, extra: { para?: number; trocar?: boolean } = {}) {
    if (!this.fs) return;
    this.app.net.send({ t: 'mochila', fichaId: this.fs.id, uid, acao, ...extra });
  }

  // ---------------------------------------------------------------- desenhar

  private render(conteudo = true) {
    const fs = this.fs;
    if (!fs) {
      this.perfil.replaceChildren(h('p', { class: 'jg-vazio' }, 'Carregando a ficha…'));
      this.vitais.replaceChildren();
      this.numeros.replaceChildren();
      this.conteudo.replaceChildren();
      return;
    }
    vestirTema(this.el, fs.tema);
    try {
      this.calc = regras.calcular(fs.ficha);
    } catch {
      this.calc = null;
    }
    this.renderPerfil();
    this.renderVitais();
    this.renderNumeros();
    if (conteudo) this.renderConteudo();
    this.renderNav();
  }

  private vit() {
    const c = this.calc!;
    const a = this.fs!.atual;
    return {
      pv: Math.min(a?.pv ?? c.pv, c.pv),
      pvMax: c.pv,
      pe: Math.min(a?.pe ?? c.pe, c.pe),
      peMax: c.pe,
      san: Math.min(a?.san ?? c.san, c.san),
      sanMax: c.san,
    };
  }

  private renderPerfil() {
    const fs = this.fs!;
    const f = fs.ficha;
    const c = this.calc;
    const classe = f.classe ? cat.classe(f.classe).nome : 'Sem classe';
    const trilha = f.trilha ? cat.trilha(f.trilha)?.nome : undefined;
    const look = lookDe(fs.personagem);
    // o retrato sai da folha do personagem: sem ela ainda (a lista chega depois), desenha de novo daqui a pouco
    if (look && !sprites.def(look.charId!)) {
      clearTimeout(this.retratoTimer);
      this.retratoTimer = window.setTimeout(() => this.fs && this.renderPerfil(), 700);
    }
    // as condições: as do mestre e as que saem dos pontos (machucado, morrendo...)
    const auto = c ? vitalConditions(this.vit()) : null;
    const nomes = [
      ...(auto ? (Object.entries(auto) as [string, boolean][]).filter(([, v]) => v).map(([k]) => cat.condicao(k)?.nome ?? k[0].toUpperCase() + k.slice(1)) : []),
      ...(fs.condicoes ?? []).map((k) => cat.condicao(k)?.nome ?? k),
    ];
    const chips = nomes.length
      ? nomes.slice(0, 3).map((n) => h('span', { class: 'jg-chip ruim' }, n))
      : [h('span', { class: 'jg-chip ok' }, 'Normal')];
    if (regras.armado(f.inventario)) chips.push(h('span', { class: 'jg-chip arma' }, 'Armado'));
    this.perfil.replaceChildren(
      h('div', { class: 'jg-foto' }, look ? portraitCanvas(look, 120) : ic('pessoa')),
      h(
        'div',
        { class: 'jg-quem' },
        h('div', { class: 'jg-nome' }, h('b', null, fs.nome), h('span', null, [classe, trilha, `NEX ${f.nex}%`].filter(Boolean).join(' · '))),
        h('div', { class: 'jg-chips' }, ...chips),
      ),
    );
  }

  private renderVitais() {
    if (!this.calc) return this.vitais.replaceChildren(h('p', { class: 'jg-vazio' }, 'A ficha tem um problema: peça ao mestre para conferir.'));
    const v = this.vit();
    const card = (k: 'pv' | 'pe' | 'san', rotulo: string) => {
      const atual = v[k];
      const max = v[`${k}Max` as const];
      const pct = Math.max(0, Math.min(100, (atual / Math.max(1, max)) * 100));
      const antes = this.pctAntes[k] ?? pct;
      this.pctAntes[k] = pct;
      const mudar = (d: number) => {
        sfx.click();
        this.mudar((fs) => {
          const vv = this.vit();
          const novo = Math.max(k === 'pv' ? -max : 0, Math.min(max, vv[k] + d));
          fs.atual = { pv: vv.pv, pe: vv.pe, san: vv.san, ...fs.atual, [k]: novo };
        });
      };
      // a tinta corre devagar; o que saiu fica um instante claro (o rastro) e desce atrás
      const tinta = h('i', { class: 'jg-tinta', style: `width:${antes}%` });
      const rastro = h('i', { class: 'jg-rastro', style: `width:${Math.max(antes, pct)}%` });
      const mudou = pct < antes ? ' baixou' : pct > antes ? ' subiu' : '';
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          tinta.style.width = `${pct}%`;
          rastro.style.width = `${pct}%`;
        }),
      );
      return h(
        'div',
        { class: `jg-vital ${k}${mudou}${pct <= 25 ? ' baixo' : ''}` },
        h('div', { class: 'jg-vital-topo' }, h('b', null, rotulo), h('span', { class: 'jg-vital-n' }, h('strong', null, String(atual)), `/${max}`)),
        h('div', { class: 'jg-barra' }, rastro, tinta, h('i', { class: 'jg-brilho' })),
        h(
          'div',
          { class: 'jg-vital-bts' },
          h('button', { type: 'button', 'aria-label': `Tirar 1 de ${rotulo}`, onclick: () => mudar(-1) }, ic('menos')),
          h('button', { type: 'button', 'aria-label': `Somar 1 em ${rotulo}`, onclick: () => mudar(1) }, ic('mais')),
        ),
      );
    };
    this.vitais.replaceChildren(card('pv', 'PV'), card('pe', 'PE'), card('san', 'SAN'));
  }

  private renderNumeros() {
    const c = this.calc;
    if (!c) return this.numeros.replaceChildren();
    const n = (icone: NomeIcone, pint: string | string[] | undefined, rotulo: string, valor: string, dica: string) =>
      h('div', { class: 'jg-num', title: dica }, h('span', { class: 'jg-num-ic' }, pintado(pint, icone)), h('b', null, valor), h('span', null, rotulo));
    this.numeros.replaceChildren(
      n('escudo', 'defesa', 'Defesa', String(c.defesa), 'Defesa: 10 + Agilidade + proteção.'),
      n('correr', 'deslocamento', 'Desloc.', `${numero(c.deslocamento)} m`, 'Deslocamento por ação de movimento.'),
      n('mochila', IC.carga, 'Carga', `${numero(c.carga.usados)}/${c.carga.espacos}`, `Espaços da mochila (até ${c.carga.maximo}, sobrecarregado).`),
      n('raio', 'pe', 'Limite PE', String(c.limitePe), 'PE que dá para gastar por turno.'),
    );
  }

  private renderNav() {
    this.nav.replaceChildren(
      ...ABAS.map((a) =>
        h(
          'button',
          {
            class: `jg-aba${this.aba === a.id ? ' on' : ''}`,
            type: 'button',
            role: 'tab',
            'aria-selected': String(this.aba === a.id),
            onclick: () => {
              if (this.aba === a.id) return;
              sfx.click();
              this.aba = a.id;
              this.renderConteudo();
              this.renderNav();
              this.conteudo.scrollTop = 0;
            },
          },
          pintado(a.pintado, a.icone),
          h('span', null, a.rotulo),
        ),
      ),
    );
  }

  private renderConteudo() {
    if (!this.fs || !this.calc) return this.conteudo.replaceChildren();
    const partes: Record<Aba, () => Node[]> = {
      agente: () => this.abaAgente(),
      mochila: () => this.abaMochila(),
      ataques: () => this.abaAtaques(),
      poderes: () => this.abaPoderes(),
      rituais: () => this.abaRituais(),
      docs: () => this.abaDocs(),
      notas: () => this.abaNotas(),
    };
    this.conteudo.dataset.aba = this.aba;
    this.el.dataset.aba = this.aba;
    this.conteudo.replaceChildren(...partes[this.aba]());
    if (this.focarDetalhe) {
      this.focarDetalhe = false;
      const det = this.conteudo.querySelector('.jg-det');
      if (det) requestAnimationFrame(() => det.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }

  /** O título de uma seção: o nome em pixel e, à direita, um extra (contagem ou botão). */
  private titulo(texto: string, _icone: NomeIcone, extra?: Node | null) {
    return h('div', { class: 'jg-tit' }, h('h2', null, texto), h('i', { class: 'jg-tit-linha', 'aria-hidden': 'true' }), extra ?? null);
  }

  // ---------------------------------------------------------------- Agente

  private abaAgente(): Node[] {
    const fs = this.fs!;
    const c = this.calc!;
    const armado = regras.armado(fs.ficha.inventario);
    const armas = fs.ficha.inventario.filter((it) => it.tipo === 'arma' && regras.maosDoItem(it) > 0 && it.uid);
    const naMao = fs.ficha.inventario.filter((it) => it.tipo === 'arma' && regras.lugarDoItem(it) === 'mao');
    const trocar = h(
      'button',
      {
        class: `jg-armado${armado ? ' on' : ''}`,
        type: 'button',
        disabled: !armado && !armas.length,
        title: armado ? `Na mão: ${naMao.map((x) => regras.nomeDoItem(x)).join(', ')}. Toque para guardar.` : armas.length ? `Saca ${regras.nomeDoItem(armas[0])}.` : 'Nenhuma arma na mochila.',
        onclick: () => {
          sfx.click();
          if (armado) for (const it of naMao) this.mochila(it.uid!, 'guardar');
          else if (armas[0]) this.mochila(armas[0].uid!, 'empunhar', { trocar: true });
        },
      },
      h('span', { class: 'jg-armado-op des' }, pintado(IC.desarmado, 'mao'), 'Desarmado'),
      h('span', { class: 'jg-armado-op arm' }, pintado(IC.armado, 'pistola'), 'Armado'),
    );
    return [
      faixaAtributos(c.atributos),
      this.numeros,
      trocar,
      h('p', { class: 'jg-nota-armado' }, armado ? `Na mão: ${naMao.map((x) => regras.nomeDoItem(x)).join(', ')}.` : armas.length ? 'A arma fica guardada; Armado saca a primeira da mochila.' : 'Sem arma na mochila.'),
    ];
  }

  // ---------------------------------------------------------------- Mochila

  private abaMochila(): Node[] {
    const fs = this.fs!;
    const c = this.calc!;
    const inv = fs.ficha.inventario.filter((it) => it.uid);
    const casas: HTMLElement[] = inv.map((it) => {
      const inf = infoItem(it, c);
      const lugar = regras.lugarDoItem(it);
      const aura = auraDoItem(it);
      return h(
        'button',
        { class: `jg-casa${lugar !== 'mochila' ? ' usado' : ''}${aura ? ` aura ${aura}` : ''}`, type: 'button', title: inf.nome, 'aria-label': inf.nome, onclick: () => (sfx.paper(), this.abrirItem(it.uid!)) },
        h('span', { class: 'jg-casa-arte' }, arteDoItem(it, inf.icone)),
        selosDoItem(it),
        (it.qtd ?? 1) > 1 ? h('span', { class: 'jg-casa-q' }, `x${it.qtd}`) : null,
        lugar !== 'mochila' ? h('span', { class: 'jg-casa-lugar', title: lugar === 'mao' ? 'Na mão' : 'Vestido' }, pintado(lugar === 'mao' ? IC.armado : 'protecao', lugar === 'mao' ? 'mao' : 'colete')) : null,
      );
    });
    // as casas vazias completam a fileira (no mínimo três fileiras)
    const vazias = Math.max(12, Math.ceil((casas.length + 1) / 4) * 4) - casas.length;
    for (let i = 0; i < vazias; i++) casas.push(h('span', { class: 'jg-casa vazia', 'aria-hidden': 'true' }));
    const partes: (HTMLElement | null)[] = [
      this.titulo('MOCHILA', 'mochila', h('span', { class: 'jg-tit-extra' }, pintado(IC.carga, 'mochila'), h('b', null, `${numero(c.carga.usados)}/${c.carga.espacos}`), ' espaços')),
      h('div', { class: 'jg-casas' }, ...casas),
      inv.length ? null : h('p', { class: 'jg-vazio' }, 'A mochila está vazia. Os itens vêm da requisição (na ficha completa) e do que o mestre entrega.'),
    ];
    return partes.filter((x): x is HTMLElement => !!x);
  }

  /** O item num modal: a arte, o nome, o peso, o que faz e o que dá para fazer com ele. */
  abrirItem(uid: number) {
    const it = this.fs?.ficha.inventario.find((x) => x.uid === uid);
    if (!it) return;
    const inf = infoItem(it, this.calc);
    const lugar = regras.lugarDoItem(it);
    const base = it.tipo === 'cena' ? undefined : (regras.baseDoItem(it) as { resumo?: string } | undefined);
    const resumo = it.descricao || base?.resumo || '';
    const j = janela(inf.nome.toUpperCase(), 'mochila', () => {}, 46);
    j.el.classList.add('tela-toda', 'jg-modal-item');
    const fazer = (fn: () => void) => () => (fn(), j.fechar());
    const acoes: HTMLElement[] = [];
    if (regras.maosDoItem(it) > 0)
      acoes.push(lugar === 'mao' ? botao('Guardar', 'mochila', '', fazer(() => this.mochila(uid, 'guardar'))) : botao('Empunhar', 'mao', 'forte', fazer(() => this.mochila(uid, 'empunhar', { trocar: true }))));
    else if (regras.vestivel(it)) acoes.push(lugar === 'vestido' ? botao('Tirar', 'colete', '', fazer(() => this.mochila(uid, 'tirar'))) : botao('Vestir', 'colete', 'forte', fazer(() => this.mochila(uid, 'vestir'))));
    if (regras.consumivel(it))
      acoes.push(
        botao('Usar', 'kitMedico', 'forte', async () => {
          if (!(await confirmar(`USAR ${inf.nome.toUpperCase()}?`, 'O item é gasto, e o mestre vê no registro.', 'Usar'))) return;
          this.mochila(uid, 'usar');
          j.fechar();
        }),
      );
    if (this.equipe.length) acoes.push(botao('Entregar', 'pessoa', '', () => (j.fechar(), this.entregar(it, inf.nome))));
    // modificações e maldições do livro: o motor diz o que cabe (a patente sobe a categoria); o mestre vê no registro
    if (it.tipo === 'arma' || it.tipo === 'protecao' || it.tipo === 'equipamento') acoes.push(botao('Modificar', 'engrenagem', '', () => (j.fechar(), this.modificar(uid))));
    acoes.push(
      botao('Largar', 'lixo', 'perigo', async () => {
        if (!(await confirmar(`LARGAR ${inf.nome.toUpperCase()}?`, 'O item sai da mochila e fica no chão, na casa onde você está. Qualquer um pode pegar.', 'Largar', true))) return;
        this.mochila(uid, 'largar');
        j.fechar();
      }),
    );
    const campo = (rot: string, valor: string) => h('div', { class: 'jg-mi-campo' }, h('small', null, rot), h('b', null, valor));
    const efeito = [inf.efeito, inf.obs].filter((x) => x && x !== '—').join(' · ');
    j.corpo.append(
      h(
        'div',
        { class: 'jg-mi' },
        h('div', { class: `jg-mi-arte${auraDoItem(it) ? ` aura ${auraDoItem(it)}` : ''}` }, arteDoItem(it, inf.icone), selosDoItem(it)),
        h(
          'div',
          { class: 'jg-mi-campos' },
          campo('Tipo', inf.tipo),
          campo('Peso', `${numero(inf.espacos * (it.qtd ?? 1))} esp.${(it.qtd ?? 1) > 1 ? ` (${it.qtd} un.)` : ''}`),
          campo('Categoria', it.tipo === 'cena' ? 'achado' : ['0', 'I', 'II', 'III', 'IV'][inf.categoria] ?? '—'),
          campo('Onde', lugar === 'mao' ? 'Na mão' : lugar === 'vestido' ? 'Vestido' : 'Na mochila'),
        ),
        efeito ? h('p', { class: 'jg-mi-efeito' }, efeito) : null,
        resumo ? h('p', { class: 'jg-mi-txt' }, resumo) : null,
        ...melhoriasDoItem(it),
        inf.ref ? h('p', { class: 'jg-det-meta' }, textoRef(inf.ref)) : null,
      ),
    );
    if (acoes.length) j.rodape.append(...acoes);
    else j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'ok', 'forte', () => j.fechar()));
  }

  /** As modificações e maldições do item: liga e desliga cada uma, e o servidor confere com a regra. */
  private modificar(uid: number) {
    const fs = this.fs;
    if (!fs) return;
    const i = fs.ficha.inventario.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const it = fs.ficha.inventario[i];
    const tem = [...(it.modificacoes ?? []).map((m) => `modificacao:${m}`), ...(it.maldicoes ?? []).map((m) => `maldicao:${m}`)];
    void escolher(
      {
        titulo: `Modificar: ${regras.nomeDoItem(it)}`,
        dica: 'Cada modificação sobe a categoria do item em I; a primeira maldição em II e as outras em I (LR p. 60 e 144). A patente precisa caber.',
        qtd: 20,
        podeVazio: true,
        opcoes: () => opcoesMelhoria(fs.ficha, i, 'todas', false),
        atual: () => tem,
        aplicar: (ids) => {
          for (const id of new Set([...tem, ...ids])) {
            const por = ids.includes(id);
            if (por === tem.includes(id)) continue;
            const [tipo, mid] = id.split(':') as ['modificacao' | 'maldicao', string];
            this.app.net.send({ t: 'mochilaMelhorar', fichaId: fs.id, uid, tipo, id: mid, por });
          }
        },
      },
      () => {},
    );
  }

  private entregar(it: regras.ItemFicha, nome: string) {
    const j = janela(`ENTREGAR ${nome.toUpperCase()}`, 'pessoa', () => {}, 34);
    j.corpo.append(
      h('p', { class: 'fj-dica' }, 'Para quem? O item sai da sua mochila na hora.'),
      h(
        'div',
        { class: 'jg-lista-escolha' },
        ...this.equipe.map((o) =>
          h('button', { class: 'fx-bt', type: 'button', onclick: () => (this.mochila(it.uid!, 'entregar', { para: o.id }), j.fechar()) }, ic('pessoa'), h('span', null, o.nome)),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- Ataques e jogadas prontas

  private abaAtaques(): Node[] {
    const fs = this.fs!;
    const c = this.calc!;
    const v = this.vit();
    const cartaoAtaque = (a: regras.Ataque) => {
      const it = a.uid !== undefined ? fs.ficha.inventario.find((x) => x.uid === a.uid) : undefined;
      const inf = it ? infoItem(it, c) : null;
      return h(
        'div',
        { class: `jg-atq${a.naMao ? ' mao' : ''}` },
        h('span', { class: 'jg-atq-arte' }, it && inf ? arteDoItem(it, inf.icone) : pintado('for', 'punho')),
        h(
          'span',
          { class: 'jg-atq-txt' },
          h('b', null, a.nome),
          h('span', { class: 'jg-atq-linha' }, h('em', null, a.pericia === 'pontaria' ? 'Pontaria' : 'Luta'), ` ${textoTesteAtaque(a)}`),
          h('span', { class: 'jg-atq-linha' }, h('em', null, 'Dano'), ` ${a.dano}`, h('em', null, ' · Crítico'), ` ${a.critico.margem}/×${a.critico.multiplicador}`, a.alcance ? h('em', null, ` · ${a.alcance}`) : null),
        ),
        h('span', { class: `jg-atq-lugar${a.naMao ? ' on' : ''}` }, a.naMao ? 'Na mão' : 'Guardada'),
      );
    };
    const jogadas = fs.jogadas ?? [];
    const cartaoJogada = (j: regras.Jogada) => {
      const r = regras.conferirJogada(fs.ficha, c, j, { peAtual: v.pe });
      return h(
        'button',
        { class: `jg-jog${r.ok ? '' : ' erro'}`, type: 'button', onclick: () => (sfx.paper(), this.editarJogada(j)) },
        h('span', { class: 'jg-jog-ic' }, pintado('combate-habilidade', 'estrela')),
        h('span', { class: 'jg-jog-txt' }, h('b', null, j.nome, r.pe ? h('em', { class: 'jg-selo pe' }, `${r.pe} PE`) : null), h('small', null, r.linhas[0] ?? ''), ...(r.erros.length ? [h('small', { class: 'jg-jog-erro' }, r.erros[0])] : [])),
        ic('direita'),
      );
    };
    return [
      this.titulo('ATAQUES', 'espadas'),
      h('div', { class: 'jg-atqs' }, ...c.ataques.map(cartaoAtaque)),
      this.titulo('JOGADAS PRONTAS', 'estrela', h('button', { class: 'jg-tit-bt', type: 'button', onclick: () => this.editarJogada(null) }, ic('mais'), h('span', null, 'Nova'))),
      jogadas.length
        ? h('div', { class: 'jg-lista' }, ...jogadas.map(cartaoJogada))
        : h('p', { class: 'jg-vazio' }, 'Monte o que você faz num ataque (a arma, os poderes e os PE) e dê um nome. No combate, o mestre escolhe a jogada e tudo já vem somado e conferido.'),
    ];
  }

  /** O montador da jogada: a arma, os poderes que gastam PE e o que cada um soma. O motor confere na hora. */
  private editarJogada(antiga: regras.Jogada | null) {
    const fs = this.fs!;
    const c = this.calc!;
    const j: regras.Jogada = antiga ? JSON.parse(JSON.stringify(antiga)) : { id: `j${Date.now().toString(36)}`, nome: '', passos: [], ...(c.ataques.find((a) => a.naMao && a.uid !== undefined)?.uid ? { arma: c.ataques.find((a) => a.naMao && a.uid !== undefined)!.uid } : {}) };
    const poderes = regras.poderesDaJogada(fs.ficha, c);
    const jan = janela(antiga ? 'JOGADA PRONTA' : 'NOVA JOGADA', 'estrela', () => {}, 56);
    jan.el.classList.add('tela-toda', 'jg-modal-jogada');
    const nome = h('input', { class: 'fx-inp', value: j.nome, maxlength: 60, placeholder: 'Ataque supremo shaolin' }) as HTMLInputElement;
    nome.addEventListener('input', () => ((j.nome = nome.value), conferir()));
    const nota = h('textarea', { class: 'fx-inp jg-jog-nota', maxlength: 300, placeholder: 'Uma linha para o mestre (opcional)' }) as HTMLTextAreaElement;
    nota.value = j.nota ?? '';
    nota.addEventListener('input', () => (j.nota = nota.value.trim() || undefined));
    const armas = h('div', { class: 'jg-jog-armas' });
    const passos = h('div', { class: 'jg-jog-passos' });
    const resultado = h('div', { class: 'jg-jog-res' });
    const salvar = botao('Salvar', 'salvar', 'forte', () => {
      j.nome = j.nome.trim();
      this.mudar((f) => {
        const lista = (f.jogadas ?? []).filter((x) => x.id !== j.id);
        f.jogadas = [...lista, j].slice(0, regras.MAX_JOGADAS);
      });
      toast('Jogada salva.');
      jan.fechar();
    });
    const desenharArmas = () =>
      armas.replaceChildren(
        ...c.ataques.map((a) => {
          const on = (j.arma ?? undefined) === a.uid;
          const it = a.uid !== undefined ? fs.ficha.inventario.find((x) => x.uid === a.uid) : undefined;
          return h(
            'button',
            { class: `jg-jog-arma${on ? ' on' : ''}`, type: 'button', onclick: () => (sfx.click(), a.uid === undefined ? delete j.arma : (j.arma = a.uid), desenharArmas(), conferir()) },
            h('span', { class: 'jg-jog-arma-arte' }, it ? arteDoItem(it, infoItem(it, c).icone) : pintado('for', 'punho')),
            h('small', null, a.nome),
          );
        }),
      );
    const stepper = (rot: string, valor: number, passo: number, min: number, max: number, mudar: (n: number) => void) =>
      h(
        'div',
        { class: 'jg-step' },
        h('small', null, rot),
        h('button', { type: 'button', class: 'fc-pm', disabled: valor - passo < min, onclick: () => (mudar(valor - passo), desenharPassos(), conferir()) }, ic('menos')),
        h('b', null, `${valor >= 0 && rot !== 'PE' ? '+' : ''}${valor}`),
        h('button', { type: 'button', class: 'fc-pm', disabled: valor + passo > max, onclick: () => (mudar(valor + passo), desenharPassos(), conferir()) }, ic('mais')),
      );
    const desenharPassos = () =>
      passos.replaceChildren(
        ...(poderes.length
          ? poderes.map(({ poder, custo, escala }) => {
              const passo = j.passos.find((x) => x.poder === poder.id);
              const ligar = () => {
                sfx.click();
                if (passo) j.passos = j.passos.filter((x) => x !== passo);
                else j.passos.push(escala ? { poder: poder.id, pe: escala[0].pe, ataque: escala[0].bonus } : { poder: poder.id, pe: custo });
                desenharPassos();
                conferir();
              };
              const corpo: Node[] = [];
              if (passo && escala) {
                const degrau = escala.find((e) => e.pe === passo.pe) ?? escala[0];
                corpo.push(
                  h('div', { class: 'jg-jog-degraus' }, ...escala.map((e) => h('button', { type: 'button', class: `fc-chip${e.pe === passo.pe ? ' on' : ''}`, onclick: () => ((passo.pe = e.pe), (passo.ataque = e.bonus), (passo.dano = 0), desenharPassos(), conferir()) }, `${e.pe} PE: +${e.bonus}`))),
                  stepper('No ataque', passo.ataque ?? 0, 5, 0, degrau.bonus, (n) => ((passo.ataque = n), (passo.dano = degrau.bonus - n))),
                  h('p', { class: 'jg-jog-dica' }, `No dano: +${degrau.bonus - (passo.ataque ?? 0)} (o resto dos +${degrau.bonus})`),
                );
              } else if (passo) {
                corpo.push(
                  stepper('PE', passo.pe, 1, custo, 20, (n) => (passo.pe = n)),
                  stepper('No ataque', passo.ataque ?? 0, 1, -20, 20, (n) => (passo.ataque = n || undefined)),
                  stepper('No dano', passo.dano ?? 0, 1, -20, 20, (n) => (passo.dano = n || undefined)),
                  h(
                    'label',
                    { class: 'jg-jog-dados' },
                    h('small', null, 'Dados a mais no dano'),
                    Object.assign(h('input', { class: 'fx-inp', value: passo.danoDados ?? '', maxlength: 8, placeholder: '1d6' }) as HTMLInputElement, {
                      oninput: (e: Event) => ((passo.danoDados = (e.target as HTMLInputElement).value.trim() || undefined), conferir()),
                    }),
                  ),
                  h('p', { class: 'jg-jog-dica' }, 'O livro não dá número fixo para isso aqui: o mestre confere o que você escrever.'),
                );
              }
              return h(
                'div',
                { class: `jg-jog-passo${passo ? ' on' : ''}` },
                h('button', { type: 'button', class: 'jg-jog-passo-cab', onclick: ligar }, h('span', { class: 'jg-jog-check' }, passo ? ic('ok') : null), h('b', null, poder.nome), h('em', { class: 'jg-selo pe' }, escala ? `${escala.map((e) => e.pe).join('/')} PE` : `${custo} PE`)),
                ...corpo,
              );
            })
          : [h('p', { class: 'jg-vazio' }, 'Nenhum poder que gaste PE na ficha ainda. A jogada pode ser só a arma.')]),
      );
    const conferir = () => {
      const r = regras.conferirJogada(fs.ficha, c, j, { peAtual: this.vit().pe });
      // o PE de agora pode mudar até o combate: aqui só o que é regra trava
      const travas = r.erros.filter((e) => !/^Faltam PE/.test(e));
      resultado.replaceChildren(
        h('h4', null, 'Como fica'),
        ...r.linhas.map((l) => h('p', null, l)),
        h('p', { class: 'jg-jog-total' }, `Total: ${r.pe} PE (limite ${c.limitePe} por turno)`),
        ...r.erros.map((e) => h('p', { class: 'jg-jog-erro' }, ic('fechar'), e)),
        ...r.avisos.map((e) => h('p', { class: 'jg-jog-aviso' }, ic('alerta'), e)),
      );
      (salvar as HTMLButtonElement).disabled = !j.nome.trim() || travas.length > 0;
    };
    jan.corpo.append(
      h('label', { class: 'fc-campo' }, h('span', null, 'Nome da jogada'), nome),
      h('div', { class: 'fc-campo' }, h('span', null, 'A arma'), armas),
      h('div', { class: 'fc-campo' }, h('span', null, 'Os poderes (toque para usar)'), passos),
      h('label', { class: 'fc-campo' }, h('span', null, 'Nota'), nota),
      resultado,
    );
    if (antiga)
      jan.rodape.append(
        botao('Apagar', 'lixo', 'perigo', async () => {
          if (!(await confirmar('APAGAR A JOGADA?', `"${antiga.nome}" sai da lista.`, 'Apagar', true))) return;
          this.mudar((f) => (f.jogadas = (f.jogadas ?? []).filter((x) => x.id !== antiga.id)));
          jan.fechar();
        }),
      );
    jan.rodape.append(botao('Cancelar', 'fechar', '', () => jan.fechar()), salvar);
    desenharArmas();
    desenharPassos();
    conferir();
  }

  // ---------------------------------------------------------------- Poderes

  private abaPoderes(): Node[] {
    const c = this.calc!;
    const f = this.fs!.ficha;
    const filtros = FILTROS_PODER.filter((x) => c.poderes.some((p) => x.tipos.includes(p.tipo)));
    if (!filtros.some((x) => x.id === this.filtroPoder) && filtros.length) this.filtroPoder = filtros[0].id;
    const filtro = FILTROS_PODER.find((x) => x.id === this.filtroPoder)!;
    const lista = c.poderes.filter((p) => filtro.tipos.includes(p.tipo));
    const linhas = lista.map((p) => {
      const info = this.infoPoder(p);
      return h(
        'button',
        { class: `jg-linha${this.poderSel === p.id ? ' on' : ''}`, type: 'button', onclick: () => ((this.poderSel = this.poderSel === p.id ? null : p.id), (this.focarDetalhe = true), sfx.click(), this.renderConteudo()) },
        h('span', { class: 'jg-linha-ic' }, pintado(filtro.pintado, filtro.icone)),
        h('span', { class: 'jg-linha-txt' }, h('span', { class: 'jg-linha-n' }, p.nome, h('em', { class: `jg-selo${info.custo ? ' pe' : ''}` }, info.custo ? `${info.custo} PE` : 'Passivo')), info.resumo ? h('small', null, info.resumo) : null),
        ic('direita'),
      );
    });
    const sel = lista.find((p) => p.id === this.poderSel);
    const nomeGrupo: Record<FiltroPoder, string> = {
      classe: f.classe ? cat.classe(f.classe).nome : 'Classe',
      trilha: (f.trilha && cat.trilha(f.trilha)?.nome) || 'Trilha',
      origem: (f.origem && cat.origem(f.origem)?.nome) || 'Origem',
      paranormal: 'Paranormal',
    };
    const partes: (HTMLElement | null)[] = [
      this.titulo('PODERES', 'estrela'),
      filtros.length > 1
        ? h(
            'div',
            { class: 'jg-filtros' },
            ...filtros.map((x) =>
              h('button', { class: `jg-filtro${x.id === this.filtroPoder ? ' on' : ''}`, type: 'button', onclick: () => ((this.filtroPoder = x.id), (this.poderSel = null), sfx.click(), this.renderConteudo()) }, pintado(x.pintado, x.icone), h('span', null, x.rotulo)),
            ),
          )
        : null,
      lista.length
        ? h('div', { class: 'jg-lista' }, ...lista.flatMap((p, i) => (p === sel ? [linhas[i], this.detalhePoder(p, nomeGrupo[filtro.id], filtro.icone, filtro.pintado)] : [linhas[i]])))
        : h('p', { class: 'jg-vazio' }, 'Sem poderes ainda.'),
    ];
    return partes.filter((x): x is HTMLElement => !!x);
  }

  private infoPoder(p: regras.PoderObtido) {
    const def = cat.poder(p.id) ?? cat.paranormal(p.id);
    const hab = def ? undefined : buscaHabilidade(p.id);
    const resumo = (def as { resumo?: string } | undefined)?.resumo ?? hab?.resumo ?? '';
    const custo = (def as { custoPe?: number } | undefined)?.custoPe ?? hab?.custoPe;
    const ref = def?.ref ?? hab?.ref;
    const efeitos = p.efeitos.filter((e) => e.alvo !== 'nota').map((e) => regras.textoEfeito(e) + (e.condicional ? ` (${e.condicional})` : ''));
    const notas = p.efeitos.filter((e): e is Extract<regras.Efeito, { alvo: 'nota' }> => e.alvo === 'nota').map((e) => e.texto);
    return { resumo, custo, ref, efeitos, notas };
  }

  private detalhePoder(p: regras.PoderObtido, grupo: string, icone: NomeIcone, pint: string): HTMLElement {
    const info = this.infoPoder(p);
    const bloco = (titulo: string, ico: NomeIcone, ...txt: (string | null | undefined)[]) => {
      const t = txt.filter((x): x is string => !!x);
      return t.length ? h('div', { class: 'jg-bloco' }, h('h4', null, ic(ico), titulo), ...t.map((x) => h('p', null, x))) : null;
    };
    return h(
      'article',
      { class: 'jg-det jg-det-poder' },
      h('div', { class: 'jg-det-cab' }, h('span', { class: 'jg-linha-ic grande' }, pintado(pint, icone)), h('div', null, h('h3', null, p.nome), h('p', { class: 'jg-det-meta' }, `${NOME_TIPO_PODER[p.tipo]} · ${grupo}`)), h('em', { class: `jg-selo grande${info.custo ? ' pe' : ''}` }, info.custo ? `${info.custo} PE` : 'Passivo')),
      h(
        'div',
        { class: 'jg-blocos' },
        bloco('O que faz', 'livro', info.resumo || null, ...info.notas),
        bloco('Efeitos', 'alvo', info.efeitos.length ? info.efeitos.join('; ') + '.' : null),
        bloco('De onde', 'pino', `NEX ${p.nex}%${p.via ? ` (${p.via})` : ''}.`, info.ref ? textoRef(info.ref) : null),
      ),
    );
  }

  // ---------------------------------------------------------------- Rituais

  private abaRituais(): Node[] {
    const fs = this.fs!;
    const c = this.calc!;
    const fav = new Set(fs.favoritos ?? []);
    const rituais = c.rituais
      .map((r) => cat.ritual(r.id))
      .filter((r): r is regras.Ritual => !!r)
      .sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)) || a.circulo - b.circulo || a.nome.localeCompare(b.nome));
    const conta = (r: regras.Ritual) => c.custoRituais[r.id] ?? { pe: [0, 1, 3, 6, 10][r.circulo], dt: c.dtRituais };
    const estrela = (r: regras.Ritual) =>
      h(
        'button',
        {
          class: `jg-estrela${fav.has(r.id) ? ' on' : ''}`,
          type: 'button',
          title: fav.has(r.id) ? 'Tirar dos favoritos' : 'Marcar favorito',
          'aria-pressed': String(fav.has(r.id)),
          onclick: (e: Event) => {
            e.stopPropagation();
            sfx.click();
            this.mudar((f) => {
              const s = new Set(f.favoritos ?? []);
              if (s.has(r.id)) s.delete(r.id);
              else s.add(r.id);
              f.favoritos = [...s];
            });
          },
        },
        ic('estrela'),
      );
    const campo = (rot: string, icone: NomeIcone, valor: string) => h('span', { class: 'jg-rit-campo' }, h('small', null, rot), h('b', null, ic(icone), valor));
    const cards = rituais.map((r) => {
      const k = conta(r);
      return h(
        'div',
        { class: `jg-rit${this.ritualSel === r.id ? ' on' : ''}`, role: 'button', tabindex: 0, style: `--cor:${COR_ELEMENTO[r.elemento]}`, onclick: () => ((this.ritualSel = this.ritualSel === r.id ? null : r.id), (this.focarDetalhe = true), sfx.click(), this.renderConteudo()) },
        h('span', { class: 'jg-rit-arte' }, arteOu([`/arte/rituais/${r.id}.png`, `/arte/icones/sigilo-${r.elemento}.png`], ic('pentagrama'))),
        h(
          'span',
          { class: 'jg-rit-txt' },
          h('span', { class: 'jg-rit-n' }, r.nome),
          h('span', { class: 'jg-rit-campos' }, campo('Círculo', 'mais3', `${r.circulo}º`), campo('Custo', 'raio', `${k.pe} PE`), campo('Execução', 'ampulheta', r.execucao), campo('Alcance', 'alvo', r.alcance), campo('DT', 'olho', r.resistencia ? String(k.dt) : '—')),
        ),
        estrela(r),
      );
    });
    const sel = rituais.find((r) => r.id === this.ritualSel);
    return [
      this.titulo('RITUAIS', 'pentagrama'),
      rituais.length
        ? h('div', { class: 'jg-rits' }, ...rituais.flatMap((r, i) => (r === sel ? [cards[i], this.detalheRitual(r, conta(r), fav.has(r.id), estrela(r))] : [cards[i]])))
        : h('p', { class: 'jg-vazio' }, 'Sem rituais. Eles vêm do ocultista ou do poder Aprender Ritual.'),
    ].filter(Boolean) as HTMLElement[];
  }

  private detalheRitual(r: regras.Ritual, k: { pe: number; dt: number }, fav: boolean, estrela: HTMLElement): HTMLElement {
    const linha = (rot: string, valor: string) => h('span', { class: 'jg-rit-campo' }, h('small', null, rot), h('b', null, valor));
    const extras = [
      r.discente ? `Discente: +${r.discente.custoExtra} PE${r.discente.circulo ? `, ${r.discente.circulo}º círculo` : ''}.` : '',
      r.verdadeiro ? `Verdadeiro: +${r.verdadeiro.custoExtra} PE${r.verdadeiro.circulo ? `, ${r.verdadeiro.circulo}º círculo` : ''}${r.verdadeiro.afinidade ? ', com afinidade' : ''}.` : '',
    ].filter(Boolean);
    return h(
      'article',
      { class: 'jg-det jg-det-rit', style: `--cor:${COR_ELEMENTO[r.elemento]}` },
      h('div', { class: 'jg-rit-arte grande' }, arteOu([`/arte/rituais/${r.id}.png`, `/arte/icones/sigilo-${r.elemento}.png`], ic('pentagrama'))),
      h(
        'div',
        { class: 'jg-det-txt' },
        h('h3', null, r.nome),
        h('p', { class: 'jg-det-meta' }, `${NOME_ELEMENTO[r.elemento]} · ${r.circulo}º círculo${r.alvo ? ` · ${r.alvo}` : ''} · ${r.duracao}`),
        ...extras.map((x) => h('p', null, x)),
        h('p', { class: 'jg-det-meta' }, textoRef(r.ref)),
      ),
      h('div', { class: 'jg-rit-campos largo' }, linha('Execução', r.execucao), linha('Alcance', r.alcance), linha('Resistência', r.resistencia ?? '—'), linha('DT', r.resistencia ? String(k.dt) : '—'), linha('Custo', `${k.pe} PE`)),
      h('div', { class: 'jg-det-bts' }, estrela, h('span', null, fav ? 'Favorito' : 'Marcar favorito')),
    );
  }

  // ---------------------------------------------------------------- Docs

  private abaDocs(): Node[] {
    const fs = this.fs!;
    const lista = this.docs
      .filter((d) => this.filtroDoc === 'todos' || d.grupo === this.filtroDoc)
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    if (this.docSel !== null && !this.docs.some((d) => d.id === this.docSel)) this.docSel = null;
    const filtros: { id: GrupoDocumento | 'todos'; rotulo: string; icone: NomeIcone; pintado: string | string[] }[] = [
      { id: 'todos', rotulo: 'Todos', icone: 'documento', pintado: IC.docsTodos },
      { id: 'evidencia', rotulo: 'Evidências', icone: 'lupa', pintado: IC.docsEvidencias },
      { id: 'pista', rotulo: 'Pistas', icone: 'mapa', pintado: IC.docsPistas },
    ];
    const meta = (d: Documento) => [nomeTipoDocumento(d.tipo), d.origem, `${d.paginas.length} página${d.paginas.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    const linhas = lista.map((d) =>
      h(
        'button',
        { class: `jg-doc${this.docSel === d.id ? ' on' : ''}`, type: 'button', onclick: () => ((this.docSel = this.docSel === d.id ? null : d.id), (this.focarDetalhe = true), sfx.paper(), this.renderConteudo()) },
        h('span', { class: 'jg-doc-mini' }, d.imagem ? h('img', { src: d.imagem, alt: '', loading: 'lazy', decoding: 'async' }) : ic(ICONE_DOC[d.tipo])),
        h('span', { class: 'jg-linha-txt' }, h('span', { class: 'jg-linha-n' }, d.titulo, d.marcadoPor?.includes(fs.id) ? h('em', { class: 'jg-marca' }, ic('pino')) : null), h('small', null, meta(d))),
        ic('direita'),
      ),
    );
    const sel = this.docs.find((d) => d.id === this.docSel);
    return [
      this.titulo('DOCUMENTOS', 'documento'),
      h(
        'div',
        { class: 'jg-filtros' },
        ...filtros.map((x) =>
          h('button', { class: `jg-filtro${x.id === this.filtroDoc ? ' on' : ''}`, type: 'button', onclick: () => ((this.filtroDoc = x.id), sfx.click(), this.renderConteudo()) }, pintado(x.pintado, x.icone), h('span', null, x.rotulo)),
        ),
      ),
      lista.length
        ? h('div', { class: 'jg-lista' }, ...lista.flatMap((d, i) => (d === sel ? [linhas[i], this.detalheDoc(d, meta(d))] : [linhas[i]])))
        : h('p', { class: 'jg-vazio' }, this.docs.length ? 'Nada neste filtro.' : 'Nenhum documento ainda. O que o mestre entregar (relatórios, fotos, pistas) aparece aqui.'),
    ].filter(Boolean) as HTMLElement[];
  }

  private detalheDoc(d: Documento, meta: string): HTMLElement {
    const fs = this.fs!;
    const marcado = !!d.marcadoPor?.includes(fs.id);
    const previa = d.paginas.find((p) => p.trim()) ?? '';
    return h(
      'article',
      { class: 'jg-det jg-det-doc' },
      d.imagem ? h('button', { class: 'jg-det-arte', type: 'button', title: 'Ler', onclick: () => this.lerDoc(d) }, h('img', { src: d.imagem, alt: '' })) : h('div', { class: 'jg-det-arte' }, ic(ICONE_DOC[d.tipo])),
      h('div', { class: 'jg-det-txt' }, h('h3', null, d.titulo), h('p', { class: 'jg-det-meta' }, meta), previa ? h('p', { class: 'jg-doc-previa' }, previa.length > 320 ? `${previa.slice(0, 320)}…` : previa) : null),
      h(
        'div',
        { class: 'jg-det-bts' },
        botao('Ler', 'livro', 'forte', () => this.lerDoc(d)),
        botao(marcado ? 'Marcado' : 'Marcar', 'pino', marcado ? 'on' : '', () => this.app.net.send({ t: 'docMarcar', id: d.id, marcado: !marcado })),
        d.equipe
          ? h('span', { class: 'jg-equipe-ok' }, ic('ok'), 'Com a equipe')
          : botao('Mover para equipe', 'pessoa', '', async () => {
              if (await confirmar('PASSAR PARA A EQUIPE?', `Todos os agentes passam a ver "${d.titulo}". Não dá para desfazer.`, 'Passar')) this.app.net.send({ t: 'docEquipe', id: d.id });
            }),
      ),
    );
  }

  /** O documento inteiro, página por página, na tela toda. */
  private lerDoc(d: Documento) {
    sfx.paper();
    let pag = 0;
    const j = janela(d.titulo.toUpperCase(), 'documento', () => {}, 60);
    j.el.classList.add('tela-toda', 'jg-leitor');
    const pagina = h('div', { class: 'jg-pagina' });
    const cont = h('span', { class: 'jg-pag-n' });
    const ant = botao('Anterior', 'esquerda', '', () => ir(-1));
    const prox = botao('Próxima', 'direita', 'forte', () => ir(1));
    const ir = (n: number) => {
      pag = Math.max(0, Math.min(d.paginas.length - 1, pag + n));
      sfx.paper();
      desenhar();
    };
    const desenhar = () => {
      pagina.replaceChildren(...(pag === 0 && d.imagem ? [h('img', { class: 'jg-pagina-img', src: d.imagem, alt: '' })] : []), ...d.paginas[pag].split(/\n{2,}/).map((p) => h('p', null, p)));
      cont.textContent = d.paginas.length > 1 ? `Página ${pag + 1} de ${d.paginas.length}` : '';
      ant.disabled = pag === 0;
      prox.disabled = pag >= d.paginas.length - 1;
    };
    j.corpo.append(pagina);
    if (d.paginas.length > 1) j.rodape.append(ant, cont, prox);
    else j.rodape.append(h('span', { class: 'fj-esp' }), botao('Fechar', 'ok', 'forte', () => j.fechar()));
    desenhar();
  }

  // ---------------------------------------------------------------- Notas

  private abaNotas(): Node[] {
    const fs = this.fs!;
    const todas = [...(fs.diario ?? [])].sort((a, b) => Number(!!b.fixada) - Number(!!a.fixada) || b.em.localeCompare(a.em));
    const lista = this.soFixadas ? todas.filter((n) => n.fixada) : todas;
    if (this.notaSel && !todas.some((n) => n.id === this.notaSel)) this.notaSel = null;
    const linhas = lista.map((n) =>
      h(
        'button',
        { class: `jg-nota${this.notaSel === n.id ? ' on' : ''}`, type: 'button', onclick: () => ((this.notaSel = this.notaSel === n.id ? null : n.id), (this.focarDetalhe = true), sfx.paper(), this.renderConteudo()) },
        ic('documento'),
        h('span', { class: 'jg-linha-txt' }, h('span', { class: 'jg-linha-n' }, n.titulo || 'Sem título'), h('small', null, quando(n.em))),
        n.fixada ? h('em', { class: 'jg-marca' }, ic('pino')) : null,
        ic('direita'),
      ),
    );
    const sel = todas.find((n) => n.id === this.notaSel);
    const filtro = (fix: boolean, rotulo: string, icone: NomeIcone, pint: string | string[]) =>
      h('button', { class: `jg-filtro${this.soFixadas === fix ? ' on' : ''}`, type: 'button', onclick: () => ((this.soFixadas = fix), sfx.click(), this.renderConteudo()) }, pintado(pint, icone), h('span', null, rotulo));
    return [
      this.titulo('NOTAS', 'pena', h('button', { class: 'jg-tit-bt', type: 'button', onclick: () => this.novaNota() }, ic('mais'), h('span', null, 'Nova nota'))),
      h('div', { class: 'jg-filtros dois' }, filtro(false, 'Recentes', 'ampulheta', IC.notasRecentes), filtro(true, 'Fixadas', 'pino', IC.notasFixadas)),
      lista.length
        ? h('div', { class: 'jg-lista' }, ...lista.flatMap((n, i) => (n === sel ? [linhas[i], this.editorNota(n)] : [linhas[i]])))
        : h('p', { class: 'jg-vazio' }, this.soFixadas ? 'Nenhuma nota fixada.' : 'Nenhuma nota. Anote pistas, nomes e portas trancadas: só você e o mestre veem.'),
    ].filter(Boolean) as HTMLElement[];
  }

  private novaNota() {
    sfx.paper();
    const n: NotaDiario = { id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, titulo: '', texto: '', em: agora() };
    this.notaSel = n.id;
    this.soFixadas = false;
    this.mudar((fs) => (fs.diario = [n, ...(fs.diario ?? [])].slice(0, 200)));
    (this.conteudo.querySelector('.jg-nota-tit') as HTMLInputElement | null)?.focus();
  }

  private editorNota(n: NotaDiario): HTMLElement {
    const titulo = h('input', { class: 'fx-inp jg-nota-tit', value: n.titulo, maxlength: 80, placeholder: 'Título' }) as HTMLInputElement;
    const texto = h('textarea', { class: 'fx-inp jg-nota-txt', maxlength: 4000, placeholder: 'Escreva aqui…' }) as HTMLTextAreaElement;
    texto.value = n.texto;
    const gravar = (extra: Partial<NotaDiario> = {}, redesenhar = true) =>
      this.mudar((fs) => {
        const alvo = fs.diario?.find((x) => x.id === n.id);
        if (!alvo) return;
        Object.assign(alvo, { titulo: titulo.value.trim(), texto: texto.value, em: agora() }, extra);
        if (alvo.fixada === undefined) delete alvo.fixada;
      }, redesenhar);
    // grava sozinho enquanto escreve (sem redesenhar, para não perder o cursor)
    titulo.addEventListener('input', () => gravar({}, false));
    texto.addEventListener('input', () => gravar({}, false));
    return h(
      'article',
      { class: 'jg-det jg-det-nota' },
      h(
        'div',
        { class: 'jg-nota-cab' },
        titulo,
        h('span', { class: 'jg-det-meta' }, quando(n.em)),
        h(
          'button',
          {
            class: 'jg-lixo',
            type: 'button',
            title: 'Apagar a nota',
            'aria-label': 'Apagar a nota',
            onclick: async () => {
              if (!(await confirmar('APAGAR A NOTA?', `"${n.titulo || 'Sem título'}" some de vez.`, 'Apagar', true))) return;
              this.notaSel = null;
              this.mudar((fs) => (fs.diario = (fs.diario ?? []).filter((x) => x.id !== n.id)));
            },
          },
          ic('lixo'),
        ),
      ),
      texto,
      h(
        'div',
        { class: 'jg-det-bts' },
        botao('Salvar', 'salvar', '', () => (gravar(), toast('Nota salva.'))),
        botao(n.fixada ? 'Desafixar' : 'Fixar', 'pino', n.fixada ? 'on' : '', () => gravar({ fixada: !n.fixada || undefined })),
        botao('Nova nota', 'mais', 'forte', () => (gravar(), this.novaNota())),
      ),
    );
  }
}

function buscaHabilidade(id: string): regras.Habilidade | undefined {
  for (const c of cat.CATALOGO.classes) for (const x of c.habilidades) if (x.id === id) return x;
  for (const t of cat.CATALOGO.trilhas) for (const x of t.habilidades) if (x.id === id) return x;
  for (const o of cat.CATALOGO.origens) if (o.poder.id === id) return o.poder;
  return undefined;
}


/** "4d20+5" (com a penalidade de dados, "2d20 (pior)"). */
function textoTesteAtaque(a: regras.Ataque): string {
  const r = regras.rolagem(a.dados, a.penalidadeDados);
  return `${r.dados}d20${a.bonus ? (a.bonus > 0 ? `+${a.bonus}` : `${a.bonus}`) : ''}${r.fica === 'menor' ? ' (pior)' : ''}`;
}

/** A cor da maldição do item (a do primeiro elemento): a aura da arte. */
function auraDoItem(it: regras.ItemFicha): string | null {
  const m = it.maldicoes?.[0];
  return m ? (cat.maldicao(m)?.elemento ?? 'medo') : it.tipo === 'amaldicoado' ? 'medo' : null;
}

/** Um selinho por modificação (até três e o "+N"), no canto da arte. */
function selosDoItem(it: regras.ItemFicha): HTMLElement | null {
  const mods = it.modificacoes ?? [];
  if (!mods.length) return null;
  return h(
    'span',
    { class: 'jg-selos', title: mods.map((m) => cat.modificacao(m)?.nome ?? m).join(', ') },
    ...mods.slice(0, 3).map(() => h('i', { class: 'jg-selo-mod' }, pintado('combate-habilidade', 'engrenagem'))),
    mods.length > 3 ? h('i', { class: 'jg-selo-mais' }, `+${mods.length - 3}`) : null,
  );
}

/** As modificações e maldições no modal do item: o nome e o que fazem. */
function melhoriasDoItem(it: regras.ItemFicha): HTMLElement[] {
  const linhas = [
    ...(it.modificacoes ?? []).map((m) => ({ nome: cat.modificacao(m)?.nome ?? m, cls: 'mod', texto: (cat.modificacao(m) as { resumo?: string } | undefined)?.resumo ?? '' })),
    ...(it.maldicoes ?? []).map((m) => ({ nome: cat.maldicao(m)?.nome ?? m, cls: `mal ${cat.maldicao(m)?.elemento ?? ''}`, texto: cat.maldicao(m) ? `Maldição de ${NOME_ELEMENTO[cat.maldicao(m)!.elemento]}` : '' })),
  ];
  if (!linhas.length) return [];
  return [h('div', { class: 'jg-mi-mods' }, ...linhas.map((l) => h('p', { class: `jg-mi-mod ${l.cls}` }, h('b', null, l.nome), l.texto ? ` · ${l.texto}` : '')))];
}
