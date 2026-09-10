// Termômetro de nível — substitui o card azul "Nível no teste" na tela de
// resultado (ver components/Quiz.tsx). As 3 faixas (inicial/intermediário/
// avançado) e o ponteiro são posições fixas, não calculadas em runtime: com
// só 3 níveis possíveis (ver nivelTeste em lib/perfil.ts), é mais simples e
// mais confiável cravar as 3 coordenadas já validadas visualmente do que
// gerar arco/ângulo por trigonometria pra um valor que só assume 3 estados.
const FAIXAS = [
  { nivel: 'inicial', path: 'M 20 100 A 80 80 0 0 1 73 24', agulha: { x: 31, y: 60 } },
  { nivel: 'intermediário', path: 'M 76 22 A 80 80 0 0 1 124 22', agulha: { x: 100, y: 20 } },
  { nivel: 'avançado', path: 'M 127 24 A 80 80 0 0 1 180 100', agulha: { x: 169, y: 60 } },
] as const

type NivelGaugeProps = {
  nivel: string
  acertos: number
  total: number
}

export default function NivelGauge({ nivel, acertos, total }: NivelGaugeProps) {
  const ativa = FAIXAS.find((f) => f.nivel === nivel) ?? FAIXAS[0]
  return (
    <div className="flex items-center gap-4 rounded-[14px] bg-gradient-to-br from-brand-navy to-brand-navy-2 px-5 py-4">
      <svg viewBox="0 0 200 120" width={118} height={71} role="img" aria-label={`Nível: ${nivel}`} className="flex-none">
        {FAIXAS.map((f) => (
          <path key={f.nivel} d={f.path} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={16} strokeLinecap="round" />
        ))}
        <path d={ativa.path} fill="none" stroke="#F9E08A" strokeWidth={16} strokeLinecap="round" />
        <line x1={100} y1={100} x2={ativa.agulha.x} y2={ativa.agulha.y} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
        <circle cx={100} cy={100} r={7} fill="#fff" />
      </svg>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Nível no teste</p>
        <p className="mt-1 text-[17px] font-bold text-white">{nivel}</p>
        <p className="mt-1 text-[12px] text-white/70">{acertos}/{total} questões certas</p>
      </div>
    </div>
  )
}
