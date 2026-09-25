<template>
  <div class="w-80 pt-1">
    <div class="py-2">
      <span class="pl-3 text-base font-semibold text-neutral-500">
        {{ $t('manager.selectVersion') }}
      </span>
    </div>
    <div
      v-if="isBusy"
      class="flex flex-col items-center py-4 text-center text-muted"
    >
      <Spinner class="mb-2 size-8" />
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
    <ListboxRoot
      v-else
      v-model="selectedVersion"
      selection-behavior="replace"
      class="w-full"
    >
      <ListboxContent class="max-h-[50vh] scrollbar-hide overflow-y-auto p-1">
        <ListboxItem
          v-for="option in processedVersionOptions"
          :key="option.value"
          :value="option.value"
          :disabled="option.isDisabled"
          :aria-disabled="option.isDisabled"
          :aria-label="option.label"
          class="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-secondary-background-hover"
        >
          <div class="flex items-center gap-2">
            <div v-if="option.value === 'nightly'" class="w-4"></div>
            <i
              v-else-if="option.hasConflict"
              v-tooltip="{
                value: option.conflictMessage,
                showDelay: 300
              }"
              class="icon-[lucide--triangle-alert] text-warning-background"
              role="img"
              :aria-label="option.conflictMessage"
            />
            <VerifiedIcon v-else :size="20" class="relative right-0.5" />
            <span>{{ option.label }}</span>
            <PackStatusMessage
              v-if="option.isFlagged"
              status-type="NodeVersionStatusFlagged"
              class="shrink-0"
            />
          </div>
          <ListboxItemIndicator as-child>
            <i class="icon-[lucide--check] text-highlight" />
          </ListboxItemIndicator>
        </ListboxItem>
      </ListboxContent>
    </ListboxRoot>
    <p role="status" class="px-3 text-sm text-muted">
      {{ latestUnavailableMessage }}
    </p>
    <ContentDivider class="my-2" />
    <div class="flex justify-end gap-2 px-3 py-1">
      <Button
        variant="muted-textonly"
        class="text-sm"
        :disabled="isQueueing"
        @click="emit('cancel')"
      >
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="secondary"
        class="rounded-lg bg-secondary-background px-4 py-2.5 text-sm text-base-foreground"
        :disabled="isInstallDisabled"
        @click="handleSubmit"
      >
        {{ $t('g.install') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import {
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxRoot
} from 'reka-ui'
import { valid as validSemver } from 'semver'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VerifiedIcon from '@/components/icons/VerifiedIcon.vue'
import Button from '@/components/ui/button/Button.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components } from '@/types/comfyRegistryTypes'
import PackStatusMessage from '@/workbench/extensions/manager/components/manager/PackStatusMessage.vue'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import { getJoinedConflictMessages } from '@/workbench/extensions/manager/utils/conflictMessageUtil'
import {
  getLatestVersion,
  versionStatusFilters
} from '@/workbench/extensions/manager/utils/nodePackVersionUtil'

type ManagerChannel = ManagerComponents['schemas']['ManagerChannel']
type ManagerDatabaseSource =
  ManagerComponents['schemas']['ManagerDatabaseSource']
type SelectedVersion = ManagerComponents['schemas']['SelectedVersion']
type VersionOption = {
  value: string
  label: string
}

// Enum values for runtime use
const SelectedVersionValues = {
  LATEST: 'latest' as SelectedVersion,
  NIGHTLY: 'nightly' as SelectedVersion
}

const ManagerChannelValues: Record<string, ManagerChannel> = {
  DEFAULT: 'default',
  DEV: 'dev'
}

const ManagerDatabaseSourceValues: Record<string, ManagerDatabaseSource> = {
  CACHE: 'cache',
  REMOTE: 'remote',
  LOCAL: 'local'
}

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
const { checkNodeCompatibility } = useConflictDetection()

const isQueueing = ref(false)
const isLoadingVersions = ref(false)
const isBusy = computed(() => isLoadingVersions.value || isQueueing.value)
const selectedVersion = ref<string>(SelectedVersionValues.LATEST)
const isInstallDisabled = computed(
  () =>
    !nodePack.id ||
    isLoadingVersions.value ||
    isQueueing.value ||
    (selectedVersion.value === SelectedVersionValues.LATEST &&
      !latestActiveVersion.value) ||
    managerStore.isPackInstalling(nodePack.id) ||
    isVersionInstalled(selectedVersion.value)
)
onMounted(() => {
  const initialVersion =
    getInitialSelectedVersion() ?? SelectedVersionValues.LATEST
  selectedVersion.value =
    // Use NIGHTLY when version is a Git hash
    validSemver(initialVersion) ||
    initialVersion === SelectedVersionValues.LATEST
      ? initialVersion
      : SelectedVersionValues.NIGHTLY
})

const getInitialSelectedVersion = () => {
  if (!nodePack.id) return

  // If unclaimed, set selected version to nightly
  if (nodePack.publisher?.name === 'Unclaimed')
    return SelectedVersionValues.NIGHTLY

  // If node pack is installed, set selected version to the installed version
  if (managerStore.isPackInstalled(nodePack.id))
    return managerStore.getInstalledPackVersion(nodePack.id)

  // If node pack is not installed, set selected version to latest
  return !nodePack.latest_version && nodePack.repository
    ? SelectedVersionValues.NIGHTLY
    : SelectedVersionValues.LATEST
}

const fetchedVersions = ref<components['schemas']['NodeVersion'][]>([])
const latestActiveVersion = computed(() =>
  getLatestVersion(fetchedVersions.value, versionStatusFilters.active)
)
const latestInstallableVersion = computed(() =>
  getLatestVersion(fetchedVersions.value, versionStatusFilters.installable)
)

const latestUnavailableMessage = computed(() => {
  if (isBusy.value || latestActiveVersion.value) return ''
  if (registryService.error.value) return t('manager.versionLoadFailed')
  return fetchedVersions.value.some(
    (version) =>
      version.version && version.status === 'NodeVersionStatusFlagged'
  )
    ? t('manager.noActiveVersionsFlagged')
    : t('manager.noActiveVersions')
})

const onNodePackChange = async () => {
  isLoadingVersions.value = true
  fetchedVersions.value = nodePack.id
    ? ((await registryService.getPackVersions(nodePack.id)) ?? [])
    : []
  isLoadingVersions.value = false
}

const versionOptions = computed(() => {
  if (!nodePack.id) return []
  const latestVersionNumber = latestActiveVersion.value?.version
  const latestInstallableNumber = latestInstallableVersion.value?.version
  const hasSeparateLatest =
    latestInstallableNumber && latestInstallableNumber !== latestVersionNumber

  const availableVersionOptions = fetchedVersions.value
    .map((version) => ({
      value: version.version ?? '',
      label: version.version ?? ''
    }))
    .filter(
      (option) =>
        option.value &&
        option.value !== latestVersionNumber &&
        option.value !== latestInstallableNumber
    )

  const activeLabel = hasSeparateLatest
    ? t('manager.latestStableVersion')
    : t('manager.latestVersion')
  const latestLabel = latestVersionNumber
    ? `${activeLabel} (${latestVersionNumber})`
    : activeLabel

  const defaultVersions: VersionOption[] = [
    {
      value: SelectedVersionValues.LATEST,
      label: latestLabel
    }
  ]

  if (hasSeparateLatest) {
    defaultVersions.unshift({
      value: latestInstallableNumber,
      label: `${t('manager.latestVersion')} (${latestInstallableNumber})`
    })
  }

  if (nodePack.repository) {
    defaultVersions.push({
      value: SelectedVersionValues.NIGHTLY,
      label: t('manager.nightlyVersion')
    })
  }

  return [...defaultVersions, ...availableVersionOptions]
})

whenever(
  () => nodePack.id,
  (nodePackId, oldNodePackId) => {
    if (nodePackId !== oldNodePackId) {
      void onNodePackChange()
    }
  },
  { deep: true, immediate: true }
)

const handleSubmit = async () => {
  if (!nodePack.id || isInstallDisabled.value) return
  const actualVersion =
    selectedVersion.value === 'latest'
      ? latestActiveVersion.value?.version
      : selectedVersion.value

  if (!actualVersion) return
  isQueueing.value = true

  await managerStore.installPack.call({
    id: nodePack.id,
    repository: nodePack.repository ?? '',
    channel: ManagerChannelValues.DEFAULT,
    mode: ManagerDatabaseSourceValues.CACHE,
    version: actualVersion,
    selected_version: actualVersion
  })

  isQueueing.value = false
  emit('submit')
}

const getVersionData = (version: string) => {
  if (version === 'latest') return latestActiveVersion.value ?? {}
  const versionData = fetchedVersions.value.find((v) => v.version === version)
  if (versionData) return versionData
  return version === nodePack.latest_version?.version
    ? (nodePack.latest_version ?? nodePack)
    : nodePack
}
// Main function to get version compatibility info
const getVersionCompatibility = (version: string) => {
  const versionData = getVersionData(version)
  const compatibility = checkNodeCompatibility(versionData)
  const conflictMessage = compatibility.hasConflict
    ? getJoinedConflictMessages(compatibility.conflicts, t)
    : ''
  return {
    hasConflict: compatibility.hasConflict,
    conflictMessage
  }
}
const isVersionInstalled = (version: string) => {
  const installed = nodePack.id
    ? managerStore.getInstalledPackVersion(nodePack.id)
    : undefined
  if (!installed) return false
  if (version === 'latest')
    return installed === latestActiveVersion.value?.version
  return version === installed
}

const processedVersionOptions = computed(() => {
  return versionOptions.value.map((option) => {
    const compatibility = getVersionCompatibility(option.value)
    return {
      ...option,
      isFlagged:
        option.value !== 'latest' &&
        option.value !== 'nightly' &&
        getVersionData(option.value).status === 'NodeVersionStatusFlagged',
      hasConflict: compatibility.hasConflict,
      conflictMessage: compatibility.conflictMessage,
      isDisabled:
        isVersionInstalled(option.value) ||
        (option.value === SelectedVersionValues.LATEST &&
          !latestActiveVersion.value)
    }
  })
})
</script>
