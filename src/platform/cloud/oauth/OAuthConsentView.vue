<template>
  <main class="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
    <section v-if="challenge" class="flex flex-col gap-8">
      <header class="flex flex-col items-center gap-4 text-center">
        <div class="flex items-center gap-4">
          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-white"
          >
            <i
              class="icon-[lucide--app-window] size-8 text-black"
              aria-hidden="true"
              data-testid="client-icon"
            />
          </div>
          <i
            class="icon-[lucide--arrow-left-right] size-6 text-muted"
            aria-hidden="true"
          />
          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-plum-600"
          >
            <i
              class="icon-[comfy--comfy-c] size-8 text-white"
              aria-hidden="true"
            />
          </div>
        </div>
        <div class="flex flex-col items-center gap-2">
          <h1 class="m-0 text-2xl/tight font-semibold text-base-foreground">
            {{
              t('oauth.consent.title', {
                client: challenge.client_display_name
              })
            }}
          </h1>
          <p class="m-0 text-sm text-muted">
            {{ t('oauth.consent.subtitle', { resource: resourceName }) }}
          </p>
        </div>
      </header>

      <section class="flex flex-col gap-2">
        <p class="m-0 text-sm font-medium">
          {{ t('oauth.consent.workspaceLabel') }}
        </p>
        <div
          v-if="challenge.workspaces.length === 0"
          class="rounded-lg bg-ink-400 p-3 text-sm text-muted"
        >
          {{ t('oauth.consent.noWorkspaces') }}
        </div>
        <RadioGroupRoot
          v-else
          v-model="selectedWorkspaceId"
          :aria-label="t('oauth.consent.workspaceLabel')"
          class="m-0 flex scrollbar-custom max-h-72 list-none flex-col divide-y divide-white/10 overflow-hidden overflow-y-auto rounded-lg bg-ink-400 p-0"
        >
          <RadioGroupItem
            v-for="workspace in challenge.workspaces"
            :key="workspace.id"
            :value="workspace.id"
            :class="
              cn(
                'flex w-full cursor-pointer items-center gap-3 border-none bg-transparent p-3 text-left transition-colors',
                'hover:bg-ink-300',
                'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset',
                selectedWorkspaceId === workspace.id && 'bg-ink-200'
              )
            "
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
              class="icon-[lucide--check] size-4 shrink-0 text-base-foreground"
              aria-hidden="true"
            />
          </RadioGroupItem>
        </RadioGroupRoot>
      </section>

      <section class="flex flex-col gap-3">
        <p class="m-0 text-sm font-medium">
          {{ t('oauth.consent.detailsHeader') }}
        </p>
        <div class="flex flex-col gap-1.5 rounded-lg bg-ink-400 p-3">
          <span class="text-xs text-muted">
            {{ t('oauth.consent.permissionsHeader') }}
          </span>
          <ul
            class="m-0 flex scrollbar-custom max-h-72 list-none flex-col gap-1.5 overflow-y-auto p-0"
          >
            <li
              v-for="scope in challenge.scopes"
              :key="scope"
              class="flex items-center gap-2"
            >
              <i
                class="icon-[lucide--check] size-4 shrink-0 text-brand-yellow"
                aria-hidden="true"
              />
              <span class="text-sm">
                {{ scopeLabel(scope) }}
              </span>
            </li>
          </ul>
        </div>
        <div
          v-if="challenge.redirect_uri"
          class="flex flex-col gap-1.5 rounded-lg bg-ink-400 p-3"
        >
          <span class="text-xs text-muted">
            {{ t('oauth.consent.redirectNotice') }}
          </span>
          <code
            class="m-0 block truncate rounded-md bg-ink-200 px-3 py-2 font-mono text-xs text-base-foreground"
            :title="challenge.redirect_uri"
          >
            {{ challenge.redirect_uri }}
          </code>
        </div>
      </section>

      <p
        v-show="errorMessage"
        role="alert"
        class="m-0 rounded-md border border-solid border-destructive-background bg-destructive-background/10 p-3 text-sm text-destructive-background"
      >
        {{ errorMessage }}
      </p>

      <footer class="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          class="w-full bg-ink-500 hover:bg-ink-400"
          :loading="submitting === 'allow'"
          :disabled="isSubmitting || !selectedWorkspaceIsValid"
          @click="submit('allow')"
        >
          {{ t('oauth.consent.allow') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          class="w-full bg-ink-600 hover:bg-ink-400"
          :loading="submitting === 'deny'"
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
import { cn } from '@comfyorg/tailwind-utils'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
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
  OAuthWorkspace
} from '@/platform/cloud/oauth/oauthApi'
import {
  clearOAuthRequestId,
  getOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'

const { initialChallenge } = defineProps<{
  initialChallenge?: OAuthConsentChallenge
}>()

const { t, te } = useI18n()
const route = useRoute()

function getDefaultWorkspaceId(
  source: OAuthConsentChallenge | undefined
): string | undefined {
  return source?.workspaces.length === 1 ? source.workspaces[0].id : undefined
}

const challenge = ref<OAuthConsentChallenge | null>(initialChallenge ?? null)
const selectedWorkspaceId = ref<string | undefined>(
  getDefaultWorkspaceId(initialChallenge)
)
const errorMessage = ref('')
const submitting = ref<'allow' | 'deny' | null>(null)
const isSubmitting = computed(() => submitting.value !== null)

const resourceName = computed(
  () =>
    challenge.value?.resource_display_name ??
    t('oauth.consent.resourceFallback')
)

const selectedWorkspaceIsValid = computed(() =>
  Boolean(
    selectedWorkspaceId.value &&
    challenge.value?.workspaces.some(
      (workspace) => workspace.id === selectedWorkspaceId.value
    )
  )
)

function scopeLabel(scope: string): string {
  const key = `oauth.scopes.${scope}.label`
  return te(key) ? t(key) : scope
}

// Row's secondary label: personal workspaces show "Personal" (role is
// always implicit owner); team workspaces show the role ("Owner"/"Member").
function workspaceSecondaryLabel(workspace: OAuthWorkspace): string {
  if (workspace.type === 'personal') return t('oauth.workspace.personal')
  return workspace.role === 'owner'
    ? t('oauth.workspace.owner')
    : t('oauth.workspace.member')
}

function requestIdFromRoute(): string | null {
  return typeof route.query.oauth_request_id === 'string'
    ? route.query.oauth_request_id
    : getOAuthRequestId()
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
    selectedWorkspaceId.value = getDefaultWorkspaceId(next)
  } catch (error) {
    errorMessage.value = messageForError(error)
  }
}

function messageForError(error: unknown): string {
  if (error instanceof OAuthApiError) {
    if (error.status === 400) return t('oauth.consent.errorExpired')
    if (error.status === 401) return t('oauth.consent.sessionError')
    if (error.status === 403) return t('oauth.consent.errorScopeBroadening')
    if (error.status === 404) return t('oauth.consent.errorUnavailable')
  }
  return t('oauth.consent.genericError')
}

async function submit(decision: 'allow' | 'deny') {
  if (!challenge.value) return
  if (decision === 'allow' && !selectedWorkspaceIsValid.value) return
  const workspaceId =
    selectedWorkspaceId.value ?? challenge.value.workspaces[0]?.id
  if (!workspaceId) {
    errorMessage.value = t('oauth.consent.genericError')
    return
  }

  errorMessage.value = ''
  submitting.value = decision
  try {
    await submitOAuthConsentDecision({
      oauthRequestId: challenge.value.oauth_request_id,
      csrfToken: challenge.value.csrf_token,
      decision,
      workspaceId,
      expectedRedirectUri: challenge.value.redirect_uri
    })
    clearOAuthRequestId()
  } catch (error) {
    errorMessage.value = messageForError(error)
  } finally {
    submitting.value = null
  }
}

onMounted(() => {
  if (!initialChallenge) {
    void loadChallenge()
  }
})
</script>
