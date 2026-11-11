<template>
  <Teleport to="body" :disabled="!detached">
    <div
      v-if="docked"
      ref="panelElement"
      data-testid="docked-agent-panel"
      :data-presentation="presentation.kind"
      role="complementary"
      aria-labelledby="agent-panel-title"
      :class="panelClass"
      :style="panelStyle"
    >
      <div
        v-if="!detached"
        data-testid="agent-panel-resize-handle"
        class="absolute top-0 left-0 z-10 h-full w-[5px] cursor-col-resize transition-colors delay-300 duration-200 hover:bg-primary data-[resizing=true]:bg-primary"
        :data-resizing="isResizing"
        @pointerdown="onResizeStart"
        @lostpointercapture="isResizing = false"
      />
      <div data-testid="docked-agent-panel-shell" :class="shellClass">
        <div :class="frameClass">
          <AgentPanelLoadError v-if="mountFailed" :on-retry="retryMount" />
          <AgentPanelRoot v-else :key="mountAttempt" />
        </div>
        <div
          v-if="isFullscreen"
          class="pointer-events-none absolute inset-x-0 top-14 z-10 px-4"
        >
          <ErrorOverlay />
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
  nextTick,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import ErrorOverlay from '@/platform/workflowErrors/overlay/ErrorOverlay.vue'
import { useWorkspaceInsetRight } from '@/composables/useWorkspaceInset'
import { reportError } from '@comfyorg/telemetry/reportError'
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
    useAgentPanelStore().exitFullscreen('load_failed')
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
  isOverlay,
  isFullscreen,
  presentation
} = storeToRefs(agentPanelStore)
const detached = computed(() => isOverlay.value || isFullscreen.value)

function presentationClass(): string {
  if (isFullscreen.value) return 'fixed inset-0 z-panel bg-background'
  return isOverlay.value
    ? '[anchor-name:--docked-agent-panel] fixed inset-y-0 right-0 z-panel max-w-full bg-background shadow-lg'
    : '[anchor-name:--docked-agent-panel] relative h-full'
}

const panelClass = computed(() =>
  cn(
    'docked-agent-panel pointer-events-auto shrink-0 overflow-hidden',
    presentationClass()
  )
)
const panelStyle = computed(() =>
  isFullscreen.value ? undefined : { width: `${panelWidth.value}px` }
)
const shellClass = computed(() =>
  cn(
    'size-full',
    !isFullscreen.value && 'p-2',
    hasOpaqueNeighbor &&
      !isFullscreen.value &&
      'border-l border-border bg-background'
  )
)
const frameClass = computed(() =>
  cn('size-full overflow-hidden', !isFullscreen.value && 'rounded-lg border')
)
const { width: viewportWidth } = useWindowSize()
const panelWidth = computed(() =>
  Math.min(
    isOverlay.value ? requestedWidth.value : width.value,
    viewportWidth.value
  )
)
useWorkspaceInsetRight(() =>
  docked.value && !detached.value ? width.value : 0
)

onMounted(() => agentPanelStore.setPanelMounted(true))
onBeforeUnmount(() => agentPanelStore.setPanelMounted(false))

const panelElement = useTemplateRef<HTMLElement>('panelElement')
watch(
  isFullscreen,
  async () => {
    const scrolled = Array.from(
      panelElement.value?.querySelectorAll<HTMLElement>('*') ?? []
    )
      .filter((element) => element.scrollTop > 0)
      .map((element) => ({ element, top: element.scrollTop }))
    await nextTick()
    for (const { element, top } of scrolled) element.scrollTop = top
  },
  { flush: 'pre' }
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
