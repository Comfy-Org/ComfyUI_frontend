<template>
  <BaseViewTemplate dark>
    <main
      class="relative my-8 flex w-full max-w-lg flex-col gap-6 rounded-lg bg-(--comfy-menu-bg) p-8 shadow-lg"
    >
      <header class="flex flex-col gap-1">
        <h1 class="text-xl font-semibold text-neutral-100">
          {{ t('connectionPanel.title') }}
        </h1>
        <p class="text-sm text-neutral-400">
          {{ t('connectionPanel.subtitle') }}
        </p>
      </header>

      <!-- Backend URL input -->
      <section class="flex flex-col gap-2">
        <label for="backend-url" class="text-sm font-medium text-neutral-300">
          {{ t('connectionPanel.backendUrl') }}
        </label>
        <div class="flex gap-2">
          <input
            id="backend-url"
            v-model="backendUrl"
            type="url"
            :placeholder="DEFAULT_BACKEND_URL"
            class="flex h-10 w-full min-w-0 appearance-none rounded-lg border-none bg-neutral-800 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-600 focus-visible:outline-none"
            @keyup.enter="testConnection"
          />
          <Button
            variant="primary"
            size="lg"
            :loading="isTesting"
            :disabled="isTesting"
            @click="testConnection"
          >
            {{ t('connectionPanel.test') }}
          </Button>
        </div>
      </section>

      <!-- Connection status -->
      <section
        v-if="httpStatus !== null || wsStatus !== null"
        role="status"
        aria-live="polite"
        class="flex flex-col gap-2 rounded-md bg-neutral-800/50 p-3"
      >
        <h2
          class="text-xs font-medium tracking-wide text-neutral-400 uppercase"
        >
          {{ t('connectionPanel.status') }}
        </h2>
        <div class="flex gap-4 text-sm">
          <span class="flex items-center gap-1.5">
            <span
              :class="
                cn(
                  'inline-block size-2 rounded-full',
                  httpStatus === true && 'bg-green-500',
                  httpStatus === false && 'bg-red-500',
                  httpStatus === null && 'bg-neutral-600'
                )
              "
            />
            {{ t('connectionPanel.http') }}
            {{ httpStatus === true ? '✓' : httpStatus === false ? '✗' : '—' }}
          </span>
          <span class="flex items-center gap-1.5">
            <span
              :class="
                cn(
                  'inline-block size-2 rounded-full',
                  wsStatus === true && 'bg-green-500',
                  wsStatus === false && 'bg-red-500',
                  wsStatus === null && 'bg-neutral-600'
                )
              "
            />
            {{ t('connectionPanel.ws') }}
            {{ wsStatus === true ? '✓' : wsStatus === false ? '✗' : '—' }}
          </span>
        </div>
        <p v-if="connectionError" class="text-xs text-red-400">
          {{ connectionError }}
        </p>
        <p
          v-if="httpStatus === true && wsStatus === true"
          class="text-xs text-green-400"
        >
          {{ t('connectionPanel.connected') }}
        </p>

        <!-- Backend cloud-API base + mismatch warning -->
        <div
          v-if="backendCloudBase"
          class="flex flex-col gap-1 border-t border-neutral-700 pt-2 text-xs"
        >
          <p class="text-neutral-400">
            <span class="text-neutral-500"
              >{{ t('connectionPanel.backendCloud') }}
            </span>
            <code
              class="ml-1 rounded-sm bg-neutral-900 px-1 py-0.5 text-neutral-200"
              >{{ backendCloudBase }}</code
            >
          </p>
          <p v-if="cloudMismatch" class="text-amber-400">
            {{
              t('connectionPanel.cloudMismatch', {
                frontend: frontendCloudBase
              })
            }}
          </p>
        </div>

        <!-- Connect & Go button -->
        <Button
          v-if="httpStatus === true"
          variant="primary"
          size="lg"
          class="mt-2 w-full"
          @click="connectAndGo"
        >
          {{ t('connectionPanel.connectAndGo') }}
        </Button>
      </section>

      <!-- Quick Start with Comfy CLI -->
      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-medium text-neutral-300">
          {{ t('connectionPanel.quickStart') }}
        </h2>
        <p class="text-xs text-neutral-400">
          {{ t('connectionPanel.quickStartDescription') }}
        </p>

        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium text-neutral-400">
              {{ t('connectionPanel.step1InstallUv') }}
            </span>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              curl -LsSf https://astral.sh/uv/install.sh | sh
            </code>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
            </code>
            <p class="text-xs text-neutral-500">
              {{ t('connectionPanel.uvNote') }}
            </p>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium text-neutral-400">
              {{ t('connectionPanel.step2InstallComfyui') }}
            </span>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              uv pip install comfy-cli --system && comfy install
            </code>
            <p class="text-xs text-neutral-500">
              {{ t('connectionPanel.managerIncludedNote') }}
            </p>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium text-neutral-400">
              {{ t('connectionPanel.step3Launch') }}
            </span>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              comfy launch -- --enable-cors-header="{{ corsOrigin }}"
            </code>
          </div>
        </div>

        <p class="text-xs text-neutral-500">
          {{ t('connectionPanel.corsNote') }}
        </p>

        <aside
          class="flex flex-col gap-1 rounded-md border border-neutral-700 bg-neutral-800/50 p-3"
        >
          <h3 class="text-xs font-medium text-neutral-300">
            {{ t('connectionPanel.managerTitle') }}
          </h3>
          <p class="text-xs text-neutral-400">
            {{ t('connectionPanel.managerDescription') }}
          </p>
          <a
            href="https://github.com/Comfy-Org/ComfyUI-Manager"
            target="_blank"
            rel="noopener"
            class="text-xs text-neutral-300 underline hover:text-neutral-100"
          >
            {{ t('connectionPanel.managerLearnMore') }}
          </a>
        </aside>
      </section>

      <!-- Alternative: manual python / pip -->
      <details class="group">
        <summary
          class="cursor-pointer text-sm font-medium text-neutral-400 hover:text-neutral-300"
        >
          {{ t('connectionPanel.altManualSetup') }}
        </summary>
        <div class="mt-2 flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <p class="text-xs text-neutral-400">
              {{ t('connectionPanel.altPipDescription') }}
            </p>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              pip install comfy-cli
            </code>
            <p class="text-xs text-neutral-500">
              {{ t('connectionPanel.altPipNote') }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <p class="text-xs text-neutral-400">
              {{ t('connectionPanel.altManagerDescription') }}
            </p>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              git clone https://github.com/Comfy-Org/ComfyUI-Manager.git
              custom_nodes/ComfyUI-Manager
            </code>
          </div>
          <div class="flex flex-col gap-1">
            <p class="text-xs text-neutral-400">
              {{ t('connectionPanel.guideDescription') }}
            </p>
            <code
              class="block rounded-md bg-neutral-800 p-3 text-xs text-neutral-200 select-all"
            >
              python main.py --enable-cors-header="{{ corsOrigin }}"
            </code>
          </div>
        </div>
      </details>

      <!-- Local network access -->
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-neutral-300">
          {{ t('connectionPanel.localAccess') }}
        </h2>
        <p class="text-xs text-neutral-400">
          {{ t('connectionPanel.localAccessDescription') }}
        </p>
      </section>

      <footer
        class="flex items-center justify-between border-t border-neutral-700 pt-4 text-xs text-neutral-500"
      >
        <span
          :title="buildTooltip"
          class="cursor-help underline decoration-dotted"
        >
          {{ buildLabel }}
        </span>
        <a
          :href="repoUrl"
          target="_blank"
          rel="noopener"
          class="text-neutral-400 hover:text-neutral-200"
        >
          {{ t('connectionPanel.source') }}
        </a>
      </footer>
    </main>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

type SystemStats = { system?: { argv?: string[] } }

const COMFY_API_BASE_FLAG = '--comfy-api-base'
const DEFAULT_CLOUD_API_BASE = 'https://api.comfy.org'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function parseBackendCloudBase(argv: string[] | undefined): string {
  if (!argv) return DEFAULT_CLOUD_API_BASE
  let value: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === COMFY_API_BASE_FLAG && i + 1 < argv.length) value = argv[i + 1]
    else if (a.startsWith(`${COMFY_API_BASE_FLAG}=`))
      value = a.slice(COMFY_API_BASE_FLAG.length + 1)
  }
  return stripTrailingSlash(value ?? DEFAULT_CLOUD_API_BASE)
}

const { t } = useI18n()

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8188'
const STORAGE_KEY = 'comfyui-preview-backend-url'
const REPO = 'https://github.com/Comfy-Org/ComfyUI_frontend'
const corsOrigin = window.location.origin

const backendUrl = ref(localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL)

const isTesting = ref(false)
const httpStatus = ref<boolean | null>(null)
const wsStatus = ref<boolean | null>(null)
const connectionError = ref('')
const backendCloudBase = ref<string | null>(null)
const frontendCloudBase = stripTrailingSlash(getComfyApiBaseUrl())
const cloudMismatch = computed(
  () =>
    backendCloudBase.value !== null &&
    backendCloudBase.value !== frontendCloudBase
)

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!url) url = DEFAULT_BACKEND_URL
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url
  return url.replace(/\/+$/, '')
}

async function fetchSystemStats(base: string): Promise<SystemStats | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${base}/api/system_stats`, {
      signal: controller.signal
    })
    if (!res.ok) return null
    return (await res.json()) as SystemStats
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function testWs(base: string): Promise<boolean> {
  return new Promise((resolve) => {
    const wsUrl = new URL(base)
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl.pathname = '/ws'
    wsUrl.search = ''
    wsUrl.hash = ''
    const ws = new WebSocket(wsUrl.toString())
    const timeout = setTimeout(() => {
      ws.close()
      resolve(false)
    }, 5000)
    ws.addEventListener('open', () => {
      clearTimeout(timeout)
      ws.close()
      resolve(true)
    })
    ws.addEventListener('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

async function testConnection() {
  isTesting.value = true
  httpStatus.value = null
  wsStatus.value = null
  connectionError.value = ''
  backendCloudBase.value = null

  const base = normalizeUrl(backendUrl.value)
  backendUrl.value = base
  localStorage.setItem(STORAGE_KEY, base)

  try {
    const [stats, ws] = await Promise.all([
      fetchSystemStats(base),
      testWs(base)
    ])
    httpStatus.value = stats !== null
    wsStatus.value = ws
    backendCloudBase.value = stats
      ? parseBackendCloudBase(stats.system?.argv)
      : null

    if (stats === null && !ws) {
      connectionError.value = t('connectionPanel.errorUnreachable')
    } else if (stats === null) {
      connectionError.value = t('connectionPanel.errorHttpFailed')
    } else if (!ws) {
      connectionError.value = t('connectionPanel.errorWsFailed')
    }
  } catch {
    httpStatus.value = false
    wsStatus.value = false
    connectionError.value = t('connectionPanel.errorUnreachable')
  } finally {
    isTesting.value = false
  }
}

function connectAndGo() {
  const base = normalizeUrl(backendUrl.value)
  localStorage.setItem(STORAGE_KEY, base)
  // Full page reload so ComfyApi constructor picks up the new backend URL
  window.location.href = import.meta.env.BASE_URL || '/'
}

const version = __COMFYUI_FRONTEND_VERSION__
const commit = __COMFYUI_FRONTEND_COMMIT__
const branch = __CI_BRANCH__
const prNumber = __CI_PR_NUMBER__
const runId = __CI_RUN_ID__
const jobId = __CI_JOB_ID__

const buildLabel = computed(() => {
  if (prNumber) return t('connectionPanel.buildPr', { prNumber })
  if (branch) return branch
  return t('connectionPanel.buildVersion', { version })
})

const buildTooltip = computed(() => {
  const parts = [t('connectionPanel.tooltipVersion', { version })]
  if (commit)
    parts.push(
      t('connectionPanel.tooltipCommit', { commit: commit.slice(0, 8) })
    )
  if (branch) parts.push(t('connectionPanel.tooltipBranch', { branch }))
  if (runId) parts.push(t('connectionPanel.tooltipRunId', { runId }))
  if (jobId) parts.push(t('connectionPanel.tooltipJobId', { jobId }))
  return parts.join('\n')
})

const repoUrl = computed(() => {
  if (prNumber) return `${REPO}/pull/${prNumber}`
  if (branch) return `${REPO}/tree/${branch}`
  return REPO
})

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
