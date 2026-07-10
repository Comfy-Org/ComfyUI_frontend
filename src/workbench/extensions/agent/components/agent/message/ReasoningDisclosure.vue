<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// Open while the reasoning is still streaming so the user sees it live; collapses to a
// one-line summary once the turn moves on. Controlled (not defaultOpen, which reka reads
// only at mount) so it actually collapses when streaming ends; a manual re-open sticks.
const { text, streaming = false } = defineProps<{
  text: string
  streaming?: boolean
}>()

const { t } = useI18n()

const open = ref(streaming)
watch(
  () => streaming,
  (isStreaming) => {
    if (!isStreaming) open.value = false
  }
)
</script>

<template>
  <CollapsibleRoot
    v-model:open="open"
    class="rounded-agent border-agent-border bg-agent-surface border"
  >
    <CollapsibleTrigger
      class="group text-agent-fg-muted hover:text-agent-fg flex w-full items-center gap-1.5 px-3 py-1.5 text-xs transition-colors"
    >
      <span
        class="icon-[lucide--chevron-right] size-3.5 transition-transform group-data-[state=open]:rotate-90"
      />
      {{ t('agent.reasoning') }}
    </CollapsibleTrigger>
    <CollapsibleContent
      class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
    >
      <div
        class="text-agent-fg-muted px-3 pb-2 text-xs/relaxed whitespace-pre-wrap"
      >
        {{ text }}
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
