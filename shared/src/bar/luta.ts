/**
 * O Felipe's Fight (23/10, o Felipe: "e se o segundo feliperama fosse um Felipe's Fight, um modelo diferente que só
 * funciona de dupla e é um joguinho de luta?!"): dois lutadores numa arena de lado, melhor de três rounds de 60 s.
 * Andar, pular, defender (segurando para baixo), soco, chute (no ar vira voadora) e o especial (a bola de energia, que
 * gasta meia barra de energia; a barra enche batendo e apanhando).
 *
 * A conta é do aparelho do primeiro lugar (o anfitrião): ele recebe os comandos do outro, avança a luta 60 vezes por
 * segundo e manda a fotografia da luta; o outro só desenha. Por isso aqui não precisa ser igual em todo navegador.
 */

/** A arena: a largura e o chão (em pixels do jogo). */
export const ARENA = 192;
export const QUADROS_POR_SEGUNDO = 60;
export const ROUND_SEGUNDOS = 60;
export const ROUNDS_PARA_VENCER = 2;
export const VIDA = 100;
export const ENERGIA = 100;
export const CUSTO_ESPECIAL = 50;

/** Os comandos de um quadro, em bits. */
export const B = { esq: 1, dir: 2, cima: 4, baixo: 8, soco: 16, chute: 32, especial: 64 } as const;

export type Estado = 'parado' | 'andando' | 'pulo' | 'defesa' | 'soco' | 'chute' | 'voadora' | 'especial' | 'atingido' | 'defendeu' | 'caido' | 'vitoria';

export interface Lutador {
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  vida: number;
  energia: number;
  estado: Estado;
  /** quadros no estado */
  t: number;
  /** quanto tempo ainda atordoado */
  preso: number;
  /** o golpe de agora já acertou (não acerta duas vezes) */
  acertou: boolean;
  rounds: number;
}

export interface Bola {
  x: number;
  y: number;
  vx: number;
  dono: 0 | 1;
}

export type Fase = 'espera' | 'apresenta' | 'luta' | 'ko' | 'fim';

export interface Evento {
  tipo: 'acerto' | 'defesa' | 'bola' | 'ko' | 'pulo' | 'golpe' | 'round' | 'lute' | 'tempo';
  x: number;
  y: number;
  /** quem fez */
  de: number;
  forte?: boolean;
}

export interface Luta {
  fase: Fase;
  /** quadros na fase */
  t: number;
  round: number;
  /** quadros que faltam no round */
  relogio: number;
  l: [Lutador, Lutador];
  bolas: Bola[];
  pronto: [boolean, boolean];
  /** quem levou o round (-1 = ninguém, no empate do tempo) */
  levou: number;
  vencedor: number;
}

interface Golpe {
  ini: number;
  ativo: number;
  rec: number;
  alcance: number;
  dano: number;
  atordoa: number;
  empurra: number;
}
export const GOLPES: Record<'soco' | 'chute' | 'voadora', Golpe> = {
  soco: { ini: 3, ativo: 3, rec: 7, alcance: 15, dano: 6, atordoa: 12, empurra: 1.4 },
  chute: { ini: 6, ativo: 4, rec: 11, alcance: 21, dano: 10, atordoa: 16, empurra: 2.6 },
  voadora: { ini: 2, ativo: 40, rec: 0, alcance: 17, dano: 9, atordoa: 14, empurra: 2.2 },
};
/** o especial: o quadro em que a bola sai e quanto ele dura */
const ESP = { sai: 10, total: 26, vel: 2.7, dano: 14, atordoa: 18 };
const ANDA = 1.15;
const PULO = 4.7;
const GRAVIDADE = 0.28;
const LARGURA = 6;
const APRESENTA = 110;
const KO = 140;

function lutador(x: number, face: 1 | -1, rounds = 0): Lutador {
  return { x, y: 0, vx: 0, vy: 0, face, vida: VIDA, energia: 0, estado: 'parado', t: 0, preso: 0, acertou: false, rounds };
}

export function nova(): Luta {
  return { fase: 'espera', t: 0, round: 0, relogio: ROUND_SEGUNDOS * QUADROS_POR_SEGUNDO, l: [lutador(56, 1), lutador(ARENA - 56, -1)], bolas: [], pronto: [false, false], levou: -1, vencedor: -1 };
}

function comecarRound(p: Luta) {
  p.round++;
  p.fase = 'apresenta';
  p.t = 0;
  p.relogio = ROUND_SEGUNDOS * QUADROS_POR_SEGUNDO;
  p.l = [lutador(56, 1, p.l[0].rounds), lutador(ARENA - 56, -1, p.l[1].rounds)];
  p.bolas = [];
  p.levou = -1;
}

const livre = (f: Lutador) => f.estado === 'parado' || f.estado === 'andando' || f.estado === 'defesa';

/**
 * Um quadro. `ent` = os comandos de agora de cada lado; `antes` = os do quadro anterior (o golpe sai quando o botão
 * desce). Mexe na luta e devolve o que aconteceu (para o som e o brilho).
 */
export function passo(p: Luta, ent: [number, number], antes: [number, number]): Evento[] {
  const ev: Evento[] = [];
  const desceu = (i: number, b: number) => (ent[i] & b) !== 0 && (antes[i] & b) === 0;
  p.t++;
  if (p.fase === 'espera' || p.fase === 'fim') {
    for (const i of [0, 1]) if (desceu(i, B.soco) || desceu(i, B.chute)) p.pronto[i] = true;
    if (p.pronto[0] && p.pronto[1]) {
      if (p.fase === 'fim') p.l = [lutador(56, 1), lutador(ARENA - 56, -1)];
      p.round = 0;
      p.pronto = [false, false];
      p.vencedor = -1;
      comecarRound(p);
      ev.push({ tipo: 'round', x: ARENA / 2, y: 60, de: -1 });
    }
    return ev;
  }
  if (p.fase === 'apresenta') {
    if (p.t === Math.floor(APRESENTA * 0.6)) ev.push({ tipo: 'lute', x: ARENA / 2, y: 60, de: -1 });
    if (p.t >= APRESENTA) (p.fase = 'luta'), (p.t = 0);
    return ev;
  }
  if (p.fase === 'ko') {
    for (const f of p.l) fisica(f);
    if (p.t >= KO) {
      if (p.l.some((f) => f.rounds >= ROUNDS_PARA_VENCER)) {
        p.fase = 'fim';
        p.t = 0;
        p.vencedor = p.l[0].rounds >= ROUNDS_PARA_VENCER ? 0 : 1;
        p.pronto = [false, false];
      } else {
        comecarRound(p);
        ev.push({ tipo: 'round', x: ARENA / 2, y: 60, de: -1 });
      }
    }
    return ev;
  }
  // ---- a luta
  p.relogio--;
  p.l.forEach((f, i) => comandar(p, f, i, ent[i], desceu, ev));
  for (const f of p.l) fisica(f);
  // um não atravessa o outro
  const [a, b] = p.l;
  const dx = b.x - a.x;
  if (Math.abs(dx) < LARGURA * 2 && Math.abs(a.y - b.y) < 22) {
    const meio = (a.x + b.x) / 2;
    const lado = dx === 0 ? (a.face === 1 ? 1 : -1) : Math.sign(dx);
    a.x = meio - (lado * LARGURA);
    b.x = meio + (lado * LARGURA);
    for (const f of p.l) f.x = Math.max(8, Math.min(ARENA - 8, f.x));
  }
  // os golpes
  p.l.forEach((f, i) => golpear(p, f, p.l[1 - i], i, ev));
  // as bolas
  for (const bola of [...p.bolas]) {
    bola.x += bola.vx;
    const alvo = p.l[1 - bola.dono];
    if (Math.abs(alvo.x - bola.x) < LARGURA + 3 && alvo.y < 18 && alvo.estado !== 'caido') {
      p.bolas.splice(p.bolas.indexOf(bola), 1);
      bater(p, p.l[bola.dono], alvo, bola.dono, { ini: 0, ativo: 0, rec: 0, alcance: 0, dano: ESP.dano, atordoa: ESP.atordoa, empurra: 3 }, ev, bola.x);
    } else if (bola.x < -8 || bola.x > ARENA + 8) p.bolas.splice(p.bolas.indexOf(bola), 1);
  }
  // duas bolas se encontrando se apagam
  if (p.bolas.length === 2 && p.bolas[0].dono !== p.bolas[1].dono && Math.abs(p.bolas[0].x - p.bolas[1].x) < 6) {
    ev.push({ tipo: 'defesa', x: (p.bolas[0].x + p.bolas[1].x) / 2, y: 12, de: -1, forte: true });
    p.bolas = [];
  }
  // o fim do round: alguém caiu, ou o tempo acabou
  const caiu = p.l.findIndex((f) => f.vida <= 0);
  if (caiu >= 0 || p.relogio <= 0) {
    if (caiu < 0) ev.push({ tipo: 'tempo', x: ARENA / 2, y: 60, de: -1 });
    const levou = caiu >= 0 ? (p.l[1 - caiu].vida <= 0 ? -1 : 1 - caiu) : p.l[0].vida === p.l[1].vida ? -1 : p.l[0].vida > p.l[1].vida ? 0 : 1;
    p.levou = levou;
    if (levou >= 0) {
      p.l[levou].rounds++;
      const v = p.l[levou];
      v.estado = 'vitoria';
      v.t = 0;
    }
    p.fase = 'ko';
    p.t = 0;
    p.bolas = [];
  }
  return ev;
}

function comandar(p: Luta, f: Lutador, i: number, e: number, desceu: (i: number, b: number) => boolean, ev: Evento[]) {
  f.t++;
  const outro = p.l[1 - i];
  if (f.estado === 'caido') return;
  if (f.preso > 0) {
    f.preso--;
    if (f.preso === 0) (f.estado = 'parado'), (f.t = 0);
    return;
  }
  // os golpes terminando
  for (const g of ['soco', 'chute', 'especial'] as const) {
    if (f.estado !== g) continue;
    const dur = g === 'especial' ? ESP.total : GOLPES[g].ini + GOLPES[g].ativo + GOLPES[g].rec;
    if (g === 'especial' && f.t === ESP.sai) {
      p.bolas.push({ x: f.x + f.face * 10, y: 14, vx: f.face * ESP.vel, dono: i as 0 | 1 });
      ev.push({ tipo: 'bola', x: f.x + f.face * 10, y: 14, de: i });
    }
    if (f.t >= dur) (f.estado = 'parado'), (f.t = 0);
    return;
  }
  const noChao = f.y <= 0 && f.vy <= 0;
  if (!noChao) {
    if (f.estado === 'pulo' && desceu(i, B.chute)) {
      f.estado = 'voadora';
      f.t = 0;
      f.acertou = false;
      ev.push({ tipo: 'golpe', x: f.x, y: f.y, de: i });
    }
    return;
  }
  if (!livre(f)) return;
  // de frente para o outro
  f.face = outro.x >= f.x ? 1 : -1;
  if (desceu(i, B.especial) && f.energia >= CUSTO_ESPECIAL && !p.bolas.some((b) => b.dono === i)) {
    f.energia -= CUSTO_ESPECIAL;
    f.estado = 'especial';
    f.t = 0;
    f.vx = 0;
    return;
  }
  if (desceu(i, B.soco) || desceu(i, B.chute)) {
    f.estado = desceu(i, B.chute) ? 'chute' : 'soco';
    f.t = 0;
    f.vx = 0;
    f.acertou = false;
    ev.push({ tipo: 'golpe', x: f.x, y: f.y, de: i });
    return;
  }
  const esq = (e & B.esq) !== 0;
  const dir = (e & B.dir) !== 0;
  const anda = esq === dir ? 0 : esq ? -1 : 1;
  if (desceu(i, B.cima) || ((e & B.cima) !== 0 && f.estado !== 'pulo')) {
    f.estado = 'pulo';
    f.t = 0;
    f.vy = PULO;
    f.vx = anda * 1.4;
    ev.push({ tipo: 'pulo', x: f.x, y: 0, de: i });
    return;
  }
  if (e & B.baixo) {
    if (f.estado !== 'defesa') (f.estado = 'defesa'), (f.t = 0);
    f.vx = 0;
    return;
  }
  f.vx = anda * ANDA;
  const novo = anda ? 'andando' : 'parado';
  if (f.estado !== novo) (f.estado = novo), (f.t = 0);
}

function fisica(f: Lutador) {
  f.x += f.vx;
  if (f.y > 0 || f.vy > 0) {
    f.y += f.vy;
    f.vy -= GRAVIDADE;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      if (f.estado === 'pulo' || f.estado === 'voadora') (f.estado = 'parado'), (f.t = 0), (f.vx = 0);
    }
  } else if (f.estado === 'atingido' || f.estado === 'defendeu' || f.estado === 'caido') f.vx *= 0.82;
  f.x = Math.max(8, Math.min(ARENA - 8, f.x));
}

function golpear(p: Luta, f: Lutador, alvo: Lutador, i: number, ev: Evento[]) {
  if (f.acertou || (f.estado !== 'soco' && f.estado !== 'chute' && f.estado !== 'voadora')) return;
  const g = GOLPES[f.estado];
  if (f.t < g.ini || f.t >= g.ini + g.ativo) return;
  const dx = (alvo.x - f.x) * f.face;
  if (dx < 0 || dx > g.alcance + LARGURA || Math.abs(alvo.y - f.y) > 22 || alvo.estado === 'caido') return;
  f.acertou = true;
  bater(p, f, alvo, i, g, ev, f.x + f.face * Math.min(dx, g.alcance));
}

/** O golpe pegou: na defesa, só um tico de dano; senão o dano, o tranco e o atordoado (ou o tombo, no fim da vida). */
function bater(p: Luta, de: Lutador, alvo: Lutador, i: number, g: Golpe, ev: Evento[], xh: number) {
  void p;
  const vindo = alvo.x >= de.x ? 1 : -1;
  const defendeu = alvo.estado === 'defesa' && alvo.face === -vindo;
  const y = alvo.y + (de.estado === 'chute' ? 10 : 18);
  if (defendeu) {
    alvo.vida = Math.max(0, alvo.vida - Math.max(1, Math.floor(g.dano * 0.2)));
    alvo.estado = 'defendeu';
    alvo.t = 0;
    alvo.preso = 8;
    alvo.vx = vindo * g.empurra * 0.6;
    alvo.energia = Math.min(ENERGIA, alvo.energia + 4);
    ev.push({ tipo: 'defesa', x: xh, y, de: i });
  } else {
    alvo.vida = Math.max(0, alvo.vida - g.dano);
    alvo.estado = 'atingido';
    alvo.t = 0;
    alvo.preso = g.atordoa;
    alvo.vx = vindo * g.empurra;
    de.energia = Math.min(ENERGIA, de.energia + 7);
    alvo.energia = Math.min(ENERGIA, alvo.energia + 3);
    ev.push({ tipo: 'acerto', x: xh, y, de: i, forte: g.dano >= 10 });
  }
  if (alvo.vida <= 0) {
    alvo.estado = 'caido';
    alvo.t = 0;
    alvo.preso = 0;
    alvo.vy = 2.4;
    alvo.y = Math.max(alvo.y, 0.1);
    alvo.vx = vindo * 2.2;
    ev.push({ tipo: 'ko', x: alvo.x, y: 14, de: i });
  }
}
