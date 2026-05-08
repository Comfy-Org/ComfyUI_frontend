<template>
  <main class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <section v-if="challenge" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <p class="m-0 text-sm text-muted">
          {{ t('oauth.consent.resourceLabel') }}
        </p>
        <h1 class="m-0 text-2xl font-semibold">
          {{ challenge.client_display_name }}
        </h1>
        <p v-if="challenge.resource_display_name" class="m-0 text-muted">
          {{ challenge.resource_display_name }}
        </p>
      </div>

      <section class="rounded-lg bg-(--p-content-background) p-4">
        <h2 class="mt-0 text-base font-semibold">
          {{ t('oauth.consent.scopesTitle') }}
        </h2>
        <ul class="mb-0 flex flex-col gap-2 pl-5">
          <li v-for="scope in challenge.scopes" :key="scope">
            {{ labelForScope(scope) }}
          </li>
        </ul>
      </section>

      <section class="rounded-lg bg-(--p-content-background) p-4">
        <h2 class="mt-0 text-base font-semibold">
          {{ t('oauth.consent.workspaceTitle') }}
        </h2>
        <p v-if="challenge.workspaces.length === 0" class="text-muted">
          {{ t('oauth.consent.noWorkspaces') }}
        </p>
        <div v-else-if="challenge.workspaces.length === 1">
          <WorkspaceSummary :workspace="challenge.workspaces[0]" />
        </div>
        <fieldset v-else class="m-0 flex flex-col gap-3 border-0 p-0">
          <legend class="sr-only">
            {{ t('oauth.consent.workspaceTitle') }}
          </legend>
          <label
            v-for="workspace in challenge.workspaces"
            :key="workspace.id"
            class="flex cursor-pointer gap-3 rounded-md border border-solid border-muted p-3"
          >
            <input
              v-model="selectedWorkspaceId"
              type="radio"
              name="workspace"
              :value="workspace.id"
            />
            <WorkspaceSummary :workspace />
          </label>
        </fieldset>
      </section>

      <p v-if="errorMessage" role="alert" class="m-0 text-red-500">
        {{ errorMessage }}
      </p>

      <div class="flex gap-3">
        <button
          class="rounded-md bg-neutral-700 px-4 py-2 text-white disabled:opacity-50"
          :disabled="isSubmitting || !canSubmit"
          @click="submit('deny')"
        >
          {{ t('oauth.consent.deny') }}
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          :disabled="isSubmitting || !canSubmit"
          @click="submit('allow')"
        >
          {{ t('oauth.consent.allow') }}
        </button>
      </div>
    </section>

    <p v-else-if="errorMessage" role="alert" class="m-0 text-red-500">
      {{ errorMessage }}
    </p>
    <p v-else class="m-0 text-muted">
      {{ t('oauth.consent.loading') }}
    </p>
  </main>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import {
  fetchOAuthConsentChallenge,
  submitOAuthConsentDecision
} from '@/platform/cloud/oauth/oauthApi'
import type {
  OAuthConsentChallenge,
  OAuthConsentDecision,
  OAuthWorkspace
} from '@/platform/cloud/oauth/oauthApi'
import {
  clearOAuthRequestId,
  getOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'

const { initialChallenge, submitDecision = submitOAuthConsentDecision } =
  defineProps<{
    initialChallenge?: OAuthConsentChallenge
    submitDecision?: OAuthConsentDecision
  }>()

const WorkspaceSummary = (props: { workspace: OAuthWorkspace }) =>
  h('span', { class: 'flex flex-col gap-1' }, [
    h('span', props.workspace.name),
    h('span', { class: 'text-xs text-muted' }, [
      props.workspace.type,
      ' · ',
      props.workspace.role
    ])
  ])

const { t } = useI18n()
const route = useRoute()
const challenge = ref<OAuthConsentChallenge | null>(initialChallenge ?? null)
const selectedWorkspaceId = ref(
  initialChallenge?.workspaces.length === 1
    ? initialChallenge.workspaces[0].id
    : ''
)
const errorMessage = ref('')
const isSubmitting = ref(false)

const selectedWorkspaceIsValid = computed(() => {
  return Boolean(
    challenge.value?.workspaces.some(
      (workspace) => workspace.id === selectedWorkspaceId.value
    )
  )
})

const canSubmit = computed(() => selectedWorkspaceIsValid.value)

function labelForScope(scope: string): string {
  return scope
}

function requestIdFromRoute(): string | null {
  return typeof route.query.oauth_request_id === 'string'
    ? route.query.oauth_request_id
    : getOAuthRequestId()
}

function initializeWorkspaceSelection(nextChallenge: OAuthConsentChallenge) {
  selectedWorkspaceId.value =
    nextChallenge.workspaces.length === 1 ? nextChallenge.workspaces[0].id : ''
}

async function loadChallenge() {
  const oauthRequestId = requestIdFromRoute()
  if (!oauthRequestId) {
    errorMessage.value = t('oauth.consent.missingRequest')
    return
  }

  try {
    const nextChallenge = await fetchOAuthConsentChallenge(oauthRequestId)
    challenge.value = nextChallenge
    initializeWorkspaceSelection(nextChallenge)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t('oauth.consent.genericError')
  }
}

async function submit(decision: 'allow' | 'deny') {
  if (!challenge.value || !selectedWorkspaceIsValid.value) return

  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await submitDecision({
      oauthRequestId: challenge.value.oauth_request_id,
      csrfToken: challenge.value.csrf_token,
      decision,
      workspaceId: selectedWorkspaceId.value
    })
    clearOAuthRequestId()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t('oauth.consent.genericError')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  if (!initialChallenge) {
    void loadChallenge()
  }
})
</script>
