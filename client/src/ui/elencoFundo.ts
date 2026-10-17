/**
 * O fundo vivo do retrato da ameaça no Elenco (17/10, o Felipe: "o bicho é de sangue, aí desce um sangue ali; se é de
 * morte fica desenhando uns espirais no fundo; conhecimento fica passando os sigilos; e energia, além de raios, fica meio
 * caótico"). Um canvas atrás da imagem, desenhado por código; os sigilos são inventados aqui (nunca os oficiais).
 * Para sozinho quando sai da tela; com "menos movimento" no sistema, fica num quadro parado.
 */

export type Fundo = 'sangue' | 'morte' | 'conhecimento' | 'energia' | 'medo' | 'neutro';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function fundoDoElemento(elemento?: string): HTMLCanvasElement {
  const tipo: Fundo = (['sangue', 'morte', 'conhecimento', 'energia', 'medo'] as const).find((e) => e === elemento) ?? 'neutro';
  const cv = document.createElement('canvas');
  cv.className = `el-d-fundo el-d-fundo-${tipo}`;
  cv.setAttribute('aria-hidden', 'true');
  const g = cv.getContext('2d')!;
  let w = 0;
  let hh = 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const medir = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return false;
    w = r.width;
    hh = r.height;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(hh * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  };
  const desenha = criar(tipo, g, () => [w, hh]);
  const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ultimo = performance.now();
  let pronto = false;
  const quadro = (agora: number) => {
    if (!cv.isConnected) {
      // ainda não entrou na tela (o painel monta antes de pôr no lugar) ou já saiu: espera um pouco e para
      if (agora - ultimo > 3000) return;
      requestAnimationFrame(quadro);
      return;
    }
    if (!pronto || cv.width !== Math.round(cv.getBoundingClientRect().width * dpr)) pronto = medir();
    if (!pronto) return void requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    desenha(dt, agora / 1000);
    if (parado) return;
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
  return cv;
}

/** O pintor de um fundo (exportado para conferir os quadros sem depender da tela visível). */
export function criar(tipo: Fundo, g: CanvasRenderingContext2D, tam: () => [number, number]): (dt: number, t: number) => void {
  switch (tipo) {
    case 'sangue':
      return sangue(g, tam);
    case 'morte':
      return morte(g, tam);
    case 'conhecimento':
      return conhecimento(g, tam);
    case 'energia':
      return energia(g, tam);
    case 'medo':
      return medo(g, tam);
    default:
      return poeira(g, tam);
  }
}

/** Sangue: a borda de cima encharcada e os fios escorrendo, cada um com a gota na ponta, que cai e recomeça. */
function sangue(g: CanvasRenderingContext2D, tam: () => [number, number]) {
  type Fio = { x: number; y: number; v: number; r: number; espera: number };
  const fios: Fio[] = [];
  const gotas: { x: number; y: number; v: number; r: number }[] = [];
  const novo = (w: number): Fio => ({ x: rnd(0.03, 0.97) * w, y: rnd(4, 14), v: rnd(16, 38), r: rnd(2.2, 4.6), espera: rnd(0, 1.6) });
  return (dt: number) => {
    const [w, h] = tam();
    while (fios.length < Math.max(9, Math.round(w / 20))) fios.push(novo(w));
    g.clearRect(0, 0, w, h);
    // a borda de cima, escura e brilhando
    const topo = g.createLinearGradient(0, 0, 0, h * 0.22);
    topo.addColorStop(0, 'rgba(120, 8, 8, 0.85)');
    topo.addColorStop(1, 'rgba(60, 0, 0, 0)');
    g.fillStyle = topo;
    g.fillRect(0, 0, w, h * 0.22);
    // a borda encharcada, ondulada
    g.fillStyle = 'rgba(140, 10, 10, 0.95)';
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= w; x += 6) g.lineTo(x, 6 + Math.sin(x * 0.13) * 3 + Math.sin(x * 0.041) * 4);
    g.lineTo(w, 0);
    g.closePath();
    g.fill();
    for (const f of fios) {
      if (f.espera > 0) {
        f.espera -= dt;
        continue;
      }
      f.y += f.v * dt;
      // o fio: escuro e mais grosso perto da gota
      const grad = g.createLinearGradient(0, 0, 0, f.y);
      grad.addColorStop(0, 'rgba(110, 6, 6, 0.9)');
      grad.addColorStop(1, 'rgba(170, 18, 18, 0.95)');
      g.strokeStyle = grad;
      g.lineWidth = f.r;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(f.x, 0);
      g.lineTo(f.x, f.y);
      g.stroke();
      g.fillStyle = 'rgba(190, 24, 24, 0.95)';
      g.beginPath();
      g.arc(f.x, f.y, f.r * 1.25, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255, 140, 140, 0.45)';
      g.beginPath();
      g.arc(f.x - f.r * 0.4, f.y - f.r * 0.4, f.r * 0.35, 0, Math.PI * 2);
      g.fill();
      if (f.y > h * rnd(0.35, 0.95)) {
        gotas.push({ x: f.x, y: f.y, v: 40, r: f.r * 1.1 });
        Object.assign(f, novo(w));
      }
    }
    for (let i = gotas.length - 1; i >= 0; i--) {
      const d = gotas[i];
      d.v += 380 * dt;
      d.y += d.v * dt;
      g.fillStyle = 'rgba(190, 24, 24, 0.9)';
      g.beginPath();
      g.ellipse(d.x, d.y, d.r, d.r * 1.5, 0, 0, Math.PI * 2);
      g.fill();
      if (d.y > h + 10) gotas.splice(i, 1);
    }
  };
}

/** Morte: espirais que se desenham devagar, do centro para fora, e somem; o fundo cinza de cinza. */
function morte(g: CanvasRenderingContext2D, tam: () => [number, number]) {
  type Esp = { x: number; y: number; r: number; t: number; dur: number; giro: number; sentido: number };
  const esps: Esp[] = [];
  const nova = (w: number, h: number): Esp => ({ x: rnd(0.1, 0.9) * w, y: rnd(0.1, 0.9) * h, r: rnd(0.2, 0.42) * Math.min(w, h * 1.4), t: 0, dur: rnd(4, 7), giro: rnd(0, Math.PI * 2), sentido: Math.random() < 0.5 ? -1 : 1 });
  return (dt: number) => {
    const [w, h] = tam();
    while (esps.length < 5) esps.push({ ...nova(w, h), t: rnd(0, 5) });
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < esps.length; i++) {
      const e = esps[i];
      e.t += dt;
      const p = Math.min(1, e.t / (e.dur * 0.65));
      const some = e.t > e.dur * 0.65 ? 1 - (e.t - e.dur * 0.65) / (e.dur * 0.35) : 1;
      if (e.t > e.dur) {
        esps[i] = nova(w, h);
        continue;
      }
      const voltas = 3.2;
      const passos = Math.floor(160 * p);
      g.strokeStyle = `rgba(196, 188, 214, ${0.62 * some})`;
      g.lineWidth = 1.8;
      g.beginPath();
      for (let k = 0; k <= passos; k++) {
        const a = (k / 160) * voltas * Math.PI * 2;
        const rr = (k / 160) * e.r;
        const x = e.x + Math.cos(e.giro + a * e.sentido) * rr;
        const y = e.y + Math.sin(e.giro + a * e.sentido) * rr * 0.9;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      e.giro += dt * 0.15 * e.sentido;
    }
  };
}

/** Conhecimento: sigilos inventados (círculo, traços e pontos) passando e subindo, dourados, acendendo e apagando. */
function conhecimento(g: CanvasRenderingContext2D, tam: () => [number, number]) {
  type Sig = { x: number; y: number; s: number; vx: number; vy: number; t: number; dur: number; partes: number[] };
  const sigs: Sig[] = [];
  const novo = (w: number, h: number): Sig => ({ x: rnd(-0.1, 1.1) * w, y: rnd(0.2, 1.05) * h, s: rnd(12, 26), vx: rnd(-8, 8), vy: rnd(-16, -6), t: 0, dur: rnd(3, 6), partes: Array.from({ length: 7 }, () => Math.random()) });
  const desenhar = (sg: Sig, a: number) => {
    const { x, y, s, partes: p } = sg;
    g.strokeStyle = `rgba(233, 190, 90, ${a})`;
    g.fillStyle = `rgba(255, 220, 140, ${a})`;
    g.lineWidth = 1.3;
    g.beginPath();
    if (p[0] < 0.5) g.arc(x, y, s, 0, Math.PI * 2);
    else {
      g.moveTo(x, y - s);
      g.lineTo(x + s, y);
      g.lineTo(x, y + s);
      g.lineTo(x - s, y);
      g.closePath();
    }
    g.stroke();
    // os traços de dentro
    const n = 2 + Math.floor(p[1] * 3);
    for (let i = 0; i < n; i++) {
      const a1 = p[(i + 2) % 7] * Math.PI * 2;
      const a2 = a1 + Math.PI * (0.5 + p[(i + 3) % 7]);
      g.beginPath();
      g.moveTo(x + Math.cos(a1) * s * 0.85, y + Math.sin(a1) * s * 0.85);
      g.lineTo(x + Math.cos(a2) * s * 0.3 * p[i % 7], y + Math.sin(a2) * s * 0.3);
      g.stroke();
    }
    g.beginPath();
    g.arc(x + (p[4] - 0.5) * s * 0.6, y + (p[5] - 0.5) * s * 0.6, 1.8, 0, Math.PI * 2);
    g.fill();
  };
  return (dt: number) => {
    const [w, h] = tam();
    while (sigs.length < 9) sigs.push({ ...novo(w, h), t: rnd(0, 4) });
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < sigs.length; i++) {
      const sg = sigs[i];
      sg.t += dt;
      sg.x += sg.vx * dt;
      sg.y += sg.vy * dt;
      if (sg.t > sg.dur) {
        sigs[i] = novo(w, h);
        continue;
      }
      const a = Math.sin((sg.t / sg.dur) * Math.PI) * 0.55;
      desenhar(sg, a);
    }
  };
}

/** Energia: raios que caem e piscam, faíscas tremendo e a cor mudando sem parar: caótico. */
function energia(g: CanvasRenderingContext2D, tam: () => [number, number]) {
  type Raio = { pts: [number, number][]; vida: number; cor: string };
  const raios: Raio[] = [];
  const faiscas: { x: number; y: number; vx: number; vy: number; v: number }[] = [];
  let prox = 0;
  const cores = ['180, 110, 255', '255, 90, 200', '120, 220, 255', '255, 240, 140'];
  const raio = (w: number, h: number): Raio => {
    const pts: [number, number][] = [];
    let x = rnd(0.1, 0.9) * w;
    let y = -5;
    pts.push([x, y]);
    while (y < h) {
      y += rnd(10, 22);
      x += rnd(-16, 16);
      pts.push([x, y]);
    }
    return { pts, vida: rnd(0.12, 0.3), cor: cores[Math.floor(Math.random() * cores.length)] };
  };
  return (dt: number, t: number) => {
    const [w, h] = tam();
    // o rastro: o quadro anterior apaga aos poucos (os raios deixam um brilho que some)
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    // o plasma: manchas de cor que trocam e se mexem sem parar
    for (let k = 0; k < 4; k++) {
      const cx = (0.5 + 0.45 * Math.sin(t * (0.7 + k * 0.37) + k * 2.1)) * w;
      const cy = (0.5 + 0.45 * Math.cos(t * (0.9 + k * 0.29) + k)) * h;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.4);
      gr.addColorStop(0, `rgba(${cores[(k + Math.floor(t * 2)) % cores.length]}, 0.10)`);
      gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    prox -= dt;
    if (prox <= 0) {
      raios.push(raio(w, h));
      if (Math.random() < 0.35) raios.push(raio(w, h));
      prox = rnd(0.12, 0.5);
    }
    for (let i = raios.length - 1; i >= 0; i--) {
      const r = raios[i];
      r.vida -= dt;
      if (r.vida <= 0) {
        raios.splice(i, 1);
        continue;
      }
      for (const [lw, a] of [
        [5, 0.18],
        [1.6, 0.95],
      ] as const) {
        g.strokeStyle = `rgba(${r.cor}, ${a})`;
        g.lineWidth = lw;
        g.beginPath();
        r.pts.forEach(([x, y], k) => (k ? g.lineTo(x + rnd(-1.5, 1.5), y) : g.moveTo(x, y)));
        g.stroke();
      }
    }
    while (faiscas.length < 26) faiscas.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-40, 40), vy: rnd(-40, 40), v: rnd(0.3, 1.2) });
    for (let i = faiscas.length - 1; i >= 0; i--) {
      const f = faiscas[i];
      f.v -= dt;
      f.x += (f.vx + rnd(-120, 120)) * dt;
      f.y += (f.vy + rnd(-120, 120)) * dt;
      if (f.v <= 0) {
        faiscas.splice(i, 1);
        continue;
      }
      g.fillStyle = `rgba(${cores[i % cores.length]}, ${Math.min(1, f.v) * 0.8})`;
      g.fillRect(f.x, f.y, 2, 2);
    }
  };
}

/** Medo: névoa pálida passando devagar e, de vez em quando, um chiado de estática e a luz falhando. */
function medo(g: CanvasRenderingContext2D, tam: () => [number, number]) {
  const nevoas = Array.from({ length: 6 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(0.35, 0.7), v: rnd(0.01, 0.03) }));
  let chiado = 0;
  return (dt: number, t: number) => {
    const [w, h] = tam();
    g.clearRect(0, 0, w, h);
    for (const n of nevoas) {
      n.x += n.v * dt;
      if (n.x > 1.4) n.x = -0.4;
      const cx = n.x * w;
      const cy = (n.y + Math.sin(t * 0.3 + n.r * 9) * 0.05) * h;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, n.r * w);
      gr.addColorStop(0, 'rgba(230, 225, 214, 0.07)');
      gr.addColorStop(1, 'rgba(230, 225, 214, 0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    chiado -= dt;
    if (chiado < -rnd(2, 5)) chiado = rnd(0.15, 0.4);
    if (chiado > 0) {
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(240, 236, 228, ${rnd(0.05, 0.25)})`;
        g.fillRect(0, rnd(0, h), w, rnd(0.5, 1.5));
      }
      g.fillStyle = 'rgba(0, 0, 0, 0.18)';
      g.fillRect(0, 0, w, h);
    }
  };
}

/** As mundanas e as do mestre: poeira na luz, devagar. */
function poeira(g: CanvasRenderingContext2D, tam: () => [number, number]) {
  const ps = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(0.01, 0.04), f: Math.random() * 6 }));
  return (dt: number, t: number) => {
    const [w, h] = tam();
    g.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.y -= p.v * dt;
      if (p.y < -0.05) p.y = 1.05;
      g.fillStyle = `rgba(220, 200, 160, ${0.18 + 0.15 * Math.sin(t + p.f)})`;
      g.fillRect(p.x * w + Math.sin(t * 0.5 + p.f) * 6, p.y * h, 1.6, 1.6);
    }
  };
}
