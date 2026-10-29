/**
 * O medidor de desempenho (28/10, o Felipe: "movimentar a tela trava tudo, lentão", no PC e no notebook): só com ?fps no
 * endereço. No canto de cima, a cada meio segundo: quadros por segundo, quanto o tabuleiro leva para desenhar cada quadro,
 * as travadas (tarefas de mais de 50 ms) e quantas vezes a interface em volta mudou. Uma foto dele diz para onde o
 * tempo vai, na máquina de quem joga.
 */
import type { RoomView } from '../room/RoomView';

export function ligarMedidor(view: RoomView, tela: HTMLCanvasElement, cena: () => string) {
  // desenhado num canvas (29/10): o texto num div, trocado a cada meio segundo, fazia a página recalcular o estilo
  // inteiro de tempos em tempos (~80 ms a cada 5 s, medido na prévia): o medidor criava a travada que devia medir
  const el = document.createElement('canvas');
  el.width = 360;
  el.height = 74;
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;border-radius:6px;pointer-events:none';
  document.body.append(el);
  const g = el.getContext('2d')!;
  const escrever = (linhas: string[]) => {
    g.fillStyle = 'rgba(0,0,0,.82)';
    g.clearRect(0, 0, el.width, el.height);
    g.fillRect(0, 0, el.width, el.height);
    g.fillStyle = '#9fe';
    g.font = '12px ui-monospace, monospace';
    linhas.forEach((l, i) => g.fillText(l, 9, 18 + i * 16));
  };
  let quadros = 0;
  let desenho = 0;
  let pior = 0;
  let travadas = 0;
  let travadoMs = 0;
  let mudancas = 0;
  let antes = performance.now();
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        travadas++;
        travadoMs += e.duration;
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    /* o navegador não mede tarefas longas */
  }
  // a interface em volta do tabuleiro: cada mudança no HTML (fora o próprio medidor)
  new MutationObserver((ms) => {
    for (const m of ms) if (m.target !== el) mudancas++;
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const laco = () => {
    requestAnimationFrame(laco);
    quadros++;
    desenho += view.ultimoQuadroMs;
    pior = Math.max(pior, view.ultimoQuadroMs);
    const agora = performance.now();
    if (agora - antes < 500) return;
    const s = (agora - antes) / 1000;
    escrever([
      `${cena()}`,
      `FPS ${(quadros / s).toFixed(0)}   desenho ${(desenho / Math.max(1, quadros)).toFixed(1)} ms (pior ${pior.toFixed(0)})`,
      `travadas ${travadas} (${travadoMs.toFixed(0)} ms)   interface ${Math.round(mudancas / s)}/s`,
      `tela ${tela.width}x${tela.height}   dpr ${devicePixelRatio}   qualidade ${Math.round(view.qualidade * 100)}%`,
    ]);
    quadros = 0;
    desenho = 0;
    pior = 0;
    travadas = 0;
    travadoMs = 0;
    mudancas = 0;
    antes = agora;
  };
  requestAnimationFrame(laco);
}
