import { reduced } from '../ui/motion';
import { breathPoints, type BreathMode } from './portrait';

/**
 * O fôlego das peças paradas no tabuleiro (17/10, o Felipe: "ninguém respira pela perna, o peito sobe e desce,
 * acabou"). Os mesmos fôlegos do personagem grande da ficha (`breathPoints`, pela ficha: machucado irregular, SAN
 * baixa ofegante, PE baixo devagar, morrendo fraco), em números: quem desenha sobe o peito a partir da cintura
 * (`drawPose`). Cada peça tem a sua volta de fôlegos e começa num ponto dela: ninguém respira junto.
 */

interface Volta {
  modo: BreathMode;
  armado: boolean;
  pts: { t: number; b: number }[];
  /** duração da volta (s) */
  total: number;
  /** quando a volta começou (ms, relógio do quadro) */
  t0: number;
  /** trocou de jeito de respirar: de onde o peito estava e quando, para emendar sem pulo */
  bAntes: number;
  desde: number;
}

const voltas = new Map<number, Volta>();

/** Emenda de um jeito de respirar no outro (ms). */
const EMENDA_MS = 900;

/**
 * Com a arma na mão: o fôlego mais firme e controlado (um pouco mais curto e mais raso, alerta). Morrendo, não
 * muda nada.
 */
const ARMADO = { tempo: 0.88, fundura: 0.82 };

/** Curva suave de um ponto ao outro (como o `ease-in-out` dos quadros-chave da ficha). */
const suave = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

function fundura(v: Volta, now: number): number {
  const k = v.armado && v.modo !== 'dying' ? ARMADO : null;
  const total = v.total * (k?.tempo ?? 1);
  const t = ((((now - v.t0) / 1000) % total) + total) % total;
  const s = t / (k?.tempo ?? 1);
  const pts = v.pts;
  let i = 1;
  while (i < pts.length - 1 && pts[i].t < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const u = b.t > a.t ? Math.min(1, Math.max(0, (s - a.t) / (b.t - a.t))) : 1;
  return (a.b + (b.b - a.b) * suave(u)) * (k?.fundura ?? 1);
}

/**
 * Quanto o peito da peça está cheio agora (0 = vazio; ~1 = fôlego fundo). `fase` (0..10) escolhe onde a volta
 * começa. Com movimento reduzido, 0: a peça fica parada como a arte.
 */
export function folegoDaPeca(id: number, modo: BreathMode, armado: boolean, now: number, fase: number): number {
  if (reduced()) return 0;
  let v = voltas.get(id);
  if (!v || v.modo !== modo || v.armado !== armado) {
    const antes = v ? atual(v, now) : 0;
    const { pts, total } = breathPoints(modo);
    v = {
      modo,
      armado,
      pts,
      total,
      // a primeira volta começa num ponto da peça; trocando de jeito, começa agora, com o peito vazio
      t0: v ? now : now - ((fase / 10) % 1) * total * 1000,
      bAntes: antes,
      desde: v ? now : -Infinity,
    };
    voltas.set(id, v);
  }
  return atual(v, now);
}

/** O fôlego de agora, emendado no jeito de antes logo depois de uma troca. */
function atual(v: Volta, now: number): number {
  const b = fundura(v, now);
  const u = (now - v.desde) / EMENDA_MS;
  return u >= 1 ? b : v.bAntes + (b - v.bAntes) * suave(Math.max(0, u));
}
