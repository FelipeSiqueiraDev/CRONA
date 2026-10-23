/**
 * O 21 (blackjack) da mesa da Sala de Jogos (23/10, o Felipe: "tem um número X de fichas que o jogador que inicia a
 * mesa decide, aí você pode ir apostando; tem a opção de ser jogador (a padrão) mas também a de ser o dealer").
 *
 * - Na MESA (antes de começar), cada um pode marcar "Ser o dealer"; o primeiro lugar (quem chegou primeiro) escolhe
 *   quantas fichas cada jogador recebe e começa. Fica dealer o primeiro lugar que marcou; ninguém marcou, a banca é
 *   da casa e joga sozinha.
 * - A rodada: cada jogador aposta; as cartas saem (duas para cada um, duas para a banca, uma virada para baixo); cada
 *   um, na sua vez, pede, para, dobra ou divide; a banca vira a carta e compra até 17 (para no 17, mole ou duro); as
 *   apostas se acertam. O 21 de saída (blackjack) paga 3 para 2; o empate devolve a aposta.
 * - O dealer de gente não decide: ele distribui, vira a carta e compra (a regra da banca diz quando para), e as fichas
 *   dele são a banca, que começa com as de todos os jogadores juntos e paga quem ganha. A banca sem fichas quebra, e a
 *   partida acaba.
 *
 * Tudo aqui é conta pura: cada celular refaz a partida pelas jogadas, com o sapato embaralhado pela semente.
 */
import { sorteio } from './sorteio';

/** Uma carta: de 0 a 51. O valor é c % 13 (0 = Ás, 1..9 = 2..10, 10 = J, 11 = Q, 12 = K); o naipe, c / 13. */
export type Carta = number;

/** quantos baralhos no sapato */
export const BARALHOS = 4;
/** com menos que isso no sapato, embaralha de novo antes da rodada */
export const RESTO_MINIMO = 52;
/** as opções de fichas para começar */
export const FICHAS_OPCOES = [100, 250, 500, 1000, 5000];
/** as fichas de apostar, da menor para a maior */
export const FICHAS_APOSTA = [5, 25, 100, 500, 1000];
/** a aposta mínima (quem tem menos que isso aposta o que tem) */
export const APOSTA_MINIMA = 5;

export const NAIPES = ['♠', '♥', '♦', '♣'] as const;
export const ROTULOS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export const rotulo = (c: Carta) => ROTULOS[c % 13];
export const naipe = (c: Carta) => Math.floor(c / 13) % 4;
export const vermelha = (c: Carta) => naipe(c) === 1 || naipe(c) === 2;
/** o valor da carta no 21 (o Ás vale 1 aqui; `total` decide se ele vale 11) */
export const pontos = (c: Carta) => Math.min(10, (c % 13) + 1);

/** O total da mão e se é "mole" (um Ás contando 11). */
export function total(cartas: Carta[]): { valor: number; mole: boolean } {
  let v = 0;
  let ases = 0;
  for (const c of cartas) {
    v += pontos(c);
    if (c % 13 === 0) ases++;
  }
  const mole = ases > 0 && v + 10 <= 21;
  return { valor: mole ? v + 10 : v, mole };
}

export interface Mao {
  cartas: Carta[];
  aposta: number;
  /** acabou de jogar (parou, estourou, dobrou ou fez 21) */
  feita: boolean;
  dobrou: boolean;
  /** veio de uma divisão (o 21 dela não é blackjack) */
  dividida: boolean;
}

export interface Lugar {
  fichas: number;
  /** a aposta da rodada (0 = ainda não apostou) */
  aposta: number;
  maos: Mao[];
  /** a mão que joga agora */
  ativa: number;
  /** o que ganhou (ou perdeu) na última rodada, já com a aposta de volta: para o recado */
  saldo: number;
}

export type Fase = 'mesa' | 'apostas' | 'distribuir' | 'jogadores' | 'dealer' | 'fim' | 'acabou';

export interface Resultado {
  lugar: number;
  mao: number;
  /** 'bj' = blackjack, 'ganhou', 'empate', 'perdeu', 'estourou' */
  como: 'bj' | 'ganhou' | 'empate' | 'perdeu' | 'estourou';
  /** o que voltou para o jogador (a aposta e o prêmio) */
  volta: number;
}

export interface Partida {
  n: number;
  fase: Fase;
  /** na mesa: quem marcou "Ser o dealer" */
  querDealer: boolean[];
  /** o lugar do dealer, ou null (a casa) */
  dealer: number | null;
  fichasIniciais: number;
  /** as fichas da banca, quando o dealer é gente (a da casa não acaba: null) */
  banca: number | null;
  lugares: Lugar[];
  /** as cartas da banca; `virada` = a segunda já aparece */
  casa: Carta[];
  virada: boolean;
  /** de quem é a vez (na fase dos jogadores) */
  vez: number;
  rodada: number;
  semente: number;
  embaralhadas: number;
  sapato: Carta[];
  resultados: Resultado[];
  /** por que acabou */
  fim: string;
}

/** O sapato novo, embaralhado pela semente (Fisher-Yates). */
function sapato(semente: number, vez: number): Carta[] {
  const r = sorteio((semente + vez * 7919) >>> 0);
  const s: Carta[] = [];
  for (let b = 0; b < BARALHOS; b++) for (let c = 0; c < 52; c++) s.push(c);
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

/** A mesa nova (antes de começar), com `n` lugares. */
export function nova(n: number): Partida {
  return {
    n: Math.max(1, n),
    fase: 'mesa',
    querDealer: Array(Math.max(1, n)).fill(false),
    dealer: null,
    fichasIniciais: 0,
    banca: null,
    lugares: [],
    casa: [],
    virada: false,
    vez: -1,
    rodada: 0,
    semente: 0,
    embaralhadas: 0,
    sapato: [],
    resultados: [],
    fim: '',
  };
}

/** Joga na rodada (não é o dealer e ainda tem fichas). */
export const joga = (p: Partida, i: number) => i !== p.dealer && (p.lugares[i]?.fichas > 0 || (p.lugares[i]?.aposta ?? 0) > 0);

/** Os lugares que jogam a rodada. */
export const jogadores = (p: Partida) => p.lugares.map((_, i) => i).filter((i) => joga(p, i));

/** O dealer que a mesa terá ao começar (o primeiro lugar que marcou), se sobrar ao menos um jogador. */
export function dealerDaMesa(p: Partida): number | null {
  const i = p.querDealer.findIndex(Boolean);
  return i >= 0 && p.n > 1 ? i : null;
}

const copia = (p: Partida): Partida => ({
  ...p,
  querDealer: [...p.querDealer],
  lugares: p.lugares.map((l) => ({ ...l, maos: l.maos.map((m) => ({ ...m, cartas: [...m.cartas] })) })),
  casa: [...p.casa],
  sapato: [...p.sapato],
  resultados: [...p.resultados],
});

function tirar(p: Partida): Carta {
  if (!p.sapato.length) p.sapato = sapato(p.semente, ++p.embaralhadas);
  return p.sapato.pop()!;
}

/** O que dá para fazer agora, para os botões. */
export function pode(p: Partida, de: number) {
  const l = p.lugares[de];
  const m = l?.maos[l.ativa];
  const vez = p.fase === 'jogadores' && p.vez === de && !!m && !m.feita;
  const duas = vez && m!.cartas.length === 2;
  const dealerGente = p.dealer !== null && p.dealer === de;
  const t = total(p.casa).valor;
  return {
    apostar: p.fase === 'apostas' && joga(p, de) && l.aposta === 0,
    pedir: vez,
    parar: vez,
    dobrar: duas && l.fichas >= m!.aposta,
    dividir: duas && l.maos.length === 1 && pontos(m!.cartas[0]) === pontos(m!.cartas[1]) && l.fichas >= m!.aposta,
    distribuir: p.fase === 'distribuir' && dealerGente,
    virar: p.fase === 'dealer' && dealerGente && !p.virada,
    comprar: p.fase === 'dealer' && dealerGente && p.virada && t < 17,
    proxima: p.fase === 'fim',
  };
}

/** Passa para a próxima mão que joga (a outra mão do mesmo lugar, o lugar seguinte, ou a banca). */
function seguir(p: Partida) {
  while (p.vez >= 0 && p.vez < p.n) {
    const l = p.lugares[p.vez];
    if (joga(p, p.vez) && l.aposta > 0) {
      while (l.ativa < l.maos.length && l.maos[l.ativa].feita) l.ativa++;
      if (l.ativa < l.maos.length) return;
    }
    p.vez++;
  }
  p.vez = -1;
  p.fase = 'dealer';
  // todo mundo estourou: a banca só vira a carta e acerta
  const vivos = p.lugares.some((l) => l.maos.some((m) => total(m.cartas).valor <= 21));
  if (!vivos) (p.virada = true), acertar(p);
  else if (p.dealer === null) banca(p);
}

/** A banca da casa: vira e compra até 17. */
function banca(p: Partida) {
  p.virada = true;
  while (total(p.casa).valor < 17) p.casa.push(tirar(p));
  acertar(p);
}

const blackjack = (m: Mao) => !m.dividida && m.cartas.length === 2 && total(m.cartas).valor === 21;

/** Acerta as apostas e fecha a rodada. */
function acertar(p: Partida) {
  const casa = total(p.casa).valor;
  const bjCasa = p.casa.length === 2 && casa === 21;
  p.resultados = [];
  p.lugares.forEach((l, i) => {
    if (!joga(p, i) || !l.aposta) return;
    l.saldo = 0;
    l.maos.forEach((m, k) => {
      const v = total(m.cartas).valor;
      let como: Resultado['como'];
      let volta = 0;
      if (v > 21) como = 'estourou';
      else if (blackjack(m) && !bjCasa) (como = 'bj'), (volta = m.aposta + Math.floor((m.aposta * 3) / 2));
      else if (bjCasa && !blackjack(m)) como = 'perdeu';
      else if (casa > 21 || v > casa) (como = 'ganhou'), (volta = m.aposta * 2);
      else if (v === casa) (como = 'empate'), (volta = m.aposta);
      else como = 'perdeu';
      l.fichas += volta;
      l.saldo += volta - m.aposta;
      if (p.banca !== null) p.banca -= volta - m.aposta;
      p.resultados.push({ lugar: i, mao: k, como, volta });
    });
  });
  p.fase = 'fim';
  if (p.banca !== null && p.banca <= 0) {
    p.banca = Math.max(0, p.banca);
    p.fase = 'acabou';
    p.fim = 'A banca quebrou!';
  } else if (!p.lugares.some((l, i) => i !== p.dealer && l.fichas > 0)) {
    p.fase = 'acabou';
    p.fim = p.dealer === null ? 'A casa levou tudo.' : 'O dealer levou tudo.';
  }
}

/** As cartas saem: duas para cada jogador, duas para a banca (a segunda para baixo). */
function distribuir(p: Partida) {
  const quem = jogadores(p).filter((i) => p.lugares[i].aposta > 0);
  for (let volta = 0; volta < 2; volta++) {
    for (const i of quem) p.lugares[i].maos[0].cartas.push(tirar(p));
    p.casa.push(tirar(p));
  }
  for (const i of quem) {
    const m = p.lugares[i].maos[0];
    if (total(m.cartas).valor === 21) m.feita = true;
  }
  // a banca espia: com 21 de saída, vira na hora e a rodada acaba
  if (total(p.casa).valor === 21) {
    p.virada = true;
    acertar(p);
    return;
  }
  p.fase = 'jogadores';
  p.vez = 0;
  seguir(p);
}

/** A rodada nova: limpa a mesa e abre as apostas (embaralha se o sapato está no fim). */
function rodadaNova(p: Partida) {
  p.rodada++;
  p.casa = [];
  p.virada = false;
  p.resultados = [];
  p.vez = -1;
  if (p.sapato.length < RESTO_MINIMO) p.sapato = sapato(p.semente, ++p.embaralhadas);
  for (const l of p.lugares) (l.aposta = 0), (l.maos = []), (l.ativa = 0);
  p.fase = 'apostas';
}

/** Todos apostaram: a casa distribui na hora; o dealer de gente aperta Distribuir. */
function conferirApostas(p: Partida) {
  if (jogadores(p).some((i) => p.lugares[i].aposta === 0)) return;
  if (p.dealer === null) distribuir(p);
  else p.fase = 'distribuir';
}

const inteiro = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : NaN);

/**
 * Uma jogada do lugar `de`. Devolve a partida nova (ou a mesma, se a jogada não vale agora). Tipos:
 * quero {dealer}, comecar {fichas, semente}, aposta {valor}, pedir, parar, dobrar, dividir, distribuir, virar,
 * comprar, proxima, mesa (volta para a mesa, para começar de novo).
 */
export function jogar(p0: Partida, de: number, d: Record<string, unknown>): Partida {
  if (de < 0 || de >= p0.n) return p0;
  const tipo = d.tipo;
  if (tipo === 'mesa') return de === 0 || p0.fase === 'acabou' ? nova(p0.n) : p0;
  const p = copia(p0);
  if (tipo === 'quero') {
    if (p.fase !== 'mesa') return p0;
    p.querDealer[de] = d.dealer === true;
    return p;
  }
  if (tipo === 'comecar') {
    const fichas = inteiro(d.fichas);
    const semente = inteiro(d.semente);
    if (p.fase !== 'mesa' || de !== 0 || !(fichas >= 1 && fichas <= 1_000_000) || Number.isNaN(semente)) return p0;
    p.dealer = dealerDaMesa(p);
    p.fichasIniciais = fichas;
    p.semente = semente >>> 0;
    p.lugares = Array.from({ length: p.n }, (_, i) => ({ fichas: i === p.dealer ? 0 : fichas, aposta: 0, maos: [], ativa: 0, saldo: 0 }));
    p.banca = p.dealer === null ? null : fichas * (p.n - 1);
    p.sapato = sapato(p.semente, 0);
    p.embaralhadas = 0;
    rodadaNova(p);
    return p;
  }
  const ok = pode(p0, de);
  const l = p.lugares[de];
  if (tipo === 'aposta') {
    const valor = inteiro(d.valor);
    const min = Math.min(APOSTA_MINIMA, l?.fichas ?? 0);
    if (!ok.apostar || !(valor >= min && valor <= l.fichas) || valor < 1) return p0;
    l.fichas -= valor;
    l.aposta = valor;
    l.maos = [{ cartas: [], aposta: valor, feita: false, dobrou: false, dividida: false }];
    l.ativa = 0;
    conferirApostas(p);
    return p;
  }
  const m = l?.maos[l.ativa];
  if (tipo === 'pedir' && ok.pedir) {
    m.cartas.push(tirar(p));
    if (total(m.cartas).valor >= 21) m.feita = true;
    // a mão dividida de Ás recebe uma carta só
  } else if (tipo === 'parar' && ok.parar) {
    m.feita = true;
  } else if (tipo === 'dobrar' && ok.dobrar) {
    l.fichas -= m.aposta;
    l.aposta += m.aposta;
    m.aposta *= 2;
    m.dobrou = true;
    m.cartas.push(tirar(p));
    m.feita = true;
  } else if (tipo === 'dividir' && ok.dividir) {
    l.fichas -= m.aposta;
    l.aposta += m.aposta;
    const [a, b] = m.cartas;
    const ases = a % 13 === 0;
    l.maos = [
      { cartas: [a, tirar(p)], aposta: m.aposta, feita: false, dobrou: false, dividida: true },
      { cartas: [b, tirar(p)], aposta: m.aposta, feita: false, dobrou: false, dividida: true },
    ];
    for (const x of l.maos) if (ases || total(x.cartas).valor === 21) x.feita = true;
  } else if (tipo === 'distribuir' && ok.distribuir) {
    distribuir(p);
    return p;
  } else if (tipo === 'virar' && ok.virar) {
    p.virada = true;
    if (total(p.casa).valor >= 17) acertar(p);
    return p;
  } else if (tipo === 'comprar' && ok.comprar) {
    p.casa.push(tirar(p));
    if (total(p.casa).valor >= 17) acertar(p);
    return p;
  } else if (tipo === 'proxima' && ok.proxima) {
    rodadaNova(p);
    return p;
  } else return p0;
  seguir(p);
  return p;
}
