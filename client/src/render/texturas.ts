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
