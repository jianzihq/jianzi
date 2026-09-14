/**
 * Fixed taxonomy. Small and closed on purpose: the stamp needs a fixed colour set,
 * and reverse recommendation needs domains it can compare. Free-form labels break both.
 */
export const DOMAINS = {
  社区: '#a34a35',
  学术: '#3a5a72',
  职业: '#7a6320',
  医学: '#8c3a4a',
  情感: '#8a4a6e',
  处世: '#46685a',
  技术: '#4a4d78',
  人文: '#6d4a30',
} as const

export type Domain = keyof typeof DOMAINS

export const domainInk = (d: string): string =>
  (DOMAINS as Record<string, string>)[d] ?? 'var(--ink-soft)'
