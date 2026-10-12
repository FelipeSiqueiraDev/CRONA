/** Duração de um passo (servidor autoritativo, igual ao ciclo clássico de 500ms). */
export const TICK_MS = 500;
/**
 * O passo na diagonal anda √2 casas: leva mais tempo, para a peça andar sempre na mesma velocidade
 * (12/10: antes a diagonal levava os mesmos 500 ms e a peça acelerava 40% nela). O relógio do
 * servidor bate a cada meio passo; o reto leva 2 batidas, a diagonal 3 (750 ms, perto de 707).
 */
export const MEIO_PASSO_MS = TICK_MS / 2;
export const BATIDAS_RETO = 2;
export const BATIDAS_DIAGONAL = 3;
/** Diferença máxima de altura para subir um degrau. */
export const MAX_STEP_UP = 1.5;
/** Diferença máxima de altura para descer. */
export const MAX_STEP_DOWN = 3;
export const MAX_CHAT = 140;
export const MAX_NAME = 16;
/** Nome de personagem (peça): cabe nome e sobrenome. */
export const MAX_TOKEN_NAME = 24;
/** Altura máxima de empilhamento de mobis. */
export const STACK_LIMIT = 12;
/** Pixels de tela (eixo x) por tile ao longo de uma parede. */
export const WALL_PX_PER_TILE = 32;
/** Pixels de tela por unidade de altura. */
export const Z_PX = 32;
/**
 * A casa do tabuleiro, em metros: meio quadrado do livro (o quadrado de 1,5 m = 2 casas;
 * REGRAS.md, decisão 6). Tudo segue isto: as regras, o desenho e a arte (móveis no
 * tamanho de verdade, a pessoa com 1,80 m).
 */
export const M_POR_CASA = 0.75;
/**
 * Escala do mundo: unidades de altura (32 px) por metro, a mesma da casa no isométrico
 * (casa de 64×32 px = câmera a 45° e 30°): 52 px por metro na vertical. A pessoa de 1,80 m
 * tem ~94 px; os mobis são medidos em metros e convertidos com isto (mesa 0,8 m, estante
 * 2,2 m, porta 2,15 m).
 */
export const Z_PER_M = (Math.SQRT2 * Math.cos(Math.PI / 6)) / M_POR_CASA;
/** Altura das paredes (em unidades de altura) acima do piso mais alto: 2,8 m. */
export const WALL_HEIGHT = 2.8 * Z_PER_M;
/**
 * A arte das pessoas (bonecos, poses, folhas) sai a 57,6 px por metro (a escala antiga, de
 * 0,68 m por casa); o tabuleiro desenha com isto, para a pessoa ficar com 1,80 m na escala nova.
 */
export const ESCALA_ARTE_PESSOA = (Z_PER_M * Z_PX) / 57.6;
export const MAX_ROOM_SIZE = 80;
