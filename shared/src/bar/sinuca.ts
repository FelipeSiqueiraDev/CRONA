/**
 * A sinuca do bar: a física das bolas (atrito, tabela, choque e caçapa) e a regra da bola 8, um
 * pouco simplificada (lisas contra listradas; quem encaçapa a sua joga de novo; a branca na caçapa
 * ou a tacada que não toca em nada é falta e passa a vez; a 8 só no fim, senão perde). Sozinho,
 * é treino: encaçapar todas com o menor número de tacadas.
 *
 * A mesa fica em pé, como na tela do celular: 100 de largura por 200 de comprimento (1 = 1,27 cm),
 * a branca embaixo e o triângulo em cima. Só soma, multiplicação, divisão e raiz: o mesmo
 * resultado em todo celular (ver o index).
 */
import { sorteio } from './sorteio';

export const LARGURA = 100;
export const COMPRIMENTO = 200;
export const RAIO = 2.3;
/** a casa da branca (embaixo) e a ponta do triângulo (em cima) */
export const CABECA = { x: 50, y: 150 };
export const PE = { x: 50, y: 58 };

/** As caçapas: as quatro dos cantos e as duas do meio das tabelas compridas. */
export const CACAPAS = [
  { x: -1.4, y: -1.4, r: 5.6 },
  { x: LARGURA + 1.4, y: -1.4, r: 5.6 },
  { x: -2.4, y: COMPRIMENTO / 2, r: 4.9 },
  { x: LARGURA + 2.4, y: COMPRIMENTO / 2, r: 4.9 },
  { x: -1.4, y: COMPRIMENTO + 1.4, r: 5.6 },
  { x: LARGURA + 1.4, y: COMPRIMENTO + 1.4, r: 5.6 },
];

/** Passo da física (1/240 s), atrito (unidades/s²), quanto a tabela devolve, o choque das bolas e a tacada mais forte. */
export const DT = 1 / 240;
export const ATRITO = 24;
export const TABELA = 0.76;
export const CHOQUE = 0.95;
export const VMAX = 340;

export interface Bola {
  /** 0 = a branca; 1 a 7 lisas; 8 a preta; 9 a 15 listradas */
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fora: boolean;
}

export type Grupo = 'lisas' | 'listradas';
export const grupoDa = (n: number): Grupo | null => (n >= 1 && n <= 7 ? 'lisas' : n >= 9 ? 'listradas' : null);

/** As cores das bolas (a 9 a 15 repetem as da 1 a 7, com a faixa branca). */
export const COR_BOLA = ['#f4f1e6', '#f2c230', '#2f5fd0', '#d8352a', '#6a3aa8', '#f07a22', '#2a9a52', '#8a2a24', '#141414'];
export const corDa = (n: number) => COR_BOLA[n <= 8 ? n : n - 8];

const R3 = Math.sqrt(3);

/** O triângulo arrumado (a 8 no meio, um canto liso e outro listrado) e a branca na cabeça. */
export function arrumar(semente: number): Bola[] {
  const rnd = sorteio(semente);
  const resto = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (let i = resto.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [resto[i], resto[j]] = [resto[j], resto[i]];
  }
  // os cantos de trás: um de cada grupo
  const lisa = resto.findIndex((n) => n < 8);
  const canto1 = resto.splice(lisa, 1)[0];
  const listrada = resto.findIndex((n) => n > 8);
  const canto2 = resto.splice(listrada, 1)[0];
  const bolas: Bola[] = [{ n: 0, x: CABECA.x, y: CABECA.y, vx: 0, vy: 0, fora: false }];
  const passo = RAIO * 2 + 0.02;
  for (let fila = 0; fila < 5; fila++)
    for (let i = 0; i <= fila; i++) {
      const x = PE.x + (i - fila / 2) * passo;
      const y = PE.y - fila * (passo * R3) / 2;
      let n: number;
      if (fila === 2 && i === 1) n = 8;
      else if (fila === 4 && i === 0) n = canto1;
      else if (fila === 4 && i === 4) n = canto2;
      else n = resto.shift()!;
      bolas.push({ n, x, y, vx: 0, vy: 0, fora: false });
    }
  return bolas;
}

/** Uma tacada rodando: as bolas, a primeira que a branca tocou e as que caíram. */
export interface Mundo {
  bolas: Bola[];
  primeiroToque: number | null;
  encacapadas: number[];
  parado: boolean;
  t: number;
  /** o que aconteceu desde a última vez que a tela olhou (o som e a animação; não mexe no resultado) */
  batidas: { tipo: 'bola' | 'tabela'; forca: number }[];
  quedas: { n: number; x: number; y: number; cx: number; cy: number }[];
}

/** Começa a tacada: a branca sai com (vx, vy), limitada à mais forte. */
export function tacar(bolas: Bola[], vx: number, vy: number): Mundo {
  const v = Math.sqrt(vx * vx + vy * vy);
  const k = v > VMAX ? VMAX / v : 1;
  const copia = bolas.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const branca = copia.find((b) => b.n === 0)!;
  branca.vx = vx * k;
  branca.vy = vy * k;
  return { bolas: copia, primeiroToque: null, encacapadas: [], parado: false, t: 0, batidas: [], quedas: [] };
}

/** Um passo de física (DT). */
export function passo(m: Mundo) {
  if (m.parado) return;
  m.t += DT;
  const bs = m.bolas;
  for (const b of bs) {
    if (b.fora || (b.vx === 0 && b.vy === 0)) continue;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const nv = v - ATRITO * DT;
    if (nv <= 0.5) (b.vx = 0), (b.vy = 0);
    else (b.vx = (b.vx * nv) / v), (b.vy = (b.vy * nv) / v);
    // a tabela (menos na boca das caçapas)
    const bocaCanto = b.y < 7 || b.y > COMPRIMENTO - 7;
    const bocaMeio = b.y > COMPRIMENTO / 2 - 4.4 && b.y < COMPRIMENTO / 2 + 4.4;
    if (b.x < RAIO && !bocaCanto && !bocaMeio) (b.x = 2 * RAIO - b.x), (b.vx = -b.vx * TABELA), m.batidas.push({ tipo: 'tabela', forca: Math.abs(b.vx) / VMAX });
    if (b.x > LARGURA - RAIO && !bocaCanto && !bocaMeio) (b.x = 2 * (LARGURA - RAIO) - b.x), (b.vx = -b.vx * TABELA), m.batidas.push({ tipo: 'tabela', forca: Math.abs(b.vx) / VMAX });
    const bocaLado = b.x < 7 || b.x > LARGURA - 7;
    if (b.y < RAIO && !bocaLado) (b.y = 2 * RAIO - b.y), (b.vy = -b.vy * TABELA), m.batidas.push({ tipo: 'tabela', forca: Math.abs(b.vy) / VMAX });
    if (b.y > COMPRIMENTO - RAIO && !bocaLado) (b.y = 2 * (COMPRIMENTO - RAIO) - b.y), (b.vy = -b.vy * TABELA), m.batidas.push({ tipo: 'tabela', forca: Math.abs(b.vy) / VMAX });
    // a caçapa
    for (const c of CACAPAS) {
      const dx = b.x - c.x;
      const dy = b.y - c.y;
      if (dx * dx + dy * dy < c.r * c.r) {
        cair(m, b, c);
        break;
      }
    }
    if (!b.fora && (b.x < -5 || b.x > LARGURA + 5 || b.y < -5 || b.y > COMPRIMENTO + 5)) cair(m, b, CACAPAS.reduce((p, c) => ((c.x - b.x) ** 2 + (c.y - b.y) ** 2 < (p.x - b.x) ** 2 + (p.y - b.y) ** 2 ? c : p)));
  }
  // o choque entre as bolas
  const d0 = 4 * RAIO * RAIO;
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    if (a.fora) continue;
    for (let j = i + 1; j < bs.length; j++) {
      const b = bs[j];
      if (b.fora) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= d0 || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vrel > 0) {
        const k = (vrel * (1 + CHOQUE)) / 2;
        a.vx -= k * nx;
        a.vy -= k * ny;
        b.vx += k * nx;
        b.vy += k * ny;
        if (m.primeiroToque === null && (a.n === 0 || b.n === 0)) m.primeiroToque = a.n === 0 ? b.n : a.n;
        m.batidas.push({ tipo: 'bola', forca: vrel / VMAX });
      }
      const sobra = (2 * RAIO - d) / 2;
      a.x -= nx * sobra;
      a.y -= ny * sobra;
      b.x += nx * sobra;
      b.y += ny * sobra;
    }
  }
  m.parado = m.t > 40 || bs.every((b) => b.fora || (b.vx === 0 && b.vy === 0));
}

function cair(m: Mundo, b: Bola, c: { x: number; y: number }) {
  m.quedas.push({ n: b.n, x: b.x, y: b.y, cx: c.x, cy: c.y });
  b.fora = true;
  b.vx = 0;
  b.vy = 0;
  m.encacapadas.push(b.n);
}

/** Roda a tacada até as bolas pararem (para quem só precisa do resultado: os testes e o celular que reconecta). */
export function ateParar(m: Mundo): Mundo {
  while (!m.parado) passo(m);
  return m;
}

// ---------------------------------------------------------------- a regra

export interface Estado {
  bolas: Bola[];
  jogadores: number;
  vez: number;
  grupos: (Grupo | null)[];
  vencedor: number | null;
  tacadas: number[];
  /** o que aconteceu na última tacada ("FALTA: a branca caiu") */
  aviso: string;
}

export function novo(jogadores: number, semente: number): Estado {
  const n = Math.max(1, Math.min(2, jogadores));
  return { bolas: arrumar(semente), jogadores: n, vez: 0, grupos: Array(n).fill(null), vencedor: null, tacadas: Array(n).fill(0), aviso: '' };
}

/** Põe a bola num ponto livre, descendo (a branca) ou subindo (a 8) até não encostar em nenhuma. */
function recolocar(bolas: Bola[], b: Bola, x: number, y: number, dir: number) {
  b.fora = false;
  b.vx = 0;
  b.vy = 0;
  b.x = x;
  b.y = y;
  for (let i = 0; i < 200; i++) {
    const bate = bolas.some((o) => o !== b && !o.fora && (o.x - b.x) * (o.x - b.x) + (o.y - b.y) * (o.y - b.y) < 4 * RAIO * RAIO + 0.1);
    if (!bate) return;
    b.y += dir * RAIO;
    if (b.y > COMPRIMENTO - RAIO || b.y < RAIO) (b.y = y), (b.x += RAIO * 2);
  }
}

/** Depois que as bolas pararam: falta, grupos, quem joga e quem venceu. */
export function resolver(e: Estado, m: Mundo): Estado {
  const antes = e.bolas;
  const bolas = m.bolas.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const q: Estado = { ...e, bolas, grupos: [...e.grupos], tacadas: [...e.tacadas], aviso: '' };
  q.tacadas[q.vez]++;
  const caiu = m.encacapadas;
  const branca = bolas.find((b) => b.n === 0)!;
  const brancaCaiu = caiu.includes(0);
  const nada = m.primeiroToque === null;
  const falta = brancaCaiu || nada;
  if (brancaCaiu) recolocar(bolas, branca, CABECA.x, CABECA.y, 1);
  const outro = (q.vez + 1) % q.jogadores;
  const restamDe = (bs: Bola[], g: Grupo | null) => bs.filter((b) => !b.fora && b.n !== 0 && b.n !== 8 && (!g || grupoDa(b.n) === g)).length;

  if (q.jogadores === 1) {
    // treino: a 8 que cai antes volta para o pé
    if (caiu.includes(8) && restamDe(bolas, null) > 0) {
      recolocar(bolas, bolas.find((b) => b.n === 8)!, PE.x, PE.y, -1);
      q.aviso = 'A 8 VOLTA PARA A MESA';
    } else if (brancaCaiu) q.aviso = 'A BRANCA CAIU';
    else if (caiu.length) q.aviso = caiu.length > 1 ? `${caiu.length} BOLAS!` : 'BOA!';
    if (bolas.every((b) => b.n === 0 || b.fora)) q.vencedor = 0;
    return q;
  }

  if (caiu.includes(8)) {
    const meu = e.grupos[e.vez];
    const limpou = meu !== null && restamDe(antes, meu) === 0;
    q.vencedor = limpou && !falta ? q.vez : outro;
    q.aviso = q.vencedor === q.vez ? 'ENCAÇAPOU A 8!' : 'A 8 CAIU ANTES DA HORA';
    return q;
  }
  if (!falta && q.grupos[q.vez] === null) {
    const primeira = caiu.find((n) => grupoDa(n));
    if (primeira !== undefined) {
      const g = grupoDa(primeira)!;
      q.grupos[q.vez] = g;
      q.grupos[outro] = g === 'lisas' ? 'listradas' : 'lisas';
    }
  }
  const minhas = caiu.filter((n) => q.grupos[q.vez] !== null && grupoDa(n) === q.grupos[q.vez]).length;
  if (falta) q.aviso = brancaCaiu ? 'FALTA: A BRANCA CAIU' : 'FALTA: NÃO TOCOU EM NADA';
  else if (minhas) q.aviso = minhas > 1 ? `${minhas} BOLAS! JOGA DE NOVO` : 'BOA! JOGA DE NOVO';
  if (falta || !minhas) q.vez = outro;
  return q;
}
