import type { FloorStyle } from '@crona/shared';

/**
 * Texturas de chão e parede desenhadas (arte em /arte/texturas/), por estilo de piso
 * do cômodo. O chão vem visto de cima e a parede de frente, retos e sem emenda: o
 * tabuleiro deita e entorta cada uma para o isométrico. A lista é o
 * /arte/texturas/texturas.json:
 *   { "<estilo>": { "piso": { "arquivo", "casas" }, "parede": { "arquivo" } } }
 * casas: quantas casas uma volta do piso cobre; a parede vai do chão ao topo, e a
 * largura de uma volta sai da proporção da imagem.
 * origem: o pixel da textura onde cruzam dois rejuntes (ou duas emendas), que vai para a
 * quina de uma casa. Com `casas` inteiro e o número de ladrilhos da volta, cada ladrilho
 * fica com um tamanho que cabe certinho nas casas e o rejunte segue a grade e as paredes,
 * como num tabuleiro de verdade (12/10: antes a volta era 3,53 casas, e o rejunte cortava
 * as casas e passava torto pelos móveis).
 */

interface Estilo {
  piso?: { arquivo: string; casas: number; origem?: [number, number] };
  parede?: { arquivo: string };
  /**
   * pixel art 1:1 (scripts/3d/estilo/texturas_px.py): a pasta em /arte/texturas/px/ com o chão e a parede já no
   * ângulo do tabuleiro, uma imagem por casa e por trecho de parede, coladas sem esticar. Vale no lugar das de cima.
   */
  px?: string;
}

/** As âncoras e as variações do chão e da parede em pixel art (o px.json da pasta). */
interface MetaPx {
  n: number;
  piso: { ax: number; ay: number };
  parede: Record<'l' | 'r', { ax: number; ay: number }>;
}

export interface TexturaPx {
  n: number;
  piso: { ax: number; ay: number; imgs: HTMLImageElement[][] };
  parede: Record<'l' | 'r', { ax: number; ay: number; imgs: HTMLImageElement[] }>;
}

let lista: Record<string, Estilo> | null = null;
const imagens = new Map<string, HTMLImageElement | 'carregando' | 'erro'>();
let versao = 0;

void fetch('/arte/texturas/texturas.json')
  .then((r) => (r.ok ? (r.json() as Promise<Record<string, Estilo>>) : {}))
  .then((j) => {
    lista = j;
    versao++;
  })
  .catch(() => (lista = {}));

function carregar(arquivo: string): HTMLImageElement | null {
  const url = `/arte/texturas/${arquivo}`;
  const c = imagens.get(url);
  if (c instanceof HTMLImageElement) return c;
  if (!c) {
    imagens.set(url, 'carregando');
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imagens.set(url, img);
      versao++;
    };
    img.onerror = () => imagens.set(url, 'erro');
    img.src = url;
  }
  return null;
}

const metas = new Map<string, MetaPx | 'carregando' | 'erro'>();

function metaPx(pasta: string): MetaPx | null {
  const m = metas.get(pasta);
  if (m && m !== 'carregando' && m !== 'erro') return m;
  if (!m) {
    metas.set(pasta, 'carregando');
    void fetch(`/arte/texturas/px/${pasta}/px.json`)
      .then((r) => (r.ok ? (r.json() as Promise<MetaPx>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        metas.set(pasta, j);
        versao++;
      })
      .catch(() => metas.set(pasta, 'erro'));
  }
  return null;
}

/** O chão e a parede em pixel art do estilo (só quando todas as imagens já chegaram). */
export function texturaPx(estilo: FloorStyle | undefined): TexturaPx | null {
  const pasta = estilo ? lista?.[estilo]?.px : undefined;
  if (!pasta) return null;
  const m = metaPx(pasta);
  if (!m) return null;
  let falta = false;
  const img = (nome: string) => {
    const i = carregar(`px/${pasta}/${nome}`);
    if (!i) falta = true;
    return i!;
  };
  const piso = Array.from({ length: m.n }, (_, i) => Array.from({ length: m.n }, (_, j) => img(`piso-${i}-${j}.png`)));
  const parede = {
    l: { ...m.parede.l, imgs: Array.from({ length: m.n }, (_, i) => img(`parede-l-${i}.png`)) },
    r: { ...m.parede.r, imgs: Array.from({ length: m.n }, (_, i) => img(`parede-r-${i}.png`)) },
  };
  return falta ? null : { n: m.n, piso: { ...m.piso, imgs: piso }, parede };
}

/** Muda quando chega uma textura (ou a lista): o cômodo já desenhado precisa ser refeito. */
export function versaoTexturas() {
  return versao;
}

export function texturaPiso(estilo: FloorStyle | undefined): { img: HTMLImageElement; casas: number; origem: [number, number] } | null {
  const e = estilo ? lista?.[estilo]?.piso : undefined;
  if (!e) return null;
  const img = carregar(e.arquivo);
  return img ? { img, casas: e.casas, origem: e.origem ?? [0, 0] } : null;
}

export function texturaParede(estilo: FloorStyle | undefined): { img: HTMLImageElement } | null {
  const e = estilo ? lista?.[estilo]?.parede : undefined;
  if (!e) return null;
  const img = carregar(e.arquivo);
  return img ? { img } : null;
}
