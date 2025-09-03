<template>
  <div class="w-[552px] flex flex-col">
    <ContentDivider :width="1" />
    <div class="px-4 py-6 w-full h-full flex flex-col gap-2">
      <!-- Description -->
      <div v-if="showAfterWhatsNew">
        <p
          class="text-sm leading-4 text-neutral-800 dark-theme:text-white m-0 mb-4"
        >
          {{ $t('manager.conflicts.description') }}
          <br /><br />
          {{ $t('manager.conflicts.info') }}
        </p>
      </div>

      <!-- Import Failed List Wrapper -->
      <div
        v-if="importFailedConflicts.length > 0"
        class="w-full flex flex-col bg-neutral-200 dark-theme:bg-black min-h-8 rounded-lg"
      >
        <div
          class="w-full h-8 flex items-center justify-between gap-2 pl-4"
          @click="toggleImportFailedPanel"
        >
          <div class="flex-1 flex">
            <span
              class="text-xs font-bold text-yellow-600 dark-theme:text-yellow-400 mr-2"
              >{{ importFailedConflicts.length }}</span
            >
            <span
              class="text-xs font-bold text-neutral-600 dark-theme:text-white"
              >{{ $t('manager.conflicts.importFailedExtensions') }}</span
            >
          </div>
          <div>
            <Button
              :icon="
                importFailedExpanded
                  ? 'pi pi-chevron-down text-xs'
                  : 'pi pi-chevron-right text-xs'
              "
              text
              class="text-neutral-600 dark-theme:text-neutral-300 !bg-transparent"
            />
          </div>
        </div>
        <!-- Import failed list -->
        <div
          v-if="importFailedExpanded"
          class="py-2 px-4 flex flex-col gap-2.5 max-h-[142px] overflow-y-auto scrollbar-hide"
        >
          <div
            v-for="(packageName, i) in importFailedConflicts"
            :key="i"
            class="flex items-center justify-between h-6 px-4 flex-shrink-0 conflict-list-item"
          >
            <span class="text-xs text-neutral-600 dark-theme:text-neutral-300">
              {{ packageName }}
            </span>
            <span class="pi pi-info-circle text-sm"></span>
          </div>
        </div>
      </div>
      <!-- Conflict List Wrapper -->
      <div
        class="w-full flex flex-col bg-neutral-200 dark-theme:bg-black min-h-8 rounded-lg"
      >
        <div
          class="w-full h-8 flex items-center justify-between gap-2 pl-4"
          @click="toggleConflictsPanel"
        >
          <div class="flex-1 flex">
            <span
              class="text-xs font-bold text-yellow-600 dark-theme:text-yellow-400 mr-2"
              >{{ allConflictDetails.length }}</span
            >
            <span
              class="text-xs font-bold text-neutral-600 dark-theme:text-white"
              >{{ $t('manager.conflicts.conflicts') }}</span
            >
          </div>
          <div>
            <Button
              :icon="
                conflictsExpanded
                  ? 'pi pi-chevron-down text-xs'
                  : 'pi pi-chevron-right text-xs'
              "
              text
              class="text-neutral-600 dark-theme:text-neutral-300 !bg-transparent"
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
            <span
              class="text-xs text-neutral-600 dark-theme:text-neutral-300"
              >{{ getConflictMessage(conflict, t) }}</span
            >
            <span class="pi pi-info-circle text-sm"></span>
          </div>
        </div>
      </div>
      <!-- Extension List Wrapper -->
      <div
        class="w-full flex flex-col bg-neutral-200 dark-theme:bg-black min-h-8 rounded-lg"
      >
        <div
          class="w-full h-8 flex items-center justify-between gap-2 pl-4"
          @click="toggleExtensionsPanel"
        >
          <div class="flex-1 flex">
            <span
              class="text-xs font-bold text-yellow-600 dark-theme:text-yellow-400 mr-2"
              >{{ conflictData.length }}</span
            >
            <span
              class="text-xs font-bold text-neutral-600 dark-theme:text-white"
              >{{ $t('manager.conflicts.extensionAtRisk') }}</span
            >
          </div>
          <div>
            <Button
              :icon="
                extensionsExpanded
                  ? 'pi pi-chevron-down text-xs'
                  : 'pi pi-chevron-right text-xs'
              "
              text
              class="text-neutral-600 dark-theme:text-neutral-300 !bg-transparent"
            />
          </div>
        </div>
        <!-- Extension list -->
        <div
          v-if="extensionsExpanded"
          class="py-2 px-4 flex flex-col gap-2.5 max-h-[142px] overflow-y-auto scrollbar-hide"
        >
          <div
            v-for="conflictResult in conflictData"
            :key="conflictResult.package_id"
            class="flex items-center justify-between h-6 px-4 flex-shrink-0 conflict-list-item"
          >
            <span class="text-xs text-neutral-600 dark-theme:text-neutral-300">
              {{ conflictResult.package_name }}
            </span>
            <span class="pi pi-info-circle text-sm"></span>
          </div>
        </div>
      </div>
    </div>
    <ContentDivider :width="1" />
  </div>
</template>

<script setup lang="ts">
import { filter, flatMap, map, some } from 'es-toolkit/compat'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import {
  ConflictDetail,
  ConflictDetectionResult
} from '@/types/conflictDetectionTypes'
import { getConflictMessage } from '@/utils/conflictMessageUtil'

const { showAfterWhatsNew = false, conflictedPackages } = defineProps<{
  showAfterWhatsNew?: boolean
  conflictedPackages?: ConflictDetectionResult[]
}>()

const { t } = useI18n()
const { conflictedPackages: globalConflictPackages } = useConflictDetection()

const conflictsExpanded = ref<boolean>(false)
const extensionsExpanded = ref<boolean>(false)
const importFailedExpanded = ref<boolean>(false)

const conflictData = computed(
  () => conflictedPackages || globalConflictPackages.value
)

const allConflictDetails = computed(() => {
  const allConflicts = flatMap(
    conflictData.value,
    (result: ConflictDetectionResult) => result.conflicts
  )
  return filter(
    allConflicts,
    (conflict: ConflictDetail) => conflict.type !== 'import_failed'
  )
})

const packagesWithImportFailed = computed(() => {
  return filter(conflictData.value, (result: ConflictDetectionResult) =>
    some(
      result.conflicts,
      (conflict: ConflictDetail) => conflict.type === 'import_failed'
    )
  )
})

const importFailedConflicts = computed(() => {
  return map(
    packagesWithImportFailed.value,
    (result: ConflictDetectionResult) =>
      result.package_name || result.package_id
  )
})

const toggleImportFailedPanel = () => {
  importFailedExpanded.value = !importFailedExpanded.value
  conflictsExpanded.value = false
  extensionsExpanded.value = false
}

const toggleConflictsPanel = () => {
  conflictsExpanded.value = !conflictsExpanded.value
  extensionsExpanded.value = false
  importFailedExpanded.value = false
}

const toggleExtensionsPanel = () => {
  extensionsExpanded.value = !extensionsExpanded.value
  conflictsExpanded.value = false
  importFailedExpanded.value = false
}
</script>
<style scoped>
.conflict-list-item:hover {
  background-color: rgba(0, 122, 255, 0.2);
}
</style>
