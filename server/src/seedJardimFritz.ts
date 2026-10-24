import { getFurni, RoomMap, type Door } from "@crona/shared";
import type { Database, RoomData } from "./db";
import { type FloorSeed } from "./seed";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";
import { paraCena, Sala } from "./seedMansaoAlbuquerque";

/**
 * O Jardim do Fritz (24/10), pela planta ilustrada do Felipe ("Jardim Secreto · Pedra Serena"): uma propriedade de Pedra
 * Serena, afastada do centro e mais perto do galpão do Fritz (o Felipe: "um jardim secreto do Fritz onde só pessoas muito
 * bem selecionadas vão"). É um lugar à parte no mapa-múndi (chega-se de van), com a campanha dele.
 *
 * Fora: o terreno murado de pedra com o portão para a rua, o caminho principal com a fonte e o espelho d'água, os dois
 * jardins formais de buxinho, o casarão com a varanda, a estufa principal e as auxiliares, o laboratório, o bosque com
 * as trilhas, a instalação de concreto, o alojamento, a oficina, a área de convivência (o pergolado), o cultivo externo,
 * a horta com a composteira, o gazebo e o acesso de serviço. A arte é pixel por código (pecas_px/jardim_fritz.py).
 * O terreno é a planta encolhida pela metade (a de verdade tem uns 110 x 100 m); os cômodos, no tamanho de verdade.
 *
 * Dentro: o casarão (térreo, 1º andar e subsolo), na planta do Felipe, com a `Sala` da mansão (coordenadas da planta,
 * as portas nos dois lados), e os outros prédios, cada um com a sua entrada na frente da porta (24/10).
 *
 * Mudou a montagem? Suba JARDIM_FRITZ_REV.
 */
export const JARDIM_FRITZ = "Jardim do Fritz · ";
export const JARDIM_FRITZ_REV = 4;

const TERREO = "Casarão";
const PRIMEIRO = "Casarão 1º";
const SUBSOLO = "Subsolo";
const FORA = "Jardim";

const DENTRO: Partial<CenaSpec> = { darkness: 0.34, ambient: "#e8d4b0", particles: ["dust"] };
const PORAO: Partial<CenaSpec> = { darkness: 0.62, ambient: "#a89878", particles: ["dust"] };
const ESTUFA: Partial<CenaSpec> = { darkness: 0.18, ambient: "#d4e4c4", particles: ["dust"] };
const LAB: Partial<CenaSpec> = { darkness: 0.3, ambient: "#dce8ec", particles: [] };
const CONCRETO: Partial<CenaSpec> = { darkness: 0.5, ambient: "#9ab0c0", particles: ["dust"] };

/** as entradas dos prédios no jardim (a casa na frente da porta) e a chave da cena de dentro */
const ENTRADAS: [number, number, string][] = [
  [35, 25, "estufa_p"],
  [36, 25, "estufa_p"],
  [24, 25, "estufa_1"],
  [47, 25, "estufa_2"],
  [11, 41, "estufa_3"],
  [16, 18, "laboratorio"],
  [16, 19, "laboratorio"],
  [59, 13, "antecamara"],
  [60, 13, "antecamara"],
  [57, 22, "aloj_copa"],
  [62, 22, "aloj_sala"],
  [56, 29, "oficina"],
  [57, 29, "oficina"],
  [63, 29, "oficina"],
];

// ------------------------------------------------------------------ o terreno (de fora)

const TW = 72;
const TH = 66;
/** o muro: de X0 a X1 e de Y0 a Y1 (o portão na fileira Y1, casas 34 a 37) */
const X0 = 2;
const X1 = 69;
const Y0 = 2;
const Y1 = 61;
const PORTAO_X = 34;
/** o acesso de serviço: o portão no muro do leste, casas 31 a 34 */
const SERVICO_Y = 31;
/** o casarão (24 x 12) e a porta dele (as casas 35 e 36 da fileira da frente) */
const CASARAO = { x: 24, y: 28 };
const ENTRADA_Y = CASARAO.y + 12;
/** os dois jardins formais, de um lado e do outro do caminho */
const FORMAIS: [number, number, number, number][] = [
  [21, 45, 31, 56],
  [40, 45, 50, 56],
];

function terrenoJardim(): Terreno {
  const t = new Terreno(TW, TH);
  // a rua de fora (o asfalto) e a estrada de terra do acesso de serviço
  t.ret(0, Y1 + 1, TW - 1, TH - 1, "t");
  t.ret(X1 + 1, SERVICO_Y, TW - 1, Y1, "d");
  // os caminhos de cascalho: a avenida de leste a oeste na frente da casa, a de trás, as duas de norte a sul
  t.ret(10, 42, 52, 43, "p");
  t.ret(17, 25, 52, 26, "p");
  t.ret(17, 12, 18, 58, "p");
  t.ret(51, 4, 52, 59, "p");
  t.ret(53, SERVICO_Y, X1, SERVICO_Y + 1, "p");
  // o caminho principal de pedra (do portão à varanda), a praça da fonte, a varanda e o caminho da estufa
  t.ret(PORTAO_X, ENTRADA_Y, PORTAO_X + 3, Y1, "q");
  t.ret(31, 45, 40, 51, "q");
  t.ret(33, 52, 38, 58, "q");
  t.ret(30, ENTRADA_Y, 41, ENTRADA_Y + 2, "q");
  t.ret(33, 25, 38, 27, "q");
  // o espelho d'água no meio do caminho
  t.ret(35, 52, 36, 58, "a");
  // a volta de cascalho dentro de cada jardim formal
  for (const [a, b, c, d] of FORMAIS) t.disco((a + c) / 2, (b + d) / 2, 3.2, 3.6, "p");
  // as trilhas do bosque (a volta de terra no canto de cima à esquerda) e a do gazebo
  t.linha([[5, 10], [9, 5], [16, 4], [24, 6], [27, 10], [20, 11], [12, 10], [5, 10]], "d", 1);
  t.linha([[17, 50], [15, 51]], "p", 2);
  // a horta (terra arada) e o chão de terra do cultivo
  t.ret(54, 53, 61, 58, "l");
  return t;
}
const T_JARDIM = terrenoJardim();

function jardimPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  const t = T_JARDIM;
  const livre = (x: number, y: number) => t.at(x, y) === "." || t.at(x, y) === "";
  // os prédios
  f.push(["casarao_fritz", CASARAO.x, CASARAO.y, 4]);
  f.push(["entrada", 35, ENTRADA_Y, 0], ["entrada", 36, ENTRADA_Y, 0]);
  for (const [x, y] of ENTRADAS) f.push(["entrada", x, y, 0]);
  f.push(["estufa_principal", 31, 13, 4], ["estufa_auxiliar", 21, 15, 4], ["estufa_auxiliar", 44, 15, 4], ["estufa_auxiliar", 8, 31, 4]);
  f.push(["laboratorio_fritz", 7, 14, 2], ["contencao_fritz", 54, 4, 4], ["alojamento_fritz", 54, 15, 4], ["oficina_fritz", 54, 23, 4]);
  // o muro de pedra (os pilares nos cantos e a cada 6 casas), o portão da rua e o de serviço
  const pilar = (k: number) => k % 6 === 0;
  for (let x = X0; x <= X1; x++)
    for (const y of [Y0, Y1]) {
      if (y === Y1 && x >= PORTAO_X && x <= PORTAO_X + 3) continue;
      f.push([x === X0 || x === X1 || pilar(x - X0) ? "muro_pilar" : "muro_mansao", x, y, 4]);
    }
  for (let y = Y0 + 1; y < Y1; y++)
    for (const x of [X0, X1]) {
      if (x === X1 && y >= SERVICO_Y && y <= SERVICO_Y + 3) continue;
      f.push([pilar(y - Y0) ? "muro_pilar" : "muro_mansao", x, y, 2]);
    }
  f.push(["portao_mansao", PORTAO_X, Y1, 4, undefined, 1], ["portao_mansao", X1, SERVICO_Y, 6, undefined, 1]);
  // a fonte na praça, os lampiões do caminho, os vasos da escadaria
  f.push(["fonte", 34, 46, 4]);
  for (const y of [45, 50, 55, 59]) f.push(["lampiao_jardim", 32, y, 0], ["lampiao_jardim", 39, y, 0]);
  for (const x of [30, 41]) f.push(["lampiao_jardim", x, ENTRADA_Y + 2, 0]);
  for (const x of [20, 30, 41, 50]) f.push(["lampiao_jardim", x, 44, 0]);
  for (const y of [14, 22, 30, 36, 50, 56]) f.push(["lampiao_jardim", 19, y, 0], ["lampiao_jardim", 53, y, 0]);
  // os jardins formais: a borda de buxinho (aberta no meio de cada lado), as topiárias, as flores e o vaso no meio
  for (const [a, b, c, d] of FORMAIS) {
    const mx = Math.floor((a + c) / 2);
    const my = Math.floor((b + d) / 2);
    for (let x = a; x <= c; x++)
      for (const y of [b, d]) if (x < mx || x > mx + 1) f.push(["buxo", x, y, 0]);
    for (let y = b + 1; y < d; y++) for (const x of [a, c]) if (y < my || y > my + 1) f.push(["buxo", x, y, 0]);
    f.push(["topiaria", mx, my, 0]);
    for (const [x, y] of [[a + 1, b + 1], [c - 2, b + 1], [a + 1, d - 1], [c - 2, d - 1]] as [number, number][]) f.push(["canteiro_flores", x, y, 4]);
    for (const [x, y] of [[a + 1, my], [c - 1, my]] as [number, number][]) if (livre(x, y)) f.push(["topiaria", x, y, 0]);
  }
  f.push(["banco_praca", 32, 47, 2], ["banco_praca", 39, 47, 6]);
  // a área de convivência: o pergolado com as mesas e os bancos embaixo
  f.push(["pergolado", 55, 33, 4], ["table_round", 56, 34, 0], ["table_round", 60, 34, 0]);
  f.push(["banco_praca", 56, 36, 0], ["banco_praca", 60, 36, 0], ["chair_wood", 58, 34, 2], ["chair_wood", 58, 35, 2]);
  // o cultivo externo (os canteiros elevados em fileiras) e a horta com a composteira
  for (const y of [40, 43, 46, 49]) for (const x of [54, 59, 64]) f.push(["canteiro_elevado", x, y, 4]);
  for (let y = 53; y <= 58; y += 2) for (let x = 54; x <= 61; x++) f.push(["horta", x, y, 0]);
  f.push(["composteira", 63, 56, 4], ["composteira", 63, 58, 4]);
  // o gazebo do canto oeste
  f.push(["gazebo_jardim", 12, 49, 4]);
  // as árvores: o bosque do canto de cima à esquerda, as de dentro ao longo do muro, as de fora em volta
  for (let x = 3; x <= 29; x += 2)
    for (let y = 3; y <= 11; y += 2) {
      const k = (x * 7 + y * 13) % 5;
      if (k !== 0 && livre(x, y)) f.push(["arvore", x, y, 0]);
    }
  for (let y = 4; y < Y1 - 1; y += 3) {
    if (y > 12 && livre(3, y)) f.push(["cipreste", 3, y, 0]);
    if (livre(X1 - 1, y)) f.push(["cipreste", X1 - 1, y, 0]);
  }
  for (let x = 4; x < X1 - 1; x += 3) if (livre(x, Y1 - 1) && (x < PORTAO_X - 2 || x > PORTAO_X + 5)) f.push(["arbusto", x, Y1 - 1, 0]);
  for (const [x, y] of [[6, 46], [9, 56], [14, 57], [24, 59], [46, 59], [44, 27], [13, 27], [48, 9], [42, 4], [36, 6], [30, 9]] as [number, number][])
    if (livre(x, y)) f.push(["arvore", x, y, 0]);
  for (let y = 0; y < Y1; y += 2) f.push(["arvore", 0, y, 0], ["arvore", TW - 1, y + 1, 0]);
  for (let x = 1; x < TW - 1; x += 2) f.push(["arvore", x, 0, 0]);
  return f.filter(([id, x, y]) => !["arvore", "arbusto", "cipreste"].includes(id) || livre(x, y));
}

// ------------------------------------------------------------------ o casarão por dentro

const SALAS: Sala[] = [];
const nova = (key: string, nome: string, w: number, h: number, style: string, px: number, py: number, andar: string, desc: string, clima = DENTRO) => {
  const s = new Sala(key, nome, w, h, style, px, py, andar, desc);
  s.prefixo = JARDIM_FRITZ;
  s.semTroca = true;
  s.extra = { ...clima };
  SALAS.push(s);
  return s;
};

// ---------------------------------------------------------------- TÉRREO (32 x 20): a cozinha, a despensa, o hall da escada,
// o lavabo e a sala de música no fundo; a sala de estar, o escritório, o salão, a sala de chá e a sala de visitas na frente
{
  const s = nova("salao", "Salão", 8, 12, "mansao_marmore", 12, 8, TERREO, "O salão do casarão, logo depois da porta: o piso de pedra clara, a mesa comprida de madeira escura sobre o tapete, as cadeiras de espaldar alto, os lustres acesos e o relógio de caixa alta. Daqui se vai para todos os lados.");
  s.porta("S", 15, "jardim").porta("N", 15, "hall_escada").porta("O", 13, "escritorio").porta("L", 13, "sala_cha");
  s.add("rug_aubusson", 2, 4, 4).add("mesa_jantar", 2, 5, 4).cadeiras("cadeira_jantar_luxo", 2, 5, 4, 2, { n: [0, 1, 2, 3], s: [0, 1, 2, 3] });
  s.enc("N", "sideboard", 5).enc("O", "relogio_carrilhao", 1).add("vaso_grande", 0, 11, 0).add("vaso_grande", 7, 11, 0);
  s.lustres([3, 3], [3, 8]);
}
{
  const s = nova("hall_escada", "Hall da Escada", 8, 8, "mansao_marmore", 12, 0, TERREO, "O hall do fundo: a escadaria de madeira que sobe para o 1º andar e, num canto, a escada estreita que desce para o subsolo.");
  s.porta("S", 15, "salao").porta("L", 2, "lavabo");
  s.escada("escada_nobre", 2, 0, 4, "galeria").escada("escada_desce", 6, 0, 4, "deposito");
  s.add("poltrona_orelha", 0, 4, 2).add("table_small", 0, 5, 2).add("vaso_grande", 7, 7, 0).lustres([3, 4]);
}
{
  const s = nova("lavabo", "Lavabo", 4, 5, "azulejo", 20, 0, TERREO, "O lavabo: o vaso, a pia de louça e o espelho de moldura dourada.");
  s.porta("O", 2, "hall_escada");
  s.enc("N", "sink", 1).enc("N", "toilet", 3).par("N", "espelho_dourado", 1.5);
}
{
  const s = nova("cozinha", "Cozinha", 8, 8, "ladrilho", 0, 0, TERREO, "A cozinha grande: o fogão, a pia, a geladeira, o armário de louça e a mesa de trabalho no meio, com as cadeiras.");
  s.porta("S", 3, "sala_estar").porta("L", 2, "despensa");
  s.enc("N", "fogao_lenha", 1).enc("N", "pia_cozinha", 4).enc("N", "geladeira", 6).enc("O", "armario_cozinha", 3);
  s.add("mesa_cozinha", 3, 3, 4).cadeiras("chair_wood", 3, 3, 3, 2, { s: [0, 2] }).lustres([4, 2]);
}
{
  const s = nova("despensa", "Despensa", 4, 5, "ladrilho", 8, 0, TERREO, "A despensa: as prateleiras de madeira cheias de potes, sacos e conservas, um barril e os caixotes.");
  s.porta("O", 2, "cozinha");
  s.enc("N", "prateleira", 0).enc("N", "prateleira", 2).add("crate_wood", 3, 4, 0).add("barrel", 3, 3, 0);
}
{
  const s = nova("sala_estar", "Sala de Estar", 6, 12, "taco", 0, 8, TERREO, "A sala de estar: a lareira, o sofá de couro de frente para ela, as poltronas, a estante e o tapete gasto.");
  s.porta("N", 3, "cozinha").porta("L", 13, "escritorio");
  s.enc("N", "estante_biblioteca", 0).enc("O", "lareira", 4).add("rug_worn", 1, 4, 4).add("sofa_verissimo", 3, 4, 6);
  s.add("armchair_verissimo", 1, 8, 0).add("armchair_verissimo", 2, 8, 0).add("vaso_grande", 0, 11, 0).add("floor_lamp", 5, 11, 0).lustres([3, 6]);
}
{
  const s = nova("escritorio", "Escritório", 6, 12, "madeira", 6, 8, TERREO, "O escritório: a mesa grande de madeira, as estantes do chão ao teto, as poltronas de orelha e o globo.");
  s.porta("O", 13, "sala_estar").porta("L", 13, "salao");
  s.enc("N", "estante_biblioteca", 0).enc("N", "estante_biblioteca", 3).add("mesa_ceo", 1, 8, 4).add("chair_wood", 2, 7, 4);
  s.add("poltrona_orelha", 1, 3, 0).add("poltrona_orelha", 4, 3, 0).add("globo", 5, 11, 0).lustres([3, 5]);
}
{
  const s = nova("sala_cha", "Sala de Chá", 6, 12, "taco", 20, 8, TERREO, "A sala de chá: a mesa redonda com as cadeiras estofadas sobre o tapete, o aparador com o serviço de chá e os vasos.");
  s.porta("O", 13, "salao").porta("L", 13, "sala_visitas");
  s.add("rug_aubusson", 1, 6, 4).add("table_round", 2, 7, 0).cadeiras("cadeira_jantar_luxo", 2, 7, 2, 2, { n: [0, 1], s: [0, 1] });
  s.enc("N", "sideboard", 2).add("vaso_grande", 0, 0, 0).add("vaso_grande", 5, 0, 0).lustres([3, 4]);
}
{
  const s = nova("sala_visitas", "Sala de Visitas", 6, 12, "taco", 26, 8, TERREO, "A sala de visitas: a lareira, o sofá de couro, as poltronas e a mesinha sobre o tapete persa, o relógio no canto.");
  s.porta("O", 13, "sala_cha").porta("N", 28, "sala_musica");
  s.enc("N", "lareira", 3).add("rug_ornate", 1, 6, 4).add("sofa_verissimo", 1, 10, 0).add("armchair_verissimo", 4, 7, 6).add("armchair_verissimo", 4, 8, 6);
  s.add("table_small", 2, 7, 4).add("relogio_carrilhao", 5, 11, 0).lustres([3, 5]);
}
{
  const s = nova("sala_musica", "Sala de Música", 8, 8, "madeira", 24, 0, TERREO, "A sala de música: o piano de cauda sobre o tapete, as poltronas, a estante de partituras e os livros.");
  s.porta("S", 28, "sala_visitas");
  s.add("rug_aubusson", 1, 2, 4).add("piano_cauda", 2, 2, 4).add("banco_piano", 3, 4, 0).add("poltrona_orelha", 6, 3, 6).add("poltrona_orelha", 6, 5, 6);
  s.enc("N", "bookshelf", 5).enc("O", "estante_biblioteca", 4).add("vaso_grande", 0, 0, 0).lustres([4, 3]);
}

// ---------------------------------------------------------------- 1º ANDAR: a galeria no meio (a escadaria e o terraço
// da frente), dois quartos de cada lado, cada um com o seu banheiro
{
  const s = nova("galeria", "Galeria", 8, 16, "madeira", 12, 0, PRIMEIRO, "A galeria do 1º andar: a escadaria que desce, a passadeira comprida, a mesa redonda com o vaso, as poltronas e as portas dos quartos dos dois lados. Na frente, o terraço.");
  s.escada("escada_nobre_desce", 2, 0, 4, "hall_escada");
  s.porta("S", 15, "terraco").porta("O", 5, "quarto_1").porta("O", 14, "quarto_2").porta("L", 5, "quarto_3").porta("L", 14, "quarto_4");
  s.add("tapete_corredor", 3, 3, 4).add("table_round", 3, 10, 0).add("poltrona_orelha", 0, 8, 2).enc("O", "bookshelf", 10);
  s.add("relogio_carrilhao", 7, 8, 0).add("vaso_grande", 0, 15, 0).add("vaso_grande", 7, 15, 0).lustres([3, 3], [3, 9]);
}
{
  const s = nova("terraco", "Terraço", 8, 4, "mansao_marmore", 12, 16, PRIMEIRO, "O terraço em cima da varanda: a balaustrada de pedra, a mesinha com as duas cadeiras e os vasos, e a vista do jardim até o portão.");
  s.porta("N", 15, "galeria");
  s.add("table_small", 1, 1, 4).add("chair_wood", 1, 2, 0).add("chair_wood", 2, 1, 6).add("vaso_grande", 0, 3, 0).add("vaso_grande", 7, 3, 0);
  s.extra = { darkness: 0.3, ambient: "#c8d0c0", particles: ["dust"] };
}
{
  const s = nova("quarto_1", "Quarto 1", 12, 10, "taco", 0, 0, PRIMEIRO, "O quarto grande do lado oeste: a cama de casal de dossel, os criados-mudos, o guarda-roupa, a penteadeira, a cômoda e a poltrona.");
  s.porta("L", 5, "galeria").porta("S", 2, "banho_1");
  s.enc("N", "cama_master", 4).enc("N", "nightstand", 3).enc("N", "nightstand", 7).enc("N", "comoda", 9).enc("O", "guarda_roupa", 3).enc("O", "penteadeira", 6);
  s.add("rug_ornate", 4, 4, 4).add("poltrona_orelha", 9, 7, 6).lustres([5, 4]);
}
{
  const s = nova("banho_1", "Banheiro 1", 5, 6, "azulejo", 0, 10, PRIMEIRO, "O banheiro do quarto 1: a banheira de pés, o vaso, a pia e o espelho.");
  s.porta("N", 2, "quarto_1");
  s.enc("N", "sink", 0).enc("N", "toilet", 4).enc("O", "banheira", 2).par("N", "espelho_dourado", 0.5);
}
{
  const s = nova("quarto_2", "Quarto 2", 7, 10, "taco", 5, 10, PRIMEIRO, "O quarto do canto da frente, a oeste: a cama de casal, os criados-mudos, o guarda-roupa e a escrivaninha.");
  s.porta("L", 14, "galeria").porta("O", 18, "banho_2");
  s.enc("N", "cama_casal", 2).enc("N", "nightstand", 1).enc("N", "nightstand", 4).enc("O", "guarda_roupa", 2);
  s.add("rug_worn", 2, 4, 4).add("desk_wood", 4, 7, 4).add("chair_wood", 4, 6, 4).lustres([3, 4]);
}
{
  const s = nova("banho_2", "Banheiro 2", 5, 4, "azulejo", 0, 16, PRIMEIRO, "O banheiro do quarto 2: o vaso, a pia e o box.");
  s.porta("L", 18, "quarto_2");
  s.enc("N", "toilet", 0).enc("N", "sink", 1).enc("N", "box_chuveiro", 3);
}
{
  const s = nova("quarto_3", "Quarto 3", 12, 10, "taco", 20, 0, PRIMEIRO, "O quarto grande do lado leste: a cama de casal de dossel, os criados-mudos, a cômoda, o guarda-roupa e a poltrona.");
  s.porta("O", 5, "galeria").porta("S", 29, "banho_3");
  s.enc("N", "comoda", 0).enc("N", "nightstand", 3).enc("N", "cama_master", 4).enc("N", "nightstand", 7).enc("N", "guarda_roupa", 9);
  s.add("rug_ornate", 4, 4, 4).add("poltrona_orelha", 2, 7, 0).lustres([6, 4]);
}
{
  const s = nova("banho_3", "Banheiro 3", 5, 6, "azulejo", 27, 10, PRIMEIRO, "O banheiro do quarto 3: a banheira de pés, o vaso, a pia e o espelho.");
  s.porta("N", 29, "quarto_3");
  s.enc("N", "sink", 0).enc("N", "toilet", 4).enc("O", "banheira", 2).par("N", "espelho_dourado", 0.5);
}
{
  const s = nova("quarto_4", "Quarto 4", 7, 10, "taco", 20, 10, PRIMEIRO, "O quarto do canto da frente, a leste: a cama de casal, os criados-mudos, o guarda-roupa e a escrivaninha.");
  s.porta("O", 14, "galeria").porta("L", 18, "banho_4");
  s.enc("N", "guarda_roupa", 0).enc("N", "nightstand", 2).enc("N", "cama_casal", 3).enc("N", "nightstand", 5);
  s.add("desk_wood", 1, 7, 4).add("chair_wood", 1, 6, 4).lustres([3, 4]);
}
{
  const s = nova("banho_4", "Banheiro 4", 5, 4, "azulejo", 27, 16, PRIMEIRO, "O banheiro do quarto 4: o vaso, a pia e o box.");
  s.porta("O", 18, "quarto_4");
  s.enc("N", "toilet", 1).enc("N", "sink", 2).enc("N", "box_chuveiro", 4);
}

// ---------------------------------------------------------------- SUBSOLO (acesso interno, pela escada do hall)
{
  const s = nova("deposito", "Depósito do Subsolo", 20, 12, "pedra", 6, 3, SUBSOLO, "O subsolo embaixo do casarão: o porão comprido de pedra, as estantes de aço cheias de potes, caixas e vidros, as bancadas de trabalho no meio, o carrinho e os caixotes. A escada sobe para o hall.", PORAO);
  s.escada("stairs_up", 9, 0, 4, "hall_escada");
  s.porta("O", 8, "estudo").porta("S", 15, "camara");
  for (const x of [0, 2, 4, 6, 11, 13, 15, 17]) s.enc("N", "shelf_metal", x);
  s.enc("O", "estante_remedios", 1).enc("O", "estante_remedios", 8);
  s.add("lab_bench", 5, 5, 4).add("lab_bench", 7, 5, 4).add("stool_lab", 6, 6, 0).add("stool_lab", 8, 6, 0);
  s.add("mesa_vidro_lab", 14, 4, 4).add("trolley", 12, 8, 0).mais("crate_wood", 0, [18, 10], [18, 9], [17, 10]);
  s.mais("ceiling_lamp", 0, [5, 3], [14, 3], [9, 8]);
}
{
  const s = nova("estudo", "Sala de Estudos", 6, 8, "pedra", 0, 5, SUBSOLO, "A sala de estudos do subsolo: a mesa comprida com a cadeira, as estantes de livros e papéis, a lâmpada pendurada.", PORAO);
  s.porta("L", 8, "deposito");
  s.enc("N", "estante_biblioteca", 0).enc("N", "bookshelf", 3).add("mesa_ceo", 1, 4, 4).add("chair_wood", 2, 3, 4).add("ceiling_lamp", 2, 2, 0);
}
{
  const s = nova("camara", "Câmara do Subsolo", 12, 3, "pedra", 10, 15, SUBSOLO, "A câmara estreita no fundo do subsolo: os dois tanques de vidro e a estante de aço, o chão úmido.", PORAO);
  s.porta("N", 15, "deposito");
  s.add("tank", 1, 1, 4).add("tank", 7, 1, 4).enc("N", "shelf_metal", 10).add("ceiling_lamp", 5, 1, 0);
}

// ---------------------------------------------------------------- OS OUTROS PRÉDIOS (24/10): cada um a sua cena, a porta
// virada para a entrada do jardim
{
  const s = nova("estufa_p", "Estufa Principal", 10, 12, "mansao_estufa", 0, 0, "Estufa Principal", "A estufa grande por dentro: a abóbada de vidro lá em cima, o ar quente e úmido, as palmeiras em vaso e, no meio das plantas comuns, as fileiras de orquídeas de flores carmim que parecem pingar. No fundo, a bancada das mudas.", ESTUFA);
  s.porta("S", 5, "jardim");
  s.enc("N", "palmeira_vaso", 0).enc("N", "orquidea_sangue", 2).enc("N", "bancada_mudas", 4).enc("N", "orquidea_sangue", 7).enc("N", "palmeira_vaso", 9);
  s.add("canteiro_orquideas", 0, 2, 4).add("canteiro_orquideas", 6, 2, 4).add("canteiro_orquideas", 0, 5, 4).add("canteiro_elevado", 6, 5, 4);
  s.add("canteiro_elevado", 0, 8, 4).add("canteiro_elevado", 6, 8, 4);
  s.add("vaso_flores", 0, 11, 0).add("vaso_flores", 9, 11, 0).add("plant", 4, 11, 0);
}
for (let i = 1; i <= 3; i++) {
  const s = nova(`estufa_${i}`, `Estufa ${i}`, 7, 10, "mansao_estufa", 0, 0, `Estufa ${i}`, [
    "Uma das estufas pequenas: os canteiros de pedra cheios de pedras cinzentas com bulbos roxos brotando nas frestas, as bancadas de mudas do outro lado e o cheiro de terra molhada.",
    "Outra estufa pequena: os canteiros de orquídeas de flores carmim, as bancadas de mudas e um regador esquecido no corredor.",
    "A estufa do canto oeste, mais afastada e trancada por fora: os canteiros comuns de um lado e, do outro, as vitrines de vidro com as raízes escuras e o líquido preto que escorre delas.",
  ][i - 1], ESTUFA);
  s.porta("S", 3, "jardim");
  if (i === 1) {
    for (const y of [1, 4, 7]) s.add("canteiro_purpulis", 0, y, 4).add("canteiro_purpulis", 2, y, 4);
    s.add("bravo_purpulis", 0, 9, 0);
  } else if (i === 2) {
    for (const y of [1, 4, 7]) s.add("canteiro_orquideas", 0, y, 4);
    s.add("orquidea_sangue", 0, 9, 0);
  } else for (const y of [1, 4, 7]) s.add("canteiro_elevado", 0, y, 4);
  for (const y of [1, 4, 7]) s.add(i === 3 ? "vitrine_lodo" : "bancada_mudas", 5, y, 4);
  s.add(i === 2 ? "plant" : "palmeira_vaso", 0, 0, 0).add("vaso_flores", 6, 9, 0);
}
{
  const s = nova("laboratorio", "Laboratório", 10, 9, "azulejo", 0, 0, "Laboratório", "O laboratório: as bancadas de azulejo branco com os microscópios e os frascos, a ilha no meio com as banquetas, a mesa de vidro, a estante de remédios, a pia, uma vitrine com raízes escuras e um vaso de orquídea carmim. Tudo limpo demais.", LAB);
  s.porta("L", 4, "jardim");
  s.enc("N", "bancada_lab_parede", 0).enc("N", "bancada_lab_parede", 4).enc("N", "sink", 8);
  s.em("microscope", 1, 0, 4).em("flasks", 3, 0, 4).em("microscope", 6, 0, 4).em("flasks", 5, 0, 4);
  s.add("bancada_lab_ilha", 3, 4, 4).add("stool_lab", 3, 5, 0).add("stool_lab", 5, 5, 0).add("stool_lab", 4, 3, 4);
  s.add("mesa_vidro_lab", 0, 3, 4).add("trolley", 8, 6, 0).enc("O", "estante_remedios", 6).enc("O", "locker", 8).add("vitrine_lodo", 6, 6, 4).add("orquidea_sangue", 9, 5, 0);
  s.mais("ceiling_lamp", 0, [3, 2], [6, 2], [4, 6]);
}
{
  const s = nova("antecamara", "Antecâmara", 12, 3, "metal", 0, 5, "Prédio de Concreto", "A entrada do prédio de concreto: o corredor estreito e frio, os armários de metal, a bancada com as telas das câmeras e a segunda porta de aço, pesada, no fundo.", CONCRETO);
  s.porta("S", 6, "jardim").porta("N", 6, "contencao");
  s.enc("N", "locker_row", 0).enc("N", "locker_row", 2).enc("N", "console", 9).add("stool_metal", 9, 1, 4).add("ceiling_lamp", 6, 1, 0);
}
{
  const s = nova("contencao", "Sala de Contenção", 12, 5, "metal", 0, 0, "Prédio de Concreto", "A sala do fundo do prédio de concreto: os tanques de vidro iluminados por dentro (num deles, uma flor enorme e dentada no meio de tentáculos com sete flores coloridas), a mesa de contenção com as correias, os monitores e os racks zumbindo. O ar é gelado.", CONCRETO);
  s.porta("S", 6, "antecamara");
  s.add("tank", 1, 1, 4).add("tanque_dama", 4, 1, 4).add("mesa_contencao", 8, 1, 4).add("vitals_monitor", 10, 1, 0).add("monitor_suporte", 10, 2, 0);
  s.enc("N", "server_rack", 0).enc("N", "server_rack", 11).mais("ceiling_lamp", 0, [3, 3], [6, 3]);
}
{
  const s = nova("aloj_copa", "Copa do Alojamento", 6, 6, "ladrilho", 0, 0, "Alojamento", "A copa do alojamento: o fogão a gás, a pia, a geladeira, a mesa com as cadeiras e as canecas de quem trabalha aqui.", DENTRO);
  s.porta("S", 3, "jardim").porta("L", 3, "aloj_sala");
  s.enc("N", "fogao_gas", 0).enc("N", "pia_cozinha", 1).enc("N", "geladeira", 3).add("mesa_cozinha", 1, 3, 4).cadeiras("chair_wood", 1, 3, 3, 2, { n: [0, 2] }).add("ceiling_lamp", 5, 4, 0);
}
{
  const s = nova("aloj_sala", "Sala Comum do Alojamento", 6, 6, "taco", 6, 0, "Alojamento", "A sala comum do alojamento: o sofá de frente para a TV, a mesinha, a estante e a escada que sobe para os quartos.", DENTRO);
  s.porta("S", 8, "jardim").porta("O", 3, "aloj_copa");
  s.escada("stairs_up", 4, 0, 4, "aloj_quartos");
  s.enc("N", "rack_tv", 1).add("sofa_leather", 1, 3, 0).add("table_small", 2, 2, 4).enc("O", "bookshelf", 4).add("ceiling_lamp", 3, 2, 0);
}
{
  const s = nova("aloj_quartos", "Quartos do Alojamento", 9, 6, "taco", 0, 0, "Alojamento 1º", "O andar dos quartos: as quatro camas de solteiro em fila, os criados-mudos, o guarda-roupa, a mesa de estudo e a porta do banheiro.", DENTRO);
  s.porta("L", 2, "aloj_banho");
  s.escada("escada_desce", 8, 0, 4, "aloj_sala");
  for (const x of [0, 2, 4, 6]) s.enc("N", "cama_solteiro", x);
  for (const x of [1, 3, 5]) s.enc("N", "nightstand", x);
  s.enc("O", "guarda_roupa", 3).add("desk_wood", 2, 4, 4).add("chair_wood", 2, 3, 4).mais("ceiling_lamp", 0, [4, 3], [6, 3]);
}
{
  const s = nova("aloj_banho", "Banheiro do Alojamento", 3, 6, "azulejo", 9, 0, "Alojamento 1º", "O banheiro do alojamento: o vaso, a pia e o box, as toalhas nos ganchos.", DENTRO);
  s.porta("O", 2, "aloj_quartos");
  s.enc("N", "toilet", 0).enc("N", "sink", 1).enc("N", "box_chuveiro", 2);
}
{
  const s = nova("oficina", "Oficina", 12, 5, "concreto", 0, 0, "Oficina", "A oficina da manutenção: o portão de aço de enrolar, as bancadas de ferramentas, o painel com as chaves penduradas, as estantes com as peças, os galões e os armários de metal.", PORAO);
  s.porta("S", 2, "jardim").porta("S", 9, "jardim");
  s.enc("N", "table_tools", 0).enc("N", "table_tools", 3).enc("N", "shelf_metal", 6).enc("N", "locker", 10).enc("N", "locker", 11);
  s.add("barrel", 11, 4, 0).add("barrel", 11, 3, 0).add("crate_wood", 6, 3, 0).add("crate_wood", 7, 3, 0);
  s.par("N", "tool_board", 2.0, 1.7).mais("ceiling_lamp", 0, [3, 2], [8, 2]);
}

const CENAS: CenaSpec[] = [
  {
    key: "jardim",
    name: JARDIM_FRITZ + "Jardim",
    description:
      "A propriedade murada, afastada do centro de Pedra Serena: de fora, só se vê o alto do casarão por cima do muro de pedra e da mata. Dentro, o caminho de pedra do portão até a varanda, a fonte e o espelho d'água, os jardins de buxinho, as estufas de vidro atrás da casa, os prédios de reboco e telha, o bloco de concreto no canto, o bosque com as trilhas, a horta e o pergolado.",
    layout: { heightmap: T_JARDIM.planta(), door: { x: PORTAO_X + 1, y: Y1 + 2, dir: 0 } satisfies Door },
    andar: FORA,
    style: "grama",
    aberto: true,
    terreno: T_JARDIM.texto(),
    darkness: 0.3,
    ambient: "#b4bc96",
    particles: ["dust"],
    floor: jardimPiso(),
    wall: [],
    links: [
      [35, ENTRADA_Y, "salao"],
      [36, ENTRADA_Y, "salao"],
      ...ENTRADAS,
    ],
    plan: { x: 0, y: 0 },
  },
  ...SALAS.map(paraCena),
];

// ------------------------------------------------------------------ montagem

function ligar(built: Map<string, RoomData>) {
  for (const spec of CENAS) {
    const room = built.get(spec.key)!;
    for (const [x, y, to] of spec.links) {
      const target = built.get(to);
      const it = room.items.find((i) => i.x === x && i.y === y && getFurni(i.defId)?.portal);
      if (!it || !target) {
        console.warn(`[seed] ${room.name}: sem passagem em ${x},${y} (${to})`);
        continue;
      }
      it.link = target.id;
    }
  }
}

/** Monta o Jardim do Fritz e a campanha dele (o lugar "Jardim do Fritz" do mapa-múndi). */
export function seedJardimFritz(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(JARDIM_FRITZ))) return;
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    const room = montar(db, spec);
    estilo(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  db.rooms.push(...built.values());
  const primeira = built.get(CENAS[0].key)!;
  db.campaigns ??= {};
  db.campaigns[String(primeira.id)] = {
    title: "Jardim do Fritz",
    subtitle: "Pedra Serena",
    // a planta do Felipe é noturna: o Jardim abre de noite (o mestre troca no ☀ Clima)
    hora: "noite",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.jardimFritzRev = JARDIM_FRITZ_REV;
}

/** Refaz o Jardim no lugar quando a montagem muda (JARDIM_FRITZ_REV): mesmas cenas e registro; a que saiu é apagada. */
function rebuildJardimFritz(db: Database): boolean {
  if ((db.jardimFritzRev ?? 0) >= JARDIM_FRITZ_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(JARDIM_FRITZ));
  if (!existing.length) return false;
  const key = Math.min(...existing.map((r) => r.id));
  const built = new Map<string, RoomData>();
  const usadas = new Set<number>();
  for (const spec of CENAS) {
    let room = existing.find((r) => r.name === spec.name && !usadas.has(r.id));
    if (room) usadas.add(room.id);
    const fresh = montar(db, spec);
    if (room) {
      db.nextRoomId--;
      Object.assign(room, { name: fresh.name, description: fresh.description, heightmap: fresh.heightmap, door: fresh.door, items: fresh.items, wallItems: fresh.wallItems });
    } else {
      room = fresh;
      db.rooms.push(room);
    }
    estilo(room, spec);
    built.set(spec.key, room);
  }
  ligar(built);
  const ficam = new Set([...built.values()].map((r) => r.id));
  const jardim = built.get("jardim")!;
  for (const velha of existing.filter((r) => !ficam.has(r.id))) {
    for (const t of velha.tokens ?? []) (jardim.tokens ??= []).push({ ...t, x: jardim.door.x, y: jardim.door.y });
    db.rooms.splice(db.rooms.indexOf(velha), 1);
  }
  for (const room of built.values()) {
    const map = new RoomMap(room.heightmap, room.door, room.items);
    for (const t of room.tokens ?? []) {
      if (map.walkState(t.x, t.y) === "walk") continue;
      t.x = room.door.x;
      t.y = room.door.y;
    }
  }
  const camp = db.campaigns?.[String(key)];
  if (camp) {
    camp.hora ??= "noite";
    for (const id of Object.keys(camp.layout)) if (!ficam.has(Number(id))) delete camp.layout[Number(id)];
    for (const s of CENAS) camp.layout[built.get(s.key)!.id] = naPlanta(s);
  }
  db.jardimFritzRev = JARDIM_FRITZ_REV;
  return true;
}

/** Monta o Jardim do Fritz se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarJardimFritz(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(JARDIM_FRITZ))) {
    seedJardimFritz(db);
    return true;
  }
  return rebuildJardimFritz(db);
}
