/**
 * A Viagem (07/10): uma cena especial em que os agentes andam num veículo (a van preta) enquanto o
 * cenário de fora passa. O veículo fica parado na tela e o mundo se mexe; o mestre escolhe onde cada
 * um senta, o cenário e a velocidade, e fica nela até decidir chegar a algum lugar.
 */

export const CENARIOS_VIAGEM = [
  { id: 'rodovia', nome: 'Rodovia' },
  { id: 'terra', nome: 'Estrada de terra' },
] as const;
export type CenarioViagem = (typeof CENARIOS_VIAGEM)[number]['id'];
export const isCenarioViagem = (s: unknown): s is CenarioViagem => CENARIOS_VIAGEM.some((c) => c.id === s);

/** A hora do dia: muda a luz da cena (o escuro e a cor do ambiente). */
export const HORAS_VIAGEM = [
  { id: 'dia', nome: 'Dia', escuro: 0.08, ambiente: '#fff1d6' },
  { id: 'entardecer', nome: 'Entardecer', escuro: 0.3, ambiente: '#ff9a52' },
  { id: 'noite', nome: 'Noite', escuro: 0.62, ambiente: '#4a68c8' },
] as const;
export type HoraViagem = (typeof HORAS_VIAGEM)[number]['id'];
export const isHoraViagem = (s: unknown): s is HoraViagem => HORAS_VIAGEM.some((h) => h.id === s);

/** A velocidade do mundo passando: 0 parada ... 1 correndo. */
export const VELOCIDADES_VIAGEM = [
  { v: 0, nome: 'Parada' },
  { v: 0.35, nome: 'Devagar' },
  { v: 0.7, nome: 'Normal' },
  { v: 1, nome: 'Correndo' },
] as const;

export interface ViagemInfo {
  cenario: CenarioViagem;
  hora: HoraViagem;
  /** 0 a 1 */
  velocidade: number;
  /** o texto que o mestre põe ("Rumo a Santo Berço"), mostrado na cena */
  destino?: string;
  /** a cena de onde a viagem partiu (liga a viagem à campanha) */
  origem: number;
}

/** A van por dentro, em casas (0,75 m): o comprimento corre em x (a frente é x grande), a largura em y. */
export const VAN = {
  comprimento: 8,
  largura: 3,
  /** a frente aponta para +x (giro 2 do mobi) */
  giroBanco: 2,
  /** o painel da frente olha para trás (-x), para os bancos */
  giroPainel: 6,
} as const;

export interface BancoVan {
  id: number;
  nome: string;
  x: number;
  y: number;
}

/** Os oito bancos: o motorista e o carona na frente e duas fileiras de três; o fundo é a bagagem. */
export const BANCOS_VAN: BancoVan[] = [
  { id: 0, nome: 'Motorista', x: 6, y: 2 },
  { id: 1, nome: 'Carona', x: 6, y: 0 },
  { id: 2, nome: 'Fila 2 · porta', x: 4, y: 2 },
  { id: 3, nome: 'Fila 2 · meio', x: 4, y: 1 },
  { id: 4, nome: 'Fila 2 · janela', x: 4, y: 0 },
  { id: 5, nome: 'Fila 3 · porta', x: 2, y: 2 },
  { id: 6, nome: 'Fila 3 · meio', x: 2, y: 1 },
  { id: 7, nome: 'Fila 3 · janela', x: 2, y: 0 },
];

/** O que a van leva por dentro (mobis do jogo): os bancos, o painel e o console entre os da frente. */
export function moveisDaVan(): { defId: string; x: number; y: number; rot: number }[] {
  const rot = VAN.giroBanco;
  return [
    ...BANCOS_VAN.map((b) => ({ defId: 'van_seat', x: b.x, y: b.y, rot })),
    { defId: 'van_console', x: 6, y: 1, rot },
    // o painel olha para trás, para quem senta (o volante e os mostradores viram para os agentes)
    { defId: 'van_dash', x: 7, y: 0, rot: VAN.giroPainel },
  ];
}

/** O mapa do chão da van (todo andar 0). */
export const heightmapDaVan = () => Array.from({ length: VAN.largura }, () => '0'.repeat(VAN.comprimento)).join('\n');
