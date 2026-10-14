/**
 * Vida (PV), esforço (PE) e sanidade (SAN) de um personagem, como na ficha de
 * Ordem Paranormal RPG: valor atual e total. As condições seguem o livro de
 * regras (capítulo de condições):
 *  - machucado: menos da metade dos PV totais;
 *  - morrendo: 0 PV;
 *  - perturbado: menos da metade da Sanidade total;
 *  - enlouquecendo: Sanidade 0.
 * PE baixo (menos da metade) não é condição do livro; o CRONA usa só para o
 * retrato (respiração lenta, de cansaço).
 */
export interface Vitals {
  pv: number;
  pvMax: number;
  pe: number;
  peMax: number;
  san: number;
  sanMax: number;
}

export type VitalKey = 'pv' | 'pe' | 'san';
export const VITAL_KEYS: VitalKey[] = ['pv', 'pe', 'san'];

export const VITAL_LABEL: Record<VitalKey, string> = { pv: 'PV', pe: 'PE', san: 'SAN' };
export const VITAL_NAME: Record<VitalKey, string> = { pv: 'Vida', pe: 'Esforço', san: 'Sanidade' };

/** Maior valor aceito para um total (PV/PE/SAN). */
export const VITAL_LIMIT = 999;

/** Ficha nova sem números ainda: o mestre ajusta. */
export const DEFAULT_VITALS: Vitals = { pv: 20, pvMax: 20, pe: 5, peMax: 5, san: 20, sanMax: 20 };

const maxKey = (k: VitalKey) => `${k}Max` as const;

/** Muda um valor: `delta` soma ao atual, `value` troca o atual, `max` troca o total. Tudo dentro dos limites. */
export function applyVital(v: Vitals, key: VitalKey, change: { delta?: number; value?: number; max?: number }): Vitals {
  const out = { ...v };
  const mk = maxKey(key);
  const int = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : undefined);
  const max = int(change.max);
  // PE e SAN podem ter máximo 0 (as criaturas não têm); o PV tem pelo menos 1
  if (max !== undefined) out[mk] = Math.max(key === 'pv' ? 1 : 0, Math.min(VITAL_LIMIT, max));
  const value = int(change.value);
  const delta = int(change.delta);
  let cur = out[key];
  if (value !== undefined) cur = value;
  if (delta !== undefined) cur += delta;
  out[key] = Math.max(0, Math.min(out[mk], cur));
  return out;
}

/** Aceita só números válidos (dados que vêm de fora, como o banco salvo). */
export function sanitizeVitals(raw: unknown): Vitals | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  let v: Vitals = { ...DEFAULT_VITALS };
  for (const k of VITAL_KEYS) v = applyVital(v, k, { max: o[maxKey(k)] as number, value: o[k] as number });
  return v;
}

export interface VitalConditions {
  machucado: boolean;
  morrendo: boolean;
  perturbado: boolean;
  enlouquecendo: boolean;
  /** PE abaixo da metade (regra do CRONA, não do livro) */
  cansado: boolean;
}

export function vitalConditions(v: Vitals | undefined): VitalConditions {
  if (!v) return { machucado: false, morrendo: false, perturbado: false, enlouquecendo: false, cansado: false };
  return {
    machucado: v.pv < v.pvMax / 2,
    morrendo: v.pv <= 0,
    perturbado: v.san < v.sanMax / 2,
    // quem não tem Sanidade (as criaturas: SAN 0 de 0) não enlouquece
    enlouquecendo: v.sanMax > 0 && v.san <= 0,
    cansado: v.pe < v.peMax / 2,
  };
}

/** Nomes das condições ativas, na ordem de gravidade. */
export function conditionLabels(c: VitalConditions): string[] {
  const out: string[] = [];
  if (c.morrendo) out.push('Morrendo');
  else if (c.machucado) out.push('Machucado');
  if (c.enlouquecendo) out.push('Enlouquecendo');
  else if (c.perturbado) out.push('Perturbado');
  return out;
}
