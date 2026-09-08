'use client'

import { Flag } from 'lucide-react'

type ProgressTrailProps = {
  // 0-100. Sempre visível — do início (abertura) ao fim (resultado) — pra dar
  // a sensação contínua de "tô me movendo" (goal-gradient + metáfora de
  // percurso), em vez de escondida como a barra linear antiga.
  progresso: number
}

export default function ProgressTrail({ progresso }: ProgressTrailProps) {
  const pos = Math.min(100, Math.max(0, progresso))
  return (
    <div className="relative mt-4 h-5">
      <div
        className="absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, var(--color-brand-line) 0 6px, transparent 6px 11px)',
        }}
      />
      <span
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-300 ease-out"
        style={{
          left: `${pos}%`,
          backgroundImage: 'radial-gradient(circle at 35% 30%, var(--color-brand-gold), var(--color-brand-gold-deep))',
          boxShadow: '0 2px 6px rgba(200,155,24,0.5)',
        }}
      />
      <Flag size={15} strokeWidth={2} className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-navy" />
    </div>
  )
}
