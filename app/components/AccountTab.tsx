import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  dismissNotice,
  loginHref,
  readAccount,
  readNotice,
  serverAccount,
  serverNotice,
  signOut,
  startAccount,
  subscribeAccount,
} from '@/lib/account'
import styles from './AccountTab.module.css'

const NOTICE_TEXT = {
  'login-failed': '登录没有成功，可以再试一次',
  'sync-failed': '收藏暂时没能同步，先留在这台浏览器里',
} as const

/**
 * A paper tab hanging from the top edge of the desk, the third edge to carry one: the Zhihu
 * login, and once signed in, the reader's own name. Favourite tags follow the account from
 * then on. It steps away while a card is open, like the rails. docs/backend-requirements.md §4.4.
 */
export function AccountTab({ hidden }: { hidden: boolean }) {
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
    <div ref={box} className={styles.account} data-hidden={hidden} inert={hidden}>
      {account.status === 'anonymous' && (
        <a className={styles.tab} data-invite="" href={loginHref()} title="登录后，收藏跟着知乎账号走">
          用知乎登录
        </a>
      )}

      {account.status === 'signed-in' && (
        <button
          type="button"
          className={styles.tab}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
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
