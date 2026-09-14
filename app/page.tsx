import { Desk } from './components/Desk'
import { EmptyDesk } from './components/EmptyDesk'
import { pool } from '@/lib/pool'

/**
 * The card table. An unbounded desk with a few clippings on it, the middle one clear
 * and the rest receding — DESIGN.md sections 3 and 4.
 *
 * The list view and favourite tags live inside the desk (DESIGN.md section 11). The flat
 * spread this page used to be stays at /sheet as an internal curation sheet.
 *
 * With no cards in the pool the desk would be bare ground, so the page says so instead:
 * DESIGN.md section 8.
 */
export default function Page() {
  return pool.length > 0 ? <Desk cards={pool} /> : <EmptyDesk />
}
