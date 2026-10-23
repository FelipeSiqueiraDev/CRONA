import { footprint, getFurni, getWallFurni, RoomMap, Z_PER_M, type Door, type FloorStyle, type Hint } from "@crona/shared";
import fs from "node:fs";
import path from "node:path";
import type { Database, RoomData } from "./db";
import { DATA_DIR } from "./pastas";
import { type FloorSeed, type WallSeed } from "./seed";
import { planBottom, planRight } from "./seedSede";
import { estilo, montar, naPlanta, Terreno, type CenaSpec } from "./seedFazenda";

/**
 * A Mansão Albuquerque (21/10): o lar da Catarina e do Miguel. O terreno murado de fora (jardim, anexo, barracão), o
 * térreo na planta do Felipe (`campanha/referencias/mansao-albuquerque/mansao-primeiro-andar.webp`), o 2º andar que eu
 * inventei (suíte do casal, quartos da Catarina e do Miguel, escritório do pai, biblioteca, sala de jogos, hóspedes, terraço)
 * e o mezanino da Catarina. A lista de cômodos, as ligações e o que há em cada um estão em `docs/MANSAO-ALBUQUERQUE.md`.
 *
 * 1 quadrado da planta = 1 casa (0,75 m). Cada cômodo é uma cena (o Felipe: "entrei na sala, mudou o cenário"), com porta
 * nos dois lados. As salas são descritas em coordenadas LOCAIS (0..w-1, 0..h-1) e as portas pela coordenada da PLANTA
 * (a mesma nos dois vizinhos, o que garante o alinhamento); o resto do trabalho (o vão da porta principal, o deslocamento
 * dos móveis e dos itens de parede) é feito em `paraCena`.
 *
 * Mudou a montagem? Suba MANSAO_REV: a mansão é refeita no lugar, mantendo as cenas, as peças e o registro.
 */
export const MANSAO = "Mansão Albuquerque · ";
export const MANSAO_REV = 1;

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

interface Porta {
  lado: Lado;
  /** a coordenada da PLANTA ao longo da parede (x para N e S, y para O e L) */
  ao: number;
  para: string;
  /** 0 aberta (padrão), 1 fechada */
  estado?: number;
  pista?: Hint;
}

class Sala {
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
    this.floor.push([id, x, y, rot, pista, estado]);
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
function paraCena(s: Sala): CenaSpec {
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
    name: MANSAO + s.nome,
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
/** o anexo e o barracão (cantos de cima à esquerda) */
const ANEXO = { x: 6, y: 36, w: 8, h: 6 };
const BARRACAO = { x: 33, y: 35, w: 9, h: 9 };

function terrenoJardim(): Terreno {
  const t = new Terreno(JW, JH);
  // o pátio de pedra entre as alas e o caminho do portão até o pórtico
  t.ret(18, 30, 30, 33, "p");
  t.ret(22, 30, 25, PORTAO_Y, "p");
  // a volta de pedra em volta dos gramados, como na fachada, e o círculo da fonte
  t.volta(14, 31, 34, 49, 6, "p", 2);
  t.disco(CX, 41, 4.4, 3.6, "p");
  // as trilhas de terra: a oeste até o anexo, a leste até o barracão, e uma volta pelo fundo
  t.linha([[16, 44], [12, 44], [10, ANEXO.y + ANEXO.h + 1.5]], "d", 2);
  t.linha([[32, 44], [37, 46], [BARRACAO.x + 4.5, BARRACAO.y + BARRACAO.h + 1.5]], "d", 2);
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
  f.push(["barracao_mansao", BARRACAO.x, BARRACAO.y, 4], ["entrada", BARRACAO.x + 4, BARRACAO.y + BARRACAO.h, 0]);
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

// ---------------------------------------------------------------- CENTRO
{
  const s = nova("portico", "Pórtico", 9, 8, "mansao_marmore", 20, 21, ANDAR, "O pórtico de entrada, a quatro colunas de mármore e um longo tapete vermelho do portão da casa ao saguão. Aqui os visitantes esperavam ser anunciados. Os lustres de cristal pendem do teto alto, e dos dois lados abrem os corredores das alas.");
  s.porta("S", 24, "jardim").porta("N", 24, "saguao").porta("O", 22, "corredor_o").porta("L", 22, "corredor_l");
  s.add("tapete_longo", 3, 0, 4);
  s.mais("coluna_marmore", 0, [1, 2], [1, 5], [7, 2], [7, 5]);
  s.lustres([4, 2], [4, 5]);
  s.enc("N", "console_dourado", 1).enc("N", "console_dourado", 6);
  s.enc("N", "relogio_carrilhao", 8);
  s.mais("palmeira_vaso", 0, [0, 0], [0, 7], [8, 7]).mais("vaso_grande", 0, [0, 3], [8, 3]);
  s.mais("estatua_jardim", 4, [2, 7], [6, 7]);
  s.par("N", "quadro_oleo_grande", 2.5, 1.9).par("N", "quadro_oleo_grande", 6.6, 1.9);
  s.par("O", "espelho_dourado", 4.0, 1.6);
}
{
  const s = nova("saguao", "Saguão", 10, 5, "mansao_marmore", 19, 15, ANDAR, "O saguão de honra: o mármore xadrez, o tapete vermelho redondo e as duas escadarias nobres que sobem lado a lado para a galeria do andar de cima. O relógio de caixa alta marca as horas para ninguém.");
  s.porta("S", 24, "portico").porta("N", 24, "salao").porta("O", 18, "cha").porta("L", 18, "musica");
  s.escada("escada_nobre", 0, 0, 4, "galeria").escada("escada_nobre", 7, 0, 4, "galeria");
  s.add("tapete_redondo", 3, 1, 0);
  s.lustres([5, 2], [2, 3], [7, 3]);
  s.enc("N", "relogio_carrilhao", 3).mais("palmeira_vaso", 0, [6, 0], [6, 4]);
  s.mais("vaso_grande", 0, [0, 4], [9, 4]);
    s.item(8, 3, "Cartão de Visita dos Albuquerque", 0.5);
}
{
  const s = nova("salao", "Grande Salão", 13, 8, "mansao_nobre", 18, 7, ANDAR, "O grande salão de jantar: duas mesas compridas sobre tapetes vinho, com dez cadeiras cada, e ao fundo, em arco, a lareira de mármore. Colunas, armaduras, lustres de cristal e os quadros a óleo. Cabe uma festa inteira aqui, e hoje cabe o silêncio.");
  s.porta("S", 24, "saguao").porta("N", 20, "suite_o").porta("N", 28, "suite_l").porta("O", 8, "sala_roxa").porta("O", 13, "cozinha").porta("L", 8, "cafe").porta("L", 12, "tapete_vinho");
  s.add("rug_aubusson", 2, 2, 2);
  s.add("rug_aubusson", 8, 2, 2);
  for (const x0 of [3, 9]) {
    s.add("mesa_jantar", x0, 2, 2);
    s.cadeiras("chair_red", x0, 2, 2, 4, { o: [0, 1, 2, 3], l: [0, 1, 2, 3] });
  }
  s.enc("N", "lareira_marmore", 5);
  s.lustres([3, 3], [9, 3], [6, 5]);
  s.mais("coluna_marmore", 0, [1, 1], [11, 1], [1, 6], [11, 6]);
  s.mais("armor_display", 4, [4, 0], [8, 0]);
  s.enc("S", "console_dourado", 3).enc("S", "console_dourado", 8).em("candelabra", 3, 7, 0).em("candelabra", 9, 7, 0);
  s.par("N", "retrato_nobre", 4.0, 1.8).par("N", "retrato_nobre", 8.5, 1.8);
  s.par("O", "quadro_oleo_grande", 3.8, 1.8);
}
{
  const s = nova("suite_o", "Suíte de Hóspedes Oeste", 5, 4, "mansao_claro", 18, 3, ANDAR, "A suíte de hóspedes do lado oeste, de tom claro: a cama de casal, a cômoda, a poltrona junto da janela. Uma porta leva ao banheiro dos hóspedes.");
  s.porta("S", 20, "salao").porta("L", 5, "banho_h");
  s.enc("N", "cama_casal", 2).enc("N", "nightstand", 1).enc("N", "nightstand", 4);
  s.enc("O", "comoda", 2);
  s.lustres([2, 2]).par("N", "janela_cortinas", 2.5, 1.72, undefined, 0);
}
{
  const s = nova("banho_h", "Banheiro dos Hóspedes", 3, 4, "mansao_banho", 23, 3, ANDAR, "O banheiro de mármore que as duas suítes dos hóspedes dividem: a banheira de louça com pés dourados, o vaso e o espelho.");
  s.porta("O", 5, "suite_o").porta("L", 5, "suite_l");
  s.add("banheira_luxo", 0, 0, 2);
  s.enc("O", "toilet", 3);
  s.par("N", "espelho_dourado", 1.5);
}
{
  const s = nova("suite_l", "Suíte de Hóspedes Leste", 5, 4, "mansao_claro", 26, 3, ANDAR, "A suíte de hóspedes do lado leste, de tom claro, de frente para a do lado oeste. Uma porta leva ao banheiro dos hóspedes.");
  s.porta("S", 28, "salao").porta("O", 5, "banho_h");
  s.enc("N", "nightstand", 0).enc("N", "cama_casal", 1).enc("N", "comoda", 3);
  s.add("poltrona_orelha", 4, 3, 0);
  s.lustres([2, 2]).par("N", "janela_cortinas", 3.5, 1.72, undefined, 0);
}

// ---------------------------------------------------------------- ALA OESTE
{
  const s = nova("sala_roxa", "Sala Roxa", 6, 4, "mansao_nobre", 12, 7, ANDAR, "A sala roxa, sala de estar e de estudos da ala oeste: o tapete roxo, o sofá de veludo, as poltronas diante da lareira e a estante cheia. Cheira a chá e a papel velho.");
  s.porta("L", 8, "salao").porta("O", 9, "estufa");
  s.add("rug_purple", 1, 0, 4);
  s.enc("N", "lareira_marmore", 2).add("sofa_velvet", 2, 3, 0).add("armchair_verissimo", 0, 1, 2).add("armchair_verissimo", 4, 2, 6);
  s.add("table_small", 2, 2, 4).enc("N", "bookshelf", 0);
  s.lustres([3, 2]);
}
{
  const s = nova("estufa", "Estufa", 7, 8, "mansao_estufa", 5, 7, ANDAR, "A estufa, o jardim de inverno da casa: canteiros em fileira, palmeiras, vasos, uma fonte pequena e um banco para ler com o sol de fim de tarde batendo nas vidraças.");
  s.porta("L", 9, "sala_roxa").porta("S", 7, "lavanderia");
  s.mais("canteiro_flores", 4, [1, 0], [3, 0]);
  s.mais("palmeira_vaso", 0, [0, 2], [6, 3], [0, 5], [6, 5]);
  s.add("chafariz", 2, 3, 4).add("banco_praca", 4, 7, 0).add("banco_praca", 0, 7, 0);
  s.mais("plant", 0, [2, 1], [5, 0], [4, 1]);
  s.mais("vaso_grande", 0, [0, 0], [6, 7]);
  s.item(3, 6, "Tesoura de Poda Dourada", 0.5);
}
{
  const s = nova("cozinha", "Cozinha", 7, 6, "mansao_servico", 11, 12, ANDAR, "A cozinha da mansão, ampla e reluzente: fogões, a pia dupla, a grande mesa de trabalho no meio, panelas penduradas. Dali saem as bandejas para o grande salão.");
  s.porta("L", 13, "salao").porta("O", 16, "lavanderia").porta("S", 13, "escad_serv");
  s.enc("N", "armario_cozinha", 0).enc("N", "fogao_lenha", 2).enc("N", "pia_cozinha", 4).enc("N", "geladeira", 6);
  s.add("mesa_cozinha", 2, 3, 4).enc("O", "armario_cozinha", 1).mais("barrel", 0, [0, 5]);
  s.em("cesta_pao", 3, 3, 4).em("jarra_canecas", 4, 3, 4);
  s.lustres([3, 3]).par("N", "utensilios_parede", 3.0, 1.9);
}
{
  const s = nova("lavanderia", "Lavanderia", 6, 3, "mansao_servico", 5, 15, ANDAR, "A lavanderia: dois tanques, as máquinas de lavar, as cestas de roupa e a tábua de passar.");
  s.porta("L", 16, "cozinha").porta("N", 7, "estufa").porta("S", 8, "despensa").porta("S", 5, "deposito");
  s.enc("N", "tanque", 0).enc("N", "tanque", 1).enc("N", "maquina_lavar", 3).enc("N", "maquina_lavar", 4);
  s.add("crate_wood", 4, 1, 4).add("trash_can", 5, 0, 4);
}
{
  const s = nova("despensa", "Despensa", 4, 3, "mansao_servico", 7, 18, ANDAR, "A despensa, de prateleiras até o teto: mantimentos, barris, sacas e a adega da casa.");
  s.porta("N", 8, "lavanderia").porta("L", 19, "escad_serv").porta("S", 9, "corredor_o");
  s.enc("O", "prateleira", 0).enc("N", "adega", 2).add("barrel", 0, 2, 4).add("sacas", 2, 1, 4);
}
{
  const s = nova("deposito", "Depósito", 3, 3, "mansao_rustico", 4, 18, ANDAR, "O depósito de ferramentas de jardinagem: pás, regadores, sacos de adubo e um carrinho de mão.");
  s.porta("N", 5, "lavanderia");
  s.enc("O", "prateleira", 1).add("crate_wood", 2, 0, 4).add("sacas", 2, 1, 4).add("barrel", 2, 2, 0);
  
}
{
  const s = nova("escad_serv", "Escadaria de Serviço", 4, 3, "mansao_servico", 11, 18, ANDAR, "A escadaria de serviço, estreita e de degraus gastos: sobe da cozinha para o corredor dos quartos do andar de cima, para os criados chegarem sem cruzar os donos da casa.");
  s.porta("N", 13, "cozinha").porta("O", 19, "despensa").porta("S", 12, "corredor_o");
  s.escada("stairs_up", 3, 0, 4, "corr_o2");
  s.enc("S", "bench", 2).par("N", "quadro_chaves", 1.2, 1.6);
}
{
  const s = nova("cha", "Sala de Chá", 4, 5, "mansao_claro", 15, 16, ANDAR, "A saleta de chá: a mesinha redonda no meio, duas poltronas, o aparador com o aparelho de porcelana. Janela para o jardim.");
  s.porta("L", 18, "saguao").porta("S", 17, "corredor_o");
  s.add("table_round", 1, 2, 0).add("chair_red", 0, 3, 2).add("chair_red", 3, 3, 6);
  s.lustres([2, 2]).par("N", "janela_cortinas", 2.0, 1.72, undefined, 0);
}
{
  const s = nova("corredor_o", "Corredor Oeste", 11, 3, "mansao_marmore", 9, 21, ANDAR, "O corredor da ala oeste, de mármore e passadeira azul, com consoles, vasos e quadros. Liga o pórtico à escadaria de serviço, à despensa, à sala de chá e à sala de estar.");
  s.porta("L", 22, "portico").porta("O", 22, "banho_e").porta("N", 12, "escad_serv").porta("N", 17, "cha").porta("N", 9, "despensa").porta("S", 12, "estar_o");
  s.add("tapete_corredor", 4, 0, 2);
  s.enc("N", "console_dourado", 5).enc("S", "console_dourado", 6).mais("vaso_grande", 0, [10, 0], [4, 1]);
  s.par("N", "quadro_oleo_grande", 6.6, 1.9).par("N", "retrato_nobre", 10.0, 1.9);
  s.lustres([2, 1], [8, 1]);
}
{
  const s = nova("banho_e", "Banheiro dos Empregados", 4, 3, "mansao_servico", 5, 21, ANDAR, "O banheiro dos empregados: simples e impecável, com box, vaso e uma pia.");
  s.porta("L", 22, "corredor_o");
  s.enc("N", "sink", 0).enc("N", "toilet", 1).enc("N", "box_chuveiro", 3).enc("O", "tanque", 1);
}
{
  const s = nova("estar_o", "Sala de Estar Oeste", 7, 7, "mansao_nobre", 9, 24, ANDAR, "A sala de estar da ala oeste: o grande tapete vinho com duas poltronas diante da lareira, a mesa redonda de jogo com quatro cadeiras ao fundo, as estantes. Uma sala de ficar.");
  s.porta("N", 12, "corredor_o").porta("O", 25, "q_emp1").porta("O", 29, "q_emp2");
  s.add("rug_ornate", 3, 2, 4);
  s.enc("N", "lareira_marmore", 4).add("armchair_red", 4, 3, 0).add("armchair_red", 6, 3, 0).add("table_small", 5, 3, 4);
  s.add("table_round", 1, 4, 0).cadeiras("chair_red", 1, 4, 2, 2, { n: [0, 1], s: [0, 1] });
  s.enc("N", "bookshelf", 0).enc("O", "bookshelf", 2).lustres([3, 3]);
}
for (const [k, n, py, h] of [["q_emp1", "Quarto das Empregadas", 24, 4], ["q_emp2", "Quarto do Mordomo", 28, 3]] as [string, string, number, number][]) {
  const s = nova(k, n, 4, h, "mansao_servico", 5, py, ANDAR, `${n}: um quartinho limpo e simples, a cama de solteiro, o criado-mudo e o guarda-roupa.`);
  s.porta("L", k === "q_emp1" ? 25 : 29, "estar_o");
  s.enc("N", "cama_solteiro", 0).enc("N", "nightstand", 1).enc("N", "guarda_roupa", 2);
  s.add("chair_wood", 2, 2, 6);
}

// ---------------------------------------------------------------- ALA LESTE
{
  const s = nova("cafe", "Sala do Café", 4, 4, "mansao_nobre", 31, 7, ANDAR, "A sala do café da manhã: a mesa redonda de quatro lugares, o aparador, a cabeça de cervo na parede. Troféu de caça de algum Albuquerque que ninguém lembra.");
  s.porta("O", 8, "salao").porta("L", 9, "duplo");
  s.add("table_round", 1, 1, 0).cadeiras("chair_red", 1, 1, 2, 2, { n: [0, 1], s: [0, 1] });
  s.enc("L", "sideboard", 0).par("N", "antlers", 2.0, 1.9).lustres([2, 2]);
}
{
  const s = nova("duplo", "Quarto de Hóspedes Duplo", 5, 4, "mansao_claro", 35, 7, ANDAR, "O quarto duplo de hóspedes: duas camas de solteiro lado a lado, uma com colcha branca e outra com azul, e o criado-mudo entre elas.");
  s.porta("O", 9, "cafe").porta("L", 9, "banho_l");
  s.enc("N", "cama_solteiro", 1).enc("N", "nightstand", 2).enc("N", "cama_solteiro", 3);
  s.add("rug_worn", 1, 2, 2).lustres([2, 3]).par("N", "janela_cortinas", 2.5, 1.72, undefined, 0);
}
{
  const s = nova("banho_l", "Banheiro Leste", 3, 4, "mansao_banho", 40, 7, ANDAR, "O banheiro dos quartos de hóspedes leste, com a banheira de louça no canto.");
  s.porta("O", 9, "duplo");
  s.add("banheira_luxo", 0, 0, 2).enc("O", "toilet", 3);
}
{
  const s = nova("tapete_vinho", "Sala do Tapete Vinho", 5, 4, "mansao_nobre", 31, 11, ANDAR, "A sala de estar do grande tapete vinho: dois sofás, a mesinha de centro com um tabuleiro de xadrez, a lareira. Ouve-se a biblioteca ao lado, de tão calada.");
  s.porta("O", 12, "salao").porta("L", 12, "biblioteca");
  s.add("rug_aubusson", 0, 0, 4).enc("N", "lareira_marmore", 1).add("sofa_velvet", 0, 3, 0).add("sofa_velvet", 3, 3, 0);
  s.add("table_chess", 2, 2, 4).lustres([2, 2]).par("O", "retrato_nobre", 3.0, 1.7);
}
{
  const s = nova("biblioteca", "Biblioteca", 7, 10, "mansao_nobre", 36, 11, ANDAR, "A grande biblioteca da casa, de dinheiro antigo: estantes do chão ao teto dos dois lados, a mesa de leitura comprida no meio sob dois abajures verdes, a escada de rodízio, poltronas para quem fica a noite inteira.");
  s.porta("O", 12, "tapete_vinho").porta("S", 39, "lounge");
  s.add("rug_aubusson", 1, 3, 4);
  s.enc("N", "estante_biblioteca", 0).enc("N", "estante_biblioteca", 3);
  s.enc("O", "estante_biblioteca", 2).enc("O", "estante_biblioteca", 5);
  s.add("mesa_leitura", 2, 4, 4).cadeiras("chair_wood", 2, 4, 4, 2, { n: [0, 1, 2, 3], s: [0, 1, 2, 3] });
  s.add("escada_biblioteca", 6, 0, 4).add("globo", 5, 8, 0).add("armchair_verissimo", 0, 8, 4).add("armchair_verissimo", 6, 8, 4);
  s.lustres([3, 2], [3, 7]);
}
{
  const s = nova("musica", "Sala de Música", 6, 6, "mansao_claro", 29, 15, ANDAR, "A sala de música de portas altas: o piano de cauda preto com o banco, a harpa que ninguém toca, o sofá para quem escuta. A janela dá para a alameda.");
  s.porta("O", 18, "saguao").porta("S", 32, "corredor_l");
  s.add("rug_ornate", 1, 2, 4).add("piano_cauda", 1, 1, 4).add("banco_piano", 2, 3, 0);
  s.enc("L", "sofa_velvet", 3).add("armchair", 4, 1, 6);
  s.lustres([3, 3]).par("N", "janela_cortinas", 4.5, 1.72, undefined, 0);
}
{
  const s = nova("corredor_l", "Corredor Leste", 7, 3, "mansao_marmore", 29, 21, ANDAR, "O corredor da ala leste: passadeira, consoles e quadros, entre o pórtico, a sala de música, o lounge e a escada em caracol.");
  s.porta("O", 22, "portico").porta("L", 22, "lounge").porta("N", 32, "musica").porta("S", 34, "escada_l");
  s.add("tapete_corredor", 0, 0, 2).enc("N", "console_dourado", 4).enc("S", "console_dourado", 1).mais("vaso_grande", 0, [6, 2], [6, 0]);
  s.par("N", "quadro_oleo_grande", 5.4, 1.9).par("N", "retrato_nobre", 1.2, 1.7);
  s.lustres([2, 1], [5, 1]);
}
{
  const s = nova("lounge", "Sala de Estar das Poltronas", 7, 3, "mansao_nobre", 36, 21, ANDAR, "A sala de estar das poltronas vermelhas, entre a biblioteca e o gabinete: um banco comprido, aparadores, o tapete gasto de tanto passo.");
  s.porta("O", 22, "corredor_l").porta("N", 39, "biblioteca").porta("S", 39, "gabinete");
  s.add("armchair_red", 1, 1, 4).add("armchair_red", 5, 1, 4).add("table_small", 3, 1, 4);
  s.enc("L", "bench", 0).enc("S", "sideboard", 0).lustres([3, 1]).par("N", "retrato_nobre", 1.5, 1.9).par("N", "retrato_nobre", 5.5, 1.9);
}
{
  const s = nova("escada_l", "Escada Leste", 4, 3, "mansao_nobre", 32, 24, ANDAR, "A escada em caracol da ala leste: degraus de madeira escura que sobem em espiral até o corredor do andar de cima.");
  s.porta("N", 34, "corredor_l").porta("S", 33, "quarto_l").porta("L", 25, "gabinete");
  s.escada("escada_espiral", 0, 0, 0, "corr_l2");
  s.par("O", "retrato_nobre", 2.1, 1.9);
}
{
  const s = nova("quarto_l", "Quarto Leste", 4, 4, "mansao_claro", 32, 27, ANDAR, "O quarto do fim da ala leste: a cama de casal, a cômoda e o guarda-roupa, tudo arrumado como se esperasse alguém.");
  s.porta("N", 33, "escada_l");
  s.enc("N", "cama_casal", 2).enc("O", "guarda_roupa", 1).add("nightstand", 3, 3, 4).lustres([1, 2]);
}
{
  const s = nova("gabinete", "Gabinete", 7, 7, "mansao_nobre", 36, 24, ANDAR, "O gabinete, o escritório clássico da planta: o grande tapete vermelho, a mesa de despachos, o globo antigo, a lareira ao fundo e o retrato do fundador do frigorífico acima dela. É o escritório do avô, não o do pai (esse fica no andar de cima).");
  s.porta("N", 39, "lounge").porta("O", 25, "escada_l");
  s.add("rug_aubusson", 1, 1, 4).add("desk_verissimo", 2, 2, 4).add("chair_verissimo", 3, 4, 0);
  s.add("globo", 5, 1, 4).enc("O", "bookshelf", 3).enc("O", "bookshelf", 5);
  s.add("armchair_verissimo", 1, 4, 2).add("sofa_verissimo", 4, 6, 0).lustres([3, 3]);
  s.par("N", "retrato_nobre", 1.5, 1.9, segredo("retrato-fundador", "O retrato do fundador", "Um homem de terno claro e olhos cansados, numa moldura dourada, com a plaquinha embaixo. O que ela diz fica com o mestre."));
  s.par("N", "placa_frigorifico", 5.4, 1.9);
  s.item(2, 3, "Abridor de Cartas de Prata", 0.5);
}

// ---------------------------------------------------------------- 2º ANDAR
{
  const s = nova("galeria", "Galeria", 10, 5, "mansao_marmore", 19, 15, ANDAR2, "A galeria do andar de cima, de onde as duas escadas nobres descem ao saguão: o balcão de balaústres, o banco, os retratos de família. Daqui se vai ao terraço, ao hall dos quartos e aos dois corredores.");
  s.porta("N", 24, "hall_s").porta("S", 24, "terraco").porta("O", 17, "corr_o2").porta("L", 17, "corr_l2");
  s.escada("escada_nobre_desce", 0, 0, 4, "saguao").escada("escada_nobre_desce", 7, 0, 4, "saguao");
  s.add("tapete_redondo", 3, 1, 0).lustres([5, 2]).mais("palmeira_vaso", 0, [3, 0], [6, 0]).add("banco_praca", 6, 4, 0);
  s.par("O", "retrato_nobre", 0.9, 1.8);
}
{
  const s = nova("terraco", "Terraço", 9, 8, "mansao_marmore", 20, 20, ANDAR2, "O terraço sobre o pórtico, de onde se vê o caminho de pedra, a fonte e os gramados até o portão. Mesinhas de ferro, vasos e o parapeito de pedra.");
  s.porta("N", 24, "galeria");
  s.mais("vaso_grande", 0, [0, 0], [8, 0], [0, 7], [8, 7]).mais("table_small", 0, [2, 3], [6, 3]);
  s.mais("chair_wood", 4, [1, 3], [3, 3]).mais("chair_wood", 4, [5, 3], [7, 3]);
  s.mais("chair_wood", 0, [2, 4], [6, 4]).mais("banco_praca", 0, [3, 7], [5, 7]).mais("palmeira_vaso", 0, [4, 1]);
  s.extra = { darkness: 0.18, ambient: "#cfd8e8", particles: [] };
}
{
  const s = nova("hall_s", "Galeria de Quadros", 13, 5, "mansao_nobre", 18, 10, ANDAR2, "O hall superior, a galeria de quadros da família: retratos a óleo de gente de épocas diferentes, paisagens, uma passadeira comprida. Há quem passe aqui sem nunca olhar para cima.");
  s.porta("S", 24, "galeria").porta("N", 26, "suite").porta("N", 20, "banho_s");
  s.add("tapete_corredor", 1, 0, 2).add("tapete_corredor", 7, 0, 2);
  s.enc("S", "console_dourado", 1).enc("S", "console_dourado", 10).enc("S", "relogio_carrilhao", 4);
  s.par("N", "retrato_nobre~3", 0.8, 1.8).par("N", "retrato_nobre", 4.0, 1.8, segredo("galeria-retrato-1", "Retrato a óleo", "Um homem de terno escuro, num retrato antigo com a plaquinha dourada. O que ela diz fica com o mestre.")).par("N", "retrato_nobre~4", 5.7, 1.8, segredo("galeria-retrato-2", "Retrato a óleo", "Outro retrato de família, de outra época, com a plaquinha dourada. O que ela diz fica com o mestre.")).par("N", "retrato_nobre~2", 10.6, 1.8).par("N", "retrato_nobre~3", 12.0, 1.8);
  s.par("O", "retrato_nobre~2", 1.6, 1.8).par("O", "retrato_nobre~3", 3.4, 1.8);
  s.lustres([3, 2], [9, 2]).mais("vaso_grande", 0, [0, 4], [12, 4]);
}
{
  const s = nova("suite", "Suíte do Casal", 8, 8, "mansao_nobre", 23, 2, ANDAR2, "A suíte do casal Albuquerque, a maior do andar: a cama enorme de cabeceira entalhada, a lareira com o espelho dourado, o divã e as duas poltronas junto da janela, a penteadeira. Tudo em ordem e tudo calado.");
  s.porta("S", 26, "hall_s").porta("O", 4, "closet").porta("O", 8, "banho_s");
  s.add("rug_aubusson", 2, 2, 4).enc("N", "cama_master", 2).enc("N", "nightstand", 1).enc("N", "nightstand", 5).enc("O", "lareira_marmore", 3);
  s.add("chaise_longue", 2, 6, 0).add("poltrona_orelha", 3, 5, 6).add("poltrona_orelha", 3, 3, 6).enc("S", "penteadeira", 5);
  s.lustres([3, 3], [4, 6]).par("N", "janela_cortinas", 6.4, 1.72, undefined, 0);
}
{
  const s = nova("closet", "Closet", 5, 4, "mansao_claro", 18, 2, ANDAR2, "O closet da suíte: armários abertos de ternos e vestidos, sapatos em fila, o espelho de corpo inteiro e a penteadeira.");
  s.porta("L", 4, "suite");
  s.enc("N", "closet_aberto", 0).enc("N", "closet_aberto", 2).enc("O", "closet_aberto", 1).enc("S", "penteadeira", 0).add("espelho_corpo", 3, 2, 6).add("pufe", 2, 2, 4);
  s.lustres([2, 2]);
}
{
  const s = nova("banho_s", "Banheiro da Suíte", 5, 4, "mansao_banho", 18, 6, ANDAR2, "O banheiro da suíte: a banheira de pés dourados no centro, a pia dupla de mármore, o box e o espelho dourado. Tudo reluz.");
  s.porta("L", 8, "suite").porta("S", 20, "hall_s");
  s.enc("N", "banheira_luxo", 2).enc("O", "pia_dupla", 1).add("box_chuveiro", 0, 0, 4).enc("N", "toilet", 1);
  s.par("N", "espelho_dourado", 4.0).lustres([2, 2]);
}
{
  const s = nova("corr_o2", "Corredor Oeste (2º andar)", 14, 3, "mansao_nobre", 5, 15, ANDAR2, "O corredor do andar de cima da ala oeste: passadeira comprida, quadros, e a escada de serviço descendo para a cozinha. Leva à sala de jogos, ao quarto de hóspedes e à biblioteca.");
  s.porta("L", 17, "galeria").porta("N", 10, "jogos").porta("N", 16, "hosp1").porta("S", 12, "biblio2");
  s.escada("escada_desce", 9, 0, 4, "escad_serv");
  s.add("tapete_corredor", 1, 0, 2).enc("S", "console_dourado", 1).enc("S", "console_dourado", 9).lustres([3, 1], [8, 1], [12, 1]);
  s.par("N", "quadro_oleo_grande", 2.6, 1.9).par("N", "quadro_oleo_grande", 7.4, 1.9).par("N", "retrato_nobre", 13.0, 1.9);
}
{
  const s = nova("jogos", "Sala de Jogos", 9, 8, "mansao_jogos", 5, 7, ANDAR2, "A sala de jogos de dinheiro novo e gosto antigo: a mesa de sinuca sob a luminária, o fliperama piscando num canto, a mesa de pôquer, a TV grande com o sofá e, ao fundo, o bar com as banquetas. Alguém jogou aqui até muito tarde.");
  s.porta("S", 10, "corr_o2");
  s.add("pool_table", 5, 3, 4).enc("N", "arcade", 7).enc("N", "arcade", 8).enc("N", "jukebox", 0);
  s.add("mesa_carteado", 1, 2, 4).cadeiras("chair_red", 1, 2, 2, 2, { o: [0, 1], l: [0, 1] });
  s.enc("N", "bar_counter", 3).enc("N", "bar_shelf", 5).add("stool_bar", 3, 1, 0).add("stool_bar", 4, 1, 0);
  s.enc("O", "tv_gamer", 5).add("sofa_verissimo", 3, 5, 6);
  s.par("O", "dartboard", 3.0, 1.6).par("N", "neon_bar", 4.8, 2.1, undefined, 0);
  s.lustres([3, 3], [6, 5]);
}
{
  const s = nova("hosp1", "Quarto de Hóspedes 1", 5, 8, "mansao_claro", 14, 7, ANDAR2, "O primeiro quarto de hóspedes do andar de cima: cama de casal, escrivaninha, poltrona de leitura, cortinas pesadas.");
  s.porta("S", 16, "corr_o2");
  s.enc("N", "cama_casal", 1).enc("N", "nightstand", 3).enc("O", "guarda_roupa", 4).add("rug_ornate", 1, 2, 4);
  s.add("desk_wood", 3, 5, 6).add("chair_wood", 3, 4, 2).add("poltrona_orelha", 0, 6, 4).lustres([2, 3]).par("N", "janela_cortinas", 2.5, 1.72, undefined, 0);
}
{
  const s = nova("biblio2", "Biblioteca de Cima", 14, 10, "mansao_nobre", 5, 18, ANDAR2, "A segunda biblioteca da casa, a dos livros que os visitantes não veem: estantes de parede a parede, a lareira, as mesas de leitura, a escada de rodízio e poltronas fundas. Cheira a couro e a lenha.");
  s.porta("N", 12, "corr_o2");
  s.add("rug_aubusson", 4, 3, 4).add("rug_aubusson", 8, 3, 4);
  s.enc("O", "estante_biblioteca", 3).enc("O", "estante_biblioteca", 6);
  s.enc("N", "lareira_marmore", 4).enc("N", "estante_biblioteca", 1).enc("N", "estante_biblioteca", 8).enc("N", "estante_biblioteca", 11).add("escada_biblioteca", 8, 8, 0);
  s.add("mesa_leitura", 4, 4, 4).cadeiras("chair_wood", 4, 4, 4, 2, { n: [0, 1, 2, 3], s: [0, 1, 2, 3] });
  s.add("armchair_verissimo", 3, 2, 0).add("armchair_verissimo", 8, 2, 0).add("globo", 10, 6, 4).lustres([4, 3], [8, 3], [6, 7]);
}
{
  const s = nova("corr_l2", "Corredor Leste (2º andar)", 14, 3, "mansao_nobre", 29, 15, ANDAR2, "O corredor do andar de cima da ala leste: passadeira, quadros e, no fim, o caracol que desce para o térreo. Dele se chega aos quartos dos irmãos, ao escritório do pai e ao quarto de hóspedes.");
  s.porta("O", 17, "galeria").porta("N", 32, "miguel").porta("N", 39, "catarina").porta("S", 32, "hosp2").porta("S", 39, "escritorio");
  s.escada("escada_espiral", 12, 1, 0, "escada_l");
  s.add("tapete_corredor", 1, 0, 2).enc("N", "console_dourado", 5).enc("S", "console_dourado", 5).lustres([3, 1], [8, 1]);
  s.par("N", "retrato_nobre", 6.0, 1.9).par("N", "retrato_nobre~2", 7.8, 1.9);
}
{
  const s = nova("miguel", "Quarto do Miguel", 6, 8, "mansao_claro", 29, 7, ANDAR2, "O quarto do Miguel: o de um rapaz sério, ruivo, de boxe e de eletrônica. A bancada de solda e os monitores num canto, o saco de pancada e os halteres no outro, o tatame e a cama de solteiro bem esticada. Na parede, as luvas e um mapa cheio de alfinetes.");
  s.porta("S", 32, "corr_l2");
  s.enc("N", "cama_solteiro", 0).enc("N", "nightstand", 1).enc("O", "bancada_eletronica", 3).add("chair_office", 1, 3, 2);
  s.add("tatame", 2, 4, 4).add("saco_pancada", 5, 6, 4).enc("L", "rack_halteres", 1).enc("N", "guarda_roupa", 2);
  s.par("N", "luvas_parede", 4.2, 1.6).par("O", "board_investigation", 5.5, 1.6).par("N", "poster_esgrima", 2.5, 1.6).lustres([3, 4]);
  s.extra = { darkness: 0.34, ambient: "#c8d0e0" };
}
{
  const s = nova("catarina", "Quarto da Catarina", 8, 8, "mansao_claro", 35, 7, ANDAR2, "O quarto da Catarina, de menina que cresceu competindo: tom neutro, a cama de casal enorme cheia de travesseiros com dois ursos de pelúcia, a TV gigante com o console de movimento, o canto das espadas de esgrima. Numa parede só, destacada, o painel de troféus e medalhas de todas as competições que ela disputou, mesmo as de participação. Perto da cama, a parede de escalada leva à caverna dela, no mezanino.");
  s.porta("S", 39, "corr_l2");
  s.add("rug_ornate", 2, 3, 4).enc("N", "cama_catarina", 3).enc("N", "rack_esgrima", 6);
  s.escada("parede_escalada", 0, 0, 4, "mezanino");
  s.enc("L", "tv_gamer", 3).add("puff_gamer", 3, 5, 0).add("puff_gamer", 4, 6, 0);
  s.par("O", "painel_trofeus", 4.5, 1.5).par("N", "fita_led", 4.5, 2.3, undefined, 0);
  s.lustres([4, 3]).item(5, 6, "Medalha de Ouro de Esgrima", 0.5);
}
{
  const s = nova("mezanino", "Mezanino da Catarina", 6, 5, "mansao_caverna", 35, 7, ANDAR_MEZ, "O mezanino da Catarina, a caverna dela: escuro, cheio de LED roxo e ciano, a cadeira gamer diante dos dois monitores, o teclado que brilha, o computador potente, os pufes e as anotações coladas por todo lado. Lá em cima ela jogava e escrevia.");
  s.escada("parede_escalada", 0, 0, 4, "catarina");
  s.enc("L", "setup_gamer", 1).add("cadeira_gamer", 3, 1, 6).add("puff_gamer", 1, 3, 4).add("puff_gamer", 2, 4, 4).add("rug_worn", 1, 2, 4);
  s.par("O", "fita_led", 2.5, 1.0, undefined, 0).par("N", "notes_wall", 4.6, 1.6).par("O", "notes_wall", 3.9, 1.6);
  s.item(2, 1, "Caderno de Anotações da Catarina", 0.5);
}
{
  const s = nova("escritorio", "Escritório do Pai", 8, 8, "mansao_nobre", 35, 18, ANDAR2, "O escritório do pai da Catarina, CEO do Frigorífico Albuquerque: a mesa enorme virada para a cadeira, a estante, o cofre no canto, o bar de nogueira, o mapa do Brasil com as unidades. Na parede, os prêmios da empresa e a foto aérea de uma das fábricas.");
  s.porta("N", 39, "corr_l2");
  s.add("rug_aubusson", 2, 2, 4).add("mesa_ceo", 2, 3, 4).add("cadeira_ceo", 3, 5, 0);
  s.add("chair_red", 2, 2, 4).add("chair_red", 4, 2, 4);
  s.enc("O", "cofre", 0, segredo("cofre-escritorio", "O cofre", "Um cofre de aço do tamanho de um armário pequeno. A senha e o que há dentro ficam com o mestre."));
  s.enc("N", "bar_escritorio", 6).enc("O", "estante_biblioteca", 2);
  s.add("touro_bronze", 2, 7, 4).add("globo", 7, 6, 6).enc("L", "sofa_verissimo", 3).add("armchair_verissimo", 5, 7, 0);
  s.par("O", "mapa_frigorifico", 6.6, 1.6).par("N", "trofeus_empresa", 2.0, 1.6).par("N", "placa_frigorifico", 6.6, 2.05);
  s.lustres([3, 3], [3, 6]);
}
{
  const s = nova("hosp2", "Quarto de Hóspedes 2", 6, 8, "mansao_claro", 29, 18, ANDAR2, "O segundo quarto de hóspedes do andar de cima: cama de casal, escrivaninha junto da janela, uma poltrona e o guarda-roupa.");
  s.porta("N", 32, "corr_l2");
  s.enc("N", "cama_casal", 4).enc("N", "nightstand", 2).enc("O", "guarda_roupa", 3).add("desk_wood", 0, 5, 0).add("chair_wood", 1, 6, 2).add("poltrona_orelha", 4, 6, 6).add("rug_ornate", 1, 1, 4).lustres([2, 4]);
}

// ---------------------------------------------------------------- ANEXO e BARRACÃO
{
  const s = nova("anexo", "Anexo", 8, 6, "mansao_rustico", ANEXO.x, ANEXO.y, "Anexo", "O anexo de pedra do jardim, que serve de depósito e de sala de armas: caixotes, barris, uma pele de urso estendida no chão, o rack de armas na parede e a mesa de trabalho.");
  s.porta("S", ANEXO.x + 4, "jardim");
  s.enc("N", "weapon_rack", 1).enc("N", "weapon_rack", 4).enc("O", "shelf_metal", 2);
  s.add("crate_wood", 7, 0, 4).add("barrel", 7, 5, 0).add("barrel", 6, 5, 0).add("table_tools", 3, 3, 4).add("chest_army", 1, 4, 4);
  s.par("N", "blade_rack", 6.5, 1.7).par("O", "tool_board", 1.5, 1.7);
  s.extra = { darkness: 0.5 };
}
{
  const s = nova("barracao", "Barracão", 9, 9, "mansao_tabuas", BARRACAO.x, BARRACAO.y, "Barracão", "O barracão dos empregados, de tábuas velhas: dois quartos de cada lado do corredor central, cada um com uma cama de solteiro e um baú. Um lugar simples e limpo.");
  s.porta("S", BARRACAO.x + 4, "jardim");
  for (const y of [0, 3, 6]) s.add("cama_solteiro", 0, y, 2).add("nightstand", 3, y, 4);
  s.add("cama_solteiro", 5, 0, 4).add("nightstand", 6, 0, 4).add("cama_solteiro", 7, 0, 4).add("nightstand", 8, 0, 4);
  s.add("crate_wood", 5, 8, 0).add("bench", 2, 8, 0).add("table_small", 4, 4, 4);
  s.extra = { darkness: 0.5 };
}

/** Os links dos itens que o `paraCena` não conhece (a chave "x" marca cena que não existe: corrigida abaixo). */
const CHAVES_FICTICIAS: Record<string, string> = {};

const CENAS: CenaSpec[] = [
  {
    key: "jardim",
    name: MANSAO + "Jardim",
    description:
      "O terreno murado da mansão, no meio da mata: o portão de ferro entre os pilares, o caminho de pedra clara até o pórtico, a fonte no meio dos gramados, os ciprestes e as topiárias, as alas de pedra escura de telhado ferrugem em forma de U. À esquerda o anexo de pedra, à direita o barracão dos empregados. Um silêncio de dinheiro velho.",
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
      [23, 30, "portico"],
      [24, 30, "portico"],
      [ANEXO.x + 4, ANEXO.y + ANEXO.h, "anexo"],
      [BARRACAO.x + 4, BARRACAO.y + BARRACAO.h, "barracao"],
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
