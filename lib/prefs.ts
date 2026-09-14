/**
 * Likes and dislikes: the edits and the browser store behind them. No React.
 *
 * They exist to be used backwards — orderDeck in lib/deck.ts sinks every domain the reader
 * has reacted to — and they never leave this browser. Unlike favourite tags they are not
 * meant for the account; AGENTS.md fixes that.
 */

import { emptyPrefs, type Prefs } from './deck'

export type Reaction = 'liked' | 'disliked'

export function reactionOf(prefs: Prefs, cardId: string): Reaction | null {
  if (prefs.liked.includes(cardId)) return 'liked'
  if (prefs.disliked.includes(cardId)) return 'disliked'
  return null
}

/** Mark a card. Choosing the mark it already has takes the mark off; the other one switches. */
export function toggleReaction(prefs: Prefs, cardId: string, reaction: Reaction): Prefs {
  const next = reactionOf(prefs, cardId) === reaction ? null : reaction
  const liked = prefs.liked.filter((id) => id !== cardId)
  const disliked = prefs.disliked.filter((id) => id !== cardId)
  if (next === 'liked') liked.unshift(cardId)
  if (next === 'disliked') disliked.unshift(cardId)
  return { liked, disliked }
}

// ---- browser store, shaped for useSyncExternalStore ----

const STORAGE_KEY = 'jianzi:prefs:v1'
const listeners = new Set<() => void>()
let cache: Prefs | null = null

const idList = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : []

/**
 * What this browser has kept. Storage is untrusted: missing, blocked or malformed all read
 * as nothing kept. A card found under both marks keeps the like.
 */
function load(): Prefs {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return { liked: [], disliked: [] }
    const liked = idList((parsed as Record<string, unknown>).liked)
    const disliked = idList((parsed as Record<string, unknown>).disliked).filter(
      (id) => !liked.includes(id),
    )
    return { liked, disliked }
  } catch {
    return { liked: [], disliked: [] }
  }
}

/** The current prefs — the same object until they change. */
export function readPrefs(): Prefs {
  cache ??= load()
  return cache
}

/** The server has no storage, so nothing is kept. Stable, as a server snapshot must be. */
export const serverPrefs = (): Prefs => emptyPrefs

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function writePrefs(next: Prefs): void {
  if (next === cache) return
  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: the reaction still counts for this visit.
  }
  listeners.forEach((listener) => listener())
}
