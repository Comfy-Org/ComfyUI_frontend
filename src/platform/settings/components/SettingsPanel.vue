<template>
  <div v-if="props.settingGroups.length > 0">
    <SettingGroup
      v-for="(group, i) in props.settingGroups"
      :key="group.label"
      :divider="i !== 0"
      :group="group"
    />
  </div>
  <NoResultsPlaceholder
    v-else
    icon="icon-[lucide--search]"
    :title="$t('g.noResultsFound')"
    :message="$t('g.searchFailedMessage')"
  />
</template>

<script setup lang="ts">
import NoResultsPlaceholder from '@comfyorg/design-system/common/NoResultsPlaceholder'
import SettingGroup from '@/platform/settings/components/SettingGroup.vue'
import type { ISettingGroup } from '@comfyorg/settings-core/types'

const props = defineProps<{
  settingGroups: ISettingGroup[]
}>()
</script>
