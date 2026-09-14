/**
 * ContentText from the open platform is a plain-text opening. Paragraphs are marked
 * with `\n`. It is not Markdown and not HTML (the documented `<em>` highlights have
 * never appeared in the pool).
 */
export function paragraphs(text: string): string[] {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
}
