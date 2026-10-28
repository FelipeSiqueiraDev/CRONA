/**
 * O ajuste de quem senta em cada tipo de assento (28/10), que o servidor manda (`assentosAjuste`): por móvel e direção
 * da pose ("chair_office:ne"), em pixels do tabuleiro, somado ao ajuste do personagem (sentadoAjuste).
 */
export const ajusteAssentos: { mapa: Record<string, [number, number]> } = { mapa: {} };
