/**
 * Os agentes como miniaturas: o recorte ilustrado de corpo inteiro (a pose de 8 direções do tabuleiro) em pé sobre uma base
 * de acrílico com o anel da cor do lado, sempre de frente para a câmera, respirando, com o nome embaixo. A direção em que
 * ele olha (o sprite certo das 8) muda conforme a câmera gira em volta.
 */
import * as THREE from 'three';
import { CASA, centroDa } from './dados';
import { CASAS_POR_SEGUNDO } from './caminho3d';
import { construirStandee, type Standee } from './standee';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LOWPOLY } from './estilo';
import { sombraMole } from './texturas';

export interface AgenteDef {
  nome: string;
  pasta: string;
  cor: string;
  /** a casa onde ele está */
  casa: [number, number];
  /** para onde ele olha, no mundo (x, y do jogo); no protótipo, gira com a tecla G */
  olha: [number, number];
}

export const AGENTES: AgenteDef[] = [
  { nome: 'D.Tepes', pasta: 'tepes', cor: '#d8402f', casa: [8, 5], olha: [-0.25, -1] },
  { nome: 'Catarina', pasta: 'catarina', cor: '#4a8ae0', casa: [7, 8], olha: [1, 0.8] },
  { nome: 'Alosi', pasta: 'alosi', cor: '#e0b030', casa: [10, 5], olha: [0.1, -1] },
  { nome: 'Cora', pasta: 'cora-falcao', cor: '#9a5ae0', casa: [9, 9], olha: [0.9, 1] },
];

/** As 8 direções do tabuleiro e o vetor do mundo (x, y do jogo) que cada uma mostra voltada para a tela. */
const DIRS: { k: string; v: [number, number] }[] = [
  { k: 's', v: [1, 1] },
  { k: 'se', v: [1, 0] },
  { k: 'e', v: [1, -1] },
  { k: 'ne', v: [0, -1] },
  { k: 'n', v: [-1, -1] },
  { k: 'nw', v: [-1, 0] },
  { k: 'w', v: [-1, 1] },
  { k: 'sw', v: [0, 1] },
];
const ANG_ISO = Math.atan2(1, 1);
/** o espelho de cada direção (a ilustração de um lado, virada, serve para o outro enquanto o desenho dele não chega) */
const ESPELHO: Record<string, string> = { s: 's', n: 'n', e: 'w', w: 'e', se: 'sw', sw: 'se', ne: 'nw', nw: 'ne' };

/**
 * De onde vêm as ilustrações de cada direção (10/11, como os tokens da referência, que mostram o perfil e as costas quando
 * a pessoa gira): `standee-<dir>.png` na pasta do agente; `standee.png` vale como a de frente (s). Com `?standee=chibi`, o
 * standee usa as 8 poses do tabuleiro, só para conferir a troca enquanto as ilustrações das outras direções não chegam.
 */
const FONTE_STANDEE = new URLSearchParams(location.search).get('standee');
const urlStandee = (pasta: string, d: string) =>
  FONTE_STANDEE === 'chibi'
    ? `/arte/personagens/${pasta}/tabuleiro-32bits/idle-desarmado-${d}.png`
    : LOWPOLY
      ? `/arte/personagens/${pasta}/standee-lp-${d}.png` // a folha low-poly do personagem (11/11), recortada por `scripts/3d/lowpoly/folha_standee.mjs`
      : `/arte/personagens/${pasta}/standee-${d}.png`;

/**
 * O agente como MALHA 3D de verdade (11/11): o GLB low-poly animado (`scripts/3d/lowpoly/personagem_alosi.py`) no lugar do
 * standee. Liga sozinho no estilo lowpoly para quem tem modelo; `?agente3d=0` volta ao standee, `?agente3d=1` liga também fora do lowpoly.
 */
const PARAM_3D = new URLSearchParams(location.search).get('agente3d');
const USA_3D = PARAM_3D === '1' || (LOWPOLY && PARAM_3D !== '0');
const COM_MODELO = new Set(['alosi']);
const URL_MODELO = (pasta: string) => `/prototipo3d/lowpoly/personagens/${pasta}.glb`;
/** o passo do clipe Walk cobre 1,6 m por ciclo de 1 s */
const M_POR_CICLO_WALK = 1.6;

/** A altura do recorte em metros: gente do livro, 1,80 m. */
const ALTURA = 1.8;
/** a figura ocupa quase toda a altura do quadro de 474 px */
const PX_ALTURA = 474;

interface Sprite {
  tex: THREE.Texture;
  /** largura e altura do plano em metros, e o deslocamento do centro da figura */
  w: number;
  h: number;
}

async function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error(url));
    img.src = url;
  });
}

/** Corta a margem transparente e devolve a textura e as medidas do recorte. */
function recortar(img: HTMLImageElement): Sprite {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let x1 = 0;
  let y0 = c.height;
  let y1 = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const o = document.createElement('canvas');
  o.width = w;
  o.height = h;
  o.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  const tex = new THREE.CanvasTexture(o);
  tex.colorSpace = THREE.SRGBColorSpace;
  // pixel art de verdade: vizinho mais próximo, sem mipmap (HD-2D)
  tex.anisotropy = 1;
  tex.generateMipmaps = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return { tex, w: (w / PX_ALTURA) * ALTURA, h: (h / PX_ALTURA) * ALTURA };
}

function nomeEmCartao(nome: string, cor: string): THREE.Sprite {
  // letra de pixel: o cartão é pequeno e sobe com o filtro vizinho-mais-próximo
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 20;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(12,8,6,0.82)';
  g.fillRect(1, 1, 94, 18);
  g.fillStyle = cor;
  g.fillRect(1, 17, 94, 2);
  g.fillStyle = '#f4ead0';
  g.font = 'bold 11px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(nome.toUpperCase(), 48, 9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  s.renderOrder = 20;
  s.scale.set(0.86, 0.18, 1);
  return s;
}

/** Como os agentes aparecem: o boneco de pixel do tabuleiro ou o standee ilustrado (a foto recortada, com espessura e relevo). */
export type ModoAgente = 'pixel' | 'ilustrado';

export class Agente {
  /** os dois jeitos de ver (tecla K) e se o standee gira para a câmera (padrão) ou fica virado para onde olha (tecla V) */
  static modo: ModoAgente = 'ilustrado';
  static virarParaCamera = true;
  /** os agentes giram devagar no lugar (tecla G), para ver a troca das direções */
  static girando = false;
  /** os agentes com modelo 3D seguram o grimório aberto (clipe Armado_idle); tecla F */
  static armado = new URLSearchParams(location.search).get('armado') === '1';
  /** o modelo 3D animado, se houver */
  private modelo: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private acoes = new Map<string, THREE.AnimationAction>();
  private clipeAtual = '';
  private mov = 0;
  private caido = false;
  /** um standee por direção desenhada (o relevo sai do contorno de cada uma) */
  private standees = new Map<string, Standee>();
  private standeeAtual = '';
  private olhaAng = 0;
  readonly grupo = new THREE.Group();
  readonly recorte: THREE.Mesh;
  private sprites = new Map<string, Sprite>();
  private atual = '';
  private fase: number;
  private quadro = new THREE.Group();
  readonly anel: THREE.Mesh;
  readonly casaCelula: THREE.Mesh;

  constructor(readonly def: AgenteDef, indice: number) {
    this.fase = indice * 1.7;
    this.olhaAng = Math.atan2(def.olha[1], def.olha[0]);
    const { x: cx, z: cz } = centroDa(def.casa[0], def.casa[1]);
    this.grupo.position.set(cx, 0, cz);
    // a base de acrílico (um disco transparente) e o anel colorido
    const acrilico = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.035, 36),
      new THREE.MeshStandardMaterial({ color: '#cfd8e0', transparent: true, opacity: 0.18, roughness: 0.8, metalness: 0 }),
    );
    acrilico.position.y = 0.0175;
    acrilico.castShadow = true;
    acrilico.receiveShadow = true;
    this.anel = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.012, 8, 40), new THREE.MeshStandardMaterial({ color: def.cor, emissive: def.cor, emissiveIntensity: 0.4, roughness: 0.8, metalness: 0 }));
    this.anel.rotation.x = Math.PI / 2;
    this.anel.position.y = 0.036;
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: sombraMole(), transparent: true, depthWrite: false, opacity: 0.8 }));
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.012;
    // a casa (0,75 m) marcada no chão quando a grade está ligada
    this.casaCelula = new THREE.Mesh(new THREE.PlaneGeometry(CASA, CASA), new THREE.MeshBasicMaterial({ color: def.cor, transparent: true, opacity: 0.22, depthWrite: false }));
    this.casaCelula.rotation.x = -Math.PI / 2;
    this.casaCelula.position.y = 0.016;
    this.casaCelula.visible = false;
    // o recorte: o plano fica com o pé na origem e respira escalando em y
    this.recorte = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.16 }),
    );
    this.recorte.geometry.translate(0, 0.5, 0);
    this.recorte.castShadow = false;
    this.quadro.add(this.recorte);
    this.quadro.position.y = 0.04;
    const nome = nomeEmCartao(def.nome, def.cor);
    // o nome fica embaixo, na frente da base (a câmera olha de cima: a faixa cai no chão diante dos pés)
    nome.position.set(0, 0.0, 0.0);
    nome.center.set(0.5, 1.15);
    this.grupo.add(this.casaCelula, sombra, acrilico, this.anel, this.quadro, nome);
    this.nome = nome;
  }

  private nome: THREE.Sprite;

  async carregar() {
    await Promise.all(
      DIRS.map(async (d) => {
        const img = await carregarImagem(`/arte/personagens/${this.def.pasta}/tabuleiro-32bits/idle-desarmado-${d.k}.png`);
        this.sprites.set(d.k, recortar(img));
      }),
    );
    // o standee ilustrado, uma ilustração por direção; sem nenhuma, o agente fica no pixel
    const fotos = await Promise.all(
      DIRS.map(async (d) => {
        try {
          return [d.k, await carregarImagem(urlStandee(this.def.pasta, d.k))] as const;
        } catch {
          if (d.k !== 's' || FONTE_STANDEE === 'chibi') return null;
          try {
            return [d.k, await carregarImagem(`/arte/personagens/${this.def.pasta}/standee.png`)] as const;
          } catch {
            return null;
          }
        }
      }),
    );
    for (const f of fotos) {
      if (!f) continue;
      const st = construirStandee(f[1], ALTURA);
      st.grupo.visible = false;
      this.standees.set(f[0], st);
      this.quadro.add(st.grupo);
    }
    if (USA_3D && COM_MODELO.has(this.def.pasta)) {
      try {
        const gltf = await new GLTFLoader().loadAsync(URL_MODELO(this.def.pasta));
        const m = gltf.scene;
        m.traverse((n) => {
          const me = n as THREE.Mesh;
          if (!me.isMesh) return;
          me.castShadow = true;
          me.receiveShadow = false;
          me.frustumCulled = false;
          for (const mt of Array.isArray(me.material) ? me.material : [me.material]) {
            const st = mt as THREE.MeshStandardMaterial;
            st.flatShading = true;
            st.roughness = 1;
            st.metalness = 0;
            st.map = null;
            st.needsUpdate = true;
          }
        });
        this.modelo = m;
        this.quadro.add(m);
        this.mixer = new THREE.AnimationMixer(m);
        for (const c of gltf.animations) this.acoes.set(c.name, this.mixer.clipAction(c));
        this.tocar('Idle', 0);
      } catch (e) {
        console.warn('modelo 3D do agente não carregou, fica o standee', e);
      }
    }
    this.aplicarModo();
  }

  /** Troca o clipe com um fio de mistura. */
  private tocar(nome: string, fade = 0.25) {
    if (nome === this.clipeAtual) return;
    const nova = this.acoes.get(nome);
    if (!nova) return;
    const velha = this.acoes.get(this.clipeAtual);
    nova.reset().setEffectiveWeight(1).play();
    if (velha) velha.crossFadeTo(nova, fade, false);
    this.clipeAtual = nome;
  }

  /** Marca o agente como caído (clipe Caido) ou de pé de novo. */
  definirCaido(v: boolean) {
    this.caido = v;
  }

  /** A direção k, se dá para mostrar: desenhada, ou o espelho de uma desenhada. */
  private disponivel(k: string): { k: string; espelho: boolean } | null {
    if (this.standees.has(k)) return { k, espelho: false };
    const e = ESPELHO[k];
    if (this.standees.has(e)) return { k: e, espelho: true };
    return null;
  }

  /** Mostra o pixel ou o standee, conforme `Agente.modo`. */
  aplicarModo() {
    const m3 = !!this.modelo && Agente.modo === 'ilustrado';
    if (this.modelo) this.modelo.visible = m3;
    const ilus = !m3 && Agente.modo === 'ilustrado' && this.standees.size > 0;
    this.recorte.visible = !ilus && !m3;
    for (const [k, st] of this.standees) st.grupo.visible = ilus && k === this.standeeAtual;
  }

  /** As direções desenhadas deste agente (para o HUD). */
  get direcoes(): string[] {
    return [...this.standees.keys()];
  }

  /** Qual das 8 poses mostrar, vendo de `cam` (em metros no chão), e a pose de agora. */
  private escolher(cam: THREE.Vector3, so?: (k: string) => boolean): string {
    const angCam = Math.atan2(cam.z - this.grupo.position.z, cam.x - this.grupo.position.x);
    const angOlha = this.olhaAng;
    let melhor = 's';
    let menor = 99;
    for (const d of DIRS) {
      if (so && !so(d.k)) continue;
      // o sprite d mostra, vista do iso padrão (câmera em 45°), a pose que olha para d.v; girando a câmera, a mesma pose gira junto
      const alvo = angCam + (Math.atan2(d.v[1], d.v[0]) - ANG_ISO);
      const e = Math.abs(Math.atan2(Math.sin(angOlha - alvo), Math.cos(angOlha - alvo)));
      if (e < menor) (menor = e), (melhor = d.k);
    }
    return melhor;
  }

  /** Interação (protótipo): para onde o agente olha, em radianos no chão do jogo (atan2 de y, x); escolhe o sprite das 8 direções. */
  olharPara(ang: number) {
    this.olhaAng = ang;
  }

  /** Interação (protótipo): o balanço do passo e a altura do corpo (sentado desce) sem mexer na respiração. */
  corpo(dy: number, rz: number, mov = 0, sentDy = 0) {
    this.mov = mov;
    if (this.modelo) {
      // o modelo balança sozinho no passo (clipe Walk): só a altura de sentado vem de fora
      this.quadro.position.y = 0.04 + sentDy;
      this.quadro.rotation.z = 0;
      return;
    }
    this.quadro.position.y = 0.04 + dy;
    this.quadro.rotation.z = rz;
  }

  atualizar(t: number, cam: THREE.Vector3, dt = 0) {
    if (Agente.girando) this.olhaAng += dt * 0.9;
    if (this.modelo && this.mixer && Agente.modo === 'ilustrado') {
      const andando = this.mov > 0.15;
      const nome = this.caido ? 'Caido' : andando ? 'Walk' : Agente.armado ? 'Armado_idle' : 'Idle';
      this.tocar(nome);
      const w = this.acoes.get('Walk');
      if (w) w.timeScale = andando ? (CASAS_POR_SEGUNDO * CASA) / M_POR_CICLO_WALK : 1;
      this.mixer.update(dt);
      // o modelo olha para onde anda (a frente dele é +Z; o olhar vem do chão do jogo: x e y viram x e z)
      this.quadro.rotation.y = Math.atan2(Math.cos(this.olhaAng), Math.sin(this.olhaAng));
      return;
    }
    if (Agente.modo === 'ilustrado' && this.standees.size > 0) {
      // a ilustração da direção que a câmera vê (como os tokens da referência: girando, aparecem o perfil e as costas)
      const disp = this.disponivel(this.escolher(cam, (d) => !!this.disponivel(d)))!;
      if (disp.k !== this.standeeAtual) {
        this.standeeAtual = disp.k;
        this.aplicarModo();
      }
      const st = this.standees.get(disp.k)!;
      // o espelho vira a figura no eixo x
      st.grupo.scale.x = disp.espelho ? -1 : 1;
      // respira (o peito incha, o corpo cresce um fio) e vira para a câmera, ou para onde olha
      st.resp.value = Math.sin(t * 1.9 + this.fase);
      this.quadro.rotation.y = Agente.virarParaCamera
        ? Math.atan2(cam.x - this.grupo.position.x, cam.z - this.grupo.position.z)
        : Math.atan2(Math.cos(this.olhaAng), Math.sin(this.olhaAng));
      return;
    }
    this.aplicarModo();
    const k = this.escolher(cam);
    const sp = this.sprites.get(k);
    if (sp && k !== this.atual) {
      this.atual = k;
      const m = this.recorte.material as THREE.MeshLambertMaterial;
      m.map = sp.tex;
      m.emissiveMap = sp.tex;
      m.needsUpdate = true;
      this.recorte.scale.set(sp.w, sp.h, 1);
      (this.recorte.userData as { h?: number }).h = sp.h;
    }
    const h = (this.recorte.userData as { h?: number }).h ?? 1;
    // respira: o corpo sobe e desce um fio, só na altura
    const r = 1 + 0.017 * Math.sin(t * 1.9 + this.fase);
    this.recorte.scale.y = h * r;
    this.recorte.scale.x = (this.sprites.get(this.atual)?.w ?? 1) * (1 - 0.004 * Math.sin(t * 1.9 + this.fase));
    // sempre de frente para a câmera (só gira no eixo vertical)
    this.quadro.rotation.y = Math.atan2(cam.x - this.grupo.position.x, cam.z - this.grupo.position.z);
  }
}
