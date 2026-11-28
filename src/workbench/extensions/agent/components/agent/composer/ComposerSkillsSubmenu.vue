<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuLabel from '@comfyorg/design-system/menu/MenuLabel'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import MenuSub from '@comfyorg/design-system/menu/MenuSub'
import MenuSubContent from '@comfyorg/design-system/menu/MenuSubContent'
import MenuSubTrigger from '@comfyorg/design-system/menu/MenuSubTrigger'
import { SKILL_CATALOG_STATUS_LABELS } from '@/platform/skills/composables/useSkillCatalogStatus'
import type {
  BuiltinSkillCatalogStatus,
  SkillCatalogStatus
} from '@/platform/skills/composables/useSkillCatalogStatus'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'
import ComposerBuiltinSkillsGroup from './ComposerBuiltinSkillsGroup.vue'

const {
  skills,
  status,
  statusMessage,
  comfySkills = [],
  comfyStatus
} = defineProps<{
  skills: SkillReferenceMetadata[]
  status?: SkillCatalogStatus
  statusMessage?: string
  comfySkills?: SkillReferenceMetadata[]
  comfyStatus?: BuiltinSkillCatalogStatus
}>()
const emit = defineEmits<{
  opened: []
  pick: [skill: SkillReferenceMetadata]
  retry: []
  retryComfy: []
  manage: []
}>()
const { t } = useI18n()
const open = ref(false)
const userSkillsLabelId = useId()
const showComfyGroup = computed(
  () => comfySkills.length > 0 || comfyStatus !== undefined
)
watch(open, (isOpen) => {
  if (isOpen) emit('opened')
})
</script>

<template>
  <MenuSub v-model:open="open">
    <MenuSubTrigger>
      <i aria-hidden="true" class="icon-[lucide--book-open-text]" />
      <span class="flex-1 text-left whitespace-nowrap">
        {{ t('agent.skills') }}
      </span>
      <i aria-hidden="true" class="icon-[lucide--chevron-right]" />
    </MenuSubTrigger>
    <MenuSubContent
      :side-offset="4"
      width="compact"
      max-height="compact"
      class="agent-scope"
    >
      <MenuItem @select.prevent="open = false">
        <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
        <span>{{ t('g.back') }}</span>
      </MenuItem>
      <div
        :role="showComfyGroup ? 'group' : undefined"
        :aria-labelledby="showComfyGroup ? userSkillsLabelId : undefined"
        :class="showComfyGroup ? undefined : 'contents'"
      >
        <MenuLabel v-if="showComfyGroup" :id="userSkillsLabelId">
          {{ t('agent.yourSkills') }}
        </MenuLabel>
        <MenuItem
          v-for="skill in skills"
          :key="skill.name"
          :aria-label="skill.name"
          :aria-description="skill.description"
          @select="emit('pick', skill)"
        >
          <i aria-hidden="true" class="icon-[lucide--book-open-text]" />
          <span class="flex max-w-64 min-w-0 flex-col">
            <span class="truncate">{{ skill.name }}</span>
            <span
              v-if="skill.description"
              class="truncate text-xs text-muted-foreground"
              >{{ skill.description }}</span
            >
          </span>
        </MenuItem>
        <div
          v-if="status"
          role="status"
          class="px-2 py-1 text-xs text-muted-foreground"
        >
          {{ statusMessage ?? t(SKILL_CATALOG_STATUS_LABELS[status]) }}
        </div>
        <MenuItem v-if="status === 'failed'" @select.prevent="emit('retry')">
          <i aria-hidden="true" class="icon-[lucide--rotate-cw]" />
          <span>{{ t('g.retry') }}</span>
        </MenuItem>
      </div>
      <template v-if="showComfyGroup">
        <MenuSeparator />
        <ComposerBuiltinSkillsGroup
          :skills="comfySkills"
          :status="comfyStatus"
          @pick="emit('pick', $event)"
          @retry="emit('retryComfy')"
        />
      </template>
      <div
        data-testid="skills-submenu-footer"
        class="sticky -bottom-1 -mx-1 bg-background px-1 pb-1"
      >
        <MenuSeparator />
        <MenuItem @select="emit('manage')">
          <i aria-hidden="true" class="icon-[lucide--settings-2]" />
          <span>{{ t('agent.manageSkills') }}</span>
        </MenuItem>
      </div>
    </MenuSubContent>
  </MenuSub>
</template>
