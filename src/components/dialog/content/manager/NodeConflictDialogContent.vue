<template>
  <div class="w-[552px] max-h-[246px]">
    <ContentDivider :width="0.3" />
    <div class="px-4 py-6 w-full h-full flex flex-col gap-2">
      <!-- Description -->
      <!-- <div>
        <p class="text-sm leading-4 text-gray-100 m-0 mb-4">
          {{ $t('manager.conflicts.description') }}
          <br /><br />
          {{ $t('manager.conflicts.info') }}
        </p>
      </div> -->
      <!-- Conflict List Wrapper -->
      <div class="w-full flex flex-col bg-black min-h-8 rounded-lg">
        <div
          class="w-full h-8 flex items-center justify-between gap-2 pl-4"
          @click="toggleConflictsPanel"
        >
          <div class="flex-1 flex">
            <span class="text-xs font-bold text-yellow-400 mr-2">{{
              allConflictDetails.length
            }}</span>
            <span class="text-xs font-bold text-white">{{
              $t('manager.conflicts.conflicts')
            }}</span>
          </div>
          <div>
            <Button
              :icon="
                conflictsExpanded
                  ? 'pi pi-chevron-down text-xs'
                  : 'pi pi-chevron-right text-xs'
              "
              text
              class="text-neutral-300 !bg-transparent"
            />
          </div>
        </div>
        <!-- Conflicts list -->
        <div
          v-if="conflictsExpanded"
          class="py-2 px-4 flex flex-col gap-2.5 max-h-[142px] overflow-y-auto scrollbar-hide"
        >
          <div
            v-for="(conflict, i) in allConflictDetails"
            :key="i"
            class="flex items-center justify-between h-6 px-4 flex-shrink-0 conflict-list-item"
          >
            <span class="text-xs text-neutral-300">{{
              getConflictMessage(conflict)
            }}</span>
            <span class="pi pi-info-circle text-sm"></span>
          </div>
        </div>
      </div>
      <!-- Extension List Wrapper -->
      <div class="w-full flex flex-col bg-black min-h-8 rounded-lg">
        <div
          class="w-full h-8 flex items-center justify-between gap-2 pl-4"
          @click="toggleExtensionsPanel"
        >
          <div class="flex-1 flex">
            <span class="text-xs font-bold text-yellow-400 mr-2">{{
              props.conflicts.length
            }}</span>
            <span class="text-xs font-bold text-white">{{
              $t('manager.conflicts.extensionAtRisk')
            }}</span>
          </div>
          <div>
            <Button
              :icon="
                extensionsExpanded
                  ? 'pi pi-chevron-down text-xs'
                  : 'pi pi-chevron-right text-xs'
              "
              text
              class="text-neutral-300 !bg-transparent"
            />
          </div>
        </div>
        <!-- Extension list -->
        <div
          v-if="extensionsExpanded"
          class="py-2 px-4 flex flex-col gap-2.5 max-h-[142px] overflow-y-auto scrollbar-hide"
        >
          <div
            v-for="conflictResult in props.conflicts"
            :key="conflictResult.package_id"
            class="flex items-center justify-between h-6 px-4 flex-shrink-0 conflict-list-item"
          >
            <span class="text-xs text-neutral-300">
              {{ conflictResult.package_name }}
            </span>
            <span class="pi pi-info-circle text-sm"></span>
          </div>
        </div>
      </div>
    </div>
    <ContentDivider :width="0.3" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import type {
  ConflictDetail,
  ConflictDetectionResult
} from '@/types/conflictDetectionTypes'

interface Props {
  conflicts?: ConflictDetectionResult[]
}

const props = withDefaults(defineProps<Props>(), {
  conflicts: () => []
})

const { t } = useI18n()

const conflictsExpanded = ref<boolean>(false)
const extensionsExpanded = ref<boolean>(false)

const allConflictDetails = computed(() => {
  const details: ConflictDetail[] = []
  props.conflicts.forEach((conflictResult) => {
    conflictResult.conflicts.forEach((conflict) => {
      details.push(conflict)
    })
  })
  return details
})

const toggleConflictsPanel = () => {
  conflictsExpanded.value = !conflictsExpanded.value
  extensionsExpanded.value = false
}

const toggleExtensionsPanel = () => {
  extensionsExpanded.value = !extensionsExpanded.value
  conflictsExpanded.value = false
}

/**
 * Get appropriate conflict message based on conflict type
 */
function getConflictMessage(conflict: ConflictDetail): string {
  const messageKey = `manager.conflicts.conflictMessages.${conflict.type}`

  // For version and compatibility conflicts, use interpolated message
  if (
    conflict.type === 'comfyui_version' ||
    conflict.type === 'frontend_version' ||
    conflict.type === 'python_version' ||
    conflict.type === 'os' ||
    conflict.type === 'accelerator'
  ) {
    return t(messageKey, {
      current: conflict.current_value,
      required: conflict.required_value
    })
  }

  // For banned and security_pending, use simple message
  if (conflict.type === 'banned' || conflict.type === 'security_pending') {
    return t(messageKey)
  }

  // Fallback to showing raw values
  return `${conflict.type}: ${conflict.current_value} → ${conflict.required_value}`
}
</script>
<style scoped>
.conflict-list-item:hover {
  background-color: rgba(0, 122, 255, 0.2);
}
</style>
