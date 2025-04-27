<template>
  <div class="w-64 mt-2">
    <span class="pl-3 text-muted text-md font-semibold opacity-70">
      {{ $t('manager.selectVersion') }}
    </span>
    <div
      v-if="isLoadingVersions || isQueueing"
      class="text-center text-muted py-4 flex flex-col items-center"
    >
      <ProgressSpinner class="w-8 h-8 mb-2" />
      {{ $t('manager.loadingVersions') }}
    </div>
    <div v-else-if="versionOptions.length === 0" class="py-2">
      <NoResultsPlaceholder
        :title="$t('g.noResultsFound')"
        :message="$t('manager.tryAgainLater')"
        icon="pi pi-exclamation-circle"
        class="p-0"
      />
    </div>
    <Listbox
      v-else
      v-model="selectedVersion"
      option-label="label"
      option-value="value"
      :options="versionOptions"
      :highlight-on-select="false"
      class="my-3 w-full max-h-[50vh] border-none shadow-none"
    >
      <template #option="slotProps">
        <div class="flex justify-between items-center w-full p-1">
          <span>{{ slotProps.option.label }}</span>
          <i
            v-if="selectedVersion === slotProps.option.value"
            class="pi pi-check text-highlight"
          />
        </div>
      </template>
    </Listbox>
    <ContentDivider class="my-2" />
    <div class="flex justify-end gap-2 p-1 px-3">
      <Button
        text
        severity="secondary"
        :label="$t('g.cancel')"
        :disabled="isQueueing"
        @click="emit('cancel')"
      />
      <Button
        severity="secondary"
        :label="$t('g.install')"
        class="py-3 px-4 dark-theme:bg-unset bg-black/80 dark-theme:text-unset text-neutral-100 rounded-lg"
        :disabled="isQueueing"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import ProgressSpinner from 'primevue/progressspinner'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  ManagerChannel,
  ManagerDatabaseSource,
  SelectedVersion
} from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import { isSemVer } from '@/utils/formatUtil'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const emit = defineEmits<{
  cancel: []
  submit: []
}>()

const { t } = useI18n()
const registryService = useComfyRegistryService()
const managerStore = useComfyManagerStore()

const isQueueing = ref(false)

const selectedVersion = ref<string>(SelectedVersion.LATEST)
onMounted(() => {
  const initialVersion = getInitialSelectedVersion() ?? SelectedVersion.LATEST
  selectedVersion.value =
    // Use NIGHTLY when version is a Git hash
    isSemVer(initialVersion) ? initialVersion : SelectedVersion.NIGHTLY
})

const getInitialSelectedVersion = () => {
  if (!nodePack.id) return

  // If unclaimed, set selected version to nightly
  if (nodePack.publisher?.name === 'Unclaimed') return SelectedVersion.NIGHTLY

  // If node pack is installed, set selected version to the installed version
  if (managerStore.isPackInstalled(nodePack.id))
    return managerStore.getInstalledPackVersion(nodePack.id)

  // If node pack is not installed, set selected version to latest
  return nodePack.latest_version?.version
}

const fetchVersions = async () => {
  if (!nodePack?.id) return []
  return (await registryService.getPackVersions(nodePack.id)) || []
}

const versionOptions = ref<
  {
    value: string
    label: string
  }[]
>([])

const isLoadingVersions = ref(false)

const onNodePackChange = async () => {
  isLoadingVersions.value = true

  // Fetch versions from the registry
  const versions = await fetchVersions()
  const availableVersionOptions = versions
    .map((version) => ({
      value: version.version ?? '',
      label: version.version ?? ''
    }))
    .filter((option) => option.value)

  // Add Latest option
  const defaultVersions = [
    {
      value: SelectedVersion.LATEST,
      label: t('manager.latestVersion')
    }
  ]

  // Add Nightly option if there is a non-empty `repository` field
  if (nodePack.repository?.length) {
    defaultVersions.push({
      value: SelectedVersion.NIGHTLY,
      label: t('manager.nightlyVersion')
    })
  }

  versionOptions.value = [...defaultVersions, ...availableVersionOptions]
  isLoadingVersions.value = false
}

whenever(
  () => nodePack,
  () => {
    void onNodePackChange()
  },
  { deep: true, immediate: true }
)

const handleSubmit = async () => {
  isQueueing.value = true
  await managerStore.installPack.call({
    id: nodePack.id,
    repository: nodePack.repository ?? '',
    channel: ManagerChannel.DEFAULT,
    mode: ManagerDatabaseSource.CACHE,
    version: selectedVersion.value,
    selected_version: selectedVersion.value
  })

  isQueueing.value = false
  emit('submit')
}

onUnmounted(() => {
  managerStore.installPack.clear()
})
</script>
