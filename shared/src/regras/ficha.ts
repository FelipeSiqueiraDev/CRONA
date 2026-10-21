/**
 * A ficha de um personagem no CRONA: só as ESCOLHAS (classe, origem,
 * atributos, perícias, o que foi escolhido em cada NEX, a mochila). Tudo que é
 * número (PV, Defesa, carga...) sai de `calcular()`; o que falta escolher sai
 * de `pendencias()`; o que pode ser escolhido sai de `opcoes()`.
 *
 * A criação vai de NEX 0% (pessoa comum, regra opcional) ou 5% até 99%, um
 * patamar por vez: cada NEX guarda as próprias escolhas em `progressao`.
 */
import type { AtributoId, ClasseAgente, Elemento, ElementoAfinidade, Nex, PericiaId } from './tipos';

/** Parâmetro de uma escolha (qual perícia, qual elemento, qual ritual...). */
export interface ValorEscolha {
  pericias?: PericiaId[];
  elemento?: Elemento;
  atributo?: AtributoId;
  rituais?: string[];
  /** id da arma (A Favorita) */
  arma?: string;
  /** poder escolhido por esta escolha (Transcender → poder paranormal; poder de outra classe) */
  poder?: string;
  /** a escolha do poder escolhido (ex.: o elemento do poder paranormal) */
  sub?: ValorEscolha;
  texto?: string;
}

/** Um poder de classe escolhido. */
export interface EscolhaPoder {
  id: string;
  escolha?: ValorEscolha;
}

/** O que foi escolhido num patamar de NEX. */
export interface EscolhasNex {
  /** poder de classe (15, 30, 45, 60, 75, 90%) */
  poder?: EscolhaPoder;
  /** versatilidade (50%): um poder de classe ou o 1º poder de outra trilha da classe */
  versatilidade?: { poder?: EscolhaPoder; trilha?: string };
  /** aumento de atributo (20, 50, 80, 95%) */
  atributo?: AtributoId;
  /** NEX 5% de quem começou como pessoa comum: o ponto de atributo do treinamento (sem passar de 3) */
  atributoTreino?: AtributoId;
  /** perícia nova quando o Intelecto sobe (uma por ponto) */
  periciaIntelecto?: PericiaId;
  /** grau de treinamento (35, 70%): as perícias que sobem um grau */
  grau?: PericiaId[];
  /** o ritual aprendido neste NEX (ocultista, a partir de 10%). Os que vêm de habilidade (os 3 do NEX 5%) ficam em `parametros` */
  rituais?: string[];
  /** elemento de afinidade (50%) */
  afinidade?: ElementoAfinidade;
  /** escolhas das habilidades fixas que chegam neste NEX (id da habilidade → escolha) */
  parametros?: Record<string, ValorEscolha>;
}

/** Tipo de item do catálogo (o do cenário fica fora: `'cena'`). */
export type TipoItemCatalogo = 'arma' | 'protecao' | 'equipamento' | 'amaldicoado';

/** Item na mochila: do catálogo ou achado no cenário (`'cena'`: um documento, uma chave). */
export interface ItemFicha {
  /** id do catálogo; no item do cenário, um texto livre */
  id: string;
  tipo: TipoItemCatalogo | 'cena';
  /** número do item, único entre as fichas (entregar, largar, mãos); o servidor dá */
  uid?: number;
  qtd?: number;
  /** ids de modificações */
  modificacoes?: string[];
  /** ids de maldições */
  maldicoes?: string[];
  /** na mão (armas, escudo e itens "empunhado"); sem isso, guardado */
  empunhado?: boolean;
  /** vestido (proteções e itens "vestido"); sem isso, vestido */
  vestido?: boolean;
  /** nome próprio (ex.: "Katana do avô") */
  apelido?: string;
  /**
   * o que se escolhe ao requisitar o item (LR p. 63 e 66): a perícia do utensílio e da vestimenta
   * (fora Luta e Pontaria) e o elemento dos itens "de (Elemento)" e do catalisador
   */
  escolha?: { pericia?: PericiaId; elemento?: Elemento };
  /** achado na missão: não ocupa vaga da patente, que limita o que a Ordem fornece (LR p. 53) */
  achado?: boolean;
  /** item do cenário: nome, espaços, tipo (o ícone) e o texto do mestre */
  nome?: string;
  espacos?: number;
  tipoCena?: string;
  descricao?: string;
}

/** Regras em uso nesta ficha (vêm da campanha). */
export interface RegrasFicha {
  /** conteúdo do Sobrevivendo ao Horror */
  sah: boolean;
  /** personagens de NEX 0% (LR p. 171) */
  nexZero: boolean;
}

export const REGRAS_PADRAO: RegrasFicha = { sah: true, nexZero: true };

export interface Ficha {
  versao: 1;
  nome: string;
  jogador?: string;
  /** toques finais (LR p. 36) */
  textos?: { idade?: string; aparencia?: string; personalidade?: string; historico?: string; objetivo?: string };
  nex: Nex;
  /** começou em NEX 0% como pessoa comum */
  comecouMundano: boolean;
  /** classe de agente; `null` enquanto for pessoa comum */
  classe: ClasseAgente | null;
  origem: string | null;
  /** atributos distribuídos na criação (sem os aumentos de NEX) */
  atributos: Record<AtributoId, number>;
  /** perícias treinadas na criação */
  pericias: {
    /** Amnésico: as duas perícias escolhidas pelo mestre (as outras origens já dão as suas) */
    origem?: PericiaId[];
    /** uma de cada grupo da classe (combatente: Luta ou Pontaria, Fortitude ou Reflexos) */
    grupos: PericiaId[];
    /** as livres da classe mais uma por ponto de Intelecto da criação */
    livres: PericiaId[];
  };
  /** a profissão, quando treinado em Profissão */
  profissao?: string;
  trilha: string | null;
  /** escolhas feitas em cada NEX */
  progressao: Partial<Record<Nex, EscolhasNex>>;
  /** pontos de prestígio (definem a patente) */
  pp: number;
  inventario: ItemFicha[];
  /** ajustes do mestre somados às contas */
  ajustes?: { pv?: number; pe?: number; san?: number; limitePe?: number; defesa?: number };
  /**
   * avisos do mestre para o jogador (18/10, o Felipe: "se tiver algo errado na ficha de lá [do C.R.I.S], deixa de aviso
   * ali pra eles quando entrarem"): aparecem numa janela quando ele abre a ficha e na Evolução do mestre
   */
  avisos?: string[];
  /**
   * cumpriu hoje a etapa ritualística (Monstruoso, Ser Amaldiçoado, SaH p. 17): liga o efeito do elemento até o fim do
   * dia; sem ela, fome e sede. O mestre marca no painel PLAYERS ("Cumpriu"); passar o dia desmarca (19/10)
   */
  etapaCumprida?: boolean;
  /**
   * regra da mesa (19/10): quantas vezes por dia vale cada poder, ritual ou item (a chave de `chaveDia`, em porDia.ts);
   * o mestre marca. `usosDia` é quanto já foi usado hoje; passar o dia zera.
   */
  limitesDia?: Record<string, number>;
  usosDia?: Record<string, number>;
  /** 19/10, uma vez: depois das escolhas do NEX, o jogador refaz o equipamento (a mochila foi zerada); some ao fazer */
  refazerEquipamento?: boolean;
  /** o NEX em que o jogador já viu o aviso de evolução (21/10); se o NEX da ficha é maior, o aviso abre no login */
  nexVisto?: number;
  /** perdas permanentes (rituais de Medo, Custo do Paranormal) */
  perdas?: { san?: number; pe?: number };
  regras: RegrasFicha;
}

/** Ficha vazia, pronta para a criação. */
export function novaFicha(nome = '', opcoes: { comecouMundano?: boolean; regras?: Partial<RegrasFicha> } = {}): Ficha {
  const mundano = !!opcoes.comecouMundano;
  return {
    versao: 1,
    nome,
    nex: mundano ? 0 : 5,
    comecouMundano: mundano,
    classe: null,
    origem: null,
    atributos: { agi: 1, for: 1, int: 1, pre: 1, vig: 1 },
    pericias: { grupos: [], livres: [] },
    trilha: null,
    progressao: {},
    pp: 0,
    inventario: [],
    regras: { ...REGRAS_PADRAO, ...opcoes.regras },
  };
}

/** Escolhas de um NEX (cria o objeto se ainda não existir). */
export function escolhasDe(f: Ficha, nex: Nex): EscolhasNex {
  return (f.progressao[nex] ??= {});
}
