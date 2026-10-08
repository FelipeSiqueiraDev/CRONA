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
  { id: 'amanhecer', nome: 'Amanhecer', escuro: 0.2, ambiente: '#ffb48a' },
  { id: 'dia', nome: 'Dia', escuro: 0.08, ambiente: '#fff1d6' },
  { id: 'entardecer', nome: 'Entardecer', escuro: 0.3, ambiente: '#ff9a52' },
  { id: 'noite', nome: 'Noite', escuro: 0.62, ambiente: '#4a68c8' },
  { id: 'madrugada', nome: 'Madrugada', escuro: 0.72, ambiente: '#3a3f8a' },
] as const;
export type HoraViagem = (typeof HORAS_VIAGEM)[number]['id'];
export const isHoraViagem = (s: unknown): s is HoraViagem => HORAS_VIAGEM.some((h) => h.id === s);

/** O clima lá fora: a chuva e a neblina são desenhadas por cima da cena. */
export const CLIMAS_VIAGEM = [
  { id: 'limpo', nome: 'Limpo' },
  { id: 'nublado', nome: 'Nublado' },
  { id: 'chuva', nome: 'Chuva' },
  { id: 'tempestade', nome: 'Tempestade' },
  { id: 'neblina', nome: 'Neblina' },
] as const;
export type ClimaViagem = (typeof CLIMAS_VIAGEM)[number]['id'];
export const isClimaViagem = (s: unknown): s is ClimaViagem => CLIMAS_VIAGEM.some((c) => c.id === s);

/**
 * As ilustrações de cena (public/arte/viagem/ilustracoes): aparecem para todos quando a viagem começa e quando termina.
 * `ambientes`: onde cada uma combina (a rodovia do campo não aparece indo para a Sede, a rua da cidade não aparece indo
 * para a fazenda). "estrada" é a que serve para qualquer lugar fora da cidade e do campo.
 */
export type AmbienteViagem = 'cidade' | 'rural' | 'estrada';
export const ILUSTRACOES_VIAGEM: { id: string; nome: string; ambientes: AmbienteViagem[] }[] = [
  { id: 'amanhecer', nome: 'Amanhecer na rodovia', ambientes: ['rural', 'estrada'] },
  { id: 'cidade-madrugada', nome: 'A cidade de madrugada', ambientes: ['cidade'] },
  { id: 'estrada-chuva', nome: 'Estrada na chuva', ambientes: ['estrada', 'rural', 'cidade'] },
  { id: 'estrada-noite', nome: 'Estrada à noite', ambientes: ['estrada', 'rural'] },
  { id: 'estrada-terra-fazenda', nome: 'Estrada de terra, rumo à fazenda', ambientes: ['rural'] },
  { id: 'interior-van', nome: 'Por dentro da van', ambientes: ['cidade', 'rural', 'estrada'] },
  { id: 'neblina', nome: 'Neblina na estrada de terra', ambientes: ['rural'] },
  { id: 'ponte', nome: 'A ponte ao amanhecer', ambientes: ['estrada', 'rural'] },
  { id: 'posto-noite', nome: 'Posto de gasolina à noite', ambientes: ['estrada', 'cidade'] },
  { id: 'tunel', nome: 'O túnel', ambientes: ['estrada', 'cidade'] },
];
export const arteDaIlustracao = (id: string) => `/arte/viagem/ilustracoes/ilust-${id}.png`;

/** O jeito do lugar de destino, pelo nome ("Fazenda Olhos de Águia" é do campo; "Sede da Ordem" é da cidade). */
export function ambienteDoDestino(nome?: string): AmbienteViagem {
  if (!nome) return 'estrada';
  if (/fazenda|arredores|celeiro|casar[aã]o|calabou[cç]o|mantimentos|olhos de [aá]guia|s[ií]tio|orfanato/i.test(nome)) return 'rural';
  if (/sede|ordem|ordo|cidade|pr[eé]dio|bar\b|subsolo/i.test(nome)) return 'cidade';
  return 'estrada';
}

/** Sorteia uma ilustração que combina com o lugar, fugindo da `evitar` (para a partida e a chegada não repetirem). */
export function sortearIlustracao(ambiente: AmbienteViagem, evitar?: string, rnd: () => number = Math.random): string {
  const certas = ILUSTRACOES_VIAGEM.filter((i) => i.ambientes.includes(ambiente));
  const lista = certas.filter((i) => i.id !== evitar);
  const de = lista.length ? lista : certas.length ? certas : ILUSTRACOES_VIAGEM;
  return de[Math.floor(rnd() * de.length) % de.length].id;
}

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
  /** o clima (sem o campo, limpo) */
  clima?: ClimaViagem;
  /** 0 a 1 */
  velocidade: number;
  /** o nome do destino ("Fazenda · Cozinha"), mostrado na cena */
  destino?: string;
  /** a cena do destino: "Chegamos" abre exatamente ela */
  destinoId?: number;
  /** a ilustração da tela de partida, para a da chegada não repetir */
  ilustracao?: string;
  /** a cena de onde a viagem partiu (liga a viagem à campanha) */
  origem: number;
}

/**
 * A van, em casas (0,75 m): o comprimento corre em x (a frente é x grande), a largura em y. O casco todo (da traseira ao
 * para-choque) tem 8 casas; o PISO, onde os agentes ficam, só as 6 de trás: dali para a frente é o capô (o motor).
 */
export const VAN = {
  comprimento: 8,
  /** o piso: da traseira ao painel (o capô fica de fora) */
  piso: 6,
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

/** Os oito bancos: o motorista e o carona na frente (junto do painel) e duas fileiras de três atrás. */
export const BANCOS_VAN: BancoVan[] = [
  { id: 0, nome: 'Motorista', x: 4, y: 2 },
  { id: 1, nome: 'Carona', x: 4, y: 0 },
  { id: 2, nome: 'Fila 2 · porta', x: 2, y: 2 },
  { id: 3, nome: 'Fila 2 · meio', x: 2, y: 1 },
  { id: 4, nome: 'Fila 2 · janela', x: 2, y: 0 },
  { id: 5, nome: 'Fila 3 · porta', x: 0, y: 2 },
  { id: 6, nome: 'Fila 3 · meio', x: 0, y: 1 },
  { id: 7, nome: 'Fila 3 · janela', x: 0, y: 0 },
];

/** O que a van leva por dentro (mobis do jogo): os bancos e o painel (sem nada entre o motorista e o carona). */
export function moveisDaVan(): { defId: string; x: number; y: number; rot: number }[] {
  const rot = VAN.giroBanco;
  return [
    ...BANCOS_VAN.map((b) => ({ defId: 'van_seat', x: b.x, y: b.y, rot })),
    // o painel olha para trás, para quem senta (o volante e os mostradores viram para os agentes)
    { defId: 'van_dash', x: VAN.piso - 1, y: 0, rot: VAN.giroPainel },
  ];
}

/** O mapa do chão da van (todo andar 0): só o piso, sem o capô. */
export const heightmapDaVan = () => Array.from({ length: VAN.largura }, () => '0'.repeat(VAN.piso)).join('\n');
