<template>
  <div class="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
    <!-- Frontend-only reassurance + onboarding hint when no key -->
    <div
      class="rounded-sm border border-azure-600/40 bg-azure-600/10 px-2.5 py-2 text-xs text-(--fg-color)"
    >
      <p class="leading-snug">
        <span class="font-semibold">{{
          t('agent.settings.frontendOnly')
        }}</span>
        — {{ t('agent.settings.frontendOnlyHint') }}
      </p>
      <p v-if="!apiKey" class="mt-1 leading-snug text-electric-400">
        ⚠️ {{ t('agent.settings.noKeyWarning') }}
      </p>
    </div>

    <!-- Compact 3-field row: API base / API key / Model -->
    <section class="flex flex-col gap-2">
      <label
        for="agent-baseurl"
        class="text-xs font-medium text-muted-foreground"
      >
        {{ t('agent.settings.baseUrl') }}
      </label>
      <input
        id="agent-baseurl"
        v-model="baseURL"
        type="url"
        autocomplete="off"
        spellcheck="false"
        class="border-default rounded-sm border bg-secondary-background px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-(--border-default) focus:outline-none"
        :placeholder="baseUrlPlaceholder"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('agent.settings.baseUrlHint') }}
      </p>

      <label
        for="agent-apikey"
        class="mt-1 text-xs font-medium text-muted-foreground"
      >
        {{ t('agent.settings.apiKey') }}
      </label>
      <input
        id="agent-apikey"
        v-model="apiKey"
        type="password"
        autocomplete="off"
        spellcheck="false"
        class="border-default rounded-sm border bg-secondary-background px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-(--border-default) focus:outline-none"
        :placeholder="apiKeyPlaceholder"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('agent.settings.apiKeyHint') }}
      </p>

      <label
        for="agent-model"
        class="mt-1 text-xs font-medium text-muted-foreground"
      >
        {{ t('agent.settings.model') }}
      </label>
      <input
        id="agent-model"
        v-model="model"
        type="text"
        autocomplete="off"
        spellcheck="false"
        class="border-default rounded-sm border bg-secondary-background px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-(--border-default) focus:outline-none"
        :placeholder="t('agent.settings.modelPlaceholder')"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('agent.settings.modelHint') }}
      </p>
    </section>

    <details class="border-default border-t pt-3 text-sm">
      <summary
        class="cursor-pointer text-xs font-medium text-muted-foreground select-none"
      >
        {{ t('agent.settings.advanced') }}
      </summary>

      <section class="mt-2 flex flex-col gap-1">
        <label
          for="agent-reasoning"
          class="text-xs font-medium text-muted-foreground"
        >
          {{ t('agent.settings.reasoning') }}
        </label>
        <select
          id="agent-reasoning"
          v-model="reasoningEffort"
          class="border-default rounded-sm border bg-secondary-background px-2 py-1.5 text-sm focus:ring-1 focus:ring-(--border-default) focus:outline-none"
        >
          <option value="minimal">
            {{ t('agent.settings.reasoningMinimal') }}
          </option>
          <option value="low">{{ t('agent.settings.reasoningLow') }}</option>
          <option value="medium">
            {{ t('agent.settings.reasoningMedium') }}
          </option>
          <option value="high">
            {{ t('agent.settings.reasoningHigh') }}
          </option>
        </select>
        <p class="text-xs text-muted-foreground">
          {{ t('agent.settings.reasoningHint') }}
        </p>
      </section>

      <section class="mt-3 flex flex-1 flex-col gap-1">
        <label
          for="agent-sysprompt"
          class="text-xs font-medium text-muted-foreground"
        >
          {{ t('agent.settings.systemPrompt') }}
        </label>
        <textarea
          id="agent-sysprompt"
          v-model="systemPromptAppend"
          rows="6"
          class="border-default flex-1 resize-none rounded-sm border bg-secondary-background px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-(--border-default) focus:outline-none"
          :placeholder="t('agent.settings.systemPromptPlaceholder')"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('agent.settings.systemPromptHint') }}
        </p>
      </section>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAgentSession } from '../composables/useAgentSession'

const { t } = useI18n()
const { apiKey, baseURL, model, reasoningEffort, systemPromptAppend } =
  useAgentSession()

const apiKeyPlaceholder = computed(() =>
  apiKey.value ? '•••••• (stored)' : 'sk-... or sk-or-...'
)
const baseUrlPlaceholder = computed(
  () => 'https://api.openai.com/v1  (default — leave blank for OpenAI)'
)
</script>
