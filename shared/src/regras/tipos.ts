/**
 * Tipos das regras de Ordem Paranormal RPG no CRONA: os catálogos (classes,
 * origens, trilhas, poderes, rituais, itens) e a linguagem de requisitos e
 * efeitos que amarra uma escolha na outra.
 *
 * - Requisito: o que libera uma opção (atributo mínimo, perícia treinada, NEX,
 *   outro poder...). Opção com requisito não cumprido aparece bloqueada, com
 *   o motivo.
 * - Efeito: o que a opção muda na ficha (PV, Defesa, perícias, carga...).
 *
 * Páginas = número impresso no rodapé do livro de regras (LR) ou do
 * Sobrevivendo ao Horror (SaH). Ver docs/REGRAS.md e docs/CRIACAO-DE-PERSONAGEM.md.
 *
 * Direitos autorais: o repositório é público. Resumos só com nossas palavras e
 * só para o conteúdo aberto do livro (capítulos 1 a 4, Open Game License).
 * Rituais, poderes paranormais, itens amaldiçoados e o conteúdo do SaH ficam
 * só com nome, números e página.
 */

// ================= básicos =================

export type Fonte = 'LR' | 'SaH';

/** Onde a regra está no livro. */
export interface Ref {
  fonte: Fonte;
  pagina: number;
}

export type AtributoId = 'agi' | 'for' | 'int' | 'pre' | 'vig';
export const ATRIBUTOS: AtributoId[] = ['agi', 'for', 'int', 'pre', 'vig'];

export type PericiaId =
  | 'acrobacia'
  | 'adestramento'
  | 'artes'
  | 'atletismo'
  | 'atualidades'
  | 'ciencias'
  | 'crime'
  | 'diplomacia'
  | 'enganacao'
  | 'fortitude'
  | 'furtividade'
  | 'iniciativa'
  | 'intimidacao'
  | 'intuicao'
  | 'investigacao'
  | 'luta'
  | 'medicina'
  | 'ocultismo'
  | 'percepcao'
  | 'pilotagem'
  | 'pontaria'
  | 'profissao'
  | 'reflexos'
  | 'religiao'
  | 'sobrevivencia'
  | 'tatica'
  | 'tecnologia'
  | 'vontade';

export type Grau = 'destreinado' | 'treinado' | 'veterano' | 'expert';
export const GRAUS: Grau[] = ['destreinado', 'treinado', 'veterano', 'expert'];

/** Classe do agente. `mundano` = pessoa comum de NEX 0% (regra opcional, LR p. 171). */
export type ClasseId = 'mundano' | 'combatente' | 'especialista' | 'ocultista';
export type ClasseAgente = Exclude<ClasseId, 'mundano'>;
export const CLASSES_AGENTE: ClasseAgente[] = ['combatente', 'especialista', 'ocultista'];

export type Elemento = 'sangue' | 'morte' | 'conhecimento' | 'energia' | 'medo';
/** Elementos com que se pode ter afinidade (LR p. 114). */
export type ElementoAfinidade = Exclude<Elemento, 'medo'>;
export const ELEMENTOS_AFINIDADE: ElementoAfinidade[] = ['sangue', 'morte', 'conhecimento', 'energia'];

/** NEX: 0 (pessoa comum), de 5 a 95 de 5 em 5, e 99. */
export type Nex = 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95 | 99;
export const NEX_LISTA: Nex[] = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];

/** Categoria de item: 0, I, II, III, IV. */
export type Categoria = 0 | 1 | 2 | 3 | 4;

export type Proficiencia =
  | 'armasSimples'
  | 'armasTaticas'
  | 'armasPesadas'
  | 'protecoesLeves'
  | 'protecoesPesadas'
  /** só as táticas corpo a corpo (Ninja Urbano) */
  | 'armasTaticasCorpoACorpo'
  /** só as táticas de fogo (Balística Avançada) */
  | 'armasTaticasFogo'
  /** armas de fogo que usam balas longas, de qualquer categoria (Mira de Elite) */
  | 'armasFogoBalasLongas';

/** Tipos de dano (LR p. 82). `fisico` = balístico, corte, impacto e perfuração juntos. */
export type TipoDano =
  | 'balistico'
  | 'corte'
  | 'eletricidade'
  | 'fogo'
  | 'frio'
  | 'impacto'
  | 'mental'
  | 'perfuracao'
  | 'quimico'
  | 'sangue'
  | 'morte'
  | 'conhecimento'
  | 'energia'
  | 'medo'
  | 'paranormal'
  | 'fisico'
  | 'todos';

/**
 * Identificador de catálogo: o nome em minúsculas, sem acento, com hífens.
 * "Armamento Pesado" → "armamento-pesado"; "T.I." → "t-i". Toda referência
 * entre catálogos usa este formato.
 */
export function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ================= requisitos =================

/**
 * O que libera uma opção. Uma lista de requisitos vale como "todos"; use
 * `algum` para "um ou outro".
 */
export type Requisito =
  /** atributo com pelo menos `min` (ex.: Força 2) */
  | { tipo: 'atributo'; atributo: AtributoId; min: number }
  /** perícia com pelo menos o grau (padrão: treinado). `escolhida` = a perícia escolhida junto com o poder */
  | { tipo: 'pericia'; pericia: PericiaId | 'escolhida'; grau?: Grau }
  /** NEX mínimo */
  | { tipo: 'nex'; min: Nex }
  /** ter outro poder ou habilidade (id do catálogo). `mesmaEscolha`: com a mesma escolha (ex.: o mesmo elemento) */
  | { tipo: 'poder'; poder: string; mesmaEscolha?: boolean }
  /** poderes paranormais: já ter pelo menos `min` OUTROS poderes do mesmo elemento deste poder (LR p. 114) */
  | { tipo: 'elemento'; min: number }
  /** ter afinidade (com o elemento indicado ou, sem ele, com o elemento do próprio poder) */
  | { tipo: 'afinidade'; elemento?: ElementoAfinidade }
  | { tipo: 'classe'; classe: ClasseId }
  | { tipo: 'trilha'; trilha: string }
  /** poder conjurar rituais deste círculo */
  | { tipo: 'circulo'; min: 1 | 2 | 3 | 4 }
  /** um dos requisitos da lista */
  | { tipo: 'algum'; de: Requisito[] }
  /** não pode cumprir este requisito (ex.: não ter o poder X) */
  | { tipo: 'nao'; req: Requisito }
  /** requisito que o CRONA não confere sozinho: o mestre decide */
  | { tipo: 'texto'; texto: string };

// ================= escolhas =================

/** Escolha feita junto com um poder ou habilidade (ex.: qual perícia, qual elemento). */
export type Escolha =
  /** `qtd` perícias (padrão 1). `treinada`: só entre as que já são treinadas. */
  | { tipo: 'pericia'; qtd?: number; de?: PericiaId[]; exceto?: PericiaId[]; treinada?: boolean }
  | { tipo: 'elemento'; de?: Elemento[] }
  | { tipo: 'atributo'; de?: AtributoId[] }
  /** rituais (padrão 1) até o círculo indicado */
  | { tipo: 'ritual'; qtd?: number; circuloMax?: 1 | 2 | 3 | 4; elemento?: Elemento }
  /** uma arma (ex.: A Favorita) */
  | { tipo: 'arma' }
  /** um poder paranormal (Transcender) */
  | { tipo: 'poderParanormal' }
  /** um poder de classe; `outraClasse`: de uma classe que não é a sua */
  | { tipo: 'poderClasse'; outraClasse?: boolean }
  /** escolha livre, só anotada (ex.: a profissão) */
  | { tipo: 'texto'; rotulo: string };

// ================= efeitos =================

/** Número fixo ou o valor de um atributo da ficha (ex.: 'agi' = soma a Agilidade). */
export type Valor = number | AtributoId;

/** A que armas um bônus vale. Armas de fogo contam como armas de disparo (LR p. 59). */
export type Escopo =
  | 'todos'
  /** ataques corpo a corpo, o desarmado incluído */
  | 'corpoACorpo'
  /** armas corpo a corpo: o desarmado fica de fora (LR p. 57) */
  | 'armasCorpoACorpo'
  | 'distancia'
  | 'disparo'
  | 'fogo'
  | 'arremesso'
  | 'desarmado'
  | 'favorita'
  /** armas táticas corpo a corpo */
  | 'taticaCorpoACorpo'
  /** armas táticas de fogo */
  | 'taticaFogo'
  /** armas de fogo que usam balas longas */
  | 'balasLongas'
  | 'ritual';

/**
 * O que uma opção muda na ficha. `condicional` = só vale numa situação (ou
 * pagando um custo): não entra nas contas, vira aviso. `afinidade` = só vale
 * com afinidade no elemento do poder (poder escolhido pela 2ª vez).
 *
 * Por NEX: `porNex` = por patamar de NEX (5% = 1 … 95% = 19, 99% = 20);
 * `porDezNex` = a cada 10% (99% = 10); `porNexImpar` = em cada patamar ímpar
 * a partir de 15% (15, 25, … 95%).
 *
 * `soElemento` = só vale com este elemento: o escolhido no próprio poder, senão
 * o escolhido na trilha (Monstruoso), senão o da afinidade (Possuído).
 */
/** `etapa`: só vale com a etapa ritualística do dia cumprida ('com') ou sem ela ('sem') (Ser Amaldiçoado, SaH p. 17) */
export type Efeito = { condicional?: string; afinidade?: boolean; soElemento?: Elemento; etapa?: 'com' | 'sem' } & (
  | { alvo: 'pv' | 'pe'; fixo?: number; porNex?: number; porDezNex?: number; porNexImpar?: number; valor?: AtributoId; atributoEscolhido?: boolean }
  | { alvo: 'san'; fixo?: number; porNex?: number }
  /** multiplica a Sanidade inicial da classe (Cultista Arrependido: 0,5) */
  | { alvo: 'sanInicial'; fator: number }
  | { alvo: 'limitePe'; valor: Valor }
  /** só para conjurar rituais */
  | { alvo: 'limitePeRituais'; valor: Valor }
  | { alvo: 'defesa'; valor: Valor }
  /** em metros */
  | { alvo: 'deslocamento'; valor: number }
  /** espaços de carga a mais */
  | { alvo: 'espacos'; valor: Valor }
  /** a carga passa a usar a soma destes atributos (Técnico: Força + Intelecto) */
  | { alvo: 'cargaAtributos'; atributos: AtributoId[] }
  | { alvo: 'pericia'; pericia: PericiaId | 'escolhida' | 'todas'; valor?: Valor; dados?: number }
  /** deixa treinado (ou no grau indicado) na perícia; se já era, soma `seJa` nela */
  | { alvo: 'treino'; pericia: PericiaId | 'escolhida'; grau?: Grau; seJa?: number }
  /** usa este atributo no lugar de Presença para calcular os PE (vale o maior) */
  | { alvo: 'atributoPe'; atributo: AtributoId }
  /** usa este atributo no lugar do normal nesta perícia (vale o maior) */
  | { alvo: 'atributoPericia'; pericia: PericiaId; atributo: AtributoId }
  /** muda um atributo fora dos pontos de criação */
  | { alvo: 'atributo'; atributo: AtributoId; valor: number }
  /** resistência a dano; `escolhido` = o elemento escolhido junto com o poder (Resistir a <Elemento>) */
  | { alvo: 'resistencia'; dano: TipoDano | 'escolhido'; valor: Valor }
  /** bônus em testes de resistência (Fortitude, Reflexos, Vontade) */
  | { alvo: 'resistenciaTeste'; valor?: Valor; dados?: number }
  | { alvo: 'proficiencia'; proficiencia: Proficiencia }
  | { alvo: 'rituaisConhecidos'; valor: Valor }
  | { alvo: 'dtRituais'; valor: number; elemento?: Elemento | 'escolhido' }
  /** muda o custo em PE de rituais (negativo = mais barato) */
  | { alvo: 'custoRitual'; valor: number; elemento?: Elemento | 'escolhido' }
  /** +N itens da categoria no limite da patente */
  | { alvo: 'itens'; categoria: Categoria; valor: number }
  /** reduz a categoria de um item (A Favorita). Para o mesmo item vale a maior redução */
  | { alvo: 'categoria'; item: 'favorita' | 'escolhido'; valor: number }
  /** sobe o limite de crédito em níveis */
  | { alvo: 'credito'; valor: number }
  | { alvo: 'ataque'; escopo: Escopo; valor?: Valor; dados?: number }
  | { alvo: 'dano'; escopo: Escopo; valor?: Valor; dadoExtra?: number }
  | { alvo: 'margem'; escopo: Escopo; valor: number }
  | { alvo: 'multiplicador'; escopo: Escopo; valor: number }
  /** vestimentas a mais que dão bônus ao mesmo tempo (o normal são 2) */
  | { alvo: 'vestimentas'; valor: number }
  /** efeito que o CRONA só mostra */
  | { alvo: 'nota'; texto: string }
);

// ================= catálogos =================

/** Habilidade fixa (de classe, de trilha ou de origem). */
export interface Habilidade {
  id: string;
  nome: string;
  ref: Ref;
  /** NEX em que chega (trilha: 10, 40, 65 ou 99; classe: o NEX da tabela) */
  nex?: Nex;
  /** resumo com nossas palavras (só conteúdo aberto) */
  resumo?: string;
  /** custo em PE para usar, quando tem */
  custoPe?: number;
  efeitos?: Efeito[];
  escolha?: Escolha;
  /** rituais que ela ensina (ids), ou `escolha` */
  concedeRituais?: string[] | { escolha: Escolha };
  /**
   * Rituais a mais, à escolha, fora do limite: `qtd` no NEX da habilidade (um
   * número ou um atributo) e, com `porCirculoNovo`, mais um a cada círculo que
   * a classe liberar depois (Saber Ampliado, Grimório Ritualístico).
   */
  rituaisExtras?: { qtd: Valor; circuloMax?: 1 | 2 | 3 | 4; porCirculoNovo?: boolean };
}

export interface Classe {
  id: ClasseId;
  nome: string;
  ref: Ref;
  /** PV: inicial + Vigor; a cada NEX novo, porNex + Vigor */
  pv: { inicial: number; porNex: number };
  /** PE: inicial + Presença; a cada NEX novo, porNex + Presença */
  pe: { inicial: number; porNex: number };
  /** SAN: inicial; a cada NEX novo, porNex (sem atributo) */
  san: { inicial: number; porNex: number };
  pericias: {
    /** treinadas sempre */
    fixas: PericiaId[];
    /** de cada grupo, escolhe uma */
    grupos: PericiaId[][];
    /** quantas mais, à escolha (fora estas, +1 por ponto de Intelecto) */
    livres: number;
  };
  proficiencias: Proficiencia[];
  /** habilidades fixas, com o NEX em que chegam */
  habilidades: Habilidade[];
  /** grau de treinamento (NEX 35% e 70%): quantas perícias sobem, fora o Intelecto */
  grauTreinamento: number;
  /** rituais (ocultista): quantos começa sabendo, quantos aprende por NEX e o NEX de cada círculo */
  rituais?: { iniciais: number; porNex: number; circulos: Record<1 | 2 | 3 | 4, Nex> };
}

export interface Trilha {
  id: string;
  nome: string;
  ref: Ref;
  classe: ClasseAgente;
  /** para escolher a trilha (ex.: Médico de Campo pede Medicina treinada) */
  requisitos?: Requisito[];
  /** as quatro habilidades (NEX 10, 40, 65 e 99) */
  habilidades: Habilidade[];
  /**
   * Alterações da Progressão de NEX que chegam sozinhas, em NEX que a trilha não dá habilidade (Monstruoso, SaH p. 17 e 99):
   * entram nas contas a partir do NEX de cada uma, com a escolha que pedem.
   */
  alteracoes?: Habilidade[];
  resumo?: string;
}

export interface Origem {
  id: string;
  nome: string;
  ref: Ref;
  /** as duas perícias treinadas; `escolha` quando o jogador ou o mestre escolhe (Amnésico) */
  pericias: PericiaId[] | { escolha: number; texto?: string };
  poder: Habilidade;
  resumo?: string;
}

/** Poder de classe (ou geral, do SaH). */
export interface Poder {
  id: string;
  nome: string;
  ref: Ref;
  /** classes que podem escolher; `geral` = qualquer classe (SaH) */
  classes: (ClasseAgente | 'geral')[];
  requisitos?: Requisito[];
  /** pode escolher mais de uma vez */
  repetivel?: boolean;
  escolha?: Escolha;
  custoPe?: number;
  efeitos?: Efeito[];
  resumo?: string;
}

/** Poder paranormal (vem de Transcender). Identidade do produto: só nome, números e página. */
export interface PoderParanormal {
  id: string;
  nome: string;
  ref: Ref;
  elemento: Elemento;
  /** o elemento vem da escolha: o elemento escolhido ou o do ritual aprendido (Resistir a <Elemento>, Aprender Ritual) */
  elementoDaEscolha?: boolean;
  requisitos?: Requisito[];
  /** tem versão com afinidade (pode ser escolhido de novo com afinidade) */
  afinidade?: boolean;
  /** pode escolher várias vezes (Aprender Ritual) */
  repetivel?: boolean;
  escolha?: Escolha;
  custoPe?: number;
  efeitos?: Efeito[];
}

export type Execucao = 'livre' | 'reacao' | 'movimento' | 'padrao' | 'completa' | string;
export type AlcanceRitual = 'pessoal' | 'toque' | 'curto' | 'medio' | 'longo' | 'extremo' | 'ilimitado' | string;

/** Ritual. Identidade do produto: só nome, números e página. */
export interface Ritual {
  id: string;
  nome: string;
  ref: Ref;
  elemento: Elemento;
  /** o elemento é escolhido ao aprender, entre estes (Amaldiçoar Arma) */
  elementos?: Elemento[];
  /** só vem desta habilidade, não se escolhe na lista (Lâmina do Medo) */
  concedidoPor?: string;
  circulo: 1 | 2 | 3 | 4;
  execucao: Execucao;
  alcance: AlcanceRitual;
  /** alvo, área ou efeito, bem curto (ex.: "1 ser", "esfera de 6 m") */
  alvo?: string;
  duracao: string;
  resistencia?: string;
  /** formas avançadas: PE a mais e o que exigem */
  discente?: { custoExtra: number; circulo?: 2 | 3 | 4; afinidade?: boolean };
  verdadeiro?: { custoExtra: number; circulo?: 2 | 3 | 4; afinidade?: boolean };
}

export type ProficienciaArma = 'simples' | 'tatica' | 'pesada';
export type TipoArma = 'corpoACorpo' | 'arremesso' | 'disparo' | 'fogo';
export type Empunhadura = 'leve' | 'umaMao' | 'duasMaos';
export type Alcance = 'curto' | 'medio' | 'longo' | 'extremo';
/** id do pacote de munição no catálogo de equipamentos */
export type Municao = 'balas-curtas' | 'balas-longas' | 'cartuchos' | 'combustivel' | 'flechas' | 'foguete' | 'bolinhas' | string;

export interface Arma {
  id: string;
  nome: string;
  ref: Ref;
  categoria: Categoria;
  proficiencia: ProficienciaArma;
  tipo: TipoArma;
  empunhadura: Empunhadura;
  /** dados de dano (ex.: "1d8", "2d6") */
  dano: string;
  /** margem de ameaça (20, 19, 18) e multiplicador (2, 3, 4) */
  critico: { margem: number; multiplicador: number };
  /** sem alcance = só adjacente */
  alcance?: Alcance;
  /** tipo de dano; mais de um quando a arma causa à escolha (ex.: corte ou perfuração) */
  tipoDano: TipoDano[];
  espacos: number;
  /** ágil: pode usar Agilidade no ataque e no dano (LR p. 59) */
  agil?: boolean;
  /** automática: pode fazer rajada (LR p. 59) */
  automatica?: boolean;
  municao?: Municao;
  /** d20 a menos nos testes de ataque (arma improvisada: −1, LR p. 57) */
  penalidadeAtaque?: number;
  /** número somado aos testes de ataque (moto-serra: −2, LR p. 59) */
  bonusAtaque?: number;
  /** penalidade no ataque de quem tem menos Força que a pedida (metralhadora: −5 sem Força 4, LR p. 59) */
  forcaMinima?: { forca: number; bonus: number; nota: string };
  /** soma a Força no dano mesmo sendo de disparo (arco composto, LR p. 58; estilingue, SaH p. 37) */
  somaForca?: boolean;
  /** outras regras da arma, em palavras curtas (ex.: "arremessável", "duas mãos: 1d10") */
  especial?: string[];
  resumo?: string;
}

export type TipoProtecao = 'leve' | 'pesada' | 'escudo';

export interface Protecao {
  id: string;
  nome: string;
  ref: Ref;
  categoria: Categoria;
  tipo: TipoProtecao;
  defesa: number;
  espacos: number;
  resistencia?: { dano: TipoDano[]; valor: number };
  /** penalidade nas perícias de carga (Acrobacia, Crime, Furtividade) */
  penalidadePericias?: number;
  resumo?: string;
}

export type GrupoItem =
  | 'acessorio'
  | 'kit'
  | 'utensilio'
  | 'vestimenta'
  | 'explosivo'
  | 'operacional'
  | 'paranormal'
  | 'municao'
  | 'medicamento'
  | 'veiculo'
  | 'outro';

/** Equipamento geral (não é arma nem proteção). */
export interface Equipamento {
  id: string;
  nome: string;
  ref: Ref;
  categoria: Categoria;
  espacos: number;
  grupo: GrupoItem;
  /** kit exigido por usos desta perícia */
  kitDe?: PericiaId;
  /** os efeitos só valem com esta perícia treinada (o cão adestrado pede Adestramento) */
  exigeTreino?: PericiaId;
  efeitos?: Efeito[];
  /** usos ou cargas, quando o item gasta */
  usos?: number;
  especial?: string[];
  resumo?: string;
}

export type AlvoModificacao = 'armaCorpoACorpo' | 'armaDisparo' | 'armaFogo' | 'municao' | 'protecao' | 'acessorio';

/** Modificação de item: cada uma sobe a categoria do item em I (LR p. 60). */
export interface Modificacao {
  id: string;
  nome: string;
  ref: Ref;
  para: AlvoModificacao[];
  /** só em proteção leve ou pesada, etc. */
  requisitos?: Requisito[];
  /** modificações que não combinam com esta (ids) */
  incompativel?: string[];
  efeitos?: Efeito[];
  especial?: string[];
  resumo?: string;
}

/** Item amaldiçoado. Identidade do produto: só nome, números e página. */
export interface ItemAmaldicoado {
  id: string;
  nome: string;
  ref: Ref;
  elemento: Elemento;
  categoria: Categoria;
  espacos: number;
  /** vestido, empunhado, consumível... em palavras curtas */
  especial?: string[];
  /** números que mudam a ficha enquanto o item está em uso */
  efeitos?: Efeito[];
}

/** Maldição de item (arma, proteção ou acessório). Identidade do produto. */
export interface Maldicao {
  id: string;
  nome: string;
  ref: Ref;
  elemento: Elemento;
  para: ('arma' | 'protecao' | 'acessorio')[];
  /** números que mudam a ficha enquanto o item está em uso */
  efeitos?: Efeito[];
}

export interface Patente {
  id: string;
  nome: string;
  ref: Ref;
  /** pontos de prestígio mínimos */
  pp: number;
  credito: 'baixo' | 'medio' | 'alto' | 'ilimitado';
  /** itens por categoria (I a IV); categoria 0 não tem limite */
  itens: Record<1 | 2 | 3 | 4, number>;
}

export interface Pericia {
  id: PericiaId;
  nome: string;
  ref: Ref;
  atributo: AtributoId;
  /** só pode usar treinado */
  somenteTreinada: boolean;
  /** sofre penalidade de carga */
  carga: boolean;
}
