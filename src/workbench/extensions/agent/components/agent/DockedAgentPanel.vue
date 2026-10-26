<template>
  <Teleport to="body" :disabled="!isOverlay">
    <div
      v-if="docked"
      data-testid="docked-agent-panel"
      role="complementary"
      aria-labelledby="agent-panel-title"
      :class="
        cn(
          'docked-agent-panel pointer-events-auto shrink-0 overflow-hidden [anchor-name:--docked-agent-panel]',
          isOverlay
            ? 'fixed inset-y-0 right-0 z-1100 max-w-full bg-background shadow-lg'
            : 'relative h-full'
        )
      "
      :style="{ width: `${panelWidth}px` }"
    >
      <div
        v-if="!isOverlay"
        data-testid="agent-panel-resize-handle"
        class="absolute top-0 left-0 z-10 h-full w-[5px] cursor-col-resize transition-colors delay-300 duration-200 hover:bg-primary data-[resizing=true]:bg-primary"
        :data-resizing="isResizing"
        @pointerdown="onResizeStart"
        @lostpointercapture="isResizing = false"
      />
      <div
        data-testid="docked-agent-panel-shell"
        :class="
          cn(
            'size-full p-2',
            hasOpaqueNeighbor && 'border-l border-border bg-background'
          )
        "
      >
        <div class="size-full overflow-hidden rounded-lg border">
          <AgentPanelLoadError v-if="mountFailed" :on-retry="retryMount" />
          <AgentPanelRoot v-else :key="mountAttempt" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { PropType } from 'vue'
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  onErrorCaptured,
  ref
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkspaceInsetRight } from '@/composables/useWorkspaceInset'
import { reportError } from '@/platform/telemetry/reportError'
import { useAgentPanelRenderStore } from '@/workbench/extensions/agent/stores/agent/agentPanelRenderStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentRunModeStore } from '@/workbench/extensions/agent/stores/agent/agentRunModeStore'

const AgentPanelLoadError = defineComponent({
  name: 'AgentPanelLoadError',
  props: {
    onRetry: { type: Function as PropType<() => void>, default: undefined }
  },
  setup(props) {
    const { t } = useI18n()
    return () =>
      h('div', { class: 'size-full bg-background p-3' }, [
        h(
          'h2',
          { id: 'agent-panel-title', class: 'sr-only' },
          t('agent.title')
        ),
        h('p', { class: 'text-sm text-foreground' }, t('agent.loadFailed')),
        props.onRetry &&
          h(
            Button,
            {
              class: 'mt-3',
              variant: 'secondary',
              size: 'sm',
              onClick: props.onRetry
            },
            () => t('g.retry')
          )
      ])
  }
})

const agentPanelRenderStore = useAgentPanelRenderStore()
agentPanelRenderStore.reach('root_unresolved')

const AgentPanelRoot = defineAsyncComponent({
  loader: async () => {
    const panelRoot =
      await import('@/workbench/extensions/agent/AgentPanelRoot.vue')
    agentPanelRenderStore.reach('root_resolved_not_mounted')
    return panelRoot
  },
  errorComponent: AgentPanelLoadError,
  onError: (error, _retry, fail) => {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_panel_load_failure'
    })
    fail()
  }
})

const mountAttempt = ref(0)
const mountFailed = ref(false)

onErrorCaptured((error) => {
  if (agentPanelRenderStore.progress !== 'root_resolved_not_mounted') return
  reportError(error, {
    surface: 'agent',
    errorType: 'failure_mounting_agent_panel'
  })
  mountFailed.value = true
  return false
})

function retryMount(): void {
  mountFailed.value = false
  mountAttempt.value++
}

/** Set by the parent that lays out both this panel and its left neighbour. */
const { hasOpaqueNeighbor = false } = defineProps<{
  hasOpaqueNeighbor?: boolean
}>()

const agentPanelStore = useAgentPanelStore()
const {
  isVisible: docked,
  width,
  requestedWidth,
  isOverlay
} = storeToRefs(agentPanelStore)
const { width: viewportWidth } = useWindowSize()
const panelWidth = computed(() =>
  Math.min(
    isOverlay.value ? requestedWidth.value : width.value,
    viewportWidth.value
  )
)
useWorkspaceInsetRight(() =>
  docked.value && !isOverlay.value ? width.value : 0
)
const agentRunModeStore = useAgentRunModeStore()

void agentRunModeStore.load().catch((error: unknown) => {
  reportError(error, {
    surface: 'agent',
    errorType: 'agent_run_mode_load_failure'
  })
})

const isResizing = ref(false)
let resizeStartX = 0
let resizeStartWidth = 0

function onResizeStart(e: PointerEvent): void {
  isResizing.value = true
  resizeStartX = e.clientX
  resizeStartWidth = agentPanelStore.width
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

useEventListener(document, 'pointermove', (e: PointerEvent) => {
  if (!isResizing.value) return
  agentPanelStore.setWidth(resizeStartWidth + (resizeStartX - e.clientX))
})

function stopResizing(): void {
  isResizing.value = false
}

useEventListener(document, 'pointerup', stopResizing)
useEventListener(document, 'pointercancel', stopResizing)
onBeforeUnmount(stopResizing)
</script>
