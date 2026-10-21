import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { regras } from '@crona/shared';

/**
 * Cora (21/10): a arma dela vale categoria 0 (Favorita) e 3 pacotes de balas longas lotam as 3 vagas de categoria I do
 * Operador. Uma modificação (arma categoria I) estoura o limite; duas (categoria II) cabem na vaga de II. A janela
 * precisa deixar escolher as duas de uma vez: só o conjunto final confere (LR p. 52 e 60).
 */
function agente(): regras.Ficha {
  const f = regras.novaFicha('Teste');
  f.classe = 'combatente';
  f.nex = 5;
  f.pp = 20; // Operador: 3 de categoria I, 1 de categoria II
  f.inventario = [
    { id: 'faca', tipo: 'arma', uid: 1 },
    { id: 'balas-curtas', tipo: 'equipamento', qtd: 1, uid: 2 },
    { id: 'balas-longas', tipo: 'equipamento', qtd: 3, uid: 3 },
  ] as regras.ItemFicha[];
  return f;
}

describe('modificações de uma vez (limite da patente)', () => {
  it('uma sozinha estoura a categoria I cheia; duas juntas viram categoria II e cabem', () => {
    const f = agente();
    const m = (id: string) => ({ tipo: 'modificacao' as const, id });
    assert.match(regras.erroDeLimiteMelhorias(f, 0, [m('tatica')]) ?? '', /limite/);
    assert.equal(regras.erroDeLimiteMelhorias(f, 0, [m('tatica'), m('alongada')]), null);
  });

  it('a opção sozinha não fica travada: o limite vira aviso e o conjunto é conferido ao gravar', () => {
    const f = agente();
    const op = regras.opcoesDeMelhoria(f, 0).find((o) => o.id === 'tatica')!;
    assert.equal(op.ok, true);
    assert.equal(op.limite, true);
    assert.ok(op.avisos.some((a) => a.includes('conjunto')));
  });

  it('o mesmo conjunto a mais estoura o limite: três modificações viram categoria III', () => {
    const f = agente();
    const m = (id: string) => ({ tipo: 'modificacao' as const, id });
    assert.match(regras.erroDeLimiteMelhorias(f, 0, [m('tatica'), m('alongada'), m('certeira')]) ?? '', /limite/);
  });
});
