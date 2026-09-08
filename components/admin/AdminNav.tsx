'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Users, PieChart as PieChartIcon, LogOut } from 'lucide-react'

const ITENS = [
  { href: '/admin/leads', label: 'Leads', Icone: Users },
  { href: '/admin/analytics', label: 'Analytics', Icone: PieChartIcon },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function sair() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <aside className="flex w-[232px] flex-none flex-col border-r border-brand-line px-4 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src="/brand/versao01-color0.svg" alt="VDE Concursos — Tribunais" width={1163} height={393} className="mb-6 ml-2 h-8 w-auto" />

      <nav className="flex flex-col gap-0.5">
        {ITENS.map(({ href, label, Icone }) => {
          const ativo = pathname === href || pathname.startsWith(href + '/')
          return (
            <a
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors ${
                ativo ? 'bg-brand-tint font-semibold text-brand-ink' : 'text-brand-ink-soft hover:bg-brand-tint hover:text-brand-ink'
              }`}
            >
              <Icone size={17} strokeWidth={2.25} />
              {label}
            </a>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-brand-line pt-4">
        <button
          type="button"
          onClick={() => void sair()}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-medium text-brand-ink-soft transition-colors hover:bg-brand-tint hover:text-brand-ink"
        >
          <LogOut size={17} strokeWidth={2.25} />
          Sair
        </button>
      </div>
    </aside>
  )
}
