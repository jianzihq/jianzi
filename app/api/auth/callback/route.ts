import { NextRequest, NextResponse } from 'next/server'
import {
  attachSession,
  clearOauthState,
  readOauthState,
  stateCookieName,
} from '@/lib/server/session'
import { exchangeAccessToken, fetchSessionUser, oauthConfig } from '@/lib/server/zhihu'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const fail = () => clearOauthState(NextResponse.redirect(new URL('/?login=failed', origin)))

  if (!oauthConfig()) return fail()

  const code =
    req.nextUrl.searchParams.get('authorization_code') ?? req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const saved = readOauthState(req.cookies.get(stateCookieName)?.value)

  // Drop the one-time state cookie before any token call so a replay cannot reuse it.
  if (!code || !state || !saved || saved.state !== state) return fail()

  let user = null
  try {
    const accessToken = await exchangeAccessToken(code)
    if (accessToken) user = await fetchSessionUser(accessToken)
  } catch {
    user = null
  }

  if (!user) return fail()

  const res = NextResponse.redirect(new URL(saved.next, origin))
  return attachSession(clearOauthState(res), user)
}
