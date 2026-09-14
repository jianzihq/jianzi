import { NextRequest } from 'next/server'
import { jsonError, sameOrigin } from '@/lib/server/http'
import { addCard, isTagId, knownCard, removeCard } from '@/lib/server/collections-store'
import { readSession, sessionCookieName } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ tag: string; cardId: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!sameOrigin(req)) return jsonError('forbidden', 403)
  const user = readSession(req.cookies.get(sessionCookieName)?.value)
  if (!user) return jsonError('unauthenticated', 401)

  const { tag, cardId: rawId } = await ctx.params
  const cardId = decodeURIComponent(rawId)
  if (!isTagId(tag)) return jsonError('bad_tag', 400)
  if (!knownCard(cardId)) return jsonError('unknown_card', 400)

  const data = await addCard(user.id, tag, cardId)
  if (data === 'unavailable') return jsonError('unavailable', 503)
  return Response.json(data)
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!sameOrigin(req)) return jsonError('forbidden', 403)
  const user = readSession(req.cookies.get(sessionCookieName)?.value)
  if (!user) return jsonError('unauthenticated', 401)

  const { tag, cardId: rawId } = await ctx.params
  const cardId = decodeURIComponent(rawId)
  if (!isTagId(tag)) return jsonError('bad_tag', 400)
  if (!knownCard(cardId)) return jsonError('unknown_card', 400)

  const data = await removeCard(user.id, tag, cardId)
  if (data === 'unavailable') return jsonError('unavailable', 503)
  return Response.json(data)
}
