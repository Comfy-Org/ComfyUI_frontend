<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import type { Component } from 'vue'
import { useMounted } from '@vueuse/core'

import type { Locale } from '../../../i18n/site.ts'
import { t } from '../../../i18n/site.ts'
import { externalLinks, getRoutes } from '../../../config/routes.ts'
import type { WorkshopBuyCreditsTrigger } from '../../../config/workshop-buy-credits.ts'
import { subscribeToWorkshopBuyCredits } from '../../../config/workshop-buy-credits.ts'
import { WORKSHOP_CREDITS_URL } from '../../../config/workshop-env.ts'
import type { WorkshopAccountSource } from '../../../config/workshop-account-source.ts'
import {
  peekWorkshopAccountSource,
  resolveWorkshopAccountSource
} from '../../../config/workshop-account-source.ts'
import {
  useWorkshopAuthFlag,
  useWorkshopEnabled
} from '../../../scripts/posthog.ts'
import GitHubStarBadge from '../GitHubStarBadge.vue'
import HeaderMainDesktop from './HeaderMainDesktop.vue'
import HeaderMainMobile from './HeaderMainMobile.vue'
import LogoContextMenu from './LogoContextMenu.vue'
import Button from '@/components/ui/button/Button.vue'

const {
  locale = 'en',
  githubStars = '',
  workshopInBuild = false
} = defineProps<{
  locale?: Locale
  githubStars?: string
  workshopInBuild?: boolean
}>()
const routes = getRoutes(locale)
const workshopAuthEnabled = useWorkshopAuthFlag()
const workshopEnabled = useWorkshopEnabled()
const mounted = useMounted()
const showWorkshop = computed(
  () => mounted.value && workshopInBuild && workshopEnabled.value
)
const showAccount = computed(
  () => showWorkshop.value && workshopAuthEnabled.value
)
// Each loader waits for the account source, so a visitor the web session
// knows never mounts an island that would start Firebase.
const HeaderAccount = defineAsyncComponent(async () => {
  const [source, firebaseHeader] = await Promise.all([
    resolveWorkshopAccountSource(),
    import('../../workshop/HeaderAccount.vue')
  ])
  return source === 'session'
    ? import('../../workshop/HeaderSessionAccount.vue')
    : firebaseHeader
})
const BuyCreditsDialog = defineAsyncComponent<Component>(async () => {
  const [source, dialog] = await Promise.all([
    resolveWorkshopAccountSource(),
    import('../../workshop/BuyCreditsDialog.vue')
  ])
  return source === 'session' ? { render: () => null } : dialog
})
const buyingCredits = ref(false)
const buyCreditsTrigger = ref<WorkshopBuyCreditsTrigger>('action')
const buyCreditsDialogMounted = ref(false)
let stopBuyCreditsRequests: (() => void) | undefined

function claimCloudCreditsTab(): Window | null {
  try {
    return window.open(
      locale === 'zh-CN' ? '/zh-CN/checkout-opening' : '/checkout-opening',
      '_blank'
    )
  } catch {
    return null
  }
}

function releaseCloudCreditsTab(tab: Window | null): void {
  try {
    tab?.close()
  } catch {
    // A closed or browser-owned tab is already outside this page's control.
  }
}

interface CloudCreditsOpener {
  readonly open: () => void
  readonly release: () => void
}

const openInGesture: CloudCreditsOpener = {
  open: () =>
    window.open(WORKSHOP_CREDITS_URL, '_blank', 'noopener,noreferrer'),
  release: () => {}
}

// Outside the gesture a new tab would be blocked, so a refused placeholder
// falls back to navigating this tab.
const openInThisTab: CloudCreditsOpener = {
  open: () => window.location.assign(WORKSHOP_CREDITS_URL),
  release: () => {}
}

function openInClaimedTab(tab: Window): CloudCreditsOpener {
  return {
    open: () => {
      try {
        tab.opener = null
        tab.location.assign(WORKSHOP_CREDITS_URL)
      } catch {
        releaseCloudCreditsTab(tab)
      }
    },
    release: () => releaseCloudCreditsTab(tab)
  }
}

function routeBuyCredits(
  source: WorkshopAccountSource,
  trigger: WorkshopBuyCreditsTrigger,
  opener: CloudCreditsOpener
): void {
  if (!showAccount.value) {
    opener.release()
    return
  }
  if (source === 'firebase') {
    opener.release()
    buyCreditsTrigger.value = trigger
    buyingCredits.value = true
    return
  }
  // Session accounts buy in Cloud. Only an explicit action can open a tab:
  // an automatic refusal arrives outside a user gesture, so the visible Add
  // credits action stays the recovery instead of a popup the browser drops.
  if (trigger === 'action') opener.open()
}

function handleBuyCreditsRequest(trigger: WorkshopBuyCreditsTrigger): void {
  if (!showAccount.value) return
  const settled = peekWorkshopAccountSource()
  if (settled) {
    routeBuyCredits(settled, trigger, openInGesture)
    return
  }
  // Claim the tab inside the click's gesture; it is released if the source
  // settles on the in-page dialog.
  const tab = trigger === 'action' ? claimCloudCreditsTab() : null
  const opener = tab ? openInClaimedTab(tab) : openInThisTab
  void resolveWorkshopAccountSource().then((source) =>
    routeBuyCredits(source, trigger, opener)
  )
}

onMounted(() => {
  stopBuyCreditsRequests = subscribeToWorkshopBuyCredits(
    handleBuyCreditsRequest
  )
})
onBeforeUnmount(() => stopBuyCreditsRequests?.())
watch(
  showAccount,
  (enabled) => {
    if (enabled) buyCreditsDialogMounted.value = true
  },
  { immediate: true }
)

const ctaButtons = [
  {
    full: t('nav.downloadLocal', {}, { locale: locale }),
    short: t('nav.ctaDesktopCore', {}, { locale: locale }),
    ariaLabel: t('nav.downloadLocal', {}, { locale: locale }),
    href: routes.download,
    primary: false
  },
  {
    full: t('nav.launchCloud', {}, { locale: locale }),
    short: t('nav.ctaCloudCore', {}, { locale: locale }),
    ariaLabel: t('nav.launchCloud', {}, { locale: locale }),
    href: externalLinks.cloudCta('nav_try_cloud'),
    primary: true
  }
]
</script>

<template>
  <nav
    class="sticky top-0 z-50 flex items-center justify-between gap-4 bg-primary-comfy-ink px-6 py-5 lg:gap-4 lg:px-[clamp(0.25rem,4vw,5rem)] lg:py-8"
    aria-label="Main navigation"
  >
    <LogoContextMenu :locale>
      <a
        :href="routes.home"
        class="inline-grid h-10 shrink-0 grid-cols-1 grid-rows-1 transition-[width]"
        aria-label="Comfy home"
      >
        <img
          src="/icons/logomark.svg"
          alt="Comfy"
          class="col-span-full row-span-full h-8"
        />
        <div
          class="relative col-span-full row-span-full h-10 w-0 overflow-clip transition-[width] 2xl:w-36"
        >
          <img
            src="/icons/logo.svg"
            alt="Comfy"
            class="absolute top-0 left-0 h-10 w-36 max-w-none object-contain object-left"
          />
        </div>
      </a>
    </LogoContextMenu>

    <!-- Desktop nav links -->
    <HeaderMainDesktop
      :locale
      :workshop-in-build="showWorkshop"
      :class="showWorkshop ? 'hidden xl:block' : 'hidden lg:block'"
    />
    <div
      data-testid="mobile-nav-cta"
      class="flex shrink-0 items-center gap-2"
      :class="showWorkshop ? 'xl:hidden' : 'lg:hidden'"
    >
      <HeaderAccount v-if="showAccount" :locale="locale" />
      <HeaderMainMobile :locale :workshop-in-build="showWorkshop" />
    </div>

    <!-- Desktop CTA buttons -->
    <div
      data-testid="desktop-nav-cta"
      class="hidden shrink-0 items-center gap-2"
      :class="showWorkshop ? 'xl:flex' : 'lg:flex'"
    >
      <!-- Get Yoland to sign a contract of permission before killing this -->
      <GitHubStarBadge v-if="githubStars" :stars="githubStars" />
      <Button
        v-for="cta in ctaButtons"
        :key="cta.href"
        as="a"
        :href="cta.href"
        :variant="cta.primary ? 'default' : 'outline'"
        :aria-label="cta.ariaLabel"
      >
        <span>
          <span class="hidden min-[1800px]:inline-block">{{ cta.full }}</span>
          <span class="min-[1800px]:hidden">{{ cta.short }}</span>
        </span>
      </Button>
      <HeaderAccount v-if="showAccount" :locale="locale" />
    </div>
  </nav>
  <BuyCreditsDialog
    v-if="buyCreditsDialogMounted"
    v-model:open="buyingCredits"
    :trigger="buyCreditsTrigger"
    :locale
  />
</template>
