import { chromium } from 'playwright'
import type { QuizSession } from './types'
import { DIAG, L } from '../quizContent'

const CSS = `
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Poppins', system-ui, sans-serif; color: #203C7C; }
  .eyebrow { display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
    color: #8A6A0C; background: #FBF3D6; border-radius: 999px; padding: 5px 11px; margin: 0 0 10px; }
  h1 { font-size: 26px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 12px; }
  h2 { font-size: 18px; color: #203C7C; margin: 24px 0 10px; }
  h3 { font-size: 14px; color: #203C7C; margin: 0 0 6px; padding-left: 12px; border-left: 3px solid #203C7C; }
  p { font-size: 12.5px; line-height: 1.6; color: #5B6478; margin: 0 0 9px; }
  .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
  .resumo div { border: 1.5px solid #E7E7EA; border-radius: 12px; padding: 10px 13px; font-size: 12px; }
  .resumo span:first-child { display: block; color: #7C86A6; font-size: 10.5px; }
  .blk { background: #FFFFFF; border: 1.5px solid #E7E7EA; border-radius: 14px; padding: 13px 16px; margin: 0 0 9px; break-inside: avoid; }
  .box { background: #FFFFFF; border: 1.5px solid #E7E7EA; border-left: 4px solid #C89B18; border-radius: 12px; padding: 12px 15px; margin: 12px 0; }
  ol { list-style: none; margin: 0; padding: 0; counter-reset: passo; }
  ol li { counter-increment: passo; position: relative; padding: 10px 14px 10px 42px; margin-bottom: 7px;
    background: #FFFFFF; border: 1.5px solid #E7E7EA; border-radius: 12px; font-size: 12.5px; color: #5B6478; }
  ol li::before { content: counter(passo); position: absolute; left: 13px; top: 9px; width: 20px; height: 20px;
    border-radius: 50%; background: #203C7C; color: #fff; font-size: 10.5px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; }
`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function montarHtmlLaudo(sessao: QuizSession, nivel: string): string {
  const momento = sessao.perfil.momento ? DIAG[sessao.perfil.momento] : undefined
  const primeiroNome = sessao.nome.split(' ')[0]
  const blocos = sessao.blocos ?? []
  const mostrarPlano = sessao.perfil.leitura === 'completa' && momento

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <span class="eyebrow">Diagnóstico da Base</span>
    <h1>${escapeHtml(primeiroNome)}, este é o seu raio-x completo.</h1>
    <div class="resumo">
      <div><span>Onde você está</span>${sessao.perfil.momento ? escapeHtml(L.momento[sessao.perfil.momento]) : ''}</div>
      <div><span>Curso indicado</span>${escapeHtml(sessao.perfilCalculado?.curso ?? '')}</div>
      <div><span>Ritmo</span>${escapeHtml(sessao.perfilCalculado?.ritmo ?? '')}</div>
      <div><span>Nível no teste</span>${escapeHtml(nivel)} · ${sessao.acertos ?? 0} de ${sessao.total ?? 0}</div>
    </div>

    ${momento ? `
      <h2>A leitura do seu caso</h2>
      ${momento.texto.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}
      <div class="box"><p><b>Começa por aqui:</b> ${escapeHtml(momento.prescricao)}</p></div>
    ` : ''}

    ${mostrarPlano ? `
      <h2>A ordem que eu seguiria</h2>
      <ol>${momento!.ordem.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
    ` : ''}

    ${blocos.length > 0 ? `
      <h2>Ponto a ponto do que você me contou</h2>
      ${blocos.map((b) => `
        <div class="blk">
          <h3>${escapeHtml(b.title)}</h3>
          ${b.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      `).join('')}
    ` : ''}
  </body></html>`
}

export async function gerarPdfLaudo(sessao: QuizSession, nivel: string): Promise<Buffer> {
  const html = montarHtmlLaudo(sessao, nivel)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return pdf
  } finally {
    await browser.close()
  }
}
