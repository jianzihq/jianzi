/**
 * Putting cards on the desk. Pure — no React, no browser.
 *
 * A cell keeps the card it was dealt for the whole visit, so panning away and back finds the
 * same clipping where it was, and nothing on screen changes while the reader looks at it.
 * Only a cell seen for the first time takes a card.
 *
 * Cards go down in passes through the deck, in orderDeck's order. A pass lays every card down
 * once, skipping any already on screen and, while it can, any laid down in about the last
 * screenful. A reaction reorders the deck and starts a new pass there and then. Otherwise a
 * reader who had already wandered past most of the untouched domains would be dealt what was
 * left of the old pass — mostly the domain they had just reacted to.
 *
 * A reaction changes what is dealt next, never what already lies on the desk. A card liked or
 * disliked during this visit stays in its cell and is simply not dealt again. The one card
 * that does move is one reacted to on an earlier visit: the server deals before this
 * browser's prefs are known, so such a card can land on the first screen, and its cell is
 * dealt again as soon as they arrive.
 */

import type { Card } from './types'
import type { Cell, Slot } from './desk'

/**
 * Deal the cells on screen. `stays` holds the cards reacted to during this visit: they have
 * left the deck, but keep the cells they already lie in.
 */
export type Dealer = (cells: Cell[], deck: Card[], stays?: ReadonlySet<string>) => Slot[]

/**
 * How many of the latest deals count as recent: about a screenful and a column, so a card
 * that has just scrolled off is not laid straight back down. Never more than half the deck.
 */
const RECENT = 24

const NONE: ReadonlySet<string> = new Set()

/** A dealer for one visit. Slot indexes point into `cards`; every deck is drawn from them. */
export function createDealer(cards: Card[]): Dealer {
  const indexOf = new Map(cards.map((card, i) => [card.id, i]))
  /** Cell key → card id, for every cell dealt this visit. */
  const placed = new Map<string, string>()
  /** Card id → the number of the deal that last laid it down. */
  const dealtAt = new Map<string, number>()
  let deals = 0
  /** The deal the current pass began at. */
  let passStart = 0
  let lastDeck: Card[] | null = null

  return (cells, deck, stays = NONE) => {
    if (deck !== lastDeck) {
      if (lastDeck !== null) passStart = deals
      lastDeck = deck
    }

    const onDeck = new Set(deck.map((card) => card.id))
    const onScreen = new Set<string>()
    const span = Math.min(RECENT, Math.floor(deck.length / 2))
    const at = (id: string) => dealtAt.get(id) ?? -Infinity
    const inPass = (id: string) => at(id) >= passStart
    const recent = (id: string) => deals - at(id) <= span
    const first = (ok: (id: string) => boolean) =>
      deck.find((card) => !onScreen.has(card.id) && ok(card.id))?.id

    const next = (): string | undefined => {
      let id = first((c) => !inPass(c) && !recent(c)) ?? first((c) => !inPass(c))
      if (id === undefined) {
        // Everything on offer has been dealt this pass: begin the next one.
        passStart = deals
        id = first((c) => !recent(c)) ?? first(() => true)
      }
      if (id !== undefined) return id
      // A deck smaller than the screen has to repeat itself: the card laid down longest ago.
      let oldest: string | undefined
      for (const card of deck) if (oldest === undefined || at(card.id) < at(oldest)) oldest = card.id
      return oldest
    }

    // Cells keep what they hold first, so a card already on screen is never dealt beside it.
    const kept = cells.map((cell) => {
      const id = placed.get(cell.key)
      if (id === undefined || !(onDeck.has(id) || stays.has(id))) return undefined
      onScreen.add(id)
      return id
    })

    return cells.flatMap((cell, k) => {
      let id = kept[k]
      if (id === undefined) {
        id = next()
        if (id !== undefined) {
          placed.set(cell.key, id)
          dealtAt.set(id, deals)
          deals += 1
          onScreen.add(id)
        }
      }
      const index = id === undefined ? undefined : indexOf.get(id)
      return index === undefined ? [] : [{ ...cell, index }]
    })
  }
}
