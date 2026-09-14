import { Desk } from './components/Desk'
import { pool } from '@/lib/pool'

/**
 * The card table. An unbounded desk with a few clippings on it, the middle one clear
 * and the rest receding — DESIGN.md sections 3 and 4.
 *
 * The list view and favourite tags live inside the desk (DESIGN.md section 11). The flat
 * spread this page used to be stays at /sheet as an internal curation sheet.
 */
export default function Page() {
  return <Desk cards={pool} />
}
