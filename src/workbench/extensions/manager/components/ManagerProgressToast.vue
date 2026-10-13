<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useScroll, whenever } from '@vueuse/core'
import type { ComponentPublicInstance } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import DotSpinner from '@/components/common/DotSpinner.vue'
import ToastPanel from '@/components/ui/toast/ToastPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import { useApplyChanges } from '@/workbench/extensions/manager/composables/useApplyChanges'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

const { t } = useI18n()
const comfyManagerStore = useComfyManagerStore()
const { isRestarting, isRestartCompleted, applyChanges } = useApplyChanges()

const isExpanded = ref(false)
const activeTab = ref('installation')

const tabs = computed(() => [
  {
    value: 'installation',
    label: t('manager.installationQueue'),
    logs: comfyManagerStore.succeededTasksLogs
  },
  {
    value: 'failed',
    label: t('manager.failed', {
      count: comfyManagerStore.failedTasksIds.length
    }),
    logs: comfyManagerStore.failedTasksLogs
  }
])
const activeTabData = computed(
  () => tabs.value.find((tab) => tab.value === activeTab.value) ?? tabs.value[0]
)

const visible = computed(() => comfyManagerStore.taskLogs.length > 0)

const isInProgress = computed(
  () => comfyManagerStore.isProcessingTasks || isRestarting.value
)
const hasSuccessfulTasks = computed(
  () => comfyManagerStore.succeededTasksIds.length > 0
)

const completedTasksCount = computed(() => {
  return (
    comfyManagerStore.succeededTasksIds.length +
    comfyManagerStore.failedTasksIds.length
  )
})

const totalTasksCount = computed(() => {
  const completedTasks = Object.keys(comfyManagerStore.taskHistory).length
  const taskQueue = comfyManagerStore.taskQueue
  const queuedTasks = taskQueue
    ? (taskQueue.running_queue?.length || 0) +
      (taskQueue.pending_queue?.length || 0)
    : 0
  return completedTasks + queuedTasks
})

const currentTaskName = computed(() => {
  if (isRestarting.value) {
    return t('manager.restartingBackend')
  }
  if (isRestartCompleted.value) {
    return t('manager.extensionsSuccessfullyInstalled')
  }
  if (!comfyManagerStore.taskLogs.length)
    return t('manager.installingDependencies')
  const task = comfyManagerStore.taskLogs.at(-1)
  return task?.taskName ?? t('manager.installingDependencies')
})

const announcement = computed(() => {
  if (comfyManagerStore.queueError && isInProgress.value)
    return t('manager.queueWaitingToContinue')
  if (isRestarting.value || isRestartCompleted.value)
    return currentTaskName.value
  if (isInProgress.value) return t('manager.installingDependencies')
  if (hasSuccessfulTasks.value) return t('manager.restartToApplyChanges')
  if (comfyManagerStore.failedTasksIds.length) return t('g.failed')
  return t('g.completed')
})

const sectionsContainerRef = ref<HTMLElement | null>(null)
const { y: scrollY } = useScroll(sectionsContainerRef, {
  eventListenerOptions: { passive: true }
})

const latestLogContainerRef = ref<HTMLElement | null>(null)
const isUserScrolling = ref(false)
const latestTaskLogLines = computed(
  () =>
    tabs.value.find((tab) => tab.value === activeTab.value)?.logs.at(-1)?.logs
)

function setLatestLogContainer(el: Element | ComponentPublicInstance | null) {
  latestLogContainerRef.value = el instanceof HTMLElement ? el : null
}

function isAtBottom(el: HTMLElement | null) {
  if (!el) return false
  const threshold = 20
  return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < threshold
}

function scrollLatestLogToBottom() {
  if (!latestLogContainerRef.value || isUserScrolling.value) return
  latestLogContainerRef.value.scrollTop =
    latestLogContainerRef.value.scrollHeight
}

function scrollContentToBottom() {
  scrollY.value = sectionsContainerRef.value?.scrollHeight ?? 0
}

function resetUserScrolling() {
  isUserScrolling.value = false
}

function handleScroll(e: Event) {
  if (!(e.target instanceof HTMLElement)) return
  const target = e.target
  if (target !== latestLogContainerRef.value) return
  isUserScrolling.value = !isAtBottom(target)
}

function onLogsAdded() {
  if (isUserScrolling.value) return
  scrollLatestLogToBottom()
}

whenever(latestTaskLogLines, onLogsAdded, { flush: 'post', deep: true })
whenever(
  () => isExpanded.value,
  () => {
    scrollContentToBottom()
    scrollLatestLogToBottom()
  },
  { flush: 'post' }
)
whenever(() => !isExpanded.value, resetUserScrolling)

function closeToast() {
  comfyManagerStore.resetTaskState()
  isRestartCompleted.value = false
  isExpanded.value = false
}

async function handleRestart() {
  try {
    await applyChanges(closeToast)
  } catch (err) {
    console.error('[ManagerProgressToast] Restart failed:', err)
  }
}

onMounted(() => {
  scrollContentToBottom()
})

onBeforeUnmount(() => {
  isExpanded.value = false
})
</script>

<template>
  <ToastPanel v-model:expanded="isExpanded" :visible :announcement>
    <template #default>
      <Tabs
        v-if="isExpanded"
        v-model="activeTab"
        class="gap-0"
        orientation="horizontal"
      >
        <div class="flex items-center px-4 py-2">
          <TabsList variant="flush" class="flex w-full">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              variant="flush"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent :value="activeTab" class="mt-0">
          <div
            ref="sectionsContainerRef"
            role="region"
            :aria-label="activeTabData.label"
            class="scroll-container max-h-[450px] overflow-y-auto px-6 py-4"
            :style="{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
            }"
          >
            <details
              v-for="(log, index) in activeTabData.logs"
              :key="log.taskId"
              open
              class="group/log mt-2 rounded-lg border border-interface-stroke bg-interface-panel-surface shadow-interface"
            >
              <summary
                class="flex w-full cursor-pointer list-none items-center justify-between px-4 py-2 [&::-webkit-details-marker]:hidden"
              >
                <span class="flex flex-col text-sm/normal font-medium">
                  <span>{{ log.taskName }}</span>
                  <span class="text-muted">
                    {{
                      comfyManagerStore.isTaskFailed(log.taskId)
                        ? t('g.failed')
                        : comfyManagerStore.isTaskInProgress(log.taskId)
                          ? t('g.inProgress')
                          : t('g.completedWithCheckmark')
                    }}
                  </span>
                </span>
                <i
                  aria-hidden="true"
                  class="icon-[lucide--chevron-right] size-4 text-neutral-300 group-open/log:rotate-90"
                />
              </summary>
              <div
                :ref="
                  index === activeTabData.logs.length - 1
                    ? setLatestLogContainer
                    : undefined
                "
                role="log"
                :aria-label="log.taskName"
                :class="
                  cn(
                    'h-64 overflow-y-auto rounded-lg bg-black',
                    index === activeTabData.logs.length - 1 && 'grow'
                  )
                "
                @scroll="handleScroll"
              >
                <div class="h-full">
                  <div
                    v-for="(logLine, logIndex) in log.logs"
                    :key="logIndex"
                    class="text-muted"
                  >
                    <pre class="wrap-break-word whitespace-pre-wrap">{{
                      logLine
                    }}</pre>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </TabsContent>
      </Tabs>
    </template>

    <template #footer="{ toggle }">
      <div
        class="flex w-full items-center justify-between gap-4 px-6 py-2 shadow-lg"
      >
        <div class="flex min-w-0 items-center text-base leading-none">
          <div class="flex items-center">
            <span v-if="comfyManagerStore.queueError && isInProgress">
              {{ t('manager.queueWaitingToContinue') }}
            </span>
            <template v-else-if="isInProgress">
              <DotSpinner duration="1s" class="mr-2" />
              <span>{{ currentTaskName }}</span>
            </template>
            <template v-else-if="isRestartCompleted">
              <span class="mr-2">🎉</span>
              <span>{{ currentTaskName }}</span>
            </template>
            <template v-else-if="hasSuccessfulTasks">
              <span class="mr-2">✅</span>
              <span>{{ t('manager.restartToApplyChanges') }}</span>
            </template>
            <span
              v-else-if="comfyManagerStore.failedTasksIds.length"
              class="text-error"
              >{{ t('g.failed') }}</span
            >
            <span v-else>{{ t('g.completed') }}</span>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-4">
          <span
            v-if="isInProgress && !comfyManagerStore.queueError"
            class="text-sm text-muted-foreground"
          >
            {{ completedTasksCount }} {{ t('g.progressCountOf') }}
            {{ totalTasksCount }}
          </span>
          <div class="flex items-center">
            <Button
              v-if="comfyManagerStore.queueError && isInProgress"
              variant="secondary"
              @click="comfyManagerStore.startQueue"
            >
              {{ t('manager.retryQueueStart') }}
            </Button>
            <Button
              v-if="!isInProgress && !isRestartCompleted && hasSuccessfulTasks"
              variant="secondary"
              class="mr-4 rounded-full border-2 border-base-foreground px-3 text-base-foreground hover:bg-secondary-background-hover"
              @click="handleRestart"
            >
              {{ t('manager.applyChanges') }}
            </Button>
            <Button
              v-if="!isRestartCompleted"
              variant="muted-textonly"
              size="sm"
              class="rounded-full font-bold"
              :aria-label="
                t(isExpanded ? 'contextMenu.Collapse' : 'contextMenu.Expand')
              "
              @click.stop="toggle"
            >
              <i
                :class="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
              />
            </Button>
            <Button
              variant="muted-textonly"
              size="sm"
              class="rounded-full font-bold"
              :aria-label="t('g.close')"
              :disabled="isInProgress"
              @click.stop="closeToast"
            >
              <i class="pi pi-times" />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </ToastPanel>
</template>
