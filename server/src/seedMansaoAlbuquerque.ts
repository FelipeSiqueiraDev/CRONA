import { footprint, getFurni, getWallFurni, RoomMap, Z_PER_M, type Door, type FloorStyle, type Hint } from "@crona/shared";
import fs from "node:fs";
import path from "node:path";
import type { Database, RoomData } from "./db";
import { DATA_DIR } from "./pastas";
import { type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planRight } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * A Mansão Albuquerque (21/10; refeita em 23/10 pela planta ilustrada do Felipe, com menos cômodos e maiores): o lar da
 * Catarina e do Miguel. O jardim murado de fora e o anexo; o térreo (salão principal com as duas escadarias, biblioteca,
 * escritório de Alexander, sala de jantar, cozinha, despensa, a ala de serviço com os seis quartos dos funcionários e a lavanderia); o
 * 2º andar (hall superior, suíte do casal com o closet, sala de jogos, os quartos do Miguel, da Catarina e de hóspedes, cada um com o
 * seu banheiro) e o mezanino da Catarina. A lista de cômodos, as ligações e o que há em cada um estão em `docs/MANSAO-ALBUQUERQUE.md`.
 *
 * 1 quadrado da planta = 1 casa (0,75 m). Cada cômodo é uma cena (o Felipe: "entrei na sala, mudou o cenário"), com porta
 * nos dois lados. As salas são descritas em coordenadas LOCAIS (0..w-1, 0..h-1) e as portas pela coordenada da PLANTA
 * (a mesma nos dois vizinhos, o que garante o alinhamento); o resto do trabalho (o vão da porta principal, o deslocamento
 * dos móveis e dos itens de parede) é feito em `paraCena`.
 *
 * Mudou a montagem? Suba MANSAO_REV: a mansão é refeita no lugar, mantendo as cenas, as peças e o registro.
 */
export const MANSAO = "Mansão Albuquerque · ";
export const MANSAO_REV = 12;

const ANDAR = "Mansão Albuquerque";
const ANDAR2 = "Mansão Albuquerque 2º";
const ANDAR_MEZ = "Mansão Albuquerque Mezanino";
const FORA = "Jardim da Mansão";

const hint = (title: string, text: string): Hint => ({ icon: "inspect", title, text, visible: true });
const oculta = (title: string, text: string): Hint => ({ ...hint(title, text), visible: false });
/**
 * As pistas da campanha não vão para o repositório (é público): o texto de verdade fica em
 * `server/data/segredos-mansao.json` (fora do git, `{ chave: { title, text } }`). Sem o arquivo, a pista leva o texto neutro daqui.
 */
const SEGREDOS: Record<string, { title?: string; text?: string }> = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "segredos-mansao.json"), "utf8"));
  } catch {
    return {};
  }
})();
const segredo = (chave: string, title: string, text: string): Hint => oculta(SEGREDOS[chave]?.title ?? title, SEGREDOS[chave]?.text ?? text);

// ------------------------------------------------------------------ o clima de cada piso

type Clima = Pick<CenaSpec, "darkness" | "ambient" | "particles">;
const CLIMA: Record<string, Clima> = {
  mansao_marmore: { darkness: 0.26, ambient: "#e4d8c0", particles: ["dust"] },
  mansao_nobre: { darkness: 0.36, ambient: "#d0a070", particles: ["dust"] },
  mansao_claro: { darkness: 0.28, ambient: "#eadfc8", particles: ["dust"] },
  mansao_servico: { darkness: 0.3, ambient: "#e6e2d2", particles: ["dust"] },
  mansao_estufa: { darkness: 0.2, ambient: "#d4e4c4", particles: ["dust"] },
  mansao_banho: { darkness: 0.28, ambient: "#e8e4dc", particles: [] },
  mansao_jogos: { darkness: 0.42, ambient: "#c09a68", particles: ["dust", "smoke"] },
  mansao_caverna: { darkness: 0.7, ambient: "#6a4aa8", particles: ["dust"] },
  mansao_rustico: { darkness: 0.52, ambient: "#a8946e", particles: ["dust"] },
  mansao_tabuas: { darkness: 0.5, ambient: "#a8946e", particles: ["dust"] },
};

// ------------------------------------------------------------------ a sala em coordenadas locais

type Lado = "N" | "S" | "L" | "O";
/** N = parede do fundo da direita (y = 0), O = parede do fundo da esquerda (x = 0), S e L = as da frente. */
const ROT_DO_LADO: Record<Lado, number> = { N: 4, O: 2, S: 0, L: 6 };

/**
 * A mansão moderna (23/10, o Felipe: "a casa dos Albuquerque está muito feinha, cheio de madeira e coisas com aparência
 * velha; é uma mansão no meio da grande São Paulo: é tudo mármore, coisas chiques... essas coisas atuais muito chiques que
 * os ricos têm"): cada móvel velho vira o moderno do mesmo tamanho, no mesmo lugar (pecas_px/mansao_moderno.py). null
 * tira (o barril, as sacas, as velas no criado-mudo). A madeira que fica é a das estantes entalhadas do século XVII. O
 * Anexo (o depósito de pedra do jardim) fica como é.
 */
const MODERNO: Record<string, string | null> = {
  fogao_lenha: "bancada_cooktop",
  pia_cozinha: "bancada_pia",
  armario_cozinha: "armario_cozinha_laca",
  mesa_cozinha: "ilha_marmore",
  geladeira: "geladeira_embutida",
  prateleira: "estante_despensa",
  crate_wood: "cesto_roupa",
  barrel: null,
  sacas: null,
  candles: null,
  cesta_pao: "fruteira_prata",
  jarra_canecas: "servico_cha",
  mesa_jantar: "mesa_jantar_marmore",
  sideboard: "aparador_marmore",
  armor_display: "escultura_moderna",
  estatua_jardim: "escultura_moderna",
  nightstand: "criado_laca",
  guarda_roupa: "armario_laca",
  comoda: "comoda_laca",
  desk_wood: "escrivaninha_vidro",
  chair_wood: "cadeira_design",
  cama_casal: "cama_estofada",
  cama_solteiro: "cama_solteiro_estofada",
  rug_ornate: "tapete_contemporaneo_v",
  rug_aubusson: "tapete_contemporaneo",
  rug_worn: "tapete_contemporaneo_p",
  estante_biblioteca: "estante_entalhada",
  bookshelf: "estante_entalhada_2",
  mesa_ceo: "mesa_executiva",
  bar_escritorio: "bar_vidro",
  sofa_verissimo: "sofa_moderno",
  armchair_verissimo: "poltrona_luxo",
  bar_counter: "bar_marmore",
  bar_shelf: "adega_iluminada",
  stool_bar: "banqueta_design",
  bench: "banco_moderno",
  sink: "cuba_marmore",
  cama_master: "cama_master_estofada",
  penteadeira: "penteadeira_moderna",
  poltrona_orelha: "poltrona_luxo",
  table_small: "mesa_lateral_marmore",
  // 24/10: o relógio de carrilhão clássico vira a escultura de bronze
  relogio_carrilhao: "escultura_moderna",
};
/** os itens de parede velhos que saem (os utensílios pendurados da cozinha de fazenda) ou mudam (a janela de cortina vinho, 24/10) */
const MODERNO_PAREDE: Record<string, string | null> = { utensilios_parede: null, janela_cortinas: "janela_moderna" };
/** os cômodos que ficam como eram */
const SEM_TROCA = new Set(["anexo"]);

interface Porta {
  lado: Lado;
  /** a coordenada da PLANTA ao longo da parede (x para N e S, y para O e L) */
  ao: number;
  para: string;
  /** 0 aberta (padrão), 1 fechada */
  estado?: number;
  pista?: Hint;
}

export class Sala {
  /** outro lugar que usa a mesma planta (o Jardim do Fritz): o prefixo do nome e sem a troca pelo móvel moderno */
  prefixo?: string;
  semTroca = false;
  floor: FloorSeed[] = [];
  wall: WallSeed[] = [];
  portas: Porta[] = [];
  /** passagens que não são portas (escadas): [x, y, chave] em coordenadas locais */
  links: [number, number, string][] = [];
  chao: CenaSpec["chao"] = [];
  extra: Partial<CenaSpec> = {};
  constructor(
    public key: string,
    public nome: string,
    public w: number,
    public h: number,
    public style: string,
    public px: number,
    public py: number,
    public andar: string,
    public description: string,
  ) {}

  /** um móvel nas coordenadas locais (giro 4 por padrão: a frente para +y) */
  add(id: string, x: number, y: number, rot = 4, pista?: Hint, estado?: number) {
    const troca = this.semTroca || SEM_TROCA.has(this.key) ? undefined : MODERNO[id];
    if (troca === null) return this;
    this.floor.push([troca ?? id, x, y, rot, pista, estado]);
    return this;
  }
  /** vários iguais */
  mais(id: string, rot: number, ...at: [number, number][]) {
    for (const [x, y] of at) this.add(id, x, y, rot);
    return this;
  }
  /** encostado numa parede: `pos` é a primeira casa ao longo dela */
  enc(lado: Lado, id: string, pos: number, pista?: Hint, estado?: number) {
    const d = getFurni(id)!;
    const rot = ROT_DO_LADO[lado];
    if (lado === "N") this.add(id, pos, 0, rot, pista, estado);
    else if (lado === "S") this.add(id, pos, this.h - d.depth, rot, pista, estado);
    else if (lado === "O") this.add(id, 0, pos, rot, pista, estado);
    else this.add(id, this.w - d.depth, pos, rot, pista, estado);
    return this;
  }
  /** a mesa/o objeto em cima de outro (mesma casa) */
  em(id: string, x: number, y: number, rot = 4, pista?: Hint, estado?: number) {
    return this.add(id, x, y, rot, pista, estado);
  }
  /** cadeiras viradas para a mesa (x, y, largura, fundo da mesa no giro 4): n = cima, s = baixo, o = esquerda, l = direita */
  cadeiras(id: string, x: number, y: number, w: number, d: number, o: { n?: number[]; s?: number[]; o?: number[]; l?: number[] }) {
    for (const cx of o.n ?? []) this.add(id, x + cx, y - 1, 4);
    for (const cx of o.s ?? []) this.add(id, x + cx, y + d, 0);
    for (const cy of o.o ?? []) this.add(id, x - 1, y + cy, 2);
    for (const cy of o.l ?? []) this.add(id, x + w, y + cy, 6);
    return this;
  }
  /** item de parede: `pos` é o centro ao longo da parede (casas), `cm` a altura do centro (m) */
  par(lado: "N" | "O", id: string, pos: number, cm = 1.55, pista?: Hint, estado?: number) {
    const trocaP = this.semTroca || SEM_TROCA.has(this.key) ? undefined : MODERNO_PAREDE[id.split("~")[0]];
    if (trocaP === null) return this;
    if (trocaP) id = trocaP;
    const d = getWallFurni(id.split("~")[0]);
    if (!d) throw new Error(`item de parede desconhecido: ${id}`);
    const z = Math.round((cm * Z_PER_M - d.h / 64) * 100) / 100;
    this.wall.push([id, lado === "N" ? "r" : "l", 0, pos, z, pista, estado]);
    return this;
  }
  porta(lado: Lado, ao: number, para: string, estado?: number, pista?: Hint) {
    this.portas.push({ lado, ao, para, estado, pista });
    return this;
  }
  escada(id: string, x: number, y: number, rot: number, para: string) {
    this.floor.push([id, x, y, rot]);
    this.links.push([x, y, para]);
    return this;
  }
  /** uma lâmpada (lustre) nas casas dadas */
  lustres(...at: [number, number][]) {
    for (const [x, y] of at) this.add("lustre_cristal", x, y, 0);
    return this;
  }
  item(x: number, y: number, nome: string, espacos: number) {
    (this.chao ??= []).push([x, y, nome, espacos, "misc"]);
    return this;
  }
}

/** A porta principal da sala: a da frente (S ou L) se houver, para o vão não aparecer; senão a primeira. */
function principal(s: Sala): Porta | undefined {
  return s.portas.find((p) => p.lado === "S") ?? s.portas.find((p) => p.lado === "L") ?? s.portas[0];
}

/** Põe a sala no quadro da cena: o vão da porta principal, o deslocamento de tudo e as passagens. */
export function paraCena(s: Sala): CenaSpec {
  const pr = principal(s);
  let layout: { heightmap: string; door: Door };
  let ox = 0;
  let oy = 0;
  const loc = pr ? pr.ao - (pr.lado === "N" || pr.lado === "S" ? s.px : s.py) : Math.floor(s.w / 2);
  if (!pr || pr.lado === "S") layout = planBottom(s.w, s.h, loc);
  else if (pr.lado === "L") layout = planRight(s.w, s.h, loc);
  else if (pr.lado === "N") {
    // porta na parede do fundo da direita: o vão na fileira 0, a sala começa na 1
    const rows = [Array.from({ length: s.w }, (_, x) => (x === loc ? "0" : "x")).join("")];
    for (let y = 0; y < s.h; y++) rows.push("0".repeat(s.w));
    layout = { heightmap: rows.join("\n"), door: { x: loc, y: 0, dir: 4 } };
    oy = 1;
  } else {
    const rows: string[] = [];
    for (let y = 0; y < s.h; y++) rows.push((y === loc ? "0" : "x") + "0".repeat(s.w));
    layout = { heightmap: rows.join("\n"), door: { x: 0, y: loc, dir: 2 } };
    ox = 1;
  }
  const desloca = (f: FloorSeed): FloorSeed => [f[0], f[1] + ox, f[2] + oy, f[3], f[4], f[5]];
  const floor: FloorSeed[] = [];
  const moveis: FloorSeed[] = s.floor.map(desloca);
  const links: [number, number, string][] = s.links.map(([x, y, k]) => [x + ox, y + oy, k]);
  for (const p of s.portas) {
    const l = p.lado;
    const pos = p.ao - (l === "N" || l === "S" ? s.px : s.py);
    const [x, y] = l === "N" ? [pos, 0] : l === "S" ? [pos, s.h - 1] : l === "O" ? [0, pos] : [s.w - 1, pos];
    if (pos < 0 || pos >= (l === "N" || l === "S" ? s.w : s.h)) console.warn(`[seed] ${s.nome}: a porta ${l}@${p.ao} cai fora da sala`);
    floor.push(["portal", x + ox, y + oy, ROT_DO_LADO[l], p.pista, p.estado]);
    links.push([x + ox, y + oy, p.para]);
  }
  // os itens de parede: o plano e a posição no quadro da cena; sai o que cai em cima de uma porta ou escada
  // as passagens vêm primeiro: o móvel é que cede, nunca a porta
  const escadas = moveis.filter((f) => getFurni(f[0])?.portal);
  const resto = moveis.filter((f) => !getFurni(f[0])?.portal);
  const lustres = resto.filter((f) => f[0] === "lustre_cristal");
  const tapetes = resto.filter((f) => getFurni(f[0])?.flat);
  const demais = resto.filter((f) => f[0] !== "lustre_cristal" && !getFurni(f[0])?.flat);
  floor.push(...escadas, ...lustres, ...tapetes, ...demais);
  const vaos: { wall: "l" | "r"; a0: number; a1: number }[] = [];
  for (const f of floor) {
    const d = getFurni(f[0]);
    if (!d?.portal) continue;
    const { sx, sy } = footprint(d, f[3]);
    if (f[3] === 4 && f[2] === oy) vaos.push({ wall: "r", a0: f[1], a1: f[1] + sx });
    if (f[3] === 2 && f[1] === ox) vaos.push({ wall: "l", a0: f[2], a1: f[2] + sy });
  }
  const wall: WallSeed[] = [];
  const usados: { lado: string; a0: number; a1: number; z0: number; z1: number }[] = [];
  for (const w of s.wall) {
    const [id, lado, , pos, z, h, st] = w;
    const d = getWallFurni(id.split("~")[0])!;
    const meia = d.w / 32 / 2;
    const plano = lado === "r" ? oy : ox;
    const ini = lado === "r" ? ox : oy;
    const compr = lado === "r" ? s.w : s.h;
    const p0 = pos + ini;
    const z1 = z + d.h / 32;
    // o móvel alto encostado nesta parede, a porta e outro quadro: o item se desloca (de meia em meia casa) até um trecho livre
    const livre = (p: number) => {
      if (p - meia < ini - 0.01 || p + meia > ini + compr + 0.01) return false;
      if (vaos.some((v) => v.wall === lado && Math.min(p + meia, v.a1) - Math.max(p - meia, v.a0) > -0.06)) return false;
      if (usados.some((u) => u.lado === lado && Math.min(p + meia, u.a1) - Math.max(p - meia, u.a0) > 0.02 && Math.min(z1, u.z1) - Math.max(z, u.z0) > 0.02)) return false;
      for (const f of floor) {
        const fd = getFurni(f[0]);
        if (!fd || fd.height <= 0 || fd.flat || fd.walkable) continue;
        if ((lado === "l" ? f[1] : f[2]) !== plano) continue;
        const { sx, sy } = footprint(fd, f[3]);
        const [b0, b1] = lado === "l" ? [f[2], f[2] + sy] : [f[1], f[1] + sx];
        if (Math.min(p + meia, b1) - Math.max(p - meia, b0) <= 0.05) continue;
        if (fd.height > z + 0.05) return false;
      }
      return true;
    };
    let achou: number | null = null;
    for (let k = 0; k <= 16 && achou === null; k++)
      for (const sinal of k === 0 ? [1] : [1, -1]) {
        const p = p0 + sinal * k * 0.25;
        if (livre(p)) {
          achou = p;
          break;
        }
      }
    if (achou === null) {
      console.warn(`[seed] ${s.nome}: ${id} em ${lado}@${pos} não achou lugar na parede; ignorado`);
      continue;
    }
    usados.push({ lado, a0: achou - meia, a1: achou + meia, z0: z, z1 });
    wall.push([id, lado, plano, achou, z, h, st]);
  }
  const clima = CLIMA[s.style] ?? CLIMA.mansao_nobre;
  return {
    key: s.key,
    name: (s.prefixo ?? MANSAO) + s.nome,
    description: s.description,
    layout,
    andar: s.andar,
    style: s.style as FloorStyle,
    ...clima,
    ...s.extra,
    floor,
    wall,
    links,
    plan: { x: s.px, y: s.py },
    chao: (s.chao ?? []).map(([x, y, ...r]) => [x + ox, y + oy, ...r] as NonNullable<CenaSpec["chao"]>[number]),
  };
}

// ------------------------------------------------------------------ o jardim (de fora)

const JW = 48;
const JH = 56;
/** o centro do portão e do caminho */
const CX = 24;
/** o portão: casas 22 a 25 da fileira de baixo do muro */
const PORTAO_Y = 53;
/** o anexo (canto de baixo à esquerda) */
const ANEXO = { x: 6, y: 36, w: 8, h: 6 };

function terrenoJardim(): Terreno {
  const t = new Terreno(JW, JH);
  // o pátio de pedra entre as alas e o caminho do portão até o pórtico
  t.ret(18, 30, 30, 33, "p");
  t.ret(22, 30, 25, PORTAO_Y, "p");
  // a volta de pedra em volta dos gramados, como na fachada, e o círculo da fonte
  t.volta(14, 31, 34, 49, 6, "p", 2);
  t.disco(CX, 41, 4.4, 3.6, "p");
  // as trilhas de terra: a oeste até o anexo e uma volta pelo fundo
  t.linha([[16, 44], [12, 44], [10, ANEXO.y + ANEXO.h + 1.5]], "d", 2);
  t.linha([[3, 31], [6, 33], [14, 32]], "d", 2);
  t.linha([[44, 31], [40, 33], [33, 32]], "d", 2);
  return t;
}
const T_JARDIM = terrenoJardim();

function jardimPiso(): FloorSeed[] {
  const f: FloorSeed[] = [];
  const t = T_JARDIM;
  const livre = (x: number, y: number) => t.at(x, y) === "." || t.at(x, y) === "";
  // os quatro blocos da mansão (o U) e as entradas
  f.push(["mansao_central", 18, 2, 4], ["mansao_ala_oeste", 5, 7, 4], ["mansao_ala_leste", 31, 7, 4], ["mansao_portico", 20, 21, 4]);
  f.push(["entrada", 23, 30, 0], ["entrada", 24, 30, 0]);
  f.push(["anexo_mansao", ANEXO.x, ANEXO.y, 4], ["entrada", ANEXO.x + 4, ANEXO.y + ANEXO.h, 0]);
  // o muro em volta (pilares nos cantos e a cada 6 casas) e o portão
  const X0 = 1;
  const X1 = 46;
  const Y0 = 1;
  const Y1 = PORTAO_Y;
  const pilar = (x: number, y: number) => (x - X0) % 6 === 0 || (y - Y0) % 6 === 0;
  for (let x = X0; x <= X1; x++) {
    for (const y of [Y0, Y1]) {
      if (y === Y1 && x >= 22 && x <= 25) continue;
      const canto = x === X0 || x === X1;
      f.push([canto || (x - X0) % 6 === 0 ? "muro_pilar" : "muro_mansao", x, y, 4]);
    }
  }
  for (let y = Y0 + 1; y < Y1; y++)
    for (const x of [X0, X1]) f.push([pilar(x, y) && (y - Y0) % 6 === 0 ? "muro_pilar" : "muro_mansao", x, y, 2]);
  f.push(["portao_mansao", 22, PORTAO_Y, 4, undefined, 1]);
  // a fonte no meio do círculo, o chafariz do jardim
  f.push(["fonte", CX - 1, 40, 4]);
  // os ciprestes e os lampiões ao longo do caminho de pedra, as topiárias nos gramados
  for (const y of [34, 38, 45, 49]) {
    f.push(["cipreste", 21, y, 0], ["cipreste", 26, y, 0]);
  }
  for (const y of [36, 47, 51]) f.push(["lampiao_jardim", 21, y, 0], ["lampiao_jardim", 26, y, 0]);
  for (const [x, y] of [[17, 36], [17, 40], [17, 44], [31, 36], [31, 40], [31, 44], [20, 31], [28, 31]] as [number, number][]) f.push(["topiaria", x, y, 0]);
  f.push(["estatua_jardim", 19, 33, 4], ["estatua_jardim", 28, 33, 4]);
  // os canteiros no pé das alas e os bancos de frente para a fonte
  for (const x of [6, 9, 12, 15]) f.push(["canteiro_flores", x, 31, 4]);
  for (const x of [32, 35, 38, 41]) f.push(["canteiro_flores", x, 31, 4]);
  f.push(["banco_praca", 19, 42, 2], ["banco_praca", 28, 42, 6]);
  // as árvores: o bosque em volta, fora do muro, e as de dentro
  for (let y = 0; y < JH; y += 2) {
    f.push(["arvore", 0, y, 0], ["arvore", JW - 1, y + 1 < JH ? y + 1 : y, 0]);
  }
  for (let x = 1; x < JW - 1; x += 2) f.push(["arvore", x, 0, 0], ["arvore", x + 1 < JW - 1 ? x + 1 : x, JH - 1, 0]);
  for (const [x, y] of [[3, 9], [3, 18], [3, 27], [4, 33], [4, 49], [9, 51], [14, 52], [10, 48], [35, 51], [41, 48], [44, 9], [44, 19], [44, 28], [44, 38], [44, 50], [3, 41], [45, 33]] as [number, number][])
    if (livre(x, y)) f.push(["arvore", x, y, 0]);
  for (const [x, y] of [[2, 22], [2, 35], [45, 24], [45, 42]] as [number, number][]) if (livre(x, y)) f.push(["arbusto", x, y, 0]);
  return f;
}

// ------------------------------------------------------------------ as salas

const SALAS: Sala[] = [];
const nova = (key: string, nome: string, w: number, h: number, style: string, px: number, py: number, andar: string, desc: string) => {
  const s = new Sala(key, nome, w, h, style, px, py, andar, desc);
  SALAS.push(s);
  return s;
};

// ---------------------------------------------------------------- TÉRREO (a planta do Felipe de 23/10: menos cômodos, cada um maior)
// a ala de serviço (à esquerda): os seis quartos dos funcionários em volta do corredor, a lavanderia e a área de serviço
for (let i = 0; i < 6; i++) {
  const cima = i < 4;
  const px = cima ? i * 4 : (i - 4) * 4;
  const py = cima ? 0 : 7;
  const s = nova(`func${i + 1}`, `Quarto de Funcionário ${i + 1}`, 4, 4, "mansao_servico", px, py, ANDAR, `O quarto ${i + 1} dos funcionários: pequeno, limpo e simples, a cama de solteiro bem esticada, o criado-mudo e ${cima ? "o guarda-roupa" : "a cadeira"}.`);
  s.porta(cima ? "S" : "N", px + 2, "corr_func");
  s.enc("N", "cama_solteiro", 0).enc("N", "nightstand", 1).em("candles", 1, 0, 4);
  if (cima) s.enc("N", "guarda_roupa", 2).add("chair_wood", 3, 2, 6);
  else s.enc("N", "nightstand", 3).add("chair_wood", 3, 2, 6);
}
{
  const s = nova("corr_func", "Corredor dos Funcionários", 16, 3, "mansao_servico", 0, 4, ANDAR, "O corredor da ala dos funcionários, claro e silencioso: as portas dos seis quartos, a da lavanderia e, no fim, a da cozinha. O quadro das chaves e os bancos estofados.");
  s.porta("N", 2, "func1").porta("N", 6, "func2").porta("N", 10, "func3").porta("N", 14, "func4");
  s.porta("S", 2, "func5").porta("S", 6, "func6").porta("S", 11, "lavanderia").porta("L", 5, "cozinha");
  s.add("tapete_corredor", 4, 0, 2).enc("N", "bench", 3).enc("N", "bench", 11);
  s.par("N", "quadro_chaves", 8.0, 1.6).lustres([5, 1], [12, 1]);
}
{
  const s = nova("lavanderia", "Lavanderia", 8, 4, "mansao_servico", 8, 7, ANDAR, "A lavanderia: as bancadas com os tanques, as máquinas de lavar de última geração e os cestos de palha com a roupa dobrada.");
  s.porta("N", 11, "corr_func");
  s.enc("N", "tanque", 0).enc("N", "tanque", 1).enc("N", "maquina_lavar", 5).enc("N", "maquina_lavar", 6);
  s.add("crate_wood", 7, 3, 0).add("trash_can", 0, 3, 0);
}
// a biblioteca, à esquerda do salão (23/10: cresceu para o lugar da área de serviço; o Felipe: as estantes nas duas paredes,
// no canto do L a vitrine "com algo muito chique que só alguém rico teria", o tapete grande no meio, um sofá em cada lado
// dele e as poltronas nas diagonais)
{
  const s = nova("biblioteca", "Biblioteca", 16, 13, "mansao_nobre", 0, 11, ANDAR, "A grande biblioteca da casa, de dinheiro antigo: as estantes do chão ao teto correndo pelas duas paredes e, no canto onde elas se encontram, a vitrine de vidro com o ovo de ouro cravejado de pedras. No meio, sobre o tapete imperial, quatro sofás de veludo capitonê em volta da mesa de mármore negro e, nas pontas, as bergères douradas.");
  s.porta("L", 19, "salao");
  s.add("vitrine_ovo", 0, 0, 4);
  // a vitrine no canto com uma casa livre de cada lado (para chegar perto do vidro), e as estantes correndo daí em diante
  for (const x of [2, 5, 8, 11]) s.enc("N", "estante_biblioteca", x);
  s.enc("N", "bookshelf", 14);
  for (const y of [2, 5, 8]) s.enc("O", "estante_biblioteca", y);
  s.enc("O", "bookshelf", 11);
  s.add("tapete_imperial", 5, 4, 4);
  s.add("sofa_luxo", 6, 3, 4).add("sofa_luxo", 6, 9, 0).add("sofa_luxo_vinho", 4, 5, 2).add("sofa_luxo_vinho", 11, 5, 6);
  s.add("poltrona_luxo", 4, 3, 4).add("poltrona_luxo", 11, 3, 4).add("poltrona_luxo_verde", 4, 9, 0).add("poltrona_luxo_verde", 11, 9, 0);
  s.add("mesa_centro_luxo", 7, 6, 4).em("decanter_tacas", 7, 6, 4).em("arranjo_flores", 8, 6, 4);
  s.add("escada_biblioteca", 9, 1, 4).add("globo", 14, 11, 0).add("balde_champanhe", 13, 11, 0).add("floor_lamp", 2, 11, 0);
  s.lustres([8, 5], [8, 8]);
}
// a cozinha, a despensa e a sala de jantar, no fundo
{
  const s = nova("cozinha", "Cozinha", 10, 7, "mansao_servico", 16, 0, ANDAR, "A cozinha gourmet da mansão, ampla e reluzente: a coluna de fornos em laca marfim, as bancadas de mármore Calacatta com o cooktop e a cuba, a geladeira embutida de inox e, no meio, a ilha de mármore em cascata. Dali descem as bandejas para o salão e para a sala de jantar.");
  s.porta("S", 22, "salao").porta("O", 5, "corr_func").porta("L", 2, "despensa");
  s.enc("N", "armario_cozinha", 0).enc("N", "fogao_lenha", 2).enc("N", "pia_cozinha", 4).enc("N", "geladeira", 6).enc("N", "armario_cozinha", 8);
  s.enc("O", "armario_cozinha", 1).add("mesa_cozinha", 3, 3, 4).em("cesta_pao", 3, 3, 4).em("jarra_canecas", 4, 3, 4);
  s.add("barrel", 9, 6, 0).lustres([4, 2]).par("N", "utensilios_parede", 3.0, 1.9);
  // os objetinhos (23/10): a fruteira e a bandeja na ilha
  s.em("fruteira_prata", 5, 3, 4).em("food_tray", 5, 4, 4);
}
{
  const s = nova("despensa", "Despensa", 5, 5, "mansao_servico", 26, 0, ANDAR, "A despensa, organizada como uma loja: as prateleiras de laca até o teto com os potes de vidro de tampa de latão, as caixas de linho, os vinhos deitados e a adega climatizada.");
  s.porta("O", 2, "cozinha");
  s.enc("N", "prateleira", 1).enc("N", "adega", 3).add("barrel", 4, 4, 0).add("sacas", 3, 4, 0).add("crate_wood", 4, 3, 0);
}
{
  const s = nova("jantar", "Sala de Jantar", 10, 12, "mansao_nobre", 31, 0, ANDAR, "A sala de jantar: a mesa comprida de vinte lugares de mármore Calacatta sobre as bases de latão, o tapete contemporâneo, a lareira de mármore na cabeceira, o aparador de mármore preto com a prataria, os lustres de cristal e os quadros a óleo. Cabe uma festa inteira, e hoje cabe o silêncio.");
  s.porta("O", 9, "salao");
  s.add("rug_aubusson", 3, 2, 2).add("rug_aubusson", 3, 6, 2);
  s.add("mesa_jantar", 4, 2, 2).add("mesa_jantar", 4, 6, 2);
  // as cadeiras de medalhão dos lados; nas pontas, uma só: a poltrona do dono da casa na ponta da parede (23/10)
  s.cadeiras("cadeira_jantar_luxo", 4, 2, 2, 8, { o: [0, 1, 2, 3, 4, 5, 6, 7], l: [0, 1, 2, 3, 4, 5, 6, 7] });
  s.add("cadeira_cabeceira", 4, 1, 4).add("cadeira_jantar_luxo", 4, 10, 0);
  s.enc("N", "lareira_marmore", 7).enc("O", "sideboard", 1).mais("palmeira_vaso", 0, [9, 11], [0, 11]).add("armor_display", 9, 5, 6);
  s.lustres([5, 4], [5, 8]).par("N", "pintura_mestre~5", 2.5, 1.9).par("O", "pintura_mestre~3", 5.5, 1.85);
  // os objetinhos (23/10): os candelabros, a fruteira e o arranjo na mesa; o serviço de chá e o uísque no aparador; o champanhe
  s.em("candelabro_prata", 4, 3, 4).em("fruteira_prata", 5, 5, 4).em("arranjo_flores", 4, 6, 4).em("candelabro_prata", 5, 8, 4);
  s.em("servico_cha", 0, 1, 2).em("decanter_tacas", 0, 2, 2).add("balde_champanhe", 9, 8, 0);
}
// o salão principal, o hall de entrada com as duas escadarias
{
  const s = nova("salao", "Salão Principal", 15, 17, "mansao_marmore", 16, 7, ANDAR, "O salão principal, o hall de entrada da mansão: o mármore claro, o tapete vermelho que vem da porta, as colunas, a escultura de bronze no meio sob o grande lustre e as duas escadarias curvas que sobem ao andar de cima. Nas paredes, a galeria da família: os retratos de todas as gerações, do fundador, junto da entrada, até os netos, no fundo. Daqui se vai à biblioteca, ao escritório, à sala de jantar e à cozinha.");
  s.porta("S", 23, "jardim").porta("N", 22, "cozinha").porta("O", 19, "biblioteca").porta("L", 9, "jantar").porta("L", 17, "escritorio");
  s.escada("escada_nobre", 2, 0, 4, "hall_s").escada("escada_nobre", 10, 0, 4, "hall_s");
  s.add("tapete_redondo", 6, 5, 0).add("tapete_longo", 6, 9, 4);
  s.add("estatua_jardim", 7, 6, 4);
  s.mais("coluna_marmore", 0, [5, 13], [9, 13], [5, 16], [9, 16]);
  s.mais("palmeira_vaso", 0, [0, 0], [14, 0], [0, 16], [14, 16]).mais("vaso_grande", 0, [5, 0]);
  s.add("poltrona_luxo", 2, 13, 2).add("poltrona_luxo", 12, 13, 6).enc("O", "console_dourado", 7).enc("N", "relogio_carrilhao", 9);
  s.lustres([7, 3], [7, 11], [3, 8], [11, 8]);
  // a galeria da família (23/10, o Felipe: "concentrasse todos os quadros da família só no Hall central, meio que começa do
  // mais antigo e vai circulando a sala até os mais novos"): da entrada, pela parede da esquerda até o fundo, e daí pela
  // parede do fundo; o fundador primeiro, os netos por último (retrato_familia ~1 a ~9, cada vez menos envelhecidos)
  s.par("O", "retrato_familia", 14.6, 1.8, segredo("retrato-fundador", "O retrato do fundador", "Um homem de terno claro e olhos cansados, numa moldura dourada, com a plaquinha embaixo. O que ela diz fica com o mestre."));
  s.par("O", "retrato_familia~2", 10.9, 1.8).par("O", "retrato_familia~3", 9.35, 1.8, segredo("galeria-retrato-1", "Retrato a óleo", "Um homem de terno escuro, num retrato antigo com a plaquinha dourada. O que ela diz fica com o mestre."));
  s.par("O", "retrato_familia~4", 7.8, 1.8, segredo("galeria-retrato-2", "Retrato a óleo", "Outro retrato de família, de outra época, com a plaquinha dourada. O que ela diz fica com o mestre."));
  s.par("O", "retrato_familia~5", 6.25, 1.8).par("O", "retrato_familia~6", 4.7, 1.8).par("O", "retrato_familia~7", 3.2, 1.8);
  s.par("O", "retrato_familia~8", 1.75, 1.8).par("N", "retrato_familia~9", 8.0, 1.8);
  s.item(9, 10, "Cartão de Visita dos Albuquerque", 0.5);
  // os objetinhos (23/10): o arranjo no console, as mesinhas ao lado das poltronas com o candelabro e os porta-retratos
  s.em("arranjo_flores", 0, 7, 2).add("table_small", 3, 13, 0).em("porta_retratos", 3, 13, 0).add("table_small", 11, 13, 0).em("candelabro_prata", 11, 13, 0);
}
// o escritório do pai, à direita do salão
{
  const s = nova("escritorio", "Escritório de Alexander", 10, 11, "mansao_nobre", 31, 13, ANDAR, "O escritório de Alexander Albuquerque, CEO do Frigorífico Albuquerque: a mesa enorme de mármore preto sobre o latão, virada para a cadeira, as duas estantes entalhadas à mão no século XVII, o cofre no canto, o bar de vidro e latão, o sofá de bouclé e o mapa do Brasil com as unidades. Na parede, a marinha de mestre sob a luminária de latão e os prêmios da empresa.");
  s.porta("O", 17, "salao");
  s.add("rug_aubusson", 3, 3, 4).add("mesa_ceo", 3, 4, 4).add("cadeira_ceo", 4, 6, 0);
  s.add("cadeira_jantar_luxo", 3, 3, 4).add("cadeira_jantar_luxo", 5, 3, 4);
  s.enc("O", "cofre", 0, segredo("cofre-escritorio", "O cofre", "Um cofre de aço do tamanho de um armário pequeno. A senha e o que há dentro ficam com o mestre."));
  s.enc("O", "estante_biblioteca", 1).enc("N", "estante_biblioteca", 2).enc("N", "bar_escritorio", 6);
  s.add("globo", 9, 1, 6).add("touro_bronze", 1, 9, 4).enc("L", "sofa_verissimo", 6).add("armchair_verissimo", 6, 9, 0);
  s.par("N", "pintura_mestre", 4.5, 1.9);
  s.par("N", "placa_frigorifico", 9.0, 2.0).par("O", "mapa_frigorifico", 6.0, 1.6).par("O", "trofeus_empresa", 8.8, 1.6);
  s.lustres([2, 6], [7, 4]).item(5, 8, "Abridor de Cartas de Prata", 0.5);
  // os objetinhos (23/10): o uísque no bar, os papéis, a luminária e as fotos na mesa, os livros de couro
  s.em("decanter_tacas", 6, 0, 4).em("livros_couro", 7, 0, 4).em("papers", 3, 4, 4).em("porta_retratos", 4, 4, 4).em("desk_lamp", 6, 4, 4).add("vaso_grande", 9, 10, 0);
}

// ---------------------------------------------------------------- 2º ANDAR (área íntima e lazer)
{
  const s = nova("hall_s", "Hall Superior", 36, 5, "mansao_marmore", 0, 8, ANDAR2, "O hall do andar de cima, onde chegam as duas escadarias do salão: a passadeira comprida, os consoles dourados e as telas de mestre, com a grande tela abstrata sob a luminária. Daqui se vai à suíte do casal, à sala de jogos e aos quartos.");
  s.porta("S", 5, "miguel").porta("S", 20, "catarina").porta("S", 27, "hospedes").porta("N", 12, "suite").porta("N", 26, "jogos");
  s.escada("escada_nobre_desce", 15, 0, 4, "salao").escada("escada_nobre_desce", 19, 0, 4, "salao");
  s.add("tapete_corredor", 3, 2, 2).add("tapete_corredor", 27, 2, 2);
  s.enc("N", "console_dourado", 7).enc("N", "console_dourado", 29).enc("N", "relogio_carrilhao", 23);
  s.mais("palmeira_vaso", 0, [0, 0], [35, 0], [0, 4], [35, 4]).mais("vaso_grande", 0, [14, 0], [22, 0]);
  s.lustres([9, 2], [18, 3], [30, 2]);
  // as telas "de milhões" (23/10): os retratos da família foram todos para a galeria do salão
  s.par("N", "tela_abstrata", 3.6, 1.75).par("N", "pintura_mestre~2", 9.6, 1.85).par("N", "pintura_mestre~4", 31.6, 1.85).par("O", "espelho_dourado", 2.5, 1.6);
  // os objetinhos (23/10): os arranjos, as fotos e o candelabro nos consoles
  s.em("arranjo_flores", 7, 0, 4).em("porta_retratos", 8, 0, 4).em("candelabro_prata", 29, 0, 4).em("arranjo_flores", 30, 0, 4);
}
{
  const s = nova("suite", "Suíte do Casal", 12, 8, "mansao_nobre", 6, 0, ANDAR2, "A suíte do casal Albuquerque, a maior do andar: a cama enorme de cabeceira entalhada, a lareira de mármore, o divã e as poltronas, a penteadeira e a porta do closet. Tudo em ordem e tudo calado.");
  s.porta("S", 12, "hall_s").porta("O", 3, "banho_casal").porta("L", 1, "closet_casal");
  s.add("rug_aubusson", 4, 3, 4).enc("N", "cama_master", 4).enc("N", "nightstand", 3).enc("N", "nightstand", 7);
  s.add("vaso_grande", 0, 0, 4).enc("N", "penteadeira", 9).add("pufe", 10, 1, 4).enc("O", "lareira_marmore", 4);
  s.add("chaise_longue", 8, 6, 0).add("poltrona_orelha", 2, 5, 6).add("poltrona_orelha", 2, 6, 6);
  s.lustres([5, 4], [9, 4]).par("N", "janela_cortinas", 2.5, 1.72, undefined, 0).par("O", "pintura_mestre~2", 5.0, 2.05);
  // os objetinhos (23/10): a luminária e as fotos nos criados-mudos, o champanhe perto do divã, a mesinha das poltronas
  s.em("desk_lamp", 3, 0, 4).em("porta_retratos", 7, 0, 4).add("balde_champanhe", 10, 6, 0).add("table_small", 2, 4, 0).em("servico_cha", 2, 4, 0);
}
{
  const s = nova("banho_casal", "Banheiro do Casal", 6, 7, "mansao_banho", 0, 0, ANDAR2, "O banheiro da suíte: a banheira de pés dourados, a pia dupla de mármore, o box e o espelho dourado. Tudo reluz.");
  s.porta("L", 3, "suite");
  s.enc("N", "box_chuveiro", 0).enc("N", "banheira_luxo", 2).enc("O", "pia_dupla", 2).enc("O", "toilet", 5);
  s.par("O", "espelho_dourado", 3.0).lustres([3, 4]);
  // os perfumes na pia (23/10)
  s.em("perfumes", 0, 2, 2);
}
{
  // 23/10, o Felipe: "faria mais sentido o casal Albuquerque ter um closet ao invés de um guarda-roupas né?! Metade masculino
  // metade feminino": o cômodo entre a suíte e a sala de jogos, com a porta direta da suíte
  const s = nova("closet_casal", "Closet do Casal", 4, 8, "mansao_claro", 18, 0, ANDAR2, "O closet do casal, ao lado da suíte: na parede comprida, metade dele, de nogueira, com os ternos, as camisas, as gravatas e os sapatos sociais, e metade dela, laqueada de marfim, com os vestidos longos, as bolsas e a parede de saltos. No meio, a ilha de vidro com os relógios dele e as joias dela; no fundo, o espelho de corpo inteiro e o pufe.");
  s.porta("O", 1, "suite");
  s.enc("O", "closet_masculino", 2).enc("O", "closet_feminino", 5).add("ilha_joias", 2, 3, 2);
  s.enc("N", "espelho_corpo", 2).add("vaso_grande", 3, 0, 4).add("pufe", 2, 6, 4);
  s.lustres([2, 5]);
}
{
  const s = nova("jogos", "Sala de Jogos", 14, 8, "mansao_jogos", 22, 0, ANDAR2, "A sala de jogos: a mesa de sinuca sob a luminária, os fliperamas piscando num canto, a mesa de 21, a TV grande com o sofá e, ao fundo, o bar de mármore preto com a adega iluminada e as banquetas de couro. Alguém jogou aqui até muito tarde.");
  s.porta("S", 26, "hall_s");
  s.add("pool_table", 6, 2, 4).enc("N", "bar_counter", 3).enc("N", "bar_shelf", 5).add("stool_bar", 3, 1, 0).add("stool_bar", 4, 1, 0);
  // 23/10: o segundo fliperama virou o Felipe's Fight (o de luta, só em dupla) e a mesa de pôquer, a de 21 em meia-lua:
  // os jogadores sentam na curva (as cinco cadeiras), o dealer fica em pé atrás do lado reto (a casa 11, 3)
  s.enc("N", "arcade", 10).enc("N", "arcade_luta", 11).enc("N", "jukebox", 13);
  s.add("mesa_21", 10, 4, 4).add("cadeira_jantar_luxo", 9, 5, 2).add("cadeira_jantar_luxo", 13, 5, 6);
  s.cadeiras("cadeira_jantar_luxo", 10, 4, 3, 2, { s: [0, 1, 2] });
  s.enc("O", "tv_gamer", 3).add("sofa_verissimo", 2, 3, 6);
  s.par("O", "dartboard", 1.5, 1.6).par("N", "neon_bar", 8.0, 2.1, undefined, 0);
  s.lustres([7, 6], [11, 2]);
  // os objetinhos (23/10): o uísque no balcão do bar e o champanhe ao lado do sofá
  s.em("decanter_tacas", 3, 0, 4).add("balde_champanhe", 2, 6, 0);
}
{
  const s = nova("miguel", "Quarto do Miguel", 11, 8, "mansao_claro", 0, 13, ANDAR2, "O quarto do Miguel: o de um rapaz sério, ruivo, de boxe e de eletrônica. A bancada de solda e os monitores num canto, o saco de pancada e os halteres no outro, o tatame e a cama de solteiro bem esticada. Na parede, as luvas e um mapa cheio de alfinetes.");
  s.porta("N", 5, "hall_s").porta("S", 5, "banho_miguel");
  s.enc("N", "cama_solteiro", 0).enc("N", "nightstand", 1).enc("N", "guarda_roupa", 2).enc("N", "rack_halteres", 8);
  s.enc("O", "bancada_eletronica", 4).add("chair_office", 1, 4, 2).add("tatame", 6, 3, 4).add("saco_pancada", 9, 6, 4);
  s.par("N", "luvas_parede", 7.0, 1.6).par("O", "board_investigation", 6.5, 1.6).par("N", "poster_esgrima", 4.5, 1.6).lustres([4, 4]);
  s.extra = { darkness: 0.34, ambient: "#c8d0e0" };
  // a luminária no criado-mudo (23/10)
  s.em("desk_lamp", 1, 0, 4);
}
{
  const s = nova("banho_miguel", "Banheiro do Miguel", 6, 4, "mansao_banho", 2, 21, ANDAR2, "O banheiro do Miguel: a pia, o vaso e o box, as toalhas escuras e um par de luvas secando.");
  s.porta("N", 5, "miguel");
  s.enc("N", "sink", 0).enc("N", "toilet", 1).enc("N", "box_chuveiro", 5).par("N", "espelho_dourado", 0.5);
}
{
  const s = nova("catarina", "Quarto da Catarina", 13, 8, "mansao_claro", 11, 13, ANDAR2, "O quarto da Catarina, de menina que cresceu competindo: tom neutro, a cama de casal enorme cheia de travesseiros com dois ursos de pelúcia, a TV gigante com o console de movimento, o canto das espadas de esgrima. Numa parede, destacada, o painel de troféus e medalhas de todas as competições que ela disputou, mesmo as de participação, e no canto a estante com as taças. Perto da cama, a parede de escalada leva à caverna dela, no mezanino.");
  s.porta("N", 20, "hall_s").porta("S", 13, "banho_catarina");
  s.add("estante_trofeus", 0, 0, 4).enc("N", "rack_esgrima", 1).enc("N", "nightstand", 3).enc("N", "cama_catarina", 4).enc("N", "nightstand", 7);
  s.escada("parede_escalada", 10, 0, 4, "mezanino");
  s.add("rug_ornate", 4, 3, 4).enc("S", "tv_gamer", 4).add("puff_gamer", 4, 5, 0).add("puff_gamer", 6, 5, 0);
  // os troféus de verdade (23/10, o Felipe: "esses troféus parecem pintura e não um troféu"): duas vitrines na parede
  s.enc("O", "vitrine_trofeus", 2).enc("O", "vitrine_trofeus", 5).par("N", "fita_led", 6.0, 2.3, undefined, 0);
  s.lustres([5, 4]).item(9, 5, "Medalha de Ouro de Esgrima", 0.5);
  // as fotos e a luminária nos criados-mudos (23/10)
  s.em("porta_retratos", 3, 0, 4).em("desk_lamp", 7, 0, 4);
}
{
  const s = nova("banho_catarina", "Banheiro da Catarina", 6, 4, "mansao_banho", 11, 21, ANDAR2, "O banheiro da Catarina: a pia dupla, o vaso, o box, as toalhas rosadas e uma mochila de treino largada no canto.");
  s.porta("N", 13, "catarina");
  s.enc("N", "toilet", 0).enc("N", "pia_dupla", 3).enc("N", "box_chuveiro", 5).par("N", "espelho_dourado", 4.0);
  // os perfumes na pia (23/10)
  s.em("perfumes", 3, 0, 4);
}
{
  const s = nova("mezanino", "Mezanino da Catarina", 6, 5, "mansao_caverna", 11, 13, ANDAR_MEZ, "O mezanino da Catarina, a caverna dela: escuro, cheio de LED roxo e ciano, a cadeira gamer diante dos dois monitores, o teclado que brilha, o computador potente, os pufes e as anotações coladas por todo lado. Lá em cima ela jogava e escrevia.");
  s.escada("parede_escalada", 0, 0, 4, "catarina");
  s.enc("L", "setup_gamer", 1).add("cadeira_gamer", 3, 1, 6).add("puff_gamer", 1, 3, 4).add("puff_gamer", 2, 4, 4).add("rug_worn", 1, 2, 4);
  s.par("O", "fita_led", 2.5, 1.0, undefined, 0).par("N", "notes_wall", 4.6, 1.6).par("O", "notes_wall", 3.9, 1.6);
  s.item(2, 1, "Caderno de Anotações da Catarina", 0.5);
}
{
  const s = nova("hospedes", "Quarto de Hóspedes", 12, 8, "mansao_claro", 24, 13, ANDAR2, "O quarto de hóspedes do andar de cima, como uma suíte de hotel: a cama estofada de cabeceira alta, o guarda-roupa e a cômoda de laca marfim, a escrivaninha de vidro e latão junto da janela e a poltrona de leitura.");
  s.porta("N", 27, "hall_s").porta("S", 30, "banho_hospedes");
  s.enc("N", "nightstand", 5).enc("N", "cama_casal", 6).enc("N", "nightstand", 8).enc("N", "comoda", 10).enc("O", "guarda_roupa", 1);
  s.add("rug_ornate", 5, 3, 4).add("desk_wood", 9, 5, 6).add("chair_wood", 8, 5, 2).add("poltrona_orelha", 1, 6, 4);
  s.lustres([6, 4]).par("N", "janela_cortinas", 1.5, 1.72, undefined, 0).par("O", "tela_abstrata~2", 5.0, 1.7);
  // os objetinhos (23/10): o arranjo e a luminária nos criados-mudos, os livros na cômoda, os papéis na escrivaninha
  s.em("arranjo_flores", 5, 0, 4).em("desk_lamp", 8, 0, 4).em("livros_couro", 10, 0, 4).em("papers", 9, 5, 6);
}
{
  const s = nova("banho_hospedes", "Banheiro dos Hóspedes", 6, 4, "mansao_banho", 27, 21, ANDAR2, "O banheiro dos hóspedes: o vaso, a pia, o box e as toalhas brancas dobradas.");
  s.porta("N", 30, "hospedes");
  s.enc("N", "toilet", 0).enc("N", "sink", 1).enc("N", "box_chuveiro", 5).par("N", "espelho_dourado", 1.5);
}

// ---------------------------------------------------------------- ANEXO (no jardim)
{
  const s = nova("anexo", "Anexo", 8, 6, "mansao_rustico", ANEXO.x, ANEXO.y, "Anexo", "O anexo de pedra do jardim, que serve de depósito e de sala de armas: caixotes, barris, uma pele de urso estendida no chão, o rack de armas na parede e a mesa de trabalho.");
  s.porta("S", ANEXO.x + 4, "jardim");
  s.enc("N", "weapon_rack", 1).enc("N", "weapon_rack", 4).enc("O", "shelf_metal", 2);
  s.add("crate_wood", 7, 0, 4).add("barrel", 7, 5, 0).add("barrel", 6, 5, 0).add("table_tools", 3, 3, 4).add("chest_army", 1, 4, 4);
  s.par("N", "blade_rack", 6.5, 1.7).par("O", "tool_board", 1.5, 1.7);
  s.extra = { darkness: 0.5 };
}

/** Os links dos itens que o `paraCena` não conhece (a chave "x" marca cena que não existe: corrigida abaixo). */
const CHAVES_FICTICIAS: Record<string, string> = {};

const CENAS: CenaSpec[] = [
  {
    key: "jardim",
    name: MANSAO + "Jardim",
    description:
      "O terreno murado da mansão, no meio da mata: o portão de ferro entre os pilares, o caminho de pedra clara até a entrada principal, a fonte no meio dos gramados, os ciprestes e as topiárias, as alas de pedra escura de telhado ferrugem em forma de U. À esquerda o anexo de pedra. Um silêncio de dinheiro velho.",
    layout: { heightmap: T_JARDIM.planta(), door: { x: CX, y: PORTAO_Y - 2, dir: 0 } },
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
      [23, 30, "salao"],
      [24, 30, "salao"],
      [ANEXO.x + 4, ANEXO.y + ANEXO.h, "anexo"],
    ],
    plan: { x: 0, y: 0 },
  },
  ...SALAS.map(paraCena),
];
void CHAVES_FICTICIAS;

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

/** Monta a mansão inteira e a campanha dela (o lugar "Mansão Albuquerque" do mapa-múndi). */
export function seedMansao(db: Database) {
  if (db.rooms.some((r) => r.name.startsWith(MANSAO))) return;
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
    title: "Mansão Albuquerque",
    subtitle: "Missão",
    objectives: [],
    layout: Object.fromEntries(CENAS.map((s) => [built.get(s.key)!.id, naPlanta(s)])),
    log: [],
  };
  db.mansaoRev = MANSAO_REV;
}

/** Refaz a mansão no lugar quando a montagem muda (MANSAO_REV): mesmas cenas, peças e registro; a que saiu é apagada. */
function rebuildMansao(db: Database): boolean {
  if ((db.mansaoRev ?? 0) >= MANSAO_REV) return false;
  const existing = db.rooms.filter((r) => r.name.startsWith(MANSAO));
  if (!existing.length) return false;
  const key = Math.min(...existing.map((r) => r.id));
  const built = new Map<string, RoomData>();
  for (const spec of CENAS) {
    let room = existing.find((r) => r.name === spec.name);
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
  const porta = built.get("jardim")!;
  for (const velha of existing.filter((r) => !ficam.has(r.id))) {
    for (const t of velha.tokens ?? []) (porta.tokens ??= []).push({ ...t, x: porta.door.x, y: porta.door.y });
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
    for (const id of Object.keys(camp.layout)) if (!ficam.has(Number(id))) delete camp.layout[Number(id)];
    for (const s of CENAS) camp.layout[built.get(s.key)!.id] = naPlanta(s);
  }
  db.mansaoRev = MANSAO_REV;
  return true;
}

/** Monta a mansão se ainda não existe; se existe, refaz quando a montagem mudou. */
export function montarMansao(db: Database): boolean {
  if (!db.rooms.some((r) => r.name.startsWith(MANSAO))) {
    seedMansao(db);
    return true;
  }
  return rebuildMansao(db);
}
