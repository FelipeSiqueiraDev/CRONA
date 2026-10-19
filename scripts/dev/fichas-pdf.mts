// As fichas completas em HTML (para virar PDF), calculadas pelo motor do jogo (19/10, o Felipe: "um PDF com as fichas
// dos 4 Marcados, detalhadamente, todas as informações").
//
//   npx tsx scripts/dev/fichas-pdf.mts <fichas.json> <saida.html>
//
// O JSON é a lista de fichas salvas (a coluna `dados` da tabela fichas). Depois:
//   msedge --headless=new --print-to-pdf=<saida.pdf> <saida.html>
import fs from 'node:fs';
import { regras } from '@crona/shared';

const [entrada, saida] = process.argv.slice(2);
const fichas = JSON.parse(fs.readFileSync(entrada, 'utf8')) as any[];
const cat = regras.catalogo;
const C = cat.CATALOGO as any;

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ATR: Record<string, string> = { agi: 'Agilidade', for: 'Força', int: 'Intelecto', pre: 'Presença', vig: 'Vigor' };
const ATRC: Record<string, string> = { agi: 'AGI', for: 'FOR', int: 'INT', pre: 'PRE', vig: 'VIG' };
const GRAU: Record<string, string> = { destreinado: '—', treinado: 'Treinado (+5)', veterano: 'Veterano (+10)', expert: 'Expert (+15)' };
const ref = (r?: { fonte: string; pagina: number }) => (r ? `${r.fonte === 'LR' ? 'LR' : r.fonte === 'SAH' ? 'SaH' : r.fonte} p. ${r.pagina}` : '');
const teste = (dados: number, bonus: number, pen = 0) => {
  const n = dados + pen;
  const d = n >= 1 ? `${n}d20` : `${dados + Math.abs(pen) + (n < 1 && dados <= 0 ? 1 : 0)}d20 (o pior)`;
  return `${d}${bonus ? (bonus > 0 ? ` + ${bonus}` : ` − ${-bonus}`) : ''}`;
};
const nomeDe = (lista: any[] | undefined, id: string | null | undefined) => lista?.find((x) => x.id === id)?.nome ?? id ?? '—';

/** O resumo do que a coisa faz: procura no catálogo inteiro um objeto com esse id que tenha resumo. */
const resumos = new Map<string, any>();
const varre = (o: any) => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) return o.forEach(varre);
  if (typeof o.id === 'string' && (o.resumo || o.efeito || o.texto) && !resumos.has(o.id)) resumos.set(o.id, o);
  for (const v of Object.values(o)) if (v && typeof v === 'object') varre(v);
};
varre(C);
const resumoDe = (id: string) => {
  const x = resumos.get(id);
  return x?.resumo ?? (typeof x?.efeito === 'string' ? x.efeito : '') ?? '';
};

const TIPO_PODER: Record<string, string> = { origem: 'Origem', habilidade: 'Habilidade de classe', classe: 'Poder de classe', trilha: 'Trilha', paranormal: 'Poder paranormal', geral: 'Poder geral' };

function ficha(fs: any): string {
  const f = fs.ficha;
  const k: any = regras.calcular(f);
  const atual = fs.atual ?? {};
  const classe = nomeDe(C.classes, f.classe);
  const trilha = nomeDe(C.trilhas, f.trilha);
  const origem = cat.origem(f.origem) as any;
  const linhas: string[] = [];
  const sec = (t: string, corpo: string) => linhas.push(`<section><h2>${esc(t)}</h2>${corpo}</section>`);

  // cabeçalho
  linhas.push(`<header><h1>${esc(fs.nome)}</h1><p class="sub">${esc(classe)} · ${esc(trilha)} · origem ${esc(origem?.nome ?? f.origem)} · NEX ${f.nex}% · ${esc(k.patente?.nome ?? '')} (${f.pp} PP, crédito ${esc(k.patente?.credito ?? '—')})</p></header>`);

  // atributos e números
  sec(
    'Atributos',
    `<div class="atrs">${Object.keys(ATR)
      .map((a) => `<div class="atr"><b>${k.atributos[a]}</b><span>${ATR[a]}</span></div>`)
      .join('')}</div><p class="nota">Distribuição da criação: ${Object.keys(ATR).map((a) => `${ATRC[a]} ${f.atributos[a]}`).join(', ')}. Aumentos de NEX: ${
      Object.entries(f.progressao ?? {})
        .filter(([, e]: any) => e?.atributo)
        .map(([n, e]: any) => `NEX ${n}% ${ATRC[e.atributo]}`)
        .join(', ') || 'nenhum'
    }.</p>`,
  );
  const vit = (nome: string, a: number | undefined, m: number) => `<div class="vit"><span>${nome}</span><b>${a ?? m} / ${m}</b></div>`;
  sec(
    'Pontos e combate',
    `<div class="vits">${vit('PV', atual.pv, k.pv)}${vit('PE', atual.pe, k.pe)}${vit('SAN', atual.san, k.san)}</div>
    <table><tr><th>Defesa</th><td>${k.defesa}${k.protecao ? ` (proteção +${k.protecao})` : ''}</td><th>Deslocamento</th><td>${k.deslocamento} m</td></tr>
    <tr><th>Limite de PE por turno</th><td>${k.limitePe}</td><th>DT dos rituais</th><td>${k.dtRituais}</td></tr>
    <tr><th>Esquiva</th><td>${k.reacoes.esquiva ?? '—'}</td><th>Bloqueio</th><td>${k.reacoes.bloqueio !== null ? `RD ${k.reacoes.bloqueio}` : '—'}</td></tr>
    <tr><th>Contra-ataque</th><td>${k.reacoes.contraAtaque ? 'Sim' : '—'}</td><th>DT das habilidades</th><td>${Object.entries(k.dtHabilidades).map(([a, v]) => `${ATRC[a]} ${v}`).join(' · ')}</td></tr>
    <tr><th>Resistências</th><td colspan="3">${Object.entries(k.resistencias).map(([t, v]) => `${t} ${v}`).join(', ') || '—'}</td></tr>
    <tr><th>Proficiências</th><td colspan="3">${esc(k.proficiencias.map((x: string) => x.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ') || '—')}</td></tr>
    <tr><th>Carga</th><td colspan="3">${k.carga.usados} de ${k.carga.espacos} espaços (máximo ${k.carga.maximo})</td></tr></table>`,
  );

  // perícias
  sec(
    'Perícias',
    `<table class="pers"><tr><th>Perícia</th><th>Atributo</th><th>Grau</th><th>Teste</th></tr>${(C.pericias as any[])
      .map((p) => {
        const pc = k.pericias[p.id];
        const nome = p.id === 'profissao' && f.profissao ? `Profissão (${f.profissao})` : p.nome;
        const tr = pc.grau !== 'destreinado';
        return `<tr class="${tr ? 'tr' : ''}"><td>${esc(nome)}${p.somenteTreinada ? ' <small>(só treinada)</small>' : ''}</td><td>${ATRC[pc.atributo]}</td><td>${GRAU[pc.grau]}</td><td>${pc.podeUsar ? teste(pc.dados, pc.bonus, pc.penalidadeDados) : '—'}</td></tr>`;
      })
      .join('')}</table>`,
  );

  // ataques
  sec(
    'Ataques',
    k.ataques.length
      ? `<table><tr><th>Ataque</th><th>Teste</th><th>Dano</th><th>Crítico</th><th>Tipo</th></tr>${k.ataques
          .map((a: any) => `<tr><td>${esc(a.nome)}</td><td>${a.pericia === 'pontaria' ? 'Pontaria' : 'Luta'} ${teste(a.dados, a.bonus, a.penalidadeDados)}</td><td>${esc(a.dano)}</td><td>${a.critico.margem < 20 ? `${a.critico.margem}/` : ''}x${a.critico.multiplicador}</td><td>${esc((a.tipoDano ?? []).join(', '))}</td></tr>${a.notas?.length ? `<tr><td colspan="5" class="nota">${esc(a.notas.join(' · '))}</td></tr>` : ''}`)
          .join('')}</table>`
      : '<p>—</p>',
  );

  // poderes e habilidades
  sec(
    'Poderes e habilidades',
    k.poderes
      .map((p: any) => {
        const notas = (p.efeitos ?? []).filter((e: any) => e.alvo === 'nota' && (!e.etapa || (e.etapa === 'com') === !!f.etapaCumprida)).map((e: any) => e.texto);
        const r = resumoDe(p.id);
        const esco = p.escolha ? Object.entries(p.escolha).map(([kk, v]) => `${kk}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : '';
        return `<div class="poder"><h3>${esc(p.nome)} <small>${esc(TIPO_PODER[p.tipo] ?? p.tipo)} · NEX ${p.nex}%</small></h3>${r ? `<p>${esc(r)}</p>` : ''}${esco ? `<p class="nota">Escolha: ${esc(esco)}</p>` : ''}${notas.map((n: string) => `<p class="nota">${esc(n)}</p>`).join('')}</div>`;
      })
      .join('') || '<p>—</p>',
  );

  // rituais
  if (k.rituais.length)
    sec(
      'Rituais',
      `<p class="nota">Rituais por poder: ${k.rituaisPorPoder.usados} de ${k.rituaisPorPoder.limite}.</p>${k.rituais
        .map((rr: any) => {
          const r: any = cat.ritual(rr.id);
          const custo = k.custoRituais[rr.id];
          return `<div class="poder"><h3>${esc(r?.nome ?? rr.id)} <small>${r?.circulo}º círculo · ${esc(r?.elemento)} · aprendido no NEX ${rr.nex}% (${esc(rr.via)})</small></h3>
          <table><tr><th>Execução</th><td>${esc(r?.execucao)}</td><th>Alcance</th><td>${esc(r?.alcance)}</td></tr><tr><th>Alvo / área</th><td>${esc(r?.alvo ?? r?.area ?? '—')}</td><th>Duração</th><td>${esc(r?.duracao)}</td></tr><tr><th>Resistência</th><td>${esc(r?.resistencia ?? '—')}</td><th>Custo e DT</th><td>${custo?.pe ?? '?'} PE · DT ${custo?.dt ?? '?'}</td></tr></table>
          ${resumoDe(rr.id) ? `<p>${esc(resumoDe(rr.id))}</p>` : ''}<p class="nota">${esc(ref(r?.ref))}</p></div>`;
        })
        .join('')}`,
    );

  // evolução NEX a NEX
  const nexes = Object.keys(f.progressao ?? {}).map(Number).sort((a, b) => a - b);
  sec(
    'Evolução, NEX a NEX',
    `<p>NEX 5%: criação — classe ${esc(classe)}, origem ${esc(origem?.nome)} (perícias ${esc((origem?.pericias ?? []).map((p: string) => nomeDe(C.pericias, p)).join(', '))}); perícias da classe ${esc([...(f.pericias.grupos ?? []), ...(f.pericias.livres ?? [])].map((p: string) => nomeDe(C.pericias, p)).join(', '))}.</p>${nexes
      .map((n) => {
        const e = f.progressao[n];
        const partes: string[] = [];
        if (e.poder) partes.push(`poder: ${nomeDe(C.poderes, e.poder.id)}`);
        if (e.atributo) partes.push(`+1 em ${ATR[e.atributo]}`);
        if (e.rituais?.length) partes.push(`ritual: ${e.rituais.map((r: string) => cat.ritual(r)?.nome ?? r).join(', ')}`);
        if (e.parametros) for (const [h, v] of Object.entries(e.parametros) as any) partes.push(`${resumos.get(h)?.nome ?? h}: ${Object.values(v).flat().map((x: any) => cat.ritual(x)?.nome ?? x).join(', ')}`);
        if (e.grau?.length) partes.push(`grau: ${e.grau.join(', ')}`);
        if (e.afinidade) partes.push(`afinidade: ${e.afinidade}`);
        return `<p>NEX ${n}%: ${esc(partes.join('; ') || '—')}</p>`;
      })
      .join('')}`,
  );

  // companheiro, condições, mochila, avisos, pendências
  const cp = fs.companheiro;
  if (cp) sec('Companheiro', `<p><b>${esc(cp.nome)}</b> — ${esc(cp.tipo)}${cp.pvMax ? ` · PV ${cp.pv ?? cp.pvMax} / ${cp.pvMax}` : ''}${cp.segue ? ' · está com o agente' : ''}</p>`);
  sec('Condições', `<p>${esc((fs.condicoes ?? []).map((c: string) => cat.condicao(c)?.nome ?? c).join(', ') || 'nenhuma marcada')}${f.etapaCumprida ? ' · etapa ritualística do dia cumprida' : ''}</p>`);
  sec('Mochila', f.inventario.length ? `<ul>${f.inventario.map((i: any) => `<li>${esc(regras.nomeDoItem(i))}</li>`).join('')}</ul>` : '<p>Vazia.</p>');
  const pend = [...k.pendencias.map((p: any) => `Falta escolher: ${p.texto}`), ...k.problemas.map((p: any) => `${p.onde}: ${p.texto}`), ...(f.avisos ?? [])];
  if (pend.length) sec('Pendências e avisos', `<ul>${pend.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`);
  const tx = f.textos ?? {};
  const textos = Object.entries({ Idade: tx.idade, Aparência: tx.aparencia, Personalidade: tx.personalidade, Histórico: tx.historico, Objetivo: tx.objetivo }).filter(([, v]) => v);
  if (textos.length) sec('Toques finais', textos.map(([kk, v]) => `<p><b>${kk}:</b> ${esc(v)}</p>`).join(''));
  return `<article class="ficha">${linhas.join('')}</article>`;
}

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fichas dos Marcados</title><style>
@page { size: A4; margin: 14mm 13mm; }
body { font: 10.5pt/1.35 'Segoe UI', system-ui, sans-serif; color: #1b1b1f; }
.ficha { page-break-after: always; }
.ficha:last-child { page-break-after: auto; }
header { border-bottom: 2.5pt solid #8e1f1a; margin-bottom: 8pt; }
h1 { font-size: 22pt; margin: 0; color: #8e1f1a; letter-spacing: 0.02em; }
.sub { margin: 2pt 0 6pt; color: #444; }
h2 { font-size: 12pt; margin: 10pt 0 4pt; color: #8e1f1a; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 0.6pt solid #d6c7b8; break-after: avoid; }
h3 { font-size: 10.5pt; margin: 6pt 0 2pt; }
h3 small, small { color: #666; font-weight: 400; }
section { break-inside: auto; }
.atrs, .vits { display: flex; gap: 8pt; }
.atr, .vit { flex: 1; border: 0.8pt solid #c9b8a6; border-radius: 4pt; text-align: center; padding: 4pt; background: #faf6f0; }
.atr b { display: block; font-size: 18pt; color: #8e1f1a; }
.vit b { display: block; font-size: 14pt; }
.vit span, .atr span { font-size: 8.5pt; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0; }
th, td { border: 0.5pt solid #ddd0c2; padding: 2.5pt 5pt; text-align: left; vertical-align: top; }
th { background: #f4ece2; font-weight: 600; width: 22%; }
.pers th { width: auto; }
.pers tr.tr td { font-weight: 600; }
.pers tr:not(.tr) td { color: #777; }
.poder { break-inside: avoid; margin-bottom: 4pt; }
.poder p { margin: 1pt 0; }
.nota { color: #555; font-size: 9pt; margin: 2pt 0; }
ul { margin: 2pt 0 2pt 14pt; padding: 0; }
</style></head><body>${fichas.map(ficha).join('')}</body></html>`;
fs.writeFileSync(saida, html, 'utf8');
console.log('ok', saida, fichas.length);
