import { Redis } from '@upstash/redis'
import { pool } from '@/lib/pool'
import {
  emptyCollections,
  isTagId,
  type Collections,
  type TagId,
  TAGS,
} from '@/lib/collections'

const MAX_PER_TAG = 500
const poolIds = new Set(pool.map((card) => card.id))

export const knownCard = (cardId: string): boolean => poolIds.has(cardId)

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const keyFor = (userId: string) => `collections:${userId}`

function normalize(raw: unknown): Collections {
  const out = emptyCollections()
  if (!raw || typeof raw !== 'object') return out
  const rec = raw as Record<string, unknown>
  for (const { id } of TAGS) {
    const list = rec[id]
    if (!Array.isArray(list)) continue
    const seen = new Set<string>()
    const next: string[] = []
    for (const item of list) {
      if (typeof item !== 'string' || !item || seen.has(item) || !poolIds.has(item)) continue
      seen.add(item)
      next.push(item)
      if (next.length >= MAX_PER_TAG) break
    }
    out[id] = next
  }
  return out
}

export async function readCollections(userId: string): Promise<Collections | 'unavailable'> {
  const client = redis()
  if (!client) return 'unavailable'
  try {
    const raw = await client.get<unknown>(keyFor(userId))
    return normalize(raw)
  } catch {
    return 'unavailable'
  }
}

async function write(userId: string, value: Collections): Promise<Collections | 'unavailable'> {
  const client = redis()
  if (!client) return 'unavailable'
  try {
    await client.set(keyFor(userId), value)
    return value
  } catch {
    return 'unavailable'
  }
}

export async function addCard(
  userId: string,
  tag: TagId,
  cardId: string,
): Promise<Collections | 'unavailable'> {
  const current = await readCollections(userId)
  if (current === 'unavailable') return current
  if (current[tag][0] === cardId) return current
  const rest = current[tag].filter((id) => id !== cardId)
  return write(userId, { ...current, [tag]: [cardId, ...rest].slice(0, MAX_PER_TAG) })
}

export async function removeCard(
  userId: string,
  tag: TagId,
  cardId: string,
): Promise<Collections | 'unavailable'> {
  const current = await readCollections(userId)
  if (current === 'unavailable') return current
  if (!current[tag].includes(cardId)) return current
  return write(userId, { ...current, [tag]: current[tag].filter((id) => id !== cardId) })
}

export function parseLocalCollections(body: unknown): Collections {
  const out = emptyCollections()
  if (!body || typeof body !== 'object') return out
  const rec = body as Record<string, unknown>
  for (const { id } of TAGS) {
    const list = rec[id]
    if (!Array.isArray(list)) continue
    const seen = new Set<string>()
    const next: string[] = []
    for (const item of list) {
      if (typeof item !== 'string' || !item || seen.has(item) || !poolIds.has(item)) continue
      seen.add(item)
      next.push(item)
      if (next.length >= MAX_PER_TAG) break
    }
    out[id] = next
  }
  return out
}

export function mergeCollections(account: Collections, local: Collections): Collections {
  const out = emptyCollections()
  for (const { id } of TAGS) {
    const seen = new Set<string>()
    const next: string[] = []
    for (const cardId of [...account[id], ...local[id]]) {
      if (seen.has(cardId) || !poolIds.has(cardId)) continue
      seen.add(cardId)
      next.push(cardId)
      if (next.length >= MAX_PER_TAG) break
    }
    out[id] = next
  }
  return out
}

export async function saveMerged(
  userId: string,
  local: Collections,
): Promise<Collections | 'unavailable'> {
  const account = await readCollections(userId)
  if (account === 'unavailable') return account
  return write(userId, mergeCollections(account, local))
}

export { isTagId }
export type { TagId, Collections }
