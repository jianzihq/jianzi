import { NextRequest, NextResponse } from 'next/server'
import { safeNext } from '@/lib/server/http'
import { attachOauthState, newOauthState, sessionConfigured } from '@/lib/server/session'
import { authorizeUrl, oauthConfig } from '@/lib/server/zhihu'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const failed = NextResponse.redirect(new URL('/?login=failed', req.nextUrl.origin))
  const cfg = oauthConfig()
  if (!cfg || !sessionConfigured()) return failed

  const state = newOauthState()
  const next = safeNext(req.nextUrl.searchParams.get('next'))
  const res = NextResponse.redirect(authorizeUrl(cfg.appId, cfg.redirectUri, state))
  return attachOauthState(res, state, next)
}
