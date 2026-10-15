/**
 * A chave da arte pintada do Códex DENTRO do tabuleiro (14/10, o Felipe: "a gente que tá fazendo daqui"). Desligada,
 * a cena só usa o que é feito por código: o móvel sem pixel art cai no desenho de reserva, o item largado no chão e
 * a vista tática não carregam as imagens pintadas e a névoa usa as nuvens desenhadas. Fica de fora a viagem (a van e
 * o mundo que passa), que o Felipe quer igual, e os bonecos dos personagens.
 */
export const CODEX_NO_TABULEIRO = false;

/**
 * As exceções de arte do Códex dentro do tabuleiro. Desde 15/10 (o Felipe: "não quero arte do Códex em absolutamente
 * NADA do meu tabuleiro") a lista é vazia: a escrita de sangue do Orfanato, que era aprovada, volta ao desenho por
 * código. Só a van da viagem (`van_*`) continua, até o Felipe decidir.
 */
const CODEX_APROVADO = new Set<string>();

/** O móvel entra na cena? Só com pixel art feita por código (e a van, da viagem, e as exceções aprovadas). */
export const moveisDoCodex = (chave: string, arte: { pixel?: boolean }) =>
  CODEX_NO_TABULEIRO || !!arte.pixel || chave.startsWith('van_') || CODEX_APROVADO.has(chave.split(/[~!@]/)[0]);
