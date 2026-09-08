// Serializador CSV mínimo, sem dependência nova — só o que a exportação de
// leads precisa: separador vírgula, aspas duplas escapando aspas/vírgula/
// quebra de linha, terminador \r\n (compatível com Excel).

// `nome`/`email`/`whatsapp` vêm de texto livre digitado por qualquer lead —
// se alguém preencher o nome como "=HYPERLINK(...)" ou "=cmd|'/c calc'!A1",
// o Excel/Sheets pode interpretar a célula como fórmula ao abrir (CSV/
// Excel formula injection, OWASP). Prefixa com aspas simples quem começa
// com um caractere que dispara fórmula — igual ao que o Google Sheets faz
// automaticamente, mas aqui de propósito, pro time que só abre o CSV baixado.
const GATILHOS_FORMULA = ['=', '+', '-', '@', '\t', '\r']

function celula(valor: unknown): string {
  let texto = valor === null || valor === undefined ? '' : String(valor)
  if (texto !== '' && GATILHOS_FORMULA.includes(texto[0])) {
    texto = `'${texto}`
  }
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

export function paraCsv(cabecalho: string[], linhas: unknown[][]): string {
  const todas = [cabecalho, ...linhas]
  return todas.map((linha) => linha.map(celula).join(',')).join('\r\n') + '\r\n'
}
