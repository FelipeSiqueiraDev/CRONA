import type { SceneInfo } from './protocol';

/**
 * Os lugares da campanha em níveis, para o minimapa: Terreno › Prédio › Andar › Cômodo.
 *
 * Nada disso é guardado: sai das cenas e das passagens. A cena ao ar livre é um terreno; o
 * prédio dela (o mobi grande, `marcos`) abre a cena da passagem encostada nele, e o prédio é
 * tudo o que se alcança de lá sem sair ao ar livre (o casarão com os dois andares, o celeiro
 * com o calabouço). Cada cena tem o andar dela (`floor`). Assim, quem montar um mapa novo
 * ganha o minimapa sem preencher nada.
 */

export interface LocalAndar {
  /** o `floor` das cenas */
  nome: string;
  /** como aparece na aba: "Térreo", "2º andar", "Subsolo" */
  rotulo: string;
  /** altura, para ordenar: 0 = térreo, 1 = 2º andar, -1 = subsolo */
  nivel: number;
  cenas: number[];
}

export interface LocalPredio {
  id: string;
  /** o nome do prédio ("Casarão"); vazio quando é a campanha inteira (a Sede) */
  nome: string;
  /** o desenho do mobi (casarao, celeiro, galpao), para o telhado */
  kind?: string;
  /** o terreno onde fica (a cena ao ar livre), ou null */
  terreno: number | null;
  /** onde fica no terreno (casas) */
  marco?: { x: number; y: number; w: number; h: number };
  /** a cena por onde se entra */
  entrada: number;
  cenas: number[];
  /** do mais alto para o mais baixo */
  andares: LocalAndar[];
}

export interface LocalTerreno {
  cena: number;
  nome: string;
  predios: string[];
  /** passagens para outro terreno (a porteira para os arredores) */
  saidas: { x: number; y: number; para: number }[];
}

export interface Locais {
  terrenos: LocalTerreno[];
  predios: LocalPredio[];
  /** onde fica cada cena */
  onde: Map<number, { terreno: number | null; predio?: string; andar?: string }>;
}

type CenaLocal = Pick<SceneInfo, 'id' | 'name' | 'floor' | 'aberto' | 'portals' | 'marcos'>;

const PADRAO = /t[ée]rreo|subsolo|andar|por[aã]o|s[oó]t[aã]o|calabou[çc]o|cobertura|mezanino|pavimento/i;

/** O nome curto da cena ("Fazenda · Cozinha" → "Cozinha"). */
export function nomeCurto(nome: string) {
  return nome.split('·').pop()!.trim();
}

/** Como o andar aparece na aba, a partir do `floor` e do nome do prédio. */
export function rotuloDoAndar(floor: string, predio: string, daEntrada: boolean): string {
  const f = floor.trim();
  if (f && predio && f.toLowerCase().startsWith(predio.toLowerCase())) {
    const resto = f.slice(predio.length).trim();
    if (!resto) return 'Térreo';
    return /^\d+\s*[ºo°]?$/.test(resto) ? `${resto.replace(/\s+/g, '')} andar` : resto;
  }
  if (PADRAO.test(f)) return f;
  if (daEntrada || !f) return 'Térreo';
  return f;
}

/** A altura do andar pelo rótulo (para ordenar as abas). */
export function nivelDoAndar(rotulo: string): number | null {
  if (/t[ée]rreo/i.test(rotulo)) return 0;
  if (/subsolo|por[aã]o|calabou[çc]o/i.test(rotulo)) return -1;
  if (/s[oó]t[aã]o|cobertura/i.test(rotulo)) return 50;
  const n = /(\d+)\s*[ºo°]?\s*andar/i.exec(rotulo);
  return n ? Number(n[1]) - 1 : null;
}

export function montarLocais(cenas: readonly CenaLocal[]): Locais {
  const porId = new Map(cenas.map((c) => [c.id, c]));
  const aberta = (id: number) => !!porId.get(id)?.aberto;
  // vizinhos de cada cena coberta pelas passagens, nos dois sentidos (a escada desce e a outra sobe)
  const viz = new Map<number, Set<number>>();
  const liga = (a: number, b: number) => {
    if (!viz.has(a)) viz.set(a, new Set());
    viz.get(a)!.add(b);
  };
  for (const c of cenas)
    for (const p of c.portals)
      if (porId.has(p.link) && !c.aberto && !aberta(p.link)) (liga(c.id, p.link), liga(p.link, c.id));
  const dono = new Map<number, string>();
  const predios: LocalPredio[] = [];
  /** o prédio a partir da cena de entrada: tudo o que se alcança sem sair ao ar livre */
  const novo = (entrada: number, nome: string, terreno: number | null, extra: Partial<LocalPredio> = {}) => {
    const id = `p${entrada}`;
    const ordem: number[] = [];
    const fila = [entrada];
    dono.set(entrada, id);
    while (fila.length) {
      const c = fila.shift()!;
      ordem.push(c);
      for (const v of [...(viz.get(c) ?? [])].sort((a, b) => a - b))
        if (!dono.has(v)) (dono.set(v, id), fila.push(v));
    }
    const doEntrada = porId.get(entrada)?.floor ?? '';
    const grupos = new Map<string, number[]>();
    for (const c of ordem) {
      const f = porId.get(c)?.floor ?? '';
      if (!grupos.has(f)) grupos.set(f, []);
      grupos.get(f)!.push(c);
    }
    const andares = [...grupos.entries()].map(([f, ids], i) => {
      const rotulo = rotuloDoAndar(f, nome, f === doEntrada);
      return { nome: f, rotulo, nivel: nivelDoAndar(rotulo) ?? -100 - i, cenas: ids, i };
    });
    andares.sort((a, b) => b.nivel - a.nivel || a.i - b.i);
    const p: LocalPredio = { id, nome, terreno, entrada, cenas: ordem, andares: andares.map(({ i: _i, ...a }) => a), ...extra };
    predios.push(p);
    return p;
  };
  const terrenos: LocalTerreno[] = [];
  for (const t of cenas) {
    if (!t.aberto) continue;
    const lt: LocalTerreno = { cena: t.id, nome: nomeCurto(t.name), predios: [], saidas: [] };
    for (const m of t.marcos ?? []) {
      if (m.entra === undefined || !porId.has(m.entra) || aberta(m.entra) || dono.has(m.entra)) continue;
      lt.predios.push(novo(m.entra, m.nome, t.id, { kind: m.kind, marco: { x: m.x, y: m.y, w: m.w, h: m.h } }).id);
    }
    // passagem direto para uma cena coberta, sem prédio desenhado: vira um prédio sem lugar no mapa
    for (const p of t.portals) {
      if (aberta(p.link)) {
        if (p.link !== t.id && !lt.saidas.some((s) => s.para === p.link)) lt.saidas.push({ x: p.x, y: p.y, para: p.link });
        continue;
      }
      if (porId.has(p.link) && !dono.has(p.link)) lt.predios.push(novo(p.link, nomeCurto(porId.get(p.link)!.name), t.id).id);
    }
    terrenos.push(lt);
  }
  // o que sobrou (a Sede inteira, sem terreno): um prédio por grupo ligado
  for (const c of cenas) if (!c.aberto && !dono.has(c.id)) novo(c.id, '', null);
  const onde: Locais['onde'] = new Map();
  for (const t of terrenos) onde.set(t.cena, { terreno: t.cena });
  for (const p of predios)
    for (const a of p.andares) for (const c of a.cenas) onde.set(c, { terreno: p.terreno, predio: p.id, andar: a.nome });
  return { terrenos, predios, onde };
}
