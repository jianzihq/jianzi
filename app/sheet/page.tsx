import { Card } from '../components/Card'
import { pool } from '@/lib/pool'
import styles from './sheet.module.css'

/**
 * A flat spread of card fronts. Scaffolding for judging the card itself — the card
 * table with its depth, dragging and flip replaces this. See DESIGN.md sections 3-5.
 */
export default function Page() {
  const withReason = pool.filter((c) => c.reason).length
  const withComments = pool.filter((c) => c.comments.length > 0).length
  const old = pool.filter((c) => c.stats.year < 2026).length

  // Cards carrying a written reason first — those are the ones worth looking at.
  const spread = [...pool].sort((a, b) => Number(Boolean(b.reason)) - Number(Boolean(a.reason)))

  return (
    <main className={styles.desk}>
      <header className={styles.masthead}>
        <h1 className={styles.title}>见字</h1>
        <p className={styles.tagline}>
          一张一张地遇见知乎上那些写得认真的人，然后走进去读完他写的东西。
        </p>
      </header>

      <div className={styles.status}>
        <span>{pool.length} 张卡</span>
        <span>{old} 张早于 2026</span>
        <span>{withComments} 张有精选评论</span>
        <span className={withReason < pool.length ? styles.todo : undefined}>
          {withReason} / {pool.length} 张已有理由
        </span>
      </div>

      <div className={styles.spread}>
        {spread.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </main>
  )
}
