import { CENA_MAX_CAMADAS, CENA_MAX_QUADROS, type CamadaCena, type CenaMomento, type CenaQuadro, type EntradaCamada, type Foco, type MovimentoCena, type TransicaoCena } from '@crona/shared';
import type { App } from './app';
import { h, toast } from './dom';
import { botao, janela } from './fichaModal';
import { ic } from './icons';
import { sfx } from './sfx';

/**
 * A janela CENAS (17/10): o mestre monta as cenas de momento (uma sequência de imagens, a música e a fala dele em
 * cada quadro), guarda e solta quando a história pede. Ao soltar, a imagem toma a tela de todos (cenaTela.ts).
 */

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const MOVIMENTOS_ROTULO: [MovimentoCena | 'custom', string][] = [
  ['zoom', 'Aproximar devagar'],
  ['afasta', 'Afastar devagar'],
  ['esquerda', 'Deslizar para a esquerda'],
  ['direita', 'Deslizar para a direita'],
  ['cima', 'Deslizar para cima'],
  ['baixo', 'Deslizar para baixo'],
  ['tremor', 'Tremer (pancada, susto)'],
  ['parado', 'Parado'],
  ['custom', 'Personalizada (escolher na imagem)'],
];
const TRANSICOES_ROTULO: [TransicaoCena, string][] = [
  ['fade', 'Dissolver'],
  ['corte', 'Corte seco'],
  ['flash', 'Clarão branco'],
  ['preto', 'Passando pelo preto'],
];
const ENTRADAS_ROTULO: [EntradaCamada, string][] = [
  ['fade', 'Surgir'],
  ['esquerda', 'Vir da esquerda'],
  ['direita', 'Vir da direita'],
  ['cima', 'Descer de cima'],
  ['baixo', 'Subir de baixo'],
  ['zoom', 'Crescer'],
  ['corte', 'De repente'],
];
function opcoes<T extends string>(lista: [T, string][], valor: T, aoMudar: (v: T) => void, rotulo: string) {
  const sel = h('select', { class: 'fx-inp cne-sel', 'aria-label': rotulo, onchange: () => aoMudar(sel.value as T) }, ...lista.map(([v, nome]) => h('option', { value: v, selected: v === valor }, nome))) as HTMLSelectElement;
  return sel;
}
const novoId = () => `cena-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

async function enviar(app: App, rota: 'mapas' | 'cenas-audio', arq: File): Promise<string> {
  const me = app.state.me;
  if (!me) throw new Error('Entre no jogo antes de enviar.');
  const res = await fetch(`/api/${rota}?token=${encodeURIComponent(me.token)}`, { method: 'POST', headers: { 'Content-Type': arq.type || 'application/octet-stream' }, body: arq });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Não foi possível enviar o arquivo.');
  return data.url;
}

export function abrirCenas(app: App) {
  if (app.state.role !== 'gm') return;
  app.net.send({ t: 'cenasPedir' });
  let rasc: CenaMomento = { id: novoId(), titulo: '', quadros: [] };
  let existe = false;
  let sujo = false;
  let enviando = 0;
  const j = janela('CENAS', 'imagem', () => off(), 96);
  j.el.classList.add('cne-fundo');

  // uma imagem só, na hora, na frente do tabuleiro de todos (o tablet da mesa e os celulares): vira a cena "Imagem rápida"
  const rapida = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden' }) as HTMLInputElement;
  rapida.addEventListener('change', async () => {
    const f = rapida.files?.[0];
    rapida.value = '';
    if (!f) return;
    try {
      const imagem = await enviarImagem(f);
      app.net.send({ t: 'cenaSalvar', cena: { id: 'imagem-rapida', titulo: 'Imagem rápida', quadros: [{ imagem, movimento: 'parado', nota: 'Fecha no X quando quiser voltar ao tabuleiro.' }] } });
      app.net.send({ t: 'cenaTocar', id: 'imagem-rapida' });
      j.fechar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  });
  const lista = h('div', { class: 'cne-lista' }, rapida);
  const editor = h('div', { class: 'cne-editor' });
  j.corpo.append(h('div', { class: 'cne' }, lista, editor));

  const pergunta = (): boolean => !sujo || confirm('Tem alterações que não foram guardadas. Descartar?');
  const abrirRasc = (c: CenaMomento | null) => {
    if (!pergunta()) return;
    rasc = c ? clone(c) : { id: novoId(), titulo: '', quadros: [] };
    existe = !!c;
    sujo = false;
    desenharEditor();
    desenharLista();
  };

  const desenharLista = () => {
    const cenas = app.state.cenas;
    lista.replaceChildren(
      h('div', { class: 'cne-lista-topo' }, botao('Nova cena', 'mais', 'forte', () => abrirRasc(null)), botao('Mostrar imagem', 'imagem', 'normal', () => rapida.click())),
      ...(cenas.length
        ? cenas.map((c) =>
            h(
              'div',
              { class: `cne-item${existe && c.id === rasc.id ? ' on' : ''}` },
              h('button', { class: 'cne-item-nome', type: 'button', title: 'Editar esta cena', onclick: () => (sfx.click(), abrirRasc(c)) }, h('b', null, c.titulo), h('small', null, `${c.quadros.length} ${c.quadros.length === 1 ? 'quadro' : 'quadros'}${c.musica ? ' · com música' : ''}`)),
              h('button', { class: 'cne-tocar', type: 'button', title: 'Soltar esta cena na tela de todos', 'aria-label': `Soltar ${c.titulo}`, onclick: () => (sfx.click(), app.net.send({ t: 'cenaTocar', id: c.id }), j.fechar()) }, ic('avancar'), h('span', null, 'Soltar')),
            ),
          )
        : [h('p', { class: 'cne-vazio' }, 'Nenhuma cena guardada ainda. Monte a primeira ao lado.')]),
    );
  };

  /** Um quadro: a imagem, a legenda (todos veem) e a fala (só o mestre), e embaixo a câmera, a transição, o tempo, o som e as camadas. */
  const linhaQuadro = (q: CenaQuadro, i: number) => {
    const marcar = () => (sujo = true);
    const trocar = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden' }) as HTMLInputElement;
    trocar.addEventListener('change', async () => {
      const f = trocar.files?.[0];
      if (!f) return;
      try {
        q.imagem = await enviarImagem(f);
        marcar();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      desenharEditor();
    });
    const legenda = h('input', { class: 'fx-inp', maxlength: 160, placeholder: 'Legenda na tela (opcional)', value: q.legenda ?? '', oninput: () => ((q.legenda = legenda.value), marcar()) }) as HTMLInputElement;
    const nota = h('textarea', { class: 'fx-inp cne-nota-in', rows: 2, maxlength: 300, placeholder: 'Sua fala ou deixa neste quadro (só você vê)', oninput: () => ((q.nota = nota.value), marcar()) }) as HTMLTextAreaElement;
    nota.value = q.nota ?? '';
    const mover = (d: number) => {
      const k = i + d;
      if (k < 0 || k >= rasc.quadros.length) return;
      [rasc.quadros[i], rasc.quadros[k]] = [rasc.quadros[k], rasc.quadros[i]];
      marcar();
      desenharEditor();
    };

    // a câmera: um movimento pronto ou feita à mão (clicar na imagem para dizer para onde ela olha, no começo e no fim)
    const padrao = (): { de: Foco; para: Foco } => ({ de: { x: 50, y: 50, zoom: 1 }, para: { x: 50, y: 50, zoom: 1.4 } });
    const camSel = opcoes(
      MOVIMENTOS_ROTULO,
      q.camera ? 'custom' : (q.movimento ?? 'zoom'),
      (v) => {
        if (v === 'custom') {
          q.camera ??= padrao();
          delete q.movimento;
        } else {
          delete q.camera;
          if (v === 'zoom') delete q.movimento;
          else q.movimento = v;
        }
        marcar();
        desenharEditor();
      },
      'Movimento da câmera',
    );
    let ponta: 'de' | 'para' = 'de';
    const picker = (() => {
      const cam = q.camera;
      if (!cam) return null;
      const quadroImg = h('img', { src: q.imagem, alt: '', draggable: 'false' }) as HTMLImageElement;
      const marcaDe = h('span', { class: 'cne-foco de', title: 'Onde a câmera começa' }, 'início');
      const marcaPara = h('span', { class: 'cne-foco para', title: 'Onde a câmera termina' }, 'fim');
      const pos = () => {
        for (const [m, f] of [
          [marcaDe, cam.de],
          [marcaPara, cam.para],
        ] as const) {
          m.style.left = `${f.x}%`;
          m.style.top = `${f.y}%`;
        }
      };
      pos();
      const area = h('div', { class: 'cne-camarea', title: 'Clique na imagem para pôr o ponto escolhido' }, quadroImg, marcaDe, marcaPara);
      area.addEventListener('click', (ev) => {
        const r = area.getBoundingClientRect();
        cam[ponta] = { ...cam[ponta], x: Math.round(((ev.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((ev.clientY - r.top) / r.height) * 1000) / 10 };
        marcar();
        pos();
      });
      const zoom = (qual: 'de' | 'para', rot: string) => {
        const inp = h('input', {
          class: 'fx-inp cne-num',
          type: 'number',
          min: 0.3,
          max: 4,
          step: 0.1,
          value: cam[qual].zoom,
          title: 'Zoom: 1 cobre a tela, menos mostra mais da imagem, mais chega perto',
          oninput: () => ((cam[qual] = { ...cam[qual], zoom: Math.max(0.3, Math.min(4, Number(inp.value) || 1)) }), marcar()),
        }) as HTMLInputElement;
        return h('label', { class: 'cne-zoom' }, h('small', null, rot), inp);
      };
      const chips: HTMLButtonElement[] = (['de', 'para'] as const).map(
        (qual) =>
          h(
            'button',
            {
              class: `cne-chip${ponta === qual ? ' on' : ''}`,
              type: 'button',
              onclick: () => {
                ponta = qual;
                chips.forEach((c, k) => c.classList.toggle('on', (k === 0 ? 'de' : 'para') === qual));
              },
            },
            qual === 'de' ? '1. Começo' : '2. Fim',
          ) as HTMLButtonElement,
      );
      return h('div', { class: 'cne-camera' }, area, h('div', { class: 'cne-cam-ctl' }, h('small', null, 'Escolha o ponto e clique na imagem'), h('div', { class: 'cne-chips' }, ...chips), zoom('de', 'Zoom no começo'), zoom('para', 'Zoom no fim')));
    })();

    // a transição, o tempo e o som do quadro
    const trSel = opcoes(TRANSICOES_ROTULO, q.transicao ?? 'fade', (v) => ((q.transicao = v === 'fade' ? undefined : v), marcar()), 'Como o quadro entra');
    const dur = h('input', {
      class: 'fx-inp cne-num',
      type: 'number',
      min: 0.2,
      max: 120,
      step: 0.1,
      placeholder: 'fica',
      value: q.duracao ?? '',
      title: 'Quantos segundos o quadro fica na tela antes de passar sozinho. Vazio: fica até você avançar (o último quadro congela até você fechar)',
      oninput: () => ((q.duracao = dur.value ? Math.max(0.2, Math.min(120, Number(dur.value))) : undefined), marcar()),
    }) as HTMLInputElement;
    const arqSom = h('input', { type: 'file', accept: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/webm,.mp3,.ogg,.wav,.m4a', class: 'hidden' }) as HTMLInputElement;
    arqSom.addEventListener('change', async () => {
      const f = arqSom.files?.[0];
      if (!f) return;
      if (f.size > 40 * 1024 * 1024) return toast('Áudio grande demais (máx. 40 MB).', 'error');
      enviando++;
      try {
        q.som = await enviar(app, 'cenas-audio', f);
        q.somNome = f.name.slice(0, 60);
        marcar();
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        enviando--;
      }
      desenharEditor();
    });
    const som = h(
      'div',
      { class: 'cne-som' },
      h('button', { class: 'cne-mini', type: 'button', title: 'Um som que toca uma vez quando o quadro entra (a porta, a pancada na grade)', onclick: () => arqSom.click() }, ic('radio'), h('span', null, q.som ? 'Trocar o som' : 'Som do quadro')),
      arqSom,
      q.som ? h('span', { class: 'cne-som-nome' }, q.somNome ?? 'som enviado') : null,
      q.som ? h('button', { class: 'cne-mini', type: 'button', title: 'Tirar o som', 'aria-label': 'Tirar o som do quadro', onclick: () => ((q.som = undefined), (q.somNome = undefined), marcar(), desenharEditor()) }, ic('lixo')) : null,
    );

    // as camadas da colagem
    const arqCamada = h('input', { type: 'file', accept: 'image/png,image/webp', multiple: true, class: 'hidden' }) as HTMLInputElement;
    arqCamada.addEventListener('change', async () => {
      const fs = [...(arqCamada.files ?? [])].slice(0, CENA_MAX_CAMADAS - (q.camadas?.length ?? 0));
      for (const f of fs) {
        try {
          const url = await enviarImagem(f);
          const camadas = (q.camadas ??= []);
          camadas.push({ imagem: url, ...(camadas.length ? { atraso: camadas.length * 1.5 } : {}) });
          marcar();
          desenharEditor();
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      }
      desenharEditor();
    });
    const numero = (rot: string, dica: string, min: number, max: number, passo: number, valor: number, aoMudar: (n: number) => void) => {
      const inp = h('input', { class: 'fx-inp cne-num', type: 'number', min, max, step: passo, value: valor, oninput: () => (aoMudar(Number(inp.value) || 0), marcar()) }) as HTMLInputElement;
      return h('label', { class: 'cne-zoom', title: dica }, h('small', null, rot), inp);
    };
    const linhaCamada = (k: CamadaCena, ki: number) =>
      h(
        'div',
        { class: 'cne-camada' },
        h('span', { class: 'cne-camada-img' }, h('img', { src: k.imagem, alt: `Camada ${ki + 1}` })),
        opcoes(ENTRADAS_ROTULO, k.entrada ?? 'fade', (v) => ((k.entrada = v === 'fade' ? undefined : v), marcar()), 'Como a camada entra'),
        numero('Entra depois de (s)', 'Segundos depois de o quadro entrar', 0, 60, 0.5, k.atraso ?? 0, (n) => (k.atraso = n > 0 ? Math.min(60, n) : undefined)),
        numero('Leva (s)', 'Quanto tempo a entrada leva: 1 é rápida, 5 aparece bem devagar (o rosto saindo do escuro)', 0, 30, 0.5, k.duracao ?? 1, (n) => (k.duracao = n > 0 && n !== 1 ? Math.min(30, n) : undefined)),
        numero('Fundo ↔ frente', 'Profundidade: 0 cola no fundo, 3 bem na frente (cresce um pouco mais durante o quadro)', 0, 3, 0.5, k.prof ?? 0, (n) => (k.prof = n > 0 ? Math.min(3, n) : undefined)),
        h('button', { class: 'cne-mini', type: 'button', title: 'Tirar a camada', 'aria-label': 'Tirar a camada', onclick: () => ((q.camadas = (q.camadas ?? []).filter((x) => x !== k)), q.camadas.length || delete q.camadas, marcar(), desenharEditor()) }, ic('lixo')),
      );
    const camadas = h(
      'div',
      { class: 'cne-camadas' },
      h('small', null, 'Camadas da colagem: PNGs transparentes do mesmo tamanho da imagem, que entram por cima dela'),
      ...(q.camadas ?? []).map(linhaCamada),
      h('button', { class: 'cne-mini largo', type: 'button', disabled: (q.camadas?.length ?? 0) >= CENA_MAX_CAMADAS, onclick: () => arqCamada.click() }, ic('mais'), h('span', null, 'Adicionar camadas')),
      arqCamada,
    );

    return h(
      'div',
      { class: 'cne-quadro' },
      h('span', { class: 'cne-n' }, String(i + 1)),
      h('button', { class: 'cne-thumb', type: 'button', title: 'Trocar a imagem do fundo', onclick: () => trocar.click() }, h('img', { src: q.imagem, alt: `Quadro ${i + 1}` })),
      trocar,
      h('div', { class: 'cne-campos' }, legenda, nota),
      h(
        'div',
        { class: 'cne-acoes' },
        h('button', { class: 'cne-mini', type: 'button', title: 'Subir', 'aria-label': 'Subir o quadro', disabled: i === 0, onclick: () => mover(-1) }, ic('direita', 'ic cne-sobe')),
        h('button', { class: 'cne-mini', type: 'button', title: 'Descer', 'aria-label': 'Descer o quadro', disabled: i === rasc.quadros.length - 1, onclick: () => mover(1) }, ic('direita', 'ic cne-desce')),
        h('button', { class: 'cne-mini', type: 'button', title: 'Tirar o quadro', 'aria-label': 'Tirar o quadro', onclick: () => (rasc.quadros.splice(i, 1), marcar(), desenharEditor()) }, ic('lixo')),
      ),
      h(
        'div',
        { class: 'cne-ajustes' },
        h('label', { class: 'cne-zoom' }, h('small', null, 'Câmera'), camSel),
        h('label', { class: 'cne-zoom' }, h('small', null, 'Entrada do quadro'), trSel),
        h('label', { class: 'cne-zoom' }, h('small', null, 'Tempo (s)'), dur),
        som,
      ),
      picker,
      camadas,
    );
  };

  const enviarImagem = async (f: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) throw new Error('Envie uma imagem PNG, JPG ou WEBP.');
    if (f.size > 12 * 1024 * 1024) throw new Error('Imagem grande demais (máx. 12 MB).');
    enviando++;
    try {
      return await enviar(app, 'mapas', f);
    } finally {
      enviando--;
    }
  };

  /** As salas ligadas à cena: quando o mestre entra numa delas, o jogo oferece soltar a cena (ele decide). */
  const salasDaCena = () => {
    const atual = app.state.room;
    const nome = (id: number) => app.state.rooms.find((r) => r.id === id)?.name ?? `Sala ${id}`;
    const ligadas = rasc.salas ?? [];
    const jaLigada = !!atual && ligadas.includes(atual.id);
    return h(
      'div',
      { class: 'cne-salas' },
      ...ligadas.map((id) =>
        h(
          'span',
          { class: 'cne-sala' },
          nome(id),
          h('button', { type: 'button', title: 'Desligar desta sala', 'aria-label': `Desligar de ${nome(id)}`, onclick: () => ((rasc.salas = ligadas.filter((x) => x !== id)), rasc.salas.length || delete rasc.salas, (sujo = true), desenharEditor()) }, ic('fechar')),
        ),
      ),
      atual && !jaLigada && ligadas.length < 12
        ? h('button', { class: 'cne-mini largo', type: 'button', title: 'Quando você entrar nesta sala, o jogo oferece soltar a cena', onclick: () => ((rasc.salas = [...ligadas, atual.id]), (sujo = true), desenharEditor()) }, ic('pino'), h('span', null, `Ligar à sala de agora (${atual.name})`))
        : null,
      !ligadas.length ? h('small', null, 'Sem sala ligada: a cena só sai pelo botão CENAS.') : null,
    );
  };

  const desenharEditor = () => {
    const titulo = h('input', { class: 'fx-inp', maxlength: 60, placeholder: 'Ex.: A cela do pai da Cora', value: rasc.titulo, oninput: () => ((rasc.titulo = titulo.value), (sujo = true)) }) as HTMLInputElement;

    // a música
    const arqMusica = h('input', { type: 'file', accept: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/webm,.mp3,.ogg,.wav,.m4a', class: 'hidden' }) as HTMLInputElement;
    arqMusica.addEventListener('change', async () => {
      const f = arqMusica.files?.[0];
      if (!f) return;
      if (f.size > 40 * 1024 * 1024) return toast('Áudio grande demais (máx. 40 MB).', 'error');
      enviando++;
      try {
        rasc.musica = await enviar(app, 'cenas-audio', f);
        rasc.musicaNome = f.name.slice(0, 60);
        sujo = true;
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        enviando--;
      }
      desenharEditor();
    });
    const musica = h(
      'div',
      { class: 'cne-musica' },
      h('button', { class: 'cne-mini largo', type: 'button', onclick: () => arqMusica.click() }, ic('radio'), h('span', null, rasc.musica ? 'Trocar a música' : 'Escolher a música')),
      arqMusica,
      rasc.musica
        ? h(
            'div',
            { class: 'cne-tocando' },
            h('span', null, rasc.musicaNome ?? 'música enviada'),
            h('audio', { src: rasc.musica, controls: true, preload: 'none' }),
            h('button', { class: 'cne-mini', type: 'button', title: 'Tirar a música', 'aria-label': 'Tirar a música', onclick: () => ((rasc.musica = undefined), (rasc.musicaNome = undefined), (sujo = true), desenharEditor()) }, ic('lixo')),
          )
        : h('small', null, 'MP3, OGG, WAV ou M4A, até 40 MB. Toca em loop até a cena fechar.'),
    );

    // os quadros
    const arqQuadros = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, class: 'hidden' }) as HTMLInputElement;
    arqQuadros.addEventListener('change', async () => {
      const fs = [...(arqQuadros.files ?? [])].slice(0, CENA_MAX_QUADROS - rasc.quadros.length);
      for (const f of fs) {
        try {
          rasc.quadros.push({ imagem: await enviarImagem(f) });
          sujo = true;
          desenharEditor();
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      }
      desenharEditor();
    });
    const cheio = rasc.quadros.length >= CENA_MAX_QUADROS;
    const quadros = h(
      'div',
      { class: 'cne-quadros' },
      ...(rasc.quadros.length ? rasc.quadros.map(linhaQuadro) : [h('p', { class: 'cne-vazio' }, 'Nenhum quadro ainda: cada quadro é uma imagem que ocupa a tela toda. Prefira 1920 × 1080.')]),
      h('button', { class: 'cne-mini largo', type: 'button', disabled: cheio, onclick: () => arqQuadros.click() }, ic('mais'), h('span', null, cheio ? `No máximo ${CENA_MAX_QUADROS} quadros` : 'Adicionar quadros (uma ou várias imagens)')),
      arqQuadros,
    );

    const guardar = (soltar: boolean) => {
      if (enviando) return toast('Espere os arquivos terminarem de subir.', 'error');
      if (!rasc.titulo.trim()) return toast('Dê um nome à cena.', 'error');
      if (!rasc.quadros.length) return toast('A cena precisa de pelo menos um quadro.', 'error');
      app.net.send({ t: 'cenaSalvar', cena: clone(rasc) });
      existe = true;
      sujo = false;
      sfx.paper();
      if (soltar) {
        app.net.send({ t: 'cenaTocar', id: rasc.id });
        j.fechar();
      } else desenharLista();
    };

    editor.replaceChildren(
      h('label', { class: 'cne-campo' }, h('small', null, 'Nome da cena'), titulo),
      h('div', { class: 'cne-campo' }, h('small', null, 'Música'), musica),
      h('div', { class: 'cne-campo' }, h('small', null, 'Sugerir ao entrar em'), salasDaCena()),
      h(
        'label',
        { class: 'cne-marca', title: 'Faixas pretas em cima e embaixo, como no cinema; a legenda vai na de baixo' },
        h('input', { type: 'checkbox', checked: !!rasc.cinema, onchange: function (this: HTMLInputElement) { rasc.cinema = this.checked || undefined; sujo = true; } }),
        h('span', null, 'Faixas de cinema'),
      ),
      h('div', { class: 'cne-campo' }, h('small', null, `Quadros · ${rasc.quadros.length} de ${CENA_MAX_QUADROS}`), quadros),
      h(
        'div',
        { class: 'cne-rodape' },
        existe ? h('button', { class: 'cne-mini', type: 'button', title: 'Apagar esta cena', 'aria-label': 'Apagar esta cena', onclick: () => confirm(`Apagar a cena "${rasc.titulo}"?`) && (app.net.send({ t: 'cenaApagar', id: rasc.id }), (sujo = false), abrirRasc(null)) }, ic('lixo')) : null,
        botao('Guardar', 'salvar', 'claro', () => guardar(false)),
        botao('Guardar e soltar', 'avancar', 'forte', () => guardar(true)),
      ),
    );
  };

  const aoMudar = () => {
    // só a lista (o rascunho em edição não é refeito por baixo da mão do mestre)
    desenharLista();
  };
  const off = () => app.off('cenas', aoMudar);
  app.on('cenas', aoMudar);

  desenharLista();
  desenharEditor();
}
