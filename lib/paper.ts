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
