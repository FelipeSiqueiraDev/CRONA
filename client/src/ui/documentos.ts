/**
 * Os documentos da investigação, do lado do mestre (Configurações → Documentos): cria o
 * relatório, a foto ou a pista, com imagem e páginas de texto, e entrega a um agente ou à
 * equipe. O jogador vê na aba Docs do celular (docs/TELA-DO-JOGADOR.md).
 */
import { GRUPOS_DOCUMENTO, TIPOS_DOCUMENTO, capaDoDocumento, nomeTipoDocumento, type Documento, type FichaSalva, type GrupoDocumento, type TipoDocumento } from '@crona/shared';
import type { App } from './app';
import { h, toast } from './dom';
import { botao, confirmar, janela } from './fichaModal';
import { ic } from './icons';
import { sfx } from './sfx';

export interface FonteDocumentos {
  docs: () => Documento[];
  fichas: () => FichaSalva[];
  /** a campanha aberta (o documento novo nasce nela) */
  campanha: () => number | undefined;
}

let redesenhar: (() => void) | null = null;

/** Chegou a lista nova do servidor: a janela aberta acompanha. */
export function documentosMudaram() {
  redesenhar?.();
}

const novoDoc = (campanha?: number): Documento => ({
  id: 0,
  titulo: '',
  tipo: 'relatorio',
  grupo: 'documento',
  paginas: [''],
  para: [],
  equipe: false,
  ...(campanha ? { campanha } : {}),
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
});

export function abrirDocumentos(app: App, fonte: FonteDocumentos) {
  sfx.paper();
  let rascunho: Documento | null = null;
  let mudou = false;
  const j = janela('Documentos', 'documento', () => (redesenhar = null), 110);
  j.el.classList.add('tela-toda', 'doc-janela');
  const lista = h('div', { class: 'doc-lista' });
  const editor = h('div', { class: 'doc-editor' });
  j.corpo.append(h('div', { class: 'doc-grade' }, h('div', { class: 'doc-col' }, botao('Novo documento', 'mais', 'forte', () => abrir(novoDoc(fonte.campanha()))), lista), editor));
  j.rodape.append(h('p', { class: 'doc-dica' }, 'O agente vê na aba Docs do celular. Entregue a um agente ou à equipe inteira (os agentes da campanha).'), h('span', { class: 'fj-esp' }), botao('Fechar', 'fechar', '', () => j.fechar()));

  const nomeFicha = (id: number) => fonte.fichas().find((f) => f.id === id)?.nome ?? `#${id}`;
  const quem = (d: Documento) => (d.equipe ? 'Equipe' : d.para.length ? d.para.map(nomeFicha).join(', ') : 'Ninguém ainda');

  const abrir = async (d: Documento) => {
    if (mudou && rascunho && !(await confirmar('DESCARTAR AS MUDANÇAS?', `"${rascunho.titulo || 'Sem título'}" tem mudanças que não foram salvas.`, 'Descartar', true))) return;
    sfx.paper();
    rascunho = JSON.parse(JSON.stringify(d)) as Documento;
    mudou = false;
    desenharLista();
    desenharEditor();
  };

  const desenharLista = () => {
    const docs = [...fonte.docs()].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    lista.replaceChildren(
      ...(docs.length
        ? docs.map((d) =>
            h(
              'button',
              { class: `doc-item${rascunho?.id === d.id ? ' on' : ''}`, type: 'button', onclick: () => void abrir(d) },
              h('span', { class: 'doc-mini' }, capaDoDocumento(d) ? h('img', { src: capaDoDocumento(d)!, alt: '', loading: 'lazy' }) : ic('documento')),
              h('span', { class: 'doc-item-txt' }, h('b', null, d.titulo), h('small', null, `${nomeTipoDocumento(d.tipo)} · ${quem(d)}${d.guardado ? ' · guardado num móvel' : ''}${d.marcadoPor?.length ? ` · marcado por ${d.marcadoPor.map(nomeFicha).join(', ')}` : ''}`)),
            ),
          )
        : [h('p', { class: 'doc-vazio' }, 'Nenhum documento ainda.')]),
    );
  };

  const desenharEditor = () => {
    const d = rascunho;
    if (!d) {
      editor.replaceChildren(h('p', { class: 'doc-vazio' }, 'Escolha um documento à esquerda ou crie um novo.'));
      return;
    }
    const marcar = () => (mudou = true);
    const campo = (rotulo: string, el: HTMLElement) => h('label', { class: 'doc-campo' }, h('span', null, rotulo), el);
    const titulo = h('input', { class: 'fx-inp', value: d.titulo, maxlength: 100, placeholder: 'Projeto Fulgor — Relatório 02' }) as HTMLInputElement;
    titulo.addEventListener('input', () => ((d.titulo = titulo.value), marcar()));
    const sel = <T extends string>(ops: { id: T; nome: string }[], atual: T, mudar: (v: T) => void) => {
      const s = h('select', { class: 'fx-inp' }, ...ops.map((o) => h('option', { value: o.id, selected: o.id === atual }, o.nome))) as HTMLSelectElement;
      s.addEventListener('change', () => (mudar(s.value as T), marcar()));
      return s;
    };
    const origem = h('input', { class: 'fx-inp', value: d.origem ?? '', maxlength: 40, placeholder: 'Fundação, Médicos, Instalação…' }) as HTMLInputElement;
    origem.addEventListener('input', () => ((d.origem = origem.value.trim() || undefined), marcar()));

    // a imagem: escolher manda para o servidor na hora (o mesmo envio do mapa improvisado)
    const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden' }) as HTMLInputElement;
    const previa = h('div', { class: 'doc-img' }, d.imagem ? h('img', { src: d.imagem, alt: '' }) : h('span', null, ic('imagem'), 'Sem imagem'));
    arquivo.addEventListener('change', async () => {
      const f = arquivo.files?.[0];
      const me = app.state.me;
      if (!f || !me) return;
      previa.replaceChildren(h('span', null, 'Enviando…'));
      try {
        const res = await fetch(`/api/mapas?token=${encodeURIComponent(me.token)}`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? 'Não foi possível enviar a imagem.');
        d.imagem = data.url;
        marcar();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      desenharEditor();
    });

    const paginas = h('div', { class: 'doc-paginas' });
    const desenharPaginas = () =>
      paginas.replaceChildren(
        ...d.paginas.map((p, i) => {
          const t = h('textarea', { class: 'fx-inp', maxlength: 6000, placeholder: i === 0 ? 'O texto que o agente lê. Uma linha em branco separa os parágrafos.' : 'Continua…' }) as HTMLTextAreaElement;
          t.value = p;
          t.addEventListener('input', () => ((d.paginas[i] = t.value), marcar()));
          return h(
            'div',
            { class: 'doc-pagina' },
            h('div', { class: 'doc-pagina-cab' }, h('b', null, `Página ${i + 1}`), d.paginas.length > 1 ? h('button', { class: 'doc-x', type: 'button', title: 'Tirar a página', onclick: () => (d.paginas.splice(i, 1), marcar(), desenharPaginas()) }, ic('lixo')) : null),
            t,
          );
        }),
        d.paginas.length < 30 ? botao('Mais uma página', 'mais', '', () => (d.paginas.push(''), marcar(), desenharPaginas())) : h('span'),
      );
    desenharPaginas();

    // para quem: agentes (fichas da campanha primeiro) ou a equipe
    const fichas = [...fonte.fichas()].sort((a, b) => Number(b.campanha === d.campanha) - Number(a.campanha === d.campanha) || a.nome.localeCompare(b.nome));
    const equipe = h('input', { type: 'checkbox', checked: d.equipe }) as HTMLInputElement;
    equipe.addEventListener('change', () => ((d.equipe = equipe.checked), marcar()));
    const agentes = fichas.map((f) => {
      const c = h('input', { type: 'checkbox', checked: d.para.includes(f.id) }) as HTMLInputElement;
      c.addEventListener('change', () => {
        d.para = c.checked ? [...new Set([...d.para, f.id])] : d.para.filter((x) => x !== f.id);
        marcar();
      });
      return h('label', { class: 'doc-check' }, c, f.nome);
    });

    const salvar = () => {
      if (!d.titulo.trim()) return toast('Dê um título ao documento.', 'error');
      app.net.send({ t: 'docSalvar', doc: d });
      sfx.paper();
      mudou = false;
      toast(d.id ? 'Documento salvo.' : 'Documento criado.');
      if (!d.id) rascunho = null;
      desenharEditor();
    };

    editor.replaceChildren(
      campo('Título', titulo),
      h('div', { class: 'doc-linha' }, campo('Filtro', sel<GrupoDocumento>(GRUPOS_DOCUMENTO, d.grupo, (v) => (d.grupo = v))), campo('Tipo', sel<TipoDocumento>(TIPOS_DOCUMENTO, d.tipo, (v) => (d.tipo = v))), campo('De onde', origem)),
      h(
        'div',
        { class: 'doc-linha' },
        previa,
        h(
          'div',
          { class: 'doc-img-bts' },
          h('label', { class: 'fx-bt' }, ic('imagem'), h('span', null, d.imagem ? 'Trocar a imagem' : 'Pôr uma imagem'), arquivo),
          d.imagem ? botao('Tirar a imagem', 'lixo', '', () => ((d.imagem = undefined), marcar(), desenharEditor())) : null,
        ),
      ),
      // as páginas em imagem (os documentos dos PDFs) e o móvel onde o documento está guardado
      d.imagens?.length
        ? h('div', { class: 'doc-linha' }, ...d.imagens.slice(0, 6).map((src, i) => h('div', { class: 'doc-img' }, h('img', { src, alt: `Página ${i + 1}`, loading: 'lazy' }))), h('p', { class: 'doc-dica' }, `${d.imagens.length} página${d.imagens.length > 1 ? 's' : ''} em imagem.`))
        : h('span'),
      d.guardado
        ? h('div', { class: 'doc-linha' }, h('p', { class: 'doc-dica' }, 'Guardado num móvel do cenário: quem procurar lá acha (o cartão do objeto entrega).'), botao('Tirar do móvel', 'lixo', '', () => ((d.guardado = undefined), marcar(), desenharEditor())))
        : h('p', { class: 'doc-dica' }, 'Para guardar num móvel: selecione o móvel no tabuleiro, Configurar, "Documentos guardados".'),
      paginas,
      h('div', { class: 'doc-para' }, h('h4', null, 'Entregar para'), h('label', { class: 'doc-check forte' }, equipe, 'Toda a equipe'), h('div', { class: 'doc-checks' }, ...agentes)),
      h(
        'div',
        { class: 'doc-bts' },
        d.id
          ? botao('Apagar', 'lixo', 'perigo', async () => {
              if (!(await confirmar('APAGAR O DOCUMENTO?', `"${d.titulo}" some para todos os agentes.`, 'Apagar', true))) return;
              app.net.send({ t: 'docApagar', id: d.id });
              rascunho = null;
              mudou = false;
              desenharEditor();
            })
          : null,
        h('span', { class: 'fj-esp' }),
        botao(d.id ? 'Salvar' : 'Criar e entregar', 'salvar', 'forte', salvar),
      ),
    );
  };

  redesenhar = () => {
    // o documento salvo volta do servidor com o número: abre ele de novo
    if (rascunho && !mudou && rascunho.id) {
      const novo = fonte.docs().find((x) => x.id === rascunho!.id);
      if (novo) rascunho = JSON.parse(JSON.stringify(novo)) as Documento;
      else rascunho = null;
      desenharEditor();
    }
    desenharLista();
  };
  desenharLista();
  desenharEditor();
}
