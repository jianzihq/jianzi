/**
 * Favourite tags: the data, the edits, and the browser store behind them. No React.
 *
 * Collections live in this browser for now. Keeping them on the reader's Zhihu account
 * needs OAuth and server storage, which the backend owns — see
 * docs/backend-requirements.md. When that lands only the store at the bottom of this file
 * changes; everything that reads or edits a collection goes through the functions above it.
 */

export const TAGS = [
  { id: 'later', label: '稍后读' },
  { id: 'again', label: '值得再读' },
  { id: 'share', label: '想转给谁' },
] as const

export type TagId = (typeof TAGS)[number]['id']

/** Card ids per tag, most recently filed first. */
export type Collections = Record<TagId, string[]>

export const emptyCollections = (): Collections => ({ later: [], again: [], share: [] })

export const isTagId = (value: unknown): value is TagId => TAGS.some((tag) => tag.id === value)

export const tagLabel = (id: TagId): string => TAGS.find((tag) => tag.id === id)?.label ?? ''

/** File a card under a tag. Filing it again changes nothing and returns the same object. */
export function withCard(c: Collections, tag: TagId, cardId: string): Collections {
  return c[tag].includes(cardId) ? c : { ...c, [tag]: [cardId, ...c[tag]] }
}

export function withoutCard(c: Collections, tag: TagId, cardId: string): Collections {
  return c[tag].includes(cardId) ? { ...c, [tag]: c[tag].filter((id) => id !== cardId) } : c
}

/**
 * Drop ids no longer in the pool, say after it was rebuilt. Returns the same object when
 * nothing had to go, so memoised readers do not re-render for nothing.
 */
export function narrowTo(c: Collections, known: ReadonlySet<string>): Collections {
  let dropped = false
  const out = emptyCollections()
  for (const { id } of TAGS) {
    out[id] = c[id].filter((cardId) => known.has(cardId))
    if (out[id].length !== c[id].length) dropped = true
  }
  return dropped ? out : c
}

// ---- browser store, shaped for useSyncExternalStore ----

const STORAGE_KEY = 'jianzi:collections:v1'
/** Stable, as the server snapshot must be: the server has no storage, so nothing is kept. */
const SERVER_SNAPSHOT: Collections = emptyCollections()
const listeners = new Set<() => void>()
let cache: Collections | null = null

/**
 * What this browser has kept. Storage is untrusted: it may be missing, blocked, or written
 * by an older version, and each of those reads as nothing kept rather than as an error.
 */
function load(): Collections {
  const out = emptyCollections()
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return out
    for (const { id } of TAGS) {
      const list = (parsed as Record<string, unknown>)[id]
      if (Array.isArray(list)) {
        out[id] = [...new Set(list.filter((v): v is string => typeof v === 'string'))]
      }
    }
  } catch {
    // Unreadable storage: start empty.
  }
  return out
}

/** The current collections — the same object until they change. */
export function readCollections(): Collections {
  cache ??= load()
  return cache
}

export const serverCollections = (): Collections => SERVER_SNAPSHOT

export function subscribeCollections(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function writeCollections(next: Collections): void {
  if (next === cache) return
  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: filing still works for this visit, it just will not survive a reload.
  }
  listeners.forEach((listener) => listener())
}
