'use client'

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Card as CardData } from '@/lib/types'
import {
  fileCard,
  isTagId,
  narrowTo,
  readCollections,
  serverCollections,
  subscribeCollections,
  tagLabel,
  unfileCard,
  type TagId,
} from '@/lib/collections'
import { offerLoginAfterFiling } from '@/lib/account'

/** How long a card is held still before it lifts off to be filed. */
const LIFT_MS = 320
/**
 * Movement that turns a press into a pan or a scroll instead. An ordinary drag that starts
 * on a card has to keep moving the desk: in the compact view there is barely any bare desk
 * left to grab, so filing cannot take the plain drag for itself.
 */
const SLOP = 8

const under = (x: number, y: number, attr: string): Element | null =>
  document.elementFromPoint(x, y)?.closest(`[${attr}]`) ?? null

const place = (ghost: HTMLElement, x: number, y: number) => {
  ghost.style.transform = `translate(${x + 14}px, ${y + 12}px) rotate(-3deg)`
}

/** A small nudge on the tag that just took a card, so the filing is seen to land. */
export function pulse(tag: TagId) {
  const el = document.querySelector<HTMLElement>(`[data-tag="${tag}"]`)
  if (!el) return
  el.removeAttribute('data-pulse')
  void el.offsetWidth
  el.setAttribute('data-pulse', '')
  window.setTimeout(() => el.removeAttribute('data-pulse'), 700)
}

type Options = {
  /** True while something else owns the pointer, such as a card turned over. */
  blocked: () => boolean
  /** A tag pressed and released without being dragged. */
  onTagClick: (tag: TagId) => void
}

/**
 * Filing cards under favourite tags, in both directions: hold a card still and drag it
 * onto a tag, or drag a tag onto a card. DESIGN.md section 11.
 *
 * Everything that moves during a drag — the ghost, the highlighted target — is written
 * straight to the DOM, so the desk and its cards never re-render on a pointer move.
 */
export function useCollect(cards: CardData[], { blocked, onTagClick }: Options) {
  const known = useMemo(() => new Set(cards.map((c) => c.id)), [cards])
  // The server snapshot is empty, so hydration agrees with the server and what this browser
  // has kept arrives in the render right after.
  const stored = useSyncExternalStore(subscribeCollections, readCollections, serverCollections)
  const collections = useMemo(() => narrowTo(stored, known), [stored, known])

  // Filing a card is the moment a login is worth offering; see offerLoginAfterFiling.
  const add = useCallback((tag: TagId, id: string) => {
    if (fileCard(tag, id)) offerLoginAfterFiling()
  }, [])
  const remove = useCallback((tag: TagId, id: string) => {
    unfileCard(tag, id)
  }, [])

  const ghost = useRef<HTMLDivElement>(null)
  /** A card is off the desk and following the pointer; the desk must not pan meanwhile. */
  const lifting = useRef(false)
  /** The press that just ended lifted its card, so the click that follows must not open it. */
  const justLifted = useRef(false)
  const aimed = useRef<Element | null>(null)
  /** Detaches whatever press is in progress. */
  const release = useRef<(() => void) | null>(null)

  useEffect(() => () => release.current?.(), [])

  const aim = useCallback((el: Element | null) => {
    if (aimed.current === el) return
    aimed.current?.removeAttribute('data-drop')
    el?.setAttribute('data-drop', '')
    aimed.current = el
  }, [])

  const showGhost = useCallback((text: string, kind: 'card' | 'tag', x: number, y: number) => {
    const g = ghost.current
    if (!g) return
    g.textContent = text
    g.dataset.kind = kind
    place(g, x, y)
    g.hidden = false
  }, [])

  const hideGhost = useCallback(() => {
    if (ghost.current) ghost.current.hidden = true
    aim(null)
  }, [aim])

  const pressCard = useCallback(
    (e: React.PointerEvent<HTMLElement>, card: CardData) => {
      justLifted.current = false
      if (e.button !== 0 || blocked()) return
      release.current?.()
      const holder = e.currentTarget
      const start = { x: e.clientX, y: e.clientY }
      let last = start

      function finish() {
        window.clearTimeout(timer)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        holder.removeAttribute('data-lifted')
        lifting.current = false
        hideGhost()
        release.current = null
      }
      function onMove(ev: PointerEvent) {
        last = { x: ev.clientX, y: ev.clientY }
        if (!lifting.current) {
          if (Math.hypot(last.x - start.x, last.y - start.y) > SLOP) finish()
          return
        }
        if (ghost.current) place(ghost.current, last.x, last.y)
        aim(under(last.x, last.y, 'data-tag'))
      }
      function onUp(ev: PointerEvent) {
        if (lifting.current) {
          const tag = under(ev.clientX, ev.clientY, 'data-tag')?.getAttribute('data-tag')
          if (isTagId(tag)) {
            add(tag, card.id)
            pulse(tag)
          }
        }
        finish()
      }

      const timer = window.setTimeout(() => {
        lifting.current = true
        justLifted.current = true
        holder.setAttribute('data-lifted', '')
        showGhost(card.title, 'card', last.x, last.y)
      }, LIFT_MS)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      release.current = finish
    },
    [add, aim, blocked, hideGhost, showGhost],
  )

  const pressTag = useCallback(
    (e: React.PointerEvent<HTMLElement>, tag: TagId) => {
      if (e.button !== 0 || blocked()) return
      release.current?.()
      const start = { x: e.clientX, y: e.clientY }
      let dragging = false

      function finish() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        hideGhost()
        release.current = null
      }
      function onMove(ev: PointerEvent) {
        if (!dragging) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= 5) return
          dragging = true
          showGhost(tagLabel(tag), 'tag', ev.clientX, ev.clientY)
        }
        if (ghost.current) place(ghost.current, ev.clientX, ev.clientY)
        aim(under(ev.clientX, ev.clientY, 'data-card'))
      }
      function onUp(ev: PointerEvent) {
        if (dragging) {
          const id = under(ev.clientX, ev.clientY, 'data-card')?.getAttribute('data-card')
          if (id && known.has(id)) {
            add(tag, id)
            pulse(tag)
          }
        } else if (ev.type === 'pointerup') {
          onTagClick(tag)
        }
        finish()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      release.current = finish
    },
    [add, aim, blocked, hideGhost, known, onTagClick, showGhost],
  )

  /** A card is lifted right now. The desk asks before panning. */
  const isLifting = useCallback(() => lifting.current, [])
  /** The press that just ended lifted its card, so the click that follows must not open it. */
  const liftedLastPress = useCallback(() => justLifted.current, [])

  return { collections, add, remove, pressCard, pressTag, ghost, isLifting, liftedLastPress }
}
