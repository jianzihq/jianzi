import type { Card } from './types'

/**
 * First-visit guide card. It occupies one desk cell for the whole visit, like any
 * other clipping: it turns over, it pans away and back. This browser remembers so
 * the next load puts the real card back in that cell.
 *
 * Server snapshot is "already seen" so SSR matches the hydrated first paint; the
 * session decision arrives in the render right after.
 */

export const GUIDE_ID = 'jianzi:guide'

export const GUIDE_TITLE = '从中间这一张看起'

export const GUIDE_BODY =
  '中间这一张最清楚，旁边的字会退开一点。桌子可以拖。触控板两指也能挪。方向键会把下一张送到眼前。拖到某张停住了，点它，纸会翻过来。翻过去那一面排的是我们拿到的全部原文开头，撕口下面才去知乎。周围淡下去的是还没走到跟前的剪报。评论里有人顶回去，有人只回了一句玩笑，那些也在翻开的那一面。你在桌上遇见谁，就读谁。'

export const GUIDE_SLIP = '想留着的卡，按住再拖到左边。'

/** Same shape as a pool card so the flip and the column can take it. */
export const guideCard: Card = {
  id: GUIDE_ID,
  title: GUIDE_TITLE,
  url: '',
  contentType: 'Answer',
  excerpt: GUIDE_BODY,
  author: { name: '见字', badge: '桌上留的一张', avatar: '' },
  comments: [],
  stats: { votes: 0, comments: 0, year: 2026 },
  domain: '',
  reason: GUIDE_SLIP,
}

const STORAGE_KEY = 'jianzi:guide:v3'

const listeners = new Set<() => void>()
let cache: boolean | null = null

function loadSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function readGuideSeen(): boolean {
  cache ??= loadSeen()
  return cache
}

export const serverGuideSeen = (): boolean => true

export function subscribeGuide(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Next visit skips the guide. This visit keeps it in its cell until the page unloads. */
export function rememberGuide(): void {
  if (cache === true) return
  cache = true
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Blocked storage: the next visit may show it again.
  }
  listeners.forEach((listener) => listener())
}
