import type { AvatarLook } from './avatar';
import type { AcaoCombate, Combate, FichaAmeaca } from './combate/tipos';
import type { RollResult } from './dice';
import type { FloorItem, FloorStyle, Hint, ParticleKind, WallItem } from './room';
import type { LugarInfo } from './lugares';
import type { Criatura } from './bestiario';
import type { Npc } from './npcs';
import type { ViagemInfo } from './viagem';
import type { CampaignState, LootKind } from './rpg';
import type { PapelConta, Role, Session, SessionAction, Token } from './session';
import type { Documento } from './documentos';
import type { FichaSalva } from './fichas';
import type { LugarDescanso } from './regras/interludio';
import type { AcaoNevoa, MarcaMesa, NevoaCena } from './mesa';
import type { TipoItemCatalogo } from './regras/ficha';
import type { VitalKey } from './vitals';
import type { Door } from './walls';
import type { TipoJogoBar } from './bar';

/**
 * Para onde a linha da folha de sprite está virada, na tela. As diagonais são
 * as direções do chão (andar ao longo das casas); s/e/n/w são as retas, usadas
 * quando o personagem anda na diagonal da grade. Folhas de 4 direções só têm
 * as diagonais; as de 8 têm todas.
 */
export type DirKey = 'sw' | 'se' | 'nw' | 'ne' | 's' | 'e' | 'n' | 'w';
/** As 4 diagonais primeiro (folhas de 4 direções), depois as retas. */
export const DIR_KEYS: DirKey[] = ['sw', 'se', 'nw', 'ne', 's', 'e', 'n', 'w'];

/** Direção da peça (0..7, ver Token.dir) → linha da folha que a mostra melhor. */
export const DIR_TO_SHEET: DirKey[] = ['ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'n'];

/** Linha da folha → direção da peça (para pré-visualizar cada linha). */
export const SHEET_TO_DIR: Record<DirKey, number> = { ne: 0, e: 1, se: 2, s: 3, sw: 4, w: 5, nw: 6, n: 7 };

/** Na falta de uma linha, a mais parecida (as retas caem na diagonal vizinha, como nas folhas de 4). */
const DIR_FALLBACK: Record<DirKey, DirKey[]> = {
  e: ['se', 'ne', 'sw', 'nw'],
  s: ['sw', 'se', 'nw', 'ne'],
  w: ['sw', 'nw', 'se', 'ne'],
  n: ['ne', 'nw', 'se', 'sw'],
  se: ['e', 's', 'sw', 'ne', 'nw', 'w', 'n'],
  sw: ['s', 'w', 'se', 'nw', 'ne', 'e', 'n'],
  ne: ['n', 'e', 'nw', 'se', 'sw', 'w', 's'],
  nw: ['w', 'n', 'ne', 'sw', 'se', 'e', 's'],
};

/** Linha da folha para a direção da peça, entre as que a folha tem (null = nenhuma). */
export function sheetDirFor(dir: number, has: (k: DirKey) => boolean): DirKey | null {
  const want = DIR_TO_SHEET[((dir % 8) + 8) % 8];
  if (has(want)) return want;
  return DIR_FALLBACK[want].find(has) ?? null;
}

/** Direções (0..7) que mostram poses diferentes numa folha com essas linhas: 4 ou 8. */
export function distinctFacings(has: (k: DirKey) => boolean): number[] {
  const out = new Set<number>();
  for (let d = 0; d < 8; d++) {
    const k = sheetDirFor(d, has);
    if (k) out.add(SHEET_TO_DIR[k]);
  }
  return [...out].sort((a, b) => a - b);
}

/** Próxima direção girando a peça (cw = sentido horário na tela), só entre as permitidas. */
export function turnFacing(dir: number, cw: boolean, allowed: number[]): number {
  const d = ((dir % 8) + 8) % 8;
  const list = allowed.length ? allowed : [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = 1; i <= 8; i++) {
    const n = (((d + (cw ? i : -i)) % 8) + 8) % 8;
    if (list.includes(n)) return n;
  }
  return d;
}

/** O que se faz com um item da mochila (docs/REGRAS.md, Mochila). */
export type AcaoMochila = 'empunhar' | 'guardar' | 'vestir' | 'tirar' | 'usar' | 'entregar' | 'largar';
export const ACOES_MOCHILA: AcaoMochila[] = ['empunhar', 'guardar', 'vestir', 'tirar', 'usar', 'entregar', 'largar'];

/** Animação de cada linha da folha. */
export type AnimKey = 'idle' | 'walk' | 'sit';
export const ANIM_KEYS: AnimKey[] = ['idle', 'walk', 'sit'];

/**
 * Estado do retrato do personagem (cartas do grupo, na tela do mestre): com ou
 * sem arma, machucado ou não. Cada estado é uma imagem própria, na pasta do
 * personagem: retrato-<estado>.png (e retrato-<estado>-olhos-fechados.png para piscar).
 * O mesmo estado escolhe a pose do personagem no tabuleiro (CharacterDef.poses).
 */
export type PortraitState = 'desarmado' | 'armado' | 'desarmado-machucado' | 'armado-machucado';
export const PORTRAIT_STATES: PortraitState[] = ['desarmado', 'armado', 'desarmado-machucado', 'armado-machucado'];

export function portraitState(armed: boolean, hurt: boolean): PortraitState {
  return `${armed ? 'armado' : 'desarmado'}${hurt ? '-machucado' : ''}` as PortraitState;
}

/** Imagens de um estado do retrato: olhos abertos e (se houver) fechados. */
export interface PortraitArt {
  open: string;
  closed?: string;
}

/** Clima de luz do quarto (controlado pelo mestre). */
export type LightMode = 'normal' | 'flicker' | 'blackout';
export const LIGHT_MODES: LightMode[] = ['normal', 'flicker', 'blackout'];

/** Personagem com sprite sheet enviado por um jogador. */
export interface CharacterDef {
  id: number;
  name: string;
  owner: string;
  /** URL da imagem (ex: /uploads/abc.png) */
  sheet: string;
  cols: number;
  rows: number;
  /** direção de cada linha da folha */
  dirs: DirKey[];
  /** animação de cada linha (padrão: idle) */
  anims?: AnimKey[];
  /** altura na tela, em pixels (zoom 1) */
  height: number;
  fps: number;
  /** ordem dos quadros de idle */
  sequence: number[];
  removeBg: boolean;
  /**
   * Retratos por estado, achados pelo servidor na pasta do personagem
   * (client/public/arte/personagens/<nome>/). Sem eles, o retrato é recortado da folha.
   */
  portraits?: Partial<Record<PortraitState, PortraitArt>>;
  /**
   * Poses do tabuleiro (arte em 32 bits, uma imagem por pose), por estado e
   * direção, achadas pelo servidor em tabuleiro-32bits/ na pasta do personagem:
   * idle-<estado>-<direção>.png (sem a direção, é `se`). Sem elas, o tabuleiro usa a folha.
   */
  poses?: Partial<Record<PortraitState, Partial<Record<DirKey, string>>>>;
  /**
   * Quadros de andar do tabuleiro, por estado e direção, achados na mesma
   * pasta: andar-<estado>-<direção>-<n>.png (n = 1, 2, 3..., em ordem). Com o
   * mesmo tamanho e os pés no mesmo ponto da pose parada da direção. Sem eles,
   * a pose parada desliza com um balanço.
   */
  passos?: Partial<Record<PortraitState, Partial<Record<DirKey, string[]>>>>;
  /**
   * O boneco animado do tabuleiro (parado respirando e andando, nas 8 direções),
   * gerado por scripts/boneco.py e achado pelo servidor em tabuleiro-32bits/anim.json.
   * Quando tem, vale no lugar de `poses` e `passos`.
   */
  anim?: AnimTabuleiro;
  /**
   * O boneco filmado em 3D (docs/PERSONAGENS-3D.md): várias animações por estado e
   * direção, achadas pelo servidor em tabuleiro-3d/anim.json. Quando tem, vale no lugar de `anim`.
   */
  boneco?: BonecoTabuleiro;
}

/**
 * Uma animação do boneco numa direção: a tira (os quadros lado a lado), o tamanho de cada
 * quadro e a âncora (o chão embaixo do corpo), em pixels da arte, e como tocar.
 */
export interface BonecoClipe {
  url: string;
  quadros: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** volta ao começo quando acaba (parado, andar) ou toca uma vez (pegar, cair) */
  laco: boolean;
  /** quanto dura cada quadro */
  ms?: number;
  /** andar: quantas casas um ciclo anda (o quadro vem da distância, e o pé fica no chão) */
  casasPorCiclo?: number;
  /** andar: a fase do ciclo no meio da casa */
  fase?: number;
  /** uma vez: fica no último quadro (caído) */
  segura?: boolean;
  /** os pés em cada quadro, em pixels da tela no zoom 1, a partir da âncora */
  pes: PeQuadro[][];
}

/** O boneco filmado em 3D: `escala` = pixels da tela (zoom 1) por pixel da arte. */
export interface BonecoTabuleiro {
  versao: 2;
  escala: number;
  estados: Partial<Record<PortraitState, Partial<Record<DirKey, Record<string, BonecoClipe>>>>>;
}

/** Um pé num quadro: [dx, dy, altura no ar], em pixels, a partir da âncora (o chão embaixo do corpo). */
export type PeQuadro = [number, number, number];

/** Uma tira de quadros lado a lado; com olhos, a segunda linha é igual de olhos fechados. */
export interface AnimTira {
  url: string;
  quadros: number;
}

/** Uma direção do boneco: o tamanho do quadro, a âncora, as duas tiras e onde ficam os pés em cada quadro. */
export interface AnimDirecao {
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** a direção mostra os olhos: as tiras têm a linha de olhos fechados (para piscar) */
  olhos: boolean;
  parado: AnimTira;
  andar: AnimTira;
  pesParado: PeQuadro[][];
  pesAndar: PeQuadro[][];
  /** a fase do andar no meio da casa só desta direção (o andar desenhado pode começar o ciclo em outro ponto) */
  faseAndar?: number;
}

/** O boneco animado do tabuleiro (anim.json, gerado por scripts/boneco.py). */
export interface AnimTabuleiro {
  versao: 1;
  /** quanto dura cada quadro parado (a respiração) */
  msParado: number;
  /** a fase do ciclo de andar (0..1, um ciclo por casa) quando a peça está no meio da casa: a passagem */
  faseAndar: number;
  estados: Partial<Record<PortraitState, Partial<Record<DirKey, AnimDirecao>>>>;
}

export type CharacterPatch = Partial<Pick<CharacterDef, 'name' | 'cols' | 'rows' | 'dirs' | 'anims' | 'height' | 'fps' | 'sequence' | 'removeBg'>>;

export function sanitizeCharPatch(p: unknown): CharacterPatch {
  const out: CharacterPatch = {};
  if (!p || typeof p !== 'object') return out;
  const o = p as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
  if (typeof o.name === 'string') {
    const n = o.name.trim().slice(0, 24);
    if (n.length >= 2) out.name = n;
  }
  const cols = int(o.cols, 1, 16);
  if (cols) out.cols = cols;
  const rows = int(o.rows, 1, 8);
  if (rows) out.rows = rows;
  if (Array.isArray(o.dirs) && o.dirs.length <= 8 && o.dirs.every((d) => DIR_KEYS.includes(d as DirKey)))
    out.dirs = o.dirs as DirKey[];
  if (Array.isArray(o.anims) && o.anims.length <= 8 && o.anims.every((a) => ANIM_KEYS.includes(a as AnimKey)))
    out.anims = o.anims as AnimKey[];
  const height = int(o.height, 40, 260);
  if (height) out.height = height;
  const fps = int(o.fps, 1, 24);
  if (fps) out.fps = fps;
  if (Array.isArray(o.sequence) && o.sequence.length >= 1 && o.sequence.length <= 32 && o.sequence.every((n) => int(n, 0, 15) !== undefined))
    out.sequence = o.sequence as number[];
  if (typeof o.removeBg === 'boolean') out.removeBg = o.removeBg;
  return out;
}

export interface UserStatus {
  id: number;
  x: number;
  y: number;
  z: number;
  dir: number;
  headDir: number;
  /** 0 em pé, 1 sentado em mobi, 2 sentado no chão */
  sit: 0 | 1 | 2;
  dance: boolean;
  /** próximo tile (andando); ms: quanto o passo leva (a diagonal, mais; sem ele, TICK_MS) */
  mv?: { x: number; y: number; z: number; ms?: number };
}

export interface UserInfo extends UserStatus {
  name: string;
  look: AvatarLook;
  /** cor da peça (anel/retrato) */
  color?: string;
  /** de cócoras (furtivo, atrás de um móvel): o corpo tem 1,0 m e não 1,8 m para a cobertura */
  agachado?: boolean;
  /** na cama de cima do beliche (a de baixo é a de sempre) */
  alto?: boolean;
  /** flutua (a criatura que anda sem tocar o chão, como o Existido) */
  flutua?: boolean;
  /** a peça é uma criatura do bestiário: qual e com que aparência */
  criatura?: { id: string; aparencia: string };
}

export interface RoomSummary {
  id: number;
  name: string;
  description: string;
  owner: string;
  users: number;
}

export interface RoomInfo {
  id: number;
  name: string;
  description: string;
  owner: string;
  heightmap: string;
  door: Door;
  darkness: number;
  lightMode: LightMode;
  /** densidade da névoa 0..1 */
  fog: number;
  publicBuild: boolean;
  /** andar do cômodo ("Térreo", "Subsolo"); sem nome = o único andar */
  floor?: string;
  /** área do cômodo ("Área técnica"), na plaquinha do cartão da sala */
  area?: string;
  /** piso do cômodo */
  floorStyle?: FloorStyle;
  /** ao ar livre: sem paredes, sem teto (fazenda, estrada, praça) */
  aberto?: boolean;
  /** chão casa por casa, ao ar livre (letras de TERRENOS, linhas como a planta) */
  terreno?: string;
  /** cor do ambiente (#rrggbb): tinge a escuridão e o ar do cômodo */
  ambient?: string;
  /** partículas do cômodo */
  particles?: ParticleKind[];
  /** quantidade de partículas 0..1 (clima da cena; sem valor = DEFAULT_PARTICLE_LEVEL) */
  particleLevel?: number;
  /** vista tática: a câmera do tabuleiro em cima, como um mapa de batalha (o mestre liga; a mesa acompanha) */
  tatico?: boolean;
  /** o quarto (de hotel, de pousada): a condição do descanso de quem dorme aqui no interlúdio (LR p. 92) */
  descanso?: LugarDescanso;
  /** Santo Berço: não há fogo; o que seria fogo (lareira, forja, vela, lampião) é a luz dos cristais vermelhos */
  luzDeCristal?: boolean;
  /** a névoa revelada aos poucos (docs/FERRAMENTAS-DA-MESA.md): sem ela, a mesa vê a cena inteira */
  nevoa?: NevoaCena;
  /** mapa improvisado: a imagem que o mestre subiu, deitada no chão inteiro da cena */
  mapa?: string;
  /** a Viagem: a van parada na tela e o mundo passando */
  viagem?: ViagemInfo;
  /** o cliente atual pode construir/editar */
  canBuild: boolean;
  /** o cliente atual é o dono (mestre) */
  isOwner: boolean;
}

/** Uma cena (quarto) do minimapa: planta, passagens e quem está nela. */
export interface SceneInfo {
  id: number;
  name: string;
  /** andar ("Térreo", "Subsolo"): a planta mostra um andar por vez */
  floor?: string;
  heightmap: string;
  door: Door;
  portals: { x: number; y: number; link: number }[];
  /** o texto do lugar (Configurar cena), para o cartão do minimapa */
  descricao?: string;
  users: { id: number; name: string; x: number; y: number }[];
  /** o piso do cômodo: a planta pinta o cômodo na cor dele (ladrilho, carpete, taco...) */
  estilo?: FloorStyle;
  /** a Viagem (a van): fora da planta */
  viagem?: boolean;
  /** o quarto (de hotel, de pousada): a condição do descanso de quem dorme nele (LR p. 92) */
  descanso?: LugarDescanso;
  /** ao ar livre: a planta desenha o terreno (grama, estrada, água) no lugar da pedra */
  aberto?: boolean;
  terreno?: string;
  /**
   * os prédios do lugar (casas que ocupam e o nome), para a planta de quem está ao ar livre:
   * `kind` é o desenho do mobi (casarao, celeiro...) e `entra`, a cena que a entrada dele abre
   */
  marcos?: { x: number; y: number; w: number; h: number; nome: string; kind?: string; entra?: number }[];
  /** o resto do que está no chão ao ar livre, para o minimapa desenhar: [kind, x, y, w, h] */
  simbolos?: [string, number, number, number, number][];
}

export interface InvItem {
  id: number;
  defId: string;
}

export type ChatKind = 'say' | 'shout' | 'roll' | 'system';

export type ClientMsg =
  /**
   * Mestre: o computador do servidor, ou quem manda a chave do link do mestre
   * (gmKey). mesa = tela da mesa, que sempre entra como jogador.
   */
  | { t: 'login'; name: string; look: AvatarLook; gmKey?: string; mesa?: boolean; fichaKey?: string; sessao?: string }
  /**
   * Contas da plataforma (a tela de entrada): e-mail e senha. A primeira conta, ou a criada no
   * computador do servidor, é de mestre; as outras, de jogador. A resposta é a mensagem `conta`.
   */
  | { t: 'contaCriar'; nome: string; email: string; senha: string }
  | { t: 'contaEntrar'; email: string; senha: string }
  /** sair: a sessão deste aparelho deixa de valer */
  | { t: 'contaSair'; sessao: string }
  /** ações da sessão (contrato em session.ts); só o mestre */
  | { t: 'act'; a: SessionAction }
  | { t: 'rooms' }
  | { t: 'createRoom'; name: string; model: string }
  | { t: 'join'; roomId: number }
  | { t: 'peek'; roomId: number }
  | { t: 'walk'; x: number; y: number }
  | { t: 'lookAt'; x: number; y: number }
  | { t: 'chat'; text: string; shout?: boolean }
  | { t: 'action'; action: 'wave' | 'dance' | 'sit' | 'stand' }
  | { t: 'look'; look: AvatarLook }
  | { t: 'place'; defId?: string; invId?: number; x: number; y: number; rot: number }
  | { t: 'placeWall'; defId?: string; invId?: number; wall: 'l' | 'r'; plane: number; pos: number; z: number }
  | { t: 'moveItem'; id: number; x: number; y: number; rot: number }
  | { t: 'moveWallItem'; id: number; wall: 'l' | 'r'; plane: number; pos: number; z: number }
  | { t: 'pickup'; id: number }
  /** muda o tamanho do desenho de um quadro (parede) ou de um tapete (chão): de 0,5 a 3 */
  | { t: 'resizeItem'; id: number; escala: number }
  /** destruir ou consertar um móvel (o mestre): ver `FloorItem.quebrado` */
  | { t: 'quebrarItem'; id: number; quebrado: boolean }
  /** troca o móvel por outro do catálogo, no mesmo lugar (e no mesmo giro, se der) */
  | { t: 'swapItem'; id: number; defId: string }
  | { t: 'use'; id: number }
  /**
   * os jogos do bar (só o mestre): a peça vai até o fliperama, o alvo de dardos ou a sinuca e o jogo
   * abre no celular de quem joga com ela (peça sem ficha = um NPC: o mestre joga na tela dele); de
   * novo, com a mesma peça, ela sai do jogo
   */
  | { t: 'barJogar'; tokenId: number; itemId: number }
  /** sair da mesa do bar (o jogador, ou o mestre pelo NPC do `lugar`); `recorde` = o melhor da vez */
  | { t: 'barSair'; mesa: number; lugar?: number; recorde?: { jogo: string; pontos: number } }
  /** uma jogada para os outros da mesa (o mestre diz de qual lugar de NPC); `registrar` = guardar para quem reconectar */
  | { t: 'barJogo'; mesa: number; de?: number; dados: Record<string, unknown>; registrar?: boolean }
  | { t: 'setHint'; id: number; hint: Hint | null }
  | { t: 'roomSettings'; name: string; description: string; darkness: number; publicBuild: boolean; floor?: string; area?: string; floorStyle?: FloorStyle; ambient?: string | null; particles?: ParticleKind[] }
  /** senha de um mobi com fechadura: certa = ele desliza e abre a passagem */
  | { t: 'unlock'; id: number; code: string }
  /** fecha a passagem de novo (o mobi volta para o lugar) */
  | { t: 'relock'; id: number }
  /** cria (id 0) ou atualiza uma ficha (só o mestre) */
  | { t: 'fichaSalvar'; ficha: FichaSalva }
  /** mexe num item da mochila (só o mestre): mão, roupa, usar, entregar a outra ficha ou largar no chão */
  | { t: 'mochila'; fichaId: number; uid: number; acao: AcaoMochila; para?: number; trocar?: boolean }
  /** item do catálogo novo na mochila (só o mestre): requisitado à Ordem, conta na patente */
  | { t: 'mochilaNova'; fichaId: number; tipo: TipoItemCatalogo; id: string; escolha?: { pericia?: string; elemento?: string } }
  /** o interlúdio (só o mestre; LR p. 92–93): o lugar e as ações de cada ficha; o servidor aplica tudo */
  | { t: 'interludio'; lugar: string; escolhas: { fichaId: number; acoes: string[]; prato?: string }[] }
  /** gasta (delta −1) ou zera (fim da missão) os +1d6 guardados de uma ficha */
  | { t: 'bonusInterludio'; fichaId: number; tipo: 'exercicio' | 'leitura' | 'todos'; delta: number }
  /** põe ou tira uma modificação ou maldição de um item da mochila (só o mestre; LR p. 60 e 144) */
  | { t: 'mochilaMelhorar'; fichaId: number; uid: number; tipo: 'modificacao' | 'maldicao'; id: string; por: boolean }
  | { t: 'fichaApagar'; id: number }
  /** documentos da investigação (docs/TELA-DO-JOGADOR.md): o mestre cria, muda e apaga */
  | { t: 'docSalvar'; doc: Documento }
  | { t: 'docApagar'; id: number }
  /** o jogador marca um documento dele, ou passa para a equipe */
  | { t: 'docMarcar'; id: number; marcado: boolean }
  | { t: 'docEquipe'; id: number }
  /** gera (ou troca) o link do jogador para a ficha (só o mestre) */
  | { t: 'fichaLink'; id: number }
  /** combate da campanha da cena atual (só o mestre; docs/COMBATE.md) */
  | { t: 'combate'; a: AcaoCombate }
  /** ficha rápida de uma ameaça (peça), preenchida pelo mestre; null apaga */
  | { t: 'ameaca'; tokenId: number; ficha: FichaAmeaca | null }
  /** o bestiário (só o mestre): pedir a lista, gravar ou apagar uma criatura, pôr N peças dela na cena, trocar a cara de uma peça */
  | { t: 'bestiario' }
  | { t: 'criaturaSalvar'; criatura: Criatura }
  | { t: 'criaturaApagar'; id: string }
  | { t: 'criaturaColocar'; criaturaId: string; aparencia: string; quantidade: number }
  | { t: 'pecaAparencia'; tokenId: number; aparencia: string }
  /** os NPCs do mestre (16/10): gravar, apagar e pôr um na cena */
  | { t: 'npcSalvar'; npc: Npc }
  | { t: 'npcApagar'; id: string }
  | { t: 'npcColocar'; npcId: string }
  | { t: 'roomFx'; lightMode?: LightMode; fog?: number; darkness?: number; particleLevel?: number; tatico?: boolean }
  /** ponto de atenção ou desenho rápido para a mesa (só o mestre; some sozinho) */
  | { t: 'marca'; marca: MarcaMesa }
  /** a névoa revelada aos poucos da cena (só o mestre) */
  | ({ t: 'nevoa' } & AcaoNevoa)
  /**
   * mapa improvisado (só o mestre): a imagem enviada (`/api/mapas`) vira uma cena ao ar livre de
   * largura × altura casas, ligada à cena atual por uma Entrada; `levar` leva os agentes da cena atual
   */
  | { t: 'mapaImprovisado'; nome: string; url: string; largura: number; altura: number; levar?: boolean }
  /** apaga um mapa improvisado (só o mestre): quem estava nele volta para a cena ligada */
  | { t: 'mapaApagar'; roomId: number }
  /**
   * a Viagem (só o mestre): `iniciar` leva os agentes (cada um no banco que o mestre escolheu) para a van;
   * `ajustar` muda o cenário, a hora, a velocidade e o destino; `chegar` leva todos à cena escolhida e a viagem acaba.
   */
  | { t: 'viagem'; acao: 'iniciar'; bancos: { tokenId: number; banco: number }[]; cenario?: string; hora?: string; clima?: string; velocidade?: number; destino?: string; destinoId?: number }
  | { t: 'viagem'; acao: 'ajustar'; cenario?: string; hora?: string; clima?: string; velocidade?: number; destino?: string; destinoId?: number | null; ilustracao?: string }
  | { t: 'viagem'; acao: 'chegar'; roomId: number }
  /** o mapa-múndi: a lista dos lugares; o mestre arrasta um ícone para outro ponto do mapa */
  | { t: 'lugares' }
  | { t: 'lugarMover'; id: number; x: number; y: number }
  /**
   * o minimapa: as peças vão para a cena. Sem `tokens`, todos os agentes da campanha; com
   * `tokens`, só essas (o grupo dividido, ou a peça arrastada). `entrar` (padrão sim): o
   * mestre e a mesa vão junto.
   */
  | { t: 'grupoPara'; roomId: number; tokens?: number[]; entrar?: boolean }
  /** o minimapa: o mestre marca a cena como visitada ou não (`roomId` sem valor = todas da campanha) */
  | { t: 'visitada'; roomId?: number; campanha?: number; visitada: boolean }
  | { t: 'setLink'; id: number; roomId: number | null }
  | { t: 'sendTo'; userId: number | 'all'; roomId: number }
  | { t: 'tokenAdd'; name: string; look: AvatarLook; color?: string; capacity?: number }
  /** armed/hurt = estado do retrato (com arma, machucado) */
  | { t: 'tokenEdit'; tokenId: number; name?: string; look?: AvatarLook; color?: string; capacity?: number; armed?: boolean; hurt?: boolean; agachado?: boolean; alto?: boolean }
  | { t: 'tokenRemove'; tokenId: number }
  | { t: 'tokenWalk'; tokenId: number; x: number; y: number }
  | { t: 'tokenFace'; tokenId: number; dir: number }
  /** PV/PE/SAN da peça: delta soma ao atual, value troca o atual, max troca o total */
  | { t: 'vitals'; tokenId: number; key: VitalKey; delta?: number; value?: number; max?: number }
  | { t: 'tokenScene'; tokenId: number; roomId: number }
  /** item novo num mobi; `item` = do catálogo (a faca vira arma de verdade) */
  | { t: 'lootAdd'; itemId: number; name: string; espacos: number; kind: LootKind; item?: { tipo: TipoItemCatalogo; id: string }; qtd?: number; descricao?: string }
  | { t: 'lootRemove'; itemId: number; lootId: number }
  | { t: 'lootGive'; itemId: number; lootId: number; to: string | null }
  | { t: 'lootReveal'; itemId: number; lootId: number; revealed: boolean }
  | { t: 'actionAdd'; itemId: number; label: string; dt: number }
  | { t: 'actionRemove'; itemId: number; actionId: number }
  | { t: 'actionLog'; itemId: number; actionId: number; player: string; success: boolean; value?: number }
  | { t: 'objAdd'; text: string }
  | { t: 'objToggle'; id: number }
  | { t: 'objRemove'; id: number }
  | { t: 'campaignSet'; title: string; subtitle: string; operacao?: string }
  | { t: 'layoutSet'; roomId: number; x: number; y: number }
  /** anotação na planta: sem id cria; com id muda o texto ou a posição; apagar (ou texto vazio) tira */
  | { t: 'planNota'; id?: number; andar?: string; texto?: string; x?: number; y?: number; apagar?: boolean }
  | { t: 'capacitySet'; name: string; capacity: number }
  | { t: 'floorPlan'; heightmap: string; door: Door }
  | { t: 'charUpdate'; id: number; patch: CharacterPatch }
  | { t: 'charDelete'; id: number };

export type ServerMsg =
  /** a tela da viagem: a pintura que aparece para todos na partida e na chegada (com o som do carro) */
  | { t: 'viagemTela'; fase: 'partida' | 'chegada'; ilustracao: string; texto: string; reserva?: string }
  | { t: 'hello'; characters: CharacterDef[] }
  | { t: 'welcome'; id: number; name: string; look: AvatarLook; token: string; inventory: InvItem[]; home?: number; role: Role }
  /**
   * Resposta da conta. ok: a sessão (guardada no aparelho e mandada no login), o nome, o papel e,
   * para o jogador com a ficha ligada, a chave da ficha. Sem ok: o motivo (expirou = a sessão
   * guardada não vale mais).
   */
  | { t: 'conta'; ok: true; sessao: string; nome: string; papel: PapelConta; fichaKey?: string }
  | { t: 'conta'; ok: false; erro: string; expirou?: boolean }
  | { t: 'error'; msg: string }
  | { t: 'notice'; msg: string }
  /**
   * a mesa do bar de que você faz parte: o jogo, quem joga em cada lugar (npc = o mestre joga), os seus
   * lugares e as jogadas guardadas desde o começo da partida (para quem reconecta)
   */
  | { t: 'bar'; mesa: number; tipo: TipoJogoBar; jogadores: string[]; npc: boolean[]; eu: number[]; log: Record<string, unknown>[] }
  /** você saiu da mesa (ou o mestre chamou de volta) */
  | { t: 'barFechar'; mesa: number; aviso?: string }
  /** a jogada de outro lugar da mesa */
  | { t: 'barJogo'; mesa: number; de: number; dados: Record<string, unknown> }
  | { t: 'roomList'; rooms: RoomSummary[] }
  | { t: 'lugares'; lugares: LugarInfo[] }
  | { t: 'roomCreated'; id: number }
  | { t: 'roomEnter'; room: RoomInfo; items: FloorItem[]; wallItems: WallItem[]; users: UserInfo[] }
  /** conteúdo de outra cena da campanha (miniatura), sem entrar nela */
  | { t: 'peek'; room: RoomInfo; items: FloorItem[]; wallItems: WallItem[] }
  | { t: 'roomUpdate'; room: RoomInfo }
  /** ponto de atenção ou desenho do mestre, para todos que olham a cena */
  | { t: 'marca'; marca: MarcaMesa }
  | { t: 'userJoin'; user: UserInfo }
  | { t: 'userLeave'; id: number }
  /** a peça atravessou uma passagem para outra cena (quem a comanda vai junto) */
  | { t: 'tokenTravel'; tokenId: number; roomId: number }
  | { t: 'userLook'; id: number; look: AvatarLook }
  | { t: 'status'; updates: UserStatus[] }
  | { t: 'chat'; id: number; name: string; text: string; kind: ChatKind; roll?: RollResult }
  | { t: 'action'; id: number; action: 'wave' }
  | { t: 'itemAdd'; item: FloorItem }
  | { t: 'itemUpdate'; item: FloorItem }
  | { t: 'itemRemove'; id: number }
  | { t: 'wallAdd'; item: WallItem }
  | { t: 'wallUpdate'; item: WallItem }
  | { t: 'wallRemove'; id: number }
  | { t: 'inventory'; items: InvItem[] }
  | { t: 'characters'; list: CharacterDef[] }
  | { t: 'scenes'; scenes: SceneInfo[] }
  | { t: 'campaign'; state: CampaignState }
  /** estado completo da sessão (reenviado quando muda) */
  | { t: 'session'; session: Session }
  /** peças que se mexeram neste passo (a cada TOKEN_STEP_MS) */
  | { t: 'tokens'; sceneId: number; tokens: Token[] }
  /** ação recusada pelo servidor */
  | { t: 'denied'; action: string; reason: string }
  /** resposta à senha digitada (só para quem digitou) */
  | { t: 'lockResult'; id: number; ok: boolean; reason?: string }
  /** todas as fichas (só para o mestre); `nova` = id da ficha que acabou de ser criada */
  | { t: 'fichas'; fichas: FichaSalva[]; nova?: number; equipe?: { id: number; nome: string }[] }
  /** os documentos: todos para o mestre, os da ficha para o jogador */
  | { t: 'docs'; docs: Documento[] }
  /** combate da campanha (a mesa recebe só a ordem, a rodada e a vez); null = sem combate */
  | { t: 'combate'; combate: Combate | null; podeDesfazer?: boolean; ameacas?: Record<string, FichaAmeaca> }
  /** o bestiário inteiro (para o mestre) */
  | { t: 'bestiario'; criaturas: Criatura[]; npcs?: Npc[] };
