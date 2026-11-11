/**
 * O standee: a ilustração recortada do agente (standee.png, corpo inteiro, fundo transparente) vira um objeto com espessura e
 * relevo leve, como uma miniatura de acrílico recortada. Do canal alfa sai uma malha de células de ~8 mm; cada célula cheia
 * ganha a face da frente (a ilustração) e as costas (a mesma imagem, escurecida); onde a célula vizinha é vazia, sobe uma
 * parede lateral na cor da roupa. A espessura vai de ~3 cm na borda a ~9 cm no meio ("inflação" pela distância até a borda,
 * suavizada), o que pega luz e dá paralaxe quando a câmera gira. O contorno exato vem do `alphaTest` da textura.
 */
import * as THREE from 'three';
import { LOWPOLY } from './estilo';

export interface Standee {
  grupo: THREE.Group;
  /** a respiração: de -1 a 1 (o chamador põe o seno) */
  resp: { value: number };
  largura: number;
  altura: number;
}

/** células na altura da figura (a célula tem ALTURA / CELULAS ≈ 8 mm) */
const CELULAS = LOWPOLY ? 110 : 220; // low-poly: malha 7x mais leve (o recorte fica facetado, como o resto)
/** espessura total (m) na borda e a mais no miolo */
const BORDA = 0.03;
const MIOLO = 0.06;
/** distância (em m) da borda até o relevo chegar ao máximo */
const RAIO_RELEVO = 0.15;

function lerImagem(img: HTMLImageElement, nx: number, ny: number) {
  const c = document.createElement('canvas');
  c.width = nx;
  c.height = ny;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, nx, ny);
  return g.getImageData(0, 0, nx, ny).data;
}

/** Distância (em células) de cada célula cheia até a vazia mais perto (dois passes, pesos 1 e 1,414). */
function distancia(cheia: Uint8Array, nx: number, ny: number): Float32Array {
  const INF = 1e6;
  const d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) d[k] = cheia[k] ? INF : 0;
  const R2 = Math.SQRT2;
  const at = (i: number, j: number) => d[j * nx + i];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let v = d[j * nx + i];
      if (v === 0) continue;
      if (i > 0) v = Math.min(v, at(i - 1, j) + 1);
      if (j > 0) v = Math.min(v, at(i, j - 1) + 1);
      if (i > 0 && j > 0) v = Math.min(v, at(i - 1, j - 1) + R2);
      if (i < nx - 1 && j > 0) v = Math.min(v, at(i + 1, j - 1) + R2);
      d[j * nx + i] = v;
    }
  for (let j = ny - 1; j >= 0; j--)
    for (let i = nx - 1; i >= 0; i--) {
      let v = d[j * nx + i];
      if (v === 0) continue;
      if (i < nx - 1) v = Math.min(v, at(i + 1, j) + 1);
      if (j < ny - 1) v = Math.min(v, at(i, j + 1) + 1);
      if (i < nx - 1 && j < ny - 1) v = Math.min(v, at(i + 1, j + 1) + R2);
      if (i > 0 && j < ny - 1) v = Math.min(v, at(i - 1, j + 1) + R2);
      d[j * nx + i] = v;
    }
  return d;
}

export function construirStandee(img: HTMLImageElement, altura = 1.8): Standee {
  const cs = altura / CELULAS;
  const ny0 = CELULAS;
  const nx0 = Math.max(8, Math.round((CELULAS * img.width) / img.height));
  const PAD = 2;
  // a grade com 2 células vazias à esquerda, à direita e em cima (embaixo não: o pé pousa no chão)
  const NX = nx0 + PAD * 2;
  const NY = ny0 + PAD;
  const dados = lerImagem(img, nx0, ny0);
  const cheia = new Uint8Array(NX * NY);
  const cor = new Uint8Array(NX * NY * 3);
  for (let j = 0; j < ny0; j++)
    for (let i = 0; i < nx0; i++) {
      const s = (j * nx0 + i) * 4;
      const k = (j + PAD) * NX + (i + PAD);
      if (dados[s + 3] > 64) {
        cheia[k] = 1;
        cor[k * 3] = dados[s];
        cor[k * 3 + 1] = dados[s + 1];
        cor[k * 3 + 2] = dados[s + 2];
      }
    }
  const dist = distancia(cheia, NX, NY);

  // a profundidade de cada canto da grade: média das células cheias em volta, depois suavizada
  const CX = NX + 1;
  const CY = NY + 1;
  const prof = new Float32Array(CX * CY);
  const raioCel = RAIO_RELEVO / cs;
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let cj = 0; cj < CY; cj++)
    for (let ci = 0; ci < CX; ci++) {
      let soma = 0;
      let n = 0;
      for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= NX || j >= NY) continue;
        const k = j * NX + i;
        if (cheia[k]) {
          soma += dist[k];
          n++;
        }
      }
      const d = n ? soma / n : 0;
      prof[cj * CX + ci] = BORDA / 2 + (MIOLO / 2) * sm(Math.min(1, Math.max(0, d - 0.5) / raioCel));
    }
  for (let passo = 0; passo < 3; passo++) {
    const c = prof.slice();
    for (let cj = 1; cj < CY - 1; cj++)
      for (let ci = 1; ci < CX - 1; ci++) {
        let s = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += c[(cj + dj) * CX + ci + di];
        prof[cj * CX + ci] = s / 9;
      }
  }

  const px = (ci: number) => (ci - PAD - nx0 / 2) * cs;
  const py = (cj: number) => (NY - cj) * cs;
  const U = (ci: number) => (ci - PAD) / nx0;
  const V = (cj: number) => 1 - (cj - PAD) / ny0;

  // a frente e as costas (vértices compartilhados por canto; só as células cheias entram nos índices)
  const posF = new Float32Array(CX * CY * 3);
  const posB = new Float32Array(CX * CY * 3);
  const uv = new Float32Array(CX * CY * 2);
  for (let cj = 0; cj < CY; cj++)
    for (let ci = 0; ci < CX; ci++) {
      const k = cj * CX + ci;
      const h = prof[k];
      posF.set([px(ci), py(cj), h], k * 3);
      posB.set([px(ci), py(cj), -h], k * 3);
      uv.set([U(ci), V(cj)], k * 2);
    }
  const idxF: number[] = [];
  const idxB: number[] = [];
  const paredes: { p: number[]; n: number[]; c: number[] } = { p: [], n: [], c: [] };
  const corCel = (k: number, f: number): number[] => [(cor[k * 3] / 255) * f, (cor[k * 3 + 1] / 255) * f, (cor[k * 3 + 2] / 255) * f];
  const parede = (ci0: number, cj0: number, ci1: number, cj1: number, nx: number, ny: number, k: number) => {
    const a = (ci0 + cj0 * CX) * 3;
    const b = (ci1 + cj1 * CX) * 3;
    const f0 = [posF[a], posF[a + 1], posF[a + 2]];
    const f1 = [posF[b], posF[b + 1], posF[b + 2]];
    const b0 = [posB[a], posB[a + 1], posB[a + 2]];
    const b1 = [posB[b], posB[b + 1], posB[b + 2]];
    const col = corCel(k, 0.55);
    // dois triângulos: f0 f1 b1 e f0 b1 b0 (a ordem certa dá a normal para fora; a malha é DoubleSide na parede)
    for (const v of [f0, f1, b1, f0, b1, b0]) {
      paredes.p.push(...v);
      paredes.n.push(nx, ny, 0);
      paredes.c.push(...col);
    }
  };
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (!cheia[k]) continue;
      const a = j * CX + i;
      const b = a + 1;
      const c = a + CX;
      const d = c + 1;
      idxF.push(a, c, d, a, d, b);
      idxB.push(a, d, c, a, b, d);
      // paredes: cima, baixo, esquerda e direita onde a vizinha é vazia
      if (j === 0 || !cheia[k - NX]) parede(i + 1, j, i, j, 0, 1, k);
      if (j < NY - 1 ? !cheia[k + NX] : true) parede(i, j + 1, i + 1, j + 1, 0, -1, k);
      if (i === 0 || !cheia[k - 1]) parede(i, j, i, j + 1, -1, 0, k);
      if (i === NX - 1 || !cheia[k + 1]) parede(i + 1, j + 1, i + 1, j, 1, 0, k);
    }

  const geo = (pos: Float32Array, idx: number[], inverteNormal: boolean) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (inverteNormal) {
      // as costas: a normal já sai para -z pela ordem dos índices
    }
    return g;
  };

  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const resp = { value: 0 };
  // a respiração: o peito incha em z e o corpo cresce um fio em y (o chamador põe `resp` entre -1 e 1)
  const comResp = (m: THREE.Material) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uResp = resp;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uResp;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float hh = clamp(position.y / ${altura.toFixed(3)}, 0.0, 1.0);
          float peito = smoothstep(0.45, 0.68, hh) * (1.0 - smoothstep(0.76, 0.92, hh));
          transformed.z *= 1.0 + uResp * 0.28 * peito;
          transformed.x *= 1.0 + uResp * 0.012 * peito;
          transformed.y *= 1.0 + uResp * 0.015;`,
        );
    };
    m.customProgramCacheKey = () => 'standee-resp';
  };

  const frente = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.2 });
  const costas = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, color: '#8a8478', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.08 });
  const lado = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.0 });
  comResp(frente);
  comResp(costas);
  comResp(lado);

  const meshF = new THREE.Mesh(geo(posF, idxF, false), frente);
  const meshB = new THREE.Mesh(geo(posB, idxB, true), costas);
  const gl = new THREE.BufferGeometry();
  gl.setAttribute('position', new THREE.Float32BufferAttribute(paredes.p, 3));
  gl.setAttribute('normal', new THREE.Float32BufferAttribute(paredes.n, 3));
  gl.setAttribute('color', new THREE.Float32BufferAttribute(paredes.c, 3));
  const meshL = new THREE.Mesh(gl, lado);
  const grupo = new THREE.Group();
  for (const m of [meshF, meshB, meshL]) {
    m.castShadow = true;
    m.frustumCulled = false;
    grupo.add(m);
  }
  return { grupo, resp, largura: nx0 * cs, altura };
}
