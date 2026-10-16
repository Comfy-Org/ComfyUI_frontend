<script setup lang="ts">
import { isPlainPrimaryClick } from '@/lib/workshop/navigation-intent'
import {
  computed,
  defineAsyncComponent,
  inject,
  onMounted,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  watch
} from 'vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { ModelsPageData } from '@/config/models-page-data'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { fetchCatalogDetail } from '@/lib/cms/detail-page-client'
import { workshopRunInFlight } from '@/config/workshop-run-state'
import {
  catalogBrowseNavigation,
  catalogDetailNavigation,
  catalogDetailPath,
  listenCatalogHistory
} from '@/lib/cms/detail-route'
import CatalogDetailHeading from './CatalogDetailHeading.vue'
import CatalogueBackLink from './CatalogueBackLink.vue'

const {
  path,
  preview,
  locale = 'en'
} = defineProps<{
  path: string
  preview?: WorkshopModel
  locale?: Locale
}>()
const loadWorkflowPage = () => import('./WorkflowPage.vue')
const loadModelPage = () => import('./ModelPage.vue')
const WorkflowPage = defineAsyncComponent(loadWorkflowPage)
const ModelPage = defineAsyncComponent(loadModelPage)
const LocalModelPage = defineAsyncComponent(
  () => import('./LocalModelPage.vue')
)
const { t } = translationsFor(locale)
const activePath = ref(path)
const activePreview = shallowRef(preview)
const parentNavigation = inject(catalogDetailNavigation, undefined)
const browseNavigation = inject(catalogBrowseNavigation, undefined)
provide(catalogDetailNavigation, (event, model) => {
  if (parentNavigation) return parentNavigation(event, model)
  if (!isPlainPrimaryClick(event)) return
  if (!model.href) return
  const target = new URL(model.href, location.href)
  if (target.origin !== location.origin || !catalogDetailPath(target.pathname))
    return
  if (locale === 'zh-CN' && !target.pathname.startsWith('/zh-CN/'))
    target.pathname = '/zh-CN' + target.pathname
  event.preventDefault()
  event.stopPropagation()
  activePreview.value = model
  activePath.value = target.pathname
  window.history.pushState(
    { ...window.history.state, cccDetailPath: target.pathname },
    '',
    target.pathname + target.search + target.hash
  )
  document.title = `${model.name} - Comfy`
  window.scrollTo({ top: 0, behavior: 'instant' })
})
const page = shallowRef<ModelsPageData>()
const failed = ref(false)
const missing = ref(false)
const currentModel = computed(() => page.value?.model ?? activePreview.value)
const workflow = computed(() =>
  page.value?.model.workflowId !== undefined ? page.value.model : undefined
)
const localModel = computed(() => {
  const model = page.value?.model
  return model?.type === 'MODEL' && model.routerId === undefined
    ? model
    : undefined
})
const routerPage = computed(() => {
  const value = page.value
  return value && value.model.routerId !== undefined
    ? { ...value, model: value.model }
    : undefined
})
const browsePath = computed(() => {
  const prefix = locale === 'zh-CN' ? '/zh-CN' : ''
  return `${prefix}/hub/${activePath.value.includes('/workflows/') ? 'workflows' : 'models'}/`
})
let request: AbortController | undefined
let sequence = 0
async function load() {
  request?.abort()
  const controller = new AbortController()
  request = controller
  const current = ++sequence
  failed.value = false
  missing.value = false
  page.value = undefined
  // Load UI code alongside the record, not as another serial wait afterward.
  void (
    activePath.value.includes('/workflows/')
      ? loadWorkflowPage()
      : loadModelPage()
  ).catch(() => undefined)
  try {
    const result = await fetchCatalogDetail(
      activePath.value,
      locale,
      AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    )
    if (current !== sequence || controller.signal.aborted) return
    page.value = result
    document.title = `${result.model.name} - Comfy`
  } catch (error) {
    if (current !== sequence || controller.signal.aborted) return
    failed.value = true
    missing.value = error instanceof Error && error.message === 'not-found'
  }
}
function restoreDetail(event: PopStateEvent) {
  if (parentNavigation || !catalogDetailPath(location.pathname)) return false
  event.stopImmediatePropagation()
  activePreview.value = undefined
  activePath.value = location.pathname
  return true
}
function refreshVisible() {
  if (
    document.visibilityState === 'hidden' ||
    workshopRunInFlight.value ||
    location.pathname.replace(/\/$/, '') !== activePath.value.replace(/\/$/, '')
  )
    return
  activePreview.value = undefined
  void load()
}
function restorePage(event: PageTransitionEvent) {
  if (event.persisted) refreshVisible()
}
let stopHistory: (() => void) | undefined
onMounted(() => {
  void load()
  stopHistory = listenCatalogHistory(restoreDetail)
  window.addEventListener('focus', refreshVisible)
  window.addEventListener('pageshow', restorePage)
  document.addEventListener('visibilitychange', refreshVisible)
})
watch(
  () => path,
  (value) => {
    activePreview.value = preview
    activePath.value = value
  }
)
watch(activePath, load)
onScopeDispose(() => {
  sequence++
  request?.abort()
  stopHistory?.()
  window.removeEventListener('focus', refreshVisible)
  window.removeEventListener('pageshow', restorePage)
  document.removeEventListener('visibilitychange', refreshVisible)
})
</script>

<template>
  <article
    class="mx-auto min-h-[70vh] max-w-10xl px-6 pt-5 pb-20 lg:px-8"
    data-testid="catalog-detail-page"
  >
    <CatalogueBackLink
      :catalogue="browsePath"
      :locale
      :fallback="
        activePath.includes('/workflows/')
          ? t('workshop.catalogue.backToWorkflows')
          : undefined
      "
      class="mb-7 min-h-11"
      @click="browseNavigation?.($event)"
    />
    <div v-if="page?.canEdit && page.catalogUID" class="flex justify-end">
      <a
        :href="`/admin/content/${page.catalogUID}/edit`"
        data-astro-reload
        class="rounded-lg border border-primary-comfy-yellow/40 px-4 py-2 text-sm text-primary-comfy-yellow"
        >{{ t('cmsEditor.edit') }}</a
      >
    </div>
    <CatalogDetailHeading
      :model="currentModel"
      :missing
      :workflow="activePath.includes('/workflows/')"
      :locale
    />
    <div
      v-if="failed"
      role="alert"
      class="rounded-2xl bg-hub-surface p-6 text-primary-warm-gray"
    >
      <p>
        {{ t(missing ? 'cccCatalogPage.notFound' : 'workshop.load.failed') }}
      </p>
      <button
        v-if="!missing"
        class="mt-4 text-primary-comfy-yellow"
        @click="load"
      >
        {{ t('cccCatalogPage.retry') }}
      </button>
    </div>
    <WorkflowPage
      v-else-if="workflow"
      :key="workflow.slug"
      :model="workflow"
      embedded
    />
    <ModelPage
      v-else-if="routerPage"
      :key="routerPage.model.slug"
      :page="routerPage"
      :locale
      embedded
    />
    <LocalModelPage
      v-else-if="localModel"
      :model="localModel"
      :locale
      embedded
    />
    <section
      v-else
      :aria-label="t('workshop.load.pending')"
      aria-busy="true"
      class="grid gap-6 lg:grid-cols-[2fr_1fr]"
    >
      <div
        class="min-h-96 rounded-2xl bg-hub-surface p-6 text-primary-warm-gray"
        role="status"
      >
        {{ t('workshop.load.pending') }}
      </div>
      <div class="min-h-48 rounded-2xl bg-hub-surface" />
    </section>
  </article>
</template>

<style scoped>
:global(
  main:has([data-testid='catalog-detail-page']) [data-ccc-create-content]
) {
  display: none;
}
</style>
