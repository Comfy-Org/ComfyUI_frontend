import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PromptEditor } from '../../types/promptEditor'
import type { WorkflowReferenceOption } from '../../types/workflowReference'
import type {
  MentionPickerEvent,
  MentionPickerState,
  MentionSection
} from './mentionPickerState'
import { transitionMentionPicker } from './mentionPickerState'
import type { SelectedNode } from './useCanvasSelection'
import { selectedNodeKey } from './useCanvasSelection'
import type { SkillReferenceMetadata } from '../../types/skillReference'

interface MentionPickerOptions {
  draft: () => string
  editor: () => PromptEditor | null
  selectionTags: () => SelectedNode[]
  workflows: () => WorkflowReferenceOption[]
  skills: () => SkillReferenceMetadata[]
  skillsEnabled: () => boolean
  nodeReferenceDisabledReason: () => string | undefined
  workflowSelecting: () => boolean
  getMentionNodes: () => SelectedNode[]
  selectWorkflow: (
    workflow: WorkflowReferenceOption,
    from: number,
    to: number
  ) => Promise<boolean>
  pickNode: (node: SelectedNode) => void
  requestWorkflows: () => void
}

export function useAgentMentionPicker(options: MentionPickerOptions) {
  const { t } = useI18n()
  const graphNodes = ref<SelectedNode[]>([])
  function loadMentionNodes(): void {
    if (options.nodeReferenceDisabledReason()) {
      graphNodes.value = []
      return
    }
    graphNodes.value = [...options.getMentionNodes()].sort((a, b) =>
      a.title.localeCompare(b.title)
    )
  }

  const mention = ref<MentionPickerState>({ status: 'closed' })
  const mentionSection = computed(() =>
    mention.value.status === 'open' ? mention.value.section : 'root'
  )
  const mentionQuery = computed(() =>
    mention.value.status === 'open' ? mention.value.query : null
  )
  const mentionActive = computed(() =>
    mention.value.status === 'open' ? mention.value.activeIndex : 0
  )

  type MentionMatch =
    | { kind: 'section'; id: 'nodes' | 'workflows'; label: string }
    | { kind: 'back'; id: 'back'; label: string }
    | { kind: 'node'; id: string; label: string; node: SelectedNode }
    | {
        kind: 'skill'
        id: string
        label: string
        skill: SkillReferenceMetadata
      }
    | {
        kind: 'workflow'
        id: string
        label: string
        workflow: WorkflowReferenceOption
      }

  const stagedKeys = computed(
    () => new Set(options.selectionTags().map((tag) => selectedNodeKey(tag)))
  )

  function getMentionMatches(
    section: MentionSection,
    query: string
  ): MentionMatch[] {
    const search = query.toLowerCase()
    if (section === 'skills') {
      return options
        .skills()
        .filter(({ name }) => name.toLowerCase().includes(search))
        .map((skill) => ({
          kind: 'skill',
          id: skill.name,
          label: skill.name,
          skill
        }))
    }
    if (section === 'root') {
      const sections: MentionMatch[] = [
        { kind: 'section', id: 'nodes', label: t('agent.nodes') },
        { kind: 'section', id: 'workflows', label: t('agent.workflows') }
      ]
      return sections.filter(({ label }) =>
        label.toLowerCase().includes(search)
      )
    }

    const back: MentionMatch = { kind: 'back', id: 'back', label: t('g.back') }
    if (section === 'nodes') {
      return [
        back,
        ...graphNodes.value
          .filter(
            (node) =>
              !stagedKeys.value.has(selectedNodeKey(node)) &&
              (node.title.toLowerCase().includes(search) ||
                node.id.includes(search))
          )
          .map(
            (node): MentionMatch => ({
              kind: 'node',
              id: selectedNodeKey(node),
              label: node.title,
              node
            })
          )
      ]
    }

    return [
      back,
      ...options
        .workflows()
        .filter(({ name }) => name.toLowerCase().includes(search))
        .map(
          (workflow): MentionMatch => ({
            kind: 'workflow',
            id: workflow.id ?? workflow.tabPath,
            label: workflow.name,
            workflow
          })
        )
    ]
  }

  const mentionMatches = computed(() => {
    const query = mentionQuery.value
    return query === null ? [] : getMentionMatches(mentionSection.value, query)
  })

  const mentionVisible = computed(
    () =>
      mentionQuery.value !== null &&
      (mentionSection.value === 'skills' ||
        mentionQuery.value === '' ||
        mentionMatches.value.some(
          (match) => match.kind !== 'back' && !isNodeReferenceDisabled(match)
        ))
  )
  const mentionHasResults = computed(() =>
    mentionSection.value === 'skills'
      ? mentionMatches.value.length > 0
      : mentionSection.value === 'root' || mentionMatches.value.length > 1
  )

  function duplicatedTitles(nodes: SelectedNode[]): Set<string> {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const node of nodes) {
      if (seen.has(node.title)) dupes.add(node.title)
      else seen.add(node.title)
    }
    return dupes
  }

  const graphDupes = computed(() => duplicatedTitles(graphNodes.value))
  const tagDupes = computed(() => duplicatedTitles(options.selectionTags()))

  watch(
    () => options.selectionTags(),
    (tags) => {
      if (tags.length) loadMentionNodes()
    },
    { immediate: true }
  )

  function dispatchMention(event: MentionPickerEvent): void {
    mention.value = transitionMentionPicker(mention.value, event)
  }

  function firstMentionMatchIndex(
    section: MentionSection,
    query: string
  ): number {
    return getMentionMatches(section, query).findIndex(
      (match) => match.kind !== 'back' && !isNodeReferenceDisabled(match)
    )
  }

  function syncMention(): void {
    const selection = options.editor()?.selection()
    const caret = selection?.start ?? 0
    const text = options.draft()
    const candidate = (['@', '/'] as const)
      .map((trigger) => ({
        trigger,
        start: text.lastIndexOf(trigger, caret - 1)
      }))
      .sort((a, b) => b.start - a.start)
      .find(({ trigger, start }) => {
        if (
          start < 0 ||
          start >= caret ||
          (start > 0 && !/\s/.test(text[start - 1]))
        )
          return false
        const query = text.slice(start + 1, caret)
        return (
          !query.includes('\n') &&
          (trigger === '@' ||
            (options.skillsEnabled() && /^[A-Za-z0-9._-]*$/.test(query)))
        )
      })
    if (!candidate || selection?.end !== caret) {
      dispatchMention({ type: 'closed' })
      return
    }
    const { trigger, start: at } = candidate
    const query = text.slice(at + 1, caret)
    if (
      trigger === '@' &&
      (mention.value.status === 'closed' || mention.value.section === 'skills')
    )
      loadMentionNodes()
    dispatchMention({
      type: 'queryChanged',
      start: at,
      query,
      trigger,
      firstMatchIndex: firstMentionMatchIndex(
        trigger === '/'
          ? 'skills'
          : mentionSection.value === 'skills'
            ? 'root'
            : mentionSection.value,
        query
      )
    })
  }

  watch(
    () => options.skills(),
    (_next, previous) => {
      const state = mention.value
      if (state.status !== 'open' || state.section !== 'skills') return
      const selected = previous
        .filter(({ name }) =>
          name.toLowerCase().includes(state.query.toLowerCase())
        )
        .at(state.activeIndex)
      const index = getMentionMatches('skills', state.query).findIndex(
        (match) => match.id === selected?.name
      )
      dispatchMention({ type: 'highlighted', index: Math.max(0, index) })
    },
    { flush: 'sync' }
  )

  function isNodeReferenceDisabled(match: MentionMatch): boolean {
    return (
      !!options.nodeReferenceDisabledReason() &&
      (match.kind === 'node' ||
        (match.kind === 'section' && match.id === 'nodes'))
    )
  }

  watch(
    () => options.nodeReferenceDisabledReason(),
    (reason) => {
      if (!reason) {
        if (mention.value.status === 'open') loadMentionNodes()
        return
      }
      graphNodes.value = []
      if (
        mention.value.status === 'open' &&
        mention.value.section === 'nodes'
      ) {
        dispatchMention({
          type: 'nodesUnavailable',
          firstMatchIndex: firstMentionMatchIndex('root', mention.value.query)
        })
      }
    },
    { flush: 'sync' }
  )

  watch(
    () => options.skillsEnabled(),
    (enabled) => {
      if (!enabled && mentionSection.value === 'skills')
        dispatchMention({ type: 'closed' })
      else if (enabled) syncMention()
    },
    { flush: 'sync' }
  )

  async function pickMention(match: MentionMatch): Promise<void> {
    const state = mention.value
    if (state.status === 'closed' || isMentionDisabled(match)) return
    if (match.kind === 'section') {
      options
        .editor()
        ?.replaceText(state.start + 1, state.start + 1 + state.query.length, '')
      dispatchMention({ type: 'sectionSelected', section: match.id })
      if (match.id === 'workflows') options.requestWorkflows()
      return
    }
    if (match.kind === 'back') {
      dispatchMention({ type: 'back' })
      return
    }
    if (match.kind === 'skill') {
      options
        .editor()
        ?.selectSkill(
          match.skill,
          state.start,
          state.start + 1 + state.query.length
        )
      dispatchMention({ type: 'closed' })
      return
    }
    if (match.kind === 'workflow') {
      if (
        await options.selectWorkflow(
          match.workflow,
          state.start,
          state.start + 1 + state.query.length
        )
      )
        dispatchMention({ type: 'closed' })
      return
    }
    options
      .editor()
      ?.replaceText(state.start, state.start + 1 + state.query.length, '')
    options.pickNode(match.node)
    dispatchMention({ type: 'closed' })
    options.editor()?.focus()
  }

  function isMentionDisabled(match: MentionMatch): boolean {
    return (
      isNodeReferenceDisabled(match) ||
      (match.kind === 'workflow' && options.workflowSelecting())
    )
  }

  function onComposerKeydown(event: KeyboardEvent): boolean {
    const state = mention.value
    if (
      state.status === 'open' &&
      mentionVisible.value &&
      !event.isComposing &&
      !event.shiftKey
    ) {
      const matches = mentionMatches.value
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        dispatchMention({
          type: 'highlightMoved',
          direction: event.key === 'ArrowDown' ? 1 : -1,
          disabled: matches.map(isMentionDisabled)
        })
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const match =
          state.activeIndex < 0 ? undefined : matches.at(state.activeIndex)
        if (match) void pickMention(match)
        return true
      }
      if (event.key === 'Escape') {
        event.stopPropagation()
        dispatchMention({ type: 'closed' })
        return true
      }
    }
    return false
  }

  const CARET_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End']

  function onComposerKeyup(event: KeyboardEvent): void {
    if (mention.value.status === 'open' && CARET_KEYS.includes(event.key))
      syncMention()
  }

  return {
    mentionSection,
    mentionActive,
    mentionMatches,
    mentionVisible,
    mentionHasResults,
    graphDupes,
    tagDupes,
    syncMention,
    pickMention,
    isNodeReferenceDisabled,
    isMentionDisabled,
    onComposerKeydown,
    onComposerKeyup,
    close: () => dispatchMention({ type: 'closed' }),
    highlight: (index: number) =>
      dispatchMention({ type: 'highlighted', index })
  }
}
