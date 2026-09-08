'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// `?proximo=` vem da URL, então é entrada não-confiável. Só aceita um path
// interno (começa com uma única "/", nunca "//" — que o navegador trata como
// protocol-relative pra outro host — nem barra invertida). Sem essa checagem,
// um link tipo /admin/login?proximo=https://look-alike.com te loga de
// verdade e manda pra uma cópia phishing pedindo a senha nesse outro host
// (open redirect).
export function destinoSeguro(proximo: string | null): string {
  if (!proximo) return '/admin/leads'
  if (!proximo.startsWith('/') || proximo.startsWith('//') || proximo.includes('\\')) return '/admin/leads'
  return proximo
}

function FormularioLogin() {
  const router = useRouter()
  const params = useSearchParams()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar() {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setErro(res.status === 429 ? 'Muitas tentativas — aguarde um pouco.' : (json?.erro ?? 'Senha incorreta.'))
        return
      }
      router.replace(destinoSeguro(params.get('proximo')))
      router.refresh()
    } catch {
      setErro('Não foi possível conectar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
        <img src="/brand/versao01-color0.svg" alt="VDE Concursos — Tribunais" width={1163} height={393} className="mx-auto h-11 w-auto" />
        <h1 className="mt-7 text-xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">Painel administrativo</h1>
        <p className="mt-2 text-[14px] text-brand-ink-soft">Área restrita ao time VDE Tribunais.</p>

        <form
          className="mt-7 text-left"
          onSubmit={(e) => {
            e.preventDefault()
            void entrar()
          }}
        >
          <label htmlFor="admin-senha" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">Senha</label>
          <input
            id="admin-senha"
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink focus:border-brand-ink focus:outline-none focus:ring-4 focus:ring-brand-ink/10"
          />
          {erro && <p role="alert" className="mt-3 rounded-2xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-[13.5px] text-brand-red">{erro}</p>}
          <button
            type="submit"
            disabled={enviando || senha === ''}
            className="mt-5 w-full rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-deep px-6 py-4 text-[15.5px] font-semibold text-brand-navy shadow-[0_10px_24px_rgba(200,155,24,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(200,155,24,0.32)] disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// useSearchParams exige um limite de Suspense em volta — evita erro de build
// do Next em prerendering estático.
export default function AdminLoginPage() {
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  )
}
