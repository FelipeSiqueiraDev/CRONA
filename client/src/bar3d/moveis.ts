/**
 * Os móveis do Bar em 3D. O modelo bom é o `.glb` de `public/prototipo3d/modelos/<defId>.glb` (metros, origem no centro
 * da pegada no chão, frente em +Z); enquanto ele não existe, a RESERVA: um modelo de poucos polígonos montado aqui,
 * da medida exata do móvel (largura × altura × fundo), para o Bar já ficar de pé.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { anguloDoGiro, CASA, pegada, type DadosBar, type DefBar, type MobiBar } from './dados';
import { ALTURA_PAREDE } from './ambiente';
import { sombraMole, tapete } from './texturas';
import { LOWPOLY } from './estilo';

type Luz = { luz: THREE.PointLight; base: number };

export interface Resultado {
  grupo: THREE.Group;
  /** as luzes dos móveis (lâmpadas, velas, abajur), para o clima e a hora mexerem */
  luzes: Luz[];
  /** materiais que brilham (janelas das geladeiras, letreiros) e a intensidade de noite */
  brilhos: { mat: THREE.MeshStandardMaterial; base: number }[];
  /** quantos modelos .glb entraram no lugar da reserva */
  glb: number;
  /** os tipos que ainda usam a reserva */
  reserva: string[];
  /** o que a medida do apoio achou para cada item que pousa em cima de outro móvel (para conferir) */
  diag: { id: number; def: string; apoios: string[]; topo: number | null; faixas: [number, number][]; y: number }[];
  /** cada móvel colocado (o grupo, o dado do jogo e a pegada), para a interação achar e mexer */
  entradas: Entrada[];
}

const cor = (s: string | undefined, fallback: string) => new THREE.Color(s ?? fallback);
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(c: string | THREE.Color, rugosidade = 0.8, metal = 0): THREE.MeshStandardMaterial {
  const chave = `${typeof c === 'string' ? c : c.getHexString()}|${rugosidade}|${metal}`;
  let m = matCache.get(chave);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: rugosidade, metalness: metal });
    matCache.set(chave, m);
  }
  return m;
}

function caixa(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cilindro(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function esfera(r: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const MADEIRA_ESCURA = '#3a2214';
const MADEIRA = '#7a4a26';
const MADEIRA_CLARA = '#a8723c';

interface Ctx {
  def: DefBar;
  w: number;
  d: number;
  h: number;
  luzes: Luz[];
  brilhos: Resultado['brilhos'];
}

const brilhante = (ctx: Ctx, c: string, intensidade: number): THREE.MeshStandardMaterial => {
  const m = new THREE.MeshStandardMaterial({ color: '#0c0c0c', emissive: c, emissiveIntensity: intensidade, roughness: 0.5 });
  ctx.brilhos.push({ mat: m, base: intensidade });
  return m;
};

const luzDe = (ctx: Ctx, g: THREE.Object3D, c: string, intensidade: number, dist: number, x: number, y: number, z: number, sombra = false) => {
  const l = new THREE.PointLight(c, intensidade, dist, 1.6);
  l.position.set(x, y, z);
  if (sombra) {
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.03;
    l.shadow.radius = 5;
  }
  g.add(l);
  ctx.luzes.push({ luz: l, base: intensidade });
};

/** Garrafas numa prateleira (cores variadas). */
function garrafas(g: THREE.Group, w: number, y: number, z: number, n: number, semente: number) {
  const cores = ['#2e7a3c', '#7a3a1a', '#b88a28', '#2a4a7a', '#6a1a2a', '#c8c0a0'];
  for (let i = 0; i < n; i++) {
    const c = cores[(i * 7 + semente) % cores.length];
    const x = -w / 2 + 0.08 + ((w - 0.16) * (i + 0.5)) / n;
    const garrafa = cilindro(0.028, 0.032, 0.2, new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.1, emissive: c, emissiveIntensity: 0.25 }), x, y, z, 8);
    const gargalo = cilindro(0.012, 0.016, 0.08, mat(c, 0.3), x, y + 0.2, z, 8);
    g.add(garrafa, gargalo);
  }
}

type Construtor = (ctx: Ctx) => THREE.Group;

const construtores: Record<string, Construtor> = {
  bar_counter: ({ w, d, h }) => {
    const g = new THREE.Group();
    g.add(caixa(w, h - 0.05, d * 0.86, mat(MADEIRA_ESCURA, 0.7), 0, 0, -d * 0.04));
    // frisos de madeira na frente
    for (let i = 0; i < 4; i++) g.add(caixa(w * 0.2, h * 0.6, 0.02, mat('#4a2c18', 0.75), -w * 0.375 + i * w * 0.25, 0.1, d * 0.4));
    g.add(caixa(w + 0.02, 0.06, d * 1.02, mat('#a06a34', 0.35, 0.05), 0, h - 0.06, 0));
    g.add(cilindro(0.025, 0.025, w, mat('#b89a58', 0.3, 0.8), 0, 0.12, d * 0.46, 10).rotateZ(Math.PI / 2));
    return g;
  },
  bar_shelf: (ctx) => {
    const { w, d, h } = ctx;
    const g = new THREE.Group();
    g.add(caixa(w, h, 0.05, mat('#2a170c', 0.8), 0, 0, -d / 2 + 0.03));
    g.add(caixa(0.05, h, d * 0.5, mat(MADEIRA_ESCURA, 0.8), -w / 2 + 0.03, 0, -d * 0.25));
    g.add(caixa(0.05, h, d * 0.5, mat(MADEIRA_ESCURA, 0.8), w / 2 - 0.03, 0, -d * 0.25));
    g.add(caixa(w, h * 0.42, d * 0.7, mat('#3a2214', 0.8), 0, 0, -d * 0.12));
    for (let i = 0; i < 4; i++) {
      const y = h * 0.44 + i * h * 0.14;
      g.add(caixa(w - 0.06, 0.03, d * 0.5, mat('#5a3a20', 0.6), 0, y, -d * 0.2));
      garrafas(g, w - 0.14, y + 0.03, -d * 0.2, 7 + (i % 2), i * 3 + (Math.round(w * 10) % 5));
    }
    luzDe(ctx, g, '#ffb866', 0.5, 2.2, 0, h * 0.85, -d * 0.1);
    return g;
  },
  stool_high: ({ w, h }) => {
    const g = new THREE.Group();
    g.add(cilindro(0.17, 0.15, 0.07, mat('#8a1a1a', 0.55), 0, h - 0.07, 0, 18));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const perna = cilindro(0.016, 0.02, h - 0.07, mat('#26262c', 0.4, 0.7), Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, 6);
      g.add(perna);
    }
    g.add(cilindro(0.13, 0.13, 0.015, mat('#26262c', 0.4, 0.7), 0, h * 0.4, 0, 14));
    void w;
    return g;
  },
  chair: ({ def, w, h }) => {
    const g = new THREE.Group();
    const c = def.colors[0] ?? '#a02020';
    const plastico = mat(cor(c, '#a02020').multiplyScalar(0.9), 0.45);
    const assento = h * 0.98;
    g.add(caixa(w * 0.5, 0.045, w * 0.5, plastico, 0, assento - 0.045, 0));
    g.add(caixa(w * 0.5, h * 0.8, 0.04, plastico, 0, assento - 0.02, -w * 0.23));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) g.add(cilindro(0.017, 0.02, assento - 0.045, mat('#d8d4c8', 0.4, 0.4), sx * w * 0.2, 0, sz * w * 0.2, 6));
    return g;
  },
  table: ({ w, h, def }) => {
    const g = new THREE.Group();
    const redonda = def.id === 'table_small';
    const tampo = mat(def.id === 'table_bar' ? '#c27a2c' : '#8a5a30', 0.5);
    if (redonda || true) g.add(cilindro(w * 0.4, w * 0.4, 0.045, tampo, 0, h - 0.045, 0, 22));
    g.add(cilindro(0.04, 0.05, h - 0.06, mat('#2a2a30', 0.4, 0.7), 0, 0.02, 0, 10));
    g.add(cilindro(w * 0.24, w * 0.26, 0.025, mat('#2a2a30', 0.4, 0.7), 0, 0, 0, 16));
    return g;
  },
  table_big: ({ w, d, h }) => {
    const g = new THREE.Group();
    g.add(caixa(w, h - 0.06, d * 0.9, mat('#5a3620', 0.7), 0, 0, 0));
    g.add(caixa(w + 0.04, 0.06, d, mat('#8a5a30', 0.45), 0, h - 0.06, 0));
    for (let i = 0; i < 2; i++) g.add(caixa(w * 0.4, h * 0.5, 0.02, mat('#3a2214', 0.8), -w * 0.24 + i * w * 0.48, 0.12, d * 0.46));
    return g;
  },
  beer_fridge: (ctx) => {
    const { w, d, h, def } = ctx;
    const g = new THREE.Group();
    const c = def.colors[0] ?? '#b8901c';
    g.add(caixa(w * 0.94, h, d * 0.9, mat(c, 0.4, 0.2), 0, 0, 0));
    const vidro = brilhante(ctx, def.colors[1] ?? '#ffe9a0', 1.15);
    g.add(caixa(w * 0.7, h * (h > 1.4 ? 0.62 : 0.6), 0.02, vidro, 0, h * 0.2, d * 0.46));
    g.add(caixa(0.03, h * 0.5, 0.04, mat('#d8d8d0', 0.3, 0.8), w * 0.38, h * 0.25, d * 0.49));
    luzDe(ctx, g, '#ffe8b0', 0.45, 1.6, 0, h * 0.5, d * 0.7);
    return g;
  },
  jukebox: (ctx) => {
    const { w, d, h } = ctx;
    const g = new THREE.Group();
    g.add(caixa(w * 0.9, h, d * 0.9, mat('#1c1830', 0.45, 0.2), 0, 0, 0));
    g.add(caixa(w * 0.78, h * 0.34, 0.03, brilhante(ctx, '#5affd0', 1.4), 0, h * 0.52, d * 0.46));
    g.add(caixa(w * 0.5, h * 0.12, 0.03, brilhante(ctx, '#ff4fa0', 1.5), 0, h * 0.22, d * 0.46));
    for (let i = 0; i < 3; i++) g.add(cilindro(0.025, 0.025, 0.03, brilhante(ctx, ['#ffd24a', '#ff5a5a', '#5aa0ff'][i], 1.6), -0.12 + i * 0.12, h * 0.1, d * 0.47, 10).rotateX(Math.PI / 2));
    luzDe(ctx, g, '#7affd8', 0.5, 2.4, 0, h * 0.6, d * 0.9);
    return g;
  },
  pool_table: ({ w, d, h }) => {
    const g = new THREE.Group();
    const madeira = mat('#4a2812', 0.5);
    g.add(caixa(w, 0.12, d, madeira, 0, h - 0.17, 0));
    g.add(caixa(w - 0.2, 0.03, d - 0.2, mat('#1f6a3a', 0.95), 0, h - 0.06, 0));
    // bordas
    g.add(caixa(w, 0.1, 0.1, madeira, 0, h - 0.1, d / 2 - 0.05));
    g.add(caixa(w, 0.1, 0.1, madeira, 0, h - 0.1, -d / 2 + 0.05));
    g.add(caixa(0.1, 0.1, d, madeira, w / 2 - 0.05, h - 0.1, 0));
    g.add(caixa(0.1, 0.1, d, madeira, -w / 2 + 0.05, h - 0.1, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(caixa(0.14, h - 0.17, 0.14, madeira, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12)));
    // buracos e bolas
    const preto = mat('#050505', 0.9);
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) g.add(cilindro(0.05, 0.05, 0.01, preto, sx * (w / 2 - 0.1), h - 0.04, sz * (d / 2 - 0.1), 10));
    const bolas = ['#f2e8c0', '#d8b020', '#2a4ad0', '#c02020', '#6a2a8a', '#e07a20', '#1f7a3a', '#7a1f1a', '#151515'];
    bolas.forEach((c, i) => g.add(esfera(0.028, new THREE.MeshStandardMaterial({ color: c, roughness: 0.2 }), -0.12 + (i % 3) * 0.06, h - 0.03 + 0.0, -0.4 + Math.floor(i / 3) * 0.06 + ((i % 3) - 1) * 0.03)));
    return g;
  },
  sofa: ({ w, d, h }) => {
    const g = new THREE.Group();
    const couro = mat('#7a1a1a', 0.55);
    g.add(caixa(w * 0.96, h * 0.55, d * 0.9, couro, 0, 0.05, 0));
    g.add(caixa(w * 0.96, h * 1.5, d * 0.22, couro, 0, 0.05, -d * 0.36));
    for (const sx of [-1, 1]) g.add(caixa(w * 0.08, h * 0.95, d * 0.9, couro, sx * w * 0.46, 0.05, 0));
    g.add(cilindro(0.015, 0.015, 0.06, mat('#151515'), 0, 0, 0, 6));
    return g;
  },
  armchair: ({ w, d, h }) => {
    const g = new THREE.Group();
    const c = mat('#8a1a1a', 0.65);
    g.add(caixa(w * 0.8, h * 0.8, d * 0.8, c, 0, 0.05, 0));
    g.add(caixa(w * 0.8, h * 2.0, d * 0.2, c, 0, 0.05, -d * 0.3));
    for (const sx of [-1, 1]) g.add(caixa(w * 0.14, h * 1.2, d * 0.8, c, sx * w * 0.38, 0.05, 0));
    return g;
  },
  plant: ({ w, h }) => {
    const g = new THREE.Group();
    g.add(cilindro(w * 0.24, w * 0.18, h * 0.3, mat('#6a3a22', 0.8), 0, 0, 0, 14));
    const folha = new THREE.MeshStandardMaterial({ color: '#2f7a3a', roughness: 0.6, emissive: '#10331a', emissiveIntensity: 0.3 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, h * 0.55, 6), folha);
      f.position.set(Math.cos(a) * 0.14, h * 0.58, Math.sin(a) * 0.14);
      f.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      f.castShadow = true;
      g.add(f);
    }
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, h * 0.6, 6), folha);
    c.position.set(0, h * 0.62, 0);
    c.castShadow = true;
    g.add(c);
    return g;
  },
  floor_lamp: (ctx) => {
    const { h } = ctx;
    const g = new THREE.Group();
    g.add(cilindro(0.15, 0.17, 0.03, mat('#222', 0.5, 0.6), 0, 0, 0, 14));
    g.add(cilindro(0.015, 0.015, h * 0.82, mat('#222', 0.5, 0.6), 0, 0.03, 0, 6));
    const sombra = new THREE.MeshStandardMaterial({ color: '#d8b070', emissive: '#ffb050', emissiveIntensity: 1.2, roughness: 0.8, side: THREE.DoubleSide });
    ctx.brilhos.push({ mat: sombra, base: 1.2 });
    const cupula = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.26, 14, 1, true), sombra);
    cupula.position.set(0, h * 0.88, 0);
    g.add(cupula);
    luzDe(ctx, g, '#ffb866', 1.4, 5.5, 0, h * 0.85, 0);
    return g;
  },
  ceiling_lamp: (ctx) => {
    const g = new THREE.Group();
    // pendurada no teto de 2,80 m (a origem do modelo é o ponto de prender no teto)
    const y = ALTURA_PAREDE - 0.05;
    g.add(cilindro(0.008, 0.008, 0.9, mat('#111'), 0, y - 0.1, 0, 4));
    const m = new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#ffcf80', emissiveIntensity: 1.6, roughness: 0.6, side: THREE.DoubleSide });
    ctx.brilhos.push({ mat: m, base: 1.6 });
    const cupula = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.24, 0.17, 16, 1, true), m);
    cupula.position.set(0, y - 0.18, 0);
    g.add(cupula);
    g.add(esfera(0.05, new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#fff0c0', emissiveIntensity: 2 }), 0, y - 0.22, 0));
    luzDe(ctx, g, '#ffc47a', 2.4, 7.5, 0, y - 0.3, 0, ctx.def.id === 'ceiling_lamp' && Math.round(ctx.w * 100) === 75 && false);
    return g;
  },
  candles: (ctx) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.05;
      g.add(cilindro(0.014, 0.014, 0.1 + i * 0.03, mat('#e8e0c8', 0.9), x, 0, i % 2 ? 0.02 : -0.02, 8));
      g.add(esfera(0.012, new THREE.MeshStandardMaterial({ color: '#ffd070', emissive: '#ffb030', emissiveIntensity: 3 }), x, 0.12 + i * 0.03, i % 2 ? 0.02 : -0.02));
    }
    luzDe(ctx, g, '#ff9a40', 0.5, 2.2, 0, 0.2, 0);
    return g;
  },
  barrel: ({ w, h }) => {
    const g = new THREE.Group();
    const c = mat('#7a4a22', 0.65);
    g.add(cilindro(w * 0.32, w * 0.3, h, c, 0, 0, 0, 18));
    for (const y of [0.1, h - 0.14]) g.add(cilindro(w * 0.335, w * 0.335, 0.025, mat('#2a2a2e', 0.4, 0.8), 0, y, 0, 18));
    return g;
  },
  crate: ({ w, d, h, def }) => {
    const g = new THREE.Group();
    if (def.id === 'trash_can') {
      g.add(cilindro(w * 0.26, w * 0.22, h, mat('#4a4e54', 0.4, 0.6), 0, 0, 0, 14));
      g.add(cilindro(w * 0.28, w * 0.28, 0.03, mat('#33363a', 0.4, 0.6), 0, h, 0, 14));
      return g;
    }
    const c = def.id === 'beer_crate' ? '#c0902a' : def.id === 'chair_stack' ? '#a02020' : '#8a5a30';
    g.add(caixa(w * 0.9, h, d * 0.9, mat(c, 0.7), 0, 0, 0));
    for (let i = 0; i < 3; i++) g.add(caixa(w * 0.92, 0.025, d * 0.92, mat('#3a2214', 0.8), 0, h * (0.2 + i * 0.3), 0));
    if (def.id === 'beer_crate') for (let i = 0; i < 4; i++) g.add(cilindro(0.03, 0.03, 0.12, mat('#3a2a10', 0.3), -0.2 + i * 0.13, h, 0.05, 8));
    return g;
  },
  nightstand: ({ w, d, h }) => {
    const g = new THREE.Group();
    g.add(caixa(w * 0.86, h, d * 0.8, mat('#5a3620', 0.65), 0, 0, 0));
    g.add(caixa(w * 0.9, 0.04, d * 0.84, mat('#8a5a30', 0.5), 0, h, 0));
    return g;
  },
  monitor: ({ w, h }) => {
    const g = new THREE.Group();
    g.add(caixa(w * 0.4, h * 0.7, w * 0.4, mat('#cfc8b0', 0.6), 0, 0.02, 0));
    g.add(caixa(w * 0.34, h * 0.5, 0.02, new THREE.MeshStandardMaterial({ color: '#04140a', emissive: '#40ff80', emissiveIntensity: 0.6 }), 0, h * 0.28, w * 0.21));
    return g;
  },
  mug: ({ def, h }) => {
    const g = new THREE.Group();
    if (def.id === 'ashtray') {
      g.add(cilindro(0.07, 0.065, h, mat('#2c2c30', 0.4, 0.4), 0, 0, 0, 12));
      return g;
    }
    if (def.id === 'beer_glass') {
      g.add(cilindro(0.032, 0.026, h, new THREE.MeshStandardMaterial({ color: '#d8a030', transparent: true, opacity: 0.8, roughness: 0.1, emissive: '#b07010', emissiveIntensity: 0.3 }), 0, 0, 0, 10));
      g.add(cilindro(0.033, 0.033, 0.03, mat('#f4ecd0', 0.9), 0, h - 0.015, 0, 10));
      return g;
    }
    g.add(cilindro(0.04, 0.036, h, mat('#c8bfa8', 0.5), 0, 0, 0, 10));
    return g;
  },
  papers: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = caixa(0.2, 0.004, 0.28, mat('#ece4cc', 0.9), (i - 1) * 0.03, i * 0.004, (i - 1) * 0.02);
      p.rotation.y = (i - 1) * 0.25;
      g.add(p);
    }
    return g;
  },
};

const extras: Record<string, string> = { stool_bar: 'stool_high', chair_bar: 'chair' };

function decal(w: number, d: number, texto: 'sujeira' | 'poca' | 'cabos', def: DefBar): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  if (texto === 'poca') {
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(20,14,10,0.7)');
    grad.addColorStop(0.7, 'rgba(30,22,14,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(64, 64, 58, 44, 0.4, 0, 7);
    g.fill();
  } else if (texto === 'cabos') {
    g.strokeStyle = 'rgba(8,8,10,0.85)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(4, 70);
    g.bezierCurveTo(40, 30, 70, 110, 124, 56);
    g.moveTo(4, 86);
    g.bezierCurveTo(50, 60, 80, 120, 124, 90);
    g.stroke();
  } else {
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(24,14,8,${0.04 + Math.random() * 0.08})`;
      g.beginPath();
      g.arc(20 + Math.random() * 88, 20 + Math.random() * 88, 3 + Math.random() * 14, 0, 7);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: texto === 'poca' ? 0.1 : 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  void def;
  return m;
}

function tapeteDe(def: DefBar, w: number, d: number): THREE.Mesh {
  const ornado = def.id === 'rug_ornate';
  const t = tapete(ornado ? '#5a1a22' : '#4a4034', ornado ? '#d8b060' : '#8a7858');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.97, d * 0.97), new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.receiveShadow = true;
  return m;
}

/** A reserva de um móvel (modelo de poucos polígonos na medida certa). */
export function reserva(def: DefBar, luzes: Luz[], brilhos: Resultado['brilhos']): THREE.Group {
  const w = def.width * CASA;
  const d = def.depth * CASA;
  const h = Math.max(def.alturaM, 0.02);
  const ctx: Ctx = { def, w, d, h, luzes, brilhos };
  const grupo = new THREE.Group();
  if (def.kind === 'rug') {
    grupo.add(tapeteDe(def, w, d));
    return grupo;
  }
  if (def.kind === 'dirt') {
    grupo.add(decal(w, d, def.id.startsWith('puddle') ? 'poca' : def.id.startsWith('cables') ? 'cabos' : 'sujeira', def));
    return grupo;
  }
  if (def.kind === 'stairs_down') return grupo;
  const k = construtores[def.kind] ?? construtores[extras[def.id] ?? ''];
  if (k) {
    grupo.add(k(ctx));
  } else {
    // sem construtor: a caixa da medida, com a cor do móvel
    grupo.add(caixa(w * 0.9, h, d * 0.9, mat(def.colors[0] ?? '#888888', 0.7)));
  }
  // a sombra mole de baixo dos móveis grandes
  if (h > 0.3) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, d * 1.5), new THREE.MeshBasicMaterial({ map: sombraMole(), transparent: true, depthWrite: false, opacity: 0.55 }));
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.006;
    grupo.add(s);
  }
  return grupo;
}

const loader = new GLTFLoader();

async function carregarGlb(defId: string): Promise<THREE.Object3D | null> {
  const url = `/prototipo3d/${LOWPOLY ? 'lowpoly' : 'modelos'}/${defId}.glb`;
  try {
    const r = await fetch(url, { headers: { Accept: 'model/gltf-binary' }, cache: 'no-store' });
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('html')) return null;
    const buf = await r.arrayBuffer();
    const gltf = await loader.parseAsync(buf, '');
    return gltf.scene;
  } catch {
    return null;
  }
}

/**
 * O contorno escuro de ~1 px dos móveis (HD-2D): uma "casca" invertida de cada peça, empurrada em PIXELS DE TELA (não em
 * metros), então fica fina em qualquer zoom. `uPx` = 0 apaga; `uRes` é o tamanho do quadro que está sendo desenhado.
 */
export const contorno = { uRes: { value: new THREE.Vector2(512, 384) }, uPx: { value: 1 }, uCor: { value: new THREE.Color('#150b07') } };
const matContorno = new THREE.ShaderMaterial({
  uniforms: contorno,
  side: THREE.BackSide,
  vertexShader: `
    uniform vec2 uRes; uniform float uPx;
    void main() {
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vec2 d = (projectionMatrix * vec4(n, 0.0)).xy;
      d = length(d) > 1e-5 ? normalize(d) : vec2(0.0);
      clip.xy += d * uPx * 2.0 / uRes * clip.w;
      gl_Position = clip;
    }`,
  fragmentShader: `uniform vec3 uCor; void main() { gl_FragColor = vec4(uCor, 1.0); }`,
});
const cascas = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function geometriaDaCasca(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let h = cascas.get(g);
  if (!h) {
    // só a posição, com os vértices colados e as normais médias: a casca não abre nas quinas
    const so = new THREE.BufferGeometry();
    so.setAttribute('position', g.getAttribute('position'));
    if (g.index) so.setIndex(g.index);
    h = mergeVertices(so, 1e-4);
    h.computeVertexNormals();
    cascas.set(g, h);
  }
  return h;
}
function comContorno(o: THREE.Object3D) {
  const malhas: THREE.Mesh[] = [];
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || (m as unknown as { userData: { casca?: boolean } }).userData.casca) return;
    const mt = m.material as THREE.Material;
    if (Array.isArray(mt) || mt.transparent) return;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    // tapete, mancha e fiação no chão não levam contorno
    if (bb.max.y - bb.min.y < 0.03) return;
    malhas.push(m);
  });
  for (const m of malhas) {
    const casca = new THREE.Mesh(geometriaDaCasca(m.geometry), matContorno);
    casca.userData.casca = true;
    casca.castShadow = false;
    casca.receiveShadow = false;
    casca.renderOrder = -1;
    m.add(casca);
  }
}

/**
 * Ajusta os materiais do modelo para a luz da cena. O que já vem com textura (o estilo do sprite isométrico) é respeitado:
 * filtro vizinho-mais-próximo (pixel nítido) e só ganha ajuste se vier brilhante demais; o que vem sem textura é forçado
 * ao fosco (rugosidade ≥ 0,68, metal ≤ 0,22, sem verniz nem reflexo do ambiente). O VIDRO é transparente e o EMISSIVO é moderado.
 */
/** Low-poly: tudo fosco e chapado (sem textura, sem metal, sem reflexo), flat shading; só o vidro e o emissivo mudam. */
function prepararLowpoly(o: THREE.Object3D, brilhos: Resultado['brilhos']) {
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const lista = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const base of lista) {
      const m = base as THREE.MeshStandardMaterial;
      if (!m || !('roughness' in m)) continue;
      const nome = (m.name ?? '').toUpperCase();
      m.flatShading = true;
      m.roughness = 1;
      m.metalness = 0;
      m.envMapIntensity = 0;
      m.map = null;
      const fis = m as unknown as THREE.MeshPhysicalMaterial;
      if ('specularIntensity' in fis) fis.specularIntensity = 0;
      if (nome.includes('VIDRO') || nome.includes('POCA')) {
        m.transparent = true;
        m.depthWrite = false;
        mesh.castShadow = false;
      } else if (nome.includes('EMISSIVO') || nome.includes('NEON') || nome.includes('CHAMA')) {
        m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.9);
        brilhos.push({ mat: m, base: m.emissiveIntensity });
      }
      m.needsUpdate = true;
    }
  });
}

function prepararGlb(o: THREE.Object3D, brilhos: Resultado['brilhos']) {
  if (LOWPOLY) return prepararLowpoly(o, brilhos);
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const lista = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const base of lista) {
      const m = base as THREE.MeshPhysicalMaterial;
      if (!m || !('roughness' in m)) continue;
      const nome = (m.name ?? '').toUpperCase();
      const pixel = (t: THREE.Texture | null) => {
        if (!t) return;
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.anisotropy = 1;
        t.needsUpdate = true;
      };
      pixel(m.map);
      pixel(m.emissiveMap);
      pixel(m.normalMap);
      if (nome.includes('VIDRO')) {
        m.transparent = true;
        m.opacity = Math.min(m.opacity, 0.35);
        m.depthWrite = false;
        m.roughness = 0.12;
        m.envMapIntensity = 0;
        continue;
      }
      m.envMap = null;
      m.envMapIntensity = 0;
      if (m.normalScale) m.normalScale.set(0.6, 0.6);
      const comTextura = !!m.map;
      if (nome.includes('EMISSIVO')) {
        if (!m.emissive || m.emissive.getHex() === 0) m.emissive = (m.color ?? new THREE.Color('#ffd080')).clone();
        m.emissiveIntensity = Math.min(Math.max(m.emissiveIntensity, 0.55), 0.8);
        m.roughness = Math.max(m.roughness, 0.6);
        m.metalness = 0;
        brilhos.push({ mat: m, base: m.emissiveIntensity });
        continue;
      }
      // textura que já veio fosca fica como veio; o resto é forçado
      const foscoJa = comTextura && m.roughness >= 0.65 && m.metalness <= 0.3;
      if (!foscoJa) {
        if (!comTextura) {
          m.roughnessMap = null;
          m.metalnessMap = null;
        }
        m.roughness = Math.max(m.roughness ?? 1, comTextura ? 0.7 : 0.68);
        m.metalness = Math.min(m.metalness ?? 0, comTextura ? 0.2 : 0.22);
      }
      if (m.isMeshPhysicalMaterial) {
        m.clearcoat = 0;
        m.clearcoatRoughness = 1;
        m.sheen = 0;
        m.iridescence = 0;
        m.specularIntensity = 0.3;
        m.transmission = 0;
      }
      // um emissivo que veio sem a marca do nome vira só um toque, nunca uma fonte de luz
      if (m.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.6);
      m.needsUpdate = true;
    }
  });
  comContorno(o);
}

/** O halo suave de uma lâmpada (um brilho redondo que some nas bordas), no lugar de uma superfície estourada. */
let texHalo: THREE.CanvasTexture | null = null;
function halo(cor: string, tamanho: number, opacidade: number, x: number, y: number, z: number): THREE.Sprite {
  if (!texHalo) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.32)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.07)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    texHalo = new THREE.CanvasTexture(c);
    texHalo.colorSpace = THREE.SRGBColorSpace;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: cor, transparent: true, opacity: opacidade, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sp.scale.set(tamanho, tamanho, 1);
  sp.position.set(x, y, z);
  return sp;
}

// ---------------------------------------------------------------- os itens em cima dos móveis
// O `z` que o jogo guarda é em unidades do jogo, de outro modelo de móvel: o copo "a 1,8" não cai na altura do tampo do
// balcão de verdade (10/11, o Felipe: "os itens nas mesas estão flutuando, quero eles NA mesa"). A altura vem do que está
// embaixo: um raio para baixo, sobre vários pontos da casa, acha o tampo REAL do modelo carregado (a moda das alturas, que
// ignora garrafas e outros enfeites no meio) e a base do item (o mínimo da malha) pousa exatamente ali.
export interface Entrada {
  m: MobiBar;
  def: DefBar;
  g: THREE.Group;
  sx: number;
  sy: number;
}

/** Os tipos que nunca seguram nada (chão, luz, tapete e sujeira). */
const NAO_APOIA = new Set(['rug', 'dirt', 'ceiling_lamp', 'floor_lamp', 'stairs_down']);

/** As malhas sólidas de um grupo: sem o contorno, o halo e a sombra mole. */
function malhasSolidas(o: THREE.Object3D): THREE.Mesh[] {
  const lista: THREE.Mesh[] = [];
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || (m as unknown as { isSprite?: boolean }).isSprite) return;
    if ((m.userData as { casca?: boolean }).casca) return;
    const mt = m.material as THREE.Material | THREE.Material[];
    const um = Array.isArray(mt) ? mt[0] : mt;
    if (um && (um as THREE.MeshBasicMaterial).isMeshBasicMaterial) return; // a sombra mole e os brilhos de papel
    lista.push(m);
  });
  return lista;
}

/** O ponto mais baixo (y do mundo) de um item, medido nas malhas sólidas. */
function baseDe(g: THREE.Object3D): number {
  g.updateWorldMatrix(true, true);
  let min = Infinity;
  const caixa = new THREE.Box3();
  for (const m of malhasSolidas(g)) {
    caixa.setFromObject(m, true);
    if (!caixa.isEmpty()) min = Math.min(min, caixa.min.y);
  }
  return Number.isFinite(min) ? min : g.position.y;
}

const raio = new THREE.Raycaster();

/** O tampo em que o item pousa (y do mundo), ou null se não há nada embaixo dele. */
function topoDoApoio(e: Entrada, candidatos: Entrada[]): { topo: number; faixas: [number, number][]; apoios: string[] } | null {
  const cx = e.g.position.x;
  const cz = e.g.position.z;
  const apoios = candidatos.filter((c) => {
    if (c === e || NAO_APOIA.has(c.def.kind)) return false;
    if (c.m.z >= e.m.z - 1e-6 && c.m.z > 0.01) return false;
    return cx >= c.m.x * CASA - 1e-6 && cx <= (c.m.x + c.sx) * CASA + 1e-6 && cz >= c.m.y * CASA - 1e-6 && cz <= (c.m.y + c.sy) * CASA + 1e-6;
  });
  if (!apoios.length) return null;
  const malhas = apoios.flatMap((c) => malhasSolidas(c.g));
  const meia = Math.min(0.26, (Math.min(e.sx, e.sy) * CASA) / 2 - 0.04);
  const alturas: number[] = [];
  const passos = 5;
  for (let i = 0; i < passos; i++) {
    for (let k = 0; k < passos; k++) {
      const x = cx + (i / (passos - 1) - 0.5) * 2 * meia;
      const z = cz + (k / (passos - 1) - 0.5) * 2 * meia;
      raio.set(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
      raio.far = 8;
      const acertos = raio.intersectObjects(malhas, false);
      if (acertos.length) alturas.push(acertos[0].point.y);
    }
  }
  if (!alturas.length) return null;
  const nomes = apoios.map((c) => `${c.def.id}#${c.m.id}`);
  // as alturas em faixas de 2 cm. O tampo é a faixa mais ALTA que cobre uma parte boa da casa (as garrafas e os enfeites no
  // meio cobrem pouco e ficam de fora; o fundo de um engradado, que fica embaixo da borda, também)
  const faixas = new Map<number, number[]>();
  for (const y of alturas) {
    const f = Math.round(y / 0.02);
    (faixas.get(f) ?? faixas.set(f, []).get(f)!).push(y);
  }
  const lista = [...faixas.entries()].sort((a, b) => a[0] - b[0]);
  const minimo = Math.max(2, Math.ceil(alturas.length * 0.12));
  let escolhida = [...lista].reverse().find(([, ys]) => ys.length >= minimo)?.[1];
  if (!escolhida) escolhida = [...lista].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0][1];
  return {
    topo: escolhida.reduce((a, b) => a + b, 0) / escolhida.length,
    faixas: lista.map(([f, ys]) => [Math.round(f * 2) / 100, ys.length] as [number, number]),
    apoios: nomes,
  };
}

/** A poça de luz quente que uma lâmpada deixa no chão (low-poly): um círculo aditivo que some nas bordas, sem custo de luz. */
let texPoca: THREE.CanvasTexture | null = null;
function pocaDeLuz(yChao: number, raio = 1.5): THREE.Mesh {
  if (!texPoca) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,214,140,0.28)');
    gr.addColorStop(0.55, 'rgba(255,200,120,0.1)');
    gr.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    texPoca = new THREE.CanvasTexture(c);
    texPoca.colorSpace = THREE.SRGBColorSpace;
  }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(raio * 2, raio * 2), new THREE.MeshBasicMaterial({ map: texPoca, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  p.rotation.x = -Math.PI / 2;
  p.position.y = yChao + 0.015;
  p.renderOrder = 2;
  return p;
}

export async function montarMoveis(dados: DadosBar): Promise<Resultado> {
  const grupo = new THREE.Group();
  const luzes: Luz[] = [];
  const brilhos: Resultado['brilhos'] = [];
  const modelos = new Map<string, THREE.Object3D | null>();
  await Promise.all(
    [...new Set(dados.mobis.map((m) => m.defId))].map(async (id) => {
      modelos.set(id, await carregarGlb(id));
    }),
  );
  let glb = 0;
  const reservas = new Set<string>();
  const Z = dados.Z_PER_M;
  const entradas: Entrada[] = [];
  let lampadas = 0;
  for (const m of dados.mobis) {
    const def = dados.defs[m.defId];
    if (!def) continue;
    const { sx, sy } = pegada(def, m.rot);
    const g = new THREE.Group();
    g.position.set((m.x + sx / 2) * CASA, m.z / Z, (m.y + sy / 2) * CASA);
    g.rotation.y = anguloDoGiro(m.rot);
    const modelo = modelos.get(m.defId);
    if (modelo) {
      const c = modelo.clone(true);
      prepararGlb(c, brilhos);
      // a luminária do teto: o modelo tem a origem no ponto de prender, então sobe até o teto do bar
      if (def.kind === 'ceiling_lamp') c.position.y = ALTURA_PAREDE;
      g.add(c);
      glb++;
      if (LOWPOLY) {
        // low-poly: ZERO luzes de ponto (barato em tablet). O calor vem da hemisférica + direcional e do brilho dos emissivos;
        // cada lâmpada ganha só uma poça de luz no chão (um desenho aditivo) e um halo
        if (def.kind === 'ceiling_lamp') {
          g.add(halo('#ffcf8a', 0.9, 0.5, 0, ALTURA_PAREDE - 0.55, 0));
          g.add(pocaDeLuz(-g.position.y));
        } else if (def.kind === 'floor_lamp') {
          g.add(halo('#ffbf70', 0.8, 0.45, 0, def.alturaM * 0.86, 0));
          g.add(pocaDeLuz(-g.position.y, 1.1));
        } else if (def.kind === 'candles') g.add(halo('#ffa850', 0.35, 0.5, 0, 0.17, 0));
      } else {
      // o modelo não traz luz: as lâmpadas, as velas e o brilho das geladeiras vêm do mesmo lugar da reserva
      const luzesDaReserva: THREE.PointLight[] = [];
      reserva(def, luzes, []).traverse((o) => {
        if ((o as THREE.PointLight).isPointLight) luzesDaReserva.push(o as THREE.PointLight);
      });
      for (const l of luzesDaReserva) g.add(l);
      if (def.kind === 'ceiling_lamp') g.add(halo('#ffcf8a', 1.05, 0.26, 0, ALTURA_PAREDE - 0.55, 0));
      else if (def.kind === 'floor_lamp') g.add(halo('#ffbf70', 0.8, 0.3, 0, def.alturaM * 0.86, 0));
      else if (def.kind === 'candles') g.add(halo('#ffa850', 0.4, 0.4, 0, 0.17, 0));
      if (def.kind === 'ceiling_lamp') {
        lampadas++;
        const luz = luzes[luzes.length - 1];
        if (luz && [1, 3, 5].includes(lampadas)) {
          luz.luz.castShadow = true;
          luz.luz.shadow.mapSize.set(1024, 1024);
          luz.luz.shadow.bias = -0.0006;
          luz.luz.shadow.normalBias = 0.03;
          luz.luz.shadow.radius = 6;
        }
      }
      }
    } else {
      reservas.add(m.defId);
      // a lâmpada do teto que mais ilumina faz sombra
      const r = reserva(def, luzes, brilhos);
      if (def.kind === 'ceiling_lamp') {
        lampadas++;
        const luz = luzes[luzes.length - 1];
        if (luz && [1, 3, 5].includes(lampadas)) {
          luz.luz.castShadow = true;
          luz.luz.shadow.mapSize.set(1024, 1024);
          luz.luz.shadow.bias = -0.0006;
          luz.luz.shadow.normalBias = 0.03;
          luz.luz.shadow.radius = 6;
        }
      }
      g.add(r);
    }
    grupo.add(g);
    entradas.push({ m, def, g, sx, sy });
  }
  // os itens em cima de outros móveis (copo, caneca, cinzeiro, papéis, velas, computador, jarra, caixa empilhada...): do mais
  // baixo para o mais alto, para o que está embaixo já estar no lugar quando o de cima for medido
  grupo.updateMatrixWorld(true);
  const diag: Resultado['diag'] = [];
  const prontos = entradas.filter((e) => e.m.z <= 0.01);
  const emCima = entradas.filter((e) => e.m.z > 0.01 && !NAO_APOIA.has(e.def.kind)).sort((a, b) => a.m.z - b.m.z || a.m.id - b.m.id);
  for (const e of emCima) {
    const achou = topoDoApoio(e, prontos);
    if (achou) {
      // a base do item no tampo, centrada: se a casa é a do apoio e ele cobre uma casa só, o centro da casa já é o do apoio
      e.g.position.y = 0;
      const base = baseDe(e.g);
      e.g.position.y = achou.topo - base;
      e.g.updateMatrixWorld(true);
    }
    diag.push({ id: e.m.id, def: e.def.id, apoios: achou?.apoios ?? [], topo: achou ? Math.round(achou.topo * 1000) / 1000 : null, faixas: achou?.faixas ?? [], y: Math.round(e.g.position.y * 1000) / 1000 });
    prontos.push(e);
  }
  return { grupo, luzes, brilhos, glb, reserva: [...reservas], diag, entradas };
}

export type { MobiBar };
