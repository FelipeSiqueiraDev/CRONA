/**
 * O tamanho dos seres no tabuleiro (06/11, o Felipe: "pegar o tamanho real dos personagens como é tratado no livro"),
 * pela Tabela 7.1 do livro (LR p. 179). O livro não dá altura: dá a categoria, os exemplos e o espaço ocupado
 * (Minúsculo, Pequeno e Médio: 1,5 m; Grande: 3 m; Enorme: 4,5 m; Colossal: 9 m).
 *
 * - **Espaço no chão:** a peça Média ocupa uma casa (0,75 m), e o quadrado de 1,5 m do livro fica nas regras de
 *   alcance; na mesma proporção, a Grande ocupa 2 × 2 casas, a Enorme 3 × 3 e a Colossal 6 × 6. Ninguém entra nessas
 *   casas, e o alcance e a adjacência contam da borda dela.
 * - **Altura do boneco:** a dos exemplos do livro quando a criatura não tem a dela (a Magistrada fica como foi
 *   desenhada; a Camarilla e a Ana têm a altura própria).
 */
import type { Tamanho } from './combate/manobra';

/** Casas de cada lado da pegada no chão. */
export const LADO_DO_TAMANHO: Record<Tamanho, number> = { minusculo: 1, pequeno: 1, medio: 1, grande: 2, enorme: 3, colossal: 6 };

/** A altura do boneco, em metros, quando a criatura não tem a dela (os exemplos da Tab. 7.1). */
export const ALTURA_DO_TAMANHO: Record<Tamanho, number> = { minusculo: 0.3, pequeno: 0.9, medio: 1.8, grande: 3, enorme: 4.5, colossal: 9 };

export interface Pegada {
  x0: number;
  y0: number;
  /** casas de cada lado */
  lado: number;
}

/**
 * As casas que a peça ocupa: a casa dela é a de referência (onde o servidor a guarda e por onde ela anda), e a pegada
 * se espalha em volta dela, o meio da pegada o mais perto possível do meio da casa.
 */
export function pegadaDaPeca(x: number, y: number, lado = 1): Pegada {
  const n = Math.max(1, Math.round(lado));
  const k = Math.floor((n - 1) / 2);
  return { x0: x - k, y0: y - k, lado: n };
}

/** Quanto o meio do desenho sai do meio da casa de referência (0 com lado ímpar, meia casa com lado par). */
export function desvioDoMeio(lado = 1): number {
  const n = Math.max(1, Math.round(lado));
  return n / 2 - Math.floor((n - 1) / 2) - 0.5;
}

/** A casa está dentro da pegada? */
export function naPegada(p: Pegada, x: number, y: number): boolean {
  return x >= p.x0 && y >= p.y0 && x < p.x0 + p.lado && y < p.y0 + p.lado;
}

/** Todas as casas da pegada. */
export function casasDaPegada(p: Pegada): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < p.lado; dy++) for (let dx = 0; dx < p.lado; dx++) out.push({ x: p.x0 + dx, y: p.y0 + dy });
  return out;
}

/** A casa da pegada mais perto de um ponto (para o alcance contar da borda da peça grande). */
export function casaMaisPerto(p: Pegada, x: number, y: number): { x: number; y: number } {
  return { x: Math.max(p.x0, Math.min(p.x0 + p.lado - 1, x)), y: Math.max(p.y0, Math.min(p.y0 + p.lado - 1, y)) };
}

/** As duas casas mais perto entre duas pegadas: a distância e a adjacência do combate contam entre elas. */
export function casasMaisPerto(a: Pegada, b: Pegada): [{ x: number; y: number }, { x: number; y: number }] {
  const eixo = (a0: number, an: number, b0: number, bn: number): [number, number] => {
    const a1 = a0 + an - 1;
    const b1 = b0 + bn - 1;
    if (a1 < b0) return [a1, b0];
    if (b1 < a0) return [a0, b1];
    // se cruzam no eixo: o mesmo valor dos dois lados
    const m = Math.max(a0, b0);
    return [m, m];
  };
  const [ax, bx] = eixo(a.x0, a.lado, b.x0, b.lado);
  const [ay, by] = eixo(a.y0, a.lado, b.y0, b.lado);
  return [
    { x: ax, y: ay },
    { x: bx, y: by },
  ];
}
