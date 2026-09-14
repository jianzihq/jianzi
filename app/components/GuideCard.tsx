import Image from 'next/image'
import { paperOffset, paperTilt, plateOffset, deckleIndex, slipPose } from '@/lib/paper'
import { DECKLE_COUNT } from './Deckle'
import {
  GUIDE_AVATAR,
  GUIDE_BLOCKS,
  GUIDE_ID,
  GUIDE_SLIP,
  GUIDE_TITLE,
  type GuideBlock,
} from '@/lib/guide'
import card from './Card.module.css'

/**
 * How wide a plate is drawn, so the browser fetches a cut that fits instead of assuming
 * the whole viewport. The front sits in the card's text column, 356px at the largest card
 * scale of 1.2. The back sits in the column sheet: min(640px, 100vw - 48px) less its side
 * padding, 92px, or 44px on a phone.
 */
const PLATE_SIZES = {
  front: '428px',
  back: '(max-width: 560px) calc(100vw - 92px), (max-width: 688px) calc(100vw - 140px), 548px',
} as const

export function GuideCopy({
  face,
  figureClassName,
}: {
  face: 'front' | 'back'
  figureClassName: string
}) {
  return GUIDE_BLOCKS.filter((block) => block.face === face).map((block, i) => (
    <GuidePiece key={i} block={block} figureClassName={figureClassName} sizes={PLATE_SIZES[face]} />
  ))
}

function GuidePiece({
  block,
  figureClassName,
  sizes,
}: {
  block: GuideBlock
  figureClassName: string
  sizes: string
}) {
  if (block.type === 'text') return <p>{block.text}</p>
  if (block.type === 'heading') return <h3>{block.text}</h3>
  return (
    <figure className={figureClassName}>
      <Image src={block.src} alt={block.alt} width={block.width} height={block.height} sizes={sizes} />
    </figure>
  )
}

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

      <div className={card.copy}>
        <GuideCopy face="front" figureClassName={card.figure} />
      </div>

      <div className={card.slip}>{GUIDE_SLIP}</div>
    </article>
  )
}
