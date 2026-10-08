/**
 * O Brasil do mapa-múndi (07/10), em pixel art, como na referência do Felipe: a terra flutuando no mar, com a borda
 * grossa e escura por baixo (o "bolo" da ilha), os biomas em cores chapadas (a Amazônia, o Cerrado, a Caatinga, a Mata
 * Atlântica, o Pampa e o Pantanal), os rios, umas arvorezinhas, cactos e serras. Tudo desenhado uma vez numa tela pequena
 * (`MAPA_W` × `MAPA_H`) e ampliado com pixels grandes.
 */

export const MAPA_W = 480;
export const MAPA_H = 270;

/** O contorno do Brasil (longitude, latitude), simplificado, no sentido horário a partir de Roraima. */
const CONTORNO: [number, number][] = [
  [-60.0, 5.2], [-59.5, 2.0], [-56.5, 1.9], [-54.0, 2.3], [-51.6, 4.2], [-50.0, 1.7], [-49.5, -0.2], [-48.0, -0.8],
  [-44.5, -2.4], [-41.5, -2.9], [-38.5, -3.7], [-35.2, -5.5], [-34.8, -7.1], [-35.0, -9.0], [-37.0, -11.0], [-38.5, -13.0],
  [-39.0, -15.0], [-39.7, -19.0], [-41.0, -22.0], [-43.2, -23.0], [-45.5, -23.8], [-48.0, -25.5], [-48.6, -28.5], [-50.0, -30.5],
  [-52.0, -32.5], [-53.4, -33.7], [-53.5, -32.0], [-55.5, -30.9], [-57.6, -30.2], [-55.8, -28.0], [-53.9, -27.1], [-54.6, -25.6],
  [-54.3, -24.0], [-55.4, -23.9], [-55.8, -22.3], [-57.9, -22.1], [-58.0, -20.0], [-58.2, -17.3], [-60.2, -16.3], [-60.5, -13.8],
  [-62.2, -13.0], [-64.3, -12.5], [-65.4, -11.0], [-67.0, -10.6], [-69.6, -11.0], [-73.0, -9.5], [-73.9, -7.3], [-72.9, -5.2],
  [-70.0, -4.3], [-69.4, -1.0], [-69.9, 1.1], [-67.0, 2.0], [-66.8, 1.2], [-64.0, 2.0], [-63.4, 3.9], [-62.0, 4.2], [-60.7, 5.2],
];

/** Os rios (longitude, latitude): o Amazonas, o São Francisco, o Paraná e o Tocantins. */
const RIOS: { pts: [number, number][]; largo: boolean }[] = [
  { pts: [[-70.0, -4.2], [-66.0, -3.4], [-62.0, -3.3], [-59.0, -3.1], [-56.0, -2.5], [-53.0, -1.8], [-51.0, -1.0], [-49.8, -0.4]], largo: true },
  { pts: [[-45.9, -20.2], [-45.0, -18.0], [-44.0, -15.6], [-43.3, -13.0], [-42.2, -10.6], [-40.5, -9.4], [-38.6, -9.6], [-36.6, -10.4]], largo: false },
  { pts: [[-51.0, -19.8], [-52.6, -21.6], [-53.8, -23.6], [-54.5, -25.4]], largo: false },
  { pts: [[-48.6, -15.6], [-48.3, -11.8], [-48.2, -8.5], [-49.2, -5.4], [-49.4, -2.2]], largo: false },
];

// a projeção: o meio do Brasil no meio da tela, um pouco para cima (a borda de baixo precisa de espaço)
const LON_C = -54.35;
const LAT_C = -14.25;
const KY = 6.09;
const KX = KY * 0.97;
const CX = MAPA_W / 2;
const CY = 129;

/** Longitude e latitude para o pixel da tela pequena. */
export function projetar(lon: number, lat: number): [number, number] {
  return [CX + (lon - LON_C) * KX, CY - (lat - LAT_C) * KY];
}

/** O pixel de volta para longitude e latitude. */
function desprojetar(x: number, y: number): [number, number] {
  return [LON_C + (x - CX) / KX, LAT_C - (y - CY) / KY];
}

const ruido = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return v - Math.floor(v);
};
/** um ruído suave (para a beira dos biomas não ficar reta) */
function suave(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const a = ruido(xi, yi);
  const b = ruido(xi + 1, yi);
  const c = ruido(xi, yi + 1);
  const d = ruido(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

type Bioma = 'amazonia' | 'cerrado' | 'caatinga' | 'mata' | 'pampa' | 'pantanal';
const COR: Record<Bioma, [string, string]> = {
  amazonia: ['#3ea64a', '#4fbb55'],
  cerrado: ['#b9c94a', '#c9d65a'],
  caatinga: ['#e6ad45', '#f0bf5a'],
  mata: ['#5cc24e', '#70d05c'],
  pampa: ['#9bd56a', '#aee07c'],
  pantanal: ['#6fbf86', '#82cf95'],
};

/** O bioma de um ponto (com a beira tremida pelo ruído). `costa`: quantos pixels até o mar a leste. */
function bioma(lon: number, lat: number, costa: number): Bioma {
  const t = (suave(lon * 0.9, lat * 0.9) - 0.5) * 2.4;
  if (lat < -28.6 + t * 0.6) return 'pampa';
  if (costa < 9 + t * 2 && lat < -5.5 && lat > -29.5) return 'mata';
  if (lon < -55.2 + t && lon > -58.6 && lat < -16 + t * 0.5 && lat > -21.5) return 'pantanal';
  if (lon > -45.5 + t && lat > -16.2 + t && lat < -2.6) return 'caatinga';
  if (lat > -9.5 + t - Math.max(0, -lon - 60) * 0.25 && lon < -46.5 + t) return 'amazonia';
  if (lat > -12.5 + t && lon < -60) return 'amazonia';
  return 'cerrado';
}

function corInt(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Desenha o Brasil inteiro (a borda, os biomas, os rios e os enfeites) na tela pequena. */
export function desenharBrasil(ctx: CanvasRenderingContext2D) {
  // a máscara da terra: o contorno pintado e endurecido (cada pixel é terra ou mar)
  const m = document.createElement('canvas');
  m.width = MAPA_W;
  m.height = MAPA_H;
  const mc = m.getContext('2d')!;
  mc.beginPath();
  CONTORNO.forEach(([lo, la], i) => {
    const [x, y] = projetar(lo, la);
    if (i) mc.lineTo(x, y);
    else mc.moveTo(x, y);
  });
  mc.closePath();
  mc.fillStyle = '#fff';
  mc.fill();
  const md = mc.getImageData(0, 0, MAPA_W, MAPA_H).data;
  const terra = (x: number, y: number) => x >= 0 && y >= 0 && x < MAPA_W && y < MAPA_H && md[(y * MAPA_W + x) * 4 + 3] > 120;

  const img = ctx.getImageData(0, 0, MAPA_W, MAPA_H);
  const d = img.data;
  const pinta = (x: number, y: number, c: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= MAPA_W || y >= MAPA_H) return;
    const i = (y * MAPA_W + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  };

  // o bolo da ilha: a terra repetida para baixo, escura, com a beira de baixo mais escura ainda
  const PROF = 9;
  const lado = corInt('#3c2f5c');
  const ladoClaro = corInt('#54457a');
  const fundoBolo = corInt('#271d3d');
  for (let y = MAPA_H - 1; y >= 0; y--)
    for (let x = 0; x < MAPA_W; x++) {
      if (terra(x, y)) continue;
      for (let k = 1; k <= PROF; k++)
        if (terra(x, y - k)) {
          pinta(x, y, k === PROF || !terra(x, y - k + 1) ? (k > PROF - 2 ? fundoBolo : k < 3 ? ladoClaro : lado) : lado);
          break;
        }
    }
  // a sombra do bolo no mar
  const sombra = corInt('#2b8d95');
  for (let y = 0; y < MAPA_H; y++)
    for (let x = 0; x < MAPA_W; x++) {
      const i = (y * MAPA_W + x) * 4;
      if (d[i + 3] === 255 && (d[i] !== 0 || d[i + 1] !== 0) && (terra(x, y) || [1, 2, 3, 4, 5, 6, 7, 8, 9].some((k) => terra(x, y - k)))) continue;
      if (terra(x - 4, y - PROF - 3) || [1, 2, 3, 4, 5, 6, 7].some((k) => terra(x - 4, y - PROF - 3 - k))) pinta(x, y, sombra);
    }

  // o topo: o bioma de cada pixel, com um pontilhado mais claro e a beira do mar marcada
  const costaDe = new Int32Array(MAPA_H).fill(-1);
  for (let y = 0; y < MAPA_H; y++) for (let x = MAPA_W - 1; x >= 0; x--) if (terra(x, y)) {
    costaDe[y] = x;
    break;
  }
  const contorno = corInt('#2a1d2e');
  for (let y = 0; y < MAPA_H; y++)
    for (let x = 0; x < MAPA_W; x++) {
      if (!terra(x, y)) continue;
      const [lon, lat] = desprojetar(x + 0.5, y + 0.5);
      const b = bioma(lon, lat, costaDe[y] - x);
      const [base, claro] = COR[b];
      const borda = !terra(x - 1, y) || !terra(x + 1, y) || !terra(x, y - 1) || !terra(x, y + 1);
      if (borda) {
        // a beira de cima fica clara (a luz), as outras com o contorno escuro
        pinta(x, y, !terra(x, y - 1) ? corInt(claro) : contorno);
        continue;
      }
      pinta(x, y, corInt(ruido(x, y, 3) < 0.12 ? claro : base));
    }
  ctx.putImageData(img, 0, 0);

  // os rios
  ctx.lineCap = 'square';
  for (const rio of RIOS) {
    ctx.beginPath();
    rio.pts.forEach(([lo, la], i) => {
      const [x, y] = projetar(lo, la);
      if (i) ctx.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5);
      else ctx.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5);
    });
    ctx.strokeStyle = '#2a7fb3';
    ctx.lineWidth = rio.largo ? 3 : 2;
    ctx.stroke();
    ctx.strokeStyle = '#58c2ee';
    ctx.lineWidth = rio.largo ? 2 : 1;
    ctx.stroke();
  }

  // os enfeites: arvorezinhas na Amazônia, cactos na Caatinga, as serras de Minas, os pinheiros do Sul
  const enfeite = (lon: number, lat: number, f: (x: number, y: number) => void) => {
    const [x, y] = projetar(lon, lat);
    if (terra(Math.round(x), Math.round(y))) f(Math.round(x), Math.round(y));
  };
  for (let i = 0; i < 46; i++) {
    const lon = -72 + ruido(i, 1) * 24;
    const lat = -10 + ruido(i, 2) * 13;
    enfeite(lon, lat, (x, y) => {
      if (bioma(lon, lat, 99) !== 'amazonia') return;
      ctx.fillStyle = '#2a1d2e';
      ctx.fillRect(x - 2, y - 3, 5, 4);
      ctx.fillStyle = '#2f8a3b';
      ctx.fillRect(x - 1, y - 3, 3, 3);
      ctx.fillStyle = '#5fcf63';
      ctx.fillRect(x - 1, y - 3, 1, 1);
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(x, y, 1, 1);
    });
  }
  for (let i = 0; i < 12; i++) {
    const lon = -44.5 + ruido(i, 4) * 6.5;
    const lat = -14.5 + ruido(i, 5) * 9;
    enfeite(lon, lat, (x, y) => {
      if (bioma(lon, lat, 99) !== 'caatinga') return;
      ctx.fillStyle = '#2d7d43';
      ctx.fillRect(x, y - 4, 1, 5);
      ctx.fillRect(x - 2, y - 2, 1, 2);
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x + 2, y - 3, 1, 2);
      ctx.fillRect(x + 1, y - 2, 1, 1);
    });
  }
  for (const [lon, lat] of [[-44.2, -19.4], [-43.2, -20.6], [-42.4, -18.6]] as [number, number][])
    enfeite(lon, lat, (x, y) => {
      ctx.fillStyle = '#2a1d2e';
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 1);
      ctx.lineTo(x, y - 7);
      ctx.lineTo(x + 6, y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8b6a55';
      ctx.beginPath();
      ctx.moveTo(x - 4.5, y);
      ctx.lineTo(x, y - 5.5);
      ctx.lineTo(x + 4.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b08a6c';
      ctx.fillRect(x - 1, y - 4, 1, 3);
    });
  for (let i = 0; i < 7; i++) {
    const lon = -53.5 + ruido(i, 6) * 5;
    const lat = -25.5 + ruido(i, 7) * 3;
    enfeite(lon, lat, (x, y) => {
      ctx.fillStyle = '#1f6b3a';
      ctx.fillRect(x - 1, y - 4, 3, 1);
      ctx.fillRect(x - 2, y - 3, 5, 1);
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(x, y - 2, 1, 2);
    });
  }
}
