<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import MenuGroup from '@comfyorg/design-system/menu/MenuGroup'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuLabel from '@comfyorg/design-system/menu/MenuLabel'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { BUILTIN_SKILL_CATALOG_STATUS_LABELS } from '@/platform/skills/composables/useSkillCatalogStatus'
import type { BuiltinSkillCatalogStatus } from '@/platform/skills/composables/useSkillCatalogStatus'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'

const { skills, status } = defineProps<{
  skills: SkillReferenceMetadata[]
  status?: BuiltinSkillCatalogStatus
}>()
const emit = defineEmits<{
  pick: [skill: SkillReferenceMetadata]
  retry: []
}>()
const { t } = useI18n()
const labelId = useId()
</script>

<template>
  <MenuGroup :aria-labelledby="labelId">
    <MenuLabel :id="labelId">
      {{ t('agent.comfySkills') }}
    </MenuLabel>
    <Tooltip
      v-for="skill in skills"
      :key="skill.name"
      :disabled="!skill.description"
    >
      <TooltipTrigger as-child>
        <MenuItem
          :aria-label="skill.name"
          :aria-description="skill.description"
          @select="emit('pick', skill)"
        >
          <i aria-hidden="true" class="icon-[lucide--book-open-text]" />
          <span class="max-w-64 min-w-0 truncate">{{ skill.name }}</span>
        </MenuItem>
      </TooltipTrigger>
      <TooltipContent side="right">
        {{ skill.description }}
      </TooltipContent>
    </Tooltip>
    <div
      v-if="status"
      role="status"
      class="px-2 py-1 text-xs text-muted-foreground"
    >
      {{ t(BUILTIN_SKILL_CATALOG_STATUS_LABELS[status]) }}
    </div>
    <MenuItem v-if="status === 'failed'" @select.prevent="emit('retry')">
      <i aria-hidden="true" class="icon-[lucide--rotate-cw]" />
      <span>{{ t('g.retry') }}</span>
    </MenuItem>
  </MenuGroup>
</template>
