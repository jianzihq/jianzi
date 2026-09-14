import { Desk } from './components/Desk'
import { pool } from '@/lib/pool'

/**
 * The card table. An unbounded desk with a few clippings on it, the middle one clear
 * and the rest receding — DESIGN.md sections 3 and 4.
 *
 * The flat spread that this page used to be still lives at /sheet, where it is easier
 * to judge a card on its own. DESIGN.md section 11 keeps it as a real second view.
 */
export default function Page() {
  return <Desk cards={pool} />
}
