<template>
  <div
    data-testid="api-signin-dialog"
    class="relative flex max-h-[85vh] min-h-100 w-[min(44rem,90vw)] items-stretch rounded-3xl border border-border-subtle bg-base-background p-2"
  >
    <Button
      variant="muted-textonly"
      size="icon-sm"
      class="absolute top-4 right-4 size-6 rounded-sm"
      :aria-label="t('g.close')"
      @click="onCancel?.()"
    >
      <i class="icon-[lucide--x] block size-4 leading-none" />
    </Button>

    <img
      src="/assets/images/partner-nodes-signin.webp"
      alt=""
      class="hidden w-74.25 shrink-0 rounded-[20px] object-cover sm:block"
    />

    <div
      class="flex min-w-0 flex-1 flex-col justify-between pt-5 pr-3 pb-2 pl-6"
    >
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-3">
          <h2
            :id="titleId"
            class="m-0 text-[22px] font-semibold text-base-foreground"
          >
            {{ t('apiNodesSignInDialog.title') }}
          </h2>
          <p class="m-0 text-sm/[1.45] text-muted-foreground">
            {{ t('apiNodesSignInDialog.message') }}
          </p>
        </div>

        <div v-if="apiNodeNames.length" class="flex flex-col gap-2">
          <div class="text-xs font-medium text-muted-foreground">
            {{ t('apiNodesSignInDialog.partnerNodesInWorkflow') }}
          </div>
          <ul
            class="m-0 flex max-h-48 list-none flex-col gap-2 overflow-y-auto p-0"
          >
            <li
              v-for="name in apiNodeNames"
              :key="name"
              class="flex items-center gap-2 rounded-lg bg-secondary-background px-3.5 py-2.5 text-sm font-semibold text-base-foreground"
            >
              <i
                class="icon-[tabler--crown-filled] size-4 shrink-0 text-brand-yellow"
                aria-hidden="true"
              />
              <span
                :title="displayNameFor(name)"
                class="min-w-0 flex-1 truncate"
              >
                {{ displayNameFor(name) }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 pt-4"
      >
        <AccessibleTooltip
          :label="t('apiNodesSignInDialog.tooltip')"
          side="bottom"
        >
          <template #trigger>
            <a
              :href="partnerNodesDocsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 text-xs text-muted-foreground no-underline duration-150 hover:text-base-foreground motion-safe:transition-colors"
            >
              <i
                class="icon-[lucide--info] size-4 shrink-0"
                aria-hidden="true"
              />
              <span class="leading-4">
                {{ t('apiNodesSignInDialog.whatArePartnerNodes') }}
              </span>
            </a>
          </template>
        </AccessibleTooltip>
        <Button
          variant="inverted"
          size="unset"
          class="h-9 rounded-lg px-6 text-sm font-medium"
          @click="onLogin?.()"
        >
          {{ t('apiNodesSignInDialog.signIn') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()
const nodeDefStore = useNodeDefStore()

const { apiNodeNames, titleId, onLogin, onCancel } = defineProps<{
  apiNodeNames: string[]
  titleId: string
  onLogin?: () => void
  onCancel?: () => void
}>()

const partnerNodesDocsUrl = buildDocsUrl('/tutorials/api-nodes/faq', {
  includeLocale: true
})

const displayNameFor = (name: string) =>
  nodeDefStore.nodeDefsByName[name]?.display_name || name
</script>
