import { getFurni, RoomMap, type FloorItem } from '@crona/shared';
import type { Database, RoomData } from './db';
import { estilo, montar, naPlanta, type CenaSpec } from './seedFazenda';
import { paraCena, Sala } from './seedMansaoAlbuquerque';

/**
 * O Frigorífico Albuquerque (11/11/2026, o Felipe: "é lá que o Alosi e a Catarina vão lutar"; "o Frigorífico fica na
 * campanha da Mansão Albuquerque"; "o mapa igual é sempre feito na nossa plataforma, lugarzinho isométrico"):
 *
 * Como as outras cenas do jogo, cada cômodo é uma CENA (planta com paredes, piso, móveis com arte, luzes e clima), e as
 * cenas se ligam por portas e escadas. O desenho do frigorífico de 1918 (o PDF "Mapa Frigorífico 1918") só serve de
 * referência do layout; cada quadrado dele é uma casa (0,75 m):
 *
 *   Rua da Frente (ao ar livre) → Salão de Abate (a nave grande, com os trilhos de carcaças, as mesas de corte e as
 *   portas para o Escritório, a Casa da Caldeira, os Currais e a Doca) → a escada que desce para a Área Gelada.
 *
 * A Área Gelada é a câmara fria: pequena, bem iluminada e azulada, só com os varais de porcos pendurados.
 *
 * A Rua da Frente se liga ao Jardim da Mansão por uma Entrada (a saída dos fundos), e é por ela que o frigorífico entra
 * no grupo de cenas (e na campanha) da Mansão. Uma vez só (`db.frigorificoRev`); rodar de novo só reconfere as pontas
 * (a Mansão refeita pode tirar a Entrada do Jardim) e nunca duplica nem apaga o que o mestre mexeu.
 */
export const FRIGORIFICO_REV = 2;
export const PREFIXO = 'Frigorífico Albuquerque · ';
export const NOMES = {
  rua: `${PREFIXO}Rua da Frente`,
  salao: `${PREFIXO}Salão de Abate`,
  gelada: `${PREFIXO}Área Gelada`,
  escritorio: `${PREFIXO}Escritório`,
  caldeira: `${PREFIXO}Casa da Caldeira`,
  currais: `${PREFIXO}Currais`,
  doca: `${PREFIXO}Doca de Carga`,
};
const JARDIM = 'Mansão Albuquerque · Jardim';
/** o que a primeira montagem (a imagem do mapa no chão, 10/11) deixou: sai na migração */
const ANTIGAS = ['Frigorífico Albuquerque', 'Frigorífico Albuquerque · Área Gelada'];

/** coordenadas da PLANTA do prédio (casas): onde cada cômodo fica, na ordem do desenho */
const PLANTA = {
  salao: { x: 12, y: 2, w: 24, h: 20 },
  escritorio: { x: 2, y: 3, w: 10, h: 10 },
  caldeira: { x: 37, y: 2, w: 10, h: 9 },
  currais: { x: 37, y: 13, w: 10, h: 10 },
  doca: { x: 1, y: 14, w: 11, h: 10 },
  gelada: { x: 12, y: 2, w: 12, h: 9 },
};

const DESCRICAO = {
  rua: 'A rua em frente ao Frigorífico Albuquerque, de 1918: o cascalho manchado, a escada larga da entrada, a luz amarela do poste e o cheiro de sangue velho que sai pelas frestas do portão.',
  salao:
    'O salão de abate do Frigorífico Albuquerque: o ladrilho branco manchado, os trilhos com as carcaças penduradas em fileira, as longas mesas de corte de aço, os ralos no chão e o frio de ferro. ' +
    'A porta da frente dá para a rua; as outras levam ao escritório, à caldeira, aos currais e à doca, e uma escada larga, no canto de baixo à esquerda, desce para a área gelada.',
  gelada:
    'A câmara fria do frigorífico: o azulejo branco molhado, a luz azul-gelo dos tubos de teto, o ar que sai branco da boca e o varal atrás do varal de porcos pendurados em fileira, balançando nos ganchos. Alguma coisa ficou guardada aqui por tempo demais.',
  escritorio: 'O escritório do frigorífico: a mesa grande do gerente, os arquivos de metal com as contas de cem anos, a caixa-forte no canto e um calendário parado em outro século.',
  caldeira: 'A casa da caldeira: a fornalha de ferro rugindo, o monte de carvão no canto e a tubulação que corre pelo teto levando o calor (e o cheiro) para o resto do frigorífico.',
  currais: 'Os currais dos fundos: baias de madeira com palha suja, o chão de terra batida e o grunhido dos últimos porcos que ainda esperam a vez.',
  doca: 'A doca de carga: o portão de enrolar por onde entram os caminhões, as caixas e os caixotes empilhados e o carrinho de carne com a roda quebrada.',
};

/** o que passa a ser um varal de porcos: uma fileira de ganchos de carne de lado, um depois do outro */
const varal = (s: Sala, y: number, x0: number, x1: number, passo = 1) => {
  for (let x = x0; x <= x1; x += passo) s.add('porco_pendurado', x, y, 2);
};

// ------------------------------------------------------------------ as salas

function salao(): Sala {
  const p = PLANTA.salao;
  const s = new Sala('salao', 'Salão de Abate', p.w, p.h, 'ladrilho', p.x, p.y, 'Térreo', DESCRICAO.salao);
  s.prefixo = PREFIXO;
  s.semTroca = true;
  s.extra = { darkness: 0.34, fog: 0.12, ambient: '#c4dcf5', particles: ['dust'] };
  // os trilhos: duas fileiras de carcaças penduradas, no alto
  varal(s, 2, 3, 21, 2);
  varal(s, 5, 3, 21, 2);
  // as mesas de corte (aço, a meia carcaça aberta em cima), os cepos, a serra de fita, o tanque de escalda e os carrinhos
  for (const x of [4, 10, 16]) s.add('mesa_corte', x, 8, 2).add('mesa_corte', x, 12, 2);
  s.add('bloco_de_corte', 8, 10, 4).add('bloco_de_corte', 14, 10, 4).add('bloco_de_corte', 20, 8, 4).add('tanque_de_escalda', 20, 11, 2);
  s.add('carrinho_de_carne', 8, 14, 4).add('carrinho_de_carne', 14, 14, 4).add('carrinho_de_carne', 21, 14, 4);
  // as caixas da doca, no canto de baixo à direita, e os barris
  s.add('crate_wood', 21, 17, 4).add('crate_wood', 21, 18, 4).add('crate_wood', 22, 17, 4).add('barril_madeira', 22, 15, 0);
  // os ralos e o sangue no chão
  for (const [x, y] of [[9, 7], [15, 7], [9, 14], [15, 14], [3, 10]]) s.add('dirt', x, y, 0);
  for (const [x, y] of [[6, 10], [12, 10], [18, 11], [7, 4], [16, 4], [12, 17]]) s.add('blood_pool', x, y, 0);
  s.add('blood_drops', 13, 6, 0).add('blood_drops', 5, 6, 0).add('blood_drops', 19, 13, 0);
  // as luzes frias de teto em fileira, a placa na parede do fundo
  for (const y of [1, 7, 13, 18]) for (const x of [4, 10, 16, 21]) s.add('ceiling_lamp', x, y, 0);
  s.par('N', 'placa_frigorifico', 12, 2.0);
  // a escada que desce para a Área Gelada (na quina do fundo, onde as duas paredes se encontram) e as portas
  s.escada('escada_simples', 0, 0, 4, 'gelada');
  s.porta('S', p.x + 12, 'rua');
  s.porta('O', p.y + 4, 'escritorio');
  s.porta('O', p.y + 17, 'doca');
  s.porta('L', p.y + 4, 'caldeira');
  s.porta('L', p.y + 15, 'currais');
  return s;
}

/** A câmara fria: pequena, bem iluminada e azul, só os varais cheios de porcos (a escada de volta no canto). */
function gelada(): Sala {
  const p = PLANTA.gelada;
  const s = new Sala('gelada', 'Área Gelada', p.w, p.h, 'camara_fria', p.x, p.y, 'Subsolo', DESCRICAO.gelada);
  s.prefixo = PREFIXO;
  s.semTroca = true;
  s.extra = { darkness: 0.5, fog: 0.4, ambient: '#1c4c9c', particles: ['dust'] };
  s.escada('escada_simples_fria', 0, 0, 4, 'salao');
  // os varais: fileiras paralelas, uma depois da outra, cheias
  [1, 3, 5, 7].forEach((y, i) => varal(s, y, i % 2 ? 3 : 2, 10, 2));
  // as luzes de teto, em fileira cobrindo a sala toda (nas fileiras livres entre os varais)
  for (const y of [2, 6]) for (const x of [2, 6, 10]) s.add('fluorescent', x, y, 0);
  // o ralo e o sangue
  s.add('dirt', 6, 0, 0).add('blood_drops', 4, 4, 0).add('blood_drops', 9, 6, 0);
  return s;
}

function escritorio(): Sala {
  const p = PLANTA.escritorio;
  const s = new Sala('escritorio', 'Escritório', p.w, p.h, 'madeira', p.x, p.y, 'Térreo', DESCRICAO.escritorio);
  s.prefixo = PREFIXO;
  s.semTroca = true;
  s.extra = { darkness: 0.5, fog: 0, ambient: '#d2a060', particles: ['dust'] };
  s.add('desk_wood', 3, 3, 4).add('chair_wood', 4, 5, 0).add('papers', 1, 7, 0).add('livros_couro', 4, 3, 4);
  s.add('bookshelf', 1, 0, 4).add('estante_arquivo', 4, 0, 4);
  s.add('cofre', 8, 0, 4).add('armchair', 7, 7, 6).add('ceiling_lamp', 4, 4, 0).add('candelabra', 1, 5, 0);
  s.porta('L', p.y + 3, 'salao');
  return s;
}

function caldeira(): Sala {
  const p = PLANTA.caldeira;
  const s = new Sala('caldeira', 'Casa da Caldeira', p.w, p.h, 'concreto', p.x, p.y, 'Térreo', DESCRICAO.caldeira);
  s.prefixo = PREFIXO;
  s.semTroca = true;
  s.extra = { darkness: 0.58, fog: 0.1, ambient: '#e07a3a', particles: ['embers', 'dust'] };
  s.add('fornalha', 3, 0, 4).add('fole', 5, 2, 6).add('pilha_carvao', 7, 0, 4).add('ceiling_lamp', 5, 4, 0);
  s.porta('O', p.y + 4, 'salao');
  return s;
}

function currais(): Sala {
  const p = PLANTA.currais;
  const s = new Sala('currais', 'Currais', p.w, p.h, 'terra', p.x, p.y, 'Térreo', DESCRICAO.currais);
  s.prefixo = PREFIXO;
  s.semTroca = true;
  s.extra = { darkness: 0.5, fog: 0.1, ambient: '#b09870', particles: ['dust'] };
  for (const [x, y] of [[2, 0], [4, 0], [6, 0], [8, 0]]) s.add('baia', x, y, 4);
  for (const [x, y] of [[2, 4], [4, 4], [6, 4], [8, 4]]) s.add('baia', x, y, 4);
  s.add('feno', 1, 8, 4).add('feno', 2, 8, 4).add('barril_madeira', 9, 7, 0).add('dirt', 5, 7, 0).add('dirt', 3, 6, 0).add('puddle', 6, 6, 0);
  for (const [x, y, rot] of [[3, 0, 4], [5, 0, 2], [7, 0, 4], [3, 4, 2], [5, 4, 4], [7, 4, 2]] as const) s.add('porco_morto', x, y, rot);
  s.porta('O', p.y + 2, 'salao');
  return s;
}

function doca(): Sala {
  const p = PLANTA.doca;
  const s = new Sala('doca', 'Doca de Carga', p.w, p.h, 'concreto', p.x, p.y, 'Térreo', DESCRICAO.doca);
  s.prefixo = PREFIXO;
  s.semTroca = true;
  s.extra = { darkness: 0.5, fog: 0.1, ambient: '#b0b8c8', particles: ['dust'] };
  for (const [x, y] of [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1]]) s.add('crate_wood', x, y, 4);
  for (const [x, y] of [[8, 0], [9, 0], [8, 1], [9, 1]]) s.add('crate_wood', x, y, 4);
  s.add('carrinho_de_carne', 5, 3, 4).add('carrinho_de_carne', 7, 5, 2).add('barril_madeira', 10, 5, 0).add('barril_madeira', 10, 6, 0).add('crate_wood', 1, 6, 4);
  for (const x of [3, 8]) s.add('ceiling_lamp', x, 4, 0);
  s.add('dirt', 4, 6, 0).add('blood_drops', 6, 7, 0);
  s.porta('S', p.x + 5, 'rua');
  s.porta('L', p.y + 3, 'salao');
  return s;
}

/** A rua da frente, ao ar livre: o cascalho, a escada da entrada e os postes (as saídas: o Salão, a Doca e o Jardim). */
function rua(): CenaSpec {
  const W = 26;
  const H = 14;
  const hm = Array.from({ length: H }, () => '0'.repeat(W)).join('\n');
  return {
    key: 'rua',
    name: NOMES.rua,
    description: DESCRICAO.rua,
    layout: { heightmap: hm, door: { x: 13, y: H - 2, dir: 0 } },
    andar: 'Frigorífico Albuquerque Rua',
    style: 'cascalho',
    darkness: 0.35,
    fog: 0.12,
    ambient: '#8ea4c8',
    particles: ['dust'],
    aberto: true,
    floor: [
      ['entrada', 12, 1, 0],
      ['entrada', 13, 1, 0],
      ['entrada', 5, 1, 0],
      ['entrada', 13, 12, 0],
      ['poste_ferro', 8, 3, 0],
      ['poste_ferro', 18, 3, 0],
      ['banco_praca', 21, 4, 4],
      ['crate_wood', 2, 5, 4],
      ['crate_wood', 3, 5, 4],
      ['barril_madeira', 23, 7, 0],
      ['trash_bin', 24, 9, 4],
      ['dirt', 10, 6, 0],
      ['dirt', 16, 8, 0],
      ['blood_drops', 12, 4, 0],
      ['puddle', 8, 9, 0],
    ],
    links: [
      [12, 1, 'salao'],
      [13, 1, 'salao'],
      [5, 1, 'doca'],
    ],
    plan: { x: 0, y: 30 },
  };
}

// ------------------------------------------------------------------ a montagem

const entrada = (db: Database, x: number, y: number, link: number): FloorItem => ({ id: db.nextItemId++, defId: 'entrada', x, y, z: 0, rot: 0, state: 0, link });

/** A casa livre do Jardim, perto da cerca da direita, para a Entrada do frigorífico. */
function casaNoJardim(jardim: RoomData): { x: number; y: number } | null {
  const mapa = new RoomMap(jardim.heightmap, jardim.door, jardim.items);
  for (const [x, y] of [[45, 46], [45, 44], [45, 42], [45, 48], [45, 40], [44, 46]] as const) if (mapa.canPlace('entrada', x, y, 0).ok) return { x, y };
  return null;
}

/** Tira o que a primeira montagem deixou (a imagem do mapa no chão): as cenas, a Entrada do Jardim e quem estava dentro. */
function tirarAntigas(db: Database, jardim: RoomData) {
  const velhas = db.rooms.filter((r) => ANTIGAS.includes(r.name));
  for (const v of velhas) {
    for (const t of v.tokens ?? []) (jardim.tokens ??= []).push({ ...t, x: jardim.door.x, y: jardim.door.y });
    db.rooms.splice(db.rooms.indexOf(v), 1);
    for (const r of db.rooms) r.items = r.items.filter((i) => i.link !== v.id);
    for (const c of Object.values(db.campaigns ?? {})) delete c.layout[v.id];
  }
  return velhas.length > 0;
}

export function montarFrigorifico(db: Database): boolean {
  const jardim = db.rooms.find((r) => r.name === JARDIM);
  if (!jardim) return false;
  let mudou = false;
  // a primeira montagem (rev 1) deixou o mapa com imagem e uma Área Gelada de 20 × 14: saem, e as novas entram
  if ((db.frigorificoRev ?? 0) === 1 && tirarAntigas(db, jardim)) mudou = true;
  const nome = (k: keyof typeof NOMES) => db.rooms.find((r) => r.name === NOMES[k]);
  if (!nome('salao') && !nome('gelada')) {
    // uma vez só: se o mestre apagou tudo depois, não volta
    if ((db.frigorificoRev ?? 0) >= FRIGORIFICO_REV) return mudou;
    const specs: CenaSpec[] = [rua(), ...[salao(), gelada(), escritorio(), caldeira(), currais(), doca()].map(paraCena)];
    const feitas = new Map<string, RoomData>();
    for (const spec of specs) {
      const sala = montar(db, spec);
      estilo(sala, spec);
      feitas.set(spec.key, sala);
    }
    // as passagens: cada uma liga ao destino pela chave
    for (const spec of specs) {
      const sala = feitas.get(spec.key)!;
      for (const [x, y, para] of spec.links) {
        const alvo = feitas.get(para);
        const it = sala.items.find((i) => i.x === x && i.y === y && getFurni(i.defId)?.portal);
        if (!it || !alvo) console.warn(`[frigorífico] ${sala.name}: sem passagem em ${x},${y} (${para})`);
        else it.link = alvo.id;
      }
    }
    db.rooms.push(...feitas.values());
    // a planta do prédio no minimapa (a campanha da Mansão)
    const camp = Object.values(db.campaigns ?? {}).find((c) => jardim.id in c.layout);
    if (camp) for (const spec of specs) camp.layout[feitas.get(spec.key)!.id] = naPlanta(spec);
    db.frigorificoRev = FRIGORIFICO_REV;
    mudou = true;
  }
  // as pontas: a Entrada da rua para o Jardim e a do Jardim para a rua
  const rr = nome('rua');
  if (!rr) return mudou;
  let volta = rr.items.find((i) => i.defId === 'entrada' && i.x === 13 && i.y === 12);
  if (!volta) {
    volta = entrada(db, 13, 12, jardim.id);
    rr.items.push(volta);
    mudou = true;
  }
  if (volta.link !== jardim.id) (volta.link = jardim.id), (mudou = true);
  if (!jardim.items.some((i) => i.defId === 'entrada' && i.link === rr.id)) {
    const casa = casaNoJardim(jardim);
    if (casa) {
      jardim.items.push(entrada(db, casa.x, casa.y, rr.id));
      mudou = true;
    } else console.warn('[frigorífico] não achei casa livre no Jardim para a Entrada');
  }
  return mudou;
}

