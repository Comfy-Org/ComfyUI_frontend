<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watch
} from 'vue'

import AppModeToolbar from '@/components/appMode/AppModeToolbar.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  applyInputOverrides,
  buildOutputAssets,
  waitForPromptOutputs
} from '@/renderer/extensions/apiMode/runApiWorkflow'
import type { ApiPrompt } from '@/renderer/extensions/apiMode/runApiWorkflow'
import { useApiSpec } from '@/renderer/extensions/apiMode/useApiSpec'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

const { spec, inputs, inputFieldMap, selectedOutputs } = useApiSpec()
const container = useTemplateRef<HTMLDivElement>('container')

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()

// The left toolbar's "APIs"/assets buttons toggle a sidebar tab; render its
// panel here so it shows up while viewing the Swagger (as it does in App mode).
const activeTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)

type SwaggerUIFactory = (options: Record<string, unknown>) => unknown
let swaggerUIBundle: SwaggerUIFactory | undefined

async function ensureSwagger(): Promise<void> {
  if (swaggerUIBundle) return
  const mod = await import('swagger-ui-dist')
  await import('swagger-ui-dist/swagger-ui.css')
  swaggerUIBundle = mod.SwaggerUIBundle as SwaggerUIFactory
}

interface SwaggerRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

interface SwaggerResponse {
  url?: string
  status: number
  statusText?: string
  ok: boolean
  headers?: Record<string, string>
  text?: string
  data?: string
  body?: unknown
  obj?: unknown
}

function absoluteViewUrl(
  filename: string,
  subfolder: string,
  type: string
): string {
  const params = new URLSearchParams({ filename, subfolder, type })
  return new URL(
    api.apiURL(`/view?${params.toString()}`),
    window.location.origin
  ).href
}

/**
 * Swagger's "Execute" can't reach the documented endpoint directly, so we
 * rewrite the request to ComfyUI's real `/prompt` endpoint, applying the
 * payload onto the live workflow's promoted inputs.
 */
async function requestInterceptor(
  req: SwaggerRequest
): Promise<SwaggerRequest> {
  // The "describe inputs" endpoint is computed entirely on the client from the
  // workflow's API configuration. Serve it locally via a data URL so Execute
  // returns the inputs and their current values without hitting the server.
  if (req.url.includes('/workflow/inputs')) {
    const payload = {
      inputs: inputs.value,
      outputs: selectedOutputs.value
    }
    req.url =
      'data:application/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(payload))
    req.method = 'GET'
    req.body = undefined
    return req
  }

  if (!req.url.includes('/workflow/generate')) return req

  let payload: Record<string, unknown>
  try {
    payload = req.body ? JSON.parse(req.body) : {}
  } catch {
    payload = {}
  }

  const { output, workflow } = await app.graphToPrompt()
  applyInputOverrides(
    output as unknown as ApiPrompt,
    payload,
    inputFieldMap.value
  )

  req.url = api.apiURL('/prompt')
  req.method = 'POST'
  req.headers = { ...req.headers, 'Content-Type': 'application/json' }
  req.body = JSON.stringify({
    client_id: api.clientId ?? '',
    prompt: output,
    extra_data: { extra_pnginfo: { workflow } }
  })
  return req
}

/**
 * After `/prompt` accepts the job, wait for it to finish and replace the
 * response with the produced outputs (each asset carries a `/view` URL).
 */
async function responseInterceptor(
  res: SwaggerResponse
): Promise<SwaggerResponse> {
  if (!res.url || !res.url.endsWith('/prompt')) return res

  const setBody = (value: unknown, status = 200, statusText = 'OK') => {
    const text = JSON.stringify(value, null, 2)
    res.text = text
    res.data = text
    res.body = value
    res.obj = value
    res.status = status
    res.statusText = statusText
    res.ok = status >= 200 && status < 300
    res.headers = { ...(res.headers ?? {}), 'content-type': 'application/json' }
  }

  try {
    let parsed: { prompt_id?: string; error?: unknown; node_errors?: unknown }
    try {
      parsed = (res.body ??
        res.obj ??
        JSON.parse(res.text ?? '{}')) as typeof parsed
    } catch {
      return res
    }
    const promptId = parsed?.prompt_id
    if (!promptId) return res // surface node_errors / validation failures as-is

    const historyOutputs = await waitForPromptOutputs(promptId, (route) =>
      api.fetchApi(route)
    )
    const outputs = buildOutputAssets(
      historyOutputs,
      selectedOutputs.value,
      absoluteViewUrl
    )
    setBody({ prompt_id: promptId, outputs })
  } catch (error) {
    setBody(
      { error: error instanceof Error ? error.message : String(error) },
      504,
      'Gateway Timeout'
    )
  }
  return res
}

async function render(): Promise<void> {
  await ensureSwagger()
  if (!container.value || !swaggerUIBundle) return
  swaggerUIBundle({
    domNode: container.value,
    spec: spec.value,
    deepLinking: false,
    // Enable the "Try it out" / "Execute" buttons so the endpoint can be tested.
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    defaultModelsExpandDepth: 1,
    requestInterceptor,
    responseInterceptor
  })
}

onMounted(() => {
  void render()
})
watch(spec, () => {
  void render()
})
onBeforeUnmount(() => {
  if (container.value) container.value.innerHTML = ''
})
</script>

<template>
  <div class="absolute flex size-full flex-col bg-base-background">
    <div
      class="workflow-tabs-container pointer-events-auto h-(--workflow-tabs-height) w-full border-b border-interface-stroke shadow-interface"
    >
      <div class="flex h-full items-center">
        <WorkflowTabs />
        <TopbarBadges />
        <TopbarSubscribeButton />
      </div>
    </div>
    <div class="relative flex flex-1 overflow-hidden">
      <div
        v-if="sidebarOnLeft && activeTab"
        class="w-80 shrink-0 overflow-x-hidden overflow-y-auto border-r border-border-subtle"
      >
        <ExtensionSlot :extension="activeTab" />
      </div>
      <div class="relative flex-1 overflow-auto">
        <div class="absolute top-2 left-4 z-20">
          <AppModeToolbar />
        </div>
        <div ref="container" class="swagger-api-mode min-h-full pt-16" />
      </div>
      <div
        v-if="!sidebarOnLeft && activeTab"
        class="w-80 shrink-0 overflow-x-hidden overflow-y-auto border-l border-border-subtle"
      >
        <ExtensionSlot :extension="activeTab" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Swagger UI ships a light theme with hard-coded dark text, which is illegible
 * on the app's dark background. Re-map its colors to the app's theme-aware
 * semantic tokens so it stays readable in both light and dark mode.
 */
.swagger-api-mode :deep(.swagger-ui) {
  background: transparent;
  color: var(--base-foreground);
}

/* Headings, info block and general body text */
.swagger-api-mode :deep(.swagger-ui .info .title),
.swagger-api-mode :deep(.swagger-ui .info li),
.swagger-api-mode :deep(.swagger-ui .info p),
.swagger-api-mode :deep(.swagger-ui .info a),
.swagger-api-mode :deep(.swagger-ui .info table),
.swagger-api-mode :deep(.swagger-ui h1),
.swagger-api-mode :deep(.swagger-ui h2),
.swagger-api-mode :deep(.swagger-ui h3),
.swagger-api-mode :deep(.swagger-ui h4),
.swagger-api-mode :deep(.swagger-ui h5),
.swagger-api-mode :deep(.swagger-ui label),
.swagger-api-mode :deep(.swagger-ui .opblock-tag),
.swagger-api-mode :deep(.swagger-ui .opblock-tag small),
.swagger-api-mode :deep(.swagger-ui .opblock .opblock-summary-path),
.swagger-api-mode :deep(.swagger-ui .opblock .opblock-summary-path__deprecated),
.swagger-api-mode :deep(.swagger-ui .opblock .opblock-summary-description),
.swagger-api-mode :deep(.swagger-ui .opblock-description-wrapper p),
.swagger-api-mode :deep(.swagger-ui .opblock-external-docs-wrapper p),
.swagger-api-mode :deep(.swagger-ui .opblock-title_normal p),
.swagger-api-mode :deep(.swagger-ui .parameter__name),
.swagger-api-mode :deep(.swagger-ui .parameter__type),
.swagger-api-mode :deep(.swagger-ui .parameter__in),
.swagger-api-mode :deep(.swagger-ui table thead tr td),
.swagger-api-mode :deep(.swagger-ui table thead tr th),
.swagger-api-mode :deep(.swagger-ui .response-col_status),
.swagger-api-mode :deep(.swagger-ui .response-col_links),
.swagger-api-mode :deep(.swagger-ui .col_header),
.swagger-api-mode :deep(.swagger-ui .responses-inner h4),
.swagger-api-mode :deep(.swagger-ui .responses-inner h5),
.swagger-api-mode :deep(.swagger-ui .tab li),
.swagger-api-mode :deep(.swagger-ui .tab li button.tablinks),
.swagger-api-mode :deep(.swagger-ui section.models h4),
.swagger-api-mode :deep(.swagger-ui .model-title),
.swagger-api-mode :deep(.swagger-ui .model),
.swagger-api-mode :deep(.swagger-ui .model-toggle),
.swagger-api-mode :deep(.swagger-ui .prop-type),
.swagger-api-mode :deep(.swagger-ui .prop-format) {
  color: var(--base-foreground);
}

/* Secondary / muted text */
.swagger-api-mode :deep(.swagger-ui .opblock-tag small),
.swagger-api-mode :deep(.swagger-ui .parameter__in),
.swagger-api-mode :deep(.swagger-ui .renderedMarkdown p),
.swagger-api-mode :deep(.swagger-ui .response-col_description) {
  color: var(--muted-foreground);
}

/* Links */
.swagger-api-mode :deep(.swagger-ui a),
.swagger-api-mode :deep(.swagger-ui .info a) {
  color: var(--primary-background);
}

/* Section panels, schemes and tables */
.swagger-api-mode :deep(.swagger-ui .scheme-container) {
  background: transparent;
  box-shadow: none;
}
.swagger-api-mode :deep(.swagger-ui .opblock .opblock-section-header) {
  background: var(--secondary-background);
  box-shadow: none;
}
.swagger-api-mode :deep(.swagger-ui .opblock) {
  background: var(--secondary-background);
  border-color: var(--border-subtle);
  box-shadow: none;
}
.swagger-api-mode :deep(.swagger-ui .opblock .opblock-summary) {
  border-color: var(--border-subtle);
}
.swagger-api-mode :deep(.swagger-ui section.models),
.swagger-api-mode :deep(.swagger-ui section.models .model-container),
.swagger-api-mode :deep(.swagger-ui .model-box) {
  background: var(--secondary-background);
  border-color: var(--border-subtle);
}
.swagger-api-mode :deep(.swagger-ui table tbody tr td),
.swagger-api-mode :deep(.swagger-ui .responses-inner) {
  border-color: var(--border-subtle);
  color: var(--base-foreground);
}

/* Form controls */
.swagger-api-mode :deep(.swagger-ui select),
.swagger-api-mode :deep(.swagger-ui input[type='text']),
.swagger-api-mode :deep(.swagger-ui textarea) {
  background: var(--base-background);
  color: var(--base-foreground);
  border-color: var(--border-subtle);
}

/* Inline code / markdown */
.swagger-api-mode :deep(.swagger-ui .markdown code),
.swagger-api-mode :deep(.swagger-ui .renderedMarkdown code) {
  background: var(--tertiary-background);
  color: var(--base-foreground);
}

/* Outline buttons ("Try it out", "Cancel") have dark text by default */
.swagger-api-mode :deep(.swagger-ui .btn.try-out__btn),
.swagger-api-mode :deep(.swagger-ui .btn.cancel),
.swagger-api-mode :deep(.swagger-ui .btn.btn-clear) {
  color: var(--base-foreground);
  border-color: var(--border-subtle);
  background: transparent;
}

/* Expand/collapse arrows and other icons */
.swagger-api-mode :deep(.swagger-ui .opblock-summary-control svg),
.swagger-api-mode :deep(.swagger-ui .models-control svg),
.swagger-api-mode :deep(.swagger-ui .expand-operation svg),
.swagger-api-mode :deep(.swagger-ui .arrow) {
  fill: var(--base-foreground);
}
</style>
