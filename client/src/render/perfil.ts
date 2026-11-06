/**
 * O perfil do quadro (06/11, a investigação do desempenho): o tempo e a memória criada em cada parte do desenho do
 * tabuleiro. Desligado, cada marca é uma comparação só. Liga com `?fps` (o medidor mostra as partes) ou pelo console
 * (`__perfil.ativo = true`); `__perfil.tabela()` lista a média por quadro.
 */
type Mem = { usedJSHeapSize: number };
const mem = (): number => (performance as Performance & { memory?: Mem }).memory?.usedJSHeapSize ?? 0;

interface Secao {
  ms: number;
  kb: number;
}

class Perfil {
  ativo = false;
  private t = 0;
  private m = 0;
  private quadros = 0;
  private secoes = new Map<string, Secao>();

  /** começo do quadro */
  comeco() {
    if (!this.ativo) return;
    this.quadros++;
    this.t = performance.now();
    this.m = mem();
  }

  /** fecha a parte que terminou aqui */
  marca(nome: string) {
    if (!this.ativo) return;
    const t = performance.now();
    const m = mem();
    const s = this.secoes.get(nome) ?? { ms: 0, kb: 0 };
    s.ms += t - this.t;
    // o coletor de lixo pode rodar no meio: a memória que cai não conta
    if (m > this.m) s.kb += (m - this.m) / 1024;
    this.secoes.set(nome, s);
    this.t = t;
    this.m = m;
  }

  /** a média por quadro de cada parte, da mais cara para a mais barata */
  tabela(): { parte: string; ms: number; kb: number }[] {
    const n = Math.max(1, this.quadros);
    return [...this.secoes]
      .map(([parte, s]) => ({ parte, ms: Math.round((s.ms / n) * 100) / 100, kb: Math.round((s.kb / n) * 10) / 10 }))
      .sort((a, b) => b.ms - a.ms);
  }

  zerar() {
    this.secoes.clear();
    this.quadros = 0;
  }
}

export const perfil = new Perfil();
if (typeof window !== 'undefined') {
  (window as unknown as { __perfil: Perfil }).__perfil = perfil;
  if (/[?&]fps\b/.test(location.search)) perfil.ativo = true;
}
