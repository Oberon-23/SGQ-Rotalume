import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Os mesmos cabeçalhos de segurança da Vercel valem no `vite preview`, para os testes no navegador
// pegarem qualquer coisa que a política de segurança (CSP) bloquearia em produção.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
const prodHeaders = Object.fromEntries((vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: prodHeaders },
  build: {
    rollupOptions: {
      output: {
        // bibliotecas em arquivos separados: mudam pouco e ficam no cache do navegador entre os deploys
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'react'
          if (id.includes('node_modules/lucide-react')) return 'icones'
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // as regras de negócio (src/data) precisam continuar testadas: o CI falha se a cobertura cair
    coverage: { include: ['src/data/**'], exclude: ['src/data/**/*.test.ts', 'src/data/types.ts', 'src/data/store.tsx', 'src/data/cloud.ts'], thresholds: { lines: 90, functions: 80, branches: 75 } },
  },
})
