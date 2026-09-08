'use client'

type ProgressBarProps = {
  // 0-100. Sempre visível — do início (abertura) ao fim (resultado).
  progresso: number
}

// Barra de progresso simples: só o preenchimento contínuo, sem marcos de
// fase nem elementos lúdicos (corredor/bandeira) — tom institucional,
// mais adequado ao público de concurso de tribunais.
export default function ProgressBar({ progresso }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, progresso))
  return (
    <div className="mt-4 h-[7px] w-full overflow-hidden rounded-full bg-[#ECE9F5]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
