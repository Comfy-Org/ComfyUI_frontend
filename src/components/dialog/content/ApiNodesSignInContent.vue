<template>
  <div
    data-testid="api-signin-dialog"
    class="relative flex w-[min(44rem,90vw)] overflow-hidden rounded-lg bg-base-background"
  >
    <div
      class="hidden w-64 shrink-0 bg-linear-to-br from-coral-500 via-coral-500 to-azure-600 sm:block"
      aria-hidden="true"
    />

    <Button
      variant="muted-textonly"
      size="icon-sm"
      class="absolute top-2 right-2 size-6 rounded-sm"
      :aria-label="t('g.close')"
      @click="onCancel?.()"
    >
      <i class="icon-[lucide--x] block size-4 leading-none" />
    </Button>

    <div class="flex min-h-96 flex-1 flex-col gap-4 p-6">
      <div class="text-2xl font-medium">
        {{ t('apiNodesSignInDialog.title') }}
      </div>

      <div class="text-sm text-muted-foreground">
        {{ t('apiNodesSignInDialog.message') }}
      </div>

      <template v-if="apiNodeNames.length">
        <div class="text-xs text-muted-foreground">
          {{ t('apiNodesSignInDialog.partnerNodesInWorkflow') }}
        </div>
        <ul
          class="m-0 flex max-h-48 list-none flex-col gap-2 overflow-y-auto p-0"
        >
          <li
            v-for="name in apiNodeNames"
            :key="name"
            class="flex items-center gap-2 rounded-lg bg-secondary-background px-3 py-2 text-sm"
          >
            <i
              class="icon-[tabler--crown-filled] size-4 shrink-0 text-brand-yellow"
              aria-hidden="true"
            />
            {{ displayNameFor(name) }}
          </li>
        </ul>
      </template>

      <div class="mt-auto flex items-center justify-between gap-4 pt-4">
        <a
          :href="partnerNodesDocsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-base-foreground"
        >
          <i class="icon-[lucide--info] size-4" aria-hidden="true" />
          {{ t('apiNodesSignInDialog.whatArePartnerNodes') }}
        </a>
        <Button variant="inverted" @click="onLogin?.()">
          {{ t('apiNodesSignInDialog.signIn') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()
const nodeDefStore = useNodeDefStore()

const { apiNodeNames, onLogin, onCancel } = defineProps<{
  apiNodeNames: string[]
  onLogin?: () => void
  onCancel?: () => void
}>()

const partnerNodesDocsUrl = buildDocsUrl('/tutorials/api-nodes/faq', {
  includeLocale: true
})

const displayNameFor = (name: string) =>
  nodeDefStore.nodeDefsByName[name]?.display_name || name
</script>
