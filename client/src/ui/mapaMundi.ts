import type { LugarInfo } from '@crona/shared';
import { desenharBrasil, MAPA_H, MAPA_W } from '../render/mapaBrasil';
import { SPRITE_CENTRO, SPRITE_H, SPRITE_W, spriteDoLugar } from '../render/lugarSprites';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { sfx } from './sfx';

/**
 * O mapa-múndi (07/10): uma ilhazinha por LUGAR (a Base da Ordem, a Fazenda Olhos de Águia, o Orfanato...), no estilo
 * pixel art limpo das referências do Felipe. Clicar num lugar mostra o nome e os botões; o mestre arrasta as ilhas para
 * arrumar o mapa. Dois jeitos de abrir: para olhar (Abrir / Viajar para cá) ou para ESCOLHER o destino da viagem.
 * A tela é pequena (320 × 180) e cresce com pixels grandes; os nomes são texto de verdade por cima.
 */

const W = MAPA_W;
const H = MAPA_H;
const MAR = '#3fb1d6';

export interface OpcoesMapa {
  /** abrir só para escolher o destino da viagem: o botão vira "Escolher este destino" */
  escolher?: (l: LugarInfo) => void;
  /** o lugar já escolhido (aparece marcado) */
  marcado?: number | null;
  /** o botão Viajar para cá (o mestre, fora da viagem) */
  aoViajar?: (l: LugarInfo) => void;
}

const aleat = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** O fundo parado: o mar, as ondinhas e as estradas pontilhadas entre os lugares. */
function fundo(c: HTMLCanvasElement, lugares: LugarInfo[]) {
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = MAR;
  ctx.fillRect(0, 0, W, H);
  // o mar com uns tracinhos mais claros e mais escuros
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = aleat(i) < 0.5 ? '#48bbdf' : '#38a7cc';
    ctx.fillRect(Math.floor(aleat(i + 1000) * W), Math.floor(aleat(i + 2000) * H), 3 + Math.floor(aleat(i + 3000) * 4), 1);
  }
  // o Brasil flutuando
  desenharBrasil(ctx);
  // a estradinha pontilhada ligando cada lugar ao seguinte, por cima da terra
  const pts = [...lugares].sort((a, b) => a.x - b.x);
  ctx.fillStyle = '#fff3d2';
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = a.x * W;
    const ay = a.y * H + 4;
    const bx = b.x * W;
    const by = b.y * H + 4;
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2 + 10;
    const n = Math.max(14, Math.round(Math.hypot(bx - ax, by - ay) / 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
      const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
      if (k % 2 === 0) ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
}

/** Abre o mapa-múndi. */
export function abrirMapaMundi(app: App, o: OpcoesMapa = {}) {
  const escolhendo = !!o.escolher;
  let sel: number | null = o.marcado ?? null;
  const j = janela(escolhendo ? 'ESCOLHER O DESTINO' : 'MAPA-MÚNDI', 'globo', () => off(), 92);
  const tela = h('canvas', { class: 'mm-tela', width: W, height: H });
  const palco = h('div', { class: 'mm-palco' }, tela);
  const painel = h('div', { class: 'mm-info hidden' });
  palco.append(painel);
  const ctx = tela.getContext('2d')!;
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  let bgChave = '';
  let raf = 0;
  const nuvens = Array.from({ length: 7 }, (_, i) => ({ x: aleat(i + 70) * W, y: 14 + aleat(i + 80) * (H - 40), v: 1.4 + aleat(i + 90) * 2, t: 0.8 + aleat(i + 95) * 0.6, chove: aleat(i + 99) < 0.45 }));

  const lugares = () => app.state.lugares;
  const eu = () => app.isGm;

  const nuvem = (x: number, y: number, t: number, chove: boolean, now: number) => {
    const bx = Math.round(x);
    const by = Math.round(y);
    const s = t > 1.1 ? 1 : 0;
    // a nuvem de pixel: três camadas, a de baixo um pouco azulada
    ctx.fillStyle = '#d8eef7';
    ctx.fillRect(bx - 9 - s, by + 1, 19 + s * 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 8 - s, by - 2, 17 + s * 2, 3);
    ctx.fillRect(bx - 4, by - 5, 8, 3);
    ctx.fillRect(bx - 2 - s, by - 7, 5, 2);
    if (chove) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 5; k++) {
        const f = (now / 90 + k * 3) % 9;
        ctx.fillRect(bx - 7 + k * 3, by + 5 + Math.floor(f), 1, 2);
      }
    }
  };
  const brilhos = Array.from({ length: 10 }, (_, i) => ({ x: Math.floor(aleat(i + 300) * W), y: Math.floor(aleat(i + 310) * H), f: aleat(i + 320) * 6 }));

  const desenhar = (now: number) => {
    const ls = lugares();
    const chave = ls.map((l) => `${l.id}:${l.x.toFixed(3)}:${l.y.toFixed(3)}`).join('|');
    if (chave !== bgChave) {
      bgChave = chave;
      fundo(bg, ls);
    }
    ctx.drawImage(bg, 0, 0);
    // os brilhinhos no mar, piscando
    for (const b of brilhos) {
      const a = Math.sin(now / 600 + b.f);
      if (a < 0.3) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x, b.y - 1, 1, 3);
      ctx.fillRect(b.x - 1, b.y, 3, 1);
    }
    // as ilhas, de trás para a frente, balançando de leve (cada uma no seu tempo)
    for (const l of [...ls].sort((a, b) => a.y - b.y)) {
      const spr = spriteDoLugar(l.icone);
      const bob = Math.round(Math.sin(now / 900 + l.id * 1.7) * 2) - 6;
      const x = Math.round(l.x * W - SPRITE_CENTRO[0]);
      const y = Math.round(l.y * H - SPRITE_CENTRO[1]) + bob;
      // a sombra no chão, embaixo da ilha que flutua (ela sobe e desce, a sombra fica)
      ctx.fillStyle = 'rgba(20,30,40,0.28)';
      const yb = Math.round(l.y * H - SPRITE_CENTRO[1]);
      ctx.fillRect(x + 14, yb + SPRITE_H - 4, SPRITE_W - 28, 3);
      ctx.fillRect(x + 18, yb + SPRITE_H - 5, SPRITE_W - 36, 1);
      if (l.id === sel) {
        ctx.fillStyle = '#fff6d0';
        ctx.fillRect(x + 6, y + SPRITE_H - 17, SPRITE_W - 12, 1);
        ctx.fillRect(x + 6, y + SPRITE_H - 9, SPRITE_W - 12, 1);
      }
      ctx.drawImage(spr, x, y);
      if (l.aqui) {
        // a bandeirinha de quem está aqui
        const fx = Math.round(l.x * W) + 14;
        const fy = y + 10;
        ctx.fillStyle = '#2a1d2e';
        ctx.fillRect(fx, fy, 1, 11);
        ctx.fillStyle = '#e9a844';
        ctx.fillRect(fx + 1, fy, 6, 4);
      }
    }
    // as nuvens passando por cima
    for (const n of nuvens) {
      n.x += n.v / 60;
      if (n.x > W + 20) n.x = -20;
      nuvem(n.x, n.y, n.t, n.chove, now);
    }
    raf = requestAnimationFrame(desenhar);
  };

  const pinos = h('div', { class: 'mm-pinos' });
  palco.append(pinos);
  const fechado = () => !document.body.contains(j.el);

  const info = () => {
    const l = lugares().find((x) => x.id === sel);
    painel.classList.toggle('hidden', !l);
    if (!l) return;
    painel.replaceChildren(
      h('b', { class: 'mm-nome-grande' }, l.nome),
      h('small', null, `${l.salas} ${l.salas === 1 ? 'sala' : 'salas'}${l.aqui ? ' · vocês estão aqui' : ''}`),
      h(
        'div',
        { class: 'mm-bts' },
        ...(escolhendo
          ? [botao('Escolher este destino', 'bandeira', 'forte', () => (o.escolher!(l), j.fechar()))]
          : [
              ...(o.aoViajar && eu() ? [botao('Viajar para cá', 'correr', 'forte', () => (j.fechar(), o.aoViajar!(l)))] : []),
              ...(eu() ? [botao('Abrir', 'olho', 'claro', () => (app.net.send({ t: 'join', roomId: l.entrada }), j.fechar()))] : []),
            ]),
      ),
    );
  };

  const montarPinos = () => {
    pinos.replaceChildren(
      ...lugares().map((l) => {
        const pino = h(
          'button',
          {
            class: `mm-pino${l.id === sel ? ' on' : ''}${l.aqui ? ' aqui' : ''}`,
            type: 'button',
            style: `left:${l.x * 100}%;top:${l.y * 100}%`,
            'aria-label': l.nome,
          },
          h('span', { class: 'mm-nome' }, l.nome),
        );
        // arrastar (o mestre) ou clicar
        pino.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          const r = palco.getBoundingClientRect();
          const x0 = e.clientX;
          const y0 = e.clientY;
          let arrastou = false;
          const mover = (ev: PointerEvent) => {
            if (!eu() || escolhendo) return;
            if (!arrastou && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
            arrastou = true;
            l.x = Math.max(0.08, Math.min(0.92, (ev.clientX - r.left) / r.width));
            l.y = Math.max(0.1, Math.min(0.9, (ev.clientY - r.top) / r.height));
            pino.style.left = `${l.x * 100}%`;
            pino.style.top = `${l.y * 100}%`;
          };
          const soltar = () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', soltar);
            if (arrastou) app.net.send({ t: 'lugarMover', id: l.id, x: l.x, y: l.y });
            else {
              sfx.click();
              sel = l.id;
              montarPinos();
              info();
            }
          };
          window.addEventListener('pointermove', mover);
          window.addEventListener('pointerup', soltar);
        });
        return pino;
      }),
    );
  };

  const atualizar = () => {
    if (fechado()) return;
    montarPinos();
    info();
  };
  app.on('lugares', atualizar);
  const off = () => cancelAnimationFrame(raf);

  j.corpo.append(
    h('p', { class: 'vg-dica' }, escolhendo ? 'Toque no lugar para onde a van vai.' : eu() ? 'Toque num lugar. Arraste as ilhas para arrumar o mapa.' : 'O mundo da campanha.'),
    palco,
  );
  j.rodape.append(botao('Fechar', 'fechar', 'claro', () => j.fechar()));
  app.net.send({ t: 'lugares' });
  atualizar();
  raf = requestAnimationFrame(desenhar);
}
