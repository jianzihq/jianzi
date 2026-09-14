import { paperOffset, paperTilt, plateOffset, deckleIndex } from '@/lib/paper'
import { DECKLE_COUNT } from './Deckle'
import card from './Card.module.css'
import styles from './EmptyDesk.module.css'

const EMPTY_ID = 'jianzi:empty'
const EMPTY_TITLE = '桌上还没有剪报'

/**
 * What the page shows when the pool has no cards. DESIGN.md section 8 asks for a real notice
 * here: not a blank desk, and not placeholder cards. The pool ships inside the build, so this
 * only appears when a build goes out without one.
 *
 * Same stock as the guide, a clipping with none of the fields a Zhihu card carries.
 */
export function EmptyDesk() {
  const { x, y } = paperOffset(EMPTY_ID)
  const plate = plateOffset(EMPTY_ID)

  return (
    <main className={styles.empty}>
      <article
        className={card.card}
        style={
          {
            '--paper-x': `${x}px`,
            '--paper-y': `${y}px`,
            '--tilt': `${paperTilt(EMPTY_ID).toFixed(2)}deg`,
            '--stamp-ink': 'var(--ink-soft)',
            '--plate-x': `${plate.x.toFixed(2)}px`,
            '--plate-y': `${plate.y.toFixed(2)}px`,
            '--plate-rot': `${plate.rot.toFixed(3)}deg`,
            '--deckle': `url(#deckle-${deckleIndex(EMPTY_ID, DECKLE_COUNT)})`,
          } as React.CSSProperties
        }
      >
        <div className={card.sheet} />

        <div className={card.masthead}>
          <span className={card.source}>见字 · 说明</span>
        </div>

        <h1 className={card.headline}>
          <span className={card.plate} aria-hidden="true">
            {EMPTY_TITLE}
          </span>
          <span className={card.ink}>{EMPTY_TITLE}</span>
        </h1>

        <hr className={card.rule} />

        <div className={card.copy}>
          <p>这一版的内容池是空的，卡片没能摆上桌。我们补上内容以后，刷新这一页就能看到。</p>
        </div>
      </article>
    </main>
  )
}
