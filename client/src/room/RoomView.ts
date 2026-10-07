import {
  DEFAULT_PARTICLE_LEVEL,
  footprint,
  getFurni,
  ocupa,
  PILHA_CHAO,
  regras as regrasShared,
  getWallFurni,
  playerColorFor,
  RoomMap,
  TICK_MS,
  Z_PER_M,
  type AvatarLook,
  type ChatKind,
  type FloorItem,
  type Hint,
  type PortraitState,
  type RollResult,
  type PeQuadro,
  type RoomInfo,
  type UserInfo,
  type UserStatus,
  type WallFurniDef,
  type WallItem,
  type WallSeg,
  ESCALA_ARTE_PESSOA,
  casasEmVolta,
  type CorGiz,
  type FormaTraco,
  type MarcaMesa,
} from '@crona/shared';
import { drawPixelAvatar, PIXEL_AVATAR_HEIGHT, type Pose } from '../render/avatarPixel';
import { Bubbles, UI_FONT } from '../render/bubbles';
import { COR_LADO, baseDoKit, desenharChao, desenharCima, desenharRotulos, type MarcasCombate } from '../render/combateMarcas';
import { desenharParedeComArte, visualComArte } from '../render/furniArte';
import { furniVisual } from '../render/furniFloor';
import { drawWallFurni, wallLights } from '../render/furniWall';
import { drawHintGlyph, drawHintIcon } from '../render/hints';
import { iso, unIso } from '../render/iso';
import { MarcasMesa } from '../render/marcasMesa';
import { NevoaMesa } from '../render/nevoaMesa';
import { imagemDoMapa } from '../render/mapaImagem';
import { desenharItemNoChao } from '../render/itemNoChao';
import { cameraVoo, casaNoPonto, desenharMesa, enquadrar, marcasNoChao, marcasPorCima, matrizNaAltura, passo, projetar, type CameraVoo, type Enquadre, type PecaTatica } from '../render/mapaTatico';
import { portraitCanvas } from '../render/portrait';
import { hash, hexToRgb, rgba } from '../render/color';
import { Fog } from '../render/fog';
import { Lighting, type Light } from '../render/lighting';
import { Particles } from '../render/particles';
import { boxSilhouette, Mapper, Painter, pointInPoly, type WBox } from '../render/painter';
import { buildStatic, doorClipPath, roomBounds, type StaticLayer } from '../render/roomStatic';
import { versaoTexturas } from '../render/texturas';
import { MundoViagem } from '../render/viagemMundo';
import { Celas, escurecerChao, escurecerForma, escuroEm } from './celas';
import { cmp, sortDrawables, type Drawable } from '../render/sort';
import {
  bonecoDir,
  bonecoFor,
  drawBoneco,
  drawPose,
  drawSombraProjetada,
  drawSprite,
  framesFor,
  passosFor,
  poseFor,
  quadroDaFolha,
  quadroDaPose,
  sprites,
  type LuzNaPeca,
  type SpriteFrame,
} from '../render/sprites';
import { sfx } from '../ui/sfx';

/**
 * Ferramenta do mestre no tabuleiro (docs/FERRAMENTAS-DA-MESA.md): com ela ligada, o clique e o
 * arrasto vão para ela (o arrasto não mexe a câmera).
 */
export type FerramentaMesa =
  | { tipo: 'ponto' }
  | { tipo: 'traco'; forma: FormaTraco; cor: CorGiz }
  | { tipo: 'nevoa'; vista: boolean; raio: number };

export interface ClientUser {
  id: number;
  name: string;
  look: AvatarLook;
  x: number;
  y: number;
  z: number;
  dir: number;
  headDir: number;
  sit: 0 | 1 | 2;
  dance: boolean;
  /** de cócoras: a peça se mostra mais baixa (até chegar a animação própria) */
  agachado?: boolean;
  anim: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; start: number } | null;
  waveUntil: number;
  phase: number;
  color: string;
  /** virou parado neste instante (efeito de giro) */
  turnAt?: number;
  /** começou a andar neste instante: o passo segue contínuo de casa em casa */
  andandoDesde?: number;
  /** andando: as casas já andadas nesta caminhada e o início do passo de agora (o ciclo do boneco segue a casa) */
  casas?: number;
  passoDesde?: number;
  /** o comprimento do passo de agora, em casas (√2 na diagonal) */
  passoLen?: number;
  /** o boneco pisca: quando vem a próxima piscada, até quando os olhos ficam fechados e a segunda piscada (dupla) */
  piscaEm?: number;
  piscaAte?: number;
  piscaDupla?: number;
}

/**
 * Os olhos do boneco estão fechados agora? Pisca de 2,4 a 6 s, por 120 ms; uma
 * vez em quatro, pisca duas vezes seguidas.
 */
function piscando(u: ClientUser, now: number): boolean {
  u.piscaEm ??= now + 900 + Math.random() * 3200;
  if (now >= u.piscaEm) {
    u.piscaAte = now + 120;
    u.piscaDupla = Math.random() < 0.25 ? now + 260 : undefined;
    u.piscaEm = now + 2400 + Math.random() * 3600;
  }
  if (u.piscaDupla !== undefined && now >= u.piscaDupla) {
    u.piscaAte = now + 110;
    u.piscaDupla = undefined;
  }
  return now < (u.piscaAte ?? 0);
}

/** Duração do efeito de giro da peça parada. */
const TURN_MS = 240;

/** Sombras de contato prontas, por tamanho. */
const sombrasPes = new Map<string, HTMLCanvasElement>();

/**
 * Sombra de contato embaixo das botas, em pixel duro como o resto do
 * tabuleiro: um elipse escuro de borda firme, com o miolo mais fechado.
 */
function desenharSombraPes(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  const k = `${rx}x${ry}`;
  let c = sombrasPes.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = rx * 2 + 1;
    c.height = ry * 2 + 1;
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    for (let j = 0; j < c.height; j++)
      for (let i = 0; i < c.width; i++) {
        const dx = (i - rx) / rx;
        const dy = (j - ry) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        img.data[(j * c.width + i) * 4 + 3] = d < 0.45 ? 158 : 102;
      }
    g.putImageData(img, 0, 0);
    sombrasPes.set(k, c);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x - rx), Math.round(y - ry));
  ctx.restore();
}

/** Proporção do anel da peça no chão (altura / largura). */
const ANEL_Q = 0.46;

/**
 * O anel que passa embaixo dos dois pés (em relação ao meio deles): a elipse do chão que tem um pé em
 * cada ponta, nem pequena demais (pés juntos) nem enorme (passada larga).
 */
function anelPelosPes(pes: [number, number][]): [number, number] {
  const hx = Math.abs(pes[0][0] - pes[1][0]) / 2;
  const hy = Math.abs(pes[0][1] - pes[1][1]) / 2;
  const r = Math.max(17, Math.min(34, Math.hypot(hx, hy / ANEL_Q)));
  return [r, r * ANEL_Q];
}

/**
 * Sombra de contato da arte grande (alta definição): suave como as sombras dos móveis, bem escura
 * no miolo (onde a sola encosta) e sumindo para fora.
 */
function desenharSombraSuave(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.72)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.8, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Sombra projetada por uma luz: para onde vai no chão (casas), a que distância a luz está e quão escura é. */
interface SombraDaLuz {
  D: [number, number];
  dist: number;
  a: number;
}

/**
 * As luzes do cenário que alcançam a peça: a cor que bate no corpo (a média,
 * pelo peso de cada uma) e as sombras que ela projeta (as duas luzes mais
 * fortes, cada sombra para o lado oposto ao da sua luz). (mx, my) = o meio do
 * corpo na tela; (cx, cy) = os pés no cômodo.
 */
function luzesDaPeca(luzes: { L: Light; i: number }[], mx: number, my: number, cx: number, cy: number): { luz: LuzNaPeca | null; sombras: SombraDaLuz[] } {
  let r = 0;
  let g = 0;
  let b = 0;
  let soma = 0;
  const sombras: SombraDaLuz[] = [];
  for (const { L, i } of luzes) {
    const d = Math.hypot(L.x - mx, L.y - my);
    if (d >= L.radius || !L.mundo) continue;
    const w = i * (1 - d / L.radius) ** 2;
    const [cr, cg, cb] = hexToRgb(L.color);
    if (Number.isFinite(cr + cg + cb)) {
      r += cr * w;
      g += cg * w;
      b += cb * w;
      soma += w;
    }
    const dx = cx - L.mundo[0];
    const dy = cy - L.mundo[1];
    const dist = Math.hypot(dx, dy);
    // luz bem em cima da peça: a sombra fica embaixo dela (a de contato)
    if (dist > 0.35) sombras.push({ D: [dx / dist, dy / dist], dist, a: w });
  }
  sombras.sort((p, q) => q.a - p.a);
  return {
    luz: soma > 0 ? { rgb: [r / soma, g / soma, b / soma], forca: Math.min(1, soma * 1.6) } : null,
    sombras: sombras.slice(0, 2),
  };
}

/** Na tela, um passo no chão do cômodo (em casas). */
const telaDoChao = (x: number, y: number): [number, number] => [(x - y) * 32, (x + y) * 16];

/**
 * Vetores da sombra projetada (por pixel do quadro): a largura do corpo vai de
 * través no chão e a altura vai na direção D, encurtada por `comprimento`. Na
 * tela, o corpo tem a largura de um passo na diagonal do chão (45,25 pixels por casa).
 */
function vetoresDaSombra(D: [number, number], comprimento: number): { lado: [number, number]; comp: [number, number] } {
  const K = Math.SQRT2 / 64;
  let lado = telaDoChao(D[1], -D[0]);
  // sem espelhar: o lado direito da peça fica à direita na sombra
  if (lado[0] < 0) lado = [-lado[0], -lado[1]];
  const c = telaDoChao(D[0], D[1]);
  return { lado: [lado[0] * K, lado[1] * K], comp: [c[0] * K * comprimento, c[1] * K * comprimento] };
}

export type Selection = { kind: 'floor' | 'wall' | 'user'; id: number } | null;
export type FloorPlacement = { kind: 'floor'; defId: string; rot: number; invId?: number; moveId?: number };
export type WallPlacement = { kind: 'wall'; defId: string; invId?: number; moveId?: number };
export type Placement = FloorPlacement | WallPlacement;
export interface WallTarget {
  wall: 'l' | 'r';
  plane: number;
  pos: number;
  z: number;
  ok: boolean;
}

export interface RoomEvents {
  walk(x: number, y: number): void;
  lookAt(x: number, y: number): void;
  placeFloor(p: FloorPlacement, x: number, y: number, keep: boolean): void;
  placeWall(p: WallPlacement, t: WallTarget, keep: boolean): void;
  use(id: number): void;
  select(sel: Selection): void;
  openHint(kind: 'floor' | 'wall', id: number): void;
  /** um aviso curto para quem está mexendo no tabuleiro */
  aviso?(texto: string): void;
}

interface Hit {
  kind: 'user' | 'floor' | 'wall';
  id: number;
  test(x: number, y: number): boolean;
}

interface HintTarget {
  kind: 'floor' | 'wall';
  id: number;
  hint: Hint;
  wx: number;
  wy: number;
  sx: number;
  sy: number;
}

/** Nível de energia no modo "piscando": rajadas de falhas sincronizadas pelo relógio. */
function flickerLevel(t: number): number {
  const burst = hash(Math.floor(t / 2100)) < 0.55;
  if (!burst) return 0.9 + 0.1 * Math.sin(t / 140);
  const r = hash(Math.floor(t / 70) + 7);
  return r < 0.32 ? 0.04 : r < 0.5 ? 0.45 : 1;
}

const ZOOMS =[0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
/** duração do deslize de um mobi com senha */
const SLIDE_MS = 1500;
/** abaixo deste zoom o cômodo não é encolhido: a câmera acompanha as peças */
const FIT_MIN = 0.72;
const BG = '#07060a';
/** a pessoa (~1,78 m) em unidades de altura: a caixa dela na ordem de desenho e no raio-x */
const ALTURA_PESSOA = 1.78 * Z_PER_M;
const AMBER = 'rgba(255,196,90,0.95)';

export class RoomView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private events: RoomEvents;
  private dpr = 1;
  private vw = 0;
  private vh = 0;
  zoom = 1;
  private cam = { x: 0, y: 0 };
  /** área do canvas que fica à vista (o resto fica sob os painéis) */
  private frameRect = { x: 0, y: 0, w: 0, h: 0 };
  /** enquadramento automático até o usuário mexer no zoom */
  private autoFit = true;
  /** centro (mundo) de cada objeto no último quadro, para fotos */
  private centers = new Map<string, [number, number]>();
  /** mobis com senha deslizando (abrindo ou fechando a passagem) */
  private slides = new Map<number, { fx: number; fy: number; t0: number }>();
  /** câmera deslizando até um alvo */
  private camAnim: { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number } | null = null;
  /** marcas de destino (clique no chão) e anéis de seleção */
  private marks: { x: number; y: number; z: number; t0: number; color: string }[] = [];
  private pulses: { key: string; t0: number }[] = [];
  map: RoomMap | null = null;
  info: RoomInfo | null = null;
  users = new Map<number, ClientUser>();
  myId = 0;
  selection: Selection = null;
  placement: Placement | null = null;
  private painter = new Painter();
  private mapper = new Mapper();
  private lighting = new Lighting();
  /** as celas da cena (porta de cela): fechadas no escuro, abertas acesas */
  private celas = new Celas();
  private fog = new Fog();
  private particles = new Particles();
  /** cômodo grande demais para caber: a câmera acompanha as peças */
  private follow = false;
  private followAt = 0;
  private bubbles = new Bubbles();
  private staticLayer: StaticLayer | null = null;
  /** a Viagem: o mundo passando por fora da van (só nas cenas de viagem) */
  private mundoViagem = new MundoViagem();
  private staticKey = '';
  private tilesFrontFirst: [number, number, number][] = [];
  private hits: Hit[] = [];
  private hintTargets: HintTarget[] = [];
  private mouse = { x: -1, y: -1, inside: false };
  private hoverTile: { x: number; y: number } | null = null;
  /** a casa do mouse está atrás do desenho de um móvel (o contorno vai por cima de tudo) */
  private cursorPorCima = false;
  private hoverKey = '';
  private wallTarget: WallTarget | null = null;
  private drag: { sx: number; sy: number; cx: number; cy: number; tx: number; ty: number; moved: boolean } | null = null;
  private lastClick = { t: 0, key: '' };
  private raf = 0;
  private door: { seg: WallSeg; path: Path2D } | null = null;

  /** tamanho fixo (render fora da tela) */
  private fixed: { w: number; h: number } | null = null;
  /**
   * Só assistir (tela da mesa): sem clique, arrasto ou zoom, sem ícones de
   * pista, e o quarto sempre enquadrado.
   */
  watchOnly = false;
  /** marcações do combate (a tela COMBATE e a mesa preenchem; null = nenhuma) */
  combate: MarcasCombate | null = null;
  /** estado de cada peça (com a arma, machucada): escolhe a pose do tabuleiro, quando o personagem tem (null = desarmado) */
  estadoDe: ((id: number) => PortraitState | null) | null = null;
  /** clique numa peça: devolve true quando a tela usou o clique (escolher o alvo sem trocar a peça comandada) */
  aoClicarPeca: ((id: number) => boolean) | null = null;
  /** clique numa casa para uma ferramenta (medir, área): devolve true quando usou o clique */
  aoClicarCasa: ((x: number, y: number) => boolean) | null = null;
  /** PV de cada peça, de 0 a 1 (o arco em volta da ficha no mapa tático) */
  pvDe: ((id: number) => number | null) | null = null;
  /**
   * Vista tática: a câmera sai do isométrico, gira e sobe até ver a sala de cima, como um mapa de
   * batalha (o mestre liga, info.tatico; a mesa acompanha). t vai de 0 (isométrico) a 1 (em cima);
   * a foto é o isométrico, que se desfaz no começo do caminho.
   */
  private tat: { t: number; alvo: number; antes: number; foto: HTMLCanvasElement | null; v: CameraVoo | null; e: Enquadre | null } = { t: 0, alvo: 0, antes: 0, foto: null, v: null, e: null };
  /**
   * O zoom do mapa tático (só nesta tela; a mesa não acompanha): o enquadre da sala vezes k, deslocado
   * de (dx, dy) px do canvas. k = 1 é a sala inteira no quadro.
   */
  private tatZoom = { k: 1, dx: 0, dy: 0 };
  /** o retrato de cada peça para a ficha do mapa tático */
  private retratos = new Map<number, { chave: string; c: HTMLCanvasElement }>();
  /** o ponto de atenção e os desenhos do mestre (chegam do servidor) */
  readonly marcasMesa = new MarcasMesa();
  /** a névoa revelada aos poucos */
  private nevoaView = new NevoaMesa();
  /** a ferramenta do mestre ligada (null = o clique de sempre) */
  ferramenta: FerramentaMesa | null = null;
  /** o mestre marcou o tabuleiro (ponto ou desenho): a tela manda para o servidor */
  aoMarcar: ((m: MarcaMesa) => void) | null = null;
  /** o mestre pintou a névoa (mostrar ou esconder as casas) */
  aoPintarNevoa: ((casas: { x: number; y: number }[], vista: boolean) => void) | null = null;
  /** o risco em andamento (desenho ou pincel da névoa) */
  private risco: { ferr: FerramentaMesa; pintadas: Set<string> } | null = null;
  /** a câmera da mesa foi até o ponto de atenção: a de seguir as peças espera até lá */
  private pontoAte = 0;

  /** A vista tática está ligada (ou indo para lá). */
  get tatico(): boolean {
    return this.tat.alvo === 1;
  }

  /** Casa do mouse (para as ferramentas do combate). */
  get casaDoMouse(): { x: number; y: number } | null {
    return this.mouse.inside ? this.hoverTile : null;
  }

  constructor(canvas: HTMLCanvasElement, events: RoomEvents, live = true) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.events = events;
    this.painter.ctx = this.ctx;
    if (!live) return;
    this.bindInput();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      try {
        this.frame();
      } catch (e) {
        console.error(e);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  // ---------- estado ----------
  enter(info: RoomInfo, items: FloorItem[], wallItems: WallItem[], users: UserInfo[], myId: number) {
    this.info = info;
    // a cena nova já abre na vista dela (sem a câmera voar na entrada)
    this.tat.alvo = this.tat.t = info.tatico ? 1 : 0;
    this.tatZoom = { k: 1, dx: 0, dy: 0 };
    this.tat.foto = null;
    this.map = new RoomMap(info.heightmap, info.door, items, wallItems);
    // ao ar livre não tem parede: ninguém fica atrás da porta
    this.door = info.aberto ? null : doorClipPath(this.map);
    this.fog.setMap(this.map);
    this.particles.setRoom(this.map, info.particles);
    // mantém a peça ativa se ela estiver nesta cena
    this.myId = users.some((u) => u.id === myId) ? myId : 0;
    this.users.clear();
    for (const u of users) this.addUser(u);
    this.selection = null;
    this.placement = null;
    this.staticKey = '';
    this.bubbles.clear();
    this.rebuildTiles();
    this.resize();
    this.needFit = true;
    if (this.vw > 0 && this.vh > 0) this.fit();
  }

  /** enquadrar assim que o canvas tiver tamanho (a aba pode estar oculta ao entrar) */
  private needFit = false;

  /** Escolhe o maior zoom em que o quarto inteiro cabe na tela e centraliza. */
  fit() {
    if (!this.map) return;
    const b = roomBounds(this.map, !!this.info?.aberto);
    const f = this.frame_();
    // a Viagem: a van num pedaço do quadro, para o mundo passando aparecer em volta
    const k = this.info?.viagem ? 2.2 : 1;
    const bw = (b.maxX - b.minX) * k + 16;
    const bh = (b.maxY - b.minY) * k + 16;
    const availW = f.w;
    const availH = f.h;
    // zoom contínuo: o quarto preenche o tabuleiro
    // um pouco além do encaixe exato: as bordas do quarto passam por baixo dos papéis
    const z = Math.max(0.35, Math.min(2.5, Math.min(availW / bw, availH / bh) * 1.1));
    this.needFit = false;
    this.autoFit = true;
    this.bubbles.clear();
    // cômodo grande: em vez de encolher tudo, fica num zoom confortável e acompanha as peças
    if (z < FIT_MIN && this.users.size) {
      this.zoom = FIT_MIN;
      this.follow = true;
      this.followParty(false);
      return;
    }
    this.follow = false;
    this.zoom = z;
    this.center();
  }

  /** Centro das peças na tela (mundo), dentro dos limites do cômodo. */
  private partyTarget(): [number, number] | null {
    if (!this.map || !this.users.size) return null;
    const now = performance.now();
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      // a câmera da mesa não vai atrás de quem está na névoa
      if (this.escondeNevoa && NevoaMesa.escondida(this.info?.nevoa, p.x + 0.5, p.y + 0.5)) continue;
      const [x, y] = iso(p.x + 0.5, p.y + 0.5, p.z);
      sx += x;
      sy += y - 40;
      n++;
    }
    if (!n) return null;
    const b = roomBounds(this.map, !!this.info?.aberto);
    const f = this.frame_();
    const hw = f.w / 2 / this.zoom;
    const hh = f.h / 2 / this.zoom;
    const clamp = (v: number, a: number, c: number) => (a > c ? (a + c) / 2 : Math.max(a, Math.min(c, v)));
    return [clamp(sx / n, b.minX + hw - 40, b.maxX - hw + 40), clamp(sy / n, b.minY + hh - 40, b.maxY - hh + 40)];
  }

  /** Leva a câmera para as peças (sem desligar o enquadramento automático). */
  private followParty(smooth: boolean) {
    const t = this.partyTarget();
    if (!t) return;
    const f = this.frame_();
    const tx = Math.round(f.x + f.w / 2 - t[0] * this.zoom);
    const ty = Math.round(f.y + f.h / 2 - t[1] * this.zoom);
    if (!smooth) {
      this.camAnim = null;
      this.cam.x = tx;
      this.cam.y = ty;
      return;
    }
    if (Math.hypot(tx - this.cam.x, ty - this.cam.y) < f.w * 0.18) return;
    const dist = Math.hypot(tx - this.cam.x, ty - this.cam.y);
    this.camAnim = { fx: this.cam.x, fy: this.cam.y, tx, ty, t0: performance.now(), dur: Math.min(1400, 500 + dist * 0.8) };
  }

  /** Área visível do tabuleiro, em px do canvas (null = canvas inteiro). */
  setFrame(r: { x: number; y: number; w: number; h: number } | null) {
    const n = r ?? { x: 0, y: 0, w: 0, h: 0 };
    const o = this.frameRect;
    if (Math.abs(n.x - o.x) < 0.5 && Math.abs(n.y - o.y) < 0.5 && Math.abs(n.w - o.w) < 0.5 && Math.abs(n.h - o.h) < 0.5) return;
    const before = this.frame_();
    this.frameRect = { ...n };
    const after = this.frame_();
    if (this.map && this.autoFit && after.w > 0 && after.h > 0) this.fit();
    else {
      this.cam.x += after.x + after.w / 2 - (before.x + before.w / 2);
      this.cam.y += after.y + after.h / 2 - (before.y + before.h / 2);
    }
  }

  /** Tela MAPA: dentro da moldura, fundo azul-escuro com pontinhos (docs/referencias/mapa.webp). */
  fundoPontos = false;
  private padraoPontos: CanvasPattern | null = null;

  private pintarFundo(ctx: CanvasRenderingContext2D) {
    const fr = this.frame_();
    const dpr = this.dpr;
    if (!this.padraoPontos) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.round(22 * dpr);
      const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(140, 170, 220, 0.34)';
      g.beginPath();
      g.arc(11 * dpr, 11 * dpr, Math.max(0.8, 1.1 * dpr), 0, Math.PI * 2);
      g.fill();
      this.padraoPontos = ctx.createPattern(c, 'repeat');
    }
    ctx.save();
    const x = fr.x * dpr;
    const y = fr.y * dpr;
    const w = fr.w * dpr;
    const h = fr.h * dpr;
    const grad = ctx.createRadialGradient(x + w / 2, y + h * 0.45, 10, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, '#151b28');
    grad.addColorStop(1, '#090c12');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    if (this.padraoPontos) {
      ctx.fillStyle = this.padraoPontos;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  private frame_() {
    const f = this.frameRect;
    return f.w > 0 && f.h > 0 ? f : { x: 0, y: 0, w: this.vw, h: this.vh };
  }

  leave() {
    this.map = null;
    this.info = null;
    this.users.clear();
    this.bubbles.clear();
    this.selection = null;
    this.placement = null;
  }

  updateInfo(info: RoomInfo) {
    this.info = info;
    this.tat.alvo = info.tatico ? 1 : 0;
    if (!info.tatico) this.tatZoom = { k: 1, dx: 0, dy: 0 };
  }

  private rebuildTiles() {
    const map = this.map!;
    const t: [number, number, number][] = [];
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const h = map.floorHeight(x, y);
        if (h !== null) t.push([x, y, h]);
      }
    t.sort((a, b) => b[0] + b[1] - (a[0] + a[1]) || b[2] - a[2]);
    this.tilesFrontFirst = t;
  }

  addUser(u: UserInfo) {
    this.users.set(u.id, {
      id: u.id,
      name: u.name,
      look: u.look,
      x: u.x,
      y: u.y,
      z: u.z,
      dir: u.dir,
      headDir: u.headDir,
      sit: u.sit,
      dance: u.dance,
      agachado: u.agachado,
      anim: u.mv ? { fx: u.x, fy: u.y, fz: u.z, tx: u.mv.x, ty: u.mv.y, tz: u.mv.z, start: performance.now() } : null,
      waveUntil: 0,
      phase: Math.random() * 10,
      color: u.color ?? playerColorFor(u.name),
    });
  }

  removeUser(id: number) {
    this.users.delete(id);
    if (this.selection?.kind === 'user' && this.selection.id === id) this.select(null);
  }

  setLook(id: number, look: AvatarLook) {
    const u = this.users.get(id);
    if (u) u.look = look;
  }

  wave(id: number) {
    const u = this.users.get(id);
    if (u) u.waveUntil = performance.now() + 2200;
  }

  applyStatus(s: UserStatus) {
    const u = this.users.get(s.id);
    if (!u) return;
    const now = performance.now();
    if (s.mv) {
      const cur = this.userPos(u, now);
      const far = Math.abs(cur.x - s.x) > 1.5 || Math.abs(cur.y - s.y) > 1.5;
      const f = far ? { x: s.x, y: s.y, z: s.z } : cur;
      u.anim = { fx: f.x, fy: f.y, fz: f.z, tx: s.mv.x, ty: s.mv.y, tz: s.mv.z, start: now };
    } else if (u.anim && !(u.anim.tx === s.x && u.anim.ty === s.y)) u.anim = null;
    else if (u.anim) u.anim.tz = s.z;
    // virou sem sair do lugar: efeito de giro
    if (!s.mv && !u.anim && s.dir !== u.dir) u.turnAt = now;
    u.x = s.x;
    u.y = s.y;
    u.z = s.z;
    u.dir = s.dir;
    u.headDir = s.headDir;
    u.sit = s.sit;
    u.dance = s.dance;
  }

  /** O tile da porta fica atrás da parede; o avatar é mostrado dentro do vão. */
  private vis(x: number, y: number): [number, number] {
    const d = this.door;
    if (!d || x !== this.map!.door.x || y !== this.map!.door.y) return [x, y];
    return d.seg.wall === 'l' ? [x + 0.45, y] : [x, y + 0.45];
  }

  private userPos(u: ClientUser, now: number) {
    if (u.anim) {
      const t = (now - u.anim.start) / TICK_MS;
      const k = Math.min(1, Math.max(0, t));
      const [fx, fy] = this.vis(u.anim.fx, u.anim.fy);
      const [tx, ty] = this.vis(u.anim.tx, u.anim.ty);
      return {
        x: fx + (tx - fx) * k,
        y: fy + (ty - fy) * k,
        z: u.anim.fz + (u.anim.tz - u.anim.fz) * k,
        moving: t < 1.1,
      };
    }
    const [x, y] = this.vis(u.x, u.y);
    return { x, y, z: u.z, moving: false };
  }

  /** A altura da pessoa na tela (zoom 1): a arte dela vem na escala antiga e o tabuleiro reduz (ESCALA_ARTE_PESSOA). */
  private avatarHeight(u: ClientUser) {
    const sp = u.look.charId ? sprites.get(u.look.charId) : null;
    return (sp ? sp.def.height : PIXEL_AVATAR_HEIGHT) * ESCALA_ARTE_PESSOA;
  }

  chat(id: number, name: string, text: string, kind: ChatKind, roll?: RollResult) {
    const u = this.users.get(id);
    if (!u || kind === 'system') return;
    const p = this.userPos(u, performance.now());
    const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
    const headY = (wy - this.avatarHeight(u) - (u.sit ? 0 : 6)) * this.zoom + this.cam.y;
    this.bubbles.add(this.ctx, wx, headY, name, text, kind, u.look, roll);
  }

  addItem(it: FloorItem) {
    this.map?.addItem(it);
  }
  updateItem(it: FloorItem) {
    const old = this.map?.getItem(it.id);
    // fechadura abriu ou fechou: o mobi desliza até o lugar novo, arrastando
    if (old?.lock && it.lock && old.lock.open !== it.lock.open && (old.x !== it.x || old.y !== it.y)) {
      this.slides.set(it.id, { fx: old.x, fy: old.y, t0: performance.now() });
      sfx.scrape(SLIDE_MS);
    }
    this.map?.updateItem(it);
  }

  /** Posição desenhada de um mobi que está deslizando (pesado: custa a sair, trepida, para). */
  private slidPos(it: FloorItem, now: number) {
    const s = this.slides.get(it.id);
    if (!s) return it;
    const t = (now - s.t0) / SLIDE_MS;
    if (t >= 1) {
      this.slides.delete(it.id);
      return it;
    }
    const e = t < 0.14 ? t * 0.25 : 0.035 + 0.965 * (1 - Math.pow(1 - (t - 0.14) / 0.86, 3));
    const shake = t > 0.14 && t < 0.92 ? Math.sin(now / 16) * 0.012 : 0;
    return { ...it, x: s.fx + (it.x - s.fx) * e + shake, y: s.fy + (it.y - s.fy) * e + shake * 0.5 };
  }
  removeItem(id: number) {
    this.map?.removeItem(id);
    if (this.selection?.kind === 'floor' && this.selection.id === id) this.select(null);
  }
  setWallItem(it: WallItem) {
    this.map?.setWallItem(it);
  }
  removeWallItem(id: number) {
    this.map?.removeWallItem(id);
    if (this.selection?.kind === 'wall' && this.selection.id === id) this.select(null);
  }

  select(sel: Selection) {
    this.selection = sel;
    if (sel && sel.kind !== 'user') this.pulses.push({ key: sel.kind + sel.id, t0: performance.now() });
    this.events.select(sel);
  }

  startPlacement(p: Placement) {
    this.placement = p;
    if (p.kind === 'floor') this.updateFloorGhostRot();
    this.select(null);
  }

  cancelPlacement() {
    this.placement = null;
  }

  rotatePlacement() {
    const p = this.placement;
    if (p?.kind !== 'floor') return;
    const def = getFurni(p.defId);
    if (!def) return;
    const i = def.rotations.indexOf(p.rot);
    p.rot = def.rotations[(i + 1) % def.rotations.length];
  }

  private updateFloorGhostRot() {
    const p = this.placement;
    if (p?.kind !== 'floor') return;
    const def = getFurni(p.defId);
    if (def && !def.rotations.includes(p.rot)) p.rot = def.rotations[0];
  }

  // ---------- câmera ----------
  resize() {
    const dpr = this.fixed ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const w = this.fixed ? this.fixed.w : this.canvas.clientWidth;
    const h = this.fixed ? this.fixed.h : this.canvas.clientHeight;
    if (w !== this.vw || h !== this.vh || dpr !== this.dpr) {
      const dx = (w - this.vw) / 2;
      const dy = (h - this.vh) / 2;
      if (this.vw && !(this.frameRect.w > 0)) {
        this.cam.x += dx;
        this.cam.y += dy;
      }
      this.vw = w;
      this.vh = h;
      this.dpr = dpr;
      this.padraoPontos = null;
      // mudou o tamanho e ninguém mexeu na câmera: enquadra de novo
      if (this.autoFit || this.watchOnly) this.needFit = true;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    if (this.needFit && this.map && w > 0 && h > 0) this.fit();
  }

  center() {
    if (!this.map) return;
    const b = roomBounds(this.map, !!this.info?.aberto);
    const f = this.frame_();
    this.cam.x = Math.round(f.x + f.w / 2 - ((b.minX + b.maxX) / 2) * this.zoom);
    this.cam.y = Math.round(f.y + f.h / 2 - ((b.minY + b.maxY) / 2) * this.zoom);
  }

  setZoom(z: number, ax = this.frame_().x + this.frame_().w / 2, ay = this.frame_().y + this.frame_().h / 2) {
    if (z === this.zoom) return;
    this.autoFit = false;
    this.camAnim = null;
    const wx = (ax - this.cam.x) / this.zoom;
    const wy = (ay - this.cam.y) / this.zoom;
    this.zoom = z;
    this.cam.x = Math.round(ax - wx * z);
    this.cam.y = Math.round(ay - wy * z);
    this.bubbles.clear();
  }

  zoomStep(dir: 1 | -1, ax?: number, ay?: number) {
    // próximo nível acima/abaixo do zoom atual (que pode ser contínuo após enquadrar)
    const n = dir > 0 ? ZOOMS.find((z) => z > this.zoom + 1e-3) : [...ZOOMS].reverse().find((z) => z < this.zoom - 1e-3);
    if (n) this.setZoom(n, ax, ay);
  }

  /** Aproxima (f > 1) ou afasta o mapa tático, com o ponto (px, py) do canvas parado; de 1x a 5x. */
  zoomTatico(f: number, px: number, py: number) {
    const z = this.tatZoom;
    const k = Math.max(1, Math.min(5, z.k * f));
    if (k === 1) {
      this.tatZoom = { k: 1, dx: 0, dy: 0 };
      return;
    }
    const g = k / z.k;
    this.tatZoom = { k, dx: px + (z.dx - px) * g, dy: py + (z.dy - py) * g };
  }

  private toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.cam.x) / this.zoom, (sy - this.cam.y) / this.zoom];
  }

  // ---------- entrada ----------
  private bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (this.watchOnly) return;
      this.mouse = { x: e.offsetX, y: e.offsetY, inside: true };
      this.updateHover();
      if (e.button === 2) {
        if (this.placement) this.rotatePlacement();
        return;
      }
      if (e.button !== 0) return;
      c.setPointerCapture(e.pointerId);
      // a ferramenta do mestre (ou o Alt, que aponta sem ligar nada)
      if ((this.ferramenta || e.altKey) && !this.placement && this.info?.isOwner) {
        this.comecarRisco(this.ferramenta ?? { tipo: 'ponto' });
        return;
      }
      this.drag = { sx: e.offsetX, sy: e.offsetY, cx: this.cam.x, cy: this.cam.y, tx: this.tatZoom.dx, ty: this.tatZoom.dy, moved: false };
    });
    c.addEventListener('pointermove', (e) => {
      if (this.watchOnly) return;
      this.mouse = { x: e.offsetX, y: e.offsetY, inside: true };
      if (this.risco) {
        this.updateHover();
        this.seguirRisco();
        return;
      }
      const d = this.drag;
      if (d) {
        const dx = e.offsetX - d.sx;
        const dy = e.offsetY - d.sy;
        if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
        if (d.moved && this.tat.t <= 0) {
          this.autoFit = false;
          this.camAnim = null;
          const ny = Math.round(d.cy + dy);
          this.bubbles.pan(ny - this.cam.y);
          this.cam.x = Math.round(d.cx + dx);
          this.cam.y = ny;
        } else if (d.moved && this.tat.t >= 1 && this.tatZoom.k > 1) {
          // com zoom, arrastar anda pelo mapa tático
          this.tatZoom.dx = d.tx + dx * this.dpr;
          this.tatZoom.dy = d.ty + dy * this.dpr;
        }
      }
      this.updateHover();
    });
    c.addEventListener('pointerup', (e) => {
      if (this.risco) {
        this.mouse = { x: e.offsetX, y: e.offsetY, inside: true };
        this.acabarRisco();
        return;
      }
      const d = this.drag;
      this.drag = null;
      if (d && !d.moved && e.button === 0) {
        this.mouse = { x: e.offsetX, y: e.offsetY, inside: true };
        this.updateHover();
        this.click(e.shiftKey);
      }
    });
    c.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
      this.hoverTile = null;
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.watchOnly) return;
        if (this.tat.t >= 1) this.zoomTatico(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.offsetX * this.dpr, e.offsetY * this.dpr);
        else if (this.tat.t <= 0) this.zoomStep(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY);
      },
      { passive: false },
    );
  }

  /** O ponto do chão embaixo do mouse, em casas (com fração), no isométrico ou no mapa tático. */
  private pontoNoChao(): [number, number] | null {
    if (!this.map || !this.mouse.inside) return null;
    if (this.tat.t > 0) {
      const e = this.tat.e;
      if (this.tat.t < 1 || !e) return null;
      return [(this.mouse.x * this.dpr - e.x) / e.casa, (this.mouse.y * this.dpr - e.y) / e.casa];
    }
    const [wx, wy] = this.toWorld(this.mouse.x, this.mouse.y);
    let [x, y] = unIso(wx, wy, 0);
    const h = this.map.floorHeight(Math.floor(x), Math.floor(y));
    if (h) [x, y] = unIso(wx, wy, h);
    return [x, y];
  }

  /** As casas do pincel da névoa em volta da casa do mouse. */
  private casasDoPincel(raio: number): { x: number; y: number }[] {
    const t = this.hoverTile;
    const map = this.map;
    if (!t || !map) return [];
    return casasEmVolta(t.x, t.y, raio).filter((c) => map.floorHeight(c.x, c.y) !== null);
  }

  private comecarRisco(ferr: FerramentaMesa) {
    this.risco = { ferr, pintadas: new Set() };
    const p = this.pontoNoChao();
    if (ferr.tipo === 'traco' && p) this.marcasMesa.rascunho = { forma: ferr.forma, cor: ferr.cor, pts: [p, p] };
    if (ferr.tipo === 'nevoa') this.pintar();
  }

  private seguirRisco() {
    const r = this.risco;
    if (!r) return;
    if (r.ferr.tipo === 'nevoa') return this.pintar();
    const rasc = this.marcasMesa.rascunho;
    const p = this.pontoNoChao();
    if (!rasc || !p) return;
    if (rasc.forma === 'livre') {
      const u = rasc.pts[rasc.pts.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) > 0.12 && rasc.pts.length < 400) rasc.pts.push(p);
      // o primeiro par era o ponto repetido
      if (rasc.pts.length === 3 && rasc.pts[0][0] === rasc.pts[1][0] && rasc.pts[0][1] === rasc.pts[1][1]) rasc.pts.splice(1, 1);
    } else rasc.pts[1] = p;
  }

  private acabarRisco() {
    const r = this.risco;
    this.risco = null;
    if (!r) return;
    if (r.ferr.tipo === 'ponto') {
      const p = this.pontoNoChao();
      if (p) this.aoMarcar?.({ tipo: 'ponto', x: p[0], y: p[1] });
      return;
    }
    if (r.ferr.tipo === 'traco') {
      const rasc = this.marcasMesa.rascunho;
      this.marcasMesa.rascunho = null;
      if (!rasc) return;
      const [a, b] = [rasc.pts[0], rasc.pts[rasc.pts.length - 1]];
      // um clique sem arrastar não desenha nada
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.2 && rasc.pts.length < 4) return;
      this.aoMarcar?.({ tipo: 'traco', forma: rasc.forma, cor: rasc.cor, pts: rasc.pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]) });
    }
  }

  /** O pincel da névoa: as casas debaixo dele que ainda não foram pintadas neste risco. */
  private pintar() {
    const r = this.risco;
    if (!r || r.ferr.tipo !== 'nevoa') return;
    const novas = this.casasDoPincel(r.ferr.raio).filter((c) => !r.pintadas.has(`${c.x},${c.y}`));
    if (!novas.length) return;
    for (const c of novas) r.pintadas.add(`${c.x},${c.y}`);
    this.aoPintarNevoa?.(novas, r.ferr.vista);
  }

  /** Chegou um ponto de atenção ou um desenho. Na mesa, com o cômodo grande, a câmera vai até o ponto. */
  receberMarca(m: MarcaMesa) {
    this.marcasMesa.add(m);
    if (m.tipo !== 'ponto' || !this.watchOnly || !this.follow || this.tat.t > 0) return;
    const h = this.map?.floorHeight(Math.floor(m.x), Math.floor(m.y)) ?? 0;
    const [wx, wy] = iso(m.x, m.y, h);
    const f = this.frame_();
    const tx = Math.round(f.x + f.w / 2 - wx * this.zoom);
    const ty = Math.round(f.y + f.h / 2 - (wy - 30) * this.zoom);
    this.pontoAte = performance.now() + 4000;
    this.camAnim = { fx: this.cam.x, fy: this.cam.y, tx, ty, t0: performance.now(), dur: 700 };
  }

  /** A mesa não vê o que está na névoa (o mestre vê tudo). */
  private get escondeNevoa(): boolean {
    return !!this.info?.nevoa && !this.info.isOwner;
  }

  private tileAt(wx: number, wy: number): { x: number; y: number } | null {
    for (const [x, y, h] of this.tilesFrontFirst) {
      const [cx, cy] = iso(x + 0.5, y + 0.5, h);
      if (Math.abs(wx - cx) / 32 + Math.abs(wy - cy) / 16 <= 1) return { x, y };
    }
    return null;
  }

  private hintAt(sx: number, sy: number): HintTarget | null {
    for (let i = this.hintTargets.length - 1; i >= 0; i--) {
      const h = this.hintTargets[i];
      if (sx >= h.sx - 13 && sx <= h.sx + 13 && sy >= h.sy - 32 && sy <= h.sy) return h;
    }
    return null;
  }

  private pickAt(wx: number, wy: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) if (this.hits[i].test(wx, wy)) return this.hits[i];
    return null;
  }

  /**
   * O desenho de um móvel alto (estante, balcão, armário) cobre as casas de trás dele. Clicando numa
   * casa de chão livre que não é a base do móvel, o clique é andar até ela (para pôr a peça atrás do
   * balcão); o móvel se escolhe pela base dele ou com o clique duplo.
   */
  private cobreChaoLivre(hit: Hit | null, tile: { x: number; y: number } | null): boolean {
    const map = this.map;
    if (!map || !tile || hit?.kind !== 'floor') return false;
    const it = map.getItem(hit.id);
    const def = it ? getFurni(it.defId) : undefined;
    if (!it || !def || def.walkable || def.sit) return false;
    const fp = footprint(def, it.rot);
    const dx = tile.x - it.x;
    const dy = tile.y - it.y;
    const naPegada = dx >= 0 && dy >= 0 && dx < fp.sx && dy < fp.sy;
    // a peça vazada (a cortina do leito, a mesa em U): a casa de dentro é chão, e a da cortina aberta também
    const naBase = naPegada && (!def.vazio?.length || (ocupa(def, it.rot, dx, dy) && map.walkState(tile.x, tile.y) === 'blocked'));
    return !naBase && map.walkState(tile.x, tile.y) !== 'blocked';
  }

  private updateHover() {
    if (!this.map) return;
    if (this.tat.t > 0) {
      // vista tática: a casa e a peça (ou o móvel) do mapa de cima; no meio do caminho, nada
      this.wallTarget = null;
      const pronto = this.tat.t >= 1;
      this.hoverTile = pronto ? this.casaTatica() : null;
      const hit = pronto && !this.placement && !this.ferramenta ? this.pickTatico() : null;
      this.hoverKey = hit ? hit.kind + hit.id : '';
      this.canvas.style.cursor = this.placement || this.ferramenta ? 'crosshair' : hit ? 'pointer' : 'default';
      return;
    }
    const [wx, wy] = this.toWorld(this.mouse.x, this.mouse.y);
    this.hoverTile = this.tileAt(wx, wy);
    const p = this.placement;
    if (p?.kind === 'wall') {
      const def = getWallFurni(p.defId);
      this.wallTarget = def ? this.computeWallTarget(wx, wy, def) : null;
    } else this.wallTarget = null;
    if (this.ferramenta) {
      this.hoverKey = '';
      this.cursorPorCima = false;
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    const hint = this.hintAt(this.mouse.x, this.mouse.y);
    let hit = hint ? null : this.pickAt(wx, wy);
    this.cursorPorCima = this.cobreChaoLivre(hit, this.hoverTile);
    if (this.cursorPorCima) hit = null;
    this.hoverKey = hint ? `h${hint.kind}${hint.id}` : hit ? `${hit.kind}${hit.id}` : '';
    this.canvas.style.cursor = this.placement ? 'crosshair' : hint || hit ? 'pointer' : 'default';
  }

  private click(shift: boolean) {
    const map = this.map;
    if (!map) return;
    // vista tática: o clique é no mapa de cima (no meio do caminho, nada)
    const tat = this.tat.t > 0;
    if (tat && this.tat.t < 1) return;
    const [wx, wy] = this.toWorld(this.mouse.x, this.mouse.y);
    const now = performance.now();
    const p = this.placement;
    if (p) {
      if (p.kind === 'floor') {
        // colocando ou movendo um móvel: a casa do mouse (de cima, a do mapa tático)
        const t = tat ? this.casaTatica() : this.tileAt(wx, wy);
        if (t) this.events.placeFloor(p, t.x, t.y, shift);
      } else if (tat) {
        // de cima não aparece a parede para escolher o lugar
        this.events.aviso?.('Item de parede: coloque na vista isométrica (tecla T).');
      } else {
        const def = getWallFurni(p.defId);
        const t = def ? this.computeWallTarget(wx, wy, def) : null;
        if (t) this.events.placeWall(p, t, shift);
      }
      return;
    }
    const hint = tat ? null : this.hintAt(this.mouse.x, this.mouse.y);
    if (hint) {
      this.events.openHint(hint.kind, hint.id);
      return;
    }
    let hit = tat ? this.pickTatico() : this.pickAt(wx, wy);
    const key = hit ? `${hit.kind}${hit.id}` : '';
    const dbl = key !== '' && key === this.lastClick.key && now - this.lastClick.t < 380;
    this.lastClick = { t: dbl ? 0 : now, key };
    let tile = tat ? this.casaTatica() : this.tileAt(wx, wy);
    // o desenho do móvel por cima de chão livre: um clique é andar (o duplo usa o móvel)
    if (!tat && !dbl && this.cobreChaoLivre(hit, tile)) hit = null;
    // ferramenta do combate (medir, área): a casa da peça também serve
    if (this.aoClicarCasa) {
      if (!tile && hit?.kind === 'user') {
        const u = this.users.get(hit.id);
        if (u) tile = { x: u.x, y: u.y };
      }
      if (tile && this.aoClicarCasa(tile.x, tile.y)) return;
    }

    if (hit?.kind === 'user') {
      if (this.aoClicarPeca?.(hit.id)) return;
      // clicar numa peça passa a controlá-la
      this.myId = hit.id;
      this.select({ kind: 'user', id: hit.id });
      return;
    }
    if (hit?.kind === 'wall') {
      if (dbl) this.events.use(hit.id);
      this.select({ kind: 'wall', id: hit.id });
      return;
    }
    if (hit?.kind === 'floor') {
      const it = map.getItem(hit.id);
      const def = it ? getFurni(it.defId) : undefined;
      if (it && def) {
        if (dbl) this.events.use(it.id);
        if (def.walkable || def.sit) {
          const fp = footprint(def, it.rot);
          const inside = tile && tile.x >= it.x && tile.y >= it.y && tile.x < it.x + fp.sx && tile.y < it.y + fp.sy;
          const target = inside ? tile! : { x: it.x, y: it.y };
          if (!(def.flat && !this.info?.canBuild && !it.hint)) this.select({ kind: 'floor', id: it.id });
          else this.select(null);
          this.mark(target.x, target.y);
          this.events.walk(target.x, target.y);
        } else this.select({ kind: 'floor', id: it.id });
        return;
      }
    }
    this.select(null);
    if (tile) {
      this.mark(tile.x, tile.y);
      this.events.walk(tile.x, tile.y);
    }
  }

  /** Marca no chão onde a peça ativa vai parar. */
  private mark(x: number, y: number) {
    const u = this.users.get(this.myId);
    if (!u || !this.map) return;
    this.marks.push({ x, y, z: this.map.standHeight(x, y), t0: performance.now(), color: u.color });
    if (this.marks.length > 6) this.marks.shift();
  }

  // ---------- paredes ----------
  private wallXform(wall: 'l' | 'r', plane: number, pos: number, z: number, def: WallFurniDef) {
    const [cx, cyb] = wall === 'l' ? iso(plane, pos, z) : iso(pos, plane, z);
    const k = wall === 'l' ? -0.5 : 0.5;
    return { ox: cx - def.w / 2, oy: cyb - def.h - (k * def.w) / 2, k };
  }

  private computeWallTarget(wx: number, wy: number, def: WallFurniDef): WallTarget | null {
    const map = this.map!;
    for (const s of map.walls.segs) {
      if (s.door) continue;
      let a: number;
      let z: number;
      if (s.wall === 'l') {
        a = s.plane - wx / 32;
        z = ((s.plane + a) * 16 - wy) / 32;
      } else {
        a = wx / 32 + s.plane;
        z = ((a + s.plane) * 16 - wy) / 32;
      }
      if (a < s.at || a >= s.at + 1 || z < s.base || z > map.walls.top) continue;
      const pos = Math.round(a * 32) / 32;
      const zz = Math.round((z - def.h / 64) * 32) / 32;
      return { wall: s.wall, plane: s.plane, pos, z: zz, ok: map.canPlaceWall(def.id, s.wall, s.plane, pos, zz).ok };
    }
    return null;
  }

  private drawWallItem(it: { id: number; wall: 'l' | 'r'; plane: number; pos: number; z: number; state: number; escala?: number }, def: WallFurniDef, t: number, lights: Light[], alpha: number, outline: string | null) {
    const ctx = this.ctx;
    const { ox, oy, k } = this.wallXform(it.wall, it.plane, it.pos, it.z, def);
    ctx.save();
    ctx.globalAlpha = alpha;
    // com arte: a vista desenhada daquela parede, presa no meio do item
    const zc = it.z + def.h / 64;
    const [px, py] = it.wall === 'l' ? iso(it.plane, it.pos, zc) : iso(it.pos, it.plane, zc);
    // o quadro maior ou menor (o mestre muda): cresce em volta do meio dele
    const e = it.escala ?? 1;
    if (e !== 1) {
      ctx.translate(px, py);
      ctx.scale(e, e);
      ctx.translate(-px, -py);
    }
    const comArte = desenharParedeComArte(ctx, def.id, it.wall, it.state, px, py, it.id);
    ctx.transform(1, k, 0, 1, ox, oy);
    if (!comArte) drawWallFurni(ctx, def, it.state, it.id, t);
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-2, -2, def.w + 4, def.h + 4);
    }
    ctx.restore();
    for (const L of wallLights(def, it.state)) {
      // no cômodo: ao longo da parede, um pouco para dentro dela, na altura da luz
      const ao = (L.x - def.w / 2) / 32;
      const alt = it.z + (def.h - L.y) / 32;
      const mundo: [number, number, number] = it.wall === 'l' ? [it.plane + 0.2, it.pos - ao, alt] : [it.pos + ao, it.plane + 0.2, alt];
      lights.push({ x: ox + L.x, y: oy + k * L.x + L.y, radius: L.radius, color: L.color, intensity: L.intensity * alpha, flicker: L.flicker, pulse: L.pulse, kind: L.kind, seed: it.id, mundo });
    }
    return { ox, oy, k, px, py, e };
  }

  // ---------- quadro ----------
  private frame() {
    const now = performance.now();
    const tat = this.tat;
    // a câmera anda até a vista pedida (1,7 s de ponta a ponta)
    const dt = Math.min(100, now - (tat.antes || now));
    tat.antes = now;
    if (tat.t !== tat.alvo) tat.t = tat.alvo > tat.t ? Math.min(tat.alvo, tat.t + dt / 1700) : Math.max(tat.alvo, tat.t - dt / 1700);
    if (tat.t <= 0) {
      tat.foto = null;
      this.frameIso();
      return;
    }
    // a foto do isométrico, que se desfaz no começo do caminho (na ida e na volta)
    if (tat.t >= 1) tat.foto = null;
    else if (tat.t < 0.22 && !tat.foto && this.map) {
      this.frameIso();
      const f = document.createElement('canvas');
      f.width = this.canvas.width;
      f.height = this.canvas.height;
      f.getContext('2d')!.drawImage(this.canvas, 0, 0);
      tat.foto = f;
    }
    this.frameTatico(now);
  }

  /** A sala vista de cima (ou no caminho até lá), pela câmera tática. */
  private frameTatico(now: number) {
    this.resize();
    const ctx = this.ctx;
    (ctx as CanvasRenderingContext2D & { reset?: () => void }).reset?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.fundoPontos) this.pintarFundo(ctx);
    const map = this.map;
    const info = this.info;
    if (!map || !info) return;
    const dpr = this.dpr;
    const fr = this.frame_();
    const quadro = { x: fr.x * dpr, y: fr.y * dpr, w: fr.w * dpr, h: fr.h * dpr };
    const e0 = enquadrar(map, quadro.w, quadro.h, 34 * dpr, quadro.x, quadro.y);
    const z = this.tatZoom;
    const e = { x: z.dx + e0.x * z.k, y: z.dy + e0.y * z.k, casa: e0.casa * z.k };
    const camIso = { zoom: this.zoom * dpr, camX: this.cam.x * dpr, camY: this.cam.y * dpr };
    const t = this.tat.t;
    const v = cameraVoo(map, camIso, e, t, quadro);
    this.tat.v = v;
    this.tat.e = e;
    const celas = this.celas.quadro(map, now);
    const marcas = this.combate;
    const pos = (id: number) => {
      const u = this.users.get(id);
      if (!u) return null;
      const p = this.userPos(u, now);
      // a peça na névoa: a mesa não vê as marcas do combate dela
      if (this.escondeNevoa && NevoaMesa.escondida(info.nevoa, p.x + 0.5, p.y + 0.5)) return null;
      return { x: p.x, y: p.y };
    };
    const mouse = t >= 1 && this.mouse.inside && !this.watchOnly ? this.hoverTile : null;
    // com zoom, o mapa fica dentro da moldura do tabuleiro
    const recorta = z.k > 1;
    if (recorta) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(quadro.x, quadro.y, quadro.w, quadro.h);
      ctx.clip();
    }
    const nv = info.nevoa;
    const esconde = this.escondeNevoa;
    const pecas = this.pecasTaticas(now).filter((p) => !esconde || !NevoaMesa.escondida(nv, p.x + 0.5, p.y + 0.5));
    desenharMesa(ctx, map, info.floorStyle, pecas, v, {
      mostrarItem: esconde ? (it) => !this.itemOculto(it) : undefined,
      imagemChao: imagemDoMapa(info.mapa),
      terreno: info.terreno,
      // no começo do caminho, o escuro da sala (como no isométrico); em cima, o mapa claro
      escuro: Math.min(0.5, info.darkness * 0.7) * (1 - passo(0.15, 1, t)),
      celas: celas?.casa,
      noChao: (c) => marcasNoChao(c, marcas, pos, mouse, now),
      porCima: (c, vv) => {
        if (nv) this.nevoaView.desenharTatico(c, map, nv, `${info.id}|${info.heightmap}`, esconde, vv, now);
        marcasPorCima(c, vv, marcas, pos, mouse);
        this.edicaoTatica(c, vv);
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (this.ferramenta?.tipo === 'nevoa' && this.mouse.inside && vv.t >= 1) this.desenharPincel(c, (x, y) => projetar(vv, x, y, 0), this.dpr);
        this.marcasMesa.desenhar(c, { proj: (x, y) => projetar(vv, x, y, 0), px: this.dpr, dpr: this.dpr }, now);
        c.restore();
      },
    });
    if (recorta) ctx.restore();
    const foto = this.tat.foto;
    const a = 1 - passo(0, 0.2, t);
    if (foto && a > 0.001) {
      // a foto presa no chão da câmera: no começo ela cobre a maquete e se desfaz
      const M0inv = matrizNaAltura(cameraVoo(map, camIso, e, 0, quadro), 0).inverse();
      ctx.save();
      ctx.globalAlpha = a;
      ctx.setTransform(matrizNaAltura(v, 0).multiply(M0inv));
      ctx.drawImage(foto, 0, 0);
      ctx.restore();
    }
    this.vinheta(ctx);
  }

  /**
   * Na vista tática, mexendo nos móveis: o móvel escolhido com o contorno tracejado e, colocando ou
   * movendo um, o fantasma dele na casa do mouse (verde se cabe, vermelho se não), com a frente
   * marcada (o R e o botão direito giram).
   */
  private edicaoTatica(ctx: CanvasRenderingContext2D, v: CameraVoo) {
    const map = this.map;
    if (!map || v.t < 1) return;
    ctx.save();
    ctx.setTransform(matrizNaAltura(v, 0));
    const px = 1 / v.escala;
    const sel = this.selection;
    const escolhido = sel?.kind === 'floor' ? map.getItem(sel.id) : undefined;
    const defEscolhido = escolhido ? getFurni(escolhido.defId) : undefined;
    if (escolhido && defEscolhido && !this.placement) {
      const fp = footprint(defEscolhido, escolhido.rot);
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.strokeRect(escolhido.x, escolhido.y, fp.sx, fp.sy);
      ctx.setLineDash([]);
    }
    const p = this.placement;
    const t = this.hoverTile;
    const def = p?.kind === 'floor' ? getFurni(p.defId) : undefined;
    if (p?.kind === 'floor' && def && t) {
      const fp = footprint(def, p.rot);
      const ok = map.canPlace(p.defId, t.x, t.y, p.rot, p.moveId).ok;
      ctx.fillStyle = ok ? 'rgba(120,255,160,0.28)' : 'rgba(255,80,80,0.3)';
      ctx.strokeStyle = ok ? 'rgba(120,255,160,0.95)' : 'rgba(255,80,80,0.95)';
      ctx.lineWidth = 2 * px;
      ctx.fillRect(t.x, t.y, fp.sx, fp.sy);
      ctx.strokeRect(t.x, t.y, fp.sx, fp.sy);
      // a frente: o lado para onde o móvel olha (giro 4: +y, 0: -y, 2: +x, 6: -x)
      const [a, b] =
        p.rot === 4
          ? [[t.x, t.y + fp.sy], [t.x + fp.sx, t.y + fp.sy]]
          : p.rot === 0
            ? [[t.x, t.y], [t.x + fp.sx, t.y]]
            : p.rot === 2
              ? [[t.x + fp.sx, t.y], [t.x + fp.sx, t.y + fp.sy]]
              : [[t.x, t.y], [t.x, t.y + fp.sy]];
      ctx.lineWidth = 6 * px;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** As peças como fichas do mapa tático: o retrato, a cor do lado, o PV, a vez, a mira. */
  private pecasTaticas(now: number): PecaTatica[] {
    const m = this.combate;
    const sel = this.selection;
    const out: PecaTatica[] = [];
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      const base = m?.bases.get(u.id);
      out.push({
        id: u.id,
        x: p.x,
        y: p.y,
        nome: u.name,
        cor: base ?? u.color,
        lado: base === COR_LADO.inimigo ? 'ameaca' : 'agente',
        retrato: this.retratoDe(u),
        pv: this.pvDe?.(u.id) ?? undefined,
        vez: !!m?.vez.has(u.id),
        escolhida: !this.watchOnly && (u.id === this.myId || (sel?.kind === 'user' && sel.id === u.id)),
        caido: !!m?.deitadas.has(u.id),
        mira: m?.mira === u.id,
        naArea: !!m?.naArea.has(u.id),
      });
    }
    return out;
  }

  /** O retrato da peça para a ficha do mapa tático (refeito só quando a aparência muda). */
  private retratoDe(u: ClientUser): HTMLCanvasElement {
    const chave = JSON.stringify(u.look);
    const r = this.retratos.get(u.id);
    if (r && r.chave === chave) return r.c;
    const c = portraitCanvas(u.look, 160, { dir: 2 });
    this.retratos.set(u.id, { chave, c });
    return c;
  }

  /** Na vista tática: a casa embaixo do mouse. */
  private casaTatica(): { x: number; y: number } | null {
    const e = this.tat.e;
    return this.map && e && this.mouse.inside ? casaNoPonto(this.map, e, this.mouse.x * this.dpr, this.mouse.y * this.dpr) : null;
  }

  /** Na vista tática: a peça (a ficha redonda) ou o móvel embaixo do mouse. */
  private pickTatico(): Hit | null {
    const map = this.map;
    const e = this.tat.e;
    if (!map || !e || !this.mouse.inside) return null;
    const px = this.mouse.x * this.dpr;
    const py = this.mouse.y * this.dpr;
    const now = performance.now();
    let perto: Hit | null = null;
    let d0 = Infinity;
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      const d = Math.hypot(px - (e.x + (p.x + 0.5) * e.casa), py - (e.y + (p.y + 0.5) * e.casa));
      if (d < e.casa * 0.62 && d < d0) {
        d0 = d;
        perto = { kind: 'user', id: u.id, test: () => true };
      }
    }
    if (perto) return perto;
    const x = (px - e.x) / e.casa;
    const y = (py - e.y) / e.casa;
    let topo: FloorItem | null = null;
    for (const it of map.allItems()) {
      const def = getFurni(it.defId);
      if (!def || /lamp|fluorescent|luz/.test(def.kind) || (def.hidden && it.state !== 1) || (def.flat && !this.info?.canBuild && !it.hint)) continue;
      const fp = footprint(def, it.rot);
      if (x >= it.x && x < it.x + fp.sx && y >= it.y && y < it.y + fp.sy && (!topo || it.z >= topo.z)) topo = it;
    }
    return topo ? { kind: 'floor', id: topo.id, test: () => true } : null;
  }

  private frameIso() {
    this.resize();
    // cômodo grande: de tempos em tempos a câmera vai atrás das peças
    if (this.follow && (this.autoFit || this.watchOnly) && !this.camAnim && performance.now() > this.pontoAte) {
      const n = performance.now();
      if (n - this.followAt > 350) {
        this.followAt = n;
        this.followParty(true);
      }
    }
    if (this.camAnim) {
      const a = this.camAnim;
      const t = Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const nx = Math.round(a.fx + (a.tx - a.fx) * e);
      const ny = Math.round(a.fy + (a.ty - a.fy) * e);
      this.bubbles.pan(ny - this.cam.y);
      this.cam.x = nx;
      this.cam.y = ny;
      if (t >= 1) this.camAnim = null;
    }
    const ctx = this.ctx;
    // tudo do zero a cada quadro: um erro no meio de um desenho não deixa o pincel torto para os próximos
    (ctx as CanvasRenderingContext2D & { reset?: () => void }).reset?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.fundoPontos) this.pintarFundo(ctx);
    const map = this.map;
    if (!map || !this.info) return;
    const now = performance.now();
    const t = Date.now();
    const dpr = this.dpr;
    const z = this.zoom;
    const scale = z * dpr;
    const canBuild = this.info.canBuild;

    const key = `${this.info.id}|${this.info.heightmap}|${map.door.x},${map.door.y}|${scale}|${this.info.floorStyle ?? ''}|${versaoTexturas()}|${this.info.aberto ? 'a' : ''}|${this.info.terreno ?? ''}`;
    if (key !== this.staticKey) {
      this.staticLayer = buildStatic(map, scale, this.info.floorStyle, this.info.terreno, !!this.info.aberto);
      this.staticKey = key;
    }
    // a Viagem: o mundo passa por baixo e por fora; a van (e quem está nela) só balança de leve
    const viagem = this.info.viagem;
    let balanco = 0;
    if (viagem) {
      this.mundoViagem.atualizar(now, viagem);
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      this.mundoViagem.chao(ctx, viagem);
      balanco = this.mundoViagem.balanco(now) * z;
    }
    ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, (this.cam.y + balanco) * dpr);
    const st = this.staticLayer!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(st.canvas, st.x, st.y, st.w, st.h);
    ctx.imageSmoothingEnabled = true;
    if (viagem) this.mundoViagem.casco(ctx, viagem);
    // mapa improvisado: a imagem deitada no chão inteiro (a casa x, y vai para o losango dela)
    const imgMapa = imagemDoMapa(this.info.mapa);
    if (imgMapa) {
      ctx.save();
      ctx.transform(32, 16, -32, 16, 0, 0);
      ctx.drawImage(imgMapa, 0, 0, map.width, map.height);
      ctx.restore();
    }
    this.drawMarks(ctx, now);
    // celas fechadas: o chão de dentro no escuro (o que fica em pé lá dentro escurece ao ser desenhado)
    const celas = this.celas.quadro(map, now);
    if (celas) escurecerChao(ctx, map, celas);

    const lights: Light[] = [];
    // a névoa: na mesa, o que está escondido não é desenhado, e o chão e as paredes de lá ficam debaixo
    // da fumaça (antes dos móveis: o que está à vista na frente passa por cima dela)
    const nv = this.info.nevoa;
    const esconde = this.escondeNevoa;
    const oculta = (x: number, y: number) => esconde && NevoaMesa.escondida(nv, x, y);
    const mundo = new DOMMatrix([scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr]);
    if (nv && esconde) {
      this.nevoaView.desenharIso(ctx, map, nv, this.staticKey, true, mundo, scale, now);
      ctx.setTransform(mundo);
    }
    const marcas = this.combate;
    // a peça na névoa não aparece na mesa, nem as marcas do combate dela
    const posPeca = (id: number) => {
      const u = this.users.get(id);
      const p = u ? this.userPos(u, now) : null;
      return p && !oculta(p.x + 0.5, p.y + 0.5) ? p : null;
    };
    const alturaCasa = (c: { x: number; y: number }) => map.standHeight(c.x, c.y);
    if (marcas) desenharChao(ctx, marcas, posPeca, alturaCasa, now, lights);
    const hits: Hit[] = [];
    const hintTargets: HintTarget[] = [];
    this.painter.t = t;
    const lm = this.info.lightMode ?? 'normal';
    this.painter.power = lm === 'blackout' ? 0 : lm === 'flicker' ? flickerLevel(t) : 1;
    const sel = this.selection;

    // itens de parede
    const place = this.placement;
    for (const it of map.allWallItems()) {
      const def = getWallFurni(it.defId);
      if (!def) continue;
      if (esconde && (it.wall === 'l' ? oculta(it.plane, it.pos) : oculta(it.pos, it.plane))) continue;
      const moving = place?.kind === 'wall' && place.moveId === it.id;
      const { ox, oy, k, px, py, e } = this.drawWallItem(it, def, t, lights, moving ? 0.35 : 1, sel?.kind === 'wall' && sel.id === it.id ? AMBER : null);
      // na parede de dentro de uma cela fechada (a lâmpada de grade, os riscos): no escuro também
      const eParede = escuroEm(celas, it.wall === 'l' ? it.plane + 0.2 : it.pos, it.wall === 'l' ? it.pos : it.plane + 0.2);
      if (eParede > 0.01)
        escurecerForma(
          ctx,
          [
            [ox - 2, oy - 2],
            [ox + def.w + 2, oy + k * def.w - 2],
            [ox + def.w + 2, oy + k * def.w + def.h + 2],
            [ox - 2, oy + def.h + 2],
          ],
          eParede,
        );
      hits.push({
        kind: 'wall',
        id: it.id,
        test: (x0, y0) => {
          // no quadro maior ou menor, o ponto volta para o tamanho do desenho
          const x = px + (x0 - px) / e;
          const y = py + (y0 - py) / e;
          const lx = x - ox;
          const ly = y - oy - k * lx;
          return lx >= 0 && lx <= def.w && ly >= 0 && ly <= def.h;
        },
      });
      this.centers.set(`wall${it.id}`, [ox + def.w / 2, oy + (k * def.w) / 2 + def.h / 2]);
      if (it.hint && (it.hint.visible || canBuild)) hintTargets.push({ kind: 'wall', id: it.id, hint: it.hint, wx: ox + def.w / 2, wy: oy + (k * def.w) / 2 - 2, sx: 0, sy: 0 });
    }
    if (place?.kind === 'wall' && this.wallTarget && this.mouse.inside) {
      const def = getWallFurni(place.defId);
      if (def) {
        const wt = this.wallTarget;
        this.drawWallItem({ id: 0, wall: wt.wall, plane: wt.plane, pos: wt.pos, z: wt.z, state: 0 }, def, t, lights, 0.75, wt.ok ? 'rgba(120,255,160,0.9)' : 'rgba(255,80,80,0.9)');
      }
    }

    // mobis de chão
    const flats: Drawable[] = [];
    const drawables: Drawable[] = [];
    const hitOf = new Map<Drawable, Hit>();
    const m = this.mapper;
    const painter = this.painter;
    // raio-x: parede interna, árvore ou prédio na frente de uma peça fica transparente (para ninguém sumir atrás)
    const raioX: { box: WBox; rect: [number, number, number, number] }[] = [];
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      if (oculta(p.x + 0.5, p.y + 0.5)) continue;
      // quem está numa cela fechada não deixa a parede transparente (a cela não se entrega)
      if (escuroEm(celas, p.x + 0.5, p.y + 0.5) > 0.5) continue;
      const [mx, my] = iso(p.x + 0.5, p.y + 0.5, p.z);
      const H = this.avatarHeight(u);
      raioX.push({ box: { x0: p.x + 0.2, x1: p.x + 0.8, y0: p.y + 0.2, y1: p.y + 0.8, z0: p.z, z1: p.z + ALTURA_PESSOA }, rect: [mx - 22, my - H - 6, mx + 22, my + 8] });
    }
    // o que cai fora da tela não é desenhado (a fazenda tem centenas de mobis); a luz deles continua valendo
    const vista = { x0: -this.cam.x / z - 120, y0: -this.cam.y / z - 200, x1: (this.vw - this.cam.x) / z + 120, y1: (this.vh - this.cam.y) / z + 120 };
    const addFurni = (it: { id: number; defId: string; x: number; y: number; z: number; rot: number; state: number; escala?: number }, alpha: number, selected: boolean, ghost: boolean) => {
      const def = getFurni(it.defId);
      if (!def) return;
      const base = furniVisual(def, it.state, it.id);
      const vis = visualComArte(def, base, it.state, it.id, it.rot, this.info?.floorStyle, it.escala ?? 1) ?? base;
      m.set(it.rot, def.width, def.depth, it.x, it.y, it.z);
      const floorH = map.floorHeight(it.x, it.y) ?? 0;
      const flat = !!def.flat && it.z <= floorH + 0.05 && !ghost;
      let topZ = it.z + def.height;
      for (const node of vis.nodes) {
        const box = m.box(node.b);
        if (box.z1 > topZ) topZ = box.z1;
        const sil = boxSilhouette(box);
        let sx0 = Infinity;
        let sy0 = Infinity;
        let sx1 = -Infinity;
        let sy1 = -Infinity;
        for (const [px, py] of sil) {
          if (px < sx0) sx0 = px;
          if (px > sx1) sx1 = px;
          if (py < sy0) sy0 = py;
          if (py > sy1) sy1 = py;
        }
        const pad = node.pad ?? 0;
        if (sx1 + pad < vista.x0 || sx0 - pad > vista.x1 || sy1 + pad < vista.y0 || sy0 - pad > vista.y1) continue;
        const rot = it.rot;
        const xray =
          !!def.xray && raioX.some((pc) => sx0 - pad < pc.rect[2] && sx1 + pad > pc.rect[0] && sy0 - pad < pc.rect[3] && sy1 > pc.rect[1] && cmp(pc.box, box) < 0);
        // cela: a parede entre a cela aberta e a câmera fica transparente; o que dá para dentro da fechada, no escuro
        const cela = ghost ? undefined : celas?.mobi.get(it.id);
        const nodeAlpha = (xray ? alpha * 0.28 : alpha) * (cela ? 1 - 0.72 * cela.transp : 1);
        const d: Drawable = {
          box: node.ordem ? m.box(node.ordem) : box,
          sx0: sx0 - 12,
          sx1: sx1 + 12,
          sy0: sy0 - 24,
          sy1: sy1 + 4,
          poly: sil,
          draw: () => {
            painter.m.set(rot, def.width, def.depth, it.x, it.y, it.z);
            painter.state = it.state;
            painter.seed = it.id;
            ctx.globalAlpha = nodeAlpha;
            node.draw(painter);
            if (cela) escurecerForma(ctx, sil, cela.escuro);
            ctx.globalAlpha = 1;
            if (selected) {
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = AMBER;
              ctx.beginPath();
              ctx.moveTo(sil[0][0], sil[0][1]);
              for (let i = 1; i < sil.length; i++) ctx.lineTo(sil[i][0], sil[i][1]);
              ctx.closePath();
              ctx.stroke();
            }
          },
        };
        (flat ? flats : drawables).push(d);
        if (!ghost) hitOf.set(d, { kind: 'floor', id: it.id, test: (x, y) => pointInPoly(x, y, sil) });
        if (def.vazio?.length && !flat) {
          // peça vazada (a cortina do leito, a mesa em U): o que está dentro fica entre as paredes do
          // fundo e as da frente. A peça inteira vai para trás de tudo de dentro (a quina do fundo) e
          // as paredes da frente (as faces x1 e y1, as que a câmera vê) são redesenhadas por cima,
          // recortadas, na quina da frente.
          const fp = footprint(def, rot);
          const B = { x0: it.x, x1: it.x + fp.sx, y0: it.y, y1: it.y + fp.sy, z0: box.z0, z1: box.z1 };
          const e = 0.02;
          d.box = { x0: B.x0 - e, x1: B.x0, y0: B.y0 - e, y1: B.y0, z0: B.z0, z1: B.z1 };
          // as faces de perto (x1 e y1), menos o lado aberto: pela face aberta se vê o fundo da peça,
          // que não pode ser repintado por cima de quem está dentro
          const ladoX1 = rot === 2 ? 'frente' : rot === 6 ? 'fundo' : 'lado';
          const ladoY1 = rot === 4 ? 'frente' : rot === 0 ? 'fundo' : 'lado';
          const aberto = (lado: string) => (def.aberto as string[] | undefined)?.includes(lado) ?? false;
          const faces: [number, number][][] = [];
          if (!aberto(ladoY1)) faces.push([iso(B.x0, B.y1, B.z0), iso(B.x1, B.y1, B.z0), iso(B.x1, B.y1, B.z1), iso(B.x0, B.y1, B.z1)]);
          if (!aberto(ladoX1)) faces.push([iso(B.x1, B.y0, B.z0), iso(B.x1, B.y1, B.z0), iso(B.x1, B.y1, B.z1), iso(B.x1, B.y0, B.z1)]);
          // a parte grossa de perto (o braço da mesa em U: a casa inteira, com o tampo e o que está em
          // cima dele) também fica na frente de quem está dentro. É a casa ocupada da coluna ou da fileira
          // de perto que tem uma casa vazia antes dela, na mesma fileira ou na mesma coluna.
          const vaz = (dx: number, dy: number) => !ocupa(def, rot, dx, dy);
          const zTopo = B.z1 + 0.45 * Z_PER_M;
          for (let dy = 0; dy < fp.sy; dy++)
            for (let dx = 0; dx < fp.sx; dx++) {
              if (vaz(dx, dy) || (dx !== fp.sx - 1 && dy !== fp.sy - 1)) continue;
              let antes = false;
              for (let k = 0; k < dx && !antes; k++) antes = vaz(k, dy);
              for (let k = 0; k < dy && !antes; k++) antes = vaz(dx, k);
              if (antes) faces.push(boxSilhouette({ x0: B.x0 + dx, x1: B.x0 + dx + 1, y0: B.y0 + dy, y1: B.y0 + dy + 1, z0: B.z0, z1: zTopo }));
            }
          // todas no mesmo sentido, para o recorte ser a união delas (no nonzero, sentidos opostos se anulam)
          for (let i = 0; i < faces.length; i++) {
            const f = faces[i];
            let area = 0;
            for (let k = 0; k < f.length; k++) area += f[k][0] * f[(k + 1) % f.length][1] - f[(k + 1) % f.length][0] * f[k][1];
            if (area < 0) faces[i] = [...f].reverse();
          }
          drawables.push({
            box: { x0: B.x1, x1: B.x1 + e, y0: B.y1, y1: B.y1 + e, z0: B.z0, z1: B.z1 },
            sx0: d.sx0,
            sx1: d.sx1,
            sy0: d.sy0,
            sy1: d.sy1,
            poly: sil,
            draw: () => {
              if (!faces.length) return;
              ctx.save();
              ctx.beginPath();
              for (const f of faces) {
                ctx.moveTo(f[0][0], f[0][1]);
                for (let i = 1; i < f.length; i++) ctx.lineTo(f[i][0], f[i][1]);
                ctx.closePath();
              }
              ctx.clip();
              painter.m.set(rot, def.width, def.depth, it.x, it.y, it.z);
              painter.state = it.state;
              painter.seed = it.id;
              ctx.globalAlpha = nodeAlpha;
              node.draw(painter);
              ctx.globalAlpha = 1;
              ctx.restore();
            },
          });
        }
      }
      for (const L of vis.lights) {
        const [lx, ly] = m.p(L.u, L.v, L.z);
        const [wx, wy] = m.xy(L.u, L.v);
        lights.push({ x: lx, y: ly, radius: L.radius, color: L.color, intensity: L.intensity * alpha, flicker: L.flicker, kind: L.kind, seed: it.id, mundo: [wx, wy, m.oz + L.z * Z_PER_M] });
      }
      return topZ;
    };

    for (const real of map.allItems()) {
      if (esconde && this.itemOculto(real)) continue;
      // o que alguém largou no chão: a arte pintada do item (a mesma da mochila), deitada na casa
      if (real.defId === PILHA_CHAO && real.loot?.length) {
        const imgs = real.loot.slice(0, 3).map((l) => imagemDoMapa(`/arte/itens/pintados/${l.item?.id ?? regrasShared.slug(l.name)}.png`)).filter((x): x is HTMLImageElement => !!x);
        if (imgs.length) {
          const z = real.z;
          const box: WBox = { x0: real.x, x1: real.x + 1, y0: real.y, y1: real.y + 1, z0: z, z1: z + 0.2 };
          const [cx, cy] = iso(real.x + 0.5, real.y + 0.5, z);
          // como o drop de um jogo (07/10): o ícone pintado de pé e um pouco inclinado, com sombra, brilho quente
          // no chão e balanço leve (render/itemNoChao.ts). Deitá-lo na perspectiva do piso (2:1) o esmagava.
          const pos = imgs.map((img, i) => ({ img, ox: [0, -0.24, 0.22][i], oy: [0, 0.2, -0.2][i], semente: hash(real.id, i) }));
          drawables.push({
            box,
            sx0: cx - 56,
            sx1: cx + 56,
            sy0: cy - 72,
            sy1: cy + 20,
            draw: () => {
              // os do fundo primeiro: o de trás não tapa o da frente
              for (const { img, ox, oy, semente } of [...pos].sort((a, b) => a.ox + a.oy - (b.ox + b.oy))) {
                const [px, py] = iso(real.x + 0.5 + ox, real.y + 0.5 + oy, z);
                desenharItemNoChao(ctx, img, px, py, imgs.length > 1 ? 58 : 72, semente);
              }
            },
          });
          continue;
        }
      }
      const it = this.slides.size ? this.slidPos(real, now) : real;
      const moving = place?.kind === 'floor' && place.moveId === it.id;
      const topZ = addFurni(it, moving ? 0.35 : 1, sel?.kind === 'floor' && sel.id === it.id, false);
      const fdef = getFurni(it.defId);
      if (fdef) {
        const fp = footprint(fdef, it.rot);
        this.centers.set(`floor${it.id}`, iso(it.x + fp.sx / 2, it.y + fp.sy / 2, it.z + fdef.height * 0.4));
      }
      if (it.hint && (it.hint.visible || canBuild) && topZ !== undefined) {
        const def = getFurni(it.defId)!;
        const fp = footprint(def, it.rot);
        const [hx, hy] = iso(it.x + fp.sx / 2, it.y + fp.sy / 2, topZ);
        hintTargets.push({ kind: 'floor', id: it.id, hint: it.hint, wx: hx, wy: hy - 6, sx: 0, sy: 0 });
      }
    }

    // fantasma de colocação
    let footprintTiles: { x: number; y: number }[] = [];
    let footprintOk = false;
    if (place?.kind === 'floor' && this.hoverTile && this.mouse.inside) {
      const def = getFurni(place.defId);
      if (def) {
        const ht = this.hoverTile;
        const res = map.canPlace(def.id, ht.x, ht.y, place.rot, place.moveId);
        footprintOk = res.ok;
        footprintTiles = map.tilesFor(def.id, ht.x, ht.y, place.rot);
        const zz = res.ok ? res.z : map.floorHeight(ht.x, ht.y) ?? 0;
        addFurni({ id: 0, defId: def.id, x: ht.x, y: ht.y, z: zz, rot: place.rot, state: 0 }, res.ok ? 0.8 : 0.45, false, true);
      }
    }

    // luzes do cenário que alcançam as peças (as das peças e a do cursor, não), conforme o clima:
    // a cor delas tinge o corpo e cada uma projeta a sombra da peça no chão
    const energia = lm === 'flicker' ? flickerLevel(t) : 1;
    // a luz de dentro de uma cela fechada não sai dela (apaga junto)
    if (celas)
      for (const L of lights) {
        const e = L.mundo ? escuroEm(celas, L.mundo[0], L.mundo[1]) : 0;
        if (e > 0) L.intensity *= 1 - e;
      }
    const luzesCena: { L: Light; i: number }[] = [];
    for (const L of lights) {
      if (!L.mundo) continue;
      const kind = L.kind ?? 'electric';
      if (lm === 'blackout' && kind === 'electric') continue;
      const i = lm === 'flicker' && kind === 'electric' ? L.intensity * energia : L.intensity;
      if (i > 0.02) luzesCena.push({ L, i });
    }
    // o que fica no chão embaixo das peças (sombras e anel) vai antes de tudo que fica em pé: o que está na frente tapa
    const chaoPecas: (() => void)[] = [];

    // avatares
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      if (oculta(p.x + 0.5, p.y + 0.5)) continue;
      const cx = p.x + 0.5;
      const cy = p.y + 0.5;
      const sp = u.look.charId ? sprites.get(u.look.charId) : null;
      // pose do tabuleiro (arte em 32 bits) no estado da peça; sem ela, a folha
      const cdef = sprites.def(u.look.charId);
      const lp = cdef ? sprites.poses(cdef) : null;
      const estado = this.estadoDe?.(u.id) ?? 'desarmado';
      const pf = lp ? poseFor(lp, estado, u.dir) : null;
      // o relógio do passo: começa quando a peça sai andando e segue de casa em casa até parar
      if (p.moving) u.andandoDesde ??= now;
      else delete u.andandoDesde;
      // o quanto a peça já andou, em casas (√2 no passo na diagonal): o ciclo do boneco segue o chão, e não o
      // relógio, então o pé que apoia fica parado no chão; no meio de cada casa ele está na passagem
      if (p.moving && u.anim) {
        if (u.passoDesde !== u.anim.start) {
          if (u.passoDesde !== undefined) u.casas = (u.casas ?? 0) + (u.passoLen ?? 1);
          u.passoDesde = u.anim.start;
          u.passoLen = Math.min(1.5, Math.hypot(u.anim.tx - u.anim.fx, u.anim.ty - u.anim.fy)) || 1;
        }
      } else {
        delete u.casas;
        delete u.passoDesde;
        delete u.passoLen;
      }
      const casas = p.moving && u.anim ? (u.casas ?? 0) + (u.passoLen ?? 1) * Math.min(1, Math.max(0, (now - u.anim.start) / TICK_MS)) : 0;
      let bq: SpriteFrame | null = null;
      let bpes: PeQuadro[] | null = null;
      // o boneco filmado em 3D (andar completo, parado respirando, sentado, dançando): vale no lugar de tudo
      const bc = cdef ? sprites.boneco(cdef) : null;
      const bdir = bc ? bonecoDir(bc, estado, u.dir) : null;
      const sentadoReal = !!bdir && (u.sit === 1 || u.sit === 2) && !!bdir.sentado;
      if (bdir) {
        let nome = 'parado';
        let i = 0;
        if (p.moving && bdir.andar) {
          nome = 'andar';
          const c = bdir.andar.clipe;
          // a pessoa menor dá passos menores: mais ciclos por casa
          const ciclo = casas / ((c.casasPorCiclo ?? 1.91) * ESCALA_ARTE_PESSOA) + (c.fase ?? 0);
          i = Math.floor((((ciclo % 1) + 1) % 1) * c.quadros) % c.quadros;
        } else {
          nome = sentadoReal ? 'sentado' : u.dance && bdir.dancar ? 'dancar' : 'parado';
          const c = bdir[nome].clipe;
          // cada peça no seu tempo (os agentes não respiram juntos)
          i = Math.floor(now / (c.ms ?? 125) + u.phase * c.quadros) % c.quadros;
        }
        bq = bdir[nome].quadros[i];
        bpes = bdir[nome].clipe.pes[i] ?? null;
      }
      // o boneco animado de antes (montado da pose parada): respira, pisca e anda
      const la = !bdir && cdef ? sprites.anim(cdef) : null;
      const bd = la ? bonecoFor(la, estado, u.dir) : null;
      if (la && bd) {
        const fechado = bd.info.olhos && piscando(u, now);
        if (p.moving) {
          const n = bd.andar.length;
          const i = Math.floor((((casas + (bd.info.faseAndar ?? la.anim.faseAndar)) % 1) + 1) % 1 * n) % n;
          bq = (fechado && bd.andarFechado ? bd.andarFechado : bd.andar)[i];
          bpes = bd.info.pesAndar[i] ?? null;
        } else {
          const n = bd.parado.length;
          const i = Math.floor(now / la.anim.msParado + u.phase * n) % n;
          bq = (fechado && bd.paradoFechado ? bd.paradoFechado : bd.parado)[i];
          bpes = bd.info.pesParado[i] ?? null;
        }
      }
      const passos = lp && p.moving ? passosFor(lp, estado, u.dir) : null;
      // folha sem pose de sentar: fica de pé no chão, junto do assento (não em cima dele)
      const standBy = !!sp && u.sit === 1 && !p.moving && !framesFor(sp.lc, u.dir, 'sit');
      const seated = u.sit === 1 && !standBy;
      const baseZ = standBy ? (map.floorHeight(u.x, u.y) ?? p.z) : p.z;
      const half = seated ? 0.25 : 0.3;
      const [sx, sy] = iso(cx, cy, baseZ);
      // H: a altura na arte; HE: na tela (a arte vem na escala antiga e o tabuleiro reduz)
      const H = bq ? bq.ay : sp ? sp.def.height : pf ? pf.h : PIXEL_AVATAR_HEIGHT;
      const HE = H * ESCALA_ARTE_PESSOA;
      const isSel = sel?.kind === 'user' && sel.id === u.id;
      const pose: Pose = p.moving ? 'walk' : seated || u.sit === 2 ? 'sit' : 'stand';
      const wave = u.waveUntil > now;
      // ~1,75 m de altura para a ordem de desenho
      const box: WBox = { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half, z0: baseZ, z1: baseZ + ALTURA_PESSOA };
      const deitada = !!marcas?.deitadas.has(u.id);
      const fy = u.sit === 2 ? sy - 8 : sy;
      const door = this.door;
      const clip = !!door && (door.seg.wall === 'l' ? cx < door.seg.plane : cy < door.seg.plane);
      const sPose = pose === 'sit' ? 'sit' : pose;
      const andando = now - (u.andandoDesde ?? now);
      // o quadro que vai à tela agora (andando, o do passo): a sombra projetada é a silhueta dele
      const quadro: SpriteFrame | null = bq
        ? bq
        : pf
        ? quadroDaPose(pf, now, sPose, passos, andando).q
        : sp
          ? (quadroDaFolha(sp.def, sp.lc, u.dir, now, u.phase, sPose)?.q ?? null)
          : null;
      // a peça pisa no meio da casa: o centro da pegada das botas fica no centro dela, e não a ponta
      // da bota (sem isso, a sombra e o anel aparecem na frente dos pés e ela parece flutuar)
      // (o boneco e a pose com a âncora no meio dos pés já vêm assim)
      const afunda = !bq && (pf || sp) && !quadro?.noMeioDosPes && !deitada && !seated && u.sit !== 2 ? Math.round(H * 0.05) : 0;
      const { luz, sombras } = luzesDaPeca(luzesCena, sx, sy - HE * 0.5, cx, cy);
      if (!seated)
        chaoPecas.push(() => {
          if (clip) {
            ctx.save();
            ctx.clip(door!.path, 'evenodd');
          }
          {
            // a sombra e o anel na escala da pessoa, a partir dos pés
            ctx.save();
            ctx.translate(sx, sy);
            ctx.scale(ESCALA_ARTE_PESSOA, ESCALA_ARTE_PESSOA);
            ctx.translate(-sx, -sy);
            // a sombra cobre os dois pés: com o boneco, da largura entre eles
            const abre = bpes ? Math.max(...bpes.map((pe) => Math.abs(pe[0]))) + 8 : 0;
            const pes = bpes ? Math.max(15, Math.min(26, abre)) : pf?.pes ? Math.max(15, Math.min(26, pf.pes + 4)) : 19;
            const rx = deitada ? 30 : pes;
            const ry = deitada ? 10 : Math.max(6, Math.round(pes * 0.42));
            // a pose com a âncora no meio dos pés: o anel passa embaixo dos dois, um pé em cada ponta
            const doisPes = !bpes && !deitada && quadro?.noMeioDosPes && quadro.pesPontos?.length === 2 ? quadro.pesPontos : null;
            const [arx, ary] = doisPes ? anelPelosPes(doisPes) : [rx + 3, ry + 2];
            // em volta: o chão escurece um pouco, sumindo para fora (o corpo tapa a luz); na pose com os dois pés
            // achados, no meio deles e cobrindo os dois
            const pp = !bpes && !deitada ? quadro?.pesPontos : undefined;
            const ax0 = pp?.length ? sx + pp.reduce((s, p) => s + p[0], 0) / pp.length : sx;
            const ay0 = pp?.length ? sy + afunda + pp.reduce((s, p) => s + p[1], 0) / pp.length : sy;
            const rxa = pp && pp.length > 1 ? Math.max(rx, Math.abs(pp[0][0] - pp[1][0]) / 2 + 12) : rx;
            const amb = ctx.createRadialGradient(ax0, ay0, 0, ax0, ay0, rxa * 1.35);
            amb.addColorStop(0, 'rgba(0,0,0,0.42)');
            amb.addColorStop(0.6, 'rgba(0,0,0,0.2)');
            amb.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.translate(ax0, ay0);
            ctx.scale(1, ry / rx);
            ctx.translate(-ax0, -ay0);
            ctx.fillStyle = amb;
            ctx.beginPath();
            ctx.arc(ax0, ay0, rxa * 1.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // a sombra que cada luz por perto joga no chão, do lado oposto a ela: mais longa quanto mais longe a luz
            if (quadro && !deitada && u.sit !== 2)
              for (const s of sombras) {
                const v = vetoresDaSombra(s.D, Math.max(0.4, Math.min(0.85, 0.3 + 0.25 * s.dist)));
                drawSombraProjetada(ctx, quadro, sx, sy + afunda, v.lado, v.comp, Math.min(0.45, s.a * 2));
              }
            // embaixo das botas: a sombra de contato, escura e de borda firme, como no pixel art; com o boneco,
            // uma embaixo de cada pé, menor e mais clara quando o pé está no ar
            if (!deitada && bpes && u.sit !== 2)
              for (const [dx, dy, alt] of bpes) {
                const k = Math.max(0.45, 1 - alt / 9);
                desenharSombraPes(ctx, sx + Math.round(dx), sy + Math.round(dy), Math.round(8 * k), Math.max(2, Math.round(3.5 * k)));
              }
            else if (!deitada && quadro?.pesPontos?.length && u.sit !== 2) {
              // a pose (pixel art ou arte grande): uma sombra embaixo de cada pé que a imagem mostra, inclusive o
              // de trás (mais alto na tela), que sem ela parecia flutuar
              // um pouco maior que a sola: a bota tapa a metade de cima e o resto aparece em volta dela (a pose é
              // desenhada `afunda` mais para baixo, e a sombra vai junto)
              for (const [dx, dy] of quadro.pesPontos)
                if (quadro.pixel) desenharSombraPes(ctx, sx + Math.round(dx), sy + afunda + Math.round(dy), 10, 4);
                else {
                  // a larga, que some para fora, e o miolo bem rente à sola, onde ela encosta no chão
                  desenharSombraSuave(ctx, sx + dx, sy + afunda + dy + 0.5, 15, 6);
                  desenharSombraSuave(ctx, sx + dx, sy + afunda + dy + 0.3, 8, 2.6);
                }
            } else if (!deitada) desenharSombraPes(ctx, sx, sy, Math.round(rx * 0.86), Math.round(ry * 0.86));
            // anel na cor do personagem (no combate, na cor do lado): fino, em volta da sombra; a peça ativa pulsa
            const active = u.id === this.myId;
            const pulse = active ? 1 + Math.sin(now / 260) * 0.06 : 1;
            const corBase = marcas?.bases.get(u.id) ?? u.color;
            // no combate, a base pintada do kit (agente ou inimigo); fora dele, o anel na cor do personagem
            const baseKit = marcas?.bases.has(u.id) ? baseDoKit(corBase) : null;
            if (baseKit) {
              // a elipse da arte é mais achatada (uns 3,5:1) que o chão (2:1): a altura vai a 0,85 da largura
              const bw = arx * 2 * 1.45 * pulse;
              const bh = bw * 0.85;
              ctx.drawImage(baseKit, sx - bw / 2, sy - bh / 2, bw, bh);
            } else {
              ctx.lineWidth = active ? 1.8 : 1.2;
              ctx.strokeStyle = rgba(corBase, active ? 0.78 : 0.5);
              ctx.beginPath();
              ctx.ellipse(sx, sy, arx * pulse, ary * pulse, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            // de cócoras: duas setas para baixo embaixo do anel
            if (u.agachado) {
              ctx.strokeStyle = rgba(corBase, 0.95);
              ctx.lineWidth = 1.6;
              ctx.lineCap = 'round';
              for (const dy of [ary + 4, ary + 8]) {
                ctx.beginPath();
                ctx.moveTo(sx - 5, sy + dy);
                ctx.lineTo(sx, sy + dy + 3.5);
                ctx.lineTo(sx + 5, sy + dy);
                ctx.stroke();
              }
            }
            if (isSel || active) {
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(255,255,255,0.38)';
              ctx.beginPath();
              ctx.ellipse(sx, sy, (arx + 3) * pulse, (ary + 1.5) * pulse, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          }
          if (clip) ctx.restore();
        });
      const d: Drawable = {
        box,
        sx0: sx - 40,
        sx1: sx + 40,
        sy0: sy - HE - 30,
        sy1: sy + 16,
        draw: () => {
          if (clip) {
            ctx.save();
            ctx.clip(door!.path, 'evenodd');
          }
          // numa cela fechada, a peça fica no escuro com ela
          const eCela = escuroEm(celas, cx, cy);
          if (eCela > 0.01) ctx.filter = `brightness(${(1 - 0.78 * eCela).toFixed(3)})`;
          // a pessoa na escala do tabuleiro, a partir dos pés (de cócoras, mais baixa)
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(ESCALA_ARTE_PESSOA, ESCALA_ARTE_PESSOA * (u.agachado ? 0.72 : 1));
          ctx.translate(-sx, -sy);
          const dance = u.dance ? -Math.abs(Math.sin((now * Math.PI) / 320 + u.phase)) * 4 : 0;
          // giro: afina de lado e volta, com um pulinho, a partir dos pés
          const tt = u.turnAt ? (now - u.turnAt) / TURN_MS : 1;
          const turning = tt < 1;
          if (turning) {
            const k = 0.35 + 0.65 * (1 - Math.pow(1 - tt, 3));
            ctx.save();
            ctx.translate(sx, fy - Math.sin(tt * Math.PI) * 2);
            ctx.scale(k, 1 + (1 - k) * 0.08);
            ctx.translate(-sx, -fy);
          }
          // caída ou inconsciente: a peça deita no chão, com a cabeça para a esquerda
          if (deitada) {
            ctx.save();
            ctx.translate(sx + H * 0.42, fy - 4);
            ctx.rotate(-Math.PI / 2 + 0.12);
            ctx.scale(0.92, 1);
            ctx.translate(-sx, -fy);
          }
          if (bq) drawBoneco(ctx, bq, sx, fy + dance, sPose === 'sit' && !sentadoReal, 1, luz);
          else if (pf) drawPose(ctx, pf, sx, fy + afunda + dance, now, sPose, 1, passos, andando, luz);
          else if (sp) drawSprite(ctx, sp.def, sp.lc, u.dir, sx, fy + afunda + dance, now, u.phase, sPose, 1, luz);
          else
            drawPixelAvatar(ctx, u.look, sx, fy, u.dir, u.headDir, {
              pose,
              frame: pose === 'walk' ? Math.floor(now / 125) % 4 : u.dance || wave ? Math.floor(now / 220) % 2 : 0,
              wave,
              dance: u.dance,
              blink: (now + u.phase * 997) % 4300 < 140,
            });
          if (deitada) ctx.restore();
          if (turning) ctx.restore();
          if (wave && sp) this.drawEmote(sx, fy - H - 14, now);
          ctx.restore();
          if (eCela > 0.01) ctx.filter = 'none';
          if (clip) ctx.restore();
        },
      };
      drawables.push(d);
      hitOf.set(d, {
        kind: 'user',
        id: u.id,
        test: (x, y) => x >= sx - 16 && x <= sx + 16 && y >= sy - HE && y <= sy + 10,
      });
      // a luz da peça desce até as pernas: ilumina o chão em volta junto com o corpo (sem parecer colado por cima)
      lights.push({ x: sx, y: sy - HE * 0.22, radius: 88, color: '#ffe2b8', intensity: u.id === this.myId ? 0.42 : 0.3, kind: 'personal' });
    }

    // cursor do piso
    const ht = this.hoverTile;
    if (ht && this.mouse.inside && !place && !this.ferramenta && !map.isDoor(ht.x, ht.y)) {
      const h = map.walkState(ht.x, ht.y) === 'blocked' ? map.floorHeight(ht.x, ht.y) ?? 0 : map.standHeight(ht.x, ht.y);
      const box: WBox = { x0: ht.x, x1: ht.x + 1, y0: ht.y, y1: ht.y + 1, z0: h, z1: h };
      const pts = [iso(ht.x, ht.y, h), iso(ht.x + 1, ht.y, h), iso(ht.x + 1, ht.y + 1, h), iso(ht.x, ht.y + 1, h)];
      drawables.push({
        box,
        sx0: pts[3][0],
        sx1: pts[1][0],
        sy0: pts[0][1],
        sy1: pts[2][1],
        poly: pts,
        draw: () => {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,240,220,0.08)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,244,230,0.75)';
          ctx.stroke();
        },
      });
      const [lx, ly] = iso(ht.x + 0.5, ht.y + 0.5, h);
      lights.push({ x: lx, y: ly, radius: 46, color: '#fff0dc', intensity: 0.28, kind: 'personal' });
    }

    // desenha decalques, marca de colocação e o resto ordenado
    const orderFlats = flats.sort((a, b) => a.box.z0 - b.box.z0 || a.depth! - b.depth!);
    for (const d of orderFlats) {
      d.draw();
      const h = hitOf.get(d);
      if (h) hits.push(h);
    }
    if (footprintTiles.length) {
      for (const tt of footprintTiles) {
        const fh = map.floorHeight(tt.x, tt.y);
        if (fh === null) continue;
        const pts = [iso(tt.x, tt.y, fh), iso(tt.x + 1, tt.y, fh), iso(tt.x + 1, tt.y + 1, fh), iso(tt.x, tt.y + 1, fh)];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = footprintOk ? 'rgba(90,230,140,0.22)' : 'rgba(255,70,70,0.28)';
        ctx.fill();
        ctx.strokeStyle = footprintOk ? 'rgba(120,255,160,0.8)' : 'rgba(255,90,90,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // embaixo das peças: as sombras e o anel, por cima do chão e por baixo de tudo que fica em pé
    for (const f of chaoPecas) f();
    for (const d of sortDrawables(drawables)) {
      d.draw();
      const h = hitOf.get(d);
      if (h) hits.push(h);
    }
    this.hits = hits;
    if (viagem) {
      this.mundoViagem.frente(ctx);
      // o que passa de perto é do mundo: não balança com a van
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      this.mundoViagem.proximo(ctx, viagem);
      ctx.restore();
    }
    // a casa do mouse atrás de um móvel: o contorno tracejado por cima, para ver onde a peça vai parar
    if (this.cursorPorCima && ht && this.mouse.inside && !place) {
      const h = map.standHeight(ht.x, ht.y);
      const pts = [iso(ht.x, ht.y, h), iso(ht.x + 1, ht.y, h), iso(ht.x + 1, ht.y + 1, h), iso(ht.x, ht.y + 1, h)];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,244,230,0.85)';
      ctx.stroke();
      ctx.restore();
    }

    // névoa (antes da luz: brilha perto das fontes)
    this.fog.draw(ctx, this.info.fog ?? 0, now);

    // luz, conforme o clima do mestre
    const mode = this.info.lightMode ?? 'normal';
    const surge = mode === 'flicker' ? flickerLevel(t) : 1;
    let darkness = this.info.darkness;
    if (mode === 'blackout') darkness = Math.max(darkness, 0.9);
    if (mode === 'flicker') darkness = Math.min(0.95, darkness + (1 - surge) * 0.3);
    const active: Light[] = [];
    for (const L of lights) {
      const kind = L.kind ?? 'electric';
      if (mode === 'blackout') {
        if (kind === 'electric') continue;
        if (kind === 'personal') active.push({ ...L, intensity: L.intensity * 0.55, radius: L.radius * 0.7 });
        else if (kind === 'emergency') active.push({ ...L, intensity: Math.min(1, L.intensity * 1.2) });
        else active.push(L);
      } else if (mode === 'flicker' && kind === 'electric') {
        if (surge > 0.05) active.push({ ...L, intensity: L.intensity * surge });
      } else active.push(L);
    }
    if (darkness > 0.01)
      this.lighting.render(ctx, active, darkness, (x, y) => [(x * z + this.cam.x) * dpr, (y * z + this.cam.y) * dpr], scale, t, this.info.ambient);

    // partículas (poeira na luz, fumaça e brasas das velas)
    if (this.particles.active) {
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      this.particles.draw(ctx, now, active, this.info.particleLevel ?? DEFAULT_PARTICLE_LEVEL);
    }

    // a névoa para o mestre: o que a mesa não vê fica riscado, por cima de tudo
    if (nv && !esconde) this.nevoaView.desenharIso(ctx, map, nv, this.staticKey, false, mundo, scale, now);

    // combate: anel de alcance, linha até o alvo, mira, medida (depois da luz: sempre à vista)
    if (marcas) {
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      desenharCima(ctx, marcas, posPeca, alturaCasa, this.casaDoMouse, now);
    }

    // as ferramentas do mestre: o pincel da névoa embaixo do mouse, o ponto de atenção e os desenhos
    ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
    if (this.ferramenta?.tipo === 'nevoa' && this.mouse.inside) this.desenharPincel(ctx, (x, y, h) => iso(x, y, h), 1 / z);
    const chaoEm = (x: number, y: number) => map.floorHeight(Math.floor(x), Math.floor(y)) ?? 0;
    this.marcasMesa.desenhar(ctx, { proj: (x, y) => iso(x, y, chaoEm(x, y)), px: 1 / z, dpr, alto: 120 }, now);

    this.vinheta(ctx);

    // anel de destaque do objeto recém-selecionado
    this.drawPulses(ctx, now);

    // combate: etiquetas, escudo da cobertura e caveiras
    if (marcas)
      desenharRotulos(
        ctx,
        marcas,
        posPeca,
        alturaCasa,
        this.casaDoMouse,
        (wx, wy) => [wx * z + this.cam.x, wy * z + this.cam.y],
        (id) => {
          const u = this.users.get(id);
          if (!u) return null;
          const p = this.userPos(u, now);
          if (oculta(p.x + 0.5, p.y + 0.5)) return null;
          const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
          return marcas.deitadas.has(id) ? [wx, wy - 14] : [wx, wy - this.avatarHeight(u)];
        },
      );

    // ícones de pista (a tela da mesa não mostra)
    if (this.watchOnly) hintTargets.length = 0;
    for (const h of hintTargets) {
      h.sx = Math.round(h.wx * z + this.cam.x);
      h.sy = Math.round(h.wy * z + this.cam.y + Math.sin(t / 450 + h.id) * 2);
      drawHintIcon(ctx, h.sx, h.sy, h.hint.icon, !h.hint.visible, this.hoverKey === `h${h.kind}${h.id}`);
    }
    this.hintTargets = hintTargets;

    // nome ao passar o mouse
    const hk = this.hoverKey;
    for (const u of this.users.values()) {
      if (hk !== `user${u.id}` && !(sel?.kind === 'user' && sel.id === u.id)) continue;
      const p = this.userPos(u, now);
      const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
      const H = this.avatarHeight(u);
      this.nameTag(u.name, wx * z + this.cam.x, (wy - H - (u.sit ? -12 : 4)) * z + this.cam.y, u.id === this.myId);
    }

    this.bubbles.draw(ctx, (wx) => wx * z + this.cam.x, this.vw);
    if (viagem?.destino) this.faixaDoDestino(viagem.destino);
  }

  /** O que o mestre escreveu como destino da viagem, numa faixa no alto do tabuleiro (a mesa também lê). */
  private faixaDoDestino(texto: string) {
    const ctx = this.ctx;
    const fr = this.frame_();
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = `700 17px ${UI_FONT}`;
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(texto).width + 40;
    const x = Math.round(fr.x + fr.w / 2 - w / 2);
    const y = Math.round(fr.y + 22);
    ctx.fillStyle = 'rgba(5,11,20,0.82)';
    ctx.fillRect(x, y, w, 32);
    ctx.strokeStyle = 'rgba(233,169,68,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, 30.5);
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(texto, x + 20, y + 16.5);
    ctx.restore();
  }

  /** O móvel some na mesa quando todas as casas dele estão na névoa. */
  private itemOculto(it: FloorItem): boolean {
    const nv = this.info?.nevoa;
    const def = getFurni(it.defId);
    if (!nv || !def) return false;
    const fp = footprint(def, it.rot);
    for (let y = it.y; y < it.y + fp.sy; y++) for (let x = it.x; x < it.x + fp.sx; x++) if (!NevoaMesa.escondida(nv, x, y)) return false;
    return true;
  }

  /** O pincel da névoa: as casas que ele pinta, verdes (mostrar) ou vermelhas (esconder). */
  private desenharPincel(ctx: CanvasRenderingContext2D, proj: (x: number, y: number, h: number) => [number, number], px: number) {
    const f = this.ferramenta;
    const map = this.map;
    if (f?.tipo !== 'nevoa' || !map) return;
    const casas = this.casasDoPincel(f.raio);
    if (!casas.length) return;
    ctx.save();
    ctx.beginPath();
    for (const c of casas) {
      const h = map.floorHeight(c.x, c.y) ?? 0;
      const q = [proj(c.x, c.y, h), proj(c.x + 1, c.y, h), proj(c.x + 1, c.y + 1, h), proj(c.x, c.y + 1, h)];
      ctx.moveTo(q[0][0], q[0][1]);
      for (const p of q.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    }
    ctx.fillStyle = f.vista ? 'rgba(120, 230, 160, 0.16)' : 'rgba(240, 90, 80, 0.18)';
    ctx.fill();
    ctx.lineWidth = 1.2 * px;
    ctx.strokeStyle = f.vista ? 'rgba(140, 255, 180, 0.7)' : 'rgba(255, 110, 100, 0.75)';
    ctx.stroke();
    ctx.restore();
  }

  /** A vinheta: as bordas do quadro escurecem. */
  private vinheta(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const fr = this.frame_();
    const vcx = fr.x + fr.w / 2;
    const vcy = fr.y + fr.h / 2;
    const vg = ctx.createRadialGradient(vcx, vcy, Math.min(fr.w, fr.h) * 0.38, vcx, vcy, Math.max(fr.w, fr.h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);
  }

  private nameTag(name: string, x: number, y: number, me: boolean) {
    const ctx = this.ctx;
    ctx.font = `700 12px ${UI_FONT}`;
    const w = ctx.measureText(name).width + 14;
    const bx = Math.round(x - w / 2);
    const by = Math.round(y - 22);
    ctx.fillStyle = 'rgba(12,9,12,0.85)';
    ctx.fillRect(bx, by, w, 18);
    ctx.strokeStyle = me ? 'rgba(255,196,90,0.8)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, 17);
    ctx.fillStyle = me ? '#ffd27a' : '#efe6d6';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, bx + 7, by + 9.5);
  }

  /** Balãozinho de aceno (para sprites sem animação de braço). */
  private drawEmote(x: number, y: number, now: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y + Math.sin(now / 120) * 1.5);
    ctx.fillStyle = '#ece6dc';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.sin(now / 110) * 0.35);
    drawHintGlyph(ctx, 'interact', '#1a1418');
    ctx.restore();
  }

  /** Peça que o controlador está comandando. */
  setActive(id: number) {
    this.myId = id;
    this.select(id ? { kind: 'user', id } : null);
  }

  /** Centraliza a câmera numa peça (deslizando). */
  focusUser(id: number, smooth = true) {
    const u = this.users.get(id);
    if (!u) return;
    const p = this.userPos(u, performance.now());
    const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
    this.panTo(wx, wy - 40, smooth);
  }

  /** Centraliza a câmera num objeto (deslizando). */
  focusItem(kind: 'floor' | 'wall', id: number) {
    const c = this.centers.get(kind + id);
    if (c) this.panTo(c[0], c[1]);
  }

  /** Leva a câmera até um ponto do mundo. */
  panTo(wx: number, wy: number, smooth = true) {
    const f = this.frame_();
    const tx = Math.round(f.x + f.w / 2 - wx * this.zoom);
    const ty = Math.round(f.y + f.h / 2 - wy * this.zoom);
    this.autoFit = false;
    if (!smooth) {
      this.camAnim = null;
      this.cam.x = tx;
      this.cam.y = ty;
      this.bubbles.clear();
      return;
    }
    const dist = Math.hypot(tx - this.cam.x, ty - this.cam.y);
    this.camAnim = { fx: this.cam.x, fy: this.cam.y, tx, ty, t0: performance.now(), dur: Math.min(700, 260 + dist * 0.6) };
  }

  /** Destino no chão: anel na cor da peça que abre e some, com um X de giz. */
  private drawMarks(ctx: CanvasRenderingContext2D, now: number) {
    if (!this.marks.length) return;
    const DUR = 1000;
    this.marks = this.marks.filter((m) => now - m.t0 < DUR);
    for (const m of this.marks) {
      const t = (now - m.t0) / DUR;
      const [x, y] = iso(m.x + 0.5, m.y + 0.5, m.z);
      const e = 1 - Math.pow(1 - t, 3);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2.4 * (1 - t) + 0.6;
      ctx.beginPath();
      ctx.ellipse(x, y, 10 + e * 22, 5 + e * 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + e * 12, 3 + e * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      // X de giz no ponto
      const sz = 5 * Math.min(1, t * 6);
      ctx.globalAlpha = Math.min(1, (1 - t) * 1.6);
      ctx.strokeStyle = 'rgba(240,232,218,0.9)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - sz, y - sz / 2);
      ctx.lineTo(x + sz, y + sz / 2);
      ctx.moveTo(x + sz, y - sz / 2);
      ctx.lineTo(x - sz, y + sz / 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Objeto recém-selecionado: dois anéis âmbar abrindo a partir do centro. */
  private drawPulses(ctx: CanvasRenderingContext2D, now: number) {
    if (!this.pulses.length) return;
    const DUR = 700;
    this.pulses = this.pulses.filter((p) => now - p.t0 < DUR + 200);
    const z = this.zoom;
    const dpr = this.dpr;
    for (const p of this.pulses) {
      const c = this.centers.get(p.key);
      if (!c) continue;
      for (const lag of [0, 180]) {
        const t = (now - p.t0 - lag) / DUR;
        if (t < 0 || t > 1) continue;
        const e = 1 - Math.pow(1 - t, 2);
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = 'rgba(255,200,110,1)';
        ctx.shadowColor = 'rgba(255,180,80,0.9)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(c[0] * z + this.cam.x, c[1] * z + this.cam.y, (14 + e * 46) * z, (7 + e * 23) * z, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** Miniatura da cena atual (para a lista de cenários). */
  snapshot(w = 120, h = 72, bright = 1.7): string | null {
    if (!this.map || !this.vw) return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    // recorta só a área do quarto (em pixels do canvas) e clareia
    const b = roomBounds(this.map, !!this.info?.aberto);
    const k = this.dpr;
    let x0 = Math.max(0, (b.minX * this.zoom + this.cam.x) * k);
    let y0 = Math.max(0, (b.minY * this.zoom + this.cam.y) * k);
    const x1 = Math.min(this.canvas.width, (b.maxX * this.zoom + this.cam.x) * k);
    const y1 = Math.min(this.canvas.height, (b.maxY * this.zoom + this.cam.y) * k);
    let sw = x1 - x0;
    let sh = y1 - y0;
    if (sw < 20 || sh < 20) {
      x0 = 0;
      y0 = 0;
      sw = this.canvas.width;
      sh = this.canvas.height;
    }
    const s = Math.max(w / sw, h / sh);
    ctx.filter = `brightness(${bright}) contrast(1.05)`;
    ctx.drawImage(this.canvas, x0, y0, sw, sh, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
    try {
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return null;
    }
  }

  /** Foto do objeto no cenário (recorte do quadro atual), para a polaroid. */
  photo(kind: 'floor' | 'wall', id: number, w = 160, h = 150): string | null {
    const c = this.centers.get(kind + id);
    if (!c || !this.vw) return null;
    const k = this.dpr;
    const sx = (c[0] * this.zoom + this.cam.x) * k;
    const sy = (c[1] * this.zoom + this.cam.y) * k;
    const rw = Math.min(this.canvas.width, 230 * this.zoom * k);
    const rh = (rw * h) / w;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#0b0a0c';
    ctx.fillRect(0, 0, w, h);
    ctx.filter = 'brightness(1.25) contrast(1.05) saturate(0.95)';
    ctx.drawImage(this.canvas, sx - rw / 2, sy - rh * 0.55, rw, rh, 0, 0, w, h);
    try {
      return out.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  }

  /** Desenha uma cena fora da tela e devolve a miniatura (lista de cenários). */
  static still(info: RoomInfo, items: FloorItem[], wallItems: WallItem[], w: number, h: number): string | null {
    const noop = () => {};
    const v = new RoomView(document.createElement('canvas'), { walk: noop, lookAt: noop, placeFloor: noop, placeWall: noop, use: noop, select: noop, openHint: noop }, false);
    v.fixed = { w: 640, h: 440 };
    v.enter({ ...info, canBuild: false, fog: 0 }, items, wallItems, [], 0);
    v.resize();
    v.fit();
    try {
      v.frame();
    } catch {
      return null;
    }
    return v.snapshot(w, h, 1.35);
  }

  /** Posição de tela do avatar (para interface). */
  userScreen(id: number): [number, number] | null {
    const u = this.users.get(id);
    if (!u) return null;
    const p = this.userPos(u, performance.now());
    const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
    return [wx * this.zoom + this.cam.x, wy * this.zoom + this.cam.y];
  }
}
