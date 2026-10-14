/**
 * A chave da arte pintada do Códex DENTRO do tabuleiro (14/10, o Felipe: "a gente que tá fazendo daqui"). Desligada,
 * a cena só usa o que é feito por código: o móvel sem pixel art cai no desenho de reserva, o item largado no chão e
 * a vista tática não carregam as imagens pintadas e a névoa usa as nuvens desenhadas. Fica de fora a viagem (a van e
 * o mundo que passa), que o Felipe quer igual, e os bonecos dos personagens.
 */
export const CODEX_NO_TABULEIRO = false;

/** O móvel entra na cena? Só com pixel art feita por código (e a van, da viagem). */
export const moveisDoCodex = (chave: string, arte: { pixel?: boolean }) => CODEX_NO_TABULEIRO || !!arte.pixel || chave.startsWith('van_');
