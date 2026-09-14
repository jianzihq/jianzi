import { useEffect, useRef } from 'react'
import type { RibbonPose } from '@/lib/paper'
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

type RibbonProps = {
  /** Only while the column is being read; they slide away with it as it turns. */
  on: boolean
  /** How this card's pair was tucked in — lib/paper.ts. */
  pose: RibbonPose
  reaction: Reaction | null
  onChoose: (reaction: Reaction) => void
}

/**
 * The considered way to react: two ribbons tucked under the right edge of the open column,
 * the way a ribbon marks a page. They belong to the sheet rather than lying loose on the desk,
 * and every card has them tucked in a little differently. The chosen one is drawn further out
 * and turns red; choosing it again tucks it back.
 *
 * Rendered inside the stage and before the sheet, so the paper lies over their roots.
 */
export function ReactionRibbons({ on, pose, reaction, onChoose }: RibbonProps) {
  return (
    <div
      className={styles.ribbons}
      data-on={on}
      role="group"
      aria-label="这张怎么样"
      style={{ '--drop': `${pose.drop}px`, '--gap': `${pose.gap}px` } as React.CSSProperties}
    >
      {MARKS.map((mark, i) => (
        <button
          key={mark.id}
          type="button"
          className={styles.ribbon}
          data-mark={mark.id}
          aria-pressed={reaction === mark.id}
          disabled={!on}
          onClick={() => onChoose(mark.id)}
          style={
            {
              '--rot': `${pose.ribbons[i].rot}deg`,
              '--base': `${pose.ribbons[i].reach}px`,
            } as React.CSSProperties
          }
        >
          <span className={styles.band}>{mark.label}</span>
        </button>
      ))}
    </div>
  )
}
