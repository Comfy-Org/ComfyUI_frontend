<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import Badge from '@comfyorg/design-system/badge/Badge'
import { menuItemClass } from '@comfyorg/design-system/lib/menu/menuStyles'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import type { useAgentMentionPicker } from '@/workbench/extensions/agent/composables/agent/useAgentMentionPicker'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'
import AssetThumbnail from './AssetThumbnail.vue'
import SkillMenuDescription from './SkillMenuDescription.vue'

type MentionMatch = ReturnType<
  typeof useAgentMentionPicker
>['mentionMatches']['value'][number]
const {
  match,
  index,
  active,
  disabled,
  nodeReferenceDisabledReason,
  duplicateNodeTitles,
  describedSkill,
  descriptionId
} = defineProps<{
  match: MentionMatch
  index: number
  active: boolean
  disabled: boolean
  nodeReferenceDisabledReason?: string
  duplicateNodeTitles: Set<string>
  describedSkill?: SkillReferenceMetadata
  descriptionId?: string
}>()
const emit = defineEmits<{
  highlight: []
  pick: []
  descriptionEnter: []
  descriptionLeave: []
  descriptionFocusout: [event: FocusEvent]
  descriptionReleaseFocus: []
  descriptionDismiss: []
}>()
const row = useTemplateRef<HTMLDivElement>('row')
const description = computed(() =>
  active && descriptionId ? describedSkill : undefined
)
const disabledReason = computed(() =>
  match.kind === 'node' || (match.kind === 'section' && match.id === 'nodes')
    ? nodeReferenceDisabledReason
    : undefined
)
const asset = computed(() => (match.kind === 'asset' ? match.asset : undefined))
const icon = computed(() => {
  if (match.kind === 'back') return 'icon-[lucide--chevron-left]'
  if (match.kind !== 'section') return undefined
  return match.id === 'nodes'
    ? 'icon-[comfy--node] size-4'
    : 'icon-[comfy--workflow] size-4'
})
const unsavedWorkflow = computed(
  () => match.kind === 'workflow' && match.workflow.id === undefined
)
const nodeId = computed(() =>
  match.kind === 'node' && duplicateNodeTitles.has(match.node.title)
    ? match.node.id
    : undefined
)
</script>

<template>
  <Tooltip :disabled="!disabledReason">
    <TooltipTrigger as-child>
      <div
        :id="`agent-reference-item-${index}`"
        ref="row"
        :aria-disabled="disabled || undefined"
        :aria-description="disabledReason"
        :aria-describedby="description ? descriptionId : undefined"
        role="menuitem"
        :aria-label="asset || match.kind === 'skill' ? match.label : undefined"
        :data-active="active"
        :class="
          cn(
            menuItemClass,
            'w-full cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
            active && 'bg-accent'
          )
        "
        @mouseenter="emit('highlight')"
        @click="emit('pick')"
      >
        <i v-if="icon" aria-hidden="true" :class="icon" />
        <AssetThumbnail
          v-if="asset"
          :name="asset.name"
          :preview-url="asset.previewUrl"
          :media-kind="asset.mediaKind"
          variant="menu"
          class="size-5 shrink-0"
        />
        <span class="min-w-0 flex-1 truncate">{{ match.label }}</span>
        <SkillMenuDescription
          v-if="description && descriptionId"
          :id="descriptionId"
          :skill="description"
          :anchor="row"
          @enter="emit('descriptionEnter')"
          @leave="emit('descriptionLeave')"
          @focusout="emit('descriptionFocusout', $event)"
          @release-focus="emit('descriptionReleaseFocus')"
          @dismiss="emit('descriptionDismiss')"
        />
        <span v-if="unsavedWorkflow" class="text-muted-foreground">{{
          $t('agent.unsavedWorkflow')
        }}</span>
        <Badge
          v-if="nodeId !== undefined"
          variant="badge"
          class="ml-auto font-mono"
          >{{ ' #' + nodeId }}</Badge
        >
        <i
          v-if="match.kind === 'section'"
          aria-hidden="true"
          class="icon-[lucide--chevron-right]"
        />
      </div>
    </TooltipTrigger>
    <TooltipContent>{{ disabledReason }}</TooltipContent>
  </Tooltip>
</template>
