import { NextResponse } from 'next/server'
import { clearOauthState, clearSession } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = new NextResponse(null, { status: 204 })
  return clearOauthState(clearSession(res))
}
