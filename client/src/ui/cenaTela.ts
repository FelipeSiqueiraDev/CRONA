import type { CenaAoVivo, CenaQuadro, Foco } from '@crona/shared';
import { FOCO_ZOOM_MAX, FOCO_ZOOM_MIN } from '@crona/shared';
import type { App } from './app';
import { h } from './dom';
import { ic } from './icons';
import { sfx } from './sfx';

/**
 * A tela de uma cena de momento (17/10): uma ilustração (e as peças da colagem que entram por cima dela) toma a tela do
 * mestre, da mesa e dos celulares; a câmera passeia por ela (foco e zoom), a música toca, a legenda é digitada. O mestre
 * vê por cima a barra (voltar, avançar, pausa, som, fechar) e a fala dele neste quadro; os outros só veem a cena. Quem manda
 * é o servidor (`cenaAoVivo`, e o relógio dos quadros com duração): esta tela só desenha.
 */

const FADE_MUSICA_MS = 2200;
const VOLUME = 0.85;
/** o quadro que espera o mestre: a câmera anda devagar durante este tempo */
const CAMERA_MANUAL_MS = 40000;

interface Estado {
  id: string;
  tela: HTMLElement;
  atual: HTMLElement | null;
  legenda: HTMLElement;
  nota: HTMLElement;
  contador: HTMLElement;
  proximo: HTMLButtonElement;
  voltar: HTMLButtonElement;
  pausaBt: HTMLButtonElement | null;
  progresso: HTMLElement;
  quadro: number;
  pausada: boolean;
  digitando: number;
  fim: () => void;
}

let est: Estado | null = null;
let audio: HTMLAudioElement | null = null;
let audioSrc = '';
let mudo = false;
let fadeTimer = 0;

/** Sobe ou desce o volume aos poucos (a música entra e sai sem estalo). */
function fade(a: HTMLAudioElement, para: number, ms: number, depois?: () => void) {
  clearInterval(fadeTimer);
  const de = a.volume;
  const t0 = performance.now();
  fadeTimer = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, de + (para - de) * k));
    if (k >= 1) {
      clearInterval(fadeTimer);
      depois?.();
    }
  }, 50);
}

function tocarMusica(src: string | undefined) {
  if (!src) {
    pararMusica();
    return;
  }
  if (audio && audioSrc === src) return;
  pararMusica(true);
  const a = new Audio(src);
  a.loop = true;
  a.volume = 0;
  audio = a;
  audioSrc = src;
  const iniciar = () => {
    if (audio !== a) return;
    a.play()
      .then(() => {
        if (audio === a && !mudo) fade(a, VOLUME, FADE_MUSICA_MS);
      })
      .catch(() => {
        // o navegador só deixa tocar depois de um toque na página (a mesa que ninguém tocou): tenta de novo no primeiro
        const de_novo = () => {
          removeEventListener('pointerdown', de_novo, true);
          removeEventListener('keydown', de_novo, true);
          iniciar();
        };
        addEventListener('pointerdown', de_novo, true);
        addEventListener('keydown', de_novo, true);
      });
  };
  iniciar();
}

function pararMusica(seco = false) {
  const a = audio;
  audio = null;
  audioSrc = '';
  if (!a) return;
  if (seco) {
    clearInterval(fadeTimer);
    a.pause();
    return;
  }
  fade(a, 0, 1400, () => a.pause());
}

/** O som de um quadro: toca uma vez, quando ele entra. */
function tocarEfeito(src: string | undefined) {
  if (!src || mudo) return;
  const a = new Audio(src);
  a.volume = 0.95;
  void a.play().catch(() => undefined);
}

/** O que a câmera faz por padrão em cada movimento pronto (de, para). */
function focosDoMovimento(m: CenaQuadro['movimento']): [Foco, Foco] {
  const c = (x: number, y: number, zoom: number): Foco => ({ x, y, zoom });
  switch (m) {
    case 'afasta':
      return [c(50, 50, 1.16), c(50, 50, 1)];
    case 'esquerda':
      return [c(62, 50, 1.16), c(38, 50, 1.16)];
    case 'direita':
      return [c(38, 50, 1.16), c(62, 50, 1.16)];
    case 'cima':
      return [c(50, 62, 1.16), c(50, 38, 1.16)];
    case 'baixo':
      return [c(50, 38, 1.16), c(50, 62, 1.16)];
    case 'tremor':
      return [c(50, 50, 1.07), c(50, 50, 1.07)];
    case 'tremorForte':
      return [c(50, 50, 1.12), c(50, 50, 1.3)];
    case 'correndo':
      return [c(50, 50, 1), c(50, 50, 1.6)];
    case 'queda':
      return [c(50, 50, 1.1), c(50, 60, 1.25)];
    case 'parado':
      return [c(50, 50, 1), c(50, 50, 1)];
    default:
      return [c(50, 50, 1), c(50, 50, 1.16)];
  }
}

/** A transformação da câmera para um enquadramento: a imagem (iw × ih) na janela (vw × vh), sem mostrar borda de fora. */
export function transformDoFoco(f: Foco, iw: number, ih: number, vw: number, vh: number): string {
  const s0 = Math.max(vw / iw, vh / ih);
  const zmin = Math.min(vw / iw, vh / ih) / s0;
  const s = s0 * Math.max(Math.max(FOCO_ZOOM_MIN, zmin), Math.min(FOCO_ZOOM_MAX, f.zoom));
  const eixo = (centro: number, tam: number, janela: number) => {
    const t = janela / 2 - centro * s;
    if (tam * s <= janela) return (janela - tam * s) / 2;
    return Math.max(janela - tam * s, Math.min(0, t));
  };
  const tx = eixo((f.x / 100) * iw, iw, vw);
  const ty = eixo((f.y / 100) * ih, ih, vh);
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
}

/** Desenha a cena que o servidor mandou (`null` = fecha a que estiver na tela). */
export function mostrarCena(app: App, c: CenaAoVivo | null) {
  if (!c) {
    est?.fim();
    return;
  }
  const mestre = app.state.role === 'gm';
  if (est && est.id !== c.id) est.fim();
  if (!est) {
    est = abrir(app, c, mestre);
    // as imagens de todos os quadros já vão para o cache: o corte não espera o arquivo
    for (const q of c.quadros) for (const im of [q.imagem, ...(q.camadas ?? []).map((k) => k.imagem)]) new Image().src = im;
  }
  est.tela.classList.toggle('cinema', !!c.cinema);
  mostrarQuadro(est, c, mestre);
  tocarMusica(c.musica);
}

function abrir(app: App, c: CenaAoVivo, mestre: boolean): Estado {
  const legenda = h('div', { class: 'cn-legenda' });
  const nota = h('div', { class: 'cn-nota hidden' });
  const contador = h('span', { class: 'cn-contador' });
  const progresso = h('div', { class: 'cn-progresso' }, h('i'));
  const voltar = h('button', { class: 'cn-bt', type: 'button', title: 'Quadro anterior (←)', 'aria-label': 'Quadro anterior', onclick: () => ir(-1) }, ic('esquerda')) as HTMLButtonElement;
  const proximo = h('button', { class: 'cn-bt forte', type: 'button', onclick: () => ir(1) }) as HTMLButtonElement;
  const somBt = h('button', { class: 'cn-bt', type: 'button', title: 'Ligar ou desligar o som só aqui', 'aria-label': 'Som', onclick: () => alternarSom() }, ic('radio')) as HTMLButtonElement;
  const temTempo = c.quadros.some((q) => q.duracao);
  const pausaBt = temTempo ? (h('button', { class: 'cn-bt', type: 'button', title: 'Parar ou retomar a passagem sozinha (P)', 'aria-label': 'Pausar', onclick: () => pausar() }, h('span', null, 'Pausa')) as HTMLButtonElement) : null;
  const fecharBt = h('button', { class: 'cn-bt', type: 'button', title: 'Voltar ao tabuleiro (Esc)', 'aria-label': 'Voltar ao tabuleiro', onclick: () => app.net.send({ t: 'cenaFechar' }) }, ic('fechar')) as HTMLButtonElement;
  const barra = mestre ? h('div', { class: 'cn-barra' }, voltar, contador, proximo, ...(pausaBt ? [pausaBt] : []), somBt, fecharBt) : null;
  const tela = h('div', { class: 'cn-tela', role: 'dialog', 'aria-label': c.titulo }, h('div', { class: 'cn-vinheta' }), legenda, nota, progresso, barra);
  tela.classList.add(mestre ? 'mestre' : 'plateia');

  const ir = (d: number) => {
    if (!est) return;
    sfx.click();
    const alvo = est.quadro + d;
    if (alvo >= c.quadros.length) app.net.send({ t: 'cenaFechar' });
    else if (alvo >= 0) app.net.send({ t: 'cenaQuadro', quadro: alvo });
  };
  const pausar = () => est && app.net.send({ t: 'cenaPausa', pausada: !est.pausada });
  const alternarSom = () => {
    mudo = !mudo;
    somBt.classList.toggle('mudo', mudo);
    if (audio) fade(audio, mudo ? 0 : VOLUME, 500);
  };
  const tecla = (ev: KeyboardEvent) => {
    if (!mestre) return;
    const k = ev.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'Enter') ir(1);
    else if (k === 'ArrowLeft') ir(-1);
    else if ((k === 'p' || k === 'P') && pausaBt) pausar();
    else if (k === 'Escape') app.net.send({ t: 'cenaFechar' });
    else return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };
  addEventListener('keydown', tecla, true);
  document.body.append(tela);
  requestAnimationFrame(() => tela.classList.add('on'));
  const fim = () => {
    removeEventListener('keydown', tecla, true);
    if (est?.tela === tela) {
      clearInterval(est.digitando);
      est = null;
    }
    pararMusica();
    tela.classList.remove('on');
    tela.classList.add('saindo');
    setTimeout(() => tela.remove(), 1100);
  };
  return { id: c.id, tela, atual: null, legenda, nota, contador, proximo, voltar, pausaBt, progresso, quadro: -1, pausada: false, digitando: 0, fim };
}

/** Monta o quadro: a ilustração, as camadas da colagem e a câmera andando. */
function montarQuadro(q: CenaQuadro, vwNow = innerWidth, vhNow = innerHeight): HTMLElement {
  const fundo = h('img', { class: 'cn-fundo', src: q.imagem, alt: '', draggable: 'false' }) as HTMLImageElement;
  const palco = h('div', { class: 'cn-palco' }, fundo);
  const camadas = (q.camadas ?? []).map((k) => {
    const im = h('img', { class: `cn-camada ent-${k.entrada ?? 'fade'}`, src: k.imagem, alt: '', draggable: 'false' }) as HTMLImageElement;
    im.style.animationDelay = `${k.atraso ?? 0}s`;
    if (k.duracao) im.style.animationDuration = `${k.duracao}s`;
    return { k, im };
  });
  for (const { im } of camadas) palco.append(im);
  const mov = q.movimento === 'tremor' ? ' tremor' : q.movimento === 'tremorForte' ? ' tremor forte' : q.movimento === 'correndo' ? ' correndo' : q.movimento === 'queda' ? ' queda' : '';
  const quadro = h('div', { class: `cn-quadro${mov}` }, palco);
  if (q.duracao) quadro.style.setProperty('--dur', `${q.duracao}s`);
  const ms = q.duracao ? q.duracao * 1000 : CAMERA_MANUAL_MS;
  const [de, para] = q.camera ? [q.camera.de, q.camera.para] : focosDoMovimento(q.movimento);
  const ligar = () => {
    const iw = fundo.naturalWidth || 1920;
    const ih = fundo.naturalHeight || 1080;
    palco.style.width = `${iw}px`;
    palco.style.height = `${ih}px`;
    const vw = quadro.clientWidth || vwNow;
    const vh = quadro.clientHeight || vhNow;
    const a = transformDoFoco(de, iw, ih, vw, vh);
    const b = transformDoFoco(para, iw, ih, vw, vh);
    palco.style.transform = a;
    if (a !== b && !matchMedia('(prefers-reduced-motion: reduce)').matches) palco.animate([{ transform: a }, { transform: b }], { duration: ms, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' });
    // a profundidade: a peça mais "na frente" cresce um tiquinho mais que o fundo durante o quadro (volume sem 3D)
    for (const { k, im } of camadas) if (k.prof && !matchMedia('(prefers-reduced-motion: reduce)').matches) im.animate([{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.035 * k.prof})` }], { duration: ms, easing: 'linear', fill: 'forwards' });
  };
  if (fundo.complete && fundo.naturalWidth) ligar();
  else {
    fundo.addEventListener('load', ligar, { once: true });
    // sem esperar para sempre: se a imagem não vier, a câmera usa o tamanho de uma tela
    setTimeout(() => !palco.style.width && ligar(), 1500);
  }
  return quadro;
}

function digitar(e: Estado, texto: string) {
  clearInterval(e.digitando);
  e.legenda.textContent = '';
  if (!texto) {
    e.legenda.classList.remove('on');
    return;
  }
  e.legenda.classList.add('on');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    e.legenda.textContent = texto;
    return;
  }
  let i = 0;
  const passo = Math.max(18, Math.min(45, 2400 / texto.length));
  e.digitando = window.setInterval(() => {
    i++;
    e.legenda.textContent = texto.slice(0, i);
    if (i >= texto.length) clearInterval(e.digitando);
  }, passo);
}

function mostrarQuadro(e: Estado, c: CenaAoVivo, mestre: boolean) {
  const i = Math.max(0, Math.min(c.quadros.length - 1, c.quadro));
  const q = c.quadros[i];
  const mudouQuadro = e.quadro !== i;
  if (mudouQuadro) {
    const velho = e.atual;
    const novo = montarQuadro(q);
    const tr = q.transicao ?? 'fade';
    novo.classList.add(`tr-${tr}`);
    e.tela.insertBefore(novo, e.tela.querySelector('.cn-vinheta'));
    e.atual = novo;
    if (tr === 'olho') {
      // as pálpebras: fecham sobre o quadro de antes, a tela fica preta um instante e abrem no novo
      const olho = h('div', { class: 'cn-olho' }, h('i'), h('i'));
      e.tela.append(olho);
      setTimeout(() => olho.remove(), 2600);
    }
    if (velho) {
      if (tr === 'corte' || tr === 'flash') velho.remove();
      else if (tr === 'olho') setTimeout(() => velho.remove(), 1000);
      else if (tr === 'preto') {
        velho.classList.add('some');
        setTimeout(() => velho.remove(), 800);
      } else setTimeout(() => velho.remove(), 1600);
    }
    if (tr === 'flash' && velho) {
      const clarao = h('div', { class: 'cn-clarao' });
      e.tela.append(clarao);
      setTimeout(() => clarao.remove(), 700);
    }
    if (tr === 'olho') setTimeout(() => novo.classList.add('on'), 1000);
    else requestAnimationFrame(() => requestAnimationFrame(() => novo.classList.add('on')));
    tocarEfeito(q.som);
    // a legenda troca com um respiro: some, e volta digitada
    e.legenda.classList.remove('on');
    const espera = e.quadro < 0 ? 700 : tr === 'preto' ? 1300 : 500;
    clearInterval(e.digitando);
    e.digitando = window.setTimeout(() => e.legenda.isConnected && digitar(e, q.legenda ?? ''), espera);
  }
  e.quadro = i;
  // a barra de tempo do quadro que passa sozinho (para quando está em pausa)
  e.pausada = !!c.pausada;
  const barraTempo = e.progresso.firstElementChild as HTMLElement;
  if (mudouQuadro) {
    e.progresso.classList.toggle('ativa', !!q.duracao);
    barraTempo.style.animation = 'none';
    void barraTempo.offsetWidth;
    barraTempo.style.animation = q.duracao ? `cn-tempo ${q.duracao}s linear forwards` : '';
  }
  barraTempo.style.animationPlayState = e.pausada ? 'paused' : 'running';
  if (mestre) {
    e.contador.textContent = `${i + 1} / ${c.quadros.length}`;
    e.voltar.disabled = i === 0;
    const ultimo = i === c.quadros.length - 1;
    e.proximo.replaceChildren(ic(ultimo ? 'ok' : 'direita'), h('span', null, ultimo ? 'Voltar ao tabuleiro' : 'Avançar'));
    e.proximo.title = ultimo ? 'Fechar a cena e voltar ao tabuleiro (→)' : 'Próximo quadro (→ ou espaço)';
    if (e.pausaBt) {
      e.pausaBt.classList.toggle('mudo', false);
      e.pausaBt.firstElementChild!.textContent = e.pausada ? 'Retomar' : 'Pausa';
    }
    e.nota.replaceChildren(h('small', null, 'SÓ VOCÊ VÊ'), h('p', null, q.nota ?? ''));
    e.nota.classList.toggle('hidden', !q.nota);
  }
}
