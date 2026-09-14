/**
 * First-visit guide card. The desk shows it once, then this browser remembers.
 *
 * Server snapshot is "already seen" so SSR and the hydrated first paint have no card;
 * what this browser has actually kept arrives in the render right after. Returning
 * visitors never flash a card. First visitors see it occupy the compact view's
 * centre slot, the same way any other clipping sits in the lamp.
 */

const STORAGE_KEY = 'jianzi:guide:v2'

const listeners = new Set<() => void>()
/** null until the first client read. */
let cache: boolean | null = null

function loadSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Blocked storage: do not pin a card they cannot put away for good.
    return true
  }
}

/** Whether this browser has already put the guide away. */
export function readGuideSeen(): boolean {
  cache ??= loadSeen()
  return cache
}

/** The server has no storage, so it behaves as if the guide has already been seen. */
export const serverGuideSeen = (): boolean => true

export function subscribeGuide(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Put the guide away. Further visits skip it. */
export function dismissGuide(): void {
  if (cache === true) return
  cache = true
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Blocked storage: hidden for this visit only.
  }
  listeners.forEach((listener) => listener())
}
