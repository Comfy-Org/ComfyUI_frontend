<script setup lang="ts">
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

const languages = alternates
  .filter((alternate) => isLocale(alternate.hreflang))
  .map((alternate) => ({
    code: alternate.hreflang as Locale,
    // Relative, so the link works on any origin — preview deploys included.
    href: new URL(alternate.href).pathname,
    label: LOCALES[alternate.hreflang as Locale].nativeName
  }))

// One entry means the page exists in one language, so there is nothing to
// switch to and a control would be a dead end.
const hasChoice = languages.length > 1
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
            language.code === locale
              ? 'text-sm underline underline-offset-4'
              : 'text-sm hover:underline hover:underline-offset-4'
          "
        >
          {{ language.label }}
        </a>
      </li>
    </ul>
  </nav>
</template>
