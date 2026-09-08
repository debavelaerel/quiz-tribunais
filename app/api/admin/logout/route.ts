import { NextResponse } from 'next/server'
import { NOME_COOKIE_ADMIN } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true }, { status: 200 })
  res.cookies.set(NOME_COOKIE_ADMIN, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
