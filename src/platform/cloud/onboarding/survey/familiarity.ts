const APP_MODE_FAMILIARITY = ['new', 'starting']

/**
 * Less-experienced users (just starting out) are steered toward App templates,
 * which are simpler than raw node graphs.
 */
export function prefersAppTemplates(familiarity: unknown): boolean {
  return (
    typeof familiarity === 'string' &&
    APP_MODE_FAMILIARITY.includes(familiarity)
  )
}
