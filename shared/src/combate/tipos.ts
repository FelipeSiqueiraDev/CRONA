/**
 * Combate: quem está na luta, a ordem de iniciativa, a rodada e o turno.
 * A regra está em docs/COMBATE.md; a tela, em docs/TELA-COMBATE.md.
 *
 * Montar o combate, Iniciativa, rodadas e turnos, atrasar, preparar, quem
 * chega depois, surpresa, as ações usadas no turno, os contadores de morrendo
 * e enlouquecendo, o ataque com o dano, as condições, o PE gasto, o ritual
 * sustentado e o registro. Só o mestre mexe; os dados são físicos (o mestre
 * digita os resultados).
 */
import type { Elemento, TipoDano } from '../regras/tipos';
import type { ManobraId, Tamanho } from './manobra';
import type { FormaRitual, TesteResistencia } from './ritual';

/** Lado de cada ser: os agentes têm turno próprio; inimigos e neutros agem no turno do mestre. */
export type Lado = 'agente' | 'inimigo' | 'neutro';
export const LADOS: Lado[] = ['agente', 'inimigo', 'neutro'];

export type Fase = 'montando' | 'andamento' | 'encerrado';

/** Por que um ser saiu do combate. */
export type Saida = 'morto' | 'insano' | 'saiu';

export interface Participante {
  /** id da peça no tabuleiro */
  id: number;
  nome: string;
  lado: Lado;
  /** ciente dos inimigos no começo; quem não está fica surpreendido na rodada 1 (LR p. 83) */
  ciente: boolean;
  /** Iniciativa do agente (os seres do mestre usam a do grupo) */
  iniciativa: number | null;
  /** desempate: o maior age antes */
  desempate: number;
  /** age a partir desta rodada (quem chega depois age na seguinte, LR p. 83) */
  desde: number;
  /** saiu do combate */
  fora?: Saida;
  /** turnos começados morrendo e enlouquecendo nesta cena (LR p. 88) */
  morrendo: number;
  enlouquecendo: number;
  /**
   * Dano não letal sofrido: soma com o letal para desmaiar, mas não deixa
   * morrendo; a cura tira primeiro ele (LR p. 88). Os PV da peça só caem com
   * o letal.
   */
  naoLetal?: number;
  /** já usou a defesa especial (bloqueio, esquiva ou contra-ataque) desde o começo do próprio turno */
  reacao: boolean;
  /** Defesa a mais ou a menos até o começo do próximo turno dele (a investida, o combate defensivo) */
  defesaTurno?: { nome: string; valor: number }[];
  /** condições marcadas no combate (ids do catálogo). As dos agentes ficam na ficha deles. */
  condicoes?: string[];
  /** ritual que o ser sustenta: paga 1 PE no começo de cada turno (LR p. 120) */
  sustenta?: string;
  /** quem este ser está agarrando (id da peça; LR p. 85) */
  agarra?: number;
}

/** Ação preparada: acontece como reação até o próximo turno de quem preparou (LR p. 86). */
export interface Preparada {
  entrada: string;
  texto: string;
  rodada: number;
}

export type TipoRegistro = 'rodada' | 'turno' | 'acao' | 'estado' | 'nota';

export interface LinhaRegistro {
  em: number;
  rodada: number;
  tipo: TipoRegistro;
  texto: string;
  /** trechos do texto em vermelho (acerto crítico, machucado) */
  destaque?: string[];
}

/** O que a vez já usou no turno (LR p. 84), e o PE gasto (o limite de PE vale para o turno, LR p. 23). */
export interface AcoesTurno {
  padrao: boolean;
  movimento: boolean;
  completa: boolean;
  /** PE gastos desde o começo do turno */
  pe?: number;
  /** ataques que ainda cabem na ação padrão já usada (ataque ×2 da ameaça, LR p. 179) */
  golpes?: number;
}

export type ResultadoAtaque = 'erro' | 'acerto' | 'critico';

/** O último ataque confirmado: a mesa mostra a linha e o carimbo por um instante. */
export interface UltimoAtaque {
  quem: number;
  alvo: number;
  resultado: ResultadoAtaque;
  multiplicador?: number;
  em: number;
}

export interface Combate {
  fase: Fase;
  /** cena onde o combate começou */
  cena: number;
  /** 0 enquanto monta */
  rodada: number;
  /** entrada da vez: "p:<id>" (agente) ou "mestre" */
  vez: string | null;
  /** entradas que já tiveram o turno nesta rodada */
  agiram: string[];
  /**
   * Entradas que já começaram o turno nesta rodada: quem atrasa não começa de
   * novo (os contadores e o sustentado não contam duas vezes, LR p. 87–88).
   */
  comecaram?: string[];
  /** o que cada ser do lugar já tinha usado quando atrasou (PE do sustentado, ações livres): volta com a vez */
  atrasados?: Record<string, Record<string, AcoesTurno>>;
  participantes: Participante[];
  /** Iniciativa do grupo do mestre: um teste por todos, com o menor bônus (LR p. 83) */
  mestre: { iniciativa: number | null; desempate: number };
  /** o que cada ser da vez já usou (no turno do mestre, cada ser tem as próprias ações), pelo id da peça */
  acoes: Record<string, AcoesTurno>;
  preparadas: Preparada[];
  registro: LinhaRegistro[];
  /** quando começou (ms) */
  inicio: number;
  ultimo?: UltimoAtaque;
}

/** Um lugar na ordem de iniciativa: um agente, ou o turno do mestre com todos os seres dele. */
export interface Entrada {
  id: string;
  valor: number;
  desempate: number;
  participantes: number[];
  mestre: boolean;
}

/** Peça que pode entrar no combate (o servidor monta a lista a partir do tabuleiro). */
export interface PecaCombate {
  id: number;
  nome: string;
  /** peça ligada a uma ficha de agente */
  agente: boolean;
  /** está na cena onde o combate começa */
  naCena: boolean;
}

/** Tipos de ação para declarar (o que gastam do turno). */
export type TipoAcao = 'padrao' | 'movimento' | 'completa' | 'livre' | 'reacao';

/** Um ataque que o mestre confirmou na tela (os números já saem da tela; o servidor confere a forma e aplica). */
export interface AtaqueConfirmado {
  quem: number;
  alvo: number;
  /** a Defesa de quem ataca muda até o próximo turno dele (investida −5, combate defensivo +5) */
  defesaAteTurno?: { nome: string; valor: number }[];
  /** a arma foi arremessada: o item da mochila e se volta para a mão (amarrada num fio) ou cai perto do alvo */
  arremesso?: { uid?: number; volta: boolean };
  /** o ajuste livre do mestre no teste (só para o registro) */
  ajuste?: { dados: number; bonus: number; texto?: string };
  /** nome da arma ou do ataque */
  arma: string;
  /** ação que o ataque gasta */
  qual: 'padrao' | 'completa';
  /** o teste: dados, bônus, o d20 que ficou, o total e a Defesa contra */
  teste: { dados: number; bonus: number; d20: number; total: number; defesa: number };
  /** situações que pesaram (nomes curtos, para o registro) */
  situacoes: string[];
  /** chance de falha (camuflagem): a chance, o dado (d10; d4 nos 75%) e se falhou */
  falha?: { chance: number; d10: number; falhou: boolean };
  resultado: ResultadoAtaque;
  multiplicador?: number;
  /** o dano: a fórmula rolada, a soma dos dados, o total e o que ficou depois de resistência e RD */
  dano?: DanoConfirmado;
  /** o dano a mais de outro tipo (Vomitar Lodo: e 1d8 mental, LR p. 221) */
  danoExtra?: DanoConfirmado;
  /** defesa especial que o alvo usou */
  reacao?: 'esquiva' | 'bloqueio';
  /** errou um golpe corpo a corpo e o alvo pode contra-atacar (lembrete no registro) */
  contraAtaque?: boolean;
  /** a ação faz este número de ataques (o "×2" da ameaça, LR p. 179) */
  vezes?: number;
  /** a jogada pronta do agente: o nome e os PE que ela gasta junto com o ataque */
  jogada?: { nome: string; pe: number };
}

/** Um lado do teste oposto: dados, bônus, o d20 que ficou e o total. */
export interface LadoOposto {
  dados: number;
  bonus: number;
  d20: number;
  total: number;
}

/** Dano já contado na tela (ataque, esmagar, quebrar): a fórmula, a soma dos dados, o total e o que ficou. */
export interface DanoConfirmado {
  formula: string;
  soma: number;
  total: number;
  tipo: string;
  conta: string;
  final: number;
  naoLetal?: boolean;
}

/** Uma manobra que o mestre confirmou na tela (LR p. 85–86; COMBATE.md, seção 9). */
export interface ManobraConfirmada {
  quem: number;
  alvo: number;
  manobra: ManobraId;
  /** ação gasta: padrão; atropelar durante a investida é livre (LR p. 86) */
  qual: 'padrao' | 'livre';
  /** arma do teste de manobra */
  arma?: string;
  teste: { quem: LadoOposto; alvo: LadoOposto };
  /** quem faz a manobra venceu o teste oposto (no empate, rola de novo e não chega aqui) */
  venceu: boolean;
  diferenca: number;
  /** o que pesou nos testes (nomes curtos, para o registro) */
  modificadores: string[];
  /** casas que o alvo foi empurrado (a tela move a peça) */
  empurrao?: number;
  /** esmagar e quebrar */
  dano?: DanoConfirmado;
  /** quebrar: o objeto, os PV dele e se quebrou */
  objeto?: { nome: string; pv: number; quebrou: boolean };
  /** desarmar: o item da mão do alvo que cai (sem ele, a primeira arma na mão) */
  item?: number;
}

/** Um alvo do ritual: o teste de resistência, o dano e a condição que ele ganha. */
export interface AlvoRitual {
  id: number;
  teste?: { nome: TesteResistencia; dados: number; bonus: number; d20: number; total: number; passou: boolean };
  dano?: DanoConfirmado;
  /** o dano a mais de outro tipo (Presença do Medo: mental e de Medo, LR p. 139) */
  danoExtra?: DanoConfirmado;
  /** condição do catálogo que o alvo ganha */
  condicao?: string;
}

/** Um ritual que o mestre confirmou na tela (LR p. 117–121; COMBATE.md, seção 15.1). */
export interface RitualConfirmado {
  quem: number;
  ritual: string;
  /** elemento do ritual: as criaturas são imunes aos de Medo (LR p. 180) */
  elemento?: Elemento;
  forma: FormaRitual;
  /** a execução do ritual (o que gasta do turno) */
  qual: TipoAcao;
  /** PE gastos (0 = ameaça, que não paga PE) */
  pe: number;
  dt?: number;
  sustentado?: boolean;
  /** teste de Vontade de concentração (condição ruim ou terrível); falhou, o ritual não sai */
  concentracao?: { dt: number; d20: number; total: number; passou: boolean };
  alvos: AlvoRitual[];
  /** Custo do Paranormal: o teste de Ocultismo, fora de Medo */
  custo?: { dt: number; d20: number; total: number; passou: boolean };
  /** ritual de Medo: não tem teste; o dano mental e a SAN vêm direto */
  medo?: boolean;
  /** dano mental em quem conjura e a SAN que ele perde para sempre */
  mental?: number;
  sanPermanente?: number;
}

/** O que a tela do mestre pede (o servidor confere e aplica). */
export type AcaoCombate =
  /** abre o combate na cena atual, com as peças dela */
  | { tipo: 'abrir' }
  /** montando: inclui, tira ou muda um participante; andamento: corrige a Iniciativa */
  | { tipo: 'participante'; id: number; incluir?: boolean; lado?: Lado; ciente?: boolean; iniciativa?: number | null; desempate?: number }
  | { tipo: 'iniciativaMestre'; valor: number | null; desempate?: number }
  | { tipo: 'comecar' }
  | { tipo: 'passar' }
  | { tipo: 'atrasar'; valor: number }
  | { tipo: 'preparar'; texto: string }
  | { tipo: 'usarPreparada'; entrada: string }
  /** marca ou desmarca à mão o que um ser da vez já usou */
  | { tipo: 'orcamento'; qual: 'padrao' | 'movimento' | 'completa'; usada: boolean; quem?: number }
  /**
   * Declara uma ação: vai para o registro e gasta o que ela custa. `quem` = qual
   * ser age (no turno do mestre); `especial` = reação de defesa especial
   * (bloqueio, esquiva, contra-ataque: uma por rodada). `sacar` = o item da
   * mochila do ser que vai para a mão junto (sacar é ação de movimento, LR p. 54).
   */
  | { tipo: 'declarar'; qual: TipoAcao; texto: string; quem?: number; especial?: boolean; sacar?: number }
  | { tipo: 'reacao'; id: number; usada: boolean }
  /** alguém chega no meio: age a partir da rodada seguinte */
  | { tipo: 'entrar'; id: number; lado: Lado; iniciativa?: number | null }
  | { tipo: 'sair'; id: number; motivo?: Saida }
  | { tipo: 'nota'; texto: string }
  /** ataque resolvido na tela: aplica o dano no alvo e escreve no registro */
  | { tipo: 'ataque'; ataque: AtaqueConfirmado }
  /** manobra resolvida na tela: teste oposto, condição no alvo e o dano de esmagar */
  | { tipo: 'manobra'; manobra: ManobraConfirmada }
  /** quem agarra solta o alvo (ação livre, LR p. 85) */
  | { tipo: 'soltar'; id: number }
  /** ritual resolvido na tela: PE, resistências, dano, condições e o Custo do Paranormal */
  | { tipo: 'ritual'; ritual: RitualConfirmado }
  /** marca ou tira uma condição de um ser do combate */
  | { tipo: 'condicao'; id: number; condicao: string; ativa: boolean }
  /** gasta PE de quem age (habilidade, ritual): conta no limite do turno */
  | { tipo: 'gastarPe'; quem: number; pe: number; motivo: string }
  /** começa ou para de sustentar um ritual */
  | { tipo: 'sustentar'; id: number; ritual: string | null }
  /** muda PV, PE ou SAN de um ser (cura, socorro, dano de fora do ataque), com o motivo no registro */
  | { tipo: 'vitais'; id: number; pv?: number; pe?: number; san?: number; motivo: string }
  /** muda o dano não letal de um ser (a cura tira primeiro ele, LR p. 88) */
  | { tipo: 'naoLetal'; id: number; valor: number; motivo?: string }
  | { tipo: 'encerrar' }
  | { tipo: 'fechar' }
  | { tipo: 'desfazer' };

/** O que o servidor sabe na hora de aplicar uma ação. */
export interface Contexto {
  agora: number;
  /** cena atual do mestre (para abrir o combate) */
  cena: number;
  /** as peças da campanha */
  pecas: PecaCombate[];
  /** PV, PE e SAN de cada peça (contadores de morrendo e enlouquecendo, dano, PE gasto) */
  vitais: (id: number) => Vitais | null;
  /** a ficha rápida da ameaça de uma peça (presença perturbadora) */
  ameaca?: (id: number) => FichaAmeaca | null;
}

/** PV, PE e SAN (igual ao `Vitals` da sessão; repetido aqui para o módulo não depender da sessão). */
export interface Vitais {
  pv: number;
  pvMax: number;
  pe: number;
  peMax: number;
  san: number;
  sanMax: number;
}

/** O que muda fora do combate: os PV, PE e SAN das peças (valores novos). */
export interface MudancaVitais {
  id: number;
  pv?: number;
  pe?: number;
  san?: number;
}

export type Resultado = { ok: true; combate: Combate | null; vitais?: MudancaVitais[] } | { ok: false; motivo: string };

// ------------------------------------------------------------------ ameaças

/** Teste da ameaça em dados + bônus (ex.: Fortitude 2d20+5). */
export interface TesteAmeaca {
  dados: number;
  bonus: number;
}

/** Um ataque da ficha da ameaça (LR p. 178–179). */
export interface AtaqueAmeaca {
  nome: string;
  pericia: 'luta' | 'pontaria';
  dados: number;
  bonus: number;
  /** dano como na ficha: "2d6+3" */
  dano: string;
  tipo: TipoDano;
  margem: number;
  multiplicador: number;
  /** alcance da arma: curto, médio, longo, extremo (sem alcance = corpo a corpo) */
  alcance?: string;
  /** ataques por ação (o "×2" da ficha) */
  vezes?: number;
  /** dano a mais de outro tipo, rolado à parte ("3d6 Morte e 1d8 mental") */
  extra?: { dano: string; tipo: TipoDano };
}

/** Presença perturbadora: NEX que dá imunidade, DT e o dano mental (LR p. 180). */
export interface PresencaAmeaca {
  nex: number;
  dt: number;
  dano: string;
}

/**
 * Ficha rápida de ameaça (NPC ou criatura), preenchida pelo mestre a partir do
 * livro: só os números que o combate usa (COMBATE.md, seção 17). PV ficam na
 * peça, como os dos agentes.
 */
export interface FichaAmeaca {
  /** descritor: Pessoa, Criatura de Sangue... */
  tipo: string;
  vd?: number;
  defesa: number;
  fortitude: TesteAmeaca;
  reflexos: TesteAmeaca;
  vontade: TesteAmeaca;
  rd: Partial<Record<TipoDano, number>>;
  imunidades: TipoDano[];
  vulnerabilidades: TipoDano[];
  ataques: AtaqueAmeaca[];
  /** tamanho (Tab. 7.1, LR p. 179): muda os testes de manobra; sem nada, Médio */
  tamanho?: Tamanho;
  /** Luta para o teste oposto das manobras; sem nada, vale o primeiro ataque corpo a corpo */
  luta?: TesteAmeaca;
  /** elemento da criatura (rituais: o elemento que vence o dela, LR p. 118); pessoa não tem */
  elemento?: Elemento;
  presenca?: PresencaAmeaca;
  /** id da ameaça do livro de que a ficha veio (ameacasLivro.ts) */
  livro?: string;
  notas?: string;
}
