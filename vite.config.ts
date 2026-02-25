import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
    plugins: [
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
    ],
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
      chunkSizeWarningLimit: 1000, // Increase chunk size warning limit to 1000kb
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: false,
        open: true,
    },
}));
