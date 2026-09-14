import { NextRequest } from 'next/server'
import { jsonError } from '@/lib/server/http'
import { readCollections } from '@/lib/server/collections-store'
import { readSession, sessionCookieName } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = readSession(req.cookies.get(sessionCookieName)?.value)
  if (!user) return jsonError('unauthenticated', 401)
  const data = await readCollections(user.id)
  if (data === 'unavailable') return jsonError('unavailable', 503)
  return Response.json(data)
}
