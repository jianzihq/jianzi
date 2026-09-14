import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export type SessionUser = {
  id: string
  name: string
  avatar: string
  headline: string
}

type SessionPayload = SessionUser & { exp: number }
type OauthStatePayload = { state: string; next: string; exp: number }

const SESSION_COOKIE = 'jz_session'
const STATE_COOKIE = 'jz_oauth'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7
const STATE_MAX_AGE = 60 * 10

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

function secret(): string | null {
  const value = process.env.SESSION_SECRET ?? ''
  return value.length >= 32 ? value : null
}

function sign(payload: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(payload).digest('base64url')
}

function encode(data: object): string | null {
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
  const mac = sign(payload)
  if (!mac) return null
  return `${payload}.${mac}`
}

function decode<T>(token: string | undefined): T | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = sign(payload)
  if (!expected) return null
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

export function newOauthState(): string {
  return randomBytes(32).toString('base64url')
}

export function attachOauthState(res: NextResponse, state: string, next: string): NextResponse {
  const value = encode({ state, next, exp: Date.now() + STATE_MAX_AGE * 1000 })
  if (!value) return res
  res.cookies.set(STATE_COOKIE, value, { ...cookieBase, maxAge: STATE_MAX_AGE })
  return res
}

export function readOauthState(cookie: string | undefined): OauthStatePayload | null {
  const data = decode<OauthStatePayload>(cookie)
  if (!data || typeof data.state !== 'string' || typeof data.next !== 'string') return null
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
  return data
}

export function clearOauthState(res: NextResponse): NextResponse {
  res.cookies.set(STATE_COOKIE, '', { ...cookieBase, maxAge: 0 })
  return res
}

export function attachSession(res: NextResponse, user: SessionUser): NextResponse {
  const value = encode({ ...user, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  if (!value) return res
  res.cookies.set(SESSION_COOKIE, value, { ...cookieBase, maxAge: SESSION_MAX_AGE })
  return res
}

export function readSession(cookie: string | undefined): SessionUser | null {
  const data = decode<SessionPayload>(cookie)
  if (!data || typeof data.id !== 'string' || data.id.length === 0) return null
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
  return {
    id: data.id,
    name: typeof data.name === 'string' ? data.name : '',
    avatar: typeof data.avatar === 'string' ? data.avatar : '',
    headline: typeof data.headline === 'string' ? data.headline : '',
  }
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 })
  return res
}

export const sessionCookieName = SESSION_COOKIE
export const stateCookieName = STATE_COOKIE
export const sessionConfigured = (): boolean => secret() !== null
