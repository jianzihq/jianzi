import Image from 'next/image'
import type { Card as CardData } from '@/lib/types'
import { domainInk } from '@/lib/domains'
import { paperOffset, paperTilt } from '@/lib/paper'
import styles from './Card.module.css'

/**
 * The front of a card: a clipping lying on the desk.
 *
 * Reading order is headline, slip, byline, body. Visual weight does not follow it —
 * the slip wins on contrast alone, being handwritten on a second stock at an angle,
 * so it stays small. See DESIGN.md section 3.
 */
export function Card({ card }: { card: CardData }) {
  const { x, y } = paperOffset(card.id)
  const ink = domainInk(card.domain)

  return (
    <article
      className={styles.card}
      style={
        {
          '--paper-x': `${x}px`,
          '--paper-y': `${y}px`,
          '--tilt': `${paperTilt(card.id).toFixed(2)}deg`,
          '--stamp-ink': ink,
        } as React.CSSProperties
      }
    >
      <div className={styles.masthead}>
        <span className={styles.source}>
          知乎 · {card.stats.year} · {card.stats.votes} 赞 · {card.stats.comments} 评
        </span>
        {card.domain && <span className={styles.stamp}>{card.domain}</span>}
      </div>

      {/* data-text feeds the misregistered plate underneath. */}
      <h2 className={styles.headline} data-text={card.title}>
        {card.title}
      </h2>

      <div className={styles.byline}>
        {card.author ? (
          <>
            <span className={styles.portrait}>
              <Image src={card.author.avatar} alt="" width={38} height={38} />
            </span>
            <span className={styles.who}>
              <div className={styles.name}>{card.author.name}</div>
              {card.author.badge && <div className={styles.badge}>{card.author.badge}</div>}
            </span>
          </>
        ) : (
          <span className={styles.unsigned}>署名不详</span>
        )}
      </div>

      <hr className={styles.rule} />

      <p className={styles.body}>{card.excerpt}</p>

      {/* The slip sits on top of where the body keeps going. We hand over a reason and
          the rest of the text is for the reader to go and find. */}
      {card.reason && <div className={styles.slip}>{card.reason}</div>}
    </article>
  )
}
