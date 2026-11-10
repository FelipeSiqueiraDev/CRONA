/**
 * A casca do Bar em 3D: o piso e as duas paredes do fundo (a da esquerda tem a porta e as janelas da rua), os itens de
 * parede, a rua lá fora e os prédios de janelas acesas ao redor. A frente e a direita ficam abertas, como na mesa.
 */
import * as THREE from 'three';
import { CASA, pegada, type DadosBar, type ParedeBar } from './dados';
import { noiteNaJanela, PAREDE_ALTURA, PAREDE_LARGURA, parede as texParede, PISO_LADO, pisoMadeira, predio, quadro, sorteio } from './texturas';

/** O pé-direito do bar (10/11, o Felipe: "agora mais real"): 2,80 m, paredes de 15 cm. */
export const ALTURA_PAREDE = PAREDE_ALTURA;
const ESPESSURA = 0.15;
const PX_POR_M = 52;

export interface Casca {
  grupo: THREE.Group;
  /** o que muda com a hora: o brilho das janelas dos prédios e da rua */
  janelasPredios: THREE.MeshStandardMaterial[];
  luzesDaRua: { luz: THREE.PointLight; base: number }[];
  luzesDeParede: { luz: THREE.PointLight; base: number }[];
  brilhosDeParede: { mat: THREE.MeshStandardMaterial; base: number }[];
  ventiladores: THREE.Object3D[];
  /** o clarão do relâmpago que entra pelas janelas (luzes de dentro, azuladas) e os vidros que acendem com ele */
  luzesJanela: THREE.PointLight[];
  vidros: THREE.MeshBasicMaterial[];
  /** o retângulo do piso, em metros: x0, z0, x1, z1 */
  piso: [number, number, number, number];
  /** a abertura da porta, em metros (z0..z1 na parede esquerda) */
  porta: { z0: number; z1: number };
}

/** A madeira escura das molduras (rodapé, guarda-cadeira, moldura de teto, batentes). */
const MAD_ESCURA = new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.88, metalness: 0 });
const MAD_MEDIA = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.85, metalness: 0 });

/** O piso: um quadrado por casa que não é vazia, com a textura contínua. */
function pisoDe(dados: DadosBar, buracos: Set<string>): { mesh: THREE.Mesh; caixa: [number, number, number, number] } {
  const linhas = dados.cena.heightmap.split('\n').map((l) => l.trim());
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let x0 = 1e9;
  let z0 = 1e9;
  let x1 = -1e9;
  let z1 = -1e9;
  linhas.forEach((linha, y) => {
    [...linha].forEach((c, x) => {
      if (c.toLowerCase() === 'x') return;
      // o buraco da escada secreta fica sem chão (o modelo dela desce por ali)
      const vazio = buracos.has(`${x},${y}`);
      // a casa da porta (x = 0) fica de fora como soleira: só o que está dentro da parede entra no piso grande
      const X = x * CASA;
      const Z = y * CASA;
      const n = pos.length / 3;
      if (!vazio) {
        pos.push(X, 0, Z, X + CASA, 0, Z, X + CASA, 0, Z + CASA, X, 0, Z + CASA);
        const s = 1 / PISO_LADO;
        uv.push(X * s, Z * s, (X + CASA) * s, Z * s, (X + CASA) * s, (Z + CASA) * s, X * s, (Z + CASA) * s);
        idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
      }
      x0 = Math.min(x0, X);
      z0 = Math.min(z0, Z);
      x1 = Math.max(x1, X + CASA);
      z1 = Math.max(z1, Z + CASA);
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const piso = pisoMadeira();
  piso.anisotropy = 8;
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: piso, roughness: 0.94, metalness: 0, color: '#d8c0a0' }));
  mesh.receiveShadow = true;
  return { mesh, caixa: [x0, z0, x1, z1] };
}

/** Uma caixa de parede entre dois pontos do chão (x0,z0)-(x1,z1) e duas alturas; a face de dentro leva a textura. */
function paredeCaixa(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, interna: 'x' | 'z', mats: { dentro: THREE.Material; fora: THREE.Material }): THREE.Mesh {
  const w = Math.abs(x1 - x0);
  const d = Math.abs(z1 - z0);
  const h = y1 - y0;
  const geo = new THREE.BoxGeometry(w, h, d);
  // ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z
  const lista: THREE.Material[] = [mats.fora, mats.fora, mats.fora, mats.fora, mats.fora, mats.fora];
  if (interna === 'x') lista[0] = mats.dentro;
  else lista[4] = mats.dentro;
  const m = new THREE.Mesh(geo, lista);
  m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function texNeon(texto: string, cor: string): THREE.CanvasTexture {
  const [c, g] = canvas(512, 200);
  g.clearRect(0, 0, 512, 200);
  g.font = '700 84px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = cor;
  g.shadowBlur = 28;
  g.fillStyle = cor;
  g.fillText(texto, 256, 70);
  g.fillText(texto, 256, 70);
  g.shadowBlur = 0;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.strokeText(texto, 256, 70);
  g.shadowColor = cor;
  g.shadowBlur = 20;
  g.font = '600 52px "Segoe UI", sans-serif';
  g.fillStyle = cor;
  g.fillText('BAR', 256, 148);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texAlvo(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const aneis = ['#141414', '#e8dcc0', '#b3261e', '#e8dcc0', '#1f6a3a', '#141414'];
  aneis.forEach((cor, i) => {
    g.fillStyle = cor;
    g.beginPath();
    g.arc(64, 64, 62 - i * 10, 0, 7);
    g.fill();
  });
  g.fillStyle = '#b3261e';
  g.beginPath();
  g.arc(64, 64, 5, 0, 7);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texRelogio(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#2a2420';
  g.beginPath();
  g.arc(64, 64, 62, 0, 7);
  g.fill();
  g.fillStyle = '#e4dcc4';
  g.beginPath();
  g.arc(64, 64, 52, 0, 7);
  g.fill();
  g.strokeStyle = '#2a2420';
  g.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
    g.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
    g.stroke();
  }
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64, 28);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(88, 74);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MAT_CRU = new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 0.9 });

function itemDeParede(it: ParedeBar, dados: DadosBar, casca: Casca): THREE.Object3D | null {
  const def = dados.defsParede[it.defId];
  if (!def) return null;
  // o tamanho de verdade de cada peça (o desenho do jogo é miúdo/chibi): o quadro de 80 × 60 cm, o letreiro de 1 m, o relógio
  // de 34 cm, a arandela de 16 × 30 cm, a TV de 42" (95 × 55 cm), o alvo de dardos de 46 cm
  const REAL: Record<string, [number, number]> = { painting: [0.8, 0.6], neon: [1.05, 0.42], clock: [0.34, 0.34], sconce: [0.16, 0.3], tv: [0.95, 0.55], fan: [0.45, 0.45], dartboard: [0.46, 0.46] };
  const [w, h] = REAL[def.kind] ?? [def.w / PX_POR_M, def.h / PX_POR_M];
  const g = new THREE.Group();
  const frente = new THREE.Group();
  g.add(frente);
  const brilho = (cor: string, base: number) => {
    const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: cor, emissiveIntensity: base, roughness: 0.6 });
    casca.brilhosDeParede.push({ mat: m, base });
    return m;
  };
  switch (def.kind) {
    case 'painting': {
      const moldura = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), new THREE.MeshStandardMaterial({ color: '#b8903a', roughness: 0.45, metalness: 0.3 }));
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.84, h * 0.82), new THREE.MeshStandardMaterial({ map: quadro(it.id), roughness: 0.8 }));
      tela.position.z = 0.025;
      frente.add(moldura, tela);
      break;
    }
    case 'neon': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), new THREE.MeshStandardMaterial({ color: '#1a0a14', roughness: 0.8 }));
      const t = texNeon('SUVACO SECO', '#ff4f9a');
      const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 1.7, transparent: true, color: '#ffffff' });
      casca.brilhosDeParede.push({ mat: m, base: 1.7 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), m);
      pl.position.z = 0.02;
      frente.add(base, pl);
      const luz = new THREE.PointLight('#ff4f9a', 1.5, 6, 1.6);
      luz.position.set(0, 0, 0.45);
      frente.add(luz);
      casca.luzesDeParede.push({ luz, base: 1.5 });
      break;
    }
    case 'clock': {
      const m = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 28), new THREE.MeshStandardMaterial({ map: texRelogio(), roughness: 0.5 }));
      m.position.z = 0.02;
      frente.add(m);
      break;
    }
    case 'dartboard': {
      const m = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 28), new THREE.MeshStandardMaterial({ map: texAlvo(), roughness: 0.9 }));
      m.position.z = 0.025;
      frente.add(m);
      break;
    }
    case 'tv': {
      frente.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), new THREE.MeshStandardMaterial({ color: '#34363a', roughness: 0.6 })));
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, h * 0.72), new THREE.MeshStandardMaterial({ color: '#06140a', emissive: '#4cff80', emissiveIntensity: 0.55, roughness: 0.3 }));
      tela.position.set(0, h * 0.04, 0.115);
      casca.brilhosDeParede.push({ mat: tela.material as THREE.MeshStandardMaterial, base: 0.55 });
      frente.add(tela);
      break;
    }
    case 'fan': {
      const eixo = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const pa = new THREE.Mesh(new THREE.BoxGeometry(w * 0.12, h * 0.4, 0.008), new THREE.MeshStandardMaterial({ color: '#d8c8a0', roughness: 0.6 }));
        pa.position.y = h * 0.22;
        const bra = new THREE.Group();
        bra.rotation.z = (i / 4) * Math.PI * 2;
        bra.add(pa);
        eixo.add(bra);
      }
      eixo.position.z = 0.1;
      frente.add(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.05, w * 0.05, 0.14, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a8e92', metalness: 0.6, roughness: 0.4 })), eixo);
      casca.ventiladores.push(eixo);
      break;
    }
    case 'sconce': {
      frente.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.5, 0.06), new THREE.MeshStandardMaterial({ color: '#8a6a2a', metalness: 0.5, roughness: 0.4 })));
      for (const dx of [-0.06, 0.06]) {
        const vela = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#e8e0c8' }));
        vela.position.set(dx, h * 0.34, 0.08);
        const fogo = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshStandardMaterial({ color: '#ffd070', emissive: '#ffa030', emissiveIntensity: 3 }));
        fogo.position.set(dx, h * 0.34 + 0.09, 0.08);
        frente.add(vela, fogo);
      }
      const luz = new THREE.PointLight('#ff9a40', 0.7, 3.4, 1.7);
      luz.position.set(0, h * 0.45, 0.35);
      frente.add(luz);
      casca.luzesDeParede.push({ luz, base: 0.7 });
      break;
    }
    default:
      frente.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), new THREE.MeshStandardMaterial({ color: def.colors[0] ?? '#888' })));
  }
  frente.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = false;
  });
  // a altura: a que o jogo guarda, sem encostar na moldura de teto (8 cm); o alvo de dardos tem o centro a 1,73 m
  const y = def.kind === 'dartboard' ? 1.73 : Math.min(it.z / dados.Z_PER_M + h / 2, ALTURA_PAREDE - 0.14 - h / 2);
  if (it.wall === 'l') {
    g.position.set(it.plane * CASA + 0.01 + ESPESSURA * 0.0, y, it.pos * CASA);
    g.rotation.y = Math.PI / 2;
  } else {
    g.position.set(it.pos * CASA, y, it.plane * CASA + 0.01);
  }
  return g;
}

/** Janela: moldura, vidro escuro com a noite do outro lado (e o reflexo leve). */
/** O vidro de noite sem cidade atrás: escuro, com um brilho leve que sobe pelo meio. */
function vidroEscuro(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#05070e');
  grad.addColorStop(0.7, '#0a1224');
  grad.addColorStop(1, '#16223c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(160,190,255,0.07)';
  g.beginPath();
  g.moveTo(8, 0);
  g.lineTo(28, 0);
  g.lineTo(6, 128);
  g.lineTo(0, 128);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function janela(z0: number, z1: number, y0: number, y1: number, xParede: number, cidade: boolean, casca: Casca): THREE.Group {
  const g = new THREE.Group();
  const w = z1 - z0;
  const h = y1 - y0;
  const cz = (z0 + z1) / 2;
  const cy = (y0 + y1) / 2;
  const mad = new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.78 });
  const xMeio = xParede - ESPESSURA / 2;
  const peca = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material = mad) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    g.add(b);
  };
  // o caixilho dentro da espessura da parede: o quadro (5 cm), o montante do meio e a travessa
  const q = 0.05;
  peca(0.05, h, q, xMeio, cy, z0 + q / 2);
  peca(0.05, h, q, xMeio, cy, z1 - q / 2);
  peca(0.05, q, w, xMeio, y1 - q / 2, cz);
  peca(0.05, q, w, xMeio, y0 + q / 2, cz);
  peca(0.04, h, 0.03, xMeio, cy, cz);
  peca(0.04, 0.03, w, xMeio, y0 + h * 0.62, cz);
  // a guarnição por dentro (7 cm de cada lado, 1,5 cm de relevo) e o peitoril que avança
  const gu = 0.07;
  peca(0.02, h + 2 * gu, gu, xParede + 0.01, cy, z0 - gu / 2, MAD_ESCURA);
  peca(0.02, h + 2 * gu, gu, xParede + 0.01, cy, z1 + gu / 2, MAD_ESCURA);
  peca(0.02, gu, w, xParede + 0.01, y1 + gu / 2, cz, MAD_ESCURA);
  peca(0.09, 0.035, w + 2 * gu + 0.06, xParede + 0.045, y0 - 0.0175, cz, MAD_MEDIA);
  const noite = cidade ? noiteNaJanela() : vidroEscuro();
  const matVidro = new THREE.MeshBasicMaterial({ map: noite, transparent: true, opacity: 0.92, toneMapped: false });
  casca.vidros.push(matVidro);
  const vidro = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * q, h - 2 * q), matVidro);
  // o clarão do relâmpago entra por aqui (a luz fica dentro do salão, perto do vidro, e só acende no clarão)
  const clarao = new THREE.PointLight('#9bb8ff', 0, 8, 1.6);
  clarao.position.set(xParede + 0.7, cy, cz);
  g.add(clarao);
  casca.luzesJanela.push(clarao);
  vidro.rotation.y = Math.PI / 2;
  vidro.position.set(xMeio - 0.015, cy, cz);
  g.add(vidro);
  const reflexo = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * q, h - 2 * q), new THREE.MeshStandardMaterial({ color: '#8ab0ff', transparent: true, opacity: 0.08, roughness: 0.2, metalness: 0.2 }));
  reflexo.rotation.y = Math.PI / 2;
  reflexo.position.set(xMeio + 0.02, cy, cz);
  g.add(reflexo);
  return g;
}

function ruaEPredios(casca: Casca, x0: number, z0: number, x1: number, z1: number) {
  const g = casca.grupo;
  // o chão da rua e da calçada
  const asfalto = (() => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(0, 0, 256, 256);
    const r = sorteio(3);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.05})`;
      ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 12);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const rua = new THREE.Mesh(new THREE.PlaneGeometry(14, 60), new THREE.MeshStandardMaterial({ map: asfalto, roughness: 0.92, metalness: 0 }));
  rua.rotation.x = -Math.PI / 2;
  rua.position.set(x0 - 8.2, -0.02, (z0 + z1) / 2 + 6);
  rua.receiveShadow = true;
  g.add(rua);
  const calcada = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 60), new THREE.MeshStandardMaterial({ color: '#4a4850', roughness: 0.9 }));
  calcada.position.set(x0 - 0.9, -0.07, (z0 + z1) / 2 + 6);
  calcada.receiveShadow = true;
  g.add(calcada);
  // o beco atrás
  const beco = new THREE.Mesh(new THREE.PlaneGeometry(60, 10), new THREE.MeshStandardMaterial({ color: '#16171c', roughness: 0.7 }));
  beco.rotation.x = -Math.PI / 2;
  beco.position.set((x0 + x1) / 2 + 6, -0.02, z0 - 5.2);
  g.add(beco);

  // os prédios (cada um com a sua textura de janelas)
  const r = sorteio(77);
  const alvos: { x: number; z: number; w: number; d: number; h: number }[] = [];
  // do outro lado da rua (à esquerda da parede esquerda)
  for (let z = z0 - 12; z < z1 + 26; ) {
    const w = 5 + r() * 4;
    const d = 6 + r() * 4;
    alvos.push({ x: x0 - 17 - d / 2 + r() * 2, z: z + w / 2, w: d, d: w, h: 12 + r() * 34 });
    z += w + 0.6 + r() * 0.8;
  }
  // atrás do beco
  for (let x = x0 - 8; x < x1 + 26; ) {
    const w = 5 + r() * 4;
    const d = 6 + r() * 4;
    alvos.push({ x: x + w / 2, z: z0 - 12 - d / 2 - r() * 2, w, d, h: 12 + r() * 36 });
    x += w + 0.6 + r() * 0.8;
  }
  alvos.forEach((a, i) => {
    const { mapa, emissivo } = predio(40 + i);
    mapa.repeat.set(Math.max(1, Math.round(a.w / 2.4)), Math.max(1, Math.round(a.h / 3.4)));
    emissivo.repeat.copy(mapa.repeat);
    const m = new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: emissivo, emissive: '#ffffff', emissiveIntensity: 1.5, roughness: 0.9 });
    casca.janelasPredios.push(m);
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(a.w, a.h, a.d), m);
    caixa.position.set(a.x, a.h / 2 - 0.05, a.z);
    g.add(caixa);
  });
  // o poste da rua
  const poste = new THREE.Group();
  poste.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8), new THREE.MeshStandardMaterial({ color: '#202026', metalness: 0.6, roughness: 0.5 })).translateY(2.3));
  const braco = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: '#202026', metalness: 0.6 }));
  braco.position.set(0.4, 4.5, 0);
  poste.add(braco);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff4cc', emissive: '#ffd890', emissiveIntensity: 3 }));
  lamp.position.set(0.85, 4.42, 0);
  poste.add(lamp);
  casca.janelasPredios.push(lamp.material as THREE.MeshStandardMaterial);
  const luz = new THREE.PointLight('#ffd08a', 14, 14, 1.4);
  luz.position.set(0.85, 4.2, 0);
  poste.add(luz);
  casca.luzesDaRua.push({ luz, base: 14 });
  poste.position.set(x0 - 1.4, 0, z0 + 9.6);
  g.add(poste);
}

export function montarCasca(dados: DadosBar, cidade = false): Casca {
  const grupo = new THREE.Group();
  const casca: Casca = { grupo, janelasPredios: [], luzesDaRua: [], luzesDeParede: [], brilhosDeParede: [], ventiladores: [], luzesJanela: [], vidros: [], piso: [0, 0, 0, 0], porta: { z0: 0, z1: 0 } };
  // o buraco da escada secreta: as casas dela ficam sem chão
  const buracos = new Set<string>();
  for (const m of dados.mobis) {
    const def = dados.defs[m.defId];
    if (!def || def.kind !== 'stairs_down') continue;
    const { sx, sy } = pegada(def, m.rot);
    for (let dx = 0; dx < sx; dx++) for (let dy = 0; dy < sy; dy++) buracos.add(`${m.x + dx},${m.y + dy}`);
  }
  const { mesh, caixa } = pisoDe(dados, buracos);
  grupo.add(mesh);
  // a parede da esquerda fica no plano x = 1 casa (a coluna 0 é a soleira da porta); a do fundo, em y = 0
  const xEsq = CASA;
  const [, zIni, xFim, zFim] = caixa;
  casca.piso = [xEsq, zIni, xFim, zFim];
  // a porta de 0,90 × 2,10 m (o vão de 0,96 × 2,13 com o batente de 3 cm), centrada na casa da porta
  const porta = dados.cena.door;
  const zCentroPorta = (porta.y + 0.5) * CASA;
  const zPortaIni = zCentroPorta - 0.48;
  const zPortaFim = zCentroPorta + 0.48;
  const ALT_PORTA = 2.13;
  casca.porta = { z0: zPortaIni, z1: zPortaFim };

  // O papel de parede e o lambri correm contínuos pela parede inteira: cada pedaço (acima de uma porta, abaixo de uma janela...)
  // pega da textura o trecho que é dele (a posição no chão e a altura), com as emendas alinhadas.
  const base = texParede();
  const matParede = (face: 'x' | 'z', a: number, b: number, y0: number, y1: number) => {
    const t = base.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    if (face === 'x') {
      // a face de dentro da parede esquerda: o u corre de z = b (u = 0) a z = a (u = 1)
      t.repeat.set(-(b - a) / PAREDE_LARGURA, (y1 - y0) / ALTURA_PAREDE);
      t.offset.set(b / PAREDE_LARGURA, y0 / ALTURA_PAREDE);
    } else {
      // a do fundo: o u corre de x = a a x = b
      t.repeat.set((b - a) / PAREDE_LARGURA, (y1 - y0) / ALTURA_PAREDE);
      t.offset.set(a / PAREDE_LARGURA, y0 / ALTURA_PAREDE);
    }
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.97, metalness: 0 });
  };
  const fora = MAT_CRU;
  const JANELAS = [
    { z0: 1.325, z1: 2.525 },
    { z0: 9.525, z1: 10.725 },
  ];
  // peitoril a 1,00 m, janela de 1,40 m de altura (até 2,40 m)
  const Y_PEITORIL = 1.0;
  const Y_TOPO_JANELA = 2.4;
  const abrir = [{ z0: zPortaIni, z1: zPortaFim, y0: 0, y1: ALT_PORTA, porta: true }, ...JANELAS.map((j) => ({ ...j, y0: Y_PEITORIL, y1: Y_TOPO_JANELA, porta: false }))].sort((a, b) => a.z0 - b.z0);
  const cortes = [zIni, ...abrir.flatMap((o) => [o.z0, o.z1]), zFim];
  for (let i = 0; i < cortes.length - 1; i++) {
    const a = cortes[i];
    const b = cortes[i + 1];
    if (b - a < 0.001) continue;
    const meio = (a + b) / 2;
    const o = abrir.find((q) => meio > q.z0 && meio < q.z1);
    if (!o) {
      grupo.add(paredeCaixa(xEsq - ESPESSURA, a, xEsq, b, 0, ALTURA_PAREDE, 'x', { dentro: matParede('x', a, b, 0, ALTURA_PAREDE), fora }));
    } else {
      if (o.y0 > 0.01) grupo.add(paredeCaixa(xEsq - ESPESSURA, a, xEsq, b, 0, o.y0, 'x', { dentro: matParede('x', a, b, 0, o.y0), fora }));
      grupo.add(paredeCaixa(xEsq - ESPESSURA, a, xEsq, b, o.y1, ALTURA_PAREDE, 'x', { dentro: matParede('x', a, b, o.y1, ALTURA_PAREDE), fora }));
      if (!o.porta) grupo.add(janela(a, b, o.y0, o.y1, xEsq, cidade, casca));
    }
  }
  grupo.add(paredeCaixa(xEsq - ESPESSURA, zIni - ESPESSURA, xFim, zIni, 0, ALTURA_PAREDE, 'z', { dentro: matParede('z', xEsq - ESPESSURA, xFim, 0, ALTURA_PAREDE), fora }));

  // as molduras em relevo (rodapé de 12 cm, guarda-cadeira de 5 cm a 0,90 m, moldura de teto de 8 cm): a textura já as
  // desenha; aqui elas ganham volume e pegam a luz e a sombra
  const trechos = (a: number, b: number, vaos: [number, number][]): [number, number][] => {
    let lista: [number, number][] = [[a, b]];
    for (const [v0, v1] of vaos) {
      const nova: [number, number][] = [];
      for (const [x0, x1] of lista) {
        if (v1 <= x0 || v0 >= x1) nova.push([x0, x1]);
        else {
          if (v0 - x0 > 0.001) nova.push([x0, v0]);
          if (x1 - v1 > 0.001) nova.push([v1, x1]);
        }
      }
      lista = nova;
    }
    return lista;
  };
  const molduraEsq = (y: number, h: number, prof: number, vaos: [number, number][], m: THREE.Material) => {
    for (const [a, b] of trechos(zIni, zFim, vaos)) {
      const mol = new THREE.Mesh(new THREE.BoxGeometry(prof, h, b - a), m);
      mol.position.set(xEsq + prof / 2, y + h / 2, (a + b) / 2);
      mol.castShadow = true;
      mol.receiveShadow = true;
      grupo.add(mol);
    }
  };
  const molduraFundo = (y: number, h: number, prof: number, m: THREE.Material) => {
    const mol = new THREE.Mesh(new THREE.BoxGeometry(xFim - xEsq, h, prof), m);
    mol.position.set((xEsq + xFim) / 2, y + h / 2, zIni + prof / 2);
    mol.castShadow = true;
    mol.receiveShadow = true;
    grupo.add(mol);
  };
  const vaoPorta: [number, number][] = [[zPortaIni - 0.07, zPortaFim + 0.07]];
  molduraEsq(0, 0.12, 0.018, vaoPorta, MAD_ESCURA);
  molduraEsq(0.9, 0.05, 0.022, vaoPorta, MAD_MEDIA);
  molduraEsq(ALTURA_PAREDE - 0.08, 0.08, 0.04, [], MAD_MEDIA);
  molduraFundo(0, 0.12, 0.018, MAD_ESCURA);
  molduraFundo(0.9, 0.05, 0.022, MAD_MEDIA);
  molduraFundo(ALTURA_PAREDE - 0.08, 0.08, 0.04, MAD_MEDIA);

  // a porta: batente de 3 cm, guarnição de 7 cm por dentro, folha de 0,88 × 2,07 m aberta de leve e a soleira
  const batente = new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.8 });
  const larguraPorta = zPortaFim - zPortaIni;
  const jamba = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material = batente) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    grupo.add(b);
  };
  const xMeioParede = xEsq - ESPESSURA / 2;
  jamba(ESPESSURA, ALT_PORTA, 0.03, xMeioParede, ALT_PORTA / 2, zPortaIni + 0.015);
  jamba(ESPESSURA, ALT_PORTA, 0.03, xMeioParede, ALT_PORTA / 2, zPortaFim - 0.015);
  jamba(ESPESSURA, 0.03, larguraPorta, xMeioParede, ALT_PORTA - 0.015, zCentroPorta);
  jamba(0.02, ALT_PORTA + 0.07, 0.07, xEsq + 0.01, (ALT_PORTA + 0.07) / 2, zPortaIni - 0.035, MAD_ESCURA);
  jamba(0.02, ALT_PORTA + 0.07, 0.07, xEsq + 0.01, (ALT_PORTA + 0.07) / 2, zPortaFim + 0.035, MAD_ESCURA);
  jamba(0.02, 0.07, larguraPorta + 0.14, xEsq + 0.01, ALT_PORTA + 0.035, zCentroPorta, MAD_ESCURA);
  const lFolha = 0.88;
  const folha = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.07, lFolha), new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.8 }));
  folha.geometry.translate(0, 0, lFolha / 2);
  folha.position.set(xEsq - ESPESSURA / 2, 1.035, zPortaIni + 0.04);
  folha.rotation.y = -1.15;
  folha.castShadow = true;
  folha.receiveShadow = true;
  grupo.add(folha);
  const soleira = new THREE.Mesh(new THREE.BoxGeometry(ESPESSURA + 0.04, 0.03, larguraPorta), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.85 }));
  soleira.position.set(xMeioParede, 0.015, zCentroPorta);
  soleira.receiveShadow = true;
  grupo.add(soleira);

  for (const it of dados.parede) {
    const o = itemDeParede(it, dados, casca);
    if (o) grupo.add(o);
  }
  // a cidade lá fora (a rua, os prédios de janelas acesas, o terreno) só nas cenas ao ar livre ou com ?cidade=1;
  // dentro do bar fica só o interior (10/11, o Felipe: "quando estivermos indoor, não deixa esses prédios aí")
  if (cidade) ruaEPredios(casca, xEsq, zIni, xFim, zFim);
  // o chão do mundo em volta (a calçada e o terreno) e o alicerce do bar, que dá o corte da "maquete"
  const terreno = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.95, metalness: 0 }));
  terreno.rotation.x = -Math.PI / 2;
  terreno.position.set(10, -0.05, 6);
  terreno.receiveShadow = true;
  if (cidade) grupo.add(terreno);
  const larg = xFim - xEsq + 0.5;
  const prof = zFim - zIni + 0.5;
  const alicerce = new THREE.Mesh(new THREE.BoxGeometry(larg, 0.5, prof), new THREE.MeshStandardMaterial({ color: '#54483c', roughness: 0.88 }));
  alicerce.position.set(xEsq - 0.25 + larg / 2, -0.26, zIni - 0.25 + prof / 2);
  alicerce.receiveShadow = true;
  alicerce.castShadow = true;
  grupo.add(alicerce);
  return casca;
}
