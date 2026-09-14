import { TAGS, type Collections, type TagId } from '@/lib/collections'
import styles from './Shelf.module.css'

type Props = {
  collections: Collections
  /** A card is turned over; the shelf steps away. */
  hidden: boolean
  /** The tag the list is narrowed to, if any. */
  activeTag: TagId | null
  onPress: (e: React.PointerEvent<HTMLElement>, tag: TagId) => void
  /** Keyboard activation only. A pointer click is told apart from a drag in onPress. */
  onKeyOpen: (tag: TagId) => void
}

/**
 * Favourite tags on the left edge, on the kraft stock the slips use: they are the reader's
 * own marks, the way the slip is the editor's. DESIGN.md section 11.
 */
export function Shelf({ collections, hidden, activeTag, onPress, onKeyOpen }: Props) {
  return (
    <nav className={styles.shelf} data-hidden={hidden} aria-label="收藏">
      {TAGS.map((tag) => {
        const count = collections[tag.id].length
        return (
          <button
            key={tag.id}
            type="button"
            className={styles.tag}
            data-tag={tag.id}
            aria-pressed={activeTag === tag.id}
            aria-label={`${tag.label}，${count} 张`}
            disabled={hidden}
            onPointerDown={(e) => onPress(e, tag.id)}
            onClick={(e) => {
              if (e.detail === 0) onKeyOpen(tag.id)
            }}
          >
            <span>{tag.label}</span>
            <span className={styles.count}>{count}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** What follows the pointer while filing. Filled and positioned by useCollect. */
export function DragGhost({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={styles.ghost} hidden aria-hidden="true" />
}
