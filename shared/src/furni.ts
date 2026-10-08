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
  | 'parede';

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
  leitos?: number[];
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
  /** os lados abertos da peça vazada (a cortina não tem o fundo; a mesa em U não tem a frente) */
  aberto?: ('fundo' | 'frente')[];
  rotations: number[];
  colors: string[];
  desc?: string;
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
  { id: 'desk_wood', name: 'Mesa de Escritório', category: 'escritorio', kind: 'desk', width: 2, depth: 1, height: 0.8, stackable: true, rotations: ALL, colors: ['#4b3120', '#2f1f15', '#b8955a'] },
  { id: 'desk_metal', name: 'Mesa Metálica', category: 'escritorio', kind: 'desk', width: 2, depth: 1, height: 0.8, stackable: true, rotations: ALL, colors: ['#3c4046', '#2a2d31', '#8a9098'] },
  { id: 'chair_office', name: 'Cadeira de Escritório', category: 'escritorio', kind: 'office_chair', width: 1, depth: 1, height: 0.5, sit: true, rotations: ALL, colors: ['#242329', '#131216'] },
  { id: 'monitor', name: 'Monitor', category: 'escritorio', kind: 'monitor', width: 1, depth: 1, height: 0.45, states: 2, rotations: ALL, colors: ['#1b1d21', '#5fd3ff'], desc: 'Clique duplo liga/desliga.' },
  { id: 'monitor_green', name: 'Monitor de Radar', category: 'escritorio', kind: 'monitor', width: 1, depth: 1, height: 0.42, states: 2, rotations: ALL, colors: ['#1b1d21', '#4fe39a'] },
  // a enfermaria tem os dela (com arte): o monitor do radar, os frascos do laboratório e os computadores dos outros cômodos ficam como estão
  { id: 'vitals_monitor', name: 'Monitor de Sinais Vitais', category: 'saude', kind: 'monitor', width: 1, depth: 1, height: 0.34, states: 2, rotations: ALL, colors: ['#1b1d21', '#4fe39a'], desc: 'A linha verde do batimento.' },
  { id: 'med_tray', name: 'Bandeja de Remédios', category: 'saude', kind: 'flasks', width: 1, depth: 1, height: 0.16, rotations: ALL, colors: ['#c8ccd0', '#8a5a2a', '#e8eef2'], desc: 'Frascos, seringas e algodão numa bandeja de inox.' },
  { id: 'computer_old', name: 'Computador Antigo', category: 'escritorio', kind: 'monitor', width: 1, depth: 1, height: 0.42, states: 2, rotations: ALL, colors: ['#c8b89a', '#3f7fff'], desc: 'Monitor de tubo bege e teclado. Clique duplo liga/desliga.' },
  { id: 'keyboard', name: 'Teclado', category: 'escritorio', kind: 'keyboard', width: 1, depth: 1, height: 0.05, stackable: true, rotations: ALL, colors: ['#18181b'] },
  { id: 'papers', name: 'Papéis Espalhados', category: 'escritorio', kind: 'papers', width: 1, depth: 1, height: 0.02, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#d8cdb0'] },
  { id: 'mug', name: 'Caneca', category: 'escritorio', kind: 'mug', width: 1, depth: 1, height: 0.2, rotations: ALL, colors: ['#d8d2c4'] },
  { id: 'cabinet_file', name: 'Arquivo de Aço', category: 'escritorio', kind: 'file_cabinet', width: 1, depth: 1, height: 1.35, stackable: true, states: 2, rotations: ALL, colors: ['#4b5057', '#34383d', '#c9c0a4'], desc: 'Clique duplo abre a gaveta.' },

  // ---------- Mobília ----------
  { id: 'table_meeting', name: 'Mesa de Reunião', category: 'mobilia', kind: 'table_big', width: 3, depth: 2, height: 0.8, stackable: true, rotations: ALL, colors: ['#3f2a1b', '#2b1c12', '#9a7a4a'] },
  { id: 'table_small', name: 'Mesinha', category: 'mobilia', kind: 'table', width: 1, depth: 1, height: 0.55, stackable: true, rotations: ALL, colors: ['#4b3120', '#2f1f15'] },
  { id: 'chair_wood', name: 'Cadeira de Madeira', category: 'mobilia', kind: 'chair', width: 1, depth: 1, height: 0.46, sit: true, rotations: ALL, colors: ['#5a3a24', '#3d2718'] },
  { id: 'stool', name: 'Banqueta', category: 'mobilia', kind: 'stool', width: 1, depth: 1, height: 0.55, sit: true, rotations: ALL, colors: ['#3a2a24', '#1d1a18'] },
  { id: 'stool_lab', name: 'Banqueta de Laboratório', category: 'laboratorio', kind: 'stool', width: 1, depth: 1, height: 0.62, sit: true, rotations: ALL, colors: ['#1d1d1f', '#8d949c'], desc: 'Assento de vinil preto, rodinhas e o anel de apoio dos pés.' },
  { id: 'sofa_leather', name: 'Sofá de Couro', category: 'mobilia', kind: 'sofa', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#4a2320'] },
  { id: 'rug_worn', name: 'Tapete Gasto', category: 'mobilia', kind: 'rug', width: 2, depth: 3, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#4a1c1c', '#8a6a3a'] },

  // ---------- Laboratório ----------
  { id: 'lab_bench', name: 'Bancada de Laboratório', category: 'laboratorio', kind: 'lab_bench', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#2f3338', '#8d949c', '#cfcabd'] },
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
  { id: 'skull', name: 'Crânio', category: 'ocultismo', kind: 'skull', width: 1, depth: 1, height: 0.3, rotations: ALL, colors: ['#d8cfb8'] },
  { id: 'table_tools', name: 'Mesa das Ferramentas', category: 'ocultismo', kind: 'desk', width: 2, depth: 1, height: 0.8, stackable: true, rotations: ALL, colors: ['#4a3020', '#2e1d12', '#9a7a4a'], desc: 'Mesa rústica com a faca cerimonial, o giz, a tigela, a corda e as velas.' },
  { id: 'books_stack', name: 'Pilha de Livros', category: 'ocultismo', kind: 'books', width: 1, depth: 1, height: 0.4, stackable: true, rotations: ALL, colors: ['#5a2320', '#2f3f5a', '#4a4a2a'] },
  { id: 'bookshelf', name: 'Estante de Livros', category: 'ocultismo', kind: 'bookshelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#3d2819', '#2a1b11'] },

  // ---------- Iluminação ----------
  { id: 'candles', name: 'Velas', category: 'iluminacao', kind: 'candles', width: 1, depth: 1, height: 0.35, states: 2, rotations: ALL, colors: ['#e8dcc0'], desc: 'Clique duplo acende/apaga.' },
  { id: 'candelabra', name: 'Candelabro', category: 'iluminacao', kind: 'candelabra', width: 1, depth: 1, height: 1.6, states: 2, rotations: ALL, colors: ['#8a6a2a', '#e8dcc0'] },
  { id: 'desk_lamp', name: 'Luminária de Mesa', category: 'iluminacao', kind: 'desk_lamp', width: 1, depth: 1, height: 0.45, states: 2, rotations: ALL, colors: ['#2a2a2a', '#ffc46b'] },
  { id: 'floor_lamp', name: 'Luminária de Chão', category: 'iluminacao', kind: 'floor_lamp', width: 1, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#2a2a2a', '#e8c98a'] },

  // ---------- Armazenamento ----------
  { id: 'shelf_metal', name: 'Estante de Metal', category: 'armazenamento', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#3a3d42', '#23262a'] },
  { id: 'locker', name: 'Armário de Metal', category: 'armazenamento', kind: 'locker', width: 1, depth: 1, height: 1.95, states: 2, rotations: ALL, colors: ['#3d4148', '#2a2d32'], desc: 'Clique duplo abre a porta.' },
  { id: 'pilha_chao', name: 'Itens no Chão', category: 'armazenamento', kind: 'pilha', width: 1, depth: 1, height: 0.12, walkable: true, interno: true, rotations: [0], colors: ['#5c4630', '#2e241a'], desc: 'O que alguém largou aqui. Quem passar pode pegar.' },
  { id: 'crate_wood', name: 'Caixote de Madeira', category: 'armazenamento', kind: 'crate', width: 1, depth: 1, height: 0.8, stackable: true, rotations: ALL, colors: ['#6b4a2e', '#4a321f'] },
  { id: 'crate_metal', name: 'Caixa Metálica', category: 'armazenamento', kind: 'crate_metal', width: 1, depth: 1, height: 0.8, stackable: true, rotations: ALL, colors: ['#35393f', '#24272b', '#7a6a4a'] },
  { id: 'chest_military', name: 'Baú Militar Grande', category: 'armazenamento', kind: 'chest', width: 2, depth: 1, height: 0.7, stackable: true, rotations: ALL, colors: ['#3e3a2c', '#2a271e', '#8a8060'] },
  { id: 'chest_army', name: 'Baú Militar', category: 'arsenal', kind: 'chest', width: 1, depth: 1, height: 0.45, stackable: true, states: 2, rotations: ALL, colors: ['#5a6a2a', '#2a2d1e', '#8a7a5a'], desc: 'Madeira e metal verde-oliva. Clique duplo abre: coletes e lanternas dentro.' },
  { id: 'ammo_box', name: 'Caixa de Munição', category: 'arsenal', kind: 'crate_metal', width: 1, depth: 1, height: 0.3, stackable: true, rotations: ALL, colors: ['#4a5a2a', '#2a2d1e', '#8a7a5a'] },
  { id: 'barrel', name: 'Barril', category: 'armazenamento', kind: 'barrel', width: 1, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#3a3f2e', '#1f2219'] },

  // ---------- Decoração ----------
  { id: 'plant', name: 'Planta', category: 'decoracao', kind: 'plant', width: 1, depth: 1, height: 1.2, rotations: ALL, colors: ['#2f5a2a', '#3d2a1e'] },
  { id: 'pillar', name: 'Pilar de Concreto', category: 'decoracao', kind: 'pillar', width: 1, depth: 1, height: 2.75, rotations: [0], colors: ['#4a4540'] },
  { id: 'iwall', name: 'Parede Interna', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 2.4, xray: true, rotations: ALL, colors: ['#3b342f'], desc: 'Monte cômodos. Fica transparente quando você passa atrás.' },
  { id: 'iwall_low', name: 'Divisória Baixa', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 1.3, xray: true, rotations: ALL, colors: ['#4a433c'], desc: 'Meia parede: separa baias sem esconder quem está dentro.' },
  { id: 'stall_panel', name: 'Divisória de Cabine', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 1.6, xray: true, rotations: ALL, colors: ['#c8b89a'], desc: 'Painel de fórmica entre os vasos do banheiro.' },
  { id: 'trash_bin', name: 'Lixeira', category: 'saude', kind: 'crate', width: 1, depth: 1, height: 0.4, rotations: ALL, colors: ['#d8d0c0', '#8a8478'] },
  { id: 'trash_can', name: 'Lixeira de Metal', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#8a8478', '#5a4a3a'], desc: 'Redonda, amassada, de tampa basculante.' },
  { id: 'locker_row', name: 'Armários de Vestiário', category: 'armazenamento', kind: 'locker', width: 2, depth: 1, height: 1.9, rotations: ALL, colors: ['#6a6e66', '#3a3d38'], desc: 'Três portas estreitas com cadeado.' },
  { id: 'janitor_cart', name: 'Carrinho de Limpeza', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 1.1, rotations: ALL, colors: ['#e8c020', '#2a2a2a'], desc: 'Balde, esfregão, borrifadores e o saco de lixo.' },
  { id: 'wet_sign', name: 'Placa de Piso Molhado', category: 'decoracao', kind: 'crate', width: 1, depth: 1, height: 0.6, rotations: ALL, colors: ['#e8c020', '#2a2a2a'] },
  { id: 'puddle', name: 'Poça de Água', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#5a6a7a', '#8aa0b0'] },
  { id: 'compass_floor', name: 'Rosa dos Ventos', category: 'mobilia', kind: 'rug', width: 3, depth: 3, height: 0.02, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#8a6a2a', '#c9a86a'], desc: 'Gravada em bronze no chão do Salão.' },
  { id: 'iwall_door', name: 'Parede com Vão', category: 'estrutura', kind: 'iwall_door', width: 1, depth: 1, height: 0, walkable: true, xray: true, rotations: ALL, colors: ['#3b342f', '#2a1d14'] },
  { id: 'iwall_window', name: 'Parede com Janela', category: 'estrutura', kind: 'iwall_window', width: 1, depth: 1, height: 2.4, xray: true, rotations: ALL, colors: ['#3b342f', '#2a1d14'] },
  { id: 'portal', name: 'Passagem', category: 'estrutura', kind: 'portal', width: 1, depth: 1, height: 0, walkable: true, portal: true, states: 3, openState: 0, rotations: ALL, colors: ['#2a1d14'], desc: 'Pare em cima para ir ao quarto ligado (o mestre escolhe o destino). Clique duplo: aberta, fechada, trancada; fechada ou trancada, ninguém passa.' },
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
  { id: 'fridge_drinks', name: 'Expositor de Bebidas', category: 'bar', kind: 'beer_fridge', width: 1, depth: 1, height: 2.0, rotations: [4, 2], colors: ['#26343a', '#cfeaff'], desc: 'Geladeira de porta de vidro, cheia de garrafas.' },
  { id: 'minibar', name: 'Frigobar', category: 'bar', kind: 'beer_fridge', width: 1, depth: 1, height: 0.9, stackable: true, rotations: [4, 2], colors: ['#3a3f44', '#ffe9b0'], desc: 'A geladeirinha de trás do balcão.' },
  { id: 'pool_table', name: 'Mesa de Sinuca', category: 'bar', kind: 'pool_table', width: 2, depth: 4, height: 0.85, stackable: true, rotations: ALL, colors: ['#3fae4a', '#4a2c1a'] },
  { id: 'jukebox', name: 'Jukebox', category: 'bar', kind: 'jukebox', width: 1, depth: 1, height: 1.6, states: 2, rotations: ALL, colors: ['#3a1a24', '#ff7ab0', '#ffb14a'], desc: 'Clique duplo liga/desliga.' },
  { id: 'arcade', name: 'Fliperama', category: 'bar', kind: 'jukebox', width: 1, depth: 1, height: 1.8, states: 2, rotations: ALL, colors: ['#16123a', '#6a5aff', '#5ad8ff'], desc: 'Fliperama de Tetris: a tela ilumina o bar inteiro. Clique duplo liga/desliga.' },
  { id: 'beer_crate', name: 'Engradado de Cerveja', category: 'bar', kind: 'crate', width: 1, depth: 1, height: 0.35, stackable: true, rotations: ALL, colors: ['#a8842e', '#5a4020'] },
  { id: 'chair_stack', name: 'Pilha de Cadeiras', category: 'bar', kind: 'crate', width: 1, depth: 1, height: 1.3, rotations: ALL, colors: ['#c99a2e', '#7a5a1a'], desc: 'Cadeiras de plástico empilhadas no canto.' },
  { id: 'bar_cabinet', name: 'Armarinho', category: 'bar', kind: 'nightstand', width: 1, depth: 1, height: 1.0, stackable: true, rotations: ALL, colors: ['#4a3020', '#c9a86a'] },
  { id: 'ashtray', name: 'Cinzeiro', category: 'bar', kind: 'mug', width: 1, depth: 1, height: 0.05, rotations: ALL, colors: ['#8a8a8a'] },
  { id: 'beer_glass', name: 'Copo', category: 'bar', kind: 'mug', width: 1, depth: 1, height: 0.15, rotations: ALL, colors: ['#e8d8a0'] },
  { id: 'stool_bar', name: 'Banqueta de Balcão', category: 'bar', kind: 'stool_high', width: 1, depth: 1, height: 0.75, sit: true, rotations: ALL, colors: ['#6a1a16', '#1d1a18'] },
  { id: 'table_bar', name: 'Mesa de Bar', category: 'bar', kind: 'table', width: 1, depth: 1, height: 0.75, stackable: true, rotations: ALL, colors: ['#b08a3a', '#4a3420'] },
  { id: 'chair_bar', name: 'Cadeira de Bar', category: 'bar', kind: 'chair', width: 1, depth: 1, height: 0.46, sit: true, rotations: ALL, colors: ['#a8842e', '#5a4020'] },
  { id: 'sofa_booth', name: 'Sofá Vermelho', category: 'bar', kind: 'sofa', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#7a1c1a'] },
  { id: 'armchair_red', name: 'Poltrona Vermelha', category: 'bar', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#8a1c1a'] },
  { id: 'sideboard', name: 'Aparador', category: 'bar', kind: 'table_big', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#4a3020', '#2e1d12', '#9a7a4a'], desc: 'Aparador de madeira escura, com garrafas e copos em cima.' },
  { id: 'keg', name: 'Barril de Chope', category: 'bar', kind: 'barrel', width: 1, depth: 1, height: 0.6, stackable: true, rotations: ALL, colors: ['#8a8e92', '#4a4e52'] },
  // dormitório
  { id: 'bed', name: 'Cama de Cela', category: 'mobilia', kind: 'bed', width: 1, depth: 3, height: 0.5, rotations: ALL, colors: ['#5a5a2e', '#2a2622', '#d8d0c0'] },
  { id: 'nightstand', name: 'Criado-Mudo', category: 'mobilia', kind: 'nightstand', width: 1, depth: 1, height: 0.6, stackable: true, rotations: ALL, colors: ['#4b3120', '#c9a86a'] },
  { id: 'bench', name: 'Banco de Madeira', category: 'mobilia', kind: 'bench', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#5a3a24', '#2a1d14'] },
  // salas
  { id: 'sofa_velvet', name: 'Sofá de Veludo', category: 'mobilia', kind: 'sofa', width: 2, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#8a74c0'] },
  { id: 'rug_purple', name: 'Carpete Roxo', category: 'mobilia', kind: 'rug', width: 3, depth: 4, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#3a1f5a', '#9a7ad0'] },
  { id: 'rug_ornate', name: 'Tapete Persa', category: 'mobilia', kind: 'rug', width: 3, depth: 4, height: 0.03, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#6a3016', '#d8a050'] },
  { id: 'table_round', name: 'Mesa Redonda', category: 'mobilia', kind: 'table_round', width: 2, depth: 2, height: 0.76, stackable: true, rotations: [0], colors: ['#5a3a20', '#2a1d14'] },
  { id: 'table_chess', name: 'Mesa de Xadrez', category: 'mobilia', kind: 'table_chess', width: 1, depth: 1, height: 0.72, stackable: true, rotations: ALL, colors: ['#2a2622', '#d8d0c0'] },
  { id: 'armchair', name: 'Poltrona', category: 'mobilia', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#2a2826'] },
  { id: 'chair_red', name: 'Cadeira Estofada', category: 'mobilia', kind: 'chair', width: 1, depth: 1, height: 0.46, sit: true, rotations: ALL, colors: ['#8a1c1a', '#2a1d14'] },
  { id: 'altar', name: 'Altar de Pedra', category: 'ocultismo', kind: 'altar', width: 2, depth: 1, height: 0.6, stackable: true, rotations: ALL, colors: ['#4a4540', '#7a0d0d'], desc: 'Altar baixo de pedra antiga, com cera escorrida e restos de oferendas.' },
  // o escritório do Veríssimo (peças inteiras, 06/10): madeira escura nobre e o vermelho, como um conjunto
  { id: 'shelf_verissimo', name: 'Estante do Veríssimo', category: 'escritorio', kind: 'bookshelf', width: 6, depth: 1, height: 2.6, rotations: ALL, colors: ['#4a2a18', '#2a1810'], desc: 'A estante que pega a parede inteira: livros de couro, pastas da Ordem, um globo, chaves antigas e, dobrado num canto, um pedaço de capuz amarelo.' },
  { id: 'desk_verissimo', name: 'Mesa do Veríssimo', category: 'escritorio', kind: 'desk', width: 3, depth: 2, height: 0.8, stackable: true, rotations: ALL, colors: ['#4a2a18', '#2a1810', '#3f7a3a'], desc: 'A grande mesa de madeira entalhada, cheia de livros, pastas de casos e a luminária verde.' },
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
  { id: 'medical_cabinet', name: 'Armário de Remédios', category: 'saude', kind: 'medical_cabinet', width: 2, depth: 1, height: 1.9, rotations: ALL, colors: ['#d8dcdf', '#b3261e'] },
  { id: 'divider', name: 'Divisória Hospitalar', category: 'saude', kind: 'divider', width: 1, depth: 1, height: 1.6, xray: true, rotations: ALL, colors: ['#c9d4c8', '#8a9098'] },
  // arsenal
  { id: 'weapon_rack', name: 'Armário de Armas', category: 'arsenal', kind: 'weapon_rack', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#2a2d31', '#1a1c1f'] },
  { id: 'gun_table', name: 'Bancada de Armas', category: 'arsenal', kind: 'table_big', width: 3, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#2a3a2a', '#1f2219', '#6a7a5a'] },
  { id: 'locker_ammo', name: 'Armário de Munição', category: 'arsenal', kind: 'locker', width: 1, depth: 1, height: 1.9, states: 2, rotations: ALL, colors: ['#5a6a3a', '#2a2d1e'], desc: 'Aço verde-oliva com cadeado. Clique duplo abre: caixas de munição e carregadores.' },
  { id: 'stool_metal', name: 'Banqueta Giratória', category: 'arsenal', kind: 'stool', width: 1, depth: 1, height: 0.6, sit: true, rotations: ALL, colors: ['#8a5a3a', '#5a6a3a'] },
  { id: 'oil_stain', name: 'Mancha de Óleo', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: [0], colors: ['#1a1a14', '#3a3a2a'] },
  // depósito
  { id: 'rubble', name: 'Entulho', category: 'armazenamento', kind: 'rubble', width: 2, depth: 2, height: 0.5, rotations: ALL, colors: ['#5a5550', '#4a3222'] },
  { id: 'console', name: 'Bancada de Computadores', category: 'escritorio', kind: 'console', width: 2, depth: 1, height: 0.78, stackable: true, states: 2, rotations: ALL, colors: ['#2e2a36', '#8a78c0', '#7fd0ff'], desc: 'Dois monitores e teclado. Clique duplo liga/desliga.' },
  { id: 'server_rack', name: 'Rack de Servidores', category: 'escritorio', kind: 'locker', width: 1, depth: 1, height: 2.0, rotations: ALL, colors: ['#1d1d20', '#4fe39a'], desc: 'Armário de metal com os servidores piscando.' },
  { id: 'printer_dot', name: 'Impressora Matricial', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 1.0, rotations: ALL, colors: ['#d8ccb0', '#6a6e74'], desc: 'Papel contínuo caindo na frente.' },
  { id: 'whiteboard', name: 'Quadro Branco', category: 'escritorio', kind: 'crate', width: 3, depth: 1, height: 1.8, rotations: ALL, colors: ['#e8e4dc', '#8a8f96'], desc: 'De rodinhas, cheio de setas e círculos.' },
  { id: 'media_shelf', name: 'Estante de Mídias', category: 'escritorio', kind: 'crate', width: 2, depth: 1, height: 1.1, rotations: ALL, colors: ['#8a8f96', '#2a2a2a'], desc: 'Fitas VHS, disquetes e caixas.' },
  { id: 'water_cooler', name: 'Bebedouro', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 1.2, rotations: ALL, colors: ['#d8d0c0', '#3f7fd8'] },
  { id: 'parts_boxes', name: 'Caixas de Componentes', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 0.5, rotations: ALL, colors: ['#b8864e', '#2a2a2a'], desc: 'Caixas de papelão abertas com cabos, peças e um teclado velho.' },
  { id: 'ups', name: 'Nobreak e Estabilizador', category: 'escritorio', kind: 'crate', width: 1, depth: 1, height: 0.3, stackable: true, rotations: ALL, colors: ['#1d1d20', '#d8d0c0'] },
  { id: 'cables_floor', name: 'Cabos no Chão', category: 'decoracao', kind: 'dirt', width: 3, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#1a1a1a', '#d8c8a0'] },
  { id: 'table_work', name: 'Mesa de Trabalho', category: 'escritorio', kind: 'table_big', width: 3, depth: 2, height: 0.78, stackable: true, rotations: ALL, colors: ['#1d1c20', '#141316', '#3a3a42'] },
  { id: 'counter_wood', name: 'Balcão de Madeira', category: 'mobilia', kind: 'table_big', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#4a3020', '#2e1d12', '#9a7a4a'] },
  { id: 'armchair_leather', name: 'Poltrona de Couro', category: 'mobilia', kind: 'armchair', width: 1, depth: 1, height: 0.45, sit: true, rotations: ALL, colors: ['#5a2e1c'] },
  { id: 'dirt', name: 'Sujeira', category: 'decoracao', kind: 'dirt', width: 1, depth: 1, height: 0.01, walkable: true, stackable: true, flat: true, rotations: ALL, colors: ['#2a1d12', '#8a7a5a'] },
  // prisão
  { id: 'cell_bars', name: 'Grade de Cela', category: 'estrutura', kind: 'bars', width: 1, depth: 1, height: 2.2, rotations: ALL, colors: ['#3a3d42', '#1c1d20'] },
  { id: 'cell_wall', name: 'Divisória de Cela', category: 'estrutura', kind: 'iwall', width: 1, depth: 1, height: 1.3, xray: true, rotations: ALL, colors: ['#6a6e66', '#3a3d38'], desc: 'Meia parede de concreto entre as celas.' },
  { id: 'cell_door', name: 'Porta de Cela', category: 'estrutura', kind: 'cell_door', width: 1, depth: 1, height: 0, states: 2, openState: 1, cela: true, rotations: ALL, colors: ['#3a3d42', '#1c1d20', '#8a7a4a'], desc: 'Clique duplo abre/fecha. Fechada, ninguém passa.' },
  { id: 'cell_front', name: 'Parede de Cela', category: 'estrutura', kind: 'cell_front', width: 1, depth: 1, height: 2.2, xray: true, rotations: ALL, colors: ['#6a6e66', '#3a3d38'], desc: 'Parede de concreto da cela, inteira (no lugar da grade): fechada, não se vê o que tem dentro.' },
  { id: 'cell_door_steel', name: 'Porta de Aço da Cela', category: 'estrutura', kind: 'cell_door_steel', width: 1, depth: 1, height: 0, states: 2, openState: 1, cela: true, xray: true, rotations: ALL, colors: ['#555a60', '#1c1d20', '#8a7a4a'], desc: 'Clique duplo abre/fecha. Fechada, ninguém passa e a cela fica no escuro; aberta, acende e a parede da frente fica transparente.' },

  // ---------- Fazenda (ao ar livre) ----------
  // os prédios vistos de fora: a porta deles é uma Entrada na frente (que leva para dentro)
  { id: 'casarao', name: 'Casarão', category: 'fazenda', kind: 'casarao', width: 14, depth: 9, height: 6.5, xray: true, rotations: ALL, colors: ['#d9cbb0', '#8c3b26', '#4a3020', '#26323a'], desc: 'A casa grande, de dois andares, com a varanda na frente.' },
  { id: 'celeiro', name: 'Celeiro', category: 'fazenda', kind: 'celeiro', width: 12, depth: 8, height: 6.5, xray: true, rotations: ALL, colors: ['#7c2f22', '#3e2e26', '#e2d8c4', '#4a2418'], desc: 'Baias, feno e a carroça.' },
  { id: 'galpao', name: 'Casa de Mantimentos', category: 'fazenda', kind: 'galpao', width: 8, depth: 6, height: 4.6, xray: true, rotations: ALL, colors: ['#8a6a46', '#5e3424', '#3a281a', '#2b2622'], desc: 'Depósito de mantimentos e ferramentas, com o escritório do capataz.' },
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
  { id: 'guarda_roupa', name: 'Guarda-roupa', category: 'casa', kind: 'armario', width: 2, depth: 1, height: 2.0, rotations: ALL, colors: ['#5a3a24', '#c9a86a'] },
  { id: 'comoda', name: 'Cômoda', category: 'casa', kind: 'armario', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#6a4428', '#c9a86a'] },
  { id: 'armario_cozinha', name: 'Armário de Cozinha', category: 'casa', kind: 'armario', width: 2, depth: 1, height: 1.9, rotations: ALL, colors: ['#e2d6bc', '#5a4a3a'] },
  { id: 'fogao_lenha', name: 'Fogão a Lenha', category: 'casa', kind: 'fogao', width: 2, depth: 1, height: 0.85, states: 2, rotations: ALL, colors: ['#c8bca4', '#2a2420'], desc: 'Clique duplo acende/apaga.' },
  { id: 'pia_cozinha', name: 'Pia de Cozinha', category: 'casa', kind: 'pia_cozinha', width: 2, depth: 1, height: 0.9, stackable: true, rotations: ALL, colors: ['#e2d6bc', '#9aa4a8'] },
  { id: 'mesa_jantar', name: 'Mesa de Jantar', category: 'casa', kind: 'mesa', width: 4, depth: 2, height: 0.78, stackable: true, rotations: ALL, colors: ['#6a4428', '#4a2e1a'] },
  { id: 'mesa_cozinha', name: 'Mesa da Cozinha', category: 'casa', kind: 'mesa', width: 3, depth: 2, height: 0.78, stackable: true, rotations: ALL, colors: ['#9a7448', '#6a4a2e'] },
  { id: 'banheira', name: 'Banheira', category: 'casa', kind: 'banheira', width: 1, depth: 2, height: 0.6, rotations: ALL, colors: ['#ece6da', '#b8a070'] },
  { id: 'prateleira', name: 'Prateleira de Madeira', category: 'casa', kind: 'shelf', width: 2, depth: 1, height: 2.2, rotations: ALL, colors: ['#7a5a3a', '#4a3424'] },
  { id: 'escada_desce', name: 'Escada que Desce', category: 'casa', kind: 'escada_desce', width: 1, depth: 2, height: 0, walkable: true, portal: true, rotations: ALL, colors: ['#6a4a2e', '#1a1410'], desc: 'O vão da escada, com o corrimão: pare em cima para descer (o mestre escolhe o destino).' },
];

export const WALL_FURNI_LIST: WallFurniDef[] = [
  { id: 'poster_sigil', name: 'Pôster de Sigilo', category: 'parede', kind: 'poster_sigil', w: 44, h: 56, colors: ['#cdbf9c', '#8a1010'] },
  { id: 'notes_wall', name: 'Anotações', category: 'parede', kind: 'notes', w: 40, h: 38, colors: ['#d8cdb0'] },
  { id: 'painting_coliseu', name: 'Pintura do Coliseu', category: 'parede', kind: 'painting', w: 101, h: 63, colors: ['#b8903a', '#8a6a4a'] },
  { id: 'board_detective', name: 'Quadro de Detetive', category: 'parede', kind: 'board', w: 152, h: 82, colors: ['#8a6a44', '#b3261e'] },
  { id: 'board_investigation', name: 'Quadro de Investigação', category: 'parede', kind: 'board', w: 76, h: 50, colors: ['#6b4a2e', '#b3261e'] },
  { id: 'window_barred', name: 'Janela Gradeada', category: 'parede', kind: 'window', w: 44, h: 54, states: 2, colors: ['#1c2a3a', '#5fa8ff'] },
  { id: 'sconce', name: 'Arandela de Velas', category: 'parede', kind: 'sconce', w: 16, h: 28, states: 2, colors: ['#8a6a2a', '#e8dcc0'] },
  { id: 'door_sealed', name: 'Porta Selada', category: 'parede', kind: 'door_sealed', w: 40, h: 122, colors: ['#5a1414', '#8a1010'] },
  { id: 'pipes', name: 'Tubulação', category: 'parede', kind: 'pipes', w: 64, h: 22, colors: ['#3a3d42'] },
  { id: 'wall_shelf', name: 'Prateleira de Parede', category: 'parede', kind: 'wall_shelf', w: 48, h: 26, colors: ['#3d2819'] },
  { id: 'antlers', name: 'Crânio de Cervo', category: 'parede', kind: 'antlers', w: 40, h: 34, colors: ['#d8cfb8'] },
  { id: 'emergency_light', name: 'Luz de Emergência', category: 'parede', kind: 'emergency', w: 22, h: 16, states: 2, colors: ['#2a2d31', '#ff2a1a'], desc: 'Continua acesa no apagão.' },
  { id: 'clock', name: 'Relógio de Parede', category: 'parede', kind: 'clock', w: 22, h: 22, colors: ['#2a2420', '#d8cfb8'] },
  { id: 'tv_wall', name: 'TV de Tubo', category: 'parede', kind: 'tv', w: 26, h: 34, colors: ['#3a3d42', '#7ad08a'], desc: 'TV velha no suporte, passando futebol.' },
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
];

/** Metros → unidades de altura (duas casas). */
export const toUnits = (m: number) => Math.round(m * Z_PER_M * 100) / 100;

/** A pilha do que alguém largou no chão (docs/REGRAS.md, Mochila). */
export const PILHA_CHAO = 'pilha_chao';

export const FURNI_LIST: FurniDef[] = FURNI_METERS.map((d) => ({ ...d, height: toUnits(d.height), ...(d.leitos ? { leitos: d.leitos.map(toUnits) } : {}) }));

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

export function nextRotation(def: FurniDef, rot: number): number {
  const i = def.rotations.indexOf(rot);
  return def.rotations[(i + 1) % def.rotations.length] ?? def.rotations[0];
}
