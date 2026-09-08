// Máscaras de exibição pros campos de formulário — puro, sem I/O. Aplicado
// no onChange (o state guarda o valor já mascarado); validação/normalização
// em lib/validacao.ts e lib/normalize.ts sempre tiram a máscara de novo com
// `replace(/\D/g, '')`, então guardar o valor mascarado no state não muda
// nada pra elas.

// (85) 99682-6067 — DDD entre parênteses, celular com o 9º dígito, 5+4
// separados por traço. Constrói incrementalmente conforme a pessoa digita.
export function formatarWhatsapp(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}
