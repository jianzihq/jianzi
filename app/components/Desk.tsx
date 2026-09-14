'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGesture } from '@use-gesture/react'
import type { Card as CardData } from '@/lib/types'
import { slotsInView, focusAt, CELL_W, CELL_H, type Slot } from '@/lib/desk'
import { Card } from './Card'
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
      onDrag: ({ delta: [dx, dy], last, velocity, direction }) => {
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

    const onKey = (e: KeyboardEvent) => {
      const step: Record<string, [number, number]> = {
        ArrowLeft: [-CELL_W, 0],
        ArrowRight: [CELL_W, 0],
        ArrowUp: [0, -CELL_H],
        ArrowDown: [0, CELL_H],
      }
      const s = step[e.key]
      if (!s) return
      e.preventDefault()
      target.current.x += s[0]
      target.current.y += s[1]
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

  return (
    <div ref={viewport} className={styles.viewport}>
      <div ref={plane} className={styles.plane}>
        {slots.map((slot) => (
          <div
            key={slot.key}
            ref={registerSlot(slot)}
            className={styles.slot}
            style={{ left: slot.x, top: slot.y }}
          >
            <Card card={cards[slot.index]} />
          </div>
        ))}
      </div>
      <div className={styles.hud}>拖动 · 触控板两指 · 方向键</div>
    </div>
  )
}
