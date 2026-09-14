#!/usr/bin/env node
/**
 * Fetch raw search responses for the pool.
 *
 * Seeds are question titles, not topic keywords. A topic keyword returns whatever
 * is recent — the 2026-09-06 probe got 47 of 50 items from 2026 that way. A question
 * title returns that question's own history instead, reaching the 2014 answers and
 * the low-vote ones that never surface in a ranked list.
 *
 * Reads ZHIHU_KEY_MAX from the environment. Never hardcode a secret here.
 * Serial with a sleep: error 30001 is rate limiting, separate from the daily quota.
 *
 * Usage: ZHIHU_KEY_MAX=... node scripts/fetch-seeds.mjs [outDir]
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const KEY = process.env.ZHIHU_KEY_MAX
if (!KEY) {
  console.error('ZHIHU_KEY_MAX is not set')
  process.exit(1)
}

const outDir = process.argv[2] ?? path.join(import.meta.dirname, '..', '..', 'pool-raw')

/** Question titles worth having. The bar: does this question's answer need a person in it? */
const seeds = [
  '如何看待 / 评价知乎上的「如何看待 / 评价 X」类问题',
  '「如何看待 X 」或「如何评价 X」是一种糟糕的提问方式吗',
  '读博是一种怎样的体验',
  '为什么有那么多人愿意无偿分享知识',
  '三十岁转行还来得及吗',
  '有哪些你后来才慢慢明白的道理',
  '医生第一次独立主刀是什么体验',
  '你为什么坚持写知乎',
  '有哪些让你瞬间破防的回答',
  '知乎为什么越来越不好玩了',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await mkdir(outDir, { recursive: true })
let ok = 0

for (const [i, query] of seeds.entries()) {
  const name = `seed${String(i + 1).padStart(2, '0')}.json`
  const url = new URL('https://developer.zhihu.com/api/v1/content/zhihu_search')
  url.searchParams.set('Query', query)
  url.searchParams.set('Count', '20')

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
      'Content-Type': 'application/json',
    },
  })
  const body = await res.json()

  if (body.Code !== 0) {
    console.warn(`  ${name}  ${query}  -> Code ${body.Code} ${body.Message}`)
  } else {
    const n = body?.Data?.Items?.length ?? 0
    await writeFile(path.join(outDir, name), JSON.stringify(body, null, 2))
    ok++
    console.log(`  ${name}  ${query}  -> ${n} items`)
  }
  await sleep(2000)
}

console.log(`\n${ok}/${seeds.length} seeds saved to ${outDir}`)
