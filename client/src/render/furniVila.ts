import { Z_PER_M } from '@crona/shared';
import { B, lightIf, V, WARM, type Builder } from './furniKit';

/**
 * Santo Berço (14/10): as peças da vila que acendem. A arte é a de pixel (moveis.json); aqui fica só a caixa de reserva
 * (enquanto a arte carrega) e a LUZ de cada uma, que o desenho de pixel não traz.
 */
const alto = (h: number) => Math.max(0.1, h / Z_PER_M);

export const VILA_BUILDERS: Record<string, Builder> = {
  /** o cristal (e o poste com o cristal na ponta): a luz da cor dele, sem tremer como o fogo; o vermelho esquenta */
  luz_cristal(def, state) {
    const [base, brilho] = def.colors;
    const h = alto(def.height);
    const poste = def.width === 1 && h > 2;
    return V(
      [B([0.3, 0.7, 0.3, 0.7, 0, h], base)],
      lightIf(state === 0, { u: 0.5, v: 0.5, z: h * 0.85, radius: poste ? 200 : 110, color: brilho, intensity: poste ? 0.95 : 0.7, flicker: 0.04, kind: 'cristal' }),
    );
  },

  /** a forja: as brasas acesas no meio do carvão */
  forja(def, state) {
    const h = alto(def.height);
    return V(
      [B([0.05, def.depth - 0.05, 0.05, def.width - 0.05, 0, h], def.colors[0])],
      lightIf(state === 0, { u: def.depth / 2, v: def.width / 2, z: h * 0.8, radius: 210, color: '#ff8a3a', intensity: 1, flicker: 0.2, kind: 'fire' }),
    );
  },

  /** a neblina densa: o banco de neblina sai do fog.ts; aqui só a marquinha no chão para o mestre achar a peça */
  neblina(def) {
    return V([B([0.3, 0.7, 0.3, 0.7, 0, 0.02], def.colors[0])]);
  },

  /** a lareira encostada na parede: o fogo na boca dela */
  lareira(def, state) {
    const h = alto(def.height);
    return V(
      [B([0.05, def.depth - 0.05, 0.05, def.width - 0.05, 0, h], def.colors[0])],
      lightIf(state === 0, { u: def.depth * 0.6, v: def.width / 2, z: 0.4, radius: 240, color: WARM, intensity: 1, flicker: 0.22, kind: 'fire' }),
    );
  },
};
