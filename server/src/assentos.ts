/**
 * O ajuste de quem senta em cada tipo de assento (28/10, o Felipe: "na cadeira ela tá ótima, mas na poltrona tá
 * terrível"): por móvel e direção da pose ("chair_office:ne"), em pixels do tabuleiro, somado ao ajuste do personagem.
 * Fica em client/public/arte/mobiliario/sentar.json, junto da arte dos móveis (entra no git).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIR_KEYS, type DirKey } from '@crona/shared';

const ARQUIVO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public/arte/mobiliario/sentar.json');
const CHAVE = /^[a-z0-9_]+:(ne|nw|se|sw|n|s|e|w)$/;

export type AjusteAssentos = Record<string, [number, number]>;

export function lerAssentos(arquivo = ARQUIVO): AjusteAssentos {
  try {
    const bruto = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as Record<string, unknown>;
    const out: AjusteAssentos = {};
    for (const [k, v] of Object.entries(bruto))
      if (CHAVE.test(k) && Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))) out[k] = [v[0], v[1]];
    return out;
  } catch {
    return {};
  }
}

/** Grava o ajuste de um móvel numa direção (0, 0 tira) e devolve o mapa inteiro. */
export function gravarAssento(mapa: AjusteAssentos, defId: string, dir: DirKey, dx: number, dy: number, arquivo = ARQUIVO): AjusteAssentos {
  if (!(DIR_KEYS as readonly string[]).includes(dir) || !/^[a-z0-9_]+$/.test(defId)) return mapa;
  const k = `${defId}:${dir}`;
  const novo = { ...mapa };
  const x = Math.round(Math.max(-60, Math.min(60, dx)) * 2) / 2;
  const y = Math.round(Math.max(-60, Math.min(60, dy)) * 2) / 2;
  if (x || y) novo[k] = [x, y];
  else delete novo[k];
  const ordenado = Object.fromEntries(Object.entries(novo).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(ordenado).length) fs.writeFileSync(arquivo, JSON.stringify(ordenado, null, 2) + '\n');
  else fs.rmSync(arquivo, { force: true });
  return ordenado;
}
