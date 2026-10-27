/**
 * De onde partiu cada cópia de ficha que a tela mexe (27/10, auditoria: "a ficha inteira por cima").
 *
 * Toda edição trabalha numa cópia; ao gravar, a cópia vai junto da ficha do servidor de onde ela saiu (`base`), e o
 * servidor fica só com o que mudou (`mesclarFicha`): o dano do combate, o item entregue ou a condição marcada no meio
 * do caminho não se perdem. A ficha que chega do servidor ainda não foi mexida: a cópia dela parte dela mesma.
 */
import { mesclarFicha, type ClientMsg, type FichaSalva } from '@crona/shared';

const origem = new WeakMap<object, string>();

/** Uma cópia para mexer, lembrando de que ficha do servidor ela partiu. */
export function clonarFicha(fs: FichaSalva): FichaSalva {
  const json = JSON.stringify(fs);
  const c = JSON.parse(json) as FichaSalva;
  origem.set(c, origem.get(fs) ?? json);
  return c;
}

/** A mensagem de gravar: a ficha e, se se sabe, a base de onde ela partiu. */
export function gravarFicha(fs: FichaSalva): ClientMsg {
  const base = origem.get(fs);
  return base ? { t: 'fichaSalvar', ficha: fs, base: JSON.parse(base) as FichaSalva } : { t: 'fichaSalvar', ficha: fs };
}

/**
 * Chegou a ficha do servidor enquanto a cópia ainda tem mudança a mandar: a cópia passa a partir dela, com as
 * mudanças daqui por cima (o que o servidor mudou aparece na tela, o que se mexeu aqui continua).
 */
export function rebasearFicha(local: FichaSalva, servidor: FichaSalva): FichaSalva {
  const base = origem.get(local);
  const json = JSON.stringify(servidor);
  const r = base ? mesclarFicha(JSON.parse(base) as FichaSalva, local, JSON.parse(json) as FichaSalva) : (JSON.parse(json) as FichaSalva);
  const c = JSON.parse(JSON.stringify(r)) as FichaSalva;
  origem.set(c, json);
  return c;
}
