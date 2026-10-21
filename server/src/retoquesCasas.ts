import type { Database } from './db';

/**
 * Os erros da conferência dos cenários (21/10, o Felipe: "quero fazer isso aqui também"): o que está no lugar errado ou
 * fora do clima de cada lugar (frascos de laboratório sobre o balcão da loja, cama azul e nova no quarto queimado,
 * lixeira branca de hospital no orfanato, o mesmo quadro do casarão em todas as casas...), mais os detalhes pequenos
 * (Santo Berço de fora, a pedido).
 *
 * Os `seed*.ts` já saem com isso certo; aqui os cenários que já estão no banco são retocados no lugar, sem refazer a
 * sala, para não desfazer o que o mestre arrumou pelo jogo. Roda uma vez (`db.retoquesCasas2110`).
 */
type Pos = [x: number, y: number];

interface Retoque {
  /** o nome da cena (ou o começo dele, com `*` no fim) */
  sala: string;
  /** troca o defId do móvel que está na casa (x, y) */
  trocar?: [defId: string, para: string, ...Pos][];
  /** tira o móvel do defId que está na casa (x, y) */
  tirar?: [defId: string, ...Pos][];
  /** tira todo móvel desse defId na cena */
  tirarTodos?: string[];
  /** troca o defId de todo móvel da cena */
  trocarTodos?: [defId: string, para: string][];
  /** põe o móvel noutra casa e no chão: defId, de (x, y), para (x, y) */
  mover?: [defId: string, ...Pos, ...Pos][];
  /** troca o defId do enfeite de parede */
  paredeTrocar?: [defId: string, para: string][];
  paredePlano?: [defId: string, plano: number][];
}

const RETOQUES: Retoque[] = [
  // ---- erros claros
  { sala: 'Sede · Sala de Rituais', trocar: [['flasks', 'candles', 2, 6], ['flasks', 'books_stack', 7, 6]] },
  { sala: 'Sede · Prisão', tirar: [['ceiling_lamp', 11, 9]] },
  { sala: 'Sede · Salão Principal', paredePlano: [['emergency_light', 1]] },
  { sala: 'Sede · Bar', tirar: [['beer_crate', 11, 3]] },
  { sala: 'Orfanato · Banheiro', tirar: [['desk_wood', 4, 0], ['chair_wood', 5, 1]] },
  { sala: 'Orfanato · Quarto da Diretora', trocar: [['cama_solteiro', 'cama_queimada', 5, 0]] },
  {
    sala: 'Orfanato · Sala de Cirurgia',
    trocar: [['hospital_bed', 'catre', 2, 0], ['hospital_bed', 'catre', 7, 0]],
    tirar: [['monitor_suporte', 6, 0]],
    paredeTrocar: [['cage_lamp', 'tocha_parede']],
  },
  { sala: 'Orfanato *', trocarTodos: [['trash_bin', 'trash_can']] },
  { sala: 'Orfanato · Salão', mover: [['escombros', 8, 7, 11, 4]] },
  { sala: 'Orfanato · Enfermaria', tirar: [['trolley', 3, 3]] },
  { sala: 'Santo Berço · Ferraria', trocar: [['table_tools', 'mesa_rustica', 2, 5]] },
  { sala: 'Tiradentes · Pousada', paredeTrocar: [['shelf_wall', 'wall_shelf']] },
  { sala: 'Igarapé · Venda', trocarTodos: [['prateleira', 'prateleira_venda']] },
  // ---- detalhes pequenos (menos Santo Berço)
  { sala: 'Igarapé · Capela', tirar: [['igarape_santa', 8, 0], ['candles', 1, 0], ['candles', 7, 0]] },
  { sala: 'Tiradentes · Cidade', tirar: [['barrel', 8, 23], ['crate_wood', 39, 23]] },
  { sala: 'Tiradentes · Igreja Matriz', tirar: [['rug_worn', 5, 3], ['rug_worn', 5, 9]] },
  { sala: 'Orfanato · Quarto *', trocarTodos: [['chest_army', 'bau_madeira']] },
  {
    sala: 'Orfanato · Sala de Cirurgia',
    tirar: [['blood_drops', 1, 1], ['blood_drops', 5, 1], ['blood_drops', 8, 2], ['blood_pool', 4, 5], ['blood_pool', 6, 1], ['blood_pool', 8, 3]],
  },
  {
    sala: 'Orfanato · Salão',
    tirar: [['blood_drops', 3, 6], ['blood_drops', 11, 6], ['blood_drops', 9, 13], ['blood_pool', 6, 9], ['blood_pool', 7, 12]],
  },
  { sala: 'Fazenda · Quarto das Crianças', tirar: [['pilha_chao', 2, 2], ['pilha_chao', 6, 1], ['pilha_chao', 7, 0]] },
];

/** O mesmo quadro do casarão repetido nas casas de Tiradentes e Igarapé (e no boteco e na sacristia): quadro comum. */
const QUADRO_COMUM = ['Tiradentes ·', 'Igarapé ·'];

const casa = (sala: string, nome: string): boolean => (sala.endsWith('*') ? nome.startsWith(sala.slice(0, -1)) : nome === sala);

export function retoquesCasas2110(db: Database): boolean {
  const d = db as Database & { retoquesCasas2110?: boolean };
  if (d.retoquesCasas2110) return false;
  d.retoquesCasas2110 = true;
  for (const r of RETOQUES)
    for (const room of db.rooms) {
      if (!casa(r.sala, room.name)) continue;
      for (const [defId, para, x, y] of r.trocar ?? []) {
        const it = room.items.find((i) => i.defId === defId && i.x === x && i.y === y);
        if (it) it.defId = para;
      }
      for (const [defId, para] of r.trocarTodos ?? []) for (const it of room.items) if (it.defId === defId) it.defId = para;
      for (const [defId, x, y] of r.tirar ?? []) {
        const i = room.items.findIndex((it) => it.defId === defId && it.x === x && it.y === y);
        if (i >= 0) room.items.splice(i, 1);
      }
      for (const defId of r.tirarTodos ?? []) room.items = room.items.filter((it) => it.defId !== defId);
      for (const [defId, x, y, nx, ny] of r.mover ?? []) {
        const it = room.items.find((i) => i.defId === defId && i.x === x && i.y === y);
        if (it) {
          it.x = nx;
          it.y = ny;
          it.z = 0;
        }
      }
      for (const [defId, para] of r.paredeTrocar ?? []) for (const w of room.wallItems) if (w.defId === defId) w.defId = para;
      for (const [defId, plano] of r.paredePlano ?? []) for (const w of room.wallItems) if (w.defId === defId) w.plane = plano;
    }
  for (const room of db.rooms)
    if (QUADRO_COMUM.some((p) => room.name.startsWith(p)))
      for (const w of room.wallItems) if (w.defId.startsWith('quadro_fazenda')) w.defId = 'painting';
  return true;
}
