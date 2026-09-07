'use client'

import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'gold' | 'navy'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

// Classes exportadas para o único lugar que precisa do mesmo visual num
// elemento que não é um <button> (o CTA de WhatsApp, que é um link).
export const BUTTON_BASE =
  'w-full rounded-full px-6 py-4 text-[15.5px] font-semibold transition-all disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none flex items-center justify-center gap-2'

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Dourado = ação que empurra a narrativa do funil pra frente (mesma regra
  // do funil de referência: quase todo CTA de avanço usa `.btn.gold`).
  gold: 'bg-gradient-to-br from-brand-gold to-brand-gold-deep text-brand-navy shadow-[0_10px_24px_rgba(200,155,24,0.28)] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(200,155,24,0.32)]',
  // Navy = confirmação neutra (ex.: "Continuar" depois de uma seleção múltipla).
  navy: 'bg-brand-navy text-white shadow-[0_10px_24px_rgba(1,18,58,0.18)] hover:-translate-y-0.5 hover:bg-brand-navy-2 hover:shadow-[0_14px_28px_rgba(1,18,58,0.22)]',
}

export default function Button({ variant = 'navy', className = '', ...props }: ButtonProps) {
  return <button className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} {...props} />
}
