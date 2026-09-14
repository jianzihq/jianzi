/**
 * Per-card paper variation. Same card, same result, every render — the offset has to
 * survive a reload or the deck stops feeling like physical objects.
 *
 * One shared texture serves every card. Cards differ by showing a different patch of
 * the same sheet, which is what keeps the deck same-stock instead of same-sticker.
 */
const hash = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Texture is 1024², the card is smaller, so any offset stays inside the sheet. */
export function paperOffset(id: string): { x: number; y: number } {
  const h = hash(id)
  return { x: -(h % 600), y: -((h >> 9) % 460) }
}

/** A degree and a half either way. Enough to read as placed by hand, not as skewed. */
export function paperTilt(id: string): number {
  const h = hash(id + 'tilt')
  return ((h % 300) / 100 - 1.5)
}

/**
 * How far this card's colour plate missed registration.
 *
 * Constant within a card and different between cards, which is how a press actually
 * behaves: the plate sits where it sits for the whole impression, and the next sheet
 * off the roller sits somewhere slightly else. A uniform per-glyph offset reads as an
 * emboss instead — the give-away is that it cannot rotate, and a slipped plate always
 * rotates a little.
 */
export function plateOffset(id: string): { x: number; y: number; rot: number } {
  const h = hash(id + 'plate')
  return {
    x: ((h % 33) / 10 - 1.4),
    y: (((h >> 6) % 16) / 10 + 0.3),
    rot: (((h >> 12) % 45) / 100 - 0.22),
  }
}

/** Which deckle filter this card's sheet uses. Stable, like every other paper trait. */
export function deckleIndex(id: string, count: number): number {
  return hash(id + 'deckle') % count
}

/**
 * How this card's slip was put down.
 *
 * Everything here varies per card. A note clipped to the same spot at the same angle on
 * every clipping reads as a UI element stamped by a template, which is the one thing the
 * slip must not read as — it is supposed to be the trace of a person who went through
 * these and left a line.
 */
export function slipPose(id: string): {
  width: number
  left: number
  bottom: number
  rot: number
  clip: number
} {
  const h = hash(id + 'slip')
  return {
    width: 282 + (h % 38),
    left: 8 + ((h >> 5) % 52),
    bottom: 14 + ((h >> 10) % 22),
    // Mostly counter-clockwise, the way a right hand lays paper down, but not always.
    rot: ((h >> 15) % 101) / 10 - 7.6,
    clip: 18 + ((h >> 22) % 52),
  }
}

/**
 * The ragged foot of a column, as a clip path.
 *
 * A clip rather than a displacement filter: a filter chews every edge it is given, so a
 * torn strip never meets the paper above it. A clip leaves the top and sides straight by
 * construction and tears only the bottom.
 *
 * Two scales, because a real tear has both — a slow wander as it follows the grain, and
 * fibre-scale fuzz along the way. One coarse walk draws visible straight segments and
 * reads as a vector zigzag. A slight slant across the width keeps it from looking ruled.
 * The deepest point stays within 36px of the paper's foot; the tucked note relies on it.
 */
export function tearClip(id: string): string {
  const N = 160
  let h = hash(id + 'tear')
  const rand = (): number => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0
    return (h % 1000) / 1000
  }
  const slant = rand() * 16 - 8
  let wander = 14 + rand() * 8
  let drift = 0
  const pts = ['0 0', '100% 0']
  for (let k = 0; k <= N; k++) {
    drift = Math.max(-1.4, Math.min(1.4, drift + (rand() - 0.5) * 0.8))
    wander = Math.max(7, Math.min(26, wander + drift))
    const fuzz = (rand() - 0.5) * 3
    const t = (N - k) / N
    const depth = Math.max(2, Math.min(36, wander + fuzz + slant * (t - 0.5)))
    pts.push(`${(100 * t).toFixed(3)}% calc(100% - ${depth.toFixed(1)}px)`)
  }
  return `polygon(${pts.join(', ')})`
}

/** How the "rest is on Zhihu" note was slipped under the torn foot. */
export function onwardPose(id: string): { left: number; rot: number } {
  const h = hash(id + 'onward')
  return { left: 40 + (h % 90), rot: ((h >> 7) % 41) / 10 - 3 }
}

export type RibbonPose = {
  /** How far below the usual height the pair was tucked in, in px. */
  drop: number
  /** Desk showing between the two roots, in px. */
  gap: number
  /** 喜欢 then 不喜欢: each one's angle in degrees (positive swings the tail down) and how far it reaches past the paper, in px. */
  ribbons: [{ rot: number; reach: number }, { rot: number; reach: number }]
}

/**
 * How the two ribbons under an open column were tucked in.
 *
 * Per card, like the slip, so the pair reads as something put there by hand rather than as a
 * control fixed to the screen. The order never changes — 喜欢 above 不喜欢 — so the reader
 * never has to look twice. The two lie nearly parallel, as ribbons tucked in together do:
 * the lower one's angle is drawn from the upper one's, at most two degrees closer at the
 * tail, where more would let a chosen ribbon close the gap, and two and a half apart, where
 * more fans the pair open into a V.
 */
export function ribbonPose(id: string): RibbonPose {
  let h = hash(id + 'ribbon')
  const rand = (): number => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0
    return (h % 1000) / 1000
  }
  const drop = Math.round(rand() * 110)
  const gap = 22 + Math.round(rand() * 12)
  const upper = rand() * 6 - 4
  const lower = upper - 2 + rand() * 4.5
  return {
    drop,
    gap,
    ribbons: [
      { rot: Number(upper.toFixed(2)), reach: 140 + Math.round(rand() * 32) },
      { rot: Number(lower.toFixed(2)), reach: 140 + Math.round(rand() * 32) },
    ],
  }
}
