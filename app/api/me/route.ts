import { NextRequest, NextResponse } from 'next/server'
import { readSession, sessionCookieName } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = readSession(req.cookies.get(sessionCookieName)?.value)
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null })
  }
}
