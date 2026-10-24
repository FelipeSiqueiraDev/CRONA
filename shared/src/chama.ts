/**
 * A chama fantasmagórica das criaturas (17/10, o Felipe): o Anfitrião do livro é da tecnologia e do caos, e todas as
 * faces dele carregam a mesma chama, cada uma na cor da sua. Quem tem chama é DADO da criatura (`chama`, em
 * `bestiario.ts`), não um if no desenho: para pôr fogo no Existido, no Deus da Morte ou em quem for, basta o campo.
 * O desenho em pixel está em `client/src/render/chamaPeca.ts`; aqui ficam só a tabela, as cores e as contas.
 */

export interface ChamaCriatura {
  /** a cor do corpo da chama (#rrggbb) */
  cor: string;
  /** a cor da borda fria, onde o fogo morre; sem ela, a mesma cor escurecida */
  acento?: string;
  /** o toque de outra cor (faíscas e pontos soltos no meio do fogo); sem ele, só a cor da chama */
  toque?: string;
  /** o quanto queima: 1 é o normal, 0,3 uma brasa, 2 uma fogueira (0,2 a 2,5) */
  intensidade: number;
}

/** A tabela do Felipe: o Anfitrião e as cinco faces (cada face na cor do elemento/da face dela). */
export const CHAMAS_DAS_CRIATURAS: Record<string, ChamaCriatura> = {
  // azul e roxo, com um toque de magenta (a foto do livro: chamas fantasmagóricas azuis e roxas)
  anfitriao: { cor: '#4a6bff', acento: '#6a28b8', toque: '#ff3fc4', intensidade: 1 },
  'anfitriao-amphitruo': { cor: '#7fd6ff', acento: '#3a6fd8', intensidade: 1 },
  'anfitriao-aeneas': { cor: '#ee3a2c', acento: '#7a1018', intensidade: 1 },
  'anfitriao-liber': { cor: '#ff8a1e', acento: '#a8340c', intensidade: 1 },
  'anfitriao-silenus': { cor: '#2fd9c8', acento: '#0f6e8c', intensidade: 1 },
  'anfitriao-plautus': { cor: '#ff62ae', acento: '#9a2a86', intensidade: 1 },
  // o Anárquico Descontrolado (23/10, o Felipe: "ele não é vermelho, é roxo, brilhante; ele é literalmente feito de energia")
  'anarquico-descontrolado': { cor: '#a24bff', acento: '#4a1a9a', toque: '#ff7ae8', intensidade: 1.2 },
};

const limpoHex = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null);

/** A chama que veio da tela (ou do banco), conferida: cor válida, intensidade dentro do limite. null = sem chama. */
export function lerChama(raw: unknown): ChamaCriatura | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const cor = limpoHex(o.cor);
  if (!cor) return null;
  const acento = limpoHex(o.acento);
  const toque = limpoHex(o.toque);
  const i = typeof o.intensidade === 'number' && Number.isFinite(o.intensidade) ? o.intensidade : 1;
  return { cor, ...(acento ? { acento } : {}), ...(toque ? { toque } : {}), intensidade: Math.max(0.2, Math.min(2.5, i)) };
}

/** A chama de uma criatura: a que ela guarda, ou a da tabela pelo id (as criadas antes do campo existir). */
export function chamaDaCriatura(id: string | undefined, propria?: ChamaCriatura | null): ChamaCriatura | null {
  if (propria) return propria;
  return id ? (CHAMAS_DAS_CRIATURAS[id] ?? null) : null;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mistura = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * k),
  Math.round(a[1] + (b[1] - a[1]) * k),
  Math.round(a[2] + (b[2] - a[2]) * k),
];

/** Degraus de calor da paleta: 0 e 1 são vazio; do 2 (a borda fria) ao último (o miolo claro). */
export const DEGRAUS_DA_CHAMA = 12;

/** Uma cor da paleta: r, g, b e a opacidade (0..255). */
export type CorDaChama = [number, number, number, number];

/**
 * A paleta da chama, do frio para o quente: a borda no acento escurecido e meio transparente (a chama é fantasma, não
 * sólida), o corpo na cor, e o miolo clareando até quase branco com um fio da cor. `toque` dá a mesma rampa na outra
 * cor (usada nos pontos soltos). Devolve DEGRAUS_DA_CHAMA cores; as duas primeiras são transparentes.
 */
export function paletaDaChama(cor: string, acento?: string, toque?: string): { corpo: CorDaChama[]; toque: CorDaChama[] } {
  const rampa = (principal: string, frio?: string): CorDaChama[] => {
    const c = rgb(principal);
    const f = frio ? rgb(frio) : mistura(c, [8, 4, 24], 0.62);
    const branco: [number, number, number] = [250, 247, 255];
    const out: CorDaChama[] = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (let i = 2; i < DEGRAUS_DA_CHAMA; i++) {
      const k = (i - 2) / (DEGRAUS_DA_CHAMA - 3);
      // 0..0,45: do acento à cor; 0,45..1: da cor ao miolo claro
      const rgbk = k < 0.45 ? mistura(f, c, k / 0.45) : mistura(c, branco, Math.pow((k - 0.45) / 0.55, 1.3) * 0.82);
      // a borda é a mais rala; o miolo, quase cheio (o fantasma deixa ver o que está atrás)
      out.push([rgbk[0], rgbk[1], rgbk[2], Math.round(255 * (0.34 + 0.56 * Math.sqrt(k)))]);
    }
    return out;
  };
  return { corpo: rampa(cor, acento), toque: rampa(toque ?? cor, toque ? acento : undefined) };
}

/**
 * Quanto o vento da peça empurra a chama (px de mundo por segundo → inclinação -1..1 e o quanto ela encolhe):
 * andando, a chama é arrastada para trás (contra o sentido do passo) e fica mais baixa; parada, sobe reta e alta.
 */
export function ventoDaChama(vx: number, vy: number): { inclina: number; encolhe: number } {
  const v = Math.hypot(vx, vy);
  // sentido na tela: andando para a direita, a chama pende para a esquerda
  const lado = v > 0.5 ? -vx / v : 0;
  const forca = Math.min(1, v / 45);
  return { inclina: lado * forca, encolhe: 0.35 * forca };
}
