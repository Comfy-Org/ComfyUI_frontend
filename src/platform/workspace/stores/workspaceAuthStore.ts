import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { t } from "@/i18n";
import {
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS,
} from "@/platform/workspace/workspaceConstants";
import { api } from "@/scripts/api";
import { useAuthStore } from "@/stores/authStore";
import type { AuthHeader } from "@/types/authTypes";
import type { WorkspaceWithRole } from "@/platform/workspace/workspaceTypes";
import { useFeatureFlags } from "@/composables/useFeatureFlags";
import { useToastStore } from "@/platform/updates/common/toastStore";
import {
  retryWithBackoff,
  RetriesExhaustedError,
  RetryAbortedError,
} from "@/base/common/retry";

const WorkspaceWithRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["personal", "team"]),
  role: z.enum(["owner", "member"]),
});

const WorkspaceTokenResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["personal", "team"]),
  }),
  role: z.enum(["owner", "member"]),
  permissions: z.array(z.string()),
});

export class WorkspaceAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "WorkspaceAuthError";
  }
}

/**
 * Check if an error represents permanent workspace access revocation.
 * These errors should not be retried - the user has lost access.
 */
function isWorkspaceAccessRevoked(err: unknown): boolean {
  return (
    err instanceof WorkspaceAuthError &&
    (err.code === "ACCESS_DENIED" || err.code === "WORKSPACE_NOT_FOUND")
  );
}

/**
 * Check if an error is transient and worth retrying.
 */
function isTransientError(err: unknown): boolean {
  // Network errors
  if (
    err instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(err.message)
  ) {
    return true;
  }

  // Auth errors that may resolve with retry (e.g., Firebase token refresh)
  if (err instanceof WorkspaceAuthError) {
    return (
      err.code === "TOKEN_EXCHANGE_FAILED" ||
      err.code === "INVALID_FIREBASE_TOKEN" ||
      err.code === "NOT_AUTHENTICATED"
    );
  }

  return false;
}

export const useWorkspaceAuthStore = defineStore("workspaceAuth", () => {
  const { flags } = useFeatureFlags();

  // State
  const currentWorkspace = shallowRef<WorkspaceWithRole | null>(null);
  const workspaceToken = ref<string | null>(null);
  const workspaceTokenExpiresAt = ref<number | null>(null);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const isInDegradedState = ref(false);

  // Timer state
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

  // AbortController for cleanup
  let currentRefreshAbort: AbortController | null = null;

  // Request ID to prevent stale refresh operations from overwriting newer workspace contexts
  let refreshRequestId = 0;

  // Getters
  const isAuthenticated = computed(
    () => currentWorkspace.value !== null && hasUsableWorkspaceToken(),
  );

  // Private helpers
  function stopRefreshTimer(): void {
    if (refreshTimerId !== null) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }
  }

  function abortCurrentRefresh(): void {
    if (currentRefreshAbort) {
      currentRefreshAbort.abort();
      currentRefreshAbort = null;
    }
  }

  /**
   * Check if the current workspace token is still valid (not expired).
   */
  function hasUsableWorkspaceToken(): boolean {
    return (
      workspaceToken.value !== null &&
      workspaceTokenExpiresAt.value !== null &&
      workspaceTokenExpiresAt.value > Date.now()
    );
  }

  function scheduleTokenRefresh(expiresAt: number): void {
    stopRefreshTimer();
    const now = Date.now();
    const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS;
    const delay = Math.max(0, refreshAt - now);

    refreshTimerId = setTimeout(() => {
      void refreshToken();
    }, delay);
  }

  /**
   * Schedule a retry when refresh fails but token is still valid.
   * Uses adaptive delay based on remaining token lifetime.
   */
  function scheduleRefreshRetry(): void {
    stopRefreshTimer();

    if (!hasUsableWorkspaceToken() || workspaceTokenExpiresAt.value === null) {
      clearWorkspaceContext();
      return;
    }

    const remainingMs = workspaceTokenExpiresAt.value - Date.now();

    // Adaptive retry delay:
    // - If < 10s remaining, retry immediately when it expires
    // - Otherwise, retry at half the remaining time or 60s, whichever is smaller
    // Add jitter to prevent thundering herd across tabs
    const jitter = Math.random() * 5000;
    const retryDelay =
      remainingMs <= 10_000
        ? remainingMs
        : Math.min(60_000, Math.floor(remainingMs / 2)) + jitter;

    refreshTimerId = setTimeout(() => {
      void refreshToken();
    }, retryDelay);
  }

  function persistToSession(
    workspace: WorkspaceWithRole,
    token: string,
    expiresAt: number,
  ): void {
    try {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(workspace),
      );
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, token);
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        expiresAt.toString(),
      );
    } catch {
      console.warn("Failed to persist workspace context to sessionStorage");
    }
  }

  function clearSessionStorage(): void {
    try {
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE);
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT);
    } catch {
      console.warn("Failed to clear workspace context from sessionStorage");
    }
  }

  // Actions
  function init(): void {
    initializeFromSession();
  }

  function destroy(): void {
    stopRefreshTimer();
    abortCurrentRefresh();
  }

  function initializeFromSession(): boolean {
    if (!flags.teamWorkspacesEnabled) {
      return false;
    }

    try {
      const workspaceJson = sessionStorage.getItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      );
      const token = sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN);
      const expiresAtStr = sessionStorage.getItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
      );

      if (!workspaceJson || !token || !expiresAtStr) {
        return false;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt) || expiresAt <= Date.now()) {
        clearSessionStorage();
        return false;
      }

      const parsedWorkspace = JSON.parse(workspaceJson);
      const parseResult = WorkspaceWithRoleSchema.safeParse(parsedWorkspace);

      if (!parseResult.success) {
        clearSessionStorage();
        return false;
      }

      currentWorkspace.value = parseResult.data;
      workspaceToken.value = token;
      workspaceTokenExpiresAt.value = expiresAt;
      error.value = null;

      scheduleTokenRefresh(expiresAt);
      return true;
    } catch {
      clearSessionStorage();
      return false;
    }
  }

  async function switchWorkspace(workspaceId: string): Promise<void> {
    if (!flags.teamWorkspacesEnabled) {
      return;
    }

    // Only increment request ID when switching to a different workspace
    // This invalidates stale refresh operations for the old workspace
    // but allows refresh operations for the same workspace to complete
    if (currentWorkspace.value?.id !== workspaceId) {
      refreshRequestId++;
      abortCurrentRefresh();
    }

    isLoading.value = true;
    error.value = null;

    try {
      const authStore = useAuthStore();
      const firebaseToken = await authStore.getIdToken();
      if (!firebaseToken) {
        throw new WorkspaceAuthError(
          t("workspaceAuth.errors.notAuthenticated"),
          "NOT_AUTHENTICATED",
        );
      }

      const response = await fetch(api.apiURL("/auth/token"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || response.statusText;

        if (response.status === 401) {
          throw new WorkspaceAuthError(
            t("workspaceAuth.errors.invalidFirebaseToken"),
            "INVALID_FIREBASE_TOKEN",
          );
        }
        if (response.status === 403) {
          throw new WorkspaceAuthError(
            t("workspaceAuth.errors.accessDenied"),
            "ACCESS_DENIED",
          );
        }
        if (response.status === 404) {
          throw new WorkspaceAuthError(
            t("workspaceAuth.errors.workspaceNotFound"),
            "WORKSPACE_NOT_FOUND",
          );
        }

        throw new WorkspaceAuthError(
          t("workspaceAuth.errors.tokenExchangeFailed", { error: message }),
          "TOKEN_EXCHANGE_FAILED",
        );
      }

      const rawData = await response.json();
      const parseResult = WorkspaceTokenResponseSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new WorkspaceAuthError(
          t("workspaceAuth.errors.tokenExchangeFailed", {
            error: fromZodError(parseResult.error).message,
          }),
          "TOKEN_EXCHANGE_FAILED",
        );
      }

      const data = parseResult.data;
      const expiresAt = new Date(data.expires_at).getTime();

      if (isNaN(expiresAt)) {
        throw new WorkspaceAuthError(
          t("workspaceAuth.errors.tokenExchangeFailed", {
            error: "Invalid expiry timestamp",
          }),
          "TOKEN_EXCHANGE_FAILED",
        );
      }

      const workspaceWithRole: WorkspaceWithRole = {
        ...data.workspace,
        role: data.role,
      };

      currentWorkspace.value = workspaceWithRole;
      workspaceToken.value = data.token;
      workspaceTokenExpiresAt.value = expiresAt;

      persistToSession(workspaceWithRole, data.token, expiresAt);
      scheduleTokenRefresh(expiresAt);
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      throw error.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshToken(): Promise<void> {
    if (!currentWorkspace.value) {
      return;
    }

    const workspaceId = currentWorkspace.value.id;
    // Capture the current request ID to detect if workspace context changed during refresh
    const capturedRequestId = refreshRequestId;
    const toastStore = useToastStore();

    // Create AbortController for this refresh operation
    abortCurrentRefresh();
    const abortController = new AbortController();
    currentRefreshAbort = abortController;

    try {
      await retryWithBackoff(() => switchWorkspace(workspaceId), {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 60_000,
        jitter: "full",
        signal: abortController.signal,

        shouldRetry: (err, _attempt) => {
          // Stop if aborted or workspace changed
          if (
            abortController.signal.aborted ||
            capturedRequestId !== refreshRequestId
          ) {
            return false;
          }

          // Never retry access revocation
          if (isWorkspaceAccessRevoked(err)) {
            return false;
          }

          // Only retry transient errors while token is still valid
          if (!isTransientError(err)) {
            return false;
          }

          // Don't retry if token has expired
          if (!hasUsableWorkspaceToken()) {
            return false;
          }

          return true;
        },

        onRetry: (err, attempt, delay) => {
          console.warn(
            `Token refresh failed (attempt ${attempt}), retrying in ${Math.round(delay)}ms:`,
            err,
          );
          toastStore.add({
            severity: "warn",
            summary: t("workspaceAuth.refreshRetrying"),
            detail: t("workspaceAuth.refreshRetryingDetail", {
              attempt,
              delay: Math.round(delay / 1000),
            }),
            life: delay + 2000,
          });
        },

        onExhausted: (err, totalAttempts) => {
          console.warn(
            `Token refresh exhausted after ${totalAttempts} attempts:`,
            err,
          );

          // Only handle if this refresh is still current
          if (capturedRequestId !== refreshRequestId) {
            return;
          }

          if (hasUsableWorkspaceToken()) {
            // Token still valid - enter degraded state and schedule retry
            isInDegradedState.value = true;
            scheduleRefreshRetry();
            toastStore.add({
              severity: "warn",
              summary: t("workspaceAuth.refreshDegraded"),
              detail: t("workspaceAuth.refreshDegradedDetail"),
              life: 10000,
            });
          } else {
            // Token expired - must clear context
            clearWorkspaceContext();
            toastStore.add({
              severity: "error",
              summary: t("workspaceAuth.sessionExpired"),
              detail: t("workspaceAuth.sessionExpiredDetail"),
              life: 10000,
            });
          }
        },
      });

      // Success - clear degraded state
      if (isInDegradedState.value) {
        isInDegradedState.value = false;
        toastStore.add({
          severity: "success",
          summary: t("workspaceAuth.refreshRecovered"),
          life: 3000,
        });
      }
    } catch (err) {
      // Check if this refresh is still current
      if (capturedRequestId !== refreshRequestId) {
        console.warn(
          "Aborting stale token refresh: workspace context changed during refresh",
        );
        return;
      }

      // Handle aborted refresh (cleanup, switching workspaces)
      if (err instanceof RetryAbortedError) {
        return;
      }

      // Handle permanent errors (access revoked)
      if (isWorkspaceAccessRevoked(err)) {
        console.error("Workspace access revoked:", err);
        clearWorkspaceContext();
        toastStore.add({
          severity: "error",
          summary: t("workspaceAuth.errors.accessDenied"),
          life: 10000,
        });
        return;
      }

      // Handle exhausted retries (already handled in onExhausted, but catch the error)
      if (err instanceof RetriesExhaustedError) {
        // Already handled in onExhausted callback
        return;
      }

      // Unexpected error - clear context to be safe
      console.error("Unexpected error during token refresh:", err);
      clearWorkspaceContext();
    }
  }

  function getWorkspaceAuthHeader(): AuthHeader | null {
    if (!hasUsableWorkspaceToken()) {
      return null;
    }
    return {
      Authorization: `Bearer ${workspaceToken.value}`,
    };
  }

  function getWorkspaceToken(): string | undefined {
    return hasUsableWorkspaceToken()
      ? (workspaceToken.value ?? undefined)
      : undefined;
  }

  function clearWorkspaceContext(): void {
    // Increment request ID to invalidate any in-flight stale refresh operations
    refreshRequestId++;
    abortCurrentRefresh();
    stopRefreshTimer();
    currentWorkspace.value = null;
    workspaceToken.value = null;
    workspaceTokenExpiresAt.value = null;
    isInDegradedState.value = false;
    error.value = null;
    clearSessionStorage();
  }

  return {
    // State
    currentWorkspace,
    workspaceToken,
    isLoading,
    error,
    isInDegradedState,

    // Getters
    isAuthenticated,

    // Actions
    init,
    destroy,
    initializeFromSession,
    switchWorkspace,
    refreshToken,
    getWorkspaceAuthHeader,
    getWorkspaceToken,
    clearWorkspaceContext,
  };
});
