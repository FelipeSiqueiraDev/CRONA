import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  BANCOS_VAN,
  getFurni,
  lerCriatura,
  aparenciaDaVez,
  heightmapDaVan,
  isCenarioViagem,
  iconePeloNome,
  ambienteDoDestino,
  artesDeChegada,
  ILUSTRACOES_VIAGEM,
  isClimaViagem,
  sortearIlustracao,
  posicaoInicial,
  isHoraViagem,
  moveisDaVan,
  VAN,
  type BancoVan,
  type LugarInfo,
  type ViagemInfo,
  DIR_KEYS,
  getLayout,
  MAX_NAME,
  sanitizeCharPatch,
  sanitizeLook,
  type CharacterDef,
  type InvItem,
  DEFAULT_CAPACITY,
  parseHeightmap,
  playerColorFor,
  SESSION_ACTIONS,
  sceneShortName,
  type CampaignState,
  type Character,
  type Item,
  type LogIcon,
  type NormPoint,
  type PartyMember,
  type Role,
  type RoomSummary,
  type SceneInfo,
  type SceneObject,
  type ServerMsg,
  type Session,
  type SessionActionType,
  type Tile,
  type Token,
  type VitalKey,
  type Vitals,
  VITAL_LABEL,
  regras,
  bar,
  combate as cmb,
  sanitizarFicha,
  sanitizarDocumento,
  documentoDaFicha,
  documentoParaJogador,
  MAX_DOCUMENTOS,
  type FichaSalva,
  ACOES_MOCHILA,
  itemParaLoot,
  lootParaItem,
  noCatalogo,
  type AcaoMochila,
  type Loot,
  type PapelConta,
  MAPA_AREA_MAX,
  MAPA_MAX,
  MAPA_MIN,
  URL_MAPA_RE,
} from '@crona/shared';
import { confereSenha, contaDaSessao, EMAIL_RE, fecharSessao, hashSenha, novaSessao, SENHA_MIN, type Conta } from './contas';
import { loadDb, saveDbNow, scheduleSave, type CampaignData, type Database, type RoomData, type TokenData, type UserData } from './db';
import { RoomInstance, type Client, type HotelApi } from './roomInstance';
import { refreshPortraits } from './portraits';
import { limparSalasDeExemplo, seedDb, SYSTEM_OWNER, upgradeDb } from './seed';

const NAME_RE = /^[\p{L}\p{N}_\-. ]+$/u;
const STARTER: string[] = ['chair_wood', 'table_small', 'candles', 'crate_wood', 'plant'];

/** Mensagens que mudam o tabuleiro: só o mestre manda (o resto recebe "Só o mestre..."). */
/** Uma mesa do bar: o móvel (id), o jogo, quem joga em cada lugar (sem ficha = NPC do mestre) e as jogadas guardadas. */
interface MesaBar {
  id: number;
  tipo: bar.TipoJogoBar;
  lugares: { tokenId: number; nome: string; fichaId?: number }[];
  log: Record<string, unknown>[];
}
const NOME_MESA: Record<bar.TipoJogoBar, string> = { fliperama: 'o Feliperama', dardos: 'os dardos', sinuca: 'a sinuca' };
/** "no Feliperama", "nos dardos", "na sinuca" */
const NOME_EM: Record<bar.TipoJogoBar, string> = { fliperama: 'no Feliperama', dardos: 'nos dardos', sinuca: 'na sinuca' };

/** As chaves do combate que guardam o id de uma peça (as outras contas, como a rodada, ficam como estão). */
const CHAVES_DE_PECA = new Set(['id', 'quem', 'alvo', 'ator', 'alvos', 'participantes', 'ids', 'de', 'para']);

/** Troca os ids de peça pelo mapa: nos campos de peça, no "p:<id>" das entradas e nas chaves por id. */
function trocarIds(v: unknown, mapa: Map<number, number>, chave?: string): unknown {
  if (typeof v === 'number') return chave && CHAVES_DE_PECA.has(chave) ? (mapa.get(v) ?? v) : v;
  if (typeof v === 'string') {
    const m = /^p:(\d+)$/.exec(v);
    return m && mapa.has(Number(m[1])) ? `p:${mapa.get(Number(m[1]))}` : v;
  }
  if (Array.isArray(v)) return v.map((x) => trocarIds(x, mapa, chave));
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const nk = /^\d+$/.test(k) && mapa.has(Number(k)) ? String(mapa.get(Number(k))) : k;
      o[nk] = trocarIds(x, mapa, k);
    }
    return o;
  }
  return v;
}

const GM_ONLY = new Set([
  'createRoom',
  'barJogar',
  'charUpdate',
  'charDelete',
  'sendTo',
  'objAdd',
  'objToggle',
  'objRemove',
  'campaignSet',
  'layoutSet',
  'planNota',
  'capacitySet',
  'tokenAdd',
  'tokenEdit',
  'tokenRemove',
  'tokenWalk',
  'tokenFace',
  'tokenScene',
  'vitals',
  'fichaApagar',
  'fichaLink',
  'docSalvar',
  'docApagar',
  'mochilaNova',
  'interludio',
  'bonusInterludio',
  'place',
  'placeWall',
  'moveItem',
  'moveWallItem',
  'pickup',
  'use',
  'setHint',
  'roomSettings',
  'roomFx',
  'marca',
  'nevoa',
  'mapaImprovisado',
  'mapaApagar',
  'viagem',
  'grupoPara',
  'visitada',
  'setLink',
  'unlock',
  'relock',
  'lootAdd',
  'lootRemove',
  'lootGive',
  'lootReveal',
  'actionAdd',
  'actionRemove',
  'actionLog',
  'floorPlan',
  'combate',
  'ameaca',
]);

/** Quantos estados do combate o "Desfazer" guarda por campanha. */
const MAX_DESFAZER = 40;

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface HotelOptions {
  /** banco em memória (testes); sem ele, lê server/data/db.json */
  db?: Database;
  /** false = não grava nada em disco (testes) */
  persist?: boolean;
  /** false = nada roda sozinho; o teste chama pushNow() e room.step() */
  timers?: boolean;
}

export class Hotel implements HotelApi {
  db: Database;
  rooms = new Map<number, RoomInstance>();
  readonly timers: boolean;
  private persist: boolean;
  private clients = new Map<number, Client>();
  private byToken = new Map<string, Client>();
  private nextClientId = 1;
  private listTimer: NodeJS.Timeout | null = null;
  private touchTimer: NodeJS.Timeout | null = null;

  constructor(opts: HotelOptions = {}) {
    this.persist = opts.persist ?? true;
    this.timers = opts.timers ?? true;
    const loaded = opts.db ? null : loadDb();
    this.db = opts.db ?? loaded ?? seedDb();
    let dirty = upgradeDb(this.db) || (!loaded && !opts.db);
    // só em banco guardado (os testes montam o deles): tira as salas de exemplo antigas, uma vez
    if (loaded && limparSalasDeExemplo(this.db)) dirty = true;
    if (!this.db.gmKey) {
      this.db.gmKey = crypto.randomBytes(9).toString('base64url');
      dirty = true;
    }
    if (refreshPortraits(this.db.characters)) dirty = true;
    for (const r of this.db.rooms) this.rooms.set(r.id, new RoomInstance(r, this));
    if (this.migrarMochilas()) dirty = true;
    if (dirty && this.persist) saveDbNow(this.db);
    // peças de agente que ainda não têm PV/PE/SAN pegam os da ficha (a MAPA e o combate usam)
    for (const f of this.db.fichas ?? [])
      if (f.personagem)
        try {
          this.fichaParaPecas(f, true);
        } catch (e) {
          console.error(`[fichas] ficha ${f.id} com erro nas regras`, e);
        }
    if (this.persist) console.log(`[hotel] ${this.rooms.size} quarto(s), ${this.db.characters.length} personagem(ns)`);
    if (this.timers) {
      setInterval(() => this.pushScenes(), 1500);
      // retratos e poses do tabuleiro novos na pasta do personagem aparecem sem reiniciar o servidor
      setInterval(() => this.checkPortraits(), 5000);
    }
  }

  /** Procura retratos e poses do tabuleiro novos (ou removidos) nas pastas dos personagens. */
  checkPortraits() {
    if (!refreshPortraits(this.db.characters)) return;
    this.save();
    this.broadcastCharacters();
  }

  /** Chave do link do mestre. */
  get gmKey() {
    return this.db.gmKey!;
  }

  private checkGmKey(key: string) {
    const a = Buffer.from(key);
    const b = Buffer.from(this.gmKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // ---------- minimapa: cenas ligadas por Passagens ----------
  private sceneGroup(roomId: number): number[] {
    const adj = new Map<number, Set<number>>();
    const link = (a: number, b: number) => {
      if (!this.rooms.has(a) || !this.rooms.has(b)) return;
      (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
      (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
    };
    for (const r of this.rooms.values()) for (const p of r.portals()) link(r.data.id, p.link);
    // a Viagem pertence à campanha de onde partiu
    for (const r of this.rooms.values()) if (r.data.viagem) link(r.data.id, r.data.viagem.origem);
    const seen = new Set([roomId]);
    const queue = [roomId];
    while (queue.length) for (const n of adj.get(queue.shift()!) ?? []) if (!seen.has(n)) (seen.add(n), queue.push(n));
    return [...seen];
  }

  // ---------- campanha (tela MAPA) ----------
  private campaignFor(key: number): CampaignData {
    const all = (this.db.campaigns ??= {});
    let c = all[String(key)];
    if (!c) {
      const r = this.rooms.get(key);
      const [title, sub] = (r?.data.name ?? 'Campanha').split('·').map((s) => s.trim());
      c = { title: title || 'Campanha', subtitle: sub ?? '', objectives: [], layout: {}, log: [] };
      all[String(key)] = c;
    }
    return c;
  }

  private groupKey(roomId: number) {
    return Math.min(...this.sceneGroup(roomId));
  }

  log(roomId: number, icon: LogIcon, text: string) {
    const c = this.campaignFor(this.groupKey(roomId));
    c.log.push({ at: Date.now(), icon, text });
    if (c.log.length > 60) c.log.splice(0, c.log.length - 60);
    this.save();
    this.touch();
  }

  /** Mudanças de PV/PE/SAN esperando para ir ao registro (cliques seguidos viram uma linha). */
  private vitalLog = new Map<string, { roomId: number; name: string; key: VitalKey; from: number; to: number; max: number; timer: NodeJS.Timeout | null }>();

  // ---------- combate (docs/COMBATE.md) ----------
  /** estados anteriores do combate de cada campanha, para o "Desfazer" (só na memória), com os PV/PE/SAN que cada passo mudou */
  /** as mesas do bar (o fliperama, o alvo, a sinuca), pelo id do móvel: quem joga em cada lugar e as jogadas guardadas */
  private mesas = new Map<number, MesaBar>();
  private desfazeres = new Map<number, { combate: string; vitais: { id: number; antes: Vitals }[]; mochilas?: { fichaId: number; inventario: regras.ItemFicha[] }[]; largados?: number[] }[]>();

  /** Peças da campanha e os PV/SAN delas, para as regras do combate. */
  private contextoCombate(group: number[], cena: number): cmb.Contexto {
    const agentes = new Set((this.db.fichas ?? []).map((f) => f.personagem).filter((x): x is number => !!x));
    const pecas: cmb.PecaCombate[] = [];
    const vitais = new Map<number, Vitals>();
    for (const id of group) {
      const r = this.rooms.get(id);
      if (!r) continue;
      for (const t of r.tokensLive()) {
        pecas.push({ id: t.token.id, nome: t.name, agente: !!t.look.charId && agentes.has(t.look.charId), naCena: id === cena });
        if (t.vitals) vitais.set(t.token.id, { ...t.vitals });
      }
    }
    const ameacas = this.fichasDasAmeacas(group, this.campaignFor(Math.min(...group)));
    return { agora: Date.now(), cena, pecas, vitais: (id) => vitais.get(id) ?? null, ameaca: (id) => ameacas[String(id)] ?? null };
  }

  /**
   * As fichas das ameaças da campanha, por peça: a que o mestre editou para aquela peça (`ameacas`) ou, sem ela, a da
   * criatura do bestiário que a peça é (10 Existidos leem a mesma ficha).
   */
  private fichasDasAmeacas(group: number[], camp: CampaignData): Record<string, cmb.FichaAmeaca> {
    const out: Record<string, cmb.FichaAmeaca> = {};
    const bestiario = new Map((this.db.bestiario ?? []).map((c) => [c.id, c]));
    for (const id of group)
      for (const [tokenId, pc] of this.rooms.get(id)?.criaturasDasPecas() ?? []) {
        const c = bestiario.get(pc.id);
        if (c) out[String(tokenId)] = c.ficha;
      }
    return { ...out, ...(camp.ameacas ?? {}) };
  }

  // ---------- o bestiário (10/10) ----------
  private bestiarioPara(c: Client) {
    if (c.role === 'gm') c.send({ t: 'bestiario', criaturas: this.db.bestiario ?? [] });
  }

  private bestiarioMudou() {
    this.save();
    this.touch();
    for (const o of this.clients.values()) this.bestiarioPara(o);
    // as fichas do combate (a da criatura mudou): os mestres recebem de novo
    this.touch();
  }

  /** A arte de uma aparência: o personagem (folha) da pasta arte/personagens/<arte>/, se o Códex já entregou. */
  private charDaArte(arte?: string): number | null {
    if (!arte) return null;
    const ch = this.db.characters.find((x) => x.sheet.includes(`/personagens/${arte}/`));
    return ch ? ch.id : null;
  }

  private bestiarioMsg(c: Client, m: Record<string, unknown>) {
    if (c.role !== 'gm') return;
    if (m.t === 'bestiario') return this.bestiarioPara(c);
    this.db.bestiario ??= [];
    if (m.t === 'criaturaSalvar') {
      const cr = lerCriatura(m.criatura);
      if (!cr) return c.send({ t: 'error', msg: 'Criatura inválida: confira o nome, a ficha, os PV e as aparências.' });
      const i = this.db.bestiario.findIndex((x) => x.id === cr.id);
      if (i >= 0) this.db.bestiario[i] = cr;
      else this.db.bestiario.push(cr);
      return this.bestiarioMudou();
    }
    if (m.t === 'criaturaApagar' && typeof m.id === 'string') {
      this.db.bestiario = this.db.bestiario.filter((x) => x.id !== m.id);
      return this.bestiarioMudou();
    }
    const room = c.room;
    if (!room) return;
    if (m.t === 'criaturaColocar') {
      const cr = this.db.bestiario.find((x) => x.id === m.criaturaId);
      if (!cr) return c.send({ t: 'error', msg: 'Criatura não encontrada.' });
      const n = typeof m.quantidade === 'number' && Number.isInteger(m.quantidade) ? Math.max(1, Math.min(20, m.quantidade)) : 1;
      if (room.tokenList().length + n > 30) return c.send({ t: 'error', msg: 'Máximo de 30 peças por cena.' });
      const escolha = typeof m.aparencia === 'string' ? m.aparencia : 'variadas';
      const lista: TokenData[] = [];
      let k = 1;
      for (let i = 0; i < n; i++) {
        while (this.tokenNameTaken(room.data.id, `${cr.nome} ${k}`) || lista.some((t) => t.name === `${cr.nome} ${k}`)) k++;
        const ap = aparenciaDaVez(cr, escolha, i);
        lista.push({
          id: this.nextItemId(),
          name: `${cr.nome} ${k}`,
          look: { ...ap.look, charId: this.charDaArte(ap.arte) },
          x: room.data.door.x,
          y: room.data.door.y,
          dir: room.data.door.dir,
          color: '#b3261e',
          vitals: { pv: cr.pv, pvMax: cr.pv, pe: 0, peMax: 0, san: 0, sanMax: 0 },
          criatura: { id: cr.id, aparencia: ap.id },
          ...(cr.flutua ? { flutua: true } : {}),
        });
      }
      room.colocarVarias(lista);
      return c.send({ t: 'notice', msg: `${n} ${n === 1 ? cr.nome : `${cr.nome}s`} em campo, todos com a mesma ficha.` });
    }
    if (m.t === 'pecaAparencia' && typeof m.tokenId === 'number' && typeof m.aparencia === 'string') {
      const pc = room.criaturasDasPecas().get(m.tokenId);
      const cr = pc && this.db.bestiario.find((x) => x.id === pc.id);
      const ap = cr?.aparencias.find((a) => a.id === m.aparencia);
      if (!cr || !ap) return;
      room.trocarAparencia(m.tokenId, { id: cr.id, aparencia: ap.id }, { ...ap.look, charId: this.charDaArte(ap.arte) });
    }
  }

  /** Uma ação da tela de combate (só o mestre). */
  private combateAcao(c: Client, m: Record<string, unknown>) {
    const room = c.room;
    if (!room) return;
    const a = cmb.lerAcao(m.a);
    if (!a) return c.send({ t: 'denied', action: 'combate', reason: 'Ação de combate inválida.' });
    const group = this.sceneGroup(room.data.id);
    const key = Math.min(...group);
    const camp = this.campaignFor(key);
    this.religarCombate(group, camp);
    const pilha = this.desfazeres.get(key) ?? [];
    this.desfazeres.set(key, pilha);
    if (a.tipo === 'desfazer') {
      const passo = pilha.pop();
      if (passo === undefined) return c.send({ t: 'denied', action: 'combate', reason: 'Nada para desfazer.' });
      const volta = JSON.parse(passo.combate) as cmb.Combate | null;
      if (volta) camp.combate = volta;
      else delete camp.combate;
      // o que o passo mudou nas peças volta também: PV, o item que caiu no chão e a mochila
      for (const x of passo.vitais) this.mudarVitaisPeca(group, x.id, x.antes);
      for (const uid of passo.largados ?? []) for (const id of group) if (this.rooms.get(id)?.retirarLoot(uid)) break;
      for (const x of passo.mochilas ?? []) {
        const f = (this.db.fichas ?? []).find((y) => y.id === x.fichaId);
        if (!f) continue;
        this.trocarMochila(f, x.inventario);
        this.fichaMudou(f);
      }
      this.save();
      this.touch();
      return;
    }
    const antes = camp.combate ?? null;
    // sacar: confere a mão antes de gastar a ação de movimento
    let sacar: { f: FichaSalva; inventario: regras.ItemFicha[] } | null = null;
    if (a.tipo === 'declarar' && typeof a.sacar === 'number') {
      const f = this.fichaDaPeca(group, a.quem);
      if (!f) return c.send({ t: 'denied', action: 'combate', reason: 'Sem ficha: não há mochila para sacar.' });
      const e = regras.empunhar(f.ficha.inventario, a.sacar, true);
      if (!e.ok) return c.send({ t: 'denied', action: 'combate', reason: e.motivo });
      sacar = { f, inventario: e.inventario };
    }
    const r = cmb.aplicar(antes, a, this.contextoCombate(group, room.data.id));
    if (!r.ok) return c.send({ t: 'denied', action: 'combate', reason: r.motivo });
    const mochilas: { fichaId: number; inventario: regras.ItemFicha[] }[] = [];
    const largados: number[] = [];
    if (sacar) {
      mochilas.push({ fichaId: sacar.f.id, inventario: sacar.f.ficha.inventario });
      this.trocarMochila(sacar.f, sacar.inventario);
      this.fichaMudou(sacar.f);
    }
    // desarmar: o item da mão do alvo cai no chão, na casa dele (LR p. 85)
    if (a.tipo === 'manobra' && a.manobra.manobra === 'desarmar' && a.manobra.venceu) {
      const caiu = this.desarmar(group, a.manobra.alvo, a.manobra.item);
      if (caiu) {
        mochilas.push(caiu.antes);
        largados.push(caiu.uid);
      }
    }
    const mudou: { id: number; antes: Vitals }[] = [];
    for (const m of r.vitais ?? []) {
      const velho = this.mudarVitaisPeca(group, m.id, m);
      if (velho) mudou.push({ id: m.id, antes: velho });
    }
    pilha.push({ combate: JSON.stringify(antes), vitais: mudou, ...(mochilas.length ? { mochilas } : {}), ...(largados.length ? { largados } : {}) });
    if (pilha.length > MAX_DESFAZER) pilha.splice(0, pilha.length - MAX_DESFAZER);
    if (r.combate) camp.combate = r.combate;
    else delete camp.combate;
    // o começo e o fim do combate vão também para o registro da sessão
    if (a.tipo === 'comecar') this.log(room.data.id, 'dice', 'Combate começou.');
    if (a.tipo === 'encerrar' && antes?.fase === 'andamento') this.log(room.data.id, 'dice', `Combate encerrado na rodada ${antes.rodada}.`);
    this.save();
    this.touch();
  }

  /** Ficha do ser do combate (o id é o da peça). */
  private fichaDaPeca(group: number[], tokenId: number | undefined): FichaSalva | undefined {
    if (typeof tokenId !== 'number') return undefined;
    for (const id of group) {
      const t = this.rooms.get(id)?.tokensLive().find((x) => x.token.id === tokenId);
      if (t) return this.fichaDoPersonagem(t.look?.charId);
    }
    return undefined;
  }

  /** O item da mão do alvo (o escolhido ou a primeira arma) cai no chão, na casa dele. */
  private desarmar(group: number[], alvo: number, uid: number | undefined): { antes: { fichaId: number; inventario: regras.ItemFicha[] }; uid: number } | null {
    const f = this.fichaDaPeca(group, alvo);
    if (!f?.personagem) return null;
    const inv = f.ficha.inventario;
    const naMao = inv.filter((it) => regras.lugarDoItem(it) === 'mao');
    const it = naMao.find((x) => x.uid === uid) ?? naMao.find((x) => x.tipo === 'arma') ?? naMao[0];
    if (!it || !Number.isInteger(it.uid)) return null;
    const s = regras.retirar(inv, it.uid!);
    if (!s.ok) return null;
    const sala = group.map((id) => this.rooms.get(id)).find((r) => r?.temPersonagem(f.personagem!));
    if (!sala || sala.largarNoChao(f.personagem, itemParaLoot(s.item))) return null;
    this.trocarMochila(f, s.inventario);
    this.fichaMudou(f);
    return { antes: { fichaId: f.id, inventario: inv }, uid: it.uid! };
  }

  /** PV, PE ou SAN de uma peça da campanha (procura a cena em que ela está). Devolve os de antes. */
  private mudarVitaisPeca(group: number[], tokenId: number, m: { pv?: number; pe?: number; san?: number }): Vitals | null {
    for (const id of group) {
      const antes = this.rooms.get(id)?.mudarVitais(tokenId, m);
      if (antes) return antes;
    }
    return null;
  }

  /** Ficha rápida de ameaça de uma peça (só o mestre), guardada na campanha. */
  private ameacaSalvar(c: Client, m: Record<string, unknown>) {
    const room = c.room;
    if (!room || typeof m.tokenId !== 'number') return;
    const group = this.sceneGroup(room.data.id);
    const existe = group.some((id) => this.rooms.get(id)?.tokensLive().some((t) => t.token.id === m.tokenId));
    if (!existe) return c.send({ t: 'denied', action: 'ameaca', reason: 'Peça não encontrada nesta campanha.' });
    const camp = this.campaignFor(Math.min(...group));
    camp.ameacas ??= {};
    if (m.ficha === null) delete camp.ameacas[String(m.tokenId)];
    else {
      const f = cmb.lerFichaAmeaca(m.ficha);
      if (!f) return c.send({ t: 'denied', action: 'ameaca', reason: 'Ficha inválida.' });
      camp.ameacas[String(m.tokenId)] = f;
    }
    this.save();
    this.touch();
  }


  // ---------- mochila: um inventário só (docs/REGRAS.md, Mochila) ----------
  /** contas de cada ficha (a carga vai na sessão a cada envio), até a ficha mudar */
  private calcCache = new WeakMap<regras.Ficha, regras.Calculado | null>();

  private calcDe(f: FichaSalva): regras.Calculado | null {
    let c = this.calcCache.get(f.ficha);
    if (c === undefined) {
      try {
        c = regras.calcular(f.ficha);
      } catch (e) {
        console.error(`[fichas] ficha ${f.id} com erro nas regras`, e);
        c = null;
      }
      this.calcCache.set(f.ficha, c);
    }
    return c;
  }

  /** Ficha ligada à folha de sprite do personagem. */
  private fichaDoPersonagem(personagem: number | null | undefined): FichaSalva | undefined {
    return personagem ? (this.db.fichas ?? []).find((f) => f.personagem === personagem) : undefined;
  }

  /** Ficha da peça com esse nome na campanha da cena. */
  private fichaPeloNome(roomId: number, nome: string): FichaSalva | undefined {
    const key = nome.toLowerCase();
    for (const id of this.sceneGroup(roomId)) {
      const t = this.rooms.get(id)?.tokensLive().find((x) => x.name.toLowerCase() === key);
      if (t) return this.fichaDoPersonagem(t.look?.charId);
    }
    return undefined;
  }

  /** A cena onde está a peça do personagem (de preferência a do mestre). */
  private salaDoPersonagem(personagem: number | null | undefined, prefere?: RoomInstance | null): RoomInstance | undefined {
    if (!personagem) return undefined;
    if (prefere?.temPersonagem(personagem)) return prefere;
    // cada campanha tem a sua peça do mesmo personagem: primeiro a campanha de quem está olhando
    if (prefere) for (const id of this.sceneGroup(prefere.data.id)) if (this.rooms.get(id)?.temPersonagem(personagem)) return this.rooms.get(id);
    return [...this.rooms.values()].find((r) => r.temPersonagem(personagem));
  }

  /** Mochila nova (objeto novo: as contas guardadas eram da antiga). */
  private trocarMochila(f: FichaSalva, inventario: regras.ItemFicha[]) {
    f.ficha = { ...f.ficha, inventario };
    f.atualizadaEm = new Date().toISOString();
  }

  /** O Armado das peças do personagem acompanha a mão. */
  private sincronizarArmado(f: FichaSalva): boolean {
    if (!f.personagem) return false;
    const armado = regras.armado(f.ficha.inventario);
    let mudou = false;
    for (const r of this.rooms.values()) mudou = r.definirArmado(f.personagem, armado) || mudou;
    return mudou;
  }

  /** A mochila mudou: o Armado acompanha e todos recebem. */
  private fichaMudou(f: FichaSalva) {
    this.sincronizarArmado(f);
    this.save();
    this.enviarFichas();
    this.touch();
  }

  /** A arma na mão da ficha: de fogo (fogo e disparo) ou branca. */
  private armaNaMao(f: FichaSalva): 'fogo' | 'branca' {
    const it = f.ficha.inventario.find((x) => x.tipo === 'arma' && regras.lugarDoItem(x) === 'mao');
    const tipo = it ? regras.catalogo.arma(it.id)?.tipo : undefined;
    return tipo === 'fogo' || tipo === 'disparo' ? 'fogo' : 'branca';
  }

  /** Cabe na carga? Passar do dobro não dá (LR p. 53). null = cabe. */
  private naoCabe(f: FichaSalva, it: regras.ItemFicha): string | null {
    let c: regras.Calculado;
    try {
      c = regras.calcular({ ...f.ficha, inventario: [...f.ficha.inventario, it] });
    } catch {
      return null;
    }
    if (c.carga.usados <= c.carga.maximo) return null;
    return `${f.nome} não aguenta ${regras.nomeDoItem(it)}: seriam ${c.carga.usados} espaços, e o máximo é ${c.carga.maximo} (o dobro da carga, LR p. 53).`;
  }

  /** Registro na campanha onde a peça do personagem está. */
  private logDoPersonagem(f: FichaSalva, icon: LogIcon, text: string, prefere?: RoomInstance | null) {
    const sala = this.salaDoPersonagem(f.personagem, prefere) ?? prefere;
    if (sala) this.log(sala.data.id, icon, text);
  }

  /** Item do cenário entregue a uma peça: com ficha, vai para a mochila (achado na missão). */
  pegarItem(roomId: number, nome: string, l: Loot, quem: string, deOnde: string): boolean | string {
    const f = this.fichaPeloNome(roomId, nome);
    if (!f) return false;
    const it = lootParaItem(l);
    if (!Number.isInteger(it.uid) || (this.db.fichas ?? []).some((x) => x.ficha.inventario.some((y) => y.uid === it.uid))) it.uid = this.nextItemId();
    const erro = this.naoCabe(f, it);
    if (erro) return erro;
    this.trocarMochila(f, [...f.ficha.inventario, it]);
    this.log(roomId, 'give', quem ? `${quem} entregou ${l.name} para ${nome}.` : `${nome} pegou ${l.name} (${deOnde}).`);
    this.fichaMudou(f);
    return true;
  }

  /** A peça é de um agente: o personagem tem ficha (a névoa abre em volta dela). */
  ehAgente(personagem: number | null | undefined): boolean {
    return !!this.fichaDoPersonagem(personagem);
  }

  /** Armado na peça com ficha: empunha a primeira arma da mochila (trocando o que estiver na mão) ou guarda as armas. */
  armarPelaPeca(personagem: number | null | undefined, armado: boolean, c: Client): boolean {
    const f = this.fichaDoPersonagem(personagem);
    if (!f) return false;
    let inv = f.ficha.inventario;
    if (armado) {
      if (regras.armado(inv)) return true;
      const arma = inv.find((it) => it.tipo === 'arma' && regras.maosDoItem(it) > 0 && Number.isInteger(it.uid));
      if (!arma) {
        c.send({ t: 'error', msg: `${f.nome} não tem arma na mochila.` });
        return true;
      }
      const r = regras.empunhar(inv, arma.uid!, true);
      if (!r.ok) {
        c.send({ t: 'error', msg: r.motivo });
        return true;
      }
      inv = r.inventario;
    } else
      for (const it of f.ficha.inventario)
        if (it.tipo === 'arma' && regras.lugarDoItem(it) === 'mao') {
          const r = regras.guardar(inv, it.uid!);
          if (r.ok) inv = r.inventario;
        }
    this.trocarMochila(f, inv);
    this.fichaMudou(f);
    return true;
  }

  /** Um item da mochila: mão, roupa, usar, entregar a outra ficha ou largar no chão (o jogador, na dele). */
  private mochila(c: Client, m: Record<string, unknown>) {
    const err = (msg: string) => c.send({ t: 'error', msg });
    const f = (this.db.fichas ?? []).find((x) => x.id === m.fichaId);
    const acao = m.acao as AcaoMochila;
    const uid = typeof m.uid === 'number' ? m.uid : NaN;
    const inv = f?.ficha.inventario ?? [];
    const item = inv.find((x) => x.uid === uid);
    if (!f || !item || !ACOES_MOCHILA.includes(acao)) return err('Item não encontrado.');
    // o jogador mexe só na própria mochila (largar põe o item no chão, onde a peça dele está)
    if (c.role !== 'gm' && f.id !== c.fichaId) return err('Você só pode mexer na sua mochila.');
    const nome = regras.nomeDoItem(item);
    let r: regras.ResultadoMochila;
    switch (acao) {
      case 'empunhar':
        r = regras.empunhar(inv, uid, m.trocar === true);
        break;
      case 'guardar':
        r = regras.guardar(inv, uid);
        break;
      case 'vestir':
        r = regras.vestir(inv, uid);
        break;
      case 'tirar':
        r = regras.tirar(inv, uid);
        break;
      case 'usar': {
        const u = regras.usar(inv, uid);
        r = u;
        if (u.ok) {
          const resto = u.inventario.find((x) => x.uid === uid);
          const sobra = u.gastou ? (resto ? (resto.qtd ?? 1) : 0) : null;
          this.logDoPersonagem(f, 'user', `${f.nome} usou ${nome}${sobra === null ? '' : sobra > 1 ? ` (sobram ${sobra})` : sobra === 1 ? ' (sobra 1)' : ' (era o último)'}.`, c.room);
        }
        break;
      }
      case 'entregar': {
        const para = (this.db.fichas ?? []).find((x) => x.id === m.para);
        if (!para || para === f) return err('Entregar para quem?');
        if (c.role !== 'gm' && para.campanha !== f.campanha) return err('Só para quem está na sua equipe.');
        const s = regras.retirar(inv, uid);
        if (!s.ok) return err(s.motivo);
        const erro = this.naoCabe(para, s.item);
        if (erro) return err(erro);
        this.trocarMochila(f, s.inventario);
        this.trocarMochila(para, [...para.ficha.inventario, s.item]);
        this.logDoPersonagem(f, 'give', `${f.nome} entregou ${nome} para ${para.nome}.`, c.room);
        this.sincronizarArmado(para);
        this.fichaMudou(f);
        return;
      }
      case 'largar': {
        // o jogador não está numa cena: vale a que o mestre está jogando (a da mesa), se a peça estiver lá
        const sala = this.salaDoPersonagem(f.personagem, c.room ?? (this.db.liveScene !== undefined ? this.rooms.get(this.db.liveScene) : undefined));
        if (!sala || !f.personagem) return err(`${f.nome} não está no tabuleiro.`);
        const s = regras.retirar(inv, uid);
        if (!s.ok) return err(s.motivo);
        const e = sala.largarNoChao(f.personagem, itemParaLoot(s.item));
        if (e) return err(e);
        this.trocarMochila(f, s.inventario);
        this.log(sala.data.id, 'give', `${f.nome} largou ${nome} no chão.`);
        this.fichaMudou(f);
        return;
      }
    }
    if (!r.ok) return err(r.motivo);
    if (r.inventario !== inv) this.trocarMochila(f, r.inventario);
    this.fichaMudou(f);
  }

  // ---------- documentos (aba Docs do jogador; docs/TELA-DO-JOGADOR.md) ----------

  /** Manda os documentos: todos para o mestre, os da ficha para o jogador. */
  private enviarDocs(so?: Client) {
    const docs = this.db.documentos ?? [];
    const fichas = this.db.fichas ?? [];
    const para = (c: Client) => {
      if (c.role === 'gm') return c.send({ t: 'docs', docs });
      if (!c.fichaId) return;
      const f = fichas.find((x) => x.id === c.fichaId);
      c.send({ t: 'docs', docs: docs.filter((d) => documentoDaFicha(d, c.fichaId!, f?.campanha)).map((d) => documentoParaJogador(d, c.fichaId!)) });
    };
    if (so) return para(so);
    for (const c of this.clients.values()) para(c);
  }

  /** O mestre cria ou muda um documento (as marcas dos jogadores ficam). */
  private docSalvar(c: Client, m: Record<string, unknown>) {
    const d = sanitizarDocumento(m.doc);
    if (!d) return c.send({ t: 'error', msg: 'Documento sem título.' });
    const lista = (this.db.documentos ??= []);
    const antigo = d.id ? lista.find((x) => x.id === d.id) : undefined;
    const fichas = new Set((this.db.fichas ?? []).map((f) => f.id));
    d.para = d.para.filter((id) => fichas.has(id));
    if (antigo) {
      d.criadoEm = antigo.criadoEm;
      if (antigo.marcadoPor) d.marcadoPor = antigo.marcadoPor;
      else delete d.marcadoPor;
      lista[lista.indexOf(antigo)] = d;
    } else {
      if (lista.length >= MAX_DOCUMENTOS) return c.send({ t: 'error', msg: `Limite de ${MAX_DOCUMENTOS} documentos.` });
      d.id = Math.max(this.db.nextDocId ?? 1, ...lista.map((x) => x.id + 1));
      this.db.nextDocId = d.id + 1;
      delete d.marcadoPor;
      lista.push(d);
    }
    this.save();
    this.enviarDocs();
  }

  private docApagar(m: Record<string, unknown>) {
    const lista = this.db.documentos ?? [];
    const i = lista.findIndex((x) => x.id === m.id);
    if (i < 0) return;
    lista.splice(i, 1);
    this.save();
    this.enviarDocs();
  }

  /** O jogador marca um documento dele ou passa para a equipe. */
  private docDoJogador(c: Client, m: Record<string, unknown>) {
    const d = (this.db.documentos ?? []).find((x) => x.id === m.id);
    const f = (this.db.fichas ?? []).find((x) => x.id === c.fichaId);
    if (!d || !f || !documentoDaFicha(d, f.id, f.campanha)) return c.send({ t: 'error', msg: 'Documento não encontrado.' });
    if (m.t === 'docEquipe') {
      if (d.equipe) return;
      d.equipe = true;
      if (!d.campanha && f.campanha) d.campanha = f.campanha;
      this.logDoPersonagem(f, 'user', `${f.nome} passou "${d.titulo}" para a equipe.`, c.room);
    } else {
      const marcados = new Set(d.marcadoPor ?? []);
      if (m.marcado === true) marcados.add(f.id);
      else marcados.delete(f.id);
      if (marcados.size) d.marcadoPor = [...marcados];
      else delete d.marcadoPor;
    }
    d.atualizadoEm = new Date().toISOString();
    this.save();
    this.enviarDocs();
  }

  /** Item do catálogo novo na mochila (requisitado à Ordem: conta na patente). */
  private mochilaNova(c: Client, m: Record<string, unknown>) {
    const f = (this.db.fichas ?? []).find((x) => x.id === m.fichaId);
    if (!f || !noCatalogo(m.tipo, m.id)) return c.send({ t: 'error', msg: 'Item não encontrado.' });
    const it: regras.ItemFicha = { id: m.id as string, tipo: m.tipo, uid: this.nextItemId() };
    // o que se escolhe dentro do item (a perícia do utensílio, o elemento das amarras)
    const qual = regras.escolhaDoItem(m.tipo, m.id as string);
    const esc = (m.escolha ?? {}) as Record<string, unknown>;
    if (qual === 'pericia' && regras.periciasDoItem().some((p) => p.id === esc.pericia)) it.escolha = { pericia: esc.pericia as regras.PericiaId };
    if (qual === 'elemento' && ['sangue', 'morte', 'conhecimento', 'energia'].includes(esc.elemento as string)) it.escolha = { elemento: esc.elemento as regras.Elemento };
    const erro = this.naoCabe(f, it);
    if (erro) return c.send({ t: 'error', msg: erro });
    // munição: mais um pacote na pilha que já está na mochila (o mesmo, sem modificação)
    const pilha = regras.catalogo.equipamento(it.id)?.grupo === 'municao' && it.tipo === 'equipamento'
      ? f.ficha.inventario.find((x) => x.tipo === 'equipamento' && x.id === it.id && !x.achado && !x.modificacoes?.length)
      : undefined;
    if (pilha) this.trocarMochila(f, f.ficha.inventario.map((x) => (x === pilha ? { ...x, qtd: (x.qtd ?? 1) + 1 } : x)));
    else this.trocarMochila(f, [...f.ficha.inventario, it]);
    this.fichaMudou(f);
  }

  /**
   * O interlúdio (LR p. 92–93): as ações de cada ficha, todas de uma vez (o relaxar conta quem relaxa
   * junto). Os PV, PE e SAN entram na ficha e nas peças dela; os +1d6 ficam guardados; o registro conta.
   */
  private interludio(c: Client, m: Record<string, unknown>) {
    const lugar = regras.LUGARES_DESCANSO.find((l) => l.id === m.lugar);
    if (!lugar || !Array.isArray(m.escolhas)) return c.send({ t: 'error', msg: 'Interlúdio inválido.' });
    const acoes = new Set(regras.ACOES_INTERLUDIO.map((a) => a.id));
    const pratos = new Set(regras.PRATOS.map((p) => p.id));
    const grupo: { f: FichaSalva; n: regras.NoInterludio }[] = [];
    for (const raw of m.escolhas as Record<string, unknown>[]) {
      const f = (this.db.fichas ?? []).find((x) => x.id === raw?.fichaId);
      if (!f || grupo.some((g) => g.f === f) || !Array.isArray(raw.acoes)) continue;
      const escolha: regras.EscolhaInterludio = { acoes: (raw.acoes as unknown[]).filter((a): a is regras.AcaoInterludio => acoes.has(a as regras.AcaoInterludio)) };
      if (pratos.has(raw.prato as regras.Prato)) escolha.prato = raw.prato as regras.Prato;
      if (!escolha.acoes.length) continue;
      const erros = regras.errosDaEscolha(escolha);
      if (erros.length) return c.send({ t: 'error', msg: `${f.nome}: ${erros[0]}` });
      const calc = regras.calcular(f.ficha);
      const a = f.atual ?? { pv: calc.pv, pe: calc.pe, san: calc.san };
      grupo.push({
        f,
        n: {
          id: f.id,
          limitePe: calc.limitePe,
          vigor: calc.atributos.vig,
          intelecto: calc.atributos.int,
          atual: { pv: Math.min(a.pv, calc.pv), pe: Math.min(a.pe, calc.pe), san: Math.min(a.san, calc.san) },
          max: { pv: calc.pv, pe: calc.pe, san: calc.san },
          bonus: { exercicio: f.bonus?.exercicio ?? 0, leitura: f.bonus?.leitura ?? 0 },
          escolha,
        },
      });
    }
    if (!grupo.length) return c.send({ t: 'error', msg: 'Ninguém fez nada no interlúdio.' });
    const sala = c.room?.data.id;
    for (const r of regras.resolverInterludio(lugar.id, grupo.map((g) => g.n))) {
      const { f, n } = grupo.find((g) => g.n.id === r.id)!;
      f.atual = { ...(f.atual ?? n.atual), pv: n.atual.pv + r.pv, pe: n.atual.pe + r.pe, san: n.atual.san + r.san };
      const bonus = { ...(r.bonus.exercicio ? { exercicio: r.bonus.exercicio } : {}), ...(r.bonus.leitura ? { leitura: r.bonus.leitura } : {}) };
      if (Object.keys(bonus).length) f.bonus = bonus;
      else delete f.bonus;
      f.atualizadaEm = new Date().toISOString();
      if (f.personagem) this.fichaParaPecas(f);
      const nomes = n.escolha.acoes.map((a) => regras.ACOES_INTERLUDIO.find((x) => x.id === a)!.nome.toLowerCase());
      const ganhos = [r.pv && `+${r.pv} PV`, r.pe && `+${r.pe} PE`, r.san && `+${r.san} SAN`].filter(Boolean).join(', ');
      const texto = `Interlúdio (${lugar.nome.toLowerCase()}): ${f.nome} — ${nomes.join(' e ')}${ganhos ? `: ${ganhos}` : ''}${r.notas.length ? ` (${r.notas.join('; ')})` : ''}.`;
      if (sala) this.log(sala, 'scene', texto);
    }
    this.save();
    this.enviarFichas();
    this.touch();
  }

  /** Gasta um +1d6 guardado (delta −1) ou zera os da ficha (fim da missão). */
  private bonusInterludio(m: Record<string, unknown>) {
    const f = (this.db.fichas ?? []).find((x) => x.id === m.fichaId);
    if (!f || typeof m.delta !== 'number' || !Number.isFinite(m.delta)) return;
    const b = { exercicio: f.bonus?.exercicio ?? 0, leitura: f.bonus?.leitura ?? 0 };
    for (const k of ['exercicio', 'leitura'] as const) if (m.tipo === k || m.tipo === 'todos') b[k] = Math.max(0, Math.min(10, b[k] + Math.round(m.delta)));
    if (b.exercicio || b.leitura) f.bonus = { ...(b.exercicio ? { exercicio: b.exercicio } : {}), ...(b.leitura ? { leitura: b.leitura } : {}) };
    else delete f.bonus;
    this.save();
    this.enviarFichas();
  }

  /** Põe ou tira uma modificação ou maldição (o mestre passa por cima dos limites, como na requisição). */
  private mochilaMelhorar(c: Client, m: Record<string, unknown>) {
    const f = (this.db.fichas ?? []).find((x) => x.id === m.fichaId);
    const i = f ? f.ficha.inventario.findIndex((x) => x.uid === m.uid) : -1;
    if (!f || i < 0 || (m.tipo !== 'modificacao' && m.tipo !== 'maldicao') || typeof m.id !== 'string') return c.send({ t: 'error', msg: 'Item não encontrado.' });
    // só o que serve para o item (a lista do motor); o jogador, só na própria mochila e sem passar por cima da regra
    const op = regras.opcoesDeMelhoria(f.ficha, i).find((o) => o.tipo === m.tipo && o.id === m.id);
    if (!op) return c.send({ t: 'error', msg: 'Isso não vai neste item.' });
    if (c.role !== 'gm') {
      if (f.id !== c.fichaId) return c.send({ t: 'error', msg: 'Você só pode mexer na sua mochila.' });
      if (!op.ok) return c.send({ t: 'error', msg: `${op.motivos[0] ?? 'A regra não deixa.'} Peça ao mestre.` });
    }
    const it = f.ficha.inventario[i];
    const campo = m.tipo === 'modificacao' ? 'modificacoes' : 'maldicoes';
    const lista = (it[campo] ?? []).filter((x) => x !== m.id);
    if (m.por === true) lista.push(m.id);
    const novo: regras.ItemFicha = { ...it, [campo]: lista };
    if (!lista.length) delete novo[campo];
    this.trocarMochila(f, f.ficha.inventario.map((x, j) => (j === i ? novo : x)));
    if (c.role !== 'gm') this.logDoPersonagem(f, 'user', `${f.nome} ${m.por === true ? 'pôs' : 'tirou'} ${op.nome} ${m.por === true ? 'em' : 'de'} ${regras.nomeDoItem(it)}.`, c.room);
    this.fichaMudou(f);
  }

  /**
   * Um inventário só, na subida: cada item das fichas ganha número, o que
   * estava com uma peça de ficha (no cenário, com dono) vai para a mochila
   * dela, e o Armado das peças passa a vir da mão. true = mudou algo.
   */
  private migrarMochilas(): boolean {
    let mudou = false;
    for (const f of this.db.fichas ?? []) mudou = regras.numerarItens(f.ficha.inventario, () => this.nextItemId()) || mudou;
    for (const r of this.rooms.values())
      for (const { nome, loot } of r.tirarItensComDono((n) => !!this.fichaPeloNome(r.data.id, n))) {
        const f = this.fichaPeloNome(r.data.id, nome)!;
        f.ficha = { ...f.ficha, inventario: [...f.ficha.inventario, lootParaItem(loot)] };
        mudou = true;
      }
    for (const f of this.db.fichas ?? []) mudou = this.sincronizarArmado(f) || mudou;
    return mudou;
  }

  // ---------- fichas ----------
  private fichasTimer: NodeJS.Timeout | null = null;

  /** Manda a lista de fichas para quem é mestre (ou só para um cliente). */
  private enviarFichas(so?: Client, nova?: number) {
    const todas = this.db.fichas ?? [];
    const para = (c: Client) => {
      if (c.role === 'gm') return c.send({ t: 'fichas', fichas: todas, nova });
      if (!c.fichaId) return;
      const minha = todas.find((f) => f.id === c.fichaId);
      // a equipe (para entregar um item): os outros agentes da mesma campanha, só o nome
      const equipe = minha ? todas.filter((f) => f !== minha && f.campanha === minha.campanha).map((f) => ({ id: f.id, nome: f.nome })) : [];
      c.send({ t: 'fichas', fichas: minha ? [{ ...minha, chave: undefined }] : [], equipe });
    };
    if (so) return para(so);
    for (const c of this.clients.values()) para(c);
  }

  private fichaSalvar(c: Client, m: Record<string, unknown>) {
    const f = sanitizarFicha(m.ficha);
    if (!f) return c.send({ t: 'error', msg: 'Ficha inválida.' });
    const lista = (this.db.fichas ??= []);
    const antiga = f.id ? lista.find((x) => x.id === f.id) : undefined;
    if (c.role !== 'gm') {
      // o jogador mexe só na própria ficha; NEX, patente, ligação e link são do mestre
      if (!c.fichaId || !antiga || antiga.id !== c.fichaId) return c.send({ t: 'error', msg: 'Você só pode mexer na sua ficha.' });
      f.ficha.nex = antiga.ficha.nex;
      f.ficha.pp = antiga.ficha.pp;
      f.ficha.regras = antiga.ficha.regras;
      f.personagem = antiga.personagem;
      f.campanha = antiga.campanha;
      // a requisição do jogador respeita a patente: nenhuma categoria acima do limite a mais que antes (LR p. 52)
      try {
        const antes = regras.calcular(antiga.ficha).itens;
        const depois = regras.calcular(f.ficha).itens;
        const passou = depois.find((l) => l.usados > l.limite && l.usados > (antes.find((x) => x.categoria === l.categoria)?.usados ?? 0));
        if (passou) return c.send({ t: 'error', msg: `Limite da patente: categoria ${'I'.repeat(passou.categoria === 4 ? 0 : passou.categoria) || 'IV'} já tem ${passou.limite} (LR p. 52). Peça ao mestre.` });
        // e nenhum erro de regra novo (atributo fora dos pontos, escolha travada...): o jogador não passa por cima do livro
        const errosAntes = new Set(regras.calcular(antiga.ficha).problemas.filter((p) => p.severidade === 'erro').map((p) => `${p.onde}|${p.texto}`));
        const novo = regras.calcular(f.ficha).problemas.find((p) => p.severidade === 'erro' && !errosAntes.has(`${p.onde}|${p.texto}`));
        if (novo) return c.send({ t: 'error', msg: `${novo.onde}: ${novo.texto} Peça ao mestre.` });
      } catch {
        /* ficha que o motor não fecha: o mestre confere */
      }
    }
    if (antiga) f.chave = antiga.chave;
    else delete f.chave;
    let nova: number | undefined;
    if (antiga) {
      f.criadaEm = antiga.criadaEm;
      lista[lista.indexOf(antiga)] = f;
    } else {
      f.id = this.db.nextFichaId = Math.max(this.db.nextFichaId ?? 1, ...lista.map((x) => x.id + 1));
      this.db.nextFichaId = f.id + 1;
      lista.push(f);
      nova = f.id;
    }
    // uma folha de sprite tem uma ficha só
    if (f.personagem) for (const o of lista) if (o !== f && o.personagem === f.personagem) delete o.personagem;
    // itens novos ganham número (um só entre todas as fichas)
    const usados = new Set(lista.filter((o) => o !== f).flatMap((o) => o.ficha.inventario.map((it) => it.uid)));
    for (const it of f.ficha.inventario) if (usados.has(it.uid)) delete it.uid;
    regras.numerarItens(f.ficha.inventario, () => this.nextItemId());
    if (f.personagem) {
      this.fichaParaPecas(f);
      this.sincronizarArmado(f);
    }
    this.save();
    this.enviarFichas(undefined, nova);
    this.touch();
  }

  private fichaApagar(c: Client, m: Record<string, unknown>) {
    const id = typeof m.id === 'number' ? m.id : 0;
    const lista = this.db.fichas ?? [];
    const i = lista.findIndex((x) => x.id === id);
    if (i < 0) return;
    lista.splice(i, 1);
    this.save();
    this.enviarFichas();
    void c;
  }

  private fichaLink(m: Record<string, unknown>) {
    const f = (this.db.fichas ?? []).find((x) => x.id === m.id);
    if (!f) return;
    f.chave = crypto.randomBytes(9).toString('base64url');
    this.save();
    this.enviarFichas();
  }

  /** Link de jogador válido? Devolve a ficha. */
  private fichaPelaChave(chave: string): FichaSalva | undefined {
    const b = Buffer.from(chave);
    return (this.db.fichas ?? []).find((f) => {
      if (!f.chave) return false;
      const a = Buffer.from(f.chave);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
  }

  /** PV/PE/SAN da ficha (máximos pelo motor de regras) para as peças do personagem ligado. `soSemVitais`: só as peças que ainda não têm. */
  private fichaParaPecas(f: FichaSalva, soSemVitais = false) {
    const calc = regras.calcular(f.ficha);
    const a = f.atual ?? { pv: calc.pv, pe: calc.pe, san: calc.san };
    const v: Vitals = { pv: Math.min(a.pv, calc.pv), pvMax: calc.pv, pe: Math.min(a.pe, calc.pe), peMax: calc.pe, san: Math.min(a.san, calc.san), sanMax: calc.san };
    let mudou = false;
    for (const r of this.rooms.values()) mudou = r.definirVitais(f.personagem!, v, soSemVitais) || mudou;
    if (mudou) this.touch();
  }

  /** Peça nova (ou com outra folha): sem PV/PE/SAN, pega os da ficha ligada ao personagem. */
  vitaisDaFicha(personagem: number | null | undefined) {
    if (!personagem) return;
    const f = (this.db.fichas ?? []).find((x) => x.personagem === personagem);
    if (f) this.fichaParaPecas(f, true);
  }

  /** PV/PE/SAN de uma peça mudou no tabuleiro: a ficha ligada ao personagem acompanha. */
  vitalEmOutraCena(roomId: number, userId: number, m: Record<string, unknown>) {
    for (const id of this.sceneGroup(roomId)) if (id !== roomId && this.rooms.get(id)?.mudarVital(userId, m)) return;
  }

  vitaisDaPeca(personagem: number | null | undefined, v: Vitals) {
    if (!personagem) return;
    const f = (this.db.fichas ?? []).find((x) => x.personagem === personagem);
    if (!f) return;
    f.atual = { ...f.atual, pv: v.pv, pe: v.pe, san: v.san };
    this.save();
    if (!this.timers) return this.enviarFichas();
    if (this.fichasTimer) return;
    this.fichasTimer = setTimeout(() => {
      this.fichasTimer = null;
      this.enviarFichas();
    }, 300);
  }

  vitalChanged(roomId: number, tokenId: number, name: string, key: VitalKey, from: number, to: number, max: number) {
    const k = `${tokenId}:${key}`;
    const cur = this.vitalLog.get(k);
    const entry = cur ?? { roomId, name, key, from, to, max, timer: null };
    entry.to = to;
    entry.max = max;
    entry.name = name;
    if (entry.timer) clearTimeout(entry.timer);
    this.vitalLog.set(k, entry);
    const flush = () => {
      this.vitalLog.delete(k);
      if (entry.to === entry.from) return;
      const d = entry.to - entry.from;
      const label = VITAL_LABEL[entry.key];
      const what = d < 0 ? `perdeu ${-d} ${label}` : `recuperou ${d} ${label}`;
      this.log(entry.roomId, 'user', `${entry.name} ${what} (${entry.to}/${entry.max}).`);
    };
    if (this.timers) entry.timer = setTimeout(flush, 2500);
    else flush();
  }

  touch() {
    if (!this.timers || this.touchTimer) return;
    this.touchTimer = setTimeout(() => {
      this.touchTimer = null;
      this.pushScenes();
    }, 60);
  }

  private campaignState(group: number[]): CampaignState {
    const key = Math.min(...group);
    const camp = this.campaignFor(key);
    const rooms = group.map((id) => this.rooms.get(id)!).sort((a, b) => a.data.id - b.data.id);
    const scenes: SceneInfo[] = rooms.map((r) => ({
      id: r.data.id,
      name: r.data.name,
      floor: r.data.floor,
      heightmap: r.data.heightmap,
      door: r.data.door,
      portals: r.portals(),
      users: r.userPositions(),
      ...(r.data.floorStyle ? { estilo: r.data.floorStyle } : {}),
      ...(r.data.viagem ? { viagem: true } : {}),
      ...(r.data.aberto ? { aberto: true, terreno: r.data.terreno, marcos: r.marcos(), simbolos: r.simbolos() } : {}),
    }));
    this.ensureLayout(camp, scenes);
    this.marcarVisitas(camp, rooms);
    // grupo = as peças de todas as cenas da campanha
    const load = new Map<string, number>();
    for (const r of rooms) for (const l of r.heldLoot()) load.set(l.holder.toLowerCase(), (load.get(l.holder.toLowerCase()) ?? 0) + l.espacos);
    const party = new Map<string, PartyMember>();
    for (const r of rooms)
      for (const t of r.tokenList()) {
        // com ficha, a carga é a da mochila (espaços, LR p. 53)
        const fc = this.fichaDoPersonagem(t.look?.charId);
        const carga = fc ? this.calcDe(fc)?.carga : undefined;
        party.set(`t${t.id}`, {
          name: t.name,
          id: t.id,
          look: t.look,
          load: carga ? carga.usados : Math.round((load.get(t.name.toLowerCase()) ?? 0) * 10) / 10,
          capacity: carga ? carga.espacos : (t.capacity ?? DEFAULT_CAPACITY),
          roomId: r.data.id,
          color: t.color ?? playerColorFor(t.name),
          armed: t.armed,
          hurt: t.hurt,
          vitals: t.vitals,
        });
      }
    return {
      key,
      title: camp.title,
      subtitle: camp.subtitle,
      operacao: camp.operacao,
      objectives: camp.objectives,
      layout: camp.layout,
      log: camp.log.slice(-30),
      party: [...party.values()].sort((a, b) => (a.id ?? 0) > (b.id ?? 0) ? -1 : 1),
      scenes,
      notas: camp.notas ?? [],
      visitadas: camp.visitadas ?? [],
    };
  }

  /** Cena onde um agente está passa a ser visitada (o minimapa deixa de apagá-la). */
  private marcarVisitas(camp: CampaignData, rooms: RoomInstance[]) {
    const set = new Set(camp.visitadas ?? []);
    const antes = set.size;
    for (const r of rooms) if (!set.has(r.data.id) && r.tokenList().some((t) => this.ehAgente(t.look?.charId))) set.add(r.data.id);
    if (set.size === antes) return;
    camp.visitadas = [...set].sort((a, b) => a - b);
    this.save();
  }

  /** Planta: posiciona cenas novas lado a lado. */
  private ensureLayout(camp: CampaignData, scenes: { id: number; heightmap: string }[]) {
    let changed = false;
    let right = 0;
    for (const s of scenes) {
      const p = camp.layout[s.id];
      if (p) right = Math.max(right, p.x + parseHeightmap(s.heightmap).width + 1);
    }
    for (const s of scenes)
      if (!camp.layout[s.id]) {
        camp.layout[s.id] = { x: right, y: 0 };
        right += parseHeightmap(s.heightmap).width + 1;
        changed = true;
      }
    if (changed) this.save();
  }

  /** Estado da sessão para um papel (o "me" de cada pessoa entra no envio). */
  private sessionState(group: number[], role: Role): Omit<Session, 'me'> {
    const key = Math.min(...group);
    const camp = this.campaignFor(key);
    const rooms = group.map((id) => this.rooms.get(id)!).sort((a, b) => a.data.id - b.data.id);
    const scenes = rooms.map((r) => r.sceneInfo());
    this.ensureLayout(camp, scenes);
    const objects: SceneObject[] = [];
    const items: Item[] = [];
    for (const r of rooms) {
      const o = r.sessionObjects(role);
      objects.push(...o.objects);
      items.push(...o.items);
    }
    const load = new Map<string, number>();
    for (const r of rooms) for (const l of r.heldLoot()) load.set(l.holder.toLowerCase(), (load.get(l.holder.toLowerCase()) ?? 0) + l.espacos);
    const characters: Character[] = [];
    const tokens: Token[] = [];
    for (const r of rooms)
      for (const t of r.tokensLive()) {
        tokens.push(t.token);
        const fc = this.fichaDoPersonagem(t.look?.charId);
        const carga = fc ? this.calcDe(fc)?.carga : undefined;
        characters.push({
          id: t.token.id,
          name: t.name,
          color: t.color ?? playerColorFor(t.name),
          capacity: carga ? carga.espacos : (t.capacity ?? DEFAULT_CAPACITY),
          load: carga ? carga.usados : round1(load.get(t.name.toLowerCase()) ?? 0),
          look: t.look,
          sceneId: r.data.id,
          armed: !!t.armed,
          ...(fc && t.armed ? { arma: this.armaNaMao(fc) } : {}),
          hurt: !!t.hurt,
          vitals: t.vitals,
        });
      }
    characters.sort((a, b) => a.id - b.id);
    const byName = new Map(characters.map((ch) => [ch.name.toLowerCase(), ch.id]));
    for (const it of items) it.holderId = it.holderName ? (byName.get(it.holderName.toLowerCase()) ?? null) : null;
    const cur = camp.currentSceneId;
    const home = this.db.home;
    const currentSceneId = cur !== undefined && group.includes(cur) ? cur : home !== undefined && group.includes(home) ? home : key;
    return {
      id: key,
      title: camp.title,
      subtitle: camp.subtitle,
      currentSceneId,
      scenes,
      objects,
      characters,
      tokens,
      items,
      objectives: camp.objectives,
      events: camp.log.slice(-30),
      layout: camp.layout,
    };
  }

  /** Reenvia campanha e sessão para quem mudou (público para os testes). */
  pushNow() {
    this.pushScenes();
  }

  private pushScenes() {
    const cache = new Map<number, string>();
    const groups = new Map<number, number[]>();
    const snaps = new Map<string, Omit<Session, 'me'>>();
    const combates = new Map<string, string>();
    for (const c of this.clients.values()) {
      if (!c.name || !c.room) continue;
      const rid = c.room.data.id;
      let group = groups.get(rid);
      if (!group) {
        group = this.sceneGroup(rid);
        for (const id of group) groups.set(id, group);
      }
      let json = cache.get(rid);
      if (json === undefined) {
        json = JSON.stringify(this.campaignState(group));
        for (const id of group) cache.set(id, json);
      }
      if (json !== c.lastScenes) {
        c.lastScenes = json;
        c.send({ t: 'campaign', state: JSON.parse(json) as CampaignState });
      }
      // sessão (contrato novo): um estado por papel, com o "me" de cada um
      const role: Role = c.role === 'gm' ? 'gm' : 'player';
      const sk = `${Math.min(...group)}:${role}`;
      let snap = snaps.get(sk);
      if (!snap) {
        snap = this.sessionState(group, role);
        snaps.set(sk, snap);
      }
      const session: Session = { ...snap, me: { name: c.name, role } };
      const sj = JSON.stringify(session);
      if (sj !== c.lastSession) {
        c.lastSession = sj;
        c.send({ t: 'session', session });
      }
      // combate: o mestre recebe tudo; a mesa, só a ordem, a rodada e a vez
      let cj = combates.get(sk);
      if (cj === undefined) {
        const key = Math.min(...group);
        const camp = this.campaignFor(key);
        this.religarCombate(group, camp);
        const cb = camp.combate ?? null;
        const podeDesfazer = role === 'gm' && (this.desfazeres.get(key)?.length ?? 0) > 0;
        // as fichas das ameaças são só do mestre (DC-4)
        cj = JSON.stringify({ t: 'combate', combate: role === 'gm' ? cb : cmb.visaoMesa(cb), ...(role === 'gm' ? { podeDesfazer, ameacas: this.fichasDasAmeacas(group, camp) } : {}) });
        combates.set(sk, cj);
      }
      if (cj !== c.lastCombate) {
        c.lastCombate = cj;
        c.send(JSON.parse(cj) as ServerMsg);
      }
    }
  }

  /**
   * O combate guarda as peças pelo id. Quando a peça é recriada (a viagem para outra campanha, a Sede
   * remontada), o id muda e o combate perdia o agente (sem retrato, sem PV, sem armas). O participante
   * cujo id sumiu é religado à peça do grupo com o mesmo nome, e a ficha da ameaça vai junto.
   */
  private religarCombate(group: number[], camp: CampaignData) {
    const c = camp.combate;
    if (!c || c.fase === 'encerrado') return;
    const pecas = group.flatMap((id) => this.rooms.get(id)?.tokensLive() ?? []);
    const ids = new Set(pecas.map((p) => p.token.id));
    const perdidos = c.participantes.filter((p) => !ids.has(p.id));
    if (!perdidos.length) return;
    const usados = new Set(c.participantes.filter((p) => ids.has(p.id)).map((p) => p.id));
    const mapa = new Map<number, number>();
    for (const p of perdidos) {
      const nova = pecas.find((x) => !usados.has(x.token.id) && x.name.toLowerCase() === p.nome.toLowerCase());
      if (!nova) continue;
      mapa.set(p.id, nova.token.id);
      usados.add(nova.token.id);
    }
    if (!mapa.size) return;
    camp.combate = trocarIds(c, mapa) as typeof c;
    if (camp.ameacas)
      for (const [velho, novo] of mapa)
        if (camp.ameacas[String(velho)] && !camp.ameacas[String(novo)]) {
          camp.ameacas[String(novo)] = camp.ameacas[String(velho)];
          delete camp.ameacas[String(velho)];
        }
    this.save();
  }

  /** Objetivos, título, planta e carga: só o mestre da cena atual. */
  private campaignEdit(c: Client, m: Record<string, unknown>) {
    const room = c.room;
    if (!room) return;
    if (!room.isOwner(c)) return c.send({ t: 'error', msg: 'Só o mestre edita a campanha.' });
    const camp = this.campaignFor(this.groupKey(room.data.id));
    const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');
    switch (m.t) {
      case 'objAdd':
        if (this.objectiveAdd(camp, m.text)) return;
        break;
      case 'objToggle': {
        const o = camp.objectives.find((x) => x.id === m.id);
        if (!o) return;
        this.objectiveSet(camp, o.id, !o.done, room.data.id);
        break;
      }
      case 'objRemove':
        this.objectiveRemove(camp, m.id);
        break;
      case 'campaignSet':
        camp.title = txt(m.title, 40) || camp.title;
        camp.subtitle = txt(m.subtitle, 40);
        if (typeof m.operacao === 'string') camp.operacao = txt(m.operacao, 40) || undefined;
        break;
      case 'layoutSet': {
        if (typeof m.roomId !== 'number' || typeof m.x !== 'number' || typeof m.y !== 'number') return;
        camp.layout[m.roomId] = { ...camp.layout[m.roomId], x: Math.max(-40, Math.min(120, Math.round(m.x))), y: Math.max(-40, Math.min(120, Math.round(m.y))) };
        break;
      }
      case 'planNota': {
        camp.notas ??= [];
        const pos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-60, Math.min(200, Math.round(v * 10) / 10)) : null);
        if (typeof m.id === 'number') {
          const n = camp.notas.find((x) => x.id === m.id);
          if (!n) return;
          const texto = typeof m.texto === 'string' ? txt(m.texto, 40) : null;
          if (m.apagar === true || texto === '') {
            camp.notas = camp.notas.filter((x) => x !== n);
            break;
          }
          if (texto) n.texto = texto;
          n.x = pos(m.x) ?? n.x;
          n.y = pos(m.y) ?? n.y;
        } else {
          const texto = txt(m.texto, 40);
          if (!texto || camp.notas.length >= 60) return;
          camp.notas.push({ id: this.nextItemId(), andar: txt(m.andar, 20), texto, x: pos(m.x) ?? 0, y: pos(m.y) ?? 0 });
        }
        break;
      }
      case 'capacitySet': {
        const k = txt(m.name, 16).toLowerCase();
        const ud = this.db.users[k];
        if (!ud || typeof m.capacity !== 'number') return;
        ud.capacity = Math.max(1, Math.min(99, Math.round(m.capacity)));
        break;
      }
    }
    this.save();
    this.touch();
  }

  /** Novo objetivo. Devolve o motivo quando não dá. */
  private objectiveAdd(camp: CampaignData, raw: unknown): string | null {
    const text = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) : '';
    if (!text) return 'Escreva o objetivo.';
    if (camp.objectives.length >= 20) return 'Máximo de 20 objetivos.';
    camp.objectives.push({ id: this.nextItemId(), text, done: false });
    return null;
  }

  private objectiveSet(camp: CampaignData, id: unknown, done: boolean, roomId: number): string | null {
    const o = camp.objectives.find((x) => x.id === id);
    if (!o) return 'Objetivo não encontrado.';
    if (o.done === done) return null;
    o.done = done;
    if (done) this.log(roomId, 'obj', `Objetivo concluído: ${o.text}.`);
    return null;
  }

  private objectiveRemove(camp: CampaignData, id: unknown): string | null {
    const n = camp.objectives.length;
    camp.objectives = camp.objectives.filter((x) => x.id !== id);
    return camp.objectives.length === n ? 'Objetivo não encontrado.' : null;
  }

  // ---------- cena atual da sessão ----------
  /** A cena que o mestre deixou aberta na sessão desta cena (se houver). */
  private currentSceneOf(roomId: number): RoomInstance | null {
    const group = this.sceneGroup(roomId);
    const id = this.campaignFor(Math.min(...group)).currentSceneId;
    return id !== undefined && group.includes(id) ? (this.rooms.get(id) ?? null) : null;
  }

  /**
   * Entrar numa cena. O mestre vai para onde quiser e leva os jogadores junto;
   * o jogador sempre vai para a cena que o mestre deixou aberta.
   */
  private enter(c: Client, room: RoomInstance) {
    if (c.role !== 'gm') {
      const live = this.db.liveScene !== undefined ? this.rooms.get(this.db.liveScene) : undefined;
      const target = live ?? this.currentSceneOf(room.data.id) ?? room;
      if (c.room === target) return c.send({ t: 'notice', msg: 'Quem escolhe a cena é o mestre.' });
      c.room?.leave(c);
      target.join(c);
      return;
    }
    if (c.room !== room) {
      c.room?.leave(c);
      room.join(c);
    }
    this.setCurrentScene(room);
  }

  private setCurrentScene(room: RoomInstance) {
    const group = this.sceneGroup(room.data.id);
    const camp = this.campaignFor(Math.min(...group));
    const changed = camp.currentSceneId !== room.data.id;
    camp.currentSceneId = room.data.id;
    this.db.liveScene = room.data.id;
    // a mesa vai junto, mesmo que estivesse em outra campanha
    for (const o of this.clients.values()) {
      if (o.role === 'gm' || !o.name || !o.room || o.room === room) continue;
      o.room.leave(o);
      room.join(o);
    }
    if (changed) this.log(room.data.id, 'scene', `Cena atual: ${sceneShortName(room.data.name)}.`);
    this.save();
    this.touch();
  }

  // ---------- ações do contrato (SessionAction) ----------
  private roomOfToken(tokenId: number) {
    for (const r of this.rooms.values()) if (r.hasToken(tokenId)) return r;
    return null;
  }

  private roomOfLoot(lootId: number) {
    for (const r of this.rooms.values()) if (r.findLoot(lootId)) return r;
    return null;
  }

  private act(c: Client, raw: unknown) {
    const a = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const type = typeof a.type === 'string' ? a.type : '';
    const deny = (reason: string) => c.send({ t: 'denied', action: type, reason });
    if (!SESSION_ACTIONS.includes(type as SessionActionType)) return deny('Ação desconhecida.');
    if (c.role !== 'gm') return deny('Só o mestre pode fazer isso.');
    let err: string | null = null;
    switch (type as SessionActionType) {
      case 'scene.change': {
        const room = isInt(a.sceneId) ? this.rooms.get(a.sceneId) : undefined;
        if (!room) return deny('Cena não encontrada.');
        this.enter(c, room);
        return;
      }
      case 'token.move': {
        const room = isInt(a.tokenId) ? this.roomOfToken(a.tokenId) : null;
        if (!room) return deny('Peça não encontrada.');
        const to = a.to && typeof a.to === 'object' ? (a.to as Record<string, unknown>) : {};
        const mode = a.mode === 'place' ? 'place' : 'walk';
        const tile = to.tile && typeof to.tile === 'object' ? (to.tile as Record<string, unknown>) : null;
        if (tile) {
          if (!isInt(tile.x) || !isInt(tile.y)) return deny('Casa inválida.');
          err = room.moveTokenTo(a.tokenId as number, { x: tile.x, y: tile.y } as Tile, true, mode);
        } else {
          if (!isNum(to.x) || !isNum(to.y)) return deny('Ponto inválido: use x e y entre 0 e 1.');
          const p: NormPoint = { x: Math.max(0, Math.min(1, to.x)), y: Math.max(0, Math.min(1, to.y)) };
          err = room.moveTokenTo(a.tokenId as number, p, false, mode);
        }
        break;
      }
      case 'token.face': {
        const room = isInt(a.tokenId) ? this.roomOfToken(a.tokenId) : null;
        if (!room) return deny('Peça não encontrada.');
        err = room.faceToken(a.tokenId as number, isInt(a.dir) ? a.dir : -1);
        break;
      }
      case 'item.give': {
        const room = isInt(a.itemId) ? this.roomOfLoot(a.itemId) : null;
        if (!room) return deny('Item não encontrado.');
        let toName: string | null = null;
        if (a.to !== null) {
          const holder = isInt(a.to) ? this.roomOfToken(a.to)?.tokensLive().find((t) => t.token.id === a.to) : undefined;
          if (!holder) return deny('Personagem não encontrado.');
          toName = holder.name;
        }
        err = room.giveLoot(c, a.itemId as number, toName);
        break;
      }
      case 'objective.add':
      case 'objective.set':
      case 'objective.remove': {
        if (!c.room) return deny('Entre numa cena primeiro.');
        const camp = this.campaignFor(this.groupKey(c.room.data.id));
        if (type === 'objective.add') err = this.objectiveAdd(camp, a.text);
        else if (type === 'objective.set') err = typeof a.done === 'boolean' ? this.objectiveSet(camp, a.id, a.done, c.room.data.id) : 'Diga se está feito (done).';
        else err = this.objectiveRemove(camp, a.id);
        if (!err) {
          this.save();
          this.touch();
        }
        break;
      }
    }
    if (err) deny(err);
  }

  /** Mestre muda a cena de um jogador (ou de todos no quarto dele). */
  private sendTo(c: Client, m: Record<string, unknown>) {
    const from = c.room;
    const target = typeof m.roomId === 'number' ? this.rooms.get(m.roomId) : undefined;
    if (!from || !target) return;
    if (!from.isOwner(c)) return c.send({ t: 'error', msg: 'Só o mestre muda a cena.' });
    const all = m.userId === 'all';
    const movers = all ? from.clients() : from.clients().filter((o) => o.id === m.userId);
    if (!all && !movers.length) {
      // jogador em outra cena do grupo: o mestre precisa ser dono daquela cena também
      for (const r of this.rooms.values())
        for (const o of r.clients()) if (o.id === m.userId && r.isOwner(c)) movers.push(o);
    }
    for (const o of movers) {
      if (o.room === target) continue;
      const prev = o.room?.data.id;
      o.room?.leave(o);
      target.join(o, prev);
      o.send({ t: 'notice', msg: `O mestre levou você para: ${target.data.name}` });
    }
    const moved = movers.filter((o) => o.room === target).map((o) => o.name);
    if (moved.length) this.log(target.data.id, 'scene', `${moved.join(', ')} ${moved.length > 1 ? 'foram levados' : 'foi levado'} para ${target.data.name}.`);
  }

  // ---------- HotelApi ----------
  save() {
    if (this.persist) scheduleSave(this.db);
  }
  flush() {
    if (this.persist) saveDbNow(this.db);
  }
  nextItemId() {
    return this.db.nextItemId++;
  }
  private userData(c: Client): UserData {
    let u = this.db.users[c.key];
    if (!u) {
      u = { name: c.name ?? c.key, look: c.look, inventory: [] };
      this.db.users[c.key] = u;
    }
    return u;
  }
  inventory(c: Client): InvItem[] {
    return this.userData(c).inventory;
  }
  sendInventory(c: Client) {
    c.send({ t: 'inventory', items: this.inventory(c) });
    this.save();
  }
  /** Contagem de usuários mudou: avisa o navegador (com debounce). */
  roomChanged() {
    if (!this.timers || this.listTimer) return;
    this.listTimer = setTimeout(() => {
      this.listTimer = null;
      const msg: ServerMsg = { t: 'roomList', rooms: this.roomList() };
      for (const c of this.clients.values()) if (c.name) c.send(msg);
    }, 300);
  }

  roomExists(roomId: number) {
    return this.rooms.has(roomId);
  }

  tokenNameTaken(roomId: number, name: string, exceptTokenId?: number) {
    const key = name.toLowerCase();
    return this.sceneGroup(roomId).some((id) => this.rooms.get(id)?.tokenNames(exceptTokenId).includes(key));
  }

  renameHolder(roomId: number, oldName: string, newName: string) {
    for (const id of this.sceneGroup(roomId)) this.rooms.get(id)?.renameHolder(oldName, newName);
    this.touch();
  }

  moveToken(from: RoomInstance, tokenId: number, toRoomId: number) {
    const to = this.rooms.get(toRoomId);
    if (!to || to === from) return;
    const t = from.takeToken(tokenId);
    if (!t) return;
    to.putToken(t, from.data.id);
  }

  teleport(c: Client, roomId: number, fromRoomId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.log(roomId, 'scene', `${c.name} foi para ${room.data.name}.`);
    c.room?.leave(c);
    room.join(c, fromRoomId);
  }

  clientByToken(token: string) {
    return this.byToken.get(token);
  }

  // ---------- conexões ----------
  /**
   * Nova conexão. `send` entrega uma mensagem; `close` encerra (sessão aberta
   * em outro lugar); `local` = vem do próprio computador do servidor (é o mestre).
   */
  attach(send: (msg: ServerMsg) => void, close?: (code: number) => void, local = false): Client {
    const c: Client = {
      id: this.nextClientId++,
      name: null,
      key: '',
      look: sanitizeLook(null),
      token: crypto.randomBytes(18).toString('base64url'),
      room: null,
      lastChat: 0,
      local,
      send,
      kick: () => {
        c.room?.leave(c);
        c.name = null;
        c.key = '';
        c.role = undefined;
        close?.(4000);
      },
    };
    this.clients.set(c.id, c);
    this.byToken.set(c.token, c);
    c.send({ t: 'hello', characters: this.db.characters });
    return c;
  }

  /** Mensagem recebida de uma conexão. */
  receive(c: Client, msg: unknown) {
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
    try {
      this.handle(c, msg as Record<string, unknown>);
    } catch (e) {
      console.error('[hotel] erro tratando mensagem', e);
    }
  }

  detach(c: Client) {
    c.room?.leave(c);
    this.clients.delete(c.id);
    this.byToken.delete(c.token);
  }

  connect(ws: WebSocket, local = false) {
    const c = this.attach(
      (msg) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      },
      (code) => ws.close(code, 'replaced'),
      local,
    );
    ws.on('message', (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      this.receive(c, msg);
    });
    // Sem este listener, um frame inválido/grande demais derrubaria o processo.
    ws.on('error', (e) => console.warn(`[ws] cliente ${c.id}: ${e.message}`));
    ws.on('close', () => this.detach(c));
  }

  private roomList(): RoomSummary[] {
    return [...this.rooms.values()]
      .map((r) => ({
        id: r.data.id,
        name: r.data.name,
        description: r.data.description,
        owner: r.data.owner,
        users: r.userCount,
      }))
      .sort((a, b) => b.users - a.users || a.id - b.id);
  }

  private broadcastCharacters() {
    const msg: ServerMsg = { t: 'characters', list: this.db.characters };
    for (const c of this.clients.values()) c.send(msg);
  }

  private handle(c: Client, m: Record<string, unknown>) {
    // a conta (tela de entrada) vale antes e depois do login
    if (m.t === 'contaCriar' || m.t === 'contaEntrar') return void this.conta(c, m);
    if (m.t === 'contaSair') return this.contaSair(m);
    if (!c.name) {
      if (m.t === 'login') this.login(c, m);
      return;
    }
    if (GM_ONLY.has(m.t as string) && c.role !== 'gm') return c.send({ t: 'error', msg: 'Só o mestre pode fazer isso.' });
    switch (m.t) {
      case 'act':
        this.act(c, m.a);
        return;
      case 'rooms':
        c.send({ t: 'roomList', rooms: this.roomList() });
        return;
      case 'createRoom':
        this.createRoom(c, m);
        return;
      case 'mapaImprovisado':
        this.mapaImprovisado(c, m);
        return;
      case 'mapaApagar':
        this.mapaApagar(c, m);
        return;
      case 'viagem':
        this.viagem(c, m);
        return;
      case 'barJogar':
        this.barJogar(c, m);
        return;
      case 'barSair':
        this.barSair(c, m);
        return;
      case 'barJogo':
        this.barJogo(c, m);
        return;
      case 'lugares':
        c.send({ t: 'lugares', lugares: this.lugares(c) });
        return;
      case 'lugarMover':
        this.lugarMover(c, m);
        return;
      case 'grupoPara':
        this.grupoPara(c, m);
        return;
      case 'visitada':
        this.visitada(c, m);
        return;
      case 'join': {
        const room = typeof m.roomId === 'number' ? this.rooms.get(m.roomId) : undefined;
        if (!room) return c.send({ t: 'error', msg: 'Quarto não encontrado.' });
        this.enter(c, room);
        return;
      }
      case 'peek': {
        // só cenas da mesma campanha da cena atual
        const cur = c.room?.data.id;
        if (typeof m.roomId !== 'number' || cur === undefined || !this.sceneGroup(cur).includes(m.roomId)) return;
        this.rooms.get(m.roomId)?.peek(c);
        return;
      }
      case 'look': {
        c.look = sanitizeLook(m.look);
        if (c.look.charId && !this.db.characters.some((ch) => ch.id === c.look.charId)) c.look.charId = null;
        this.userData(c).look = c.look;
        this.save();
        c.room?.updateLook(c);
        return;
      }
      case 'charUpdate':
        this.charUpdate(c, m);
        return;
      case 'charDelete':
        this.charDelete(c, m);
        return;
      case 'sendTo':
        this.sendTo(c, m);
        return;
      case 'objAdd':
      case 'objToggle':
      case 'objRemove':
      case 'campaignSet':
      case 'layoutSet':
      case 'planNota':
      case 'capacitySet':
        this.campaignEdit(c, m);
        return;
      case 'fichaSalvar':
        this.fichaSalvar(c, m);
        return;
      case 'fichaApagar':
        this.fichaApagar(c, m);
        return;
      case 'docSalvar':
        this.docSalvar(c, m);
        return;
      case 'docApagar':
        this.docApagar(m);
        return;
      case 'docMarcar':
      case 'docEquipe':
        this.docDoJogador(c, m);
        return;
      case 'mochila':
        this.mochila(c, m);
        return;
      case 'mochilaMelhorar':
        this.mochilaMelhorar(c, m);
        return;
      case 'interludio':
        this.interludio(c, m);
        return;
      case 'bonusInterludio':
        this.bonusInterludio(m);
        return;
      case 'mochilaNova':
        this.mochilaNova(c, m);
        return;
      case 'fichaLink':
        this.fichaLink(m);
        return;
      case 'combate':
        this.combateAcao(c, m);
        return;
      case 'ameaca':
        this.ameacaSalvar(c, m);
        return;
      case 'bestiario':
      case 'criaturaSalvar':
      case 'criaturaApagar':
      case 'criaturaColocar':
      case 'pecaAparencia':
        this.bestiarioMsg(c, m);
        return;
    }
    c.room?.handle(c, m);
  }

  // ---------- os jogos do bar (08/10) ----------
  /** As telas de jogador abertas na ficha. */
  private telasDaFicha(fichaId: number) {
    return [...this.clients.values()].filter((o) => o.role !== 'gm' && o.fichaId === fichaId);
  }

  private mestres() {
    return [...this.clients.values()].filter((o) => o.role === 'gm' && o.name);
  }

  /** Cada conexão que olha a mesa e os lugares dela (o jogador, o seu; o mestre, os dos NPCs). */
  private telasDaMesa(mesa: MesaBar): { c: Client; eu: number[] }[] {
    const out: { c: Client; eu: number[] }[] = [];
    mesa.lugares.forEach((l, i) => {
      if (l.fichaId !== undefined) for (const c of this.telasDaFicha(l.fichaId)) out.push({ c, eu: [i] });
    });
    const npcs = mesa.lugares.flatMap((l, i) => (l.fichaId === undefined ? [i] : []));
    if (npcs.length) for (const c of this.mestres()) out.push({ c, eu: npcs });
    return out;
  }

  private msgMesa(mesa: MesaBar, eu: number[]) {
    return { t: 'bar' as const, mesa: mesa.id, tipo: mesa.tipo, jogadores: mesa.lugares.map((l) => l.nome), npc: mesa.lugares.map((l) => l.fichaId === undefined), eu, log: mesa.log };
  }

  /** Quem está na mesa mudou: todos recebem a mesa de novo (a partida volta para o começo). */
  private mesaMudou(mesa: MesaBar) {
    mesa.log = [];
    for (const { c, eu } of this.telasDaMesa(mesa)) c.send(this.msgMesa(mesa, eu));
  }

  /** Tira um lugar da mesa: a tela de quem saiu fecha, os outros recebem a mesa nova. */
  private tirarDaMesa(mesa: MesaBar, i: number, aviso?: string) {
    const antes = this.telasDaMesa(mesa);
    const [saiu] = mesa.lugares.splice(i, 1);
    const ficam = new Set(this.telasDaMesa(mesa).map((x) => x.c));
    for (const { c } of antes) if (!ficam.has(c)) c.send({ t: 'barFechar', mesa: mesa.id, ...(aviso && saiu.fichaId !== undefined ? { aviso } : {}) });
    if (!mesa.lugares.length) this.mesas.delete(mesa.id);
    else this.mesaMudou(mesa);
  }

  /**
   * O mestre escolheu um agente e usou um jogo do bar: a peça vai até ele e o jogo abre no celular de
   * quem joga com ela; a peça sem ficha é um NPC, e o mestre joga por ele na tela dele. Com a peça já
   * jogando, o mesmo Usar chama de volta.
   */
  private barJogar(c: Client, m: Record<string, unknown>) {
    const room = c.room;
    if (!room || typeof m.tokenId !== 'number' || typeof m.itemId !== 'number') return;
    const r = room.pecaNoJogo(c, m.tokenId, m.itemId);
    if (typeof r === 'string') return c.send({ t: 'error', msg: r });
    const jogo = NOME_MESA[r.tipo];
    let mesa = this.mesas.get(m.itemId);
    const ja = mesa?.lugares.findIndex((l) => l.tokenId === m.tokenId) ?? -1;
    if (mesa && ja >= 0) {
      this.tirarDaMesa(mesa, ja, 'O mestre chamou de volta para a mesa.');
      return c.send({ t: 'notice', msg: `${r.nome} largou ${jogo}.` });
    }
    if (mesa && mesa.lugares.length >= bar.MAX_JOGADORES[r.tipo]) return c.send({ t: 'error', msg: `Já tem ${mesa.lugares.length} ${NOME_EM[r.tipo]}: chame alguém de volta antes.` });
    // a peça vai até o jogo, e o jogo só abre quando ela chega (09/10, o Felipe)
    const tokenId = m.tokenId;
    const itemId = m.itemId;
    const sentar = () => {
      const f = this.fichaDoPersonagem(r.charId);
      // a peça só joga uma coisa por vez
      for (const outra of [...this.mesas.values()]) {
        const i = outra.lugares.findIndex((l) => l.tokenId === tokenId || (f && l.fichaId === f.id));
        if (i >= 0) this.tirarDaMesa(outra, i);
      }
      let aqui = this.mesas.get(itemId);
      if (aqui && aqui.lugares.length >= bar.MAX_JOGADORES[r.tipo]) return c.send({ t: 'error', msg: `${r.nome} chegou, mas ${jogo} encheu enquanto andava.` });
      if (!aqui) {
        aqui = { id: itemId, tipo: r.tipo, lugares: [], log: [] };
        this.mesas.set(aqui.id, aqui);
      }
      aqui.lugares.push({ tokenId, nome: r.nome, ...(f ? { fichaId: f.id } : {}) });
      this.mesaMudou(aqui);
      const msg = !f
        ? `${r.nome} chegou ${NOME_EM[r.tipo]}. Sem ficha de jogador, é um NPC: você joga por ele na sua tela.`
        : this.telasDaFicha(f.id).length
          ? `${r.nome} chegou ${NOME_EM[r.tipo]}: o jogo abriu no celular.`
          : `${r.nome} chegou ${NOME_EM[r.tipo]}, mas o celular do jogador não está conectado (abre quando conectar).`;
      c.send({ t: 'notice', msg });
    };
    c.send({ t: 'notice', msg: `${r.nome} está indo para ${jogo}.` });
    room.irAoJogo(tokenId, itemId, sentar);
  }

  /** O lugar de quem mandou a mensagem: o do jogador, ou o do NPC que o mestre disse. */
  private lugarNaMesa(c: Client, mesa: MesaBar, de: unknown): number {
    if (c.role === 'gm') return typeof de === 'number' && mesa.lugares[de] && mesa.lugares[de].fichaId === undefined ? de : -1;
    return c.fichaId === undefined ? -1 : mesa.lugares.findIndex((l) => l.fichaId === c.fichaId);
  }

  /** Sair da mesa (o botão Sair): o mestre fica sabendo, e do recorde, se teve. */
  private barSair(c: Client, m: Record<string, unknown>) {
    const mesa = typeof m.mesa === 'number' ? this.mesas.get(m.mesa) : undefined;
    if (!mesa) return c.send({ t: 'barFechar', mesa: typeof m.mesa === 'number' ? m.mesa : 0 });
    const i = this.lugarNaMesa(c, mesa, m.lugar);
    if (i < 0) return;
    const nome = mesa.lugares[i].nome;
    const jogo = NOME_MESA[mesa.tipo];
    this.tirarDaMesa(mesa, i);
    if (c.role === 'gm') return;
    const rec = m.recorde as { jogo?: unknown; pontos?: unknown } | undefined;
    const pontos = typeof rec?.pontos === 'number' && Number.isFinite(rec.pontos) ? Math.max(0, Math.floor(rec.pontos)) : 0;
    const qual = typeof rec?.jogo === 'string' ? rec.jogo.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 20) : '';
    const msg = pontos && qual ? `${nome} largou ${jogo} (${pontos} pontos no ${qual}).` : `${nome} largou ${jogo}.`;
    for (const o of this.mestres()) o.send({ t: 'notice', msg });
  }

  /** Uma jogada: vai para os outros da mesa (e fica guardada, se pedir, para quem reconectar). */
  private barJogo(c: Client, m: Record<string, unknown>) {
    const mesa = typeof m.mesa === 'number' ? this.mesas.get(m.mesa) : undefined;
    if (!mesa || !m.dados || typeof m.dados !== 'object' || Array.isArray(m.dados)) return;
    const de = this.lugarNaMesa(c, mesa, m.de);
    if (de < 0) return;
    const dados = m.dados as Record<string, unknown>;
    if (JSON.stringify(dados).length > 4000) return;
    if (m.registrar === true) {
      if (dados.tipo === 'comecar') mesa.log = [];
      if (mesa.log.length < 3000) mesa.log.push({ de, dados });
    }
    for (const { c: o } of this.telasDaMesa(mesa)) if (o !== c) o.send({ t: 'barJogo', mesa: mesa.id, de, dados });
  }

  // ---------- contas (a tela de entrada) ----------
  /** Criar conta ou entrar com e-mail e senha. A resposta é a mensagem `conta`. */
  private async conta(c: Client, m: Record<string, unknown>) {
    const agora = Date.now();
    const falha = (erro: string) => c.send({ t: 'conta', ok: false, erro });
    if ((c.esperaConta ?? 0) > agora) return falha('Muitas tentativas seguidas. Espere meio minuto e tente de novo.');
    const email = typeof m.email === 'string' ? m.email.trim().toLowerCase() : '';
    const senha = typeof m.senha === 'string' ? m.senha : '';
    const contas = (this.db.contas ??= []);
    if (m.t === 'contaCriar') {
      if (email.length > 120 || !EMAIL_RE.test(email)) return falha('Confira o e-mail.');
      if (senha.length < SENHA_MIN || senha.length > 200) return falha(`A senha precisa de pelo menos ${SENHA_MIN} caracteres.`);
      const nome = typeof m.nome === 'string' ? m.nome.trim().replace(/\s+/g, ' ') : '';
      if (nome.length < 2 || nome.length > MAX_NAME || !NAME_RE.test(nome))
        return falha(`O nome precisa de 2 a ${MAX_NAME} letras ou números.`);
      if (nome.toLowerCase() === SYSTEM_OWNER.toLowerCase()) return falha('Esse nome é reservado.');
      const ocupado = () =>
        contas.some((x) => x.email === email) ? 'Já existe uma conta com esse e-mail.' : contas.some((x) => x.nome.toLowerCase() === nome.toLowerCase()) ? 'Esse nome já é de outra conta.' : null;
      if (ocupado()) return falha(ocupado()!);
      const hash = await hashSenha(senha);
      // outra conexão pode ter criado igual enquanto a senha virava hash
      if (ocupado()) return falha(ocupado()!);
      // a primeira conta, ou a criada no computador do servidor, é a do mestre
      const papel: PapelConta = !contas.length || c.local ? 'mestre' : 'jogador';
      const conta: Conta = { id: (this.db.nextContaId ??= 1), nome, email, senha: hash, papel, sessoes: [], criadaEm: agora };
      this.db.nextContaId++;
      contas.push(conta);
      if (this.persist) console.log(`[contas] conta nova: ${nome} (${papel})`);
      return this.contaAberta(c, conta);
    }
    // entrar: pelo e-mail ou pelo nome da conta (a regra da senha é só para criar)
    if (email.length < 2 || email.length > 120 || !senha || senha.length > 200) return falha('E-mail ou senha não conferem.');
    const conta = contas.find((x) => x.email === email) ?? (email.includes('@') ? undefined : contas.find((x) => x.nome.toLowerCase() === email));
    // sem a conta, o tempo de resposta é o mesmo (não entrega quais e-mails existem)
    const certa = conta ? await confereSenha(senha, conta.senha) : (await hashSenha(senha), false);
    if (!conta || !certa) {
      c.falhasConta = (c.falhasConta ?? 0) + 1;
      if (c.falhasConta >= 5) (c.falhasConta = 0), (c.esperaConta = agora + 30_000);
      return falha('E-mail ou senha não conferem.');
    }
    c.falhasConta = 0;
    this.contaAberta(c, conta);
  }

  private contaAberta(c: Client, conta: Conta) {
    const sessao = novaSessao(conta);
    this.save();
    const ficha = conta.papel === 'jogador' && conta.fichaId ? (this.db.fichas ?? []).find((f) => f.id === conta.fichaId) : undefined;
    c.send({ t: 'conta', ok: true, sessao, nome: conta.nome, papel: conta.papel, ...(ficha?.chave ? { fichaKey: ficha.chave } : {}) });
  }

  private contaSair(m: Record<string, unknown>) {
    if (typeof m.sessao === 'string' && m.sessao && fecharSessao(this.db.contas, m.sessao)) this.save();
  }

  private login(c: Client, m: Record<string, unknown>) {
    // com a sessão da conta, o nome e o papel saem da conta
    const sessao = typeof m.sessao === 'string' && m.sessao ? m.sessao : null;
    const conta = sessao ? contaDaSessao(this.db.contas, sessao) : undefined;
    if (sessao && !conta) return c.send({ t: 'conta', ok: false, erro: 'Sua sessão terminou. Entre de novo.', expirou: true });
    const name = conta ? conta.nome : typeof m.name === 'string' ? m.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 2 || name.length > MAX_NAME || !NAME_RE.test(name))
      return c.send({ t: 'error', msg: `Nome inválido (2 a ${MAX_NAME} letras, números, espaço, _ - .).` });
    const key = name.toLowerCase();
    if (key === SYSTEM_OWNER.toLowerCase()) return c.send({ t: 'error', msg: 'Esse nome é reservado.' });
    // a tela da mesa é sempre jogador; mestre = o próprio computador do servidor, quem tem a chave
    // ou a conta de mestre
    const hasKey = typeof m.gmKey === 'string' && !!m.gmKey && this.checkGmKey(m.gmKey);
    let daFicha = typeof m.fichaKey === 'string' && m.fichaKey ? this.fichaPelaChave(m.fichaKey) : undefined;
    // o jogador com conta continua na ficha dele mesmo que o mestre tenha trocado o link
    if (!daFicha && conta?.papel === 'jogador' && conta.fichaId) daFicha = (this.db.fichas ?? []).find((f) => f.id === conta.fichaId);
    if (typeof m.fichaKey === 'string' && m.fichaKey && !daFicha) return c.send({ t: 'error', msg: 'Link de ficha inválido. Peça um novo ao mestre.' });
    // o jogador que abre o link da ficha com a conta fica com ela ligada à conta
    if (conta?.papel === 'jogador' && daFicha && conta.fichaId !== daFicha.id) {
      conta.fichaId = daFicha.id;
      this.save();
    }
    // com a conta, vale o papel dela (o computador do servidor sozinho não basta), mas a chave do
    // mestre continua valendo
    const role: Role = m.mesa === true || daFicha ? 'player' : hasKey || conta?.papel === 'mestre' || (!conta && c.local) ? 'gm' : 'player';
    c.fichaId = daFicha?.id;
    c.contaId = conta?.id;
    // mesma pessoa abrindo em outra aba: a conexão nova assume (jogador não derruba o mestre)
    for (const o of this.clients.values())
      if (o !== c && o.key === key && o.role === 'gm' && role !== 'gm') return c.send({ t: 'error', msg: 'Esse nome já está em uso na sessão.' });
    for (const o of this.clients.values()) if (o !== c && o.key === key) o.kick?.();
    c.name = name;
    c.key = key;
    c.role = role;
    c.look = sanitizeLook(m.look);
    if (c.look.charId && !this.db.characters.some((ch) => ch.id === c.look.charId)) c.look.charId = null;
    const isNew = !this.db.users[key];
    const ud = this.userData(c);
    ud.name = name;
    ud.look = c.look;
    if (isNew) for (const defId of STARTER) ud.inventory.push({ id: this.nextItemId(), defId });
    this.save();
    c.send({ t: 'welcome', id: c.id, name, look: c.look, token: c.token, inventory: ud.inventory, home: this.db.home, role });
    c.send({ t: 'roomList', rooms: this.roomList() });
    if (role === 'gm' || c.fichaId) {
      this.enviarFichas(c);
      this.enviarDocs(c);
    }
    // o celular (ou o mestre) caiu no meio do jogo: a mesa do bar abre de novo
    for (const mesa of this.mesas.values())
      for (const t of this.telasDaMesa(mesa)) if (t.c === c) c.send(this.msgMesa(mesa, t.eu));
    if (this.persist) console.log(`[hotel] ${name} entrou (${role === 'gm' ? 'mestre' : 'jogador'})`);
  }

  private createRoom(c: Client, m: Record<string, unknown>) {
    const name = typeof m.name === 'string' ? m.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 30) : '';
    if (name.length < 3) return c.send({ t: 'error', msg: 'O nome do quarto precisa de pelo menos 3 letras.' });
    const layout = typeof m.model === 'string' ? getLayout(m.model) : undefined;
    if (!layout) return c.send({ t: 'error', msg: 'Modelo inválido.' });
    const mine = this.db.rooms.filter((r) => r.owner.toLowerCase() === c.key).length;
    if (mine >= 15) return c.send({ t: 'error', msg: 'Limite de 15 quartos por pessoa.' });
    const data: RoomData = {
      id: this.db.nextRoomId++,
      name,
      description: '',
      owner: c.name!,
      heightmap: layout.heightmap,
      door: { ...layout.door },
      items: [],
      wallItems: [],
      publicBuild: false,
      darkness: 0.55,
    };
    this.db.rooms.push(data);
    this.rooms.set(data.id, new RoomInstance(data, this));
    this.save();
    c.send({ t: 'roomCreated', id: data.id });
    this.roomChanged();
  }

  /**
   * Mapa improvisado (docs/FERRAMENTAS-DA-MESA.md): a imagem que o mestre subiu vira uma cena ao ar
   * livre, do tamanho que ele disse, com a imagem no chão e a vista tática ligada. Uma Entrada no meio
   * da borda de baixo liga a cena nova à de agora (as duas ficam na mesma campanha, e quem pisa nela
   * volta). Com `levar`, os agentes da cena de agora vão junto, e o mestre (e a mesa) também.
   */
  /**
   * Leva o grupo para a cena (o "Levar o grupo" do minimapa): as peças chegam lá (pela
   * passagem de onde vieram, como quem anda), e o mestre e a mesa abrem a cena. Sem `tokens`,
   * vão os agentes de todas as cenas da campanha (NPCs e ameaças ficam); com `tokens`, só essas
   * peças (o grupo dividido, ou a peça que o mestre arrastou no minimapa). `entrar: false`
   * move sem trocar a cena.
   */
  private grupoPara(c: Client, m: Record<string, unknown>) {
    const alvo = typeof m.roomId === 'number' ? this.rooms.get(m.roomId) : undefined;
    if (!alvo) return c.send({ t: 'error', msg: 'Cena não encontrada.' });
    const escolhidas = Array.isArray(m.tokens) ? new Set(m.tokens.filter((x): x is number => typeof x === 'number')) : null;
    const nomes: string[] = [];
    for (const id of this.sceneGroup(alvo.data.id)) {
      const de = this.rooms.get(id);
      if (!de || de === alvo) continue;
      for (const t of de.tokenList())
        if (escolhidas ? escolhidas.has(t.id) : this.ehAgente(t.look?.charId)) {
          this.moveToken(de, t.id, alvo.data.id);
          nomes.push(t.name);
        }
    }
    const lugar = sceneShortName(alvo.data.name);
    if (nomes.length) this.log(alvo.data.id, 'scene', escolhidas ? `${nomes.join(', ')} ${nomes.length > 1 ? 'foram' : 'foi'} para ${lugar}.` : `O grupo foi para ${lugar}.`);
    this.save();
    this.roomChanged();
    if (m.entrar !== false) this.enter(c, alvo);
    else this.touch();
  }

  /** O mestre marca uma cena (ou todas da campanha) como visitada ou não. */
  private visitada(c: Client, m: Record<string, unknown>) {
    const ref = typeof m.roomId === 'number' ? m.roomId : typeof m.campanha === 'number' ? m.campanha : c.room?.data.id;
    if (ref === undefined || !this.rooms.has(ref)) return;
    const group = this.sceneGroup(ref);
    const camp = this.campaignFor(Math.min(...group));
    const ids = typeof m.roomId === 'number' ? [m.roomId] : group;
    const set = new Set(camp.visitadas ?? []);
    for (const id of ids) {
      if (m.visitada) set.add(id);
      else set.delete(id);
    }
    camp.visitadas = [...set].sort((a, b) => a - b);
    this.save();
    this.touch();
    this.pushNow();
  }

  private mapaImprovisado(c: Client, m: Record<string, unknown>) {
    const de = c.room;
    if (!de) return c.send({ t: 'error', msg: 'Abra uma cena antes de criar o mapa.' });
    const url = typeof m.url === 'string' && URL_MAPA_RE.test(m.url) ? m.url : null;
    if (!url) return c.send({ t: 'error', msg: 'Envie a imagem do mapa antes.' });
    const w = isInt(m.largura) ? m.largura : 0;
    const h = isInt(m.altura) ? m.altura : 0;
    if (w < MAPA_MIN || h < MAPA_MIN || w > MAPA_MAX || h > MAPA_MAX || w * h > MAPA_AREA_MAX) return c.send({ t: 'error', msg: 'Tamanho do mapa inválido.' });
    const nome = (typeof m.nome === 'string' ? m.nome.replace(/[\u0000-\u001f·]/g, '').trim().slice(0, 30) : '') || 'Mapa improvisado';
    const lugar = de.data.name.includes('·') ? de.data.name.split('·')[0].trim() : '';
    const porta = { x: Math.floor(w / 2), y: h - 1, dir: 0 };
    const data: RoomData = {
      id: this.db.nextRoomId++,
      name: lugar ? `${lugar} · ${nome}` : nome,
      description: 'Mapa improvisado: a imagem que o mestre subiu, vista de cima.',
      owner: de.data.owner,
      heightmap: Array.from({ length: h }, () => '0'.repeat(w)).join('\n'),
      door: porta,
      items: [{ id: this.nextItemId(), defId: 'entrada', x: porta.x, y: porta.y, z: 0, rot: 0, state: 0, link: de.data.id }],
      wallItems: [],
      publicBuild: false,
      darkness: 0,
      aberto: true,
      mapa: url,
      tatico: true,
      ...(de.data.floor ? { floor: de.data.floor } : {}),
    };
    this.db.rooms.push(data);
    const nova = new RoomInstance(data, this);
    this.rooms.set(data.id, nova);
    this.log(de.data.id, 'scene', `Mapa improvisado: ${nome}.`);
    if (m.levar !== false) for (const t of de.tokenList()) if (this.ehAgente(t.look?.charId)) this.moveToken(de, t.id, data.id);
    this.save();
    this.roomChanged();
    this.enter(c, nova);
  }

  /** Apaga um mapa improvisado: as peças e quem estava nele voltam para a cena ligada pela Entrada. */
  private mapaApagar(c: Client, m: Record<string, unknown>) {
    const r = isInt(m.roomId) ? this.rooms.get(m.roomId) : undefined;
    if (!r?.data.mapa) return c.send({ t: 'error', msg: 'Só um mapa improvisado pode ser apagado.' });
    const id = r.data.id;
    const volta = r.data.items.find((it) => getFurni(it.defId)?.kind === 'entrada' && it.link !== undefined)?.link;
    const destino = (volta !== undefined && volta !== id ? this.rooms.get(volta) : undefined) ?? this.rooms.get(this.sceneGroup(id).find((x) => x !== id) ?? -1);
    if (!destino) return c.send({ t: 'error', msg: 'O mapa não está ligado a nenhuma cena.' });
    for (const t of r.tokenList()) this.moveToken(r, t.id, destino.data.id);
    for (const o of this.clients.values())
      if (o.room === r) {
        r.leave(o);
        destino.join(o);
      }
    this.rooms.delete(id);
    this.db.rooms = this.db.rooms.filter((x) => x.id !== id);
    for (const x of this.db.rooms) for (const it of x.items) if (it.link === id) delete it.link;
    for (const camp of Object.values(this.db.campaigns ?? {})) {
      if (camp.currentSceneId === id) camp.currentSceneId = destino.data.id;
      delete camp.layout[id];
    }
    if (this.db.liveScene === id) this.db.liveScene = destino.data.id;
    if (this.db.home === id) delete this.db.home;
    this.log(destino.data.id, 'scene', `Mapa improvisado apagado: ${sceneShortName(r.data.name)}.`);
    this.save();
    this.roomChanged();
    if (c.room !== destino) this.enter(c, destino);
  }

  // ---------- a Viagem (docs/VIAGEM.md) ----------

  private viagem(c: Client, m: Record<string, unknown>) {
    if (m.acao === 'iniciar') return this.viagemIniciar(c, m);
    if (m.acao === 'ajustar') return this.viagemAjustar(c, m);
    if (m.acao === 'chegar') return this.viagemChegar(c, m);
  }

  // ---------- o mapa-múndi: os lugares ----------
  /** Os lugares do mundo: cada conjunto de salas ligadas (menos a van) é um lugar, com ícone, ponto no mapa e a sala de entrada. */
  lugares(c?: Client): LugarInfo[] {
    const vistos = new Set<number>();
    const grupos: number[][] = [];
    for (const r of [...this.rooms.values()].sort((a, b) => a.data.id - b.data.id)) {
      if (r.data.viagem || vistos.has(r.data.id)) continue;
      const g = this.sceneGroup(r.data.id).filter((id) => !this.rooms.get(id)?.data.viagem);
      for (const id of g) vistos.add(id);
      grupos.push(g.sort((a, b) => a - b));
    }
    // salas soltas com o mesmo nome de lugar ("Sede · Câmara do Selo", que só se alcança pela passagem secreta) são do mesmo lugar
    const prefixo = (g: number[]) => {
      const nomes = g.map((id) => this.rooms.get(id)?.data.name ?? '').filter((n) => n.includes('·'));
      return nomes.length ? nomes[0].split('·')[0].trim().toLowerCase() : null;
    };
    for (let i = 0; i < grupos.length; i++)
      for (let k = grupos.length - 1; k > i; k--) {
        const p = prefixo(grupos[i]);
        if (p && p === prefixo(grupos[k])) {
          grupos[i] = [...grupos[i], ...grupos[k]].sort((a, b) => a - b);
          grupos.splice(k, 1);
        }
      }
    const aqui = c?.room && !c.room.data.viagem ? this.groupKey(c.room.data.id) : c?.room?.data.viagem ? this.groupKey(c.room.data.viagem.origem) : -1;
    return grupos.map((g, i) => {
      const key = g[0];
      const camp = this.campaignFor(key);
      const salas = g.map((id) => this.rooms.get(id)!).filter(Boolean);
      const nome = camp.title || salas[0]?.data.name || 'Lugar';
      // a entrada: a que o mestre escolheu; senão o Bar da Sede, a fazenda vista de fora, ou a primeira sala
      const escolhida = camp.lugar?.entrada;
      const entrada =
        (escolhida !== undefined && g.includes(escolhida) ? escolhida : undefined) ??
        salas.find((r) => /·\s*Bar$/.test(r.data.name))?.data.id ??
        salas.find((r) => /·\s*Olhos de [AÁaá]guia$/.test(r.data.name))?.data.id ??
        key;
      const pos = posicaoInicial(nome, i);
      return {
        id: key,
        nome,
        icone: camp.lugar?.icone ?? iconePeloNome(nome),
        x: camp.lugar?.x ?? pos[0],
        y: camp.lugar?.y ?? pos[1],
        entrada,
        salas: salas.length,
        aqui: key === aqui,
      };
    });
  }

  /** O mestre arrasta o ícone de um lugar para outro ponto do mapa. */
  private lugarMover(c: Client, m: Record<string, unknown>) {
    if (c.role !== 'gm') return c.send({ t: 'error', msg: 'Só o mestre mexe no mapa.' });
    if (!isInt(m.id) || typeof m.x !== 'number' || typeof m.y !== 'number' || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const l = this.lugares(c).find((x) => x.id === m.id);
    if (!l) return;
    const camp = this.campaignFor(l.id);
    camp.lugar = { ...(camp.lugar ?? {}), x: Math.max(0.08, Math.min(0.92, m.x)), y: Math.max(0.1, Math.min(0.9, m.y)) };
    this.save();
    c.send({ t: 'lugares', lugares: this.lugares(c) });
  }

  /** A pintura da partida ou da chegada, na tela de todo mundo (o mestre, a mesa e os celulares), com o som do carro. */
  private telaDaViagem(fase: 'partida' | 'chegada', ilustracao: string, texto: string, reserva?: string) {
    const msg: ServerMsg = { t: 'viagemTela', fase, ilustracao, texto, ...(reserva ? { reserva } : {}) };
    for (const c of this.clients.values()) if (c.name) c.send(msg);
  }

  /** Os ajustes de uma Viagem que o mestre mandou (o que vier errado fica como estava). */
  private viagemAjustes(m: Record<string, unknown>, base: ViagemInfo): ViagemInfo {
    const v = { ...base };
    if (isCenarioViagem(m.cenario)) v.cenario = m.cenario;
    if (isHoraViagem(m.hora)) v.hora = m.hora;
    if (typeof m.velocidade === 'number' && Number.isFinite(m.velocidade)) v.velocidade = Math.max(0, Math.min(1, m.velocidade));
    if (isClimaViagem(m.clima)) v.clima = m.clima;
    if (typeof m.ilustracao === 'string' && ILUSTRACOES_VIAGEM.some((i) => i.id === m.ilustracao)) v.ilustracao = m.ilustracao;
    // o destino é uma cena: o nome dela vira o texto da faixa, e "Chegamos" abre exatamente ela
    if (m.destinoId === null) {
      delete v.destinoId;
      delete v.destino;
    } else if (isInt(m.destinoId)) {
      const r = this.rooms.get(m.destinoId);
      if (r && !r.data.viagem) {
        // o destino é a sala de entrada do lugar; o texto é o nome do lugar
        v.destinoId = r.data.id;
        v.destino = (this.lugares().find((l) => l.entrada === r.data.id)?.nome ?? r.data.name).slice(0, 60);
      }
    } else if (typeof m.destino === 'string') {
      const d = m.destino.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60);
      if (d) v.destino = d;
      else delete v.destino;
      delete v.destinoId;
    }
    return v;
  }

  /** A van parada com o mundo passando: leva os agentes para os bancos que o mestre escolheu e abre a cena para ele e para a mesa. */
  private viagemIniciar(c: Client, m: Record<string, unknown>) {
    const de = c.room;
    if (!de) return c.send({ t: 'error', msg: 'Abra uma cena antes de começar a viagem.' });
    if (de.data.viagem) return c.send({ t: 'error', msg: 'Já estão em viagem.' });
    const lista = Array.isArray(m.bancos) ? m.bancos : [];
    const group = this.sceneGroup(de.data.id);
    // quem vai e onde senta: cada peça da campanha uma vez, cada banco uma vez
    const vai: { id: number; name: string; de: RoomInstance; banco: BancoVan }[] = [];
    const usados = new Set<number>();
    const viram = new Set<number>();
    for (const item of lista as { tokenId?: unknown; banco?: unknown }[]) {
      if (!isInt(item?.tokenId) || !isInt(item?.banco) || usados.has(item.banco) || viram.has(item.tokenId)) continue;
      const banco = BANCOS_VAN.find((b) => b.id === item.banco);
      if (!banco) continue;
      for (const id of group) {
        const r = this.rooms.get(id);
        const t = r?.tokenList().find((x) => x.id === item.tokenId);
        if (!r || !t) continue;
        vai.push({ id: t.id, name: t.name, de: r, banco });
        usados.add(banco.id);
        viram.add(item.tokenId);
        break;
      }
    }
    if (!vai.length) return c.send({ t: 'error', msg: 'Escolha quem vai e em que banco cada um senta.' });
    const base: ViagemInfo = { cenario: 'rodovia', hora: 'dia', velocidade: 0.7, origem: de.data.id };
    let sala = group.map((id) => this.rooms.get(id)).find((r) => r?.data.viagem);
    if (!sala) {
      const lugar = de.data.name.includes('·') ? de.data.name.split('·')[0].trim() : '';
      const data: RoomData = {
        id: this.db.nextRoomId++,
        name: lugar ? `${lugar} · Viagem` : 'Viagem',
        description: 'A van preta na estrada: a van fica parada na tela e o mundo passa por fora.',
        owner: de.data.owner,
        heightmap: heightmapDaVan(),
        door: { x: 1, y: 1, dir: 2 },
        items: moveisDaVan().map((mv) => ({ id: this.nextItemId(), defId: mv.defId, x: mv.x, y: mv.y, z: 0, rot: mv.rot, state: 0 })),
        wallItems: [],
        publicBuild: false,
        darkness: 0,
        aberto: true,
        floorStyle: 'metal',
        particles: [],
        viagem: base,
        ...(de.data.floor ? { floor: de.data.floor } : {}),
      };
      this.db.rooms.push(data);
      sala = new RoomInstance(data, this);
      this.rooms.set(data.id, sala);
    }
    // o destino da viagem anterior não vale para esta
    const antes: ViagemInfo = { ...base, ...(sala.data.viagem ?? {}), origem: de.data.id };
    delete antes.destino;
    delete antes.destinoId;
    const v = this.viagemAjustes(m, antes);
    // sem cenário escolhido: a estrada de terra para o campo, a rodovia para o resto
    if (!isCenarioViagem(m.cenario) && v.destino) v.cenario = ambienteDoDestino(v.destino) === 'rural' ? 'terra' : 'rodovia';
    sala.definirViagem(v);
    // a tela da partida, para todos, ANTES de qualquer peça sair do lugar (ela cobre a troca): uma pintura que combina
    // com o destino
    const ilustracao = sortearIlustracao(ambienteDoDestino(v.destino));
    sala.data.viagem = { ...sala.data.viagem!, ilustracao };
    this.telaDaViagem('partida', ilustracao, v.destino ? `Rumo a ${v.destino}` : 'A viagem começou');
    for (const x of vai) {
      const t = x.de.takeToken(x.id);
      if (t) sala.putToken({ ...t, x: x.banco.x, y: x.banco.y, dir: VAN.giroBanco }, null);
    }
    this.log(sala.data.id, 'scene', `A viagem começou: ${vai.map((x) => x.name).join(', ')} na van.`);
    this.save();
    this.roomChanged();
    this.enter(c, sala);
  }

  private viagemAjustar(c: Client, m: Record<string, unknown>) {
    const r = c.room;
    if (!r?.data.viagem) return c.send({ t: 'error', msg: 'Isto não é uma viagem.' });
    r.definirViagem(this.viagemAjustes(m, r.data.viagem));
    this.save();
  }

  /** Chegou: todos descem na cena escolhida (na porta dela) e a viagem fecha; a van fica pronta para a próxima. */
  private viagemChegar(c: Client, m: Record<string, unknown>) {
    const van = c.room;
    if (!van?.data.viagem) return c.send({ t: 'error', msg: 'Isto não é uma viagem.' });
    const dest = isInt(m.roomId) ? this.rooms.get(m.roomId) : undefined;
    if (!dest || dest.data.viagem) return c.send({ t: 'error', msg: 'Escolha a cena de chegada.' });
    const vindos = van.tokenList();
    // a tela da chegada, para todos (outra pintura do mesmo lugar)
    const lugar = this.lugares().find((l) => this.sceneGroup(dest.data.id).includes(l.id) || l.entrada === dest.data.id);
    const nomeDest = lugar?.nome ?? dest.data.name;
    // a arte de chegada do lugar (regra da casa: duas por lugar); se ainda não existe, a do jeito do lugar
    const doLugar = artesDeChegada(nomeDest)[Math.floor(Math.random() * 2)];
    this.telaDaViagem('chegada', doLugar, `Chegamos: ${nomeDest}`, sortearIlustracao(ambienteDoDestino(nomeDest), van.data.viagem.ilustracao));
    // outra campanha tem as peças dela: quem chega no lugar delas é o grupo da viagem, e as de antes saem
    const grupoDest = this.sceneGroup(dest.data.id);
    if (!grupoDest.includes(van.data.id)) {
      const charIds = new Set(vindos.map((t) => t.look?.charId).filter((x): x is number => !!x));
      for (const id of grupoDest) {
        const r = this.rooms.get(id);
        if (!r || r === van) continue;
        for (const t of r.tokenList()) if (t.look?.charId && charIds.has(t.look.charId)) r.takeToken(t.id);
      }
    }
    for (const t of vindos) this.moveToken(van, t.id, dest.data.id);
    this.log(dest.data.id, 'scene', `Chegaram: ${vindos.map((t) => t.name).join(', ') || 'ninguém'}.`);
    this.save();
    this.roomChanged();
    this.enter(c, dest);
  }

  // ---------- personagens ----------
  addCharacter(owner: Client, sheetUrl: string, name: string): CharacterDef {
    const def: CharacterDef = {
      id: this.db.nextCharId++,
      name: name.slice(0, 24) || 'Personagem',
      owner: owner.name ?? '?',
      sheet: sheetUrl,
      cols: 4,
      rows: 4,
      dirs: ['sw', 'se', 'nw', 'ne'],
      anims: ['idle', 'idle', 'idle', 'idle'],
      height: 104,
      fps: 4,
      sequence: [0, 1, 0, 1, 3, 2, 3, 1],
      removeBg: true,
    };
    this.db.characters.push(def);
    this.save();
    this.broadcastCharacters();
    return def;
  }

  /** Quem controla a sessão (o mestre) ajusta qualquer personagem, inclusive os do repositório. */
  private canEditChar(c: Client, _ch: CharacterDef) {
    return c.role === 'gm';
  }

  private charUpdate(c: Client, m: Record<string, unknown>) {
    const ch = this.db.characters.find((x) => x.id === m.id);
    if (!ch) return;
    if (!this.canEditChar(c, ch)) return c.send({ t: 'error', msg: 'Só o mestre edita personagens.' });
    Object.assign(ch, sanitizeCharPatch(m.patch));
    if (ch.dirs.length !== ch.rows) ch.dirs = Array.from({ length: ch.rows }, (_, i) => ch.dirs[i] ?? DIR_KEYS[i % DIR_KEYS.length]);
    const anims = ch.anims ?? [];
    ch.anims = Array.from({ length: ch.rows }, (_, i) => anims[i] ?? 'idle');
    ch.sequence = ch.sequence.filter((n) => n < ch.cols);
    if (!ch.sequence.length) ch.sequence = [0];
    this.save();
    this.broadcastCharacters();
  }

  private charDelete(c: Client, m: Record<string, unknown>) {
    const i = this.db.characters.findIndex((x) => x.id === m.id);
    if (i < 0) return;
    if (!this.canEditChar(c, this.db.characters[i])) return c.send({ t: 'error', msg: 'Só o mestre apaga personagens.' });
    const [removed] = this.db.characters.splice(i, 1);
    this.save();
    this.broadcastCharacters();
    for (const o of this.clients.values())
      if (o.look.charId === removed.id) {
        o.look = { ...o.look, charId: null };
        o.room?.updateLook(o);
      }
  }
}
