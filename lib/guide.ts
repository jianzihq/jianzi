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
 * The guide is a short clipping of sentences, step headings and printed plates, in order.
 * Figures stay out of the Zhihu excerpt and out of Markdown.
 *
 * The front has one job: say that a clipping opens, and how to find the next one. The back
 * is the whole guide from the top, one heading, one sentence and a plate per step, so turning
 * it over never hides what the front said.
 */
export type GuideBlock =
  | { type: 'text'; face: 'front' | 'back'; text: string }
  | { type: 'heading'; face: 'back'; text: string }
  | { type: 'figure'; face: 'front' | 'back'; src: string; alt: string }

const MOVE = { src: '/guide/move.webp', alt: 'WASD 与方向键，把下一张送到眼前' }
const POINTER = { src: '/guide/pointer.webp', alt: '触控板两指，滚轮、Shift 滚轮与中键' }
const OPEN = { src: '/guide/open.webp', alt: '点卡或按 Enter，纸会翻开' }
/** The front's own plate: wide and short, and only the one act of opening. */
const OPEN_FRONT = { src: '/guide/open-front.webp', alt: '光标点在纸角，Enter 指向同一处，纸角翻起' }
const REACT = { src: '/guide/react.webp', alt: '右键便签上的喜欢与不喜欢，专栏纸边的红、墨两条丝带' }
const FILE = { src: '/guide/file.webp', alt: '把左边的标签拖到卡上，或按 1 2 3' }
const VIEWS = { src: '/guide/views.webp', alt: '右边三个标签，或按 8 9 0' }

export const GUIDE_BLOCKS: GuideBlock[] = [
  { type: 'text', face: 'front', text: '每张纸都能翻过来，点这张试试。' },
  { type: 'figure', face: 'front', ...OPEN_FRONT },
  { type: 'text', face: 'front', text: '看完放回去，拖动桌子找下一张。' },
  { type: 'figure', face: 'front', ...MOVE },

  { type: 'heading', face: 'back', text: '一　挪桌子' },
  {
    type: 'text',
    face: 'back',
    text: '拖动桌子，下一张就到眼前。方向键和 WASD 也能挪；触控板用两指，鼠标可以滚轮，也可以按住中键拖。',
  },
  { type: 'figure', face: 'back', ...MOVE },
  { type: 'figure', face: 'back', ...POINTER },

  { type: 'heading', face: 'back', text: '二　翻开' },
  {
    type: 'text',
    face: 'back',
    text: '点一下纸，或者按 Enter，它就翻过来。背面是我们拿到的原文开头，读到撕口，余下的在知乎。看完点四周或者按 Esc，放回桌上。',
  },
  { type: 'figure', face: 'back', ...OPEN },

  { type: 'heading', face: 'back', text: '三　收藏' },
  {
    type: 'text',
    face: 'back',
    text: '想留着，就把左边的标签拖到卡上，按 1、2、3 也行。收进去的卡，点那枚标签就能看到。',
  },
  { type: 'figure', face: 'back', ...FILE },

  { type: 'heading', face: 'back', text: '四　换个摆法' },
  { type: 'text', face: 'back', text: '右边三枚标签：紧凑、宽松、列表，依次对应键盘上的 8、9、0。' },
  { type: 'figure', face: 'back', ...VIEWS },

  { type: 'heading', face: 'back', text: '五　喜不喜欢' },
  {
    type: 'text',
    face: 'back',
    text: '右键一张卡，或者翻开后点纸边的丝带，说喜欢还是不喜欢。我们会反着用：你碰过的领域往后放，没碰过的往前摆。',
  },
  { type: 'figure', face: 'back', ...REACT },
]

export const GUIDE_BODY = GUIDE_BLOCKS.filter(
  (block): block is Extract<GuideBlock, { type: 'text' }> => block.type === 'text',
)
  .map((block) => block.text)
  .join('\n')

/** The slip is the loudest thing on a clipping, so on the guide it says the one thing to do. */
export const GUIDE_SLIP = '翻过来看，背面写全了。'

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
