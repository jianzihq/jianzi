'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
/** The turn. Must match --turn in Desk.module.css. */
const TURN_MS = 720
/** How long past its due time a backup waits for a transitionend that never came. */
const GRACE_MS = 160

/** How the desk draws a card at a given focus. Shared with the overlay's closed pose. */
const depthAt = (f: number): number => 0.78 + 0.22 * f
const dimAt = (f: number): number => 0.3 + 0.7 * f

type Vec = { x: number; y: number }

/**
 * An opened card moves through these in order.
 *
 *   idle → enter → turning → reading → [rewind] → prereturn → returning → idle
 *
 * enter      mounted exactly on the desk card, measured, not yet moving
 * turning    turning over; all growth lands in the first half, so the back arrives at size
 * reading    flat and full length; the stage scrolls the whole sheet
 * rewind     sliding the sheet back to its head, only when it was scrolled
 * prereturn  back in 3D at the open pose — on screen, identical to the frame before
 * returning  turning back and shrinking onto the card on the desk
 *
 * Each step is advanced by the transition that ends it. Timers only stand in for a
 * transitionend that never arrives, and every step first checks that it still belongs to
 * the opening that scheduled it. Bare timers guessing at durations are what let a quick
 * close collide with a quick reopen.
 */
type Phase = 'idle' | 'enter' | 'turning' | 'reading' | 'rewind' | 'prereturn' | 'returning'

type Opened = {
  key: string
  index: number
  /** Desk position of the slot, to find the card on screen again when putting it back. */
  x: number
  y: number
  /** The clipping's own height, so the closed pose is the card's real size. */
  height: number
}

/** Where a card is on screen relative to the middle, and how the desk is drawing it. */
type Pose = { x: number; y: number; s: number; o: number; f: number }

export function Desk({ cards }: { cards: CardData[] }) {
  const viewport = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)

  /** Where input has pushed the camera, and where it is actually drawn. */
  const target = useRef<Vec>({ x: 0, y: 0 })
  const current = useRef<Vec>({ x: 0, y: 0 })
  const size = useRef<Vec>({ x: 1440, y: 900 })

  /** Live handles for the slots on screen, so focus is written without a re-render. */
  const nodes = useRef(new Map<string, { el: HTMLDivElement; x: number; y: number }>())
  /** Set when the desk must redraw even though the camera has not moved. */
  const dirty = useRef(true)

  // Seeded with a laptop-sized viewport at the origin so the desk arrives with cards
  // already on it. slotsInView is pure, so the server and the first client render agree
  // and nothing pops in after hydration; the real viewport size refines it on mount.
  const [slots, setSlots] = useState<Slot[]>(() =>
    slotsInView(0, 0, 1440, 900, cards.length),
  )
  const slotKeys = useRef(slots.map((s) => s.key).join('|'))

  const [phase, setPhaseState] = useState<Phase>('idle')
  /** Mirrors phase for handlers and timers, which would otherwise read a stale one. */
  const phaseRef = useRef<Phase>('idle')
  /** Bumped on every open. Anything an older opening scheduled is ignored. */
  const generation = useRef(0)
  const [opened, setOpened] = useState<Opened | null>(null)
  const openedRef = useRef<Opened | null>(null)
  const [from, setFrom] = useState<Pose>({ x: 0, y: 0, s: 1, o: 1, f: 1 })
  const [geom, setGeom] = useState({ top: 54, openH: 900 })

  const stage = useRef<HTMLDivElement>(null)
  const flipper = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  /** A drag that travelled is not a click, however it ends. */
  const moved = useRef(false)
  /** Read inside the gesture handlers, which are bound once and never see new state. */
  const isOpen = useRef(false)

  const registerSlot = useCallback((slot: Slot) => (el: HTMLDivElement | null) => {
    if (el) nodes.current.set(slot.key, { el, x: slot.x, y: slot.y })
    else nodes.current.delete(slot.key)
    dirty.current = true
  }, [])

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  /** True only if the opening that scheduled a step is still live and still in one of these. */
  const isLive = useCallback(
    (g: number, ...phases: Phase[]) =>
      generation.current === g && phases.includes(phaseRef.current),
    [],
  )

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
        // ctrl+wheel is the trackpad pinch. Over the desk it would zoom the whole page out
        // from under the fixed layout, so it is cancelled there. Over an open column it is
        // left alone: enlarging text to read it is a fair thing to want.
        if (event.ctrlKey) {
          if (!isOpen.current) event.preventDefault()
          return
        }
        if (isOpen.current) return
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
    const measureViewport = () => {
      size.current = { x: window.innerWidth, y: window.innerHeight }
      dirty.current = true
    }
    measureViewport()
    window.addEventListener('resize', measureViewport)

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

      // An open column is focused and scrolls natively, so its keys are left to it.
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
    let lastX = Number.NaN
    let lastY = Number.NaN
    const tick = () => {
      const c = current.current
      const t = target.current
      c.x += (t.x - c.x) * CHASE
      c.y += (t.y - c.y) * CHASE

      // Once the camera is at rest there is nothing new to draw. While a card is open the
      // desk is frozen, and rewriting twenty cards every frame under a scrolling column is
      // work that competes with the scroll for nothing.
      const atRest = Math.abs(c.x - lastX) < 0.01 && Math.abs(c.y - lastY) < 0.01
      if (atRest && !dirty.current) {
        raf = requestAnimationFrame(tick)
        return
      }
      lastX = c.x
      lastY = c.y
      dirty.current = false

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
        el.style.setProperty('--depth', depthAt(f).toFixed(3))
        el.style.setProperty('--dim', dimAt(f).toFixed(3))
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
      window.removeEventListener('resize', measureViewport)
      window.removeEventListener('keydown', onKey)
    }
  }, [cards.length])

  /** Where the card at a desk position is on screen right now, drawn as the desk draws it. */
  const poseOf = useCallback((x: number, y: number): Pose => {
    const c = current.current
    const dx = x - (c.x + size.current.x / 2)
    const dy = y - (c.y + size.current.y / 2)
    const f = focusAt(dx, dy)
    return { x: dx, y: dy, s: depthAt(f), o: dimAt(f), f }
  }, [])

  /** The sheet's length, and how much of it to show while it turns. */
  const measureSheet = useCallback(() => {
    const length = sheet.current?.offsetHeight ?? 900
    const top = Math.round(window.innerHeight * 0.06)
    // A long sheet is shown to a little past the bottom of the screen, never cut off above
    // it. The clip edge is then always off-screen, so letting go of it when reading starts
    // reveals nothing — that alone is why the handover into reading cannot be seen.
    setGeom({ top, openH: Math.min(length, window.innerHeight - top + 32) })
  }, [])

  const finishReturn = useCallback(
    (g: number) => {
      if (!isLive(g, 'returning')) return
      isOpen.current = false
      openedRef.current = null
      setOpened(null)
      setPhase('idle')
    },
    [isLive, setPhase],
  )

  /** Turn back onto wherever the card on the desk is at this moment. */
  const turnBack = useCallback(
    (g: number) => {
      const o = openedRef.current
      if (o) setFrom(poseOf(o.x, o.y))
      setPhase('returning')
      window.setTimeout(() => finishReturn(g), TURN_MS + GRACE_MS)
    },
    [finishReturn, poseOf, setPhase],
  )

  /** Back into 3D at the open pose, then turn. */
  const toPrereturn = useCallback(
    (g: number) => {
      if (!isLive(g, 'reading', 'rewind')) return
      const el = flipper.current
      if (el) {
        el.style.transition = ''
        el.style.transform = ''
      }
      measureSheet()
      setPhase('prereturn')
      // Two frames: the open pose has to be painted before the turn back is asked for, or
      // there is nothing for the transition to start from.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (isLive(g, 'prereturn')) turnBack(g)
        }),
      )
    },
    [isLive, measureSheet, setPhase, turnBack],
  )

  const open = useCallback(
    (slot: Slot) => {
      if (moved.current || phaseRef.current !== 'idle') return
      generation.current += 1
      isOpen.current = true

      const card = nodes.current.get(slot.key)?.el.querySelector('article')
      const next: Opened = {
        key: slot.key,
        index: slot.index,
        x: slot.x,
        y: slot.y,
        height: card instanceof HTMLElement ? card.offsetHeight : 520,
      }
      openedRef.current = next
      // Picked up from exactly where it lies, at the scale and dimming the desk is drawing it
      // with, so there is never a second copy of the card in a second place.
      setFrom(poseOf(slot.x, slot.y))
      setOpened(next)
      setPhase('enter')

      // Bring it to the middle. The overlay travels there as part of the turn and the desk
      // card is hidden meanwhile, so the camera can take its own time.
      target.current = { x: slot.x - size.current.x / 2, y: slot.y - size.current.y / 2 }
    },
    [poseOf, setPhase],
  )

  const close = useCallback(() => {
    const g = generation.current
    const p = phaseRef.current
    // From here the desk stays exactly where it is, so the card is put back where it will
    // still be when the turn ends.
    target.current = { ...current.current }

    if (p === 'enter' || p === 'turning') {
      turnBack(g)
      return
    }
    if (p !== 'reading') return

    const s = stage.current
    const el = flipper.current
    const scrolled = s ? s.scrollTop : 0
    if (!s || !el || scrolled < 1) {
      toPrereturn(g)
      return
    }
    // Hold the sheet where the reader left it while the scroll position resets under it —
    // both writes land in the same frame, so nothing moves — then slide it back to its
    // head. It can only turn from there.
    const duration = Math.min(760, 280 + scrolled * 0.18)
    el.style.transition = 'none'
    el.style.transform = `translateY(${-scrolled}px)`
    s.scrollTop = 0
    setPhase('rewind')
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!isLive(g, 'rewind')) return
        el.style.transition = `transform ${duration}ms cubic-bezier(0.32, 0.72, 0.2, 1)`
        el.style.transform = 'translateY(0px)'
        window.setTimeout(() => toPrereturn(g), duration + GRACE_MS)
      }),
    )
  }, [isLive, setPhase, toPrereturn, turnBack])

  const onTurnEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
      const g = generation.current
      switch (phaseRef.current) {
        case 'turning':
          if (isLive(g, 'turning')) setPhase('reading')
          break
        case 'rewind':
          toPrereturn(g)
          break
        case 'returning':
          finishReturn(g)
          break
      }
    },
    [finishReturn, isLive, setPhase, toPrereturn],
  )

  // Measured in the frame the overlay mounts, before it paints; the turn is asked for two
  // frames later so the closed pose is on screen to transition from.
  useLayoutEffect(() => {
    if (phase !== 'enter') return
    measureSheet()
    const g = generation.current
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (!isLive(g, 'enter')) return
        setPhase('turning')
        window.setTimeout(() => {
          if (isLive(g, 'turning')) setPhase('reading')
        }, TURN_MS + GRACE_MS)
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [phase, isLive, measureSheet, setPhase])

  // Focus the stage so Space, Page Down and the arrows scroll the column natively.
  useEffect(() => {
    if (phase === 'reading') stage.current?.focus({ preventScroll: true })
  }, [phase])

  const active = phase !== 'idle'
  useEffect(() => {
    if (!active) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [active, close])

  // While reading, the stage covers the screen above the backdrop, so it decides for itself
  // whether a click landed on paper or on desk. Paper, ink and the note stop their own
  // clicks; what is listed here are the transparent boxes around them.
  const onStageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (phaseRef.current !== 'reading') return
      const t = e.target
      const holder = sheet.current
      if (
        t === e.currentTarget ||
        t === flipper.current ||
        t === holder ||
        t === holder?.parentElement ||
        (t instanceof HTMLElement && t.parentElement === holder)
      ) {
        close()
      }
    },
    [close],
  )

  const openedCard = opened ? cards[opened.index] : null

  return (
    <div ref={viewport} className={styles.viewport}>
      <div ref={plane} className={styles.plane}>
        {slots.map((slot) => (
          <div
            key={slot.key}
            ref={registerSlot(slot)}
            className={styles.slot}
            style={{
              left: slot.x,
              top: slot.y,
              visibility: opened?.key === slot.key ? 'hidden' : undefined,
            }}
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

      {opened && openedCard && (
        <>
          <div
            className={styles.backdrop}
            data-on={phase !== 'enter' && phase !== 'returning'}
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={stage}
            className={styles.stage}
            data-phase={phase}
            tabIndex={-1}
            onClick={onStageClick}
          >
            <div
              ref={flipper}
              className={styles.flipper}
              data-phase={phase}
              onTransitionEnd={onTurnEnd}
              style={
                {
                  '--paper-x': `${paperOffset(openedCard.id).x}px`,
                  '--paper-y': `${paperOffset(openedCard.id).y}px`,
                  '--stamp-ink': domainInk(openedCard.domain),
                  '--card-tilt': `${paperTilt(openedCard.id).toFixed(2)}deg`,
                  '--closed-h': `${opened.height}px`,
                  '--column-w': 'min(640px, calc(100vw - 48px))',
                  '--top': `${geom.top}px`,
                  '--open-h': `${geom.openH}px`,
                  '--from-x': `${from.x.toFixed(1)}px`,
                  '--from-y': `${from.y.toFixed(1)}px`,
                  '--from-s': from.s.toFixed(3),
                  '--from-o': from.o.toFixed(3),
                  '--from-f': from.f.toFixed(3),
                } as React.CSSProperties
              }
            >
              <div className={`${styles.face} ${styles.front}`}>
                <Card card={openedCard} />
              </div>
              <div className={`${styles.face} ${styles.back}`}>
                <div ref={sheet}>
                  <Column card={openedCard} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.closeHint} data-on={phase === 'reading'}>
            ESC 或点击四周放回桌上
          </div>
        </>
      )}
    </div>
  )
}
