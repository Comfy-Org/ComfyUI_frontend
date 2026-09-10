import ArchitectureDiagram from './ArchitectureDiagram.astro'
import FeedbackLoopDiagram from './FeedbackLoopDiagram.astro'
import StampDiagram from './StampDiagram.astro'
import TwoDoorsDiagram from './TwoDoorsDiagram.astro'

// Keyed by the `heroDiagram` frontmatter field (see engineering-blog.schema.ts)
// so the listing page and the post body render the same diagram from one
// source of truth instead of a slug-keyed lookup maintained separately.
export const diagramRegistry = {
  architecture: ArchitectureDiagram,
  stamp: StampDiagram,
  'feedback-loop': FeedbackLoopDiagram,
  'two-doors': TwoDoorsDiagram
} as const
