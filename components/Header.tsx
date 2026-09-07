'use client'

import { ArrowLeft } from 'lucide-react'

type HeaderProps = {
  // 0-100. Omitido esconde a barra (abertura do funil e telas terminais —
  // mesma regra do funil de referência: progress.hidden = idx===0 || terminal).
  progresso?: number
  onVoltar?: () => void
}

// Cabeçalho compartilhado por todas as telas do quiz: logo oficial da VDE
// (wordmark "vde" + selo "Tribunais" já embutidos na própria arte, guia de
// marca "Raio-X da Base"), botão de voltar opcional e a barra de progresso
// do funil (gradiente dourado, como no funil de referência).
export default function Header({ progresso, onVoltar }: HeaderProps) {
  return (
    <header className="mx-auto w-full max-w-md px-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca, sem necessidade do pipeline de otimização de imagem */}
        <img src="/brand/versao01-color0.svg" alt="VDE Concursos — Tribunais" width={1163} height={393} className="h-7 w-auto" />
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand-ink-dim transition-colors hover:bg-brand-lav-soft hover:text-brand-ink"
          >
            <ArrowLeft size={15} strokeWidth={2.25} />
            voltar
          </button>
        )}
      </div>
      {progresso !== undefined && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#ECE9F5]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold transition-[width] duration-300 ease-out"
            style={{ width: `${progresso}%` }}
          />
        </div>
      )}
    </header>
  )
}
