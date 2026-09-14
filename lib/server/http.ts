import type { NextRequest } from 'next/server'

export const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status })

/** Only in-app paths. Blocks open redirects (`//`, scheme, backslash). */
export function safeNext(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  if (raw.includes('\\') || raw.includes('://')) return '/'
  return raw
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  return origin === req.nextUrl.origin
}
