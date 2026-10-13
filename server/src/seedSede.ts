import { RoomMap, type AvatarLook, type Door, type FloorItem, type FloorStyle, type LightMode, type ParticleKind, type Tema } from '@crona/shared';
import type { Database, RoomData, TokenData } from './db';
import { buildRoom, plan, type FloorSeed, type WallSeed } from './seed';

/**
 * Sede da Ordem (Ordo Realitas), a partir da planta "Mapa Base Ordo Realitas":
 * o bar no térreo (a fachada) e a sede no subsolo, cômodo por cômodo. A porta
 * da sede fica atrás da única geladeira do bar, no canto: com a senha 0413 ela
 * desliza e mostra a escada que desce para o salão.
 *
 * Os móveis são só os móveis (sem pistas nem itens dentro); a arte de cada um
 * entra depois (docs/SEDE-DA-ORDEM.md). Cada casa tem ~0,7 m: os cômodos têm
 * folga de 2 a 3 casas entre os grupos de móveis.
 */

export const SEDE = 'Sede · ';
export const SEDE_CODE = '0413';
/** Versão da montagem da Sede: subiu, a Sede é refeita no lugar (mesmos cômodos, peças e registro). */
export const SEDE_REV = 51;

/** Planta retangular com a porta na parede de cima (y = 0), na coluna doorX. */
export function planTop(w: number, h: number, doorX: number): { heightmap: string; door: Door } {
  const rows = [Array.from({ length: w }, (_, x) => (x === doorX ? '0' : 'x')).join('')];
  for (let y = 0; y < h; y++) rows.push('0'.repeat(w));
  return { heightmap: rows.join('\n'), door: { x: doorX, y: 0, dir: 4 } };
}

/**
 * Planta retangular com a porta na parede de baixo (a da frente, que não aparece no tabuleiro), na
 * coluna doorX: o vão fica na fileira de fora (y = h) e a passagem na última fileira da sala.
 */
export function planBottom(w: number, h: number, doorX: number): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) rows.push('0'.repeat(w));
  rows.push(Array.from({ length: w }, (_, x) => (x === doorX ? '0' : 'x')).join(''));
  return { heightmap: rows.join('\n'), door: { x: doorX, y: h, dir: 0 } };
}

/** Planta retangular com a porta na parede da direita (a da frente), na fileira doorY. */
export function planRight(w: number, h: number, doorY: number): { heightmap: string; door: Door } {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) rows.push('0'.repeat(w) + (y === doorY ? '0' : 'x'));
  return { heightmap: rows.join('\n'), door: { x: w, y: doorY, dir: 6 } };
}

/** Salão: 34×14 com o canto de cima à esquerda vazado (é o banheiro) e a porta da escada na parede esquerda. */
function salaoPlan(): { heightmap: string; door: Door } {
  const W = 34;
  const rows: string[] = [];
  for (let y = 0; y < 14; y++) {
    let row = y === 9 ? '0' : 'x';
    for (let x = 1; x <= W; x++) row += y <= 4 && x <= 7 ? 'x' : '0';
    rows.push(row);
  }
  return { heightmap: rows.join('\n'), door: { x: 0, y: 9, dir: 2 } };
}

interface RoomSpec {
  key: string;
  name: string;
  /** nomes antigos do mesmo cômodo (para refazer no lugar) */
  was?: string[];
  description: string;
  layout: { heightmap: string; door: Door };
  floorName: 'Térreo' | 'Subsolo';
  style: FloorStyle;
  darkness: number;
  fog?: number;
  light?: LightMode;
  floor: FloorSeed[];
  wall?: WallSeed[];
  /** passagens: [x, y, chave do cômodo de destino] */
  links: [number, number, string][];
  /** cor do ambiente (tinge o escuro) e partículas */
  ambient?: string;
  particles?: ParticleKind[];
  /** lâmpadas do teto: quentes (padrão) ou fluorescentes, frias */
  lamp?: 'fluorescent';
  /** posição na planta do andar (células) e giro em quartos de volta */
  plan: { x: number; y: number; r?: number };
}

/** Mesa de bar com cadeiras em volta (só nos lados pedidos: o = oeste, l = leste, n = norte, s = sul). */
const table = (x: number, y: number, sides: string): FloorSeed[] => [
  ['table_bar', x, y, 0],
  ...(sides.includes('o') ? [['chair_bar', x - 1, y, 2] as FloorSeed] : []),
  ...(sides.includes('l') ? [['chair_bar', x + 1, y, 6] as FloorSeed] : []),
  ...(sides.includes('n') ? [['chair_bar', x, y - 1, 4] as FloorSeed] : []),
  ...(sides.includes('s') ? [['chair_bar', x, y + 1, 0] as FloorSeed] : []),
];

/**
 * Cela da prisão (4 casas de largura): cama encostada no fundo, vaso no canto
 * e a frente de concreto com a porta de aço (fechada). Fechada, a cela fica no
 * escuro; aberta, acende e a parede da frente fica transparente (cela, no
 * furni.ts). bx = primeira coluna; bedY, sideY e frontY = linhas; rot = para
 * onde a frente olha.
 */
const cell = (bx: number, bedY: number, sideY: number, frontY: number, rot: number): FloorSeed[] => [
  ['bed', bx, bedY, 2],
  ['toilet_steel', bx + 3, sideY, 6],
  ['cell_front', bx, frontY, rot],
  ['cell_door_steel', bx + 1, frontY, rot],
  ['cell_front', bx + 2, frontY, rot],
  ['cell_front', bx + 3, frontY, rot],
];

/**
 * Cela da parede da esquerda (4 casas de comprimento, a frente corre em y e olha para a câmera):
 * a cama encostada no fundo, o vaso no canto e a frente com a porta de aço. by = primeira linha;
 * frontX = coluna da frente.
 */
const cellL = (by: number, frontX: number): FloorSeed[] => [
  ['bed', 0, by, 4],
  ['toilet_steel', 0, by + 3, 0],
  ['cell_front', frontX, by, 2],
  ['cell_door_steel', frontX, by + 1, 2],
  ['cell_front', frontX, by + 2, 2],
  ['cell_front', frontX, by + 3, 2],
];
/** Parede de concreto entre as celas (corre em x), de x0 a x1. */
const wallX = (y: number, x0: number, x1: number): FloorSeed[] => Array.from({ length: x1 - x0 + 1 }, (_, i) => ['cell_front', x0 + i, y, 4] as FloorSeed);

/** Parede de concreto entre as celas (corre em y), de y0 a y1, inteira como a frente. */
const wallY = (x: number, y0: number, y1: number): FloorSeed[] => Array.from({ length: y1 - y0 + 1 }, (_, i) => ['cell_front', x, y0 + i, 2] as FloorSeed);
/** Várias lâmpadas penduradas. */
const lamps = (...at: [number, number][]): FloorSeed[] => at.map(([x, y]) => ['ceiling_lamp', x, y, 0] as FloorSeed);

const ROOMS: RoomSpec[] = [
  // ------------------------------------------------------------ térreo
  {
    key: 'bar',
    ambient: '#c0782a',
    particles: ['dust', 'smoke'],
    name: SEDE + 'Bar',
    description: 'O Suvaco Seco: bar velho de fachada, marrom e acolhedor, com o fliperama piscando. A geladeira amarela do canto, a do teclado numérico, zumbe mais alto que as outras.',
    layout: plan(20, 15, 11),
    floorName: 'Térreo',
    style: 'madeira',
    darkness: 0.52,
    fog: 0.12,
    plan: { x: 0, y: 0 },
    // Arrumado como a planta da Sede desenhada pelo Códex (cenarios/base-ordo-realitas.png) e a descrição
    // do Suvaco Seco (wiki de Ordem Paranormal): o balcão comprido no fundo, as geladeiras no canto de
    // cima, o fliperama na parede da esquerda, as mesas amarelas, a sinuca e a pilha de cadeiras no canto.
    floor: [
      // a escada escondida vem antes: a geladeira amarela fica em cima dela (e desliza para a esquerda)
      ['stairs_down', 20, 0, 4],
      ['beer_fridge', 20, 0, 4],
      // o fundo: prateleiras de garrafas e os dois frigobares de trás do balcão; no canto, mais duas geladeiras
      ['bar_shelf', 1, 0, 4],
      ['bar_shelf', 3, 0, 4],
      ['minibar', 5, 0, 4],
      ['minibar', 6, 0, 4],
      ['bar_shelf', 7, 0, 4],
      ['bar_shelf', 9, 0, 4],
      ['beer_crate', 11, 0, 4],
      ['beer_crate', 11, 0, 4],
      ['keg', 12, 0, 0],
      ['beer_crate', 13, 0, 4],
      ['fridge_drinks', 16, 0, 4],
      ['fridge_drinks', 17, 0, 4],
      // o balcão de madeira: entre ele e as prateleiras fica o corredor do atendente (y 1 e 2), com a entrada no fim (x 13)
      ['bar_counter', 1, 3, 4],
      ['bar_counter', 3, 3, 4],
      ['bar_counter', 5, 3, 4],
      ['bar_counter', 7, 3, 4],
      ['bar_counter', 9, 3, 4],
      ['bar_counter', 11, 3, 4],
      ['beer_glass', 4, 3, 0],
      ['beer_glass', 8, 3, 0],
      ['beer_crate', 11, 3, 0],
      ['stool_bar', 2, 4, 0],
      ['stool_bar', 4, 4, 0],
      ['stool_bar', 6, 4, 0],
      ['stool_bar', 8, 4, 0],
      ['stool_bar', 10, 4, 0],
      ['stool_bar', 12, 4, 0],
      // parede da esquerda: a poltrona, a planta, o fliperama de Tetris e, no canto, a pilha de cadeiras
      ['armchair_red', 1, 5, 2],
      ['plant', 1, 6, 0],
      ['arcade', 1, 8, 2],
      ['plant', 1, 13, 0],
      ['chair_stack', 1, 14, 2],
      // as mesas amarelas, com copos e cinzeiros que ninguém tirou
      ...table(5, 6, 'olns'),
      ['beer_glass', 5, 6, 0],
      ...table(10, 7, 'olns'),
      ['ashtray', 10, 7, 0],
      ...table(5, 10, 'olns'),
      ['beer_glass', 5, 10, 0],
      ...table(8, 13, 'ol'),
      ['ashtray', 8, 13, 0],
      // a sinuca, perto do meio, e os tapetes vermelhos
      ['pool_table', 14, 7, 4],
      ['rug_ornate', 10, 10, 0],
      ['rug_worn', 15, 4, 2],
      // parede da direita: o aparador com as garrafas e, no canto de baixo, o armarinho
      ['sideboard', 20, 8, 6],
      ['bar_cabinet', 20, 13, 6],
      ['plant', 20, 14, 0],
      // perto da entrada, o sofá vermelho
      ['sofa_booth', 13, 14, 0],
      ...lamps([4, 2], [9, 2], [7, 6], [12, 9], [7, 11], [16, 11], [17, 2]),
      // sujeira
      ['dirt', 13, 1, 0],
      ['dirt', 2, 2, 2],
      ['dirt', 18, 2, 0],
      ['dirt', 12, 5, 4],
      ['dirt', 7, 9, 6],
      ['dirt', 3, 13, 0],
      ['dirt', 18, 11, 2],
      ['dirt', 10, 14, 4],
      ['dirt', 13, 12, 0],
    ],
    wall: [
      ['neon_bar', 'r', 0, 14.5, 3.08],
      ['clock', 'r', 0, 5.5, 3.72],
      ['sconce', 'l', 1, 9.4, 2.9],
      ['sconce', 'l', 1, 12.6, 2.9],
      // a TV do futebol, no alto, e o ventilador
      ['tv_wall', 'r', 0, 12.6, 2.99],
      ['fan_wall', 'l', 1, 7.0, 3.54],
      // o alvo de dardos, perto do fliperama
      ['dartboard', 'l', 1, 4.2, 2.8],
    ],
    links: [[20, 0, 'salao']],
  },
  // ------------------------------------------------------------ subsolo
  {
    key: 'salao',
    ambient: '#6a7a8c',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Salão Principal',
    description: 'O coração da Sede, bem iluminado: a fileira das quatro mesas de trabalho, os armários de ferro, os papéis dos casos e, na frente da escada, o canto das duas poltronas.',
    layout: salaoPlan(),
    floorName: 'Subsolo',
    style: 'concreto',
    darkness: 0.5,
    fog: 0.1,
    plan: { x: 29, y: 12 },
    floor: [
      ['stairs_up', 1, 9, 2],
      ['portal', 16, 0, 4],
      ['portal', 8, 2, 2],
      ['portal', 19, 13, 0],
      ['portal', 28, 13, 0],
      // mesas de trabalho, cadeiras dos dois lados
      ['table_work', 11, 3, 2],
      ['chair_office', 10, 3, 2],
      ['chair_office', 10, 4, 2],
      ['chair_office', 10, 5, 2],
      ['chair_office', 13, 3, 6],
      ['chair_office', 13, 4, 6],
      ['chair_office', 13, 5, 6],
      ['table_work', 17, 3, 2],
      ['chair_office', 16, 4, 2],
      ['chair_office', 16, 5, 2],
      ['chair_office', 19, 3, 6],
      ['chair_office', 19, 4, 6],
      ['chair_office', 19, 5, 6],
      ['table_work', 23, 3, 2],
      ['chair_office', 22, 3, 2],
      ['chair_office', 22, 4, 2],
      ['chair_office', 22, 5, 2],
      ['chair_office', 25, 3, 6],
      ['chair_office', 25, 4, 6],
      ['chair_office', 25, 5, 6],
      // a quarta mesa da fileira (na série são quatro mesas de metal em fila, com as banquetas)
      ['table_work', 29, 3, 2],
      ['chair_office', 28, 3, 2],
      ['chair_office', 28, 4, 2],
      ['chair_office', 28, 5, 2],
      ['chair_office', 31, 3, 6],
      ['chair_office', 31, 4, 6],
      ['chair_office', 31, 5, 6],
      ['cabinet_file', 33, 0, 4],
      ['cabinet_file', 34, 0, 4],
      // perto da escada, onde se chega: o canto de conversa, as duas poltronas pretas da série frente
      // a frente e a mesa de xadrez no meio (arrumado pelo Felipe no jogo, 05/10; o tapete redondo
      // preto e branco da série ainda não chegou)
      ['poltrona_preta', 3, 12, 2],
      ['table_chess', 5, 12, 4],
      ['poltrona_preta', 7, 12, 6],
      ['bench', 10, 13, 0],
      ['bench', 13, 13, 0],
      ['floor_lamp', 5, 13, 0],
      ['plant', 8, 0, 0],
      ['plant', 34, 13, 0],
      ['compass_floor', 16, 7, 0],
      ...lamps([6, 8], [14, 8], [21, 8], [27, 8], [31, 11]),
    ],
    wall: [
      ['board_investigation', 'r', 0, 12.0, 2.36],
      // as TVs grandes de tela fina da série, na parede do fundo
      ['tv_grande', 'r', 0, 21.5, 2.45],
      ['tv_grande', 'r', 0, 30.0, 2.45],
      ['clock', 'r', 0, 18.2, 3.54],
      ['pipes', 'r', 0, 26.0, 3.81],
      ['sconce', 'l', 1, 11.6, 2.9],
      ['emergency_light', 'l', 8, 3.6, 3.27],
    ],
    links: [
      [1, 9, 'bar'],
      [16, 0, 'corredor'],
      [8, 2, 'banheiro'],
      [19, 13, 'enfermaria'],
      [28, 13, 'arsenal'],
    ],
  },
  {
    key: 'corredor',
    ambient: '#5a6a82',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Corredor',
    description: 'Corredor comprido de blocos de concreto, vigiado pelas câmeras. As portas levam à prisão, às salas e ao salão; no fim, o zelador deixou o carrinho e a placa de piso molhado.',
    layout: plan(36, 3, 1),
    floorName: 'Subsolo',
    style: 'bloco',
    darkness: 0.6,
    fog: 0.15,
    plan: { x: 29, y: 8 },
    floor: [
      ['portal', 1, 1, 2],
      ['portal', 7, 0, 4],
      ['portal', 21, 0, 4],
      ['portal', 27, 0, 4],
      ['portal', 16, 2, 0],
      ['portal', 36, 1, 6],
      ['vent', 5, 1, 0],
      ['vent', 13, 2, 0],
      ['vent', 34, 2, 0],
      // na parede de cima: o banco, os armários do vestiário, as lixeiras perto das portas e a planta
      ['trash_can', 4, 0, 4],
      ['bench', 9, 0, 4],
      ['locker_row', 12, 0, 4],
      ['locker_row', 14, 0, 4],
      ['trash_can', 19, 0, 4],
      ['plant', 24, 0, 0],
      ['trash_can', 26, 0, 4],
      // no fim do corredor, a limpeza pela metade: o carrinho, a poça e a placa
      ['janitor_cart', 30, 0, 2],
      ['puddle', 32, 1, 0],
      ['wet_sign', 31, 2, 4],
      ...lamps([4, 1], [11, 1], [18, 1], [25, 1], [32, 1]),
    ],
    wall: [
      ['cctv', 'r', 0, 2.0, 3.63],
      ['pipes', 'r', 0, 3.5, 3.81],
      ['emergency_light', 'r', 0, 9.5, 3.36],
      ['pipes', 'r', 0, 14.5, 3.81],
      ['notice_board', 'r', 0, 17.0, 2],
      ['extinguisher', 'r', 0, 18.5, 1.63],
      ['power_box', 'r', 0, 23.0, 2],
      ['emergency_light', 'r', 0, 30.5, 3.36],
      ['pipes', 'r', 0, 33.5, 3.81],
      ['cctv', 'r', 0, 35.2, 3.63],
    ],
    links: [
      [1, 1, 'prisao'],
      [7, 0, 'laboratorio'],
      [21, 0, 'tecnologia'],
      [27, 0, 'gabinete'],
      [16, 2, 'salao'],
      [36, 1, 'rituais'],
    ],
  },
  {
    key: 'prisao',
    ambient: '#4a6a90',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Prisão',
    was: [SEDE + 'Alojamentos'],
    description: 'Seis celas nas duas paredes do fundo, de frente para o pátio, todas de concreto com porta de aço; a do canto, maior, é a de contenção, para o que não é gente: o sigilo no chão e as correntes na parede. No pátio, a mesa do interrogatório debaixo da lâmpada e, perto da porta, o posto do carcereiro com as câmeras. As portas abrem com clique duplo: fechada, a cela fica no escuro e ninguém sai; aberta, a luz acende.',
    layout: planRight(24, 16, 9),
    floorName: 'Subsolo',
    style: 'cela',
    darkness: 0.6,
    fog: 0.12,
    plan: { x: 4, y: 0 },
    // Todas as celas nas duas paredes do fundo, com a frente para a câmera: ninguém vê cela pelas costas.
    floor: [
      ['portal', 23, 9, 6],
      // a fileira do fundo: quatro celas, as paredes entre elas e o pilar que fecha a frente
      ...[4, 9, 14, 19].flatMap((x) => [...wallY(x, 0, 2), ['cell_front', x, 3, 4] as FloorSeed]),
      ...cell(0, 0, 1, 3, 4),
      ...cell(5, 0, 1, 3, 4),
      ...cell(10, 0, 1, 3, 4),
      ...cell(15, 0, 1, 3, 4),
      // a fileira da esquerda: uma cela e a de contenção, maior, no canto da frente
      ...cellL(4, 3),
      ...wallX(8, 0, 2),
      ['cell_front', 3, 8, 2],
      ...[9, 10, 11].map((y) => ['cell_front', 3, y, 2] as FloorSeed),
      ['cell_door_steel', 3, 12, 2],
      ...[13, 14, 15].map((y) => ['cell_front', 3, y, 2] as FloorSeed),
      // a contenção: o sigilo no chão, sem cama, e o sangue e o entulho de quem tentou sair
      ['sigil_floor', 0, 10, 0],
      ['blood_drops', 2, 13, 0],
      ['rubble', 0, 14, 0],
      // o posto do carcereiro, no canto perto da porta: a mesa das câmeras encostada na parede, com o painel dos
      // monitores em cima dela (08/10: antes o painel ficava atrás dos armários), e os armários do lado
      ['desk_metal', 20, 0, 4],
      ['monitor', 21, 0, 4],
      ['chair_office', 21, 1, 0],
      ['locker_row', 22, 0, 4],
      ['locker', 23, 1, 6],
      ['cabinet_file', 23, 3, 6],
      // o interrogatório, no meio do pátio: a mesinha, as duas cadeiras e a lâmpada em cima
      ['desk_metal', 11, 9, 0],
      ['chair_wood', 11, 8, 4],
      ['chair_wood', 12, 10, 0],
      // a comida que ninguém comeu e os ralos do pátio
      ['food_tray', 6, 1, 4],
      ['food_tray', 1, 11, 2],
      ['drain', 8, 7, 0],
      ['drain', 17, 12, 0],
      ['ceiling_lamp', 11, 9, 0],
      ...lamps([7, 6], [17, 6], [7, 13], [18, 12]),
    ],
    wall: [
      // dentro das celas do fundo: a lâmpada de grade e os dias riscados
      ['cage_lamp', 'r', 0, 1.5, 3.27],
      ['tally_marks', 'r', 0, 2.8, 1.72],
      ['cage_lamp', 'r', 0, 6.5, 3.27],
      ['cage_lamp', 'r', 0, 11.5, 3.27],
      ['tally_marks', 'r', 0, 12.5, 2],
      ['cage_lamp', 'r', 0, 16.5, 3.27],
      // dentro das celas da esquerda
      ['cage_lamp', 'l', 0, 6, 3.27],
      ['tally_marks', 'l', 0, 7.2, 1.72],
      // a contenção: correntes, o sigilo riscado à unha e a luz de emergência
      ['chains_wall', 'l', 0, 11, 2.2],
      ['sigil_scratch', 'l', 0, 13.6, 2],
      ['emergency_light', 'l', 0, 12.3, 3.45],
      // o posto: o painel das câmeras e o relógio
      ['monitor_wall', 'r', 0, 21, 2.9],
      ['clock', 'r', 0, 23.3, 3.6],
    ],
    links: [[23, 9, 'corredor']],
  },
  {
    key: 'camara',
    ambient: '#c89a3a',
    particles: ['dust', 'smoke', 'embers'],
    name: SEDE + 'Câmara do Selo',
    description: 'Um lugar secreto, sem porta: um cômodo de pedra antiga, escuro e abafado, mais velho que o resto da Sede. No chão, um selo dourado que ninguém lembra de ter pintado; no fundo, o altar e uma rachadura que vaza luz.',
    layout: planBottom(7, 7, 3),
    floorName: 'Subsolo',
    style: 'selo',
    darkness: 0.82,
    fog: 0.5,
    light: 'flicker',
    plan: { x: -4, y: 3 },
    floor: [
      // o selo no meio, com o crânio em cima, e a cera das velas que queimaram em volta dele
      ['sigil_gold', 2, 2, 0],
      ['skull', 3, 3, 4],
      ['wax_pool', 1, 1, 0],
      ['wax_pool', 5, 1, 2],
      ['wax_pool', 5, 5, 0],
      ['candles', 1, 1, 0],
      ['candles', 5, 1, 0],
      ['candles', 5, 5, 0],
      ['candles', 2, 5, 0],
      // no fundo, o altar entre os dois pedestais com as cinzas
      ['altar', 3, 0, 4],
      ['pedestal', 2, 0, 4],
      ['pedestal', 5, 0, 4],
      ['candelabra', 6, 6, 0],
      // o entulho no canto, perto da passagem
      ['rubble', 0, 5, 0],
    ],
    wall: [
      // a rachadura que vaza luz em cima do altar, as correntes e o sigilo riscado à unha
      ['crack_glow', 'r', 0, 4, 1.09],
      ['chains_wall', 'r', 0, 0.9, 1.63],
      ['sigil_scratch', 'l', 0, 1.3, 1.81],
      ['chains_wall', 'l', 0, 5.4, 1.63],
    ],
    links: [],
  },
  {
    key: 'laboratorio',
    ambient: '#3ab0b8',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Laboratório',
    description: 'O laboratório do Renan, com cara de clínica: bancadas nas paredes e duas bancadas compridas no meio, microscópios, frascos, a mesa de vidro com os tubos de ensaio, a impressora 3D e o quadro branco; o leitor de digital na parede, perto da porta.',
    layout: planBottom(9, 10, 6),
    floorName: 'Subsolo',
    style: 'azulejo',
    darkness: 0.42,
    plan: { x: 30, y: -3 },
    floor: [
      ['portal', 6, 9, 0],
      // como na planta da série, com as bancadas inteiras do Códex (12/10): a de canto no fundo,
      // a de parede inteira na esquerda e as duas ilhas compridas no meio, com o corredor entre
      // elas; o quadro branco e a impressora 3D no fundo; a mesa de vidro na parede da direita
      ['bancada_lab_curta', 0, 0, 4],
      ['stool_lab', 0, 1, 0],
      ['whiteboard', 3, 0, 4],
      ['impressora_3d', 6, 0, 4],
      ['cabinet_file', 7, 0, 4],
      ['cabinet_file', 8, 0, 4],
      ['bancada_lab_parede', 0, 3, 2],
      ['chair_office', 1, 4, 6],
      ['bancada_lab_ilha', 3, 3, 2],
      ['bancada_lab_ilha', 5, 3, 6],
      ['stool_lab', 4, 4, 0],
      ['stool_lab', 4, 6, 0],
      ['mesa_vidro_lab', 8, 3, 0],
      ['chair_office', 6, 2, 0],
      ['trolley', 7, 7, 0],
      ...lamps([2, 2], [4, 5], [7, 3]),
    ],
    wall: [
      // o quadro de investigação em cima dos arquivos (atrás do quadro branco, ele sumia)
      ['board_investigation', 'r', 0, 7.5, 2.4],
      ['notes_wall', 'l', 0, 6.5, 2.36],
      // o leitor de digital, perto da porta
      ['scanner_digital', 'l', 0, 8.6, 1.3],
    ],
    links: [[6, 9, 'corredor']],
  },
  {
    key: 'tecnologia',
    ambient: '#8a5ad0',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Sala de Tecnologia',
    was: [SEDE + 'Sala de Reunião'],
    description: 'A sala mais da hora da Sede, cheia de telas: a mesa em U com os três postos embaixo da tela enorme do C.R.I.S, o painel de telas, a torre de monitores de tubo, a mesa holográfica no meio do carpete roxo, a bancada de eletrônica com o ferro de solda fumegando, os servidores, um monitor travado na tela de DERROTA e a lixeira transbordando de embalagens.',
    layout: planBottom(13, 10, 10),
    floorName: 'Subsolo',
    style: 'carpete',
    darkness: 0.5,
    plan: { x: 40, y: -3 },
    floor: [
      ['portal', 10, 9, 0],
      // a mesa em U na parede do fundo: os três postos, cada um com a sua cadeira dentro do U
      ['desk_u', 4, 0, 4],
      ['cadeira_gamer', 5, 1, 0],
      ['cadeira_gamer', 6, 1, 0],
      ['cadeira_gamer', 8, 1, 0],
      // ao lado da mesa em U: a torre de monitores de tubo e o frigobar de energético
      ['torre_crt', 10, 0, 4],
      ['frigobar_energetico', 12, 0, 4],
      // na parede da esquerda: o rack moderno e o servidor com o nobreak, a impressora, as fitas e o bebedouro
      ['rack_moderno', 0, 1, 2],
      ['server_rack', 0, 2, 2],
      ['ups', 0, 3, 2],
      ['cables_floor', 1, 2, 4],
      ['printer_dot', 0, 5, 2],
      ['media_shelf', 0, 7, 2],
      ['water_cooler', 0, 9, 2],
      // no meio, a mesa holográfica com duas cadeiras; na parede da direita, a bancada de eletrônica; as caixas de
      // peças e a lixeira transbordando nos cantos
      ['mesa_holografica', 5, 5, 4],
      ['cadeira_gamer', 4, 6, 2],
      ['cadeira_gamer', 7, 5, 6],
      ['bancada_eletronica', 11, 4, 6],
      ['cadeira_gamer', 10, 5, 2],
      ['parts_boxes', 11, 8, 4],
      ['parts_boxes', 12, 8, 6],
      ['lixeira_lanches', 9, 8, 0],
      ...lamps([3, 3], [6, 2], [8, 7]),
    ],
    wall: [
      // a tela enorme do C.R.I.S em cima da mesa em U (o sistema da Ordem que procura o paranormal) e o painel de telas
      ['tela_cris', 'r', 0, 7.0, 1.9],
      ['painel_telas', 'r', 0, 2.4, 2.3],
      ['ac_wall', 'r', 0, 11.6, 3.9],
      // na parede da esquerda: o monitor travado na tela de DERROTA, o mural de polaroids e a prateleira
      ['tela_derrota', 'l', 0, 4.4, 2.6],
      ['mural_polaroids', 'l', 0, 8.0, 2.6],
      ['shelf_wall', 'l', 0, 6.2, 3.3],
    ],
    links: [[10, 9, 'corredor']],
  },
  {
    key: 'gabinete',
    ambient: '#c0622a',
    particles: ['dust', 'smoke'],
    name: SEDE + 'Gabinete',
    description: 'O escritório do Veríssimo, imponente: as estantes grandes no fundo, a mesa grande de madeira com a cadeira dele, o sofá vermelho embaixo da pintura do Coliseu, as quatro poltronas no tapete, o quadro de detetive e o canto das relíquias.',
    layout: planBottom(12, 10, 2),
    floorName: 'Subsolo',
    style: 'taco',
    darkness: 0.5,
    plan: { x: 54, y: -3 },
    floor: [
      ['portal', 2, 9, 0],
      // a parede do fundo é o que impressiona: a estante do Veríssimo pegando a parede quase inteira e,
      // no canto, o sofá vermelho embaixo da pintura do Coliseu
      ['sofa_verissimo', 1, 0, 4],
      ['shelf_verissimo', 6, 0, 4],
      ['candelabra', 5, 0, 4],
      ['candelabra', 11, 3, 0],
      // a mesa grande perto do centro, com a cadeira do Veríssimo atrás (de costas para o sofá)
      ['chair_verissimo', 4, 1, 4],
      // a frente da mesa (as gavetas, o lado de quem trabalha) virada para a cadeira do Veríssimo (08/10, o Felipe)
      ['desk_verissimo', 3, 2, 0],
      // as quatro poltronas avermelhadas: duas na frente da mesa e duas frente a frente no tapete; o
      // armário de metal ao lado da mesa
      ['rug_aubusson', 2, 5, 0],
      ['armchair_verissimo', 3, 4, 0],
      ['armchair_verissimo', 5, 4, 0],
      ['armchair_verissimo', 2, 6, 2],
      ['armchair_verissimo', 5, 6, 6],
      ['cabinet_file', 7, 2, 4],
      // o canto de exibição, na parede da esquerda, depois do quadro de detetive (08/10: antes o quadro ficava atrás
      // da vitrine e da armadura): um museu particular; a outra armadura guarda a relíquia do meio da sala
      ['pedestal_relic', 0, 5, 2],
      ['vitrine_paranormal', 0, 6, 2],
      ['pedestal_relic', 0, 8, 2],
      ['armor_display', 0, 9, 2],
      ['pedestal_relic', 9, 6, 0],
      ['armor_display', 10, 6, 6],
      ['plant', 11, 9, 0],
      ...lamps([6, 4], [6, 8], [3, 7], [10, 5]),
    ],
    wall: [
      // a pintura do Coliseu sobre o sofá, o quadro de detetive enorme, o relógio
      ['painting_coliseu', 'r', 0, 2.1, 2.1],
      ['board_detective', 'l', 0, 2.5, 1.95],
      ['clock', 'r', 0, 4.6, 3.54],
    ],
    links: [[2, 9, 'corredor']],
  },
  {
    key: 'rituais',
    ambient: '#c02a24',
    particles: ['dust', 'smoke', 'embers'],
    name: SEDE + 'Sala de Rituais',
    description: 'Um círculo vermelho pintado no chão, a mesa das ferramentas e o balcão dos frascos. O ar pesa aqui dentro.',
    layout: plan(9, 11, 8),
    floorName: 'Subsolo',
    style: 'musgo',
    darkness: 0.74,
    fog: 0.4,
    plan: { x: 66, y: 1 },
    floor: [
      ['portal', 1, 8, 2],
      // o círculo no meio da sala: o crânio no centro, velas nos quatro lados, sangue
      ['sigil_floor', 4, 4, 0],
      ['skull', 5, 5, 4],
      ['candles', 5, 3, 0],
      ['candles', 3, 5, 0],
      ['candles', 7, 5, 0],
      ['candles', 5, 7, 0],
      ['blood_pool', 6, 6, 0],
      ['blood_drops', 4, 4, 0],
      ['blood_drops', 7, 7, 0],
      // na parede do fundo: a estante, o balcão dos frascos e a mesa redonda do canto
      ['bookshelf', 1, 0, 4],
      ['counter_wood', 3, 0, 4],
      ['flasks', 3, 0, 4],
      ['candles', 4, 0, 4],
      ['counter_wood', 5, 0, 4],
      ['books_stack', 5, 0, 4],
      ['flasks', 6, 0, 4],
      ['table_round', 8, 0, 0],
      ['papers', 8, 0, 0],
      ['chair_wood', 8, 2, 0],
      // na parede da esquerda: a mesa das ferramentas (a faca, o giz, a tigela) e mais balcão
      ['table_tools', 1, 3, 2],
      ['stool', 2, 3, 6],
      ['counter_wood', 1, 5, 2],
      ['skull', 1, 5, 2],
    ],
    wall: [
      ['poster_sigil', 'r', 0, 4.5, 2.36],
      ['poster_sigil', 'l', 1, 7.0, 2.36],
      ['sconce', 'l', 1, 2.5, 2.9],
      ['sconce', 'l', 1, 5.5, 2.9],
      ['sconce', 'r', 0, 7.5, 2.9],
    ],
    links: [[1, 8, 'corredor']],
  },
  {
    key: 'banheiro',
    ambient: '#6aa89a',
    particles: [],
    lamp: 'fluorescent',
    name: SEDE + 'Banheiro',
    description: 'Limpo e bem iluminado: no fundo, três cabines com vaso; na parede da esquerda, as duas pias com espelhos manchados.',
    layout: planRight(6, 4, 2),
    floorName: 'Subsolo',
    style: 'xadrez',
    darkness: 0.45,
    plan: { x: 30, y: 13 },
    floor: [
      ['portal', 5, 2, 6],
      // no fundo, as três cabines com vaso; as duas pias na parede da esquerda, embaixo dos espelhos
      ['toilet', 0, 0, 4],
      ['stall_panel', 1, 0, 2],
      ['stall_panel', 1, 1, 2],
      ['toilet', 2, 0, 4],
      ['stall_panel', 3, 0, 2],
      ['stall_panel', 3, 1, 2],
      ['toilet', 4, 0, 4],
      ['stall_panel', 5, 0, 2],
      ['sink', 0, 2, 2],
      ['sink', 0, 3, 2],
      ['trash_bin', 2, 3, 4],
      ['dirt', 3, 2, 0],
      ...lamps([3, 2]),
    ],
    wall: [
      ['mirror', 'l', 0, 2.5, 2.63],
      ['mirror', 'l', 0, 3.5, 2.63],
      ['towel_dispenser', 'l', 0, 1.6, 2.27],
    ],
    links: [[5, 2, 'salao']],
  },
  {
    key: 'enfermaria',
    ambient: '#a0d0dc',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Enfermaria',
    description: 'A ala médica da Marcela: seis leitos verdes, cada um na sua cortina, os armários de remédio ao lado da porta e o posto da enfermagem no canto.',
    layout: planTop(20, 13, 17),
    floorName: 'Subsolo',
    style: 'ladrilho',
    darkness: 0.38,
    plan: { x: 31, y: 26 },
    floor: [
      ['portal', 17, 1, 4],
      // seis cubículos, como na ala médica da série: três em cima (a cabeceira na parede) e três
      // embaixo; cada leito dentro da sua cortina (a de cima aberta, a de baixo fechada), com o soro.
      // O soro fica do lado de lá da cama (o da esquerda, longe da câmera), para a cama aparecer e o lado
      // de cá ficar livre para alguém parar junto do leito (revisto em 07/10)
      ...[1, 5, 9].flatMap((x) => [
        ['bed_curtain', x - 1, 1, 4, undefined, 1] as FloorSeed,
        ['hospital_bed', x, 1, 4] as FloorSeed,
        ['iv_stand', x - 1, 1, 0] as FloorSeed,
        ['bed_curtain', x - 1, 10, 0, undefined, x === 5 ? 0 : 1] as FloorSeed,
        ['hospital_bed', x, 11, 0] as FloorSeed,
        ['iv_stand', x - 1, 13, 0] as FloorSeed,
      ]),
      // os remédios num canto só: os armários na parede do fundo, ao lado da porta, e a pia
      ['medical_cabinet', 13, 1, 4],
      ['medical_cabinet', 15, 1, 4],
      ['cabinet_file', 18, 1, 4],
      ['sink', 19, 1, 4],
      // o posto da enfermagem no canto de baixo: um balcão só, inteiro, com o computador em cima (09/10, arte do Códex)
      ['posto_enfermagem', 13, 11, 4],
      // o carrinho no corredor entre os cubículos
      ['trolley', 7, 7, 0],
      ...lamps([4, 7], [10, 7], [16, 5], [16, 9]),
    ],
    wall: [
      ['clock', 'r', 1, 19.5, 3.54],
      ['emergency_light', 'l', 0, 7.0, 3.27],
    ],
    links: [[17, 1, 'salao']],
  },
  {
    key: 'arsenal',
    ambient: '#6a8a4a',
    particles: ['dust'],
    lamp: 'fluorescent',
    name: SEDE + 'Arsenal',
    description: 'Os armários de armas dos dois lados da porta, os de munição e os baús nas paredes, e a mesa grande no meio, onde tudo é limpo e conferido.',
    layout: planTop(14, 10, 6),
    floorName: 'Subsolo',
    style: 'metal',
    darkness: 0.6,
    fog: 0.08,
    plan: { x: 51, y: 26 },
    floor: [
      ['portal', 6, 1, 4],
      // os armários de armas na parede do fundo, dos dois lados da porta, e os de munição no canto
      ['weapon_rack', 0, 1, 4],
      ['weapon_rack', 2, 1, 4],
      ['weapon_rack', 8, 1, 4],
      ['weapon_rack', 10, 1, 4],
      ['locker_ammo', 12, 1, 4],
      ['locker_ammo', 13, 1, 4],
      // mais armários de munição e os baús na parede da esquerda
      ['locker_ammo', 0, 4, 2],
      ['locker_ammo', 0, 5, 2],
      ['locker_ammo', 0, 6, 2],
      ['chest_army', 0, 8, 2],
      ['chest_army', 0, 10, 2, undefined, 1],
      // a mesa grande do Códex no meio (no lugar das bancadas pequenas, que saíam tortas), com as
      // banquetas dos dois lados
      ['mesa_arsenal', 5, 4, 4],
      ['stool_metal', 6, 3, 0],
      ['stool_metal', 7, 3, 0],
      ['stool_metal', 6, 6, 0],
      ['stool_metal', 7, 6, 0],
      ['oil_stain', 6, 8, 0],
      // as caixas de munição empilhadas no canto da frente
      ['ammo_box', 12, 9, 4],
      ['ammo_box', 13, 9, 4],
      ['ammo_box', 13, 8, 2],
      ['ammo_box', 13, 9, 4],
      ...lamps([5, 3], [10, 3], [7, 8]),
    ],
    wall: [
      ['blade_rack', 'r', 1, 5.0, 2.09],
      ['emergency_light', 'r', 1, 5.0, 3.99],
      ['tool_board', 'l', 0, 2.9, 1.63],
      ['target_paper', 'l', 0, 9.0, 1.72],
    ],
    links: [[6, 1, 'salao']],
  },
];

/**
 * A cor de cada agente (o anel no tabuleiro, a ficha no mapa tático), pela cor do elemento dele
 * (decidido pelo Felipe em 05/10): Tepes Sangue, Catarina Morte, Alosi Conhecimento, Cora Energia.
 */
export const COR_DO_AGENTE: Record<string, string> = {
  'D.Tepes': '#c8322a',
  'Catarina Albuquerque': '#1d1c21',
  'Alosi Walker': '#d4a73a',
  'Cora Falcão': '#8a4fd8',
};

/** A cor de cada agente em todas as cenas (a Sede e a Fazenda): true quando alguma mudou. */
export function coresDosAgentes(db: Database): boolean {
  let mudou = false;
  for (const room of db.rooms)
    for (const t of room.tokens ?? []) {
      const cor = COR_DO_AGENTE[t.name];
      if (cor && t.color !== cor) (t.color = cor), (mudou = true);
    }
  return mudou;
}

/** O tema da interface de cada agente, pelo elemento dele (05/10). */
const TEMA_DO_AGENTE: [RegExp, Tema][] = [
  [/tepes/i, 'sangue'],
  [/catarina/i, 'morte'],
  [/alosi/i, 'conhecimento'],
  [/cora/i, 'energia'],
];

/** Põe o tema dos quatro agentes nas fichas deles, uma vez só (depois, o jogador troca na ficha). */
export function temasDosAgentes(db: Database): boolean {
  if (db.temasAgentes || !db.fichas?.length) return false;
  for (const f of db.fichas ?? []) {
    const t = TEMA_DO_AGENTE.find(([re]) => re.test(f.nome))?.[1];
    if (t && !f.tema) f.tema = t;
  }
  db.temasAgentes = true;
  return true;
}

/** Os quatro agentes começam no bar, perto da porta da rua (ou onde a montagem pedir: [x, y, direção] de cada um). */
export function partyTokens(db: Database, charIdOf: (name: string) => number | null, onde?: [number, number, number][]): TokenData[] {
  const base = { shoes: '#3d3a40', pants: '#1c1b1f' };
  const tk = (name: string, x: number, y: number, dir: number, color: string, capacity: number, look: Partial<AvatarLook>): TokenData => ({
    id: db.nextItemId++,
    name,
    x,
    y,
    dir,
    color,
    capacity,
    look: { skin: '#e8b98f', hair: '#1a1412', hairStyle: 0, top: '#2b2a30', outfit: 0, extra: 0, ...base, charId: charIdOf(name), ...look } as AvatarLook,
  });
  const at = (i: number, x: number, y: number, dir: number): [number, number, number] => onde?.[i] ?? [x, y, dir];
  return [
    tk('D.Tepes', ...at(0, 2, 10, 2), COR_DO_AGENTE['D.Tepes'], 10, { hair: '#3b2618', hairStyle: 1, extra: 2, top: '#5c4632', outfit: 1 }),
    tk('Catarina Albuquerque', ...at(1, 3, 11, 2), COR_DO_AGENTE['Catarina Albuquerque'], 10, { skin: '#f3d2b3', hair: '#a8321e', hairStyle: 3, top: '#2b2a30', outfit: 1 }),
    tk('Alosi Walker', ...at(2, 2, 12, 2), COR_DO_AGENTE['Alosi Walker'], 12, { hair: '#1a1412', extra: 1, top: '#d8d0c0', outfit: 2 }),
    tk('Cora Falcão', ...at(3, 3, 9, 2), COR_DO_AGENTE['Cora Falcão'], 10, { hair: '#c9c4bc', hairStyle: 2, top: '#1c1b1f' }),
  ];
}

/** Liga as passagens de cada cômodo e fecha a geladeira do bar em cima da escada. */
function wire(built: Map<string, RoomData>) {
  for (const spec of ROOMS) {
    const room = built.get(spec.key)!;
    for (const [x, y, to] of spec.links) {
      const target = built.get(to);
      const it = room.items.find((i) => i.x === x && i.y === y && (i.defId === 'portal' || i.defId.startsWith('stairs')));
      if (!it || !target) {
        console.warn(`[seed] ${room.name}: sem passagem em ${x},${y}`);
        continue;
      }
      it.link = target.id;
    }
  }
  const bar = built.get('bar')!;
  const fridge = bar.items.find((i) => i.defId === 'beer_fridge') as FloorItem | undefined;
  if (fridge) fridge.lock = { code: SEDE_CODE, open: false, slide: { dx: -1, dy: 0 } };
  else console.warn('[seed] Sede: geladeira secreta não coube');
}

/** Aplica a planta, o piso e o clima do cômodo. */
function style(room: RoomData, spec: RoomSpec) {
  room.floor = spec.floorName;
  room.floorStyle = spec.style;
  room.fog = spec.fog ?? 0;
  room.lightMode = spec.light ?? 'normal';
  room.darkness = spec.darkness;
  if (spec.ambient) room.ambient = spec.ambient;
  else delete room.ambient;
  room.particles = spec.particles ?? [];
}

/** Móveis do cômodo, com as lâmpadas do tipo dele. */
const furnish = (spec: RoomSpec): FloorSeed[] => (spec.lamp ? spec.floor.map((f) => (f[0] === 'ceiling_lamp' ? ([spec.lamp, ...f.slice(1)] as FloorSeed) : f)) : spec.floor);

/** Tira a Sede inteira do banco (cômodos, campanha e peças), para montar de novo. */
export function removeSede(db: Database) {
  const ids = new Set(db.rooms.filter((r) => r.name.startsWith(SEDE)).map((r) => r.id));
  if (!ids.size) return;
  db.rooms = db.rooms.filter((r) => !ids.has(r.id));
  if (db.campaigns) for (const k of Object.keys(db.campaigns)) if (ids.has(Number(k))) delete db.campaigns[k];
  if (db.home !== undefined && ids.has(db.home)) delete db.home;
  if (db.liveScene !== undefined && ids.has(db.liveScene)) delete db.liveScene;
}

/** Monta a Sede da Ordem inteira (bar + subsolo) e a campanha dela. */
export function seedSede(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(SEDE))) return;
  const built = new Map<string, RoomData>();
  for (const spec of ROOMS) {
    const room = buildRoom(db, spec.name, spec.description, spec.layout, furnish(spec), spec.wall ?? [], spec.darkness);
    room.montagem = resumo(spec);
    style(room, spec);
    built.set(spec.key, room);
  }
  wire(built);
  const bar = built.get('bar')!;
  const charIdOf = (name: string) => db.characters.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  bar.tokens = partyTokens(db, charIdOf);
  db.rooms.push(...built.values());
  db.campaigns ??= {};
  db.campaigns[String(bar.id)] = {
    title: 'Sede da Ordem',
    subtitle: 'Ordo Realitas',
    objectives: [],
    layout: Object.fromEntries(ROOMS.map((s) => [built.get(s.key)!.id, s.plan])),
    log: [],
  };
  db.home = bar.id;
  db.sedeRev = SEDE_REV;
}

/** Resumo da montagem de um cômodo (planta, móveis, paredes): mudou, o cômodo é refeito. */
function resumo(spec: RoomSpec): string {
  const t = JSON.stringify([spec.layout, spec.floor, spec.wall ?? [], spec.links]);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

/**
 * Peças de parede novas num cômodo guardado sem resumo (de antes de 05/10): entram sem refazer o
 * cômodo, para não desfazer o que o mestre arrumou pelo jogo.
 */
const NOVAS_NA_PAREDE: Record<string, string[]> = { bar: ['dartboard'] };

/**
 * Retoques num cômodo guardado sem refazê-lo: quando o retoque acha o que procura (e devolve true),
 * mexe só nisso e o cômodo passa a ter o resumo da montagem nova, sem ser refeito.
 */
const RETOQUES: Record<string, (room: RoomData) => boolean> = {
  // o alvo de dardos entrou em cima da porta do bar (05/10): vai para perto do fliperama
  bar: (room) => {
    const alvo = room.wallItems.find((w) => w.defId === 'dartboard' && w.pos === 11);
    if (alvo) alvo.pos = 4.2;
    return !!alvo;
  },
};

/**
 * Refaz a Sede no lugar quando a montagem muda (SEDE_REV): mesmos cômodos
 * (ids), mesmas peças (numa casa livre se a antiga sumiu), mesmo registro e
 * objetivos. Móveis, pistas e itens dos cômodos voltam aos da montagem nova.
 */
export function rebuildSede(db: Database): boolean {
  if ((db.sedeRev ?? 1) >= SEDE_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(SEDE));
  if (!existing.length) return false;
  const built = new Map<string, RoomData>();
  for (const spec of ROOMS) {
    const names = [spec.name, ...(spec.was ?? [])];
    let room = existing.find((r) => names.includes(r.name));
    const h = resumo(spec);
    // a montagem deste cômodo não mudou (ou é de antes do resumo): fica como o mestre deixou
    if (room && (room.montagem === h || room.montagem === undefined || RETOQUES[spec.key]?.(room))) {
      if (room.montagem === undefined)
        for (const [defId, w, plane, pos, z] of (spec.wall ?? []).filter((ws) => NOVAS_NA_PAREDE[spec.key]?.includes(ws[0])))
          if (!room.wallItems.some((it) => it.defId === defId)) room.wallItems.push({ id: db.nextItemId++, defId, wall: w, plane, pos, z, state: 0 });
      room.montagem = h;
      style(room, spec);
      built.set(spec.key, room);
      continue;
    }
    const fresh = buildRoom(db, spec.name, spec.description, spec.layout, furnish(spec), spec.wall ?? [], spec.darkness);
    if (room) {
      // mesmo cômodo: só troca planta e móveis
      db.nextRoomId--;
      Object.assign(room, { name: fresh.name, description: fresh.description, heightmap: fresh.heightmap, door: fresh.door, items: fresh.items, wallItems: fresh.wallItems });
    } else {
      room = fresh;
      db.rooms.push(room);
    }
    room.montagem = h;
    style(room, spec);
    built.set(spec.key, room);
  }
  wire(built);
  // peças: continuam onde estavam, se ainda der; senão, perto da porta
  for (const room of built.values()) {
    const map = new RoomMap(room.heightmap, room.door, room.items);
    const taken = new Set<string>();
    for (const t of room.tokens ?? []) {
      let ok = map.walkState(t.x, t.y) === 'walk' && !taken.has(`${t.x},${t.y}`);
      for (let r = 1; !ok && r < 6; r++)
        for (let dy = -r; dy <= r && !ok; dy++)
          for (let dx = -r; dx <= r && !ok; dx++) {
            const x = room.door.x + dx;
            const y = room.door.y + dy;
            if (map.walkState(x, y) === 'walk' && !map.isDoor(x, y) && !taken.has(`${x},${y}`)) {
              t.x = x;
              t.y = y;
              ok = true;
            }
          }
      taken.add(`${t.x},${t.y}`);
    }
  }
  const key = Math.min(...[...built.values()].map((r) => r.id));
  const camp = db.campaigns?.[String(key)];
  if (camp) for (const s of ROOMS) camp.layout[built.get(s.key)!.id] = s.plan;
  db.sedeRev = SEDE_REV;
  return true;
}
