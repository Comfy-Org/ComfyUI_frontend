<template>
  <Card surface="secondary" class="flex items-center justify-between p-4">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="font-medium text-foreground">{{ secret.name }}</span>
        <img
          v-if="providerLogo"
          :src="providerLogo"
          :alt="providerLabel"
          class="size-5"
        />
        <Badge
          v-else-if="secret.provider"
          variant="square"
          severity="muted"
          class="px-2"
        >
          {{ providerLabel }}
        </Badge>
      </div>
      <div class="flex gap-3 text-xs text-muted-foreground">
        <span v-if="createdAtLabel">{{ createdAtLabel }}</span>
        <span v-if="lastUsedLabel">
          {{ lastUsedLabel }}
        </span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <i v-if="loading" class="pi pi-spinner pi-spin text-muted-foreground" />
      <template v-else>
        <Button
          :tooltip="editLabel"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="editLabel"
          :disabled="disabled"
          @click="emit('edit')"
        >
          <i class="pi pi-pen-to-square" />
        </Button>
        <Button
          :tooltip="deleteLabel"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="deleteLabel"
          :disabled="disabled"
          @click="emit('delete')"
        >
          <i class="pi pi-trash" />
        </Button>
      </template>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { parseIsoDateSafe } from '@/utils/dateTimeUtil'

import { getProviderLabel, getProviderLogo } from '../providers'
import type { SecretMetadata } from '../types'

const {
  secret,
  loading = false,
  disabled = false
} = defineProps<{
  secret: SecretMetadata
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { d, t } = useI18n()

const providerLabel = computed(() => getProviderLabel(secret.provider))
const providerLogo = computed(() => getProviderLogo(secret.provider))

function formatIsoDate(iso: string | undefined | null): string {
  const date = parseIsoDateSafe(iso)
  return date ? d(date, { dateStyle: 'medium' }) : ''
}

const createdDate = computed(() => formatIsoDate(secret.created_at))
const lastUsedDate = computed(() => formatIsoDate(secret.last_used_at))
const createdAtLabel = computed(() =>
  createdDate.value
    ? t(
        'secrets.createdAt',
        { date: createdDate.value },
        { escapeParameter: false }
      )
    : ''
)
const lastUsedLabel = computed(() =>
  lastUsedDate.value
    ? t(
        'secrets.lastUsed',
        { date: lastUsedDate.value },
        { escapeParameter: false }
      )
    : ''
)
const editLabel = computed(() => t('g.edit'))
const deleteLabel = computed(() => t('g.delete'))
</script>
