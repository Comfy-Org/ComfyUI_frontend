import type { OverridedMixpanel } from 'mixpanel-browser'

import type {
  AuthMetadata,
  ExecutionContext,
  RunButtonProperties,
  SurveyResponses,
  TelemetryEventName,
  TelemetryEventProperties,
  TelemetryProvider,
  TemplateMetadata
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

  // Onboarding mode - starts true, set to false when app is fully ready
  private isOnboardingMode = true

  // Lazy-loaded composables - only imported once when app is ready
  private _workflowStore: any = null
  private _templatesStore: any = null
  private _currentUser: any = null
  private _settingStore: any = null
  private _composablesReady = false

  constructor() {
    const token = __MIXPANEL_TOKEN__

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
              save_referrer: true,
              loaded: () => {
                this.isInitialized = true
                this.flushEventQueue() // flush events that were queued while initializing
                // TODO: Re-enable user tracking setup once circular dependency issue is resolved
                // Defer user tracking setup to avoid circular dependency issues
                // setTimeout(() => {
                //   try {
                //     useCurrentUser().onUserResolved((user) => {
                //       if (this.mixpanel && user.id) {
                //         this.mixpanel.identify(user.id)
                //         // Set existing survey data as user properties if available
                //         this.initializeExistingSurveyData()
                //       }
                //     })
                //   } catch (error) {
                //     console.error('Failed to initialize user tracking:', error)
                //   }
                // }, 0)
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
      console.warn('Mixpanel token not provided')
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

  /**
   * Identify the current user for telemetry tracking.
   * Can be called during onboarding without circular dependencies.
   */
  identifyUser(userId: string): void {
    if (!this.mixpanel) return

    try {
      this.mixpanel.identify(userId)

      // If we have pending survey responses, set them now that user is identified
      if (this.pendingSurveyResponses) {
        this.setSurveyUserProperties(this.pendingSurveyResponses)
        this.pendingSurveyResponses = null
      }

      // Load existing survey data if available (only when app is ready)
      if (!this.isOnboardingMode) {
        this.initializeExistingSurveyData()
      }
    } catch (error) {
      console.error('Failed to identify user:', error)
    }
  }

  /**
   * Mark that the main app is fully initialized and advanced telemetry features can be used.
   * Call this after the app bootstrap is complete.
   */
  markAppReady(): void {
    this.isOnboardingMode = false
    // Trigger composable initialization now that it's safe
    void this.initializeComposables()
  }

  /**
   * Lazy initialization of Vue composables to avoid circular dependencies during module loading.
   * Only imports and initializes composables once when app is ready.
   */
  private async initializeComposables(): Promise<boolean> {
    if (this._composablesReady || this.isOnboardingMode) {
      return this._composablesReady
    }

    try {
      // Dynamic imports to avoid circular dependencies during module loading
      const [
        { useWorkflowStore },
        { useWorkflowTemplatesStore },
        { useCurrentUser },
        { useSettingStore }
      ] = await Promise.all([
        import('@/platform/workflow/management/stores/workflowStore'),
        import(
          '@/platform/workflow/templates/repositories/workflowTemplatesStore'
        ),
        import('@/composables/auth/useCurrentUser'),
        import('@/platform/settings/settingStore')
      ])

      // Initialize composables once
      this._workflowStore = useWorkflowStore()
      this._templatesStore = useWorkflowTemplatesStore()
      this._currentUser = useCurrentUser()
      this._settingStore = useSettingStore()

      this._composablesReady = true

      // Now that composables are ready, set up user tracking
      if (this.mixpanel) {
        this._currentUser.onUserResolved((user: any) => {
          if (this.mixpanel && user.id) {
            this.mixpanel.identify(user.id)
            this.initializeExistingSurveyData()
          }
        })
      }

      return true
    } catch (error) {
      console.error('Failed to initialize composables:', error)
      return false
    }
  }

  private initializeExistingSurveyData(): void {
    if (!this.mixpanel) return

    try {
      // If composables are ready, use cached store
      if (this._settingStore) {
        const surveyData = this._settingStore.get('onboarding_survey')

        if (surveyData && typeof surveyData === 'object') {
          const survey = surveyData as any
          this.mixpanel.people.set({
            survey_industry: survey.industry,
            survey_team_size: survey.team_size,
            survey_use_case: survey.useCase,
            survey_familiarity: survey.familiarity,
            survey_intended_use:
              survey.useCase === 'personal'
                ? 'personal'
                : survey.useCase === 'client'
                  ? 'client'
                  : 'inhouse'
          })
        }
      }
      // If in onboarding mode, try dynamic import (safe since user is identified)
      else if (this.isOnboardingMode) {
        import('@/platform/settings/settingStore')
          .then(({ useSettingStore }) => {
            try {
              const settingStore = useSettingStore()
              const surveyData = settingStore.get('onboarding_survey')

              if (surveyData && typeof surveyData === 'object') {
                const survey = surveyData as any
                this.mixpanel?.people.set({
                  survey_industry: survey.industry,
                  survey_team_size: survey.team_size,
                  survey_use_case: survey.useCase,
                  survey_familiarity: survey.familiarity,
                  survey_intended_use:
                    survey.useCase === 'personal'
                      ? 'personal'
                      : survey.useCase === 'client'
                        ? 'client'
                        : 'inhouse'
                })
              }
            } catch (error) {
              console.error(
                'Failed to load existing survey data during onboarding:',
                error
              )
            }
          })
          .catch((error) => {
            console.error('Failed to import settings store:', error)
          })
      }
    } catch (error) {
      console.error('Failed to initialize existing survey data:', error)
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

  trackSignupOpened(): void {
    this.trackEvent(TelemetryEvents.USER_SIGN_UP_OPENED)
  }

  trackAuth(metadata: AuthMetadata): void {
    this.trackEvent(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    const eventName =
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED

    this.trackEvent(eventName)
  }

  trackRunButton(options?: { subscribe_to_run?: boolean }): void {
    if (this.isOnboardingMode) {
      // During onboarding, track basic run button click without workflow context
      this.trackEvent(TelemetryEvents.RUN_BUTTON_CLICKED, {
        subscribe_to_run: options?.subscribe_to_run || false,
        workflow_type: 'custom',
        workflow_name: 'untitled'
      })
      return
    }

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

    // Include survey responses as event properties for submitted events
    const eventProperties =
      stage === 'submitted' && responses
        ? {
            industry: responses.industry,
            team_size: responses.team_size,
            use_case: responses.use_case,
            familiarity: responses.familiarity,
            intended_use: responses.intended_use
          }
        : undefined

    this.trackEvent(eventName, eventProperties)

    // Also set survey responses as persistent user properties
    if (stage === 'submitted' && responses && this.mixpanel) {
      // During onboarding, we need to defer user property setting until user is identified
      if (this.isOnboardingMode) {
        // Store responses to be set once user is identified
        this.pendingSurveyResponses = responses
      } else {
        this.setSurveyUserProperties(responses)
      }
    }
  }

  private pendingSurveyResponses: SurveyResponses | null = null

  private setSurveyUserProperties(responses: SurveyResponses): void {
    if (!this.mixpanel) return

    try {
      this.mixpanel.people.set({
        survey_industry: responses.industry,
        survey_team_size: responses.team_size,
        survey_use_case: responses.use_case,
        survey_familiarity: responses.familiarity,
        survey_intended_use: responses.intended_use
      })
    } catch (error) {
      console.error('Failed to set survey user properties:', error)
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

  trackWorkflowExecution(): void {
    if (this.isOnboardingMode) {
      // During onboarding, track basic execution without workflow context
      this.trackEvent(TelemetryEvents.WORKFLOW_EXECUTION_STARTED, {
        is_template: false,
        workflow_name: undefined
      })
      return
    }

    const context = this.getExecutionContext()
    this.trackEvent(TelemetryEvents.WORKFLOW_EXECUTION_STARTED, context)
  }

  getExecutionContext(): ExecutionContext {
    // Try to initialize composables if not ready and not in onboarding mode
    if (!this._composablesReady && !this.isOnboardingMode) {
      void this.initializeComposables()
    }

    if (
      !this._composablesReady ||
      !this._workflowStore ||
      !this._templatesStore
    ) {
      return {
        is_template: false,
        workflow_name: undefined
      }
    }

    try {
      const activeWorkflow = this._workflowStore.activeWorkflow

      if (activeWorkflow?.filename) {
        const isTemplate = this._templatesStore.knownTemplateNames.has(
          activeWorkflow.filename
        )

        if (isTemplate) {
          const template = this._templatesStore.getTemplateByName(
            activeWorkflow.filename
          )
          return {
            is_template: true,
            workflow_name: activeWorkflow.filename,
            template_source: template?.sourceModule,
            template_category: template?.category,
            template_tags: template?.tags,
            template_models: template?.models,
            template_use_case: template?.useCase,
            template_license: template?.license
          }
        }

        return {
          is_template: false,
          workflow_name: activeWorkflow.filename
        }
      }

      return {
        is_template: false,
        workflow_name: undefined
      }
    } catch (error) {
      console.error('Failed to get execution context:', error)
      return {
        is_template: false,
        workflow_name: undefined
      }
    }
  }
}
