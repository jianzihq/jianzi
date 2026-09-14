/**
 * Desk layout. Pure — no React, no browser, so it stays runnable on its own.
 *
 * The desk is an unbounded grid of cells. Which card sits in a cell is decided by the
 * cell's own coordinates, never by render order, so panning away and back puts the same
 * card in the same place. A desk whose cards move while you are not looking is not a
 * desk.
 */

/**
 * Everything that differs between the ways the desk can be laid out. The deck, the
 * cell-to-card mapping, input and the flip are shared; only spacing and emphasis change.
 * DESIGN.md section 11.
 */
export type Layout = {
  /** Cell size, in desk pixels. */
  cellW: number
  cellH: number
  /**
   * Largest off-centre offset of a card inside its cell, each way. Kept well under half
   * the gap between cards, or two neighbours can jitter into each other.
   */
  jitterX: number
  jitterY: number
  /** Card scale at the far edge of focus; the card in the middle is always 1. */
  depthMin: number
  /** Outward push at full strength, in screen pixels, and the distances it ramps across. 0 turns it off. */
  push: number
  pushFrom: number
  pushTo: number
  /** Laid-out size of the card front against its 400px design width. */
  cardScale: number
  /** How much of a peripheral card's text survives: 1 keeps all of it, 0 hides it. */
  revealFloor: number
}

export type View = 'compact' | 'loose'

export const LAYOUTS: Record<View, Layout> = {
  /** More and larger cards, the middle one standing out, text receding, outer rings pushed. */
  compact: {
    cellW: 580,
    cellH: 740,
    jitterX: 45,
    jitterY: 35,
    depthMin: 0.78,
    push: 90,
    pushFrom: 700,
    pushTo: 1300,
    cardScale: 1.2,
    revealFloor: 0.26,
  },
  /** A few cards, every one readable, nothing pushed: the desk as first built. */
  loose: {
    cellW: 760,
    cellH: 920,
    jitterX: 80,
    jitterY: 60,
    depthMin: 0.86,
    push: 0,
    pushFrom: 700,
    pushTo: 1300,
    cardScale: 1,
    revealFloor: 1,
  },
}

export type Slot = {
  key: string
  /** Centre of the slot in desk coordinates. */
  x: number
  y: number
  /** Index into the ordered deck. */
  index: number
  /** How strongly this slot takes the outward push, 0.55–1.45. Fixed per cell. */
  drift: number
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
 * the same card. A hash would collide and put the same clipping on the desk twice. It
 * depends on the cell alone, so a cell holds the same card under every layout.
 */
const deckIndex = (i: number, j: number, len: number): number => mod(i * 7 + j * 11, len)

/** Cards sit off-centre in their cell, or the desk reads as a spreadsheet. */
const jitter = (i: number, j: number, layout: Layout): [number, number] => {
  const h = hash2(i, j)
  return [
    (h % (2 * layout.jitterX + 1)) - layout.jitterX,
    ((h >> 8) % (2 * layout.jitterY + 1)) - layout.jitterY,
  ]
}

/**
 * Where cell (i, j) actually puts its card, jitter included.
 *
 * Both the renderer and the keyboard read positions from here. If the keys did their
 * own cell arithmetic they would land on the bare grid and miss the card by whatever
 * the jitter happened to be.
 */
export function slotCentre(i: number, j: number, layout: Layout): { x: number; y: number } {
  const [jx, jy] = jitter(i, j, layout)
  return {
    x: i * layout.cellW + layout.cellW / 2 + jx,
    y: j * layout.cellH + layout.cellH / 2 + jy,
  }
}

/** Which cell a point in desk coordinates falls in. Jitter is far smaller than a cell,
 *  so the bare grid decides this unambiguously. */
export function cellAt(x: number, y: number, layout: Layout): { i: number; j: number } {
  return { i: Math.round(x / layout.cellW - 0.5), j: Math.round(y / layout.cellH - 0.5) }
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
  layout: Layout,
  ring = 1,
): Slot[] {
  if (deckLen <= 0) return []

  const i0 = Math.floor(camX / layout.cellW) - ring
  const i1 = Math.floor((camX + vw) / layout.cellW) + ring
  const j0 = Math.floor(camY / layout.cellH) - ring
  const j1 = Math.floor((camY + vh) / layout.cellH) + ring

  const slots: Slot[] = []
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const { x, y } = slotCentre(i, j, layout)
      const drift = 0.55 + ((hash2(i, j) >> 16) % 91) / 100
      slots.push({ key: `${i},${j}`, x, y, index: deckIndex(i, j, deckLen), drift })
    }
  }
  return slots
}

/** 1 at the centre of the screen, 0 once a card is a screen away from it. */
export function focusAt(dx: number, dy: number, reach = 620): number {
  const d = Math.hypot(dx, dy * 0.8)
  return Math.max(0, Math.min(1, 1 - d / reach))
}

/**
 * Screen-space outward push for a slot at (dx, dy) from the middle of the screen.
 *
 * The ring around the centre card stays where the grid puts it. From the second ring out,
 * cards are pushed away from the middle — further than the first ring, and by a different
 * amount each — which opens the spacing out there and breaks up rows and columns that
 * would otherwise line up. A grid alone cannot do this: one step of panning turns the
 * second ring into the first, so the spacing has to follow the screen, not the desk.
 *
 * Radial only. A sideways offset would change direction as the desk pans, and the cards
 * would appear to swim rather than to sit at different depths.
 */
export function pushAt(dx: number, dy: number, drift: number, layout: Layout): [number, number] {
  if (layout.push <= 0) return [0, 0]
  const r = Math.hypot(dx, dy)
  if (r < 1) return [0, 0]
  const t = Math.max(0, Math.min(1, (r - layout.pushFrom) / (layout.pushTo - layout.pushFrom)))
  const amount = layout.push * drift * t * t * (3 - 2 * t)
  return [(dx / r) * amount, (dy / r) * amount]
}
