import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    // Split heavy, rarely-changing vendor libraries into separate chunks.
    // Combined with the immutable /assets/* cache headers (netlify.toml),
    // returning visitors only re-download the small app chunk.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-icons')) return 'vendor-icons';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('emoji-picker')) return 'vendor-emoji';
          if (id.includes('socket.io')) return 'vendor-net';
          if (id.includes('axios')) return 'vendor-net';
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('redux')
          ) return 'vendor-react';
        },
      },
    },
  },
});
