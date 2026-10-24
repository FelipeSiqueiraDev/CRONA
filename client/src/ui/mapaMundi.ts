import type { LugarInfo } from '@crona/shared';
import { arteDoMapa, ilhaHD, SPRITE_CENTRO, SPRITE_H, SPRITE_W, spriteDoLugar } from '../render/lugarSprites';
import type { App } from './app';
import { h } from './dom';
import { botao, janela } from './fichaModal';
import { sfx } from './sfx';

/**
 * O mapa-múndi (07/10): uma ilhazinha por lugar, no estilo pixel art limpo das referências do Felipe; o mestre arrasta
 * as ilhas para arrumar o mapa. Dois jeitos de abrir: para olhar (Abrir / Viajar para cá) ou para ESCOLHER o destino
 * da viagem.
 *
 * Revisto em 24/10 (o Felipe: "o menu do mapa-múndi tá ficando pequeno; vamos aumentar essa tela, tirar esse sobe e
 * desce que tá travando tudo e organizar isso melhor"):
 * - uma ilha por REGIÃO (a cidade, `regiaoDoLugar`): a Fazenda Olhos de Águia fica na de Igarapé, Santo Berço na de
 *   Santa Amália, o Jardim do Fritz na de Pedra Serena; a ilha é a do lugar principal da região;
 * - a tela inteira, com a lista das regiões ao lado (clicar numa região abre os lugares dela, com os botões);
 * - parada: desenhada só quando algo muda (antes, as ilhas balançavam e o mapa era refeito a cada quadro).
 */

const W = 480;
const H = 270;

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

/** Uma região do mapa: os lugares dela e o principal (a ilha e a posição dela). */
interface Regiao {
  nome: string;
  principal: LugarInfo;
  lugares: LugarInfo[];
  aqui: boolean;
}

const aleat = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** As regiões, na ordem do nome; o lugar principal é o que tem o nome da região (senão o mais antigo). */
function regioes(ls: LugarInfo[]): Regiao[] {
  const por = new Map<string, LugarInfo[]>();
  for (const l of ls) {
    const r = l.regiao || l.nome;
    por.set(r, [...(por.get(r) ?? []), l]);
  }
  return [...por.entries()]
    .map(([nome, lugares]) => {
      const ordem = [...lugares].sort((a, b) => (a.nome === nome ? -1 : b.nome === nome ? 1 : a.id - b.id));
      return { nome, principal: ordem[0], lugares: ordem, aqui: lugares.some((l) => l.aqui) };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

/** O fundo parado: neutro, escuro, um pouco mais claro no meio e uma névoa de pontinhos. */
function fundo(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.65);
  g.addColorStop(0, '#2a2f3a');
  g.addColorStop(1, '#0f1117');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = aleat(i) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(255,230,180,0.04)';
    ctx.fillRect(Math.floor(aleat(i + 1000) * W), Math.floor(aleat(i + 2000) * H), 1, 1);
  }
}

/**
 * Onde cada ilha fica de verdade: a posição do mestre, mas as que se encostam se afastam (umas voltas empurrando os
 * pares que se sobrepõem), sem sair da tela.
 */
function arrumar(rs: Regiao[]): Map<string, { x: number; y: number }> {
  const ps = rs.map((r) => ({ nome: r.nome, x: r.principal.x * W, y: r.principal.y * H }));
  const MX = SPRITE_W + 10;
  const MY = SPRITE_H - 2;
  for (let volta = 0; volta < 60; volta++) {
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
      p.x = Math.max(SPRITE_CENTRO[0] + 4, Math.min(W - (SPRITE_W - SPRITE_CENTRO[0]) - 4, p.x));
      p.y = Math.max(SPRITE_CENTRO[1] + 4, Math.min(H - (SPRITE_H - SPRITE_CENTRO[1]) - 16, p.y));
    }
    if (!mexeu) break;
  }
  return new Map(ps.map((p) => [p.nome, { x: p.x, y: p.y }]));
}

/** Abre o mapa-múndi. */
export function abrirMapaMundi(app: App, o: OpcoesMapa = {}) {
  const escolhendo = !!o.escolher;
  const lugares = () => app.state.lugares;
  const eu = () => app.isGm;
  // a região aberta: a do lugar marcado, ou a de onde vocês estão
  const regDe = (id: number | null | undefined) => lugares().find((l) => l.id === id)?.regiao ?? null;
  let sel: string | null = regDe(o.marcado) ?? lugares().find((l) => l.aqui)?.regiao ?? null;
  let espera = 0;
  let quadro = 0;
  const pedir = () => {
    // desenha no próximo quadro, uma vez só (nada de laço: a tela fica parada)
    if (!quadro) quadro = requestAnimationFrame(desenhar);
  };
  const j = janela(o.titulo ?? (escolhendo ? 'ESCOLHER O DESTINO' : 'MAPA-MÚNDI'), 'globo', () => (cancelAnimationFrame(quadro), clearInterval(espera), window.removeEventListener('resize', pedir)), 150);
  j.el.classList.add('tela-toda', 'mundi-janela');
  const tela = h('canvas', { class: 'mm-tela', width: W, height: H });
  const pinos = h('div', { class: 'mm-pinos' });
  const palco = h('div', { class: 'mm-palco' }, tela, pinos);
  const lado = h('div', { class: 'mm-lado' });
  const ctx = tela.getContext('2d')!;
  // nítido (10/10): o canvas tem o tamanho de verdade na tela, em múltiplo inteiro da arte
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
  fundo(bg);

  function desenhar() {
    quadro = 0;
    ajustar();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0);
    const rs = regioes(lugares());
    const pos = arrumar(rs);
    // as ilhas, de trás para a frente, paradas (a sombra embaixo)
    for (const r of [...rs].sort((a, b) => pos.get(a.nome)!.y - pos.get(b.nome)!.y)) {
      const l = r.principal;
      const p = pos.get(r.nome)!;
      const x = Math.round(p.x - SPRITE_CENTRO[0]);
      const y = Math.round(p.y - SPRITE_CENTRO[1]) - 3;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 14, y + SPRITE_H - 1, SPRITE_W - 28, 3);
      if (r.nome === sel) {
        // a região aberta: duas linhas claras no chão embaixo da ilha
        ctx.fillStyle = 'rgba(255,246,208,0.9)';
        ctx.fillRect(x + 4, y + SPRITE_H + 1, SPRITE_W - 8, 1);
        ctx.fillRect(x + 10, y + SPRITE_H + 3, SPRITE_W - 20, 1);
      }
      const hd = ilhaHD(l.nome, l.icone);
      if (hd) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(hd.img, x, y + hd.dy, SPRITE_W, SPRITE_H);
        ctx.imageSmoothingEnabled = false;
      } else ctx.drawImage(spriteDoLugar(l.icone, l.nome), x, y);
      if (r.aqui) {
        // a bandeirinha de quem está aqui (a pintada, arte/mapa/aqui.png)
        const fx = Math.round(p.x) + 14;
        const fy = y + 10;
        const bandeira = arteDoMapa('aqui');
        if (bandeira) ctx.drawImage(bandeira, fx - 1, fy + 11 - bandeira.height);
        else {
          ctx.fillStyle = '#2a1d2e';
          ctx.fillRect(fx, fy, 1, 11);
          ctx.fillStyle = '#e9a844';
          ctx.fillRect(fx + 1, fy, 6, 4);
        }
      }
    }
    for (const pino of pinos.children as HTMLCollectionOf<HTMLElement>) {
      const q = pos.get(pino.dataset.regiao ?? '');
      if (q) (pino.style.left = `${(q.x / W) * 100}%`), (pino.style.top = `${(q.y / H) * 100}%`);
    }
  }

  const botoesDoLugar = (l: LugarInfo) =>
    escolhendo
      ? l.aqui
        ? []
        : [botao(o.rotulo ?? 'Escolher este destino', 'bandeira', 'forte', () => (j.fechar(), o.escolher!(l)))]
      : [
          ...(o.aoViajar && eu() && !l.aqui ? [botao('Viajar para cá', 'correr', 'forte', () => (j.fechar(), o.aoViajar!(l)))] : []),
          ...(eu() ? [botao('Abrir', 'olho', 'claro', () => (app.net.send({ t: 'join', roomId: l.entrada }), j.fechar()))] : []),
        ];

  const escolherRegiao = (nome: string) => {
    sfx.click();
    sel = sel === nome ? null : nome;
    montarPinos();
    montarLado();
    pedir();
  };

  const montarLado = () => {
    const rs = regioes(lugares());
    lado.replaceChildren(
      h('h4', { class: 'mm-lado-tit' }, 'Regiões'),
      ...rs.map((r) => {
        const aberta = r.nome === sel;
        const cab = h(
          'button',
          { class: `mm-reg${aberta ? ' on' : ''}${r.aqui ? ' aqui' : ''}`, type: 'button', onclick: () => escolherRegiao(r.nome) },
          h('b', null, r.nome),
          h('small', null, `${r.lugares.length} ${r.lugares.length === 1 ? 'lugar' : 'lugares'}${r.aqui ? ' · vocês estão aqui' : ''}`),
        );
        if (!aberta) return h('div', { class: 'mm-reg-bloco' }, cab);
        return h(
          'div',
          { class: 'mm-reg-bloco on' },
          cab,
          ...r.lugares.map((l) =>
            h(
              'div',
              { class: `mm-lugar${l.aqui ? ' aqui' : ''}${o.marcado === l.id ? ' marcado' : ''}` },
              h('div', { class: 'mm-lugar-nome' }, h('b', null, l.nome), h('small', null, `${l.salas} ${l.salas === 1 ? 'sala' : 'salas'}${l.aqui ? ' · aqui' : ''}`)),
              h('div', { class: 'mm-bts' }, ...botoesDoLugar(l)),
            ),
          ),
        );
      }),
    );
  };

  const montarPinos = () => {
    pinos.replaceChildren(
      ...regioes(lugares()).map((r) => {
        const l = r.principal;
        const pino = h(
          'button',
          {
            class: `mm-pino${r.nome === sel ? ' on' : ''}${r.aqui ? ' aqui' : ''}`,
            type: 'button',
            style: `left:${l.x * 100}%;top:${l.y * 100}%`,
            'data-regiao': r.nome,
            'aria-label': r.nome,
          },
          h('span', { class: 'mm-nome' }, r.nome),
        );
        // arrastar (o mestre: a ilha da região anda com o lugar principal) ou clicar
        pino.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          const rect = palco.getBoundingClientRect();
          const x0 = e.clientX;
          const y0 = e.clientY;
          let arrastou = false;
          const mover = (ev: PointerEvent) => {
            if (!eu() || escolhendo) return;
            if (!arrastou && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
            arrastou = true;
            l.x = Math.max(0.08, Math.min(0.92, (ev.clientX - rect.left) / rect.width));
            l.y = Math.max(0.1, Math.min(0.9, (ev.clientY - rect.top) / rect.height));
            pedir();
          };
          const soltar = () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', soltar);
            if (arrastou) app.net.send({ t: 'lugarMover', id: l.id, x: l.x, y: l.y });
            else escolherRegiao(r.nome);
          };
          window.addEventListener('pointermove', mover);
          window.addEventListener('pointerup', soltar);
        });
        return pino;
      }),
    );
  };

  const fechado = () => !document.body.contains(j.el);
  const atualizar = () => {
    if (fechado()) return;
    montarPinos();
    montarLado();
    pedir();
  };
  app.on('lugares', atualizar);
  // a arte das ilhas chega aos poucos: redesenha algumas vezes no começo e para
  let vezes = 0;
  espera = window.setInterval(() => {
    if (fechado() || ++vezes > 12) return clearInterval(espera);
    pedir();
  }, 500);
  window.addEventListener('resize', pedir);

  j.corpo.append(
    h('p', { class: 'vg-dica' }, escolhendo ? 'A bandeirinha marca onde vocês estão. Escolha a região e o lugar.' : eu() ? 'Clique numa região para ver os lugares dela. Arraste as ilhas para arrumar o mapa.' : 'O mundo da campanha.'),
    h('div', { class: 'mm-grade' }, palco, lado),
  );
  j.rodape.append(botao('Fechar', 'fechar', 'claro', () => j.fechar()));
  app.net.send({ t: 'lugares' });
  atualizar();
}
