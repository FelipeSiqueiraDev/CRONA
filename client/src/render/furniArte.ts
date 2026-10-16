import { moveisDoCodex } from './arteCodex';
import { M_POR_CASA, Z_PER_M, type FurniDef } from '@crona/shared';
import { rgba } from './color';
import { N, naParede, V, type FVisual } from './furniKit';
import { iso } from './iso';
import { drawFlame, type LBox, type Painter } from './painter';

/**
 * Móveis com arte (imagem) no lugar do desenho por código. A lista fica em
 * /arte/mobiliario/moveis.json (quem escreve é o scripts/3d/moveis.py). Cada móvel
 * tem uma imagem por giro (desenhado nos 4 giros) ou, quando só existe o desenho
 * da frente, a frente e as costas, que o espelho vira nos outros dois giros. Cada
 * imagem diz o ponto que cai no chão (a âncora). O tapete é uma imagem vista de cima,
 * deitada no chão. Enquanto a imagem não chega, fica o desenho por código.
 *
 * Outros modelos do mesmo móvel ("gun_table~b", "gun_table~c": outra arma em cima, outros
 * papéis na mesa) entram sozinhos: cada peça sorteia o seu pelo número dela, sempre o mesmo.
 * A arte de um material ("portal@metal") vale nos cômodos daquele piso (a porta de metal do
 * arsenal e da prisão).
 */

export interface VistaArte {
  arquivo: string;
  /** a âncora, em pixels da imagem */
  ax: number;
  ay: number;
  /** de que lado da imagem fica a face principal (a frente ou as costas) */
  lado?: 'esquerda' | 'direita';
  /** a âncora é a quina da frente da base (caixas) ou o centro da base (planta, cadeira) */
  ancora?: 'quina' | 'centro';
  /**
   * a profundidade de cada pixel (scripts/3d/estilo/exportar_frente_px.py), nos móveis com fogo: o que fica na frente da
   * chama animada é reposto por cima dela (frenteDoFogo)
   */
  prof?: string;
}

export interface MovelArte {
  /** pixels do tabuleiro (zoom 1) por pixel da imagem */
  escala: number;
  /** desenhado nos 4 giros: a imagem de cada um, como ela é (sem espelho) */
  giros?: Partial<Record<'0' | '2' | '4' | '6', VistaArte>>;
  frente?: VistaArte;
  costas?: VistaArte;
  /** onde o móvel fica no cômodo, para a ordem de quem fica na frente (a lâmpada, presa no teto): [u0, u1, v0, v1, z0, z1], z em metros */
  caixa?: LBox;
  /** o brilho da lâmpada acesa, em pixels da imagem (o centro e o raio) */
  brilho?: { x: number; y: number; r: number; cor?: string };
  /** tapete: a imagem vista de cima, em pé (a largura dela na lateral do móvel, a altura no comprimento) */
  chao?: { arquivo: string };
  /** item de parede: a vista presa na parede da direita ('r') e na da esquerda ('l'), e os outros estados ('r-1'...); a âncora é o ponto de encosto */
  parede?: Record<string, VistaArte>;
  /**
   * item de parede animado no estado 0 (a cortina no vento, feita por código): os quadros de cada parede, todos no
   * mesmo recorte, trocados a cada `ms`
   */
  quadros?: Partial<Record<'l' | 'r', VistaArte[]>>;
  ms?: number;
  /** item de parede redondo (o relógio): a inclinação das bordas que a arte trouxe, por parede; o jogo inclina a diferença até a da parede */
  inclina?: Record<string, number>;
  /**
   * tela acesa: o brilho em cada giro que mostra a tela, em pixels da imagem. modo 'cores'
   * (o fliperama: troca de cor a cada ms), 'pulso' (o monitor do leito: bate como um
   * coração a cada ms) ou 'tv' (o computador: tremula entre as cores). forca: o brilho máximo.
   */
  tela?: { cores: string[]; ms: number; modo?: 'cores' | 'pulso' | 'tv'; forca?: number; giros: Partial<Record<'0' | '2' | '4' | '6', { x: number; y: number; r: number }>> };
  /** a lâmpada de tubo falha de vez em quando (duas piscadas rápidas) */
  falha?: boolean;
  /** chamas que mexem, por giro ou parede ('r', 'l'): [x, y, altura] em pixels da imagem (a base da chama) */
  chamas?: Record<string, [number, number, number][]>;
  /** a lâmpada no fio balança de leve: o ângulo máximo e o tempo de uma ida e volta */
  pendulo?: { graus: number; ms: number };
  /** os outros estados do móvel (o armário aberto, o candelabro apagado): as vistas de cada um, no lugar das do estado 0 */
  estados?: Record<string, { giros: Partial<Record<'0' | '2' | '4' | '6', VistaArte>>; chamas?: Record<string, [number, number, number][]> }>;
  /** só os giros que têm vista usam a arte; nos outros fica o desenho por código (a porta nas paredes da frente) */
  soGiros?: boolean;
  /** o tamanho de verdade, em metros: [largura ao longo da frente, fundo, altura] (o mapa tático desenha o móvel nele) */
  real?: [number, number, number];
  /** encostado no fundo da casa (a prateleira na parede), em vez de no meio */
  encosta?: boolean;
  /**
   * arte feita por código (scripts/3d/codigo): o desenho já vem na medida de verdade (`real`), centrado na pegada,
   * com a sombra no chão dentro da imagem. O jogo não mede a largura do desenho (a sombra entraria na conta).
   */
  exato?: boolean;
  /**
   * pixel art (a arte feita pelo motor de pixel, 1 pixel da imagem = 1 do tabuleiro): desenhada sem suavizar e
   * no pixel inteiro, para não borrar.
   */
  pixel?: boolean;
  /**
   * o móvel visto de cima (mapa tático), com a frente para baixo; a imagem tem a pegada inteira e
   * a caixa diz onde o móvel está nela, em pixels (scripts/3d/cima.py): o jogo põe a caixa no
   * tamanho de verdade dele
   */
  cima?: VistaDeCima;
  /** quanto mais perto da câmera que a chama (metros) um pixel tem de estar para tapá-la (exportar_frente_px.py) */
  folgaFogo?: number;
  /** os estados que mudam o que se vê de cima (o baú aberto) */
  cimaEstados?: Record<string, VistaDeCima>;
  /**
   * os quadros do caminho da câmera até o tático (scripts/3d/estilo/exportar_voo_px.py): o ponto do caminho em
   * centésimos ("25", "50", "75") -> o giro -> a imagem e o meio da pegada no chão (ax, ay) nela
   */
  voo?: Record<string, Record<string, { arquivo: string; ax: number; ay: number }>>;
  /** px por metro dos quadros do voo */
  vooKv?: number;
}

export interface VistaDeCima {
  arquivo: string;
  /** onde o móvel está na imagem: [x0, y0, x1, y1] em pixels */
  caixa?: [number, number, number, number];
}

/** A tela de TV ligada (item de parede): treme de leve entre as cores, bem mais fraca que o fliperama. */
interface TelaParede {
  cores: string[];
  forca: number;
  paredes: Partial<Record<'l' | 'r', { x: number; y: number; r: number }>>;
}

interface Imagens {
  normal: HTMLCanvasElement;
  espelho: HTMLCanvasElement;
  /** a largura do desenho (os pixels que aparecem), em pixels da imagem */
  largura: number;
}

/** A largura do que aparece na imagem (alfa acima de 40), em pixels. */
function larguraDoDesenho(c: HTMLCanvasElement): number {
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let x1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  return x1 < 0 ? c.width : x1 - x0 + 1;
}

/**
 * Peças da linha da parede (a porta, a porta da cela): ficam do tamanho da arte. Encolher entortava a
 * moldura; o jogo é que se ajusta a elas (o vão da parede, a moldura atrás do que fica encostado).
 */
const DA_PAREDE = /^(portal|cell_door|cell_front|cell_wall|cell_bars|bars|iwall)/;

/** A árvore e o arbusto: a copa passa da casa de propósito (o tronco é que pisa nela); não encolhem. */
const COPA = /^(arvore|arbusto)$/;

/**
 * Quanto a peça encolhe para caber nas casas dela. O desenho vai ao tamanho de verdade pela altura
 * (moveis.py), e o gerador costuma desenhar largo: a base passava da casa (o carrinho entrava na casa
 * da frente). Pela largura do desenho e pela medida de verdade, acha a base desenhada e encolhe por
 * igual até ela caber. base: a base desenhada depois disso, em metros (a vista de cima usa a mesma).
 */
interface Encaixe {
  f: number;
  base: [number, number] | null;
}
const encaixes = new Map<string, Encaixe>();

function encaixe(chave: string, a: MovelArte, def: FurniDef, prontas: Imagens[]): Encaixe {
  const salvo = encaixes.get(chave);
  if (salvo) return salvo;
  const e: Encaixe = { f: 1, base: null };
  if (a.pixel && a.real) {
    // pixel art: a arte já vem no tamanho final (com o `aumento`), e esticar borraria o pixel
    e.base = [a.real[0], a.real[1]];
    encaixes.set(chave, e);
    return e;
  }
  if (a.exato && a.real) e.base = [a.real[0], a.real[1]];
  else if (a.real && prontas.length && !DA_PAREDE.test(def.kind) && !COPA.test(def.kind)) {
    const [rw, rd] = a.real;
    const larguras = prontas.map((im) => im.largura * a.escala).sort((x, y) => x - y);
    const medida = larguras[Math.floor(larguras.length / 2)];
    // quantas vezes o desenho é maior que o tamanho de verdade (na tela, a largura é a da frente mais a do fundo)
    const vezes = medida / (((rw + rd) * 32) / M_POR_CASA);
    const bw = rw * vezes;
    const bd = rd * vezes;
    const f = Math.min(1, (def.width * M_POR_CASA) / bw, (def.depth * M_POR_CASA) / bd);
    e.f = f < 0.99 ? f : 1;
    e.base = [bw * e.f, bd * e.f];
  }
  // a mesa maior que a pegada (o `aumento` do catálogo): cresce por igual em volta do meio dela
  const aum = def.aumento ?? 1;
  if (aum !== 1) {
    e.f *= aum;
    if (e.base) e.base = [e.base[0] * aum, e.base[1] * aum];
  }
  encaixes.set(chave, e);
  return e;
}

let lista: Record<string, MovelArte> | null = null;
/** os outros modelos de cada móvel: "gun_table" -> ["gun_table~b", "gun_table~c"] */
const modelos = new Map<string, string[]>();
const imagens = new Map<string, Imagens | 'carregando' | 'erro'>();

// o tabuleiro se pinta de novo a cada quadro: a arte aparece assim que chega. Falhou (o servidor reiniciando bem na
// hora): tenta de novo, em vez de passar a sessão inteira com os móveis no desenho de código (10/10)
function carregarLista(tentativa = 0) {
  void fetch('/arte/mobiliario/moveis.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Record<string, MovelArte>>;
    })
    .then((j) => {
      // a arte pintada do Códex não entra no tabuleiro (arteCodex.ts): só o que tem pixel art por código
      lista = Object.fromEntries(Object.entries(j).filter(([k, v]) => moveisDoCodex(k, v)));
      modelos.clear();
      for (const chave of Object.keys(lista).sort()) {
        const i = chave.indexOf('~');
        if (i > 0) modelos.set(chave.slice(0, i), [...(modelos.get(chave.slice(0, i)) ?? []), chave]);
      }
    })
    .catch(() => {
      if (tentativa < 20) setTimeout(() => carregarLista(tentativa + 1), Math.min(15000, 1500 * (tentativa + 1)));
      else lista = {};
    });
}
carregarLista();

/** O material de cada piso, para a arte de material (a porta de metal no arsenal e na prisão). */
const MATERIAL: Record<string, string> = { metal: 'metal', cela: 'metal' };

/**
 * Qual arte vale para esta peça: a do material do cômodo, se houver; senão um dos modelos do
 * móvel, sorteado pelo número da peça (o mesmo sempre, e vizinhos costumam sair diferentes).
 */
export function chaveDaArte(defId: string, seed: number, piso?: string, vazio = false, modelo?: string): string {
  if (!lista) return defId;
  // a peça já desenhada por código (14/10) não cai mais numa skin do Códex: só vale a variante também feita por código
  const L = lista;
  const serve = (k: string) => !!L[k] && (!L[defId]?.pixel || !!L[k].pixel);
  // o modelo que a montagem escolheu (os 12 quadros da fazenda, cada um o seu)
  if (modelo && serve(`${defId}~${modelo}`)) return `${defId}~${modelo}`;
  // o móvel que ficou sem nada: a gêmea vazia ("mesa-gabinete-vazio"), se já chegou
  if (vazio && serve(`${defId}!vazio`)) return `${defId}!vazio`;
  const mat = piso ? MATERIAL[piso] : undefined;
  if (mat && serve(`${defId}@${mat}`)) return `${defId}@${mat}`;
  const outros = modelos.get(defId)?.filter(serve);
  if (!outros?.length) return defId;
  const i = (Math.imul(seed | 0, 2654435761) >>> 0) % (outros.length + 1);
  return i === 0 ? defId : outros[i - 1];
}

function pronta(arquivo: string): Imagens | null {
  const url = `/arte/mobiliario/${arquivo}`;
  const c = imagens.get(url);
  if (c && c !== 'carregando' && c !== 'erro') return c;
  if (!c) {
    imagens.set(url, 'carregando');
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const normal = document.createElement('canvas');
      normal.width = img.naturalWidth;
      normal.height = img.naturalHeight;
      normal.getContext('2d')!.drawImage(img, 0, 0);
      const espelho = document.createElement('canvas');
      espelho.width = normal.width;
      espelho.height = normal.height;
      const g = espelho.getContext('2d')!;
      g.translate(normal.width, 0);
      g.scale(-1, 1);
      g.drawImage(normal, 0, 0);
      imagens.set(url, { normal, espelho, largura: larguraDoDesenho(normal) });
    };
    // falhou (o servidor reiniciando, a rede piscando): tenta de novo daqui a pouco, em vez de ficar sem arte até o F5
    img.onerror = () => {
      imagens.set(url, 'erro');
      setTimeout(() => imagens.get(url) === 'erro' && imagens.delete(url), 4000);
    };
    img.src = url;
  }
  return null;
}

/**
 * O móvel desenhado com a arte dele (uma caixa só, do tamanho do móvel, para a
 * ordem de quem fica na frente), ou null se ele não tem arte (ou ela ainda não chegou).
 * As luzes continuam as do desenho por código. state: o estado do móvel (0 = aceso).
 */
export function visualComArte(def: FurniDef, base: FVisual, state = 0, seed = 0, rot?: number, piso?: string, escala = 1, vazio = false, modelo?: string): FVisual | null {
  const chave = chaveDaArte(def.id, seed, piso, vazio, modelo);
  const salvo = lista?.[chave];
  if (!salvo) return null;
  // a porta: arte só nas paredes do fundo; nas da frente (que não aparecem), a soleira do desenho por código
  if (salvo.soGiros && rot !== undefined && !salvo.giros?.[String(rot) as '4']) return null;
  let a: MovelArte = salvo;
  const alto = Math.max(0.1, def.height / Z_PER_M);
  const caixa: LBox = a.caixa ?? [0, def.depth, 0, def.width, 0, alto];
  if (a.chao) {
    const img = pronta(a.chao.arquivo);
    if (!img) return null;
    // o tapete maior ou menor (o mestre muda): cresce em volta do meio da pegada
    const cx = (caixa[0] + caixa[1]) / 2;
    const cy = (caixa[2] + caixa[3]) / 2;
    const cz: LBox = escala === 1 ? caixa : [cx - ((caixa[1] - caixa[0]) * escala) / 2, cx + ((caixa[1] - caixa[0]) * escala) / 2, cy - ((caixa[3] - caixa[2]) * escala) / 2, cy + ((caixa[3] - caixa[2]) * escala) / 2, caixa[4], caixa[5]];
    return V([N(cz, (p) => deitar(p, img.normal, escala === 1 ? undefined : cz))], base.lights);
  }
  if (a.giros) {
    // outro estado com as vistas dele (o armário aberto): no lugar das do estado 0
    const outro = state ? a.estados?.[String(state)] : undefined;
    if (outro) a = { ...a, giros: outro.giros, chamas: outro.chamas };
    // todas as vistas precisam ter chegado: senão o móvel troca de cara ao girar
    const prontas: Partial<Record<string, Imagens>> = {};
    for (const [g, v] of Object.entries(a.giros ?? {})) {
      const img = v && pronta(v.arquivo);
      if (!img) return null;
      prontas[g] = img;
    }
    const aceso = state === 0;
    // a tela tinge a luz que ela joga no cômodo e bate junto com ela
    const cor = a.tela && aceso ? corDaTela(a.tela, seed) : null;
    const forca = a.tela && aceso ? forcaDaTela(a.tela, seed) : 1;
    let luzes = cor ? base.lights.map((L) => ({ ...L, color: cor, intensity: L.intensity * (0.75 + 0.25 * forca) })) : base.lights;
    // a lâmpada de tubo que falha: a luz cai junto com o tubo
    const falha = a.falha && aceso ? falhaDoTubo(seed) : 1;
    if (falha < 1) luzes = luzes.map((L) => ({ ...L, intensity: L.intensity * falha }));
    // a lâmpada balança no fio: a luz vai junto, de leve, e respira um pouco
    const ang = a.pendulo ? balanco(a.pendulo, seed) : 0;
    if (a.pendulo) {
      const braco = Math.max(0.2, (a.caixa?.[5] ?? 2.75) - 1.95);
      // para o lado na tela (u e v juntos, no giro 0 da lâmpada): o fundo dela vai para o lado contrário do giro
      const s = (-Math.sin(ang) * braco) / (M_POR_CASA * Math.SQRT2);
      const respira = 1 + 0.03 * Math.sin(performance.now() / 1700 + seed);
      luzes = luzes.map((L) => ({ ...L, u: L.u + s, v: L.v + s, intensity: L.intensity * respira }));
    }
    // o encaixe na casa, pelas vistas do estado 0 (os outros estados vêm na mesma escala)
    const vistas0 = Object.values(salvo.giros ?? {}).map((v) => (v ? pronta(v.arquivo) : null));
    const enc = encaixe(chave, salvo, def, vistas0.every((x) => !!x) ? (vistas0 as Imagens[]) : (Object.values(prontas) as Imagens[]));
    const no = N(caixa, (p) => desenharGiro(p, a, prontas, aceso ? (a.brilho?.cor ?? def.colors[0] ?? '#ffd98a') : null, cor, ang, forca, falha, enc, salvo.encosta));
    // a moldura da porta é parede na ordem de desenho: o que fica na sala, encostado nela, vem na frente
    return V([def.kind === 'portal' ? naParede(no) : no], luzes);
  }
  if (!a.frente) return null;
  const frente = pronta(a.frente.arquivo);
  const costas = a.costas ? pronta(a.costas.arquivo) : null;
  if (!frente || (a.costas && !costas)) return null;
  const enc = encaixe(chave, a, def, costas ? [frente, costas] : [frente]);
  return V([N(caixa, (p) => desenhar(p, a, frente, costas, enc))], base.lights);
}

/**
 * A imagem que representa o móvel no catálogo: a vista da frente (giro 4, ou o que houver) ou, no item
 * de parede, a da parede da direita; o tapete, visto de cima. null sem arte (ou antes da lista chegar).
 */
export function arteDaMiniatura(defId: string): string | null {
  const a = lista?.[defId];
  if (!a) return null;
  const v = a.giros?.['4'] ?? a.giros?.['2'] ?? a.frente ?? a.giros?.['6'] ?? a.giros?.['0'] ?? a.parede?.['r'] ?? a.parede?.['l'];
  const arq = v?.arquivo ?? a.chao?.arquivo;
  return arq ? `/arte/mobiliario/${arq}` : null;
}

/** O tapete (ou a rosa dos ventos) visto de cima, para o mapa tático; null sem arte ou enquanto ela carrega. */
export function imagemDoChao(defId: string): HTMLCanvasElement | null {
  const a = lista?.[defId];
  return a?.chao ? (pronta(a.chao.arquivo)?.normal ?? null) : null;
}

/** Os pontos do caminho da câmera que têm quadro desenhado (em 0 a 1). */
export const PONTOS_DO_VOO = [0.25, 0.5, 0.75];

/**
 * O móvel num ponto do caminho da câmera (um de PONTOS_DO_VOO), no giro dele: a imagem, o meio da pegada no chão nela
 * e os px por metro. null sem o quadro ou enquanto ele carrega.
 */
export function imagemDoVoo(defId: string, ponto: number, rot: number): { img: HTMLCanvasElement; ax: number; ay: number; kv: number } | null {
  const a = lista?.[defId];
  const q = a?.voo?.[String(Math.round(ponto * 100))]?.[String(rot)];
  const img = q ? pronta(q.arquivo)?.normal : null;
  return img && q ? { img, ax: q.ax, ay: q.ay, kv: a?.vooKv ?? 48 } : null;
}

/** O móvel visto de cima (mapa tático), no estado dele, e onde ele está na imagem; null sem arte ou enquanto ela carrega. */
export function imagemDeCima(defId: string, estado = 0): { img: HTMLCanvasElement; caixa: [number, number, number, number] | null; pixel: boolean } | null {
  const a = lista?.[defId];
  const vista = a?.cimaEstados?.[String(estado)] ?? a?.cima;
  const img = vista ? pronta(vista.arquivo)?.normal : null;
  return img ? { img, caixa: vista?.caixa ?? null, pixel: !!a?.pixel } : null;
}

/**
 * O tamanho do móvel (metros) e se ele encosta no fundo da casa, pela arte dele; null sem arte. A base é
 * a que o isométrico desenha (já encaixada na casa), para as duas vistas baterem; enquanto a arte não
 * chega, a medida de verdade.
 */
export function tamanhoReal(defId: string): { real: [number, number, number]; encosta: boolean } | null {
  const a = lista?.[defId];
  if (!a?.real) return null;
  const base = encaixes.get(defId)?.base;
  return { real: base ? [base[0], base[1], a.real[2]] : a.real, encosta: !!a.encosta };
}

/**
 * Item de parede com arte: a vista daquela parede (e do estado), com o ponto onde ele
 * encosta na parede em (x, y). false se ele não tem arte (ou ela ainda não chegou).
 */
export function desenharParedeComArte(ctx: CanvasRenderingContext2D, defId: string, parede: 'l' | 'r', state: number, x: number, y: number, seed = 0, vazio = false, modelo?: string): boolean {
  const a = lista?.[chaveDaArte(defId, seed, undefined, vazio, modelo)];
  if (!a?.parede) return false;
  let vista = (state ? a.parede[`${parede}-${state}`] : undefined) ?? a.parede[parede];
  if (!vista) return false;
  // a animação (o estado 0): o quadro da vez, cada item na sua fase; até todos chegarem, o primeiro
  const qs = !state ? a.quadros?.[parede] : undefined;
  if (qs?.length && qs.every((q) => pronta(q.arquivo))) vista = qs[Math.floor((performance.now() + seed * 977) / (a.ms ?? 140)) % qs.length];
  const img = pronta(vista.arquivo);
  if (!img) return false;
  const k = a.escala;
  // o gerador desenha o quadro um pouco torto (mais deitado que a parede): inclina na vertical, em volta
  // do ponto de encosto, até as bordas seguirem a parede; a medida é a da vista do estado 0
  const base = a.parede[parede] ? pronta(a.parede[parede].arquivo) : null;
  const med = a.inclina?.[parede] ?? inclinacaoDoDesenho((base ?? img).normal);
  const alvo = parede === 'r' ? 0.5 : -0.5;
  // a arte em pixel feita por código já vem na inclinação exata da parede: sem endireitar e no pixel inteiro
  const torto = a.pixel ? 0 : med !== null && Math.abs(alvo - med) >= 0.04 ? alvo - med : 0;
  ctx.save();
  if (torto) ctx.transform(1, torto, 0, 1, 0, -torto * x);
  ctx.imageSmoothingEnabled = !a.pixel;
  ctx.imageSmoothingQuality = 'high';
  if (a.pixel) ctx.drawImage(img.normal, Math.round(x - vista.ax), Math.round(y - vista.ay));
  else ctx.drawImage(img.normal, x - vista.ax * k, y - vista.ay * k, img.normal.width * k, img.normal.height * k);
  const tela = (a as MovelArte & { tela?: TelaParede }).tela as TelaParede | undefined;
  const spot = tela?.paredes?.[parede];
  if (tela && spot && !state) telaDeTv(ctx, tela, spot, x - vista.ax * k, y - vista.ay * k, k, seed);
  if (!state) acenderChamas(ctx, a.chamas?.[parede], x - vista.ax * k, y - vista.ay * k, k, seed);
  ctx.restore();
  return true;
}

const inclinacoes = new WeakMap<HTMLCanvasElement, number | null>();

/**
 * A inclinação das bordas de cima e de baixo do desenho (o quadro, o espelho, a TV na parede), em pixels
 * de y por pixel de x; null quando ele não é um retângulo de bordas retas (a câmera, o extintor).
 */
function inclinacaoDoDesenho(c: HTMLCanvasElement): number | null {
  if (inclinacoes.has(c)) return inclinacoes.get(c)!;
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  const opaco = (x: number, y: number) => d[(y * c.width + x) * 4 + 3] > 100;
  let x0 = c.width;
  let x1 = -1;
  for (let x = 0; x < c.width; x++)
    for (let y = 0; y < c.height; y++)
      if (opaco(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        break;
      }
  // a reta da borda (a de cima ou a de baixo) no miolo do desenho, e o quanto ela erra em média
  const reta = (deCima: boolean) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = Math.round(x0 + (x1 - x0) * 0.2); x <= Math.round(x1 - (x1 - x0) * 0.2); x++) {
      let y = -1;
      if (deCima) {
        for (let j = 0; j < c.height && y < 0; j++) if (opaco(x, j)) y = j;
      } else for (let j = c.height - 1; j >= 0 && y < 0; j--) if (opaco(x, j)) y = j;
      if (y >= 0) (xs.push(x), ys.push(y));
    }
    if (xs.length < 4) return null;
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let sxy = 0;
    let sxx = 0;
    xs.forEach((x, i) => ((sxy += (x - mx) * (ys[i] - my)), (sxx += (x - mx) ** 2)));
    const a = sxx ? sxy / sxx : 0;
    const erro = xs.reduce((s, x, i) => s + Math.abs(my + a * (x - mx) - ys[i]), 0) / xs.length;
    return { a, erro };
  };
  const cima = reta(true);
  const baixo = reta(false);
  let r: number | null = null;
  if (cima && baixo && cima.erro <= 1.6 && baixo.erro <= 1.6 && Math.abs(cima.a - baixo.a) <= 0.07) r = (cima.a + baixo.a) / 2;
  else {
    // uma borda só bem reta (a de baixo da TV tem o suporte)
    const melhor = [cima, baixo].filter((b): b is { a: number; erro: number } => !!b).sort((p, q) => p.erro - q.erro)[0];
    if (melhor && melhor.erro <= 0.6) r = melhor.a;
  }
  inclinacoes.set(c, r);
  return r;
}

/** O encaixe da peça na hora de desenhar: quanto ela encolhe e se encosta no fundo da casa. */
interface Ajuste {
  enc: Encaixe;
  encosta: boolean;
}

/** O ponto do chão que fica parado quando a peça encolhe: o meio da casa ou, encostada, o meio do fundo. */
function pivo(p: Painter, encosta: boolean): [number, number] {
  const w = p.m.box([0, p.m.D, 0, p.m.W, 0, 0]);
  const cx = (w.x0 + w.x1) / 2;
  const cy = (w.y0 + w.y1) / 2;
  if (!encosta) return iso(cx, cy, w.z0);
  // o fundo é o lado oposto à frente (giro 4: a frente para +y, o fundo no y da casa)
  const r = p.m.rot;
  return r === 4 ? iso(cx, w.y0, w.z0) : r === 0 ? iso(cx, w.y1, w.z0) : r === 2 ? iso(w.x0, cy, w.z0) : iso(w.x1, cy, w.z0);
}

/** Onde a imagem vai na tela: o canto de cima à esquerda e o tamanho (já encolhida para caber na casa). */
function lugar(p: Painter, img: HTMLCanvasElement, ax: number, ay: number, k: number, centro: boolean, aj?: Ajuste) {
  const w = p.m.box([0, p.m.D, 0, p.m.W, 0, 0]);
  // a âncora: a quina da frente da base (a de baixo na tela) ou o centro da base
  const [bx, by] = centro ? iso((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, w.z0) : iso(w.x1, w.y1, w.z0);
  const r = { x: bx - ax * k, y: by - ay * k, w: img.width * k, h: img.height * k };
  const f = aj?.enc.f ?? 1;
  if (f === 1) return r;
  const [px, py] = pivo(p, aj!.encosta);
  return { x: px + (r.x - px) * f, y: py + (r.y - py) * f, w: r.w * f, h: r.h * f };
}

function pintar(p: Painter, img: HTMLCanvasElement, ax: number, ay: number, k: number, centro: boolean, aj?: Ajuste, pixel = false) {
  const r = lugar(p, img, ax, ay, k, centro, aj);
  const ctx = p.ctx;
  const suave = ctx.imageSmoothingEnabled;
  if (pixel) {
    // pixel art: no pixel inteiro e sem suavizar (senão borra)
    r.x = Math.round(r.x);
    r.y = Math.round(r.y);
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  ctx.imageSmoothingEnabled = suave;
  return r;
}

/** O ângulo da lâmpada no fio agora (em radianos): cada uma no seu tempo, pela semente. */
function balanco(p: NonNullable<MovelArte['pendulo']>, seed: number): number {
  const t = performance.now() / p.ms;
  return ((p.graus * Math.PI) / 180) * Math.sin(t * Math.PI * 2 + seed * 1.7) * (0.75 + 0.25 * Math.sin(t * 0.37 + seed));
}

/** Um número de 0 a 1 que muda aos saltos suaves com o tempo (a cena da TV trocando). */
function ruido(t: number, passo: number, seed: number): number {
  const h = (n: number) => {
    const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const i = Math.floor(t / passo);
  const f = (t / passo) % 1;
  const s = Math.min(1, f / 0.25);
  return h(i - 1) + (h(i) - h(i - 1)) * s * s * (3 - 2 * s);
}

/**
 * Item de parede com tela ligada (a TV): um brilho fraco, que muda de força e de cor
 * como a imagem mudando, em volta da tela daquela vista. (x, y): a tela, na tela.
 */
function telaDeTv(ctx: CanvasRenderingContext2D, t: TelaParede, spot: { x: number; y: number; r: number }, x0: number, y0: number, k: number, seed: number) {
  const agora = performance.now();
  const forca = t.forca * (0.55 + 0.45 * ruido(agora, 640, seed)) * (0.92 + 0.08 * Math.sin(agora / 41));
  const i = Math.floor(ruido(agora, 2300, seed + 5) * t.cores.length) % t.cores.length;
  const cor = t.cores[i];
  const cx = x0 + spot.x * k;
  const cy = y0 + spot.y * k;
  const rr = spot.r * k;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
  g.addColorStop(0, rgba(cor, forca));
  g.addColorStop(1, rgba(cor, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  ctx.restore();
}

/** O tubo que falha: quase sempre 1; de vez em quando (cada lâmpada no seu tempo) cai duas vezes, rápido. */
function falhaDoTubo(seed: number): number {
  const periodo = 9000 + (seed % 7) * 1700;
  const f = (performance.now() + seed * 3331) % periodo;
  return (f > 120 && f < 190) || (f > 260 && f < 300) ? 0.25 : 1;
}

/** A força da tela agora (0 a 1): o coração batendo (lub-dub), a TV tremendo ou a tela firme. */
function forcaDaTela(t: NonNullable<MovelArte['tela']>, seed: number): number {
  const agora = performance.now();
  if (t.modo === 'pulso') {
    const f = (agora + seed * 97) % t.ms;
    const bate = Math.exp(-((f / 60) ** 2)) + 0.55 * Math.exp(-(((f - 170) / 55) ** 2));
    return Math.min(1, 0.3 + 0.7 * bate);
  }
  if (t.modo === 'tv') return 0.55 + 0.45 * ruido(agora, t.ms, seed);
  return 0.85 + 0.1 * Math.sin(agora / 97) + 0.05 * Math.sin(agora / 23);
}

/** A cor da tela agora: cada cor fica um tempo e passa depressa para a próxima, como as peças do Tetris. */
function corDaTela(t: NonNullable<MovelArte['tela']>, seed = 0): string {
  if (t.modo === 'pulso') return t.cores[0];
  if (t.modo === 'tv') return t.cores[Math.floor(ruido(performance.now(), t.ms * 3, seed + 3) * t.cores.length) % t.cores.length];
  const n = t.cores.length;
  const f = performance.now() / t.ms;
  const i = Math.floor(f) % n;
  const s = Math.min(1, Math.max(0, ((f % 1) - 0.7) / 0.3));
  return misturar(t.cores[i], t.cores[(i + 1) % n], s * s * (3 - 2 * s));
}

function misturar(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const canal = (sh: number) => Math.round(((ca >> sh) & 255) * (1 - t) + ((cb >> sh) & 255) * t);
  return '#' + ((canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).padStart(6, '0');
}

/** Onde cada móvel com fogo foi desenhado no quadro (pela semente, o id do item), para frenteDoFogo. */
const frentes = new Map<number, { img: HTMLCanvasElement; prof: string; folga: number; x: number; y: number; w: number; h: number; m: DOMMatrix }>();
/** A profundidade de cada pixel (metros na direção da câmera, a partir da âncora; NaN fora do móvel), por arquivo. */
const profs = new Map<string, { w: number; h: number; d: Float32Array } | 'carregando' | 'erro'>();
/** A frente já recortada (por arquivo e pela profundidade da chama, em passos de 2,5 cm). */
const recortes = new Map<string, HTMLCanvasElement>();

function profundidade(arquivo: string): { w: number; h: number; d: Float32Array } | null {
  const c = profs.get(arquivo);
  if (c && c !== 'carregando' && c !== 'erro') return c;
  if (!c) {
    profs.set(arquivo, 'carregando');
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, cv.width, cv.height).data;
      const d = new Float32Array(cv.width * cv.height);
      // 16 bits em R (alto) e G (baixo): (metros + 8) * 4000; alfa 0 = sem móvel
      for (let i = 0; i < d.length; i++) d[i] = px[i * 4 + 3] ? (px[i * 4] * 256 + px[i * 4 + 1]) / 4000 - 8 : NaN;
      profs.set(arquivo, { w: cv.width, h: cv.height, d });
    };
    img.onerror = () => profs.set(arquivo, 'erro');
    img.src = `/arte/mobiliario/${arquivo}`;
  }
  return null;
}

/**
 * Depois da chama animada do móvel (o item `seed`): repõe por cima dela os pixels do móvel que estão mais perto da câmera
 * que a chama (`profChama`, em metros a partir da âncora, como o exportar_frente_px.py conta). Assim o fogo fica
 * DENTRO da lanterna, da lareira, da fogueira, e não por cima da grade e das lenhas da frente.
 */
export function frenteDoFogo(ctx: CanvasRenderingContext2D, seed: number, profChama: number) {
  const f = frentes.get(seed);
  if (!f) return;
  const pf = profundidade(f.prof);
  if (!pf || pf.w !== f.img.width || pf.h !== f.img.height) return;
  const chave = `${f.prof}|${f.folga}|${Math.round(profChama * 40)}`;
  let rec = recortes.get(chave);
  if (!rec) {
    rec = document.createElement('canvas');
    rec.width = pf.w;
    rec.height = pf.h;
    const g = rec.getContext('2d')!;
    g.drawImage(f.img, 0, 0);
    const dados = g.getImageData(0, 0, pf.w, pf.h);
    // só o que está bem na frente da chama: a folga do móvel (a grade da lanterna tapa logo; na fogueira, só o anel de
    // pedras da frente, e não as lenhas onde ela queima)
    for (let i = 0; i < pf.d.length; i++) if (!(pf.d[i] > profChama + f.folga)) dados.data[i * 4 + 3] = 0;
    g.putImageData(dados, 0, 0);
    if (recortes.size > 200) recortes.clear();
    recortes.set(chave, rec);
  }
  ctx.save();
  ctx.setTransform(f.m);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rec, f.x, f.y, f.w, f.h);
  ctx.restore();
}

/** As chamas do desenho, mexendo: uma chama animada por cima de cada chama parada (cada uma no seu tempo). */
function acenderChamas(ctx: CanvasRenderingContext2D, chamas: [number, number, number][] | undefined, x0: number, y0: number, k: number, seed: number) {
  if (!chamas?.length) return;
  const t = performance.now() / 1000;
  ctx.save();
  chamas.forEach(([cx, cy, alt], i) => drawFlame(ctx, x0 + cx * k, y0 + cy * k, (alt * k) / 7, t + seed * 7.3 + i * 2.1));
  ctx.restore();
}

/** Um brilho redondo somado à imagem, em pixels da imagem. */
function brilhar(p: Painter, r: { x: number; y: number }, k: number, x: number, y: number, raio: number, cor: string, forca: number) {
  const ctx = p.ctx;
  const cx = r.x + x * k;
  const cy = r.y + y * k;
  const rr = raio * k;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
  // a queda é suave (o miolo forte some rápido e a borda vai devagar): sem o disco recortado em volta da lâmpada
  grad.addColorStop(0, rgba(cor, forca));
  grad.addColorStop(0.25, rgba(cor, forca * 0.45));
  grad.addColorStop(0.6, rgba(cor, forca * 0.12));
  grad.addColorStop(1, rgba(cor, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  ctx.restore();
}

/** Desenhado nos 4 giros: a imagem do giro, como ela é (e o brilho da lâmpada acesa e da tela). ang: o balanço da lâmpada. */
function desenharGiro(
  p: Painter,
  a: MovelArte,
  prontas: Partial<Record<string, Imagens>>,
  luz: string | null,
  corTela: string | null = null,
  ang = 0,
  forcaTela = 1,
  falha = 1,
  enc?: Encaixe,
  encosta = false,
) {
  const g = String(p.m.rot);
  const vista = a.giros?.[g as '4'] ?? a.giros?.['4'] ?? Object.values(a.giros ?? {})[0];
  const imgs = prontas[g] ?? prontas['4'] ?? Object.values(prontas)[0];
  if (!vista || !imgs) return;
  const aj: Ajuste | undefined = enc ? { enc, encosta } : undefined;
  // pixels da tela por pixel da imagem, já com o encolhimento (o brilho, a tela e as chamas vão juntos)
  const k = a.escala * (enc?.f ?? 1);
  const centro = vista.ancora === 'centro';
  // a lâmpada do teto acesa joga um feixe até o chão: sem teto no desenho, é ele que mostra que ela está lá no alto
  if (a.caixa && a.brilho && luz && p.power > 0.1) {
    const r0 = lugar(p, imgs.normal, vista.ax, vista.ay, a.escala, centro, aj);
    feixe(p, r0.x + a.brilho.x * k, r0.y + a.brilho.y * k, a.brilho.r * k, luz, p.power * falha);
  }
  if (ang) {
    // gira em volta do ponto onde o fio prende (o meio de cima da imagem)
    const r0 = lugar(p, imgs.normal, vista.ax, vista.ay, a.escala, centro, aj);
    const px = r0.x + r0.w / 2;
    p.ctx.save();
    p.ctx.translate(px, r0.y);
    p.ctx.rotate(ang);
    p.ctx.translate(-px, -r0.y);
  }
  const r = pintar(p, imgs.normal, vista.ax, vista.ay, a.escala, centro, aj, !!a.pixel);
  // o móvel com fogo guarda onde foi desenhado: a chama animada vem depois e a frente dele volta por cima dela
  if (vista.prof && p.seed !== undefined) frentes.set(p.seed, { img: imgs.normal, prof: vista.prof, folga: a.folgaFogo ?? 0.02, x: r.x, y: r.y, w: r.w, h: r.h, m: p.ctx.getTransform() });
  if (a.brilho && luz && p.power > 0.1) brilhar(p, r, k, a.brilho.x, a.brilho.y, a.brilho.r, luz, 0.55 * p.power * falha);
  const tela = a.tela?.giros[g as '4'];
  if (tela && corTela && p.power > 0.1) brilhar(p, r, k, tela.x, tela.y, tela.r, corTela, (a.tela?.forca ?? 0.42) * forcaTela * p.power);
  if (luz) acenderChamas(p.ctx, a.chamas?.[g], r.x, r.y, k, p.seed ?? 0);
  if (ang) p.ctx.restore();
}

/**
 * O feixe de luz da lâmpada (x, y, o brilho dela na tela) até o chão embaixo, no meio da casa. Ar com luz, e não um
 * cone recortado (12/10, o Felipe: "os feixes estão muito duros"): várias camadas do cone, cada uma mais estreita e
 * fraca, somam um miolo claro que se desfaz para os lados; a luz some descendo e pousa no chão numa mancha redonda
 * (deitada no isométrico), mais forte embaixo da lâmpada.
 */
function feixe(p: Painter, x: number, y: number, raio: number, cor: string, forca: number) {
  const [bx, by] = p.m.p(0.5, 0.5, 0);
  if (by <= y) return;
  const topo = Math.min(18, raio * 0.45);
  const base = topo * 3.4;
  const ctx = p.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // a mancha no chão: primeiro, para o cone passar por cima dela
  const rx = base * 1.5;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(1, 0.5);
  const poca = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  poca.addColorStop(0, rgba(cor, 0.34 * forca));
  poca.addColorStop(0.4, rgba(cor, 0.16 * forca));
  poca.addColorStop(1, rgba(cor, 0));
  ctx.fillStyle = poca;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // o cone em camadas: a de fora larga e quase invisível, a de dentro estreita; juntas, a borda se desfaz
  const CAMADAS = 6;
  for (let c = 0; c < CAMADAS; c++) {
    const e = 1 - c / CAMADAS; // largura: de 1 até 1/6
    const t = topo * (0.35 + 0.65 * e);
    const b = base * e;
    const g = ctx.createLinearGradient(0, y, 0, by + b * 0.25);
    const a = (0.5 / CAMADAS) * forca;
    g.addColorStop(0, rgba(cor, a));
    g.addColorStop(0.6, rgba(cor, a * 0.55));
    g.addColorStop(1, rgba(cor, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - t, y);
    ctx.lineTo(x + t, y);
    ctx.lineTo(bx + b, by);
    ctx.quadraticCurveTo(bx, by + b * 0.5, bx - b, by);
    ctx.closePath();
    ctx.fill();
  }
  // o ar em volta da lâmpada acende um pouco
  const halo = ctx.createRadialGradient(x, y, 0, x, y, topo * 2.2);
  halo.addColorStop(0, rgba(cor, 0.16 * forca));
  halo.addColorStop(1, rgba(cor, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - topo * 2.2, y - topo * 2.2, topo * 4.4, topo * 4.4);
  ctx.restore();
}

/** O tapete: a imagem vista de cima deitada no chão do móvel (a largura na lateral, a altura no comprimento). */
function deitar(p: Painter, img: HTMLCanvasElement, cx?: LBox) {
  // na pegada do móvel ou, no tapete maior ou menor, na caixa dele
  const [a0, a1, b0, b1] = cx ?? [0, p.m.D, 0, p.m.W];
  const [x0, y0] = p.m.p(a0, b0, 0);
  const [xv, yv] = p.m.p(a0, b1, 0);
  const [xu, yu] = p.m.p(a1, b0, 0);
  const ctx = p.ctx;
  ctx.save();
  ctx.transform((xv - x0) / img.width, (yv - y0) / img.width, (xu - x0) / img.height, (yu - y0) / img.height, x0, y0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Só a frente (e as costas): o espelho faz os outros dois giros. */
function desenhar(p: Painter, a: MovelArte, frente: Imagens, costas: Imagens | null, enc?: Encaixe) {
  const rot = p.m.rot;
  // giros 2 e 4 mostram a frente (2: na face de baixo à direita; 4: à esquerda); 0 e 6, as costas
  const deFrente = rot === 2 || rot === 4;
  const usarCostas = !deFrente && !!costas && !!a.costas;
  const vista = usarCostas ? a.costas! : a.frente!;
  const imgs = usarCostas ? costas! : frente;
  const ladoNaTela = rot === 2 || rot === 6 ? 'direita' : 'esquerda';
  const espelhar = (vista.lado ?? 'esquerda') !== ladoNaTela;
  const img = espelhar ? imgs.espelho : imgs.normal;
  const ax = espelhar ? img.width - vista.ax : vista.ax;
  pintar(p, img, ax, vista.ay, a.escala, vista.ancora === 'centro', enc ? { enc, encosta: !!a.encosta } : undefined, !!a.pixel);
}
