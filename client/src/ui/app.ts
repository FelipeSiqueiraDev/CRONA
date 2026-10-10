import type { AvatarLook, CharacterDef, Criatura, InvItem, LugarInfo, Role, RoomInfo, RoomSummary } from '@crona/shared';
import type { Net } from '../net';
import type { RoomView } from '../room/RoomView';
import { SessionStore } from '../session/store';

export interface Me {
  id: number;
  name: string;
  look: AvatarLook;
  token: string;
}

export interface AppState {
  me: Me | null;
  inventory: InvItem[];
  characters: CharacterDef[];
  rooms: RoomSummary[];
  /** os lugares do mapa-múndi (chega quando o mapa abre) */
  lugares: LugarInfo[];
  /** o bestiário (só o mestre; chega quando a janela Criaturas abre) */
  bestiario: Criatura[];
  room: RoomInfo | null;
  /** mestre controla; jogador só acompanha (vem do servidor no login) */
  role: Role;
}

export type AppEvent = 'me' | 'inventory' | 'characters' | 'rooms' | 'lugares' | 'bestiario' | 'room' | 'selection' | 'items' | 'placement';

export class App {
  state: AppState = { me: null, inventory: [], characters: [], rooms: [], lugares: [], bestiario: [], room: null, role: 'player' };
  net: Net;
  /** sessão compartilhada (contrato novo, docs/CONTRATO.md) */
  readonly session: SessionStore;
  view!: RoomView;
  /** peça a comandar assim que a cena carregar */
  pendingActive: number | null = null;
  private listeners = new Map<AppEvent, Set<() => void>>();

  constructor(net: Net) {
    this.net = net;
    this.session = new SessionStore((m) => net.send(m));
  }

  on(evt: AppEvent, fn: () => void) {
    let s = this.listeners.get(evt);
    if (!s) this.listeners.set(evt, (s = new Set()));
    s.add(fn);
  }

  off(evt: AppEvent, fn: () => void) {
    this.listeners.get(evt)?.delete(fn);
  }

  emit(evt: AppEvent) {
    for (const fn of this.listeners.get(evt) ?? []) fn();
  }

  get canBuild() {
    return !!this.state.room?.canBuild;
  }

  get isGm() {
    return this.state.role === 'gm';
  }
}
