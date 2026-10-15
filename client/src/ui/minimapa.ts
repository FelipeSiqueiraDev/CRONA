import { montarLocais, nomeCurto, parseHeightmap, type CampaignState, type FloorStyle, type Heightmap, type Locais, type LocalPredio, type SceneInfo } from '@crona/shared';
import { clear, h } from './dom';
import { ic } from './icons';
import { reduced, wait } from './motion';
import { sfx } from './sfx';

/**
 * O minimapa da tela MAPA: a planta do lugar em níveis, Terreno › Prédio › Andar › Cômodo.
 *
 * - No terreno (a cena ao ar livre), o mapa em pixel art na paleta da noite do HUD: o chão,
 *   as árvores, a cerca, as plantações, os prédios com o telhado e a plaquinha, as saídas e
 *   as peças. O visual é o do HUD do CRONA (hud.css): azul-noite, borda bege, ouro no lugar
 *   do grupo, plaquinhas arredondadas em letra pixel e as peças como pontos de luz.
 * - Clicar num prédio desce até ele (o mapa dá zoom no telhado e vira a planta do andar);
 *   a escada (▲ ▼) troca o andar; o botão ‹, o direito ou a roda para trás sobem. O botão
 *   das camadas abre a lista de todos os lugares, prédio por prédio, andar por andar.
 * - Clicar num cômodo só olha (o cartão embaixo diz o que é e quem está); "Entrar" ou o
 *   clique duplo levam a cena (o tabuleiro e a mesa vão junto, as peças ficam); "Levar o
 *   grupo" leva também as peças dos agentes, de onde estiverem, e no cartão o mestre tira
 *   quem fica (o grupo dividido). Arrastar a peça de um lugar para outro leva só ela.
 * - O que nenhum agente pisou ainda fica apagado (não visitado); o mestre marca e limpa.
 *
 * Tudo sai das cenas (`montarLocais`, em shared/src/locais.ts): mapa novo ganha minimapa
 * sozinho, sem arte de cada mapa.
 */

export interface MinimapaHost {
  campanha(): CampaignState | null;
  cenaAtual(): number | undefined;
  /** o mestre: arrasta as peças de um lugar para outro e marca as visitas */
  mestre(): boolean;
  ir(id: number): void;
  /**
   * as peças vão para a cena: sem `tokens`, todos os agentes; `entrar` (padrão sim) leva
   * também o mestre e a mesa
   */
  levar(roomId: number, tokens?: number[], entrar?: boolean): void;
  /** o mestre marca a cena (null = todas da campanha) como visitada ou não */
  marcarVisita(roomId: number | null, visitada: boolean): void;
  /** o personagem é de um agente (tem ficha): só esses vão no "Levar o grupo" */
  ehAgente(charId: number | null | undefined): boolean;
  /** o mestre nomeia (ou renomeia, ou apaga com texto vazio) uma área do terreno: x e y em casas */
  nomearArea(cena: number, x: number, y: number, texto: string, id?: number): void;
}

type Vista = { tipo: 'terreno'; cena: number } | { tipo: 'predio'; predio: string; andar: string };
type Caixa = { x: number; y: number; w: number; h: number };
interface Alvo extends Caixa {
  tipo: 'cena' | 'predio' | 'saida' | 'andar' | 'peca';
  id: number | string;
  nome: string;
  forma?: Path2D;
  /** a peça: a cena onde ela está */
  cena?: number;
}
interface Anim {
  terreno: Vista;
  predio: Vista;
  /** o prédio no desenho do terreno */
  R: Caixa;
  /** 1 = descendo para o prédio, -1 = subindo para o terreno */
  dir: 1 | -1;
  t0: number;
  dur: number;
}

const PAD = 10;
/** pixels da arte por casa: o mapa é desenhado pequeno e ampliado sem suavizar */
const P = 4;
const FONTE = '"Pixel Letras", "Pixelify Sans", "Ubuntu Mono", monospace';
/**
 * As cores do HUD do CRONA (os tokens --r-* de retro.css e hud.css): azul-noite, borda bege,
 * texto creme e o ouro, que marca o lugar do grupo.
 */
const HUD = {
  noite: '#050b14',
  fundo: 'rgba(5,11,20,0.88)',
  granito: '#13233d',
  borda: '#a18873',
  bordaFraca: 'rgba(161,136,115,0.65)',
  texto: '#f3e9d8',
  fraco: '#a3978a',
  ouro: '#e9a944',
  aqui: '#ffd27a',
  sel: '#9cc4f0',
};
/** A cor de cada piso na planta, escurecida para o azul-noite do HUD (a sala se acha de olho). */
const COR_PISO: Partial<Record<FloorStyle, string>> = {
  pedra: '#2b2f37',
  concreto: '#2a3038',
  bloco: '#2d323a',
  cela: '#23272e',
  madeira: '#3b2a1f',
  taco: '#4a3524',
  ladrilho: '#33424f',
  cozinha_fazenda: '#33424f',
  enxaimel: '#3b2a1f',
  ferraria: '#2a2622',
  queimado_madeira: '#352a22',
  queimado_xadrez: '#33343a',
  queimado_concreto: '#2a2c30',
  xadrez: '#2c3c52',
  azulejo: '#1d3d58',
  carpete: '#3b2456',
  musgo: '#253a2c',
  metal: '#2c3540',
  selo: '#3a3024',
  calabouco: '#25282d',
  pier: '#43372a',
};
/** A letra cresce na planta grande (a janela da tecla M); vale para o quadro que está sendo desenhado. */
let K = 1;
const fs = (n: number) => Math.round(n * K * 10) / 10;
/** metros por casa (M_POR_CASA) */
const M_CASA = 0.75;

/** Ruído fixo de uma casa (sempre o mesmo desenho para o mesmo mapa). */
function ruido(x: number, y: number, k = 0) {
  const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

const mesma = (a: Vista | null, b: Vista | null) =>
  !!a && !!b && a.tipo === b.tipo && (a.tipo === 'terreno' ? a.cena === (b as typeof a).cena : a.predio === (b as typeof a).predio && a.andar === (b as typeof a).andar);

export class Minimapa {
  readonly trilha = h('div', { class: 'mm-trilha' });
  readonly canvas = h('canvas', { class: 'plan-canvas mm-canvas' });
  readonly cartao = h('div', { class: 'mm-cartao hidden' });
  readonly botoes = h('div', { class: 'mm-botoes' });

  private locais: Locais | null = null;
  private sigLocais = '';
  private vista: Vista | null = null;
  /** acompanha a cena aberta (deixa de acompanhar quando o mestre sai olhando) */
  private seguindo = true;
  private ultimaCena: number | undefined = undefined;
  private sel: { tipo: 'cena'; id: number } | null = null;
  private hover = '';
  private alvos: Alvo[] = [];
  private anim: Anim | null = null;
  private raf = 0;
  private hatch = { room: -1, t: 1 };
  private fade = { room: -1, t: 1 };
  /** a peça arrastada no minimapa (leva só ela para onde soltar) */
  private arraste: { token: number; de: number; sx: number; sy: number; x: number; y: number; moved: boolean } | null = null;
  /** no cartão: os agentes que o mestre tirou do "Levar" (ficam onde estão) */
  private ficam = new Set<number>();
  private cartaoDe = -1;
  /** escala e origem do andar desenhado agora (para arrastar cômodos) */
  private S = 6;
  private O = { x: 0, y: 0 };
  private hms = new Map<string, Heightmap>();
  /** o terreno em pixel art, pronto (só muda quando o mapa muda) */
  private camadas = new Map<number, { sig: string; c: HTMLCanvasElement }>();

  constructor(
    private host: MinimapaHost,
    private opc: { grande?: boolean } = {},
  ) {
    this.ligar();
  }

  // ------------------------------------------------------------------ estado

  /** A campanha ou a cena mudou: refaz os níveis e volta para onde o grupo está. */
  atualizar() {
    const camp = this.host.campanha();
    const cenas = (camp?.scenes ?? []).filter((s) => !s.viagem);
    const sig = JSON.stringify(cenas.map((s) => [s.id, s.name, s.floor, s.aberto, s.portals.map((p) => p.link), s.marcos?.map((m) => [m.x, m.y, m.entra])]));
    if (sig !== this.sigLocais) {
      this.sigLocais = sig;
      this.locais = cenas.length ? montarLocais(cenas) : null;
      this.camadas.clear();
    }
    const cur = this.host.cenaAtual();
    if (cur !== this.ultimaCena) {
      this.ultimaCena = cur;
      this.seguindo = true;
      // o cartão do cômodo para onde se acabou de ir continua aberto (o Levar o grupo); o de outro fecha
      if (this.sel?.id !== cur) this.sel = null;
      this.anim = null;
    }
    const aqui = cur !== undefined ? this.vistaDe(cur) : null;
    if (this.seguindo || !this.vista || !this.valida(this.vista)) this.vista = aqui ?? this.primeira();
    this.desenhar();
  }

  /** Vai para o nível da cena (o terreno, ou o andar do prédio dela). */
  private vistaDe(id: number): Vista | null {
    const o = this.locais?.onde.get(id);
    if (!o) return null;
    if (o.predio) return { tipo: 'predio', predio: o.predio, andar: o.andar ?? '' };
    return o.terreno !== null ? { tipo: 'terreno', cena: o.terreno } : null;
  }

  private primeira(): Vista | null {
    const l = this.locais;
    if (!l) return null;
    if (l.terrenos[0]) return { tipo: 'terreno', cena: l.terrenos[0].cena };
    const p = l.predios[0];
    return p ? { tipo: 'predio', predio: p.id, andar: p.andares[0]?.nome ?? '' } : null;
  }

  private valida(v: Vista) {
    const l = this.locais;
    if (!l) return false;
    if (v.tipo === 'terreno') return l.terrenos.some((t) => t.cena === v.cena);
    return !!l.predios.find((p) => p.id === v.predio)?.andares.some((a) => a.nome === v.andar);
  }

  private predio(id: string) {
    return this.locais?.predios.find((p) => p.id === id);
  }

  private cena(id: number) {
    return this.host.campanha()?.scenes.find((s) => s.id === id);
  }

  /** Algum agente já pisou na cena (as outras ficam apagadas). */
  private visitada(id: number) {
    return !!this.host.campanha()?.visitadas?.includes(id);
  }

  /** Muda o nível mostrado; volta a acompanhar se for o da cena aberta. */
  private mostrar(v: Vista, anima = true) {
    const de = this.vista;
    if (mesma(de, v)) return;
    const cur = this.host.cenaAtual();
    this.seguindo = mesma(v, cur !== undefined ? this.vistaDe(cur) : null);
    this.sel = null;
    // terreno ↔ prédio: o zoom no telhado
    if (anima && de && !reduced()) {
      const terreno = de.tipo === 'terreno' ? de : v.tipo === 'terreno' ? v : null;
      const pv = de.tipo === 'predio' ? de : v.tipo === 'predio' ? v : null;
      const p = pv && this.predio(pv.predio);
      if (terreno && pv && p?.marco && p.terreno === terreno.cena) {
        const R = this.caixaDoPredio(terreno.cena, p);
        if (R) this.anim = { terreno, predio: pv, R, dir: v.tipo === 'predio' ? 1 : -1, t0: performance.now(), dur: 520 };
      }
    }
    this.vista = v;
    this.desenhar();
  }

  /** Sobe um nível (do prédio para o terreno dele). */
  private subir() {
    const v = this.vista;
    if (v?.tipo !== 'predio') return;
    const p = this.predio(v.predio);
    if (p?.terreno === null || p?.terreno === undefined) return;
    sfx.whoosh(260);
    this.mostrar({ tipo: 'terreno', cena: p.terreno });
  }

  private descer(p: LocalPredio) {
    sfx.whoosh(260);
    const cur = this.host.cenaAtual();
    const dentro = cur !== undefined ? this.locais?.onde.get(cur) : undefined;
    const andar = dentro?.predio === p.id ? dentro.andar! : (p.andares.find((a) => a.cenas.includes(p.entrada))?.nome ?? p.andares[0].nome);
    this.mostrar({ tipo: 'predio', predio: p.id, andar });
  }

  /** Volta para onde o grupo está. */
  private centralizar() {
    const cur = this.host.cenaAtual();
    const v = cur !== undefined ? this.vistaDe(cur) : null;
    if (!v) return;
    sfx.click();
    this.mostrar(v);
    this.seguindo = true;
  }

  /** A cena aberta mudou: o cômodo novo acende de ouro, subindo com a varredura de luz. */
  animarAtual(delay: number) {
    const room = this.host.cenaAtual() ?? -1;
    this.fade = { room: this.hatch.room, t: 0 };
    this.hatch = { room, t: reduced() ? 1 : 0 };
    if (reduced()) return this.desenhar();
    const run = async () => {
      if (delay) await wait(delay);
      const t0 = performance.now();
      const passo = () => {
        if (this.hatch.room !== room) return;
        const t = Math.min(1, (performance.now() - t0) / 700);
        this.hatch.t = t;
        this.fade.t = Math.min(1, t * 1.6);
        this.desenhar();
        if (t < 1) requestAnimationFrame(passo);
        else this.fade = { room: -1, t: 1 };
      };
      requestAnimationFrame(passo);
    };
    void run();
  }

  // ------------------------------------------------------------------ mouse

  private ligar() {
    const c = this.canvas;
    const at = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * c.clientWidth) / r.width, y: ((e.clientY - r.top) * c.clientHeight) / r.height };
    };
    const acerta = (p: { x: number; y: number }, semPeca = false) => {
      const ctx = c.getContext('2d')!;
      for (const a of [...this.alvos].reverse()) {
        if (semPeca && a.tipo === 'peca') continue;
        if (p.x < a.x || p.x > a.x + a.w || p.y < a.y || p.y > a.y + a.h) continue;
        if (a.forma) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const dentro = ctx.isPointInPath(a.forma, p.x, p.y);
          ctx.restore();
          if (!dentro) continue;
        }
        return a;
      }
      return undefined;
    };
    /** onde a peça arrastada vai parar: o cômodo, o chão do terreno ou a entrada do prédio */
    const destino = (a: Alvo | undefined) => (a?.tipo === 'cena' ? (a.id as number) : a?.tipo === 'predio' ? this.predio(a.id as string)?.entrada : undefined);
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.anim) return;
      const a = acerta(at(e));
      if (a?.tipo === 'peca' && this.host.mestre() && a.cena !== undefined) {
        const p = at(e);
        this.arraste = { token: a.id as number, de: a.cena, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false };
        c.setPointerCapture(e.pointerId);
        return;
      }
      if (!a) {
        this.sel = null;
        return this.desenhar();
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = at(e);
      const ar = this.arraste;
      if (ar) {
        ar.x = p.x;
        ar.y = p.y;
        if (Math.hypot(p.x - ar.sx, p.y - ar.sy) > 4) ar.moved = true;
        const alvo = acerta(p, true);
        const k = destino(alvo) !== undefined && alvo ? `${alvo.tipo}:${alvo.id}` : '';
        this.hover = k;
        c.style.cursor = 'grabbing';
        this.desenhar();
        return;
      }
      const a = acerta(p);
      c.style.cursor = a?.tipo === 'peca' && this.host.mestre() ? 'grab' : a ? 'pointer' : 'default';
      const k = a ? `${a.tipo}:${a.id}` : '';
      if (k !== this.hover) {
        this.hover = k;
        this.desenhar();
      }
      const titulo = a?.nome ?? '';
      if (c.title !== titulo) c.title = titulo;
    });
    c.addEventListener('pointerleave', () => {
      if (!this.hover) return;
      this.hover = '';
      this.desenhar();
    });
    c.addEventListener('pointerup', (e) => {
      const ar = this.arraste;
      if (ar) {
        this.arraste = null;
        this.hover = '';
        const para = ar.moved ? destino(acerta(at(e), true)) : undefined;
        if (para !== undefined && para !== ar.de) {
          sfx.drop();
          this.host.levar(para, [ar.token], false);
        } else if (!ar.moved) {
          // clique na peça: o cartão da cena dela
          this.sel = { tipo: 'cena', id: ar.de };
          sfx.click();
        }
        this.desenhar();
        return;
      }
      if (e.button !== 0 || this.anim) return;
      if (e.altKey) return this.nomearAqui(at(e));
      const a = acerta(at(e));
      if (!a) return;
      if (a.tipo === 'predio') {
        const p = this.predio(a.id as string);
        if (p) this.descer(p);
        return;
      }
      if (a.tipo === 'andar' && this.vista?.tipo === 'predio') {
        sfx.tick();
        this.mostrar({ tipo: 'predio', predio: this.vista.predio, andar: a.id as string }, false);
        return;
      }
      if (a.tipo === 'saida') {
        sfx.tick();
        this.mostrar({ tipo: 'terreno', cena: a.id as number }, false);
        return;
      }
      const id = a.id as number;
      // na planta do andar, um clique leva ao cômodo (14/10, o Felipe: "clique em dois passos, ruim de usar") e
      // abre o cartão dele, com o Levar o grupo; no terreno, clicar no chão só mostra o cartão (errar o prédio
      // não leva ninguém para o meio do pasto)
      if (this.vista?.tipo === 'predio' && id !== this.host.cenaAtual()) this.host.ir(id);
      else if (this.sel?.id !== id) sfx.click();
      this.sel = { tipo: 'cena', id };
      this.desenhar();
    });
    c.addEventListener('dblclick', (e) => {
      const a = acerta(at(e));
      if (a?.tipo === 'cena' && a.id !== this.host.cenaAtual()) this.host.ir(a.id as number);
    });
    // o botão direito e a roda para trás sobem; a roda para a frente em cima de um prédio desce
    c.addEventListener('contextmenu', (e) => {
      if (this.vista?.tipo !== 'predio' || this.predio(this.vista.predio)?.terreno == null) return;
      e.preventDefault();
      this.subir();
    });
    c.addEventListener(
      'wheel',
      (e) => {
        if (this.anim) return;
        if (e.deltaY > 0 && this.vista?.tipo === 'predio' && this.predio(this.vista.predio)?.terreno != null) {
          e.preventDefault();
          this.subir();
        } else if (e.deltaY < 0 && this.vista?.tipo === 'terreno') {
          const a = acerta(at(e));
          const p = a?.tipo === 'predio' ? this.predio(a.id as string) : undefined;
          if (p) {
            e.preventDefault();
            this.descer(p);
          }
        }
      },
      { passive: false },
    );
  }

  // ------------------------------------------------------------------ DOM: caminho, abas, cartão

  private renderCabeca() {
    const v = this.vista;
    const l = this.locais;
    const camp = this.host.campanha();
    const cur = this.host.cenaAtual();
    const p = v?.tipo === 'predio' ? this.predio(v.predio) : undefined;
    const terreno = v?.tipo === 'terreno' ? v.cena : p?.terreno ?? null;
    const tNome = terreno !== null ? l?.terrenos.find((t) => t.cena === terreno)?.nome : undefined;
    // o título: o lugar (a fazenda, os arredores) ou o prédio e o andar ("Casarão › Térreo")
    const partes: string[] = [];
    if (v?.tipo === 'terreno') partes.push(terreno === l?.terrenos[0]?.cena ? camp?.title || tNome || 'Planta' : tNome || 'Planta');
    if (p) {
      partes.push(p.nome || camp?.title || 'Planta');
      const a = p.andares.find((x) => v?.tipo === 'predio' && x.nome === v.andar);
      if (a && p.andares.length > 1) partes.push(a.rotulo);
    }
    if (!partes.length) partes.push('Planta');
    const sig = JSON.stringify(partes);
    if (this.trilha.dataset.sig !== sig) {
      this.trilha.dataset.sig = sig;
      clear(this.trilha);
      partes.forEach((x, i) => {
        if (i) this.trilha.append(h('span', { class: 'mm-sep', 'aria-hidden': 'true' }, '›'));
        this.trilha.append(h('span', { class: `mm-migalha${i === partes.length - 1 ? ' on' : ''}` }, x));
      });
    }
    // os botões do canto: subir, voltar para onde o grupo está e a lista de todos os lugares
    const podeSubir = v?.tipo === 'predio' && p?.terreno != null;
    const longe = !this.seguindo && cur !== undefined && !!this.vistaDe(cur);
    const sigB = JSON.stringify([podeSubir, longe]);
    if (this.botoes.dataset.sig !== sigB) {
      this.botoes.dataset.sig = sigB;
      clear(this.botoes).append(
        podeSubir ? h('button', { class: 'mm-bt', type: 'button', title: 'Voltar ao terreno (botão direito)', 'aria-label': 'Voltar ao terreno', onclick: () => this.subir() }, ic('esquerda')) : '',
        longe ? h('button', { class: 'mm-bt', type: 'button', title: 'Onde o grupo está', 'aria-label': 'Centralizar', onclick: () => this.centralizar() }, ic('centralizar')) : '',
        h('button', { class: 'mm-bt', type: 'button', title: 'Todos os lugares', 'aria-label': 'Todos os lugares', onclick: () => this.abrirLugares() }, ic('camadas')),
      );
    }
    this.renderCartao();
  }

  /** onde o terreno está desenhado (para o Alt + clique achar a casa) */
  private geoTerreno: { cena: number; ox: number; oy: number; S: number } | null = null;

  /** as áreas nomeadas pelo mestre neste terreno (notas da campanha, `andar` = t<cena>) */
  private areasNomeadas(cena: number) {
    return (this.host.campanha()?.notas ?? []).filter((n) => n.andar === `t${cena}`);
  }

  /** Alt + clique no terreno: nomeia a área (perto de um nome já posto, renomeia; vazio apaga). */
  private nomearAqui(p: { x: number; y: number }) {
    const g = this.geoTerreno;
    if (!g || !this.host.mestre() || this.vista?.tipo !== 'terreno' || this.vista.cena !== g.cena) return;
    const x = Math.round(((p.x - g.ox) / g.S) * 10) / 10;
    const y = Math.round(((p.y - g.oy) / g.S) * 10) / 10;
    const perto = this.areasNomeadas(g.cena).find((n) => Math.hypot(n.x - x, n.y - y) < 3);
    const texto = window.prompt(perto ? 'Novo nome da área (vazio apaga):' : 'Nome da área:', perto?.texto ?? '');
    if (texto === null) return;
    if (!perto && !texto.trim()) return;
    this.host.nomearArea(g.cena, x, y, texto.trim(), perto?.id);
  }

  /** Mostra a cena no minimapa (o nível dela) com o cartão aberto. */
  private focar(id: number) {
    const v = this.vistaDe(id);
    if (!v) return;
    this.mostrar(v);
    this.sel = { tipo: 'cena', id };
    this.desenhar();
  }

  /** Abertos na lista de lugares (os prédios e os andares); o do grupo abre sozinho. */
  private abertos = new Set<string>();

  /**
   * A lista de todos os lugares, numa janela: cada terreno com os prédios dele, cada prédio
   * abre os andares e os cômodos. Clicar num nome mostra no minimapa; o Entrar leva a cena.
   */
  private abrirLugares() {
    const l = this.locais;
    const camp = this.host.campanha();
    if (!l || !camp) return;
    sfx.tick();
    const cur = this.host.cenaAtual();
    const ondeCur = cur !== undefined ? l.onde.get(cur) : undefined;
    if (ondeCur?.predio) (this.abertos.add(ondeCur.predio), this.abertos.add(`${ondeCur.predio}/${ondeCur.andar}`));
    const lista = h('div', { class: 'mm-lugares' });
    // o mestre marca tudo como visitado (a base do grupo) ou limpa (missão nova)
    const rodape = this.host.mestre()
      ? h(
          'footer',
          { class: 'mm-l-rodape' },
          h('span', null, 'Não visitado fica apagado no minimapa.'),
          h('button', { class: 'mm-l-entrar mm-l-sempre', type: 'button', onclick: () => (sfx.tick(), this.host.marcarVisita(null, true), j.fechar()) }, 'Tudo visitado'),
          h('button', { class: 'mm-l-entrar mm-l-sempre', type: 'button', onclick: () => (sfx.tick(), this.host.marcarVisita(null, false), j.fechar()) }, 'Limpar visitas'),
        )
      : '';
    const j = this.janelaHud(camp.title || 'Lugares', h('div', { class: 'mm-l-corpo' }, lista, rodape));
    const bolinhas = (ids: number[]) => {
      const g = this.genteEm(ids);
      return g.length ? h('span', { class: 'mm-gente', 'aria-label': `${g.length} aqui` }, ...g.slice(0, 6).map((cor) => h('i', { style: `background:${cor}` }))) : null;
    };
    const entrar = (id: number) =>
      h(
        'span',
        { class: 'mm-l-acoes' },
        h('button', { class: 'mm-l-entrar', type: 'button', title: 'Levar o grupo: as peças dos agentes vão para lá, e a cena também', 'aria-label': 'Levar o grupo', onclick: (e: Event) => (e.stopPropagation(), j.fechar(), this.host.levar(id)) }, ic('pessoa')),
        id === cur
          ? h('span', { class: 'mm-l-aqui', title: 'A cena aberta' }, ic('pino'), 'Aqui')
          : h('button', { class: 'mm-l-entrar', type: 'button', title: 'Só a cena vai para lá; as peças ficam', onclick: (e: Event) => (e.stopPropagation(), j.fechar(), this.host.ir(id)) }, ic('entrar'), 'Entrar'),
      );
    const ver = (id: number) => () => (sfx.click(), j.fechar(), this.focar(id));
    /** linha de um lugar que é uma cena: o nome mostra no minimapa */
    const linhaCena = (id: number, nome: string, cls: string, icone: string) =>
      h(
        'div',
        { class: `mm-l-linha ${cls}${id === cur ? ' atual' : ''}${this.visitada(id) ? '' : ' novo'}`, title: this.visitada(id) ? undefined : 'Não visitado' },
        h('button', { class: 'mm-l-nome', type: 'button', title: 'Mostrar no minimapa', onclick: ver(id) }, ic(icone), h('span', null, nome), bolinhas([id])),
        entrar(id),
      );
    /** grupo que abre e fecha (o prédio, o andar) */
    const grupo = (chave: string, cabeca: (seta: Element) => HTMLElement, filhos: () => HTMLElement[], cls: string) => {
      const box = h('div', { class: `mm-l-grupo ${cls}` });
      const desenha = () => {
        const aberto = this.abertos.has(chave);
        box.classList.toggle('aberto', aberto);
        clear(box).append(
          cabeca(h('span', { class: 'mm-l-seta', 'aria-hidden': 'true' }, aberto ? '▾' : '▸')),
          aberto ? h('div', { class: 'mm-l-filhos' }, ...filhos()) : '',
        );
      };
      const alternar = () => {
        sfx.tick();
        if (this.abertos.has(chave)) this.abertos.delete(chave);
        else this.abertos.add(chave);
        desenha();
      };
      desenha();
      return { box, alternar };
    };
    const predioEl = (p: LocalPredio) => {
      let alt: () => void = () => {};
      const g = grupo(
        p.id,
        (seta) =>
          h(
            'div',
            { class: `mm-l-linha predio${ondeCur?.predio === p.id ? ' atual' : ''}${p.cenas.some((id) => this.visitada(id)) ? '' : ' novo'}` },
            h('button', { class: 'mm-l-nome', type: 'button', 'aria-expanded': String(this.abertos.has(p.id)), onclick: () => alt() }, seta, ic('mapa'), h('span', null, p.nome || camp.title || 'Prédio'), h('small', null, `${p.cenas.length} ${p.cenas.length === 1 ? 'cômodo' : 'cômodos'}`), bolinhas(p.cenas)),
            entrar(p.entrada),
          ),
        () =>
          p.andares.length === 1
            ? p.andares[0].cenas.map((id) => linhaCena(id, nomeCurto(this.cena(id)?.name ?? ''), 'comodo', 'pino'))
            : p.andares.map((a) => {
                let altA: () => void = () => {};
                const ga = grupo(
                  `${p.id}/${a.nome}`,
                  (seta) => h('div', { class: 'mm-l-linha andar' }, h('button', { class: 'mm-l-nome', type: 'button', onclick: () => altA() }, seta, ic('camadas'), h('span', null, a.rotulo), bolinhas(a.cenas))),
                  () => a.cenas.map((id) => linhaCena(id, nomeCurto(this.cena(id)?.name ?? ''), 'comodo', 'pino')),
                  'andar',
                );
                altA = ga.alternar;
                return ga.box;
              }),
        'predio',
      );
      alt = g.alternar;
      return g.box;
    };
    for (const t of l.terrenos) {
      lista.append(linhaCena(t.cena, t.nome, 'terreno', 'montanha'));
      const filhos = t.predios.map((id) => this.predio(id)).filter((p): p is LocalPredio => !!p);
      if (filhos.length) lista.append(h('div', { class: 'mm-l-filhos' }, ...filhos.map(predioEl)));
    }
    for (const p of l.predios.filter((q) => q.terreno === null)) {
      this.abertos.add(p.id);
      lista.append(predioEl(p));
    }
  }

  /** A janela do HUD (a moldura azul do tabuleiro), no meio da tela; Esc ou fora dela fecha. */
  private janelaHud(titulo: string, corpo: HTMLElement) {
    const fechar = () => {
      document.removeEventListener('keydown', tecla, true);
      fundo.classList.add('saindo');
      setTimeout(() => fundo.remove(), 140);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      fechar();
    };
    const caixa = h(
      'section',
      { class: 'mm-janela', role: 'dialog', 'aria-label': titulo },
      h('header', null, ic('camadas'), h('h3', null, titulo), h('button', { class: 'mm-bt', type: 'button', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: () => fechar() }, ic('fechar'))),
      corpo,
    );
    const fundo = h('div', { class: 'mm-janela-fundo' }, caixa);
    fundo.addEventListener('pointerdown', (e) => e.target === fundo && fechar());
    document.addEventListener('keydown', tecla, true);
    document.body.append(fundo);
    return { fechar };
  }

  /** As cores de quem está nessas cenas. */
  private genteEm(ids: number[]): string[] {
    const camp = this.host.campanha();
    if (!camp) return [];
    const out: string[] = [];
    for (const id of ids)
      for (const u of this.cena(id)?.users ?? []) out.push(camp.party.find((q) => q.id === u.id)?.color ?? '#efe6d1');
    return out;
  }

  /**
   * O cartão do cômodo escolhido: o que é, quem está lá, se já foi visitado, o Entrar e o
   * Levar o grupo, com os agentes de fora (clicar num tira ele do grupo: fica onde está).
   */
  private renderCartao() {
    const sel = this.sel;
    const s = sel ? this.cena(sel.id) : undefined;
    const cur = this.host.cenaAtual();
    const camp = this.host.campanha();
    if ((sel?.id ?? -1) !== this.cartaoDe) {
      this.cartaoDe = sel?.id ?? -1;
      this.ficam.clear();
    }
    const quem = s ? s.users.map((u) => camp?.party.find((q) => q.id === u.id)?.name ?? u.name) : [];
    // os agentes de fora dela: o grupo que dá para levar
    const deFora = s ? (camp?.party ?? []).filter((q) => q.id && this.host.ehAgente(q.look?.charId) && q.roomId !== s.id) : [];
    const vao = deFora.filter((q) => !this.ficam.has(q.id!));
    const visitada = s ? this.visitada(s.id) : true;
    const mestre = this.host.mestre();
    const sig = JSON.stringify([sel?.id, s?.name, s?.descricao, s?.portals.map((q) => q.link), quem, cur, deFora.map((q) => [q.id, q.name, q.color, q.roomId]), [...this.ficam], visitada, mestre]);
    if (this.cartao.dataset.sig === sig) return;
    this.cartao.dataset.sig = sig;
    clear(this.cartao).classList.toggle('hidden', !s);
    if (!s) return;
    const o = this.locais?.onde.get(s.id);
    const p = o?.predio ? this.predio(o.predio) : undefined;
    const andar = p?.andares.find((a) => a.nome === o?.andar)?.rotulo;
    const onde = [andar, p?.nome].filter(Boolean).join(' · ') || (s.aberto ? 'Ao ar livre' : '');
    const aqui = s.id === cur;
    const todos = vao.length === deFora.length;
    const levar = () => this.host.levar(s.id, todos ? undefined : vao.map((q) => q.id!));
    this.cartao.append(
      // o nome, onde fica e quem está; o visitado no canto (o mestre troca)
      h(
        'div',
        { class: 'mm-c-topo' },
        h('div', { class: 'mm-c-txt', title: quem.length ? `${quem.join(', ')} aqui` : 'Ninguém aqui' }, h('b', null, nomeCurto(s.name)), h('span', null, [onde, quem.length ? `${quem.length} aqui` : ''].filter(Boolean).join(' · '))),
        mestre
          ? h(
              'button',
              { class: `mm-c-visita${visitada ? '' : ' nao'}`, type: 'button', title: visitada ? 'Marcar como não visitado (fica apagado no minimapa)' : 'Marcar como visitado', onclick: () => (sfx.tick(), this.host.marcarVisita(s.id, !visitada)) },
              visitada ? 'visitado' : 'não visitado',
            )
          : '',
        h('button', { class: 'mm-c-x', type: 'button', title: 'Fechar o cartão', 'aria-label': 'Fechar o cartão', onclick: () => ((this.sel = null), sfx.tick(), this.desenhar()) }, ic('fechar')),
      ),
      // a foto da cena, o texto dela e por onde se vai (cada conexão mostra o lugar no minimapa)
      this.detalhes(s),
      // o grupo dividido: quem vai (aceso) e quem fica (apagado)
      deFora.length > 1 || (deFora.length === 1 && this.ficam.size)
        ? h(
            'div',
            { class: 'mm-c-grupo' },
            ...deFora.map((q) => {
              const fica = this.ficam.has(q.id!);
              return h(
                'button',
                {
                  class: `mm-c-agente${fica ? ' fica' : ''}`,
                  type: 'button',
                  style: `--c:${q.color}`,
                  'aria-pressed': String(!fica),
                  title: `${q.name} (em ${nomeCurto(this.cena(q.roomId ?? -1)?.name ?? '?')}): ${fica ? 'fica, clique para levar' : 'vai, clique para deixar'}`,
                  onclick: () => {
                    sfx.tick();
                    if (fica) this.ficam.delete(q.id!);
                    else this.ficam.add(q.id!);
                    this.renderCartao();
                    this.desenhar();
                  },
                },
                h('i'),
                q.name.split(/\s+/)[0],
              );
            }),
          )
        : '',
      h(
        'div',
        { class: 'mm-c-acoes' },
        deFora.length
          ? h(
              'button',
              { class: 'mm-c-entrar grupo', type: 'button', disabled: !vao.length, title: 'As peças marcadas vão para lá, e a cena (e a mesa) também', onclick: levar },
              ic('pessoa'),
              todos ? 'Levar o grupo' : vao.length ? `Levar ${vao.length}` : 'Ninguém',
            )
          : '',
        aqui
          ? h('span', { class: 'mm-c-aqui' }, ic('pino'), 'Aqui')
          : h('button', { class: 'mm-c-entrar', type: 'button', title: 'Só a cena (e a mesa) vai para lá; as peças ficam (clique duplo também)', onclick: () => this.host.ir(s.id) }, ic('entrar'), 'Entrar'),
      ),
    );
  }

  /** A foto (a última captura da cena), a descrição e as conexões do cômodo escolhido. */
  private detalhes(s: SceneInfo): HTMLElement | '' {
    let foto: string | null = null;
    try {
      foto = localStorage.getItem(`crona.thumb.${s.id}`);
    } catch {
      /* sem armazenamento: fica sem foto */
    }
    const ligacoes = [...new Set(s.portals.map((q) => q.link))].filter((id) => this.cena(id));
    if (!foto && !s.descricao && !ligacoes.length) return '';
    return h(
      'div',
      { class: 'mm-c-det' },
      foto ? h('img', { class: 'mm-c-foto', src: foto, alt: '' }) : '',
      h(
        'div',
        { class: 'mm-c-corpo' },
        s.descricao ? h('p', { class: 'mm-c-desc' }, s.descricao) : '',
        ligacoes.length
          ? h(
              'div',
              { class: 'mm-c-lig' },
              h('span', null, 'Conexões'),
              ...ligacoes.map((id) => h('button', { type: 'button', title: 'Mostrar no minimapa', onclick: () => (sfx.tick(), this.focar(id)) }, nomeCurto(this.cena(id)!.name))),
            )
          : '',
      ),
    );
  }

  // ------------------------------------------------------------------ desenho

  desenhar() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.quadro();
    });
  }

  private quadro() {
    const c = this.canvas;
    // a letra acompanha o painel: grande na janela da tecla M, menor quando a tela é pequena
    K = this.opc.grande ? 1.45 : Math.max(0.72, Math.min(1, (c.clientWidth || 220) / 330));
    const W = c.clientWidth || 220;
    this.renderCabeca();
    const H = this.altura();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const Hc = c.clientHeight || 170;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(Hc * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(Hc * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hc);
    const v = this.vista;
    if (!v || !this.locais) return;
    const a = this.anim;
    if (a) {
      const p = Math.min(1, (performance.now() - a.t0) / a.dur);
      const ease = 1 - (1 - p) ** 3;
      const e = a.dir > 0 ? ease : 1 - ease;
      // o prédio no terreno cresce até encher o painel, e a planta dele nasce do telhado
      const F = encaixar(a.R, W, H);
      const k = F.w / a.R.w;
      const s = 1 + (k - 1) * e;
      ctx.save();
      ctx.translate((F.x - a.R.x * k) * e, (F.y - a.R.y * k) * e);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.max(0, 1 - e * 1.4);
      this.desenharVista(ctx, a.terreno, W, H, []);
      ctx.restore();
      const si = 1 / k + (1 - 1 / k) * e;
      ctx.save();
      ctx.translate((a.R.x - F.x / k) * (1 - e), (a.R.y - F.y / k) * (1 - e));
      ctx.scale(si, si);
      ctx.globalAlpha = Math.min(1, Math.max(0, e * 1.6 - 0.35));
      this.desenharVista(ctx, a.predio, W, H, []);
      ctx.restore();
      if (p < 1) {
        this.desenhar();
        return;
      }
      this.anim = null;
      ctx.clearRect(0, 0, W, Hc);
    }
    const alvos: Alvo[] = [];
    this.desenharVista(ctx, v, W, H, alvos);
    this.alvos = alvos;
    this.fantasma(ctx);
  }

  /**
   * A altura do desenho: o painel inteiro, com ou sem o cartão. O cartão fica por cima; antes o
   * mapa encolhia para caber acima dele e, no painel pequeno, virava um selo (o Felipe, 12/10:
   * "ficando pequenininho quando clica").
   */
  private altura() {
    return this.canvas.clientHeight || 170;
  }

  /** Onde começa o cartão, em px do canvas (null = cartão fechado). */
  private topoDoCartao(): number | null {
    if (this.cartao.classList.contains('hidden')) return null;
    const rc = this.canvas.getBoundingClientRect();
    const rk = this.cartao.getBoundingClientRect();
    if (!rc.height || !rk.height) return null;
    return ((rk.top - rc.top) * (this.canvas.clientHeight || rc.height)) / rc.height;
  }

  private desenharVista(ctx: CanvasRenderingContext2D, v: Vista, W: number, H: number, alvos: Alvo[]) {
    ctx.imageSmoothingEnabled = false;
    if (v.tipo === 'terreno') {
      const s = this.cena(v.cena);
      if (s) this.desenharTerreno(ctx, s, W, H, alvos);
    } else {
      const p = this.predio(v.predio);
      if (p) this.desenharAndar(ctx, p, v.andar, W, H, alvos);
    }
  }

  private hm(s: SceneInfo) {
    let m = this.hms.get(s.heightmap);
    if (!m) this.hms.set(s.heightmap, (m = parseHeightmap(s.heightmap)));
    return m;
  }

  private encaixeDoTerreno(s: SceneInfo, W: number, H: number) {
    const raw = this.hm(s);
    const S = Math.min((W - PAD * 2) / raw.width, (H - PAD * 2) / raw.height);
    return { S, O: { x: Math.round((W - raw.width * S) / 2), y: Math.round((H - raw.height * S) / 2) }, raw };
  }

  private caixaDoPredio(terreno: number, p: LocalPredio): Caixa | null {
    const s = this.cena(terreno);
    if (!s || !p.marco) return null;
    const { S, O } = this.encaixeDoTerreno(s, this.canvas.clientWidth || 220, this.altura());
    return { x: O.x + p.marco.x * S, y: O.y + p.marco.y * S, w: p.marco.w * S, h: p.marco.h * S };
  }

  // ---------------------------------------------------------------- o terreno

  private desenharTerreno(ctx: CanvasRenderingContext2D, s: SceneInfo, W: number, H: number, alvos: Alvo[]) {
    const { S, O, raw } = this.encaixeDoTerreno(s, W, H);
    const l = this.locais!;
    const lt = l.terrenos.find((t) => t.cena === s.id);
    const cur = this.host.cenaAtual();
    const mw = raw.width * S;
    const mh = raw.height * S;
    // a pixel art do chão e de tudo o que está nele fica guardada (só muda quando o mapa muda)
    const sig = JSON.stringify([s.terreno?.length, s.marcos, s.simbolos?.length, s.heightmap.length]);
    let cam = this.camadas.get(s.id);
    if (!cam || cam.sig !== sig) {
      cam = { sig, c: pixelTerreno(s, raw) };
      this.camadas.set(s.id, cam);
    }
    moldura(ctx, O.x, O.y, mw, mh);
    ctx.drawImage(cam.c, O.x, O.y, mw, mh);
    // ninguém do grupo pisou aqui ainda: o mapa fica apagado
    if (!this.visitada(s.id)) {
      ctx.fillStyle = 'rgba(2,5,10,0.45)';
      ctx.fillRect(O.x, O.y, mw, mh);
    }
    // os prédios: o mouse em cima acende a borda; o do grupo fica vermelho, com a seta
    const ondeCur = cur !== undefined ? l.onde.get(cur) : undefined;
    const telhados: (Caixa & { id: string; nome: string; atual: boolean; novo: boolean; gente: string[] })[] = [];
    for (const id of lt?.predios ?? []) {
      const p = this.predio(id);
      if (!p?.marco) continue;
      const m = p.marco;
      const x = Math.round(O.x + m.x * S);
      const y = Math.round(O.y + m.y * S);
      const w = Math.round(m.w * S);
      const hh = Math.round(m.h * S);
      alvos.push({ tipo: 'predio', id, nome: `${p.nome || 'Casa'}: clique para ver dentro`, x, y, w, h: hh });
      const atual = ondeCur?.predio === id;
      if (atual) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,210,122,0.2)';
        ctx.fillRect(x, y, w, hh);
        ctx.shadowColor = 'rgba(255,196,90,0.85)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = HUD.aqui;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x - 1, y - 1, w + 2, hh + 2);
        ctx.restore();
      }
      if (this.hover === `predio:${id}`) {
        ctx.fillStyle = 'rgba(160,200,255,0.16)';
        ctx.fillRect(x, y, w, hh);
        ctx.strokeStyle = HUD.texto;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x - 1, y - 1, w + 2, hh + 2);
      }
      const novo = !p.cenas.some((id2) => this.visitada(id2));
      if (novo && !atual) {
        ctx.fillStyle = 'rgba(2,5,10,0.55)';
        ctx.fillRect(x, y, w, hh);
      }
      telhados.push({ id, nome: p.nome, x, y, w, h: hh, atual, novo, gente: this.genteEm(p.cenas) });
    }
    // as plaquinhas: no telhado quando cabe; senão embaixo, em cima ou do lado, sem tampar outra
    const ocupado: Caixa[] = [];
    const bate = (a: Caixa, b: Caixa) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const t of telhados) {
      // a casinha comum não tem rótulo (só os lugares importantes têm): fica o telhado clicável e o selo de quem está lá
      if (!t.nome) {
        alvos.push({ tipo: 'predio', id: t.id, nome: 'Casa: clique para ver dentro', x: t.x, y: t.y, w: t.w, h: t.h });
        if (t.gente.length) selo(ctx, t.gente, t.x + t.w - 2, t.y + t.h - fs(13));
        continue;
      }
      const m = medirPlaca(ctx, t.nome);
      const lugares = [
        ...(m.w <= t.w * 1.3 && m.h <= t.h * 1.2 ? [[t.x + t.w / 2, t.y + t.h / 2]] : []),
        [t.x + t.w / 2, t.y + t.h + m.h / 2 + 3],
        [t.x + t.w / 2, t.y - m.h / 2 - 3],
        [t.x + t.w + m.w / 2 + 3, t.y + t.h / 2],
        [t.x - m.w / 2 - 3, t.y + t.h / 2],
      ];
      const caixa = ([cx, cy]: number[]) => ({ x: Math.round(cx - m.w / 2), y: Math.round(cy - m.h / 2), w: m.w, h: m.h });
      const livre = lugares.find((lu) => {
        const c = caixa(lu);
        return c.x >= 0 && c.y >= 0 && c.x + c.w <= W && c.y + c.h <= H && !ocupado.some((o) => bate(c, o)) && !telhados.some((o) => o.id !== t.id && bate(c, o));
      });
      const c = caixa(livre ?? lugares[0]);
      ocupado.push(c);
      desenharPlaca(ctx, m, c, t.atual ? 'aqui' : this.hover === `predio:${t.id}` ? 'foco' : t.novo ? 'novo' : '');
      alvos.push({ tipo: 'predio', id: t.id, nome: `${t.nome}: clique para ver dentro`, ...c });
      // quem está lá dentro: o selo no canto de baixo do telhado (a seta fica em cima da plaquinha)
      if (t.gente.length) selo(ctx, t.gente, t.x + t.w - 2, t.y + t.h - fs(13));
      if (t.atual) seta(ctx, c.x + c.w / 2, c.y - 2);
    }
    // os nomes soltos do chão (plantações, lago, rio)
    // mapa pequeno: só o que se clica (os nomes do chão, a rosa e a régua ficam para o mapa maior)
    const enfeites = W >= 260;
    if (enfeites) for (const r of rotulosDoChao(s, raw)) textoSolto(ctx, r.txt, O.x + r.x * S, O.y + r.y * S);
    // as áreas que o mestre nomeou (Alt + clique no chão), por cima dos nomes achados sozinhos
    this.geoTerreno = { cena: s.id, ox: O.x, oy: O.y, S };
    for (const n of this.areasNomeadas(s.id)) textoSolto(ctx, n.texto, O.x + n.x * S, O.y + n.y * S);
    // as saídas para outro terreno (a porteira para os arredores)
    for (const sd of lt?.saidas ?? []) {
      const nome = l.terrenos.find((t) => t.cena === sd.para)?.nome ?? '';
      const esq = sd.x < raw.width / 2;
      const txt = esq ? `◄ ${nome}` : `${nome} ►`;
      const m = medirPlaca(ctx, txt);
      const x = Math.round(esq ? O.x + (sd.x + 0.5) * S + 4 : O.x + (sd.x + 0.5) * S - 4 - m.w);
      const y = O.y + (sd.y + 0.5) * S;
      // ao lado da passagem: em cima, embaixo ou no meio, onde não tampar uma plaquinha
      const lugares = [y - m.h - 4, y + 4, y - m.h / 2].map((yy) => ({ x, y: Math.round(yy), w: m.w, h: m.h }));
      const c = lugares.find((q) => !ocupado.some((o) => bate(q, o)) && !telhados.some((o) => bate(q, o))) ?? lugares[0];
      ocupado.push(c);
      desenharPlaca(ctx, m, c, this.hover === `saida:${sd.para}` ? 'foco' : 'saida');
      alvos.push({ tipo: 'saida', id: sd.para, nome: `Ver o mapa de ${nome}`, ...c });
    }
    // as peças ao ar livre
    for (const u of s.users) {
      const x = O.x + (u.x + 0.5) * S;
      const y = O.y + (u.y + 0.5) * S;
      if (this.arraste?.moved && this.arraste.token === u.id) continue;
      this.peca(ctx, u.id, x, y);
      alvos.push(this.alvoPeca(u, s.id, x, y));
    }
    if (enfeites) {
      rosa(ctx, O.x + mw - fs(13), O.y + fs(13));
      escala(ctx, S, O.x + 6, O.y + mh - 8);
    }
    // o chão inteiro também é um alvo (o primeiro da lista: os prédios ganham dele)
    alvos.unshift({ tipo: 'cena', id: s.id, nome: lt?.nome ?? nomeCurto(s.name), x: O.x, y: O.y, w: mw, h: mh });
    if (this.sel?.id === s.id) {
      ctx.strokeStyle = HUD.sel;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(O.x - 4, O.y - 4, mw + 8, mh + 8);
      ctx.setLineDash([]);
    }
  }

  /** A peça como alvo: o mestre arrasta para outro lugar (leva só ela). */
  private alvoPeca(u: { id: number; name: string }, cena: number, x: number, y: number): Alvo {
    const nome = this.host.campanha()?.party.find((q) => q.id === u.id)?.name ?? u.name;
    return { tipo: 'peca', id: u.id, cena, nome: this.host.mestre() ? `${nome}: arraste para levar a outro lugar` : nome, x: x - 6, y: y - 6, w: 12, h: 12 };
  }

  /** A peça arrastada, embaixo do mouse, com o nome. */
  private fantasma(ctx: CanvasRenderingContext2D) {
    const ar = this.arraste;
    if (!ar?.moved) return;
    const nome = this.host.campanha()?.party.find((q) => q.id === ar.token)?.name ?? '';
    ctx.save();
    ctx.globalAlpha = 0.9;
    this.peca(ctx, ar.token, ar.x, ar.y);
    ctx.restore();
    if (!nome) return;
    const m = medirPlaca(ctx, nome.split(/\s+/)[0]);
    desenharPlaca(ctx, m, { x: Math.round(ar.x + 8), y: Math.round(ar.y - m.h - 6), w: m.w, h: m.h }, 'saida');
  }

  /** A peça: o ponto de luz na cor do agente, com a borda escura (na grande, a inicial dentro). */
  private peca(ctx: CanvasRenderingContext2D, uid: number, x: number, y: number) {
    const q = this.host.campanha()?.party.find((m) => m.id === uid);
    const cor = q?.color ?? '#ffffff';
    const r = this.opc.grande ? Math.max(5, Math.min(8, this.S * 0.5)) : Math.max(2.8, Math.min(4.2, this.S * 0.48));
    ctx.save();
    ctx.shadowColor = cor;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = HUD.noite;
    ctx.stroke();
    if (this.opc.grande && r >= 6) {
      ctx.save();
      ctx.font = `700 ${Math.round(r * 1.25)}px ${FONTE}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = HUD.noite;
      ctx.fillText((q?.name || '?').trim()[0]?.toUpperCase() ?? '?', x, y + 0.5);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- o andar de um prédio

  /**
   * A planta do andar no HUD do CRONA: cada cômodo na cor do piso dele (escurecida para a
   * noite), a parede de fora grossa e bege, a de dentro fina; as portas em tracinhos de ouro,
   * as escadas (▲ ▼) que trocam o andar, o nome em plaquinha arredondada, o cômodo do grupo
   * aceso de ouro (sobe com a varredura de luz quando o grupo entra), o escolhido em azul, o
   * não visitado apagado, e as peças como pontos de luz.
   */
  /** A planta montada sozinha de cada andar, guardada até as cenas mudarem. */
  private plantas = new Map<string, { sig: string; pos: Map<number, { x: number; y: number; r: number }> }>();
  private plantaDoAndar(p: LocalPredio, andar: string, cenas: SceneInfo[]) {
    const chave = `${p.id}/${andar}`;
    const sig = JSON.stringify(cenas.map((s) => [s.id, s.heightmap.length, s.door, s.portals]));
    let g = this.plantas.get(chave);
    if (!g || g.sig !== sig) {
      g = { sig, pos: plantaAutomatica(cenas, (s) => this.hm(s), p.entrada) };
      this.plantas.set(chave, g);
    }
    return g.pos;
  }

  private desenharAndar(ctx: CanvasRenderingContext2D, p: LocalPredio, andar: string, W: number, H: number, alvos: Alvo[]) {
    const camp = this.host.campanha();
    const a = p.andares.find((x) => x.nome === andar);
    if (!camp || !a) return;
    ctx.imageSmoothingEnabled = true;
    const cur = this.host.cenaAtual();
    const cenasDoAndar = a.cenas.map((id) => this.cena(id)).filter((s): s is SceneInfo => !!s);
    const auto = this.plantaDoAndar(p, andar, cenasDoAndar);
    const parsed = cenasDoAndar
      .map((s) => {
        const pos = auto.get(s.id) ?? camp.layout[s.id] ?? { x: 0, y: 0 };
        const raw = this.hm(s);
        const rot = (x: number, y: number) => rotatePt(raw, pos.r ?? 0, x, y);
        const porta = s.aberto ? null : rot(s.door.x, s.door.y);
        return { s, raw, hm: rotateHm(raw, pos.r ?? 0), p: pos, rot, porta };
      });
    if (!parsed.length) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const { hm, p: q } of parsed) {
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x + hm.width);
      y1 = Math.max(y1, q.y + hm.height);
    }
    const bw = Math.max(1, x1 - x0);
    const bh = Math.max(1, y1 - y0);
    const pad = this.opc.grande ? 34 : PAD;
    const sozinho = parsed.length === 1;
    const teto = sozinho ? Math.min((W * 0.6) / bw, (H * 0.7) / bh) : Infinity;
    this.S = Math.max(1.5, Math.min(teto, (W - pad * 2) / bw, (H - pad * 2) / bh));
    this.O = { x: Math.round(pad + (W - pad * 2 - bw * this.S) / 2 - x0 * this.S), y: Math.round(pad + (H - pad * 2 - bh * this.S) / 2 - y0 * this.S) };
    const S = this.S;
    // o cartão fica por cima do mapa: se o cômodo escolhido cair atrás dele, o mapa sobe (sem encolher)
    let dy = 0;
    const topo = this.topoDoCartao();
    const escolhido = this.sel ? parsed.find((q) => q.s.id === this.sel!.id) : undefined;
    if (topo !== null && escolhido) {
      const cima = this.O.y + escolhido.p.y * S;
      const baixo = cima + escolhido.hm.height * S;
      if (baixo > topo - 6) dy = -Math.min(baixo - (topo - 6), Math.max(0, cima - 4));
    }
    const O = { x: this.O.x, y: this.O.y + dy };
    // a grade de 1,5 m (duas casas), de leve, no fundo inteiro
    const passo = S * 2;
    if (passo >= 4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(161,136,115,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = ((O.x % passo) + passo) % passo; x < W; x += passo) (ctx.moveTo(Math.round(x) + 0.5, 0), ctx.lineTo(Math.round(x) + 0.5, H));
      for (let y = ((O.y % passo) + passo) % passo; y < H; y += passo) (ctx.moveTo(0, Math.round(y) + 0.5), ctx.lineTo(W, Math.round(y) + 0.5));
      ctx.stroke();
      ctx.restore();
    }
    // de quem é cada casa do andar, e a forma de cada cômodo (o clique vale pela casa)
    const dono = new Map<string, number>();
    const formas = new Map<number, Path2D>();
    for (const { s, hm, p: q, porta } of parsed) {
      const forma = new Path2D();
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++) {
          if (hm.tiles[y]?.[x] === null || hm.tiles[y]?.[x] === undefined || (porta && x === porta[0] && y === porta[1])) continue;
          dono.set(`${q.x + x},${q.y + y}`, s.id);
          forma.rect(O.x + (q.x + x) * S, O.y + (q.y + y) * S, S + 0.35, S + 0.35);
        }
      formas.set(s.id, forma);
    }
    // a sombra do prédio e o chão: o granito do HUD e, por cima, a cor do piso de cada cômodo
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = HUD.granito;
    for (const f of formas.values()) ctx.fill(f);
    ctx.restore();
    const escadas: { x: number; y: number; sobe: boolean; andar: string; rotulo: string }[] = [];
    const rotulos: { nome: string; x: number; y: number; w: number; h: number; atual: boolean; novo: boolean; sel: boolean }[] = [];
    for (const { s, hm, p: q, rot } of parsed) {
      const forma = formas.get(s.id)!;
      const ox = O.x + q.x * S;
      const oy = O.y + q.y * S;
      const atual = s.id === cur;
      const sel = this.sel?.id === s.id;
      const novo = !atual && !this.visitada(s.id);
      const meu = (x: number, y: number) => dono.get(`${q.x + x},${q.y + y}`) === s.id;
      const piso = s.estilo ? COR_PISO[s.estilo] : undefined;
      if (piso) {
        ctx.fillStyle = piso;
        ctx.fill(forma);
      }
      // o xadrez bem leve das casas (dá a escala, como o chão de um mapa de jogo)
      if (S >= 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.028)';
        for (let y = 0; y < hm.height; y++) for (let x = 0; x < hm.width; x++) if (meu(x, y) && (q.x + x + q.y + y) % 2 === 0) ctx.fillRect(ox + x * S, oy + y * S, S, S);
      }
      // o cômodo do grupo: o ouro acende (entrando, sobe aos poucos com a varredura)
      if (atual) {
        const t = this.hatch.room === s.id ? this.hatch.t : 1;
        const g = ctx.createLinearGradient(ox, oy, ox, oy + hm.height * S);
        g.addColorStop(0, 'rgba(255,210,122,0.34)');
        g.addColorStop(1, 'rgba(201,127,44,0.2)');
        ctx.save();
        ctx.clip(forma);
        ctx.fillStyle = g;
        if (t < 1) {
          const yy = oy + hm.height * S * t;
          ctx.fillRect(ox, oy, hm.width * S, yy - oy);
          ctx.fillStyle = 'rgba(255,240,200,0.85)';
          ctx.fillRect(ox, yy - 1, hm.width * S, 2);
        } else ctx.fill(forma);
        ctx.restore();
      } else if (s.id === this.fade.room && this.fade.t < 1) {
        ctx.fillStyle = `rgba(233,169,68,${(0.3 * (1 - this.fade.t)).toFixed(3)})`;
        ctx.fill(forma);
      }
      if (sel && !atual) {
        ctx.fillStyle = 'rgba(120,170,235,0.2)';
        ctx.fill(forma);
      }
      if (this.hover === `cena:${s.id}`) {
        ctx.fillStyle = 'rgba(160,200,255,0.14)';
        ctx.fill(forma);
      }
      if (novo) {
        ctx.fillStyle = 'rgba(2,5,10,0.4)';
        ctx.fill(forma);
      }
      // as portas (na planta girada) e quais são escadas para outro andar
      const portas: [number, number][] = [];
      for (const pt of s.portals) {
        const [ppx, ppy] = rot(pt.x, pt.y);
        if (!meu(ppx, ppy)) continue;
        const outro = p.andares.find((x) => x.cenas.includes(pt.link));
        if (outro && outro.nome !== andar) {
          escadas.push({ x: q.x + ppx, y: q.y + ppy, sobe: outro.nivel > a.nivel, andar: outro.nome, rotulo: outro.rotulo });
          continue;
        }
        portas.push([ppx, ppy]);
      }
      // as paredes: fina entre dois cômodos, grossa por fora; limpas, como num mapa de jogo
      const fina: [number, number, number, number][] = [];
      const grossa: [number, number, number, number][] = [];
      for (let y = 0; y < hm.height; y++)
        for (let x = 0; x < hm.width; x++) {
          if (!meu(x, y)) continue;
          const X = ox + x * S;
          const Y = oy + y * S;
          for (const [nx, ny, seg] of [
            [x, y - 1, [X, Y, X + S, Y]],
            [x, y + 1, [X, Y + S, X + S, Y + S]],
            [x - 1, y, [X, Y, X, Y + S]],
            [x + 1, y, [X + S, Y, X + S, Y + S]],
          ] as [number, number, [number, number, number, number]][]) {
            if (meu(nx, ny)) continue;
            (dono.get(`${q.x + nx},${q.y + ny}`) === undefined ? grossa : fina).push(seg);
          }
        }
      const traco = (segs: [number, number, number, number][], cor: string, lw: number, brilho = 0) => {
        if (!segs.length) return;
        ctx.save();
        ctx.strokeStyle = cor;
        ctx.lineWidth = lw;
        ctx.lineCap = 'square';
        if (brilho) {
          ctx.shadowColor = 'rgba(255,196,90,0.85)';
          ctx.shadowBlur = brilho;
        }
        ctx.beginPath();
        for (const [a1, b1, c1, d1] of segs) (ctx.moveTo(a1, b1), ctx.lineTo(c1, d1));
        ctx.stroke();
        ctx.restore();
      };
      traco(fina, novo ? 'rgba(161,136,115,0.3)' : 'rgba(161,136,115,0.45)', 1);
      traco(grossa, novo ? 'rgba(161,136,115,0.55)' : sel && !atual ? HUD.sel : HUD.borda, Math.max(1.5, Math.min(2.4, S * 0.34)));
      if (atual) traco([...fina, ...grossa], HUD.aqui, 1.6, 7);
      // as portas: um tracinho de ouro atravessando a parede
      ctx.fillStyle = atual ? '#fff0c8' : novo ? 'rgba(233,169,68,0.4)' : HUD.ouro;
      for (const [px2, py2] of portas) {
        const X = ox + px2 * S;
        const Y = oy + py2 * S;
        const e = Math.max(1.6, S * 0.3);
        if (!meu(px2, py2 - 1)) ctx.fillRect(X + S * 0.2, Y - e / 2, S * 0.6, e);
        else if (!meu(px2, py2 + 1)) ctx.fillRect(X + S * 0.2, Y + S - e / 2, S * 0.6, e);
        else if (!meu(px2 - 1, py2)) ctx.fillRect(X - e / 2, Y + S * 0.2, e, S * 0.6);
        else if (!meu(px2 + 1, py2)) ctx.fillRect(X + S - e / 2, Y + S * 0.2, e, S * 0.6);
      }
      rotulos.push({ nome: nomeCurto(s.name), x: ox, y: oy, w: hm.width * S, h: hm.height * S, atual, novo, sel });
      alvos.push({ tipo: 'cena', id: s.id, nome: nomeCurto(s.name), x: ox, y: oy, w: hm.width * S, h: hm.height * S, forma });
    }
    // os nomes em plaquinhas legíveis, uma sem tapar a outra, sempre dentro do próprio cômodo;
    // do maior para o menor (o nome de cada um fica sempre no mesmo lugar). O que não cabe fica no aviso do mouse
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fonte = fs(11);
    ctx.font = `600 ${fonte}px ${FONTE}`;
    const postas: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const ordem = [...rotulos].sort((r1, r2) => r2.w * r2.h - r1.w * r1.h || r1.y - r2.y || r1.x - r2.x);
    for (const r of ordem) {
      // o nome curto é a palavra que distingue: "Sala de Tecnologia" vira Tecnologia
      const curto = r.nome.replace(/^(sala|câmara|quarto|área)\s+(de|da|do|dos|das)\s+/i, '').split(/\s+/)[0];
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      let posta: { q: { x0: number; y0: number; x1: number; y1: number }; nome: string; w: number; hh: number; f: number; lx: number; ly: number } | null = null;
      // o nome inteiro na letra normal; não cabendo, o curto; e por fim a letra um pouco menor
      for (const [nome, f] of [[r.nome, fonte], [curto, fonte], [curto, Math.max(7, fonte * 0.82)]] as [string, number][]) {
        ctx.font = `600 ${f}px ${FONTE}`;
        const w = ctx.measureText(nome).width + f;
        const hh = f + fs(6) * (f / fonte);
        if (nome === r.nome && w > Math.max(r.w + fs(14), fs(60))) continue;
        for (const [dx, dy] of [[0, 0], [0, -hh], [0, hh], [0, -hh * 2], [0, hh * 2], [-w * 0.6, 0], [w * 0.6, 0]]) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
          const q = { x0: x - w / 2, y0: y - hh / 2, x1: x + w / 2, y1: y + hh / 2 };
          if (q.x0 < 1 || q.x1 > W - 1 || q.y0 < 1 || q.y1 > H - 1) continue;
          if (postas.some((o) => q.x0 < o.x1 + 2 && q.x1 > o.x0 - 2 && q.y0 < o.y1 + 2 && q.y1 > o.y0 - 2)) continue;
          posta = { q, nome, w, hh, f, lx: x, ly: y };
          break;
        }
        if (posta) break;
      }
      if (!posta) continue;
      postas.push(posta.q);
      ctx.font = `600 ${posta.f}px ${FONTE}`;
      pilula(ctx, posta.q.x0, posta.q.y0, posta.w, posta.hh, posta.nome, posta.lx, posta.ly, r.atual ? 'aqui' : r.sel ? 'sel' : r.novo ? 'novo' : '');
    }
    ctx.restore();
    // as escadas: ▲ sobe, ▼ desce (clicar troca o andar); ganham dos cômodos no clique
    for (const e of escadas) {
      const cx = Math.round(O.x + (e.x + 0.5) * S);
      const cy = Math.round(O.y + (e.y + 0.5) * S);
      const r = Math.max(fs(4), Math.min(fs(6), S * 0.8));
      const foco = this.hover === `andar:${e.andar}`;
      ctx.save();
      ctx.shadowColor = 'rgba(255,196,90,0.7)';
      ctx.shadowBlur = foco ? 8 : 4;
      ctx.beginPath();
      if (e.sobe) (ctx.moveTo(cx, cy - r), ctx.lineTo(cx + r, cy + r * 0.75), ctx.lineTo(cx - r, cy + r * 0.75));
      else (ctx.moveTo(cx, cy + r), ctx.lineTo(cx + r, cy - r * 0.75), ctx.lineTo(cx - r, cy - r * 0.75));
      ctx.closePath();
      ctx.fillStyle = foco ? '#fff0c8' : HUD.ouro;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = HUD.noite;
      ctx.stroke();
      const m = r + 3;
      alvos.push({ tipo: 'andar', id: e.andar, nome: `${e.sobe ? 'Subir' : 'Descer'} para ${e.rotulo}`, x: cx - m, y: cy - m, w: m * 2, h: m * 2 });
    }
    // as peças
    for (const { s, p: q, rot } of parsed)
      for (const u of s.users) {
        const [ux, uy] = rot(u.x, u.y);
        const x = O.x + (q.x + ux + 0.5) * S;
        const y = O.y + (q.y + uy + 0.5) * S;
        if (this.arraste?.moved && this.arraste.token === u.id) continue;
        this.peca(ctx, u.id, x, y);
        alvos.push(this.alvoPeca(u, s.id, x, y));
      }
  }
}

// ------------------------------------------------------------------ pixel art

/** Cor para o buffer de pixels (ABGR, como o ImageData guarda). */
function cor(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

/** Um quadro de pixels pequeno (a arte), ampliado depois sem suavizar. */
class Pix {
  readonly img: ImageData;
  readonly d: Uint32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.img = new ImageData(Math.max(1, w), Math.max(1, h));
    this.d = new Uint32Array(this.img.data.buffer);
  }
  put(x: number, y: number, c: number) {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  /** disco cheio: `pinta(dx, dy, d2)` diz a cor de cada pixel (0 = não pinta) */
  disco(cx: number, cy: number, r: number, pinta: (dx: number, dy: number, d2: number) => number) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r + r * 0.6) continue;
        const c = pinta(dx, dy, d2);
        if (c) this.put(cx + dx, cy + dy, c);
      }
  }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.img.width;
    c.height = this.img.height;
    c.getContext('2d')!.putImageData(this.img, 0, 0);
    return c;
  }
}

/** A paleta do terreno: as cores de mapa da planta de antes (escuras, de noite), com luz e sombra. */
const PAL = {
  grama: [cor('#1d3426'), cor('#24402e'), cor('#172b1f')],
  sombra: cor('#0e1a13'),
  terra: [cor('#3a3123'), cor('#2c251a'), cor('#4a3e2b')],
  pedra: [cor('#2b3242'), cor('#262c3a'), cor('#1c2230')],
  arada: [cor('#34402a'), cor('#283220')],
  agua: [cor('#12304d'), cor('#24507a'), cor('#0b2238')],
  pier: [cor('#43372a'), cor('#30271d')],
  copa: [cor('#1e3a24'), cor('#26472c'), cor('#3f6a40'), cor('#0b170e')],
  moita: [cor('#24462a'), cor('#2c5432'), cor('#4a7a46'), cor('#0e1d11')],
  cerca: [cor('#5a4632'), cor('#a18873')],
  milho: [cor('#4a6a2c'), cor('#a88a3c')],
  pedraFonte: [cor('#5a6070'), cor('#141a24'), cor('#2a5a8a'), cor('#9cc4f0')],
  feno: [cor('#8a7038'), cor('#b8954a'), cor('#5a4622')],
  madeira: [cor('#4a3524'), cor('#2a1d12'), cor('#14100c')],
  capacho: cor('#a18873'),
  borda: cor('#050b14'),
};

/** Telhado de quatro águas, de noite: [norte (claro), lados, sul (escuro), telhas, cumeeira]. */
const TELHADO: Record<string, string[]> = {
  casarao: ['#6a3a2c', '#57301f', '#3e2216', '#4a281a', '#8a5236'],
  celeiro: ['#5e2c22', '#4c241b', '#341812', '#3e1e16', '#7a3c2c'],
  galpao: ['#54442e', '#443724', '#30261a', '#3a2e1f', '#6e5a3c'],
  '': ['#3c4250', '#323744', '#242834', '#2a2e3a', '#5a6070'],
};

/** O terreno inteiro em pixel art: o chão casa por casa e o que está nele (P pixels por casa). */
function pixelTerreno(s: SceneInfo, raw: Heightmap): HTMLCanvasElement {
  const linhas = (s.terreno ?? '').replace(/\r/g, '').split('\n');
  const ch = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= raw.width || y >= raw.height) return '';
    const c = linhas[y]?.[x] ?? '.';
    return raw.tiles[y]?.[x] === null && c !== 'a' ? 'a' : c;
  };
  const caminho = (c: string) => c === 't' || c === 'd' || c === 'p' || c === 'm';
  const px = new Pix(raw.width * P, raw.height * P);
  for (let ty = 0; ty < raw.height; ty++)
    for (let tx = 0; tx < raw.width; tx++) {
      const c = ch(tx, ty);
      for (let yy = 0; yy < P; yy++)
        for (let xx = 0; xx < P; xx++) {
          const X = tx * P + xx;
          const Y = ty * P + yy;
          const n = ruido(X, Y);
          // a beira: o pixel da casa que encosta numa casa de outro tipo
          const beira = (ok: (v: string) => boolean) =>
            (xx === 0 && !ok(ch(tx - 1, ty))) || (xx === P - 1 && !ok(ch(tx + 1, ty))) || (yy === 0 && !ok(ch(tx, ty - 1))) || (yy === P - 1 && !ok(ch(tx, ty + 1)));
          let v: number;
          if (c === 'a') v = beira((q) => q === 'a' || q === 'm' || q === '') ? PAL.agua[2] : (X + Y * 3 + Math.floor(n * 2)) % 9 === 0 && yy % 2 === 0 ? PAL.agua[1] : PAL.agua[0];
          else if (c === 'm') v = yy % 2 ? PAL.pier[1] : PAL.pier[0];
          else if (c === 'l') v = yy % 2 ? PAL.arada[1] : PAL.arada[0];
          else if (c === 'p') v = beira(caminho) ? PAL.pedra[2] : ((X >> 1) + (Y >> 1)) % 2 ? PAL.pedra[0] : PAL.pedra[1];
          else if (c === 't' || c === 'd') v = beira(caminho) ? PAL.terra[1] : n < 0.07 ? PAL.terra[2] : PAL.terra[0];
          else v = n < 0.09 ? PAL.grama[1] : n > 0.9 ? PAL.grama[2] : PAL.grama[0];
          px.put(X, Y, v);
        }
    }
  const simb = s.simbolos ?? [];
  const de = (k: string) => simb.filter((q) => q[0] === k);
  // as plantações: fileiras de milho
  for (const [, x, y, w] of de('plantacao'))
    for (let i = 0; i < w * P; i++) {
      px.put(x * P + i, y * P + 1, (x * P + i) % 3 ? PAL.milho[0] : PAL.milho[1]);
      px.put(x * P + i, y * P + 2, PAL.milho[0]);
    }
  // a cerca: tracinho de casa em casa e os mourões
  const cerca = new Set(de('cerca').map(([, x, y]) => `${x},${y}`));
  for (const k of cerca) {
    const [x, y] = k.split(',').map(Number);
    const cx = x * P + (P >> 1);
    const cy = y * P + (P >> 1);
    if (cerca.has(`${x + 1},${y}`)) for (let i = 0; i <= P; i++) px.put(cx + i, cy, PAL.cerca[0]);
    if (cerca.has(`${x},${y + 1}`)) for (let i = 0; i <= P; i++) px.put(cx, cy + i, PAL.cerca[0]);
    if ((x + y) % 2 === 0) px.put(cx, cy, PAL.cerca[1]);
  }
  // o resto, pequeno: a fonte, o feno, a carroça, a porteira, as entradas
  for (const [k, x, y, w, hh] of simb) {
    const X = x * P;
    const Y = y * P;
    if (k === 'fonte') {
      const r = Math.max(2, Math.round((Math.min(w, hh) * P) / 2) - 1);
      const cx = X + Math.round((w * P) / 2);
      const cy = Y + Math.round((hh * P) / 2);
      const [pedra, borda, agua, brilho] = PAL.pedraFonte;
      px.disco(cx, cy, r, (dx, dy, d2) => (d2 > (r - 1) * (r - 1) ? borda : d2 > (r - 2) * (r - 2) ? pedra : dx === -1 && dy === -1 ? brilho : agua));
      px.put(cx, cy, pedra);
    } else if (k === 'feno' || k === 'sacas') {
      const [c1, c2, c3] = PAL.feno;
      for (let i = 0; i < 3; i++) (px.put(X + i, Y + 1, c2), px.put(X + i, Y + 2, c1), px.put(X + i, Y + 3, c3));
    } else if (k === 'carroca') {
      const [c1, c2, roda] = PAL.madeira;
      for (let yy = 1; yy < hh * P - 1; yy++) for (let xx = 1; xx < w * P - 1; xx++) px.put(X + xx, Y + yy, xx === 1 || yy === 1 || xx === w * P - 2 || yy === hh * P - 2 ? c2 : c1);
      for (const [a, b] of [[0, 2], [w * P - 1, 2], [0, hh * P - 3], [w * P - 1, hh * P - 3]]) (px.put(X + a, Y + b, roda), px.put(X + a, Y + b + 1, roda));
    } else if (k === 'porteira') {
      for (let i = 0; i < Math.max(w, hh) * P; i += 2) px.put(w >= hh ? X + i : X + 1, w >= hh ? Y + 1 : Y + i, PAL.cerca[1]);
    } else if (k === 'entrada') {
      for (let xx = 1; xx < P - 1; xx++) (px.put(X + xx, Y, PAL.capacho), px.put(X + xx, Y + 1, PAL.capacho));
    } else if (k === 'placa') {
      px.put(X + 1, Y + 1, PAL.cerca[1]);
      px.put(X + 2, Y + 1, PAL.cerca[1]);
    }
  }
  // as árvores e as moitas: copa redonda com sombra, de trás para a frente
  const copas = [...de('arvore').map((q) => [q, 1] as const), ...de('arbusto').map((q) => [q, 0] as const)].sort((a, b) => a[0][2] - b[0][2]);
  for (const [[, x, y], grande] of copas) {
    const r = grande ? (ruido(x, y, 5) < 0.4 ? 4 : 3) : 2;
    const cx = x * P + (P >> 1) + Math.round((ruido(x, y, 6) - 0.5) * 2);
    const cy = y * P + (P >> 1) + Math.round((ruido(x, y, 7) - 0.5) * 2);
    px.disco(cx + 1, cy + 2, r, () => PAL.sombra);
    const [base, meio, luz, borda] = grande ? PAL.copa : PAL.moita;
    px.disco(cx, cy, r, (dx, dy, d2) => (d2 > (r - 0.8) * (r - 0.8) ? borda : dx + dy < -r * 0.6 ? luz : ruido(cx + dx, cy + dy, 2) < 0.3 ? meio : base));
  }
  // os prédios: sombra, telhado de quatro águas com as telhas e a cumeeira
  for (const m of s.marcos ?? []) {
    const [norte, lado, sul, telha, cume] = (TELHADO[m.kind ?? ''] ?? TELHADO['']).map(cor);
    const x0 = m.x * P;
    const y0 = m.y * P;
    const W = m.w * P;
    const H = m.h * P;
    for (let yy = 2; yy < H + 2; yy++) for (let xx = 2; xx < W + 2; xx++) if (xx >= W || yy >= H) px.put(x0 + xx, y0 + yy, PAL.sombra);
    for (let yy = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++) {
        const dT = yy;
        const dB = H - 1 - yy;
        const dL = xx;
        const dR = W - 1 - xx;
        const min = Math.min(dT, dB, dL, dR);
        let v: number;
        if (xx === 0 || yy === 0 || xx === W - 1 || yy === H - 1) v = PAL.borda;
        else if ((min === dT && (min === dL || min === dR)) || (min === dB && (min === dL || min === dR)) || (W >= H ? Math.abs(dT - dB) <= 0 && dL > dT && dR > dT : Math.abs(dL - dR) <= 0 && dT > dL && dB > dL)) v = cume;
        else if (min === dT) v = dT % 3 === 2 ? telha : norte;
        else if (min === dB) v = dB % 3 === 2 ? PAL.borda : sul;
        else v = (min === dL ? dL : dR) % 3 === 2 ? telha : lado;
        px.put(x0 + xx, y0 + yy, v);
      }
  }
  return px.canvas();
}

/** Os nomes que o chão forma sozinho: plantações (as roças juntas), lago e rio. */
function rotulosDoChao(s: SceneInfo, raw: Heightmap) {
  const linhas = (s.terreno ?? '').replace(/\r/g, '').split('\n');
  const ch = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= raw.width || y >= raw.height) return '';
    const c = linhas[y]?.[x] ?? '.';
    return raw.tiles[y]?.[x] === null && c !== 'a' ? 'a' : c;
  };
  const grupos = (sim: (x: number, y: number) => boolean, min: number, raio: number) => {
    const visto = new Set<string>();
    const out: { cx: number; cy: number; n: number; w: number; h: number }[] = [];
    for (let y = 0; y < raw.height; y++)
      for (let x = 0; x < raw.width; x++) {
        if (!sim(x, y) || visto.has(`${x},${y}`)) continue;
        const fila = [[x, y]];
        visto.add(`${x},${y}`);
        let sx = 0;
        let sy = 0;
        let n = 0;
        let ax = x;
        let bx = x;
        let ay = y;
        let by = y;
        while (fila.length) {
          const [a, b] = fila.pop()!;
          sx += a;
          sy += b;
          n++;
          ax = Math.min(ax, a);
          bx = Math.max(bx, a);
          ay = Math.min(ay, b);
          by = Math.max(by, b);
          for (let dy = -raio; dy <= raio; dy++)
            for (let dx = -raio; dx <= raio; dx++) {
              const k = `${a + dx},${b + dy}`;
              if (!visto.has(k) && sim(a + dx, b + dy)) (visto.add(k), fila.push([a + dx, b + dy]));
            }
        }
        if (n >= min) out.push({ cx: sx / n + 0.5, cy: sy / n + 0.5, n, w: bx - ax + 1, h: by - ay + 1 });
      }
    return out;
  };
  const cultivo = new Set((s.simbolos ?? []).filter((q) => q[0] === 'plantacao').map(([, x, y]) => `${x},${y}`));
  for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) if (ch(x, y) === 'l') cultivo.add(`${x},${y}`);
  const out: { txt: string; x: number; y: number }[] = [];
  for (const q of grupos((x, y) => cultivo.has(`${x},${y}`), 24, 4)) out.push({ txt: q.n > 120 ? 'Plantações' : 'Plantação', x: q.cx, y: q.cy });
  for (const q of grupos((x, y) => ch(x, y) === 'a' || ch(x, y) === 'm', 8, 2)) out.push({ txt: Math.max(q.w, q.h) >= Math.min(q.w, q.h) * 3 ? 'Rio' : 'Lago', x: q.cx, y: q.cy });
  return out;
}

// ------------------------------------------------------------------ peças do HUD

/** A moldura do mapa: a borda bege do HUD com a linha de dentro, e a sombra. */
function moldura(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = HUD.noite;
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.restore();
  ctx.strokeStyle = HUD.borda;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - 2.3, y - 2.3, w + 4.6, h + 4.6);
}

function medirPlaca(ctx: CanvasRenderingContext2D, nome: string) {
  ctx.save();
  ctx.font = `600 ${fs(10)}px ${FONTE}`;
  const corte = nome.length > 13 && nome.includes(' ') ? (nome.lastIndexOf(' ', 13) > 0 ? nome.lastIndexOf(' ', 13) : nome.indexOf(' ')) : -1;
  const linhas = corte > 0 ? [nome.slice(0, corte), nome.slice(corte + 1)] : [nome];
  const tw = Math.max(...linhas.map((l) => ctx.measureText(l).width));
  ctx.restore();
  return { linhas, w: Math.ceil(tw + fs(12)), h: Math.ceil(fs(12) * linhas.length + fs(5)) };
}

type Tom = '' | 'foco' | 'aqui' | 'saida' | 'novo' | 'sel';
/** As cores da plaquinha: fundo, borda e letra (ouro no lugar do grupo, apagada no não visitado). */
function tomDaPlaca(tom: Tom) {
  if (tom === 'aqui') return { fundo: 'rgba(42,26,6,0.92)', fio: HUD.aqui, letra: HUD.aqui, lw: 1.4 };
  if (tom === 'sel') return { fundo: 'rgba(8,20,38,0.92)', fio: HUD.sel, letra: '#e4f0ff', lw: 1.4 };
  if (tom === 'foco') return { fundo: 'rgba(14,26,46,0.92)', fio: HUD.texto, letra: '#ffffff', lw: 1.2 };
  if (tom === 'saida') return { fundo: HUD.fundo, fio: 'rgba(233,169,68,0.75)', letra: HUD.ouro, lw: 1 };
  if (tom === 'novo') return { fundo: 'rgba(5,11,20,0.78)', fio: 'rgba(161,136,115,0.3)', letra: '#7c7268', lw: 1 };
  return { fundo: 'rgba(5,11,20,0.86)', fio: HUD.bordaFraca, letra: HUD.texto, lw: 1 };
}

/** Plaquinha arredondada com uma linha de texto (o nome do cômodo). */
function pilula(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, txt: string, tx: number, ty: number, tom: Tom) {
  const c = tomDaPlaca(tom);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = c.fundo;
  ctx.fill();
  ctx.lineWidth = c.lw;
  ctx.strokeStyle = c.fio;
  ctx.stroke();
  ctx.fillStyle = c.letra;
  ctx.fillText(txt, tx, ty + 0.5);
}

/** A plaquinha do HUD (prédio, saída, peça arrastada): uma ou duas linhas, cantos redondos. */
function desenharPlaca(ctx: CanvasRenderingContext2D, m: { linhas: string[]; w: number; h: number }, c: Caixa, tom: Tom) {
  const t = tomDaPlaca(tom);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(c.x, c.y, c.w, c.h, Math.min(c.h / 2, fs(8)));
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = t.fundo;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = t.lw;
  ctx.strokeStyle = t.fio;
  if (tom === 'aqui') {
    ctx.shadowColor = 'rgba(255,196,90,0.7)';
    ctx.shadowBlur = 6;
  }
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.font = `600 ${fs(10)}px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = t.letra;
  m.linhas.forEach((l, i) => ctx.fillText(l, c.x + c.w / 2, c.y + fs(2.5) + fs(6) + i * fs(12)));
  ctx.restore();
}

/** Nome solto no chão (plantação, lago): letra creme com contorno da noite. */
function textoSolto(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number) {
  ctx.save();
  ctx.font = `500 ${fs(9)}px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(5,11,20,0.85)';
  ctx.strokeText(txt, Math.round(x), Math.round(y));
  ctx.fillStyle = HUD.fraco;
  ctx.fillText(txt, Math.round(x), Math.round(y));
  ctx.restore();
}

/** O selo com os pontos de luz de quem está lá dentro. */
function selo(ctx: CanvasRenderingContext2D, cores: string[], direita: number, y: number) {
  const n = Math.min(4, cores.length);
  const r = fs(2.6);
  const passo = r * 2 + fs(3);
  const mais = cores.length > 4 ? fs(12) : 0;
  const w = n * passo + fs(5) + mais;
  const h = r * 2 + fs(6);
  const x = Math.round(direita - w);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = HUD.fundo;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD.bordaFraca;
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x + fs(4) + r + i * passo, y + h / 2, r, 0, Math.PI * 2);
    ctx.shadowColor = cores[i];
    ctx.shadowBlur = 4;
    ctx.fillStyle = cores[i];
    ctx.fill();
  }
  ctx.shadowColor = 'transparent';
  if (cores.length > 4) {
    ctx.fillStyle = HUD.texto;
    ctx.font = `600 ${fs(8)}px ${FONTE}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${cores.length - 4}`, x + w - mais - fs(1), y + h / 2);
  }
  ctx.restore();
}

/** A setinha de ouro em cima da plaquinha do lugar do grupo. */
function seta(ctx: CanvasRenderingContext2D, cx: number, base: number) {
  const x = Math.round(cx);
  const k = fs(1);
  ctx.save();
  ctx.fillStyle = HUD.noite;
  ctx.beginPath();
  ctx.moveTo(x - 6 * k, base - 9 * k);
  ctx.lineTo(x + 6 * k, base - 9 * k);
  ctx.lineTo(x, base + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HUD.aqui;
  ctx.shadowColor = 'rgba(255,196,90,0.9)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x - 4 * k, base - 8 * k);
  ctx.lineTo(x + 4 * k, base - 8 * k);
  ctx.lineTo(x, base - 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** O norte, no canto do mapa: a plaquinha redonda com a ponta de ouro. */
function rosa(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const r = fs(9);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = HUD.fundo;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD.bordaFraca;
  ctx.stroke();
  ctx.fillStyle = HUD.ouro;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + fs(2));
  ctx.lineTo(cx + fs(3.5), cy - fs(1.5));
  ctx.lineTo(cx - fs(3.5), cy - fs(1.5));
  ctx.closePath();
  ctx.fill();
  ctx.font = `700 ${fs(8)}px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = HUD.texto;
  ctx.fillText('N', cx, cy + fs(3.5));
  ctx.restore();
}

/** A régua em metros, no canto de baixo do mapa. */
function escala(ctx: CanvasRenderingContext2D, S: number, x: number, y: number) {
  const m = (60 / S) * M_CASA;
  const total = [5, 10, 20, 25, 50, 100, 200].find((v) => v >= m * 0.8) ?? 200;
  const w = Math.round((total / M_CASA) * S);
  const X = Math.round(x);
  const Y = Math.round(y);
  ctx.save();
  ctx.font = `500 ${fs(9)}px ${FONTE}`;
  const rot = `${total} m`;
  const tw = Math.ceil(ctx.measureText(rot).width);
  ctx.beginPath();
  ctx.roundRect(X - 4, Y - fs(8), w + tw + 14, fs(12), fs(6));
  ctx.fillStyle = HUD.fundo;
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? HUD.noite : HUD.borda;
    ctx.fillRect(X + (i * w) / 4, Y - 3, w / 4, 3);
  }
  ctx.fillStyle = HUD.texto;
  ctx.textBaseline = 'middle';
  ctx.fillText(rot, X + w + 5, Y - 2);
  ctx.restore();
}

/** A caixa R ampliada até encher o painel, sem deformar. */
function encaixar(R: Caixa, W: number, H: number): Caixa {
  const k = Math.min((W - PAD * 2) / R.w, (H - PAD * 2) / R.h);
  return { x: (W - R.w * k) / 2, y: (H - R.h * k) / 2, w: R.w * k, h: R.h * k };
}

/** Planta girada em quartos de volta (r) no sentido horário, para encaixar o cômodo na planta. */
export function rotateHm(hm: Heightmap, r: number): Heightmap {
  const k = ((r % 4) + 4) % 4;
  if (!k) return hm;
  const W = k % 2 ? hm.height : hm.width;
  const H = k % 2 ? hm.width : hm.height;
  const tiles = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      const [ox, oy] = k === 1 ? [y, hm.height - 1 - x] : k === 2 ? [hm.width - 1 - x, hm.height - 1 - y] : [hm.width - 1 - y, x];
      return hm.tiles[oy]?.[ox] ?? null;
    }),
  );
  return { width: W, height: H, tiles };
}

/** Uma casa (x, y) do cômodo na planta girada. */
export function rotatePt(hm: Heightmap, r: number, x: number, y: number): [number, number] {
  const k = ((r % 4) + 4) % 4;
  if (k === 1) return [hm.height - 1 - y, x];
  if (k === 2) return [hm.width - 1 - x, hm.height - 1 - y];
  if (k === 3) return [y, hm.width - 1 - x];
  return [x, y];
}

/**
 * A planta montada sozinha (14/10, o Felipe: "os cômodos soltos, horrível de usar"): começa pela entrada e encaixa
 * cada cômodo vizinho pela porta que liga os dois, a casa de dentro de um encostada na do outro (a parede entre eles
 * fica fina, como numa casa de verdade). O vizinho gira de quarto em quarto de volta até as portas ficarem de frente;
 * se encostar num cômodo já posto, desliza de lado. O que não se liga por porta fica à direita.
 */
export function plantaAutomatica(cenas: SceneInfo[], hmDe: (s: SceneInfo) => Heightmap, entrada?: number): Map<number, { x: number; y: number; r: number }> {
  const porId = new Map(cenas.map((s) => [s.id, s]));
  const pos = new Map<number, { x: number; y: number; r: number }>();
  const ocupado = new Set<string>();
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /** as casas de chão do cômodo girado (sem o vão da porta) e o vão */
  const forma = (s: SceneInfo, r: number) => {
    const raw = hmDe(s);
    const hm = rotateHm(raw, r);
    const vao = s.aberto ? null : rotatePt(raw, r, s.door.x, s.door.y);
    const chao = (x: number, y: number) => hm.tiles[y]?.[x] !== null && hm.tiles[y]?.[x] !== undefined && !(vao && vao[0] === x && vao[1] === y);
    const casas: [number, number][] = [];
    for (let y = 0; y < hm.height; y++) for (let x = 0; x < hm.width; x++) if (chao(x, y)) casas.push([x, y]);
    return { raw, chao, casas };
  };
  /** a casa de dentro da porta e o lado de fora dela (para onde a porta abre) */
  const saida = (s: SceneInfo, r: number, px: number, py: number) => {
    const f = forma(s, r);
    let [cx, cy] = rotatePt(f.raw, r, px, py);
    if (!f.chao(cx, cy)) {
      const dentro = DIRS.find(([dx, dy]) => f.chao(cx + dx, cy + dy));
      if (!dentro) return null;
      [cx, cy] = [cx + dentro[0], cy + dentro[1]];
    }
    const fora = DIRS.find(([dx, dy]) => !f.chao(cx + dx, cy + dy));
    return fora ? { cx, cy, dx: fora[0], dy: fora[1], f } : null;
  };
  const cabe = (casas: [number, number][], ox: number, oy: number) => casas.every(([x, y]) => !ocupado.has(`${ox + x},${oy + y}`));
  const por = (s: SceneInfo, x: number, y: number, r: number) => {
    pos.set(s.id, { x, y, r });
    for (const [cx, cy] of forma(s, r).casas) ocupado.add(`${x + cx},${y + cy}`);
  };
  const raiz = porId.get(entrada ?? -1) ?? cenas[0];
  if (!raiz) return pos;
  por(raiz, 0, 0, 0);
  const fila = [raiz];
  while (fila.length) {
    const a = fila.shift()!;
    const pa = pos.get(a.id)!;
    for (const pt of a.portals) {
      const b = porId.get(pt.link);
      if (!b || pos.has(b.id)) continue;
      const sa = saida(a, pa.r, pt.x, pt.y);
      const volta = b.portals.find((q) => q.link === a.id);
      if (!sa || !volta) continue;
      // a casa do outro lado da parede, onde fica a casa de dentro da porta do vizinho
      const tx = pa.x + sa.cx + sa.dx;
      const ty = pa.y + sa.cy + sa.dy;
      let posto = false;
      // as portas de frente primeiro; depois qualquer giro; e deslizando de lado até caber
      const giros = [0, 1, 2, 3].map((r) => ({ r, sb: saida(b, r, volta.x, volta.y) })).filter((g) => g.sb);
      giros.sort((g1, g2) => Number(!(g1.sb!.dx === -sa.dx && g1.sb!.dy === -sa.dy)) - Number(!(g2.sb!.dx === -sa.dx && g2.sb!.dy === -sa.dy)));
      for (const desl of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        for (const { r, sb } of giros) {
          const ox = tx - sb!.cx + (sa.dx === 0 ? desl : 0);
          const oy = ty - sb!.cy + (sa.dy === 0 ? desl : 0);
          if (!cabe(sb!.f.casas, ox, oy)) continue;
          por(b, ox, oy, r);
          posto = true;
          break;
        }
        if (posto) break;
      }
      if (posto) fila.push(b);
    }
  }
  // o que ficou sem porta para o resto: à direita, um ao lado do outro
  let x1 = 0;
  for (const [id, p] of pos) x1 = Math.max(x1, p.x + rotateHm(hmDe(porId.get(id)!), p.r).width);
  let x = x1 + 2;
  for (const s of cenas) {
    if (pos.has(s.id)) continue;
    por(s, x, 0, 0);
    x += hmDe(s).width + 2;
  }
  return pos;
}
