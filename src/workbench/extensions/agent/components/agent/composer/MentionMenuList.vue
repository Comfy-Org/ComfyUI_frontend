<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MentionMatch } from '@/workbench/extensions/agent/composables/agent/useAgentMentionPicker'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'
import MentionMenuItem from './MentionMenuItem.vue'

const {
  matches,
  groupedSkills = false,
  activeIndex,
  isDisabled,
  nodeReferenceDisabledReason,
  duplicateNodeTitles,
  describedSkill,
  descriptionId
} = defineProps<{
  matches: MentionMatch[]
  groupedSkills?: boolean
  activeIndex: number
  isDisabled: (match: MentionMatch) => boolean
  nodeReferenceDisabledReason?: string
  duplicateNodeTitles: Set<string>
  describedSkill?: SkillReferenceMetadata
  descriptionId?: string
}>()
const emit = defineEmits<{
  highlight: [index: number]
  pick: [match: MentionMatch]
  descriptionEnter: []
  descriptionLeave: []
  descriptionFocusout: [event: FocusEvent]
  descriptionReleaseFocus: []
  descriptionDismiss: []
}>()

const { t } = useI18n()
const userGroupId = useId()
const comfyGroupId = useId()

interface IndexedMentionMatch {
  match: MentionMatch
  index: number
}

interface SkillMatchSection {
  id: string
  label: string
  items: IndexedMentionMatch[]
}

const skillSections = computed<SkillMatchSection[]>(() => {
  if (!groupedSkills) return []
  const userItems: IndexedMentionMatch[] = []
  const comfyItems: IndexedMentionMatch[] = []
  for (const [index, match] of matches.entries()) {
    if (match.kind !== 'skill') continue
    if (match.group === 'user') userItems.push({ match, index })
    else comfyItems.push({ match, index })
  }
  const sections: SkillMatchSection[] = []
  if (userItems.length > 0) {
    sections.push({
      id: userGroupId,
      label: t('agent.yourSkills'),
      items: userItems
    })
  }
  if (comfyItems.length > 0) {
    sections.push({
      id: comfyGroupId,
      label: t('agent.comfySkills'),
      items: comfyItems
    })
  }
  return sections
})
</script>

<template>
  <template v-if="groupedSkills">
    <template
      v-for="(section, sectionIndex) in skillSections"
      :key="section.id"
    >
      <div
        v-if="sectionIndex > 0"
        role="separator"
        class="my-1 h-px bg-border/50"
      />
      <div role="group" :aria-labelledby="section.id">
        <div
          :id="section.id"
          class="flex h-6 items-center px-1.5 py-1 text-xs/4 text-muted-foreground"
        >
          {{ section.label }}
        </div>
        <MentionMenuItem
          v-for="entry in section.items"
          :key="`${entry.match.kind}:${entry.match.id}`"
          :match="entry.match"
          :index="entry.index"
          :active="entry.index === activeIndex"
          :disabled="isDisabled(entry.match)"
          :node-reference-disabled-reason
          :duplicate-node-titles
          :described-skill
          :description-id
          @highlight="emit('highlight', entry.index)"
          @pick="emit('pick', entry.match)"
          @description-enter="emit('descriptionEnter')"
          @description-leave="emit('descriptionLeave')"
          @description-focusout="emit('descriptionFocusout', $event)"
          @description-release-focus="emit('descriptionReleaseFocus')"
          @description-dismiss="emit('descriptionDismiss')"
        />
      </div>
    </template>
  </template>
  <template v-else>
    <MentionMenuItem
      v-for="(match, index) in matches"
      :key="`${match.kind}:${match.id}`"
      :match
      :index
      :active="index === activeIndex"
      :disabled="isDisabled(match)"
      :node-reference-disabled-reason
      :duplicate-node-titles
      :described-skill
      :description-id
      @highlight="emit('highlight', index)"
      @pick="emit('pick', match)"
      @description-enter="emit('descriptionEnter')"
      @description-leave="emit('descriptionLeave')"
      @description-focusout="emit('descriptionFocusout', $event)"
      @description-release-focus="emit('descriptionReleaseFocus')"
      @description-dismiss="emit('descriptionDismiss')"
    />
  </template>
</template>
