<script setup lang="ts">
import { CalendarPlus, ChevronDown } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import type { ButtonVariants } from '../ui/button'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CalendarEvent } from '../../utils/calendar'
import {
  toGoogleCalendarUrl,
  toIcsDataUri,
  toOutlookCalendarUrl
} from '../../utils/calendar'
import { resolveRel } from '../../utils/cta'
import Button from '../ui/button/Button.vue'

const {
  event,
  locale = 'en',
  size = 'lg',
  portalDisabled = false
} = defineProps<{
  event: CalendarEvent
  locale?: Locale
  size?: ButtonVariants['size']
  /** Render the menu in place, e.g. inside a top-layer `<dialog>` that would
   * cover a body teleport. */
  portalDisabled?: boolean
}>()

const labels = computed(() => ({
  trigger: t('events.calendar.addToCalendar', locale),
  google: t('events.calendar.google', locale),
  apple: t('events.calendar.apple', locale),
  outlook: t('events.calendar.outlook', locale)
}))

const externalRel = resolveRel({ target: '_blank' })

const icsFileName = computed(
  () =>
    `${event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')}.ics`
)

const itemClass =
  'flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-primary-comfy-canvas outline-none transition-colors select-none hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink focus:bg-primary-comfy-yellow focus:text-primary-comfy-ink'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <!-- Callers that need a different affordance (the events directory's
      compact SAVE THE DATE? chip) replace the trigger; the slot must resolve to
      a single element for `as-child` to forward the menu's props onto it. -->
      <slot name="trigger" :label="labels.trigger">
        <Button
          variant="outline"
          :size
          :prepend-icon="CalendarPlus"
          :append-icon="ChevronDown"
        >
          {{ labels.trigger }}
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal :disabled="portalDisabled">
      <DropdownMenuContent
        align="start"
        :side-offset="8"
        class="bg-site-dropdown border-primary-comfy-ink-light z-50 min-w-56 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuItem as-child>
          <a
            :href="toGoogleCalendarUrl(event)"
            target="_blank"
            :rel="externalRel"
            :class="itemClass"
          >
            {{ labels.google }}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a
            :href="toIcsDataUri(event)"
            :download="icsFileName"
            :class="itemClass"
          >
            {{ labels.apple }}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a
            :href="toOutlookCalendarUrl(event)"
            target="_blank"
            :rel="externalRel"
            :class="itemClass"
          >
            {{ labels.outlook }}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
