import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIR_KEYS,
  PORTRAIT_STATES,
  type AnimDirecao,
  type AnimTabuleiro,
  type BonecoClipe,
  type BonecoTabuleiro,
  type CharacterDef,
  type DirKey,
  type PeQuadro,
  type PortraitArt,
  type PortraitState,
} from '@crona/shared';

/** Pasta das artes dos personagens no repositório (servida em /arte/personagens). */
const ART_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public/arte/personagens');
const EXTS = ['png', 'webp', 'jpg', 'jpeg'];
/** Subpasta das poses do tabuleiro, dentro da pasta do personagem. */
const POSES_DIR = 'tabuleiro-32bits';

/**
 * Procura, na subpasta `sub` da pasta do personagem da folha `sheet`, a imagem
 * de cada nome (sem extensão). null = a folha não é do repositório ou a pasta não existe.
 */
function finder(sheet: string, dir: string, sub = ''): ((base: string) => string | undefined) | null {
  const m = /^\/arte\/personagens\/([a-z0-9-]+)\//.exec(sheet);
  if (!m) return null;
  let files: string[];
  try {
    files = fs.readdirSync(path.join(dir, m[1], sub));
  } catch {
    return null;
  }
  const has = new Set(files.map((f) => f.toLowerCase()));
  const url = `/arte/personagens/${m[1]}/${sub ? `${sub}/` : ''}`;
  return (base) => {
    const ext = EXTS.find((e) => has.has(`${base}.${e}`));
    return ext ? `${url}${base}.${ext}` : undefined;
  };
}

/**
 * Retratos por estado na pasta do personagem da folha `sheet`
 * (/arte/personagens/<nome>/...): retrato-<estado>.png e, para piscar,
 * retrato-<estado>-olhos-fechados.png. Folhas enviadas pela janela não têm.
 */
export function findPortraits(sheet: string, dir = ART_DIR): CharacterDef['portraits'] {
  const find = finder(sheet, dir);
  if (!find) return undefined;
  const out: Partial<Record<PortraitState, PortraitArt>> = {};
  for (const s of PORTRAIT_STATES) {
    const open = find(`retrato-${s}`);
    if (!open) continue;
    const closed = find(`retrato-${s}-olhos-fechados`);
    out[s] = closed ? { open, closed } : { open };
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Poses do tabuleiro (arte em 32 bits) por estado e direção, em
 * /arte/personagens/<nome>/tabuleiro-32bits/: idle-<estado>-<direção>.png.
 * Sem a direção no nome (idle-<estado>.png), é a frente voltada para a direita (`se`).
 */
export function findPoses(sheet: string, dir = ART_DIR): CharacterDef['poses'] {
  const find = finder(sheet, dir, POSES_DIR);
  if (!find) return undefined;
  const out: Partial<Record<PortraitState, Partial<Record<DirKey, string>>>> = {};
  for (const s of PORTRAIT_STATES) {
    const dirs: Partial<Record<DirKey, string>> = {};
    for (const k of DIR_KEYS) {
      const url = find(`idle-${s}-${k}`) ?? (k === 'se' ? find(`idle-${s}`) : undefined);
      if (url) dirs[k] = url;
    }
    if (Object.keys(dirs).length) out[s] = dirs;
  }
  return Object.keys(out).length ? out : undefined;
}

/** As poses agachadas (17/10), na mesma pasta das poses: idle-desarmado-agachado-<dir>.png e idle-armado-agachado-<dir>.png. */
export function findAgachado(sheet: string, dir = ART_DIR): CharacterDef['agachado'] {
  const find = finder(sheet, dir, POSES_DIR);
  if (!find) return undefined;
  const out: NonNullable<CharacterDef['agachado']> = {};
  for (const estado of ['desarmado', 'armado'] as const) {
    const dirs: Partial<Record<DirKey, string>> = {};
    for (const k of DIR_KEYS) {
      const url = find(`idle-${estado}-agachado-${k}`);
      if (url) dirs[k] = url;
    }
    if (Object.keys(dirs).length) out[estado] = dirs;
  }
  return Object.keys(out).length ? out : undefined;
}

/** As poses deitadas (dormindo e caído), na mesma pasta das poses: deitado-dormindo.png e deitado-caido.png. */
export function findDeitado(sheet: string, dir = ART_DIR): CharacterDef['deitado'] {
  const find = finder(sheet, dir, POSES_DIR);
  if (!find) return undefined;
  const dormindo = find('deitado-dormindo');
  const caido = find('deitado-caido');
  return dormindo || caido ? { ...(dormindo ? { dormindo } : {}), ...(caido ? { caido } : {}) } : undefined;
}

/** Quadros de um passo por personagem: o bastante para um ciclo bem desenhado. */
const MAX_QUADROS = 16;

/**
 * Quadros de andar do tabuleiro por estado e direção, na mesma pasta das
 * poses: andar-<estado>-<direção>-<n>.png, com n = 1, 2, 3... em ordem (para
 * no primeiro que falta).
 */
export function findPassos(sheet: string, dir = ART_DIR): CharacterDef['passos'] {
  const find = finder(sheet, dir, POSES_DIR);
  if (!find) return undefined;
  const out: Partial<Record<PortraitState, Partial<Record<DirKey, string[]>>>> = {};
  for (const s of PORTRAIT_STATES) {
    const dirs: Partial<Record<DirKey, string[]>> = {};
    for (const k of DIR_KEYS) {
      const lista: string[] = [];
      for (let n = 1; n <= MAX_QUADROS; n++) {
        const url = find(`andar-${s}-${k}-${n}`);
        if (!url) break;
        lista.push(url);
      }
      if (lista.length) dirs[k] = lista;
    }
    if (Object.keys(dirs).length) out[s] = dirs;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * O boneco animado do tabuleiro (gerado por scripts/boneco.py), na mesma pasta
 * das poses: anim.json, com as tiras parado-<estado>-<direção>.png e
 * andar-<estado>-<direção>.png. Os nomes das tiras viram endereços; tira que
 * falta na pasta tira a direção.
 */
export function findAnim(sheet: string, dir = ART_DIR): AnimTabuleiro | undefined {
  const m = /^\/arte\/personagens\/([a-z0-9-]+)\//.exec(sheet);
  if (!m) return undefined;
  const pasta = path.join(dir, m[1], POSES_DIR);
  let a: ArquivoAnim;
  try {
    a = JSON.parse(fs.readFileSync(path.join(pasta, 'anim.json'), 'utf8')) as ArquivoAnim;
  } catch {
    return undefined;
  }
  if (a?.versao !== 1 || !a.estados || typeof a.estados !== 'object') return undefined;
  const url = `/arte/personagens/${m[1]}/${POSES_DIR}/`;
  const existe = (f: unknown): f is string => typeof f === 'string' && /^[a-z0-9-]+\.png$/.test(f) && fs.existsSync(path.join(pasta, f));
  const estados: AnimTabuleiro['estados'] = {};
  for (const s of PORTRAIT_STATES) {
    const out: Partial<Record<DirKey, AnimDirecao>> = {};
    for (const k of DIR_KEYS) {
      const d = a.estados[s]?.[k];
      if (!d || !existe(d.parado?.arquivo) || !existe(d.andar?.arquivo)) continue;
      out[k] = {
        w: d.w,
        h: d.h,
        ax: d.ax,
        ay: d.ay,
        olhos: !!d.olhos,
        parado: { url: url + d.parado.arquivo, quadros: d.parado.quadros },
        andar: { url: url + d.andar.arquivo, quadros: d.andar.quadros },
        pesParado: d.pesParado ?? [],
        pesAndar: d.pesAndar ?? [],
        ...(typeof d.faseAndar === 'number' ? { faseAndar: d.faseAndar } : {}),
      };
    }
    if (Object.keys(out).length) estados[s] = out;
  }
  if (!Object.keys(estados).length) return undefined;
  return { versao: 1, msParado: a.msParado ?? 150, faseAndar: a.faseAndar ?? 0.25, estados };
}

/** O anim.json como scripts/boneco.py grava (os nomes das tiras, sem o endereço). */
interface ArquivoAnim {
  versao?: number;
  msParado?: number;
  faseAndar?: number;
  estados?: Partial<
    Record<
      string,
      Partial<
        Record<
          string,
          Omit<AnimDirecao, 'parado' | 'andar' | 'pesParado' | 'pesAndar'> & {
            parado: { arquivo: string; quadros: number };
            andar: { arquivo: string; quadros: number };
            pesParado?: PeQuadro[][];
            pesAndar?: PeQuadro[][];
          }
        >
      >
    >
  >;
}

/** Subpasta do boneco filmado em 3D (docs/PERSONAGENS-3D.md). */
const BONECO_DIR = 'tabuleiro-3d';

/**
 * O boneco filmado em 3D, em tabuleiro-3d/anim.json (versão 2): por estado e
 * direção, as animações (parado, andar, sentar, pegar...), cada uma numa tira.
 * O nome da tira vira endereço; animação sem a tira na pasta sai.
 */
export function findBoneco(sheet: string, dir = ART_DIR): BonecoTabuleiro | undefined {
  const m = /^\/arte\/personagens\/([a-z0-9-]+)\//.exec(sheet);
  if (!m) return undefined;
  const pasta = path.join(dir, m[1], BONECO_DIR);
  let a: { versao?: number; escala?: number; estados?: Record<string, Record<string, Record<string, Record<string, unknown>>>> };
  try {
    a = JSON.parse(fs.readFileSync(path.join(pasta, 'anim.json'), 'utf8'));
  } catch {
    return undefined;
  }
  if (a?.versao !== 2 || !a.estados || typeof a.estados !== 'object') return undefined;
  const url = `/arte/personagens/${m[1]}/${BONECO_DIR}/`;
  const num = (v: unknown, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
  const estados: BonecoTabuleiro['estados'] = {};
  for (const s of PORTRAIT_STATES) {
    const porDir = a.estados[s];
    if (!porDir) continue;
    const out: Partial<Record<DirKey, Record<string, BonecoClipe>>> = {};
    for (const k of DIR_KEYS) {
      const clipes = porDir[k];
      if (!clipes) continue;
      const bons: Record<string, BonecoClipe> = {};
      for (const [nome, c] of Object.entries(clipes)) {
        const arq = c.arquivo;
        if (!/^[a-z0-9_]+$/.test(nome) || typeof arq !== 'string' || !/^[a-z0-9_-]+\.png$/.test(arq) || !fs.existsSync(path.join(pasta, arq))) continue;
        const quadros = Math.round(num(c.quadros));
        if (quadros < 1) continue;
        bons[nome] = {
          url: url + arq,
          quadros,
          w: num(c.w),
          h: num(c.h),
          ax: num(c.ax),
          ay: num(c.ay),
          laco: c.laco !== false,
          ...(typeof c.ms === 'number' ? { ms: c.ms } : {}),
          ...(typeof c.casasPorCiclo === 'number' ? { casasPorCiclo: c.casasPorCiclo } : {}),
          ...(typeof c.fase === 'number' ? { fase: c.fase } : {}),
          ...(c.segura === true ? { segura: true } : {}),
          pes: Array.isArray(c.pes) ? (c.pes as PeQuadro[][]) : [],
        };
      }
      if (Object.keys(bons).length) out[k] = bons;
    }
    if (Object.keys(out).length) estados[s] = out;
  }
  if (!Object.keys(estados).length) return undefined;
  return { versao: 2, escala: num(a.escala, 0.5), estados };
}

/** Atualiza os retratos, as poses, os passos e o boneco do tabuleiro de todos os personagens. Devolve true se algo mudou. */
/**
 * A folha de um personagem entregue numa pasta de arte/personagens/<nome>/ (a das 8 direções ou a folha antiga),
 * como URL servida; undefined = a pasta não existe ou ainda não tem folha.
 */
export function folhaDaPasta(nome: string, dir = ART_DIR): string | undefined {
  const acha = finder(`/arte/personagens/${nome}/`, dir);
  return acha?.('oito-direcoes') ?? acha?.('folha');
}

export function refreshPortraits(list: CharacterDef[], dir = ART_DIR): boolean {
  let changed = false;
  for (const def of list) {
    const portraits = findPortraits(def.sheet, dir);
    const poses = findPoses(def.sheet, dir);
    const passos = findPassos(def.sheet, dir);
    const anim = findAnim(def.sheet, dir);
    const boneco = findBoneco(def.sheet, dir);
    const deitado = findDeitado(def.sheet, dir);
    const agachado = findAgachado(def.sheet, dir);
    if (JSON.stringify([portraits, poses, passos, anim, boneco, deitado, agachado]) === JSON.stringify([def.portraits, def.poses, def.passos, def.anim, def.boneco, def.deitado, def.agachado])) continue;
    if (agachado) def.agachado = agachado;
    else delete def.agachado;
    if (deitado) def.deitado = deitado;
    else delete def.deitado;
    if (portraits) def.portraits = portraits;
    else delete def.portraits;
    if (poses) def.poses = poses;
    else delete def.poses;
    if (passos) def.passos = passos;
    else delete def.passos;
    if (anim) def.anim = anim;
    else delete def.anim;
    if (boneco) def.boneco = boneco;
    else delete def.boneco;
    changed = true;
  }
  return changed;
}
