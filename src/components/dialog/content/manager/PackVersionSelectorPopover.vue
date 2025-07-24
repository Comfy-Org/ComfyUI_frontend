<template>
  <div class="w-64 mt-2">
    <span class="pl-3 text-muted text-md font-semibold text-neutral-500">
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
      class="my-3 w-full max-h-[50vh] border-none shadow-none rounded-md"
    >
      <template #option="slotProps">
        <div class="flex justify-between items-center w-full p-1">
          <div class="flex items-center gap-2">
            <!-- Show no icon for nightly versions since compatibility is uncertain -->
            <template v-if="slotProps.option.value === 'nightly'">
              <div class="w-4"></div>
              <!-- Empty space to maintain alignment -->
            </template>
            <template v-else>
              <i
                v-if="
                  getVersionCompatibility(slotProps.option.value).hasConflict
                "
                v-tooltip="{
                  value: getVersionCompatibility(slotProps.option.value)
                    .conflictMessage,
                  showDelay: 300
                }"
                class="pi pi-exclamation-triangle text-yellow-500"
              />
              <VerifiedIcon v-else :size="16" />
            </template>
            <span>{{ slotProps.option.label }}</span>
          </div>
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
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VerifiedIcon from '@/components/icons/VerifiedIcon.vue'
import { useConflictDetection } from '@/composables/useConflictDetection'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'
import { components as ManagerComponents } from '@/types/generatedManagerTypes'
import { getJoinedConflictMessages } from '@/utils/conflictMessageUtil'
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
const { checkVersionCompatibility } = useConflictDetection()

const isQueueing = ref(false)

const selectedVersion = ref<string>('latest')
onMounted(() => {
  const initialVersion = getInitialSelectedVersion() ?? 'latest'
  selectedVersion.value =
    // Use NIGHTLY when version is a Git hash
    isSemVer(initialVersion) ? initialVersion : 'nightly'
})

const getInitialSelectedVersion = () => {
  if (!nodePack.id) return

  // If unclaimed, set selected version to nightly
  if (nodePack.publisher?.name === 'Unclaimed')
    return 'nightly' as ManagerComponents['schemas']['SelectedVersion']

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

// Store fetched versions with their full data
const fetchedVersions = ref<components['schemas']['NodeVersion'][]>([])

const isLoadingVersions = ref(false)

const onNodePackChange = async () => {
  isLoadingVersions.value = true

  // Fetch versions from the registry
  const versions = await fetchVersions()
  fetchedVersions.value = versions

  // Get latest version number to exclude from the list
  const latestVersionNumber = nodePack.latest_version?.version

  const availableVersionOptions = versions
    .map((version) => ({
      value: version.version ?? '',
      label: version.version ?? ''
    }))
    .filter((option) => option.value && option.value !== latestVersionNumber) // Exclude latest version from the list

  // Add Latest option with actual version number
  const latestLabel = latestVersionNumber
    ? `${t('manager.latestVersion')} (${latestVersionNumber})`
    : t('manager.latestVersion')

  const defaultVersions = [
    {
      value: 'latest' as ManagerComponents['schemas']['SelectedVersion'],
      label: latestLabel
    }
  ]

  // Add Nightly option if there is a non-empty `repository` field
  if (nodePack.repository?.length) {
    defaultVersions.push({
      value: 'nightly' as ManagerComponents['schemas']['SelectedVersion'],
      label: t('manager.nightlyVersion') // Keep as just "nightly" - no version number
    })
  }

  versionOptions.value = [...defaultVersions, ...availableVersionOptions]
  isLoadingVersions.value = false
}

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
  isQueueing.value = true
  if (!nodePack.id) {
    throw new Error('Node ID is required for installation')
  }

  // Convert 'latest' to actual version number for installation
  const actualVersion =
    selectedVersion.value === 'latest'
      ? nodePack.latest_version?.version ?? 'latest'
      : selectedVersion.value

  await managerStore.installPack.call({
    id: nodePack.id,
    version: actualVersion,
    repository: nodePack.repository ?? '',
    channel: 'default' as ManagerComponents['schemas']['ManagerChannel'],
    mode: 'cache' as ManagerComponents['schemas']['ManagerDatabaseSource'],
    selected_version: actualVersion
  })

  isQueueing.value = false
  emit('submit')
}

// Function to get version data (either from nodePack or fetchedVersions)
const getVersionData = (version: string) => {
  // Use latest_version data for both "latest" and the actual latest version number
  const latestVersionNumber = nodePack.latest_version?.version
  const useLatestVersionData =
    version === 'latest' || version === latestVersionNumber

  if (useLatestVersionData) {
    // For "latest" and the actual latest version number, use consistent data from latest_version
    const latestVersionData = nodePack.latest_version
    return {
      supported_os: latestVersionData?.supported_os ?? nodePack.supported_os,
      supported_accelerators:
        latestVersionData?.supported_accelerators ??
        nodePack.supported_accelerators,
      supported_comfyui_version:
        latestVersionData?.supported_comfyui_version ??
        nodePack.supported_comfyui_version,
      supported_comfyui_frontend_version:
        latestVersionData?.supported_comfyui_frontend_version ??
        nodePack.supported_comfyui_frontend_version,
      supported_python_version:
        (latestVersionData && 'supported_python_version' in latestVersionData
          ? latestVersionData.supported_python_version as string | undefined
          : undefined) ??
        ('supported_python_version' in nodePack
          ? nodePack.supported_python_version as string | undefined
          : undefined),
      is_banned:
        (latestVersionData && 'is_banned' in latestVersionData
          ? latestVersionData.is_banned as boolean | undefined
          : undefined) ?? ('is_banned' in nodePack ? nodePack.is_banned as boolean | undefined : false),
      has_registry_data:
        (latestVersionData && 'has_registry_data' in latestVersionData
          ? latestVersionData.has_registry_data as boolean | undefined
          : undefined) ??
        ('has_registry_data' in nodePack ? nodePack.has_registry_data as boolean | undefined : false)
    }
  }

  if (version === 'nightly') {
    // For nightly, we can't determine exact compatibility since it's dynamic Git HEAD
    // But we can assume it's generally compatible (nightly = latest development)
    // Use nodePack data as fallback, but nightly is typically more permissive
    return {
      supported_os: nodePack.supported_os || [], // If no OS restrictions, assume all supported
      supported_accelerators: nodePack.supported_accelerators || [], // If no accelerator restrictions, assume all supported
      supported_comfyui_version: nodePack.supported_comfyui_version, // Use latest known requirement
      supported_comfyui_frontend_version:
        nodePack.supported_comfyui_frontend_version, // Use latest known requirement
      supported_python_version:
        'supported_python_version' in nodePack
          ? nodePack.supported_python_version as string | undefined
          : undefined,
      is_banned: false, // Nightly versions from repositories are typically not banned
      has_registry_data: false // Nightly doesn't come from registry
    }
  }

  // For specific versions, find in fetched versions
  const versionData = fetchedVersions.value.find((v) => v.version === version)
  if (versionData) {
    return {
      supported_os: versionData.supported_os,
      supported_accelerators: versionData.supported_accelerators,
      supported_comfyui_version: versionData.supported_comfyui_version,
      supported_comfyui_frontend_version:
        versionData.supported_comfyui_frontend_version,
      supported_python_version:
        'supported_python_version' in versionData
          ? versionData.supported_python_version as string | undefined
          : undefined,
      is_banned: 'is_banned' in versionData ? versionData.is_banned as boolean | undefined : false,
      has_registry_data:
        'has_registry_data' in versionData
          ? versionData.has_registry_data as boolean | undefined
          : false
    }
  }

  // Fallback to nodePack data
  return {
    supported_os: nodePack.supported_os,
    supported_accelerators: nodePack.supported_accelerators,
    supported_comfyui_version: nodePack.supported_comfyui_version,
    supported_comfyui_frontend_version:
      nodePack.supported_comfyui_frontend_version,
    supported_python_version:
      'supported_python_version' in nodePack
        ? nodePack.supported_python_version as string | undefined
        : undefined,
    is_banned: 'is_banned' in nodePack ? nodePack.is_banned as boolean | undefined : false,
    has_registry_data:
      'has_registry_data' in nodePack ? nodePack.has_registry_data as boolean | undefined : false
  }
}

// Function to check version compatibility using centralized logic
const checkVersionCompatibilityLocal = (
  versionData: ReturnType<typeof getVersionData>
) => {
  return checkVersionCompatibility(versionData)
}

// Main function to get version compatibility info
const getVersionCompatibility = (version: string) => {
  const versionData = getVersionData(version)
  const compatibility = checkVersionCompatibilityLocal(versionData)

  const conflictMessage = compatibility.hasConflict
    ? getJoinedConflictMessages(compatibility.conflicts, t)
    : ''

  return {
    hasConflict: compatibility.hasConflict,
    conflictMessage
  }
}
</script>
