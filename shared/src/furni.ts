import { Z_PER_M } from './constants';

export type FurniCategory =
  | 'mobilia'
  | 'escritorio'
  | 'laboratorio'
  | 'ocultismo'
  | 'iluminacao'
  | 'armazenamento'
  | 'decoracao'
  | 'estrutura'
  | 'bar'
  | 'saude'
  | 'arsenal'
  | 'fazenda'
  | 'casa'
  | 'parede'
  | 'vila'
  | 'mansao';

export const CATEGORY_NAMES: Record<FurniCategory, string> = {
  estrutura: 'Estrutura',
  mobilia: 'Mobília',
  escritorio: 'Escritório',
  laboratorio: 'Laboratório',
  ocultismo: 'Ocultismo',
  iluminacao: 'Iluminação',
  armazenamento: 'Armazenamento',
  decoracao: 'Decoração',
  bar: 'Bar',
  saude: 'Enfermaria e Banheiro',
  arsenal: 'Arsenal',
  fazenda: 'Fazenda',
  casa: 'Casa',
  parede: 'Parede',
  vila: 'Santo Berço',
  mansao: 'Mansão',
};

/**
 * Mobi de chão. Dimensões canônicas: `width` ao longo de v (lateral) e `depth`
 * ao longo de u (frente). A frente aponta para a direção da rotação.
 */
export interface FurniDef {
  id: string;
  name: string;
  category: FurniCategory;
  kind: string;
  width: number;
  depth: number;
  /**
   * Altura de empilhamento/assento, em unidades de altura (a lista abaixo
   * escreve em metros; ver Z_PER_M).
   */
  height: number;
  walkable?: boolean;
  sit?: boolean;
  /**
   * Camas de andares (beliche): a altura, em metros, de cada uma onde a peça fica deitada ou sentada, de baixo para
   * cima. Quem pisa na casa fica na primeira; o mestre põe a peça na de cima ("Na cama de cima").
   */
  /** o estado da arte quando há alguém deitado nela (a cama da Catarina: os ursos vão para o canto, 23/10) */
  estadoOcupada?: number;
  leitos?: number[];
  /**
   * Cama: a peça deita nela (14/10, o Felipe: "mando o personagem ir pra cama e nada acontece"). Toda cama (kind bed,
   * hospital_bed, beliche) ganha `sit` e `deita` sozinha, em FURNI_LIST: anda até ela e deita no colchão, a cabeça para
   * a cabeceira (o fundo da peça).
   */
  deita?: boolean;
  stackable?: boolean;
  /** decalque plano (sangue, sigilo, papéis) */
  flat?: boolean;
  /** quantidade de estados (clique duplo alterna) */
  states?: number;
  /** fica transparente quando o seu avatar passa atrás (paredes internas) */
  xray?: boolean;
  /** Passagem para outro quarto */
  portal?: boolean;
  /** passagem escondida: só aparece (state 1) quando o mobi com senha em cima dela desliza */
  hidden?: boolean;
  /** porta: dá para passar só neste estado (ex.: 1 = aberta) */
  openState?: number;
  /**
   * porta de cela: as casas atrás dela (até as paredes) são a cela. Fechada, a cela fica no
   * escuro; aberta, acende e a parede entre ela e a câmera fica transparente.
   */
  cela?: boolean;
  /** só o jogo cria (não aparece no catálogo): a pilha do que alguém largou no chão */
  interno?: boolean;
  /**
   * Casas livres dentro da pegada (a peça inteira em volta delas): o meio da mesa em U, o lugar do
   * leito dentro da cortina. [u, v] na peça virada para a frente: u ao longo da largura (da esquerda
   * para a direita) e v do fundo (0) para a frente (depth - 1). Nelas se anda e se põe outra peça.
   */
  vazio?: [number, number][];
  /**
   * A altura de cima de cada casa (17/10, a ponte do Igarapé com a escadinha nas cabeceiras): [v][u] na peça virada
   * para a frente (como o `vazio`), em metros no catálogo. Sem ela, todas as casas têm o `height`.
   */
  alturas?: number[][];
  /**
   * O parapeito da frente (17/10, a ponte do Igarapé: "parece que voa sobre ela"): a faixa da beira da peça que fica
   * do lado da câmera, com `m` metros de largura e `z1` metros de altura, é desenhada de novo por cima de quem anda em
   * cima da peça. Sem isso, a peça inteira vem antes de quem está nela, e a pessoa aparece em cima da mureta.
   */
  parapeito?: { m: number; z1: number };
  /** os lados abertos da peça vazada (a cortina não tem o fundo; a mesa em U não tem a frente) */
  aberto?: ('fundo' | 'frente')[];
  /**
   * A mesa tem vão embaixo (12/10, pedido do Felipe): a cadeira e a banqueta encaixam embaixo dela.
   * 'vazada' (só pernas): a peça também passa por baixo, abaixada, e pode parar ali escondida.
   * 'fundo' (gaveteiro, painel, caixas embaixo): a cadeira encaixa, mas ninguém atravessa.
   */
  vao?: 'vazada' | 'fundo';
  /**
   * A arte maior que a pegada, na largura e no fundo: as mesas pareciam de centro perto das
   * pessoas. A borda passa um pouco por cima das casas vizinhas. As cadeiras e banquetas crescem
   * junto (12/10). A altura NÃO cresce (17/10, o Felipe: "Mesa alta né menino?! Catarina quase
   * sumiu atrás dela"): a `height` é a de verdade (mesa 0,76 m, assento 0,45 m, banqueta de
   * balcão 0,75 m, mesa de laboratório 0,90 m), e a pixel art é desenhada nela.
   */
  aumento?: number;
  rotations: number[];
  colors: string[];
  desc?: string;
  /** prédio sem nome no mapa (a casinha comum da vila: só os lugares importantes têm rótulo) */
  semNome?: boolean;
}

/** Mobi de parede. Tamanho em pixels de tela. */
export interface WallFurniDef {
  id: string;
  name: string;
  category: 'parede';
  kind: string;
  w: number;
  h: number;
  states?: number;
  colors: string[];
  desc?: string;
}

const ALL = [0, 2, 4, 6];

/** Mobis com a altura em metros (convertida para unidades em FURNI_LIST). */
const FURNI_METERS: FurniDef[] = [
  // ---------- Escritório ----------
  // a mesa em U da Sala de Tecnologia, inteira (06/10): três postos no fundo, o meio e a entrada livres
  { id: 'desk_u', name: 'Mesa em U', category: 'escritorio', kind: 'desk', width: 6, depth: 4, height: 0.78, vazio: [1, 2, 3, 4].flatMap((u) => [1, 2, 3].map((v) => [u, v] as [number, number])), aberto: ['frente'], rotations: ALL, colors: ['#2a2a30', '#b05ae0'], desc: 'Três postos com três monitores cada, teclados acesos de roxo, fones, fitas e uns cristais esquisitos no meio das pastas.' },
  { id: 'desk_wood', name: 'Mesa de Escritório', category: 'escritorio', kind: 'desk', width: 2, depth: 1, height: 0.76, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#4b3120', '#2f1f15', '#b8955a'] },
  { id: 'mesa_vazia', name: 'Mesa de Escritório Vazia', category: 'escritorio', kind: 'desk', width: 2, depth: 1, height: 0.76, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#4b3120', '#2f1f15', '#b8955a'] },
  { id: 'desk_metal', name: 'Mesa Metálica', category: 'escritorio', kind: 'desk', width: 2, depth: 1, height: 0.76, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#3c4046', '#2a2d31', '#8a9098'] },
  { id: 'chair_office', name: 'Cadeira de Escritório', category: 'escritorio', kind: 'office_chair', width: 1, depth: 1, height: 0.47, aumento: 1.2, sit: true, rotations: ALL, colors: ['#242329', '#131216'] },
  { id: 'monitor', name: 'Monitor', category: 'escritorio', kind: 'monitor', width: 1, depth: 1, height: 0.45, states: 2, rotations: ALL, colors: ['#1b1d21', '#5fd3ff'], desc: 'Clique duplo liga/desliga.' },
  { id: 'monitor_green', name: 'Monitor de Radar', category: 'escritorio', kind: 'monitor', width: 1, depth: 1, height: 0.42, states: 2, rotations: ALL, colors: ['#1b1d21', '#4fe39a'] },
  // a enfermaria tem os dela (com arte): o monitor do radar, os frascos do laboratório e os computadores dos outros cômodos ficam como estão
  { id: 'vitals_monitor', name: 'Monitor de Sinais Vitais', category: 'saude', kind: 'monitor', width: 1, depth: 1, height: 0.34, states: 2, rotations: ALL, colors: ['#1b1d21', '#4fe39a'], desc: 'A linha verde do batimento.' },
  { id: 'med_tray', name: 'Bandeja de Remédios', category: 'saude', kind: 'flasks', width: 1, depth: 1, height: 0.16, rotations: ALL, colors: ['#c8ccd0', '#8a5a2a', '#e8eef2'], desc: 'Frascos, seringas e algodão numa bandeja de inox.' },
  { id: 'computer_old', name: 'Computador Antigo', category: 'escritorio', kind: 'monitor', width: 1, depth: 1, height: 0.42, states: 2, rotations: ALL, colors: ['#c8b89a', '#3f7fff'], desc: 'Monitor de tubo bege e teclado. Clique duplo liga/desliga.' },
  { id: 'keyboard', name: 'Teclado', category: 'escritorio', kind: 'keyboard', width: 1, depth: 1, height: 0.05, stackable: true, rotations: ALL, colors: ['#18181b'] },
  { id: 'papers', name: 'Papéis Espalhados', category: 'escritorio', kind: 'papers', width: 1, depth: 1, height: 0.02, walkable: true, stackable: true, rotations: ALL, colors: ['#d8cdb0'] },
  { id: 'mug', name: 'Caneca', category: 'escritorio', kind: 'mug', width: 1, depth: 1, height: 0.2, rotations: ALL, colors: ['#d8d2c4'] },
  { id: 'cabinet_file', name: 'Arquivo de Aço', category: 'escritorio', kind: 'file_cabinet', width: 1, depth: 1, height: 1.35, stackable: true, states: 2, rotations: ALL, colors: ['#4b5057', '#34383d', '#c9c0a4'], desc: 'Clique duplo abre a gaveta.' },

  // ---------- Mobília ----------
  { id: 'table_meeting', name: 'Mesa de Reunião', category: 'mobilia', kind: 'table_big', width: 3, depth: 2, height: 0.76, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#3f2a1b', '#2b1c12', '#9a7a4a'] },
  { id: 'table_small', name: 'Mesinha', category: 'mobilia', kind: 'table', width: 1, depth: 1, height: 0.7, vao: 'vazada', aumento: 1.35, stackable: true, rotations: ALL, colors: ['#4b3120', '#2f1f15'] },
  { id: 'chair_wood', name: 'Cadeira de Madeira', category: 'mobilia', kind: 'chair', width: 1, depth: 1, height: 0.45, aumento: 1.2, sit: true, rotations: ALL, colors: ['#5a3a24', '#3d2718'] },
  { id: 'stool', name: 'Banqueta', category: 'mobilia', kind: 'stool', width: 1, depth: 1, height: 0.45, aumento: 1.2, sit: true, rotations: ALL, colors: ['#3a2a24', '#1d1a18'] },
  { id: 'stool_lab', name: 'Banqueta de Laboratório', category: 'laboratorio', kind: 'stool', width: 1, depth: 1, height: 0.7, aumento: 1.2, sit: true, rotations: ALL, colors: ['#1d1d1f', '#8d949c'], desc: 'Assento de vinil preto, rodinhas e o anel de apoio dos pés.' },
  { id: 'sofa_leather', name: 'Sofá de Couro', category: 'mobilia', kind: 'sofa', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#4a2320'] },
  { id: 'rug_worn', name: 'Tapete Gasto', category: 'mobilia', kind: 'rug', width: 2, depth: 3, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#4a1c1c', '#8a6a3a'] },

  // ---------- Laboratório ----------
  { id: 'lab_bench', name: 'Bancada de Laboratório', category: 'laboratorio', kind: 'lab_bench', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#2f3338', '#8d949c', '#cfcabd'] },
  // as bancadas inteiras do laboratório e as peças inteiras (09/10, arte do Códex)
  { id: 'bancada_lab_parede', name: 'Bancada de Laboratório (parede)', category: 'laboratorio', kind: 'lab_bench', width: 4, depth: 1, height: 0.92, stackable: true, rotations: ALL, colors: ['#2f3338', '#8d949c', '#cfcabd'] },
  { id: 'bancada_lab_curta', name: 'Bancada de Laboratório (canto)', category: 'laboratorio', kind: 'lab_bench', width: 2, depth: 1, height: 0.92, stackable: true, rotations: ALL, colors: ['#2f3338', '#8d949c', '#cfcabd'] },
  { id: 'bancada_lab_ilha', name: 'Bancada de Laboratório (ilha)', category: 'laboratorio', kind: 'lab_bench', width: 4, depth: 1, height: 0.92, stackable: true, rotations: ALL, colors: ['#2f3338', '#8d949c', '#cfcabd'] },
  { id: 'mesa_vidro_lab', name: 'Mesa de Vidro do Laboratório', category: 'laboratorio', kind: 'mesa_vidro_lab', width: 1, depth: 3, height: 0.9, vao: 'fundo', aumento: 1.2, rotations: ALL, colors: ['#a8d0e0', '#3a3d42'], desc: 'Tubos de ensaio em duas fileiras, frascos coloridos e um bico de Bunsen.' },
  { id: 'impressora_3d', name: 'Impressora 3D', category: 'laboratorio', kind: 'impressora_3d', width: 1, depth: 1, height: 1.3, rotations: ALL, colors: ['#2a2d33', '#ff8a3a'] },
  { id: 'mesa_arsenal', name: 'Mesa Grande do Arsenal', category: 'arsenal', kind: 'table_big', width: 4, depth: 2, height: 0.9, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#2a3a2a', '#1f2219'] },
  { id: 'poltrona_preta', name: 'Poltrona Preta', category: 'mobilia', kind: 'armchair', width: 1, depth: 1, height: 0.95, sit: true, rotations: ALL, colors: ['#1a1a1e', '#3a3a42'] },
  { id: 'tank', name: 'Tanque de Contenção', category: 'laboratorio', kind: 'tank', width: 2, depth: 2, height: 2.2, states: 2, rotations: ALL, colors: ['#2b2f33', '#3fe0c0'], desc: 'Clique duplo alterna a luz do tanque.' },
  { id: 'trolley', name: 'Carrinho de Laboratório', category: 'laboratorio', kind: 'trolley', width: 1, depth: 1, height: 0.95, rotations: ALL, colors: ['#7d848c', '#8a1414'] },
  { id: 'microscope', name: 'Microscópio', category: 'laboratorio', kind: 'microscope', width: 1, depth: 1, height: 0.42, rotations: ALL, colors: ['#d6d2c6', '#2a2a2a'] },
  { id: 'flasks', name: 'Frascos', category: 'laboratorio', kind: 'flasks', width: 1, depth: 1, height: 0.25, rotations: ALL, colors: ['#9b1b1b', '#3fae5a', '#3f7fbf'] },

  // ---------- Ocultismo ----------
  { id: 'sigil_floor', name: 'Sigilo Ritualístico', category: 'ocultismo', kind: 'sigil', width: 3, depth: 3, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#7a0d0d'] },
  { id: 'sigil_map', name: 'Mapa do Sigilo', category: 'ocultismo', kind: 'sigil_map', width: 2, depth: 1, height: 0.02, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#cbb994', '#8a1010'] },
  { id: 'blood_pool', name: 'Mancha de Sangue', category: 'ocultismo', kind: 'blood', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#6e0b0b'] },
  { id: 'blood_drops', name: 'Respingos de Sangue', category: 'ocultismo', kind: 'blood_small', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#6e0b0b'] },
  { id: 'monitor_suporte', name: 'Monitor no Suporte', category: 'saude', kind: 'monitor_pe', width: 1, depth: 1, height: 1.45, states: 2, rotations: ALL, colors: ['#e6e8ea', '#4fe39a'], desc: 'O monitor de sinais vitais no pé de rodinhas, com o cesto dos cabos. Clique duplo liga/desliga.' },
  { id: 'monitor_energia', name: 'Monitor Tomado pela Energia', category: 'ocultismo', kind: 'monitor_pe', width: 1, depth: 1, height: 1.6, states: 2, rotations: ALL, colors: ['#2c2433', '#c77dff'], desc: 'Um monitor fundido com outro aparelho, os cabos acesos como veias. Não devia funcionar, e funciona.' },
  { id: 'eletroencefalografo', name: 'Eletroencefalógrafo', category: 'saude', kind: 'aparelho', width: 1, depth: 1, height: 1.3, rotations: ALL, colors: ['#8a8f86', '#ffd060'], desc: 'A touca de eletrodos pendurada no gancho e o papel saindo com as linhas.' },
  { id: 'gravador_rolo', name: 'Gravador de Rolo', category: 'escritorio', kind: 'aparelho', width: 1, depth: 1, height: 0.95, rotations: ALL, colors: ['#3a3530', '#e05040'], desc: 'Os dois rolos parados no meio de uma gravação.' },
  { id: 'camera_tripe', name: 'Câmera no Tripé', category: 'escritorio', kind: 'camera_tripe', width: 1, depth: 1, height: 1.6, rotations: ALL, colors: ['#2a2a2e', '#ff3030'], desc: 'A câmera de fita no tripé, com a luzinha de gravando.' },
  { id: 'corpo_lencol', name: 'Corpo Coberto', category: 'ocultismo', kind: 'corpo', width: 1, depth: 3, height: 0.3, rotations: ALL, colors: ['#d8d0bc', '#6e1a14'], desc: 'Alguém deitado no chão, embaixo de um lençol encardido. Os pés aparecem.' },
  { id: 'corpo_saco', name: 'Saco de Cadáver', category: 'ocultismo', kind: 'corpo', width: 1, depth: 3, height: 0.3, rotations: ALL, colors: ['#1d1d22', '#8a8a90'], desc: 'Um saco de cadáver preto, fechado.' },
  // o calabouço (09/10, arte do Códex): o estrado redondo do altar, a pedra do sacrifício e o que sobrou do laboratório
  // pisável: quem pisa fica em cima dele (0,61 m), e ele se desenha no chão (atrás de quem está em cima); redondo, os
  // quatro cantos da pegada ficam de fora
  { id: 'estrado_altar', name: 'Estrado do Altar', category: 'ocultismo', kind: 'estrado', width: 5, depth: 5, height: 0.61, walkable: true, stackable: true, flat: true, vazio: [[0, 0], [4, 0], [0, 4], [4, 4]], rotations: ALL, colors: ['#2a2630', '#7a0d0d'], desc: 'O estrado redondo de pedra negra do calabouço, com o sigilo nas canaletas e velas e crânios na borda.' },
  { id: 'pedra_sacrificio', name: 'Pedra do Sacrifício', category: 'ocultismo', kind: 'pedra_sacrificio', width: 3, depth: 2, height: 1.0, rotations: ALL, colors: ['#3a3438', '#6e0b0b'], desc: 'A pedra do sacrifício: o tampo côncavo, as argolas e as correntes nas quatro pontas, o sangue seco.' },
  { id: 'tanque_corpo', name: 'Tanque com Corpo', category: 'laboratorio', kind: 'tanque_corpo', width: 2, depth: 2, height: 2.2, rotations: ALL, colors: ['#2b2f33', '#3fe0c0'], desc: 'Um cilindro de vidro grosso, cheio de líquido, com um corpo suspenso lá dentro.' },
  { id: 'mesa_contencao', name: 'Mesa de Contenção', category: 'laboratorio', kind: 'mesa_contencao', width: 2, depth: 3, height: 0.9, vao: 'vazada', aumento: 1.2, rotations: ALL, colors: ['#8a9096', '#3a3d42'], desc: 'Mesa de aço inox com as correias de couro para prender alguém deitado.' },
  { id: 'pilha_cranios', name: 'Pilha de Crânios', category: 'ocultismo', kind: 'pilha_cranios', width: 1, depth: 1, height: 0.45, rotations: ALL, colors: ['#d8cfb8', '#5a4a3a'] },
  { id: 'skull', name: 'Crânio', category: 'ocultismo', kind: 'skull', width: 1, depth: 1, height: 0.3, rotations: ALL, colors: ['#d8cfb8'] },
  { id: 'table_tools', name: 'Mesa das Ferramentas', category: 'ocultismo', kind: 'desk', width: 2, depth: 1, height: 0.78, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#4a3020', '#2e1d12', '#9a7a4a'], desc: 'Mesa rústica com a faca cerimonial, o giz, a tigela, a corda e as velas.' },
  { id: 'books_stack', name: 'Pilha de Livros', category: 'ocultismo', kind: 'books', width: 1, depth: 1, height: 0.4, stackable: true, rotations: ALL, colors: ['#5a2320', '#2f3f5a', '#4a4a2a'] },
  { id: 'bookshelf', name: 'Estante de Livros', category: 'ocultismo', kind: 'bookshelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#3d2819', '#2a1b11'] },

  // ---------- Iluminação ----------
  { id: 'candles', name: 'Velas', category: 'iluminacao', kind: 'candles', width: 1, depth: 1, height: 0.35, states: 2, rotations: ALL, colors: ['#e8dcc0'], desc: 'Clique duplo acende/apaga.' },
  { id: 'candelabra', name: 'Candelabro', category: 'iluminacao', kind: 'candelabra', width: 1, depth: 1, height: 1.6, states: 2, rotations: ALL, colors: ['#8a6a2a', '#e8dcc0'] },
  { id: 'desk_lamp', name: 'Luminária de Mesa', category: 'iluminacao', kind: 'desk_lamp', width: 1, depth: 1, height: 0.45, states: 2, rotations: ALL, colors: ['#2a2a2a', '#ffc46b'] },
  { id: 'floor_lamp', name: 'Luminária de Chão', category: 'iluminacao', kind: 'floor_lamp', width: 1, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#2a2a2a', '#e8c98a'] },

  // ---------- Armazenamento ----------
  { id: 'shelf_metal', name: 'Estante de Metal', category: 'armazenamento', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#3a3d42', '#23262a'] },
  { id: 'estante_vazia', name: 'Estante Vazia', category: 'armazenamento', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#5a6068', '#8a8e92'], desc: 'A estante de aço sem nada: só a poeira e as marcas limpas de onde ficavam as caixas.' },
  { id: 'locker', name: 'Armário de Metal', category: 'armazenamento', kind: 'locker', width: 1, depth: 1, height: 1.95, states: 2, rotations: ALL, colors: ['#3d4148', '#2a2d32'], desc: 'Clique duplo abre a porta.' },
  { id: 'pilha_chao', name: 'Itens no Chão', category: 'armazenamento', kind: 'pilha', width: 1, depth: 1, height: 0.12, walkable: true, interno: true, rotations: [0], colors: ['#5c4630', '#2e241a'], desc: 'O que alguém largou aqui. Quem passar pode pegar.' },
  { id: 'crate_wood', name: 'Caixote de Madeira', category: 'armazenamento', kind: 'crate', width: 1, depth: 1, height: 0.8, states: 2, stackable: true, rotations: ALL, colors: ['#6b4a2e', '#4a321f'], desc: 'Clique duplo abre e fecha.' },
  { id: 'crate_metal', name: 'Caixa Metálica', category: 'armazenamento', kind: 'crate_metal', width: 1, depth: 1, height: 0.8, stackable: true, rotations: ALL, colors: ['#35393f', '#24272b', '#7a6a4a'] },
  { id: 'chest_military', name: 'Baú Militar Grande', category: 'armazenamento', kind: 'chest', width: 2, depth: 1, height: 0.7, stackable: true, rotations: ALL, colors: ['#3e3a2c', '#2a271e', '#8a8060'] },
  { id: 'chest_army', name: 'Baú Militar', category: 'arsenal', kind: 'chest', width: 1, depth: 1, height: 0.45, stackable: true, states: 2, rotations: ALL, colors: ['#5a6a2a', '#2a2d1e', '#8a7a5a'], desc: 'Madeira e metal verde-oliva. Clique duplo abre: coletes e lanternas dentro.' },
  { id: 'ammo_box', name: 'Caixa de Munição', category: 'arsenal', kind: 'crate_metal', width: 1, depth: 1, height: 0.3, states: 2, stackable: true, rotations: ALL, colors: ['#4a5a2a', '#2a2d1e', '#8a7a5a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'barrel', name: 'Barril', category: 'armazenamento', kind: 'barrel', width: 1, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#3a3f2e', '#1f2219'] },

  // ---------- Decoração ----------
  { id: 'plant', name: 'Planta', category: 'decoracao', kind: 'plant', width: 1, depth: 1, height: 1.2, rotations: ALL, colors: ['#2f5a2a', '#3d2a1e'] },
  { id: 'pillar', name: 'Pilar de Concreto', category: 'decoracao', kind: 'pillar', width: 1, depth: 1, height: 2.75, rotations: [0], colors: ['#4a4540'] },
  { id: 'iwall', name: 'Parede Interna', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 2.4, xray: true, rotations: ALL, colors: ['#3b342f'], desc: 'Monte cômodos. Fica transparente quando você passa atrás.' },
  { id: 'parede_orfanato', name: 'Parede Queimada', category: 'estrutura', kind: 'parede_reboco', width: 1, depth: 1, height: 2.4, xray: true, rotations: ALL, colors: ['#8e8472', '#3e2a1c', '#14100c'], desc: 'Parede interna do orfanato: o lambri de madeira embaixo, o reboco em cima, rachada e preta de fuligem. Fica transparente quando você passa atrás.' },
  { id: 'iwall_low', name: 'Divisória Baixa', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 1.3, xray: true, rotations: ALL, colors: ['#4a433c'], desc: 'Meia parede: separa baias sem esconder quem está dentro.' },
  { id: 'stall_panel', name: 'Divisória de Cabine', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 1.6, xray: true, rotations: ALL, colors: ['#c8b89a'], desc: 'Painel de fórmica entre os vasos do banheiro.' },
  { id: 'trash_bin', name: 'Lixeira', category: 'saude', kind: 'crate', width: 1, depth: 1, height: 0.4, rotations: ALL, colors: ['#d8d0c0', '#8a8478'] },
  { id: 'trash_can', name: 'Lixeira de Metal', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#8a8478', '#5a4a3a'], desc: 'Redonda, amassada, de tampa basculante.' },
  { id: 'locker_row', name: 'Armários de Vestiário', category: 'armazenamento', kind: 'locker', width: 2, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#6a6e66', '#3a3d38'], desc: 'Três portas estreitas com cadeado. Clique duplo abre e fecha.' },
  { id: 'janitor_cart', name: 'Carrinho de Limpeza', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 1.1, rotations: ALL, colors: ['#e8c020', '#2a2a2a'], desc: 'Balde, esfregão, borrifadores e o saco de lixo.' },
  { id: 'wet_sign', name: 'Placa de Piso Molhado', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#e8c020', '#2a2a2a'] },
  { id: 'puddle', name: 'Poça de Água', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#5a6a7a', '#8aa0b0'] },
  { id: 'compass_floor', name: 'Rosa dos Ventos', category: 'mobilia', kind: 'rug', width: 3, depth: 3, height: 0.02, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#8a6a2a', '#c9a86a'], desc: 'Gravada em bronze no chão do Salão.' },
  { id: 'iwall_door', name: 'Parede com Vão', category: 'estrutura', kind: 'iwall_door', width: 1, depth: 1, height: 0, walkable: true, xray: true, rotations: ALL, colors: ['#3b342f', '#2a1d14'] },
  { id: 'iwall_window', name: 'Parede com Janela', category: 'estrutura', kind: 'iwall_window', width: 1, depth: 1, height: 2.4, xray: true, rotations: ALL, colors: ['#3b342f', '#2a1d14'] },
  { id: 'orfanato_predio', name: 'Orfanato (queimado)', category: 'fazenda', kind: 'predio_queimado', width: 16, depth: 46, height: 5.4, xray: true, rotations: [0], colors: ['#7e7366', '#3b2a24', '#3a2a20', '#16110e'], desc: 'O prédio comprido do orfanato, de um andar só, queimado: o telhado caído em vários trechos, a fuligem subindo das janelas, a porta da frente carbonizada no fim da ala dos quartos.' },
  { id: 'passagem_aberta', name: 'Passagem Aberta', category: 'estrutura', kind: 'passagem', width: 1, depth: 1, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#000000'], desc: 'Divisão de cena sem porta (o mesmo ambiente, dividido em duas cenas): nada aparece; quem para em cima vai para o cômodo ligado.' },
  { id: 'portal', name: 'Passagem', category: 'estrutura', kind: 'portal', width: 1, depth: 1, height: 0, walkable: true, portal: true, states: 2, openState: 0, rotations: ALL, colors: ['#2a1d14'], desc: 'Pare em cima para ir ao quarto ligado (o mestre escolhe o destino). Clique duplo: aberta, fechada, trancada; fechada ou trancada, ninguém passa.' },
  { id: 'fluorescent', name: 'Luminária Fluorescente', category: 'iluminacao', kind: 'fluorescent', width: 1, depth: 1, height: 0, walkable: true, stackable: true, states: 2, rotations: [0, 2], colors: ['#dff4ff'], desc: 'Luz fria do teto; dá para andar embaixo.' },
  { id: 'ceiling_lamp', name: 'Lâmpada Pendurada', category: 'iluminacao', kind: 'ceiling_lamp', width: 1, depth: 1, height: 0, walkable: true, stackable: true, states: 2, rotations: [0], colors: ['#ffd98a'], desc: 'Fica no teto; dá para andar embaixo.' },
  { id: 'vent', name: 'Grade de Ventilação', category: 'decoracao', kind: 'vent', width: 1, depth: 1, height: 0.02, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#2a2d31'] },

  // ---------- Sede da Ordem ----------
  // escadas (passagens entre andares)
  { id: 'stairs_up', name: 'Escada que Sobe', category: 'estrutura', kind: 'stairs_up', width: 1, depth: 2, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#4a3426', '#2a1d14'], desc: 'Pare em cima para subir ao andar ligado.' },
  { id: 'stairs_down', name: 'Escada Secreta', category: 'estrutura', kind: 'stairs_down', width: 1, depth: 1, height: 0, walkable: true, stackable: true, portal: true, hidden: true, rotations: ALL, colors: ['#3a2a20', '#0c0908'], desc: 'Fica escondida atrás de um mobi com senha; aparece quando ele desliza.' },
  // bar
  { id: 'bar_counter', name: 'Balcão do Bar', category: 'bar', kind: 'bar_counter', width: 2, depth: 1, height: 1.1, stackable: true, rotations: ALL, colors: ['#6a1a16', '#2e1a12', '#b8904a'] },
  { id: 'bar_shelf', name: 'Prateleira de Garrafas', category: 'bar', kind: 'bar_shelf', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#3a2418', '#241610'] },
  { id: 'beer_fridge', name: 'Geladeira Amarela', category: 'bar', kind: 'beer_fridge', width: 1, depth: 1, height: 2.0, rotations: [4, 2], colors: ['#b8901c', '#ffe9a0'], desc: 'Geladeira amarela de porta de vidro, cheia de garrafas. Tem um teclado numérico do lado.' },
  { id: 'fridge_drinks', name: 'Expositor de Bebidas', category: 'bar', kind: 'beer_fridge', width: 1, depth: 1, height: 2.0, states: 2, rotations: [4, 2], colors: ['#26343a', '#cfeaff'], desc: 'Geladeira de porta de vidro, cheia de garrafas. Clique duplo abre e fecha.' },
  { id: 'minibar', name: 'Frigobar', category: 'bar', kind: 'beer_fridge', width: 1, depth: 1, height: 0.9, states: 2, stackable: true, rotations: [4, 2], colors: ['#3a3f44', '#ffe9b0'], desc: 'A geladeirinha de trás do balcão. Clique duplo abre e fecha.' },
  { id: 'pool_table', name: 'Mesa de Sinuca', category: 'bar', kind: 'pool_table', width: 2, depth: 4, height: 0.85, stackable: true, rotations: ALL, colors: ['#3fae4a', '#4a2c1a'] },
  { id: 'jukebox', name: 'Jukebox', category: 'bar', kind: 'jukebox', width: 1, depth: 1, height: 1.6, states: 2, rotations: ALL, colors: ['#3a1a24', '#ff7ab0', '#ffb14a'], desc: 'Clique duplo liga/desliga.' },
  { id: 'arcade', name: 'Feliperama', category: 'bar', kind: 'jukebox', width: 1, depth: 1, height: 1.8, states: 2, rotations: ALL, colors: ['#16123a', '#6a5aff', '#5ad8ff'], desc: 'O Feliperama, o fliperama do bar: a tela ilumina o bar inteiro. Clique duplo liga/desliga; com um agente escolhido, Jogar leva o agente até ele (o jogo abre no celular do jogador quando ele chega).' },
  { id: 'arcade_luta', name: "Felipe's Fight", category: 'bar', kind: 'jukebox', width: 1, depth: 1, height: 1.8, states: 2, rotations: ALL, colors: ['#141014', '#e8602a', '#f0c040'], desc: "O Felipe's Fight, o fliperama de luta: o gabinete preto com as chamas e o painel de dois. Só funciona em dupla: com um agente escolhido, Jogar leva ele até a máquina (o jogo abre no celular do jogador); a luta começa quando chega o segundo." },
  { id: 'beer_crate', name: 'Engradado de Cerveja', category: 'bar', kind: 'crate', width: 1, depth: 1, height: 0.35, stackable: true, rotations: ALL, colors: ['#a8842e', '#5a4020'] },
  { id: 'chair_stack', name: 'Pilha de Cadeiras', category: 'bar', kind: 'crate', width: 1, depth: 1, height: 1.3, rotations: ALL, colors: ['#c99a2e', '#7a5a1a'], desc: 'Cadeiras de plástico empilhadas no canto.' },
  { id: 'bar_cabinet', name: 'Armarinho', category: 'bar', kind: 'nightstand', width: 1, depth: 1, height: 1.0, states: 2, stackable: true, rotations: ALL, colors: ['#4a3020', '#c9a86a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'ashtray', name: 'Cinzeiro', category: 'bar', kind: 'mug', width: 1, depth: 1, height: 0.05, rotations: ALL, colors: ['#8a8a8a'] },
  { id: 'beer_glass', name: 'Copo', category: 'bar', kind: 'mug', width: 1, depth: 1, height: 0.15, rotations: ALL, colors: ['#e8d8a0'] },
  { id: 'stool_bar', name: 'Banqueta de Balcão', category: 'bar', kind: 'stool_high', width: 1, depth: 1, height: 0.75, aumento: 1.2, sit: true, rotations: ALL, colors: ['#6a1a16', '#1d1a18'] },
  { id: 'table_bar', name: 'Mesa de Bar', category: 'bar', kind: 'table', width: 1, depth: 1, height: 0.75, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#b08a3a', '#4a3420'] },
  { id: 'chair_bar', name: 'Cadeira de Bar', category: 'bar', kind: 'chair', width: 1, depth: 1, height: 0.45, aumento: 1.2, sit: true, rotations: ALL, colors: ['#a8842e', '#5a4020'] },
  { id: 'sofa_booth', name: 'Sofá Vermelho', category: 'bar', kind: 'sofa', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#7a1c1a'] },
  { id: 'armchair_red', name: 'Poltrona Vermelha', category: 'bar', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#8a1c1a'] },
  { id: 'sideboard', name: 'Aparador', category: 'bar', kind: 'table_big', width: 2, depth: 1, height: 0.9, states: 2, stackable: true, rotations: ALL, colors: ['#4a3020', '#2e1d12', '#9a7a4a'], desc: 'Aparador de madeira escura, com garrafas e copos em cima. Clique duplo abre e fecha.' },
  { id: 'keg', name: 'Barril de Chope', category: 'bar', kind: 'barrel', width: 1, depth: 1, height: 0.6, stackable: true, rotations: ALL, colors: ['#8a8e92', '#4a4e52'] },
  // dormitório
  { id: 'bed', name: 'Cama de Cela', category: 'mobilia', kind: 'bed', width: 1, depth: 3, height: 0.5, rotations: ALL, colors: ['#5a5a2e', '#2a2622', '#d8d0c0'] },
  { id: 'nightstand', name: 'Criado-Mudo', category: 'mobilia', kind: 'nightstand', width: 1, depth: 1, height: 0.6, states: 2, stackable: true, rotations: ALL, colors: ['#4b3120', '#c9a86a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'bench', name: 'Banco de Madeira', category: 'mobilia', kind: 'bench', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#5a3a24', '#2a1d14'] },
  // salas
  { id: 'sofa_velvet', name: 'Sofá de Veludo', category: 'mobilia', kind: 'sofa', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#8a74c0'] },
  { id: 'rug_purple', name: 'Carpete Roxo', category: 'mobilia', kind: 'rug', width: 3, depth: 4, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#3a1f5a', '#9a7ad0'] },
  { id: 'rug_ornate', name: 'Tapete Persa', category: 'mobilia', kind: 'rug', width: 3, depth: 4, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#6a3016', '#d8a050'] },
  { id: 'table_round', name: 'Mesa Redonda', category: 'mobilia', kind: 'table_round', width: 2, depth: 2, height: 0.76, vao: 'vazada', aumento: 1.2, stackable: true, rotations: [0], colors: ['#5a3a20', '#2a1d14'] },
  { id: 'table_chess', name: 'Mesa de Xadrez', category: 'mobilia', kind: 'table_chess', width: 1, depth: 1, height: 0.74, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#2a2622', '#d8d0c0'] },
  { id: 'armchair', name: 'Poltrona', category: 'mobilia', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#2a2826'] },
  { id: 'chair_red', name: 'Cadeira Estofada', category: 'mobilia', kind: 'chair', width: 1, depth: 1, height: 0.45, aumento: 1.2, sit: true, rotations: ALL, colors: ['#8a1c1a', '#2a1d14'] },
  { id: 'altar', name: 'Altar de Pedra', category: 'ocultismo', kind: 'altar', width: 2, depth: 1, height: 0.6, stackable: true, rotations: ALL, colors: ['#4a4540', '#7a0d0d'], desc: 'Altar baixo de pedra antiga, com cera escorrida e restos de oferendas.' },
  // o escritório do Veríssimo (peças inteiras, 06/10): madeira escura nobre e o vermelho, como um conjunto
  { id: 'shelf_verissimo', name: 'Estante do Veríssimo', category: 'escritorio', kind: 'bookshelf', width: 6, depth: 1, height: 2.6, rotations: ALL, colors: ['#4a2a18', '#2a1810'], desc: 'A estante que pega a parede inteira: livros de couro, pastas da Ordem, um globo, chaves antigas e, dobrado num canto, um pedaço de capuz amarelo.' },
  { id: 'desk_verissimo', name: 'Mesa do Veríssimo', category: 'escritorio', kind: 'desk', width: 3, depth: 2, height: 0.76, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#4a2a18', '#2a1810', '#3f7a3a'], desc: 'A grande mesa de madeira entalhada, cheia de livros, pastas de casos e a luminária verde.' },
  { id: 'chair_verissimo', name: 'Cadeira do Veríssimo', category: 'escritorio', kind: 'armchair', width: 1, depth: 1, height: 0.48, sit: true, rotations: ALL, colors: ['#5a1418', '#4a2a18'], desc: 'Espaldar alto entalhado, couro vinho capitonê e tachas de latão.' },
  { id: 'sofa_verissimo', name: 'Sofá Chesterfield', category: 'escritorio', kind: 'sofa', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#8a1c1a'], desc: 'O sofá vermelho-vivo de couro capitonê, de braços enrolados.' },
  { id: 'armchair_verissimo', name: 'Poltrona das Visitas', category: 'escritorio', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#7a1a18'] },
  { id: 'armor_display', name: 'Armadura de Exposição', category: 'ocultismo', kind: 'pedestal', width: 1, depth: 1, height: 2.0, rotations: ALL, colors: ['#6b6a66', '#3a2a1a'], desc: 'Uma armadura completa num pedestal de madeira escura, com a espada apoiada.' },
  { id: 'vitrine_paranormal', name: 'Vitrine Paranormal', category: 'ocultismo', kind: 'bookshelf', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#4a2a18', '#9fc4d8'], desc: 'Relíquias no veludo vinho: uma máscara estranha, um crânio marcado, uma adaga escura e o pedaço do capuz amarelo.' },
  { id: 'pedestal_relic', name: 'Pedestal da Relíquia', category: 'ocultismo', kind: 'pedestal', width: 1, depth: 1, height: 1.3, rotations: ALL, colors: ['#2e2a2a', '#c23a2a'], desc: 'Mármore escuro e uma redoma de vidro com uma relíquia paranormal dentro.' },
  { id: 'rug_aubusson', name: 'Tapete Aubusson', category: 'mobilia', kind: 'rug', width: 4, depth: 3, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#8a3a4a', '#d8c8a0'] },
  { id: 'pedestal', name: 'Pedestal com Tigela', category: 'ocultismo', kind: 'pedestal', width: 1, depth: 1, height: 1.0, rotations: ALL, colors: ['#3a3532', '#a8843a'], desc: 'Pedestal estreito de pedra com uma tigela de bronze cheia de cinzas.' },
  { id: 'wax_pool', name: 'Poça de Cera', category: 'ocultismo', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#d8c8a0', '#8a6a3a'], desc: 'Cera derretida no chão, com tocos de vela caídos.' },
  { id: 'sigil_gold', name: 'Selo Dourado', category: 'ocultismo', kind: 'sigil', width: 3, depth: 3, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#b8903a'] },
  // banheiro e enfermaria
  { id: 'toilet', name: 'Vaso Sanitário', category: 'saude', kind: 'toilet', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#e8e4dc'] },
  { id: 'toilet_steel', name: 'Vaso de Aço', category: 'saude', kind: 'toilet', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#9aa0a6'], desc: 'Aço inox de prisão, com a pia em cima.' },
  { id: 'food_tray', name: 'Bandeja de Comida', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 0.1, stackable: true, rotations: ALL, colors: ['#9aa0a6', '#8a6a3a'], desc: 'Restos de comida e uma caneca de lata.' },
  { id: 'drain', name: 'Ralo', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#3a3226', '#5a6a6a'] },
  { id: 'sink', name: 'Pia', category: 'saude', kind: 'sink', width: 1, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#e8e4dc', '#8a9098'] },
  // a cortina do leito, inteira (06/10): o leito e o soro ficam dentro (as casas vazias). Desde 07/10 o
  // lado de dentro é todo chão (dá para andar em volta do leito); só a fileira da frente é a cortina, que
  // fechada não deixa passar e aberta deixa
  // a van da Viagem (07/10): só o jogo põe (não aparecem no catálogo). Os bancos olham para a frente do veículo (+x, giro 2)
  { id: 'van_seat', name: 'Banco da Van', category: 'mobilia', kind: 'van_seat', width: 1, depth: 1, height: 0.5, sit: true, interno: true, rotations: [2], colors: ['#3a3a44', '#55555f'] },
  { id: 'van_console', name: 'Console da Van', category: 'mobilia', kind: 'van_console', width: 1, depth: 1, height: 0.45, interno: true, rotations: [2], colors: ['#1b1b1f', '#34343c'] },
  { id: 'van_dash', name: 'Painel da Van', category: 'mobilia', kind: 'van_dash', width: 3, depth: 1, height: 0.55, xray: true, interno: true, rotations: [6], colors: ['#1b1b1f', '#34343c'] },
  { id: 'bed_curtain', name: 'Cortina do Leito', category: 'saude', kind: 'divider', width: 3, depth: 4, height: 2.2, states: 2, openState: 1, xray: true, vazio: [0, 1, 2].flatMap((u) => [0, 1, 2].map((v) => [u, v] as [number, number])), aberto: ['fundo'], rotations: ALL, colors: ['#a8d0b8', '#9aa0a8'], desc: 'O trilho em U com a cortina verde-clara, com espaço para andar em volta do leito. Fechada, a frente fica cerrada; aberta, a cortina fica franzida nos cantos de trás.' },
  { id: 'hospital_bed', name: 'Leito Hospitalar', category: 'saude', kind: 'hospital_bed', width: 1, depth: 3, height: 0.7, rotations: ALL, colors: ['#7fb88a', '#c9ccd0'] },
  { id: 'iv_stand', name: 'Suporte de Soro', category: 'saude', kind: 'iv_stand', width: 1, depth: 1, height: 1.9, rotations: ALL, colors: ['#9aa0a8', '#d8e8f0'] },
  { id: 'medical_cabinet', name: 'Armário de Remédios', category: 'saude', kind: 'medical_cabinet', width: 2, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#d8dcdf', '#b3261e'], desc: 'Clique duplo abre e fecha.' },
  { id: 'divider', name: 'Divisória Hospitalar', category: 'saude', kind: 'divider', width: 1, depth: 1, height: 1.6, xray: true, rotations: ALL, colors: ['#c9d4c8', '#8a9098'] },
  // arsenal
  { id: 'weapon_rack', name: 'Armário de Armas', category: 'arsenal', kind: 'weapon_rack', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#2a2d31', '#1a1c1f'] },
  { id: 'gun_table', name: 'Bancada de Armas', category: 'arsenal', kind: 'table_big', width: 3, depth: 1, height: 0.9, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#2a3a2a', '#1f2219', '#6a7a5a'] },
  { id: 'locker_ammo', name: 'Armário de Munição', category: 'arsenal', kind: 'locker', width: 1, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#5a6a3a', '#2a2d1e'], desc: 'Aço verde-oliva com cadeado. Clique duplo abre: caixas de munição e carregadores.' },
  { id: 'stool_metal', name: 'Banqueta Giratória', category: 'arsenal', kind: 'stool', width: 1, depth: 1, height: 0.7, aumento: 1.2, sit: true, rotations: ALL, colors: ['#8a5a3a', '#5a6a3a'] },
  { id: 'oil_stain', name: 'Mancha de Óleo', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#1a1a14', '#3a3a2a'] },
  // depósito
  { id: 'rubble', name: 'Entulho', category: 'armazenamento', kind: 'rubble', width: 2, depth: 2, height: 0.5, rotations: ALL, colors: ['#5a5550', '#4a3222'] },
  // o incêndio (09/10, o Orfanato): a fuligem e as cinzas no chão, os escombros queimados e a viga do telhado que caiu
  { id: 'fuligem', name: 'Fuligem', category: 'decoracao', kind: 'blood', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#120e0b'] },
  { id: 'cinzas', name: 'Cinzas', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#2a2622', '#7a746c'] },
  { id: 'escombros', name: 'Escombros Queimados', category: 'armazenamento', kind: 'escombros', width: 2, depth: 2, height: 0.6, rotations: ALL, colors: ['#4a4440', '#1a110a', '#6a3226'], desc: 'O teto que desabou no incêndio: telha, reboco e madeira carbonizada.' },
  { id: 'viga_queimada', name: 'Viga Queimada', category: 'armazenamento', kind: 'viga', width: 1, depth: 3, height: 0.3, rotations: ALL, colors: ['#22160e', '#d8642a'], desc: 'Uma viga do telhado que caiu no incêndio, ainda com brasas nas rachaduras.' },
  // o covil dos transtornados (09/10, o Orfanato; LR p. 303): eles moram onde invadem, e o lugar vira casa de tortura
  { id: 'fogueira', name: 'Fogueira', category: 'iluminacao', kind: 'fogueira', width: 2, depth: 2, height: 0.6, states: 2, rotations: [0], colors: ['#4a4440', '#2a1a10'], desc: 'Uma fogueira acesa no chão, numa roda de pedras. Clique duplo acende/apaga.' },
  { id: 'cama_queimada', name: 'Cama Queimada', category: 'mobilia', kind: 'bed', width: 1, depth: 3, height: 0.5, rotations: ALL, colors: ['#4a3a30', '#1c1410', '#6a5a48'], desc: 'Uma cama de ferro do orfanato, retorcida pelo fogo, com o colchão chamuscado.' },
  { id: 'catre', name: 'Caminha de Pano', category: 'mobilia', kind: 'bed', width: 1, depth: 3, height: 0.4, rotations: ALL, colors: ['#b3a68d', '#4a3a2c', '#d6ccb8'], desc: 'Uma caminha simples de lona num estrado de madeira, da enfermaria das crianças.' },
  { id: 'colchao_chao', name: 'Colchão no Chão', category: 'mobilia', kind: 'colchao', width: 1, depth: 2, height: 0.14, rotations: ALL, colors: ['#7a6e58', '#4a1010'], desc: 'Um colchão largado no chão, afundado e encardido de sangue. Alguém dorme aqui.' },
  { id: 'gancho_carne', name: 'Ganchos de Carne', category: 'ocultismo', kind: 'gancho', width: 1, depth: 2, height: 1.9, rotations: ALL, colors: ['#3a3430', '#8a3a30'], desc: 'Uma travessa de ferro com ganchos de açougue. O que está pendurado neles não é de boi.' },
  { id: 'console', name: 'Bancada de Computadores', category: 'escritorio', kind: 'console', width: 2, depth: 1, height: 0.78, stackable: true, states: 2, rotations: ALL, colors: ['#2e2a36', '#8a78c0', '#7fd0ff'], desc: 'Dois monitores e teclado. Clique duplo liga/desliga.' },
  // a Sala de Tecnologia cheia e o posto da enfermaria (09/10, arte do Códex)
  { id: 'cadeira_gamer', name: 'Cadeira Gamer', category: 'escritorio', kind: 'chair', width: 1, depth: 1, height: 1.32, aumento: 1.2, rotations: ALL, colors: ['#3a1a5a', '#141418'] },
  { id: 'rack_moderno', name: 'Rack de Servidores Moderno', category: 'escritorio', kind: 'server', width: 1, depth: 2, height: 2.0, rotations: ALL, colors: ['#141418', '#3fd0ff'] },
  { id: 'lixeira_lanches', name: 'Lixeira Transbordando', category: 'escritorio', kind: 'lixeira_lanches', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#3a3d42', '#e0a040'] },
  { id: 'torre_crt', name: 'Torre de Monitores CRT', category: 'escritorio', kind: 'torre_crt', width: 2, depth: 1, height: 1.8, rotations: ALL, colors: ['#c8c0a8', '#5ad8ff'], desc: 'Seis monitores de tubo empilhados e um videocassete, todos ligados.' },
  { id: 'bancada_eletronica', name: 'Bancada de Eletrônica', category: 'escritorio', kind: 'bancada_eletronica', width: 2, depth: 1, height: 0.95, rotations: ALL, colors: ['#7a5a3a', '#3a3d42'], desc: 'Tampo de madeira gasto, ferro de solda fumegando, a lupa com luz presa na borda.' },
  { id: 'mesa_holografica', name: 'Mesa Holográfica', category: 'escritorio', kind: 'mesa_holografica', width: 2, depth: 2, height: 1.0, states: 2, rotations: ALL, colors: ['#1a1d24', '#5ad8ff'], desc: 'Uma mesa redonda que projeta um mapa no ar. Clique duplo liga e desliga.' },
  { id: 'frigobar_energetico', name: 'Frigobar de Energético', category: 'escritorio', kind: 'frigobar', width: 1, depth: 1, height: 0.9, rotations: ALL, colors: ['#141418', '#7aff5a'] },
  { id: 'posto_enfermagem', name: 'Posto de Enfermagem', category: 'saude', kind: 'posto_enfermagem', width: 7, depth: 3, height: 1.1, rotations: ALL, colors: ['#e0dccc', '#5a7a8a'], desc: 'O balcão do posto de enfermagem, inteiro, com o computador em cima.' },
  { id: 'server_rack', name: 'Rack de Servidores', category: 'escritorio', kind: 'locker', width: 1, depth: 1, height: 2.0, rotations: ALL, colors: ['#1d1d20', '#4fe39a'], desc: 'Armário de metal com os servidores piscando.' },
  { id: 'printer_dot', name: 'Impressora Matricial', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 1.0, rotations: ALL, colors: ['#d8ccb0', '#6a6e74'], desc: 'Papel contínuo caindo na frente.' },
  { id: 'whiteboard', name: 'Quadro Branco', category: 'escritorio', kind: 'crate', width: 3, depth: 1, height: 1.8, rotations: ALL, colors: ['#e8e4dc', '#8a8f96'], desc: 'De rodinhas, cheio de setas e círculos.' },
  { id: 'media_shelf', name: 'Estante de Mídias', category: 'escritorio', kind: 'crate', width: 2, depth: 1, height: 1.1, rotations: ALL, colors: ['#8a8f96', '#2a2a2a'], desc: 'Fitas VHS, disquetes e caixas.' },
  { id: 'water_cooler', name: 'Bebedouro', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 1.2, rotations: ALL, colors: ['#d8d0c0', '#3f7fd8'] },
  { id: 'parts_boxes', name: 'Caixas de Componentes', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 0.5, rotations: ALL, colors: ['#b8864e', '#2a2a2a'], desc: 'Caixas de papelão abertas com cabos, peças e um teclado velho.' },
  { id: 'ups', name: 'Nobreak e Estabilizador', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 0.3, stackable: true, rotations: ALL, colors: ['#1d1d20', '#d8d0c0'] },
  { id: 'cables_floor', name: 'Cabos no Chão', category: 'decoracao', kind: 'dirt', width: 3, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#1a1a1a', '#d8c8a0'] },
  { id: 'table_work', name: 'Mesa de Trabalho', category: 'escritorio', kind: 'table_big', width: 3, depth: 2, height: 0.76, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#1d1c20', '#141316', '#3a3a42'] },
  { id: 'counter_wood', name: 'Balcão de Madeira', category: 'mobilia', kind: 'table_big', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#4a3020', '#2e1d12', '#9a7a4a'] },
  // a loja da Agatha (09/10, o teste do Códex; o resto da loja vem depois)
  { id: 'balcao_loja', name: 'Balcão da Loja', category: 'mobilia', kind: 'counter', width: 6, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#5a3a24', '#c9a86a'], desc: 'O balcão comprido de madeira escura da loja da Agatha.' },
  { id: 'estante_frascos', name: 'Estante de Frascos', category: 'mobilia', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#4a3020', '#7ad0a0'], desc: 'Seis prateleiras de boticário: frascos, potes, ervas e coisas em conserva.' },
  { id: 'armchair_leather', name: 'Poltrona de Couro', category: 'mobilia', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#5a2e1c'] },
  { id: 'dirt', name: 'Sujeira', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#2a1d12', '#8a7a5a'] },
  // prisão
  { id: 'cell_bars', name: 'Grade de Cela', category: 'estrutura', kind: 'bars', width: 1, depth: 1, height: 2.2, rotations: ALL, colors: ['#3a3d42', '#1c1d20'] },
  { id: 'cell_wall', name: 'Divisória de Cela', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 1.3, xray: true, rotations: ALL, colors: ['#6a6e66', '#3a3d38'], desc: 'Meia parede de concreto entre as celas.' },
  { id: 'cell_door', name: 'Porta de Cela', category: 'estrutura', kind: 'cell_door', width: 1, depth: 1, height: 0, states: 2, openState: 1, cela: true, rotations: ALL, colors: ['#3a3d42', '#1c1d20', '#8a7a4a'], desc: 'Clique duplo abre/fecha. Fechada, ninguém passa.' },
  { id: 'cell_front', name: 'Parede de Cela', category: 'estrutura', kind: 'cell_front', width: 1, depth: 1, height: 2.2, xray: true, rotations: ALL, colors: ['#6a6e66', '#3a3d38'], desc: 'Parede de concreto da cela, inteira (no lugar da grade): fechada, não se vê o que tem dentro.' },
  { id: 'porta_quarto', name: 'Porta do Quarto', category: 'estrutura', kind: 'porta_quarto', width: 1, depth: 1, height: 0, states: 2, openState: 1, cela: true, xray: true, rotations: ALL, colors: ['#4a3324', '#1e1510', '#6e0c0c'], desc: 'A porta de madeira de um quartinho, chamuscada. Clique duplo abre/fecha. Fechada, ninguém passa e o quarto fica no escuro; aberta, acende e a parede da frente fica transparente.' },
  { id: 'cell_door_steel', name: 'Porta de Aço da Cela', category: 'estrutura', kind: 'cell_door_steel', width: 1, depth: 1, height: 0, states: 2, openState: 1, cela: true, xray: true, rotations: ALL, colors: ['#555a60', '#1c1d20', '#8a7a4a'], desc: 'Clique duplo abre/fecha. Fechada, ninguém passa e a cela fica no escuro; aberta, acende e a parede da frente fica transparente.' },

  // ---------- Fazenda (ao ar livre) ----------
  // os prédios vistos de fora: a porta deles é uma Entrada na frente (que leva para dentro)
  { id: 'casarao', name: 'Casarão', category: 'fazenda', kind: 'casarao', width: 14, depth: 9, height: 6.5, xray: true, states: 2, rotations: ALL, colors: ['#d9cbb0', '#8c3b26', '#4a3020', '#26323a'], desc: 'A casa grande, de dois andares, com a varanda na frente.' },
  { id: 'celeiro', name: 'Celeiro', category: 'fazenda', kind: 'celeiro', width: 12, depth: 8, height: 6.5, xray: true, states: 2, rotations: ALL, colors: ['#7c2f22', '#3e2e26', '#e2d8c4', '#4a2418'], desc: 'Baias, feno e a carroça.' },
  { id: 'galpao', name: 'Casa de Mantimentos', category: 'fazenda', kind: 'galpao', width: 8, depth: 6, height: 4.6, xray: true, states: 2, rotations: ALL, colors: ['#8a6a46', '#5e3424', '#3a281a', '#2b2622'], desc: 'Depósito de mantimentos e ferramentas, com o escritório do capataz.' },
  { id: 'entrada_larga', name: 'Entrada Larga', category: 'fazenda', kind: 'entrada', width: 2, depth: 1, height: 0.02, walkable: true, portal: true, flat: true, rotations: ALL, colors: ['#7a6448'], desc: 'A entrada de um prédio, com a porta larga: pare em cima para entrar.' },
  { id: 'entrada', name: 'Entrada', category: 'fazenda', kind: 'entrada', width: 1, depth: 1, height: 0.02, walkable: true, portal: true, flat: true, rotations: ALL, colors: ['#7a6448'], desc: 'Pare em cima para entrar no lugar ligado (o mestre escolhe o destino).' },
  { id: 'porteira', name: 'Porteira', category: 'fazenda', kind: 'porteira', width: 3, depth: 1, height: 0, portal: true, states: 2, openState: 1, rotations: ALL, colors: ['#7a5a3a', '#3a2a1c'], desc: 'Aberta, quem para em cima sai para o lugar ligado. Clique duplo abre e fecha.' },
  { id: 'cerca', name: 'Cerca de Madeira', category: 'fazenda', kind: 'cerca', width: 1, depth: 1, height: 1.1, rotations: ALL, colors: ['#7a5a3a', '#4a3424'] },
  { id: 'arvore', name: 'Árvore', category: 'fazenda', kind: 'arvore', width: 1, depth: 1, height: 5.5, xray: true, rotations: ALL, colors: ['#35602c', '#4a3222'] },
  { id: 'arbusto', name: 'Arbusto', category: 'fazenda', kind: 'arbusto', width: 1, depth: 1, height: 0.9, rotations: ALL, colors: ['#3d6a30', '#2a4a22'] },
  { id: 'fonte', name: 'Fonte', category: 'fazenda', kind: 'fonte', width: 3, depth: 3, height: 1.6, rotations: ALL, colors: ['#b8b0a0', '#4a7a8a'] },
  { id: 'milharal', name: 'Milharal', category: 'fazenda', kind: 'plantacao', width: 1, depth: 1, height: 1.9, xray: true, rotations: ALL, colors: ['#6a8a3a', '#c8b04a'], desc: 'Milho mais alto que gente.' },
  { id: 'horta', name: 'Canteiro', category: 'fazenda', kind: 'plantacao', width: 1, depth: 1, height: 0.45, rotations: ALL, colors: ['#4a7a34', '#8a5a3a'] },
  { id: 'feno', name: 'Fardo de Feno', category: 'fazenda', kind: 'feno', width: 1, depth: 1, height: 0.5, stackable: true, rotations: ALL, colors: ['#c8a85a', '#8a7038'] },
  { id: 'alcapao', name: 'Alçapão', category: 'fazenda', kind: 'alcapao', width: 1, depth: 1, height: 0, walkable: true, stackable: true, portal: true, hidden: true, rotations: ALL, colors: ['#6a4a2c', '#070505'], desc: 'O alçapão escondido no chão: aparece quando o que está em cima dele sai do lugar. Pare em cima para descer.' },
  { id: 'escada_vertical', name: 'Escada de Mão', category: 'fazenda', kind: 'escada_vertical', width: 1, depth: 1, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#6a4a2c', '#e8c070'], desc: 'A escada de mão presa na parede, subindo reto até o alçapão no teto. Pare nela para subir.' },
  { id: 'sacas', name: 'Sacas de Grão', category: 'fazenda', kind: 'sacas', width: 1, depth: 1, height: 0.7, rotations: ALL, colors: ['#d8ccaa', '#8a7a5a'] },
  { id: 'carroca', name: 'Carroça', category: 'fazenda', kind: 'carroca', width: 2, depth: 3, height: 1.2, rotations: ALL, colors: ['#7a5a3a', '#3a2a1c'] },
  { id: 'placa', name: 'Placa', category: 'fazenda', kind: 'placa', width: 1, depth: 1, height: 1.8, rotations: ALL, colors: ['#8a6a44', '#3a2a1c'], desc: 'Placa de madeira com o caminho escrito à mão.' },
  { id: 'baia', name: 'Cerca da Baia', category: 'fazenda', kind: 'cerca', width: 1, depth: 1, height: 1.4, xray: true, rotations: ALL, colors: ['#6a4a2e', '#3a2a1c'] },

  // ---------- Casa ----------
  { id: 'cama_casal', name: 'Cama de Casal', category: 'casa', kind: 'bed', width: 2, depth: 3, height: 0.55, rotations: ALL, colors: ['#7a2e2a', '#4a3020', '#e2dccc'] },
  { id: 'cama_solteiro', name: 'Cama de Solteiro', category: 'casa', kind: 'bed', width: 1, depth: 3, height: 0.55, rotations: ALL, colors: ['#3e5a7a', '#5a3a24', '#e2dccc'] },
  { id: 'beliche', name: 'Beliche', category: 'casa', kind: 'beliche', width: 1, depth: 3, height: 1.85, sit: true, leitos: [0.55, 1.52], rotations: ALL, colors: ['#3e5a7a', '#5a3a24', '#e2dccc'], desc: 'Duas camas de solteiro empilhadas, com a escadinha no pé. A peça fica na de baixo; para a de cima, "Na cama de cima" (a escalada).' },
  { id: 'guarda_roupa', name: 'Guarda-roupa', category: 'casa', kind: 'armario', width: 2, depth: 1, height: 2.0, states: 2, rotations: ALL, colors: ['#5a3a24', '#c9a86a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'comoda', name: 'Cômoda', category: 'casa', kind: 'armario', width: 2, depth: 1, height: 0.9, states: 2, stackable: true, rotations: ALL, colors: ['#6a4428', '#c9a86a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'armario_cozinha', name: 'Armário de Cozinha', category: 'casa', kind: 'armario', width: 2, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#e2d6bc', '#5a4a3a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'armario_cozinha_l', name: 'Armário de Cozinha em L', category: 'casa', kind: 'armario', width: 2, depth: 3, height: 1.9, states: 2, vazio: [[1, 1], [1, 2]], rotations: ALL, colors: ['#e2d6bc', '#5a4a3a'], desc: 'O armário do canto da cozinha, num móvel só: o braço do fundo e o da esquerda com o balcão contínuo e o louceiro em cima. Clique duplo abre e fecha.' },
  { id: 'fogao_lenha', name: 'Fogão a Lenha', category: 'casa', kind: 'fogao', width: 2, depth: 1, height: 0.85, states: 2, rotations: ALL, colors: ['#c8bca4', '#2a2420'], desc: 'Clique duplo acende/apaga.' },
  { id: 'pia_cozinha', name: 'Pia de Cozinha', category: 'casa', kind: 'pia_cozinha', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#e2d6bc', '#9aa4a8'] },
  { id: 'mesa_jantar', name: 'Mesa de Jantar', category: 'casa', kind: 'mesa', width: 4, depth: 2, height: 0.76, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#6a4428', '#4a2e1a'] },
  { id: 'mesa_cozinha', name: 'Mesa da Cozinha', category: 'casa', kind: 'mesa', width: 3, depth: 2, height: 0.76, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#9a7448', '#6a4a2e'] },
  { id: 'banheira', name: 'Banheira', category: 'casa', kind: 'banheira', width: 1, depth: 2, height: 0.6, rotations: ALL, colors: ['#ece6da', '#b8a070'] },
  { id: 'prateleira', name: 'Prateleira de Madeira', category: 'casa', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#7a5a3a', '#4a3424'] },
  { id: 'estante_utensilios', name: 'Estante de Utensílios', category: 'casa', kind: 'shelf', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#7a5232', '#9aa0a8'], desc: 'A estante de tábuas da sala de utensílios: panelas empilhadas, frigideiras, pratos, canecas, bules e potes.' },
  { id: 'escada_desce', name: 'Escada que Desce', category: 'casa', kind: 'escada_desce', width: 1, depth: 2, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#6a4a2e', '#1a1410'], desc: 'O vão da escada, com o corrimão: pare em cima para descer (o mestre escolhe o destino).' },
  // Santo Berço (14/10): a vila medieval em volta do Labirinto Infinito (docs/SANTO-BERCO.md); arte em pixel por código
  { id: 'casa_vila', name: 'Casa', category: 'vila', kind: 'predio_vila', semNome: true, width: 6, depth: 5, height: 5.0, xray: true, rotations: ALL, colors: ['#d8c8a4', '#9a2f22', '#5a3a24', '#2a2018'], desc: 'Casinha medieval de enxaimel, paredes de taipa clara e telhado vermelho de telha.' },
  { id: 'taverna_predio', name: 'Taverna', category: 'vila', kind: 'predio_vila', width: 10, depth: 7, height: 6.0, xray: true, rotations: ALL, colors: ['#cdb894', '#8e2a1e', '#4a3020', '#2a2018'], desc: 'A taverna da vila: dois pisos de enxaimel, a placa pendurada na frente e a luz vermelha dos cristais na janela.' },
  { id: 'ferraria_predio', name: 'Ferraria', category: 'vila', kind: 'predio_vila', width: 8, depth: 6, height: 5.0, xray: true, rotations: ALL, colors: ['#8a8278', '#8e2a1e', '#3a2a1e', '#e0602a'], desc: 'A ferraria de pedra com a chaminé larga e o alpendre aberto da forja.' },
  { id: 'hotel_predio', name: 'Hotel', category: 'vila', kind: 'predio_vila', width: 10, depth: 8, height: 7.5, xray: true, rotations: ALL, colors: ['#d4c4a0', '#8e2a1e', '#4a3020', '#2a2018'], desc: 'O hotel de dois andares, com a varanda de madeira em cima da porta.' },
  { id: 'casa_doutor', name: 'Casa do Doutor', category: 'vila', kind: 'predio_vila', width: 10, depth: 8, height: 7.0, xray: true, rotations: ALL, colors: ['#c8bca4', '#7a2a22', '#3a2a20', '#2a2018'], desc: 'O casarão do Doutor, de pedra e madeira, o consultório no térreo.' },
  { id: 'torre_porteiro', name: 'Torre do Porteiro', category: 'vila', kind: 'predio_vila', width: 4, depth: 4, height: 9.0, xray: true, rotations: ALL, colors: ['#9a9284', '#8e2a1e', '#3a2a1e', '#e04a2a'], desc: 'A torre redonda de pedra na entrada da vila, como um farol, com o cristal vermelho aceso no alto.' },
  { id: 'portao_vila', name: 'Portão da Vila', category: 'vila', kind: 'portao_vila', width: 4, depth: 1, height: 4.5, walkable: true, xray: true, rotations: ALL, colors: ['#6a4a2c', '#3a2a1c'], desc: 'O arco de troncos no fim da estrada, a entrada de Santo Berço.' },
  { id: 'estatua_guardiao', name: 'Estátua de Guardião', category: 'vila', kind: 'estatua', width: 2, depth: 2, height: 3.6, xray: true, rotations: ALL, colors: ['#8a8680', '#4a4640'], desc: 'Uma das estátuas dos Cinco Guardiões em volta do Labirinto: pedra gasta, coberta de musgo, o rosto apagado.' },
  { id: 'poste_cristal', name: 'Poste de Cristal', category: 'vila', kind: 'luz_cristal', width: 1, depth: 1, height: 2.6, states: 2, rotations: ALL, colors: ['#3a2a1e', '#ff5a3a'], desc: 'O poste de madeira com um cristal vermelho na ponta: a luz (e o calor) da vila. Clique duplo cobre e descobre.' },
  { id: 'cristal_vermelho', name: 'Cristal Vermelho', category: 'vila', kind: 'luz_cristal', width: 1, depth: 1, height: 0.9, states: 2, rotations: ALL, colors: ['#6a1a14', '#ff5a3a'], desc: 'Cristal de calor e luz; os grandes são quentes como lava.' },
  { id: 'cristal_verde', name: 'Cristal Verde', category: 'vila', kind: 'luz_cristal', width: 1, depth: 1, height: 0.9, states: 2, rotations: ALL, colors: ['#1a5a2a', '#5aff8a'], desc: 'Cristal de cura: fecha ferida na hora; na boca, anestesia. Brilha menos conforme gasta.' },
  { id: 'cristal_azul', name: 'Cristal Azul', category: 'vila', kind: 'luz_cristal', width: 1, depth: 1, height: 0.9, states: 2, rotations: ALL, colors: ['#1a3a6a', '#6ac8ff'], desc: 'Cristal de frio extremo: a geladeira da vila.' },
  { id: 'cristal_preto', name: 'Cristal Preto', category: 'vila', kind: 'cristal_preto', width: 1, depth: 1, height: 1.1, rotations: ALL, colors: ['#121016', '#5a4a6a'], desc: 'O cristal da Provação: quem toca vira Luzidio. Só existe nas minas.' },
  { id: 'lodo_preto', name: 'Poça de Lodo Preto', category: 'vila', kind: 'lodo', width: 2, depth: 2, height: 0.02, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#0a080c', '#3a2a4a'], desc: 'Lodo preto, brilhante e hipnótico: atrai quem olha e solta tentáculos se ameaçado.' },
  { id: 'sebe', name: 'Sebe do Labirinto', category: 'vila', kind: 'sebe', width: 1, depth: 1, height: 2.4, xray: true, rotations: ALL, colors: ['#3a5a3a', '#6a3a7a'], desc: 'A parede viva do Labirinto Infinito: folhas escuras com flores roxas, que mudam de lugar.' },
  { id: 'arvore_retorcida', name: 'Árvore Retorcida', category: 'vila', kind: 'arvore', width: 1, depth: 1, height: 5.0, xray: true, rotations: ALL, colors: ['#7a3a8a', '#3a2a22'], desc: 'Árvore de tronco torto e copa de cor estranha (roxa, amarela ou azulada).' },
  { id: 'arbusto_estranho', name: 'Arbusto Estranho', category: 'vila', kind: 'arbusto', width: 1, depth: 1, height: 0.9, rotations: ALL, colors: ['#8a6a2a', '#4a3a6a'] },
  { id: 'poco', name: 'Poço', category: 'vila', kind: 'poco', width: 2, depth: 2, height: 1.4, rotations: ALL, colors: ['#8a8278', '#4a3020'], desc: 'O poço de pedra com o sarilho de madeira e o balde.' },
  { id: 'pedras', name: 'Pedras', category: 'vila', kind: 'rubble', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#7a7468', '#4a463e'] },
  { id: 'forja', name: 'Forja', category: 'vila', kind: 'forja', width: 3, depth: 2, height: 1.4, states: 2, rotations: ALL, colors: ['#5a524a', '#ff7a2a'], desc: 'A forja de pedra com o fole de couro e as brasas acesas (um cristal vermelho no meio do carvão). Clique duplo acende/apaga.' },
  { id: 'bigorna', name: 'Bigorna', category: 'vila', kind: 'bigorna', width: 1, depth: 1, height: 0.85, stackable: true, rotations: ALL, colors: ['#3a3a40', '#5a3a24'], desc: 'A bigorna num toco de madeira, com o martelo e a tenaz.' },
  { id: 'rack_medieval', name: 'Armas Medievais', category: 'vila', kind: 'rack_medieval', width: 2, depth: 1, height: 1.9, rotations: ALL, colors: ['#5a3a24', '#a8a8b0'], desc: 'O suporte de madeira com espadas, machados e arcos.' },
  { id: 'armadura_medieval', name: 'Armadura', category: 'vila', kind: 'pedestal', width: 1, depth: 1, height: 1.9, rotations: ALL, colors: ['#8a8a90', '#4a3020'], desc: 'Uma armadura de placas num cavalete, com o escudo de lado.' },
  { id: 'tina_agua', name: 'Tina de Têmpera', category: 'vila', kind: 'tina', width: 1, depth: 1, height: 0.7, rotations: ALL, colors: ['#5a3a24', '#2a3a4a'], desc: 'A tina de madeira com água para temperar o ferro.' },
  { id: 'mesa_rustica', name: 'Mesa Rústica', category: 'vila', kind: 'mesa', width: 3, depth: 2, height: 0.8, vao: 'vazada', stackable: true, rotations: ALL, colors: ['#6a4a2c', '#3a2a1c'], desc: 'Mesa comprida de tábuas grossas, marcada de faca e de caneca.' },
  { id: 'banco_rustico', name: 'Banco Rústico', category: 'vila', kind: 'bench', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#6a4a2c', '#3a2a1c'] },
  { id: 'balcao_taverna', name: 'Balcão da Taverna', category: 'vila', kind: 'counter', width: 4, depth: 1, height: 1.05, stackable: true, rotations: ALL, colors: ['#5a3a24', '#3a2a1c'], desc: 'O balcão de madeira escura com as canecas de estanho e a jarra.' },
  { id: 'barril_madeira', name: 'Barril de Madeira', category: 'vila', kind: 'barrel', width: 1, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#7a5232', '#3a3a3a'], desc: 'Barril de aduelas com aros de ferro.' },
  { id: 'lareira', name: 'Lareira', category: 'vila', kind: 'lareira', width: 3, depth: 1, height: 2.0, states: 2, rotations: ALL, colors: ['#7a7268', '#ff6a2a'], desc: 'A lareira de pedra encostada na parede, com o caldeirão pendurado. Clique duplo acende/apaga.' },
  // Santo Berço não tem fogo (16/10): as mesmas peças com os cristais vermelhos no lugar da lenha e da brasa
  { id: 'lareira_cristal', name: 'Lareira de Cristal', category: 'vila', kind: 'lareira', width: 3, depth: 1, height: 2.0, states: 2, rotations: ALL, colors: ['#7a7268', '#ff4a32'], desc: 'A lareira de pedra de Santo Berço: os cristais vermelhos entre os cães de ferro esquentam o caldeirão. Clique duplo acende/apaga.' },
  { id: 'forja_cristal', name: 'Forja de Cristal', category: 'vila', kind: 'forja', width: 3, depth: 2, height: 1.4, states: 2, rotations: ALL, colors: ['#5a524a', '#ff4a32'], desc: 'A forja de Santo Berço: na cova, as pedras escuras e o monte de cristais vermelhos, quentes como lava. Clique duplo acende/apaga.' },
  { id: 'fogao_cristal', name: 'Fogão de Cristal', category: 'vila', kind: 'fogao', width: 2, depth: 1, height: 0.85, states: 2, rotations: ALL, colors: ['#c8bca4', '#2a2420'], desc: 'O fogão de Santo Berço: o cristal vermelho na fornalha e os de reserva no nicho de baixo. Clique duplo acende/apaga.' },
  { id: 'velas_cristal', name: 'Cristais de Mesa', category: 'vila', kind: 'candles', width: 1, depth: 1, height: 0.2, states: 2, rotations: ALL, colors: ['#3a3634'], desc: 'O pratinho de ferro com três cristais vermelhos pequenos: as velas de Santo Berço. Clique duplo acende/apaga.' },
  { id: 'cama_palha', name: 'Cama de Palha', category: 'vila', kind: 'bed', width: 2, depth: 3, height: 0.55, rotations: ALL, colors: ['#8a6a4a', '#6a4a2c', '#c8a868'], desc: 'O estrado de madeira com o colchão de palha e a manta de lã.' },
  { id: 'bau_madeira', name: 'Baú de Madeira', category: 'vila', kind: 'bau', width: 1, depth: 1, height: 0.6, states: 2, stackable: true, rotations: ALL, colors: ['#6a4a2c', '#3a3a3a'], desc: 'Clique duplo abre e fecha.' },
  { id: 'escotilha', name: 'Escotilha Pesada', category: 'vila', kind: 'escotilha', width: 1, depth: 1, height: 0.04, walkable: true, stackable: true, portal: true, flat: true, states: 2, openState: 0, rotations: ALL, colors: ['#4a4a50', '#070505'], desc: 'A escotilha de ferro no chão do quarto do Ferreiro: só abre por baixo. Dá no bunker.' },
  { id: 'neblina_densa', name: 'Neblina Densa', category: 'decoracao', kind: 'neblina', width: 1, depth: 1, height: 0.02, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#a8b2a8'], desc: 'Um banco de neblina grossa, que se mexe devagar e esconde o que está dentro (o miolo do Labirinto Infinito). O tamanho da peça é o tamanho da neblina.' },
  { id: 'escada_espiral', name: 'Escada em Espiral', category: 'vila', kind: 'escada_espiral', width: 2, depth: 2, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#8a8278', '#3a2a1e'], desc: 'A escada de pedra em caracol da torre. Pare em cima para subir ou descer.' },
  // ---------- SANTO BERÇO (15/10) ----------
  // o resto de Santo Berço (docs/SANTO-BERCO.md): o Hotel, a Casa do Doutor, a Fazenda, o Bosque da Provação, as Minas,
  // o Bunker, o Labirinto e a Caverna. Arte em pixel por código (scripts/3d/estilo/pecas_px/santo_berco_*.py).
  { id: 'balcao_hotel', name: 'Balcão do Hotel', category: 'vila', kind: 'counter', width: 4, depth: 1, height: 1.05, stackable: true, rotations: ALL, colors: ['#5a3a24', '#c8a868'], desc: 'O balcão de recepção do hotel: o livro dos hóspedes aberto, a pena no tinteiro e a sineta de latão.' },
  { id: 'maca_doutor', name: 'Maca do Doutor', category: 'vila', kind: 'hospital_bed', width: 1, depth: 3, height: 0.7, rotations: ALL, colors: ['#6a4a2c', '#e8e0cc'], desc: 'A maca de madeira do consultório, com o colchão fino de linho e o rolo de couro na cabeceira.' },
  { id: 'armario_boticario', name: 'Armário de Remédios', category: 'vila', kind: 'armario', width: 2, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#5a3a24', '#7ac88a'], desc: 'O armário de botica do Doutor: as portas de madeira com vidrinhos; dentro, os potes, os frascos e as ervas. Clique duplo abre e fecha.' },
  { id: 'mesa_doutor', name: 'Mesa do Doutor', category: 'vila', kind: 'desk', width: 2, depth: 1, height: 0.8, vao: 'fundo', stackable: true, rotations: ALL, colors: ['#5a3a24', '#3a2a1c'], desc: 'A escrivaninha de carvalho do Doutor, com as gavetas e o tampo de couro gasto.' },
  { id: 'frascos_boticario', name: 'Frascos de Remédio', category: 'vila', kind: 'flasks', width: 1, depth: 1, height: 0.28, rotations: ALL, colors: ['#8ac8a0', '#5a3a24'], desc: 'Os vidrinhos de tampa de cortiça, o pilão de pedra e um maço de ervas secas.' },
  { id: 'lenha', name: 'Lenha Empilhada', category: 'vila', kind: 'lenha', width: 1, depth: 1, height: 0.5, stackable: true, rotations: ALL, colors: ['#7a5232', '#c49a64'], desc: 'As achas de lenha empilhadas do lado da lareira, com a machadinha cravada numa delas.' },
  { id: 'cesta_pao', name: 'Cesta de Pão', category: 'vila', kind: 'cesta', width: 1, depth: 1, height: 0.2, rotations: ALL, colors: ['#a8783a', '#d8a860'], desc: 'A cesta de vime com os pães redondos e um pano de linho por cima.' },
  { id: 'jarra_canecas', name: 'Jarra e Canecas', category: 'vila', kind: 'mug', width: 1, depth: 1, height: 0.3, rotations: ALL, colors: ['#8e908c', '#5e605e'], desc: 'A jarra de estanho e as canecas, uma emborcada, em cima da mesa.' },
  { id: 'olhos_escuro', name: 'Olhos no Escuro', category: 'vila', kind: 'olhos', width: 1, depth: 1, height: 0.6, walkable: true, rotations: ALL, colors: ['#e8d84a', '#1a1410'], desc: 'Os olhos brilhando no escuro, atrás do feno: os bichos da Fazendeira, escondidos como toda noite.' },
  { id: 'casa_fazendeira', name: 'Casa da Fazendeira', category: 'vila', kind: 'predio_vila', width: 7, depth: 6, height: 5.0, xray: true, rotations: ALL, colors: ['#d8c8a4', '#9a2f22', '#5a3a24', '#2a2018'], desc: 'A casa de enxaimel da Fazendeira, com o alpendre de tábuas, as réstias de cebola e o banco na porta.' },
  { id: 'boca_mina', name: 'Minas', category: 'vila', kind: 'predio_vila', width: 5, depth: 4, height: 4.0, xray: true, rotations: ALL, colors: ['#7a7468', '#5a3a24', '#ff5a3a'], desc: 'A boca das minas na encosta da montanha: o portal de troncos, o trilho saindo do escuro e o cristal vermelho pendurado.' },
  { id: 'toco_morador', name: 'Toco de Morador', category: 'vila', kind: 'toco', width: 1, depth: 1, height: 0.45, stackable: true, rotations: ALL, colors: ['#8a6a44', '#4a3422'], desc: 'O toco da árvore de um morador, cortado rente: a casca de cor estranha e os anéis à mostra.' },
  { id: 'tumulo', name: 'Túmulo', category: 'vila', kind: 'tumulo', width: 1, depth: 2, height: 0.6, rotations: ALL, colors: ['#5a4a3a', '#8a8278'], desc: 'A cova de terra embaixo da árvore de um morador, com a marca na cabeceira (a cruz de galhos ou a pedra).' },
  { id: 'boca_caverna', name: 'Boca da Caverna', category: 'vila', kind: 'boca_caverna', width: 2, depth: 2, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#2a2622', '#050404'], desc: 'O buraco de pedra no miolo do Labirinto, com os degraus descendo para o escuro e o frio. Pare em cima para descer.' },
  { id: 'boca_tunel', name: 'Boca de Túnel', category: 'vila', kind: 'portal', width: 1, depth: 1, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#3a2a1e', '#050404'], desc: 'A passagem de uma galeria para a outra, escorada com troncos (a da caverna é só a pedra). Pare em cima para passar.' },
  { id: 'trilho_mina', name: 'Trilho', category: 'vila', kind: 'trilho', width: 1, depth: 1, height: 0.06, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#4a4440', '#5a3a24'], desc: 'O trilho de ferro nos dormentes de madeira (giro 0 e 4: ao comprido da casa; 2 e 6: de lado).' },
  { id: 'carrinho_mina', name: 'Carrinho de Mina', category: 'vila', kind: 'carrinho', width: 1, depth: 1, height: 0.9, rotations: ALL, colors: ['#4a4440', '#c82a1e'], desc: 'O carrinho de ferro nas rodinhas, cheio de pedra e de lascas de cristal.' },
  { id: 'escora_mina', name: 'Escora da Mina', category: 'vila', kind: 'pillar', width: 1, depth: 1, height: 2.4, rotations: ALL, colors: ['#5a3a24', '#3a2a1c'], desc: 'O esteio de tronco que segura o teto da galeria, com a trave e a cunha.' },
  { id: 'toca_toupeira', name: 'Toca de Toupeira de Lodo', category: 'vila', kind: 'toca', width: 1, depth: 1, height: 0.3, rotations: ALL, colors: ['#4a3a2a', '#0a080c'], desc: 'O montinho de terra revirada com o buraco no meio, babado de lodo preto: a toca de uma Toupeira de Lodo.' },
  { id: 'cristal_grande_verde', name: 'Cristal Verde Grande', category: 'vila', kind: 'luz_cristal', width: 2, depth: 2, height: 2.0, states: 2, rotations: ALL, colors: ['#1a5a2a', '#5aff8a'], desc: 'Uma drusa de cristais verdes da altura de uma pessoa, brotando da pedra da galeria. Clique duplo cobre e descobre.' },
  { id: 'cristal_grande_vermelho', name: 'Cristal Vermelho Grande', category: 'vila', kind: 'luz_cristal', width: 2, depth: 2, height: 2.0, states: 2, rotations: ALL, colors: ['#6a1a14', '#ff5a3a'], desc: 'Uma drusa de cristais vermelhos da altura de uma pessoa, quente como brasa. Clique duplo cobre e descobre.' },
  { id: 'cristal_grande_azul', name: 'Cristal Azul Grande', category: 'vila', kind: 'luz_cristal', width: 2, depth: 2, height: 2.0, states: 2, rotations: ALL, colors: ['#1a3a6a', '#6ac8ff'], desc: 'Uma drusa de cristais azuis da altura de uma pessoa, com a geada em volta. Clique duplo cobre e descobre.' },
  { id: 'cristal_grande_preto', name: 'Cristal Preto Grande', category: 'vila', kind: 'cristal_preto', width: 2, depth: 2, height: 2.0, rotations: ALL, colors: ['#121016', '#5a4a6a'], desc: 'Os Cristais Pretos da Provação, do fundo das minas: quem toca vira Luzidio.' },
  { id: 'cela_branca', name: 'Parede de Cela Branca', category: 'vila', kind: 'iwall', width: 1, depth: 1, height: 2.2, xray: true, rotations: ALL, colors: ['#e8e4dc', '#b8b4ac'], desc: 'A parede lisa e branca demais das celas dos Mananciais, sem junta nem mancha: não parece feita por mão nenhuma.' },
  { id: 'porta_cela_branca', name: 'Grade de Cela Branca', category: 'vila', kind: 'cell_door', width: 1, depth: 1, height: 0, states: 2, openState: 1, cela: true, xray: true, rotations: ALL, colors: ['#f0ece4', '#1c1d20', '#c8c4bc'], desc: 'A grade branca da cela, lisa e fria como osso. Clique duplo abre e fecha; fechada, ninguém passa.' },
  { id: 'ninho_parasita', name: 'Lugar do Parasita', category: 'vila', kind: 'luz_cristal', width: 3, depth: 3, height: 1.6, rotations: ALL, colors: ['#0a080c', '#9a6ae8'], desc: 'No fundo da caverna, o chão se abre num rasgo de luz errada, cercado de tentáculos de lodo endurecido: o lugar do Parasita de Dimensões.' },
  // ---------- IGARAPÉ (15/10) ----------
  // a cidadezinha mineira cortada pelo rio (server/src/seedIgarape.ts); arte em pixel por código
  // (scripts/3d/estilo/pecas_px/igarape.py). Os prédios têm a porta no meio da casa floor(width / 2) da frente.
  { id: 'igarape_casa', name: 'Casa', category: 'fazenda', kind: 'predio_vila', semNome: true, width: 7, depth: 5, height: 4.6, xray: true, rotations: ALL, colors: ['#efeae0', '#b4562e', '#2c5a92', '#5a2414'], desc: 'A casinha térrea de Igarapé: a parede caiada, as janelas e a porta azuis, o telhado de barro com o beiral largo.' },
  { id: 'igarape_predio', name: 'Prédio', category: 'fazenda', kind: 'predio_vila', width: 8, depth: 6, height: 9.5, xray: true, rotations: ALL, colors: ['#e8d8a0', '#b4562e', '#2c5a92', '#5a2414'], desc: 'O prediozinho de três andares de Igarapé: o reboco desbotado manchado de umidade embaixo, as janelas azuis com as varandinhas de ferro, o telhado de barro.' },
  { id: 'igarape_venda', name: 'Venda', category: 'fazenda', kind: 'predio_vila', width: 8, depth: 6, height: 5.2, xray: true, rotations: ALL, colors: ['#efeae0', '#b4562e', '#2c5a92', '#5a2414'], desc: 'A venda da beira do rio: as portas largas de comércio, a tábua azul com o peixe pintado, as sacas na calçada.' },
  { id: 'igarape_capela', name: 'Capela', category: 'fazenda', kind: 'predio_vila', width: 6, depth: 8, height: 8.1, xray: true, rotations: ALL, colors: ['#efeae0', '#b4562e', '#2c5a92', '#b08a3a'], desc: 'A capelinha branca de Igarapé: o frontão com o óculo, a porta azul de duas folhas, a sineira com o sino e a cruz.' },
  { id: 'igarape_palafita', name: 'Casa de Palafita', category: 'fazenda', kind: 'predio_vila', width: 5, depth: 5, height: 4.2, xray: true, vazio: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]], rotations: ALL, colors: ['#7a5a3c', '#b4562e', '#2c5a92', '#4a3424'], desc: 'A casa de tábuas em cima das estacas, com a coluna da direita por cima da água (vazia na pegada), a varanda com a rede e a escadinha.' },
  { id: 'igarape_palafita_b', name: 'Palafita', category: 'fazenda', kind: 'predio_vila', semNome: true, width: 5, depth: 5, height: 4.2, xray: true, vazio: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]], rotations: ALL, colors: ['#7a5a3c', '#b4562e', '#2c5a92', '#4a3424'], desc: 'Outra palafita da beira do rio, sem nome no mapa.' },
  { id: 'igarape_ponte', name: 'Ponte de Pedra', category: 'fazenda', kind: 'ponte', width: 6, depth: 2, height: 0.6, alturas: [[0.3, 0.6, 0.6, 0.6, 0.6, 0.3], [0.3, 0.6, 0.6, 0.6, 0.6, 0.3]], parapeito: { m: 0.24, z1: 1.1 }, walkable: true, stackable: true, rotations: ALL, colors: ['#a8a090', '#5a5448'], desc: 'A ponte de pedra em arco por cima do rio: as cabeceiras nas duas margens (as casas das pontas) e o arco nas quatro do meio. Anda-se por cima.' },
  { id: 'igarape_canoa', name: 'Canoa', category: 'fazenda', kind: 'canoa', width: 1, depth: 4, height: 0.4, rotations: ALL, colors: ['#7e5c40', '#c0a070'], desc: 'A canoa de um pau só puxada para a beira, com o remo dentro e a corda amarrada na estaca.' },
  { id: 'igarape_ipe', name: 'Ipê Amarelo', category: 'fazenda', kind: 'arvore', width: 1, depth: 1, height: 6.2, xray: true, rotations: ALL, colors: ['#f2cc3a', '#4a3a2e'], desc: 'O ipê amarelo florido, sem uma folha, e as flores caídas no chão em volta.' },
  { id: 'igarape_rede', name: 'Rede de Dormir', category: 'casa', kind: 'bed', width: 1, depth: 3, height: 0.55, rotations: ALL, colors: ['#c8402e', '#e8b838', '#2e6aa6'], desc: 'A rede de faixas coloridas armada entre os dois esteios. Dá para deitar.' },
  { id: 'igarape_banco_igreja', name: 'Banco de Igreja', category: 'mobilia', kind: 'bench', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#5a3a24', '#6a4428'], desc: 'O banco comprido de madeira escura, com o encosto alto.' },
  { id: 'igarape_altar', name: 'Altar da Capela', category: 'mobilia', kind: 'altar_capela', width: 3, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#ece6d8', '#c8a040'], desc: 'O altar de madeira pintado de branco, com a toalha de renda, o crucifixo e os dois castiçais.' },
  { id: 'igarape_santa', name: 'Imagem da Santa', category: 'decoracao', kind: 'estatua', width: 1, depth: 1, height: 1.7, rotations: ALL, colors: ['#2e5a9a', '#ece6dc'], desc: 'A imagem de Nossa Senhora na peanha de madeira, de manto azul e coroa dourada.' },
  { id: 'igarape_rede_pesca', name: 'Rede de Pesca', category: 'fazenda', kind: 'rede_pesca', width: 1, depth: 1, height: 0.25, rotations: ALL, colors: ['#8a8a6a', '#d89a3a'], desc: 'A rede de pesca amontoada, com as boias de cortiça e a corda enrolada do lado.' },
  { id: 'igarape_cesto', name: 'Cesto de Peixe', category: 'fazenda', kind: 'cesto', width: 1, depth: 1, height: 0.38, rotations: ALL, colors: ['#b8925a', '#a8b4b8'], desc: 'O cesto de palha trançada com os peixes do dia.' },
  { id: 'igarape_varal', name: 'Varal', category: 'fazenda', kind: 'varal', width: 1, depth: 3, height: 1.6, rotations: ALL, colors: ['#6a4c34', '#c8402e', '#2e6aa6'], desc: 'Os dois paus fincados com a corda e os panos coloridos secando.' },
  // ---------- TIRADENTES (15/10) ----------
  // a cidadezinha histórica de Minas (server/src/seedTiradentes.ts); arte em pixel por código
  // (scripts/3d/estilo/pecas_px/tiradentes.py). Os prédios têm a porta no meio da casa floor(width / 2) da frente.
  { id: 'casa_colonial', name: 'Casa', category: 'casa', kind: 'predio_vila', semNome: true, width: 7, depth: 5, height: 4.6, xray: true, rotations: ALL, colors: ['#efe9dc', '#b4562f', '#2f6194', '#5a2414'], desc: 'A casa térrea do casario colonial: a parede caiada, os cunhais, as janelas de veneziana e a porta pintadas, o telhado de telha de barro.' },
  { id: 'pousada_predio', name: 'Pousada', category: 'casa', kind: 'predio_vila', width: 9, depth: 6, height: 7.4, xray: true, rotations: ALL, colors: ['#efe9dc', '#b4562f', '#2f6194', '#5a2414'], desc: 'O sobrado colonial de dois andares, com as sacadas de ferro em cima e a tábua da chave pendurada.' },
  { id: 'venda_predio', name: 'Venda', category: 'casa', kind: 'predio_vila', width: 9, depth: 5, height: 4.8, xray: true, rotations: ALL, colors: ['#efe9dc', '#b4562f', '#2f7452', '#5a2414'], desc: 'A venda de secos e molhados: as duas portas largas abertas, a tabuleta pintada, as sacas na calçada.' },
  { id: 'boteco_predio', name: 'Boteco', category: 'casa', kind: 'predio_vila', width: 7, depth: 5, height: 4.6, xray: true, rotations: ALL, colors: ['#ecd08a', '#b4562f', '#8e3426', '#5a2414'], desc: 'O boteco amarelo da Rua Direita, a porta aberta com a luz de dentro e a tabuleta da cachaça.' },
  { id: 'igreja_barroca', name: 'Igreja Matriz', category: 'casa', kind: 'predio_vila', width: 13, depth: 10, height: 9.6, xray: true, rotations: ALL, colors: ['#efe9dc', '#b4562f', '#cfae72', '#2f6a5a'], desc: 'A igreja barroca caiada, com as duas torres sineiras de cúpula, o frontão de curva, a portada de cantaria e o adro de três degraus.' },
  { id: 'chafariz', name: 'Chafariz', category: 'decoracao', kind: 'fonte', width: 3, depth: 3, height: 2.1, rotations: ALL, colors: ['#b8b0a0', '#5a8a9a'], desc: 'O chafariz de pedra do largo: o tanque de oito lados, a coluna com a taça e as quatro bicas de bronze.' },
  { id: 'coreto', name: 'Coreto', category: 'decoracao', kind: 'coreto', width: 4, depth: 4, height: 4.0, xray: true, rotations: ALL, colors: ['#efe9dc', '#2c3a30', '#b4562f'], desc: 'O coreto de ferro do largo: o estrado de tábua, as colunas e o gradil verdes, o telhado de oito águas.' },
  { id: 'poste_ferro', name: 'Poste de Ferro', category: 'iluminacao', kind: 'luz_cristal', width: 1, depth: 1, height: 3.5, states: 2, rotations: ALL, colors: ['#24262c', '#ffd27a'], desc: 'O poste antigo de ferro fundido com a lanterna de quatro vidros. Clique duplo acende e apaga.' },
  { id: 'banco_praca', name: 'Banco de Praça', category: 'mobilia', kind: 'bench', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#8a5a34', '#26282c'], desc: 'O banco de ripas de madeira com os pés de ferro fundido.' },
  { id: 'vaso_flores', name: 'Vaso de Flores', category: 'decoracao', kind: 'plant', width: 1, depth: 1, height: 0.8, rotations: ALL, colors: ['#3a682c', '#b0623e'], desc: 'O vaso de barro com a buganvília vermelha.' },
  { id: 'cruzeiro', name: 'Cruzeiro', category: 'decoracao', kind: 'cruzeiro', width: 1, depth: 1, height: 3.3, xray: true, rotations: ALL, colors: ['#4a3020', '#cfae72'], desc: 'A cruz alta de madeira escura no adro da igreja, na base de cantaria.' },
  { id: 'lajeado', name: 'Lajeado', category: 'decoracao', kind: 'lajeado', width: 2, depth: 2, height: 0.02, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#c4baa6', '#7e7462'], desc: 'As lajes de pedra do largo e do adro, em fiadas desencontradas.' },
  { id: 'banco_igreja', name: 'Banco da Igreja', category: 'mobilia', kind: 'bench', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#5a3420', '#6e4228'], desc: 'O banco comprido da nave, de madeira escura, com o encosto alto e as cabeceiras recortadas.' },
  { id: 'altar_barroco', name: 'Altar-mor', category: 'decoracao', kind: 'altar_barroco', width: 4, depth: 1, height: 2.7, rotations: ALL, colors: ['#7a2420', '#e2b24a'], desc: 'O retábulo barroco em talha dourada, o nicho com a santa de manto azul, a mesa do altar com a toalha de renda e os castiçais.' },
  { id: 'prateleira_venda', name: 'Prateleira da Venda', category: 'armazenamento', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#7a5232', '#b07a2a'], desc: 'As tábuas da venda: sacas, potes de barro, latas, garrafas de cachaça, rolos de pano.' },
  // ---------- SANTA AMÁLIA (17/10) ----------
  // a cidade comum de Minas onde a Hydra procura o Arantes (server/src/seedSantaAmalia.ts); arte em pixel por código
  // (scripts/3d/estilo/pecas_px/santa_amalia.py). Os prédios têm a porta no meio da casa floor(width / 2) da frente.
  { id: 'casa_moderna', name: 'Casa', category: 'casa', kind: 'predio_vila', semNome: true, width: 9, depth: 8, height: 4.4, xray: true, rotations: ALL, colors: ['#e8e2d4', '#b4562f', '#8a9aa6', '#5a2414'], desc: 'A casa térrea de cidade do interior: o reboco pintado e gasto, as janelas de vidro com grade, o telhado de telha cerâmica, a calçada de cimento.' },
  { id: 'casa_valenca', name: 'Casa dos Valença', category: 'casa', kind: 'predio_vila', width: 14, depth: 11, height: 4.6, xray: true, rotations: ALL, colors: ['#e6d6b6', '#b4562f', '#6a4a30', '#5a2414'], desc: 'A casa térrea dos Valença: o reboco creme manchado, a varanda coberta com o piso de cerâmica e os vasos, as janelas de vidro com as cortinas fechadas.' },
  { id: 'posto_saude', name: 'Posto de Saúde', category: 'casa', kind: 'predio_vila', width: 18, depth: 12, height: 4.8, xray: true, rotations: ALL, colors: ['#f2f0ea', '#2f6194', '#7fb88a', '#3a3a3a'], desc: 'O posto de saúde municipal: o prédio branco com o barrado azul, a placa com a cruz, as portas de vidro, a rampa com o corrimão e os canteiros.' },
  { id: 'cartorio_predio', name: 'Cartório', category: 'casa', kind: 'predio_vila', width: 15, depth: 12, height: 5.0, xray: true, rotations: ALL, colors: ['#d8ccb4', '#5a5a5a', '#6a4a30', '#3a3a3a'], desc: 'O cartório de registro de imóveis: o prédio sóbrio de reboco bege, as colunas na entrada, as janelas com grade, a placa com a balança.' },
  { id: 'prefeitura_predio', name: 'Prefeitura', category: 'casa', kind: 'predio_vila', width: 15, depth: 12, height: 8.0, xray: true, rotations: ALL, colors: ['#ece4d2', '#b4562f', '#2f6a5a', '#5a2414'], desc: 'A prefeitura: o sobrado neoclássico de dois andares, o frontão, as janelas altas, a escadaria e o mastro com a bandeira do município.' },
  { id: 'geladeira', name: 'Geladeira', category: 'casa', kind: 'geladeira', width: 1, depth: 1, height: 1.75, rotations: ALL, colors: ['#ecece6', '#9a9a96'], desc: 'A geladeira branca de duas portas, com os ímãs e os bilhetes na porta.' },
  { id: 'fogao_gas', name: 'Fogão a Gás', category: 'casa', kind: 'fogao_gas', width: 1, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#e8e6e0', '#2a2a2a'], desc: 'O fogão de quatro bocas, branco, com o forno e o botijão do lado.' },
  { id: 'maquina_lavar', name: 'Máquina de Lavar', category: 'casa', kind: 'maquina_lavar', width: 1, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#ecece6', '#7a9aaa'], desc: 'A máquina de lavar de abrir em cima, branca, com o painel de botões.' },
  { id: 'tanque', name: 'Tanque', category: 'casa', kind: 'tanque', width: 1, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#b8b4aa', '#8a8478'], desc: 'O tanque de cimento da lavanderia, a torneira e a escova em cima.' },
  { id: 'box_chuveiro', name: 'Box com Chuveiro', category: 'casa', kind: 'box_chuveiro', width: 1, depth: 1, height: 2.1, walkable: true, alturas: [[0.02]], states: 2, rotations: ALL, colors: ['#c8dce4', '#9aa4aa'], desc: 'O box de vidro com o chuveiro elétrico e o ralo. Dá para entrar e tomar banho (com o borrado, como no The Sims). Clique duplo liga e desliga o chuveiro.' },
  { id: 'rack_tv', name: 'Rack com TV', category: 'casa', kind: 'rack_tv', width: 2, depth: 1, height: 1.2, rotations: ALL, states: 2, colors: ['#6a4a30', '#1a1a1e'], desc: 'O rack de madeira com a TV de tela plana em cima, o aparelho de DVD e os enfeites. Clique duplo liga/desliga.' },
  { id: 'mesa_centro', name: 'Mesa de Centro', category: 'casa', kind: 'table', width: 1, depth: 1, height: 0.42, vao: 'vazada', stackable: true, rotations: ALL, colors: ['#7a5232', '#5a3a22'], desc: 'A mesinha de centro de madeira, com a revista e o vaso.' },
  { id: 'pufe', name: 'Pufe', category: 'casa', kind: 'pufe', width: 1, depth: 1, height: 0.4, sit: true, rotations: ALL, colors: ['#9a6a9a', '#6a4a6a'], desc: 'O pufe redondo estofado.' },
  { id: 'desenhos_espiral', name: 'Desenhos de Espiral', category: 'decoracao', kind: 'papers', width: 1, depth: 1, height: 0.02, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#f0ece2', '#1a1a1a'], desc: 'As folhas espalhadas, todas com a mesma espiral preta, riscada até furar o papel.' },
  { id: 'cadeira_espera', name: 'Cadeiras de Espera', category: 'mobilia', kind: 'bench', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#2f5a8a', '#9aa0a8'], desc: 'A fileira de três cadeiras de plástico azul presas na barra de metal.' },
  { id: 'balcao_recepcao', name: 'Balcão de Atendimento', category: 'mobilia', kind: 'counter', width: 3, depth: 1, height: 1.1, stackable: true, rotations: ALL, colors: ['#f0ece4', '#b08a5a'], desc: 'O balcão de atendimento: a frente branca, o tampo de madeira clara, o computador, a impressora e a campainha.' },
  { id: 'estante_arquivo', name: 'Estante de Arquivo', category: 'armazenamento', kind: 'shelf', width: 2, depth: 1, height: 2.1, rotations: ALL, colors: ['#4a4e54', '#c8a878'], desc: 'A estante de aço com as caixas-arquivo de papelão, etiquetadas por ano.' },
  { id: 'estante_remedios', name: 'Estante da Farmácia', category: 'saude', kind: 'shelf', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#d8dcdf', '#4a8a5a'], desc: 'A estante de aço da farmácia do posto, cheia de caixas de remédio coloridas.' },
  { id: 'maca_exame', name: 'Maca de Exame', category: 'saude', kind: 'hospital_bed', width: 1, depth: 2, height: 0.8, rotations: ALL, colors: ['#2a2a2e', '#f0f0ec'], desc: 'A maca de consultório, de estofado preto, com o papel lençol e a escadinha de dois degraus.' },
  // Igarapé (17/10): a lanchonete do largo (arte no mesmo santa_amalia.py)
  { id: 'lanchonete_predio', name: 'Lanchonete', category: 'casa', kind: 'predio_vila', width: 9, depth: 8, height: 4.4, xray: true, rotations: ALL, colors: ['#f4e2b0', '#c43a2a', '#5a2a6a', '#3a3a3a'], desc: 'A lanchonete do largo: a fachada amarela, o toldo listrado de vermelho, a placa com o cachorro-quente e o copo de açaí desenhados, as mesas de plástico na calçada.' },
  { id: 'chapa_lanche', name: 'Chapa e Estufa', category: 'casa', kind: 'chapa_lanche', width: 2, depth: 1, height: 1.2, stackable: true, rotations: ALL, colors: ['#9aa0a6', '#d8a040'], desc: 'O balcão de inox com a chapa dos lanches, a panela das salsichas e a estufa de vidro com os salgados.' },
  { id: 'freezer_acai', name: 'Freezer de Açaí', category: 'casa', kind: 'freezer_acai', width: 2, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#ecece6', '#5a2a6a'], desc: 'O freezer horizontal com a tampa de vidro: as cubas de açaí e os potes de granola, leite em pó e banana.' },
  { id: 'cafeteira', name: 'Garrafa de Café', category: 'decoracao', kind: 'mug', width: 1, depth: 1, height: 0.35, stackable: true, rotations: ALL, colors: ['#3a3a3e', '#c0c0c0'], desc: 'A garrafa térmica de café, os copinhos e o açucareiro.' },
  // ---------- MANSÃO ALBUQUERQUE (21/10) ----------
  // a mansão de pedra do Felipe (server/src/seedMansaoAlbuquerque.ts); a arte de pixel por código está em pecas_px/mansao_*.py.
  { id: 'mansao_portico', name: 'Mansão Albuquerque', category: 'mansao', kind: 'predio_vila', width: 9, depth: 9, height: 5.0, xray: true, rotations: ALL, colors: ['#5a544c', '#b4562f', '#e6dfd0', '#6a1a24'], desc: 'O pórtico de entrada da mansão: colunas, o tapete vermelho, a porta dupla e o terraço em cima.' },
  { id: 'mansao_central', name: 'Corpo Central da Mansão', category: 'mansao', kind: 'predio_vila', width: 13, depth: 18, height: 7.6, semNome: true, xray: true, rotations: ALL, colors: ['#5a544c', '#b4562f', '#8a8478', '#2a2420'], desc: 'O corpo central da mansão: pedra escura, telhado de telha ferrugem e o frontão com o óculo.' },
  { id: 'mansao_ala_oeste', name: 'Ala Oeste da Mansão', category: 'mansao', kind: 'predio_vila', width: 13, depth: 24, height: 6.9, semNome: true, xray: true, rotations: ALL, colors: ['#5a544c', '#b4562f', '#8a8478', '#2a2420'], desc: 'A ala oeste da mansão, de dois andares.' },
  { id: 'mansao_ala_leste', name: 'Ala Leste da Mansão', category: 'mansao', kind: 'predio_vila', width: 12, depth: 24, height: 6.9, semNome: true, xray: true, rotations: ALL, colors: ['#5a544c', '#b4562f', '#8a8478', '#2a2420'], desc: 'A ala leste da mansão, de dois andares.' },
  { id: 'anexo_mansao', name: 'Anexo', category: 'mansao', kind: 'predio_vila', width: 8, depth: 6, height: 4.4, xray: true, rotations: ALL, colors: ['#5a544c', '#b4562f', '#3a2a1c', '#2a2420'], desc: 'O anexo de pedra do jardim: sala de armas e depósito.' },
  { id: 'barracao_mansao', name: 'Barracão', category: 'mansao', kind: 'predio_vila', width: 9, depth: 9, height: 4.5, xray: true, rotations: ALL, colors: ['#6a5e50', '#b4562f', '#3a2a1c', '#2a2420'], desc: 'O barracão comprido dos empregados, de tábuas velhas e telha remendada.' },
  { id: 'muro_mansao', name: 'Muro da Mansão', category: 'mansao', kind: 'muro_mansao', width: 1, depth: 1, height: 2.2, rotations: ALL, colors: ['#5a544c', '#8a8478', '#5a544c'], desc: 'O muro de pedra do terreno.' },
  { id: 'muro_pilar', name: 'Pilar do Muro', category: 'mansao', kind: 'muro_mansao', width: 1, depth: 1, height: 3.0, rotations: ALL, colors: ['#5a544c', '#8a8478', '#5a544c'], desc: 'O pilar de pedra do muro, com a esfera em cima.' },
  { id: 'portao_mansao', name: 'Portão da Mansão', category: 'mansao', kind: 'portao_mansao', width: 4, depth: 1, height: 3.2, states: 2, openState: 1, rotations: ALL, colors: ['#1e1c1e', '#5a544c', '#1e1c1e'], desc: 'O portão de ferro forjado entre os pilares de pedra. Clique duplo abre e fecha.' },
  { id: 'estatua_jardim', name: 'Estátua do Jardim', category: 'mansao', kind: 'estatua', width: 1, depth: 1, height: 2.5, rotations: ALL, colors: ['#d8d4c8', '#8a8478', '#d8d4c8'], desc: 'Estátua de mármore no pedestal.' },
  { id: 'topiaria', name: 'Topiária', category: 'mansao', kind: 'arbusto', width: 1, depth: 1, height: 1.7, rotations: ALL, colors: ['#2f5a2a', '#8a8478', '#2f5a2a'], desc: 'Arbusto podado em bola, no vaso de pedra.' },
  { id: 'canteiro_flores', name: 'Canteiro de Flores', category: 'mansao', kind: 'canteiro', width: 2, depth: 1, height: 0.55, rotations: ALL, colors: ['#3a6a30', '#d86a8a', '#3a6a30'], desc: 'Canteiro com borda de pedra, cheio de hortênsias e rosas.' },
  { id: 'cipreste', name: 'Cipreste', category: 'mansao', kind: 'arvore', width: 1, depth: 1, height: 4.6, rotations: ALL, colors: ['#1f4a2a', '#3a2a1c', '#1f4a2a'], desc: 'Cipreste alto e estreito.' },
  { id: 'lampiao_jardim', name: 'Lampião do Jardim', category: 'mansao', kind: 'luz_cristal', width: 1, depth: 1, height: 3.2, states: 2, rotations: ALL, colors: ['#1e1c1e', '#ffcf70', '#1e1c1e'], desc: 'Poste de ferro com lampião de vidro. Clique duplo acende e apaga.' },
  // ---------- PEDRA SERENA (24/10) ----------
  { id: 'galpao_fritz', name: 'Galpão', category: 'casa', kind: 'predio_vila', width: 18, depth: 9, height: 6.0, semNome: true, xray: true, rotations: ALL, colors: ['#8a8a86', '#9aa0a4', '#7a5a3e', '#4e5458'], desc: 'O galpão de bloco cru e chapa ondulada, o telhado de zinco, o portão de enrolar e a porta de aço, o pátio de concreto.' },
  // ---------- JARDIM DO FRITZ (24/10) ----------
  { id: 'casarao_fritz', name: 'Casarão', category: 'casa', kind: 'predio_vila', width: 24, depth: 12, height: 8.6, semNome: true, xray: true, rotations: ALL, colors: ['#e6d6b4', '#b85a32', '#d2cab8', '#5a2414'], desc: 'O casarão de reboco creme e telha de barro: as duas alas, a varanda com as colunas e o terraço, a escadaria.' },
  { id: 'estufa_principal', name: 'Estufa Principal', category: 'casa', kind: 'predio_vila', width: 10, depth: 12, height: 6.4, semNome: true, xray: true, rotations: ALL, colors: ['#b4d0c8', '#e4e8e2', '#3e6a3c', '#9a5a3e'], desc: 'A estufa grande de ferro e vidro, em abóbada, cheia de plantas.' },
  { id: 'estufa_auxiliar', name: 'Estufa', category: 'casa', kind: 'predio_vila', width: 7, depth: 10, height: 4.2, semNome: true, xray: true, rotations: ALL, colors: ['#b4d0c8', '#e4e8e2', '#3e6a3c', '#9a5a3e'], desc: 'A estufa de vidro de duas águas.' },
  { id: 'laboratorio_fritz', name: 'Laboratório', category: 'casa', kind: 'predio_vila', width: 10, depth: 9, height: 5.0, semNome: true, xray: true, rotations: ALL, colors: ['#ddcfb2', '#b85a32', '#d2cab8', '#5a2414'], desc: 'O prédio térreo de reboco e telha, com o duto de metal saindo do telhado.' },
  { id: 'alojamento_fritz', name: 'Alojamento', category: 'casa', kind: 'predio_vila', width: 12, depth: 7, height: 7.0, semNome: true, xray: true, rotations: ALL, colors: ['#e6d6b4', '#b85a32', '#d2cab8', '#5a2414'], desc: 'O prédio de dois andares de reboco e telha, com as portas dos quartos.' },
  { id: 'oficina_fritz', name: 'Oficina', category: 'casa', kind: 'predio_vila', width: 12, depth: 6, height: 4.6, semNome: true, xray: true, rotations: ALL, colors: ['#d4c8ae', '#b85a32', '#8a9094', '#5a2414'], desc: 'O galpãozinho da manutenção: o portão de aço de enrolar, a porta lateral, os galões.' },
  { id: 'contencao_fritz', name: 'Prédio de Concreto', category: 'casa', kind: 'predio_vila', width: 12, depth: 9, height: 4.4, semNome: true, xray: true, rotations: ALL, colors: ['#8e8e8a', '#5a6066', '#b8bcbe', '#ff3a2a'], desc: 'O bloco de concreto sem janela, com a porta de aço e a luz vermelha em cima.' },
  { id: 'gazebo_jardim', name: 'Gazebo', category: 'mansao', kind: 'arbusto', width: 4, depth: 4, height: 3.6, xray: true, rotations: ALL, colors: ['#efe8da', '#5a8a78'], desc: 'O gazebo de colunas brancas com a cúpula de cobre.' },
  { id: 'pergolado', name: 'Pergolado', category: 'mansao', kind: 'arbusto', width: 8, depth: 5, height: 2.8, xray: true, vazio: [[1, 0], [2, 0], [3, 0], [5, 0], [6, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [1, 4], [2, 4], [3, 4], [5, 4], [6, 4]], rotations: ALL, colors: ['#6a4a30', '#3a6430'], desc: 'O pergolado de madeira coberto de trepadeira: só os seis pilares ocupam casa; embaixo se anda e se põe mesa.' },
  { id: 'canteiro_elevado', name: 'Canteiro Elevado', category: 'mansao', kind: 'canteiro', width: 4, depth: 1, height: 0.7, rotations: ALL, colors: ['#7a5634', '#3a6430'], desc: 'A caixa de tábuas com a terra escura e as fileiras de verdura.' },
  { id: 'composteira', name: 'Composteira', category: 'mansao', kind: 'canteiro', width: 3, depth: 1, height: 1.0, rotations: ALL, colors: ['#8a6a42', '#2a1c10'], desc: 'As três baias de ripas com o composto.' },
  { id: 'orquidea_sangue', name: 'Orquídea de Sangue', category: 'mansao', kind: 'plant', width: 1, depth: 1, height: 0.9, rotations: ALL, colors: ['#a8142a', '#1e1c1e'], desc: 'O vaso preto com a orquídea de flores carmim que parecem pingar.' },
  { id: 'canteiro_orquideas', name: 'Canteiro de Orquídeas de Sangue', category: 'mansao', kind: 'canteiro', width: 4, depth: 1, height: 1.0, rotations: ALL, colors: ['#a8142a', '#3a2a20'], desc: 'A caixa de madeira escura com as orquídeas de sangue em fila.' },
  { id: 'bravo_purpulis', name: 'Bravo Purpulis', category: 'mansao', kind: 'plant', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#7a3aa8', '#7a7670'], desc: 'A pedra cinza com os bulbos roxos brotando nas frestas.' },
  { id: 'canteiro_purpulis', name: 'Canteiro de Bravo Purpulis', category: 'mansao', kind: 'canteiro', width: 2, depth: 1, height: 0.7, rotations: ALL, colors: ['#7a3aa8', '#8a8478'], desc: 'A mureta de pedra com o cascalho e as pedras cheias de bulbos roxos.' },
  { id: 'vitrine_lodo', name: 'Vitrine de Raízes', category: 'mansao', kind: 'decor', width: 2, depth: 1, height: 1.4, rotations: ALL, colors: ['#3a2a1c', '#0e0c0e', '#c8ccd0'], desc: 'A caixa de vidro sobre o armário de aço: as raízes grossas e escuras e o líquido preto e brilhante escorrendo delas.' },
  { id: 'tanque_dama', name: 'Tanque do Espécime', category: 'mansao', kind: 'tank', width: 2, depth: 2, height: 2.45, rotations: ALL, colors: ['#a8202a', '#4a5056', '#c8ccd0'], desc: 'O cilindro de vidro com a flor grande e dentada no meio e os tentáculos com as sete flores coloridas.' },
  { id: 'bancada_mudas', name: 'Bancada de Mudas', category: 'mansao', kind: 'canteiro', width: 2, depth: 1, height: 0.95, rotations: ALL, colors: ['#4a4e50', '#6ea444'], desc: 'A bancada de grade de ferro com as bandejas de mudas e os vasinhos.' },
  { id: 'buxo', name: 'Buxinho', category: 'mansao', kind: 'arbusto', width: 1, depth: 1, height: 0.55, rotations: ALL, colors: ['#3a6430', '#2a4c24'], desc: 'O buxinho podado em bloco, das bordas dos canteiros.' },
  { id: 'lustre_cristal', name: 'Lustre de Cristal', category: 'mansao', kind: 'ceiling_lamp', width: 1, depth: 1, height: 0, walkable: true, stackable: true, states: 2, rotations: [0], colors: ['#ffe9b0', '#b8902a', '#ffe9b0'], desc: 'Lustre de cristal pendurado no teto; dá para andar embaixo. Clique duplo acende e apaga.' },
  { id: 'lareira_marmore', name: 'Lareira de Mármore', category: 'mansao', kind: 'lareira', width: 3, depth: 1, height: 2.4, states: 2, rotations: ALL, colors: ['#e6dfd0', '#ff6a2a', '#e6dfd0'], desc: 'A lareira de mármore com o consolo, o espelho dourado e a grade de latão. Clique duplo acende e apaga.' },
  { id: 'coluna_marmore', name: 'Coluna de Mármore', category: 'mansao', kind: 'pillar', width: 1, depth: 1, height: 2.8, rotations: [0], colors: ['#e6dfd0', '#b8b0a0', '#e6dfd0'], desc: 'Coluna redonda de mármore creme, canelada.' },
  { id: 'piano_cauda', name: 'Piano de Cauda', category: 'mansao', kind: 'piano', width: 3, depth: 2, height: 1.05, rotations: ALL, colors: ['#141416', '#b8902a', '#141416'], desc: 'Piano de cauda preto laqueado, de tampa aberta.' },
  { id: 'banco_piano', name: 'Banco de Piano', category: 'mansao', kind: 'stool', width: 1, depth: 1, height: 0.5, sit: true, rotations: ALL, colors: ['#141416', '#b8902a', '#141416'], desc: 'Banco estofado de piano.' },
  { id: 'escada_nobre', name: 'Escada Nobre', category: 'mansao', kind: 'escada_nobre', width: 3, depth: 2, height: 0, walkable: true, portal: true, rotations: [4, 2], colors: ['#e6dfd0', '#6a1a24', '#e6dfd0'], desc: 'A escada nobre de mármore com o tapete vinho e os balaústres. Pare em cima para subir.' },
  { id: 'escada_nobre_desce', name: 'Escada Nobre (desce)', category: 'mansao', kind: 'escada_nobre', width: 3, depth: 2, height: 0, walkable: true, portal: true, rotations: [4, 2], colors: ['#e6dfd0', '#6a1a24', '#e6dfd0'], desc: 'A escada nobre vista do andar de cima, com o corrimão. Pare em cima para descer.' },
  { id: 'relogio_carrilhao', name: 'Relógio de Caixa Alta', category: 'mansao', kind: 'relogio', width: 1, depth: 1, height: 2.4, rotations: ALL, colors: ['#4a2a18', '#b8902a', '#4a2a18'], desc: 'Relógio de caixa alta de nogueira, com o pêndulo de latão.' },
  { id: 'vaso_grande', name: 'Vaso Chinês', category: 'mansao', kind: 'plant', width: 1, depth: 1, height: 1.2, rotations: ALL, colors: ['#2f5a8a', '#e8e4dc', '#2f5a8a'], desc: 'Vaso chinês de porcelana azul e branca, com galhos em flor.' },
  { id: 'palmeira_vaso', name: 'Palmeira em Vaso', category: 'mansao', kind: 'plant', width: 1, depth: 1, height: 2.4, rotations: ALL, colors: ['#2f5a2a', '#b8902a', '#2f5a2a'], desc: 'Palmeira areca no vaso de latão.' },
  { id: 'console_dourado', name: 'Console Dourado', category: 'mansao', kind: 'table_big', width: 2, depth: 1, height: 0.88, stackable: true, rotations: ALL, colors: ['#e6dfd0', '#b8902a', '#e6dfd0'], desc: 'Console com tampo de mármore e pés dourados.' },
  { id: 'tapete_longo', name: 'Tapete Vermelho Longo', category: 'mansao', kind: 'rug', width: 2, depth: 8, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#6a1a24', '#b8902a', '#6a1a24'], desc: 'O tapete vermelho comprido do pórtico.' },
  { id: 'tapete_redondo', name: 'Tapete Redondo', category: 'mansao', kind: 'rug', width: 3, depth: 3, height: 0.03, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#6a1a24', '#b8902a', '#6a1a24'], desc: 'Tapete redondo vinho com o medalhão dourado.' },
  { id: 'tapete_corredor', name: 'Passadeira', category: 'mansao', kind: 'rug', width: 2, depth: 6, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#2f5a6a', '#e8e0d0', '#2f5a6a'], desc: 'Passadeira de corredor, azul-petróleo e creme.' },
  { id: 'cama_master', name: 'Cama do Casal', category: 'mansao', kind: 'bed', width: 3, depth: 3, height: 0.7, rotations: ALL, colors: ['#4a2a18', '#e0c898', '#4a2a18'], desc: 'Cama enorme de cabeceira entalhada e seda champanhe.' },
  { id: 'chaise_longue', name: 'Divã', category: 'mansao', kind: 'sofa', width: 2, depth: 1, height: 0.6, sit: true, rotations: ALL, colors: ['#1f3a2a', '#4a2a18', '#1f3a2a'], desc: 'Divã de veludo verde-garrafa.' },
  { id: 'penteadeira', name: 'Penteadeira', category: 'mansao', kind: 'vanity', width: 2, depth: 1, height: 1.7, rotations: ALL, colors: ['#4a2a18', '#b8902a', '#4a2a18'], desc: 'Penteadeira com o espelho tríptico dourado.' },
  { id: 'espelho_corpo', name: 'Espelho de Corpo Inteiro', category: 'mansao', kind: 'espelho', width: 1, depth: 1, height: 2.0, rotations: ALL, colors: ['#b8902a', '#cfe0e8', '#b8902a'], desc: 'Espelho de chão inteiro de moldura dourada.' },
  { id: 'banheira_luxo', name: 'Banheira de Luxo', category: 'mansao', kind: 'banheira', width: 2, depth: 3, height: 0.8, rotations: ALL, colors: ['#f0ece4', '#b8902a', '#f0ece4'], desc: 'Banheira independente com pés de garra dourados.' },
  { id: 'pia_dupla', name: 'Pia Dupla de Mármore', category: 'mansao', kind: 'sink', width: 2, depth: 1, height: 0.95, stackable: true, rotations: ALL, colors: ['#e6dfd0', '#b8902a', '#e6dfd0'], desc: 'Bancada de mármore com duas cubas e torneiras douradas.' },
  { id: 'adega', name: 'Adega', category: 'mansao', kind: 'adega', width: 2, depth: 1, height: 2.1, states: 2, rotations: ALL, colors: ['#2a1810', '#6a1a24', '#2a1810'], desc: 'Adega de madeira escura com portas de vidro. Clique duplo abre e fecha.' },
  { id: 'poltrona_orelha', name: 'Poltrona de Orelha', category: 'mansao', kind: 'armchair', width: 1, depth: 1, height: 0.5, sit: true, rotations: ALL, colors: ['#8a5a2a', '#4a2a18', '#8a5a2a'], desc: 'Poltrona de encosto alto, de couro caramelo.' },
  { id: 'carrinho_bar', name: 'Carrinho de Bar', category: 'mansao', kind: 'carrinho', width: 1, depth: 1, height: 0.95, stackable: true, rotations: ALL, colors: ['#b8902a', '#cfe0e8', '#b8902a'], desc: 'Carrinho de bar dourado, com decanters e copos de cristal.' },
  { id: 'closet_aberto', name: 'Closet', category: 'mansao', kind: 'armario', width: 2, depth: 1, height: 2.2, states: 2, rotations: ALL, colors: ['#c8b898', '#4a2a18', '#c8b898'], desc: 'Armário-closet de portas espelhadas. Clique duplo abre.' },
  { id: 'closet_masculino', name: 'Closet (Lado Dele)', category: 'mansao', kind: 'armario', width: 3, depth: 1, height: 2.4, rotations: ALL, colors: ['#4a2a16', '#b8902a', '#1c2440'], desc: 'O lado dele do closet, de nogueira: os ternos, as camisas, as gravatas e os sapatos sociais.' },
  { id: 'closet_feminino', name: 'Closet (Lado Dela)', category: 'mansao', kind: 'armario', width: 3, depth: 1, height: 2.4, rotations: ALL, colors: ['#ece4d4', '#b8902a', '#6a1a24'], desc: 'O lado dela do closet, laqueado marfim: os vestidos longos, as bolsas e a parede de saltos.' },
  { id: 'ilha_joias', name: 'Ilha de Joias', category: 'mansao', kind: 'table', width: 2, depth: 1, height: 0.92, rotations: ALL, colors: ['#ece4d4', '#1c2440', '#b8902a'], desc: 'A ilha do closet com o tampo de vidro: os relógios dele e as joias dela sobre o veludo.' },
  { id: 'cama_catarina', name: 'Cama da Catarina', category: 'mansao', kind: 'bed', width: 3, depth: 3, height: 0.65, estadoOcupada: 1, rotations: ALL, colors: ['#c8c4bc', '#e0643a', '#c8c4bc'], desc: 'Cama de casal grande, cheia de travesseiros e com dois ursos de pelúcia.' },
  { id: 'tv_gamer', name: 'TV Gigante com Console', category: 'mansao', kind: 'tv_gamer', width: 3, depth: 1, height: 1.55, states: 2, rotations: ALL, colors: ['#1a1a1e', '#6ac8ff', '#1a1a1e'], desc: 'TV bem grande com o console de movimento e os controles. Clique duplo liga e desliga.' },
  { id: 'rack_esgrima', name: 'Canto da Esgrima', category: 'mansao', kind: 'weapon_rack', width: 2, depth: 1, height: 1.75, rotations: ALL, colors: ['#d8d4c8', '#a8a8b0', '#d8d4c8'], desc: 'Floretes, espadas e sabres no suporte, a máscara e a jaqueta de esgrima.' },
  // o luxo da mansão (23/10, o Felipe: "é a casa de milionários, tudo tem que ser chique"): pecas_px/mansao_luxo.py
  { id: 'sofa_luxo', name: 'Sofá Capitonê Esmeralda', category: 'mansao', kind: 'sofa', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#1c5442', '#b8902a', '#1c5442'], desc: 'Sofá de três lugares de veludo verde-esmeralda capitonê, braços em rolo e pés de latão.' },
  { id: 'sofa_luxo_vinho', name: 'Sofá Capitonê Vinho', category: 'mansao', kind: 'sofa', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#6a1420', '#b8902a', '#6a1420'], desc: 'Sofá de três lugares de veludo vinho capitonê, braços em rolo e pés de latão.' },
  { id: 'poltrona_luxo', name: 'Poltrona Bergère Vinho', category: 'mansao', kind: 'armchair', width: 1, depth: 1, height: 0.46, sit: true, rotations: ALL, colors: ['#6a1420', '#b8902a', '#6a1420'], desc: 'Bergère de encosto em medalhão, veludo vinho capitonê e moldura dourada entalhada.' },
  { id: 'poltrona_luxo_verde', name: 'Poltrona Bergère Esmeralda', category: 'mansao', kind: 'armchair', width: 1, depth: 1, height: 0.46, sit: true, rotations: ALL, colors: ['#1c5442', '#b8902a', '#1c5442'], desc: 'Bergère de encosto em medalhão, veludo esmeralda capitonê e moldura dourada entalhada.' },
  { id: 'mesa_centro_luxo', name: 'Mesa de Centro de Mármore', category: 'mansao', kind: 'table', width: 2, depth: 1, height: 0.42, stackable: true, rotations: ALL, colors: ['#24222a', '#b8902a', '#24222a'], desc: 'Mesa de centro baixa de mármore negro com a moldura e as pernas douradas.' },
  { id: 'vitrine_ovo', name: 'Vitrine do Ovo de Joia', category: 'mansao', kind: 'vitrine', width: 1, depth: 1, height: 1.75, rotations: ALL, colors: ['#e8e0d2', '#e8c860', '#e8e0d2'], desc: 'O pedestal de mármore e, na caixa de vidro de moldura dourada, um ovo de ouro cravejado de pedras numa almofada de veludo.' },
  { id: 'tapete_imperial', name: 'Tapete Imperial', category: 'mansao', kind: 'rug', width: 6, depth: 5, height: 0.05, flat: true, walkable: true, stackable: true, rotations: ALL, colors: ['#6a1420', '#14203a', '#c8a048'], desc: 'O persa grande, vinho e azul-noite, com o medalhão e as volutas de ouro.' },
  { id: 'decanter_tacas', name: 'Decanter e Taças', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 0.3, rotations: ALL, colors: ['#c8ccd4', '#9a5a28', '#c8ccd4'], desc: 'A bandeja de prata com o decanter de uísque e duas taças de cristal.' },
  { id: 'fruteira_prata', name: 'Fruteira de Prata', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 0.25, rotations: ALL, colors: ['#c8ccd4', '#b81c22', '#c8ccd4'], desc: 'A fruteira de prata de pé, cheia de frutas e uvas.' },
  { id: 'arranjo_flores', name: 'Arranjo de Flores', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 0.36, rotations: ALL, colors: ['#f4f0ec', '#e8a8b8', '#f4f0ec'], desc: 'Rosas brancas e peônias num vaso de cristal.' },
  { id: 'servico_cha', name: 'Serviço de Chá', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 0.2, rotations: ALL, colors: ['#c8ccd4', '#f4f0ec', '#c8ccd4'], desc: 'O bule de prata, a leiteira e as xícaras de porcelana na bandeja.' },
  { id: 'candelabro_prata', name: 'Candelabro de Prata', category: 'mansao', kind: 'candles', width: 1, depth: 1, height: 0.4, rotations: ALL, colors: ['#c8ccd4', '#ffd060', '#c8ccd4'], desc: 'O candelabro de mesa de três braços, com as velas acesas.' },
  { id: 'perfumes', name: 'Frascos de Perfume', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 0.15, rotations: ALL, colors: ['#d8a8b0', '#8ab0c8', '#d8a8b0'], desc: 'Os frascos de cristal na bandejinha de prata.' },
  { id: 'porta_retratos', name: 'Porta-Retratos', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 0.2, rotations: ALL, colors: ['#c8ccd4', '#6a5a4a', '#c8ccd4'], desc: 'As fotos da família em molduras de prata.' },
  { id: 'livros_couro', name: 'Livros de Couro', category: 'mansao', kind: 'books', width: 1, depth: 1, height: 0.24, rotations: ALL, colors: ['#5a1818', '#1a3a28', '#5a1818'], desc: 'Os livros de couro com o título em ouro, entre os aparadores de bronze.' },
  { id: 'balde_champanhe', name: 'Balde de Champanhe', category: 'mansao', kind: 'decor', width: 1, depth: 1, height: 1.0, rotations: ALL, colors: ['#c8ccd4', '#b8902a', '#c8ccd4'], desc: 'O balde de prata no pé dourado, com a garrafa no gelo e o guardanapo.' },
  { id: 'cadeira_jantar_luxo', name: 'Cadeira de Jantar de Medalhão', category: 'mansao', kind: 'chair', width: 1, depth: 1, height: 0.47, sit: true, rotations: ALL, colors: ['#6a1420', '#b8902a', '#6a1420'], desc: 'Cadeira de jantar Luís XVI: o encosto de medalhão em moldura dourada entalhada, veludo vinho capitonê.' },
  { id: 'cadeira_cabeceira', name: 'Poltrona da Cabeceira', category: 'mansao', kind: 'chair', width: 1, depth: 1, height: 0.47, sit: true, rotations: ALL, colors: ['#6a1420', '#b8902a', '#6a1420'], desc: 'A poltrona do dono da casa, na cabeceira da mesa: o encosto alto quase um trono, os braços dourados.' },
  { id: 'vitrine_trofeus', name: 'Vitrine de Troféus', category: 'mansao', kind: 'bookshelf', width: 3, depth: 1, height: 1.9, rotations: ALL, colors: ['#4a2c18', '#d09a22', '#4a2c18'], desc: 'A vitrine de nogueira com o vidro: as taças, as estatuetas e as medalhas de todas as competições.' },
  { id: 'estante_trofeus', name: 'Estante de Troféus', category: 'mansao', kind: 'bookshelf', width: 1, depth: 1, height: 1.9, rotations: ALL, colors: ['#5a3a22', '#d09a22', '#5a3a22'], desc: 'A estante estreita do canto, de madeira escura: as taças, as medalhas e a estatueta das competições.' },
  { id: 'setup_gamer', name: 'Mesa Gamer', category: 'mansao', kind: 'console', width: 3, depth: 1, height: 0.78, states: 2, vao: 'fundo', rotations: ALL, colors: ['#2a2a34', '#b05ae0', '#2a2a34'], desc: 'Dois monitores, teclado RGB e o computador potente. Clique duplo liga e desliga.' },
  { id: 'parede_escalada', name: 'Parede de Escalada', category: 'mansao', kind: 'escalada', width: 3, depth: 1, height: 0, walkable: true, portal: true, rotations: [4, 2], colors: ['#c8a878', '#e0643a', '#c8a878'], desc: 'A parede de escalada, com as agarras coloridas. Pare em cima para subir (ou descer).' },
  { id: 'puff_gamer', name: 'Pufe Gamer', category: 'mansao', kind: 'pufe', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#2f6a7a', '#1f4a5a', '#2f6a7a'], desc: 'Pufe-saco grande, amassado de usar.' },
  // a mansão moderna (23/10, o Felipe: "é tudo mármore, coisas chiques... essas coisas atuais muito chiques que os ricos têm"): cada peça tem o
  // tamanho e o jeito da que ela substitui no seed (MODERNO em seedMansaoAlbuquerque.ts); a arte em pecas_px/mansao_moderno.py
  { id: 'bancada_cooktop', name: 'Bancada do Cooktop', category: 'mansao', kind: 'fogao', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#2a292e', '#f1eee8', '#b8902a'], desc: 'A bancada de laca grafite com o tampo de Calacatta, o cooktop de indução de vidro preto e a coifa de latão.' },
  { id: 'bancada_pia', name: 'Bancada da Pia', category: 'mansao', kind: 'pia_cozinha', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#2a292e', '#f1eee8', '#b8902a'], desc: 'A bancada de laca grafite com a cuba embutida no Calacatta e a torneira gourmet de latão.' },
  { id: 'armario_cozinha_laca', name: 'Coluna de Fornos', category: 'mansao', kind: 'armario', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#e6dfd2', '#16161c', '#b8902a'], desc: 'A coluna de laca marfim do chão ao teto, com o forno e o forno a vapor embutidos.' },
  { id: 'ilha_marmore', name: 'Ilha de Calacatta', category: 'mansao', kind: 'mesa', width: 3, depth: 2, height: 0.92, stackable: true, rotations: ALL, colors: ['#f1eee8', '#2a292e', '#b8902a'], desc: 'A ilha da cozinha em cascata: o tampo grosso de mármore Calacatta descendo até o chão nas pontas.' },
  { id: 'geladeira_embutida', name: 'Geladeira de Porta Dupla', category: 'mansao', kind: 'geladeira', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#b4b8bc', '#3a3e42', '#7ad0ff'], desc: 'A geladeira de porta dupla de inox escovado, do chão ao alto, com o dispenser de água e gelo.' },
  { id: 'estante_despensa', name: 'Estante da Despensa', category: 'mansao', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#e6dfd2', '#d4e0dc', '#b8902a'], desc: 'As prateleiras de laca marfim: os potes de vidro com tampa de latão, as caixas de linho, os vinhos deitados.' },
  { id: 'cesto_roupa', name: 'Cesto de Roupa', category: 'mansao', kind: 'crate', width: 1, depth: 1, height: 0.52, stackable: true, rotations: ALL, colors: ['#c8a870', '#f2ede4', '#3a2a1a'], desc: 'O cesto de palha trançada com o lençol dobrado em cima.' },
  { id: 'mesa_jantar_marmore', name: 'Mesa de Jantar de Calacatta', category: 'mansao', kind: 'mesa', width: 4, depth: 2, height: 0.76, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#f1eee8', '#b8902a', '#a89878'], desc: 'O tampo de mármore Calacatta sobre as duas bases esculpidas de latão.' },
  { id: 'aparador_marmore', name: 'Aparador de Nero Marquina', category: 'mansao', kind: 'table_big', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#16161a', '#1b1a1f', '#b8902a'], desc: 'A laca preta ripada, o tampo de mármore preto com os veios dourados, os pés de latão.' },
  { id: 'escultura_moderna', name: 'Escultura de Bronze', category: 'mansao', kind: 'estatua', width: 1, depth: 1, height: 2.2, rotations: ALL, colors: ['#b8902a', '#1b1a1f', '#e0c060'], desc: 'A fita de bronze dourado girando em laço, sobre o pedestal de Nero Marquina.' },
  { id: 'criado_laca', name: 'Criado-Mudo de Laca', category: 'mansao', kind: 'nightstand', width: 1, depth: 1, height: 0.6, stackable: true, rotations: ALL, colors: ['#e6dfd2', '#f1eee8', '#b8902a'], desc: 'A laca marfim com duas gavetas, o tampo de Calacatta e os pés finos de latão.' },
  { id: 'armario_laca', name: 'Guarda-roupa de Laca', category: 'mansao', kind: 'armario', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#e6dfd2', '#a6c0c4', '#b8902a'], desc: 'A laca marfim ripada do chão ao alto, a faixa de espelho e os puxadores longos de latão.' },
  { id: 'comoda_laca', name: 'Cômoda de Laca', category: 'mansao', kind: 'armario', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#e6dfd2', '#f1eee8', '#b8902a'], desc: 'Três gavetões de laca marfim, o tampo de Calacatta e os pés de latão.' },
  { id: 'escrivaninha_vidro', name: 'Escrivaninha de Vidro', category: 'mansao', kind: 'desk', width: 2, depth: 1, height: 0.76, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#3a4248', '#b8902a', '#2a292e'], desc: 'O tampo de vidro fumê sobre o quadro de latão, com a gavetinha de laca grafite.' },
  { id: 'cadeira_design', name: 'Cadeira de Bouclé', category: 'mansao', kind: 'chair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#e6ddce', '#b8902a', '#e6ddce'], desc: 'A concha de bouclé marfim com o encosto curvo, sobre os pés finos de latão.' },
  { id: 'cama_estofada', name: 'Cama Estofada', category: 'mansao', kind: 'bed', width: 2, depth: 3, height: 0.55, rotations: ALL, colors: ['#6a5b4e', '#f6f3ec', '#8a8890'], desc: 'A cama de casal com a cabeceira alta de veludo taupe, o edredom branco e a manta cinza.' },
  { id: 'cama_solteiro_estofada', name: 'Cama Estofada de Solteiro', category: 'mansao', kind: 'bed', width: 1, depth: 3, height: 0.55, rotations: ALL, colors: ['#6a5b4e', '#f6f3ec', '#8a8890'], desc: 'A cama de solteiro com a cabeceira de veludo taupe e o edredom branco.' },
  { id: 'tapete_contemporaneo', name: 'Tapete Contemporâneo', category: 'mansao', kind: 'rug', width: 4, depth: 3, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#e8e2d8', '#7a746c', '#c8a050'], desc: 'A lã marfim com as manchas cinza orgânicas e o fio dourado.' },
  { id: 'tapete_contemporaneo_v', name: 'Tapete Contemporâneo (comprido)', category: 'mansao', kind: 'rug', width: 3, depth: 4, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#e8e2d8', '#7a746c', '#c8a050'], desc: 'A lã marfim com as manchas cinza orgânicas e o fio dourado.' },
  { id: 'tapete_contemporaneo_p', name: 'Tapete Contemporâneo (pequeno)', category: 'mansao', kind: 'rug', width: 2, depth: 3, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#e8e2d8', '#7a746c', '#c8a050'], desc: 'A lã marfim com as manchas cinza orgânicas e o fio dourado.' },
  { id: 'estante_entalhada', name: 'Estante Entalhada (séc. XVII)', category: 'mansao', kind: 'bookshelf', width: 3, depth: 1, height: 2.9, rotations: ALL, colors: ['#4a2412', '#c89a3a', '#4a2412'], desc: 'A estante de nogueira maciça entalhada à mão no século XVII: a cornija com a talha dourada, as pilastras caneladas, os livros de couro.' },
  { id: 'estante_entalhada_2', name: 'Estante Entalhada Menor (séc. XVII)', category: 'mansao', kind: 'bookshelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#4a2412', '#c89a3a', '#4a2412'], desc: 'A estante de nogueira maciça entalhada à mão no século XVII, a menor do par.' },
  { id: 'mesa_executiva', name: 'Mesa Executiva de Nero Marquina', category: 'mansao', kind: 'desk', width: 4, depth: 2, height: 0.78, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#1b1a1f', '#b8902a', '#1a1614'], desc: 'O tampo grosso de mármore preto sobre os cavaletes de latão, com o descanso de couro.' },
  { id: 'bar_vidro', name: 'Bar de Vidro e Latão', category: 'mansao', kind: 'sideboard', width: 2, depth: 1, height: 1.2, stackable: true, rotations: ALL, colors: ['#b8902a', '#3a4248', '#1b1a1f'], desc: 'O quadro de latão com as portas de vidro fumê, as garrafas acesas por dentro, o tampo de Nero.' },
  { id: 'sofa_moderno', name: 'Sofá de Bouclé', category: 'mansao', kind: 'sofa', width: 3, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#e6ddce', '#b8902a', '#1f5a46'], desc: 'O sofá baixo e fundo de bouclé marfim, os braços largos e retos, as almofadas de veludo.' },
  { id: 'bar_marmore', name: 'Balcão de Nero Marquina', category: 'mansao', kind: 'bar_counter', width: 2, depth: 1, height: 1.1, stackable: true, rotations: ALL, colors: ['#1b1a1f', '#b8902a', '#ffd890'], desc: 'O balcão de mármore preto com o tampo de latão e a fita de luz embaixo.' },
  { id: 'adega_iluminada', name: 'Adega Iluminada', category: 'mansao', kind: 'bar_shelf', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#16161a', '#e8a850', '#b8902a'], desc: 'As prateleiras de vidro acesas por trás, com as fileiras de garrafas.' },
  { id: 'banqueta_design', name: 'Banqueta de Couro', category: 'mansao', kind: 'stool_high', width: 1, depth: 1, height: 0.75, sit: true, rotations: ALL, colors: ['#9a5a2a', '#b8902a', '#9a5a2a'], desc: 'A banqueta alta de latão com o assento de couro caramelo.' },
  { id: 'banco_moderno', name: 'Banco de Bouclé', category: 'mansao', kind: 'bench', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#e6ddce', '#b8902a', '#e6ddce'], desc: 'O banco estofado de bouclé sobre o quadro fino de latão.' },
  { id: 'cuba_marmore', name: 'Pia de Calacatta', category: 'mansao', kind: 'sink', width: 1, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#f1eee8', '#2a292e', '#b8902a'], desc: 'O tampo suspenso de Calacatta com a cuba esculpida e a torneira de latão.' },
  { id: 'cama_master_estofada', name: 'Cama do Casal Estofada', category: 'mansao', kind: 'bed', width: 3, depth: 3, height: 0.7, rotations: ALL, colors: ['#6a5b4e', '#f6f3ec', '#8a8890'], desc: 'A cama king estofada, a cabeceira alta de veludo taupe em gomos, o edredom branco e a manta cinza.' },
  { id: 'penteadeira_moderna', name: 'Penteadeira de Laca', category: 'mansao', kind: 'vanity', width: 2, depth: 1, height: 1.7, rotations: ALL, colors: ['#e6dfd2', '#f1eee8', '#b8902a'], desc: 'O tampo de Calacatta sobre a laca marfim e o espelho redondo iluminado por trás.' },
  { id: 'mesa_lateral_marmore', name: 'Mesinha de Mármore', category: 'mansao', kind: 'table', width: 1, depth: 1, height: 0.7, stackable: true, rotations: ALL, colors: ['#f1eee8', '#b8902a', '#a89878'], desc: 'O tampo redondo de Calacatta sobre a base de latão em ampulheta.' },
  { id: 'mesa_21', name: 'Mesa de 21', category: 'mansao', kind: 'table_big', width: 3, depth: 2, height: 0.8, rotations: ALL, colors: ['#1e5a3a', '#3a1a10', '#d0a040'], desc: 'A mesa de 21 em meia-lua, de feltro verde com o friso de couro: os jogadores sentam na curva, o dealer fica em pé atrás, com a bandeja de fichas e o sapato das cartas. Com um agente escolhido, Jogar leva ele até uma cadeira (o jogo abre no celular do jogador).' },
  { id: 'mesa_carteado', name: 'Mesa de Pôquer', category: 'mansao', kind: 'table_round', width: 2, depth: 2, height: 0.78, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#2f5a3a', '#141416', '#2f5a3a'], desc: 'Mesa octogonal de feltro verde, com fichas e cartas.' },
  { id: 'saco_pancada', name: 'Saco de Pancada', category: 'mansao', kind: 'saco', width: 1, depth: 1, height: 1.7, rotations: ALL, colors: ['#a82a22', '#3a3d42', '#a82a22'], desc: 'Saco de pancada de couro vermelho, com as luvas penduradas.' },
  { id: 'rack_halteres', name: 'Rack de Halteres', category: 'mansao', kind: 'rack', width: 2, depth: 1, height: 1.05, rotations: ALL, colors: ['#1a1a1e', '#8a9098', '#1a1a1e'], desc: 'Rack com pares de halteres e um banco.' },
  { id: 'tatame', name: 'Tatame', category: 'mansao', kind: 'rug', width: 3, depth: 3, height: 0.04, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#1f2f5a', '#141416', '#1f2f5a'], desc: 'Tatame azul-escuro, de placas de EVA.' },
  { id: 'mesa_ceo', name: 'Mesa do CEO', category: 'mansao', kind: 'desk', width: 4, depth: 2, height: 0.78, vao: 'fundo', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#2e1c10', '#2f5a3a', '#2e1c10'], desc: 'Mesa enorme de nogueira com tampo de couro, o abajur verde e a plaquinha de nome.' },
  { id: 'cadeira_ceo', name: 'Cadeira Executiva', category: 'mansao', kind: 'office_chair', width: 1, depth: 1, height: 0.52, sit: true, aumento: 1.2, rotations: ALL, colors: ['#141416', '#8a9098', '#141416'], desc: 'Poltrona executiva de couro preto capitonê.' },
  { id: 'trono_alexander', name: 'Trono do Escritório', category: 'mansao', kind: 'chair', width: 1, depth: 1, height: 0.52, sit: true, rotations: ALL, colors: ['#6a1420', '#b8902a', '#1c1416'], desc: 'Cadeira de espaldar altíssimo: ébano, veludo vinho capitonê, moldura e remates de ouro.' },
  { id: 'cofre', name: 'Cofre', category: 'mansao', kind: 'cofre', width: 1, depth: 1, height: 1.25, states: 2, rotations: ALL, colors: ['#2f3a30', '#b8902a', '#2f3a30'], desc: 'Cofre de aço verde-escuro, com a roda do segredo. Clique duplo abre e fecha.' },
  { id: 'globo', name: 'Globo Antigo', category: 'mansao', kind: 'globo', width: 1, depth: 1, height: 1.5, rotations: ALL, colors: ['#c8b48a', '#4a2a18', '#c8b48a'], desc: 'Globo terrestre antigo, no pedestal de madeira e latão.' },
  { id: 'bar_escritorio', name: 'Aparador-Bar', category: 'mansao', kind: 'sideboard', width: 2, depth: 1, height: 1.2, states: 2, stackable: true, rotations: ALL, colors: ['#2e1c10', '#cfe0e8', '#2e1c10'], desc: 'Aparador-bar de nogueira, com decanters de cristal. Clique duplo abre e fecha.' },
  { id: 'estante_biblioteca', name: 'Estante de Biblioteca', category: 'mansao', kind: 'bookshelf', width: 3, depth: 1, height: 2.9, rotations: ALL, colors: ['#2e1c10', '#6a1a24', '#2e1c10'], desc: 'Estante do chão ao teto, cheia de livros, com o trilho de latão.' },
  { id: 'escada_biblioteca', name: 'Escada de Biblioteca', category: 'mansao', kind: 'escada_biblio', width: 1, depth: 1, height: 2.6, rotations: ALL, colors: ['#2e1c10', '#b8902a', '#2e1c10'], desc: 'Escada de rodízio da biblioteca, de madeira escura e latão.' },
  { id: 'mesa_leitura', name: 'Mesa de Leitura', category: 'mansao', kind: 'table_big', width: 4, depth: 2, height: 0.78, vao: 'vazada', aumento: 1.2, stackable: true, rotations: ALL, colors: ['#2e1c10', '#2f5a3a', '#2e1c10'], desc: 'Mesa comprida de leitura, com dois abajures de banqueiro verdes.' },
  { id: 'touro_bronze', name: 'Touro de Bronze', category: 'mansao', kind: 'estatua', width: 1, depth: 1, height: 1.2, rotations: ALL, colors: ['#8a5a2a', '#141416', '#8a5a2a'], desc: 'O touro de bronze, mascote do Frigorífico, no pedestal de mármore preto.' },
];

export const WALL_FURNI_LIST: WallFurniDef[] = [
  { id: 'poster_sigil', name: 'Pôster de Sigilo', category: 'parede', kind: 'poster_sigil', w: 44, h: 56, colors: ['#cdbf9c', '#8a1010'] },
  { id: 'notes_wall', name: 'Anotações', category: 'parede', kind: 'notes', w: 40, h: 38, colors: ['#d8cdb0'] },
  { id: 'painting_coliseu', name: 'Pintura do Coliseu', category: 'parede', kind: 'painting', w: 101, h: 63, colors: ['#b8903a', '#8a6a4a'] },
  { id: 'board_detective', name: 'Quadro de Detetive', category: 'parede', kind: 'board', w: 152, h: 82, colors: ['#8a6a44', '#b3261e'] },
  { id: 'board_investigation', name: 'Quadro de Investigação', category: 'parede', kind: 'board', w: 76, h: 50, colors: ['#6b4a2e', '#b3261e'] },
  // a janela da cozinha da fazenda (14/10): pixel art feita por código (scripts/3d/estilo/exportar_parede_px.py)
  { id: 'janela_cozinha', name: 'Janela com Cortina', category: 'parede', kind: 'janela_sol', w: 64, h: 70, states: 3, colors: ['#9a5e36', '#bfe0f0', '#f0dfbf'], desc: 'Janela de madeira para o pasto, com a cortina de linho e o varão de ferro. Clique duplo: aberta (a cortina balança no vento), fechada e fechada com a cortina.' },
  // a teia de aranha de canto (14/10), pixel art por código (scripts/3d/estilo/teia_px.py), tremendo de leve
  { id: 'teia', name: 'Teia de Aranha', category: 'parede', kind: 'teia', w: 36, h: 30, colors: ['#807868'], desc: 'Teia velha no canto do teto, cheia de poeira.' },
  { id: 'window_barred', name: 'Janela Gradeada', category: 'parede', kind: 'window', w: 44, h: 54, states: 2, colors: ['#1c2a3a', '#5fa8ff'] },
  { id: 'sconce', name: 'Arandela de Velas', category: 'parede', kind: 'sconce', w: 16, h: 28, states: 2, colors: ['#8a6a2a', '#e8dcc0'] },
  { id: 'door_sealed', name: 'Porta Selada', category: 'parede', kind: 'door_sealed', w: 40, h: 122, colors: ['#5a1414', '#8a1010'] },
  { id: 'pipes', name: 'Tubulação', category: 'parede', kind: 'pipes', w: 64, h: 22, colors: ['#3a3d42'] },
  { id: 'wall_shelf', name: 'Prateleira de Parede', category: 'parede', kind: 'wall_shelf', w: 48, h: 26, colors: ['#3d2819'] },
  { id: 'antlers', name: 'Crânio de Cervo', category: 'parede', kind: 'antlers', w: 40, h: 34, colors: ['#d8cfb8'] },
  { id: 'emergency_light', name: 'Luz de Emergência', category: 'parede', kind: 'emergency', w: 22, h: 16, states: 2, colors: ['#2a2d31', '#ff2a1a'], desc: 'Continua acesa no apagão.' },
  { id: 'clock', name: 'Relógio de Parede', category: 'parede', kind: 'clock', w: 22, h: 22, colors: ['#2a2420', '#d8cfb8'] },
  { id: 'placa_numero', name: 'Número da Porta', category: 'parede', kind: 'placa_numero', w: 26, h: 16, colors: ['#2c5a92', '#f2eee4'], desc: 'A plaquinha de esmalte azul com o número do apartamento.' },
  { id: 'tv_wall', name: 'TV de Tubo', category: 'parede', kind: 'tv', w: 26, h: 34, states: 2, colors: ['#3a3d42', '#7ad08a'], desc: 'TV velha no suporte, passando futebol. Clique duplo liga/desliga.' },
  { id: 'fan_wall', name: 'Ventilador de Parede', category: 'parede', kind: 'fan', w: 24, h: 30, colors: ['#d8c8a0', '#8a8e92'] },
  { id: 'painting', name: 'Quadro Antigo', category: 'parede', kind: 'painting', w: 44, h: 36, colors: ['#b8903a', '#3a2a1a'] },
  { id: 'neon_bar', name: 'Letreiro Neon', category: 'parede', kind: 'neon', w: 64, h: 26, states: 2, colors: ['#ff4f9a', '#ffd0e6'], desc: 'Clique duplo liga/desliga.' },
  { id: 'dartboard', name: 'Alvo de Dardos', category: 'parede', kind: 'dartboard', w: 28, h: 28, colors: ['#1a1a1a', '#b3261e', '#d8cfb8'] },
  { id: 'screen', name: 'Tela de Projeção', category: 'parede', kind: 'screen', w: 92, h: 58, states: 2, colors: ['#e8e4dc', '#2a2d31'], desc: 'Clique duplo liga/desliga o projetor.' },
  { id: 'mirror', name: 'Espelho', category: 'parede', kind: 'mirror', w: 30, h: 40, colors: ['#9ab0b8', '#2a2622'] },
  { id: 'monitor_wall', name: 'Painel de Monitoramento', category: 'parede', kind: 'tv', w: 61, h: 52, states: 2, colors: ['#3a3d42', '#d8e0e8'], desc: 'Quatro monitores com as câmeras da Sede. Clique duplo liga/desliga.' },
  { id: 'ac_wall', name: 'Ar-condicionado', category: 'parede', kind: 'fan', w: 38, h: 17, colors: ['#d8ccb0'] },
  { id: 'shelf_wall', name: 'Prateleira de Parede', category: 'parede', kind: 'shelf', w: 42, h: 20, colors: ['#8a6a4a'], desc: 'Manuais, um rádio e um telefone velho.' },
  { id: 'cage_lamp', name: 'Luminária de Grade', category: 'parede', kind: 'cage_lamp', w: 15, h: 18, states: 2, colors: ['#5a5a50', '#ffd9a0'], desc: 'Lâmpada protegida por grade de ferro. Clique duplo acende/apaga.' },
  { id: 'tally_marks', name: 'Marcas de Contagem', category: 'parede', kind: 'board', w: 29, h: 23, colors: ['#3a3630'], desc: 'Os dias contados, riscados na parede.' },
  { id: 'cctv', name: 'Câmera de Segurança', category: 'parede', kind: 'board', w: 20, h: 24, colors: ['#c8c0b0', '#ff2a1a'], desc: 'O ledzinho vermelho nunca apaga.' },
  { id: 'notice_board', name: 'Quadro de Avisos', category: 'parede', kind: 'board', w: 52, h: 35, colors: ['#8a5a3a', '#d8c8a0'] },
  { id: 'power_box', name: 'Caixa de Força', category: 'parede', kind: 'board', w: 23, h: 29, colors: ['#8a8a84', '#2a2a2a'] },
  { id: 'tool_board', name: 'Painel de Ferramentas', category: 'parede', kind: 'board', w: 58, h: 41, colors: ['#5a6a3a', '#b3261e'], desc: 'Chaves, alicates, uma lanterna e fita.' },
  { id: 'blade_rack', name: 'Suporte de Armas Brancas', category: 'parede', kind: 'board', w: 58, h: 35, colors: ['#5a6a3a', '#8a6a4a'], desc: 'Facão, machado, duas facas e um bastão.' },
  { id: 'target_paper', name: 'Alvo de Papel', category: 'parede', kind: 'poster_sigil', w: 29, h: 46, colors: ['#e8d8b0', '#2a2a2a'], desc: 'A silhueta furada de bala.' },
  { id: 'towel_dispenser', name: 'Papeleira', category: 'parede', kind: 'dispenser', w: 18, h: 22, colors: ['#e8e4dc'] },
  { id: 'extinguisher', name: 'Extintor', category: 'parede', kind: 'extinguisher', w: 12, h: 30, colors: ['#b3261e', '#1a1a1a'] },
  // Câmara do Selo
  { id: 'chains_wall', name: 'Correntes com Algemas', category: 'parede', kind: 'board', w: 28, h: 52, colors: ['#5a3a24', '#2a1d14'], desc: 'Correntes enferrujadas presas por argolas, com as algemas abertas.' },
  { id: 'crack_glow', name: 'Rachadura Dourada', category: 'parede', kind: 'crack', w: 38, h: 92, colors: ['#ffc45a', '#1a1410'], desc: 'Uma rachadura funda; lá dentro, uma luz dourada fraca.' },
  { id: 'sigil_scratch', name: 'Sigilo Riscado', category: 'parede', kind: 'board', w: 28, h: 35, colors: ['#2a2622', '#8a8078'], desc: 'Riscos fundos na pedra, em espiral, como feitos à unha.' },
  { id: 'estandarte_sangue', name: 'Estandarte de Sangue', category: 'parede', kind: 'board', w: 40, h: 80, colors: ['#5a0d0d', '#2a1d14'], desc: 'Um estandarte velho de pano, com um sigilo pintado em sangue.' },
  { id: 'tocha_parede', name: 'Tocha de Parede', category: 'parede', kind: 'sconce', w: 14, h: 34, colors: ['#4a3a2a', '#ffb050'], desc: 'Uma tocha acesa presa na parede de pedra.' },
  { id: 'painel_telas', name: 'Painel de Telas', category: 'parede', kind: 'tv', w: 100, h: 56, states: 2, colors: ['#141418', '#5ad8ff'], desc: 'Clique duplo liga/desliga.' },
  { id: 'mural_polaroids', name: 'Mural de Polaroids', category: 'parede', kind: 'board', w: 46, h: 31, colors: ['#8a6a4a', '#e8e0d0'] },
  { id: 'tela_cris', name: 'Tela do C.R.I.S', category: 'parede', kind: 'tv', w: 130, h: 72, colors: ['#0a1420', '#3fd0ff'], desc: 'A tela enorme do C.R.I.S, o sistema da Ordem que procura o paranormal.' },
  { id: 'tela_derrota', name: 'Tela de Derrota', category: 'parede', kind: 'tv', w: 56, h: 34, states: 2, colors: ['#141418', '#ff5a5a'], desc: 'Um monitor na parede travado na tela de DERROTA de algum jogo. Clique duplo liga/desliga.' },
  { id: 'scanner_digital', name: 'Leitor de Digital', category: 'parede', kind: 'power_box', w: 10, h: 14, colors: ['#2a2d33', '#3fd0ff'] },
  { id: 'tv_grande', name: 'TV Grande', category: 'parede', kind: 'tv', w: 72, h: 42, states: 2, colors: ['#141418', '#3a5a8a'], desc: 'TV de tela fina, grande, presa na parede. Clique duplo liga/desliga.' },
  { id: 'quadro_fazenda', name: 'Quadro da Fazenda', category: 'parede', kind: 'painting', w: 36, h: 30, colors: ['#8a6a3a', '#3a2a1a'], desc: 'Um dos doze quadros do casarão: o pasto, a família em sépia, o cavalo, o bordado, o rio na neblina...' },
  { id: 'escrita_sangue', name: 'Escrita de Sangue', category: 'parede', kind: 'escrita', w: 340, h: 136, colors: ['#c81414'], desc: 'Frases escritas com sangue na parede, à mão.' },
  { id: 'fuligem_parede', name: 'Fuligem na Parede', category: 'parede', kind: 'fuligem', w: 70, h: 110, colors: ['#0f0c0a'], desc: 'As marcas pretas que o fogo deixou subindo pela parede.' },
  { id: 'utensilios_parede', name: 'Utensílios Pendurados', category: 'parede', kind: 'utensilios', w: 64, h: 40, colors: ['#5a3a24', '#9aa0a8'], desc: 'A régua de madeira com ganchos: frigideiras, conchas, escumadeiras, colheres de pau e uma peneira.' },
  // Santo Berço (14/10)
  { id: 'lampiao_cristal', name: 'Lampião de Cristal', category: 'parede', kind: 'lampiao_cristal', w: 18, h: 30, states: 2, colors: ['#3a2a1e', '#ff5a3a'], desc: 'O lampião de ferro com o cristal vermelho dentro: a luz de dentro das casas. Clique duplo cobre e descobre.' },
  { id: 'armas_parede', name: 'Escudo e Espadas', category: 'parede', kind: 'armas_parede', w: 60, h: 46, colors: ['#8a2a22', '#a8a8b0'], desc: 'O escudo redondo com duas espadas cruzadas atrás.' },
  { id: 'ferramentas_parede', name: 'Ferramentas da Forja', category: 'parede', kind: 'ferramentas_parede', w: 64, h: 36, colors: ['#5a3a24', '#5a5a60'], desc: 'A tábua com os ganchos: tenazes, martelos e ferraduras.' },
  { id: 'placa_taverna', name: 'Cardápio da Taverna', category: 'parede', kind: 'placa', w: 40, h: 34, colors: ['#6a4a2c', '#e8dcc0'], desc: 'O prato do dia escrito a giz ("Manteiga na Manteiga"). Nada se paga.' },
  // ---------- SANTO BERÇO (15/10) ----------
  { id: 'quadro_hoteleiro', name: 'Retrato de Hoteleiro', category: 'parede', kind: 'painting', w: 34, h: 44, colors: ['#9a7028', '#3a2a1a'], desc: 'Um dos quatro retratos dos Hoteleiros no hall: o mesmo sorriso em quatro rostos, e os olhos que seguem quem passa.' },
  { id: 'quadro_chaves', name: 'Quadro das Chaves', category: 'parede', kind: 'board', w: 48, h: 34, colors: ['#5a3a24', '#c8a040'], desc: 'A tábua com os ganchos e as chaves de ferro dos quartos, cada uma com a plaqueta do número.' },
  { id: 'veio_cristal_verde', name: 'Veio de Cristal Verde', category: 'parede', kind: 'crack', w: 50, h: 60, colors: ['#5aff8a', '#1a3a24'], desc: 'Os cristais verdes brotando da rocha da galeria, acesos.' },
  { id: 'veio_cristal_vermelho', name: 'Veio de Cristal Vermelho', category: 'parede', kind: 'crack', w: 50, h: 60, colors: ['#ff6a3a', '#3a1a14'], desc: 'Os cristais vermelhos brotando da rocha da galeria, quentes.' },
  { id: 'veio_cristal_azul', name: 'Veio de Cristal Azul', category: 'parede', kind: 'crack', w: 50, h: 60, colors: ['#6ac8ff', '#1a2a3a'], desc: 'Os cristais azuis brotando da rocha da galeria, com a geada em volta.' },
  { id: 'morcegosas', name: 'Morcegosas', category: 'parede', kind: 'board', w: 56, h: 30, colors: ['#2a1e2a', '#d83a3a'], desc: 'Uma penca de Morcegosas penduradas no alto da galeria, de asa fechada, os olhinhos vermelhos abertos.' },
  { id: 'lodo_parede', name: 'Lodo Escorrendo', category: 'parede', kind: 'fuligem', w: 44, h: 96, colors: ['#0a080c', '#5a3a7a'], desc: 'O lodo preto escorrendo pela pedra em fios grossos, brilhando como se tivesse luz por dentro.' },
  // ---------- TIRADENTES (15/10) ----------
  { id: 'oratorio', name: 'Oratório', category: 'parede', kind: 'painting', w: 26, h: 40, colors: ['#2f5a8a', '#e2b24a'], desc: 'O oratório mineiro de madeira pintada, as portinholas abertas, a santinha de manto azul e a vela na mísula.' },
  // ---------- SANTA AMÁLIA (17/10) ----------
  { id: 'desenho_espiral_parede', name: 'Desenhos na Parede', category: 'parede', kind: 'painting', w: 40, h: 34, colors: ['#f0ece2', '#1a1a1a'], desc: 'As folhas presas com fita na parede, uma ao lado da outra, todas com a mesma espiral preta.' },
  { id: 'janela_vidro', name: 'Janela de Vidro', category: 'parede', kind: 'window', w: 56, h: 50, states: 3, colors: ['#e8e4dc', '#bfe0f0'], desc: 'A janela de alumínio e vidro, com a grade branca por fora. Clique duplo: aberta, fechada e fechada com a cortina.' },
  // ---------- MANSÃO ALBUQUERQUE (21/10) ----------
  { id: 'quadro_oleo_grande', name: 'Quadro a Óleo Grande', category: 'parede', kind: 'painting', w: 81, h: 60, colors: ['#b8902a', '#3a4a5a'], desc: 'Pintura a óleo em moldura dourada entalhada (paisagem, caçada ou natureza-morta).' },
  { id: 'retrato_nobre', name: 'Retrato a Óleo', category: 'parede', kind: 'painting', w: 43, h: 63, colors: ['#b8902a', '#2a2420'], desc: 'Retrato a óleo de gente da família, em moldura dourada.' },
  { id: 'retrato_familia', name: 'Retrato da Família', category: 'parede', kind: 'painting', w: 43, h: 63, colors: ['#b8902a', '#2a2420', '#c4521e'], desc: 'Retrato a óleo da família Albuquerque, de uma das gerações, em moldura dourada.' },
  { id: 'pintura_mestre', name: 'Tela de Mestre', category: 'parede', kind: 'painting', w: 68, h: 63, colors: ['#b8902a', '#2a3a4a', '#c8962c'], desc: 'Tela a óleo de mestre em moldura de museu: a marinha, a paisagem, as flores, o lago ou o canal.' },
  { id: 'tela_abstrata', name: 'Tela Abstrata', category: 'parede', kind: 'painting', w: 94, h: 78, colors: ['#16161a', '#14204a', '#c88a2a'], desc: 'A tela moderna grande na moldura preta de galeria.' },
  { id: 'espelho_dourado', name: 'Espelho Dourado', category: 'parede', kind: 'mirror', w: 34, h: 60, colors: ['#b8902a', '#cfe0e8'], desc: 'Espelho de moldura dourada trabalhada.' },
  { id: 'janela_moderna', name: 'Janela com Cortina de Linho', category: 'parede', kind: 'janela_sol', w: 67, h: 110, states: 2, colors: ['#1e1e22', '#e6decc'], desc: 'A janela alta de caixilho preto com a cortina de linho claro no trilho. Clique duplo abre e fecha a cortina.' },
  { id: 'janela_cortinas', name: 'Janela com Cortinas', category: 'parede', kind: 'janela_sol', w: 67, h: 110, states: 2, colors: ['#e8e4dc', '#6a1a24'], desc: 'Janela alta com cortinas pesadas. Clique duplo abre e fecha as cortinas.' },
  { id: 'painel_trofeus', name: 'Painel de Troféus', category: 'parede', kind: 'painting', w: 192, h: 104, colors: ['#c8a878', '#d8b038'], desc: 'O painel de troféus e medalhas da Catarina, de todas as competições que ela disputou.' },
  { id: 'fita_led', name: 'Fita de LED', category: 'parede', kind: 'led', w: 96, h: 10, states: 2, colors: ['#b05ae0', '#6ac8ff'], desc: 'Fita de LED na parede. Clique duplo acende e apaga.' },
  { id: 'medalhas_cabide', name: 'Medalhas no Cabide', category: 'parede', kind: 'painting', w: 44, h: 34, colors: ['#4a2a18', '#d8b038'], desc: 'Barra de madeira com medalhas penduradas.' },
  { id: 'poster_esgrima', name: 'Pôster de Esgrima', category: 'parede', kind: 'painting', w: 30, h: 46, colors: ['#e8e4dc', '#2a2a34'], desc: 'Pôster de esgrima.' },
  { id: 'luvas_parede', name: 'Luvas de Boxe', category: 'parede', kind: 'painting', w: 28, h: 30, colors: ['#a82a22', '#3a3d42'], desc: 'Par de luvas de boxe penduradas, uma com espinhos de metal.' },
  { id: 'mapa_frigorifico', name: 'Mapa das Unidades', category: 'parede', kind: 'painting', w: 84, h: 58, colors: ['#d8c8a0', '#a82a22'], desc: 'Mapa do Brasil com os alfinetes das unidades do Frigorífico Albuquerque.' },
  { id: 'foto_unidade', name: 'Foto Aérea da Unidade', category: 'parede', kind: 'painting', w: 64, h: 42, colors: ['#4a2a18', '#c8b48a'], desc: 'Foto aérea emoldurada de uma unidade do frigorífico.' },
  { id: 'placa_frigorifico', name: 'Placa do Frigorífico', category: 'parede', kind: 'painting', w: 60, h: 24, colors: ['#b8902a', '#2f5a3a'], desc: 'A placa de bronze e esmalte do Frigorífico Albuquerque, 1918.' },
  { id: 'diplomas', name: 'Diplomas', category: 'parede', kind: 'painting', w: 52, h: 36, colors: ['#e8dcc0', '#a82a22'], desc: 'Três diplomas emoldurados.' },
  { id: 'trofeus_empresa', name: 'Vitrine de Prêmios', category: 'parede', kind: 'painting', w: 90, h: 48, colors: ['#4a2a18', '#cfe0e8'], desc: 'Vitrine de parede com os prêmios da empresa.' },
];

/** Metros → unidades de altura (duas casas). */
export const toUnits = (m: number) => Math.round(m * Z_PER_M * 100) / 100;

/** A pilha do que alguém largou no chão (docs/REGRAS.md, Mochila). */
export const PILHA_CHAO = 'pilha_chao';

/** Os tipos de móvel em que a peça deita (a cama, o leito do hospital, o beliche). */
const CAMAS = new Set(['bed', 'hospital_bed', 'beliche']);

export const FURNI_LIST: FurniDef[] = FURNI_METERS.map((d) => ({
  ...d,
  height: toUnits(d.height),
  ...(d.leitos ? { leitos: d.leitos.map(toUnits) } : {}),
  ...(d.alturas ? { alturas: d.alturas.map((l) => l.map(toUnits)) } : {}),
  ...(CAMAS.has(d.kind) ? { sit: true, deita: true } : {}),
}));

export const FURNI: Record<string, FurniDef> = Object.fromEntries(FURNI_LIST.map((d) => [d.id, d]));
export const WALL_FURNI: Record<string, WallFurniDef> = Object.fromEntries(WALL_FURNI_LIST.map((d) => [d.id, d]));

export function getFurni(id: string): FurniDef | undefined {
  return FURNI[id];
}

export function getWallFurni(id: string): WallFurniDef | undefined {
  return WALL_FURNI[id];
}

export function isWallDef(id: string): boolean {
  return id in WALL_FURNI;
}

export function anyFurniName(id: string): string {
  return FURNI[id]?.name ?? WALL_FURNI[id]?.name ?? id;
}

/** Tamanho ocupado no grid para uma rotação. */
export function footprint(def: Pick<FurniDef, 'width' | 'depth'>, rot: number): { sx: number; sy: number } {
  return rot === 2 || rot === 6 ? { sx: def.depth, sy: def.width } : { sx: def.width, sy: def.depth };
}

/**
 * A peça ocupa a casa (dx, dy) da pegada na rotação dada? Só as de `vazio` ficam de fora.
 * Giro 4: a frente para +y; 0: para -y; 2: para +x; 6: para -x.
 */
export function ocupa(def: Pick<FurniDef, 'width' | 'depth' | 'vazio'>, rot: number, dx: number, dy: number): boolean {
  if (!def.vazio?.length) return true;
  const W = def.width;
  const D = def.depth;
  let u: number;
  let v: number;
  if (rot === 4) [u, v] = [dx, dy];
  else if (rot === 0) [u, v] = [W - 1 - dx, D - 1 - dy];
  else if (rot === 2) [u, v] = [W - 1 - dy, dx];
  else [u, v] = [dy, D - 1 - dx];
  return !def.vazio.some(([a, b]) => a === u && b === v);
}

/** A altura de cima da peça na casa (dx, dy) da pegada, no giro dado (em unidades): a do `alturas`, ou o `height`. */
export function alturaNaCasa(def: Pick<FurniDef, 'width' | 'depth' | 'height' | 'alturas'>, rot: number, dx: number, dy: number): number {
  if (!def.alturas?.length) return def.height;
  const W = def.width;
  const D = def.depth;
  let u: number;
  let v: number;
  if (rot === 4) [u, v] = [dx, dy];
  else if (rot === 0) [u, v] = [W - 1 - dx, D - 1 - dy];
  else if (rot === 2) [u, v] = [W - 1 - dy, dx];
  else [u, v] = [dy, D - 1 - dx];
  return def.alturas[v]?.[u] ?? def.height;
}

export function nextRotation(def: FurniDef, rot: number): number {
  const i = def.rotations.indexOf(rot);
  return def.rotations[(i + 1) % def.rotations.length] ?? def.rotations[0];
}

/**
 * O próximo giro que cabe (14/10): se o de 90° não cabe (a peça comprida num corredor), pula para o seguinte, e assim
 * a peça ao menos inverte o lado (180°). Null quando nenhum outro giro cabe.
 */
export function giroQueCabe(def: FurniDef, rot: number, cabe: (rot: number) => boolean): number | null {
  let r = rot;
  for (let i = 1; i < def.rotations.length; i++) {
    r = nextRotation(def, r);
    if (r !== rot && cabe(r)) return r;
  }
  return null;
}
