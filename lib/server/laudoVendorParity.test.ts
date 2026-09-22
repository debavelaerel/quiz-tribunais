import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// services/laudo-pdf/vendor/ é uma cópia local de reference/raio-x-da-base e
// public/brand/versao01-color0.svg — necessária porque o build de container
// na Vercel usa services/laudo-pdf/ isolado como contexto, sem acesso ao
// resto do repo (ver o cabeçalho de services/laudo-pdf/brand.py). Isso cria
// duas fontes de verdade que podem divergir silenciosamente: os checks de
// `_confirmar`/`PacoteMudou` em brand.py só validam o conteúdo da cópia que
// o serviço carrega, nunca "cópia bateu com o original". Esse teste é quem
// pega isso.
const REPO_ROOT = join(__dirname, '../..')

function hashArquivo(caminho: string): string {
  return createHash('sha256').update(readFileSync(caminho)).digest('hex')
}

function listarArquivos(dir: string): string[] {
  const resultado: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) resultado.push(...listarArquivos(caminho))
    else resultado.push(caminho)
  }
  return resultado
}

function compararArvores(origemDir: string, copiaDir: string) {
  const arquivosOrigem = listarArquivos(origemDir).map((f) => relative(origemDir, f)).sort()
  const arquivosCopia = listarArquivos(copiaDir).map((f) => relative(copiaDir, f)).sort()
  expect(arquivosCopia, `arquivos diferentes entre ${origemDir} e ${copiaDir}`).toEqual(arquivosOrigem)

  const divergentes = arquivosOrigem.filter(
    (rel) => hashArquivo(join(origemDir, rel)) !== hashArquivo(join(copiaDir, rel)),
  )
  expect(divergentes, `conteúdo divergente (cópia desatualizada) em: ${divergentes.join(', ')}`).toEqual([])
}

describe('services/laudo-pdf/vendor está sincronizado com os originais', () => {
  it('vendor/raio-x-da-base bate com reference/raio-x-da-base', () => {
    compararArvores(
      join(REPO_ROOT, 'reference/raio-x-da-base'),
      join(REPO_ROOT, 'services/laudo-pdf/vendor/raio-x-da-base'),
    )
  })

  it('vendor/brand/versao01-color0.svg bate com public/brand/versao01-color0.svg', () => {
    const origem = join(REPO_ROOT, 'public/brand/versao01-color0.svg')
    const copia = join(REPO_ROOT, 'services/laudo-pdf/vendor/brand/versao01-color0.svg')
    expect(hashArquivo(copia)).toBe(hashArquivo(origem))
  })
})
