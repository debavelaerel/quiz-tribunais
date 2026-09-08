'use client'

import { ArrowLeft } from 'lucide-react'
import ProgressBar from './ProgressBar'

type HeaderProps = {
  // 0-100. Sempre visível — do início (abertura) ao fim (resultado).
  progresso?: number
  onVoltar?: () => void
}

// Cabeçalho compartilhado por todas as telas do quiz: logo oficial da VDE
// (wordmark "vde" + selo "Tribunais" já embutidos na própria arte, guia de
// marca "Raio-X da Base"), botão de voltar opcional e a barra de progresso
// do funil (sempre visível, do início ao fim — sem marcos de fase, tom
// institucional).
export default function Header({ progresso = 0, onVoltar }: HeaderProps) {
  return (
    <header className="mx-auto w-full max-w-md px-6 pt-6">
      <div className="flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca, sem necessidade do pipeline de otimização de imagem */}
        <img src="/brand/versao01-color0.svg" alt="VDE Concursos — Tribunais" width={1163} height={393} className="h-12 w-auto" />
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand-ink-dim transition-colors hover:bg-brand-tint hover:text-brand-ink"
          >
            <ArrowLeft size={15} strokeWidth={2.25} />
            voltar
          </button>
        )}
      </div>
      <ProgressBar progresso={progresso} />
    </header>
  )
}
