import type { ClientMsg, ServerMsg } from '@crona/shared';

/** As mensagens de entrar: passam antes do `welcome` (as outras o servidor jogaria fora). A lista de campanhas também (29/10). */
const ENTRADA = new Set<ClientMsg['t']>(['login', 'contaCriar', 'contaEntrar', 'contaSair', 'campanhasMinhas', 'campanhaCriar', 'campanhaEntrar', 'campanhaConvite']);
const ehEntrada = (m: ClientMsg) => ENTRADA.has(m.t);

export class Net {
  private ws: WebSocket | null = null;
  private queue: ClientMsg[] = [];
  /**
   * Entrou (chegou o `welcome`): antes disso o servidor joga fora tudo que não é entrar. O que se fez com a conexão
   * caída (o celular dormiu) espera na fila até a entrada, em vez de se perder (auditoria de 27/10).
   */
  private dentro = false;
  onMessage: (m: ServerMsg) => void = () => {};
  onOpen: () => void = () => {};
  onClose: (code: number) => void = () => {};

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.dentro = false;
      // o que é para entrar (o login que a página mandou antes de a conexão abrir) sai já; o resto espera o welcome.
      // Sem isso o login ficava na fila esperando o welcome, que só vem depois do login (28/10)
      const fila = this.queue.splice(0);
      for (const m of fila) {
        if (ehEntrada(m)) ws.send(JSON.stringify(m));
        else this.queue.push(m);
      }
      this.onOpen();
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
      } catch (err) {
        console.error('[net]', err);
      }
    };
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      this.dentro = false;
      this.onClose(e.code);
    };
  }

  /** fecha sem reconectar */
  close() {
    this.onClose = () => {};
    this.ws?.close();
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** O servidor aceitou a entrada: manda o que ficou na fila. */
  entrou() {
    this.dentro = true;
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    for (const m of this.queue.splice(0)) this.ws.send(JSON.stringify(m));
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN && (this.dentro || ehEntrada(m))) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }
}
