<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MentionSection } from '../../../composables/agent/mentionPickerState'
import MentionMenuItem from './MentionMenuItem.vue'
import type { MentionMatch } from './mentionMenuTypes'

const {
  matches,
  section,
  active,
  hasResults,
  nodeReferenceDisabledReason,
  graphDupes,
  duplicateIdClass
} = defineProps<{
  matches: MentionMatch[]
  section: MentionSection
  active: number
  hasResults: boolean
  nodeReferenceDisabledReason?: string
  graphDupes: Set<string>
  duplicateIdClass: string
  isNodeReferenceDisabled: (match: MentionMatch) => boolean
  isMentionDisabled: (match: MentionMatch) => boolean
}>()
const emit = defineEmits<{
  highlight: [index: number]
  pick: [match: MentionMatch]
}>()
const { t } = useI18n()
const menu = useTemplateRef<HTMLDivElement>('menu')

watch(
  () => active,
  async () => {
    await nextTick()
    menu.value
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest' })
  }
)
</script>

<template>
  <div
    id="agent-reference-menu"
    ref="menu"
    data-testid="agent-reference-menu"
    role="menu"
    :aria-label="t('agent.addToPrompt')"
    class="absolute inset-x-0 bottom-full z-1100 -mb-8.75 max-h-64 overflow-y-auto rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-md"
    @mousedown.prevent
  >
    <div
      v-if="section === 'root'"
      class="flex h-6 items-center px-1.5 py-1 text-xs/4 text-muted-foreground"
    >
      {{ t('agent.reference') }}
    </div>
    <MentionMenuItem
      v-for="(match, index) in matches"
      :key="`${match.kind}:${match.id}`"
      :match
      :index
      :active="index === active"
      :node-reference-disabled-reason
      :graph-dupes
      :duplicate-id-class
      :is-node-reference-disabled
      :is-mention-disabled
      @highlight="emit('highlight', index)"
      @pick="emit('pick', match)"
    />
    <div
      v-if="!hasResults"
      role="status"
      class="px-2 py-1 text-xs text-muted-foreground"
    >
      {{
        section === 'workflows'
          ? t('agent.noWorkflowsToReference')
          : t('agent.noNodesToReference')
      }}
    </div>
  </div>
</template>
