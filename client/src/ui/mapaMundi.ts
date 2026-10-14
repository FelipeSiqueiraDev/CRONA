import type { LugarInfo } from '@crona/shared';
import { arteDoMapa, ilhaHD, SPRITE_CENTRO, SPRITE_H, SPRITE_W, spriteDoLugar } from '../render/lugarSprites';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { sfx } from './sfx';

/**
 * O mapa-múndi (07/10): uma ilhazinha por LUGAR (a Base da Ordem, a Fazenda Olhos de Águia, o Orfanato...), no estilo
 * pixel art limpo das referências do Felipe. Clicar num lugar mostra o nome e os botões; o mestre arrasta as ilhas para
 * arrumar o mapa. Dois jeitos de abrir: para olhar (Abrir / Viajar para cá) ou para ESCOLHER o destino da viagem.
 * A tela é pequena e cresce com pixels grandes; os nomes são texto de verdade por cima.
 *
 * Revisto em 09/10 (o Felipe): sem o Brasil, as estradinhas e as nuvens atrás (muita informação, tudo embolado). O
 * fundo é neutro e escuro, para a atenção ficar nos lugares; a tela ficou menor (288 × 162), então cada ilha ocupa
 * um quarto da largura e é ampliada em pixel inteiro (nítida); e as ilhas que se encostam se afastam sozinhas.
 */

const W = 288;
const H = 162;

export interface OpcoesMapa {
  /** abrir só para escolher o destino da viagem: o botão vira "Escolher este destino" */
  escolher?: (l: LugarInfo) => void;
  /** o lugar já escolhido (aparece marcado) */
  marcado?: number | null;
  /** o botão Viajar para cá (o mestre, fora da viagem) */
  aoViajar?: (l: LugarInfo) => void;
  /** o título da janela e o texto do botão de escolher */
  titulo?: string;
  rotulo?: string;
}

const aleat = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** O fundo parado: neutro, escuro, um pouco mais claro no meio (a luz em cima dos lugares) e uma névoa de pontinhos. */
function fundo(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.65);
  g.addColorStop(0, '#2a2f3a');
  g.addColorStop(1, '#0f1117');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = aleat(i) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(255,230,180,0.04)';
    ctx.fillRect(Math.floor(aleat(i + 1000) * W), Math.floor(aleat(i + 2000) * H), 1, 1);
  }
}

/**
 * Onde cada ilha fica de verdade: a posição do mestre, mas as que se encostam se afastam (umas voltas empurrando os
 * pares que se sobrepõem), sem sair da tela.
 */
function arrumar(ls: LugarInfo[]): Map<number, { x: number; y: number }> {
  const ps = ls.map((l) => ({ id: l.id, x: l.x * W, y: l.y * H }));
  const MX = SPRITE_W + 6;
  const MY = SPRITE_H - 6;
  for (let volta = 0; volta < 40; volta++) {
    let mexeu = false;
    for (let a = 0; a < ps.length; a++)
      for (let b = a + 1; b < ps.length; b++) {
        const dx = ps[b].x - ps[a].x;
        const dy = ps[b].y - ps[a].y;
        const ox = MX - Math.abs(dx);
        const oy = MY - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        mexeu = true;
        // empurra pelo eixo que precisa de menos (metade para cada um)
        if (ox / MX < oy / MY) {
          const s = (dx >= 0 ? 1 : -1) * (ox / 2 + 0.5);
          ps[a].x -= s;
          ps[b].x += s;
        } else {
          const s = (dy >= 0 ? 1 : -1) * (oy / 2 + 0.5);
          ps[a].y -= s;
          ps[b].y += s;
        }
      }
    for (const p of ps) {
      p.x = Math.max(SPRITE_CENTRO[0] + 2, Math.min(W - (SPRITE_W - SPRITE_CENTRO[0]) - 2, p.x));
      p.y = Math.max(SPRITE_CENTRO[1] + 2, Math.min(H - (SPRITE_H - SPRITE_CENTRO[1]) - 4, p.y));
    }
    if (!mexeu) break;
  }
  return new Map(ps.map((p) => [p.id, { x: p.x, y: p.y }]));
}

/** Abre o mapa-múndi. */
export function abrirMapaMundi(app: App, o: OpcoesMapa = {}) {
  const escolhendo = !!o.escolher;
  let sel: number | null = o.marcado ?? null;
  const j = janela(o.titulo ?? (escolhendo ? 'ESCOLHER O DESTINO' : 'MAPA-MÚNDI'), 'globo', () => off(), 92);
  const tela = h('canvas', { class: 'mm-tela', width: W, height: H });
  const palco = h('div', { class: 'mm-palco' }, tela);
  const painel = h('div', { class: 'mm-info hidden' });
  palco.append(painel);
  const ctx = tela.getContext('2d')!;
  // nítido (10/10): o canvas tem o tamanho de verdade na tela, em múltiplo inteiro da arte, e desenha com a escala k:
  // cada pixel da arte vira um bloco igual (sem a ampliação do navegador alternando 2 e 3 pixels)
  let k = 0;
  const ajustar = () => {
    const largura = palco.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    const novo = Math.max(1, Math.round(largura / W));
    if (novo === k) return;
    k = novo;
    tela.width = W * k;
    tela.height = H * k;
  };
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  let bgChave = '';
  let pos = new Map<number, { x: number; y: number }>();
  let raf = 0;

  const lugares = () => app.state.lugares;
  const eu = () => app.isGm;

  const brilhos = Array.from({ length: 18 }, (_, i) => ({ x: Math.floor(aleat(i + 300) * W), y: Math.floor(aleat(i + 310) * H), f: aleat(i + 320) * 6 }));

  const desenhar = (now: number) => {
    ajustar();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const ls = lugares();
    if (!bgChave) {
      bgChave = 'ok';
      fundo(bg);
    }
    ctx.drawImage(bg, 0, 0);
    // uns pontinhos de luz piscando devagar no fundo
    for (const b of brilhos) {
      const a = Math.sin(now / 900 + b.f);
      if (a < 0.6) continue;
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      ctx.fillRect(b.x, b.y, 1, 1);
    }
    pos = arrumar(ls);
    // as ilhas, de trás para a frente, balançando de leve (cada uma no seu tempo)
    for (const l of [...ls].sort((a, b) => pos.get(a.id)!.y - pos.get(b.id)!.y)) {
      const spr = spriteDoLugar(l.icone, l.nome);
      const p = pos.get(l.id)!;
      const bob = Math.round(Math.sin(now / 900 + l.id * 1.7) * 2) - 3;
      const x = Math.round(p.x - SPRITE_CENTRO[0]);
      const y = Math.round(p.y - SPRITE_CENTRO[1]) + bob;
      // a sombra embaixo da ilha que flutua (ela sobe e desce, a sombra fica)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const yb = Math.round(p.y - SPRITE_CENTRO[1]);
      ctx.fillRect(x + 14, yb + SPRITE_H - 4, SPRITE_W - 28, 3);
      ctx.fillRect(x + 18, yb + SPRITE_H - 5, SPRITE_W - 36, 1);
      if (l.id === sel) {
        ctx.fillStyle = '#fff6d0';
        ctx.fillRect(x + 6, y + SPRITE_H - 17, SPRITE_W - 12, 1);
        ctx.fillRect(x + 6, y + SPRITE_H - 9, SPRITE_W - 12, 1);
      }
      // a ilha em alta definição, quando chegar (o detalhe inteiro); senão a de escala 1, em pixels grandes
      const hd = ilhaHD(l.nome, l.icone);
      if (hd) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(hd.img, x, y + hd.dy, SPRITE_W, SPRITE_H);
        ctx.imageSmoothingEnabled = false;
      } else ctx.drawImage(spr, x, y);
      if (l.aqui) {
        // a bandeirinha de quem está aqui (a pintada, arte/mapa/aqui.png, com o pé no mesmo ponto)
        const fx = Math.round(p.x) + 14;
        const fy = y + 10;
        const bandeira = arteDoMapa('aqui');
        if (bandeira) {
          ctx.drawImage(bandeira, fx - 1, fy + 11 - bandeira.height);
          continue;
        }
        ctx.fillStyle = '#2a1d2e';
        ctx.fillRect(fx, fy, 1, 11);
        ctx.fillStyle = '#e9a844';
        ctx.fillRect(fx + 1, fy, 6, 4);
      }
    }
    // o nome de cada lugar acompanha a ilha (afastada ou não)
    for (const pino of pinos.children as HTMLCollectionOf<HTMLElement>) {
      const q = pos.get(Number(pino.dataset.id));
      if (q) (pino.style.left = `${(q.x / W) * 100}%`), (pino.style.top = `${(q.y / H) * 100}%`);
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
          ? l.aqui
            ? []
            : [botao(o.rotulo ?? 'Escolher este destino', 'bandeira', 'forte', () => (j.fechar(), o.escolher!(l)))]
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
            'data-id': String(l.id),
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
    h('p', { class: 'vg-dica' }, escolhendo ? 'A bandeirinha marca onde vocês estão. Toque em outro lugar.' : eu() ? 'Toque num lugar. Arraste as ilhas para arrumar o mapa.' : 'O mundo da campanha.'),
    palco,
  );
  j.rodape.append(botao('Fechar', 'fechar', 'claro', () => j.fechar()));
  app.net.send({ t: 'lugares' });
  atualizar();
  raf = requestAnimationFrame(desenhar);
}
