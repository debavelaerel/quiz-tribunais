export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeWhatsapp(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}
