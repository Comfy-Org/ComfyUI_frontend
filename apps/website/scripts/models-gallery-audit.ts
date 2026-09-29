import { textOf, withoutHiddenMarkup } from './models-html-audit'

interface GalleryExample {
  readonly prompt?: string
}

export function auditExampleGallery(
  html: string,
  examples: readonly GalleryExample[]
): string[] {
  const errors: string[] = []
  const live = withoutHiddenMarkup(html)
  if (examples.length === 0 && live.includes('data-testid="examples-section"'))
    errors.push('renders a gallery with no examples')
  const cards = live.split('data-testid="example-item"').length - 1
  if (cards !== examples.length)
    errors.push(`renders ${cards} example cards, expected ${examples.length}`)
  const captions = [
    ...live.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)
  ].map(([, inner]) => textOf(inner))
  const prompts = examples.flatMap(({ prompt }) =>
    prompt === undefined ? [] : [prompt.replace(/\s+/g, ' ').trim()]
  )
  for (const prompt of new Set(prompts)) {
    const expected = prompts.filter((other) => other === prompt).length
    const found = captions.filter((caption) => caption === prompt).length
    if (found !== expected)
      errors.push(
        `captions "${prompt.slice(0, 40)}" ${found} times, expected ${expected}`
      )
  }
  return errors
}
