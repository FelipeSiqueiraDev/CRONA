/**
 * O passo pelas sombras (17/10, o Felipe): a Magistrada (LR p. 252, a ação de movimento Onipresença: ela se desloca para
 * qualquer lugar onde haja sombra ou escuridão) some numa sombra e sai de outra que o mestre escolhe.
 *
 * Quem pode é DADO da criatura (`passoSombras`, em `bestiario.ts`), não um if no código: para dar a mesma habilidade a
 * outra criatura, basta o campo (ou entrar na lista abaixo, que preenche o campo ao criar a partir do livro).
 *
 * "Sombra" de verdade = a casa onde a luz da cena não chega: o quanto a casa fica escura (a escuridão do cômodo menos o
 * que as luzes furam) passa de um limiar. O mestre também marca sombras à mão (`RoomInfo.sombras`). As contas são as do
 * mapa de luz do tabuleiro (`client/src/render/lighting.ts`), para o que aparece escuro ser o que vale como sombra.
 */

/** As criaturas do livro que ganham o passo pelas sombras ao entrar no bestiário (Magistrada: Onipresença, LR p. 252). */
export const CRIATURAS_PASSO_SOMBRAS: readonly string[] = ['mascara-do-desespero'];

/** Uma luz do cômodo, em pixels do mundo (as mesmas da `Light` do tabuleiro). */
export interface LuzDeCasa {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  /** achatamento da poça (a luz baixa cai no chão como elipse: 0,62); sem valor, redonda */
  k?: number;
}

/** O quanto a casa fica escura (0 = clara, 1 = preta) a partir daqui conta como sombra. */
export const LIMIAR_SOMBRA = 0.45;

/** Quanto uma luz fura a escuridão num ponto (0..1): o mesmo degradê do mapa de luz (cheia no centro, 70% aos 40%, zero na borda). */
export function furoDaLuz(L: LuzDeCasa, px: number, py: number): number {
  const k = L.k ?? 1;
  const d = Math.hypot(px - L.x, (py - L.y) / k);
  const r = L.radius;
  if (r <= 0 || d >= r) return 0;
  const u = d / r;
  const f = u < 0.4 ? 1 - 0.3 * (u / 0.4) : 0.7 * (1 - (u - 0.4) / 0.6);
  return L.intensity * f;
}

/** O quanto o ponto fica escuro: a escuridão do cômodo, menos o que a melhor luz por perto fura. */
export function escuridaoNoPonto(luzes: readonly LuzDeCasa[], escuridao: number, px: number, py: number): number {
  let furo = 0;
  for (const L of luzes) furo = Math.max(furo, furoDaLuz(L, px, py));
  return Math.max(0, Math.min(1, escuridao * (1 - Math.min(1, furo))));
}

export const ehSombra = (escuro: number) => escuro >= LIMIAR_SOMBRA;

/** A chave de uma casa nas listas de sombras ("x,y"). */
export const chaveCasa = (x: number, y: number) => `${x},${y}`;

export interface CasaSombra {
  x: number;
  y: number;
}

/** A lista de sombras marcadas à mão, conferida (inteiros dentro da planta, sem repetir). */
export function lerSombras(raw: unknown, largura: number, altura: number): CasaSombra[] {
  if (!Array.isArray(raw)) return [];
  const vistas = new Set<string>();
  const out: CasaSombra[] = [];
  for (const c of raw.slice(0, 400)) {
    if (!c || typeof c !== 'object') continue;
    const { x, y } = c as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (x < 0 || y < 0 || x >= largura || y >= altura) continue;
    const k = chaveCasa(x, y);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push({ x, y });
  }
  return out;
}

/**
 * A animação, em milissegundos desde a mensagem (a mesma conta nas telas do mestre e da mesa):
 *  - na sombra de saída: a poça se abre, a peça fica preta, afunda e a poça fecha;
 *  - na de chegada (começa antes de a primeira fechar, mas a peça só aparece quando a poça está aberta): a poça se
 *    abre, a peça sobe preta e desbota para as cores dela, e a poça fecha.
 */
export const PASSO_SOMBRAS = {
  /** onde a peça é vista: até aqui na casa de saída, a partir de `sobe` na de chegada (entre os dois, escondida) */
  troca: 640,
  sobe: 1000,
  fim: 1800,
} as const;

const claro = (v: number) => Math.max(0, Math.min(1, v));
const faixa = (t: number, a: number, b: number) => claro((t - a) / (b - a));

export interface FasePasso {
  /** a peça está na casa de saída (senão, na de chegada) */
  naSaida: boolean;
  /** a peça aparece (entre a troca e a subida ela está dentro do chão) */
  visivel: boolean;
  /** quanto da altura da peça está fora do chão (1 = inteira, 0 = afundada) */
  altura: number;
  /** quão preta (0 = as cores dela, 1 = silhueta preta) */
  preto: number;
  /** a poça da casa de saída e a da de chegada: 0 fechada, 1 aberta */
  pocaSaida: number;
  pocaChegada: number;
  acabou: boolean;
}

export function fasePasso(ms: number): FasePasso {
  const t = ms;
  const sobe = Math.pow(faixa(t, 1000, 1380), 0.6);
  const naSaida = t < PASSO_SOMBRAS.troca;
  const visivel = t < PASSO_SOMBRAS.troca || t >= PASSO_SOMBRAS.sobe;
  return {
    naSaida,
    visivel,
    altura: naSaida ? 1 - faixa(t, 260, 640) * (0.5 + 0.5 * faixa(t, 260, 640)) : sobe,
    preto: naSaida ? faixa(t, 120, 300) : 1 - faixa(t, 1380, 1650),
    pocaSaida: faixa(t, 0, 220) * (1 - faixa(t, 640, 900)),
    pocaChegada: faixa(t, 780, 1000) * (1 - faixa(t, 1500, 1800)),
    acabou: t >= PASSO_SOMBRAS.fim,
  };
}
