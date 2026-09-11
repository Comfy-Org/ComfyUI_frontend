import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PromptEditor } from '../../types/promptEditor'
import type {
  WorkflowReference,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import type {
  MentionPickerEvent,
  MentionPickerState,
  MentionSection
} from './mentionPickerState'
import { transitionMentionPicker } from './mentionPickerState'
import type { SelectedNode } from './useCanvasSelection'
import { selectedNodeKey } from './useCanvasSelection'

interface MentionPickerOptions {
  draft: () => string
  editor: () => PromptEditor | null
  selectionTags: () => SelectedNode[]
  references: () => WorkflowReference[]
  workflows: () => WorkflowReferenceOption[]
  editableWorkflowId: () => string | undefined
  nodeReferenceDisabledReason: () => string | undefined
  workflowSelecting: () => boolean
  getMentionNodes: () => SelectedNode[]
  selectWorkflowReference: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReference | undefined>
  pickNode: (node: SelectedNode) => void
  selectNodes: () => void
  requestWorkflows: () => void
}

export function useAgentMentionPicker(options: MentionPickerOptions) {
  const { t } = useI18n()
  const graphNodes = ref<SelectedNode[]>([])
  const eligibleWorkflows = computed(() => {
    const selectedIds = new Set(options.references().map(({ id }) => id))
    return options
      .workflows()
      .filter(
        ({ id }) =>
          id === undefined ||
          (id !== options.editableWorkflowId() && !selectedIds.has(id))
      )
  })
  function loadMentionNodes(): void {
    if (options.nodeReferenceDisabledReason()) {
      graphNodes.value = []
      return
    }
    graphNodes.value = options
      .getMentionNodes()
      .toSorted((a, b) => a.title.localeCompare(b.title))
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
      ...eligibleWorkflows.value
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
      (mentionQuery.value === '' ||
        mentionMatches.value.some(
          (match) => match.kind !== 'back' && !isNodeReferenceDisabled(match)
        ))
  )
  const mentionHasResults = computed(
    () => mentionSection.value === 'root' || mentionMatches.value.length > 1
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
    const caret = options.editor()?.selection().start ?? 0
    const text = options.draft()
    const at = text.lastIndexOf('@', caret - 1)
    const atValid =
      at !== -1 && at < caret && (at === 0 || /\s/.test(text[at - 1]))
    if (!atValid) {
      dispatchMention({ type: 'closed' })
      return
    }
    const query = text.slice(at + 1, caret)
    if (query.includes('\n')) {
      dispatchMention({ type: 'closed' })
      return
    }
    if (mention.value.status === 'closed') loadMentionNodes()
    dispatchMention({
      type: 'queryChanged',
      start: at,
      query,
      firstMatchIndex: firstMentionMatchIndex(mentionSection.value, query)
    })
  }

  function isNodeReferenceDisabled(match: MentionMatch): boolean {
    return (
      !!options.nodeReferenceDisabledReason() &&
      (match.kind === 'node' ||
        (match.kind === 'section' && match.id === 'nodes'))
    )
  }

  function onSelectNodes(event: Event): void {
    if (options.nodeReferenceDisabledReason()) {
      event.preventDefault()
      return
    }
    options.selectNodes()
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
    if (match.kind === 'workflow') {
      const insertion = options
        .editor()
        ?.captureInsertion(state.start, state.start + 1 + state.query.length)
      const reference = await options.selectWorkflowReference(match.workflow)
      if (!reference) {
        insertion?.cancel()
        return
      }
      insertion?.insert(reference)
      dispatchMention({ type: 'closed' })
      return
    }
    const draft = options.draft()
    options.pickNode(match.node)
    const current = mention.value
    if (
      options.draft() !== draft ||
      current.status === 'closed' ||
      current.start !== state.start ||
      current.query !== state.query
    )
      return
    const before = draft.slice(0, state.start)
    const end = state.start + 1 + state.query.length
    let after = draft.slice(end)
    if (after.startsWith(' ') && (before === '' || before.endsWith(' ')))
      after = after.slice(1)
    options.editor()?.replaceText(state.start, draft.length - after.length, '')
    dispatchMention({ type: 'closed' })
    options.editor()?.focus()
  }

  function onWorkflowSubmenuOpenChange(open: boolean): void {
    if (open && !options.workflowSelecting()) options.requestWorkflows()
  }

  async function pickWorkflow(
    workflow: WorkflowReferenceOption
  ): Promise<boolean> {
    if (options.workflowSelecting()) return false
    const insertion = options.editor()?.captureInsertion()
    const reference = await options.selectWorkflowReference(workflow)
    if (!reference) {
      insertion?.cancel()
      return false
    }
    insertion?.insert(reference)
    return true
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
    eligibleWorkflows,
    mentionSection,
    mentionActive,
    mentionMatches,
    mentionVisible,
    mentionHasResults,
    graphDupes,
    tagDupes,
    syncMention,
    pickMention,
    pickWorkflow,
    isNodeReferenceDisabled,
    isMentionDisabled,
    onSelectNodes,
    onWorkflowSubmenuOpenChange,
    onComposerKeydown,
    onComposerKeyup,
    close: () => dispatchMention({ type: 'closed' }),
    highlight: (index: number) =>
      dispatchMention({ type: 'highlighted', index })
  }
}
