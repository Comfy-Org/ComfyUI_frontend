import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import {
  CUSTOM_NODES,
  DEFAULT_BUILD_NAME,
  DEFAULT_GPU_INDEX,
  GPUS,
  MODELS,
  STEP_MS,
  readLocalBuildPath
} from '@/platform/openOnCloud/localBuildPrototype/mockLocalBuild'
import type { LocalBuildItem } from '@/platform/openOnCloud/localBuildPrototype/mockLocalBuild'
import { openCardDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDialogStore } from '@/stores/dialogStore'
import type { ToastId } from '@/types/toastId'

export type LocalBuildView = 'start' | 'nodes' | 'models' | 'gpu' | 'progress'

export type LocalBuildPhase =
  | 'idle'
  | 'upload'
  | 'build'
  | 'deploy'
  | 'ready'
  | 'failed'
  | 'fixing'

const DIALOG_KEY = 'global-local-build-prototype'
const COMFY_CLOUD_URL = 'https://cloud.comfy.org'

const sumGb = (items: readonly LocalBuildItem[]) =>
  items.reduce((total, item) => total + item.gb, 0)

export const useLocalBuildPrototypeStore = defineStore(
  'localBuildPrototype',
  () => {
    const path = readLocalBuildPath()
    const view = ref<LocalBuildView>('start')
    const phase = ref<LocalBuildPhase>('idle')
    const uploadPercent = ref(0)
    const name = ref('')
    const removed = ref<Record<string, boolean>>({})
    const gpuIndex = ref(DEFAULT_GPU_INDEX)
    const toast = useToast()
    const dialogStore = useDialogStore()
    let timers: ReturnType<typeof setTimeout>[] = []
    let shownToast: ToastId | undefined

    const buildName = computed(() => name.value.trim() || DEFAULT_BUILD_NAME)
    const isRemoved = (item: LocalBuildItem) => !!removed.value[item.name]
    const keptNodes = computed(() =>
      CUSTOM_NODES.filter((item) => !isRemoved(item))
    )
    const keptModels = computed(() => MODELS.filter((item) => !isRemoved(item)))
    const modelsGb = computed(() => sumGb(keptModels.value))
    const buildGb = computed(() => modelsGb.value + sumGb(keptNodes.value))
    const unusedModels = MODELS.filter((item) => item.unused)
    const unusedModelsGb = sumGb(unusedModels)
    const unusedModelsLeft = computed(() =>
      unusedModels.filter((item) => !isRemoved(item))
    )
    const gpu = computed(() => GPUS[gpuIndex.value])
    const isRunning = computed(() =>
      ['upload', 'build', 'deploy'].includes(phase.value)
    )
    const isDialogOpen = computed(() => dialogStore.isDialogOpen(DIALOG_KEY))

    function toggleItem(item: LocalBuildItem) {
      removed.value = { ...removed.value, [item.name]: !isRemoved(item) }
    }

    function toggleUnusedModels() {
      const gone = unusedModelsLeft.value.length > 0
      removed.value = {
        ...removed.value,
        ...Object.fromEntries(unusedModels.map((item) => [item.name, gone]))
      }
    }

    function clearTimers() {
      timers.forEach(clearTimeout)
      timers = []
    }

    function after(ms: number, run: () => void) {
      timers.push(setTimeout(run, ms))
    }

    function replaceToast(show: () => ToastId) {
      if (shownToast) toast.dismiss(shownToast)
      shownToast = show()
    }

    function announce(next: 'ready' | 'failed') {
      if (isDialogOpen.value) {
        if (shownToast) toast.dismiss(shownToast)
        shownToast = undefined
        return
      }
      if (next === 'ready') {
        replaceToast(() =>
          toast.success(
            t('localBuildPrototype.toast.readyTitle', {
              name: buildName.value
            }),
            {
              description: t('localBuildPrototype.progress.readySubtitle'),
              action: {
                label: t('localBuildPrototype.openComfyCloud'),
                onClick: openComfyCloud
              }
            }
          )
        )
        return
      }
      replaceToast(() =>
        toast.error(t('localBuildPrototype.progress.failedTitle'), {
          description: t('localBuildPrototype.toast.failedBody', {
            name: buildName.value
          }),
          action: {
            label: t('localBuildPrototype.toast.showDetails'),
            onClick: () => void openDialog()
          }
        })
      )
    }

    function runBuild(fromStep: 'upload' | 'build') {
      const shouldFail = path === 'failed' || path === 'fixed'
      const failsThisRun = shouldFail && fromStep === 'upload'
      let elapsed = 0
      if (fromStep === 'upload') {
        phase.value = 'upload'
        uploadPercent.value = 0
        const ticks = 20
        for (let tick = 1; tick <= ticks; tick++)
          after((STEP_MS.upload / ticks) * tick, () => {
            uploadPercent.value = Math.round((tick / ticks) * 100)
          })
        elapsed += STEP_MS.upload
        after(elapsed, () => (phase.value = 'build'))
      } else {
        phase.value = 'build'
        uploadPercent.value = 100
      }
      elapsed += STEP_MS.build
      if (failsThisRun) {
        after(elapsed, () => {
          phase.value = 'failed'
          announce('failed')
        })
        return
      }
      after(elapsed, () => (phase.value = 'deploy'))
      elapsed += STEP_MS.deploy
      after(elapsed, () => {
        phase.value = 'ready'
        announce('ready')
      })
    }

    function createBuild() {
      clearTimers()
      view.value = 'progress'
      runBuild('upload')
      after(STEP_MS.autoClose, () => {
        if (view.value === 'progress') closeDialog()
      })
    }

    function cancelBuild() {
      clearTimers()
      phase.value = 'idle'
      uploadPercent.value = 0
      view.value = 'start'
    }

    function fixWithAgent() {
      clearTimers()
      closeDialog()
      phase.value = 'fixing'
      replaceToast(() =>
        toast.info(
          t('localBuildPrototype.toast.fixingTitle', { name: buildName.value }),
          { description: t('localBuildPrototype.toast.fixingBody') }
        )
      )
      after(STEP_MS.agentFix, () => runBuild('build'))
    }

    function openComfyCloud() {
      window.open(COMFY_CLOUD_URL, '_blank', 'noopener')
    }

    async function openDialog() {
      if (phase.value === 'fixing') return
      if (shownToast) toast.dismiss(shownToast)
      shownToast = undefined
      if (phase.value !== 'idle') view.value = 'progress'
      if (isDialogOpen.value) return
      await openCardDialog(
        DIALOG_KEY,
        () =>
          import('@/platform/openOnCloud/localBuildPrototype/LocalBuildDialog.vue'),
        {}
      )
    }

    function closeDialog() {
      dialogStore.closeDialog({ key: DIALOG_KEY })
    }

    return {
      path,
      view,
      phase,
      uploadPercent,
      name,
      buildName,
      gpuIndex,
      gpu,
      keptNodes,
      keptModels,
      modelsGb,
      buildGb,
      unusedModels,
      unusedModelsGb,
      unusedModelsLeft,
      isRunning,
      isRemoved,
      toggleItem,
      toggleUnusedModels,
      createBuild,
      cancelBuild,
      fixWithAgent,
      openComfyCloud,
      openDialog,
      closeDialog
    }
  }
)
