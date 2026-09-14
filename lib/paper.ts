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
