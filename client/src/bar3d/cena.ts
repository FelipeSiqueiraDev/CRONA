/**
 * O Bar da Ordem em 3D (protótipo, 10/11): a mesma cena do jogo (heightmap, móveis com giro, itens de parede, porta) como uma
 * sala de poucos polígonos, com luz quente, sombras, a rua e os prédios de janelas acesas lá fora, e os quatro agentes como
 * miniaturas ilustradas em pé. Abre em /proto3d.html (?foto esconde a interface; ?cam=1..4 &clima=0..2 &hora=0..1 &grade=1).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Agente, AGENTES } from './agentes';
import { montarCasca, type Casca } from './ambiente';

import { Clima, HORAS, TEMPOS } from './clima';
import { CASA, carregarBar } from './dados';
import { Interacao } from './interacao';
import { contorno, montarMoveis } from './moveis';
import { LOWPOLY } from './estilo';
import { montarCascaLowpoly } from './lowpoly';

const params = new URLSearchParams(location.search);
const FOTO = params.has('foto');
if (FOTO) document.body.classList.add('foto');

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: FOTO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOWPOLY ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = LOWPOLY ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LOWPOLY ? 1 : 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const cena = new THREE.Scene();
cena.fog = new THREE.Fog('#120d22', 60, 150);
let paredesDeCorte: NonNullable<Casca['paredesDeCorte']> = [];
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

const hemi = new THREE.HemisphereLight(LOWPOLY ? '#fff0d8' : '#4a5a9a', LOWPOLY ? '#b08a68' : '#7a4a26', 1.4);
cena.add(hemi);
const lua = new THREE.DirectionalLight('#8aa4ff', 0.55);
lua.position.set(LOWPOLY ? 14 : -12, 22, LOWPOLY ? 16 : -9);
lua.target.position.set(8, 0, 5.5);
lua.castShadow = true;
lua.shadow.mapSize.set(LOWPOLY ? 1024 : 2048, LOWPOLY ? 1024 : 2048);
const sc = lua.shadow.camera;
sc.left = -14;
sc.right = 14;
sc.top = 14;
sc.bottom = -14;
sc.near = 1;
sc.far = 60;
lua.shadow.bias = -0.0004;
lua.shadow.normalBias = 0.04;
lua.shadow.radius = 4;
cena.add(lua, lua.target);

const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.minDistance = 1.5;
controles.maxDistance = 46;
controles.maxPolarAngle = Math.PI * 0.49;
controles.screenSpacePanning = false;

let composer: EffectComposer | null = null;
let bloom: UnrealBloomPass | null = null;

// HD-2D: o quadro é desenhado em 1/PX do tamanho da tela e sobe com o filtro vizinho-mais-próximo (tecla P liga e desliga)
const PX_PADRAO = Math.max(1, Math.min(4, Number(params.get('px') ?? (LOWPOLY ? 1 : 2))));
let pixelado = PX_PADRAO > 1;
const fatorPx = () => (pixelado ? PX_PADRAO : 1);
function tamanho() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const f = fatorPx();
  const dpr = f === 1 ? Math.min(window.devicePixelRatio, 2) : 1;
  renderer.setPixelRatio(dpr);
  const iw = Math.max(2, Math.floor(w / f));
  const ih = Math.max(2, Math.floor(h / f));
  renderer.setSize(iw, ih, false);
  canvas.classList.toggle('pixelado', f > 1);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer?.setPixelRatio(dpr);
  composer?.setSize(iw, ih);
  bloom?.setSize(iw * dpr, ih * dpr);
  contorno.uRes.value.set(iw * dpr, ih * dpr);
  contorno.uPx.value = pixelado ? 1 : 0;
}

// A paleta quente e levemente posterizada, com pontilhado (Bayer) como no pixel art (tecla O)
const POSTER = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uNiveis: { value: 22 }, uTinta: { value: new THREE.Vector3(1.035, 1.0, 0.935) }, uAtivo: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uNiveis; uniform vec3 uTinta; uniform float uAtivo; varying vec2 vUv;
    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
      int i = x + y * 4;
      float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      return (m[i] + 0.5) / 16.0;
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uAtivo > 0.5) {
        vec3 v = c.rgb * uTinta;
        v = floor(v * uNiveis + bayer(gl_FragCoord.xy)) / uNiveis;
        c.rgb = clamp(v, 0.0, 1.0);
      }
      gl_FragColor = c;
    }`,
});

// ---------------------------------------------------------------- presets de câmera
interface Visao {
  pos: THREE.Vector3;
  alvo: THREE.Vector3;
  fov: number;
}
const CENTRO = new THREE.Vector3(8.2, 0.4, 5.5);
let agentes: Agente[] = [];
let ombro = 0;
let interacao: Interacao | null = null;

function visao(n: number): Visao {
  if (n === 1) return { pos: new THREE.Vector3(CENTRO.x + 12.8, 18.0, CENTRO.z + 13.6), alvo: new THREE.Vector3(CENTRO.x - 0.3, 0.2, CENTRO.z + 0.1), fov: 38 };
  if (n === 2) return { pos: new THREE.Vector3(CENTRO.x + 3.6, 5.6, CENTRO.z + 9.4), alvo: new THREE.Vector3(CENTRO.x - 0.6, 0.55, CENTRO.z + 1.6), fov: 42 };
  if (n === 3) {
    const a = agentes[ombro % Math.max(1, agentes.length)];
    const p = a ? a.grupo.position : new THREE.Vector3(7, 0, 7);
    const o = a ? a.def.olha : [1, 1];
    const f = new THREE.Vector3(o[0], 0, o[1]).normalize();
    return { pos: new THREE.Vector3(p.x - f.x * 2.0, 1.95, p.z - f.z * 2.0), alvo: new THREE.Vector3(p.x + f.x * 3.4, 1.0, p.z + f.z * 3.4), fov: 44 };
  }
  // a porta: de dentro do bar, olhando para a rua
  return { pos: new THREE.Vector3(4.3, 1.75, 6.9), alvo: new THREE.Vector3(0.0, 1.3, 8.75), fov: 44 };
}

let transicao: { de: Visao; para: Visao; t: number; dur: number } | null = null;
let atual = 1;
function irPara(n: number, instante = false) {
  atual = n;
  const para = visao(n);
  if (instante) {
    camera.position.copy(para.pos);
    controles.target.copy(para.alvo);
    camera.fov = para.fov;
    camera.updateProjectionMatrix();
    controles.update();
    transicao = null;
    return;
  }
  transicao = { de: { pos: camera.position.clone(), alvo: controles.target.clone(), fov: camera.fov }, para, t: 0, dur: 1.15 };
}

// ---------------------------------------------------------------- a grade (o quadrado do livro: 1,5 m = 2 casas)
function montarGrade(piso: [number, number, number, number]): THREE.Group {
  const [x0, z0, x1, z1] = piso;
  const fina: number[] = [];
  const grossa: number[] = [];
  for (let x = x0; x <= x1 + 0.001; x += CASA) {
    const k = Math.round((x - x0) / CASA);
    (k % 2 === 0 ? grossa : fina).push(x, 0.03, z0, x, 0.03, z1);
  }
  for (let z = z0; z <= z1 + 0.001; z += CASA) {
    const k = Math.round((z - z0) / CASA);
    (k % 2 === 0 ? grossa : fina).push(x0, 0.03, z, x1, 0.03, z);
  }
  const g = new THREE.Group();
  const linha = (pts: number[], cor: string, op: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: op, depthWrite: false }));
    l.renderOrder = 3;
    return l;
  };
  g.add(linha(fina, '#ffe6b8', 0.07), linha(grossa, '#ffe6b8', 0.3));
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------- tudo junto
const estadoEl = document.getElementById('estado');
let grade: THREE.Group;
let clima: Clima;
let ventiladores: THREE.Object3D[] = [];
let lampadasNoite: { luz: THREE.PointLight; base: number }[] = [];
const relogio = new THREE.Clock();
let pronto = false;

function mostrarEstado() {
  if (!estadoEl) return;
  estadoEl.innerHTML = `${clima.nome}${grade.visible ? ' · grade 1,5 m' : ''}${pixelado ? ' · pixelado 1/' + PX_PADRAO : ''}${POSTER.uniforms.uAtivo.value > 0.5 ? ' · paleta' : ''} · ${Agente.modo === 'pixel' ? 'bonecos de pixel' : 'standees'}${Agente.virarParaCamera ? '' : ' · olhando para onde vão'}${Agente.girando ? ' · girando' : ''}<br/>${agentes.map((a) => `${a.def.nome}: ${a.direcoes.length}/8`).join(' · ')}<br/>${lampadasNoite.length} luzes · ${agentes.length} agentes`;
}

async function iniciar() {
  const { dados, mapa } = await carregarBar();
  // a cidade lá fora (rua, prédios, céu) só nas cenas ao ar livre ou com ?cidade=1; o bar é um interior fechado
  const CIDADE = params.get('cidade') === '1' || (dados.cena as unknown as { aberto?: boolean }).aberto === true;
  const casca = LOWPOLY ? montarCascaLowpoly(dados) : montarCasca(dados, CIDADE);
  paredesDeCorte = casca.paredesDeCorte ?? [];
  cena.add(casca.grupo);
  ventiladores = casca.ventiladores;
  const moveis = await montarMoveis(dados);
  cena.add(moveis.grupo);
  lampadasNoite = [...moveis.luzes, ...casca.luzesDeParede];
  grade = montarGrade(casca.piso);
  cena.add(grade);
  agentes = AGENTES.map((d, i) => new Agente(d, i));
  await Promise.all(agentes.map((a) => a.carregar()));
  for (const a of agentes) cena.add(a.grupo);

  clima = new Clima(cena, renderer, hemi, lua, casca, moveis.luzes, moveis.brilhos, CIDADE, LOWPOLY);
  // os brilhos da casca (letreiro, TV) entram na mesma hora
  for (const b of casca.brilhosDeParede) moveis.brilhos.push(b);

  // low-poly: SEM pós-processo (sem bloom, sem posterização): o quadro vai direto para a tela, o mais barato possível
  if (!LOWPOLY) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(cena, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.45, 1.1);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(POSTER);
  }
  tamanho();

  // o que veio na URL
  if (params.get('personagem') === 'pixel') Agente.modo = 'pixel';
  if (params.get('virar') === '0') Agente.virarParaCamera = false;
  for (const a of agentes) a.aplicarModo();
  const h = Number(params.get('hora') ?? 0);
  const c = Number(params.get('clima') ?? 0);
  if (h) clima.setHora(h);
  if (c) clima.setTempo(c);
  if (params.get('grade') === '1') {
    grade.visible = true;
    for (const a of agentes) a.casaCelula.visible = true;
  }
  ombro = Number(params.get('agente') ?? 0);
  irPara(Number(params.get('cam') ?? (FOTO ? 1 : 2)), true);
  mostrarEstado();

  // a interação: escolher, andar, objetos e a senha da geladeira (interacao.ts)
  interacao = new Interacao({
    cena,
    camera,
    controles,
    canvas,
    dados,
    mapa,
    agentes,
    entradas: moveis.entradas,
    lampadas: lampadasNoite,
    brilhos: moveis.brilhos,
    folhaPorta: casca.folhaPorta,
    irPara: (n) => irPara(n),
    camAtual: () => atual,
    setOmbro: (i) => {
      ombro = i;
    },
    mostrarEstado,
  });

  // a console de depuração e das fotos
  const w = window as unknown as Record<string, unknown>;
  w.proto = {
    cam: (n: number) => irPara(n, true),
    camSuave: (n: number) => irPara(n),
    clima: (n: number) => (clima.setTempo(n), mostrarEstado()),
    hora: (n: number) => (clima.setHora(n), mostrarEstado()),
    grade: (v?: boolean) => alternarGrade(v),
    pixel: (v?: boolean) => alternarPixel(v),
    personagem: (v?: 'pixel' | 'ilustrado') => alternarPersonagem(v),
    virar: (v?: boolean) => alternarVirar(v),
    agentes,
    armado: (v?: boolean) => (Agente.armado = v ?? !Agente.armado),
    caido: (i: number, v = true) => agentes[i].definirCaido(v),
    girar: (v?: boolean) => ((Agente.girando = v ?? !Agente.girando), mostrarEstado()),
    clarao: () => clima.clarao(),
    poster: (v?: boolean) => alternarPoster(v),
    ombro: (i: number) => ((ombro = i), irPara(3, true)),
    camera,
    cena,
    controles,
    interacao: interacao.api,
    renderizar: () => quadro(0.016),
    info: () => ({ glb: moveis.glb, reserva: moveis.reserva, apoios: moveis.diag, luzes: lampadasNoite.length, tri: renderer.info.render.triangles, chamadas: renderer.info.render.calls }),
  };
  w.__pronto = false;
  pronto = true;
  quadro(0.016);
  quadro(0.016);
  quadro(0.016);
  w.__pronto = true;
  document.getElementById('hud')!.style.display = FOTO ? 'none' : '';
}

function alternarPixel(v?: boolean) {
  pixelado = v ?? !pixelado;
  tamanho();
  mostrarEstado();
}

function alternarPersonagem(v?: 'pixel' | 'ilustrado') {
  Agente.modo = v ?? (Agente.modo === 'pixel' ? 'ilustrado' : 'pixel');
  for (const a of agentes) a.aplicarModo();
  mostrarEstado();
}

function alternarVirar(v?: boolean) {
  Agente.virarParaCamera = v ?? !Agente.virarParaCamera;
  mostrarEstado();
}

function alternarPoster(v?: boolean) {
  POSTER.uniforms.uAtivo.value = (v ?? POSTER.uniforms.uAtivo.value < 0.5) ? 1 : 0;
  mostrarEstado();
}

function alternarGrade(v?: boolean) {
  grade.visible = v ?? !grade.visible;
  for (const a of agentes) a.casaCelula.visible = grade.visible;
  mostrarEstado();
}

let tempo = 0;
function quadro(dt: number) {
  tempo += dt;
  if (transicao) {
    transicao.t += dt;
    const k = Math.min(1, transicao.t / transicao.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camera.position.lerpVectors(transicao.de.pos, transicao.para.pos, e);
    controles.target.lerpVectors(transicao.de.alvo, transicao.para.alvo, e);
    camera.fov = transicao.de.fov + (transicao.para.fov - transicao.de.fov) * e;
    camera.updateProjectionMatrix();
    if (k >= 1) transicao = null;
  }
  controles.update();
  for (const p of paredesDeCorte) p.obj.visible = ((p.eixo === 'x' ? camera.position.x : camera.position.z) - p.lim) * p.lado > 0.05;
  clima.atualizar(dt);
  interacao?.atualizar(dt, tempo);
  for (const a of agentes) a.atualizar(tempo, camera.position, dt);
  for (const v of ventiladores) v.rotation.z += dt * 4.5;
  // as chamas das velas e lâmpadas piscam de leve
  const f = 1 + 0.025 * Math.sin(tempo * 7.3) + 0.015 * Math.sin(tempo * 13.1);
  for (const l of lampadasNoite) if (l.base < 1) l.luz.intensity = l.base * f * (HORAS[clima.hora] === 'noite' ? 1 : 0.8);
  (composer ?? { render: () => renderer.render(cena, camera) }).render(dt);
}

function laco() {
  if (!pronto) return requestAnimationFrame(laco);
  quadro(Math.min(0.05, relogio.getDelta()));
  requestAnimationFrame(laco);
}

window.addEventListener('resize', tamanho);
window.addEventListener('keydown', (e) => {
  if (!pronto) return;
  if (e.key >= '1' && e.key <= '4') {
    const n = Number(e.key);
    if (n === 3 && atual === 3) ombro = (ombro + 1) % agentes.length;
    irPara(n);
  } else if (e.key === 't' || e.key === 'T') alternarGrade();
  else if (e.key === 'c' || e.key === 'C') (clima.setTempo(clima.tempo + 1), mostrarEstado());
  else if (e.key === 'h' || e.key === 'H') (clima.setHora(clima.hora + 1), mostrarEstado());
  else if (e.key === 'p' || e.key === 'P') alternarPixel();
  else if (e.key === 'o' || e.key === 'O') alternarPoster();
  else if (e.key === 'k' || e.key === 'K') alternarPersonagem();
  else if (e.key === 'v' || e.key === 'V') alternarVirar();
  else if (e.key === 'f' || e.key === 'F') ((Agente.armado = !Agente.armado), mostrarEstado());
  else if (e.key === 'g' || e.key === 'G') ((Agente.girando = !Agente.girando), mostrarEstado());
});

void TEMPOS;
tamanho();
iniciar().then(
  () => laco(),
  (e) => {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:20px;color:#f88;font:12px monospace;white-space:pre-wrap">${String(e?.stack ?? e)}</pre>`);
  },
);
