'use client'

import type { ReactNode } from 'react'

type OptionButtonProps = {
  selected: boolean
  multi?: boolean
  onClick: () => void
  sub?: string
  disabled?: boolean
  children: ReactNode
}

// Cartão de opção (rádio ou checkbox) do funil: mesmo padrão visual do
// `.opt`/`.dot` do funil de referência — borda + dot indicador, estado
// selecionado em roxo/lilás-claro. Fica como <button> puro (sem role
// radio/checkbox explícito) de propósito: os testes navegam o funil pegando
// "o primeiro button da tela", e um role explícito tiraria esses cartões da
// árvore de acessibilidade como "button".
export default function OptionButton({ selected, multi, onClick, sub, disabled, children }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3.5 rounded-[18px] border-[1.5px] px-4 py-4 text-left text-[15.5px] font-medium leading-snug text-brand-ink transition-colors disabled:opacity-50 ${
        selected
          ? 'border-brand-purple bg-brand-lav-soft'
          : 'border-brand-line bg-brand-card hover:border-brand-line-strong'
      }`}
    >
      <span
        className={`mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center border-[1.5px] ${
          multi ? 'rounded-[7px]' : 'rounded-full'
        } ${selected ? 'border-brand-purple' : 'border-brand-line-strong'}`}
      >
        {selected && (
          <span className={`h-2.5 w-2.5 bg-brand-purple ${multi ? 'rounded-[3px]' : 'rounded-full'}`} />
        )}
      </span>
      <span className="flex-1">
        {children}
        {sub && <span className="mt-0.5 block text-[13.5px] font-normal text-brand-ink-dim">{sub}</span>}
      </span>
    </button>
  )
}
