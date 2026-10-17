<script setup lang="ts">
import {
  catalogLocalePrefix,
  withCatalogLocalePrefix
} from '@/config/catalog-locales'
import { isPlainPrimaryClick } from '@/lib/workshop/navigation-intent'
import {
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  watch
} from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import type {
  CatalogListPages,
  CatalogListFacets
} from '@/lib/cms/catalog-list'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { fetchCataloguePage } from '@/lib/cms/catalogue-page-client'
import { workshopRunInFlight } from '@/config/workshop-run-state'
import {
  catalogBrowseNavigation,
  catalogDetailNavigation,
  catalogDetailPath,
  listenCatalogHistory
} from '@/lib/cms/detail-route'
import CatalogDetailPage from './CatalogDetailPage.vue'
import AppCatalogue from './AppCatalogue.vue'
import { cccCatalogueComponents } from './ccc-catalogue-components'
import type { CatalogueTab } from './CatalogueTabs.vue'
import ModelsCatalogue from './ModelsCatalogue.vue'
import ModelsPage from './ModelsPage.vue'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  slug?: string
  workflowId?: string
  heading?: string
  section?: CatalogueTab
  initialModels?: readonly WorkshopModel[]
  initialCatalogAvailable?: boolean
  initialHeadings?: Readonly<Record<CatalogueTab, string>>
  initialPages?: CatalogListPages
  initialFacets?: CatalogListFacets
  initialSearch?: string
  locale?: Locale
}>()

const models = shallowRef(props.initialModels)
const pages = shallowRef(props.initialPages)
const facets = shallowRef(props.initialFacets)
const search = ref(props.initialSearch)
const failed = ref(false)
const revalidating = ref(false)
const { t } = translationsFor(props.locale ?? 'en')
const detail = shallowRef<{ path: string; preview?: WorkshopModel }>()
let browseHref = ''
let browseScroll = 0
let browseTitle = ''
function openDetail(event: MouseEvent, model: WorkshopModel) {
  if (!isPlainPrimaryClick(event)) return
  if (!model.href) return
  const target = new URL(model.href, location.href)
  if (target.origin !== location.origin || !catalogDetailPath(target.pathname))
    return
  target.pathname = withCatalogLocalePrefix(
    target.pathname,
    props.locale ?? 'en'
  )
  event.preventDefault()
  event.stopPropagation()
  if (!detail.value) {
    browseHref = location.pathname + location.search + location.hash
    browseScroll = scrollY
    browseTitle = document.title
  }
  request?.abort()
  sequence++
  revalidating.value = false
  detail.value = { path: target.pathname, preview: model }
  window.history.pushState(
    { ...window.history.state, cccDetailPath: target.pathname },
    '',
    target.pathname + target.search + target.hash
  )
  document.title = `${model.name} - Comfy`
  window.scrollTo({ top: 0, behavior: 'instant' })
}
provide(catalogDetailNavigation, openDetail)
provide(catalogBrowseNavigation, (event) => {
  if (!detail.value || !browseHref || !isPlainPrimaryClick(event)) return
  event.preventDefault()
  event.stopPropagation()
  window.history.pushState(window.history.state, '', browseHref)
  detail.value = undefined
  document.title = browseTitle
  void refreshBrowse(browseScroll)
})
let request: AbortController | undefined
let sequence = 0
watch(
  () => [
    props.initialModels,
    props.initialPages,
    props.initialFacets,
    props.initialSearch
  ],
  () => {
    request?.abort()
    sequence++
    detail.value = undefined
    models.value = props.initialModels
    pages.value = props.initialPages
    facets.value = props.initialFacets
    search.value = props.initialSearch
    failed.value = false
    revalidating.value = false
  }
)

async function updateResults(
  query: string,
  history: 'push' | 'replace' | 'none' = 'replace',
  validate = false
) {
  request?.abort()
  request = new AbortController()
  const current = ++sequence
  revalidating.value = validate
  const target = new URL(location.href)
  target.search = query
  const url = new URL('/models/catalogue.json', location.origin)
  url.search = target.search
  url.searchParams.set('section', props.section ?? 'models')
  url.searchParams.set('format', 'page')
  url.searchParams.set('locale', props.locale ?? 'en')
  failed.value = false
  try {
    const result = await fetchCataloguePage(
      url,
      AbortSignal.any([request.signal, AbortSignal.timeout(10000)])
    )
    if (current !== sequence) return
    applyResults(result, target, history)
    return true
  } catch {
    if (current === sequence && !request.signal.aborted) failed.value = true
    return false
  } finally {
    if (current === sequence) revalidating.value = false
  }
}
function applyResults(
  result: Awaited<ReturnType<typeof fetchCataloguePage>>,
  target: URL,
  history: 'push' | 'replace' | 'none'
) {
  const activePage = result.pages[props.section ?? 'models']
  if (activePage.reset) {
    target.searchParams.delete('cursor')
    target.searchParams.set('p', String(activePage.page))
  }
  models.value = result.models
  pages.value = result.pages
  facets.value = result.facets
  search.value = target.search
  if (history !== 'none' || activePage.reset)
    window.history[`${history === 'none' ? 'replace' : history}State`](
      window.history.state,
      '',
      target.pathname + target.search + target.hash
    )
}
async function refreshBrowse(top = scrollY) {
  if (detail.value || workshopRunInFlight.value) return
  const ready = await updateResults(location.search, 'none', true)
  if (ready && !detail.value)
    requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
}
function restoreResults(event: PopStateEvent) {
  const prefix = catalogLocalePrefix(props.locale ?? 'en')
  if (catalogDetailPath(location.pathname)) {
    event.stopImmediatePropagation()
    detail.value = {
      path: location.pathname,
      preview: models.value?.find(
        (model) =>
          model.href &&
          new URL(model.href, location.origin).pathname === location.pathname
      )
    }
    return true
  }
  if (location.pathname !== `${prefix}/hub/${props.section ?? 'models'}/`)
    return false
  event.stopImmediatePropagation()
  const top = detail.value ? browseScroll : scrollY
  detail.value = undefined
  if (location.pathname + location.search + location.hash === browseHref)
    document.title = browseTitle
  void refreshBrowse(top)
  return true
}
let stopHistory: (() => void) | undefined
function refreshVisible() {
  if (
    document.visibilityState === 'hidden' ||
    detail.value ||
    workshopRunInFlight.value
  )
    return
  const prefix = catalogLocalePrefix(props.locale ?? 'en')
  if (location.pathname === `${prefix}/hub/${props.section ?? 'models'}/`)
    void refreshBrowse()
}
function restorePage(event: PageTransitionEvent) {
  if (event.persisted) refreshVisible()
}
onMounted(() => {
  stopHistory = listenCatalogHistory(restoreResults)
  window.addEventListener('focus', refreshVisible)
  window.addEventListener('pageshow', restorePage)
  document.addEventListener('visibilitychange', refreshVisible)
})
onBeforeUnmount(() => {
  sequence++
  request?.abort()
  stopHistory?.()
  window.removeEventListener('focus', refreshVisible)
  window.removeEventListener('pageshow', restorePage)
  document.removeEventListener('visibilitychange', refreshVisible)
})

provide(cccCatalogueComponents, {
  catalogue: ModelsCatalogue,
  workflows: WorkflowCatalogue,
  apps: AppCatalogue
})
</script>

<template>
  <CatalogDetailPage
    v-if="detail"
    :key="detail.path"
    :path="detail.path"
    :preview="detail.preview"
    :locale="props.locale"
  />
  <div v-show="!detail">
    <p
      v-if="failed"
      role="alert"
      class="mx-auto max-w-10xl px-6 py-3 text-primary-warm-gray"
    >
      {{ t('workshop.load.failed') }}
      <button
        type="button"
        class="ml-3 text-primary-comfy-yellow"
        @click="refreshVisible"
      >
        {{ t('cccCatalogPage.retry') }}
      </button>
    </p>
    <p
      v-if="revalidating"
      role="status"
      class="mx-auto max-w-10xl px-6 py-3 text-primary-warm-gray"
    >
      {{ t('workshop.load.pending') }}
    </p>
    <div v-show="!revalidating && !failed">
      <ModelsPage
        v-bind="$props"
        :initial-models="models"
        :initial-pages="pages"
        :initial-facets="facets"
        :initial-search="search"
        @search="updateResults"
      >
        <template #fallback><slot name="fallback" /></template>
      </ModelsPage>
    </div>
  </div>
</template>
