import type { SessionUser } from './session'

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

export function oauthConfig(): { appId: string; appKey: string; redirectUri: string } | null {
  const appId = process.env.ZHIHU_OAUTH_APP_ID ?? ''
  const appKey = process.env.ZHIHU_OAUTH_APP_KEY ?? process.env.ZHIHU_KEY_MAX ?? ''
  const redirectUri = process.env.ZHIHU_OAUTH_REDIRECT_URI ?? ''
  if (!appId || !appKey || !redirectUri) return null
  return { appId, appKey, redirectUri }
}

export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const url = new URL('https://openapi.zhihu.com/authorize')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeAccessToken(code: string): Promise<string | null> {
  const cfg = oauthConfig()
  if (!cfg) return null
  const body = new URLSearchParams({
    app_id: cfg.appId,
    app_key: cfg.appKey,
    grant_type: 'authorization_code',
    redirect_uri: cfg.redirectUri,
    code,
  })
  const res = await fetch('https://openapi.zhihu.com/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const json: unknown = await res.json().catch(() => null)
  const root = asRecord(json)
  if (!root) return null
  const token = asString(root.access_token) || asString(asRecord(root.data)?.access_token)
  return token || null
}

export async function fetchSessionUser(accessToken: string): Promise<SessionUser | null> {
  const res = await fetch('https://openapi.zhihu.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const json: unknown = await res.json().catch(() => null)
  const root = asRecord(json)
  if (!root) return null
  const src = asString(root.hash_id) ? root : asRecord(root.data)
  if (!src) return null
  const id = asString(src.hash_id)
  if (!id) return null
  return {
    id,
    name: asString(src.fullname),
    avatar: asString(src.avatar_path),
    headline: asString(src.headline),
  }
}
