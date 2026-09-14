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
 * A clip beats a displacement filter here because a filter chews every edge it is given,
 * including the top one, so a torn strip never meets the paper above it. This leaves the
 * top and sides straight and tears only the bottom.
 *
 * The height walks rather than jumping, because a tear propagates along the fibres — it
 * wanders, where independent samples would come out as a sawtooth.
 */
export function tearClip(id: string): string {
  const N = 24
  const pts = ['0 0', '100% 0']
  let h = hash(id + 'tear')
  let y = 14
  for (let k = 0; k <= N; k++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0
    y = Math.max(3, Math.min(27, y + ((h % 13) - 6)))
    pts.push(`${((100 * (N - k)) / N).toFixed(2)}% calc(100% - ${y}px)`)
  }
  return `polygon(${pts.join(', ')})`
}
