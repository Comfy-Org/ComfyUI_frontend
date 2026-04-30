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
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          class="text-azure-400 underline hover:text-azure-300"
          >{{ t('agent.settings.apiKeyLinkOpenAI') }}</a
        >
        {{ t('agent.settings.apiKeyOr') }}
        <a
          href="https://openrouter.ai/workspaces/default/keys"
          target="_blank"
          rel="noopener noreferrer"
          class="text-azure-400 underline hover:text-azure-300"
          >{{ t('agent.settings.apiKeyLinkOpenRouter') }}</a
        >
        {{ t('agent.settings.apiKeyOrAny') }}
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

    <!-- Local agent bridge -->
    <section class="border-default border-t pt-3">
      <p class="mb-1.5 text-xs font-medium text-muted-foreground">
        {{ t('agent.settings.localBridge') }}
      </p>
      <div class="flex items-center gap-2">
        <span
          :class="
            cn(
              'inline-flex size-2 shrink-0 rounded-full',
              connected ? 'bg-emerald-400' : 'bg-muted-foreground/40'
            )
          "
        />
        <span class="text-xs text-muted-foreground">
          {{
            connected
              ? t('agent.settings.bridgeConnected')
              : t('agent.settings.bridgeDisconnected')
          }}
        </span>
        <button
          v-if="connected && !activePairCode"
          class="ml-auto rounded-sm border border-azure-600/40 bg-azure-600/10 px-2 py-0.5 text-xs text-azure-400 hover:bg-azure-600/20"
          @click="requestPair()"
        >
          {{ t('agent.settings.bridgePair') }}
        </button>
      </div>
      <div
        v-if="activePairCode"
        class="border-default mt-2 rounded-sm border bg-secondary-background/60 p-2 text-xs"
      >
        <p class="mb-1 text-muted-foreground">
          {{ t('agent.settings.bridgePairHint') }}
        </p>
        <code class="block font-mono break-all text-azure-300 select-all"
          >comfy-ai pair http://127.0.0.1:7437/pair/{{ activePairCode }}</code
        >
        <p class="mt-1.5 text-muted-foreground/70">
          {{ t('agent.settings.bridgePairWaiting') }}
        </p>
      </div>
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

import { cn } from '@comfyorg/tailwind-utils'

import { useBridgeStatus } from '../composables/useLocalBridge'
import { useAgentSession } from '../composables/useAgentSession'

const { t } = useI18n()
const { apiKey, baseURL, model, reasoningEffort, systemPromptAppend } =
  useAgentSession()
const { connected, activePairCode, requestPair } = useBridgeStatus()

const apiKeyPlaceholder = computed(() =>
  apiKey.value ? '•••••• (stored)' : 'sk-... or sk-or-...'
)
const baseUrlPlaceholder = computed(
  () => 'https://api.openai.com/v1  (default — leave blank for OpenAI)'
)
</script>
