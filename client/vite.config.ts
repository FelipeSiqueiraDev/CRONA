import { defineConfig } from 'vite';

// o servidor do desenvolvimento (CRONA_PORT, se o servidor subir em outra porta)
const target = `http://localhost:${process.env.CRONA_PORT || 3001}`;

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // o tablet da mesa abre pela rede (http://IP-deste-computador:5173/?mesa)
    host: true,
    // Pastas sincronizadas (OneDrive) às vezes perdem eventos de arquivo.
    watch: { usePolling: true, interval: 250 },
    proxy: {
      // xfwd: o servidor precisa saber quem é deste computador (o mestre) e quem é o tablet
      '/ws': { target, ws: true, xfwd: true },
      '/api': { target, xfwd: true },
      '/uploads': { target },
    },
  },
});
