import { withoutHiddenMarkup } from './models-html-audit'

export function auditExampleGallery(
  html: string,
  exampleCount: number
): string[] {
  const errors: string[] = []
  const live = withoutHiddenMarkup(html)
  if (exampleCount === 0 && live.includes('data-testid="examples-section"'))
    errors.push('renders a gallery with no examples')
  const cards = live.split('data-testid="example-item"').length - 1
  if (cards !== exampleCount)
    errors.push(`renders ${cards} example cards, expected ${exampleCount}`)
  return errors
}
