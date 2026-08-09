import type {
  APIRequestContext,
  Locator,
  Page,
  Response,
  TestInfo
} from '@playwright/test'
import { createCipheriv, randomBytes } from 'node:crypto'
import { test as base } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'
import MCR from 'monocart-coverage-reports'

import { COVERAGE_OUTPUT_DIR } from '@e2e/coverageConfig'
import {
  ENTRY_PATHS,
  TOUR_SEEN_SETTING
} from '@/platform/onboarding/onboardingTours'
import { NodeBadgeMode } from '@/types/nodeSource'
import {
  EMPTY_BILLING_BALANCE,
  EMPTY_BILLING_PLANS,
  LEGACY_PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import {
  UNSUBSCRIBED,
  ZERO_BALANCE
} from '@e2e/fixtures/data/subscriptionFixtures'
import { ComfyActionbar } from '@e2e/fixtures/components/Actionbar'
import { ComfyTemplates } from '@e2e/fixtures/components/Templates'
import { ComfyMouse } from '@e2e/fixtures/ComfyMouse'
import { TestIds } from '@e2e/fixtures/selectors'
import { comfyExpect } from '@e2e/fixtures/utils/customMatchers'
import {
  assertCloudCustomNodeBootGuard,
  finalizeCloudCustomNodeBootGuardAtTraceBoundary,
  installCustomNodeBlankStartup,
  installCloudCustomNodeBootGuard,
  readCloudCustomNodeBootGuard,
  runWithCollectedCleanup
} from '@e2e/fixtures/utils/customNodeSuite'
import {
  setPageDiagnosticAttachmentSink,
  setPageDiagnosticSanitizer
} from '@e2e/fixtures/utils/consoleErrorCollector'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { nextFrame, sleep } from '@e2e/fixtures/utils/timing'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { BottomPanel } from '@e2e/fixtures/components/BottomPanel'
import { ComfyNodeSearchBox } from '@e2e/fixtures/components/ComfyNodeSearchBox'
import { ComfyNodeSearchBoxV2 } from '@e2e/fixtures/components/ComfyNodeSearchBoxV2'
import { ConfirmDialog } from '@e2e/fixtures/components/ConfirmDialog'
import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { MediaLightbox } from '@e2e/fixtures/components/MediaLightbox'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { SettingDialog } from '@e2e/fixtures/components/SettingDialog'
import { TemplatesDialog } from '@e2e/fixtures/components/TemplatesDialog'
import { TitleEditor } from '@e2e/fixtures/components/TitleEditor'
import {
  AssetsSidebarTab,
  ModelLibrarySidebarTab,
  NodeLibrarySidebarTab,
  NodeLibrarySidebarTabV2,
  SidebarTab,
  WorkflowsSidebarTab
} from '@e2e/fixtures/components/SidebarTab'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'
import {
  armCloudHttp502ReporterBoundary,
  CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES
} from '@e2e/fixtures/customNode/cloudTraceReporter'
import {
  cloudHttp502EvidenceAdditionalAuthenticatedData,
  cloudHttp502EvidenceBinding,
  cloudHttp502EvidenceKey,
  CloudHttp502EvidenceError,
  serializeCloudHttp502PublicEvidence
} from '@e2e/fixtures/customNode/cloudHttp502Evidence'
import type { CloudHttp502EvidenceBinding } from '@e2e/fixtures/customNode/cloudHttp502Evidence'
import { AppModeHelper } from '@e2e/fixtures/helpers/AppModeHelper'
import { AssetsHelper } from '@e2e/fixtures/helpers/AssetsHelper'
import { CanvasHelper } from '@e2e/fixtures/helpers/CanvasHelper'
import { ClipboardHelper } from '@e2e/fixtures/helpers/ClipboardHelper'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { CommandHelper } from '@e2e/fixtures/helpers/CommandHelper'
import { DragDropHelper } from '@e2e/fixtures/helpers/DragDropHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { KeyboardHelper } from '@e2e/fixtures/helpers/KeyboardHelper'
import { ModelLibraryHelper } from '@e2e/fixtures/helpers/ModelLibraryHelper'
import { NodeOperationsHelper } from '@e2e/fixtures/helpers/NodeOperationsHelper'
import { PerformanceHelper } from '@e2e/fixtures/helpers/PerformanceHelper'
import { SettingsHelper } from '@e2e/fixtures/helpers/SettingsHelper'
import { seedSmokeAuth } from '@e2e/fixtures/helpers/smokeAuth'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import { WorkflowHelper } from '@e2e/fixtures/helpers/WorkflowHelper'
import type { WorkspaceStore } from '@e2e/types/globals'

dotenvConfig()

class ComfyPropertiesPanel {
  readonly root: Locator
  readonly panelTitle: Locator
  readonly searchBox: Locator
  readonly titleEditor: TitleEditor
  readonly toggleButton: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId(TestIds.propertiesPanel.root)
    this.panelTitle = this.root.locator('h3')
    this.searchBox = this.root.getByPlaceholder(/^Search/)
    this.titleEditor = new TitleEditor(this.root)
    this.toggleButton = page.getByRole('button', {
      name: 'Toggle properties panel'
    })
  }
}

class ComfyMenu {
  private _appsTab: SidebarTab | null = null
  private _assetsTab: AssetsSidebarTab | null = null
  private _modelLibraryTab: ModelLibrarySidebarTab | null = null
  private _nodeLibraryTab: NodeLibrarySidebarTab | null = null
  private _nodeLibraryTabV2: NodeLibrarySidebarTabV2 | null = null
  private _workflowsTab: WorkflowsSidebarTab | null = null
  private _topbar: Topbar | null = null

  public readonly sideToolbar: Locator
  public readonly propertiesPanel: ComfyPropertiesPanel
  public readonly modeToggleButton: Locator
  public readonly buttons: Locator

  constructor(public readonly page: Page) {
    this.sideToolbar = page.getByTestId(TestIds.sidebar.toolbar)
    this.modeToggleButton = page.getByTestId(TestIds.sidebar.modeToggle)
    this.propertiesPanel = new ComfyPropertiesPanel(page)
    this.buttons = this.sideToolbar.locator('.side-bar-button')
  }

  get modelLibraryTab() {
    this._modelLibraryTab ??= new ModelLibrarySidebarTab(this.page)
    return this._modelLibraryTab
  }

  get nodeLibraryTab() {
    this._nodeLibraryTab ??= new NodeLibrarySidebarTab(this.page)
    return this._nodeLibraryTab
  }

  get nodeLibraryTabV2() {
    this._nodeLibraryTabV2 ??= new NodeLibrarySidebarTabV2(this.page)
    return this._nodeLibraryTabV2
  }

  get appsTab() {
    this._appsTab ??= new SidebarTab(this.page, 'apps')
    return this._appsTab
  }

  get assetsTab() {
    this._assetsTab ??= new AssetsSidebarTab(this.page)
    return this._assetsTab
  }

  get workflowsTab() {
    this._workflowsTab ??= new WorkflowsSidebarTab(this.page)
    return this._workflowsTab
  }

  get topbar() {
    this._topbar ??= new Topbar(this.page)
    return this._topbar
  }

  async toggleTheme() {
    const currentTheme = await this.getThemeId()
    await this.modeToggleButton.click()
    await this.page.waitForFunction(
      (prevTheme) => {
        const settings = window.app?.ui?.settings
        return (
          settings &&
          settings.getSettingValue('Comfy.ColorPalette') !== prevTheme
        )
      },
      currentTheme,
      { timeout: 5000 }
    )
  }

  async getThemeId() {
    return await this.page.evaluate(async () => {
      return await window.app!.ui.settings.getSettingValue('Comfy.ColorPalette')
    })
  }
}

// Only DEFINITIVELY third-party analytics hosts. A failure to one of these is
// external and never ours to fix. Everything ambiguous - a Three.js
// double-instance, a double-registered extension, a bare ERR_FAILED, a CORS
// error to any other host - is kept, because it can be a real bundling bug.
// sentry\.io, not bare sentry: the app ships a same-origin vendor-sentry-*.js
// chunk, and the bare word suppressed the trace line naming its load failure
// (run 30855533100 - the filter hid the outage the telemetry blocker caused).
const TRACE_TELEMETRY =
  /mp\.comfy\.org|customer\.io|gist\.build|sy-d\.io|sentry\.io/

// Dedupe over filter. The app boots against real Cloud, so the same error (a
// per-node widget warning, a repeated failed poll) fires thousands of times
// and buries the distinct problems. Every unique line still shows once; exact
// repeats are collapsed and a count is emitted at teardown, so a
// high-frequency error stays visible as such without the churn.
interface CloudHttp502 {
  status: 502
  method: string
  url: string
  rawUrl: string
  headers: Record<string, string>
  body: string | null
  bodyCapture: 'captured' | 'pending' | 'unavailable'
}

type CloudHttp502EncryptedEvidence = Omit<CloudHttp502, 'rawUrl'>

interface CloudPageTrace {
  run: <T>(operation: () => Promise<T>) => Promise<T>
  finalize: (
    testInfo: Pick<TestInfo, 'attach'> &
      Partial<Pick<TestInfo, 'annotations' | 'errors'>>
  ) => Promise<void>
  sanitize: (error: unknown, redactFreeform?: boolean) => Error
}

const CLOUD_ROUTING_HEADERS = ['cf-ray', 'server', 'via'] as const
const CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES = 1024 * 1024
const CLOUD_HTTP_502_EVIDENCE_LENGTH_BYTES = 4

function encryptCloudHttp502Evidence(
  evidence: readonly CloudHttp502EncryptedEvidence[],
  binding: CloudHttp502EvidenceBinding
): string {
  const key = cloudHttp502EvidenceKey()

  const payload = Buffer.from(JSON.stringify(evidence), 'utf8')
  if (
    payload.length >
    CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES -
      CLOUD_HTTP_502_EVIDENCE_LENGTH_BYTES
  )
    throw new CloudHttp502EvidenceError(
      'Cloud HTTP 502 encrypted evidence could not be retained'
    )

  const plaintext = Buffer.allocUnsafe(CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES)
  plaintext.writeUInt32BE(payload.length)
  payload.copy(plaintext, CLOUD_HTTP_502_EVIDENCE_LENGTH_BYTES)
  randomBytes(
    CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES -
      CLOUD_HTTP_502_EVIDENCE_LENGTH_BYTES -
      payload.length
  ).copy(plaintext, CLOUD_HTTP_502_EVIDENCE_LENGTH_BYTES + payload.length)

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(cloudHttp502EvidenceAdditionalAuthenticatedData(binding))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return JSON.stringify(
    {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64')
    },
    null,
    2
  )
}

function safeNetworkUrl(value: string): string {
  const url = new URL(value)
  return `${url.origin}${url.pathname}`
}

function sanitizeTraceText(
  value: string,
  redactions: readonly string[] = []
): string {
  let sanitized = value
  for (const redaction of redactions)
    if (redaction)
      sanitized = sanitized.replaceAll(
        redaction,
        '[redacted Cloud 502 response body]'
      )
  return sanitized
    .split('\n')
    .map((line) => {
      const marker = line.search(/[?#]/)
      return marker === -1 ? line : line.slice(0, marker)
    })
    .join('\n')
}

function sanitizeTraceError(
  error: unknown,
  redactions: readonly string[] = [],
  redactFreeform = false,
  publicErrors = new WeakSet<Error>(),
  seen = new WeakSet<object>()
): Error {
  if (!(error instanceof Error)) {
    return new Error(
      redactFreeform
        ? 'Fixture operation failed with redacted free-form text at strict Cloud trace boundary'
        : typeof error === 'string'
          ? sanitizeTraceText(error, redactions)
          : 'Fixture operation failed with a non-Error rejection'
    )
  }
  if (seen.has(error)) return new Error('Circular fixture error reference')
  seen.add(error)

  const options =
    'cause' in error
      ? {
          cause: sanitizeTraceError(
            error.cause,
            redactions,
            redactFreeform,
            publicErrors,
            seen
          )
        }
      : undefined
  const preserveMessage =
    !redactFreeform ||
    error instanceof CloudHttp502EvidenceError ||
    publicErrors.has(error)
  const message = preserveMessage
    ? sanitizeTraceText(error.message, redactions)
    : `Free-form ${error.name} message redacted at strict Cloud trace boundary`
  const sanitized =
    error instanceof AggregateError
      ? new AggregateError(
          [...error.errors].map((nested) =>
            sanitizeTraceError(
              nested,
              redactions,
              redactFreeform,
              publicErrors,
              seen
            )
          ),
          message,
          options
        )
      : new Error(message, options)
  sanitized.name = preserveMessage
    ? sanitizeTraceText(error.name, redactions)
    : error instanceof AggregateError
      ? 'AggregateError'
      : 'Error'
  if (error.stack && preserveMessage)
    sanitized.stack = sanitizeTraceText(error.stack, redactions)
  return sanitized
}

function redactedTraceDiagnostic(line: string): string {
  const channel =
    line.match(
      /^\[trace\] (console\.(?:error|warning)|page error|navigated|request FAILED)/
    )?.[1] ?? 'diagnostic'
  return `[trace] ${channel}: [free-form text redacted at strict Cloud trace boundary]`
}

export function traceCloudPage(
  page: Page,
  failOn502 = false,
  evidenceBinding: CloudHttp502EvidenceBinding = cloudHttp502EvidenceBinding({
    testId: 'local-trace',
    retry: 0
  })
): CloudPageTrace {
  const counts = new Map<string, number>()
  const bufferedDiagnostics: string[] = []
  const freeformDiagnostics = new Set<string>()
  const http502s: CloudHttp502[] = []
  const bodyCaptures: Promise<void>[] = []
  const lifecycleErrors: unknown[] = []
  const diagnosticAttachments: {
    name: string
    values: readonly string[]
  }[] = []
  const publicErrors = new WeakSet<Error>()
  const sanitizeError = (
    error: unknown,
    redactFreeform = http502s.length > 0
  ) =>
    sanitizeTraceError(
      error,
      http502s.flatMap(({ body }) => (body ? [body] : [])),
      redactFreeform,
      publicErrors
    )
  const sanitizeDiagnostic = (value: string) =>
    sanitizeTraceText(
      value,
      http502s.flatMap(({ body }) => (body ? [body] : []))
    )
  let endBodyCaptures: () => void = () => {}
  const bodyCapturesEnded = new Promise<void>((resolve) => {
    endBodyCaptures = resolve
  })
  let lifecycle: Promise<void> | undefined
  let rejectOn502: (error: Error) => void = () => {}
  let failFastError: Error | undefined
  let failFastObserved = false
  const failFast = new Promise<never>((_, reject) => {
    rejectOn502 = reject
  })
  void failFast.catch(() => {})
  const publicDiagnostic = (line: string) =>
    (http502s.length > 0 || lifecycleErrors.length > 0) &&
    freeformDiagnostics.has(line)
      ? redactedTraceDiagnostic(line)
      : sanitizeDiagnostic(line)
  setPageDiagnosticSanitizer(page, (value, channel) =>
    !failOn502
      ? value
      : http502s.length > 0
        ? `[${channel} redacted after Cloud returned HTTP 502]`
        : sanitizeTraceText(value)
  )
  if (failOn502)
    setPageDiagnosticAttachmentSink(page, async (name, values) => {
      diagnosticAttachments.push({ name, values })
    })
  const once = (line: string, freeform = false) => {
    if (TRACE_TELEMETRY.test(line)) return
    if (freeform) freeformDiagnostics.add(line)
    const seen = counts.get(line) ?? 0
    counts.set(line, seen + 1)
    if (seen !== 0) return
    if (failOn502) bufferedDiagnostics.push(line)
    else console.warn(publicDiagnostic(line))
  }
  const flushDiagnostics = () => {
    for (const line of bufferedDiagnostics) console.warn(publicDiagnostic(line))
    for (const [line, n] of counts)
      if (n > 1) console.warn(`[trace] (x${n}) ${publicDiagnostic(line)}`)
    bufferedDiagnostics.length = 0
  }
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame())
      once(`[trace] navigated -> ${sanitizeTraceText(frame.url())}`, true)
  })
  page.on('pageerror', (error) =>
    once(`[trace] page error: ${sanitizeTraceText(error.message)}`, true)
  )
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return
    once(
      `[trace] console.${message.type()}: ${sanitizeTraceText(message.text())}`,
      true
    )
  })
  page.on('requestfailed', (request) => {
    const err = request.failure()?.errorText ?? 'unknown'
    // net::ERR_ABORTED is the page navigating away mid-request - benign.
    if (err.includes('ERR_ABORTED')) return
    once(
      `[trace] request FAILED ${request.method()} ${safeNetworkUrl(request.url())} - ${sanitizeTraceText(err)}`,
      true
    )
  })
  const onResponse = (response: Response) => {
    const rawUrl = response.url()
    const url = safeNetworkUrl(rawUrl)
    const status = response.status()
    if (status === 502) {
      const responseHeaders = response.headers()
      const record: CloudHttp502 = {
        status: 502,
        method: response.request().method(),
        url,
        rawUrl,
        headers: Object.fromEntries(
          CLOUD_ROUTING_HEADERS.flatMap((name) => {
            const value = responseHeaders[name]
            return value === undefined ? [] : [[name, value]]
          })
        ),
        body: null,
        bodyCapture: 'pending'
      }
      http502s.push(record)
      if (failOn502 && !failFastError) {
        failFastError = new Error(
          `Cloud returned an HTTP 502 response; any 502 fails S1-S12 even if the request later recovers. ` +
            `See cloud-http-502-responses.json. First: ${record.method} ${record.url} ` +
            `headers=${JSON.stringify(record.headers)}`
        )
        publicErrors.add(failFastError)
        rejectOn502(failFastError)
      }
      const bodyCapture = Promise.race([
        response.text().then(
          (body) => ({ body, captured: true as const }),
          () => ({ body: null, captured: false as const })
        ),
        bodyCapturesEnded.then(() => ({ body: null, captured: false as const }))
      ]).then(({ body, captured }) => {
        if (captured) {
          record.body = body
          record.bodyCapture = 'captured'
        } else {
          record.bodyCapture = 'unavailable'
        }
        once(
          `[trace] HTTP 502 detail ${JSON.stringify({
            status: record.status,
            method: record.method,
            url: record.url,
            headers: record.headers,
            bodyCapture: record.bodyCapture
          })}`,
          true
        )
      })
      bodyCaptures.push(bodyCapture)
    }
    if (status >= 400)
      once(`[trace] HTTP ${status} ${response.request().method()} ${url}`)
    else if (/\/api\/(features|users|object_info)/.test(url))
      once(`[trace] HTTP ${status} ${url}`)
  }
  page.on('response', onResponse)
  page.on('close', () => {
    if (!failOn502) flushDiagnostics()
  })
  const finishLifecycle = () => {
    lifecycle ??= (async () => {
      if (failOn502 && !page.isClosed()) {
        try {
          await page.close()
        } catch (error) {
          lifecycleErrors.push(error)
        }
      }
      page.off('response', onResponse)
      endBodyCaptures()
      await Promise.allSettled(bodyCaptures)
      if (failOn502) flushDiagnostics()
    })()
    return lifecycle
  }
  return {
    run: async <T>(operation: () => Promise<T>) => {
      if (!failOn502) return operation()
      const running = operation()
      let operationError: unknown
      let operationRejected = false
      void running.then(
        () => {},
        (error) => {
          operationError = error
          operationRejected = true
        }
      )
      try {
        return await Promise.race([running, failFast])
      } catch (error) {
        const gateError = failFastError
        if (gateError) {
          failFastObserved = true
          await finishLifecycle()
          if (error !== gateError || operationRejected) {
            const sanitizedOperationError = sanitizeError(
              error === gateError ? operationError : error
            )
            // The caught error may contain URL secrets; preserve only its sanitized clone.
            const aggregate = new AggregateError(
              [gateError, sanitizedOperationError],
              `${gateError.message}; fixture operation also failed while closing`,
              { cause: sanitizedOperationError }
            )
            publicErrors.add(aggregate)
            throw aggregate
          }
          throw gateError
        }
        throw sanitizeError(error)
      }
    },
    finalize: async (testInfo) => {
      try {
        await finishLifecycle()
        const errors: unknown[] = lifecycleErrors.map((error) =>
          sanitizeError(error, true)
        )
        const redactDiagnostics =
          http502s.length > 0 || lifecycleErrors.length > 0
        for (const { name, values } of diagnosticAttachments) {
          try {
            await testInfo.attach(name, {
              body: JSON.stringify(
                values.map((value) =>
                  redactDiagnostics
                    ? '[console.error redacted at strict Cloud trace boundary]'
                    : sanitizeTraceText(value)
                ),
                null,
                2
              ),
              contentType: 'application/json'
            })
          } catch (error) {
            errors.push(sanitizeError(error, true))
          }
        }
        diagnosticAttachments.length = 0
        if (!failOn502 || http502s.length === 0) {
          if (errors.length === 1) throw errors[0]
          if (errors.length > 1)
            throw new AggregateError(
              errors,
              'Cloud trace finalization or diagnostic attachment failed'
            )
          return
        }
        const publicEvidence = http502s.map(
          ({ status, method, url, headers, bodyCapture }) => ({
            status,
            method,
            url,
            headers: { ...headers },
            bodyCapture
          })
        )
        const rawEvidence = http502s.map(({ rawUrl, ...record }) => ({
          ...record,
          url: rawUrl,
          headers: { ...record.headers }
        }))
        const first = http502s[0]
        const gateError =
          failFastError ??
          new Error(
            `Cloud returned ${http502s.length} HTTP 502 response(s); any 502 fails S1-S12 even if the request later recovers. ` +
              `See cloud-http-502-responses.json. First: ${first.method} ${first.url} ` +
              `headers=${JSON.stringify(first.headers)}`
          )
        publicErrors.add(gateError)
        const incompleteBodies = publicEvidence.filter(
          ({ bodyCapture }) => bodyCapture !== 'captured'
        )
        if (!failFastObserved) errors.push(gateError)
        if (incompleteBodies.length > 0) {
          const error = new Error(
            `Cloud HTTP 502 response-body capture was incomplete for ${incompleteBodies.length} response(s); see cloud-http-502-responses.json`
          )
          publicErrors.add(error)
          errors.push(error)
        }
        try {
          await testInfo.attach('cloud-http-502-responses.json', {
            body: serializeCloudHttp502PublicEvidence(
              publicEvidence,
              evidenceBinding
            ),
            contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
              'cloud-http-502-responses.json'
            )
          })
        } catch (error) {
          errors.push(sanitizeError(error, true))
        }
        if (rawEvidence.some(({ bodyCapture }) => bodyCapture === 'captured')) {
          try {
            await testInfo.attach('cloud-http-502-response-bodies.enc.json', {
              body: encryptCloudHttp502Evidence(rawEvidence, evidenceBinding),
              contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
                'cloud-http-502-response-bodies.enc.json'
              )
            })
          } catch (error) {
            errors.push(sanitizeError(error, true))
          }
        }
        if (errors.length === 1) throw errors[0]
        if (errors.length > 1) {
          const aggregate = new AggregateError(
            errors,
            'Cloud HTTP 502 gate or evidence capture failed'
          )
          publicErrors.add(aggregate)
          throw aggregate
        }
      } finally {
        if (http502s.length > 0) armCloudHttp502ReporterBoundary(testInfo)
      }
    },
    sanitize: sanitizeError
  }
}

export class ComfyPage {
  public readonly url: string
  public readonly apiUrl: string
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator
  public readonly selectionToolbox: Locator
  public readonly widgetTextBox: Locator

  // Buttons
  public readonly resetViewButton: Locator
  public readonly queueButton: Locator // Run button in Legacy UI
  public readonly runButton: Locator // Run button (renamed "Queue" -> "Run")

  // Inputs
  public readonly workflowUploadInput: Locator

  // Components
  public readonly searchBox: ComfyNodeSearchBox
  public readonly searchBoxV2: ComfyNodeSearchBoxV2
  public readonly menu: ComfyMenu
  public readonly actionbar: ComfyActionbar
  public readonly templates: ComfyTemplates
  public readonly settingDialog: SettingDialog
  public readonly confirmDialog: ConfirmDialog
  public readonly templatesDialog: TemplatesDialog
  public readonly titleEditor: TitleEditor
  public readonly mediaLightbox: MediaLightbox
  public readonly vueNodes: VueNodeHelpers
  public readonly appMode: AppModeHelper
  public readonly subgraph: SubgraphHelper
  public readonly canvasOps: CanvasHelper
  public readonly nodeOps: NodeOperationsHelper
  public readonly settings: SettingsHelper
  public readonly keyboard: KeyboardHelper
  public readonly clipboard: ClipboardHelper
  public readonly workflow: WorkflowHelper
  public readonly contextMenu: ContextMenu
  public readonly toast: ToastHelper
  public readonly dragDrop: DragDropHelper
  public readonly featureFlags: FeatureFlagHelper
  public readonly command: CommandHelper
  public readonly bottomPanel: BottomPanel
  public readonly queuePanel: QueuePanel
  public readonly perf: PerformanceHelper
  public readonly assets: AssetsHelper
  public readonly modelLibrary: ModelLibraryHelper
  public readonly cloudAuth: CloudAuthHelper
  public readonly visibleToasts: Locator

  /** Worker index to test user ID */
  public readonly userIds: string[] = []

  /** Whether the current test runs in Vue Nodes mode (initialized from `@vue-nodes` tag). */
  public isVueNodes = false

  /** Test user ID for the current context */
  get id() {
    return this.userIds[comfyPageFixture.info().parallelIndex]
  }

  constructor(
    public readonly page: Page,
    public readonly request: APIRequestContext
  ) {
    this.url = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
    this.apiUrl = process.env.PLAYWRIGHT_SETUP_API_URL || this.url
    this.canvas = page.locator('#graph-canvas')
    this.selectionToolbox = page.getByTestId(TestIds.selectionToolbox.root)
    this.widgetTextBox = page.getByPlaceholder('text').nth(1)
    this.resetViewButton = page.getByRole('button', { name: 'Reset View' })
    this.queueButton = page.getByRole('button', { name: 'Queue Prompt' })
    this.runButton = page.getByTestId(TestIds.topbar.queueButton)
    this.workflowUploadInput = page.locator('#comfy-file-input')

    this.searchBox = new ComfyNodeSearchBox(page)
    this.searchBoxV2 = new ComfyNodeSearchBoxV2(this)
    this.menu = new ComfyMenu(page)
    this.actionbar = new ComfyActionbar(page)
    this.templates = new ComfyTemplates(page)
    this.settingDialog = new SettingDialog(page, this)
    this.confirmDialog = new ConfirmDialog(page)
    this.templatesDialog = new TemplatesDialog(page)
    this.titleEditor = new TitleEditor(page)
    this.mediaLightbox = new MediaLightbox(page)
    this.vueNodes = new VueNodeHelpers(page)
    this.appMode = new AppModeHelper(this)
    this.subgraph = new SubgraphHelper(this)
    this.canvasOps = new CanvasHelper(page, this.canvas, this.resetViewButton)
    this.nodeOps = new NodeOperationsHelper(this)
    this.settings = new SettingsHelper(page)
    this.keyboard = new KeyboardHelper(page, this.canvas)
    this.clipboard = new ClipboardHelper(this.keyboard, page)
    this.workflow = new WorkflowHelper(this)
    this.contextMenu = new ContextMenu(page)
    this.toast = new ToastHelper(page)
    this.visibleToasts = this.toast.visibleToasts
    this.dragDrop = new DragDropHelper(page)
    this.featureFlags = new FeatureFlagHelper(page)
    this.command = new CommandHelper(page)
    this.bottomPanel = new BottomPanel(page)
    this.queuePanel = new QueuePanel(page)
    this.perf = new PerformanceHelper(page)
    this.assets = new AssetsHelper(page)
    this.modelLibrary = new ModelLibraryHelper(page)
    this.cloudAuth = new CloudAuthHelper(page)
  }

  async setupUser(username: string) {
    const res = await this.request.get(`${this.apiUrl}/api/users`)
    if (res.status() !== 200)
      throw new Error(`Failed to retrieve users: ${await res.text()}`)

    const apiRes = await res.json()
    const user = Object.entries(apiRes?.users ?? {}).find(
      ([, name]) => name === username
    )
    const id = user?.[0]

    return id ? id : await this.createUser(username)
  }

  async createUser(username: string) {
    const resp = await this.request.post(`${this.apiUrl}/api/users`, {
      data: { username }
    })

    if (resp.status() !== 200) {
      const body = await resp.text()
      // Persistent backends (Comfy Desktop server user storage) keep the user
      // across runs and do not list it via GET /api/users, so a duplicate means
      // it already exists. Returns the username since the generated id is not
      // retrievable here; only reached on single-user / default-resolving backends.
      if (resp.status() === 400 && body.includes('Duplicate username.'))
        return username
      throw new Error(`Failed to create user: ${body}`)
    }

    return await resp.json()
  }

  async setupSettings(settings: Record<string, unknown>) {
    const resp = await this.request.post(
      `${this.apiUrl}/api/devtools/set_settings`,
      {
        data: settings
      }
    )

    if (resp.status() !== 200) {
      throw new Error(`Failed to setup settings: ${await resp.text()}`)
    }
  }

  async setup({
    clearStorage = true,
    mockReleases = true,
    url
  }: {
    clearStorage?: boolean
    mockReleases?: boolean
    url?: string
  } = {}) {
    // Mock release endpoint to prevent changelog popups (before navigation)
    if (mockReleases) {
      await this.page.route('**/releases**', async (route) => {
        const url = route.request().url()
        if (
          url.includes('api.comfy.org') ||
          url.includes('stagingapi.comfy.org')
        ) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
          })
        } else {
          await route.continue()
        }
      })
    }

    // Skipped on cloud: a Playwright context starts with empty storage, so
    // this only resets a REUSED context - but on cloud the smoke user has
    // already signed in by now, and both the navigation and the wipe destroy
    // that session. The app then boots signed out, so teamWorkspaceStore
    // cannot init ("User not authenticated") and Cloud answers every
    // workspace-scoped call with 403.
    if (clearStorage && customNodesEnv() !== 'cloud') {
      // Navigate to a lightweight same-origin endpoint to obtain a page
      // context for clearing storage without loading the full frontend app.
      await this.page.goto(`${this.url}/api/users`)
      await this.page.evaluate((id) => {
        localStorage.clear()
        sessionStorage.clear()
        localStorage.setItem('Comfy.userId', id)
      }, this.id)
    }

    await this.goto({ url })

    await this.page.waitForFunction(() => document.fonts.ready)
    await this.waitForAppReady()
  }

  /**
   * Wait for the app to finish initializing after navigation/reload:
   * `window.app.extensionManager` is present, the PrimeVue block-UI mask is
   * hidden, and one animation frame has elapsed. Shared by `setup()` and
   * `WorkflowHelper.reloadAndWaitForApp()`.
   */
  async waitForAppReady() {
    const readyFuseMs = 300_000
    // Fail fast on the first auth failure. A signed-out app answers every
    // /api call 401/403 and never becomes ready, so without this the run
    // burns the whole fuse before reporting. Only same-origin xhr/fetch
    // counts - a bare document GET to /api/users legitimately 401s. Local
    // ComfyUI has no auth, so on core these calls are 200 and this never
    // fires; it needs no cloud guard.
    let onAuthFail: ((response: Response) => void) | undefined
    const authFailed = new Promise<never>((_, reject) => {
      onAuthFail = (response) => {
        const status = response.status()
        if (status !== 401 && status !== 403) return
        const type = response.request().resourceType()
        if (type !== 'xhr' && type !== 'fetch') return
        const url = response.url()
        if (!url.includes('localhost') || !url.includes('/api/')) return
        const method = response.request().method()
        // testcloud started 403ing the Firebase-token settings write
        // (~2026-08-03, probe run 30873678137: currentUser=true, firebase
        // fallback taken, write still 403) while other endpoints may still
        // accept the token. A boot-window settings-write rejection must not
        // kill the test before that is observable.
        const settingsWrite =
          (method === 'POST' || method === 'PUT') &&
          url.includes('/api/settings')
        if (settingsWrite) return
        reject(new Error(`cloud auth failed: HTTP ${status} ${method} ${url}`))
      }
      this.page.on('response', onAuthFail)
    })
    authFailed.catch(() => {})
    try {
      const ready = (async () => {
        await this.page.waitForFunction(
          // window.app => GraphCanvas ready
          // window.app.extensionManager => GraphView ready
          () => window.app?.extensionManager,
          null,
          { timeout: readyFuseMs }
        )
        await this.page
          .locator('.p-blockui-mask')
          .waitFor({ state: 'hidden', timeout: readyFuseMs })
      })()
      await Promise.race([ready, authFailed])
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('cloud auth')) {
        console.warn(
          `[cloud] ${error.message} - aborting, session not authorized`
        )
        throw error
      }
      const state = await this.describeUnreadyApp()
      console.warn(`[cloud] app never became ready: ${state}`)
      throw new Error(`app never became ready: ${state}`, { cause: error })
    } finally {
      if (onAuthFail) this.page.off('response', onAuthFail)
    }
    await this.nextFrame()
  }

  /**
   * Why the app is not ready, in one line, for the failure message. A bare
   * "timeout exceeded" cannot tell a stalled sign-in from a crashed boot from
   * a backend that never answered, which is the difference between a
   * five-minute fix and a day of guessing - so every unready-app failure
   * carries this. Best-effort by construction: it runs on an already-failing
   * page, so it reports what it could not read rather than throwing over it.
   */
  private async describeUnreadyApp(): Promise<string> {
    try {
      const state = await this.page.evaluate(() => ({
        url: location.href,
        title: document.title,
        hasApp: !!window.app,
        hasExtensionManager: !!window.app?.extensionManager,
        blockUiVisible: !!document.querySelector('.p-blockui-mask'),
        // A cloud session that failed to seed lands on a sign-in view, which
        // looks identical to a slow boot from the outside.
        signInVisible: !!document.querySelector(
          '[data-testid*="sign-in"], [class*="SignIn"], form[action*="signin"]'
        ),
        bodyText: document.body?.innerText?.slice(0, 300) ?? ''
      }))
      return (
        `url=${state.url} title=${JSON.stringify(state.title)} ` +
        `window.app=${state.hasApp} extensionManager=${state.hasExtensionManager} ` +
        `blockUiMask=${state.blockUiVisible} signInView=${state.signInVisible} ` +
        `body=${JSON.stringify(state.bodyText)}`
      )
    } catch (probeError) {
      return `page state unreadable (${probeError instanceof Error ? probeError.message : String(probeError)})`
    }
  }

  /** @deprecated Use standalone `assetPath` from `browser_tests/fixtures/utils/assetPath` directly. */
  public assetPath(fileName: string) {
    return assetPath(fileName)
  }

  async goto({ url }: { url?: string } = {}) {
    await this.page.goto(url ? new URL(url, this.url).toString() : this.url)
  }

  async nextFrame() {
    await nextFrame(this.page)
  }

  async idleFrames(count: number) {
    for (let i = 0; i < count; i++) {
      await this.nextFrame()
    }
  }

  async delay(ms: number) {
    return sleep(ms)
  }

  /**
   * Attach a screenshot to the test report.
   * By default, screenshots are only taken in non-CI environments.
   * @param name - Name for the screenshot attachment
   * @param options - Optional configuration
   * @param options.runInCI - Whether to take screenshot in CI (default: false)
   * @param options.fullPage - Whether to capture full page (default: false)
   */
  async attachScreenshot(
    name: string,
    options: { runInCI?: boolean; fullPage?: boolean } = {}
  ) {
    const { runInCI = false, fullPage = false } = options

    // Skip in CI unless explicitly requested
    if (process.env.CI && !runInCI) {
      return
    }

    const testInfo = comfyPageFixture.info()
    await testInfo.attach(name, {
      body: await this.page.screenshot({ fullPage }),
      contentType: 'image/png'
    })
  }

  async closeMenu() {
    await this.page.locator('button.comfy-close-menu-btn').click()
    await this.nextFrame()
  }

  async clickDialogButton(prompt: string, buttonText: string = 'Yes') {
    const modal = this.page.locator(
      `.comfy-modal-content:has-text("${prompt}")`
    )
    await modal.waitFor({ state: 'visible' })
    await modal
      .locator('.comfyui-button', {
        hasText: buttonText
      })
      .click()
    await modal.waitFor({ state: 'hidden' })
  }

  get domWidgets(): Locator {
    return this.page.locator('.dom-widget')
  }

  async expectScreenshot(
    locator: Locator,
    name: string | string[],
    options?: {
      animations?: 'disabled' | 'allow'
      caret?: 'hide' | 'initial'
      mask?: Array<Locator>
      maskColor?: string
      maxDiffPixelRatio?: number
      maxDiffPixels?: number
      omitBackground?: boolean
      scale?: 'css' | 'device'
      stylePath?: string | Array<string>
      threshold?: number
      timeout?: number
    }
  ): Promise<void> {
    await this.nextFrame()
    await comfyExpect(locator).toHaveScreenshot(name, options)
  }

  async setFocusMode(focusMode: boolean) {
    await this.page.evaluate((focusMode) => {
      ;(window.app!.extensionManager as WorkspaceStore).focusMode = focusMode
    }, focusMode)
    await this.nextFrame()
  }
}

class ComfyFiles {
  protected teardownCallbacks: (() => Promise<unknown>)[] = []

  constructor(protected readonly comfyPage: ComfyPage) {}

  async teardown() {
    await Promise.all(this.teardownCallbacks.map((cb) => cb()))
  }

  deleteAfterTest(file: {
    filename: string
    subfolder?: string
    type?: string
  }) {
    this.teardownCallbacks.push(() =>
      this.comfyPage.request.delete(
        `${this.comfyPage.url}/api/devtools/view?${new URLSearchParams(file)}`
      )
    )
  }
}

export const testComfySnapToGridGridSize = 50

const COLLECT_COVERAGE = process.env.COLLECT_COVERAGE === 'true'

export const comfyPageFixture = base.extend<{
  initialFeatureFlags: Record<string, unknown>
  initialSettings: Record<string, unknown>
  comfyPage: ComfyPage
  comfyMouse: ComfyMouse
  comfyFiles: ComfyFiles
}>({
  // Allows configuring feature flags for tests with before initial setup:
  // `test.use({ initialFeatureFlags: { my_flag: true } })`.
  initialFeatureFlags: [{}, { option: true }],
  // Allows seeding user settings before initial page load:
  // `test.use({ initialSettings: { 'Comfy.Locale': 'zh' } })`. Merged on top of
  // the fixture's defaults so per-test values win.
  initialSettings: [{}, { option: true }],

  page: async ({ page, browserName }, use) => {
    if (browserName !== 'chromium' || !COLLECT_COVERAGE) {
      return use(page)
    }

    await page.coverage.startJSCoverage({ resetOnNavigation: false })
    await use(page)
    const coverage = await page.coverage.stopJSCoverage()

    const mcr = MCR({
      outputDir: COVERAGE_OUTPUT_DIR,
      reports: []
    })
    await mcr.add(coverage)
  },

  comfyPage: async (
    { page, request, initialFeatureFlags, initialSettings, trace },
    use,
    testInfo
  ) => {
    const comfyPage = new ComfyPage(page, request)

    const { parallelIndex } = testInfo
    const username = `playwright-test-${parallelIndex}`
    // Cloud has no local multi-user registry: /api/users and the devtools
    // settings endpoint sit behind the cloud session. The smoke account IS
    // the user, and its workspace JWT seeds startup settings before app boot.
    const isCloudEnv = customNodesEnv() === 'cloud'
    const isCustomNodes = testInfo.project.name === 'custom-nodes'
    const isCloudCustomNodes = isCloudEnv && isCustomNodes
    const cloudPageTrace = isCloudEnv
      ? traceCloudPage(
          page,
          isCloudCustomNodes,
          cloudHttp502EvidenceBinding(testInfo)
        )
      : undefined
    const needsPerf =
      testInfo.tags.includes('@perf') || testInfo.tags.includes('@audit')
    let bootGuardInstalled = false
    let perfStarted = false
    const cleanups: (() => Promise<void>)[] = [
      ...(needsPerf
        ? [
            async () => {
              if (perfStarted) await comfyPage.perf.dispose()
            }
          ]
        : []),
      ...(isCloudCustomNodes
        ? [
            async () => {
              if (!bootGuardInstalled) return
              await finalizeCloudCustomNodeBootGuardAtTraceBoundary(
                page,
                cloudPageTrace!.sanitize
              )
            }
          ]
        : []),
      ...(cloudPageTrace ? [() => cloudPageTrace.finalize(testInfo)] : [])
    ]

    const run = async () => {
      const userId = isCloudEnv ? username : await comfyPage.setupUser(username)
      comfyPage.userIds[parallelIndex] = userId

      const isVueNodes = testInfo.tags.includes('@vue-nodes')
      comfyPage.isVueNodes = isVueNodes

      const startupSettings: Record<string, unknown> = {
        'Comfy.UseNewMenu': 'Top',
        // Hide canvas menu/info/selection toolbox by default.
        'Comfy.Graph.CanvasInfo': false,
        'Comfy.Graph.CanvasMenu': false,
        'Comfy.Canvas.SelectionToolbox': false,
        // Hide all badges by default.
        'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode.None,
        'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.None,
        // Disable tooltips by default to avoid flakiness.
        'Comfy.EnableTooltips': false,
        'Comfy.userId': userId,
        // Set tutorial completed to true to avoid loading the tutorial workflow.
        'Comfy.TutorialCompleted': true,
        // An auto-opened tour's blocker would break unrelated tests.
        [TOUR_SEEN_SETTING]: [...ENTRY_PATHS],
        'Comfy.Queue.MaxHistoryItems': 64,
        'Comfy.SnapToGrid.GridSize': testComfySnapToGridGridSize,
        // Disable toast warning about version compatibility, as they may or
        // may not appear - depending on upstream ComfyUI dependencies
        'Comfy.VersionCompatibility.DisableWarnings': true,
        // Disable errors tab to prevent missing model detection from
        // rendering error indicators on nodes during unrelated tests.
        'Comfy.RightSidePanel.ShowErrorsTab': false,
        ...(isVueNodes && { 'Comfy.VueNodes.Enabled': true }),
        ...initialSettings
      }
      if (!isCloudEnv) {
        try {
          await comfyPage.setupSettings(startupSettings)
        } catch (e) {
          console.error(e)
        }
      }
      if (testInfo.tags.includes('@cloud')) {
        const context = page.context()
        await context.route('**/api/auth/session', (route) =>
          route.fulfill({ status: 204 })
        )
        await context.route('**/api/billing/status', (route) =>
          route.fulfill({ json: LEGACY_PERSONAL_BILLING_STATUS })
        )
        await context.route('**/api/billing/balance', (route) =>
          route.fulfill({ json: EMPTY_BILLING_BALANCE })
        )
        await context.route('**/api/billing/plans', (route) =>
          route.fulfill({ json: EMPTY_BILLING_PLANS })
        )
        await context.route('**/customers/cloud-subscription-status', (route) =>
          route.fulfill({ json: UNSUBSCRIBED })
        )
        await context.route('**/customers/balance', (route) =>
          route.fulfill({ json: ZERO_BALANCE })
        )
        await mockWorkspace(context, workspace('personal', 'owner'), [])
        await comfyPage.cloudAuth.mockAuth()
      } else if (isCloudEnv) {
        const traceMode =
          typeof trace === 'string' ? trace : (trace?.mode ?? 'off')
        if (traceMode !== 'off')
          throw new Error(
            `cloud seeds a real refresh token via page.evaluate, but project ` +
              `'${testInfo.project.name}' traces '${traceMode}' - run with ` +
              `--project=custom-nodes and without --trace`
          )
        const authStartedAt = Date.now()
        await seedSmokeAuth(page, comfyPage.url, startupSettings)
        console.warn(
          `[cloud] smoke sign-in took ${Date.now() - authStartedAt}ms`
        )
        if (isCloudCustomNodes) {
          await installCloudCustomNodeBootGuard(page)
          bootGuardInstalled = true
        }
      }

      if (isCustomNodes) await installCustomNodeBlankStartup(page)

      if (Object.keys(initialFeatureFlags).length > 0) {
        await comfyPage.featureFlags.seedFlags(initialFeatureFlags)
      }

      const setupStartedAt = Date.now()
      await comfyPage.setup()
      if (isCloudEnv)
        console.warn(`[cloud] app boot took ${Date.now() - setupStartedAt}ms`)

      if (isCloudCustomNodes) {
        assertCloudCustomNodeBootGuard(await readCloudCustomNodeBootGuard(page))
      }
      if (isCustomNodes) {
        await comfyExpect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(0)
      }

      if (isVueNodes) {
        await comfyPage.vueNodes.waitForNodes()
      }

      if (needsPerf) {
        await comfyPage.perf.init()
        perfStarted = true
      }

      await use(comfyPage)
    }
    try {
      await runWithCollectedCleanup(
        () => (cloudPageTrace ? cloudPageTrace.run(run) : run()),
        cleanups
      )
    } catch (error) {
      throw cloudPageTrace?.sanitize(error) ?? error
    }
  },
  comfyMouse: async ({ comfyPage }, use) => {
    const comfyMouse = new ComfyMouse(comfyPage)
    await use(comfyMouse)
  },
  comfyFiles: async ({ comfyPage }, use) => {
    const comfyFiles = new ComfyFiles(comfyPage)
    await use(comfyFiles)
    await comfyFiles.teardown()
  }
})

export { comfyExpect }
