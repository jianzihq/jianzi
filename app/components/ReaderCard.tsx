import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  dismissNotice,
  dismissOffer,
  loginHref,
  readAccount,
  readNotice,
  readOffer,
  serverAccount,
  serverNotice,
  serverOffer,
  signOut,
  startAccount,
  subscribeAccount,
} from '@/lib/account'
import styles from './ReaderCard.module.css'

const NOTICE_TEXT = {
  'login-failed': '登录没有成功，可以再试一次',
  'sync-failed': '收藏暂时没能同步，先留在这台浏览器里',
} as const

/**
 * The reader's card, lying at the top right of the desk like a library card: the Zhihu login
 * while it is unregistered, the reader's own name once it is. A card rather than another tab,
 * because signing in is not a way of looking at the desk, and it has to be found. It steps
 * away while a card is open. docs/backend-requirements.md §4.4.
 */
export function ReaderCard({ hidden }: { hidden: boolean }) {
  const account = useSyncExternalStore(subscribeAccount, readAccount, serverAccount)
  const notice = useSyncExternalStore(subscribeAccount, readNotice, serverNotice)
  const [open, setOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startAccount()
  }, [])

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node && box.current?.contains(e.target))) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={box} className={styles.corner} data-hidden={hidden} inert={hidden}>
      {account.status === 'anonymous' && (
        <a className={styles.card} data-state="anonymous" href={loginHref()}>
          <span className={styles.head}>
            <span className={styles.issuer}>见字 · 读者证</span>
            <span className={styles.stamp}>未登记</span>
          </span>
          <span className={styles.title}>用知乎登录</span>
          <span className={styles.note}>收藏跟着账号走，换台设备也在</span>
        </a>
      )}

      {account.status === 'signed-in' && (
        <button
          type="button"
          className={styles.card}
          data-state="signed-in"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          <span className={styles.head}>
            <span className={styles.issuer}>见字 · 读者证</span>
            <span className={styles.stamp}>已登记</span>
          </span>
          <span className={styles.holder}>
            {account.user.avatar && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- a remote Zhihu avatar, fetched without a referrer so its host serves it
              <img
                className={styles.avatar}
                src={account.user.avatar}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className={styles.initial} aria-hidden="true">
                {(account.user.name || '读').slice(0, 1)}
              </span>
            )}
            <span className={styles.name}>{account.user.name || '知乎读者'}</span>
          </span>
        </button>
      )}

      {account.status === 'signed-in' && open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            退出登录
          </button>
        </div>
      )}

      {notice && (
        <button type="button" className={styles.notice} onClick={dismissNotice}>
          {NOTICE_TEXT[notice]}
        </button>
      )}
    </div>
  )
}

/**
 * Said once per browser, beside the favourite tags, the first time a signed-out reader files a
 * card: the one moment keeping favourites on an account is plainly worth something.
 */
export function LoginOffer({ hidden }: { hidden: boolean }) {
  const offer = useSyncExternalStore(subscribeAccount, readOffer, serverOffer)
  if (!offer) return null
  return (
    <div className={styles.offer} role="status" data-hidden={hidden} inert={hidden}>
      <p className={styles.offerText}>
        先收在这台浏览器里了。
        <br />
        登录知乎，换台设备也在。
      </p>
      <span className={styles.offerActions}>
        <a className={styles.offerLink} href={loginHref()}>
          用知乎登录
        </a>
        <button type="button" className={styles.offerDismiss} onClick={dismissOffer}>
          先不用
        </button>
      </span>
    </div>
  )
}
