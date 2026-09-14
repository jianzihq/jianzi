import type { Card } from './types'

/** What the browser remembers. Card ids only — nothing leaves localStorage. */
export type Prefs = {
  liked: string[]
  disliked: string[]
}

export const emptyPrefs: Prefs = { liked: [], disliked: [] }

/**
 * Order the deck. Pure — no React, no Next, no browser APIs, so it stays runnable
 * on its own.
 *
 * The rule runs the usual recommendation logic backwards: domains the reader has
 * already reacted to sink, domains they have never touched rise. Liking three
 * technology cards is a reason to show them forestry, not more technology.
 */
export function orderDeck(cards: Card[], prefs: Prefs): Card[] {
  const seen = new Set([...prefs.liked, ...prefs.disliked])
  const touchedDomains = new Set(
    cards.filter((c) => seen.has(c.id)).map((c) => c.domain)
  )

  return cards
    .filter((c) => !seen.has(c.id))
    .map((card, i) => ({ card, i }))
    .sort((a, b) => {
      const aFresh = a.card.domain && !touchedDomains.has(a.card.domain) ? 0 : 1
      const bFresh = b.card.domain && !touchedDomains.has(b.card.domain) ? 0 : 1
      return aFresh - bFresh || a.i - b.i
    })
    .map(({ card }) => card)
}

/**
 * Lay the pool out so no domain arrives in a run. The pool comes grouped the way it was
 * fetched, and the desk deals in deck order, so without this a whole screenful would be one
 * domain. Each card goes by how far through its own domain it is. orderDeck keeps this
 * order within each of its two tiers, so the interleaving survives it.
 */
export function spread(cards: Card[]): Card[] {
  const total = new Map<string, number>()
  for (const card of cards) total.set(card.domain, (total.get(card.domain) ?? 0) + 1)
  const reached = new Map<string, number>()
  return cards
    .map((card, i) => {
      const k = reached.get(card.domain) ?? 0
      reached.set(card.domain, k + 1)
      return { card, i, at: (k + 0.5) / (total.get(card.domain) ?? 1) }
    })
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(({ card }) => card)
}
