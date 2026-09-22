'use client'

// Input só-leitura que seleciona tudo ao focar — clique, Ctrl+C, cola no
// Clint. Não é um botão "copiar" (evita pedir permissão de clipboard só
// pra isso); selecionar e copiar manualmente já resolve.
export default function CampoCopiavel({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-brand-ink-dim">{label}</div>
      <input
        readOnly
        value={valor}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-0.5 w-full rounded-[10px] border-[1.5px] border-brand-line bg-brand-tint px-2.5 py-1.5 font-mono text-[11.5px] text-brand-ink"
      />
    </div>
  )
}
