/**
 * O clima e a hora do Bar em 3D: noite ou entardecer (o céu, a luz que entra e o brilho dos prédios) e o tempo
 * (limpo, chuva, chuva com relâmpago). A chuva cai fora do salão, na rua e no beco.
 */
import * as THREE from 'three';
import type { Casca } from './ambiente';

export const HORAS = ['noite', 'entardecer'] as const;
export const TEMPOS = ['limpo', 'chuva', 'relâmpago'] as const;

interface Ceu {
  topo: string;
  meio: string;
  baixo: string;
  hemiCeu: string;
  hemiChao: string;
  hemi: number;
  lua: string;
  luaForca: number;
  predios: number;
  lampadas: number;
  neblina: string;
  exposicao: number;
}

const CEUS: Record<(typeof HORAS)[number], Ceu> = {
  noite: { topo: '#060919', meio: '#15112e', baixo: '#46263a', hemiCeu: '#3a4a90', hemiChao: '#6a3a1e', hemi: 2.5, lua: '#a8b8ff', luaForca: 0.85, predios: 1.6, lampadas: 1.45, neblina: '#120d22', exposicao: 2.1 },
  entardecer: { topo: '#232a68', meio: '#b0506c', baixo: '#f2a566', hemiCeu: '#c08aa8', hemiChao: '#8a5a38', hemi: 2.1, lua: '#ffb070', luaForca: 1.5, predios: 0.55, lampadas: 1.0, neblina: '#6a3e50', exposicao: 1.5 },
};

/** Low-poly: luz quente e suave de tarde dentro do bar (hemisférica clara + uma direcional leve), sem escurecer com a hora. */
const CEU_LOWPOLY: Ceu = { topo: '#9fb3bd', meio: '#9fb3bd', baixo: '#9fb3bd', hemiCeu: '#fff0d8', hemiChao: '#b08a68', hemi: 2.3, lua: '#ffe2b4', luaForca: 2.2, predios: 0, lampadas: 1, neblina: '#9fb3bd', exposicao: 1 };

function gradiente(topo: string, meio: string, baixo: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topo);
  grad.addColorStop(0.55, meio);
  grad.addColorStop(1, baixo);
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** O som da chuva na janela e do trovão (ruído filtrado; só toca depois de um gesto, como a tecla C). */
class Som {
  private ctx: AudioContext | null = null;
  private chuva: GainNode | null = null;
  private ligar() {
    if (this.ctx) return this.ctx;
    try {
      const ctx = new AudioContext();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let ultimo = 0;
      for (let i = 0; i < d.length; i++) {
        const b = Math.random() * 2 - 1;
        ultimo = (ultimo + 0.04 * b) / 1.04; // ruído marrom (o grave da chuva)
        d[i] = ultimo * 3.2 + b * 0.18;
      }
      const fonte = ctx.createBufferSource();
      fonte.buffer = buf;
      fonte.loop = true;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 1800;
      filtro.Q.value = 0.5;
      const ganho = ctx.createGain();
      ganho.gain.value = 0;
      fonte.connect(filtro).connect(ganho).connect(ctx.destination);
      fonte.start();
      this.ctx = ctx;
      this.chuva = ganho;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }
  /** `nivel` de 0 (sem chuva) a 1. */
  chover(nivel: number) {
    const ctx = nivel > 0 ? this.ligar() : this.ctx;
    if (!ctx || !this.chuva) return;
    void ctx.resume();
    this.chuva.gain.setTargetAtTime(nivel * 0.05, ctx.currentTime, 0.4);
  }
  trovao(atraso: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + atraso;
    const dur = 2.6;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let u = 0;
    for (let i = 0; i < d.length; i++) {
      u = (u + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = u * 6 * Math.exp(-i / (ctx.sampleRate * 0.9));
    }
    const f = ctx.createBufferSource();
    f.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    f.connect(lp).connect(g).connect(ctx.destination);
    f.start(t);
  }
}

export class Clima {
  hora = 0;
  tempo = 0;
  private chuva: THREE.LineSegments;
  private gotas: Float32Array;
  private velocidades: Float32Array;
  private raio = 0;
  private som = new Som();
  private corVidro = new THREE.Color('#ffffff');
  private proximoRaio = 2.5;
  private alvo: Ceu = CEUS.noite;
  private corAlvo = { hemi: new THREE.Color(), chao: new THREE.Color(), lua: new THREE.Color() };

  constructor(
    private cena: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private hemi: THREE.HemisphereLight,
    private lua: THREE.DirectionalLight,
    private casca: Casca,
    private luzesMoveis: { luz: THREE.PointLight; base: number }[],
    private brilhosMoveis: { mat: THREE.MeshStandardMaterial; base: number }[],
    /** com cidade (cenas ao ar livre ou ?cidade=1) a chuva cai lá fora; sem ela (o bar), só o clarão e o som na janela */
    private cidade = false,
    /** low-poly: céu fixo, claro e suave (a hora não escurece a sala) */
    private lowpoly = false,
  ) {
    if (lowpoly) this.corVidro.set('#ffffff');
    const N = 1500;
    this.gotas = new Float32Array(N * 6);
    this.velocidades = new Float32Array(N);
    for (let i = 0; i < N; i++) this.reposicionar(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.gotas, 3));
    this.chuva = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#a8b8d8', transparent: true, opacity: 0.22, depthWrite: false }));
    this.chuva.frustumCulled = false;
    this.chuva.visible = false;
    cena.add(this.chuva);
    this.aplicar(true);
  }

  private reposicionar(i: number, inicio: boolean) {
    const [x0, z0, x1, z1] = this.casca.piso;
    let x = 0;
    let z = 0;
    // a chuva cai só fora do salão (que está aberto em cima, mas "coberto")
    for (let t = 0; t < 12; t++) {
      x = -13 + Math.random() * 46;
      z = -13 + Math.random() * 40;
      if (x < x0 - 0.1 || x > x1 + 0.2 || z < z0 - 0.3 || z > z1 + 0.2) break;
    }
    const y = inicio ? Math.random() * 24 : 24 + Math.random() * 3;
    const comp = 0.5 + Math.random() * 0.5;
    const o = i * 6;
    this.gotas[o] = x;
    this.gotas[o + 1] = y;
    this.gotas[o + 2] = z;
    this.gotas[o + 3] = x - 0.05;
    this.gotas[o + 4] = y + comp;
    this.gotas[o + 5] = z;
    this.velocidades[i] = 19 + Math.random() * 7;
  }

  setHora(h: number) {
    this.hora = ((h % HORAS.length) + HORAS.length) % HORAS.length;
    this.aplicar(false);
  }

  setTempo(t: number) {
    this.tempo = ((t % TEMPOS.length) + TEMPOS.length) % TEMPOS.length;
    this.proximoRaio = 1.2;
    this.aplicar(false);
  }

  private aplicar(inicial: boolean) {
    const c = this.lowpoly ? CEU_LOWPOLY : CEUS[HORAS[this.hora]];
    this.alvo = c;
    const chuvoso = this.tempo > 0;
    // o céu (a imagem de fundo)
    const escuro = (cor: string) => new THREE.Color(cor).multiplyScalar(chuvoso ? 0.62 : 1).getStyle();
    const antiga = this.cena.background as THREE.Texture | null;
    this.cena.background = this.lowpoly ? new THREE.Color('#9fb3bd') : this.cidade ? gradiente(escuro(c.topo), escuro(c.meio), escuro(c.baixo)) : gradiente('#040408', '#07060c', '#0b0910');
    antiga?.dispose();
    (this.cena.fog as THREE.Fog).color.set(c.neblina);
    if (!this.cidade) (this.cena.fog as THREE.Fog).color.set('#060509');
    if (this.lowpoly) (this.cena.fog as THREE.Fog).color.set('#9fb3bd');
    (this.cena.fog as THREE.Fog).near = this.cidade ? (chuvoso ? 38 : 60) : 90;
    (this.cena.fog as THREE.Fog).far = this.cidade ? (chuvoso ? 95 : 150) : 220;
    this.chuva.visible = chuvoso && this.cidade;
    this.som.chover(this.tempo > 0 ? 1 : 0);
    // o vidro das janelas segue a hora (entardecer: um laranja de fora); sem cidade atrás é só um vidro escuro
    const vidro = HORAS[this.hora] === 'noite' ? new THREE.Color('#ffffff') : new THREE.Color('#ffc9a0').multiplyScalar(1.5);
    this.corVidro.copy(vidro).multiplyScalar(chuvoso ? 0.8 : 1);
    if (!this.lowpoly) for (const v of this.casca.vidros) v.color.copy(this.corVidro);
    this.hemi.color.set(c.hemiCeu);
    this.hemi.groundColor.set(c.hemiChao);
    this.lua.color.set(c.lua);
    this.corAlvo.hemi.set(c.hemiCeu);
    this.corAlvo.chao.set(c.hemiChao);
    this.corAlvo.lua.set(c.lua);
    this.hemi.intensity = c.hemi * (chuvoso ? 0.78 : 1);
    this.lua.intensity = c.luaForca * (chuvoso ? 0.55 : 1);
    this.renderer.toneMappingExposure = c.exposicao;
    const p = c.predios * (chuvoso ? 0.8 : 1);
    for (const m of this.casca.janelasPredios) m.emissiveIntensity = p * (m.emissive.getHex() === 0xffffff ? 1 : 1);
    for (const l of this.casca.luzesDaRua) l.luz.intensity = l.base * (HORAS[this.hora] === 'noite' ? 1 : 0.35);
    for (const l of this.luzesMoveis) l.luz.intensity = l.base * c.lampadas;
    for (const l of this.casca.luzesDeParede) l.luz.intensity = l.base * c.lampadas;
    for (const b of this.brilhosMoveis) b.mat.emissiveIntensity = b.base * (0.8 + c.lampadas * 0.2);
    void inicial;
  }

  /** `dt` em segundos. */
  atualizar(dt: number) {
    if (this.tempo > 0 && this.cidade) {
      const a = this.gotas;
      for (let i = 0; i < this.velocidades.length; i++) {
        const o = i * 6;
        const v = this.velocidades[i] * dt;
        a[o + 1] -= v;
        a[o + 4] -= v;
        a[o] -= v * 0.06;
        a[o + 3] -= v * 0.06;
        if (a[o + 4] < -0.2) this.reposicionar(i, false);
      }
      (this.chuva.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    // o relâmpago: um clarão que some em duas pancadas
    const c = this.alvo;
    const chuvoso = this.tempo > 0 ? 1 : 0;
    if (this.tempo === 2) {
      this.proximoRaio -= dt;
      if (this.proximoRaio <= 0) {
        this.raio = 1;
        this.proximoRaio = 3.5 + Math.random() * 4;
        this.som.trovao(0.35 + Math.random() * 0.8);
      }
    }
    if (this.raio > 0) {
      this.raio = Math.max(0, this.raio - dt * 2.6);
      // duas pancadas: o clarão cai, volta e cai
      const f = this.raio > 0.55 ? this.raio : this.raio > 0.4 ? 0.2 : this.raio * 1.1;
      // com cidade o clarão é do céu todo; no bar ele só entra pelas janelas (azulado) e leve no resto
      const k = this.cidade ? 1 : 0.12;
      this.hemi.intensity = c.hemi * (chuvoso ? 0.78 : 1) + f * 3.2 * k;
      this.lua.intensity = c.luaForca * (chuvoso ? 0.55 : 1) + f * 2.4 * k;
      this.hemi.color.copy(this.corAlvo.hemi).lerp(new THREE.Color('#e8f0ff'), Math.min(1, f * k * 3));
      this.renderer.toneMappingExposure = c.exposicao + f * 0.35 * (this.cidade ? 1 : 0.4);
      for (const l of this.casca.luzesJanela) l.intensity = f * 18;
      if (!this.lowpoly) for (const v of this.casca.vidros) v.color.setScalar(1 + f * 5);
    } else {
      for (const l of this.casca.luzesJanela) l.intensity = 0;
      if (!this.lowpoly) for (const v of this.casca.vidros) v.color.copy(this.corVidro);
      this.hemi.intensity = c.hemi * (chuvoso ? 0.78 : 1);
      this.lua.intensity = c.luaForca * (chuvoso ? 0.55 : 1);
      this.hemi.color.copy(this.corAlvo.hemi);
      this.renderer.toneMappingExposure = c.exposicao;
    }
  }

  /** Dispara um clarão na hora (para as fotos e para testar). */
  clarao() {
    this.raio = 1;
  }

  get nome() {
    return `${HORAS[this.hora]} · ${TEMPOS[this.tempo]}`;
  }
}
