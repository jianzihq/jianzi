import { NextRequest } from 'next/server'
import { jsonError, sameOrigin } from '@/lib/server/http'
import { parseLocalCollections, saveMerged } from '@/lib/server/collections-store'
import { readSession, sessionCookieName } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

const MAX_BODY = 64 * 1024

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError('forbidden', 403)
  const user = readSession(req.cookies.get(sessionCookieName)?.value)
  if (!user) return jsonError('unauthenticated', 401)

  const length = Number(req.headers.get('content-length') ?? '0')
  if (length > MAX_BODY) return jsonError('too_large', 400)

  const text = await req.text()
  if (text.length > MAX_BODY) return jsonError('too_large', 400)

  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      return jsonError('bad_json', 400)
    }
  }

  const local = parseLocalCollections(body)
  const data = await saveMerged(user.id, local)
  if (data === 'unavailable') return jsonError('unavailable', 503)
  return Response.json(data)
}
