import crypto from 'node:crypto';
import {
  HORAS_VIAGEM,
  type ViagemInfo,
  directionTo,
  evalRoll,
  findPath,
  footprint,
  getFurni,
  getWallFurni,
  anyFurniName,
  applyVital,
  espacosDoItemFicha,
  kindDoItem,
  noCatalogo,
  PILHA_CHAO,
  regras,
  DEFAULT_VITALS,
  HINT_ICONS,
  isFloorStyle,
  isHexColor,
  LIGHT_MODES,
  sanitizeParticles,
  lootKindLabel,
  sanitizeLook,
  sanitizeLootInput,
  MAX_CHAT,
  MAX_TOKEN_NAME,
  parseRoll,
  RoomMap,
  sceneGrid,
  sceneShortName,
  TICK_MS,
  tileCenter,
  tilesByDistance,
  tileToPoint,
  validateHeightmap,
  sanitizeVitals,
  VITAL_KEYS,
  casasEmVolta,
  MAX_CASAS_PINCEL,
  NEVOA_RAIO_MAX,
  NEVOA_RAIO_PADRAO,
  nevoaNova,
  nevoaServe,
  pintarNevoa,
  sanitizeMarca,
  type NevoaCena,
  type AvatarLook,
  type Door,
  type FloorItem,
  type Hint,
  type InvItem,
  type Item,
  type LightMode,
  type LogIcon,
  type Loot,
  type NormPoint,
  type Point,
  type Role,
  type RoomInfo,
  type Scene,
  type SceneGrid,
  type SceneObject,
  type ServerMsg,
  type Tile,
  type Token,
  type UserInfo,
  type UserStatus,
  type VitalKey,
  type Vitals,
  type WallItem,
} from '@crona/shared';
import type { RoomData, TokenData } from './db';
import { SYSTEM_OWNER } from './seed';

export interface Client {
  id: number;
  name: string | null;
  key: string;
  look: AvatarLook;
  token: string;
  room: RoomInstance | null;
  lastChat: number;
  /** último minimapa enviado (evita reenviar igual) */
  lastScenes?: string;
  /** última sessão enviada (evita reenviar igual) */
  lastSession?: string;
  /** último estado do combate enviado (evita reenviar igual) */
  lastCombate?: string;
  /** mestre ou jogador (peças não têm) */
  role?: Role;
  /** conexão do próprio computador do servidor */
  local?: boolean;
  /** jogador que entrou pelo link da própria ficha (`?ficha=CHAVE`) */
  fichaId?: number;
  /** conta da plataforma com que entrou (tela de entrada) */
  contaId?: number;
  /** senhas erradas seguidas nesta conexão, e até quando ela espera depois de muitas */
  falhasConta?: number;
  esperaConta?: number;
  send(msg: ServerMsg): void;
  /** encerra esta conexão (sessão aberta em outra aba) */
  kick?(): void;
}

export interface HotelApi {
  /** false nos testes: nada roda sozinho, o teste chama step() */
  readonly timers: boolean;
  save(): void;
  nextItemId(): number;
  inventory(client: Client): InvItem[];
  sendInventory(client: Client): void;
  roomChanged(): void;
  /** leva o cliente para outro quarto (Passagem) */
  teleport(client: Client, roomId: number, fromRoomId: number): void;
  /** leva uma peça para outra cena */
  moveToken(from: RoomInstance, tokenId: number, toRoomId: number): void;
  roomExists(roomId: number): boolean;
  /** registra em "Últimas ações" da campanha deste quarto */
  log(roomId: number, icon: LogIcon, text: string): void;
  /** estado da campanha mudou: reenvia logo */
  touch(): void;
  /** já existe outra peça com esse nome nesta sessão? */
  tokenNameTaken(roomId: number, name: string, exceptTokenId?: number): boolean;
  /** personagem renomeado: os itens com ele passam para o nome novo (em toda a sessão) */
  renameHolder(roomId: number, oldName: string, newName: string): void;
  /** PV/PE/SAN mudou: vai para "Últimas ações" (juntando cliques seguidos) */
  vitalChanged(roomId: number, tokenId: number, name: string, key: VitalKey, from: number, to: number, max: number): void;
  /** PV/PE/SAN de uma peça mudou: a ficha ligada ao personagem acompanha */
  vitaisDaPeca(personagem: number | null | undefined, v: Vitals): void;
  /** o + e o − do painel PLAYERS para uma peça que está em outra cena da campanha */
  vitalEmOutraCena(roomId: number, userId: number, m: Record<string, unknown>): void;
  /** peça nova (ou com outra folha): sem PV/PE/SAN, pega os da ficha ligada ao personagem */
  vitaisDaFicha(personagem: number | null | undefined): void;
  /** item do cenário entregue a uma peça: com ficha, vai para a mochila. true = levou; texto = por que não */
  pegarItem(roomId: number, nome: string, loot: Loot, quem: string, deOnde: string): boolean | string;
  /** Armado de uma peça com ficha: empunha ou guarda a arma na mochila. true = a ficha cuidou */
  armarPelaPeca(personagem: number | null | undefined, armado: boolean, c: Client): boolean;
  /** a peça é de um agente (o personagem tem ficha): a névoa abre em volta dela */
  ehAgente(personagem: number | null | undefined): boolean;
}

interface RoomUser {
  client: Client;
  x: number;
  y: number;
  z: number;
  dir: number;
  headDir: number;
  goal: Point | null;
  next: Point | null;
  sit: 0 | 1 | 2;
  dance: boolean;
  dirty: boolean;
  headResetAt: number;
  /** chegou por esta passagem: não teleporta até sair do tile */
  arrivedAt: Point | null;
  /** cor, limite de carga, estado do retrato e ficha (PV/PE/SAN) da peça */
  meta?: { color?: string; capacity?: number; armed?: boolean; hurt?: boolean; agachado?: boolean; alto?: boolean; vitals?: Vitals };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clean = (s: string, max: number) =>
  s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

export function sanitizeHint(h: unknown): Hint | null {
  if (!h || typeof h !== 'object') return null;
  const o = h as Record<string, unknown>;
  if (!HINT_ICONS.includes(o.icon as Hint['icon'])) return null;
  const title = typeof o.title === 'string' ? clean(o.title, 60) : '';
  const text = typeof o.text === 'string' ? o.text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, 1200) : '';
  return { icon: o.icon as Hint['icon'], title, text, visible: o.visible !== false };
}

/** Cliente "de mentira" que representa uma peça no tabuleiro (não recebe mensagens). */
function tokenClient(t: TokenData, room: RoomInstance): Client {
  return { id: -t.id, name: t.name, key: `token:${t.id}`, look: t.look, token: '', room, lastChat: 0, send: () => {} };
}

/**
 * Uma cena do tabuleiro. As peças (tokens) andam aqui; quem está conectado só
 * assiste e comanda (`viewers`) — uma pessoa controla o tabuleiro.
 */
export class RoomInstance {
  data: RoomData;
  map: RoomMap;
  /** peças no tabuleiro */
  private users = new Map<number, RoomUser>();
  /** conexões olhando esta cena */
  private viewers = new Map<number, Client>();
  private timer: NodeJS.Timeout | null = null;
  private hotel: HotelApi;
  private tokensDirty = false;
  /** quadro da cena (casas → 0..1); refeito quando a planta muda */
  private geo: { grid: SceneGrid; aspect: number } | null = null;

  constructor(data: RoomData, hotel: HotelApi) {
    this.data = data;
    this.hotel = hotel;
    this.map = new RoomMap(data.heightmap, data.door, data.items, data.wallItems);
    for (const t of data.tokens ?? []) this.spawnToken(t, null);
    // sem ninguém na sala, a passagem secreta fica fechada (também ao carregar)
    if (!this.temAlguem()) this.closeWhenEmpty(false);
  }

  /** Alguém na sala: uma peça no tabuleiro ou o mestre olhando a cena (a mesa não conta). */
  private temAlguem() {
    return this.users.size > 0 || [...this.viewers.values()].some((c) => this.canBuild(c));
  }

  get userCount() {
    return this.viewers.size;
  }

  /** Posições das peças (planta/minimapa). */
  userPositions() {
    return [...this.users.values()].map((u) => ({ id: u.client.id, name: u.client.name ?? '?', x: u.x, y: u.y }));
  }

  /** Conexões olhando a cena. */
  clients() {
    return [...this.viewers.values()];
  }

  /** Peças desta cena. */
  tokenList() {
    return [...this.users.values()].map((u) => ({
      id: u.client.id,
      name: u.client.name ?? '?',
      look: u.client.look,
      color: u.meta?.color,
      capacity: u.meta?.capacity,
      armed: !!u.meta?.armed,
      hurt: !!u.meta?.hurt,
      vitals: u.meta?.vitals,
    }));
  }

  private ensureTimer() {
    if (!this.hotel.timers) return;
    if (!this.timer && (this.viewers.size || this.users.size)) this.timer = setInterval(() => this.step(), TICK_MS);
  }

  /** Cria a peça na cena (na passagem que liga a `fromRoomId`, ou na posição salva, ou na porta). */
  private spawnToken(t: TokenData, fromRoomId: number | null): RoomUser {
    const d = this.data.door;
    const back = fromRoomId ? this.map.allItems().find((it) => it.link === fromRoomId && getFurni(it.defId)?.portal) : undefined;
    const valid = !back && this.map.floorHeight(t.x, t.y) !== null && fromRoomId === null;
    let sx = back ? back.x : valid ? t.x : d.x;
    let sy = back ? back.y : valid ? t.y : d.y;
    let sdir = back ? (back.rot + 4) % 8 : valid ? t.dir : d.dir;
    // descendo pela escada: a peça chega no pé dela, virada para a sala (em cima dos degraus, no chão, ela sumia atrás da escada);
    // subindo, chega na frente do vão da escada do andar de cima
    const pe = back?.defId === 'stairs_up' || back?.defId === 'escada_desce' || back?.defId === 'escada_vertical' ? this.stairFoot(back) : null;
    if (pe) {
      [sx, sy] = [pe.x, pe.y];
      sdir = back!.rot;
    }
    // subindo pelo alçapão: sai do buraco e fica do lado dele
    if (back?.defId === 'alcapao') {
      const lado = this.freeNear(back.x, back.y, -t.id);
      if (lado) [sx, sy] = [lado.x, lado.y];
    }
    // chegando por uma passagem ocupada: vai para a casa livre mais perto dela
    if (back && (this.occupied(sx, sy, -t.id) || this.map.walkState(sx, sy) !== 'walk')) {
      const free = this.freeNear(sx, sy, -t.id);
      if (free) [sx, sy] = [free.x, free.y];
    }
    const u: RoomUser = {
      client: tokenClient({ ...t, x: sx, y: sy, dir: sdir }, this),
      x: sx,
      y: sy,
      z: this.map.standHeight(sx, sy),
      dir: sdir,
      headDir: sdir,
      goal: null,
      next: null,
      sit: 0,
      dance: false,
      dirty: false,
      headResetAt: 0,
      // nasce "chegando": em cima de uma passagem, só atravessa depois de sair dela e voltar
      // (sem isso, a peça salva em cima de uma porta trocava de cena a cada reinício)
      arrivedAt: { x: sx, y: sy },
      meta: { color: t.color, capacity: t.capacity, armed: t.armed, hurt: t.hurt, agachado: t.agachado, alto: t.alto, vitals: sanitizeVitals(t.vitals) },
    };
    this.users.set(u.client.id, u);
    this.settle(u);
    this.ensureTimer();
    return u;
  }

  /** A casa na frente do primeiro degrau da escada (a frente dela é o pé), se der para pisar. */
  private stairFoot(it: FloorItem): Point | null {
    const def = getFurni(it.defId);
    if (!def) return null;
    const lado = it.rot === 2 || it.rot === 6;
    const wx = lado ? def.depth : def.width;
    const dy = lado ? def.width : def.depth;
    const meioX = it.x + Math.floor((wx - 1) / 2);
    const meioY = it.y + Math.floor((dy - 1) / 2);
    const p = it.rot === 4 ? { x: meioX, y: it.y + dy } : it.rot === 0 ? { x: meioX, y: it.y - 1 } : it.rot === 2 ? { x: it.x + wx, y: meioY } : { x: it.x - 1, y: meioY };
    return this.map.walkState(p.x, p.y) === 'walk' ? p : null;
  }

  /** Casa livre (andável e sem peça) mais perto de (x, y), em anéis. */
  private freeNear(x: number, y: number, selfId: number): Point | null {
    for (let r = 1; r <= 4; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (this.map.walkState(nx, ny) !== 'walk' || this.occupied(nx, ny, selfId)) continue;
          if (getFurni(this.map.topItem(nx, ny)?.defId ?? '')?.portal) continue;
          return { x: nx, y: ny };
        }
    return null;
  }

  /** Coloca uma peça vinda de outra cena (ou nova). */
  putToken(t: TokenData, fromRoomId: number | null) {
    if (fromRoomId) this.openFromInside(fromRoomId);
    const u = this.spawnToken(t, fromRoomId);
    this.nevoaAutomatica([u]);
    this.broadcast({ t: 'userJoin', user: this.userInfo(u) });
    this.saveTokens();
  }

  /** PV/PE/SAN vindos da ficha para as peças deste personagem (folha). Devolve se mudou algo. */
  definirVitais(personagem: number, v: Vitals, soSemVitais = false): boolean {
    let mudou = false;
    for (const u of this.users.values()) {
      if (u.client.look?.charId !== personagem) continue;
      if (soSemVitais && u.meta?.vitals) continue;
      if (JSON.stringify(u.meta?.vitals) === JSON.stringify(v)) continue;
      u.meta ??= {};
      u.meta.vitals = { ...v };
      mudou = true;
    }
    if (mudou) this.saveTokens();
    return mudou;
  }

  /**
   * PV, PE ou SAN novos de uma peça (vindos do combate), com o registro de
   * "Últimas ações" e a ficha ligada acompanhando. Devolve os de antes, ou
   * null se a peça não está nesta cena.
   */
  mudarVitais(tokenId: number, m: { pv?: number; pe?: number; san?: number }): Vitals | null {
    const u = this.users.get(-tokenId);
    if (!u) return null;
    u.meta ??= {};
    const antes = u.meta.vitals ?? DEFAULT_VITALS;
    let v = { ...antes };
    for (const k of VITAL_KEYS) if (typeof m[k] === 'number') v = applyVital(v, k, { value: m[k] });
    u.meta.vitals = v;
    for (const k of VITAL_KEYS) if (v[k] !== antes[k]) this.hotel.vitalChanged(this.data.id, tokenId, u.client.name ?? '?', k, antes[k], v[k], v[`${k}Max`]);
    this.hotel.vitaisDaPeca(u.client.look?.charId, v);
    this.saveTokens();
    return { ...antes };
  }

  /** Tira a peça desta cena e devolve os dados dela. */
  takeToken(tokenId: number): TokenData | null {
    const u = this.users.get(tokenId);
    if (!u) return null;
    this.users.delete(tokenId);
    this.broadcast({ t: 'userLeave', id: tokenId });
    this.saveTokens();
    if (!this.temAlguem()) this.closeWhenEmpty();
    return this.tokenData(u);
  }

  /**
   * Sem ninguém na sala (nenhuma peça e o mestre fora da cena), a passagem secreta se fecha. O
   * mobi volta para o lugar mesmo com algo no caminho (não sobrou ninguém para ver).
   */
  private closeWhenEmpty(avisar = true) {
    for (const it of this.map.allItems()) {
      if (!it.lock?.open) continue;
      if (!this.slideLock(it, false, true) && avisar) this.hotel.log(this.data.id, 'scene', `Sem ninguém na sala, a passagem se fechou: ${anyFurniName(it.defId)} voltou para o lugar.`);
    }
  }

  private tokenData(u: RoomUser): TokenData {
    const t: TokenData = { id: -u.client.id, name: u.client.name ?? '?', look: u.client.look, x: u.x, y: u.y, dir: u.dir, color: u.meta?.color, capacity: u.meta?.capacity };
    if (u.meta?.armed) t.armed = true;
    if (u.meta?.hurt) t.hurt = true;
    if (u.meta?.agachado) t.agachado = true;
    if (u.meta?.alto) t.alto = true;
    if (u.meta?.vitals) t.vitals = u.meta.vitals;
    return t;
  }

  private saveTokens() {
    this.data.tokens = [...this.users.values()].map((u) => this.tokenData(u));
    this.hotel.save();
    this.hotel.touch();
  }

  /** Os prédios da cena ao ar livre (mobis grandes que não se pisa), para a planta. */
  marcos() {
    const out: { x: number; y: number; w: number; h: number; nome: string }[] = [];
    for (const it of this.map.allItems()) {
      const def = getFurni(it.defId);
      if (!def || def.walkable || def.width * def.depth < 20) continue;
      const fp = footprint(def, it.rot);
      out.push({ x: it.x, y: it.y, w: fp.sx, h: fp.sy, nome: def.name });
    }
    return out;
  }

  portals() {
    const out: { x: number; y: number; link: number }[] = [];
    for (const it of this.map.allItems()) if (it.link && getFurni(it.defId)?.portal) out.push({ x: it.x, y: it.y, link: it.link });
    return out;
  }

  /** Só o mestre controla a cena (o servidor decide pelo papel da conexão). */
  isOwner(c: Client) {
    return c.role === 'gm';
  }

  canBuild(c: Client) {
    return c.role === 'gm';
  }

  info(c: Client): RoomInfo {
    return {
      id: this.data.id,
      name: this.data.name,
      description: this.data.description,
      owner: this.data.owner,
      heightmap: this.data.heightmap,
      door: this.data.door,
      darkness: this.data.darkness,
      lightMode: this.data.lightMode ?? 'normal',
      fog: this.data.fog ?? 0,
      publicBuild: this.data.publicBuild,
      floor: this.data.floor,
      area: this.data.area,
      floorStyle: this.data.floorStyle,
      aberto: this.data.aberto,
      terreno: this.data.terreno,
      ambient: this.data.ambient,
      particles: this.data.particles,
      particleLevel: this.data.particleLevel,
      tatico: this.data.tatico,
      nevoa: this.nevoaAtual() ?? undefined,
      mapa: this.data.mapa,
      viagem: this.data.viagem,
      canBuild: this.canBuild(c),
      isOwner: this.isOwner(c),
    };
  }

  // ---------- visibilidade de pistas e itens ----------
  /** Jogador comum não recebe pista oculta nem item ainda não revelado (a não ser o que está com ele). */
  private hide<T extends FloorItem | WallItem>(it: T, c: Client): T {
    if (this.canBuild(c)) return it;
    const out = { ...it };
    if (out.hint && !out.hint.visible) delete out.hint;
    // a senha só vai para o mestre
    const fl = out as FloorItem;
    if (fl.lock) fl.lock = { open: fl.lock.open, slide: fl.lock.slide, ...(fl.lock.semSenha ? { semSenha: true } : {}) };
    if (out.loot) {
      const me = (c.name ?? '').toLowerCase();
      out.loot = out.loot.filter((l) => l.revealed || l.holder?.toLowerCase() === me);
    }
    return out;
  }
  private floorFor(it: FloorItem, c: Client): FloorItem {
    return this.hide(it, c);
  }
  private wallFor(it: WallItem, c: Client): WallItem {
    return this.hide(it, c);
  }

  private broadcast(msg: ServerMsg, exceptId?: number) {
    for (const c of this.viewers.values()) if (c.id !== exceptId) c.send(msg);
  }
  private broadcastFloor(t: 'itemAdd' | 'itemUpdate', it: FloorItem) {
    for (const c of this.viewers.values()) c.send({ t, item: this.floorFor(it, c) });
  }
  private broadcastWall(t: 'wallAdd' | 'wallUpdate', it: WallItem) {
    for (const c of this.viewers.values()) c.send({ t, item: this.wallFor(it, c) });
  }

  private userInfo(u: RoomUser): UserInfo {
    return { ...this.status(u), name: u.client.name ?? '?', look: u.client.look, color: u.meta?.color, ...(u.meta?.agachado ? { agachado: true } : {}), ...(u.meta?.alto ? { alto: true } : {}) };
  }

  private status(u: RoomUser): UserStatus {
    const s: UserStatus = {
      id: u.client.id,
      x: u.x,
      y: u.y,
      z: u.z,
      dir: u.dir,
      headDir: u.headDir,
      sit: u.sit,
      dance: u.dance,
    };
    if (u.next) s.mv = { x: u.next.x, y: u.next.y, z: this.map.standHeight(u.next.x, u.next.y) };
    return s;
  }

  // ---------- entrada / saída ----------
  /** Conexão passa a olhar/comandar esta cena. */
  join(c: Client, _fromRoomId?: number) {
    this.viewers.set(c.id, c);
    c.room = this;
    this.sendEnter(c);
    this.ensureTimer();
    this.hotel.roomChanged();
  }

  /** Conteúdo da cena para miniatura (mesma visibilidade de quem entra). */
  peek(c: Client) {
    c.send({
      t: 'peek',
      room: this.info(c),
      items: this.map.allItems().map((it) => this.floorFor(it, c)),
      wallItems: this.map.allWallItems().map((it) => this.wallFor(it, c)),
    });
  }

  private sendEnter(c: Client) {
    c.send({
      t: 'roomEnter',
      room: this.info(c),
      items: this.map.allItems().map((it) => this.floorFor(it, c)),
      wallItems: this.map.allWallItems().map((it) => this.wallFor(it, c)),
      users: [...this.users.values()].map((o) => this.userInfo(o)),
    });
  }

  leave(c: Client) {
    if (!this.viewers.delete(c.id)) return;
    c.room = null;
    // o mestre saiu da cena e não sobrou peça: a passagem se fecha
    if (!this.temAlguem()) this.closeWhenEmpty();
    this.hotel.roomChanged();
  }

  updateLook(_c: Client) {
    // quem assiste não tem avatar
  }

  // ---------- loop ----------
  private occupied(x: number, y: number, exceptId: number) {
    for (const o of this.users.values()) {
      if (o.client.id === exceptId) continue;
      if (o.x === x && o.y === y) return true;
      if (o.next && o.next.x === x && o.next.y === y) return true;
    }
    return false;
  }

  private settle(u: RoomUser) {
    // fora do beliche, ninguém fica "na cama de cima"
    if (u.meta?.alto && !this.map.leitoItem(u.x, u.y)) u.meta.alto = false;
    const z = this.map.standHeight(u.x, u.y, !!u.meta?.alto);
    if (z !== u.z) {
      u.z = z;
      u.dirty = true;
    }
    const seat = this.map.sitItem(u.x, u.y);
    if (seat) {
      if (u.sit !== 1 || u.dir !== seat.rot) {
        u.sit = 1;
        u.dir = u.headDir = seat.rot;
        u.dirty = true;
      }
    } else if (u.sit === 1) {
      u.sit = 0;
      u.dirty = true;
    }
  }

  /** Um passo do tabuleiro (a cada TICK_MS). Público para os testes. */
  step() {
    const now = Date.now();
    const updates: UserStatus[] = [];
    for (const u of this.users.values()) {
      if (u.next) {
        u.x = u.next.x;
        u.y = u.next.y;
        u.next = null;
        u.dirty = true;
      }
      if (u.goal) {
        if (u.goal.x === u.x && u.goal.y === u.y) u.goal = null;
        else {
          const path = findPath(this.map, u, u.goal, (x, y) => this.occupied(x, y, u.client.id));
          if (!path || !path.length) u.goal = null;
          else {
            const step = path[0];
            u.dir = u.headDir = directionTo(u, step);
            u.next = step;
            u.sit = 0;
            if (u.meta?.alto) u.meta.alto = false;
            u.headResetAt = 0;
            u.dirty = true;
          }
        }
      }
      if (!u.next) this.settle(u);
      else u.z = this.map.standHeight(u.x, u.y);
      if (u.headResetAt && now >= u.headResetAt) {
        u.headResetAt = 0;
        if (u.headDir !== u.dir) {
          u.headDir = u.dir;
          u.dirty = true;
        }
      }
      if (u.dirty) {
        u.dirty = false;
        updates.push(this.status(u));
      }
    }
    // a névoa abre antes de a peça chegar: a mesa vê o agente entrando na casa nova
    if (updates.length) this.nevoaAutomatica(updates.map((s) => this.users.get(s.id)!).filter(Boolean));
    if (updates.length) {
      this.broadcast({ t: 'status', updates });
      this.broadcast({ t: 'tokens', sceneId: this.data.id, tokens: updates.map((s) => this.tokenState(this.users.get(s.id)!)) });
    }
    // guarda a posição das peças quando param de andar
    const moving = [...this.users.values()].some((u) => u.next || u.goal);
    if (updates.length) this.tokensDirty = true;
    if (this.tokensDirty && !moving) {
      this.tokensDirty = false;
      this.saveTokens();
    }

    // Passagens: peça que parou em cima vai para a cena ligada.
    const travel: [number, number][] = [];
    for (const u of this.users.values()) {
      if (u.arrivedAt && (u.arrivedAt.x !== u.x || u.arrivedAt.y !== u.y)) u.arrivedAt = null;
      if (u.next || u.goal || u.arrivedAt) continue;
      const portal = this.map.itemsAt(u.x, u.y).find((it) => it.link && getFurni(it.defId)?.portal);
      if (portal?.link && this.hotel.roomExists(portal.link)) travel.push([u.client.id, portal.link]);
    }
    for (const [tokenId, roomId] of travel) {
      // avisa antes de tirar a peça: quem a comanda troca de cena junto
      this.broadcast({ t: 'tokenTravel', tokenId, roomId });
      this.hotel.moveToken(this, tokenId, roomId);
    }
    if (!this.viewers.size && !this.users.size && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private resettleAll() {
    for (const u of this.users.values()) if (!u.next) this.settle(u);
  }

  private usersOn(tiles: Point[]) {
    for (const u of this.users.values())
      for (const t of tiles) {
        if (u.x === t.x && u.y === t.y) return true;
        if (u.next && u.next.x === t.x && u.next.y === t.y) return true;
      }
    return false;
  }

  // ---------- mensagens ----------
  handle(c: Client, m: Record<string, unknown>) {
    if (!this.viewers.has(c.id)) return;
    // as operações de construção só usam `client`
    const u = { client: c } as RoomUser;
    switch (m.t) {
      case 'tokenAdd':
      case 'tokenEdit':
      case 'tokenRemove':
      case 'tokenWalk':
      case 'tokenFace':
      case 'tokenScene':
      case 'vitals':
        this.tokenCmd(c, m);
        break;
      case 'place':
        this.place(u, m);
        break;
      case 'placeWall':
        this.placeWall(u, m);
        break;
      case 'moveItem':
        this.moveItem(u, m);
        break;
      case 'moveWallItem':
        this.moveWallItem(u, m);
        break;
      case 'pickup':
        if (isInt(m.id)) this.pickup(u, m.id);
        break;
      case 'resizeItem':
        if (isInt(m.id) && isNum(m.escala)) this.resizeItem(u, m.id, m.escala);
        break;
      case 'swapItem':
        if (isInt(m.id) && typeof m.defId === 'string') this.swapItem(u, m.id, m.defId);
        break;
      case 'use':
        if (isInt(m.id)) this.use(u, m.id);
        break;
      case 'unlock':
        if (isInt(m.id)) this.unlock(c, m.id, m.code);
        break;
      case 'relock':
        if (isInt(m.id)) this.relock(c, m.id);
        break;
      case 'setHint':
        if (isInt(m.id)) this.setHint(u, m.id, m.hint);
        break;
      case 'roomSettings':
        this.settings(u, m);
        break;
      case 'roomFx':
        this.fx(u, m);
        break;
      case 'marca':
        this.marca(u, m.marca);
        break;
      case 'nevoa':
        this.nevoa(u, m);
        break;
      case 'setLink':
        if (isInt(m.id)) this.setLink(u, m.id, m.roomId);
        break;
      case 'lootAdd':
      case 'lootRemove':
      case 'lootGive':
      case 'lootReveal':
      case 'actionAdd':
      case 'actionRemove':
      case 'actionLog':
        if (isInt(m.itemId)) this.editItemRpg(u, m.itemId, m);
        break;
      case 'floorPlan':
        this.floorPlan(u, m);
        break;
    }
  }

  private err(c: Client, msg: string) {
    c.send({ t: 'error', msg });
  }

  private chat(u: RoomUser, raw: string, shout: boolean) {
    const now = Date.now();
    if (now - u.client.lastChat < 350) return;
    u.client.lastChat = now;
    const text = clean(raw, MAX_CHAT);
    if (!text) return;
    const name = u.client.name ?? '?';

    const rollMatch = text.match(/^\/(?:r|rolar|roll)\s+(.+)$/i);
    if (rollMatch) {
      const spec = parseRoll(rollMatch[1]);
      if (!spec) return this.err(u.client, 'Rolagem inválida. Ex: /r 2d20+3, /r 3d20kh');
      const roll = evalRoll(spec, (s) => crypto.randomInt(1, s + 1));
      this.broadcast({ t: 'chat', id: u.client.id, name, text: `rolou ${roll.expr}`, kind: 'roll', roll });
      return;
    }

    this.broadcast({ t: 'chat', id: u.client.id, name, text, kind: shout ? 'shout' : 'say' });
    // Os outros viram a cabeça para quem falou.
    for (const o of this.users.values()) {
      if (o === u || o.next || o.goal) continue;
      const d = directionTo(o, u);
      if (o.headDir !== d) {
        o.headDir = d;
        o.dirty = true;
      }
      o.headResetAt = now + 5000;
    }
  }

  private action(u: RoomUser, a: unknown) {
    if (a === 'wave') this.broadcast({ t: 'action', id: u.client.id, action: 'wave' });
    else if (a === 'dance') {
      u.dance = !u.dance;
      u.dirty = true;
    } else if (a === 'sit') {
      if (!u.next && !u.goal && u.sit === 0) {
        u.sit = 2;
        if (u.dir % 2 === 1) u.dir = u.headDir = (u.dir + 7) % 8;
        u.dirty = true;
      }
    } else if (a === 'stand') {
      if (u.sit === 2) {
        u.sit = 0;
        u.dirty = true;
      }
    }
  }

  private takeFromInventory(c: Client, invId: unknown): InvItem | null | undefined {
    if (invId === undefined || invId === null) return undefined;
    if (!isInt(invId)) return null;
    const inv = this.hotel.inventory(c);
    const i = inv.findIndex((it) => it.id === invId);
    if (i < 0) return null;
    return inv[i];
  }

  private removeFromInventory(c: Client, id: number) {
    const inv = this.hotel.inventory(c);
    const i = inv.findIndex((it) => it.id === id);
    if (i >= 0) inv.splice(i, 1);
    this.hotel.sendInventory(c);
  }

  private place(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Você não tem permissão para construir aqui.');
    if (!isInt(m.x) || !isInt(m.y) || !isInt(m.rot)) return;
    const inv = this.takeFromInventory(c, m.invId);
    if (inv === null) return this.err(c, 'Item não está no inventário.');
    const defId = inv ? inv.defId : typeof m.defId === 'string' ? m.defId : '';
    const def = getFurni(defId);
    if (!def) return this.err(c, 'Mobi inválido.');
    const res = this.map.canPlace(defId, m.x, m.y, m.rot);
    if (!res.ok) return this.err(c, res.reason ?? 'Não dá para colocar aí.');
    if (!def.walkable && !def.sit && this.usersOn(this.map.tilesFor(defId, m.x, m.y, m.rot)))
      return this.err(c, 'Tem alguém no caminho.');
    const item: FloorItem = { id: inv ? inv.id : this.hotel.nextItemId(), defId, x: m.x, y: m.y, z: res.z, rot: m.rot, state: 0 };
    if (inv) this.removeFromInventory(c, inv.id);
    this.map.addItem(item);
    this.persist();
    this.broadcastFloor('itemAdd', item);
    this.resettleAll();
  }

  private placeWall(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Você não tem permissão para construir aqui.');
    if ((m.wall !== 'l' && m.wall !== 'r') || !isInt(m.plane) || !isNum(m.pos) || !isNum(m.z)) return;
    const inv = this.takeFromInventory(c, m.invId);
    if (inv === null) return this.err(c, 'Item não está no inventário.');
    const defId = inv ? inv.defId : typeof m.defId === 'string' ? m.defId : '';
    if (!getWallFurni(defId)) return this.err(c, 'Mobi de parede inválido.');
    const pos = Math.round(m.pos * 64) / 64;
    const z = Math.round(m.z * 64) / 64;
    const res = this.map.canPlaceWall(defId, m.wall, m.plane, pos, z);
    if (!res.ok) return this.err(c, res.reason ?? 'Não dá para colocar aí.');
    const item: WallItem = { id: inv ? inv.id : this.hotel.nextItemId(), defId, wall: m.wall, plane: m.plane, pos, z, state: 0 };
    if (inv) this.removeFromInventory(c, inv.id);
    this.map.setWallItem(item);
    this.persist();
    this.broadcastWall('wallAdd', item);
  }

  private moveItem(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Sem permissão.');
    if (!isInt(m.id) || !isInt(m.x) || !isInt(m.y) || !isInt(m.rot)) return;
    const it = this.map.getItem(m.id);
    if (!it) return;
    const def = getFurni(it.defId)!;
    const res = this.map.canPlace(it.defId, m.x, m.y, m.rot, it.id);
    if (!res.ok) {
      c.send({ t: 'itemUpdate', item: this.floorFor(it, c) });
      return this.err(c, res.reason ?? 'Não dá para mover para aí.');
    }
    if (!def.walkable && !def.sit) {
      const old = new Set(this.map.tilesFor(it.defId, it.x, it.y, it.rot).map((p) => `${p.x},${p.y}`));
      const tiles = this.map.tilesFor(it.defId, m.x, m.y, m.rot).filter((p) => !old.has(`${p.x},${p.y}`));
      if (this.usersOn(tiles)) {
        c.send({ t: 'itemUpdate', item: this.floorFor(it, c) });
        return this.err(c, 'Tem alguém no caminho.');
      }
    }
    let moved: FloorItem = { ...it, x: m.x, y: m.y, rot: m.rot, z: res.z };
    // mobi de fechadura (a geladeira da passagem): o lugar novo é o fechado. Arrastada aberta, ela
    // ficava "aberta" em cima da escada: a senha não fazia mais nada e fechar empurrava para fora
    if (it.lock) moved = { ...moved, lock: { ...it.lock, open: false } };
    this.map.updateItem(moved);
    if (it.lock) this.cobrirEscondidos(it, moved);
    this.persist();
    this.broadcastFloor('itemUpdate', moved);
    this.resettleAll();
  }

  /** O mobi de fechadura mudou de lugar: o escondido que ficou descoberto aparece; o que ficou embaixo dele some. */
  private cobrirEscondidos(antes: FloorItem, depois: FloorItem) {
    const embaixo = new Set(this.map.tilesFor(depois.defId, depois.x, depois.y, depois.rot).map((t) => `${t.x},${t.y}`));
    const mudar = (x: number, y: number, state: number) => {
      for (const o of this.map.itemsAt(x, y)) {
        if (!getFurni(o.defId)?.hidden || o.state === state) continue;
        const novo: FloorItem = { ...o, state };
        this.map.updateItem(novo);
        this.broadcastFloor('itemUpdate', novo);
      }
    };
    for (const t of this.map.tilesFor(antes.defId, antes.x, antes.y, antes.rot)) if (!embaixo.has(`${t.x},${t.y}`)) mudar(t.x, t.y, 1);
    for (const k of embaixo) {
      const [x, y] = k.split(',').map(Number);
      mudar(x, y, 0);
    }
  }

  private moveWallItem(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Sem permissão.');
    if (!isInt(m.id) || (m.wall !== 'l' && m.wall !== 'r') || !isInt(m.plane) || !isNum(m.pos) || !isNum(m.z)) return;
    const it = this.map.getWallItem(m.id);
    if (!it) return;
    const pos = Math.round(m.pos * 64) / 64;
    const z = Math.round(m.z * 64) / 64;
    const res = this.map.canPlaceWall(it.defId, m.wall, m.plane, pos, z);
    if (!res.ok) {
      c.send({ t: 'wallUpdate', item: this.wallFor(it, c) });
      return this.err(c, res.reason ?? 'Não dá para mover para aí.');
    }
    const moved: WallItem = { ...it, wall: m.wall, plane: m.plane, pos, z };
    this.map.setWallItem(moved);
    this.persist();
    this.broadcastWall('wallUpdate', moved);
  }

  /** O tamanho do desenho de um quadro (item de parede) ou de um tapete (móvel de chão que se pisa). */
  private resizeItem(u: RoomUser, id: number, escala: number) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Sem permissão.');
    const e = Math.round(Math.max(0.5, Math.min(3, escala)) * 100) / 100;
    const wall = this.map.getWallItem(id);
    if (wall) {
      const novo: WallItem = { ...wall, escala: e === 1 ? undefined : e };
      this.map.setWallItem(novo);
      this.persist();
      this.broadcastWall('wallUpdate', novo);
      return;
    }
    const it = this.map.getItem(id);
    const def = it ? getFurni(it.defId) : undefined;
    if (!it || !def) return;
    if (!def.flat) return this.err(c, 'Só tapetes e quadros mudam de tamanho.');
    const novo: FloorItem = { ...it, escala: e === 1 ? undefined : e };
    this.map.updateItem(novo);
    this.persist();
    this.broadcastFloor('itemUpdate', novo);
  }

  /**
   * Troca o móvel por outro do catálogo no mesmo lugar: no mesmo giro, se der; senão no primeiro que
   * couber. Não coube de jeito nenhum: o antigo fica onde estava.
   */
  private swapItem(u: RoomUser, id: number, defId: string) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Sem permissão.');
    const old = this.map.getItem(id);
    const def = getFurni(defId);
    if (!old || !def) return;
    this.map.removeItem(id);
    const giros = [old.rot, ...def.rotations.filter((r) => r !== old.rot)].filter((r) => def.rotations.includes(r));
    for (const rot of giros) {
      const res = this.map.canPlace(defId, old.x, old.y, rot);
      if (!res.ok) continue;
      if (!def.walkable && !def.sit && this.usersOn(this.map.tilesFor(defId, old.x, old.y, rot))) continue;
      const item: FloorItem = { id: this.hotel.nextItemId(), defId, x: old.x, y: old.y, z: res.z, rot, state: 0 };
      this.broadcast({ t: 'itemRemove', id });
      this.map.addItem(item);
      this.persist();
      this.broadcastFloor('itemAdd', item);
      this.resettleAll();
      return;
    }
    this.map.addItem(old);
    this.err(c, 'O móvel novo não cabe nesse lugar.');
  }

  private pickup(u: RoomUser, id: number) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Sem permissão.');
    const floor = this.map.getItem(id);
    const wall = floor ? undefined : this.map.getWallItem(id);
    if (!floor && !wall) return;
    if (floor) {
      this.map.removeItem(id);
      this.broadcast({ t: 'itemRemove', id });
    } else {
      this.map.removeWallItem(id);
      this.broadcast({ t: 'wallRemove', id });
    }
    this.hotel.inventory(c).push({ id, defId: (floor ?? wall)!.defId });
    this.hotel.sendInventory(c);
    this.persist();
    this.resettleAll();
  }

  private use(u: RoomUser, id: number) {
    const floor = this.map.getItem(id);
    if (floor?.lock?.semSenha) return this.empurrar(u.client, floor);
    if (floor) {
      const def = getFurni(floor.defId);
      if (!def?.states || def.states < 2) return;
      const it = { ...floor, state: (floor.state + 1) % def.states };
      // porta: não fecha com alguém no vão
      if (def.openState !== undefined && it.state !== def.openState && this.usersOn(this.map.tilesFor(floor.defId, floor.x, floor.y, floor.rot)))
        return this.err(u.client, 'Tem alguém na porta.');
      this.map.updateItem(it);
      this.persist();
      this.broadcastFloor('itemUpdate', it);
      return;
    }
    const wall = this.map.getWallItem(id);
    if (wall) {
      const def = getWallFurni(wall.defId);
      if (!def?.states || def.states < 2) return;
      const it = { ...wall, state: (wall.state + 1) % def.states };
      this.map.setWallItem(it);
      this.persist();
      this.broadcastWall('wallUpdate', it);
    }
  }

  // ---------- passagem secreta ----------
  /**
   * Abre (ou fecha) a fechadura: o mobi desliza `slide` casas e a passagem
   * escondida que ficava embaixo dele aparece (ou some). Devolve o motivo quando não dá.
   */
  private slideLock(it: FloorItem, open: boolean, forcar = false): string | null {
    const lock = it.lock;
    if (!lock) return 'Esse mobi não tem senha.';
    if (lock.open === open) return null;
    const dx = open ? lock.slide.dx : -lock.slide.dx;
    const dy = open ? lock.slide.dy : -lock.slide.dy;
    const nx = it.x + dx;
    const ny = it.y + dy;
    const res = this.map.canPlace(it.defId, nx, ny, it.rot, it.id);
    if (!res.ok && !forcar) return 'Tem algo no caminho: não dá para arrastar.';
    const dest = this.map.tilesFor(it.defId, nx, ny, it.rot);
    if (!forcar && this.usersOn(dest)) return 'Tem alguém no caminho.';
    if (!res.ok) res.z = this.map.floorHeight(nx, ny) ?? it.z;
    // casas que ficam livres ao abrir (ou que voltam a ser cobertas ao fechar)
    const spot = open ? this.map.tilesFor(it.defId, it.x, it.y, it.rot) : dest;
    const next: FloorItem = { ...it, x: nx, y: ny, z: res.z, lock: { ...lock, open } };
    this.map.updateItem(next);
    this.broadcastFloor('itemUpdate', next);
    for (const t of spot)
      for (const o of this.map.itemsAt(t.x, t.y)) {
        if (!getFurni(o.defId)?.hidden || o.state === (open ? 1 : 0)) continue;
        const shown: FloorItem = { ...o, state: open ? 1 : 0 };
        this.map.updateItem(shown);
        this.broadcastFloor('itemUpdate', shown);
      }
    this.persist();
    return null;
  }

  /** Senha digitada pelo mestre (os jogadores dizem, o mestre digita). */
  private unlock(c: Client, id: number, raw: unknown) {
    if (!this.canBuild(c)) return this.err(c, 'Só o mestre digita a senha.');
    const it = this.map.getItem(id);
    if (!it?.lock) return;
    if (it.lock.open) return c.send({ t: 'lockResult', id, ok: true });
    // o mestre abre a qualquer hora (com ou sem peça na sala); ela se fecha quando ele sai e não sobra ninguém
    const code = typeof raw === 'string' ? raw.replace(/\D/g, '').slice(0, 12) : '';
    if (!code || code !== it.lock.code) return c.send({ t: 'lockResult', id, ok: false });
    const why = this.slideLock(it, true);
    if (why) return c.send({ t: 'lockResult', id, ok: false, reason: why });
    c.send({ t: 'lockResult', id, ok: true });
    this.hotel.log(this.data.id, 'scene', `Senha certa: ${anyFurniName(it.defId)} deslizou e revelou uma passagem.`);
  }

  private relock(c: Client, id: number) {
    if (!this.canBuild(c)) return this.err(c, 'Só o mestre fecha a passagem.');
    const it = this.map.getItem(id);
    if (!it?.lock?.open) return;
    const why = this.slideLock(it, false);
    if (why) return this.err(c, why);
    this.hotel.log(this.data.id, 'scene', `A passagem secreta foi fechada: ${anyFurniName(it.defId)} voltou para o lugar.`);
  }

  /**
   * Mobi sem senha em cima de uma passagem (o feno em cima do alçapão do celeiro): o clique
   * duplo do mestre empurra o mobi e a passagem aparece; de novo, ele volta e cobre.
   */
  private empurrar(c: Client, it: FloorItem) {
    if (!this.canBuild(c)) return this.err(c, 'Só o mestre mexe nisso.');
    const abrir = !it.lock!.open;
    const why = this.slideLock(it, abrir);
    if (why) return this.err(c, why);
    const nome = anyFurniName(it.defId);
    this.hotel.log(this.data.id, 'scene', abrir ? `${nome} foi empurrado e revelou uma passagem.` : `${nome} voltou para o lugar e cobriu a passagem.`);
  }

  /** Chegando por uma passagem escondida que está fechada: abre por dentro, sem senha. */
  private openFromInside(fromRoomId: number) {
    const back = this.map.allItems().find((it) => it.link === fromRoomId && getFurni(it.defId)?.portal);
    if (!back) return;
    const cover = this.map.itemsAt(back.x, back.y).find((o) => o.lock && !o.lock.open);
    if (cover && !this.slideLock(cover, true)) this.hotel.log(this.data.id, 'scene', `Alguém abriu a passagem por dentro: ${anyFurniName(cover.defId)} deslizou.`);
  }

  private setHint(u: RoomUser, id: number, raw: unknown) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Só o mestre pode editar pistas.');
    const hint = raw === null ? null : sanitizeHint(raw);
    if (raw !== null && !hint) return this.err(c, 'Pista inválida.');
    const floor = this.map.getItem(id);
    if (floor) {
      const it: FloorItem = { ...floor };
      if (hint) it.hint = hint;
      else delete it.hint;
      this.map.updateItem(it);
      this.persist();
      this.broadcastFloor('itemUpdate', it);
      return;
    }
    const wall = this.map.getWallItem(id);
    if (wall) {
      const it: WallItem = { ...wall };
      if (hint) it.hint = hint;
      else delete it.hint;
      this.map.setWallItem(it);
      this.persist();
      this.broadcastWall('wallUpdate', it);
    }
  }

  private settings(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.isOwner(c)) return this.err(c, 'Só o dono pode mudar as configurações.');
    if (typeof m.name === 'string') {
      const n = clean(m.name, 30);
      if (n.length >= 3) this.data.name = n;
    }
    if (typeof m.description === 'string') this.data.description = clean(m.description, 140);
    if (isNum(m.darkness)) this.data.darkness = Math.max(0, Math.min(0.9, m.darkness));
    if (typeof m.publicBuild === 'boolean' && this.data.owner !== SYSTEM_OWNER) this.data.publicBuild = m.publicBuild;
    if (typeof m.floor === 'string') {
      const f = clean(m.floor, 20);
      if (f) this.data.floor = f;
      else delete this.data.floor;
    }
    if (typeof m.area === 'string') {
      const a = clean(m.area, 24);
      if (a) this.data.area = a;
      else delete this.data.area;
    }
    if (isFloorStyle(m.floorStyle)) this.data.floorStyle = m.floorStyle;
    if (m.ambient === null) delete this.data.ambient;
    else if (isHexColor(m.ambient)) this.data.ambient = m.ambient;
    if (Array.isArray(m.particles)) this.data.particles = sanitizeParticles(m.particles);
    this.hotel.save();
    for (const o of this.viewers.values()) o.send({ t: 'roomUpdate', room: this.info(o) });
    this.hotel.roomChanged();
  }

  /** Comandos das peças: só quem controla o tabuleiro. */
  private tokenCmd(c: Client, m: Record<string, unknown>) {
    if (!this.canBuild(c)) return this.err(c, 'Só quem controla o tabuleiro move as peças.');
    if (m.t === 'tokenAdd') {
      if (this.users.size >= 30) return this.err(c, 'Máximo de 30 peças por cena.');
      const name = typeof m.name === 'string' ? clean(m.name, MAX_TOKEN_NAME) : '';
      if (name.length < 1) return this.err(c, 'Dê um nome à peça.');
      if (this.hotel.tokenNameTaken(this.data.id, name)) return this.err(c, `Já existe um personagem chamado ${name}.`);
      const d = this.data.door;
      const color = typeof m.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : undefined;
      const capacity = isInt(m.capacity) ? Math.max(1, Math.min(99, m.capacity)) : undefined;
      const look = sanitizeLook(m.look);
      this.putToken({ id: this.hotel.nextItemId(), name, look, x: d.x, y: d.y, dir: d.dir, color, capacity }, null);
      this.hotel.vitaisDaFicha(look.charId);
      return;
    }
    const u = isInt(m.tokenId) ? this.users.get(m.tokenId) : undefined;
    if (!u) {
      // o painel PLAYERS mostra os agentes de todas as cenas: o PV de quem está em outra vai para lá
      if (m.t === 'vitals' && isInt(m.tokenId)) this.hotel.vitalEmOutraCena(this.data.id, m.tokenId, m);
      return;
    }
    switch (m.t) {
      case 'tokenWalk':
        if (isInt(m.x) && isInt(m.y) && this.map.floorHeight(m.x, m.y) !== null) u.goal = { x: m.x, y: m.y };
        break;
      case 'tokenFace':
        if (isInt(m.dir)) this.faceToken(-u.client.id, m.dir);
        break;
      case 'tokenEdit': {
        const name = typeof m.name === 'string' ? clean(m.name, MAX_TOKEN_NAME) : '';
        const old = u.client.name ?? '';
        if (name && name !== old) {
          if (this.hotel.tokenNameTaken(this.data.id, name, -u.client.id)) return this.err(c, `Já existe um personagem chamado ${name}.`);
          u.client.name = name;
          // os itens que estavam com ele continuam com ele
          if (name.toLowerCase() !== old.toLowerCase()) this.hotel.renameHolder(this.data.id, old, name);
        }
        if (m.look) u.client.look = sanitizeLook(m.look);
        u.meta ??= {};
        if (typeof m.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.color)) u.meta.color = m.color;
        if (isInt(m.capacity)) u.meta.capacity = Math.max(1, Math.min(99, m.capacity));
        // com ficha, o Armado vem da mão: a ficha empunha ou guarda a arma
        if (typeof m.armed === 'boolean' && !this.hotel.armarPelaPeca(u.client.look?.charId, m.armed, c)) u.meta.armed = m.armed;
        if (typeof m.hurt === 'boolean') u.meta.hurt = m.hurt;
        // a escalada: da cama de baixo para a de cima do beliche (e de volta); a peça sobe de uma altura para a outra
        if (typeof m.alto === 'boolean' && !!u.meta.alto !== m.alto) {
          if (m.alto && !this.map.leitoItem(u.x, u.y)) return this.err(c, 'Fique em cima de um beliche para subir.');
          const de = u.z;
          u.meta.alto = m.alto;
          this.settle(u);
          this.broadcast({ t: 'userLeave', id: u.client.id });
          this.broadcast({ t: 'userJoin', user: { ...this.userInfo(u), z: de, mv: { x: u.x, y: u.y, z: u.z } } });
          this.hotel.log(this.data.id, 'user', `${u.client.name ?? '?'} ${m.alto ? 'subiu para a cama de cima' : 'desceu para a cama de baixo'}.`);
          this.saveTokens();
          break;
        }
        if (typeof m.agachado === 'boolean') {
          u.meta.agachado = m.agachado;
          this.broadcast({ t: 'userLeave', id: u.client.id });
          this.broadcast({ t: 'userJoin', user: this.userInfo(u) });
          this.hotel.log(this.data.id, 'user', `${u.client.name ?? '?'} ${m.agachado ? 'se agachou' : 'se levantou'}.`);
          this.saveTokens();
          break;
        }
        // só o estado do retrato mudou: o tabuleiro não precisa redesenhar a peça
        if (!name && !m.look && m.color === undefined && m.capacity === undefined) {
          this.saveTokens();
          break;
        }
        this.broadcast({ t: 'userLeave', id: u.client.id });
        this.broadcast({ t: 'userJoin', user: this.userInfo(u) });
        this.saveTokens();
        if (m.look) this.hotel.vitaisDaFicha(u.client.look?.charId);
        break;
      }
      case 'tokenRemove':
        this.takeToken(u.client.id);
        break;
      case 'tokenScene':
        if (isInt(m.roomId) && m.roomId !== this.data.id && this.hotel.roomExists(m.roomId)) this.hotel.moveToken(this, u.client.id, m.roomId);
        break;
      case 'vitals':
        this.mudarVital(u.client.id, m);
        break;
    }
  }

  /** PV, PE ou SAN de uma peça desta cena (o + e o −, ou o total). Falso se a peça não está aqui. */
  mudarVital(userId: number, m: Record<string, unknown>): boolean {
    const u = this.users.get(userId);
    if (!u) return false;
    if (!VITAL_KEYS.includes(m.key as VitalKey)) return true;
    const key = m.key as VitalKey;
    u.meta ??= {};
    const before = u.meta.vitals ?? DEFAULT_VITALS;
    const change = { delta: isNum(m.delta) ? m.delta : undefined, value: isNum(m.value) ? m.value : undefined, max: isNum(m.max) ? m.max : undefined };
    const after = applyVital(before, key, change);
    u.meta.vitals = after;
    if (after[key] !== before[key]) this.hotel.vitalChanged(this.data.id, -u.client.id, u.client.name ?? '?', key, before[key], after[key], after[`${key}Max`]);
    this.hotel.vitaisDaPeca(u.client.look?.charId, after);
    this.saveTokens();
    return true;
  }

  /** Itens dentro do mobi e interações (só mestre/construtor). */
  private editItemRpg(u: RoomUser, itemId: number, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Só o mestre mexe nos itens do cenário.');
    const floor = this.map.getItem(itemId);
    const wall = floor ? undefined : this.map.getWallItem(itemId);
    const it = floor ?? wall;
    if (!it) return;
    const objName = it.hint?.title || anyFurniName(it.defId);
    const loot = [...(it.loot ?? [])];
    const actions = [...(it.actions ?? [])];
    const gm = c.name ?? 'Mestre';
    const lootIdx = isInt(m.lootId) ? loot.findIndex((l) => l.id === m.lootId) : -1;
    switch (m.t) {
      case 'lootAdd': {
        // do catálogo: a faca da gaveta vira arma de verdade (nome e espaços do livro, se o mestre não mudar)
        const ref = (m.item ?? {}) as { tipo?: unknown; id?: unknown };
        const item = noCatalogo(ref.tipo, ref.id) ? { tipo: ref.tipo, id: ref.id as string } : undefined;
        const nome = typeof m.name === 'string' && m.name.trim() ? m.name : item ? regras.nomeDoItem(item) : '';
        const inp = sanitizeLootInput({ ...m, name: nome, espacos: typeof m.espacos === 'number' ? m.espacos : item ? espacosDoItemFicha(item) : m.weight, kind: m.kind ?? (item ? kindDoItem(item) : undefined) });
        if (!inp) return this.err(c, 'Dê um nome ao item.');
        if (loot.length >= 30) return this.err(c, 'Máximo de 30 itens por mobi.');
        loot.push({ id: this.hotel.nextItemId(), ...inp, revealed: false, ...(item ? { item } : {}) });
        break;
      }
      case 'lootRemove':
        if (lootIdx < 0) return;
        loot.splice(lootIdx, 1);
        break;
      case 'lootGive': {
        if (lootIdx < 0) return;
        const to = typeof m.to === 'string' ? clean(m.to, MAX_TOKEN_NAME) : '';
        // peça com ficha: o item vai para a mochila dela (um inventário só)
        const levou = to ? this.hotel.pegarItem(this.data.id, to, loot[lootIdx], gm, objName) : false;
        if (typeof levou === 'string') return this.err(c, levou);
        if (levou) {
          loot.splice(lootIdx, 1);
          break;
        }
        const l = { ...loot[lootIdx], revealed: true };
        if (to) l.holder = to;
        else delete l.holder;
        loot[lootIdx] = l;
        this.hotel.log(this.data.id, 'give', to ? `${gm} entregou ${l.name} para ${to}.` : `${l.name} voltou para ${objName}.`);
        break;
      }
      case 'lootReveal':
        if (lootIdx < 0) return;
        loot[lootIdx] = { ...loot[lootIdx], revealed: m.revealed === true };
        break;
      case 'actionAdd': {
        const label = typeof m.label === 'string' ? clean(m.label, 40) : '';
        const dt = isInt(m.dt) ? Math.max(0, Math.min(60, m.dt)) : 10;
        if (!label) return this.err(c, 'Dê um nome à interação.');
        if (actions.length >= 12) return;
        actions.push({ id: this.hotel.nextItemId(), label, dt });
        break;
      }
      case 'actionRemove': {
        const i = isInt(m.actionId) ? actions.findIndex((a) => a.id === m.actionId) : -1;
        if (i < 0) return;
        actions.splice(i, 1);
        break;
      }
      case 'actionLog': {
        // resultado do teste feito na mesa, registrado pelo mestre
        const a = actions.find((x) => x.id === m.actionId);
        const player = typeof m.player === 'string' ? clean(m.player, MAX_TOKEN_NAME) : '';
        if (!a || !player) return;
        const value = isInt(m.value) ? ` (${m.value})` : '';
        this.hotel.log(this.data.id, 'user', `${player} — ${a.label} em ${objName} (DT ${a.dt}) — ${m.success === true ? 'Sucesso' : 'Falha'}${value}.`);
        return;
      }
      default:
        return;
    }
    // a pilha do chão some quando pegam o último item
    if (floor?.defId === PILHA_CHAO && !loot.length) {
      this.map.removeItem(floor.id);
      this.broadcast({ t: 'itemRemove', id: floor.id });
      this.persist();
      this.hotel.touch();
      return;
    }
    const next: FloorItem | WallItem = { ...it };
    if (loot.length) next.loot = loot;
    else delete next.loot;
    if (actions.length) next.actions = actions;
    else delete next.actions;
    if (floor) {
      this.map.updateItem(next as FloorItem);
      this.broadcastFloor('itemUpdate', next as FloorItem);
    } else {
      this.map.setWallItem(next as WallItem);
      this.broadcastWall('wallUpdate', next as WallItem);
    }
    this.persist();
    this.hotel.touch();
  }

  /** Itens de RPG deste quarto com dono (para a carga das peças sem ficha). */
  heldLoot() {
    const out: { holder: string; espacos: number }[] = [];
    const all = [...this.map.allItems(), ...this.map.allWallItems()];
    for (const it of all) for (const l of it.loot ?? []) if (l.holder) out.push({ holder: l.holder, espacos: l.espacos });
    return out;
  }

  /**
   * Tira dos mobis os itens que estão com uma peça de ficha (`temFicha`): eles
   * vão para a mochila (um inventário só). Devolve quem estava com cada um.
   */
  tirarItensComDono(temFicha: (nome: string) => boolean): { nome: string; loot: Loot }[] {
    const out: { nome: string; loot: Loot }[] = [];
    const tira = <T extends FloorItem | WallItem>(it: T): T | null => {
      const loot = it.loot ?? [];
      const vao = loot.filter((l) => l.holder && temFicha(l.holder));
      if (!vao.length) return null;
      for (const l of vao) out.push({ nome: l.holder!, loot: l });
      const fica = loot.filter((l) => !vao.includes(l));
      const next = { ...it };
      if (fica.length) next.loot = fica;
      else delete next.loot;
      return next;
    };
    for (const it of this.map.allItems()) {
      const next = tira(it);
      if (next) this.map.updateItem(next);
    }
    for (const it of this.map.allWallItems()) {
      const next = tira(it);
      if (next) this.map.setWallItem(next);
    }
    if (out.length) this.persist();
    return out;
  }

  /** Armado das peças do personagem (vem da mão, na ficha). Devolve true se mudou. */
  definirArmado(personagem: number, armado: boolean): boolean {
    let mudou = false;
    for (const u of this.users.values()) {
      if (u.client.look?.charId !== personagem || !!u.meta?.armed === armado) continue;
      u.meta ??= {};
      u.meta.armed = armado;
      mudou = true;
    }
    if (mudou) this.saveTokens();
    return mudou;
  }

  /** Tira do cenário o item com esse número (o Desfazer de quem largou ou foi desarmado). true = achou. */
  retirarLoot(id: number): boolean {
    for (const it of this.map.allItems()) {
      const loot = it.loot ?? [];
      if (!loot.some((l) => l.id === id)) continue;
      const fica = loot.filter((l) => l.id !== id);
      if (it.defId === PILHA_CHAO && !fica.length) {
        this.map.removeItem(it.id);
        this.broadcast({ t: 'itemRemove', id: it.id });
      } else {
        const next: FloorItem = { ...it };
        if (fica.length) next.loot = fica;
        else delete next.loot;
        this.map.updateItem(next);
        this.broadcastFloor('itemUpdate', next);
      }
      this.persist();
      return true;
    }
    return false;
  }

  /** A peça do personagem está nesta cena? */
  temPersonagem(personagem: number): boolean {
    return [...this.users.values()].some((u) => u.client.look?.charId === personagem);
  }

  /**
   * Larga o item no chão, na casa da peça do personagem: numa pilha ("Itens no
   * Chão") que qualquer um pode abrir e pegar. null = largou; texto = por que não.
   */
  largarNoChao(personagem: number, l: Loot): string | null {
    const u = [...this.users.values()].find((x) => x.client.look?.charId === personagem);
    if (!u) return 'O personagem não está nesta cena.';
    const pilha = this.map.allItems().find((it) => it.defId === PILHA_CHAO && it.x === u.x && it.y === u.y);
    if (pilha) {
      if ((pilha.loot ?? []).length >= 30) return 'A pilha no chão já tem 30 itens.';
      const next: FloorItem = { ...pilha, loot: [...(pilha.loot ?? []), l] };
      this.map.updateItem(next);
      this.broadcastFloor('itemUpdate', next);
    } else {
      const it: FloorItem = { id: this.hotel.nextItemId(), defId: PILHA_CHAO, x: u.x, y: u.y, z: this.map.floorHeight(u.x, u.y) ?? 0, rot: 0, state: 0, loot: [l] };
      this.map.addItem(it);
      this.broadcastFloor('itemAdd', it);
    }
    this.persist();
    this.hotel.touch();
    return null;
  }

  /** A Viagem desta cena mudou (cenário, hora, velocidade, destino): a luz acompanha a hora e todos que olham recebem. */
  definirViagem(v: ViagemInfo) {
    this.data.viagem = v;
    const hora = HORAS_VIAGEM.find((h) => h.id === v.hora);
    if (hora) {
      // o tempo fechado escurece a cena (a chuva, a tempestade e a neblina)
      const mais = v.clima === 'tempestade' ? 0.2 : v.clima === 'chuva' ? 0.1 : v.clima === 'neblina' ? 0.06 : 0;
      this.data.darkness = Math.min(0.9, hora.escuro + mais);
      this.data.ambient = hora.ambiente;
    }
    this.hotel.save();
    this.enviarInfo();
  }

  /** Clima ao vivo: luz (normal/piscando/apagão), névoa e escuridão; e a vista tática (a câmera em cima). */
  private fx(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.isOwner(c)) return this.err(c, 'Só o mestre controla o clima.');
    if (LIGHT_MODES.includes(m.lightMode as LightMode)) this.data.lightMode = m.lightMode as LightMode;
    if (isNum(m.fog)) this.data.fog = Math.max(0, Math.min(1, m.fog));
    if (isNum(m.darkness)) this.data.darkness = Math.max(0, Math.min(0.9, m.darkness));
    if (isNum(m.particleLevel)) this.data.particleLevel = Math.round(Math.max(0, Math.min(1, m.particleLevel)) * 100) / 100;
    if (typeof m.tatico === 'boolean') {
      if (m.tatico) this.data.tatico = true;
      else delete this.data.tatico;
    }
    this.hotel.save();
    this.enviarInfo();
  }

  /** O cômodo mudou (clima, vista, névoa): cada um que olha recebe o dele. */
  private enviarInfo() {
    for (const o of this.viewers.values()) o.send({ t: 'roomUpdate', room: this.info(o) });
  }

  /** Ponto de atenção ou desenho rápido do mestre: vai para todos que olham a cena (a mesa também) e não fica guardado. */
  private marca(u: RoomUser, raw: unknown) {
    const c = u.client;
    if (!this.isOwner(c)) return this.err(c, 'Só o mestre marca o tabuleiro.');
    const marca = sanitizeMarca(raw, this.map.width, this.map.height);
    if (marca) this.broadcast({ t: 'marca', marca });
  }

  /** A névoa desta planta (a de outra planta, de antes de o mestre mexer nela, começa de novo). */
  private nevoaAtual(): NevoaCena | null {
    const n = this.data.nevoa;
    if (!n) return null;
    const { auto, raio } = n;
    if (nevoaServe(n, this.map.width, this.map.height)) return n;
    this.data.nevoa = nevoaNova(this.map.width, this.map.height, !!auto);
    if (raio) this.data.nevoa.raio = raio;
    return this.data.nevoa;
  }

  /** A névoa revelada aos poucos: ligar, desligar, mostrar ou esconder tudo, o pincel e a abertura automática. */
  private nevoa(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.isOwner(c)) return this.err(c, 'Só o mestre mexe na névoa.');
    const w = this.map.width;
    const h = this.map.height;
    const atual = this.nevoaAtual();
    let nova: NevoaCena | null = atual;
    switch (m.acao) {
      case 'ligar':
        // a cena toda coberta, menos em volta dos agentes que já estão nela
        nova = nevoaNova(w, h, true);
        nova = this.abrirEmVoltaDosAgentes(nova);
        break;
      case 'desligar':
        nova = null;
        break;
      case 'tudo':
      case 'nada':
        if (!atual) return;
        nova = { ...atual, vista: (m.acao === 'tudo' ? '1' : '0').repeat(w * h) };
        // com a abertura automática, a volta dos agentes continua à vista
        if (m.acao === 'nada' && nova.auto) nova = this.abrirEmVoltaDosAgentes(nova);
        break;
      case 'pintar': {
        if (!atual || !Array.isArray(m.casas) || typeof m.vista !== 'boolean') return;
        const casas = (m.casas as unknown[]).slice(0, MAX_CASAS_PINCEL).flatMap((p) => (Array.isArray(p) && isInt(p[0]) && isInt(p[1]) ? [{ x: p[0], y: p[1] }] : []));
        nova = pintarNevoa(atual, casas, m.vista);
        break;
      }
      case 'auto': {
        if (!atual || typeof m.auto !== 'boolean') return;
        nova = { ...atual };
        if (m.auto) nova.auto = true;
        else delete nova.auto;
        if (isInt(m.raio)) nova.raio = Math.max(1, Math.min(NEVOA_RAIO_MAX, m.raio));
        if (nova.auto) nova = this.abrirEmVoltaDosAgentes(nova);
        break;
      }
      default:
        return;
    }
    if (nova === atual) return;
    if (nova) this.data.nevoa = nova;
    else delete this.data.nevoa;
    this.hotel.save();
    this.enviarInfo();
  }

  /** A névoa aberta em volta de cada agente da cena (as peças com ficha), no raio dela. */
  private abrirEmVoltaDosAgentes(n: NevoaCena, so?: RoomUser[]): NevoaCena {
    const r = n.raio ?? NEVOA_RAIO_PADRAO;
    let out = n;
    for (const u of so ?? this.users.values()) {
      if (!this.hotel.ehAgente(u.client.look?.charId)) continue;
      out = pintarNevoa(out, casasEmVolta(u.x, u.y, r), true);
      if (u.next) out = pintarNevoa(out, casasEmVolta(u.next.x, u.next.y, r), true);
    }
    return out;
  }

  /** Com a abertura automática ligada: a névoa abre em volta dos agentes que andaram. */
  private nevoaAutomatica(andaram: RoomUser[]) {
    const n = this.nevoaAtual();
    if (!n?.auto || !andaram.length) return;
    const nova = this.abrirEmVoltaDosAgentes(n, andaram);
    if (nova === n) return;
    this.data.nevoa = nova;
    this.hotel.save();
    this.enviarInfo();
  }

  private setLink(u: RoomUser, id: number, roomId: unknown) {
    const c = u.client;
    if (!this.canBuild(c)) return this.err(c, 'Sem permissão.');
    const it = this.map.getItem(id);
    if (!it || !getFurni(it.defId)?.portal) return;
    const next: FloorItem = { ...it };
    if (roomId === null) delete next.link;
    else if (isInt(roomId) && roomId !== this.data.id && this.hotel.roomExists(roomId)) next.link = roomId;
    else return this.err(c, 'Quarto de destino inválido.');
    this.map.updateItem(next);
    this.persist();
    this.broadcastFloor('itemUpdate', next);
  }

  private floorPlan(u: RoomUser, m: Record<string, unknown>) {
    const c = u.client;
    if (!this.isOwner(c)) return this.err(c, 'Só o dono pode editar a planta.');
    const hmSrc = typeof m.heightmap === 'string' ? m.heightmap : '';
    const e = validateHeightmap(hmSrc);
    if (e) return this.err(c, e);
    const d = m.door as Door | undefined;
    if (!d || !isInt(d.x) || !isInt(d.y) || !isInt(d.dir) || d.dir < 0 || d.dir > 7) return this.err(c, 'Porta inválida.');
    const probe = new RoomMap(hmSrc, d);
    if (probe.floorHeight(d.x, d.y) === null) return this.err(c, 'A porta precisa estar num piso.');

    // Reposiciona os mobis que ainda cabem; o resto volta para o inventário.
    const next = new RoomMap(hmSrc, { x: d.x, y: d.y, dir: d.dir });
    const returned: InvItem[] = [];
    for (const it of [...this.map.allItems()].sort((a, b) => a.z - b.z)) {
      const res = next.canPlace(it.defId, it.x, it.y, it.rot);
      if (res.ok) next.addItem({ ...it, z: res.z });
      else returned.push({ id: it.id, defId: it.defId });
    }
    for (const it of this.map.allWallItems()) {
      if (next.canPlaceWall(it.defId, it.wall, it.plane, it.pos, it.z).ok) next.setWallItem(it);
      else returned.push({ id: it.id, defId: it.defId });
    }
    if (returned.length) {
      this.hotel.inventory(c).push(...returned);
      this.hotel.sendInventory(c);
    }
    this.data.heightmap = hmSrc.replace(/\r/g, '').split('\n').map((r) => r.trim()).filter(Boolean).join('\n');
    this.data.door = { x: d.x, y: d.y, dir: d.dir };
    this.map = next;
    this.geo = null;
    this.persist();
    for (const o of this.users.values()) {
      o.x = d.x;
      o.y = d.y;
      o.z = this.map.standHeight(d.x, d.y);
      o.dir = o.headDir = d.dir;
      o.goal = o.next = null;
      o.sit = 0;
    }
    this.saveTokens();
    for (const o of this.viewers.values()) this.sendEnter(o);
    if (returned.length) this.err(c, `${returned.length} mobi(s) não couberam e voltaram para o inventário.`);
  }

  private persist() {
    this.data.items = this.map.allItems();
    this.data.wallItems = this.map.allWallItems();
    this.hotel.save();
    this.hotel.touch();
  }

  // ---------- contrato da sessão (shared/src/session.ts) ----------
  private geometry() {
    return (this.geo ??= sceneGrid(this.map.hm, this.data.door));
  }

  /** A cena como a interface recebe. */
  sceneInfo(): Scene {
    const { grid, aspect } = this.geometry();
    return {
      id: this.data.id,
      name: sceneShortName(this.data.name),
      title: this.data.name,
      floor: this.data.floor,
      description: this.data.description,
      aspect,
      grid,
      cols: this.map.width,
      rows: this.map.height,
      heightmap: this.data.heightmap,
      exits: this.portals().map((p) => ({ tile: { x: p.x, y: p.y }, pos: tileCenter(grid, p, this.map.floorHeight(p.x, p.y) ?? 0), to: p.link })),
      lightMode: this.data.lightMode ?? 'normal',
      fog: this.data.fog ?? 0,
      darkness: this.data.darkness,
    };
  }

  private tokenState(u: RoomUser): Token {
    const { grid } = this.geometry();
    const t: Token = { id: -u.client.id, sceneId: this.data.id, tile: { x: u.x, y: u.y }, pos: tileCenter(grid, u, u.z), dir: u.dir };
    if (u.next) t.to = tileCenter(grid, u.next, this.map.standHeight(u.next.x, u.next.y));
    return t;
  }

  /** Peças desta cena com os dados do personagem (ids positivos, como no contrato). */
  tokensLive() {
    return [...this.users.values()].map((u) => ({
      token: this.tokenState(u),
      name: u.client.name ?? '?',
      look: u.client.look,
      color: u.meta?.color,
      capacity: u.meta?.capacity,
      armed: !!u.meta?.armed,
      hurt: !!u.meta?.hurt,
      vitals: u.meta?.vitals,
    }));
  }

  hasToken(tokenId: number) {
    return this.users.has(-tokenId);
  }

  /** Centro e topo do objeto no quadro da cena. */
  private objectPos(it: FloorItem | WallItem, kind: 'floor' | 'wall'): { pos: NormPoint; top: NormPoint } {
    const { grid } = this.geometry();
    if (kind === 'floor') {
      const f = it as FloorItem;
      const def = getFurni(f.defId);
      const fp = def ? footprint(def, f.rot) : { sx: 1, sy: 1 };
      const cx = f.x + fp.sx / 2;
      const cy = f.y + fp.sy / 2;
      const h = def?.height ?? 1;
      return { pos: tileToPoint(grid, cx, cy, f.z + h / 2), top: tileToPoint(grid, cx, cy, f.z + h) };
    }
    const w = it as WallItem;
    const hz = (getWallFurni(w.defId)?.h ?? 32) / 32;
    const at = (z: number) => (w.wall === 'l' ? tileToPoint(grid, w.plane, w.pos, z) : tileToPoint(grid, w.pos, w.plane, z));
    return { pos: at(w.z + hz / 2), top: at(w.z + hz) };
  }

  /** Objetos que importam (pista, itens ou interações) e os itens deles, filtrados pelo papel. */
  sessionObjects(role: Role): { objects: SceneObject[]; items: Item[] } {
    const gm = role === 'gm';
    const objects: SceneObject[] = [];
    const items: Item[] = [];
    const add = (it: FloorItem | WallItem, kind: 'floor' | 'wall') => {
      const hint = it.hint && (it.hint.visible || gm) ? it.hint : undefined;
      const loot = (it.loot ?? []).filter((l) => gm || l.revealed);
      const actions = it.actions ?? [];
      if (!hint && !loot.length && !actions.length) return;
      const desc = kind === 'floor' ? getFurni(it.defId)?.desc : getWallFurni(it.defId)?.desc;
      objects.push({
        id: it.id,
        sceneId: this.data.id,
        kind,
        defId: it.defId,
        name: hint?.title || anyFurniName(it.defId),
        description: hint?.text || desc || '',
        hidden: gm && !!it.hint && !it.hint.visible,
        ...this.objectPos(it, kind),
        itemIds: loot.map((l) => l.id),
        interactions: actions.map((a) => ({ id: a.id, label: a.label, dt: a.dt })),
      });
      for (const l of loot)
        items.push({
          id: l.id,
          name: l.name,
          espacos: l.espacos,
          ...(l.descricao ? { descricao: l.descricao } : {}),
          kind: l.kind,
          kindLabel: lootKindLabel(l.kind),
          sceneId: this.data.id,
          objectId: it.id,
          holderId: null,
          holderName: l.holder ?? null,
          revealed: !!l.revealed,
        });
    };
    for (const it of this.map.allItems()) add(it, 'floor');
    for (const it of this.map.allWallItems()) add(it, 'wall');
    return { objects, items };
  }

  /**
   * Leva a peça até o ponto: a casa livre mais próxima dele.
   * walk = anda desviando dos móveis; place = aparece direto lá.
   * Devolve o motivo quando não dá.
   */
  moveTokenTo(tokenId: number, to: NormPoint | Tile, isTile: boolean, mode: 'walk' | 'place'): string | null {
    const u = this.users.get(-tokenId);
    if (!u) return 'Essa peça não está nesta cena.';
    const { grid } = this.geometry();
    const p = isTile ? tileCenter(grid, to as Tile, this.map.floorHeight(to.x, to.y) ?? 0) : (to as NormPoint);
    const free = (x: number, y: number) => this.map.walkState(x, y) !== 'blocked' && !this.occupied(x, y, u.client.id);
    const near = tilesByDistance(grid, this.map.hm, p, free).slice(0, 24);
    if (!near.length) return 'Não há casa livre perto desse ponto.';
    if (mode === 'place') {
      const t = near[0];
      u.x = t.x;
      u.y = t.y;
      u.goal = u.next = null;
      u.sit = 0;
      u.z = this.map.standHeight(t.x, t.y);
      // colocada em cima de uma passagem: só viaja depois de sair dela
      u.arrivedAt = { x: t.x, y: t.y };
      this.settle(u);
      u.dirty = false;
      this.broadcast({ t: 'status', updates: [this.status(u)] });
      this.broadcast({ t: 'tokens', sceneId: this.data.id, tokens: [this.tokenState(u)] });
      this.saveTokens();
      return null;
    }
    for (const t of near) {
      if (t.x === u.x && t.y === u.y) {
        u.goal = null;
        return null;
      }
      const path = findPath(this.map, u, t, (x, y) => this.occupied(x, y, u.client.id));
      if (path && path.length) {
        u.goal = t;
        this.ensureTimer();
        return null;
      }
    }
    return 'Não há caminho até esse ponto.';
  }

  /** Nomes das peças desta cena (minúsculas). */
  tokenNames(exceptTokenId?: number) {
    return [...this.users.values()].filter((u) => -u.client.id !== exceptTokenId).map((u) => (u.client.name ?? '').toLowerCase());
  }

  /** Itens com `oldName` passam para `newName`. */
  renameHolder(oldName: string, newName: string) {
    const key = oldName.toLowerCase();
    let changed = false;
    const fix = <T extends FloorItem | WallItem>(it: T): T | null => {
      if (!it.loot?.some((l) => l.holder?.toLowerCase() === key)) return null;
      return { ...it, loot: it.loot.map((l) => (l.holder?.toLowerCase() === key ? { ...l, holder: newName } : l)) };
    };
    for (const it of this.map.allItems()) {
      const next = fix(it);
      if (!next) continue;
      this.map.updateItem(next);
      this.broadcastFloor('itemUpdate', next);
      changed = true;
    }
    for (const it of this.map.allWallItems()) {
      const next = fix(it);
      if (!next) continue;
      this.map.setWallItem(next);
      this.broadcastWall('wallUpdate', next);
      changed = true;
    }
    if (changed) this.persist();
  }

  /** Vira a peça parada para `dir` (0..7) e avisa todos na hora. Devolve o motivo quando não dá. */
  faceToken(tokenId: number, dir: number): string | null {
    const u = this.users.get(-tokenId);
    if (!u) return 'Essa peça não está nesta cena.';
    if (!isInt(dir) || dir < 0 || dir > 7) return 'Direção inválida: use de 0 a 7.';
    if (u.next || u.goal) return 'Espere a peça parar de andar.';
    // sentada numa cadeira, o corpo segue a cadeira; só a cabeça vira
    if (u.sit !== 1) u.dir = dir;
    u.headDir = dir;
    u.headResetAt = 0;
    u.dirty = false;
    this.broadcast({ t: 'status', updates: [this.status(u)] });
    this.broadcast({ t: 'tokens', sceneId: this.data.id, tokens: [this.tokenState(u)] });
    this.saveTokens();
    return null;
  }

  /** Onde está o item (id do Loot). */
  findLoot(lootId: number): { it: FloorItem | WallItem; loot: Loot } | null {
    for (const it of [...this.map.allItems(), ...this.map.allWallItems()]) {
      const loot = it.loot?.find((l) => l.id === lootId);
      if (loot) return { it, loot };
    }
    return null;
  }

  /** Entrega o item a alguém (ou devolve ao objeto, com toName = null). */
  giveLoot(by: Client, lootId: number, toName: string | null) {
    const found = this.findLoot(lootId);
    if (!found) return 'Item não encontrado.';
    this.editItemRpg({ client: by } as RoomUser, found.it.id, { t: 'lootGive', lootId, to: toName ?? '' });
    return null;
  }
}
