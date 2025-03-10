<template>
  <div class="w-64 mt-2">
    <span class="pl-3 text-muted text-md font-semibold opacity-70">
      {{ $t('manager.selectVersion') }}
    </span>
    <div
      v-if="isLoading"
      class="text-center text-muted py-4 flex flex-col items-center"
    >
      <ProgressSpinner class="w-8 h-8 mb-2" />
      {{ $t('manager.loadingVersions') }}
    </div>
    <div v-else-if="allVersionOptions.length === 0" class="py-2">
      <NoResultsPlaceholder
        :title="$t('g.noResultsFound')"
        :message="$t('manager.tryAgainLater')"
        icon="pi pi-exclamation-circle"
        class="p-0"
      />
    </div>
    <Listbox
      v-else
      v-model="currentSelection"
      optionLabel="label"
      optionValue="value"
      :options="allVersionOptions"
      :highlightOnSelect="false"
      class="my-3 w-full max-h-[50vh] border-none"
    >
      <template #option="slotProps">
        <div class="flex justify-between items-center w-full p-1">
          <span>{{ slotProps.option.label }}</span>
          <i
            v-if="currentSelection === slotProps.option.value"
            class="pi pi-check text-highlight"
          ></i>
        </div>
      </template>
    </Listbox>
    <ContentDivider class="my-2" />
    <div class="flex justify-end gap-2 p-1 px-3">
      <Button
        text
        severity="secondary"
        :label="$t('g.cancel')"
        @click="cancel"
      />
      <Button
        severity="secondary"
        :label="$t('g.apply')"
        @click="apply"
        :pt="{
          root: {
            class:
              'py-3 px-4 dark-theme:bg-unset bg-black/80 dark-theme:text-unset text-neutral-100 rounded-lg'
          }
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { SelectedVersion } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const { selectedVersion, nodePack } = defineProps<{
  selectedVersion: string
  nodePack?: components['schemas']['Node']
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'apply', version: string): void
}>()

const { t } = useI18n()
const registryService = useComfyRegistryService()

const currentSelection = ref<string>(selectedVersion)

const fetchVersions = async () => {
  if (!nodePack?.id) return []
  return registryService.getPackVersions(nodePack.id) || []
}

const { state: versions, isLoading } = useAsyncState(fetchVersions, [], {
  immediate: true
})

const specialOptions = computed(() => [
  {
    value: SelectedVersion.NIGHTLY,
    label: t('manager.nightlyVersion')
  },
  {
    value: SelectedVersion.LATEST,
    label: t('manager.latestVersion')
  }
])

const versionOptions = computed(() =>
  versions.value.map((version) => ({
    value: version.version,
    label: version.version
  }))
)

const allVersionOptions = computed(() => [
  ...specialOptions.value,
  ...versionOptions.value
])

const cancel = () => {
  emit('cancel')
}

const apply = () => {
  emit('apply', currentSelection.value ?? SelectedVersion.LATEST)
}

watch(
  () => nodePack?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      fetchVersions()
    }
  }
)
</script>
