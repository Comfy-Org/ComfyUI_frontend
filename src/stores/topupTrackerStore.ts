import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { AuditLog } from '@/services/customerEventsService'
import {
  EventType,
  useCustomerEventsService
} from '@/services/customerEventsService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

type PendingTopupRecord = {
  startedAtIso: string
  amountUsd?: number
  expectedCents?: number
}

const storageKeyForUser = (userId: string) => `topupTracker:pending:${userId}`

export const useTopupTrackerStore = defineStore('topupTracker', () => {
  const telemetry = useTelemetry()
  const authStore = useFirebaseAuthStore()
  const pendingTopup = ref<PendingTopupRecord | null>(null)
  const storageListenerInitialized = ref(false)

  const loadFromStorage = () => {
    const userId = authStore.userId
    if (!userId) return
    try {
      const rawValue = localStorage.getItem(storageKeyForUser(userId))
      if (!rawValue) return
      const parsedValue = JSON.parse(rawValue) as PendingTopupRecord
      pendingTopup.value = parsedValue
    } catch {
      pendingTopup.value = null
    }
  }

  const persistToStorage = () => {
    const userId = authStore.userId
    if (!userId) return
    if (pendingTopup.value) {
      localStorage.setItem(
        storageKeyForUser(userId),
        JSON.stringify(pendingTopup.value)
      )
    } else {
      localStorage.removeItem(storageKeyForUser(userId))
    }
  }

  const initializeStorageSynchronization = () => {
    if (storageListenerInitialized.value) return
    storageListenerInitialized.value = true
    loadFromStorage()
    window.addEventListener('storage', (e: StorageEvent) => {
      const userId = authStore.userId
      if (!userId) return
      if (e.key === storageKeyForUser(userId)) {
        loadFromStorage()
      }
    })

    watch(
      () => authStore.userId,
      (newUserId, oldUserId) => {
        if (newUserId && newUserId !== oldUserId) {
          loadFromStorage()
          return
        }
        if (!newUserId && oldUserId) {
          pendingTopup.value = null
        }
      }
    )
  }

  const startTopup = (amountUsd: number) => {
    const userId = authStore.userId
    if (!userId) return
    const expectedCents = Math.round(amountUsd * 100)
    pendingTopup.value = {
      startedAtIso: new Date().toISOString(),
      amountUsd,
      expectedCents
    }
    persistToStorage()
  }

  const clearTopup = () => {
    pendingTopup.value = null
    persistToStorage()
  }

  const reconcileWithEvents = async (
    events: AuditLog[] | undefined | null
  ): Promise<boolean> => {
    if (!events || events.length === 0) return false
    if (!pendingTopup.value) return false

    const startedAt = new Date(pendingTopup.value.startedAtIso)
    if (Number.isNaN(+startedAt)) {
      clearTopup()
      return false
    }

    const withinWindow = (createdAt: string) => {
      const created = new Date(createdAt)
      if (Number.isNaN(+created)) return false
      const maxAgeMs = 1000 * 60 * 60 * 24
      return (
        created >= startedAt &&
        created.getTime() - startedAt.getTime() <= maxAgeMs
      )
    }

    let matched = events.filter((e) => {
      if (e.event_type !== EventType.CREDIT_ADDED) return false
      if (!e.createdAt || !withinWindow(e.createdAt)) return false
      return true
    })

    if (pendingTopup.value.expectedCents != null) {
      matched = matched.filter((e) =>
        typeof e.params?.amount === 'number'
          ? e.params.amount === pendingTopup.value?.expectedCents
          : true
      )
    }

    if (matched.length === 0) return false

    telemetry?.trackApiCreditTopupSucceeded()
    await authStore.fetchBalance().catch(() => {})
    clearTopup()
    return true
  }

  const reconcileByFetchingEvents = async (): Promise<boolean> => {
    const service = useCustomerEventsService()
    const response = await service.getMyEvents({ page: 1, limit: 10 })
    if (!response) return false
    return await reconcileWithEvents(response.events)
  }

  initializeStorageSynchronization()

  return {
    pendingTopup,
    startTopup,
    clearTopup,
    reconcileWithEvents,
    reconcileByFetchingEvents
  }
})
