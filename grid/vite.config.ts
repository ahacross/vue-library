import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib'

  return {
    plugins: [
      vue(),
      isLib && dts({
        tsconfigPath: './tsconfig.json',
        insertTypesEntry: true,
        rollupTypes: true
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        'yz-grid/style.css': resolve(__dirname, 'src/lib/style/grid.css'),
        'yz-grid': resolve(__dirname, 'src/lib/index.ts')
      }
    },
    server: {
      watch: {
        ignored: ['**/rust-engine/**']
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    build: isLib ? {
      lib: {
        entry: resolve(__dirname, 'src/lib/index.ts'),
        name: 'YzGrid',
        fileName: (format) => `yz-grid.${format === 'es' ? 'js' : 'umd.cjs'}`
      },
      rollupOptions: {
        external: ['vue'],
        output: {
          exports: 'named',
          globals: {
            vue: 'Vue'
          }
        }
      }
    } : {
      outDir: 'dist-demo'
    }
  }
})
