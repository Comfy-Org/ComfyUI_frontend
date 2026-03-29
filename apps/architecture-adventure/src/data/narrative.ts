import type {
  ChallengeRating,
  NarrativeBridge,
  NarrativeSection,
  NarrativeSentence
} from '@/types'

const sentences: NarrativeSentence[] = [
  {
    challengeId: 'circular-dependency',
    good: 'The circular dependency between Subgraph and LGraph dissolved completely. Composition replaced inheritance, and the flat World made special cases unnecessary.',
    ok: 'A factory injection broke the import cycle, but the classes remain coupled at runtime. The next refactor will revisit this tension.',
    bad: 'The circular dependency was papered over with barrel file reordering. It lurks beneath the surface, waiting for the next import to revive the cycle.'
  },
  {
    challengeId: 'scattered-mutations',
    good: 'All 19 scattered version increments were centralized into a single auditable method. Change tracking became reliable overnight.',
    ok: 'A JavaScript Proxy intercepts version mutations, but the scattered increment sites remain in the code. Debugging has become more opaque.',
    bad: 'The 19 scattered graph._version++ sites were left untouched. Silent data loss continues to haunt the team with every missed increment.'
  },
  {
    challengeId: 'migration-question',
    good: 'A 5-phase incremental migration plan was adopted. Each phase ships independently, and production never breaks during the transition.',
    ok: 'The strangler fig pattern lets new ECS code grow beside the old, but without clear milestones the migration drifts without a timeline.',
    bad: 'A big-bang rewrite was attempted. Feature freeze dragged on for months, morale collapsed, and the old codebase drifted beyond reconciliation.'
  },
  {
    challengeId: 'god-object-dilemma',
    good: 'The god objects are being dismantled incrementally. Position extraction shipped first, then connectivity. Each PR is small and testable.',
    ok: 'A facade wraps the god objects with a cleaner API, but the 9,100-line monolith still lurks behind it. New features still require diving in.',
    bad: 'The heroic rewrite stalled at month three. The team burned out reimplementing edge cases that the god objects handled implicitly.'
  },
  {
    challengeId: 'id-crossroads',
    good: 'Branded entity IDs now catch cross-kind bugs at compile time. Cast helpers at system boundaries keep ergonomics clean.',
    ok: 'Runtime string prefixes catch some ID mix-ups, but parsing overhead spreads everywhere and hot-path checks are occasionally forgotten.',
    bad: 'Plain untyped numbers remain the norm. A LinkId passed to a node lookup caused a silent failure that took two days to debug.'
  },
  {
    challengeId: 'widget-promotion',
    good: 'Widget promotion was unified with the connection system. Adding a typed interface input is all it takes \u2014 no parallel state, no shadow copies.',
    ok: 'A simplified WidgetPromotion component replaced the ViewManager, but promotion remains a concept separate from connections.',
    bad: 'The three-layer promotion system persists. Every promoted widget is a shadow copy reconciled by a diffing layer the ECS must work around.'
  },
  {
    challengeId: 'render-time-mutation',
    good: 'Update and render phases are now fully separated. The render pass is read-only, and draw order no longer affects layout.',
    ok: 'Dirty flags reduced the worst render-time mutation symptoms, but the render pass still has permission to mutate state.',
    bad: 'Render-time mutations continue unchecked. Node positions depend on draw order, and every new node type risks layout-dependent bugs.'
  },
  {
    challengeId: 'collaboration-protocol',
    good: 'Y.js CRDTs back the layout store. Concurrent edits merge automatically, and real-time collaboration is now a reality.',
    ok: 'Collaboration was deferred to focus on other priorities. The cloud product team awaits, but the architecture is ready when the time comes.',
    bad: 'Polling-based sync was implemented. Users experience flickering, lag, and silently lost edits. Support tickets pile up.'
  },
  {
    challengeId: 'mutation-gateway',
    good: 'The command layer is in place: serializable intent flows through systems into the World. Undo/redo, replay, and CRDT sync all work.',
    ok: 'World mutations are logged as serializable operations, but the store and command layer are conflated. Batch operations produce excessive noise.',
    bad: 'Without a command layer, callers mutate the World directly. There is no undo/redo, no replay, and no audit trail.'
  }
]

const sections: NarrativeSection[] = [
  {
    id: 'legacy',
    title: 'The Legacy',
    challengeIds: [
      'circular-dependency',
      'god-object-dilemma',
      'scattered-mutations'
    ],
    introByTone: {
      optimistic:
        'The legacy codebase has been thoroughly understood and its worst patterns addressed.',
      mixed:
        'Some legacy patterns were addressed, while others remain embedded in the architecture.',
      pessimistic:
        'The legacy codebase retains most of its original pain points, resisting transformation.'
    }
  },
  {
    id: 'architecture',
    title: 'The Architecture',
    challengeIds: ['id-crossroads', 'mutation-gateway', 'render-time-mutation'],
    introByTone: {
      optimistic:
        'The new architecture stands on solid foundations \u2014 type-safe, layered, and deterministic.',
      mixed:
        'The architectural vision is partially realized. Some foundations are strong, others compromise.',
      pessimistic:
        'The architectural redesign never fully materialized. Old and new patterns clash at every boundary.'
    }
  },
  {
    id: 'future',
    title: 'The Future',
    challengeIds: [
      'migration-question',
      'collaboration-protocol',
      'widget-promotion'
    ],
    introByTone: {
      optimistic:
        'The path forward is clear. Migration proceeds in phases, collaboration is live, and the ECS world hums with clean data.',
      mixed:
        'The future is promising but uncertain. Some migration paths are clear while others remain open questions.',
      pessimistic:
        'The migration stalls. Technical debt compounds, and the team struggles to chart a path through the complexity.'
    }
  }
]

const bridges: NarrativeBridge[] = [
  {
    fromSectionId: 'legacy',
    toSectionId: 'architecture',
    byTone: {
      optimistic:
        'With the legacy pain points addressed, the team turned to building the new architecture with confidence.',
      mixed:
        'Despite unresolved legacy issues, the team pressed forward with architectural decisions.',
      pessimistic:
        'The unaddressed legacy problems cast a long shadow over every architectural decision that followed.'
    }
  },
  {
    fromSectionId: 'architecture',
    toSectionId: 'future',
    byTone: {
      optimistic:
        'The solid architectural foundations enabled ambitious plans for migration and collaboration.',
      mixed:
        'With a mixed architectural foundation, the team faced the future with cautious optimism.',
      pessimistic:
        'Weak architectural foundations made every forward-looking decision feel like building on sand.'
    }
  }
]

function getSentenceMap(): Map<string, NarrativeSentence> {
  return new Map(sentences.map((s) => [s.challengeId, s]))
}

type Tone = 'optimistic' | 'mixed' | 'pessimistic'

function sectionTone(
  results: Record<string, { rating: ChallengeRating }>,
  challengeIds: string[]
): Tone {
  const ratings = challengeIds.map((id) => results[id]?.rating).filter(Boolean)
  if (ratings.length === 0) return 'mixed'

  const goodCount = ratings.filter((r) => r === 'good').length
  const badCount = ratings.filter((r) => r === 'bad').length

  if (goodCount >= ratings.length * 0.6) return 'optimistic'
  if (badCount >= ratings.length * 0.6) return 'pessimistic'
  return 'mixed'
}

export function buildNarrativeSummary(
  results: Record<string, { rating: ChallengeRating }>
): string {
  const sentenceMap = getSentenceMap()
  const parts: string[] = []

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const tone = sectionTone(results, section.challengeIds)

    parts.push(section.introByTone[tone])

    for (const challengeId of section.challengeIds) {
      const sentence = sentenceMap.get(challengeId)
      const result = results[challengeId]
      if (sentence && result) {
        parts.push(sentence[result.rating])
      }
    }

    if (i < bridges.length) {
      const bridge = bridges[i]
      const nextSection = sections[i + 1]
      const bridgeTone = nextSection
        ? sectionTone(results, nextSection.challengeIds)
        : tone
      parts.push(bridge.byTone[bridgeTone])
    }
  }

  return parts.join(' ')
}

export { bridges, sections, sentences }
