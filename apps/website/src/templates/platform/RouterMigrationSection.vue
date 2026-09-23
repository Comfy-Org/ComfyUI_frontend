<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'
import { useTimeoutFn } from '@vueuse/core'
import { nextTick, ref, useTemplateRef } from 'vue'

import Button from '../../components/ui/button/Button.vue'
import { ROUTER_MIGRATION_PROMPT } from '../../config/router-migration-prompt'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// Interactive: inert until its host island hydrates, so render it under a
// `client:*` directive.
const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type CopyPhase = 'idle' | 'copied' | 'failed'

const phase = ref<CopyPhase>('idle')
const fallback = useTemplateRef<HTMLTextAreaElement>('fallback')
const promptPreview = ROUTER_MIGRATION_PROMPT.split('\n')[0]

const { start: scheduleReset } = useTimeoutFn(
  () => {
    phase.value = 'idle'
  },
  2000,
  { immediate: false }
)

// `useClipboard` cannot report failure: when `writeText` rejects it falls
// back to `execCommand` and reports "copied" whatever that returned. The
// manual-copy fallback needs the real outcome, so the write is done here.
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return legacyCopy(text)
  }
}

function legacyCopy(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false
  const scratch = document.createElement('textarea')
  scratch.value = text
  scratch.setAttribute('readonly', '')
  scratch.style.position = 'absolute'
  scratch.style.opacity = '0'
  document.body.appendChild(scratch)
  scratch.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    scratch.remove()
  }
}

function selectFallback() {
  fallback.value?.focus()
  fallback.value?.select()
}

async function copyPrompt() {
  const copied = await writeToClipboard(ROUTER_MIGRATION_PROMPT)
  phase.value = copied ? 'copied' : 'failed'
  if (copied) {
    scheduleReset()
    return
  }
  await nextTick()
  selectFallback()
}
</script>

<template>
  <section
    class="mx-auto max-w-9xl px-6 pb-16 md:pb-24 lg:px-16"
    aria-labelledby="router-migration-heading"
  >
    <div
      class="rounded-3xl border border-white/10 bg-transparency-white-t4 p-6 lg:px-8"
    >
      <div
        class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-12"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <h2
            id="router-migration-heading"
            class="text-xl/7 font-light tracking-tight text-primary-comfy-canvas lg:text-2xl/8"
          >
            {{ t('platform.routerMigration.heading', locale) }}
          </h2>
          <p
            aria-hidden="true"
            class="flex items-center gap-3 overflow-hidden font-mono text-xs/none whitespace-nowrap text-primary-comfy-canvas/40"
          >
            <span class="shrink-0 text-primary-comfy-yellow/70">&gt;</span>
            <span class="min-w-0 overflow-hidden mask-r-from-40%">
              {{ promptPreview }}
            </span>
          </p>
        </div>
        <Button
          type="button"
          class="shrink-0 self-start lg:self-auto"
          @click="copyPrompt"
        >
          <template #prepend>
            <span class="relative grid size-4 shrink-0 place-items-center">
              <Copy
                aria-hidden="true"
                :class="
                  cn(
                    'col-start-1 row-start-1 size-4 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
                    phase === 'copied' && 'scale-25 opacity-0 blur-xs'
                  )
                "
              />
              <Check
                aria-hidden="true"
                :stroke-width="2.5"
                :class="
                  cn(
                    'col-start-1 row-start-1 size-5 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
                    phase !== 'copied' && 'scale-25 opacity-0 blur-xs'
                  )
                "
              />
            </span>
          </template>
          <span class="grid overflow-hidden">
            <span
              :aria-hidden="phase === 'copied'"
              :class="
                cn(
                  'col-start-1 row-start-1 transition-[translate,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                  phase === 'copied' && '-translate-y-full opacity-0'
                )
              "
            >
              {{
                phase === 'failed'
                  ? t('platform.routerMigration.retry', locale)
                  : t('platform.routerMigration.copy', locale)
              }}
            </span>
            <span
              :aria-hidden="phase !== 'copied'"
              :class="
                cn(
                  'col-start-1 row-start-1 text-center transition-[translate,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                  phase !== 'copied' && 'translate-y-full opacity-0'
                )
              "
            >
              {{ t('platform.routerMigration.copied', locale) }}
            </span>
          </span>
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        :class="
          phase === 'failed'
            ? 'mt-6 text-sm text-primary-comfy-canvas'
            : 'sr-only'
        "
      >
        {{
          phase === 'copied'
            ? t('platform.routerMigration.copied', locale)
            : phase === 'failed'
              ? t('platform.routerMigration.failed', locale)
              : ''
        }}
      </p>

      <div v-if="phase === 'failed'" class="mt-3">
        <textarea
          ref="fallback"
          :value="ROUTER_MIGRATION_PROMPT"
          :aria-label="t('platform.routerMigration.promptLabel', locale)"
          readonly
          rows="12"
          class="w-full resize-y rounded-2xl border border-primary-comfy-canvas/10 bg-black p-4 font-mono text-xs/relaxed text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          @focus="fallback?.select()"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="mt-3"
          @click="selectFallback"
        >
          {{ t('platform.routerMigration.selectAll', locale) }}
        </Button>
      </div>
    </div>
  </section>
</template>
