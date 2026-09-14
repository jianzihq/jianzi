import Image from 'next/image'
import { paperOffset, paperTilt, plateOffset, deckleIndex, slipPose } from '@/lib/paper'
import { DECKLE_COUNT } from './Deckle'
import { GUIDE_AVATAR, GUIDE_BODY, GUIDE_FIGURES, GUIDE_ID, GUIDE_SLIP, GUIDE_TITLE } from '@/lib/guide'
import { paragraphs } from '@/lib/paragraphs'
import card from './Card.module.css'

/**
 * The first-visit clipping. Same stock as the deck — sheet, plate, slip — but none of
 * the fields a Zhihu card carries. Fake votes would read as a broken pool item.
 * DESIGN.md section 11.
 */
export function GuideCard() {
  const { x, y } = paperOffset(GUIDE_ID)
  const plate = plateOffset(GUIDE_ID)
  const slip = slipPose(GUIDE_ID)

  return (
    <article
      className={card.card}
      style={
        {
          '--paper-x': `${x}px`,
          '--paper-y': `${y}px`,
          '--tilt': `${paperTilt(GUIDE_ID).toFixed(2)}deg`,
          '--stamp-ink': 'var(--ink-soft)',
          '--plate-x': `${plate.x.toFixed(2)}px`,
          '--plate-y': `${plate.y.toFixed(2)}px`,
          '--plate-rot': `${plate.rot.toFixed(3)}deg`,
          '--deckle': `url(#deckle-${deckleIndex(GUIDE_ID, DECKLE_COUNT)})`,
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
          {GUIDE_TITLE}
        </span>
        <span className={card.ink}>{GUIDE_TITLE}</span>
      </h2>

      <div className={card.byline}>
        <span className={card.portrait}>
          <Image src={GUIDE_AVATAR} alt="" width={38} height={38} />
        </span>
        <span className={card.who}>
          <div className={card.name}>见字</div>
          <div className={card.badge}>第一次打开才有</div>
        </span>
      </div>

      <hr className={card.rule} />

      <div className={card.body}>
        {paragraphs(GUIDE_BODY).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {GUIDE_FIGURES.filter((fig) => fig.face === 'front').map((fig) => (
        <figure key={fig.src} className={card.figure}>
          <img src={fig.src} alt={fig.alt} />
        </figure>
      ))}

      <div className={card.slip}>{GUIDE_SLIP}</div>
    </article>
  )
}
