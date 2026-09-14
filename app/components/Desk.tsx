'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGesture } from '@use-gesture/react'
import type { Card as CardData } from '@/lib/types'
import { slotsInView, focusAt, slotCentre, cellAt, type Slot } from '@/lib/desk'
import { paperOffset, paperTilt } from '@/lib/paper'
import { domainInk } from '@/lib/domains'
import { Card } from './Card'
import { Column } from './Column'
import styles from './Desk.module.css'

/** How hard the drawn position chases the one input asked for. Lower is more syrup. */
const CHASE = 0.12
/** Seconds of travel granted to a flick. */
const THROW = 0.2

type Vec = { x: number; y: number }

export function Desk({ cards }: { cards: CardData[] }) {
  const viewport = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)

  /** Where input has pushed the camera, and where it is actually drawn. */
  const target = useRef<Vec>({ x: 0, y: 0 })
  const current = useRef<Vec>({ x: 0, y: 0 })
  const size = useRef<Vec>({ x: 1440, y: 900 })

  /** Live handles for the slots on screen, so focus is written without a re-render. */
  const nodes = useRef(new Map<string, { el: HTMLDivElement; x: number; y: number }>())

  // Seeded with a laptop-sized viewport at the origin so the desk arrives with cards
  // already on it. slotsInView is pure, so the server and the first client render agree
  // and nothing pops in after hydration; the real viewport size refines it on mount.
  /** Which slot is turned over, and whether its animation has been kicked off. */
  const [opened, setOpened] = useState<{ key: string; index: number; height: number } | null>(
    null,
  )
  const [turned, setTurned] = useState(false)
  /** Set once the turn has finished, which is when the sheet may take its real length. */
  const [reading, setReading] = useState(false)
  /** A drag that travelled is not a click, however it ends. */
  const moved = useRef(false)

  /** Read inside the gesture handlers, which are bound once and never see new state. */
  const isOpen = useRef(false)

  const [slots, setSlots] = useState<Slot[]>(() =>
    slotsInView(0, 0, 1440, 900, cards.length),
  )
  const slotKeys = useRef(slots.map((s) => s.key).join('|'))

  const registerSlot = useCallback((slot: Slot) => (el: HTMLDivElement | null) => {
    if (el) nodes.current.set(slot.key, { el, x: slot.x, y: slot.y })
    else nodes.current.delete(slot.key)
  }, [])

  useGesture(
    {
      // Dragging blank desk moves the desk. Signs match grabbing the paper itself.
      onDrag: ({ delta: [dx, dy], last, velocity, direction, movement }) => {
        // While a card is turned over the desk holds still, or closing it would reveal
        // a desk that has wandered off somewhere behind the reader's back.
        if (isOpen.current) return
        if (Math.hypot(movement[0], movement[1]) > 5) moved.current = true
        target.current.x -= dx
        target.current.y -= dy
        if (last) {
          // A pointer flick carries nothing on its own, so give it momentum here.
          target.current.x -= velocity[0] * direction[0] * THROW * 1000
          target.current.y -= velocity[1] * direction[1] * THROW * 1000
        }
      },
      // Trackpads and wheels arrive here. No momentum is added: macOS already sends a
      // tail of wheel events after the fingers lift, and decaying that again turns the
      // desk to sludge. Sign follows native scrolling, so the reader's own
      // natural-scroll setting is already baked in and must not be second-guessed.
      onWheel: ({ delta: [dx, dy], event }) => {
        if (isOpen.current) return
        // ctrl+wheel is the trackpad pinch. Swallow it or the browser zooms the page.
        if ((event as WheelEvent).ctrlKey) return
        target.current.x += dx
        target.current.y += dy
      },
    },
    {
      target: viewport,
      eventOptions: { passive: false },
      drag: { filterTaps: true, pointer: { touch: true } },
    },
  )

  useEffect(() => {
    const measure = () => {
      size.current = { x: window.innerWidth, y: window.innerHeight }
    }
    measure()
    window.addEventListener('resize', measure)

    const STEP: Record<string, [number, number]> = {
      arrowleft: [-1, 0],
      arrowright: [1, 0],
      arrowup: [0, -1],
      arrowdown: [0, 1],
      a: [-1, 0],
      d: [1, 0],
      w: [0, -1],
      s: [0, 1],
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.isContentEditable || /^(input|textarea|select)$/i.test(el?.tagName ?? '')) return

      if (isOpen.current) return
      const step = STEP[e.key.toLowerCase()]
      if (!step) return
      e.preventDefault()

      // Snap to the card itself, not one cell along from wherever the pointer stopped.
      // Stepping by a cell width preserves whatever offset the drag left behind, which
      // parks the reader in the gap between two cards and keeps them there.
      const half = { x: size.current.x / 2, y: size.current.y / 2 }
      const here = cellAt(target.current.x + half.x, target.current.y + half.y)
      const next = slotCentre(here.i + step[0], here.j + step[1])
      target.current.x = next.x - half.x
      target.current.y = next.y - half.y
    }
    window.addEventListener('keydown', onKey)

    let raf = 0
    const tick = () => {
      const c = current.current
      const t = target.current
      c.x += (t.x - c.x) * CHASE
      c.y += (t.y - c.y) * CHASE

      if (plane.current) {
        plane.current.style.transform = `translate3d(${-c.x}px, ${-c.y}px, 0)`
      }

      // Depth is opacity and scale only. A real blur across this many layers would
      // cost more than the illusion is worth — see PRODUCT section 8.
      const midX = c.x + size.current.x / 2
      const midY = c.y + size.current.y / 2
      for (const { el, x, y } of nodes.current.values()) {
        const f = focusAt(x - midX, y - midY)
        el.style.setProperty('--focus', f.toFixed(3))
        el.style.setProperty('--depth', (0.86 + 0.14 * f).toFixed(3))
        el.style.setProperty('--dim', (0.3 + 0.7 * f).toFixed(3))
      }

      // React is woken only when the set of slots on screen actually changes.
      const next = slotsInView(c.x, c.y, size.current.x, size.current.y, cards.length)
      const key = next.map((s) => s.key).join('|')
      if (key !== slotKeys.current) {
        slotKeys.current = key
        setSlots(next)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', onKey)
    }
  }, [cards.length])

  const open = useCallback((slot: Slot) => {
    if (moved.current) return
    // Bring it to the middle first. The turn then happens where the reader is looking,
    // and the camera move doubles as the desk receding.
    const half = { x: size.current.x / 2, y: size.current.y / 2 }
    target.current.x = slot.x - half.x
    target.current.y = slot.y - half.y
    isOpen.current = true
    // The clipping's own height, so the closed pose of the overlay matches the card it
    // replaces. offsetHeight ignores the slot's depth scale, which is what we want.
    const card = nodes.current.get(slot.key)?.el.querySelector('article')
    setOpened({
      key: slot.key,
      index: slot.index,
      height: card instanceof HTMLElement ? card.offsetHeight : 520,
    })
    requestAnimationFrame(() => setTurned(true))
    window.setTimeout(() => setReading(true), 760)
  }, [])

  const close = useCallback(() => {
    isOpen.current = false
    // Back to a single screenful before the turn starts, or the sheet would be folding
    // several thousand pixels of paper through the air.
    setReading(false)
    requestAnimationFrame(() => setTurned(false))
    window.setTimeout(() => setOpened(null), 780)
  }, [])

  useEffect(() => {
    if (!opened) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [opened, close])

  const openedCard = opened ? cards[opened.index] : null

  return (
    <div ref={viewport} className={styles.viewport}>
      <div ref={plane} className={styles.plane}>
        {slots.map((slot) => (
          <div
            key={slot.key}
            ref={registerSlot(slot)}
            className={styles.slot}
            style={{ left: slot.x, top: slot.y, visibility: opened?.key === slot.key ? 'hidden' : undefined }}
            onPointerDown={() => {
              moved.current = false
            }}
            onClick={() => open(slot)}
          >
            <Card card={cards[slot.index]} />
          </div>
        ))}
      </div>

      <div className={styles.hud}>拖动 · 触控板两指 · 方向键 / WASD</div>

      {openedCard && (
        <>
          <div
            className={styles.backdrop}
            data-open={turned}
            onClick={close}
            aria-hidden="true"
          />
          <div className={styles.stage} data-reading={reading}>
            <div
              className={styles.flipper}
              data-open={turned}
              data-reading={reading}
              style={
                {
                  '--paper-x': `${paperOffset(openedCard.id).x}px`,
                  '--paper-y': `${paperOffset(openedCard.id).y}px`,
                  '--stamp-ink': domainInk(openedCard.domain),
                  '--card-tilt': `${paperTilt(openedCard.id).toFixed(2)}deg`,
                  '--closed-h': `${opened?.height ?? 520}px`,
                } as React.CSSProperties
              }
            >
              <div className={`${styles.face} ${styles.front}`}>
                <Card card={openedCard} />
              </div>
              <div className={`${styles.face} ${styles.back}`}>
                <Column card={openedCard} />
              </div>
            </div>
          </div>
          <div className={styles.closeHint} data-open={turned}>
            ESC 或点击四周放回桌上
          </div>
        </>
      )}
    </div>
  )
}
