import { useEffect, useRef } from 'react'
import type { Reaction } from '@/lib/prefs'
import styles from './Reactions.module.css'

const MARKS: { id: Reaction; label: string }[] = [
  { id: 'liked', label: '喜欢' },
  { id: 'disliked', label: '不喜欢' },
]

type MenuProps = {
  x: number
  y: number
  reaction: Reaction | null
  onChoose: (reaction: Reaction) => void
  onClose: () => void
}

/**
 * The quick way to react: right-click a card that has not been turned over, and a kraft slip
 * with the two marks comes up under the pointer. Nothing else goes on it. Any press
 * elsewhere, a key, a wheel or losing the window puts it away.
 */
export function ReactionMenu({ x, y, reaction, onChoose, onClose }: MenuProps) {
  const slip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node && slip.current?.contains(e.target))) onClose()
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', onClose)
    window.addEventListener('wheel', onClose, { passive: true })
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', onClose)
      window.removeEventListener('wheel', onClose)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={slip}
      className={styles.menu}
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {MARKS.map((mark) => {
        const on = reaction === mark.id
        return (
          <button
            key={mark.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={on}
            className={styles.item}
            onClick={() => onChoose(mark.id)}
          >
            {on ? `取消${mark.label}` : mark.label}
          </button>
        )
      })}
    </div>
  )
}

type StampProps = {
  /** Only while the column is being read; they step away as it turns. */
  on: boolean
  reaction: Reaction | null
  onChoose: (reaction: Reaction) => void
}

/**
 * The considered way: two stamps resting on the desk beside the open column, the way a
 * proofreader keeps a stamp next to the page rather than on it. The chosen one is inked red;
 * pressing it again lifts the ink.
 */
export function ReactionStamps({ on, reaction, onChoose }: StampProps) {
  return (
    <div className={styles.stamps} data-on={on} role="group" aria-label="这张怎么样">
      {MARKS.map((mark) => (
        <button
          key={mark.id}
          type="button"
          className={styles.stamp}
          data-mark={mark.id}
          aria-pressed={reaction === mark.id}
          disabled={!on}
          onClick={() => onChoose(mark.id)}
        >
          {mark.label}
        </button>
      ))}
    </div>
  )
}
