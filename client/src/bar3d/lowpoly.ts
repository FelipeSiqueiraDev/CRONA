/**
 * A casca do Bar em LOW-POLY FACETADO (`?estilo=lowpoly`): piso de tábuas em cor chapada, paredes SÓ nas bordas (esquerda e
 * fundo), rodapé e friso, porta e janelas em caixas, itens de parede simples. Sem textura, sem prédio em volta, sem luz de
 * ponto (zero): a luz vem da hemisférica + direcional da cena. Devolve a mesma `Casca` que o `ambiente.ts`.
 */
import * as THREE from 'three';
import type { Casca } from './ambiente';
import { CASA, pegada, type DadosBar, type ParedeBar } from './dados';
import { PAREDE_ALTURA } from './texturas';

const ESP = 0.15;
const ALT = PAREDE_ALTURA;

const mat = (cor: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 1, metalness: 0, flatShading: true, ...extra });
const M = {
  parede: mat('#e9d2a6'),
  paredeFora: mat('#b99a6e'),
  lambri: mat('#8a5530'),
  rodape: mat('#5a3420'),
  friso: mat('#6e4226'),
  batente: mat('#5a3420'),
  porta: mat('#b5702e'),
  macaneta: mat('#e0b84a'),
  alicerce: mat('#8f7556'),
  janela: mat('#5a3420'),
};

function caixa(g: THREE.Object3D, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, sombra = true): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
  b.position.set(x, y, z);
  b.castShadow = sombra;
  b.receiveShadow = true;
  g.add(b);
  return b;
}

/** Piso: tábuas de cor chapada (3 por casa), alternando dois tons, numa malha só. Casas da escada ficam sem chão. */
function piso(dados: DadosBar, buracos: Set<string>): { mesh: THREE.Mesh; caixa: [number, number, number, number] } {
  const linhas = dados.cena.heightmap.split('\n').map((l) => l.trim());
  const pos: number[] = [];
  const cor: number[] = [];
  const tons = ['#c99a64', '#bf8f5a', '#b5865a', '#c4955f'].map((c) => new THREE.Color(c));
  let x0 = 1e9;
  let z0 = 1e9;
  let x1 = -1e9;
  let z1 = -1e9;
  linhas.forEach((linha, y) => {
    [...linha].forEach((c, x) => {
      if (c.toLowerCase() === 'x') return;
      const X = x * CASA;
      const Z = y * CASA;
      x0 = Math.min(x0, X);
      z0 = Math.min(z0, Z);
      x1 = Math.max(x1, X + CASA);
      z1 = Math.max(z1, Z + CASA);
      if (buracos.has(`${x},${y}`)) return;
      for (let t = 0; t < 3; t++) {
        const zz = Z + (t * CASA) / 3;
        const dz = CASA / 3;
        const k = (x * 7 + y * 13 + t * 5 + (x ^ y)) % tons.length;
        const col = tons[k];
        // duas faces de triângulo voltadas para cima (normal +y)
        pos.push(X, 0, zz, X, 0, zz + dz, X + CASA, 0, zz + dz, X, 0, zz, X + CASA, 0, zz + dz, X + CASA, 0, zz);
        for (let i = 0; i < 6; i++) cor.push(col.r, col.g, col.b);
      }
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return { mesh, caixa: [x0, z0, x1, z1] };
}

/** Item de parede simples e legível (cor chapada). Os que brilham entram em `brilhosDeParede`. */
function itemDeParede(it: ParedeBar, dados: DadosBar, casca: Casca): THREE.Object3D | null {
  const def = dados.defsParede[it.defId];
  if (!def) return null;
  const REAL: Record<string, [number, number]> = { painting: [0.8, 0.6], neon: [1.05, 0.42], clock: [0.34, 0.34], sconce: [0.16, 0.3], tv: [0.95, 0.55], fan: [0.45, 0.45], dartboard: [0.46, 0.46] };
  const [w, h] = REAL[def.kind] ?? [0.4, 0.4];
  const g = new THREE.Group();
  const f = new THREE.Group();
  g.add(f);
  const brilho = (cor: string, base: number) => {
    const m = mat('#222', { emissive: cor, emissiveIntensity: base });
    casca.brilhosDeParede.push({ mat: m, base });
    return m;
  };
  const cil = (m: THREE.Material, r: number, hh: number, x: number, y: number, z: number, seg = 8) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh, seg).rotateX(Math.PI / 2), m);
    c.position.set(x, y, z);
    f.add(c);
    return c;
  };
  switch (def.kind) {
    case 'painting': {
      caixa(f, mat('#d9a521'), 0, 0, 0, w, h, 0.04, false);
      caixa(f, mat('#e8d8aa'), 0, 0, 0.022, w * 0.82, h * 0.78, 0.01, false);
      // um quadro simples: céu, morro verde, sol
      caixa(f, mat('#7fb6d8'), 0, h * 0.12, 0.03, w * 0.82, h * 0.5, 0.004, false);
      const morro = new THREE.Mesh(new THREE.CircleGeometry(w * 0.3, 6, 0, Math.PI), mat('#4a9a42'));
      morro.position.set(-w * 0.1, -h * 0.13, 0.034);
      f.add(morro);
      cil(mat('#f4c430'), w * 0.07, 0.004, w * 0.22, h * 0.22, 0.034, 6);
      break;
    }
    case 'neon': {
      caixa(f, mat('#3a1f2e'), 0, 0, 0, w, h, 0.03, false);
      const nm = brilho('#ff4f9a', 1.0);
      // "SUVACO SECO" como 2 barras e uma seta: legível de relance, sem fonte
      caixa(f, nm, 0, h * 0.2, 0.025, w * 0.8, 0.045, 0.02, false);
      caixa(f, nm, 0, -h * 0.2, 0.025, w * 0.8, 0.045, 0.02, false);
      for (let i = -3; i <= 3; i++) caixa(f, nm, i * w * 0.11, 0, 0.025, 0.04, h * 0.28, 0.02, false);
      break;
    }
    case 'clock': {
      cil(mat('#2a2420'), w / 2, 0.04, 0, 0, 0, 10);
      cil(mat('#f1ead2'), w * 0.42, 0.045, 0, 0, 0.004, 10);
      caixa(f, mat('#2a2420'), 0, w * 0.1, 0.035, 0.018, w * 0.22, 0.01, false);
      const mp = caixa(f, mat('#2a2420'), w * 0.07, 0, 0.035, w * 0.16, 0.018, 0.01, false);
      mp.rotation.z = 0.5;
      break;
    }
    case 'dartboard': {
      cil(mat('#1a1a1a'), w / 2, 0.04, 0, 0, 0, 12);
      cil(mat('#d8cfb8'), w * 0.4, 0.045, 0, 0, 0.004, 12);
      cil(mat('#b3261e'), w * 0.28, 0.05, 0, 0, 0.008, 12);
      cil(mat('#1f8a3c'), w * 0.16, 0.055, 0, 0, 0.012, 12);
      cil(mat('#b3261e'), w * 0.05, 0.06, 0, 0, 0.016, 12);
      break;
    }
    case 'tv': {
      caixa(f, mat('#4a4d52'), 0, 0, 0, w, h, 0.22, false);
      caixa(f, brilho('#6aff9a', 0.8), 0, h * 0.04, 0.112, w * 0.78, h * 0.72, 0.01, false);
      break;
    }
    case 'fan': {
      const eixo = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const pa = caixa(eixo, mat('#e8d8aa'), 0, h * 0.22, 0, w * 0.14, h * 0.4, 0.012, false);
        const bra = new THREE.Group();
        bra.rotation.z = (i / 4) * Math.PI * 2;
        eixo.remove(pa);
        bra.add(pa);
        eixo.add(bra);
      }
      eixo.position.z = 0.1;
      cil(mat('#9a9ea6'), w * 0.06, 0.14, 0, 0, 0.04, 6);
      f.add(eixo);
      casca.ventiladores.push(eixo);
      break;
    }
    case 'sconce': {
      caixa(f, mat('#b88c34'), 0, 0, 0, w * 0.7, h * 0.5, 0.06, false);
      for (const dx of [-0.05, 0.05]) {
        cil(mat('#f1ead2'), 0.014, 0.12, dx, h * 0.3, 0.08, 5).rotation.x = 0;
        const fo = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 5), brilho('#ffb347', 1));
        fo.position.set(dx, h * 0.3 + 0.1, 0.08);
        f.add(fo);
      }
      break;
    }
    default:
      caixa(f, mat(def.colors[0] ?? '#888'), 0, 0, 0, w, h, 0.04, false);
  }
  const y = def.kind === 'dartboard' ? 1.73 : Math.min(it.z / dados.Z_PER_M + h / 2, ALT - 0.14 - h / 2);
  if (it.wall === 'l') {
    g.position.set(it.plane * CASA + 0.01, y, it.pos * CASA);
    g.rotation.y = Math.PI / 2;
  } else {
    g.position.set(it.pos * CASA, y, it.plane * CASA + 0.01);
  }
  return g;
}

function janela(g: THREE.Object3D, z0: number, z1: number, y0: number, y1: number, xEsq: number, casca: Casca) {
  const w = z1 - z0;
  const h = y1 - y0;
  const cz = (z0 + z1) / 2;
  const cy = (y0 + y1) / 2;
  const xm = xEsq - ESP / 2;
  const q = 0.06;
  caixa(g, M.janela, xm, cy, z0 + q / 2, 0.06, h, q);
  caixa(g, M.janela, xm, cy, z1 - q / 2, 0.06, h, q);
  caixa(g, M.janela, xm, y1 - q / 2, cz, 0.06, q, w);
  caixa(g, M.janela, xm, y0 + q / 2, cz, 0.06, q, w);
  caixa(g, M.janela, xm, cy, cz, 0.05, h, 0.035);
  caixa(g, M.janela, xm, cy + h * 0.1, cz, 0.05, 0.035, w);
  caixa(g, M.friso, xEsq + 0.04, y0 - 0.02, cz, 0.1, 0.04, w + 0.14); // peitoril
  // o vidro: azul claro e translúcido (a cor vem do material; o clima só liga e desliga)
  const vidro = new THREE.MeshBasicMaterial({ color: '#a8d4ea', transparent: true, opacity: 0.55, depthWrite: false });
  casca.vidros.push(vidro as THREE.MeshBasicMaterial);
  const v = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * q, h - 2 * q), vidro);
  v.rotation.y = Math.PI / 2;
  v.position.set(xm - 0.015, cy, cz);
  g.add(v);
}

export function montarCascaLowpoly(dados: DadosBar): Casca {
  const grupo = new THREE.Group();
  const casca: Casca = { grupo, janelasPredios: [], luzesDaRua: [], luzesDeParede: [], brilhosDeParede: [], ventiladores: [], luzesJanela: [], vidros: [], piso: [0, 0, 0, 0], porta: { z0: 0, z1: 0 } };
  const buracos = new Set<string>();
  for (const m of dados.mobis) {
    const def = dados.defs[m.defId];
    if (!def || def.kind !== 'stairs_down') continue;
    const { sx, sy } = pegada(def, m.rot);
    for (let dx = 0; dx < sx; dx++) for (let dy = 0; dy < sy; dy++) buracos.add(`${m.x + dx},${m.y + dy}`);
  }
  const { mesh, caixa: cx } = piso(dados, buracos);
  grupo.add(mesh);
  const xEsq = CASA;
  const [, zIni, xFim, zFim] = cx;
  casca.piso = [xEsq, zIni, xFim, zFim];
  const porta = dados.cena.door;
  const zc = (porta.y + 0.5) * CASA;
  const zp0 = zc - 0.48;
  const zp1 = zc + 0.48;
  const ALT_PORTA = 2.13;
  casca.porta = { z0: zp0, z1: zp1 };
  const JANELAS = [
    { z0: 1.325, z1: 2.525 },
    { z0: 9.525, z1: 10.725 },
  ];
  const Y0J = 1.0;
  const Y1J = 2.4;
  const abrir = [{ z0: zp0, z1: zp1, y0: 0, y1: ALT_PORTA, porta: true }, ...JANELAS.map((j) => ({ ...j, y0: Y0J, y1: Y1J, porta: false }))].sort((a, b) => a.z0 - b.z0);
  const cortes = [zIni, ...abrir.flatMap((o) => [o.z0, o.z1]), zFim];
  const xm = xEsq - ESP / 2;
  const parede = (a: number, b: number, y0: number, y1: number) => {
    const bx = caixa(grupo, M.parede, xm, (y0 + y1) / 2, (a + b) / 2, ESP, y1 - y0, b - a);
    // o lambri (madeira) na altura até 0,9 m, só na face de dentro
    if (y0 < 0.9) {
      const topo = Math.min(y1, 0.9);
      caixa(grupo, M.lambri, xEsq + 0.012, (y0 + topo) / 2, (a + b) / 2, 0.024, topo - y0, b - a, false);
    }
    void bx;
  };
  for (let i = 0; i < cortes.length - 1; i++) {
    const a = cortes[i];
    const b = cortes[i + 1];
    if (b - a < 0.001) continue;
    const o = abrir.find((q) => (a + b) / 2 > q.z0 && (a + b) / 2 < q.z1);
    if (!o) parede(a, b, 0, ALT);
    else {
      if (o.y0 > 0.01) parede(a, b, 0, o.y0);
      parede(a, b, o.y1, ALT);
      if (!o.porta) janela(grupo, a, b, o.y0, o.y1, xEsq, casca);
    }
  }
  // parede do fundo
  caixa(grupo, M.parede, (xEsq - ESP + xFim) / 2, ALT / 2, zIni - ESP / 2, xFim - xEsq + ESP, ALT, ESP);
  caixa(grupo, M.lambri, (xEsq + xFim) / 2, 0.45, zIni + 0.012, xFim - xEsq, 0.9, 0.024, false);
  // rodapé e friso de teto: só 2 caixas por parede, para dar o acabamento
  caixa(grupo, M.friso, (xEsq + xFim) / 2, 0.9, zIni + 0.02, xFim - xEsq, 0.05, 0.04, false);
  caixa(grupo, M.friso, (xEsq + xFim) / 2, ALT - 0.05, zIni + 0.03, xFim - xEsq, 0.1, 0.06, false);
  for (const [a, b] of [
    [zIni, zp0 - 0.07],
    [zp1 + 0.07, zFim],
  ]) {
    caixa(grupo, M.friso, xEsq + 0.02, 0.9, (a + b) / 2, 0.04, 0.05, b - a, false);
    caixa(grupo, M.friso, xEsq + 0.03, ALT - 0.05, (a + b) / 2, 0.06, 0.1, b - a, false);
  }
  // a porta
  const larg = zp1 - zp0;
  caixa(grupo, M.batente, xm, ALT_PORTA / 2, zp0 + 0.02, ESP, ALT_PORTA, 0.04);
  caixa(grupo, M.batente, xm, ALT_PORTA / 2, zp1 - 0.02, ESP, ALT_PORTA, 0.04);
  caixa(grupo, M.batente, xm, ALT_PORTA - 0.02, zc, ESP, 0.04, larg);
  const lFolha = 0.88;
  const folha = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.07, lFolha), M.porta);
  folha.geometry.translate(0, 0, lFolha / 2);
  const puxador = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.12), M.macaneta);
  puxador.position.set(0, -0.0, lFolha - 0.1);
  folha.add(puxador);
  for (const yy of [0.5, -0.5]) {
    const painel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, lFolha - 0.3), mat('#9a5e26'));
    painel.position.set(0, yy, lFolha / 2);
    folha.add(painel);
  }
  folha.position.set(xm, 1.035, zp0 + 0.04);
  folha.rotation.y = -1.15;
  folha.castShadow = true;
  folha.receiveShadow = true;
  grupo.add(folha);
  casca.folhaPorta = folha;
  caixa(grupo, mat('#6a5240'), xm, 0.015, zc, ESP + 0.04, 0.03, larg);
  for (const it of dados.parede) {
    const o = itemDeParede(it, dados, casca);
    if (o) grupo.add(o);
  }
  // a laje embaixo do piso: dá o corte de "maquete" sem nenhum prédio em volta
  const lw = xFim - xEsq + 0.5;
  const ld = zFim - zIni + 0.5;
  caixa(grupo, M.alicerce, xEsq - 0.25 + lw / 2, -0.26, zIni - 0.25 + ld / 2, lw, 0.5, ld);
  return casca;
}
