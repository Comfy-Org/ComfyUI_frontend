<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { ref } from 'vue'
import type { HTMLAttributes } from 'vue'

import CopyTextButton from '../ui/copy-text-button/CopyTextButton.vue'

type CodeSnippet = {
  id: string
  /** Language tab label, e.g. 'Python'. */
  label: string
  /** Raw source — what the copy button puts on the clipboard. */
  code: string
  /**
   * Syntax-highlighted markup for `code`, produced at build time (Shiki) so
   * no highlighter ships to the client. This is the *inner* markup only —
   * the panel owns the surrounding `<pre>` and its type styles, so pass
   * `<span style="color:#c678dd">import</span> os`, not a full `<pre>`
   * wrapper. Omit it and the panel renders `code` as plain text instead.
   */
  html?: string
}

export type CodeEnv = {
  id: string
  /** Environment tab label, e.g. 'Comfy Cloud'. */
  label: string
  languages: CodeSnippet[]
}

// Interactive: the tabs and copy button are inert until the host island
// hydrates, so render this under a `client:*` directive.
const {
  title,
  subtitle,
  envs,
  copyLabel,
  copiedLabel,
  class: className
} = defineProps<{
  title: string
  subtitle?: string
  envs: CodeEnv[]
  copyLabel: string
  copiedLabel: string
  class?: HTMLAttributes['class']
}>()

const activeEnvId = ref(envs[0]?.id ?? '')

// Each env keeps its own language choice, so switching envs and back does not
// silently reset the reader to Python.
const activeLanguageIds = ref<Record<string, string>>(
  Object.fromEntries(envs.map((env) => [env.id, env.languages[0]?.id ?? '']))
)

/*
 * Every snippet is padded to the tallest one's height so switching env or
 * language tabs never resizes the panel — a resize here shifts the whole
 * hero below it. Line count is an exact height proxy: the <pre> never wraps
 * (long lines scroll horizontally) and all snippets share text-xs/5 type,
 * so rendered height is lines x 1.25rem.
 */
const maxSnippetLines = Math.max(
  0,
  ...envs.flatMap((env) =>
    env.languages.map((lang) => lang.code.split('\n').length)
  )
)
const snippetMinHeight = { minHeight: `${maxSnippetLines * 1.25}rem` }

function snippetFor(env: CodeEnv): CodeSnippet | undefined {
  return (
    env.languages.find((lang) => lang.id === activeLanguageIds.value[env.id]) ??
    env.languages[0]
  )
}
</script>

<template>
  <div
    :class="
      cn(
        'border-code-border bg-code-bg flex flex-col gap-3 overflow-clip rounded-[20px] border px-6 py-5',
        className
      )
    "
  >
    <p class="text-code-fg text-base font-medium">{{ title }}</p>
    <p v-if="subtitle" class="text-code-subtle text-xs">{{ subtitle }}</p>

    <TabsRoot v-model="activeEnvId" activation-mode="manual" class="block">
      <TabsList
        :aria-label="title"
        class="border-code-divider flex scrollbar-none gap-1 overflow-x-auto border-b"
      >
        <TabsTrigger
          v-for="env in envs"
          :key="env.id"
          :value="env.id"
          class="focus-visible:ring-primary-comfy-yellow/50 text-code-muted hover:text-code-fg data-[state=active]:border-code-fg data-[state=active]:text-code-fg -mb-px shrink-0 cursor-pointer border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none data-[state=active]:font-medium"
        >
          {{ env.label }}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="env in envs"
        :key="env.id"
        :value="env.id"
        class="border-code-border bg-code-surface mt-3 block overflow-clip rounded-lg border"
      >
        <TabsRoot
          v-model="activeLanguageIds[env.id]"
          activation-mode="manual"
          class="block"
        >
          <div
            class="border-code-border flex items-center gap-3 border-b px-3 py-2"
          >
            <TabsList
              :aria-label="env.label"
              class="flex scrollbar-none items-center gap-3 overflow-x-auto"
            >
              <TabsTrigger
                v-for="lang in env.languages"
                :key="lang.id"
                :value="lang.id"
                class="focus-visible:ring-primary-comfy-yellow/50 text-code-subtle hover:text-code-fg data-[state=active]:bg-code-divider data-[state=active]:text-code-fg shrink-0 cursor-pointer rounded-lg px-3 py-1 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none data-[state=active]:font-medium"
              >
                {{ lang.label }}
              </TabsTrigger>
            </TabsList>

            <CopyTextButton
              v-if="snippetFor(env)"
              :value="snippetFor(env)!.code"
              :label="copyLabel"
              :copied-label="copiedLabel"
              show-label
              class="text-code-muted hover:text-code-fg ml-auto size-auto gap-1.5 rounded-md text-xs"
            />
          </div>

          <TabsContent
            v-for="lang in env.languages"
            :key="lang.id"
            :value="lang.id"
            class="block overflow-x-auto p-4"
          >
            <!-- `html` is Shiki output generated from `code` at build time by
                 the page that owns this panel — authored content, never user
                 input. -->
            <pre
              v-if="lang.html"
              class="text-code-body font-mono text-xs/5"
              :style="snippetMinHeight"
              v-html="lang.html"
            />
            <pre
              v-else
              class="text-code-body font-mono text-xs/5"
              :style="snippetMinHeight"
              >{{ lang.code }}</pre>
          </TabsContent>
        </TabsRoot>
      </TabsContent>
    </TabsRoot>
  </div>
</template>
