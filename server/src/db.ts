import type { Criatura, PecaCriatura } from '@crona/shared';
import type { ViagemInfo, IconeLugar, AvatarLook, CharacterDef, combate, Documento, Door, FichaSalva, FloorItem, FloorStyle, InvItem, LightMode, LogEntry, NevoaCena, NotaPlanta, Objective, ParticleKind, Vitals, WallItem } from '@crona/shared';
import type { Banco } from './banco';
import { BancoJson } from './banco/json';
import type { Conta } from './contas';

export { DATA_DIR, UPLOAD_DIR } from './pastas';

export interface RoomData {
  id: number;
  name: string;
  description: string;
  owner: string;
  heightmap: string;
  door: Door;
  items: FloorItem[];
  wallItems: WallItem[];
  publicBuild: boolean;
  darkness: number;
  lightMode?: LightMode;
  fog?: number;
  /** peças (personagens) nesta cena */
  tokens?: TokenData[];
  /** andar ("Térreo", "Subsolo") */
  floor?: string;
  /** área do cômodo ("Área técnica") */
  area?: string;
  /** piso do cômodo */
  floorStyle?: FloorStyle;
  /** ao ar livre: sem paredes, sem teto */
  aberto?: boolean;
  /** chão casa por casa, ao ar livre (letras de TERRENOS) */
  terreno?: string;
  /** cor do ambiente (#rrggbb) */
  ambient?: string;
  /** partículas (poeira, fumaça, brasas) */
  particles?: ParticleKind[];
  /** quantidade de partículas 0..1 */
  particleLevel?: number;
  /** a montagem da Sede de onde o cômodo saiu (o resumo dela): a Sede refeita só troca os cômodos cuja montagem mudou */
  montagem?: string;
  /** vista tática ligada (a câmera do tabuleiro em cima) */
  tatico?: boolean;
  /** a névoa revelada aos poucos: as casas que a mesa vê (sem ela, a mesa vê tudo) */
  nevoa?: NevoaCena;
  /** mapa improvisado: a imagem enviada pelo mestre, no chão inteiro da cena */
  mapa?: string;
  /** a Viagem: esta cena é a van parada com o mundo passando (docs/VIAGEM.md) */
  viagem?: ViagemInfo;
}

export interface TokenData {
  id: number;
  name: string;
  look: AvatarLook;
  x: number;
  y: number;
  dir: number;
  /** cor do anel/retrato */
  color?: string;
  /** limite de carga */
  capacity?: number;
  /** estado do retrato: com a arma, machucado */
  armed?: boolean;
  hurt?: boolean;
  /** de cócoras (furtivo ou atrás de um móvel) */
  agachado?: boolean;
  /** na cama de cima do beliche */
  alto?: boolean;
  /** PV, PE e SAN (atual e total) */
  vitals?: Vitals;
  /** a peça é uma criatura do bestiário (a ficha vem dela) e a cara que ela tem */
  criatura?: PecaCriatura;
  /** flutua (a criatura que anda sem tocar o chão) */
  flutua?: boolean;
}

export interface UserData {
  name: string;
  look: AvatarLook;
  inventory: InvItem[];
  /** limite de carga (itens de RPG) */
  capacity?: number;
}

/** Campanha = grupo de cenas ligadas; a chave é o menor id de quarto do grupo. */
export interface CampaignData {
  title: string;
  subtitle: string;
  /** nome da operação em andamento (topo da tela) */
  operacao?: string;
  objectives: Objective[];
  layout: Record<number, { x: number; y: number; r?: number }>;
  log: LogEntry[];
  /** cena que todos estão vendo (a última que o mestre abriu) */
  currentSceneId?: number;
  /** combate em andamento (docs/COMBATE.md); sem valor = sem combate */
  combate?: combate.Combate;
  /** fichas rápidas das ameaças, pelo id da peça (docs/COMBATE.md, seção 17) */
  ameacas?: Record<string, combate.FichaAmeaca>;
  /** anotações do mestre na planta, por andar */
  notas?: NotaPlanta[];
  /** onde este lugar fica no mapa-múndi, o ícone e a sala de entrada (sem valor, valem os padrões) */
  lugar?: { x: number; y: number; icone?: IconeLugar; entrada?: number };
  /** as cenas onde um agente já pisou (o minimapa apaga as outras); o mestre também marca */
  visitadas?: number[];
}

export interface Database {
  version: 1;
  /** versão do conteúdo de exemplo já aplicado */
  seedVersion?: number;
  nextRoomId: number;
  nextItemId: number;
  nextCharId: number;
  rooms: RoomData[];
  /** chave = nome em minúsculas */
  users: Record<string, UserData>;
  characters: CharacterDef[];
  campaigns?: Record<string, CampaignData>;
  /** cena de abertura sugerida (a demonstração mais nova) */
  home?: number;
  /** chave do link do mestre (quem entra com ela controla as sessões) */
  gmKey?: string;
  /** a última cena que o mestre abriu (em qualquer campanha): a mesa vai para ela */
  liveScene?: number;
  /** versão da montagem da Sede da Ordem (ver SEDE_REV) */
  sedeRev?: number;
  /** os temas dos quatro agentes já foram postos (uma vez só: depois, quem escolhe é o jogador) */
  temasAgentes?: boolean;
  /** o que estava em cima das mesas já subiu com elas (12/10, as mesas maiores) */
  mesasAltas?: boolean;
  /** versão da montagem da Fazenda Olhos de Águia (seedFazenda) */
  fazendaRev?: number;
  /** versão da montagem do Orfanato Filhos do Dragão (seedOrfanato) */
  orfanatoRev?: number;
  /** versão da montagem de Santo Berço (seedSantoBerco) */
  santoBercoRev?: number;
  /** versão da montagem de Igarapé (seedIgarape) */
  igarapeRev?: number;
  /** versão da montagem de Tiradentes (seedTiradentes) */
  tiradentesRev?: number;
  /** o nome da campanha (a história inteira, em todos os lugares): "Segredos do Outro Lado" */
  nomeCampanha?: string;
  /** o bestiário (10/10): as criaturas, cada uma com uma ficha e várias aparências */
  bestiario?: Criatura[];
  /** as salas e campanhas de exemplo antigas já foram tiradas (seed.ts, limparSalasDeExemplo) */
  limpezaExemplos?: boolean;
  /** fichas de personagem (motor de regras) */
  fichas?: FichaSalva[];
  nextFichaId?: number;
  /** documentos da investigação que o mestre entrega (aba Docs do jogador) */
  documentos?: Documento[];
  nextDocId?: number;
  /** contas da plataforma (a tela de entrada; ver src/contas.ts) */
  contas?: Conta[];
  nextContaId?: number;
}

export type { FichaSalva } from '@crona/shared';

// ---------- onde o banco fica guardado ----------
// JSON (server/data/db.json) por padrão; Postgres quando o servidor abre com
// CRONA_DB_URL (ver src/banco). O Hotel continua chamando loadDb/saveDbNow.

let banco: Banco = new BancoJson();
let carregado: { db: Database | null } | null = null;

/** Escolhe e abre o banco antes de o Hotel subir (lê o que estiver guardado). */
export async function usarBanco(b: Banco): Promise<void> {
  banco = b;
  carregado = { db: await b.carregar() };
}

export function bancoAtual(): Banco {
  return banco;
}

export function loadDb(): Database | null {
  if (carregado) {
    const { db } = carregado;
    carregado = null;
    return db;
  }
  return new BancoJson().carregarAgora();
}

export function saveDbNow(db: Database) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  banco.salvar(db).catch((e) => console.error('[banco] falha ao salvar', e));
}

let timer: NodeJS.Timeout | null = null;
export function scheduleSave(db: Database) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    saveDbNow(db);
  }, 800);
}

/** Grava o que falta e fecha a conexão (ao desligar o servidor). */
export async function fecharBanco(db: Database) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await banco.salvar(db);
  await banco.fechar();
}
