<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useAppModeStore } from '@/stores/appModeStore'
import ApiEndpointsSection from './ApiEndpointsSection.vue'
import ApiParametersSection from './ApiParametersSection.vue'
import ApiResponseSection from './ApiResponseSection.vue'
import ApiSnippetsCard from './ApiSnippetsCard.vue'
import ApiTestPanel from './ApiTestPanel.vue'
import { buildLlmSummary } from './llmSummary'
import { buildOpenApiDocument } from './openApiDocument'
import { useApiSpec } from './useApiSpec'

const { t } = useI18n()
const router = useRouter()
const appModeStore = useAppModeStore()
const { copyToClipboard } = useCopyToClipboard()

const spec = useApiSpec()

const API_DOCS_URL = 'https://docs.comfy.org'

function onOpenApiDocs() {
  window.open(API_DOCS_URL, '_blank', 'noopener')
}

async function onOpenLogs() {
  await router.push({ name: 'ApiLogsView' })
}

async function onCopySchema() {
  await copyToClipboard(
    JSON.stringify(buildOpenApiDocument(spec.value), null, 2)
  )
}

async function onCopyLlmSummary() {
  await copyToClipboard(buildLlmSummary(spec.value))
}

function onOpenLlmSummary() {
  const blob = new Blob([buildLlmSummary(spec.value)], {
    type: 'text/plain;charset=utf-8'
  })
  window.open(URL.createObjectURL(blob), '_blank')
}
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="m-0 truncate text-2xl font-bold text-base-foreground">
          {{ spec.title }}
        </h1>
        <p class="mt-1 mb-0 text-sm text-muted-foreground">
          {{ t('apiBuilder.pageSubtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="lg" @click="onCopySchema">
          <i class="icon-[lucide--file-json]" aria-hidden="true" />
          {{ t('apiBuilder.copySchema') }}
        </Button>
        <ButtonGroup class="rounded-lg">
          <Button variant="secondary" size="lg" @click="onCopyLlmSummary">
            <i class="icon-[lucide--file-text]" aria-hidden="true" />
            {{ t('apiBuilder.llmsLabel') }}
          </Button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <Button
                variant="secondary"
                size="lg"
                :aria-label="t('apiBuilder.llmsMenu')"
                class="w-7 rounded-l-none border-l border-border-default px-0"
              >
                <i
                  class="icon-[lucide--chevron-down] size-4"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                align="end"
                :side-offset="4"
                class="z-1001 min-w-44 rounded-lg border border-border-subtle bg-base-background p-1 shadow-interface"
              >
                <DropdownMenuItem as-child @select="onOpenLlmSummary">
                  <Button
                    variant="textonly"
                    size="lg"
                    class="w-full justify-start font-normal"
                  >
                    <i
                      class="icon-[lucide--external-link]"
                      aria-hidden="true"
                    />
                    {{ t('apiBuilder.openMarkdown') }}
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuItem as-child @select="onCopyLlmSummary">
                  <Button
                    variant="textonly"
                    size="lg"
                    class="w-full justify-start font-normal"
                  >
                    <i class="icon-[lucide--copy]" aria-hidden="true" />
                    {{ t('apiBuilder.copyMarkdown') }}
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </ButtonGroup>
        <Button variant="secondary" size="lg" @click="onOpenApiDocs">
          <i class="icon-[lucide--book-open]" aria-hidden="true" />
          {{ t('apiBuilder.apiDocs') }}
        </Button>
        <Button variant="secondary" size="lg" @click="onOpenLogs">
          <i class="icon-[lucide--scroll-text]" aria-hidden="true" />
          {{ t('apiBuilder.logs') }}
        </Button>
        <Button
          variant="inverted"
          size="lg"
          @click="appModeStore.enterBuilder('api')"
        >
          <i class="icon-[lucide--hammer]" aria-hidden="true" />
          {{ t('apiBuilder.editApi') }}
        </Button>
      </div>
    </header>
    <div class="flex flex-col items-start gap-6 lg:flex-row">
      <div class="flex w-full min-w-0 flex-1 flex-col gap-6">
        <ApiEndpointsSection :spec />
        <ApiParametersSection :parameters="spec.parameters" />
        <ApiSnippetsCard :spec />
        <ApiResponseSection :spec />
      </div>
      <ApiTestPanel class="top-6 w-full shrink-0 lg:sticky lg:w-96" />
    </div>
  </div>
</template>
