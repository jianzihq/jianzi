import Image from 'next/image'
import type { Card as CardData } from '@/lib/types'
import { tearClip } from '@/lib/paper'
import styles from './Column.module.css'

/**
 * The back of the card: everything the open platform legitimately returns, set to be
 * read, with a torn foot where the text runs out.
 *
 * The full answer cannot be had — ContentText is the opening and scraping is the red
 * line — so the column ends honestly and hands the reader to Zhihu. DESIGN.md section 5.
 */
export function Column({ card }: { card: CardData }) {
  return (
    <div className={styles.column}>
      <div className={styles.sheet} style={{ '--tear-clip': tearClip(card.id) } as React.CSSProperties} />
      <div className={styles.ink}>
      <div className={styles.masthead}>
        <span className={styles.source}>
          知乎 · {card.stats.year} · {card.stats.votes} 赞 · {card.stats.comments} 评
        </span>
        {card.domain && <span className={styles.stamp}>{card.domain}</span>}
      </div>

      <h2 className={styles.headline}>{card.title}</h2>

      <div className={styles.byline}>
        {card.author ? (
          <>
            <span className={styles.portrait}>
              <Image src={card.author.avatar} alt="" width={44} height={44} />
            </span>
            <span>
              <div className={styles.name}>{card.author.name}</div>
              {card.author.badge && <div className={styles.badge}>{card.author.badge}</div>}
            </span>
          </>
        ) : (
          <span className={styles.unsigned}>署名不详</span>
        )}
      </div>

      {card.reason && <p className={styles.pencil}>{card.reason}</p>}

      <p className={styles.body}>{card.excerpt}</p>

      {card.comments.length > 0 && (
        <div className={styles.letters}>
          <div className={styles.lettersHead}>读者来信</div>
          {card.comments.map((text, i) => (
            <p key={i} className={styles.letter}>
              {text}
            </p>
          ))}
        </div>
      )}

      </div>

      {/* Tucked under the torn foot, most of it showing past the ragged edge. It is a
          separate piece of paper, which is what lets it outlive the sheet. */}
      <div className={styles.onwardSlip}>
        <a className={styles.onward} href={card.url} target="_blank" rel="noopener noreferrer">
          余下的在知乎 →
        </a>
      </div>
    </div>
  )
}
