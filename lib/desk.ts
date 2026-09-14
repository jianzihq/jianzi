/**
 * Desk layout. Pure — no React, no browser, so it stays runnable on its own.
 *
 * The desk is an unbounded grid of cells. Which card sits in a cell is decided by the
 * cell's own coordinates, never by render order, so panning away and back puts the same
 * card in the same place. A desk whose cards move while you are not looking is not a
 * desk.
 */

/** Roughly two cells across a laptop viewport, which keeps the desk at "a few cards". */
export const CELL_W = 760
export const CELL_H = 920

export type Slot = {
  key: string
  /** Centre of the slot in desk coordinates. */
  x: number
  y: number
  /** Index into the ordered deck. */
  index: number
}

const hash2 = (i: number, j: number): number => {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h ^= h >>> 13
  return Math.abs(h)
}

const mod = (n: number, m: number): number => ((n % m) + m) % m

/**
 * Two coprime strides instead of a hash, so no two slots in one screenful can land on
 * the same card. A hash would collide and put the same clipping on the desk twice.
 */
const deckIndex = (i: number, j: number, len: number): number => mod(i * 7 + j * 11, len)

/** Cards sit off-centre in their cell, or the desk reads as a spreadsheet. */
const jitter = (i: number, j: number): [number, number] => {
  const h = hash2(i, j)
  return [((h % 161) - 80), (((h >> 8) % 121) - 60)]
}

/**
 * Every slot touching the viewport, plus a ring outside it so cards are already in the
 * DOM before they are needed.
 */
export function slotsInView(
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  deckLen: number,
  ring = 1,
): Slot[] {
  if (deckLen <= 0) return []

  const i0 = Math.floor(camX / CELL_W) - ring
  const i1 = Math.floor((camX + vw) / CELL_W) + ring
  const j0 = Math.floor(camY / CELL_H) - ring
  const j1 = Math.floor((camY + vh) / CELL_H) + ring

  const slots: Slot[] = []
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const [jx, jy] = jitter(i, j)
      slots.push({
        key: `${i},${j}`,
        x: i * CELL_W + CELL_W / 2 + jx,
        y: j * CELL_H + CELL_H / 2 + jy,
        index: deckIndex(i, j, deckLen),
      })
    }
  }
  return slots
}

/** 1 at the centre of the screen, 0 once a card is a screen away from it. */
export function focusAt(dx: number, dy: number, reach = 620): number {
  const d = Math.hypot(dx, dy * 0.8)
  return Math.max(0, Math.min(1, 1 - d / reach))
}
