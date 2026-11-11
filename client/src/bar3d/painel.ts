/**
 * A interface do protótipo 3D, no estilo da tela do jogador (azul-noite, borda bege, ouro, Pixelify Sans): o painel de ações do
 * objeto, o teclado numérico da senha, a etiqueta que segue o mouse, os avisos, a mochila e a ajuda (?). Tudo DOM por cima do
 * canvas; o 3D não sabe nada daqui.
 */

const CSS = `
@font-face { font-family: 'Pixel Numeros'; src: url('/fontes/silkscreen-400.woff2') format('woff2'); font-weight: 100 549; unicode-range: U+0030-0039; size-adjust: 92%; font-display: swap; }
@font-face { font-family: 'Pixel Numeros'; src: url('/fontes/silkscreen-700.woff2') format('woff2'); font-weight: 550 900; unicode-range: U+0030-0039; size-adjust: 92%; font-display: swap; }
@font-face { font-family: 'Pixel Letras'; src: url('/fontes/pixel-letras-400.woff2') format('woff2'); font-weight: 100 449; unicode-range: U+0043, U+0048, U+0063, U+00C7, U+00E7; font-display: swap; }
@font-face { font-family: 'Pixel Letras'; src: url('/fontes/pixel-letras-500.woff2') format('woff2'); font-weight: 450 549; unicode-range: U+0043, U+0048, U+0063, U+00C7, U+00E7; font-display: swap; }
@font-face { font-family: 'Pixel Letras'; src: url('/fontes/pixel-letras-600.woff2') format('woff2'); font-weight: 550 649; unicode-range: U+0043, U+0048, U+0063, U+00C7, U+00E7; font-display: swap; }
@font-face { font-family: 'Pixel Letras'; src: url('/fontes/pixel-letras-700.woff2') format('woff2'); font-weight: 650 900; unicode-range: U+0043, U+0048, U+0063, U+00C7, U+00E7; font-display: swap; }
.pr-painel, .pr-teclado, .pr-ajuda {
  --noite: #0b1526; --noite3: #142440; --campo: #060c16; --borda: #a18873; --ouro: #e9a944; --ouro-hi: #ffd27a; --texto: #f3e9d8; --texto2: #cdbfa9;
  position: fixed; z-index: 60; color: var(--texto); font: 500 14px/1.35 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; letter-spacing: 0.02em;
  background: linear-gradient(180deg, var(--noite3), var(--noite)); border: 3px solid var(--borda); border-radius: 10px;
  box-shadow: 0 0 0 2px #050b14, inset 0 0 0 2px rgba(161, 136, 115, 0.38), 0 14px 38px rgba(0, 0, 0, 0.6);
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
}
.pr-painel { right: 18px; top: 74px; width: 272px; padding: 12px 14px 14px; animation: pr-entra 0.18s ease-out; }
.pr-painel h3 { margin: 0 24px 2px 0; font: 700 17px/1.15 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: var(--ouro-hi); letter-spacing: 0.03em; }
.pr-painel .pr-sub { color: var(--texto2); font-size: 11px; margin-bottom: 8px; border-bottom: 2px solid rgba(161, 136, 115, 0.38); padding-bottom: 6px; }
.pr-painel p { margin: 0 0 10px; color: var(--texto); font-size: 13px; }
.pr-x { position: absolute; right: 8px; top: 8px; width: 24px; height: 24px; border: 2px solid rgba(161, 136, 115, 0.6); border-radius: 6px; background: var(--campo); color: var(--texto2); font: 700 14px/1 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; cursor: pointer; }
.pr-x:hover { border-color: #e0584a; color: #ff8a7a; }
.pr-bt { display: block; width: 100%; box-sizing: border-box; margin: 6px 0 0; padding: 8px 10px; text-align: left; cursor: pointer; color: var(--texto); font: 600 14px/1.1 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; letter-spacing: 0.03em;
  background: var(--campo); border: 2px solid rgba(161, 136, 115, 0.55); border-radius: 7px; }
.pr-bt:hover:not(:disabled) { border-color: var(--ouro); color: var(--ouro-hi); background: #0c1a30; }
.pr-bt:disabled { opacity: 0.45; cursor: default; }
.pr-bt.forte { background: linear-gradient(180deg, #f2b856, #c4852a); color: #1a1006; border-color: #ffd27a; text-shadow: none; }
.pr-bt.forte:hover:not(:disabled) { color: #000; border-color: #fff0c0; background: linear-gradient(180deg, #ffc866, #d4952a); }
.pr-bt kbd { float: right; font: 600 11px 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: var(--texto2); border: 1px solid rgba(161,136,115,0.5); border-radius: 4px; padding: 0 5px; }

.pr-teclado { left: min(78%, calc(100% - 136px)); top: 50%; width: 244px; transform: translate(-50%, -50%); padding: 12px 14px 14px; animation: pr-entra 0.18s ease-out; }
.pr-teclado h3 { margin: 0 24px 2px 0; font: 700 16px/1.15 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: var(--ouro-hi); letter-spacing: 0.03em; }
.pr-teclado .pr-sub { color: var(--texto2); font-size: 11px; margin-bottom: 8px; }
.pr-visor { display: flex; gap: 8px; justify-content: center; margin: 4px 0 10px; padding: 8px; background: #031008; border: 2px solid #1d4a2a; border-radius: 6px; box-shadow: inset 0 0 14px rgba(40, 255, 120, 0.12); }
.pr-visor span { width: 36px; height: 42px; display: grid; place-items: center; font: 700 26px/1 'Silkscreen', 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: #54ff9a; text-shadow: 0 0 8px rgba(84, 255, 154, 0.7); border-bottom: 3px solid #1d6a3a; }
.pr-visor.erro span { color: #ff6a5a; border-bottom-color: #8a2a22; text-shadow: 0 0 8px rgba(255, 90, 70, 0.7); }
.pr-grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pr-grade .pr-bt { margin: 0; text-align: center; font-size: 17px; padding: 9px 0; }
.pr-msg { min-height: 16px; margin-top: 8px; font-size: 12px; text-align: center; color: var(--texto2); }
.pr-msg.erro { color: #ff8a7a; }
.pr-msg.ok { color: #7aff9a; }
.pr-teclado.treme { animation: pr-treme 0.42s linear; }

.pr-ajuda { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, 92vw); padding: 14px 18px 16px; max-height: 84vh; overflow: auto; }
.pr-ajuda h3 { margin: 0 28px 8px 0; font: 700 18px/1.1 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: var(--ouro-hi); letter-spacing: 0.04em; }
.pr-ajuda h4 { margin: 12px 0 4px; font: 700 13px/1 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: var(--ouro); letter-spacing: 0.05em; }
.pr-ajuda dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 0; font-size: 13px; }
.pr-ajuda dt { color: var(--ouro-hi); font-weight: 700; }
.pr-ajuda dd { margin: 0; color: var(--texto); }

.pr-etiqueta { position: fixed; z-index: 55; pointer-events: none; padding: 3px 8px; font: 600 12px/1.2 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: #f3e9d8; background: rgba(8, 12, 24, 0.88); border: 2px solid #a18873; border-radius: 5px; white-space: nowrap; transform: translate(14px, 14px); }
.pr-etiqueta small { display: block; color: #ffd27a; font-size: 10px; }
.pr-toast { position: fixed; z-index: 58; left: 50%; bottom: 74px; transform: translateX(-50%); padding: 8px 16px; max-width: 80vw; text-align: center; font: 600 13px/1.3 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: #f3e9d8; background: rgba(8, 14, 28, 0.94); border: 2px solid #a18873; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); animation: pr-toast 3.4s ease-out forwards; pointer-events: none; }
.pr-toast.erro { border-color: #e0584a; color: #ffb0a4; }
.pr-mochila { position: fixed; z-index: 52; left: 14px; top: 62px; display: none; gap: 6px; align-items: center; flex-wrap: wrap; max-width: 46vw; font: 600 12px 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: #cdbfa9; }
.pr-mochila.tem { display: flex; }
.pr-mochila button { cursor: pointer; padding: 3px 8px; color: #f3e9d8; font: 600 12px 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; background: rgba(8, 14, 28, 0.9); border: 2px solid #a18873; border-radius: 6px; }
.pr-mochila button:hover { border-color: #e9a944; color: #ffd27a; }
.pr-sel { position: fixed; z-index: 52; left: 50%; transform: translateX(-50%); top: 12px; padding: 6px 12px; font: 600 13px 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; color: #ffd27a; background: rgba(8, 14, 28, 0.88); border: 2px solid #a18873; border-radius: 8px; text-align: center; line-height: 1.35; }
.pr-sel small { display: block; color: #cdbfa9; font-size: 11px; }
.pr-sel .pr-aj { cursor: pointer; margin-left: 8px; padding: 0 7px; border: 2px solid #a18873; border-radius: 12px; background: #060c16; color: #ffd27a; font: 700 13px 'Pixel Numeros', 'Pixel Letras', 'Pixelify Sans', monospace; }
body.foto .pr-sel, body.foto .pr-mochila { display: none !important; }
@media (max-width: 520px) { .pr-teclado { left: 50%; } }
@keyframes pr-entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.pr-teclado { animation-name: pr-entra-c; }
@keyframes pr-entra-c { from { opacity: 0; transform: translate(-50%, -46%); } to { opacity: 1; transform: translate(-50%, -50%); } }
@keyframes pr-treme { 0%,100% { transform: translate(-50%, -50%); } 12% { transform: translate(calc(-50% - 9px), -50%); } 25% { transform: translate(calc(-50% + 9px), -50%); } 38% { transform: translate(calc(-50% - 7px), -50%); } 52% { transform: translate(calc(-50% + 7px), -50%); } 68% { transform: translate(calc(-50% - 4px), -50%); } 82% { transform: translate(calc(-50% + 3px), -50%); } }
@keyframes pr-toast { 0% { opacity: 0; transform: translate(-50%, 8px); } 8% { opacity: 1; transform: translate(-50%, 0); } 84% { opacity: 1; } 100% { opacity: 0; } }
`;

export interface Acao {
  rotulo: string;
  fazer: () => void;
  forte?: boolean;
  desativada?: boolean;
  tecla?: string;
}

export interface DadosPainel {
  titulo: string;
  sub?: string;
  texto: string;
  acoes: Acao[];
}

/** Os sons curtos do protótipo (WebAudio, sem arquivo). */
let ac: AudioContext | null = null;
function tom(freq: number, dur: number, tipo: OscillatorType = 'square', vol = 0.05, ini = 0, fim = freq) {
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') void ac.resume();
    const t0 = ac.currentTime + ini;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, fim), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {
    // sem áudio: segue sem som
  }
}
export const som = {
  clique: () => tom(880, 0.05, 'square', 0.03),
  tecla: () => tom(660 + Math.random() * 60, 0.04, 'square', 0.025),
  erro: () => (tom(200, 0.18, 'sawtooth', 0.06), tom(140, 0.28, 'sawtooth', 0.06, 0.16)),
  ok: () => (tom(660, 0.09, 'square', 0.045), tom(880, 0.09, 'square', 0.045, 0.09), tom(1320, 0.18, 'square', 0.04, 0.18)),
  desliza: () => tom(110, 0.8, 'triangle', 0.06, 0, 70),
  pega: () => tom(520, 0.07, 'triangle', 0.05, 0, 760),
  luz: () => tom(300, 0.06, 'square', 0.04, 0, 520),
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export class Painel {
  private painel: HTMLDivElement | null = null;
  private teclado: HTMLDivElement | null = null;
  private ajudaEl: HTMLDivElement | null = null;
  private etiquetaEl = el('div', 'pr-etiqueta');
  private mochilaEl = el('div', 'pr-mochila');
  private selEl = el('div', 'pr-sel');
  private aoFecharPainel: (() => void) | null = null;
  private aoFecharTeclado: (() => void) | null = null;
  private teclasPainel = new Map<string, () => void>();

  constructor(onAjuda: () => void) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    // as fontes pixel do jogo (a Pixelify Sans e a Silkscreen dos números)
    const lk = document.createElement('link');
    lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=Silkscreen:wght@400;700&display=swap';
    document.head.append(lk);
    this.etiquetaEl.style.display = 'none';
    document.body.append(this.etiquetaEl, this.mochilaEl, this.selEl);
    this.selEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('pr-aj')) onAjuda();
    });
  }

  // ---------------------------------------------------------------- etiqueta, aviso, seleção, mochila
  etiqueta(titulo: string | null, sub: string | null, x = 0, y = 0) {
    if (!titulo) {
      this.etiquetaEl.style.display = 'none';
      return;
    }
    this.etiquetaEl.innerHTML = '';
    this.etiquetaEl.append(document.createTextNode(titulo));
    if (sub) this.etiquetaEl.append(el('small', undefined, sub));
    this.etiquetaEl.style.display = '';
    this.etiquetaEl.style.left = `${x}px`;
    this.etiquetaEl.style.top = `${y}px`;
  }

  toast(msg: string, erro = false) {
    const t = el('div', erro ? 'pr-toast erro' : 'pr-toast', msg);
    document.body.append(t);
    window.setTimeout(() => t.remove(), 3500);
  }

  selecionado(nome: string, estado: string) {
    this.selEl.innerHTML = '';
    const b = el('div');
    b.append(document.createTextNode(`▶ ${nome}`));
    const aj = el('button', 'pr-aj', '?');
    aj.title = 'Teclas e ações (?)';
    b.append(aj);
    this.selEl.append(b, el('small', undefined, estado));
  }

  mochila(itens: { id: number; nome: string }[], devolver: (id: number) => void) {
    this.mochilaEl.innerHTML = '';
    this.mochilaEl.classList.toggle('tem', itens.length > 0);
    if (!itens.length) return;
    this.mochilaEl.append(document.createTextNode('Mochila:'));
    for (const i of itens) {
      const b = el('button', undefined, i.nome);
      b.title = 'Clique para devolver ao lugar';
      b.addEventListener('click', () => devolver(i.id));
      this.mochilaEl.append(b);
    }
  }

  // ---------------------------------------------------------------- painel de ações do objeto
  get painelAberto() {
    return !!this.painel;
  }

  abrir(d: DadosPainel, aoFechar?: () => void) {
    this.fecharPainel(true);
    this.aoFecharPainel = aoFechar ?? null;
    const p = el('div', 'pr-painel');
    const x = el('button', 'pr-x', '×');
    x.addEventListener('click', () => this.fecharPainel());
    p.append(x, el('h3', undefined, d.titulo));
    if (d.sub) p.append(el('div', 'pr-sub', d.sub));
    const txt = el('p', undefined, d.texto);
    p.append(txt);
    this.teclasPainel.clear();
    for (const a of d.acoes) {
      const b = el('button', a.forte ? 'pr-bt forte' : 'pr-bt', a.rotulo);
      if (a.tecla) {
        const k = el('kbd', undefined, a.tecla.toUpperCase());
        b.append(k);
        this.teclasPainel.set(a.tecla.toLowerCase(), a.fazer);
      }
      b.disabled = !!a.desativada;
      b.addEventListener('click', () => {
        som.clique();
        a.fazer();
      });
      p.append(b);
    }
    document.body.append(p);
    this.painel = p;
    return txt;
  }

  /** Troca o texto do painel aberto (o resultado de examinar). */
  texto(t: string) {
    this.painel?.querySelector('p')?.replaceChildren(document.createTextNode(t));
  }

  teclaDoPainel(k: string): boolean {
    const f = this.teclasPainel.get(k.toLowerCase());
    if (!f || !this.painel) return false;
    som.clique();
    f();
    return true;
  }

  fecharPainel(semAviso = false) {
    this.painel?.remove();
    this.painel = null;
    this.teclasPainel.clear();
    const f = this.aoFecharPainel;
    this.aoFecharPainel = null;
    if (!semAviso) f?.();
  }

  // ---------------------------------------------------------------- o teclado numérico da senha
  get tecladoAberto() {
    return !!this.teclado;
  }

  /** Abre o teclado de `tam` dígitos; `enviar` devolve se o código está certo (errado: treme, apaga e deixa tentar de novo). */
  abrirTeclado(opc: { titulo: string; sub: string; tam: number; enviar: (codigo: string) => boolean }, aoFechar?: () => void) {
    this.fecharTeclado(true);
    this.aoFecharTeclado = aoFechar ?? null;
    let codigo = '';
    let trava = false;
    const t = el('div', 'pr-teclado');
    const x = el('button', 'pr-x', '×');
    x.addEventListener('click', () => this.fecharTeclado());
    const visor = el('div', 'pr-visor');
    const casas = Array.from({ length: opc.tam }, () => el('span', undefined, ''));
    visor.append(...casas);
    const msg = el('div', 'pr-msg', 'Digite a senha.');
    const pinta = () => casas.forEach((c, i) => (c.textContent = i < codigo.length ? '●' : ''));
    const enviar = () => {
      if (trava || codigo.length < opc.tam) return;
      trava = true;
      const certo = opc.enviar(codigo);
      if (certo) {
        msg.textContent = 'SENHA CERTA';
        msg.className = 'pr-msg ok';
        som.ok();
        window.setTimeout(() => this.fecharTeclado(true), 520);
        return;
      }
      som.erro();
      visor.classList.add('erro');
      msg.textContent = 'SENHA ERRADA';
      msg.className = 'pr-msg erro';
      t.classList.remove('treme');
      void t.offsetWidth;
      t.classList.add('treme');
      window.setTimeout(() => {
        codigo = '';
        pinta();
        visor.classList.remove('erro');
        msg.textContent = 'Digite a senha.';
        msg.className = 'pr-msg';
        t.classList.remove('treme');
        trava = false;
      }, 700);
    };
    const digita = (d: string) => {
      if (trava || codigo.length >= opc.tam) return;
      codigo += d;
      som.tecla();
      pinta();
      if (codigo.length === opc.tam) window.setTimeout(enviar, 160);
    };
    const apaga = () => {
      if (trava) return;
      codigo = codigo.slice(0, -1);
      som.tecla();
      pinta();
    };
    const grade = el('div', 'pr-grade');
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      const b = el('button', 'pr-bt', d);
      b.addEventListener('click', () => digita(d));
      grade.append(b);
    }
    const bap = el('button', 'pr-bt', '⌫');
    bap.addEventListener('click', apaga);
    const b0 = el('button', 'pr-bt', '0');
    b0.addEventListener('click', () => digita('0'));
    const bok = el('button', 'pr-bt forte', 'OK');
    bok.addEventListener('click', enviar);
    grade.append(bap, b0, bok);
    t.append(x, el('h3', undefined, opc.titulo), el('div', 'pr-sub', opc.sub), visor, grade, msg);
    document.body.append(t);
    this.teclado = t;
    // o teclado do computador: dígitos, apagar, Enter e Esc (a captura segura as teclas 1–4 da câmera)
    const tecla = (e: KeyboardEvent) => {
      if (!this.teclado) return;
      if (e.key >= '0' && e.key <= '9') digita(e.key);
      else if (e.key === 'Backspace') apaga();
      else if (e.key === 'Enter') enviar();
      else if (e.key === 'Escape') this.fecharTeclado();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', tecla, true);
    (t as unknown as { __tecla: (e: KeyboardEvent) => void }).__tecla = tecla;
  }

  fecharTeclado(semAviso = false) {
    const t = this.teclado;
    if (!t) return;
    window.removeEventListener('keydown', (t as unknown as { __tecla: (e: KeyboardEvent) => void }).__tecla, true);
    t.remove();
    this.teclado = null;
    const f = this.aoFecharTeclado;
    this.aoFecharTeclado = null;
    if (!semAviso) f?.();
  }

  // ---------------------------------------------------------------- a ajuda (?)
  get ajudaAberta() {
    return !!this.ajudaEl;
  }

  alternarAjuda() {
    if (this.ajudaEl) {
      this.ajudaEl.remove();
      this.ajudaEl = null;
      return;
    }
    const a = el('div', 'pr-ajuda');
    const x = el('button', 'pr-x', '×');
    x.addEventListener('click', () => this.alternarAjuda());
    a.append(x, el('h3', undefined, 'Teclas e ações'));
    const bloco = (titulo: string, linhas: [string, string][]) => {
      a.append(el('h4', undefined, titulo));
      const dl = el('dl');
      for (const [k, v] of linhas) dl.append(el('dt', undefined, k), el('dd', undefined, v));
      a.append(dl);
    };
    bloco('Andar e escolher', [
      ['clique no chão', 'o agente escolhido anda até a casa (desvia dos móveis)'],
      ['clique num agente · Tab', 'escolhe o agente (Shift + Tab volta)'],
      ['W A S D · setas', 'andam o agente escolhido, pelo lado da câmera'],
      ['Esc', 'fecha o painel · para o agente'],
    ]);
    bloco('Objetos', [
      ['passar o mouse', 'contorno e o nome do móvel'],
      ['clique no objeto', 'o painel de ações: Examinar, Sentar, Ligar ou desligar a luz, Pegar, Abrir a porta'],
      ['a geladeira amarela', 'tem um teclado numérico: a senha desliza a geladeira e mostra a escada'],
      ['cadeiras, bancos, sofás', 'o agente anda até o lugar e senta (clique no chão para levantar)'],
      ['mochila (no alto)', 'clique num item para devolver ao lugar'],
    ]);
    bloco('Câmera e cena', [
      ['1 · 2 · 3 · 4', 'visão geral · mesa · atrás do ombro do escolhido (segue quando anda) · a porta'],
      ['T', 'grade de 1,5 m'],
      ['C · H', 'clima · hora'],
      ['P · O', 'pixelado (HD-2D) · paleta posterizada'],
      ['K · V · G', 'pixel ou standee · virar para a câmera · girar no lugar'],
      ['?', 'esta ajuda'],
    ]);
    document.body.append(a);
    this.ajudaEl = a;
  }

  /** Fecha o que estiver aberto (Esc); devolve se havia algo. */
  fecharTudo(): boolean {
    if (this.tecladoAberto) return this.fecharTeclado(), true;
    if (this.ajudaEl) return this.alternarAjuda(), true;
    if (this.painel) return this.fecharPainel(), true;
    return false;
  }

  /** O ponteiro está em cima de algum painel? */
  sobre(alvo: EventTarget | null): boolean {
    return alvo instanceof Node && [this.painel, this.teclado, this.ajudaEl, this.selEl, this.mochilaEl].some((p) => p?.contains(alvo));
  }
}
