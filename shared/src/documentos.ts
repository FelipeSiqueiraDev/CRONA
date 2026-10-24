/**
 * Documentos da investigação (aba Docs do celular do jogador): relatórios, mapas, e-mails,
 * fotos e pistas que o mestre cria e entrega a um agente ou à equipe. O jogador lê, marca e
 * pode passar para a equipe; criar, mudar e apagar é do mestre.
 */

export type TipoDocumento = 'relatorio' | 'mapa' | 'comunicacao' | 'registro' | 'foto' | 'objeto' | 'outro';
export const TIPOS_DOCUMENTO: { id: TipoDocumento; nome: string }[] = [
  { id: 'relatorio', nome: 'Relatório' },
  { id: 'mapa', nome: 'Mapa' },
  { id: 'comunicacao', nome: 'Comunicação' },
  { id: 'registro', nome: 'Registro' },
  { id: 'foto', nome: 'Foto' },
  { id: 'objeto', nome: 'Objeto' },
  { id: 'outro', nome: 'Outro' },
];

/** O filtro da aba Docs: documento comum, evidência ou pista. */
export type GrupoDocumento = 'documento' | 'evidencia' | 'pista';
export const GRUPOS_DOCUMENTO: { id: GrupoDocumento; nome: string }[] = [
  { id: 'documento', nome: 'Documento' },
  { id: 'evidencia', nome: 'Evidência' },
  { id: 'pista', nome: 'Pista' },
];

export interface Documento {
  id: number;
  titulo: string;
  tipo: TipoDocumento;
  grupo: GrupoDocumento;
  /** de onde veio (Fundação, Médicos...), curto */
  origem?: string;
  /** a imagem (upload do mestre, /uploads/...) */
  imagem?: string;
  /**
   * As páginas em imagem (24/10, os documentos da campanha vindos dos PDFs do Felipe: cada página é uma imagem pronta),
   * uma por página, /uploads/...; a página i mostra a imagem i e, embaixo, o texto i (se houver).
   */
  imagens?: string[];
  /**
   * Onde o documento fica guardado no cenário (24/10, o Felipe: "não é pra vincular um documento a um item, é pra ter
   * o documento lá"): a cena e uma casa do móvel. Quem procura ali acha; o mestre entrega pelo cartão do objeto. A casa
   * (e não o id do móvel) sobrevive à cena refeita pelo seed.
   */
  guardado?: LugarDoDocumento;
  /** o texto, uma entrada por página */
  paginas: string[];
  /** as fichas que têm o documento */
  para: number[];
  /** a equipe inteira vê (os agentes da mesma campanha) */
  equipe: boolean;
  /** a campanha do documento (sem = todas) */
  campanha?: number;
  /** as fichas que marcaram o documento */
  marcadoPor?: number[];
  criadoEm: string;
  atualizadoEm: string;
}

/** A cena e a casa do móvel onde o documento está guardado. */
export interface LugarDoDocumento {
  cena: number;
  x: number;
  y: number;
}

export const MAX_DOCUMENTOS = 500;
const MAX_PAGINAS = 30;
const IMAGEM_UPLOAD = /^\/uploads\/[a-f0-9]{8,40}\.(png|jpe?g|webp)$/;

/** Quantas páginas o documento tem (o texto ou as imagens, o que tiver mais). */
export const paginasDoDocumento = (d: Pick<Documento, 'paginas' | 'imagens'>) => Math.max(d.paginas.length, d.imagens?.length ?? 0, 1);

/** A capa do documento (a miniatura): a imagem dele ou a primeira página em imagem. */
export const capaDoDocumento = (d: Pick<Documento, 'imagem' | 'imagens'>) => d.imagem ?? d.imagens?.[0];

/** O documento está guardado neste móvel: na cena dele e numa das casas que o móvel ocupa. */
export function documentoNoMovel(d: Pick<Documento, 'guardado'>, cena: number, casas: { x: number; y: number }[]): boolean {
  const g = d.guardado;
  return !!g && g.cena === cena && casas.some((c) => c.x === g.x && c.y === g.y);
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const inteiro = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : undefined);
const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x > 0))].slice(0, 50) : []);

/** Confere um documento vindo do cliente (a forma; quem pode mexer é o servidor). */
export function sanitizarDocumento(raw: unknown): Documento | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const titulo = (texto(o.titulo, 100) ?? '').trim();
  if (!titulo) return null;
  const paginas = Array.isArray(o.paginas) ? o.paginas.slice(0, MAX_PAGINAS).map((p) => texto(p, 6000) ?? '') : [];
  const imagem = texto(o.imagem, 200);
  const agora = new Date().toISOString();
  const d: Documento = {
    id: inteiro(o.id, 0, 1e9) ?? 0,
    titulo,
    tipo: TIPOS_DOCUMENTO.some((t) => t.id === o.tipo) ? (o.tipo as TipoDocumento) : 'outro',
    grupo: GRUPOS_DOCUMENTO.some((g) => g.id === o.grupo) ? (o.grupo as GrupoDocumento) : 'documento',
    paginas: paginas.length ? paginas : [''],
    para: ids(o.para),
    equipe: o.equipe === true,
    criadoEm: texto(o.criadoEm, 40) ?? agora,
    atualizadoEm: agora,
  };
  const origem = texto(o.origem, 40)?.trim();
  if (origem) d.origem = origem;
  if (imagem && IMAGEM_UPLOAD.test(imagem)) d.imagem = imagem;
  const imagens = Array.isArray(o.imagens) ? o.imagens.slice(0, MAX_PAGINAS).filter((x): x is string => typeof x === 'string' && IMAGEM_UPLOAD.test(x)) : [];
  if (imagens.length) d.imagens = imagens;
  const g = o.guardado as Record<string, unknown> | undefined;
  const cena = g && typeof g === 'object' ? inteiro(g.cena, 1, 1e9) : undefined;
  const gx = g && typeof g === 'object' ? inteiro(g.x, 0, 999) : undefined;
  const gy = g && typeof g === 'object' ? inteiro(g.y, 0, 999) : undefined;
  if (cena !== undefined && gx !== undefined && gy !== undefined) d.guardado = { cena, x: gx, y: gy };
  const campanha = inteiro(o.campanha, 0, 1e9);
  if (campanha) d.campanha = campanha;
  const marcados = ids(o.marcadoPor);
  if (marcados.length) d.marcadoPor = marcados;
  return d;
}

/** A ficha vê o documento: foi entregue a ela, ou à equipe da campanha dela. */
export function documentoDaFicha(d: Documento, fichaId: number, campanha?: number): boolean {
  if (d.para.includes(fichaId)) return true;
  return d.equipe && (!d.campanha || !campanha || d.campanha === campanha);
}

/** O que o jogador recebe: sem as marcas dos outros. */
export function documentoParaJogador(d: Documento, fichaId: number): Documento {
  const marcado = d.marcadoPor?.includes(fichaId);
  // onde o documento estava guardado é do mestre
  const { marcadoPor: _m, guardado: _g, ...resto } = d;
  return { ...resto, ...(marcado ? { marcadoPor: [fichaId] } : {}) };
}

export const nomeTipoDocumento = (t: TipoDocumento) => TIPOS_DOCUMENTO.find((x) => x.id === t)?.nome ?? 'Outro';
