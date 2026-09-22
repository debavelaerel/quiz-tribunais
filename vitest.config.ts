import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Worktrees aninhados (.worktrees/, .claude/worktrees/) são cópias
    // completas do repo, cada uma com o próprio node_modules — sem essa
    // exclusão o glob padrão do Vitest pega os *.test.tsx de dentro deles e
    // roda contra uma segunda cópia do React (diferente da que o jsdom usa
    // aqui), estourando "Cannot read properties of null (reading 'useState')".
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
