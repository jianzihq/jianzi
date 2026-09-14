'use client'

import { useEffect, useRef } from 'react'
import type { Card as CardData } from '@/lib/types'
import { tagLabel, type Collections, type TagId } from '@/lib/collections'
import { Card } from './Card'
import styles from './ListView.module.css'

type Props = {
  cards: CardData[]
  /** Narrow to one favourite tag, or null for every card. */
  filter: TagId | null
  collections: Collections
  /** The card currently turned over from this list, hidden while it is away. */
  hiddenId: string | null
  onOpen: (card: CardData, item: HTMLElement) => void
  onPress: (e: React.PointerEvent<HTMLElement>, card: CardData) => void
  onShowAll: () => void
  onRemove: (tag: TagId, id: string) => void
}

/**
 * The flat list: every card laid out to scroll through, for scanning rather than wandering.
 * Opened from a favourite tag, it shows only that tag's clippings. DESIGN.md section 11.
 */
export function ListView({
  cards,
  filter,
  collections,
  hiddenId,
  onOpen,
  onPress,
  onShowAll,
  onRemove,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)

  // Focused so the arrows, Space and Page Down scroll the list rather than nothing.
  useEffect(() => {
    scroller.current?.focus({ preventScroll: true })
  }, [])

  const byId = new Map(cards.map((c) => [c.id, c]))
  const items = filter
    ? collections[filter].flatMap((id) => byId.get(id) ?? [])
    : // Cards with a written reason first: those are the ones most worth meeting.
      [...cards].sort((a, b) => Number(Boolean(b.reason)) - Number(Boolean(a.reason)))
  const label = filter ? tagLabel(filter) : ''

  return (
    <div ref={scroller} className={styles.list} tabIndex={-1}>
      <header className={styles.masthead}>
        <h1 className={styles.title}>见字</h1>
        <p className={styles.tagline}>
          一张一张地遇见知乎上那些写得认真的人，然后走进去读完他写的东西。
        </p>
      </header>

      <div className={styles.status}>
        {filter ? (
          <>
            <span>
              「{label}」 · {items.length} 张
            </span>
            <button type="button" className={styles.showAll} onClick={onShowAll}>
              看全部
            </button>
          </>
        ) : (
          <span>全部 {items.length} 张</span>
        )}
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>
          {filter ? (
            <>
              「{label}」里还没有剪报。
              <br />
              按住一张卡片不放，把它拖到左边的标签上；或者把标签直接拖到卡片上。
            </>
          ) : (
            '卡片还没有准备好。'
          )}
        </p>
      ) : (
        <div className={styles.spread}>
          {items.map((card) => (
            <div
              key={card.id}
              className={styles.item}
              data-card={card.id}
              style={hiddenId === card.id ? { visibility: 'hidden' } : undefined}
              onPointerDown={(e) => onPress(e, card)}
              onClick={(e) => onOpen(card, e.currentTarget)}
            >
              <Card card={card} />
              {filter && (
                <button
                  type="button"
                  className={styles.remove}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(filter, card.id)
                  }}
                >
                  从「{label}」移出
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
