import { paperOffset, paperTilt, plateOffset, deckleIndex, slipPose } from '@/lib/paper'
import { DECKLE_COUNT } from './Deckle'
import card from './Card.module.css'

/** Stable id so the paper traits do not jump between renders. */
const ID = 'jianzi:guide'

/**
 * The first-visit clipping. Same stock as the deck — sheet, plate, slip — but none of
 * the fields a Zhihu card carries. Fake votes would read as a broken pool item.
 * DESIGN.md section 11.
 */
export function GuideCard() {
  const { x, y } = paperOffset(ID)
  const plate = plateOffset(ID)
  const slip = slipPose(ID)

  return (
    <article
      className={card.card}
      style={
        {
          '--paper-x': `${x}px`,
          '--paper-y': `${y}px`,
          '--tilt': `${paperTilt(ID).toFixed(2)}deg`,
          '--stamp-ink': 'var(--ink-soft)',
          '--plate-x': `${plate.x.toFixed(2)}px`,
          '--plate-y': `${plate.y.toFixed(2)}px`,
          '--plate-rot': `${plate.rot.toFixed(3)}deg`,
          '--deckle': `url(#deckle-${deckleIndex(ID, DECKLE_COUNT)})`,
          '--slip-w': `${slip.width}px`,
          '--slip-left': `${slip.left}px`,
          '--slip-bottom': `${slip.bottom}px`,
          '--slip-rot': `${slip.rot.toFixed(2)}deg`,
          '--slip-clip': `${slip.clip}px`,
        } as React.CSSProperties
      }
    >
      <div className={card.sheet} />

      <div className={card.masthead}>
        <span className={card.source}>见字 · 说明</span>
      </div>

      <h2 className={card.headline}>
        <span className={card.plate} aria-hidden="true">
          从中间这一张看起
        </span>
        <span className={card.ink}>从中间这一张看起</span>
      </h2>

      <div className={card.byline}>
        <span className={card.who}>
          <div className={card.name}>见字</div>
          <div className={card.badge}>桌上留的一张</div>
        </span>
      </div>

      <hr className={card.rule} />

      <p className={card.body}>
        中间这一张最清楚，旁边的字会退开一点。桌子可以拖。触控板两指也能挪。方向键会把下一张送到眼前。拖到某张停住了，点它，纸会翻过来。翻过去那一面排的是我们拿到的全部原文开头，撕口下面才去知乎。周围淡下去的是还没走到跟前的剪报。评论里有人顶回去，有人只回了一句玩笑，那些也在翻开的那一面。你在桌上遇见谁，就读谁。
      </p>

      <div className={card.slip}>这张看完就挪开。想留着的卡，按住再拖到左边。</div>
    </article>
  )
}
