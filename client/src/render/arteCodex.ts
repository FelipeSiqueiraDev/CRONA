/**
 * A chave da arte pintada do Códex DENTRO do tabuleiro (14/10, o Felipe: "a gente que tá fazendo daqui"). Desligada,
 * a cena só usa o que é feito por código: o móvel sem pixel art cai no desenho de reserva, o item largado no chão e
 * a vista tática não carregam as imagens pintadas e a névoa usa as nuvens desenhadas. Fica de fora a viagem (a van e
 * o mundo que passa), que o Felipe quer igual, e os bonecos dos personagens.
 */
export const CODEX_NO_TABULEIRO = false;

/**
 * As exceções que o Felipe aprovou uma a uma: arte do Códex que entra no tabuleiro mesmo com a chave desligada.
 * - escrita_sangue (15/10): a escrita de sangue do Orfanato, a imagem que o Códex entregou em 12/10
 *   (escrita-sangue.zip); a versão feita por código (parede-l.png e parede-r.png) continua na pasta.
 */
const CODEX_APROVADO = new Set(['escrita_sangue']);

/** O móvel entra na cena? Só com pixel art feita por código (e a van, da viagem, e as exceções aprovadas). */
export const moveisDoCodex = (chave: string, arte: { pixel?: boolean }) =>
  CODEX_NO_TABULEIRO || !!arte.pixel || chave.startsWith('van_') || CODEX_APROVADO.has(chave.split(/[~!@]/)[0]);
