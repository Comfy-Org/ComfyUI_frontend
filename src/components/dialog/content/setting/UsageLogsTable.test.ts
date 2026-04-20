import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onMounted, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen, waitFor } from '@testing-library/vue'

import type { AuditLog } from '@/services/customerEventsService'
import { EventType } from '@/services/customerEventsService'

import UsageLogsTable from './UsageLogsTable.vue'

const mockCustomerEventsService = vi.hoisted(() => ({
  getMyEvents: vi.fn(),
  formatEventType: vi.fn(),
  getEventSeverity: vi.fn(),
  formatAmount: vi.fn(),
  formatDate: vi.fn(),
  hasAdditionalInfo: vi.fn(),
  getTooltipContent: vi.fn(),
  error: { value: null as string | null },
  isLoading: { value: false }
}))

vi.mock('@/services/customerEventsService', () => ({
  useCustomerEventsService: () => mockCustomerEventsService,
  EventType: {
    CREDIT_ADDED: 'credit_added',
    ACCOUNT_CREATED: 'account_created',
    API_USAGE_STARTED: 'api_usage_started',
    API_USAGE_COMPLETED: 'api_usage_completed'
  }
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      credits: {
        eventType: 'Event Type',
        details: 'Details',
        time: 'Time',
        additionalInfo: 'Additional Info',
        added: 'Added',
        accountInitialized: 'Account initialized',
        model: 'Model'
      }
    }
  }
})

const globalConfig = {
  plugins: [PrimeVue, i18n, createTestingPinia()],
  directives: { tooltip: Tooltip }
}

/**
 * The component starts with loading=true and only loads data when refresh()
 * is called via template ref. This wrapper auto-calls refresh on mount.
 */
const AutoRefreshWrapper = defineComponent({
  components: { UsageLogsTable },
  setup() {
    const tableRef = ref<InstanceType<typeof UsageLogsTable> | null>(null)
    onMounted(async () => {
      await tableRef.value?.refresh()
    })
    return { tableRef }
  },
  template: '<UsageLogsTable ref="tableRef" />'
})

function makeEventsResponse(
  events: Partial<AuditLog>[],
  overrides: Record<string, unknown> = {}
) {
  return {
    events,
    total: events.length,
    page: 1,
    limit: 7,
    totalPages: 1,
    ...overrides
  }
}

describe('UsageLogsTable', () => {
  const mockEventsResponse = makeEventsResponse([
    {
      event_id: 'event-1',
      event_type: 'credit_added',
      params: {
        amount: 1000,
        transaction_id: 'txn-123'
      },
      createdAt: '2024-01-01T10:00:00Z'
    },
    {
      event_id: 'event-2',
      event_type: 'api_usage_completed',
      params: {
        api_name: 'Image Generation',
        model: 'sdxl-base',
        duration: 5000
      },
      createdAt: '2024-01-02T10:00:00Z'
    }
  ])

  beforeEach(() => {
    vi.clearAllMocks()

    mockCustomerEventsService.getMyEvents.mockResolvedValue(mockEventsResponse)
    mockCustomerEventsService.formatEventType.mockImplementation(
      (type: string) => {
        switch (type) {
          case EventType.CREDIT_ADDED:
            return 'Credits Added'
          case EventType.ACCOUNT_CREATED:
            return 'Account Created'
          case EventType.API_USAGE_COMPLETED:
            return 'API Usage'
          default:
            return type
        }
      }
    )
    mockCustomerEventsService.getEventSeverity.mockImplementation(
      (type: string) => {
        switch (type) {
          case EventType.CREDIT_ADDED:
            return 'success'
          case EventType.ACCOUNT_CREATED:
            return 'info'
          case EventType.API_USAGE_COMPLETED:
            return 'warning'
          default:
            return 'info'
        }
      }
    )
    mockCustomerEventsService.formatAmount.mockImplementation(
      (amount: number) => {
        if (!amount) return '0.00'
        return (amount / 100).toFixed(2)
      }
    )
    mockCustomerEventsService.formatDate.mockImplementation(
      (dateString: string) => new Date(dateString).toLocaleDateString()
    )
    mockCustomerEventsService.hasAdditionalInfo.mockImplementation(
      (event: AuditLog) => {
        const { amount, api_name, model, ...otherParams } =
          (event.params as Record<string, unknown>) ?? {}
        return Object.keys(otherParams).length > 0
      }
    )
    mockCustomerEventsService.getTooltipContent.mockImplementation(
      () => '<strong>Transaction Id:</strong> txn-123'
    )
    mockCustomerEventsService.error.value = null
    mockCustomerEventsService.isLoading.value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderComponent() {
    return render(UsageLogsTable, { global: globalConfig })
  }

  function renderWithAutoRefresh() {
    return render(AutoRefreshWrapper, { global: globalConfig })
  }

  async function renderLoaded() {
    const result = renderWithAutoRefresh()
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
    return result
  }

  describe('loading states', () => {
    it('shows loading spinner before refresh is called', () => {
      renderComponent()

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('shows error message when service returns null', async () => {
      mockCustomerEventsService.getMyEvents.mockResolvedValue(null)
      mockCustomerEventsService.error.value = 'Failed to load events'

      renderWithAutoRefresh()

      await waitFor(() => {
        expect(screen.getByText('Failed to load events')).toBeInTheDocument()
      })
    })

    it('shows error message when service throws', async () => {
      mockCustomerEventsService.getMyEvents.mockRejectedValue(
        new Error('Network error')
      )

      renderWithAutoRefresh()

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows data table after loading completes', async () => {
      await renderLoaded()

      expect(
        screen.queryByText('Failed to load events')
      ).not.toBeInTheDocument()
    })
  })

  describe('data rendering', () => {
    it('renders event type badges', async () => {
      await renderLoaded()

      expect(mockCustomerEventsService.formatEventType).toHaveBeenCalled()
      expect(mockCustomerEventsService.getEventSeverity).toHaveBeenCalled()
    })

    it('renders credit added details with formatted amount', async () => {
      await renderLoaded()

      expect(screen.getByText(/Added \$/)).toBeInTheDocument()
      expect(mockCustomerEventsService.formatAmount).toHaveBeenCalled()
    })

    it('renders API usage details with api name and model', async () => {
      await renderLoaded()

      expect(screen.getByText('Image Generation')).toBeInTheDocument()
      expect(screen.getByText(/sdxl-base/)).toBeInTheDocument()
    })

    it('renders account created details', async () => {
      mockCustomerEventsService.getMyEvents.mockResolvedValue(
        makeEventsResponse([
          {
            event_id: 'event-3',
            event_type: 'account_created',
            params: {},
            createdAt: '2024-01-01T10:00:00Z'
          }
        ])
      )

      renderWithAutoRefresh()

      await waitFor(() => {
        expect(screen.getByText('Account initialized')).toBeInTheDocument()
      })
    })

    it('renders formatted dates', async () => {
      await renderLoaded()

      expect(mockCustomerEventsService.formatDate).toHaveBeenCalled()
    })

    it('renders info buttons for events with additional info', async () => {
      mockCustomerEventsService.hasAdditionalInfo.mockReturnValue(true)

      await renderLoaded()

      const infoButtons = screen.getAllByRole('button', {
        name: 'Additional Info'
      })
      expect(infoButtons.length).toBeGreaterThan(0)
    })

    it('does not render info buttons when no additional info', async () => {
      mockCustomerEventsService.hasAdditionalInfo.mockReturnValue(false)

      await renderLoaded()

      expect(
        screen.queryByRole('button', { name: 'Additional Info' })
      ).not.toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    it('calls getMyEvents with initial page params', async () => {
      await renderLoaded()

      expect(mockCustomerEventsService.getMyEvents).toHaveBeenCalledWith({
        page: 1,
        limit: 7
      })
    })
  })

  describe('component methods', () => {
    it('calls getMyEvents on refresh with page 1', async () => {
      await renderLoaded()

      expect(mockCustomerEventsService.getMyEvents).toHaveBeenCalledWith({
        page: 1,
        limit: 7
      })
    })
  })

  describe('EventType integration', () => {
    it('renders credit_added event with correct detail template', async () => {
      mockCustomerEventsService.getMyEvents.mockResolvedValue(
        makeEventsResponse([
          {
            event_id: 'event-1',
            event_type: EventType.CREDIT_ADDED,
            params: { amount: 1000 },
            createdAt: '2024-01-01T10:00:00Z'
          }
        ])
      )

      await renderLoaded()

      expect(screen.getByText(/Added \$/)).toBeInTheDocument()
      expect(mockCustomerEventsService.formatAmount).toHaveBeenCalled()
    })

    it('renders api_usage_completed event with correct detail template', async () => {
      mockCustomerEventsService.getMyEvents.mockResolvedValue(
        makeEventsResponse([
          {
            event_id: 'event-2',
            event_type: EventType.API_USAGE_COMPLETED,
            params: { api_name: 'Test API', model: 'test-model' },
            createdAt: '2024-01-02T10:00:00Z'
          }
        ])
      )

      await renderLoaded()

      expect(screen.getByText('Test API')).toBeInTheDocument()
      expect(screen.getByText(/test-model/)).toBeInTheDocument()
    })
  })
})
