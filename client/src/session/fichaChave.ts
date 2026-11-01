/**
 * A chave da ficha do jogador (?ficha=CHAVE), guardada no aparelho. Fica fora da telaFicha.ts (01/11) para o começo
 * do jogo saber se é o celular do jogador sem baixar a tela dele (cada tela vem em um pedaço, só quando é usada).
 */
const CHAVE = 'crona.fichaKey';

/** A chave do link (?ficha=CHAVE), ou a guardada quando o link vem sem ela (?ficha). */
export function lerChaveFicha(): string | null {
  const q = new URLSearchParams(location.search);
  const daUrl = q.get('ficha');
  try {
    if (daUrl) localStorage.setItem(CHAVE, daUrl);
    return daUrl || (q.has('ficha') ? localStorage.getItem(CHAVE) : null);
  } catch {
    return daUrl;
  }
}

export function guardarChaveFicha(chave: string) {
  try {
    localStorage.setItem(CHAVE, chave);
  } catch {
    /* sem armazenamento */
  }
}

export function esquecerChaveFicha() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento */
  }
}
