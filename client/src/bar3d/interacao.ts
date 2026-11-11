/**
 * A interação do protótipo 3D do Bar (10/11, o Felipe: "eu queria conseguir interagir de leve com a cena, tipo colocar a
 * senha no freezer, andar pelo mapa"). Tudo local, sem servidor:
 *
 * - escolher o agente (clique nele, Tab) e andar: clique no chão, ou W A S D / setas; o caminho é o A* do jogo sobre o mesmo
 *   mapa de casas (os móveis ocupam a pegada), com o pontilhado do caminho e o marcador de destino;
 * - passar o mouse num móvel: contorno e nome; clicar: o painel de ações (Examinar, Sentar, Ligar/desligar a luz, Pegar,
 *   a porta, a escada);
 * - a geladeira amarela esconde a passagem da Sede: o teclado numérico pede a senha (0413, a do jogo): certa, a geladeira
 *   desliza e a escada aparece com a luz fria saindo do buraco; errada, o teclado treme.
 */
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getFurni, type Point, type RoomMap } from '@crona/shared';
import type { Agente } from './agentes';
import { acharCaminho, casasAoRedor, CASAS_POR_SEGUNDO, livreEm, melhorCaminho, pontoDaTrilha, trilhaDoCaminho, type Trilha } from './caminho3d';
import { CASA, casaDe, centroDa, type DadosBar } from './dados';
import type { Entrada } from './moveis';
import { Painel, som, type Acao } from './painel';

type Luz = { luz: THREE.PointLight; base: number };
type Brilho = { mat: THREE.MeshStandardMaterial; base: number };

export interface Contexto {
  cena: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controles: OrbitControls;
  canvas: HTMLCanvasElement;
  dados: DadosBar;
  mapa: RoomMap;
  agentes: Agente[];
  entradas: Entrada[];
  lampadas: Luz[];
  brilhos: Brilho[];
  /** a folha da porta da rua (para abrir e fechar) */
  folhaPorta?: THREE.Mesh;
  irPara(n: number): void;
  camAtual(): number;
  setOmbro(i: number): void;
  mostrarEstado(): void;
}

type Alvo = { tipo: 'agente'; i: number } | { tipo: 'objeto'; e: Entrada } | { tipo: 'porta' } | { tipo: 'chao'; x: number; z: number; casa: Point };

/** O que cada agente faz agora (andando, sentado, a trilha, o corpo). */
interface Rt {
  a: Agente;
  trilha: Trilha | null;
  d: number;
  aoChegar: (() => void) | null;
  /** para onde o corpo olha (radianos no chão do jogo: atan2(y, x)) */
  ang: number;
  alvoAng: number;
  passo: number;
  mov: number;
  sentado: Entrada | null;
  sentDy: number;
  pontilhado: THREE.InstancedMesh | null;
  pontos: number[];
  destino: THREE.Mesh | null;
}

/** os móveis que se pegam (o copo, a caneca, a jarra, o cinzeiro, os papéis) */
const PEGAVEIS = new Set(['beer_glass', 'mug', 'jarra_canecas', 'ashtray', 'papers']);
/** os que têm luz (e brilho) para ligar e desligar */
const COM_LUZ = new Set(['ceiling_lamp', 'floor_lamp', 'candles', 'jukebox']);
const SENHA = '0413';

const olhaDoGiro = (rot: number): [number, number] => (rot === 0 ? [0, -1] : rot === 2 ? [1, 0] : rot === 6 ? [-1, 0] : [0, 1]);
const chave = (p: Point) => `${p.x},${p.y}`;
const difAng = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const EXAMINAR_POR_TIPO: Record<string, string> = {
  chair: 'Uma cadeira de bar de madeira, o encosto gasto por tanta gente.',
  stool: 'Um banco de balcão com o assento de couro vermelho já rachado.',
  table: 'Uma mesa de bar com marcas de copo e de cigarro. Nada escondido embaixo.',
  bar_counter: 'O balcão de madeira escura. Cheira a cerveja velha e a verniz.',
  shelf: 'Garrafas arrumadas por cor. Algumas estão ali há anos, sem poeira.',
  plant: 'Uma planta de folhas finas que ninguém lembra de regar.',
  trash_can: 'Uma lixeira cheia. Por cima, um maço de cigarros amassado.',
  keg: 'Um barril de chope. Está pesado: cheio.',
  crate: 'Um engradado de cerveja. As garrafas tilintam quando se mexe.',
  beer_glass: 'Um copo de chope pela metade. Ainda está gelado.',
  mug: 'Uma caneca de cerâmica. Cheiro de café frio.',
  papers: 'Folhas soltas e uma caneta. Anotações de conta, nada de importante.',
};

export class Interacao {
  readonly painel: Painel;
  private rts: Rt[];
  private sel = 0;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pickMeshes: THREE.Mesh[] = [];
  private donoDa = new Map<THREE.Object3D, Entrada>();
  private malhasDe = new Map<Entrada, THREE.Mesh[]>();
  private caixa = new THREE.Box3();
  private contorno: THREE.Box3Helper;
  private celula: THREE.Mesh;
  private anelSel: THREE.Mesh;
  private mouse = { x: 0, y: 0, mexeu: false, dentro: false };
  private down: { x: number; y: number; t: number } | null = null;
  private teclas = new Set<string>();
  private hover: Alvo | null = null;
  private tempo = 0;
  private ultSel: THREE.Vector3;
  // a geladeira da passagem
  private geladeira: Entrada | undefined;
  private escada: Entrada | undefined;
  private aberta = false;
  private slide: { t: number; dur: number; x0: number; x1: number } | null = null;
  private luzFria: THREE.PointLight | null = null;
  private facho: THREE.Mesh | null = null;
  private brilhoBuraco: THREE.Sprite | null = null;
  private fria = 0;
  // a porta da rua
  private folha: THREE.Mesh | undefined;
  private portaAberta = true;
  private portaAng: number;
  private portaAlvo: number;
  // as luzes ligadas e desligadas, e a mochila
  private luzesLigadas = new Map<number, boolean>();
  private luzBase = new Map<THREE.PointLight, number>();
  private mochila: { id: number; nome: string; e: Entrada }[] = [];
  readonly api: Record<string, unknown>;

  constructor(private c: Contexto) {
    this.painel = new Painel(() => this.painel.alternarAjuda());
    this.rts = c.agentes.map((a) => {
      const ang = Math.atan2(a.def.olha[1], a.def.olha[0]);
      return { a, trilha: null, d: 0, aoChegar: null, ang, alvoAng: ang, passo: 0, mov: 0, sentado: null, sentDy: 0, pontilhado: null, pontos: [], destino: null };
    });
    this.ultSel = c.agentes[0].grupo.position.clone();
    this.folha = c.folhaPorta;
    this.portaAng = this.folha?.rotation.y ?? 0;
    this.portaAlvo = this.portaAng;
    this.geladeira = c.entradas.find((e) => e.def.id === 'beer_fridge' && !!e.m.lock);
    this.escada = c.entradas.find((e) => e.def.kind === 'stairs_down');

    // o que se pode clicar: as malhas de cada móvel (sem as sombras moles, que são planos de MeshBasicMaterial)
    for (const e of c.entradas) {
      e.g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
        if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
        this.pickMeshes.push(m);
        this.donoDa.set(m, e);
        const l = this.malhasDe.get(e) ?? [];
        l.push(m);
        this.malhasDe.set(e, l);
      });
    }

    // o contorno do móvel sob o mouse, a casa sob o mouse e o anel do agente escolhido
    this.contorno = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#ffd27a'));
    const mc = this.contorno.material as THREE.LineBasicMaterial;
    mc.depthTest = false;
    mc.transparent = true;
    mc.toneMapped = false;
    this.contorno.renderOrder = 40;
    this.contorno.visible = false;
    this.celula = new THREE.Mesh(
      new THREE.PlaneGeometry(CASA * 0.94, CASA * 0.94),
      new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }),
    );
    this.celula.rotation.x = -Math.PI / 2;
    this.celula.position.y = 0.024;
    this.celula.visible = false;
    this.celula.renderOrder = 4;
    this.anelSel = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.022, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
    this.anelSel.rotation.x = Math.PI / 2;
    this.anelSel.position.y = 0.05;
    this.anelSel.userData.semPick = true;
    c.cena.add(this.contorno, this.celula);
    this.selecionar(0, true);

    const cv = c.canvas;
    cv.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    cv.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || e.button !== 0) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 600) this.clicar(e.clientX, e.clientY);
    });
    cv.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.mexeu = true;
      this.mouse.dentro = true;
    });
    cv.addEventListener('pointerleave', () => {
      this.mouse.dentro = false;
      this.hover = null;
      this.mostrarHover();
    });
    window.addEventListener('keydown', (e) => this.tecla(e), true);
    window.addEventListener('keyup', (e) => this.teclas.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.teclas.clear());

    // a ajuda e o aviso na tela
    document.getElementById('hud')?.insertAdjacentHTML('beforeend', '<br /><b>clique</b> no chão: o agente anda · <b>clique</b> num agente ou <b>Tab</b>: escolher · <b>WASD</b> / setas: andar · <b>clique</b> num objeto: ações · <b>?</b> ajuda');

    this.api = {
      clicarChao: (x: number, y: number) => this.clicarCasa({ x, y }),
      clicarObjeto: (idOuDef: number | string) => this.abrirPainelDe(this.entrada(idOuDef)),
      clicarAgente: (i: number) => this.selecionar(i),
      clicarPorta: () => this.painelPorta(),
      acao: (rotulo: string) => this.acionar(rotulo),
      digitar: (cod: string) => this.digitar(cod),
      estado: () => this.estado(),
      ajuda: () => this.painel.alternarAjuda(),
      tela: (idOuDef: number | string) => this.telaDe(this.entrada(idOuDef)),
      // para a verificação por script (o painel de teste desenha ~1 quadro por segundo): anda o tempo sem desenhar
      passos: (n: number, dt = 0.05) => {
        for (let i = 0; i < n; i++) this.atualizar(dt, this.tempo + dt);
        return this.estado();
      },
    };
  }

  // ---------------------------------------------------------------- entrada e escolha
  private entrada(idOuDef: number | string): Entrada | undefined {
    return typeof idOuDef === 'number' ? this.c.entradas.find((e) => e.m.id === idOuDef) : this.c.entradas.find((e) => e.def.id === idOuDef);
  }

  /** Onde o móvel está na tela (px), para a verificação por script. */
  private telaDe(e: Entrada | undefined) {
    if (!e) return null;
    const b = this.caixaDe(e);
    const v = b.getCenter(new THREE.Vector3()).project(this.c.camera);
    const r = this.c.canvas.getBoundingClientRect();
    return { x: Math.round(r.left + ((v.x + 1) / 2) * r.width), y: Math.round(r.top + ((1 - v.y) / 2) * r.height) };
  }

  private estado() {
    return {
      selecionado: this.c.agentes[this.sel].def.nome,
      agentes: this.rts.map((r) => ({ nome: r.a.def.nome, casa: casaDe(r.a.grupo.position.x, r.a.grupo.position.z), andando: !!r.trilha, sentado: r.sentado?.def.id ?? null })),
      passagemAberta: this.aberta,
      porta: this.portaAberta ? 'aberta' : 'fechada',
      mochila: this.mochila.map((m) => m.nome),
      painel: this.painel.painelAberto,
      teclado: this.painel.tecladoAberto,
      trilhaCasas: this.rts[this.sel].trilha?.casas ?? null,
    };
  }

  private selecionar(i: number, silencioso = false) {
    this.sel = (i + this.rts.length) % this.rts.length;
    const rt = this.rts[this.sel];
    this.anelSel.parent?.remove(this.anelSel);
    rt.a.grupo.add(this.anelSel);
    this.ultSel.copy(rt.a.grupo.position);
    this.c.setOmbro(this.sel);
    if (!silencioso && this.c.camAtual() === 3) this.c.irPara(3);
    this.atualizarSel();
    if (!silencioso) som.clique();
  }

  private atualizarSel() {
    const rt = this.rts[this.sel];
    this.painel.selecionado(rt.a.def.nome, rt.sentado ? `sentado: ${rt.sentado.def.name}` : rt.trilha ? 'andando' : 'parado');
  }

  private tecla(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (this.painel.tecladoAberto) return; // o teclado numérico trata as suas teclas (e segura as da câmera)
    if (e.key === 'Tab') {
      e.preventDefault();
      this.selecionar(this.sel + (e.shiftKey ? -1 : 1));
      return;
    }
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      this.painel.alternarAjuda();
      return;
    }
    if (e.key === 'Escape') {
      if (!this.painel.fecharTudo()) this.parar(this.rts[this.sel]);
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      this.teclas.add(k);
    }
  }

  // ---------------------------------------------------------------- achar o que está sob o mouse
  private alvoEm(cx: number, cy: number): Alvo | null {
    const { canvas, camera } = this.c;
    const r = canvas.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    let melhor: Alvo | null = null;
    let dist = Infinity;
    // os agentes
    this.rts.forEach((rt, i) => {
      const hs = this.raycaster.intersectObject(rt.a.grupo, true).filter((h) => !h.object.userData.semPick && !(h.object as THREE.Sprite).isSprite);
      if (hs.length && hs[0].distance < dist) (dist = hs[0].distance), (melhor = { tipo: 'agente', i });
    });
    // os móveis
    for (const h of this.raycaster.intersectObjects(this.pickMeshes, false)) {
      const e = this.donoDa.get(h.object);
      if (!e || !this.pickavel(e)) continue;
      if (h.distance < dist) (dist = h.distance), (melhor = { tipo: 'objeto', e });
      break;
    }
    // a porta da rua
    if (this.folha) {
      const h = this.raycaster.intersectObject(this.folha, false)[0];
      if (h && h.distance < dist) (dist = h.distance), (melhor = { tipo: 'porta' });
    }
    // o chão
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plano, p)) {
      const d = p.distanceTo(camera.position);
      if (d < dist) {
        const casa = casaDe(p.x, p.z);
        if (this.c.mapa.floorHeight(casa.x, casa.y) !== null) melhor = { tipo: 'chao', x: p.x, z: p.z, casa };
      }
    }
    return melhor;
  }

  private pickavel(e: Entrada): boolean {
    const k = e.def.kind;
    if (e.def.flat || k === 'rug' || k === 'dirt') return false;
    if (k === 'stairs_down') return this.aberta;
    return e.g.visible;
  }

  private caixaDe(e: Entrada): THREE.Box3 {
    const b = new THREE.Box3();
    e.g.updateWorldMatrix(true, true);
    for (const m of this.malhasDe.get(e) ?? []) b.union(new THREE.Box3().setFromObject(m));
    if (b.isEmpty()) b.setFromObject(e.g);
    return b;
  }

  private mostrarHover() {
    const h = this.hover;
    const cv = this.c.canvas;
    this.contorno.visible = false;
    this.celula.visible = false;
    if (!h) {
      this.painel.etiqueta(null, null);
      cv.style.cursor = '';
      return;
    }
    if (h.tipo === 'objeto') {
      this.contorno.box.copy(this.caixaDe(h.e));
      this.contorno.visible = true;
      this.painel.etiqueta(h.e.def.name, 'clique: ações', this.mouse.x, this.mouse.y);
      cv.style.cursor = 'pointer';
    } else if (h.tipo === 'agente') {
      this.painel.etiqueta(this.rts[h.i].a.def.nome, h.i === this.sel ? 'escolhido' : 'clique: escolher', this.mouse.x, this.mouse.y);
      cv.style.cursor = 'pointer';
    } else if (h.tipo === 'porta') {
      this.painel.etiqueta('Porta da Rua', 'clique: ações', this.mouse.x, this.mouse.y);
      cv.style.cursor = 'pointer';
    } else {
      const st = this.c.mapa.walkState(h.casa.x, h.casa.y);
      const c = centroDa(h.casa.x, h.casa.y);
      this.celula.position.set(c.x, 0.024, c.z);
      (this.celula.material as THREE.MeshBasicMaterial).color.set(st === 'walk' ? '#ffd27a' : '#e0584a');
      this.celula.visible = true;
      this.painel.etiqueta(null, null);
      cv.style.cursor = st === 'walk' ? 'cell' : 'not-allowed';
    }
  }

  // ---------------------------------------------------------------- cliques
  private clicar(cx: number, cy: number) {
    const alvo = this.alvoEm(cx, cy);
    if (!alvo) return;
    this.clicarAlvo(alvo);
  }

  private clicarAlvo(alvo: Alvo) {
    if (alvo.tipo === 'agente') {
      this.painel.fecharPainel(true);
      this.selecionar(alvo.i);
    } else if (alvo.tipo === 'objeto') this.abrirPainelDe(alvo.e);
    else if (alvo.tipo === 'porta') this.painelPorta();
    else {
      this.painel.fecharPainel(true);
      this.clicarCasa(alvo.casa);
    }
  }

  private clicarCasa(casa: Point) {
    const rt = this.rts[this.sel];
    if (this.c.mapa.floorHeight(casa.x, casa.y) === null) return this.painel.toast('Isso fica fora do bar.', true);
    const st = this.c.mapa.walkState(casa.x, casa.y);
    if (st === 'blocked') {
      som.erro();
      return this.painel.toast('Tem um móvel aí: não dá para ficar.', true);
    }
    this.irPara(rt, casa, null);
  }

  // ---------------------------------------------------------------- andar
  private ocupadasPor(rt: Rt): Set<string> {
    const s = new Set<string>();
    for (const o of this.rts) {
      if (o === rt) continue;
      s.add(chave(casaDe(o.a.grupo.position.x, o.a.grupo.position.z)));
    }
    return s;
  }

  private celulaDe(rt: Rt): Point {
    return casaDe(rt.a.grupo.position.x, rt.a.grupo.position.z);
  }

  private irPara(rt: Rt, destino: Point, aoChegar: (() => void) | null): boolean {
    if (rt.sentado) this.levantar(rt);
    const de = this.celulaDe(rt);
    const cam = acharCaminho(this.c.mapa, de, destino, this.ocupadasPor(rt));
    if (!cam) {
      som.erro();
      this.painel.toast(this.ocupadasPor(rt).has(chave(destino)) ? 'Já tem alguém aí.' : 'Não dá para chegar lá.', true);
      return false;
    }
    this.comecar(rt, cam, aoChegar);
    return true;
  }

  /** Anda até o lugar mais perto de onde se alcança o móvel (uma casa em volta da pegada); já perto, faz na hora. */
  private irAte(rt: Rt, e: Entrada, aoChegar: () => void): boolean {
    const pegada = this.pegadaDe(e);
    const de = this.celulaDe(rt);
    if (pegada.some((c) => Math.max(Math.abs(c.x - de.x), Math.abs(c.y - de.y)) <= 1)) {
      aoChegar();
      return true;
    }
    if (rt.sentado) this.levantar(rt);
    const achou = melhorCaminho(this.c.mapa, de, casasAoRedor(this.c.mapa, pegada, de, this.ocupadasPor(rt)), this.ocupadasPor(rt));
    if (!achou) {
      som.erro();
      this.painel.toast('Não consigo chegar perto disso.', true);
      return false;
    }
    this.comecar(rt, achou.cam, aoChegar);
    return true;
  }

  private pegadaDe(e: Entrada): Point[] {
    const cs: Point[] = [];
    for (let dy = 0; dy < e.sy; dy++) for (let dx = 0; dx < e.sx; dx++) cs.push({ x: e.m.x + dx, y: e.m.y + dy });
    return cs;
  }

  private comecar(rt: Rt, cam: Point[], aoChegar: (() => void) | null) {
    this.limparTrilha(rt);
    const p = rt.a.grupo.position;
    rt.trilha = trilhaDoCaminho({ x: p.x, z: p.z }, cam);
    rt.d = 0;
    rt.aoChegar = aoChegar;
    this.desenharTrilha(rt);
    this.atualizarSel();
    if (rt.trilha.total < 0.03) this.chegou(rt);
  }

  private parar(rt: Rt) {
    this.limparTrilha(rt);
    rt.trilha = null;
    rt.aoChegar = null;
    this.atualizarSel();
  }

  private chegou(rt: Rt) {
    const f = rt.aoChegar;
    this.limparTrilha(rt);
    rt.trilha = null;
    rt.aoChegar = null;
    this.atualizarSel();
    f?.();
  }

  private limparTrilha(rt: Rt) {
    if (rt.pontilhado) {
      rt.pontilhado.removeFromParent();
      rt.pontilhado.geometry.dispose();
      rt.pontilhado = null;
    }
    if (rt.destino) {
      rt.destino.removeFromParent();
      rt.destino = null;
    }
    rt.pontos = [];
  }

  /** O pontilhado do caminho (os pontinhos que ficam para trás somem) e o marcador do destino. */
  private desenharTrilha(rt: Rt) {
    const t = rt.trilha;
    if (!t || t.total < 0.03) return;
    const passo = 0.32;
    const n = Math.max(1, Math.floor(t.total / passo));
    const geo = new THREE.CircleGeometry(0.042, 10);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });
    const im = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    // do mais longe para o mais perto: o `count` esconde, de trás para a frente, os que o agente já passou
    rt.pontos = [];
    for (let i = n - 1, k = 0; i >= 0; i--, k++) {
      const d = (i + 1) * passo;
      const p = pontoDaTrilha(t, d);
      m.makeTranslation(p.x, 0.03, p.z);
      im.setMatrixAt(k, m);
      rt.pontos.push(d);
    }
    im.renderOrder = 5;
    im.frustumCulled = false;
    im.userData.semPick = true;
    this.c.cena.add(im);
    rt.pontilhado = im;
    const fim = t.pts[t.pts.length - 1];
    const marca = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.23, 28), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.95, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    marca.rotation.x = -Math.PI / 2;
    marca.position.set(fim.x, 0.032, fim.z);
    marca.renderOrder = 5;
    this.c.cena.add(marca);
    rt.destino = marca;
  }

  // ---------------------------------------------------------------- sentar e levantar
  private sentar(rt: Rt, e: Entrada) {
    const de = this.celulaDe(rt);
    const lugares = this.pegadaDe(e).filter((c) => this.c.mapa.walkState(c.x, c.y) === 'sit' && !this.ocupadasPor(rt).has(chave(c)));
    if (!lugares.length) {
      som.erro();
      return this.painel.toast('Já tem alguém sentado aí.', true);
    }
    lugares.sort((a, b) => Math.hypot(a.x - de.x, a.y - de.y) - Math.hypot(b.x - de.x, b.y - de.y));
    this.irPara(rt, lugares[0], () => {
      const [fx, fy] = olhaDoGiro(e.m.rot);
      const c = centroDa(lugares[0].x, lugares[0].y);
      // o agente senta virado para onde a cadeira olha, um pouco para trás, e desce até o assento (a ilustração é um recorte
      // em pé: o corpo desce até o quadril ficar na altura do assento, e o que passa do chão some embaixo dele)
      rt.a.grupo.position.set(c.x - fx * 0.05, 0, c.z - fy * 0.05);
      const assento = Math.min(0.8, Math.max(0.3, e.def.alturaM));
      rt.sentDy = -(0.95 - assento);
      rt.sentado = e;
      rt.alvoAng = rt.ang = Math.atan2(fy, fx);
      this.atualizarSel();
      som.clique();
    });
  }

  private levantar(rt: Rt) {
    rt.sentado = null;
    rt.sentDy = 0;
    this.atualizarSel();
  }

  // ---------------------------------------------------------------- o painel de ações
  private descricao(e: Entrada): string {
    const d = getFurni(e.def.id);
    return d?.desc ?? EXAMINAR_POR_TIPO[e.def.kind] ?? `Nada fora do comum em ${e.def.name.toLowerCase()}.`;
  }

  private abrirPainelDe(e: Entrada | undefined) {
    if (!e) return;
    this.painel.fecharTeclado(true);
    const rt = this.rts[this.sel];
    const nome = rt.a.def.nome;
    const acoes: Acao[] = [];
    const def = e.def;
    if (this.geladeira && e === this.geladeira) {
      if (!this.aberta) acoes.push({ rotulo: 'Digitar a senha', forte: true, fazer: () => this.irAte(rt, e, () => this.abrirTeclado()) });
      else acoes.push({ rotulo: 'Fechar a passagem', forte: true, fazer: () => this.irAte(rt, e, () => this.fecharPassagem()) });
    }
    if (def.kind === 'stairs_down') acoes.push({ rotulo: 'Descer para o Salão Principal', forte: true, fazer: () => this.descer(rt, e) });
    if (def.sit) acoes.push({ rotulo: 'Sentar', forte: true, fazer: () => (this.painel.fecharPainel(true), this.sentar(rt, e)) });
    if (COM_LUZ.has(def.kind)) {
      const lig = this.luzesLigadas.get(e.m.id) ?? true;
      acoes.push({ rotulo: lig ? 'Desligar a luz' : 'Ligar a luz', forte: !def.sit, fazer: () => this.alternarLuz(e) });
    }
    if (PEGAVEIS.has(def.id)) acoes.push({ rotulo: 'Pegar', forte: true, fazer: () => this.irAte(rt, e, () => this.pegar(e)) });
    acoes.push({ rotulo: 'Examinar', fazer: () => this.irAte(rt, e, () => this.painel.texto(`${nome} examina: ${this.descricao(e)}`)) });
    const sub = def.sit ? 'lugar de sentar' : COM_LUZ.has(def.kind) ? 'luz' : PEGAVEIS.has(def.id) ? 'objeto' : this.geladeira === e ? 'tem um teclado numérico' : undefined;
    this.painel.abrir({ titulo: def.name, sub, texto: this.descricao(e), acoes });
  }

  private painelPorta() {
    const rt = this.rts[this.sel];
    this.painel.fecharTeclado(true);
    const aberta = this.portaAberta;
    this.painel.abrir({
      titulo: 'Porta da Rua',
      sub: aberta ? 'aberta' : 'fechada',
      texto: 'A porta de madeira escura que dá para a rua. Lá fora está tudo escuro.',
      acoes: [
        { rotulo: aberta ? 'Fechar a porta' : 'Abrir a porta', forte: true, fazer: () => (this.alternarPorta(), this.painelPorta()) },
        { rotulo: 'Examinar', fazer: () => this.painel.texto(`${rt.a.def.nome} examina a porta: a madeira está lascada perto da fechadura, mas a tranca é nova.`) },
      ],
    });
  }

  private acionar(rotulo: string) {
    // para a verificação por script: aperta o botão do painel pelo texto
    const bt = [...document.querySelectorAll<HTMLButtonElement>('.pr-painel .pr-bt')].find((b) => (b.firstChild?.textContent ?? '').trim() === rotulo);
    bt?.click();
    return !!bt;
  }

  // ---------------------------------------------------------------- as ações
  private pegar(e: Entrada) {
    if (!e.g.visible) return;
    e.g.visible = false;
    this.mochila.push({ id: e.m.id, nome: e.def.name, e });
    som.pega();
    this.atualizarMochila();
    this.painel.fecharPainel(true);
    this.painel.toast(`${this.rts[this.sel].a.def.nome} pegou: ${e.def.name}.`);
  }

  private atualizarMochila() {
    this.painel.mochila(
      this.mochila.map((m) => ({ id: m.id, nome: m.nome })),
      (id) => {
        const i = this.mochila.findIndex((m) => m.id === id);
        if (i < 0) return;
        this.mochila[i].e.g.visible = true;
        this.mochila.splice(i, 1);
        som.pega();
        this.atualizarMochila();
      },
    );
  }

  private alternarLuz(e: Entrada) {
    const on = !(this.luzesLigadas.get(e.m.id) ?? true);
    this.luzesLigadas.set(e.m.id, on);
    e.g.traverse((o) => {
      const l = o as THREE.PointLight;
      if (l.isPointLight) {
        const reg = this.c.lampadas.find((x) => x.luz === l);
        if (!this.luzBase.has(l)) this.luzBase.set(l, reg?.base ?? l.intensity);
        const base = this.luzBase.get(l)!;
        if (reg) reg.base = on ? base : 0;
        l.intensity = on ? base : 0;
      }
      if ((o as THREE.Sprite).isSprite) o.visible = on;
      const m = o as THREE.Mesh;
      if (m.isMesh && !Array.isArray(m.material)) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if ((mat.name ?? '').toUpperCase().includes('EMISSIVO')) {
          // o material é dividido entre os móveis do mesmo modelo: este ganha o dele
          if (m.userData.emOrig === undefined) {
            m.material = mat.clone();
            m.userData.emOrig = mat.emissiveIntensity;
          }
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? (m.userData.emOrig as number) : 0;
        }
      }
    });
    som.luz();
    this.painel.fecharPainel(true);
    this.painel.toast(`${e.def.name}: ${on ? 'ligada' : 'desligada'}.`);
  }

  private alternarPorta() {
    this.portaAberta = !this.portaAberta;
    this.portaAlvo = this.portaAberta ? -1.15 : 0;
    som.desliza();
  }

  private descer(rt: Rt, e: Entrada) {
    this.painel.fecharPainel(true);
    this.irPara(rt, { x: e.m.x, y: e.m.y }, () => this.painel.toast('Protótipo: aqui o agente desceria para a Sede · Salão Principal.'));
  }

  // ---------------------------------------------------------------- o freezer: a senha e a passagem
  private abrirTeclado() {
    this.painel.fecharPainel(true);
    this.painel.abrirTeclado(
      { titulo: 'Geladeira amarela', sub: 'O teclado numérico do lado da geladeira.', tam: 4, enviar: (cod) => this.digitar(cod) },
      () => undefined,
    );
  }

  /** A senha: certa abre a passagem, errada devolve false (o teclado treme). */
  private digitar(cod: string): boolean {
    if (cod === SENHA) {
      this.abrirPassagem();
      return true;
    }
    return false;
  }

  private abrirPassagem() {
    const g = this.geladeira;
    if (!g || this.aberta) return;
    this.aberta = true;
    this.slide = { t: 0, dur: 1.2, x0: g.g.position.x, x1: g.g.position.x - CASA };
    som.desliza();
    // a passagem vale no mapa de casas: a geladeira deixa a casa da escada
    const it = this.c.mapa.getItem(g.m.id);
    if (it) this.c.mapa.updateItem({ ...it, x: it.x - 1, lock: it.lock ? { ...it.lock, open: true } : it.lock });
    this.ligarLuzFria();
    window.setTimeout(() => this.painel.toast('A geladeira deslizou: tem uma escada atrás dela.'), 700);
  }

  private fecharPassagem() {
    const g = this.geladeira;
    if (!g || !this.aberta) return;
    const cs = this.escada ? this.celulaDe(this.rts[this.sel]) : null;
    if (this.escada && cs && cs.x === this.escada.m.x && cs.y === this.escada.m.y) return this.painel.toast('Tem alguém na escada.', true);
    this.aberta = false;
    this.slide = { t: 0, dur: 1.0, x0: g.g.position.x, x1: g.g.position.x + CASA };
    som.desliza();
    const it = this.c.mapa.getItem(g.m.id);
    if (it) this.c.mapa.updateItem({ ...it, x: it.x + 1, lock: it.lock ? { ...it.lock, open: false } : it.lock });
    this.painel.fecharPainel(true);
  }

  private ligarLuzFria() {
    if (!this.escada) return;
    const c = centroDa(this.escada.m.x, this.escada.m.y);
    if (!this.luzFria) {
      this.luzFria = new THREE.PointLight('#8fd8ff', 0, 5.0, 1.6);
      this.luzFria.position.set(c.x, 0.4, c.z);
      this.c.cena.add(this.luzFria);
      // o facho: um cilindro aberto com o brilho que some para cima
      const cv = document.createElement('canvas');
      cv.width = 4;
      cv.height = 64;
      const g = cv.getContext('2d')!;
      const gr = g.createLinearGradient(0, 64, 0, 0);
      gr.addColorStop(0, 'rgba(160,225,255,0.95)');
      gr.addColorStop(0.5, 'rgba(120,200,255,0.28)');
      gr.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.facho = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.36, 1.5, 24, 1, true),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
      );
      this.facho.position.set(c.x, 0.75, c.z);
      this.facho.userData.semPick = true;
      this.c.cena.add(this.facho);
      const hs = document.createElement('canvas');
      hs.width = hs.height = 64;
      const hg = hs.getContext('2d')!;
      const rg = hg.createRadialGradient(32, 32, 1, 32, 32, 31);
      rg.addColorStop(0, 'rgba(200,240,255,1)');
      rg.addColorStop(0.4, 'rgba(120,200,255,0.4)');
      rg.addColorStop(1, 'rgba(120,200,255,0)');
      hg.fillStyle = rg;
      hg.fillRect(0, 0, 64, 64);
      const ht = new THREE.CanvasTexture(hs);
      this.brilhoBuraco = new THREE.Sprite(new THREE.SpriteMaterial({ map: ht, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      this.brilhoBuraco.scale.set(1.0, 1.0, 1);
      this.brilhoBuraco.position.set(c.x, -0.35, c.z);
      this.c.cena.add(this.brilhoBuraco);
    }
  }

  // ---------------------------------------------------------------- o quadro
  atualizar(dt: number, tempo: number) {
    this.tempo = tempo;
    // o mouse parado não repete a busca
    if (this.mouse.mexeu && this.mouse.dentro && !this.down) {
      this.mouse.mexeu = false;
      this.hover = this.alvoEm(this.mouse.x, this.mouse.y);
      this.mostrarHover();
    } else if (this.mouse.mexeu && this.down) this.mouse.mexeu = false;

    this.teclado(dt);
    for (const rt of this.rts) this.andar(rt, dt);
    this.animarCorpos(dt);
    this.animarMarcas(dt, tempo);
    this.animarMundo(dt, tempo);
    this.seguir();
  }

  /** W A S D / setas: andam o escolhido pelo lado em que a câmera olha. */
  private teclado(dt: number) {
    if (!this.teclas.size || this.painel.tecladoAberto) return;
    const rt = this.rts[this.sel];
    const f = new THREE.Vector3();
    this.c.camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-6) return;
    f.normalize();
    const dir = new THREE.Vector2(0, 0);
    const T = this.teclas;
    const frente = T.has('w') || T.has('arrowup') ? 1 : 0;
    const tras = T.has('s') || T.has('arrowdown') ? 1 : 0;
    const dire = T.has('d') || T.has('arrowright') ? 1 : 0;
    const esq = T.has('a') || T.has('arrowleft') ? 1 : 0;
    dir.x = (frente - tras) * f.x + (dire - esq) * -f.z;
    dir.y = (frente - tras) * f.z + (dire - esq) * f.x;
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    if (rt.trilha) this.parar(rt);
    if (rt.sentado) this.levantar(rt);
    this.painel.fecharPainel(true);
    const v = CASAS_POR_SEGUNDO * CASA * dt;
    const p = rt.a.grupo.position;
    const mapa = this.c.mapa;
    // cada eixo por vez: encostou num móvel, desliza ao longo dele
    if (livreEm(mapa, p.x + dir.x * v, p.z)) p.x += dir.x * v;
    if (livreEm(mapa, p.x, p.z + dir.y * v)) p.z += dir.y * v;
    rt.alvoAng = Math.atan2(dir.y, dir.x);
    rt.mov = Math.max(rt.mov, 0.99);
    this.manual = true;
  }
  private manual = false;

  private andar(rt: Rt, dt: number) {
    if (!rt.trilha) return;
    rt.d += CASAS_POR_SEGUNDO * CASA * dt;
    const p = pontoDaTrilha(rt.trilha, rt.d);
    rt.a.grupo.position.x = p.x;
    rt.a.grupo.position.z = p.z;
    if (p.dx || p.dz) rt.alvoAng = Math.atan2(p.dz, p.dx);
    if (rt.pontilhado) {
      let restam = 0;
      for (const d of rt.pontos) if (d > rt.d) restam++;
      rt.pontilhado.count = restam;
    }
    if (rt.d >= rt.trilha.total) this.chegou(rt);
  }

  /** O corpo: gira devagar para onde anda, balança no passo, e fica mais baixo sentado. */
  private animarCorpos(dt: number) {
    const manual = this.manual;
    this.manual = false;
    this.rts.forEach((rt, i) => {
      const andando = !!rt.trilha || (manual && i === this.sel);
      rt.mov += ((andando ? 1 : 0) - rt.mov) * Math.min(1, dt * 9);
      if (rt.mov < 0.01) rt.mov = 0;
      if (andando) rt.passo += dt * 9.2;
      rt.ang += difAng(rt.ang, rt.alvoAng) * Math.min(1, dt * 11);
      rt.a.olharPara(rt.ang);
      // do alto do agente, o def.olha vira a frente da câmera 3 (atrás do ombro)
      rt.a.def.olha[0] = Math.cos(rt.ang);
      rt.a.def.olha[1] = Math.sin(rt.ang);
      const bob = Math.abs(Math.sin(rt.passo)) * 0.026 * rt.mov;
      const sway = Math.sin(rt.passo) * 0.04 * rt.mov;
      rt.a.corpo(rt.sentDy + bob, sway);
    });
  }

  private animarMarcas(dt: number, t: number) {
    // o anel do escolhido pulsa
    const k = 1 + 0.06 * Math.sin(t * 5);
    this.anelSel.scale.set(k, k, k);
    (this.anelSel.material as THREE.MeshBasicMaterial).color.setHSL(0.11, 0.9, 0.62 + 0.1 * Math.sin(t * 5));
    for (const rt of this.rts)
      if (rt.destino) {
        const s = 1 + 0.18 * Math.sin(t * 7);
        rt.destino.scale.set(s, s, s);
      }
    void dt;
  }

  private animarMundo(dt: number, t: number) {
    // a porta
    if (this.folha && Math.abs(this.portaAng - this.portaAlvo) > 0.002) {
      const dif = this.portaAlvo - this.portaAng;
      this.portaAng += Math.sign(dif) * Math.min(Math.abs(dif), dt * 2.4);
      this.folha.rotation.y = this.portaAng;
    }
    // a geladeira desliza
    const s = this.slide;
    if (s && this.geladeira) {
      s.t = Math.min(s.dur, s.t + dt);
      const k = s.t / s.dur;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.geladeira.g.position.x = s.x0 + (s.x1 - s.x0) * e;
      // um tremidinho de peso no começo, como o móvel pesado arrastando
      this.geladeira.g.position.z += Math.sin(t * 60) * 0.0006 * (1 - k);
      if (s.t >= s.dur) this.slide = null;
    }
    // a luz fria do buraco entra e sai com a passagem
    const alvo = this.aberta ? 1 : 0;
    this.fria += (alvo - this.fria) * Math.min(1, dt * 2.2);
    if (this.luzFria) {
      const piscar = 1 + 0.06 * Math.sin(t * 9) * this.fria;
      this.luzFria.intensity = 2.6 * this.fria * piscar;
      if (this.facho) (this.facho.material as THREE.MeshBasicMaterial).opacity = 0.11 * this.fria * piscar;
      if (this.brilhoBuraco) (this.brilhoBuraco.material as THREE.SpriteMaterial).opacity = 0.3 * this.fria;
    }
  }

  /** A câmera 3 (atrás do ombro) acompanha o escolhido: o que ele andou, ela anda. */
  private seguir() {
    const p = this.rts[this.sel].a.grupo.position;
    if (this.c.camAtual() === 3) {
      const dx = p.x - this.ultSel.x;
      const dz = p.z - this.ultSel.z;
      if (dx || dz) {
        this.c.camera.position.x += dx;
        this.c.camera.position.z += dz;
        this.c.controles.target.x += dx;
        this.c.controles.target.z += dz;
      }
    }
    this.ultSel.copy(p);
  }
}
