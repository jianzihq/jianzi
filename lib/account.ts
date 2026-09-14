/**
 * Who is reading, as far as the page can tell. No React.
 *
 * Signing in happens on the server (app/api/auth): the browser only holds an HttpOnly session
 * cookie it cannot read. This file asks /api/me who that is, signs out, and hands the account
 * to the favourite tags so they follow it (lib/collections.ts).
 *
 * The desk never waits on any of it. Until /api/me answers, and whenever it cannot, the reader
 * is simply not signed in and everything stays in this browser.
 */

import { connectCollections, disconnectCollections } from './collections'

export type AccountUser = { id: string; name: string; avatar: string; headline: string }

export type Account =
  | { status: 'unknown' }
  | { status: 'anonymous' }
  | { status: 'signed-in'; user: AccountUser }

/** A short message the account tab shows for a few seconds. */
export type AccountNotice = 'login-failed' | 'sync-failed' | null

const UNKNOWN: Account = { status: 'unknown' }
const ANONYMOUS: Account = { status: 'anonymous' }
const NOTICE_MS = 6000

let account: Account = UNKNOWN
let notice: AccountNotice = null
let noticeTimer = 0
let started = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const readAccount = (): Account => account
/** The server cannot know who is reading, so the first render shows no account at all. */
export const serverAccount = (): Account => UNKNOWN
export const readNotice = (): AccountNotice => notice
export const serverNotice = (): AccountNotice => null

export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function dismissNotice(): void {
  window.clearTimeout(noticeTimer)
  if (notice === null) return
  notice = null
  emit()
}

function show(next: Exclude<AccountNotice, null>): void {
  window.clearTimeout(noticeTimer)
  notice = next
  emit()
  noticeTimer = window.setTimeout(dismissNotice, NOTICE_MS)
}

// ---- the login offer ----

const OFFER_KEY = 'jianzi:login-offer:v1'
const OFFER_MS = 15000
let offer = false
let offerTimer = 0

export const readOffer = (): boolean => offer
export const serverOffer = (): boolean => false

export function dismissOffer(): void {
  window.clearTimeout(offerTimer)
  if (!offer) return
  offer = false
  emit()
}

/**
 * A signed-out reader has just filed a card. The first time this browser sees that, offer the
 * login: keeping favourites on an account is worth something right now. Once per browser; with
 * no storage to remember that in, it stays quiet rather than repeat itself.
 */
export function offerLoginAfterFiling(): void {
  if (account.status !== 'anonymous' || offer) return
  try {
    if (window.localStorage.getItem(OFFER_KEY) === '1') return
    window.localStorage.setItem(OFFER_KEY, '1')
  } catch {
    return
  }
  offer = true
  emit()
  offerTimer = window.setTimeout(dismissOffer, OFFER_MS)
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** /api/me is our own route, but its answer is still read defensively. */
function parseUser(body: unknown): AccountUser | null {
  const user = body && typeof body === 'object' ? (body as { user?: unknown }).user : null
  if (!user || typeof user !== 'object') return null
  const u = user as Record<string, unknown>
  const id = text(u.id)
  return id ? { id, name: text(u.name), avatar: text(u.avatar), headline: text(u.headline) } : null
}

/** Once per page: pick up a failed login the callback reported, then ask who is signed in. */
export function startAccount(): void {
  if (started) return
  started = true

  const url = new URL(window.location.href)
  if (url.searchParams.get('login') === 'failed') {
    // Said once. A reload should not say it again.
    url.searchParams.delete('login')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    show('login-failed')
  }

  fetch('/api/me', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: unknown) => {
      const user = parseUser(body)
      account = user ? { status: 'signed-in', user } : ANONYMOUS
      emit()
      if (user) connectCollections(user.id, () => show('sync-failed'))
    })
    .catch(() => {
      account = ANONYMOUS
      emit()
    })
}

/** Where the login link points. The server only follows paths inside the site back. */
export const loginHref = (next = '/'): string => `/api/auth/login?next=${encodeURIComponent(next)}`

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
  } catch {
    // The cookie may outlive a failed request; the next visit asks /api/me again.
  }
  disconnectCollections()
  account = ANONYMOUS
  emit()
}
