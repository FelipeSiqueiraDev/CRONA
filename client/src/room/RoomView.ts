import { CODEX_NO_TABULEIRO } from '../render/arteCodex';
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
  M_POR_CASA,
  type AvatarLook,
  type ChatKind,
  type FloorItem,
  type FurniDef,
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
  type ChamaCriatura,
  chamaDaCriatura,
  fasePasso,
  PASSO_SOMBRAS,
  ehSombra,
  escuridaoNoPonto,
  chaveCasa,
  type LuzDeCasa,
  DIRS,
} from '@crona/shared';
import { drawPixelAvatar, PIXEL_AVATAR_HEIGHT, type Pose } from '../render/avatarPixel';
import { Bubbles, UI_FONT } from '../render/bubbles';
import { COR_LADO, baseDoKit, desenharChao, desenharCima, desenharRotulos, type MarcasCombate } from '../render/combateMarcas';
import { chamineDaArte, desenharParedeComArte, frenteDoFogo, PONTOS_DO_VOO, tamanhoReal, visualComArte } from '../render/furniArte';
import { furniVisual } from '../render/furniFloor';
import { estadoDaParede, estadoDoMovel } from '../render/soproMovel';
import { drawWallFurni, wallLights } from '../render/furniWall';
import { drawHintGlyph, drawHintIcon } from '../render/hints';
import { iso, unIso, Z_PX } from '../render/iso';
import { MarcasMesa } from '../render/marcasMesa';
import { NevoaMesa } from '../render/nevoaMesa';
import { imagemDoMapa } from '../render/mapaImagem';
import { desenharItemNoChao } from '../render/itemNoChao';
import { cameraVoo, casaNoPonto, desenharMesa, enquadrar, marcasNoChao, marcasPorCima, matrizNaAltura, passo, projetar, type CameraVoo, type Enquadre, type FundoIso, type PecaTatica } from '../render/mapaTatico';
import { folegoDaPeca } from '../render/folego';
import { portraitCanvas, type BreathMode } from '../render/portrait';
import { hash, hexToRgb, rgba } from '../render/color';
import { Fog } from '../render/fog';
import { Lighting, type Light } from '../render/lighting';
import { Particles } from '../render/particles';
import { ChamasDasPecas, desenharBrilhoChama, desenharCamadaChama } from '../render/chamaPeca';
import { boxSilhouette, Mapper, Painter, pointInPoly, type WBox } from '../render/painter';
import { buildStatic, doorClipPath, roomBounds, type StaticLayer } from '../render/roomStatic';
import { versaoTexturas } from '../render/texturas';
import { MundoViagem } from '../render/viagemMundo';
import { Celas, escurecerChao, escurecerForma, escuroEm } from './celas';
import { cmp, sortDrawables, type Drawable } from '../render/sort';
import {
  bonecoDir,
  bonecoFor,
  CINTURA,
  DESLIZA_COM_A_POSE,
  drawBoneco,
  drawPose,
  drawSombraProjetada,
  drawSprite,
  framesFor,
  passosFor,
  PASSOS_POR_CASA,
  PESCOCO,
  agachadoFor,
  poseFor,
  quadroDaFolha,
  quadroDaPose,
  sprites,
  type LuzNaPeca,
  type SpriteFrame,
} from '../render/sprites';
import { sfx } from '../ui/sfx';
import { desenharCasaSombra, desenharPoca } from '../render/pocaSombra';

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
  /** na cama de cima do beliche */
  alto?: boolean;
  /** flutua um pouco acima do chão (o Existido) */
  flutua?: boolean;
  /** a chama fantasmagórica (cor e intensidade) */
  chama?: ChamaCriatura;
  /** a criatura do bestiário que a peça é, e a aparência */
  criatura?: { id: string; aparencia: string };
  anim: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; start: number; ms: number } | null;
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
  /** a poeira que o passo levanta (posição na tela do mundo, que fica onde o pé pisou) e o último passo que a levantou */
  poeira?: { x: number; y: number; t0: number }[];
  passoPoeira?: number;
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
/** quanto os pés da pose sentada ficam à frente do quadril, em casas (uns 22 cm) */
const PES_A_FRENTE_SENTADO = 0.3;

/** Sombras de contato prontas, por tamanho. */
const sombrasPes = new Map<string, HTMLCanvasElement>();

const pegadas = new Map<string, HTMLCanvasElement>();

/** A pegada em degraus embaixo do boneco em pixel art: o miolo mais escuro e um anel mais claro, de borda firme. */
function desenharPegada(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  const k = `${rx}x${ry}`;
  let c = pegadas.get(k);
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
        const o = (j * c.width + i) * 4;
        img.data[o] = 30;
        img.data[o + 1] = 14;
        img.data[o + 2] = 22;
        img.data[o + 3] = d < 0.35 ? 92 : d < 0.7 ? 62 : 34;
      }
    g.putImageData(img, 0, 0);
    pegadas.set(k, c);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x - rx), Math.round(y - ry));
  ctx.restore();
}

/** Quanto dura o sopro de poeira de um passo. */
const POEIRA_MS = 520;

/**
 * O sopro de poeira de um passo, em pixel duro como o tabuleiro: uns grãos que se abrem pelo chão (na elipse do
 * piso, 2:1), sobem um tico e somem. `t` vai de 0 a 1; `semente` sorteia os grãos (cada passo o seu).
 */
function desenharPoeira(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, semente: number) {
  const a = 0.34 * (1 - t) * (1 - t);
  if (a < 0.01) return;
  const abre = 3 + 9 * (1 - (1 - t) * (1 - t));
  ctx.fillStyle = `rgba(196,182,160,${a.toFixed(3)})`;
  let s = Math.floor(semente) % 9973;
  const sorte = () => ((s = (s * 7919 + 13) % 9973) / 9973);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + sorte() * 0.8;
    const r = abre * (0.55 + 0.45 * sorte());
    const px = Math.round(x + Math.cos(ang) * r);
    const py = Math.round(y + Math.sin(ang) * r * 0.5 - t * 3 * sorte());
    const tam = sorte() < 0.4 ? 2 : 1;
    ctx.fillRect(px, py, tam, 1);
  }
}

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
  /** o grupo de peças mudou (Shift + clique): quantas andam juntas (0 = nenhum grupo) */
  grupoMudou?(n: number): void;
  /** o clique duplo do mestre numa peça (a troca de forma do NPC, 19/10) */
  pecaDupla?(id: number): void;
  /** Ctrl + clique na cama: a coberta por cima de quem está deitado, liga e desliga */
  cobrir?(id: number): void;
  /** Ctrl + clique do mestre num móvel que abre e fecha: tranca ou destranca (sem nada à vista) */
  trancar?(id: number): void;
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
/** o nome em cima da peça (17/10: desligado; o mestre sabe quem é quem e nem sempre quer que a mesa saiba) */
const MOSTRAR_NOMES = false;
const AMBER = 'rgba(255,196,90,0.95)';
/** As lupinhas de pista em cima dos móveis (desligadas em 08/10; true traz de volta). */
const MOSTRAR_LUPAS = false;

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
  /** as peças andando em grupo (Shift + clique junta e tira; 09/10, o Felipe): a comandada e as outras, e o clique no chão manda todas */
  grupo = new Set<number>();
  selection: Selection = null;
  placement: Placement | null = null;
  private painter = new Painter();
  private mapper = new Mapper();
  private lighting = new Lighting();
  /** as celas da cena (porta de cela): fechadas no escuro, abertas acesas */
  private celas = new Celas();
  private fog = new Fog();
  /** a chama fantasmagórica das criaturas (o Anfitrião e as faces), uma grade de calor por peça */
  private chamas = new ChamasDasPecas();
  private particles = new Particles();
  /** o vapor do banho no cômodo (0 a 1): sobe com o chuveiro ligado e a porta fechada, e se desfaz devagar */
  private vapor = 0;
  private vaporEm = 0;
  private aguaTocando = false;
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
  /** Ctrl + arrastar (19/10): o retângulo de seleção; quem ficar dentro vira o grupo e anda junto */
  private caixaSel: { x0: number; y0: number; x1: number; y1: number } | null = null;
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
  /** como cada peça respira parada (pela ficha: machucada, SAN baixa, morrendo); null = calma */
  respiracaoDe: ((id: number) => BreathMode | null) | null = null;
  /** clique numa peça: devolve true quando a tela usou o clique (escolher o alvo sem trocar a peça comandada) */
  aoClicarPeca: ((id: number) => boolean) | null = null;
  /** clique numa casa para uma ferramenta (medir, área): devolve true quando usou o clique */
  aoClicarCasa: ((x: number, y: number) => boolean) | null = null;
  /**
   * Em combate (17/10, o Felipe: "no combate não deixe eu controlar outro personagem ou que ele ande livremente pelo
   * mapa; ele só pode agir de acordo com as regras de combate"): o clique no chão não anda e o clique numa peça só
   * escolhe o alvo (a tela do combate decide); quem anda é o movimento do combate.
   */
  emCombate = false;
  /**
   * Quem está no combate (17/10, o Felipe: "se tiver combate rolando e eu for para outra cena, não posso mover? é só quem
   * está no combate"): a trava vale só para a peça que participa dele; as outras, em qualquer cena, andam e se escolhem
   * como sempre. Sem esta função, a trava vale para todas.
   */
  pecaEmCombate: ((viewId: number) => boolean) | null = null;
  private travada(viewId: number): boolean {
    return this.emCombate && (this.pecaEmCombate ? this.pecaEmCombate(viewId) : true);
  }

  private avisoCombateEm = 0;
  private andarLivre(x: number, y: number) {
    // a peça comandada (ou alguma do grupo) está no combate: ela só age pelas regras
    const comandadas = this.grupo.size ? [...this.grupo] : [this.myId];
    if (comandadas.some((id) => this.travada(id))) {
      // sem avisar, parecia o jogo travado (17/10, o Felipe: "por que ninguém mais se movimenta no mapa?"): era um combate
      // aberto esquecido; o aviso diz o motivo e o que fazer (no máximo um a cada 6 s)
      const agora = performance.now();
      if (agora - this.avisoCombateEm > 6000) {
        this.avisoCombateEm = agora;
        this.events.aviso?.('Esta peça está no combate: ela só age pelas regras (aba COMBATE). Para andar solto, tire-a do combate ou encerre-o (COMBATE › ⋯).');
      }
      return;
    }
    this.events.walk(x, y);
  }
  /** PV de cada peça, de 0 a 1 (o arco em volta da ficha no mapa tático) */
  pvDe: ((id: number) => number | null) | null = null;
  /**
   * Vista tática: a câmera sai do isométrico, gira e sobe até ver a sala de cima, como um mapa de
   * batalha (o mestre liga, info.tatico; a mesa acompanha). t vai de 0 (isométrico) a 1 (em cima);
   * a foto é o isométrico, que se desfaz no começo do caminho.
   */
  private tat: { t: number; alvo: number; antes: number; foto: HTMLCanvasElement | null; fundo: FundoIso | null; v: CameraVoo | null; e: Enquadre | null } = { t: 0, alvo: 0, antes: 0, foto: null, fundo: null, v: null, e: null };
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
    this.particles.setRoom(this.map, info.particles, !!info.aberto);
    // mantém a peça ativa se ela estiver nesta cena
    this.myId = users.some((u) => u.id === myId) ? myId : 0;
    this.grupo.clear();
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
  /** a câmera do mestre que a mesa segue (18/10): o centro e o pedaço do mundo que ele vê */
  private camDoMestre: { cx: number; cy: number; w: number; h: number } | null = null;

  /** A mesa enquadra o mesmo pedaço do mundo que o mestre está vendo. */
  seguirMestre(c: { cx: number; cy: number; w: number; h: number }) {
    this.camDoMestre = c;
    this.follow = false;
    this.autoFit = false;
    this.needFit = false;
    const f = this.frame_();
    if (!f.w || !f.h) return;
    this.zoom = Math.max(0.2, Math.min(4, Math.min(f.w / c.w, f.h / c.h)));
    const tx = Math.round(f.x + f.w / 2 - c.cx * this.zoom);
    const ty = Math.round(f.y + f.h / 2 - c.cy * this.zoom);
    this.camAnim = { fx: this.cam.x, fy: this.cam.y, tx, ty, t0: performance.now(), dur: 280 };
  }

  /** O que o mestre está vendo agora (para mandar à mesa). */
  vistaDoMestre(): { cx: number; cy: number; w: number; h: number } | null {
    if (!this.map) return null;
    const f = this.frame_();
    if (!f.w || !f.h) return null;
    return { cx: Math.round((f.x + f.w / 2 - this.cam.x) / this.zoom), cy: Math.round((f.y + f.h / 2 - this.cam.y) / this.zoom), w: Math.round(f.w / this.zoom), h: Math.round(f.h / this.zoom) };
  }

  fit() {
    if (!this.map) return;
    if (this.camDoMestre && this.watchOnly) return this.seguirMestre(this.camDoMestre);
    const b = roomBounds(this.map, !!this.info?.aberto);
    const f = this.frame_();
    // a Viagem: a cena é só a van (o mundo passa por fora, como ilustração de um momento): a van enche o quadro,
    // com só uma faixa de mundo em volta (antes 2,2: a van ficava pequena num mapa enorme)
    const k = this.info?.viagem ? 1.3 : 1;
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
      alto: u.alto,
      flutua: u.flutua,
      chama: u.chama,
      criatura: u.criatura,
      anim: u.mv ? { fx: u.x, fy: u.y, fz: u.z, tx: u.mv.x, ty: u.mv.y, tz: u.mv.z, start: performance.now(), ms: u.mv.ms ?? TICK_MS } : null,
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
      u.anim = { fx: f.x, fy: f.y, fz: f.z, tx: s.mv.x, ty: s.mv.y, tz: s.mv.z, start: now, ms: s.mv.ms ?? TICK_MS };
    } else if (u.anim && !(u.anim.tx === s.x && u.anim.ty === s.y)) u.anim = null;
    else if (u.anim) u.anim.tz = s.z;
    // saiu do lugar: já não está na cama de cima
    if (u.x !== s.x || u.y !== s.y) u.alto = false;
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

  /**
   * Operação "Pede Mesa" (08/10, o Felipe): a mesa desenhada costuma ser menor que as casas dela (a de trabalho do
   * calabouço ocupa 3 × 2 casas, 2,25 × 1,5 m, e o tampo tem 0,95 m de fundo). O item na casa de trás ficava no ar, do
   * lado do tampo, e a cadeira ficava uma casa inteira longe da borda de verdade. Sem mexer na arte: o item em cima da
   * mesa escorrega para dentro do tampo desenhado, e a cadeira virada para uma mesa entra um pouco embaixo dela (a peça
   * sentada vai junto). O deslocamento é em casas, só no desenho; a casa de cada um continua a mesma.
   */
  private ajustes = new Map<number, [number, number]>();
  private ajustesQuadro = -1;

  /** O tampo desenhado de uma mesa (centro e meia medida, em casas): menor que as casas dela ou, com `aumento`, maior. */
  /** O tampo de cima do móvel (onde as coisas pousam). paraCadeira: só as mesas de antes (sem o balcão alto e sem a peça encostada). */
  private tampo(s: FloorItem, paraCadeira = false) {
    const def = getFurni(s.defId);
    // do criado-mudo ao balcão do bar (1,1 m) e às estantes baixas (até 2,2 m; 16/10: o balcão ficava de fora)
    if (!def || !def.stackable || def.sit || def.walkable || def.height < 0.85 || def.height > 2.2 * Z_PER_M) return null;
    const tr = tamanhoReal(s.defId);
    if (!tr || (paraCadeira && (tr.encosta || def.height > 1.75))) return null;
    const fp = footprint(def, s.rot);
    const larguraEmX = s.rot === 0 || s.rot === 4;
    const hx = (larguraEmX ? tr.real[0] : tr.real[1]) / M_POR_CASA / 2;
    const hy = (larguraEmX ? tr.real[1] : tr.real[0]) / M_POR_CASA / 2;
    if (tr.encosta) {
      // a arte encostada no fundo da casa (o frigobar, o aparador, as bancadas): o tampo fica lá, e não no meio
      const fundo = s.rot === 4 ? [0, -1] : s.rot === 0 ? [0, 1] : s.rot === 2 ? [-1, 0] : [1, 0];
      return { cx: s.x + fp.sx / 2 + fundo[0] * (fp.sx / 2 - hx), cy: s.y + fp.sy / 2 + fundo[1] * (fp.sy / 2 - hy), hx, hy, topo: s.z + def.height };
    }
    const [ex, ey] = this.map ? this.encostoNaParede(this.map, s) : [0, 0];
    return { cx: s.x + fp.sx / 2 + ex, cy: s.y + fp.sy / 2 + ey, hx, hy, topo: s.z + def.height };
  }

  /**
   * O móvel encostado na parede (12/10, o Felipe, com as salas de referência): o desenho tem a medida de verdade e
   * fica no meio das casas dele, então o armário de 0,5 m de fundo numa casa de 0,75 m ficava a um palmo da parede,
   * como se flutuasse. Quando as costas dele dão para a parede (a casa de trás não é chão), ele vai até ela; no canto,
   * vai também para o lado da parede. Só o desenho: a casa continua a mesma.
   */
  private encostoNaParede(map: RoomMap, it: FloorItem): [number, number] {
    const def = getFurni(it.defId);
    if (!def || (def.sit && !def.leitos) || def.walkable || def.portal || def.vao === 'vazada' || /^(portal|cell_|bars|iwall)/.test(def.kind)) return [0, 0];
    if (it.z > (map.floorHeight(it.x, it.y) ?? 0) + 0.05) return [0, 0];
    const tr = tamanhoReal(it.defId);
    if (!tr || tr.encosta) return [0, 0];
    const fp = footprint(def, it.rot);
    const larguraEmX = it.rot === 0 || it.rot === 4;
    const folgaX = Math.max(0, (fp.sx - (larguraEmX ? tr.real[0] : tr.real[1]) / M_POR_CASA) / 2);
    const folgaY = Math.max(0, (fp.sy - (larguraEmX ? tr.real[1] : tr.real[0]) / M_POR_CASA) / 2);
    if (folgaX < 0.03 && folgaY < 0.03) return [0, 0];
    // a parede do lado (-1 ou +1, em x ou em y): nenhuma casa da pegada tem chão do outro lado
    const fora = (x: number, y: number) => map.floorHeight(x, y) === null;
    const lado = (ax: 'x' | 'y', s: -1 | 1) => {
      const n = ax === 'x' ? fp.sy : fp.sx;
      for (let i = 0; i < n; i++) {
        const x = ax === 'x' ? (s < 0 ? it.x - 1 : it.x + fp.sx) : it.x + i;
        const y = ax === 'y' ? (s < 0 ? it.y - 1 : it.y + fp.sy) : it.y + i;
        if (!fora(x, y)) return false;
      }
      return true;
    };
    // as costas: o lado contrário da frente (giro 4: a frente para +y, as costas em -y)
    const costas: ['x' | 'y', -1 | 1] = it.rot === 4 ? ['y', -1] : it.rot === 0 ? ['y', 1] : it.rot === 2 ? ['x', -1] : ['x', 1];
    if (!lado(...costas)) return [0, 0];
    let dx = 0;
    let dy = 0;
    if (costas[0] === 'x') dx = costas[1] * folgaX;
    else dy = costas[1] * folgaY;
    // no canto: a lateral que dá para a outra parede (só uma delas)
    const outro = costas[0] === 'x' ? 'y' : 'x';
    const folga = outro === 'x' ? folgaX : folgaY;
    if (folga >= 0.03) {
      const menos = lado(outro, -1);
      const mais = lado(outro, 1);
      const d = menos && !mais ? -folga : mais && !menos ? folga : 0;
      if (outro === 'x') dx = d;
      else dy = d;
    }
    return [dx, dy];
  }

  private ajusteDoMovel(map: RoomMap, it: FloorItem, fundo = 0): [number, number] {
    const q = Math.floor(performance.now() / 250);
    if (q !== this.ajustesQuadro) {
      this.ajustes.clear();
      this.ajustesQuadro = q;
    }
    const salvo = this.ajustes.get(it.id);
    if (salvo) return salvo;
    let r: [number, number] = [0, 0];
    const def = getFurni(it.defId);
    const chao = map.floorHeight(it.x, it.y) ?? 0;
    if (def && fundo < 4) {
      const fp = footprint(def, it.rot);
      const tr = tamanhoReal(it.defId);
      if (it.z > chao + 0.05) {
        // em cima de alguma coisa: na mesa de tampo menor, para dentro do tampo; em cima de outro item, junto com ele
        const apoio = map.itemsAt(it.x, it.y).find((s) => s !== it && s.id !== it.id && Math.abs(s.z + (getFurni(s.defId)?.height ?? 0) - it.z) < 0.06);
        const t = apoio ? this.tampo(apoio) : null;
        if (t) {
          const ihx = Math.min(t.hx, (tr ? (it.rot === 0 || it.rot === 4 ? tr.real[0] : tr.real[1]) : 0.4) / M_POR_CASA / 2);
          const ihy = Math.min(t.hy, (tr ? (it.rot === 0 || it.rot === 4 ? tr.real[1] : tr.real[0]) : 0.4) / M_POR_CASA / 2);
          const cx = it.x + fp.sx / 2;
          const cy = it.y + fp.sy / 2;
          // com folga até a borda do tampo (16/10, o Felipe: "não pode parecer que estão prestes a cair"): o contorno e
          // a sombrinha do desenho passam um pouco da medida; se não couber com a folga, vai para o meio do tampo
          const F = 0.07;
          const dentro = (c: number, tc: number, th: number, ih: number) => (th - ih - F > 0 ? Math.max(tc - th + ih + F, Math.min(tc + th - ih - F, c)) : tc);
          const nx = dentro(cx, t.cx, t.hx, ihx);
          const ny = dentro(cy, t.cy, t.hy, ihy);
          r = [nx - cx, ny - cy];
        } else if (apoio) r = this.ajusteDoMovel(map, apoio, fundo + 1);
      } else if (!def.sit || def.leitos) {
        // a cama também (a cabeceira na parede), e quem está deitado nela vai junto
        r = this.encostoNaParede(map, it);
      } else if (def.sit && !def.leitos && def.width === 1 && def.depth === 1) {
        // a cadeira: a mesa na casa da frente dela (para onde quem senta olha)
        const [fx, fy] = it.rot === 4 ? [0, 1] : it.rot === 0 ? [0, -1] : it.rot === 2 ? [1, 0] : [-1, 0];
        const mesa = map.itemsAt(it.x + fx, it.y + fy).find((s) => this.tampo(s, true));
        const t = mesa ? this.tampo(mesa, true) : null;
        if (t) {
          const meia = (tr ? tr.real[1] : 0.5) / M_POR_CASA / 2;
          // quanto o assento entra embaixo do tampo (~4 cm): o bastante para parecer puxada para a mesa; mais que isso, o
          // encosto (mais alto que o tampo) passava por cima da mesa e a cadeira parecia enfiada nela (17/10)
          const encaixa = 0.05;
          const c = fx ? it.x + 0.5 : it.y + 0.5;
          const lado = fx ? it.y + 0.5 : it.x + 0.5;
          const [tc, th, lc, lh] = fx ? [t.cx, t.hx, t.cy, t.hy] : [t.cy, t.hy, t.cx, t.hx];
          if (Math.abs(lado - lc) <= lh + 0.1) {
            const borda = tc - (fx || fy) * th;
            const alvo = borda - (fx || fy) * (meia - encaixa);
            // para a mesa (o tampo menor que as casas) ou para trás (a mesa com `aumento`, que entra na casa dela):
            // o assento fica sempre um pouco embaixo da borda, nem longe nem dentro da mesa
            const d = Math.max(-0.45, Math.min(0.35, (alvo - c) * (fx || fy)));
            if (Math.abs(d) > 0.02) r = fx ? [d * fx, 0] : [0, d * fy];
          }
        }
      }
    }
    this.ajustes.set(it.id, r);
    return r;
  }

  /**
   * A fumaça da chaminé em pixel (17/10, o Felipe: "não dá pra fazer uma coisa contínua e única? olha como a fumaça
   * sai da chaminé"): uma pluma só, sem bolinhas soltas. Sai fina e escura da boca, sobe ondulando em curvas que correm
   * para cima o tempo todo, vai abrindo e clareando e o vento a deita para um lado; no alto ela se desfaz em fiapos.
   */
  private desenharFumaca(ctx: CanvasRenderingContext2D, wx: number, wy: number, z0: number, seed: number, now: number, boca: [number, number][]) {
    const t = now / 1000 + (seed % 11) * 3.7;
    const [bx, by] = iso(wx, wy, z0);
    const ALTO = 2.8 * Z_PER_M * Z_PX;
    const PASSOS = 90;
    ctx.save();
    // o recorte: só o que fica acima das duas bordas da frente da boca (a quina mais perto da câmera e as duas
    // vizinhas); o que está abaixo delas é a fumaça ainda dentro da chaminé, tapada pela parede da frente
    const perto = boca.reduce((m, p, i) => (p[1] > boca[m][1] ? i : m), 0);
    const esq = boca[(perto + 3) % 4];
    const dir = boca[(perto + 1) % 4];
    const [e, d] = esq[0] < dir[0] ? [esq, dir] : [dir, esq];
    ctx.beginPath();
    ctx.moveTo(e[0] - 400, e[1]);
    ctx.lineTo(e[0], e[1]);
    ctx.lineTo(boca[perto][0], boca[perto][1]);
    ctx.lineTo(d[0], d[1]);
    ctx.lineTo(d[0] + 400, d[1]);
    ctx.lineTo(d[0] + 400, d[1] - 600);
    ctx.lineTo(e[0] - 400, e[1] - 600);
    ctx.closePath();
    ctx.clip();
    for (let k = 0; k < PASSOS; k++) {
      const s = k / (PASSOS - 1);
      // o caminho: sobe, o vento leva para a direita cada vez mais, e as curvas (duas ondas) andam para cima com o tempo
      const onda = Math.sin(s * 7.5 - t * 1.6) * (1.5 + s * 7) + Math.sin(s * 15 - t * 2.7 + 1.3) * s * 2.5;
      const cx = bx + s * s * 46 + onda;
      const cy = by - s * ALTO + Math.cos(s * 6 - t * 1.3) * s * 3;
      // sai do tamanho da boca (o buraco da chaminé) e engrossa subindo
      const r = 2.2 + s * 12 + Math.sin(s * 11 - t * 2.2) * s * 2.2;
      // escura e densa na boca, clara e rala no alto; some no fim
      const tom = 70 + s * 135;
      const a = Math.min(1, s * 10 + 0.4) * Math.pow(1 - s, 0.9) * 0.85;
      const R = Math.ceil(r);
      const qx = Math.round(cx);
      const qy = Math.round(cy);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy * 1.1) / r;
          if (d > 1) continue;
          // a borda e o miolo esfarrapados, mexendo devagar (o sorteio muda com o tempo); no alto, mais buracos
          const h = (hash(seed + k * 31 + Math.floor(t * 5), (dx + 40) * 97 + dy + 40) % 1000) / 1000;
          if (h < (d - 0.5) * 1.6 + s * 0.35) continue;
          const luz = dy < 0 && dx < 0 ? 16 : dy > 0 ? -12 : 0;
          const c = Math.max(0, Math.min(255, Math.round(tom + luz - d * 18)));
          ctx.fillStyle = `rgba(${c},${c},${c + 5},${(a * (1 - d * 0.4)).toFixed(3)})`;
          ctx.fillRect(qx + dx, qy + dy, 1, 1);
        }
    }
    ctx.restore();
  }

  /** Os fios de água do chuveiro ligado: do chuveiro (a 1,9 m, no canto do fundo do box) até o ralo, caindo sem parar. */
  private desenharAgua(ctx: CanvasRenderingContext2D, it: FloorItem, now: number, dentro: boolean) {
    const topo = 1.9 * Z_PER_M;
    ctx.save();
    // alguém no banho: o vidro do box embaçado do chão até o pescoço (~1,45 m), com as gotas escorrendo nele
    if (dentro) {
      const pescoco = 1.45 * Z_PER_M;
      const sil = boxSilhouette({ x0: it.x + 0.02, x1: it.x + 0.98, y0: it.y + 0.02, y1: it.y + 0.98, z0: it.z, z1: it.z + pescoco });
      ctx.beginPath();
      ctx.moveTo(sil[0][0], sil[0][1]);
      for (let i = 1; i < sil.length; i++) ctx.lineTo(sil[i][0], sil[i][1]);
      ctx.closePath();
      const [, yTopo] = iso(it.x + 1, it.y + 1, it.z + pescoco);
      const [, yBase] = iso(it.x + 1, it.y + 1, it.z);
      const g = ctx.createLinearGradient(0, yTopo - 8, 0, yBase);
      g.addColorStop(0, 'rgba(236,243,247,0.55)');
      g.addColorStop(0.18, 'rgba(236,243,247,0.93)');
      g.addColorStop(1, 'rgba(226,236,242,0.96)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // as gotas que escorrem no vidro embaçado
      ctx.fillStyle = 'rgba(170,200,220,0.55)';
      for (let i = 0; i < 9; i++) {
        const u = 0.1 + ((hash(it.id, i + 200) % 1000) / 1000) * 0.85;
        const lado = i % 2 === 0;
        const fase = ((now / 1000) * (0.12 + (i % 4) * 0.05) + i * 0.29) % 1;
        const z = it.z + pescoco * (1 - fase);
        const [gx, gy] = lado ? iso(it.x + u, it.y + 0.99, z) : iso(it.x + 0.99, it.y + u, z);
        ctx.fillRect(Math.round(gx), Math.round(gy), 1, 3);
      }
      ctx.restore();
    }
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 22; i++) {
      const u = 0.32 + ((hash(it.id, i) % 1000) / 1000) * 0.36;
      const v = 0.32 + ((hash(it.id, i + 50) % 1000) / 1000) * 0.36;
      const vel = 1.6 + ((hash(it.id, i + 90) % 100) / 100) * 0.8;
      const fase = (now / 1000 * vel + i * 0.37) % 1;
      const z0 = it.z + topo * (1 - fase);
      const z1 = Math.max(it.z, z0 - 0.35 * Z_PER_M);
      const [x0, y0] = iso(it.x + u, it.y + v, z0);
      const [x1, y1] = iso(it.x + u, it.y + v, z1);
      ctx.strokeStyle = i % 3 ? 'rgba(190,225,255,0.8)' : 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(Math.round(x0) + 0.5, y0);
      ctx.lineTo(Math.round(x1) + 0.5, y1);
      ctx.stroke();
    }
    // os respingos no chão do box
    const [cx, cy] = iso(it.x + 0.5, it.y + 0.5, it.z);
    ctx.fillStyle = 'rgba(220,240,255,0.5)';
    for (let i = 0; i < 6; i++) {
      const a = (now / 160 + i * 1.7) % (Math.PI * 2);
      ctx.fillRect(Math.round(cx + Math.cos(a + i) * 9), Math.round(cy + Math.sin(a * 1.3) * 3), 1, 1);
    }
    ctx.restore();
  }

  /** O vapor do banho por cima do cômodo (só com a porta fechada): um véu branco e rolos de vapor que sobem e andam. */
  private desenharVapor(ctx: CanvasRenderingContext2D, map: RoomMap, now: number) {
    const { minX: x0, minY: y0, maxX: x1, maxY: y1 } = roomBounds(map);
    const k = this.vapor;
    ctx.save();
    const g = ctx.createLinearGradient(0, y0 - 60, 0, y1);
    g.addColorStop(0, `rgba(236,240,244,${(0.72 * k).toFixed(3)})`);
    g.addColorStop(1, `rgba(236,240,244,${(0.3 * k).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 20, y0 - 80, x1 - x0 + 40, y1 - y0 + 100);
    for (let i = 0; i < 9; i++) {
      const t = now / 1000;
      const px = x0 + ((hash(i, 7) % 1000) / 1000) * (x1 - x0) + Math.sin(t * 0.3 + i) * 14;
      const py = y1 - ((t * 9 + i * 37) % (y1 - y0 + 80));
      const r = 26 + (hash(i, 3) % 20);
      const rg = ctx.createRadialGradient(px, py, 0, px, py, r);
      rg.addColorStop(0, `rgba(245,248,250,${(0.45 * k).toFixed(3)})`);
      rg.addColorStop(1, 'rgba(245,248,250,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /** O pedaço da tela onde a peça vai ser desenhada, antes dela (para o mosaico achar os pixels do corpo). */
  private fotoDaPeca(ctx: CanvasRenderingContext2D, sx: number, sy: number, HE: number) {
    const T = ctx.getTransform();
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const x0 = Math.max(0, Math.floor(T.a * (sx - 34) + T.e));
    const x1 = Math.min(W, Math.ceil(T.a * (sx + 34) + T.e));
    const y0 = Math.max(0, Math.floor(T.d * (sy - HE - 14) + T.f));
    const y1 = Math.min(H, Math.ceil(T.d * (sy + 8) + T.f));
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
    // o bloco do mosaico: 3 pixels da arte, na escala da tela
    const bloco = Math.max(3, Math.round(3 * T.a * ESCALA_ARTE_PESSOA));
    return { x0, y0, w: x1 - x0, h: y1 - y0, bloco, dados: ctx.getImageData(x0, y0, x1 - x0, y1 - y0) };
  }

  /**
   * O borrado do The Sims: o que mudou na tela depois de desenhar a peça é o corpo; do peito às coxas, ele vira blocos
   * da cor média (a cabeça e os pés ficam de fora, como no jogo).
   */
  private mosaicoDaPeca(ctx: CanvasRenderingContext2D, f: { x0: number; y0: number; w: number; h: number; bloco: number; dados: ImageData }) {
    const depois = ctx.getImageData(f.x0, f.y0, f.w, f.h);
    const a = f.dados.data;
    const d = depois.data;
    const corpo = new Uint8Array(f.w * f.h);
    let topo = f.h;
    let base = -1;
    for (let i = 0, n = f.w * f.h; i < n; i++) {
      const k = i * 4;
      if (Math.abs(a[k] - d[k]) + Math.abs(a[k + 1] - d[k + 1]) + Math.abs(a[k + 2] - d[k + 2]) > 24) {
        corpo[i] = 1;
        const y = (i / f.w) | 0;
        if (y < topo) topo = y;
        if (y > base) base = y;
      }
    }
    if (base < 0) return;
    const alto = base - topo;
    const b = f.bloco;
    // dos ombros às coxas (o rosto e os pés de fora)
    const y0 = topo + Math.round(alto * 0.36);
    const y1 = topo + Math.round(alto * 0.8);
    for (let by = y0; by < y1; by += b)
      for (let bx = 0; bx < f.w; bx += b) {
        let r = 0;
        let g = 0;
        let bl = 0;
        let n = 0;
        const ye = Math.min(y1, by + b);
        const xe = Math.min(f.w, bx + b);
        for (let y = by; y < ye; y++)
          for (let x = bx; x < xe; x++) {
            const i = y * f.w + x;
            if (!corpo[i]) continue;
            r += d[i * 4];
            g += d[i * 4 + 1];
            bl += d[i * 4 + 2];
            n++;
          }
        // o bloco que é mais corpo que fundo vira um quadrado só, da cor média do corpo nele
        if (n * 3 < (ye - by) * (xe - bx)) continue;
        r = (r / n) | 0;
        g = (g / n) | 0;
        bl = (bl / n) | 0;
        for (let y = by; y < ye; y++)
          for (let x = bx; x < xe; x++) {
            const k = (y * f.w + x) * 4;
            d[k] = r;
            d[k + 1] = g;
            d[k + 2] = bl;
          }
      }
    ctx.putImageData(depois, f.x0, f.y0);
  }

  /**
   * A coberta da cama por cima de quem está deitado (17/10): o mesmo desenho da cama, recortado na fatia do travesseiro
   * até o pé e da altura do colchão um pouco para cima, desenhado de novo depois da peça. A cabeça fica no travesseiro,
   * de fora; a cabeceira, atrás, não entra no recorte.
   */
  private desenharCoberta(ctx: CanvasRenderingContext2D, map: RoomMap, it: FloorItem, def: FurniDef) {
    const base = furniVisual(def, it.state, it.id);
    const vis = visualComArte(def, base, it.state, it.id, it.rot, this.info?.floorStyle, it.escala ?? 1, it.vazio, it.modelo) ?? base;
    const [ax, ay] = this.ajusteDoMovel(map, it);
    const painter = this.painter;
    painter.m.set(it.rot, def.width, def.depth, it.x + ax, it.y + ay, it.z);
    painter.state = it.state;
    painter.seed = it.id;
    // a coberta começa abaixo do queixo (~0,8 m da cabeceira: o travesseiro e o rosto de fora; a cabeceira é o fundo da
    // peça, u = 0); o colchão está na altura do móvel
    const travesseiro = Math.min(def.depth * 0.45, 0.8 / M_POR_CASA);
    const colchao = def.height / Z_PER_M;
    const b: [number, number, number, number, number, number] = [travesseiro, def.depth, 0, def.width, 0, colchao + 0.16];
    const sil = boxSilhouette(painter.m.box(b));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sil[0][0], sil[0][1]);
    for (let i = 1; i < sil.length; i++) ctx.lineTo(sil[i][0], sil[i][1]);
    ctx.closePath();
    ctx.clip();
    for (const node of vis.nodes) node.draw(painter);
    ctx.restore();
  }

  // ================================================================ o passo pelas sombras (Magistrada, 18/10)
  /** os passos pelas sombras em andamento, por peça: de onde ela some, onde sai e quando começou (shared/sombras.ts) */
  private passosSombra = new Map<number, { de: { x: number; y: number }; para: { x: number; y: number }; t0: number }>();
  /** as luzes e a escuridão do último quadro, em px do mundo: quais casas são sombra de luz */
  private luzCasas: { luzes: LuzDeCasa[]; escuro: number } = { luzes: [], escuro: 0 };
  private sombraEscolha: { tokenId: number; aoEscolher: (x: number, y: number) => void; aoFim: () => void } | null = null;
  /** o mestre está marcando sombras à mão: o clique numa casa marca ou desmarca */
  marcandoSombra = false;
  aoMarcarSombra: ((x: number, y: number, marcada: boolean) => void) | null = null;
  private sombraTecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cancelarSombra();
  };

  /** Chegou o passo pelas sombras de uma peça: a animação começa agora (o mestre e a mesa veem a mesma coisa). */
  receberPassoSombras(m: { tokenId: number; de: { x: number; y: number }; para: { x: number; y: number } }) {
    const u = this.users.get(m.tokenId);
    if (!u) return;
    this.passosSombra.set(m.tokenId, { de: m.de, para: m.para, t0: performance.now() });
    u.anim = null;
    sfx.sombraEntra();
    setTimeout(() => sfx.sombraSai(), PASSO_SOMBRAS.sobe - 220);
  }

  /**
   * As casas que valem como sombra: as que a luz da cena deixa escuras (`ehSombra`, o limiar de shared/sombras.ts) e as que
   * o mestre marcou à mão, de chão livre e vazias. Chave "x,y".
   */
  casasDeSombra(): Map<string, 'luz' | 'marcada'> {
    const out = new Map<string, 'luz' | 'marcada'>();
    const map = this.map;
    if (!map) return out;
    const manual = new Set((this.info?.sombras ?? []).map((c) => chaveCasa(c.x, c.y)));
    const ocupadas = new Set([...this.users.values()].map((u) => chaveCasa(u.x, u.y)));
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const h = map.floorHeight(x, y);
        if (h === null || map.walkState(x, y) !== 'walk') continue;
        const k = chaveCasa(x, y);
        if (ocupadas.has(k)) continue;
        if (manual.has(k)) out.set(k, 'marcada');
        else {
          const [wx, wy] = iso(x + 0.5, y + 0.5, h);
          if (ehSombra(escuridaoNoPonto(this.luzCasas.luzes, this.luzCasas.escuro, wx, wy))) out.set(k, 'luz');
        }
      }
    return out;
  }

  /** O mestre vai escolher de qual sombra a peça sai: as sombras se acendem e o clique numa delas chama `aoEscolher`. */
  escolherSombra(tokenId: number, aoEscolher: (x: number, y: number) => void, aoFim: () => void) {
    this.cancelarSombra();
    this.sombraEscolha = { tokenId, aoEscolher, aoFim };
    window.addEventListener('keydown', this.sombraTecla);
    const n = this.casasDeSombra().size;
    this.events.aviso?.(n ? 'Clique na sombra de onde ela sai (Esc cancela).' : 'Nenhuma casa escura aqui: marque sombras à mão (Marcar sombras).');
  }

  cancelarSombra() {
    const e = this.sombraEscolha;
    if (!e) return;
    this.sombraEscolha = null;
    window.removeEventListener('keydown', this.sombraTecla);
    e.aoFim();
  }

  get escolhendoSombra() {
    return this.sombraEscolha !== null;
  }

  /** O clique do mestre no modo das sombras. Devolve true quando usou o clique. */
  private cliqueSombra(tile: { x: number; y: number } | null): boolean {
    if (!tile) return !!this.sombraEscolha;
    if (this.marcandoSombra && !this.sombraEscolha) {
      if (this.map?.floorHeight(tile.x, tile.y) == null) return true;
      const marcada = (this.info?.sombras ?? []).some((c) => c.x === tile.x && c.y === tile.y);
      this.aoMarcarSombra?.(tile.x, tile.y, !marcada);
      return true;
    }
    const e = this.sombraEscolha;
    if (!e) return false;
    if (!this.casasDeSombra().has(chaveCasa(tile.x, tile.y))) {
      this.events.aviso?.('Essa casa não é uma sombra.');
      return true;
    }
    this.sombraEscolha = null;
    window.removeEventListener('keydown', this.sombraTecla);
    e.aoEscolher(tile.x, tile.y);
    e.aoFim();
    return true;
  }

  private userPos(u: ClientUser, now: number) {
    // no passo pelas sombras a peça fica na casa de saída até afundar nela
    const fxs = this.passosSombra.get(u.id);
    if (fxs && now - fxs.t0 < PASSO_SOMBRAS.troca) {
      const [x, y] = this.vis(fxs.de.x, fxs.de.y);
      return { x, y, z: this.map?.standHeight(fxs.de.x, fxs.de.y) ?? u.z, moving: false };
    }
    if (u.anim) {
      const t = (now - u.anim.start) / u.anim.ms;
      const k = Math.min(1, Math.max(0, t));
      const [fx, fy] = this.vis(u.anim.fx, u.anim.fy);
      const [tx, ty] = this.vis(u.anim.tx, u.anim.ty);
      // a altura muda perto da borda entre as casas, onde fica o degrau: em linha reta de um meio de casa ao outro, a
      // peça subia antes de chegar à escadinha da ponte e parecia voar (17/10)
      const s = Math.min(1, Math.max(0, (k - 0.3) / 0.4));
      return {
        x: fx + (tx - fx) * k,
        y: fy + (ty - fy) * k,
        z: u.anim.fz + (u.anim.tz - u.anim.fz) * s * s * (3 - 2 * s),
        moving: t < 1.1,
      };
    }
    const [x, y] = this.vis(u.x, u.y);
    // sentada numa cadeira que entrou embaixo da mesa: vai junto com ela
    const cadeira = u.sit === 1 && this.map ? this.map.sitItem(u.x, u.y) : undefined;
    const [ax, ay] = cadeira && this.map ? this.ajusteDoMovel(this.map, cadeira) : [0, 0];
    return { x: x + ax, y: y + ay, z: u.z, moving: false };
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
    this.neblinaMudou(it.defId);
  }
  /** a peça de neblina mudou: os bancos de neblina saem de novo */
  private neblinaMudou(defId: string | undefined) {
    if (defId === 'neblina_densa' && this.map) this.fog.montarBancos(this.map);
  }
  updateItem(it: FloorItem) {
    const old = this.map?.getItem(it.id);
    // fechadura abriu ou fechou: o mobi desliza até o lugar novo, arrastando
    if (old?.lock && it.lock && old.lock.open !== it.lock.open && (old.x !== it.x || old.y !== it.y)) {
      this.slides.set(it.id, { fx: old.x, fy: old.y, t0: performance.now() });
      sfx.scrape(SLIDE_MS);
    }
    this.map?.updateItem(it);
    this.neblinaMudou(it.defId);
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
    const era = this.map?.getItem(id)?.defId;
    this.map?.removeItem(id);
    this.neblinaMudou(era);
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

  /** Enquanto um joguinho do bar está aberto (15/10, o Felipe): o zoom do tabuleiro (roda, botões +/-, mapa tático) não responde. */
  zoomTravado = false;

  zoomStep(dir: 1 | -1, ax?: number, ay?: number) {
    if (this.zoomTravado) return;
    // próximo nível acima/abaixo do zoom atual (que pode ser contínuo após enquadrar)
    const n = dir > 0 ? ZOOMS.find((z) => z > this.zoom + 1e-3) : [...ZOOMS].reverse().find((z) => z < this.zoom - 1e-3);
    if (n) this.setZoom(n, ax, ay);
  }

  /** Aproxima (f > 1) ou afasta o mapa tático, com o ponto (px, py) do canvas parado; de 1x a 5x. */
  zoomTatico(f: number, px: number, py: number) {
    if (this.zoomTravado) return;
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
      // Ctrl + arrastar: a seleção por área (o mestre junta pessoas e monstros num grupo e anda com todos)
      if ((e.ctrlKey || e.metaKey) && !this.placement && this.info?.isOwner && this.tat.t <= 0) {
        this.caixaSel = { x0: e.offsetX, y0: e.offsetY, x1: e.offsetX, y1: e.offsetY };
        return;
      }
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
      if (this.caixaSel) {
        this.caixaSel.x1 = e.offsetX;
        this.caixaSel.y1 = e.offsetY;
        return;
      }
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
      if (this.caixaSel) {
        const k = this.caixaSel;
        this.caixaSel = null;
        // arrasto curto é um Ctrl + clique normal
        if (Math.hypot(k.x1 - k.x0, k.y1 - k.y0) < 6) {
          this.mouse = { x: e.offsetX, y: e.offsetY, inside: true };
          this.updateHover();
          this.click(e.shiftKey, true);
        } else this.selecionarNaCaixa(k);
        return;
      }
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
        this.click(e.shiftKey, e.ctrlKey || e.metaKey);
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
        if (this.watchOnly || this.zoomTravado) return;
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
    // o prédio e a árvore que ficam transparentes com gente atrás (xray) não roubam o clique de quem está atrás deles
    // (17/10, o Felipe: "por que eu não consigo selecionar ela clicando nela?", a Camarilla atrás de uma casa)
    let atras: Hit | null = null;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (!h.test(wx, wy)) continue;
      if (h.kind === 'user') return h;
      if (!atras) {
        atras = h;
        const it = h.kind === 'floor' ? this.map?.getItem(h.id) : undefined;
        if (!(it && getFurni(it.defId)?.xray)) return h;
      }
    }
    return atras;
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

  private click(shift: boolean, ctrl = false) {
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
    // escolher a sombra do passo (ou marcar sombras à mão): o clique é todo dessa ferramenta
    if (this.sombraEscolha || this.marcandoSombra) {
      const alvo = tile ?? (hit?.kind === 'user' ? (this.users.get(hit.id) ?? null) : null);
      if (this.cliqueSombra(alvo ? { x: alvo.x, y: alvo.y } : null)) return;
    }
    // ferramenta do combate (medir, área): a casa da peça também serve
    if (this.aoClicarCasa) {
      if (!tile && hit?.kind === 'user') {
        const u = this.users.get(hit.id);
        if (u) tile = { x: u.x, y: u.y };
      }
      if (tile && this.aoClicarCasa(tile.x, tile.y)) return;
    }

    if (hit?.kind === 'user') {
      if (dbl && !this.watchOnly && this.info?.isOwner) this.events.pecaDupla?.(hit.id);
      if (this.aoClicarPeca?.(hit.id)) return;
      // em combate, clicar numa peça não passa o comando para ela (a tela do combate cuida de quem age), mas ela se
      // escolhe: o painel mostra a ficha dela (17/10, o Felipe: "não consigo clicar em mais ninguém no tabuleiro")
      if (this.travada(hit.id)) {
        this.select({ kind: 'user', id: hit.id });
        return;
      }
      // Shift + clique: junta a peça ao grupo (ou tira); o clique no chão manda o grupo inteiro
      if (shift && !this.watchOnly) {
        if (this.myId && this.users.has(this.myId)) this.grupo.add(this.myId);
        if (this.grupo.has(hit.id) && this.grupo.size > 1) {
          this.grupo.delete(hit.id);
          if (this.myId === hit.id) this.myId = [...this.grupo][0] ?? 0;
        } else {
          this.grupo.add(hit.id);
          this.myId = hit.id;
        }
        if (this.grupo.size < 2) this.grupo.clear();
        this.events.grupoMudou?.(this.grupo.size);
        this.select({ kind: 'user', id: this.myId });
        return;
      }
      // clicar numa peça passa a controlá-la (e desfaz o grupo)
      if (this.grupo.size) (this.grupo.clear(), this.events.grupoMudou?.(0));
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
        // Ctrl + clique na cama (o mestre): a coberta por cima de quem deita nela
        if (ctrl && def.deita && this.info?.isOwner && this.events.cobrir) {
          this.events.cobrir(it.id);
          return;
        }
        // Ctrl + clique (o mestre) no que abre e fecha (a porta, o armário, a escotilha): tranca ou destranca
        if (ctrl && (def.states ?? 0) > 1 && this.info?.isOwner && this.events.trancar) {
          this.events.trancar(it.id);
          return;
        }
        if (dbl) this.events.use(it.id);
        // como a cadeira: a mesa vazada leva a peça para baixo dela (abaixada, escondida)
        if (def.walkable || def.sit || def.vao === 'vazada') {
          const fp = footprint(def, it.rot);
          const inside = tile && tile.x >= it.x && tile.y >= it.y && tile.x < it.x + fp.sx && tile.y < it.y + fp.sy;
          const target = inside ? tile! : { x: it.x, y: it.y };
          if (!(def.flat && !this.info?.canBuild && !it.hint)) this.select({ kind: 'floor', id: it.id });
          else this.select(null);
          this.mark(target.x, target.y);
          this.andarLivre(target.x, target.y);
        } else {
          // o prédio ao ar livre (o celeiro, o casarão): um clique no desenho dele, na porta inclusive, leva a peça
          // até a entrada encostada nele, e ela entra; o clique duplo continua escolhendo o prédio
          const entrada = !dbl && def.width * def.depth >= 20 ? this.entradaDoPredio(it) : null;
          if (entrada) {
            this.select(null);
            this.mark(entrada.x, entrada.y);
            this.andarLivre(entrada.x, entrada.y);
          } else this.select({ kind: 'floor', id: it.id });
        }
        return;
      }
    }
    this.select(null);
    if (tile) {
      this.mark(tile.x, tile.y);
      this.andarLivre(tile.x, tile.y);
    }
  }

  /** A passagem (a Entrada na frente da porta) encostada no prédio, como a planta do servidor acha (`marcos`). */
  private entradaDoPredio(it: FloorItem): { x: number; y: number } | null {
    const def = getFurni(it.defId);
    if (!def || def.walkable || !this.map) return null;
    const fp = footprint(def, it.rot);
    const p = this.map
      .allItems()
      .find((q) => q.link !== undefined && getFurni(q.defId)?.portal && q.x >= it.x - 1 && q.x <= it.x + fp.sx && q.y >= it.y - 1 && q.y <= it.y + fp.sy);
    return p ? { x: p.x, y: p.y } : null;
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

  /**
   * Em Santo Berço não há fogo (16/10, o Felipe: "o fogo são os cristais vermelhos"): a luz de fogo vira o brilho do
   * cristal vermelho, sem a chama animada, a fumaça e as brasas, quase sem tremer. Fora de lá, nada muda.
   */
  private semFogo(L: { kind?: string; color: string; flicker?: number }): { kind?: 'cristal'; color?: string; flicker?: number } {
    if (!this.info?.luzDeCristal || L.kind !== 'fire') return {};
    return { kind: 'cristal', color: '#ff4a32', flicker: Math.min(L.flicker ?? 0, 0.04) };
  }

  private drawWallItem(it: { id: number; wall: 'l' | 'r'; plane: number; pos: number; z: number; state: number; escala?: number; vazio?: boolean; modelo?: string }, def: WallFurniDef, t: number, lights: Light[], alpha: number, outline: string | null) {
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
    // a vela soprada (sopro.ts): logo depois de apagar, ainda desenhada acesa enquanto a chama encolhe
    const estado = estadoDaParede(it, def);
    const comArte = desenharParedeComArte(ctx, def.id, it.wall, estado, px, py, it.id, it.vazio, it.modelo);
    ctx.transform(1, k, 0, 1, ox, oy);
    if (!comArte) drawWallFurni(ctx, def, estado, it.id, t, it.modelo);
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-2, -2, def.w + 4, def.h + 4);
    }
    ctx.restore();
    for (const L of wallLights(def, estado)) {
      // no cômodo: ao longo da parede, um pouco para dentro dela, na altura da luz
      const ao = (L.x - def.w / 2) / 32;
      const alt = it.z + (def.h - L.y) / 32;
      const mundo: [number, number, number] = it.wall === 'l' ? [it.plane + 0.2, it.pos - ao, alt] : [it.pos + ao, it.plane + 0.2, alt];
      // a janela: o feixe de luz entrando no cômodo e caindo no chão (particles.ts desenha)
      const feixe =
        L.kind === 'natural'
          ? { wall: it.wall, plane: it.plane, pos: it.pos, larg: (def.w / 32) * 0.86, z0: it.z + 0.08, z1: it.z + def.h / 32 - 0.08, chao: this.map?.floorHeight(it.wall === 'l' ? it.plane : Math.floor(it.pos), it.wall === 'l' ? Math.floor(it.pos) : it.plane) ?? 0 }
          : undefined;
      lights.push({ x: ox + L.x, y: oy + k * L.x + L.y, radius: L.radius, color: L.color, intensity: L.intensity * alpha, flicker: L.flicker, pulse: L.pulse, kind: L.kind, seed: it.id, mundo, feixe, ...this.semFogo(L) });
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
      tat.fundo = null;
      this.frameIso();
      return;
    }
    // o fundo do isométrico para o caminho (feito na saída de cada ponta, na ida e na volta)
    if (tat.t >= 1) tat.fundo = null;
    else if (!tat.fundo) tat.fundo = this.fundoDoVoo();
    // a foto do isométrico, que se desfaz no começo do caminho (na ida e na volta)
    if (tat.t >= 1) tat.foto = null;
    else if (tat.t < 0.42 && !tat.foto && this.map) {
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
      fundoIso: this.tat.fundo,
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
    // até o primeiro quadro do voo (PONTOS_DO_VOO[0], no ângulo da câmera), a foto do isométrico se desfaz por cima
    const a = 1 - passo(0, PONTOS_DO_VOO[0], 1 - v.giro / (Math.PI / 4));
    if (foto && a > 0.001) {
      // a foto presa no chão da câmera: no começo ela cobre os quadros do voo e se desfaz
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
        // a mesa (o tablet) não mostra a vida de ninguém: os jogadores não podem saber (19/10)
        pv: this.watchOnly ? undefined : (this.pvDe?.(u.id) ?? undefined),
        vez: !!m?.vez.has(u.id),
        escolhida: !this.watchOnly && (u.id === this.myId || this.grupo.has(u.id) || (sel?.kind === 'user' && sel.id === u.id)),
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

  /** O chão e as paredes do isométrico (buildStatic), refeitos só quando a sala, a escala ou o piso mudam. */
  private camadaEstatica(map: RoomMap, info: RoomInfo, scale: number): StaticLayer {
    const key = `${info.id}|${info.heightmap}|${map.door.x},${map.door.y}|${scale}|${info.floorStyle ?? ''}|${versaoTexturas()}|${info.aberto ? 'a' : ''}|${info.terreno ?? ''}`;
    if (key !== this.staticKey || !this.staticLayer) {
      this.staticLayer = buildStatic(map, scale, info.floorStyle, info.terreno, !!info.aberto);
      this.staticKey = key;
    }
    return this.staticLayer;
  }

  /**
   * O fundo do isométrico para o caminho da câmera: o chão e as paredes (a camada estática) com os itens de parede
   * por cima, sem os móveis e sem a luz. No voo, cada plano dele (o chão, cada trecho de parede) vai para o ângulo de
   * agora (mapaTatico, fundoIso): a sala continua com a arte dela, sem virar caixa.
   */
  private fundoDoVoo(): FundoIso | null {
    const map = this.map;
    const info = this.info;
    if (!map || !info) return null;
    const st = this.camadaEstatica(map, info, this.zoom * this.dpr);
    const sc = st.canvas.width / st.w;
    const c = document.createElement('canvas');
    c.width = st.canvas.width;
    c.height = st.canvas.height;
    const g = c.getContext('2d')!;
    g.setTransform(sc, 0, 0, sc, -st.x * sc, -st.y * sc);
    g.imageSmoothingEnabled = false;
    g.drawImage(st.canvas, st.x, st.y, st.w, st.h);
    // os itens de parede, pelo mesmo desenho do isométrico, nesta tela
    const salva = this.ctx;
    this.ctx = g;
    try {
      const t = Date.now();
      for (const it of map.allWallItems()) {
        const def = getWallFurni(it.defId);
        if (def) this.drawWallItem(it, def, t, [], 1, null);
      }
    } finally {
      this.ctx = salva;
    }
    return { img: c, x: st.x, y: st.y, w: st.w, h: st.h };
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

    this.camadaEstatica(map, this.info, scale);
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
    const addFurni = (it: { id: number; defId: string; x: number; y: number; z: number; rot: number; state: number; escala?: number; vazio?: boolean; quebrado?: boolean; modelo?: string }, alpha: number, selected: boolean, ghost: boolean) => {
      const def = getFurni(it.defId);
      if (!def) return;
      // a vela soprada (sopro.ts): logo depois de apagar, ainda desenhada acesa enquanto a chama encolhe para o pavio
      const estado = ghost ? it.state : estadoDoMovel(it, def);
      const base = furniVisual(def, estado, it.id);
      const vis = visualComArte(def, base, estado, it.id, it.rot, this.info?.floorStyle, it.escala ?? 1, it.vazio, it.modelo) ?? base;
      // a Operação Pede Mesa: o item escorrega para o tampo desenhado, a cadeira entra embaixo da mesa
      const [ax, ay] = ghost ? [0, 0] : this.ajusteDoMovel(map, it as FloorItem);
      const ix = it.x + ax;
      const iy = it.y + ay;
      // A ordem de desenho vem da casa de verdade do móvel (a pegada no chão), nunca do desenho: a
      // cadeira que desliza para baixo do tampo e a mesa maior que a pegada (`aumento`) cruzavam as
      // caixas, e o desempate deixava a cadeira de trás por cima da mesa (12/10). Com as pegadas, peças
      // em casas diferentes sempre têm um lado que as separa, e a ordem sai certa ao montar e ao mover.
      m.set(it.rot, def.width, def.depth, it.x, it.y, it.z);
      const ordens = vis.nodes.map((node) => m.box(node.ordem ?? node.b));
      m.set(it.rot, def.width, def.depth, ix, iy, it.z);
      const floorH = map.floorHeight(it.x, it.y) ?? 0;
      const flat = !!def.flat && it.z <= floorH + 0.05 && !ghost;
      let topZ = it.z + def.height;
      // a cadeira (ou banqueta) encaixada embaixo da mesa, no chão: a mesa vem por cima dela
      const encaixada = !!def.sit && it.z <= floorH + 0.01 && !!map.mesaDaCasa(it.x, it.y) && !ghost;
      for (const [n, node] of vis.nodes.entries()) {
        const box = m.box(node.b);
        if (def.aumento && def.aumento !== 1) {
          // a mesa maior que a pegada: o contorno (clique e quem se cruza na tela) cresce junto com a arte
          const cx = (box.x0 + box.x1) / 2;
          const cy = (box.y0 + box.y1) / 2;
          const k = def.aumento;
          box.x0 = cx + (box.x0 - cx) * k;
          box.x1 = cx + (box.x1 - cx) * k;
          box.y0 = cy + (box.y0 - cy) * k;
          box.y1 = cy + (box.y1 - cy) * k;
        }
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
          box: ordens[n],
          sob: encaixada,
          sx0: sx0 - 12,
          sx1: sx1 + 12,
          sy0: sy0 - 24,
          sy1: sy1 + 4,
          poly: sil,
          draw: () => {
            painter.m.set(rot, def.width, def.depth, ix, iy, it.z);
            painter.state = estado;
            painter.seed = it.id;
            ctx.globalAlpha = nodeAlpha;
            if (it.quebrado) {
              // destruído: carbonizado (escuro, queimado) e torto, tombando para um lado sobre a base
              ctx.save();
              const [bx, by] = iso(it.x + footprint(def, rot).sx / 2, it.y + footprint(def, rot).sy / 2, it.z);
              const giro = (((it.id * 2654435761) >>> 0) % 2 ? 1 : -1) * (0.05 + (((it.id * 40503) >>> 0) % 5) * 0.012);
              ctx.translate(bx, by);
              ctx.rotate(giro);
              ctx.translate(-bx, -by);
              ctx.filter = 'brightness(0.42) sepia(0.6) saturate(0.55) contrast(1.15)';
              node.draw(painter);
              ctx.restore();
            } else node.draw(painter);
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
        // o encosto do lado da câmera (a cadeira virada para o fundo, rot 0 ou 6): quem senta fica entre o assento e o
        // encosto, então o encosto é redesenhado por cima dela, como na cama (18/10, o Felipe: "coloca esse sentado e
        // depois desenha outro encosto neles"; antes a pessoa saía na frente do encosto, fora da cadeira)
        if (def.sit && !def.deita && !flat && !ghost && (rot === 0 || rot === 6)) {
          const fp = footprint(def, rot);
          const fatia = rot === 0 ? { x0: it.x, x1: it.x + fp.sx, y0: it.y + fp.sy - 0.24, y1: it.y + fp.sy } : { x0: it.x + fp.sx - 0.24, x1: it.x + fp.sx, y0: it.y, y1: it.y + fp.sy };
          const caixa = { ...fatia, z0: it.z, z1: it.z + 1.4 * Z_PER_M };
          const recorte = boxSilhouette(caixa);
          drawables.push({
            box: caixa,
            sx0: d.sx0,
            sx1: d.sx1,
            sy0: d.sy0,
            sy1: d.sy1,
            draw: () => {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(recorte[0][0], recorte[0][1]);
              for (let i = 1; i < recorte.length; i++) ctx.lineTo(recorte[i][0], recorte[i][1]);
              ctx.closePath();
              ctx.clip();
              d.draw();
              ctx.restore();
            },
          });
        }
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
              painter.m.set(rot, def.width, def.depth, ix, iy, it.z);
              painter.state = estado;
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
        lights.push({ x: lx, y: ly, radius: L.radius, color: L.color, intensity: L.intensity * alpha, flicker: L.flicker, kind: L.kind, seed: it.id, movel: it.id, mundo: [wx, wy, m.oz + L.z * Z_PER_M], ...this.semFogo(L) });
      }
      return topZ;
    };

    for (const real of map.allItems()) {
      if (esconde && this.itemOculto(real)) continue;
      // o que alguém largou no chão: a arte pintada do item (a mesma da mochila), deitada na casa
      if (real.defId === PILHA_CHAO && real.loot?.length) {
        const imgs = CODEX_NO_TABULEIRO ? real.loot.slice(0, 3).map((l) => imagemDoMapa(`/arte/itens/pintados/${l.item?.id ?? regrasShared.slug(l.name)}.png`)).filter((x): x is HTMLImageElement => !!x) : [];
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
                // o lado maior do item: 44 (uns 0,8 m perto da pessoa de 94), 34 quando são vários (08/10: eram 72 e 58, do tamanho de gente)
                desenharItemNoChao(ctx, img, px, py, imgs.length > 1 ? 34 : 44, semente);
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
    // as sombras acesas para escolher (ou marcar): por cima da escuridão, para se verem; e as poças do passo pelas sombras
    let sombrasAcesas: (() => void) | null = null;
    if (this.sombraEscolha || this.marcandoSombra) {
      const casas = this.casasDeSombra();
      const pulsa = 0.5 + 0.5 * Math.sin(now / 300);
      const hov = this.hoverTile && this.mouse.inside ? chaveCasa(this.hoverTile.x, this.hoverTile.y) : '';
      sombrasAcesas = () => {
        const quad = (x: number, y: number): [number, number][] => {
          const h = map.floorHeight(x, y) ?? 0;
          return [iso(x, y, h), iso(x + 1, y, h), iso(x + 1, y + 1, h), iso(x, y + 1, h)];
        };
        for (const [k, estado] of casas) {
          const [x, y] = k.split(',').map(Number);
          desenharCasaSombra(ctx, quad(x, y), now, k === hov ? 'mouse' : estado, pulsa);
        }
        if (this.marcandoSombra && hov && !casas.has(hov)) {
          const [x, y] = hov.split(',').map(Number);
          if (map.floorHeight(x, y) !== null) desenharCasaSombra(ctx, quad(x, y), now, 'mouse', pulsa);
        }
      };
    }
    for (const [id, fx] of this.passosSombra) {
      const f = fasePasso(now - fx.t0);
      if (f.acabou) {
        this.passosSombra.delete(id);
        continue;
      }
      chaoPecas.push(() => {
        const [dx, dy] = iso(fx.de.x + 0.5, fx.de.y + 0.5, map.standHeight(fx.de.x, fx.de.y));
        desenharPoca(ctx, dx, dy, f.pocaSaida, now, id);
        const [px, py] = iso(fx.para.x + 0.5, fx.para.y + 0.5, map.standHeight(fx.para.x, fx.para.y));
        desenharPoca(ctx, px, py, f.pocaChegada, now, id + 3);
      });
    }

    // avatares
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      if (oculta(p.x + 0.5, p.y + 0.5)) continue;
      // no passo pelas sombras: afundando, preta; entre as duas sombras, dentro do chão (não se vê nada dela)
      const passoSombra = this.passosSombra.get(u.id);
      const fase = passoSombra ? fasePasso(now - passoSombra.t0) : null;
      if (fase && !fase.visivel) continue;
      const cx = p.x + 0.5;
      const cy = p.y + 0.5;
      const sp = u.look.charId ? sprites.get(u.look.charId) : null;
      // pose do tabuleiro (arte em 32 bits) no estado da peça; sem ela, a folha
      const cdef = sprites.def(u.look.charId);
      const lp = cdef ? sprites.poses(cdef) : null;
      const estado = this.estadoDe?.(u.id) ?? 'desarmado';
      // agachada (17/10): a pose de cócoras desenhada, quando o personagem tem; sem ela, a de pé achatada (mais abaixo)
      const pfAgachado = u.agachado && lp ? agachadoFor(lp, estado.startsWith('armado'), u.dir) : null;
      // sentada numa cadeira (17/10): a pose sentada desenhada (as 4 diagonais), quando tem; na cama, não (lá ela deita)
      const itSentado = u.sit === 1 && !p.moving && !pfAgachado && lp ? map.sitItem(u.x, u.y) : undefined;
      const pfSentado = itSentado && !getFurni(itSentado.defId)?.deita ? agachadoFor(lp!, estado.startsWith('armado'), u.dir, 'sentado') : null;
      const pf = pfAgachado ?? pfSentado ?? (lp ? poseFor(lp, estado, u.dir) : null);
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
      const casas = p.moving && u.anim ? (u.casas ?? 0) + (u.passoLen ?? 1) * Math.min(1, Math.max(0, (now - u.anim.start) / u.anim.ms)) : 0;
      let bq: SpriteFrame | null = null;
      let bpes: PeQuadro[] | null = null;
      // o boneco filmado em 3D (andar completo, parado respirando, sentado, dançando): vale no lugar de tudo
      // (16/10: com as poses paradas das 8 direções, a peça desliza com elas; o boneco animado fica guardado)
      const bc = cdef && !(lp && DESLIZA_COM_A_POSE) ? sprites.boneco(cdef) : null;
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
      const la = !bdir && !(lp && DESLIZA_COM_A_POSE) && cdef ? sprites.anim(cdef) : null;
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
      const passos = lp && p.moving && !pfAgachado ? passosFor(lp, estado, u.dir) : null;
      // folha sem pose de sentar: fica de pé no chão, junto do assento (não em cima dele)
      // (na van não: lá o agente senta no banco mesmo sem a pose de sentar, com as pernas escondidas)
      // na cama: deitada no colchão, no meio da cama, a cabeça para a cabeceira (14/10)
      const camaIt = u.sit === 1 && !p.moving ? map.sitItem(u.x, u.y) : undefined;
      const camaDef = camaIt ? getFurni(camaIt.defId) : undefined;
      const naCama = camaIt && camaDef?.deita ? { it: camaIt, def: camaDef } : null;
      const standBy = !!sp && u.sit === 1 && !p.moving && !naCama && !pfSentado && !framesFor(sp.lc, u.dir, 'sit') && !this.info?.viagem;
      const seated = u.sit === 1 && !standBy && !naCama;
      // sentada no vaso: o corpo vai borrado em mosaico, como no The Sims (17/10, o Felipe: "quero poder usar o chuveiro
      // e o vaso... um blurzinho tipo no The Sims"). No box, o vidro é que embaça do pescoço para baixo (desenharAgua) e
      // a peça fica virada de frente, com a água batendo na cabeça ("não vamos fazer a versão pelada dos personagens")
      const noBox = !p.moving && map.itemsAt(u.x, u.y).some((s) => getFurni(s.defId)?.kind === 'box_chuveiro');
      if (noBox) {
        u.dir = 3;
        u.headDir = 3;
      }
      const privada = !p.moving && u.sit === 1 && map.itemsAt(u.x, u.y).some((s) => getFurni(s.defId)?.kind === 'toilet');
      // a pose sentada desenhada tem os pés no chão (o quadril cai na altura do assento sozinho): fica no piso
      // (em banco alto, o do balcão com 0,75 m ou o de laboratório com 0,70 m, o quadril da pose, feito para o assento de
      // 0,45 m, afundava no banco: sobe o que passa disso; o Felipe, 17/10: "a Agatha tá sentada toda errada")
      const pisoSentado = map.floorHeight(u.x, u.y) ?? p.z;
      const baseZ = standBy ? pisoSentado : pfSentado ? pisoSentado + Math.max(0, p.z - pisoSentado - 0.45 * Z_PER_M) : p.z;
      const half = seated ? 0.25 : 0.3;
      // sentada, os pés ficam à frente do quadril: a âncora (os pés) vai um tanto para a frente, para o quadril cair no
      // meio do assento (18/10, o Felipe: "eles ainda estão posicionados errados na cadeira"; de costas, o quadril
      // ficava na frente do assento, e de frente, atrás dele)
      const [fdx, fdy] = pfSentado ? (DIRS[u.dir] ?? [0, 0]) : [0, 0];
      const [sx, sy] = iso(cx + fdx * PES_A_FRENTE_SENTADO, cy + fdy * PES_A_FRENTE_SENTADO, baseZ);
      // H: a altura na arte; HE: na tela (a arte vem na escala antiga e o tabuleiro reduz)
      const H = bq ? bq.ay : sp ? sp.def.height : pf ? pf.h : PIXEL_AVATAR_HEIGHT;
      const HE = H * ESCALA_ARTE_PESSOA;
      const isSel = sel?.kind === 'user' && sel.id === u.id;
      const pose: Pose = p.moving ? 'walk' : seated || u.sit === 2 ? 'sit' : 'stand';
      const wave = u.waveUntil > now;
      // ~1,75 m de altura para a ordem de desenho
      // deitada na cama: a peça ocupa a cama inteira, em cima do colchão (se não, a cama vem por cima dela na ordem de
      // desenho e ela some atrás da cabeceira ou embaixo do colchão)
      const fpCama = naCama ? footprint(naCama.def, naCama.it.rot) : null;
      const topoCama = naCama ? naCama.it.z + naCama.def.height : 0;
      const box: WBox = naCama && fpCama
        ? { x0: naCama.it.x, x1: naCama.it.x + fpCama.sx, y0: naCama.it.y, y1: naCama.it.y + fpCama.sy, z0: topoCama, z1: topoCama + 0.5 }
        : { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half, z0: baseZ, z1: baseZ + ALTURA_PESSOA };
      const deitada = !!marcas?.deitadas.has(u.id) || !!naCama;
      // embaixo da mesa vazada: abaixada, escondida atrás dela (a mesa vem por cima na ordem de desenho)
      const sob = !deitada && map.sobMesa(Math.round(p.x), Math.round(p.y));
      const fy = u.sit === 2 ? sy - 8 : sy;
      const door = this.door;
      const clip = !!door && (door.seg.wall === 'l' ? cx < door.seg.plane : cy < door.seg.plane);
      // a pose sentada desenhada vai inteira (sem o corte das pernas da pose de pé)
      const sPose = pose === 'sit' ? (pfSentado ? 'stand' : 'sit') : pose;
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
      // parada e em pé, a pose respira: o peito sobe e desce a partir da cintura, cada peça no seu tempo (17/10)
      const respira =
        pf && cdef && pose === 'stand' && !deitada && !sob && !u.agachado && !u.flutua
          ? { b: folegoDaPeca(u.id, this.respiracaoDe?.(u.id) ?? 'calm', estado.startsWith('armado'), now, u.phase), cintura: cdef.height * CINTURA, pescoco: cdef.height * PESCOCO }
          : null;
      // a poeira do passo (deslizando com a pose parada): um sopro no chão a cada contato, embaixo do pé que pisou
      // (um de cada vez), e que fica onde ele pisou enquanto a peça segue
      if (p.moving && pf && !bq && !passos && !u.flutua && !seated && !deitada) {
        const passo = Math.floor(casas * PASSOS_POR_CASA);
        if (u.passoPoeira === undefined) u.passoPoeira = passo;
        else if (passo !== u.passoPoeira) {
          u.passoPoeira = passo;
          const pes = quadro?.pesPontos;
          const [dx, dy] = pes?.length ? pes[passo % pes.length] : [0, 0];
          (u.poeira ??= []).push({ x: sx + dx * ESCALA_ARTE_PESSOA, y: sy + (afunda + dy) * ESCALA_ARTE_PESSOA, t0: now });
        }
      } else delete u.passoPoeira;
      if (u.poeira) {
        u.poeira = u.poeira.filter((d) => now - d.t0 < POEIRA_MS);
        if (!u.poeira.length) delete u.poeira;
      }
      const poeira = u.poeira;
      if (!seated)
        chaoPecas.push(() => {
          if (fase) {
            ctx.save();
            ctx.globalAlpha *= Math.max(0, fase.altura);
          }
          if (clip) {
            ctx.save();
            ctx.clip(door!.path, 'evenodd');
          }
          if (poeira) for (const d of poeira) desenharPoeira(ctx, d.x, d.y, (now - d.t0) / POEIRA_MS, d.t0);
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
            // o boneco em pixel art (o do gerador): a pegada em degraus, como a sombra dos móveis no chão (sem ela o
            // corpo parece flutuar em cima do piso)
            if (!deitada && bpes && bq?.pixel && u.sit !== 2) {
              const abre = Math.max(6, ...bpes.map((pe) => Math.abs(pe[0])));
              desenharPegada(ctx, sx, sy + 1, Math.round(abre + 9), Math.round((abre + 9) * 0.46));
            }
            if (!deitada && bpes && u.sit !== 2)
              for (const [dx, dy, alt] of bpes) {
                const k = Math.max(0.45, 1 - alt / 9);
                // no boneco em pixel art, 1 px acima da sola: a bota tapa a metade de cima e a sombra fica embaixo dela
                const sobe = bq?.pixel ? 1 : 0;
                desenharSombraPes(ctx, sx + Math.round(dx), sy + Math.round(dy) - sobe, Math.round(8 * k), Math.max(2, Math.round(3.5 * k)));
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
            const active = u.id === this.myId || (!this.watchOnly && this.grupo.has(u.id));
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
          if (fase) ctx.restore();
        });
      const chamaDaPeca = chamaDaCriatura(u.criatura?.id, u.chama);
      const d: Drawable = {
        box,
        sob,
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
          // o passo pelas sombras: a peça afunda nos pés (escala vertical até zero) e fica preta, sólida
          if (fase) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.scale(1, Math.max(0.001, fase.altura));
            ctx.translate(-sx, -sy);
            if (fase.preto > 0.01) ctx.filter = `brightness(${(1 - fase.preto).toFixed(3)})`;
          }
          const antes = privada ? this.fotoDaPeca(ctx, sx, sy, HE) : null;
          // a chama fantasmagórica da criatura (chama.ts): atrás do corpo; a ponta quente volta por cima dele, mais abaixo
          const dancaY = u.dance ? -Math.abs(Math.sin((now * Math.PI) / 320 + u.phase)) * 4 : 0;
          const levitaY = u.flutua && !deitada ? 11 + Math.sin(now / 650 + u.phase) * 2.5 : 0;
          const camadasChama =
            chamaDaPeca && quadro
              ? this.chamas.camadas({
                  id: u.id,
                  chama: chamaDaPeca,
                  quadro,
                  x: sx,
                  y: sy + (afunda + dancaY - levitaY) * ESCALA_ARTE_PESSOA,
                  escala: ESCALA_ARTE_PESSOA,
                  escalaY: sob ? 0.62 : u.agachado && !pfAgachado ? 0.72 : 1,
                  ativa: !deitada && !seated && u.sit !== 2,
                  now,
                  fase: u.phase,
                })
              : null;
          if (camadasChama) {
            desenharBrilhoChama(ctx, chamaDaPeca!, sx, sy + (afunda + dancaY - levitaY) * ESCALA_ARTE_PESSOA, camadasChama.h, now, u.phase);
            desenharCamadaChama(ctx, camadasChama, 'tras');
          }
          // a pessoa na escala do tabuleiro, a partir dos pés (de cócoras, mais baixa)
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(ESCALA_ARTE_PESSOA, ESCALA_ARTE_PESSOA * (sob ? 0.62 : u.agachado && !pfAgachado ? 0.72 : 1));
          ctx.translate(-sx, -sy);
          const dance = u.dance ? -Math.abs(Math.sin((now * Math.PI) / 320 + u.phase)) * 4 : 0;
          // flutuando (o Existido, 10/10): o corpo uns 20 cm acima do chão, subindo e descendo devagar; a sombra e o
          // anel ficam no chão (desenhados antes), e é isso que mostra que ele não pisa
          if (u.flutua && !deitada) ctx.translate(0, -(11 + Math.sin(now / 650 + u.phase) * 2.5));
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
          // a pose deitada desenhada (16/10): dormindo na cama, caído no chão (PV 0); sem ela, a de pé é girada
          const dt = deitada && cdef?.deitado ? sprites.deitado(cdef) : null;
          // ferido (machucado, morrendo, caveira): a pose de caído; inteiro, a de dormindo, na cama ou no chão (o Felipe,
          // 17/10: "se o personagem não estiver ferido ele fica na pose de dormindo, não na de morrendo")
          const ferido = estado.endsWith('machucado') || !!marcas?.caveiras.has(u.id);
          const imgDeitado = dt ? (naCama ? (ferido ? (dt.caido ?? dt.dormindo) : (dt.dormindo ?? dt.caido)) : ferido ? (dt.caido ?? dt.dormindo) : (dt.dormindo ?? dt.caido)) : null;
          if (imgDeitado) {
            // a cabeça da imagem vai para cima e para a esquerda; na cama, espelhada até a cabeça ir para a cabeceira
            let [mx, my] = [sx, fy - 2];
            let ex = u.id % 2 ? -1 : 1;
            let ey = 1;
            if (naCama) {
              const fp = footprint(naCama.def, naCama.it.rot);
              [mx, my] = iso(naCama.it.x + fp.sx / 2, naCama.it.y + fp.sy / 2, p.z);
              my -= 3;
              // a cabeça vai para a cabeceira (o fundo da cama), mesmo quando ela fica do lado da câmera (o Felipe, 17/10):
              // visto de cima, quem deita com a cabeça para o nosso lado aparece de cabeça para baixo
              const [hx, hy] = naCama.it.rot === 4 ? [0, -1] : naCama.it.rot === 0 ? [0, 1] : naCama.it.rot === 2 ? [-1, 0] : [1, 0];
              ex = hx - hy < 0 ? 1 : -1;
              ey = hx + hy < 0 ? 1 : -1;
            }
            // o corpo deitado no comprimento da pessoa em pé (1,80 m ao longo da diagonal do piso = a altura na tela)
            // o bicho de quatro patas (a Camarilla, 22/10: "a caída ficou menor que em pé"): o corpo dele deitado é mais
            // comprido que a altura em pé, então a imagem vai na mesma escala da pose em pé (221 px de arte de altura)
            const w = cdef && cdef.height < 70 ? (H * imgDeitado.width) / 221 : H * 1.02;
            const h = (imgDeitado.height / imgDeitado.width) * w;
            ctx.save();
            ctx.translate(mx, my);
            ctx.scale(ex, ey);
            ctx.drawImage(imgDeitado, -w / 2, -h * 0.62, w, h);
            ctx.restore();
          }
          // caída ou inconsciente: a peça deita no chão, com a cabeça para a esquerda
          else if (deitada && naCama) {
            // na cama: o corpo ao longo da cama, os pés no pé e a cabeça na cabeceira (o fundo da peça: a frente é o
            // giro), centrado no colchão
            const fp = footprint(naCama.def, naCama.it.rot);
            const [mx, my] = iso(naCama.it.x + fp.sx / 2, naCama.it.y + fp.sy / 2, p.z);
            const [hx, hy] = naCama.it.rot === 4 ? [0, -1] : naCama.it.rot === 0 ? [0, 1] : naCama.it.rot === 2 ? [-1, 0] : [1, 0];
            const vx = (hx - hy) * 2;
            const vy = hx + hy;
            const n = Math.hypot(vx, vy);
            const ux = vx / n;
            const uy = vy / n;
            const meio = HE * 0.46;
            ctx.save();
            ctx.translate(mx - ux * meio, my - uy * meio - 3);
            ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
            ctx.scale(0.92, 1);
            ctx.translate(-sx, -fy);
          } else if (deitada) {
            ctx.save();
            ctx.translate(sx + H * 0.42, fy - 4);
            ctx.rotate(-Math.PI / 2 + 0.12);
            ctx.scale(0.92, 1);
            ctx.translate(-sx, -fy);
          }
          if (imgDeitado) {
            /* já desenhada */
          } else if (bq) drawBoneco(ctx, bq, sx, fy + dance, sPose === 'sit' && !sentadoReal, 1, luz);
          else if (pf) drawPose(ctx, pf, sx, fy + afunda + dance, now, sPose, 1, passos, andando, luz, casas, respira);
          else if (sp) drawSprite(ctx, sp.def, sp.lc, u.dir, sx, fy + afunda + dance, now, u.phase, sPose, 1, luz);
          else
            drawPixelAvatar(ctx, u.look, sx, fy, u.dir, u.headDir, {
              pose,
              frame: pose === 'walk' ? Math.floor(now / 125) % 4 : u.dance || wave ? Math.floor(now / 220) % 2 : 0,
              wave,
              dance: u.dance,
              blink: (now + u.phase * 997) % 4300 < 140,
            });
          if (deitada && !imgDeitado) ctx.restore();
          if (turning) ctx.restore();
          if (wave && sp) this.drawEmote(sx, fy - H - 14, now);
          ctx.restore();
          if (camadasChama) desenharCamadaChama(ctx, camadasChama, 'frente');
          if (antes) this.mosaicoDaPeca(ctx, antes);
          // a coberta fora da escala da pessoa: na mesma medida da cama, para cair em cima dela
          if (naCama?.it.coberta) this.desenharCoberta(ctx, map, naCama.it, naCama.def);
          if (fase) ctx.restore();
          if (eCela > 0.01) ctx.filter = 'none';
          if (clip) ctx.restore();
        },
      };
      drawables.push(d);
      hitOf.set(d, {
        kind: 'user',
        id: u.id,
        // a área de clique acompanha o desenho (17/10, o Felipe: "tenho que conseguir clicar nos monstros e nos NPCs igual
        // nos Marcados"): a de 32 px de largura só pegava o meio do corpo, e o Deus da Morte, a Camarilla e quem está
        // deitado são largos; o flutuante (o Existido) sobe com o corpo
        test: (() => {
          const meia = Math.max(16, Math.min(22, quadro && quadro.h ? ((quadro.w * (HE / quadro.h)) / 2) * 0.8 : 16));
          if (deitada) return (x: number, y: number) => Math.abs(x - sx) <= Math.max(meia, HE * 0.55) && y >= sy - HE * 0.45 && y <= sy + 12;
          const alto = HE + (u.flutua ? 16 : 0);
          return (x: number, y: number) => Math.abs(x - sx) <= meia && y >= sy - alto && y <= sy + 10;
        })(),
      });
      // a luz da peça desce até as pernas: ilumina o chão em volta junto com o corpo (sem parecer colado por cima)
      lights.push({ x: sx, y: sy - HE * 0.22, radius: 88, color: '#ffe2b8', intensity: u.id === this.myId ? 0.42 : 0.3, kind: 'personal' });
      // a chama também é luz: no escuro ela ilumina a si mesma e o chão em volta, na cor dela (some junto com a chama)
      if (chamaDaPeca && !deitada && !seated)
        lights.push({ x: sx, y: sy - HE * 0.4, radius: 78 + 26 * chamaDaPeca.intensidade, color: chamaDaPeca.cor, intensity: Math.min(0.75, 0.38 + 0.2 * chamaDaPeca.intensidade), flicker: 0.3, seed: u.phase, kind: 'personal' });
    }

    // a neblina densa (o miolo do labirinto): casa a casa, ordenada com a sebe, para ficar DENTRO das paredes
    for (const c of this.fog.casas) {
      const box = this.fog.caixaDaCasa(c);
      const [lx] = iso(c.x, c.y + 1, c.h);
      const [rx] = iso(c.x + 1, c.y, c.h);
      const [, topo] = iso(c.x, c.y, box.z1);
      const [, base] = iso(c.x + 1, c.y + 1, c.h);
      drawables.push({ box, sx0: lx - 30, sx1: rx + 30, sy0: topo - 30, sy1: base + 20, draw: () => this.fog.drawCasa(ctx, c, now) });
    }

    // a chaminé da casa com o fogão a lenha aceso lá dentro (17/10): a fumaça subindo da boca, por cima do telhado
    for (const it of map.allItems()) {
      if (!it.fumaca) continue;
      const def = getFurni(it.defId);
      const ch = def ? chamineDaArte(it.defId, it.id, it.modelo) : null;
      if (!def || !ch) continue;
      // do giro 4 (metros a partir da quina, ao longo da largura e a partir do fundo) para a casa no mundo
      const noMundo = (mx: number, my: number): [number, number] => {
        const [lx, ly] = [mx / M_POR_CASA, my / M_POR_CASA];
        return it.rot === 4 ? [it.x + lx, it.y + ly] : it.rot === 0 ? [it.x + def.width - lx, it.y + def.depth - ly] : it.rot === 2 ? [it.x + ly, it.y + def.width - lx] : [it.x + def.depth - ly, it.y + lx];
      };
      const [wx, wy] = noMundo(ch[0], ch[1]);
      // o buraco da chaminé (~22 cm, dentro da pedra da borda): a beira da frente dele tapa o começo da fumaça, que
      // sai lá de dentro e não de cima da pedra
      const borda = it.z + ch[2] * Z_PER_M;
      const boca = ([[-0.11, -0.11], [0.11, -0.11], [0.11, 0.11], [-0.11, 0.11]] as const).map(([dx, dy]) => {
        const [qx, qy] = noMundo(ch[0] + dx, ch[1] + dy);
        return iso(qx, qy, borda);
      });
      // a fumaça nasce lá dentro, uns 30 cm abaixo da borda
      const z0 = borda - 0.3 * Z_PER_M;
      const [bx, by] = iso(wx, wy, z0);
      drawables.push({
        box: { x0: wx - 0.3, x1: wx + 0.3, y0: wy - 0.3, y1: wy + 0.3, z0, z1: z0 + 3 * Z_PER_M },
        sx0: bx - 60,
        sx1: bx + 60,
        sy0: by - 160,
        sy1: by + 10,
        draw: () => this.desenharFumaca(ctx, wx, wy, z0, it.id, now, boca),
      });
    }

    // o chuveiro ligado (17/10): os fios de água do chuveiro até o ralo, na ordem de profundidade dentro do box; o som da
    // água enquanto um chuveiro do cômodo está aberto, e o vapor quando a porta do banheiro está fechada
    const chuveiros = [...map.allItems()].filter((it) => it.state === 1 && getFurni(it.defId)?.kind === 'box_chuveiro');
    if (chuveiros.length !== 0 !== this.aguaTocando) {
      this.aguaTocando = chuveiros.length !== 0;
      sfx.chuveiro(this.aguaTocando);
    }
    for (const it of chuveiros) {
      // a caixa na quina da frente do box: a água vem depois do vidro e de quem está no banho (cai por cima dela)
      const box: WBox = { x0: it.x + 0.97, x1: it.x + 1.01, y0: it.y + 0.97, y1: it.y + 1.01, z0: it.z, z1: it.z + 1.9 * Z_PER_M };
      const [bx, by] = iso(it.x + 0.5, it.y + 0.5, it.z);
      const dentro = [...this.users.values()].some((o) => !o.anim && o.x === it.x && o.y === it.y);
      drawables.push({ box, sx0: bx - 24, sx1: bx + 24, sy0: by - 120, sy1: by + 10, draw: () => this.desenharAgua(ctx, it, now, dentro) });
    }
    {
      const dt = Math.min(0.1, (now - (this.vaporEm || now)) / 1000);
      this.vaporEm = now;
      const portas = [...map.allItems()].filter((it) => getFurni(it.defId)?.kind === 'portal');
      const fechada = portas.length > 0 && portas.every((it) => it.state !== 0);
      const alvo = chuveiros.length && fechada ? 1 : 0;
      this.vapor += (alvo - this.vapor) * dt * (alvo ? 0.05 : 0.12);
    }

    // a chama em pixel do fogo do cenário (lareira, fogueira, tocha) entra na ordem de profundidade, na caixa dela: quem
    // fica na frente do fogo tapa a chama (antes ela vinha por cima de tudo, na camada das partículas); o brilho fica lá
    if (this.particles.active && this.tat.t < 0.5)
      for (const L of lights) {
        if (L.kind !== 'fire' || !L.mundo) continue;
        L.chamaNaOrdem = true;
        const [mx, my, mz] = L.mundo;
        // a profundidade da chama a partir da quina da frente do móvel dela (na direção da câmera, em metros), para
        // a frente do móvel (a grade da lanterna, a boca da lareira) voltar por cima da chama
        const dono = L.movel !== undefined ? map.getItem(L.movel) : undefined;
        const defDono = dono ? getFurni(dono.defId) : undefined;
        let profChama: number | null = null;
        let caixa: WBox = { x0: mx - 0.3, x1: mx + 0.3, y0: my - 0.3, y1: my + 0.3, z0: mz - 0.35, z1: mz + 0.25 };
        if (dono && defDono) {
          const fp = footprint(defDono, dono.rot);
          const dx = (mx - (dono.x + fp.sx)) * M_POR_CASA;
          const dy = (my - (dono.y + fp.sy)) * M_POR_CASA;
          const dz = (mz - (dono.z ?? 0)) / Z_PER_M;
          profChama = (dx + dy) * Math.cos(Math.PI / 6) * Math.SQRT1_2 + dz * 0.5;
          // na ordem, a chama vem logo depois do móvel dono (na quina da frente dele, depois das faces da frente que ele
          // repinta): o que é dele e fica na frente volta por cima (frenteDoFogo); quem está na frente do móvel a tapa
          const q = 0.03;
          caixa = { x0: dono.x + fp.sx + q, x1: dono.x + fp.sx + 2 * q, y0: dono.y + fp.sy + q, y1: dono.y + fp.sy + 2 * q, z0: dono.z ?? 0, z1: mz };
        }
        drawables.push({
          box: caixa,
          sx0: L.x - 40,
          sx1: L.x + 40,
          sy0: L.y - 60,
          sy1: L.y + 30,
          draw: () => {
            this.particles.chama(ctx, L, now / 1000, 'chama');
            if (profChama !== null && L.movel !== undefined) frenteDoFogo(ctx, L.movel, profChama);
          },
        });
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
    this.luzCasas = {
      luzes: active.map((L) => ({ x: L.x, y: L.y, radius: L.radius, intensity: L.intensity, k: L.mundo && L.mundo[2] < 1 ? 0.62 : 1 })),
      escuro: darkness > 0.01 ? darkness : 0,
    };
    if (darkness > 0.01)
      this.lighting.render(ctx, active, darkness, (x, y) => [(x * z + this.cam.x) * dpr, (y * z + this.cam.y) * dpr], scale, t, this.info.ambient);

    if (sombrasAcesas) {
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      sombrasAcesas();
    }

    // a vida da cena (14/10, em todas as cenas): a chama que mexe e o brilho do fogo, o feixe da janela, a poeira na
    // luz, a fumaça e as brasas (fora da vista tática, que é a planta limpa)
    if (this.particles.active && this.tat.t < 0.5) {
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      this.particles.draw(ctx, now, active, this.info.particleLevel ?? DEFAULT_PARTICLE_LEVEL, darkness);
    }

    // o vapor do banho: o cômodo embaça aos poucos, mais denso em cima (o vapor sobe), com rolos que andam devagar
    if (this.vapor > 0.01 && this.tat.t < 0.5) {
      ctx.setTransform(scale, 0, 0, scale, this.cam.x * dpr, this.cam.y * dpr);
      this.desenharVapor(ctx, map, now);
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

    // ícones de pista (a tela da mesa não mostra). Desligados em 08/10 a pedido do Felipe ("por hora, vamos descartar
    // essas lupinhas sobre os móveis... todos eles"): a pista continua no objeto, no painel dele ao clicar.
    if (this.watchOnly || !MOSTRAR_LUPAS) hintTargets.length = 0;
    for (const h of hintTargets) {
      h.sx = Math.round(h.wx * z + this.cam.x);
      h.sy = Math.round(h.wy * z + this.cam.y + Math.sin(t / 450 + h.id) * 2);
      drawHintIcon(ctx, h.sx, h.sy, h.hint.icon, !h.hint.visible, this.hoverKey === `h${h.kind}${h.id}`);
    }
    this.hintTargets = hintTargets;

    // o nome em cima da peça (ao passar o mouse e na selecionada): desligado em 17/10, a pedido do Felipe ("tira esse
    // nomezinho de cima, nem sempre eu quero que eles saibam os nomes; eu sei quem é quem")
    const hk = this.hoverKey;
    for (const u of MOSTRAR_NOMES ? this.users.values() : []) {
      if (hk !== `user${u.id}` && !(sel?.kind === 'user' && sel.id === u.id)) continue;
      const p = this.userPos(u, now);
      const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
      const H = this.avatarHeight(u);
      this.nameTag(u.name, wx * z + this.cam.x, (wy - H - (u.sit ? -12 : 4)) * z + this.cam.y, u.id === this.myId);
    }

    if (viagem) this.mundoViagem.clima(ctx, viagem, now, this.dpr);
    this.bubbles.draw(ctx, (wx) => wx * z + this.cam.x, this.vw);
    if (viagem?.destino) this.faixaDoDestino(viagem.destino);
    // o retângulo da seleção por área (Ctrl + arrastar)
    const k = this.caixaSel;
    if (k) {
      const x = Math.min(k.x0, k.x1);
      const y = Math.min(k.y0, k.y1);
      const w = Math.abs(k.x1 - k.x0);
      const hh = Math.abs(k.y1 - k.y0);
      ctx.save();
      ctx.fillStyle = 'rgba(226, 166, 74, 0.12)';
      ctx.strokeStyle = 'rgba(255, 210, 122, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(x, y, w, hh);
      ctx.strokeRect(x + 0.5, y + 0.5, w, hh);
      ctx.restore();
    }
  }

  /** Quem está dentro do retângulo (o meio do corpo na tela) vira o grupo: o clique no chão manda todos (19/10). */
  private selecionarNaCaixa(k: { x0: number; y0: number; x1: number; y1: number }) {
    const [x0, x1] = [Math.min(k.x0, k.x1), Math.max(k.x0, k.x1)];
    const [y0, y1] = [Math.min(k.y0, k.y1), Math.max(k.y0, k.y1)];
    const now = performance.now();
    const dentro: number[] = [];
    for (const u of this.users.values()) {
      const p = this.userPos(u, now);
      const [wx, wy] = iso(p.x + 0.5, p.y + 0.5, p.z);
      const sx = wx * this.zoom + this.cam.x;
      const pes = wy * this.zoom + this.cam.y;
      const meio = (wy - this.avatarHeight(u) * 0.5) * this.zoom + this.cam.y;
      if (sx >= x0 && sx <= x1 && ((pes >= y0 && pes <= y1) || (meio >= y0 && meio <= y1))) dentro.push(u.id);
    }
    if (!dentro.length) return;
    this.grupo.clear();
    if (dentro.length > 1) for (const id of dentro) this.grupo.add(id);
    this.myId = dentro[0];
    this.events.grupoMudou?.(this.grupo.size);
    this.select({ kind: 'user', id: this.myId });
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
