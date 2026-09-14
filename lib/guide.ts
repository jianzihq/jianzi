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

export const GUIDE_TITLE = '这张桌子怎么用'

/**
 * The guide is a short clipping of sentences and printed plates, in order.
 * Figures stay out of the Zhihu excerpt and out of Markdown.
 */
export type GuideBlock =
  | { type: 'text'; face: 'front' | 'back'; text: string }
  | { type: 'figure'; face: 'front' | 'back'; src: string; alt: string }

export const GUIDE_BLOCKS: GuideBlock[] = [
  {
    type: 'text',
    face: 'front',
    text: '桌子可以拖。方向键和 WASD 会把下一张送到眼前。',
  },
  { type: 'figure', face: 'front', src: '/guide/move.webp', alt: 'WASD 与方向键，移动桌子' },
  {
    type: 'text',
    face: 'front',
    text: '触控板两指，滚轮、Shift 滚轮、中键也能挪。',
  },
  { type: 'figure', face: 'front', src: '/guide/pointer.webp', alt: '触控板两指，滚轮与中键' },
  {
    type: 'text',
    face: 'back',
    text: '点开或按 Enter，纸会翻过来。背面是我们拿到的原文开头，撕开的地方去知乎。',
  },
  { type: 'figure', face: 'back', src: '/guide/open.webp', alt: '点卡或按 Enter，纸会翻开' },
  { type: 'figure', face: 'back', src: '/guide/file.webp', alt: '把左边的标签拖到卡上，或按 1 2 3' },
  { type: 'figure', face: 'back', src: '/guide/views.webp', alt: '右边三个标签，或按 8 9 0' },
]

export const GUIDE_BODY = GUIDE_BLOCKS.filter(
  (block): block is Extract<GuideBlock, { type: 'text' }> => block.type === 'text',
)
  .map((block) => block.text)
  .join('\n')

export const GUIDE_SLIP = '想留着，把左边的标签拖到卡上。'

/** Same mark as the tab icon. A 192px cut, not the 1.8MB master. */
export const GUIDE_AVATAR = '/brand/mark.png'

/** Same shape as a pool card so the flip and the column can take it. */
export const guideCard: Card = {
  id: GUIDE_ID,
  title: GUIDE_TITLE,
  url: '',
  contentType: 'Answer',
  excerpt: GUIDE_BODY,
  author: { name: '见字', badge: '第一次打开才有', avatar: GUIDE_AVATAR },
  comments: [],
  stats: { votes: 0, comments: 0, year: 2026 },
  domain: '',
  reason: GUIDE_SLIP,
}

const STORAGE_KEY = 'jianzi:guide:v4'

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
