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
        'vue-arborist/style.css': resolve(__dirname, 'src/lib/Tree.vue'),
        'vue-arborist': resolve(__dirname, 'src/lib/index.ts')
      }
    },
    build: isLib ? {
      lib: {
        entry: resolve(__dirname, 'src/lib/index.ts'),
        name: 'VueArborist',
        fileName: (format) => `vue-arborist.${format === 'es' ? 'js' : 'umd.cjs'}`
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
