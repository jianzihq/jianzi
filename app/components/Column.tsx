import Image from 'next/image'
import type { Card as CardData } from '@/lib/types'
import { tearClip, onwardPose } from '@/lib/paper'
import { GUIDE_ID } from '@/lib/guide'
import styles from './Column.module.css'

/**
 * The back of the card: everything the open platform legitimately returns, set to be
 * read, ending in a torn foot where the text runs out.
 *
 * The full answer cannot be had — ContentText is the opening and scraping is the red
 * line — so the column ends honestly and hands the reader to Zhihu on a separate note
 * tucked under the tear. DESIGN.md section 5.
 */
export function Column({ card }: { card: CardData }) {
  const pose = onwardPose(card.id)

  return (
    <div
      className={styles.column}
      style={
        {
          '--tear-clip': tearClip(card.id),
          '--onward-left': `${pose.left}px`,
          '--onward-rot': `${pose.rot.toFixed(2)}deg`,
        } as React.CSSProperties
      }
    >
      <div className={styles.paper} aria-hidden="true">
        <div className={styles.cast} />
        <div className={styles.shade} />
        <div className={styles.rim} />
        <div className={styles.sheet} />
      </div>

      <div className={styles.ink}>
        <div className={styles.masthead}>
          <span className={styles.source}>
            {card.url
              ? `知乎 · ${card.stats.year} · ${card.stats.votes} 赞 · ${card.stats.comments} 评`
              : '见字 · 说明'}
          </span>
          {card.domain && <span className={styles.stamp}>{card.domain}</span>}
        </div>

        <h2 className={styles.headline}>{card.title}</h2>

        <div className={styles.byline}>
          {card.author ? (
            <>
              {card.author.avatar ? (
                <span className={card.id === GUIDE_ID ? `${styles.portrait} ${styles.seal}` : styles.portrait}>
                  {card.id === GUIDE_ID ? (
                    <img src={card.author.avatar} alt="" width={44} height={44} />
                  ) : (
                    <Image src={card.author.avatar} alt="" width={44} height={44} />
                  )}
                </span>
              ) : null}
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

      {card.url ? (
        <div className={styles.onwardSlip}>
          <a className={styles.onward} href={card.url} target="_blank" rel="noopener noreferrer">
            余下的在知乎 →
          </a>
        </div>
      ) : null}
    </div>
  )
}
