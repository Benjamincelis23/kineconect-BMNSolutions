import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // Acceso y Panel Principal
        main: resolve(__dirname, 'index.html'),
        inicio: resolve(__dirname, 'inicio.html'),

        // Módulos Clínicos (mismo orden que la barra lateral)
        crear_pauta: resolve(__dirname, 'crear_pauta.html'),
        ejercicios: resolve(__dirname, 'ejercicios.html'),
        pautas: resolve(__dirname, 'pautas.html'),
        mensajes: resolve(__dirname, 'mensajes.html'),
        pacientes: resolve(__dirname, 'pacientes.html'),
      },
    },
  },
});