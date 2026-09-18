<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { LOCALES, isLocale } from '../../config/locales'
import type { Locale } from '../../config/locales'
import { t } from '../../i18n/translations'
import type { Alternate } from '../../utils/hreflangRoutes'

/**
 * Switching language on the page you are reading, as plain links.
 *
 * Built from the page's own hreflang alternates rather than from a list of its
 * own, so the switcher offers exactly what the site advertises to crawlers. The
 * two cannot drift apart, and the switcher widens on its own as more routes are
 * published — which is the whole shape of this feature: one predicate, read by
 * every surface.
 *
 * Links, never a toggle. A language is a different URL, so it has to be
 * navigable, shareable, and followable by a crawler.
 *
 * `data-astro-reload` because a language change is a document change, not a
 * client-side swap. ClientRouter would swap the DOM without re-evaluating any
 * module, and in production the browser loads only its own page dictionary — an
 * English reader never downloads Chinese. Crossing locales that way left the
 * new page asking for a dictionary that was never fetched, so `t()` threw and
 * the page looked broken until a refresh.
 */
const { locale, alternates } = defineProps<{
  locale: Locale
  alternates: readonly Alternate[]
}>()

/**
 * The path an alternate points at, or nothing if its URL will not parse.
 *
 * This component renders in the footer of every page, so an unparseable
 * alternate that threw would take the whole site down rather than cost one
 * language its link. The hreflang builder emits absolute URLs, so nothing
 * reaches the failure today; it is guarded because the blast radius is every
 * page, and a switcher missing an option is visible where a crash is an outage.
 */
function pathOf(href: string): string | undefined {
  try {
    return new URL(href).pathname
  } catch {
    return undefined
  }
}

// `flatMap` rather than filter-then-map so `isLocale` does the narrowing it was
// written for. Filtering leaves the element type unchanged, which is why this
// used to assert `as Locale` twice to read a list it had already checked.
const languages = computed(() =>
  alternates.flatMap((alternate) => {
    if (!isLocale(alternate.hreflang)) return []
    // Relative, so the link works on any origin — preview deploys included.
    const href = pathOf(alternate.href)
    if (href === undefined) return []
    return [
      {
        code: alternate.hreflang,
        href,
        label: LOCALES[alternate.hreflang].nativeName
      }
    ]
  })
)

// One entry means the page exists in one language, so there is nothing to
// switch to and a control would be a dead end.
const hasChoice = computed(() => languages.value.length > 1)
</script>

<template>
  <nav v-if="hasChoice" :aria-label="t('footer.language', locale)">
    <ul class="flex items-center gap-4">
      <li v-for="language in languages" :key="language.code">
        <a
          :href="language.href"
          :hreflang="language.code"
          data-astro-reload
          :lang="language.code"
          :aria-current="language.code === locale ? 'true' : undefined"
          :class="
            cn(
              'text-sm',
              language.code === locale
                ? 'underline underline-offset-4'
                : 'hover:underline hover:underline-offset-4'
            )
          "
        >
          {{ language.label }}
        </a>
      </li>
    </ul>
  </nav>
</template>
