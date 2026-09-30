import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

function gzipCompressionPlugin() {
  return {
    name: 'vite-plugin-gzip-compression',
    apply: 'build' as const,
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist/assets');
      if (!fs.existsSync(distDir)) return;
      const files = fs.readdirSync(distDir);
      for (const file of files) {
        if (file.endsWith('.wasm') || file.endsWith('.js') || file.endsWith('.css')) {
          const filePath = path.join(distDir, file);
          const buf = fs.readFileSync(filePath);
          
          // Gzip Level 9 (Max Compression)
          const gz = zlib.gzipSync(buf, { level: 9 });
          fs.writeFileSync(filePath + '.gz', gz);
        }
      }
      console.log('⚡ All assets (.wasm, .js, .css) pre-compressed to .gz (Gzip Level 9)');
    }
  };
}

export default defineConfig({
  plugins: [vue(), gzipCompressionPlugin()],
  resolve: {
    alias: {
      '@wasm-virtual/core': path.resolve(__dirname, '../core/index.ts'),
      '@wasm-virtual/vue': path.resolve(__dirname, '../vue/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    exclude: ['@wasm-virtual/core'],
  },
});
