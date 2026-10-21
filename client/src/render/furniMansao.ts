import { Z_PER_M } from '@crona/shared';
import { B, lightIf, V, type Builder } from './furniKit';

/**
 * Mansão Albuquerque (21/10): as peças que acendem e que o desenho de pixel não traz a luz. A arte é a de pixel
 * (moveis.json, `mansao_*.py`); aqui ficam só a caixa de reserva (enquanto a arte carrega) e a LUZ de cada uma.
 */
const alto = (h: number) => Math.max(0.1, h / Z_PER_M);

export const MANSAO_BUILDERS: Record<string, Builder> = {
  /** a TV gigante do quarto da Catarina e da sala de jogos: a tela acesa dá uma luz azulada que muda (clique duplo liga e desliga) */
  tv_gamer(def, state) {
    const h = alto(def.height);
    return V(
      [B([0.1, 0.9, 0.1, def.width - 0.1, 0, h], def.colors[0])],
      lightIf(state === 0, { u: 0.5, v: def.width / 2, z: h * 0.65, radius: 150, color: '#8ad0ff', intensity: 0.55, flicker: 0.14, kind: 'electric' }),
    );
  },
};
