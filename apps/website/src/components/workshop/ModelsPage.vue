<script setup lang="ts">
import { useEventListener, useMounted } from '@vueuse/core'
import { WORKSHOP_INCLUDED } from 'astro:env/client'
import {
  computed,
  defineAsyncComponent,
  h,
  inject,
  onScopeDispose,
  shallowRef,
  watch
} from 'vue'
import type { Component, FunctionalComponent } from 'vue'

import { isWorkflowSlug } from '@/config/models-catalogue'
import type { WorkshopModel } from '@/config/models-catalogue'
import { fetchModelsCatalogue } from '@/config/models-catalogue-data'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
import type {
  CatalogListPages,
  CatalogListFacets
} from '@/lib/cms/catalog-list'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'

import type { CatalogueTab } from './CatalogueTabs.vue'
import { cccCatalogueComponents } from './ccc-catalogue-components'
import { skipCatalogueTransition } from './catalogue-transitions'
import { preserveCatalogueMedia } from './persisted-catalogue-media'
import WorkshopGate from './WorkshopGate.vue'
import WorkshopLoading from './WorkshopLoading.vue'
import {
  workshopEyebrowClass,
  workshopHeadingClass
} from './workshopHeadingClasses'

const {
  slug,
  workflowId,
  heading,
  section = 'models',
  initialModels,
  initialCatalogAvailable = false,
  initialHeadings,
  initialPages,
  initialFacets,
  initialSearch,
  locale = 'en'
} = defineProps<{
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
const { t } = translationsFor(locale)
const hasInitialCatalog = computed(
  () => !slug && initialCatalogAvailable && initialModels !== undefined
)
const displayedSection = shallowRef(section)
watch(
  () => section,
  (value) => {
    displayedSection.value = value
  }
)
const displayedHeading = computed(() => {
  if (displayedSection.value === section) return heading
  return initialHeadings?.[displayedSection.value] ?? heading
})

const loadingLabel = t('workshop.load.pending')
const isWorkflow = computed(() => (slug ? isWorkflowSlug(slug) : false))
const mounted = useMounted()
function displaySection(value: CatalogueTab) {
  displayedSection.value = value
  if (!hasInitialCatalog.value || !mounted.value) return
  const type =
    value === 'models' ? 'model' : value === 'workflows' ? 'workflow' : 'app'
  document
    .querySelectorAll<HTMLAnchorElement>('a[data-ccc-create-content]')
    .forEach((anchor) => {
      anchor.href = `/admin/content/new?type=${type}`
    })
}
const catalogueRevision = shallowRef(0)
const catalogueSearch = shallowRef(initialSearch)
watch(
  () => initialSearch,
  (search) => {
    catalogueSearch.value = search
  }
)
useEventListener<DocumentEventMap['astro:before-swap']>(
  () => (mounted.value ? document : undefined),
  'astro:before-swap',
  (event) => {
    if (slug) return
    if (hasInitialCatalog.value) {
      const island = document.querySelector<HTMLElement>(
        'astro-island[data-astro-transition-persist^="ccc-hub-catalogue-"]'
      )
      if (island) {
        skipCatalogueTransition(event, island)
        preserveCatalogueMedia(event, island)
      }
    }
    catalogueSearch.value = event.to.search
    if (event.from.pathname !== event.to.pathname) return
    document.addEventListener(
      'astro:after-swap',
      () => catalogueRevision.value++,
      { once: true }
    )
  }
)
const enabled = useWorkshopEnabled()
const settled = useWorkshopEnabledSettled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const appsEnabled = useWorkshopAppsEnabled()
const gateAllows = computed(() => {
  if (isWorkflow.value || section === 'workflows') return workflowsEnabled.value
  return section === 'apps' ? appsEnabled.value : undefined
})
const catalogueView = computed(() => {
  if (hasInitialCatalog.value) return 'granted'
  if (!mounted.value || (section !== 'models' && !settled.value))
    return 'loading'
  return section === 'models' || (enabled.value && gateAllows.value)
    ? 'granted'
    : 'denied'
})
// Inside a category the category's own title carries the page, so the hub's
// eyebrow and heading give up their space to it. They stay in the document
// rather than leaving: the page keeps the one heading it is supposed to have,
// and the category reads as the section of it that it is.
const inSection = shallowRef(false)
const recoveringWorkflow = shallowRef(false)
const savedWorkflow = shallowRef(false)
const session =
  WORKSHOP_INCLUDED && workflowId ? useWorkshopSession().session : undefined
watch(
  [
    () => workflowId,
    () => session?.value?.uid,
    () => session?.value?.workspace.id
  ],
  async ([id, uid, workspaceId], _, onCleanup) => {
    savedWorkflow.value = false
    let current = true
    onCleanup(() => {
      current = false
    })
    if (!id || !uid || !workspaceId) return
    try {
      const { workflowStorage } =
        await import('@/config/workshop-workflow-storage')
      if (current)
        savedWorkflow.value = Boolean(
          workflowStorage(
            sessionStorage,
            JSON.stringify([uid, workspaceId]),
            id
          ).read()
        )
    } catch {
      return
    }
  },
  { immediate: true }
)

let legacyForward: AbortController | undefined
onScopeDispose(() => legacyForward?.abort())

async function forwardLegacyLink(): Promise<void> {
  const href = location.href
  if (section !== 'models' || !new URL(href).searchParams.has('type')) return
  legacyForward?.abort()
  legacyForward = new AbortController()
  const { signal } = legacyForward
  const { forwardLegacySection } = await import('./forwardLegacySection')
  await forwardLegacySection(href, signal)
}

const Loading: FunctionalComponent = () =>
  h(WorkshopLoading, { label: loadingLabel, 'data-testid': 'models-loading' })

const LoadError: FunctionalComponent<{ error?: unknown }> = () =>
  h(
    'div',
    {
      role: 'alert',
      class:
        'flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center text-primary-warm-white',
      'data-testid': 'models-load-error'
    },
    [
      h('p', { class: 'text-lg' }, t('workshop.load.failed')),
      h(
        'button',
        {
          type: 'button',
          class:
            'bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 h-11 cursor-pointer rounded-2xl px-6 text-sm font-bold text-primary-comfy-ink',
          'data-testid': 'models-retry',
          onClick: () => {
            Content.value = createContent()
          }
        },
        t('workshop.error.retry')
      )
    ]
  )
LoadError.props = ['error']

function updateSearch(search: string) {
  if (!hasInitialCatalog.value || !initialPages) return
  const url = new URL(location.href)
  url.search = search
  document.dispatchEvent(
    new CustomEvent('ccc:catalog-search', { detail: url.pathname + url.search })
  )
}

const suppliedComponents = inject(cccCatalogueComponents, undefined)

function renderCatalogue(
  component: Component,
  models?: readonly WorkshopModel[]
) {
  return h(
    'div',
    {
      class: 'max-w-10xl mx-auto px-6 pb-16 max-sm:pb-10 lg:px-8 lg:pb-24'
    },
    [
      h(component, {
        key: hasInitialCatalog.value
          ? 'ccc-hub-catalogue'
          : `${section}:${catalogueRevision.value}`,
        initialSearch: catalogueSearch.value,
        pages: initialPages,
        facets: initialFacets,
        onSearch: updateSearch,
        onSection: (open: boolean) => {
          inSection.value = open
        },
        models: hasInitialCatalog.value
          ? (initialModels ?? [])
          : (models ?? []).filter(
              (model) =>
                model.routerId !== undefined ||
                model.type === 'APP' ||
                workflowsEnabled.value
            ),
        locale,
        optimisticNavigation: hasInitialCatalog.value,
        onDisplayedSection: displaySection,
        section
      })
    ]
  )
}

function createContent() {
  if (hasInitialCatalog.value && suppliedComponents) {
    const catalogue = suppliedComponents.catalogue
    return () => renderCatalogue(catalogue)
  }
  return defineAsyncComponent({
    loader: async () => {
      if (slug) {
        const preload = isWorkflowSlug(slug)
          ? import('./WorkflowPage.vue')
          : import('./ModelPage.vue')
        void preload.catch(() => undefined)
        const { fetchModelsPage } = await import('@/config/models-page-data')
        const { model, ...page } = await fetchModelsPage(slug)
        if (model.routerId === undefined) {
          const { default: WorkflowPage } = await import('./WorkflowPage.vue')
          return () =>
            h(WorkflowPage, {
              model,
              onRecovery: (active: boolean) => {
                recoveringWorkflow.value = active
              }
            })
        }
        const { default: ModelPage } = await import('./ModelPage.vue')
        return () => h(ModelPage, { page: { ...page, model } })
      }
      const forwarding = hasInitialCatalog.value
        ? Promise.resolve()
        : forwardLegacyLink()
      const catalogue = Promise.all([
        import('./ModelsCatalogue.vue'),
        hasInitialCatalog.value && initialModels !== undefined
          ? undefined
          : fetchModelsCatalogue()
      ])
      void catalogue.catch(() => undefined)
      await forwarding
      const [{ default: ModelsCatalogue }, models] = await catalogue
      return () => renderCatalogue(ModelsCatalogue, models)
    },
    loadingComponent: Loading,
    errorComponent: LoadError,
    onError: (_error, retry, fail, attempts) => {
      if (attempts <= 1) retry()
      else fail()
    },
    delay: 0
  })
}

const Content = shallowRef(createContent())
watch(hasInitialCatalog, () => {
  Content.value = createContent()
})
</script>

<template>
  <template v-if="!slug">
    <div
      v-if="displayedHeading && catalogueView !== 'denied'"
      class="mx-auto max-w-10xl px-6 pt-8 max-sm:pt-5 lg:px-8 lg:pt-12"
    >
      <div
        data-testid="workshop-heading"
        :class="inSection ? 'sr-only' : 'animate-soft-in pb-4 sm:short:pb-3'"
      >
        <p :class="workshopEyebrowClass">
          {{ t('workshop.catalogue.eyebrow') }}
        </p>
        <h1 :class="workshopHeadingClass">{{ displayedHeading }}</h1>
      </div>
    </div>
    <component :is="Content" v-if="catalogueView === 'granted'" />
    <WorkshopLoading
      v-else-if="catalogueView === 'loading'"
      :label="loadingLabel"
    />
    <slot v-else name="fallback" />
  </template>
  <WorkshopGate
    v-else-if="gateAllows !== undefined"
    :keep-mounted="isWorkflow"
    :allowed="gateAllows"
    :retain-granted="recoveringWorkflow"
    :allow-recovery="savedWorkflow"
  >
    <component :is="Content" />
    <template #loading>
      <WorkshopLoading :label="loadingLabel" />
    </template>
    <template #fallback>
      <slot name="fallback" />
    </template>
  </WorkshopGate>
  <component :is="Content" v-else-if="mounted" />
  <WorkshopLoading v-else :label="loadingLabel" />
</template>
