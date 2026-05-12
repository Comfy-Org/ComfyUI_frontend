<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
    <section
      v-if="challenge"
      class="flex flex-col gap-6 rounded-2xl border border-solid border-muted bg-(--p-content-background) p-6 shadow-sm"
    >
      <header class="flex flex-col items-center gap-3 pt-2 text-center">
        <div
          class="flex size-12 items-center justify-center rounded-2xl bg-secondary-background"
        >
          <i
            class="pi pi-key text-xl text-base-foreground"
            aria-hidden="true"
          />
        </div>
        <div class="flex flex-col items-center gap-1.5">
          <h1 class="m-0 text-xl/tight font-semibold">
            {{
              t('oauth.consent.title', {
                client: challenge.client_display_name
              })
            }}
          </h1>
          <p class="m-0 text-sm text-muted">
            {{ t('oauth.consent.subtitle', { resource: resourceName }) }}
          </p>
          <span
            v-if="appTypeBadge"
            class="mt-1 inline-flex items-center gap-1 rounded-full border border-solid border-muted px-2 py-0.5 text-xs text-muted"
          >
            <i :class="appTypeBadge.icon" aria-hidden="true" />
            {{ appTypeBadge.label }}
          </span>
        </div>
      </header>

      <section class="flex flex-col gap-2">
        <p class="m-0 text-sm font-medium">
          {{ t('oauth.consent.workspaceLabel') }}
        </p>
        <div
          v-if="challenge.workspaces.length === 0"
          class="p-3 text-sm text-muted"
        >
          {{ t('oauth.consent.noWorkspaces') }}
        </div>
        <ul
          v-else
          role="radiogroup"
          :aria-label="t('oauth.consent.workspaceLabel')"
          class="m-0 flex scrollbar-custom max-h-72 list-none flex-col gap-1 overflow-y-auto p-0"
        >
          <li v-for="workspace in challenge.workspaces" :key="workspace.id">
            <button
              type="button"
              role="radio"
              :aria-checked="selectedWorkspaceId === workspace.id"
              :class="
                cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-md border-none bg-transparent px-3 py-2 text-left transition-colors',
                  'hover:bg-secondary-background-hover',
                  'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
                  selectedWorkspaceId === workspace.id &&
                    'bg-secondary-background'
                )
              "
              @click="selectedWorkspaceId = workspace.id"
            >
              <WorkspaceProfilePic
                class="size-8 shrink-0 text-sm"
                :workspace-name="workspace.name"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm text-base-foreground">
                  {{ workspace.name }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ workspaceSecondaryLabel(workspace) }}
                </span>
              </div>
              <i
                v-if="selectedWorkspaceId === workspace.id"
                class="pi pi-check shrink-0 text-sm text-base-foreground"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
        <p class="m-0 text-xs text-muted">
          {{ t('oauth.consent.workspaceHelp') }}
        </p>
      </section>

      <section class="flex flex-col gap-3">
        <p class="m-0 text-sm font-medium">
          {{ t('oauth.consent.permissionsHeader') }}
        </p>
        <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
          <li
            v-for="scope in challenge.scopes"
            :key="scope"
            class="flex items-center gap-2"
          >
            <i
              class="pi pi-check shrink-0 text-sm text-primary-background"
              aria-hidden="true"
            />
            <span class="text-sm">
              {{ scopeLabel(scope) }}
            </span>
          </li>
        </ul>
      </section>

      <section
        v-if="challenge.redirect_uri"
        class="flex flex-col gap-1.5 rounded-lg border border-solid border-muted bg-secondary-background/40 p-3"
      >
        <span class="text-xs text-muted">
          {{ t('oauth.consent.redirectNotice') }}
        </span>
        <code
          class="m-0 truncate font-mono text-xs text-base-foreground"
          :title="challenge.redirect_uri"
        >
          {{ challenge.redirect_uri }}
        </code>
      </section>

      <p
        v-if="errorMessage"
        role="alert"
        class="m-0 rounded-md border border-solid border-destructive-background bg-destructive-background/10 p-3 text-sm text-destructive-background"
      >
        {{ errorMessage }}
      </p>

      <footer class="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          class="w-full"
          :loading="isSubmitting && lastDecision === 'allow'"
          :disabled="isSubmitting || !canSubmit"
          @click="submit('allow')"
        >
          {{ t('oauth.consent.allow') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          class="w-full"
          :loading="isSubmitting && lastDecision === 'deny'"
          :disabled="isSubmitting"
          @click="submit('deny')"
        >
          {{ t('oauth.consent.deny') }}
        </Button>
      </footer>
    </section>

    <p
      v-else-if="errorMessage"
      role="alert"
      class="m-0 rounded-md border border-solid border-destructive-background bg-destructive-background/10 p-3 text-center text-sm text-destructive-background"
    >
      {{ errorMessage }}
    </p>
    <p v-else class="m-0 text-center text-sm text-muted">
      {{ t('oauth.consent.loading') }}
    </p>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import {
  OAuthApiError,
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
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { cn } from '@comfyorg/tailwind-utils'

const { initialChallenge, submitDecision = submitOAuthConsentDecision } =
  defineProps<{
    initialChallenge?: OAuthConsentChallenge
    submitDecision?: OAuthConsentDecision
  }>()

const { t, te } = useI18n()
const route = useRoute()
const challenge = ref<OAuthConsentChallenge | null>(initialChallenge ?? null)
const selectedWorkspaceId = ref<string | undefined>(
  initialChallenge?.workspaces.length === 1
    ? initialChallenge.workspaces[0].id
    : undefined
)
const errorMessage = ref('')
const isSubmitting = ref(false)
const lastDecision = ref<'allow' | 'deny' | null>(null)

const resourceName = computed(
  () =>
    challenge.value?.resource_display_name ??
    t('oauth.consent.resourceFallback')
)

const appTypeBadge = computed(() => {
  const appType = challenge.value?.client_application_type
  if (appType === 'native') {
    return { label: t('oauth.consent.appTypeNative'), icon: 'pi pi-desktop' }
  }
  if (appType === 'web') {
    return { label: t('oauth.consent.appTypeWeb'), icon: 'pi pi-globe' }
  }
  return null
})

const selectedWorkspaceIsValid = computed(() =>
  Boolean(
    selectedWorkspaceId.value &&
    challenge.value?.workspaces.some(
      (workspace) => workspace.id === selectedWorkspaceId.value
    )
  )
)

const canSubmit = computed(() => selectedWorkspaceIsValid.value)

function scopeLabel(scope: string): string {
  const key = `oauth.scopes.${scope}.label`
  return te(key) ? t(key) : scope
}

function labelFor(value: string): string {
  const key = `oauth.workspace.${value}`
  return te(key) ? t(key) : value
}

// Row's secondary label: personal workspaces show "Personal" (role is
// always implicit owner); team workspaces show the role ("Owner"/"Member").
function workspaceSecondaryLabel(workspace: OAuthWorkspace): string {
  return workspace.type === 'personal'
    ? labelFor('personal')
    : labelFor(workspace.role)
}

function requestIdFromRoute(): string | null {
  return typeof route.query.oauth_request_id === 'string'
    ? route.query.oauth_request_id
    : getOAuthRequestId()
}

function initializeWorkspaceSelection(nextChallenge: OAuthConsentChallenge) {
  selectedWorkspaceId.value =
    nextChallenge.workspaces.length === 1
      ? nextChallenge.workspaces[0].id
      : undefined
}

async function loadChallenge() {
  const oauthRequestId = requestIdFromRoute()
  if (!oauthRequestId) {
    errorMessage.value = t('oauth.consent.missingRequest')
    return
  }
  try {
    const next = await fetchOAuthConsentChallenge(oauthRequestId)
    challenge.value = next
    initializeWorkspaceSelection(next)
  } catch (error) {
    errorMessage.value = messageForError(error)
  }
}

function messageForError(error: unknown): string {
  if (error instanceof OAuthApiError) {
    if (error.status === 400) return t('oauth.consent.errorExpired')
    if (error.status === 403) return t('oauth.consent.errorScopeBroadening')
    if (error.status === 404) return t('oauth.consent.errorUnavailable')
  }
  return error instanceof Error
    ? error.message
    : t('oauth.consent.genericError')
}

async function submit(decision: 'allow' | 'deny') {
  if (!challenge.value) return
  if (decision === 'allow' && !selectedWorkspaceIsValid.value) return

  errorMessage.value = ''
  isSubmitting.value = true
  lastDecision.value = decision
  try {
    await submitDecision({
      oauthRequestId: challenge.value.oauth_request_id,
      csrfToken: challenge.value.csrf_token,
      decision,
      // Cloud requires workspace_id on both allow and deny.
      workspaceId:
        selectedWorkspaceId.value ?? challenge.value.workspaces[0]?.id ?? ''
    })
    clearOAuthRequestId()
  } catch (error) {
    errorMessage.value = messageForError(error)
  } finally {
    isSubmitting.value = false
    lastDecision.value = null
  }
}

onMounted(() => {
  if (!initialChallenge) {
    void loadChallenge()
  }
})
</script>
