import type { OverridedMixpanel } from 'mixpanel-browser'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import { reduceAllNodes } from '@/utils/graphTraversalUtil'
import { normalizeSurveyResponses } from '../../utils/surveyNormalization'

import type {
  AuthMetadata,
  CreditTopupMetadata,
  ExecutionContext,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  PageVisibilityMetadata,
  RunButtonProperties,
  SurveyResponses,
  TabCountMetadata,
  TelemetryEventName,
  TelemetryEventProperties,
  TelemetryProvider,
  TemplateFilterMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  WorkflowImportMetadata
} from '../../types'
import { TelemetryEvents } from '../../types'

interface QueuedEvent {
  eventName: TelemetryEventName
  properties?: TelemetryEventProperties
}

/**
 * Mixpanel Telemetry Provider - Cloud Build Implementation
 *
 * CRITICAL: OSS Build Safety
 * This provider integrates with Mixpanel for cloud telemetry tracking.
 * Entire file is tree-shaken away in OSS builds (DISTRIBUTION unset).
 *
 * To verify OSS builds exclude this code:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `grep -RinE --include='*.js' 'trackWorkflow|trackEvent|mixpanel' dist/` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 */
export class MixpanelTelemetryProvider implements TelemetryProvider {
  private isEnabled = true
  private mixpanel: OverridedMixpanel | null = null
  private eventQueue: QueuedEvent[] = []
  private isInitialized = false

  constructor() {
    const token = window.__CONFIG__?.mixpanel_token

    if (token) {
      try {
        // Dynamic import to avoid bundling mixpanel in OSS builds
        void import('mixpanel-browser')
          .then((mixpanelModule) => {
            this.mixpanel = mixpanelModule.default
            this.mixpanel.init(token, {
              debug: import.meta.env.DEV,
              track_pageview: true,
              api_host: 'https://mp.comfy.org',
              cross_subdomain_cookie: true,
              persistence: 'cookie',
              loaded: () => {
                this.isInitialized = true
                this.flushEventQueue() // flush events that were queued while initializing
                useCurrentUser().onUserResolved((user) => {
                  if (this.mixpanel && user.id) {
                    this.mixpanel.identify(user.id)
                  }
                })
              }
            })
          })
          .catch((error) => {
            console.error('Failed to load Mixpanel:', error)
            this.isEnabled = false
          })
      } catch (error) {
        console.error('Failed to initialize Mixpanel:', error)
        this.isEnabled = false
      }
    } else {
      console.warn('Mixpanel token not provided in runtime config')
      this.isEnabled = false
    }
  }

  private flushEventQueue(): void {
    if (!this.isInitialized || !this.mixpanel) {
      return
    }

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!
      try {
        this.mixpanel.track(event.eventName, event.properties || {})
      } catch (error) {
        console.error('Failed to track queued event:', error)
      }
    }
  }

  private trackEvent(
    eventName: TelemetryEventName,
    properties?: TelemetryEventProperties
  ): void {
    if (!this.isEnabled) {
      return
    }

    const event: QueuedEvent = { eventName, properties }

    if (this.isInitialized && this.mixpanel) {
      // Mixpanel is ready, track immediately
      try {
        this.mixpanel.track(eventName, properties || {})
      } catch (error) {
        console.error('Failed to track event:', error)
      }
    } else {
      // Mixpanel not ready yet, queue the event
      this.eventQueue.push(event)
    }
  }

  trackAuth(metadata: AuthMetadata): void {
    this.trackEvent(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackUserLoggedIn(): void {
    this.trackEvent(TelemetryEvents.USER_LOGGED_IN)
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    const eventName =
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED

    this.trackEvent(eventName)
  }

  trackMonthlySubscriptionSucceeded(): void {
    this.trackEvent(TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED)
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    const metadata: CreditTopupMetadata = {
      credit_amount: amount
    }
    this.trackEvent(
      TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED,
      metadata
    )
  }

  trackRunButton(options?: { subscribe_to_run?: boolean }): void {
    const executionContext = this.getExecutionContext()

    const runButtonProperties: RunButtonProperties = {
      subscribe_to_run: options?.subscribe_to_run || false,
      workflow_type: executionContext.is_template ? 'template' : 'custom',
      workflow_name: executionContext.workflow_name ?? 'untitled'
    }

    this.trackEvent(TelemetryEvents.RUN_BUTTON_CLICKED, runButtonProperties)
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    const eventName =
      stage === 'opened'
        ? TelemetryEvents.USER_SURVEY_OPENED
        : TelemetryEvents.USER_SURVEY_SUBMITTED

    // Apply normalization to survey responses
    const normalizedResponses = responses
      ? normalizeSurveyResponses(responses)
      : undefined

    this.trackEvent(eventName, normalizedResponses)

    // If this is a survey submission, also set user properties with normalized data
    if (stage === 'submitted' && normalizedResponses && this.mixpanel) {
      try {
        this.mixpanel.people.set(normalizedResponses)
      } catch (error) {
        console.error('Failed to set survey user properties:', error)
      }
    }
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    let eventName: TelemetryEventName

    switch (stage) {
      case 'opened':
        eventName = TelemetryEvents.USER_EMAIL_VERIFY_OPENED
        break
      case 'requested':
        eventName = TelemetryEvents.USER_EMAIL_VERIFY_REQUESTED
        break
      case 'completed':
        eventName = TelemetryEvents.USER_EMAIL_VERIFY_COMPLETED
        break
    }

    this.trackEvent(eventName)
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED, metadata)
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_LIBRARY_OPENED, metadata)
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.trackEvent(TelemetryEvents.WORKFLOW_IMPORTED, metadata)
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.trackEvent(TelemetryEvents.PAGE_VISIBILITY_CHANGED, metadata)
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.trackEvent(TelemetryEvents.TAB_COUNT_TRACKING, metadata)
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.trackEvent(TelemetryEvents.NODE_SEARCH, metadata)
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.trackEvent(TelemetryEvents.NODE_SEARCH_RESULT_SELECTED, metadata)
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_FILTER_CHANGED, metadata)
  }

  trackWorkflowExecution(): void {
    const context = this.getExecutionContext()
    this.trackEvent(TelemetryEvents.EXECUTION_START, context)
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.trackEvent(TelemetryEvents.EXECUTION_ERROR, metadata)
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.trackEvent(TelemetryEvents.EXECUTION_SUCCESS, metadata)
  }

  getExecutionContext(): ExecutionContext {
    const workflowStore = useWorkflowStore()
    const templatesStore = useWorkflowTemplatesStore()
    const nodeDefStore = useNodeDefStore()
    const activeWorkflow = workflowStore.activeWorkflow

    // Calculate node metrics in a single traversal
    const nodeMetrics = reduceAllNodes(
      app.graph,
      (acc, node) => {
        const nodeDef = nodeDefStore.nodeDefsByName[node.type]
        const isCustomNode =
          nodeDef?.nodeSource?.type === NodeSourceType.CustomNodes
        const isApiNode = nodeDef?.api_node === true
        const isSubgraph = node.isSubgraphNode?.() === true

        return {
          custom_node_count: acc.custom_node_count + (isCustomNode ? 1 : 0),
          api_node_count: acc.api_node_count + (isApiNode ? 1 : 0),
          subgraph_count: acc.subgraph_count + (isSubgraph ? 1 : 0)
        }
      },
      { custom_node_count: 0, api_node_count: 0, subgraph_count: 0 }
    )

    if (activeWorkflow?.filename) {
      const isTemplate = templatesStore.knownTemplateNames.has(
        activeWorkflow.filename
      )

      if (isTemplate) {
        const template = templatesStore.getTemplateByName(
          activeWorkflow.filename
        )

        const englishMetadata = templatesStore.getEnglishMetadata(
          activeWorkflow.filename
        )

        return {
          is_template: true,
          workflow_name: activeWorkflow.filename,
          template_source: template?.sourceModule,
          template_category: englishMetadata?.category ?? template?.category,
          template_tags: englishMetadata?.tags ?? template?.tags,
          template_models: englishMetadata?.models ?? template?.models,
          template_use_case: englishMetadata?.useCase ?? template?.useCase,
          template_license: englishMetadata?.license ?? template?.license,
          ...nodeMetrics
        }
      }

      return {
        is_template: false,
        workflow_name: activeWorkflow.filename,
        ...nodeMetrics
      }
    }

    return {
      is_template: false,
      workflow_name: undefined,
      ...nodeMetrics
    }
  }
}
