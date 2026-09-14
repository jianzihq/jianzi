/**
 * Favourite tags: the data, the edits, and where they are kept. No React.
 *
 * Signed out, collections live in this browser. Signed in, they live on the reader's Zhihu
 * account (app/api/collections) and this browser keeps a mirror, so the shelf never waits on
 * the network: an edit lands here at once and is sent on behind it. If a send fails the edit
 * stays here, marked unsynced, and goes up with the next merge.
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

// ---- where collections are kept, shaped for useSyncExternalStore ----

const STORAGE_KEY = 'jianzi:collections:v1'
/** Set while this browser holds an edit its account has not received. */
const UNSYNCED_KEY = 'jianzi:collections:unsynced'
/** Set once this browser's collections have been merged into that account. */
const syncedKey = (userId: string): string => `jianzi:collections:synced:${userId}`

/** Stable, as the server snapshot must be: the server has no storage, so nothing is kept. */
const SERVER_SNAPSHOT: Collections = emptyCollections()
const listeners = new Set<() => void>()
let cache: Collections | null = null

/** localStorage, which may be missing or blocked. Blocked, collections last for this visit. */
const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Blocked storage: kept for this visit only.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to remove from.
    }
  },
}

/**
 * Collections from anywhere untrusted: storage an older version wrote, or the network.
 * Anything malformed reads as nothing kept rather than as an error.
 */
function parse(raw: unknown): Collections {
  const out = emptyCollections()
  if (!raw || typeof raw !== 'object') return out
  for (const { id } of TAGS) {
    const list = (raw as Record<string, unknown>)[id]
    if (Array.isArray(list)) {
      out[id] = [...new Set(list.filter((v): v is string => typeof v === 'string'))]
    }
  }
  return out
}

function load(): Collections {
  try {
    return parse(JSON.parse(storage.get(STORAGE_KEY) ?? 'null'))
  } catch {
    return emptyCollections()
  }
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

/** Keep collections in this browser and tell whoever is showing them. */
function store(next: Collections): void {
  if (next === cache) return
  cache = next
  storage.set(STORAGE_KEY, JSON.stringify(next))
  listeners.forEach((listener) => listener())
}

// ---- following the reader's account ----

type Following = { userId: string; trouble: () => void }
let following: Following | null = null
/** Counts edits, so an answer that set out before one never overwrites it. */
let edits = 0

async function send(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Collections,
): Promise<Collections | null> {
  try {
    const res = await fetch(path, {
      method,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.ok ? parse(await res.json()) : null
  } catch {
    return null
  }
}

/**
 * Follow a signed-in account. The first time this browser meets it, or while an edit made
 * here has not reached it, what this browser holds is merged into the account; otherwise the
 * account's copy replaces the mirror. `trouble` hears when the account cannot be reached.
 */
export function connectCollections(userId: string, trouble: () => void): void {
  const me: Following = { userId, trouble }
  following = me
  const editsBefore = edits
  const merge = storage.get(syncedKey(userId)) !== '1' || storage.get(UNSYNCED_KEY) === '1'
  const request = merge
    ? send('POST', '/api/collections/merge', readCollections())
    : send('GET', '/api/collections')
  void request.then((account) => {
    if (following !== me) return
    if (!account) {
      trouble()
      return
    }
    storage.set(syncedKey(userId), '1')
    if (edits !== editsBefore) {
      // The reader filed something while this was on its way: keep it, merge next visit.
      storage.set(UNSYNCED_KEY, '1')
      return
    }
    storage.remove(UNSYNCED_KEY)
    store(account)
  })
}

/** Stop following. The mirror belonged to that account, so this browser starts empty again. */
export function disconnectCollections(): void {
  following = null
  storage.remove(UNSYNCED_KEY)
  store(emptyCollections())
}

/** Apply an edit here and send it on. False when it changed nothing. */
function edit(next: Collections, method: 'PUT' | 'DELETE', tag: TagId, cardId: string): boolean {
  if (next === readCollections()) return false
  edits += 1
  store(next)
  const me = following
  if (!me) {
    storage.set(UNSYNCED_KEY, '1')
    return true
  }
  void send(method, `/api/collections/${tag}/${encodeURIComponent(cardId)}`).then((account) => {
    if (account || following !== me) return
    storage.set(UNSYNCED_KEY, '1')
    me.trouble()
  })
  return true
}

/**
 * File a card under a tag: here at once, and on the account behind it when signed in. False
 * when it was already filed there.
 */
export const fileCard = (tag: TagId, cardId: string): boolean =>
  edit(withCard(readCollections(), tag, cardId), 'PUT', tag, cardId)

export const unfileCard = (tag: TagId, cardId: string): boolean =>
  edit(withoutCard(readCollections(), tag, cardId), 'DELETE', tag, cardId)
