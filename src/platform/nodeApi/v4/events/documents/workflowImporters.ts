import { reportError } from '@comfyorg/telemetry/reportError'
import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  Unsubscribe,
  WorkflowData,
  WorkflowImportContext,
  WorkflowImportResult
} from '@/platform/nodeApi/v4/types'

interface Registration {
  readonly id: string
  readonly maxBytes: number
  readonly mimeTypes: ReadonlySet<string> | undefined
  readonly extensions: ReadonlySet<string> | undefined
  isEnabled(): unknown
  parse(bytes: Uint8Array, context: WorkflowImportContext): unknown
}

export interface WorkflowImporters {
  register(importer: unknown): Unsubscribe
  /** `found` if it holds a workflow; otherwise what the first willing importer reads from `file`. */
  importUnreadFile<TFound extends object | undefined>(
    file: File,
    found: TFound
  ): Promise<TFound | WorkflowImportResult>
}

const WORKFLOW_FIELDS = ['workflow', 'prompt', 'parameters', 'templates']

const REGISTER = 'workflow.registerImporter'

export function createWorkflowImporters(): WorkflowImporters {
  const registrations = new Set<Registration>()

  return {
    register(importer) {
      const registration = checkedRegistration(importer)
      if ([...registrations].some(({ id }) => id === registration.id)) {
        throw invalidArgument(
          REGISTER,
          'an id no other importer has',
          registration.id
        )
      }
      registrations.add(registration)
      return () => {
        registrations.delete(registration)
      }
    },

    async importUnreadFile(file, found) {
      if (holdsWorkflow(found)) return found
      return (await importFile(registrations, file)) ?? found
    }
  }
}

function holdsWorkflow(found: object | undefined): boolean {
  return (
    found !== undefined &&
    WORKFLOW_FIELDS.some((field) => Boolean(Reflect.get(found, field)))
  )
}

async function importFile(
  registrations: ReadonlySet<Registration>,
  file: File
): Promise<WorkflowImportResult | undefined> {
  let bytes: Promise<Uint8Array> | undefined
  const read = () =>
    (bytes ??= file.arrayBuffer().then((buffer) => new Uint8Array(buffer)))
  for (const registration of Array.from(registrations)) {
    const result = await offer(registration, file, read)
    if (result) return result
  }
  return undefined
}

async function offer(
  registration: Registration,
  file: File,
  read: () => Promise<Uint8Array>
): Promise<WorkflowImportResult | undefined> {
  try {
    if (!accepts(registration, file)) return undefined
    if (!(await registration.isEnabled())) return undefined
    const context = Object.freeze({ name: file.name, type: file.type })
    return importResult(
      await registration.parse((await read()).slice(), context)
    )
  } catch (error) {
    reportError(error, {
      errorType: 'node_api_workflow_importer_failure',
      surface: 'platform',
      tags: { importer: registration.id }
    })
    return undefined
  }
}

function accepts(
  { maxBytes, mimeTypes, extensions }: Registration,
  file: File
): boolean {
  if (file.size > maxBytes) return false
  if (!mimeTypes && !extensions) return true
  const dot = file.name.lastIndexOf('.')
  const extension = dot === -1 ? '' : file.name.slice(dot + 1).toLowerCase()
  return !!mimeTypes?.has(file.type) || !!extensions?.has(extension)
}

function importResult(parsed: unknown): WorkflowImportResult | undefined {
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const workflow = importedData(Reflect.get(parsed, 'workflow'))
  if (workflow !== undefined) return { workflow }
  const prompt = importedData(Reflect.get(parsed, 'prompt'))
  return prompt === undefined ? undefined : { prompt }
}

function importedData(value: unknown): WorkflowData | string | undefined {
  if (typeof value === 'string') return value
  if (!isPlainObject(value)) return undefined
  const copy: unknown = JSON.parse(JSON.stringify(value))
  return isPlainObject(copy) ? copy : undefined
}

function checkedRegistration(importer: unknown): Registration {
  if (!isPlainObject(importer)) {
    throw invalidArgument(REGISTER, 'an importer object', importer)
  }
  const { id, parse, enabled, maxBytes, mimeTypes, extensions } = importer
  if (typeof id !== 'string' || id === '') {
    throw invalidArgument(REGISTER, 'an id', id)
  }
  if (typeof parse !== 'function') {
    throw invalidArgument(REGISTER, 'a parse function', parse)
  }
  if (enabled !== undefined && typeof enabled !== 'function') {
    throw invalidArgument(REGISTER, 'enabled as a function', enabled)
  }
  if (!isPositiveNumber(maxBytes)) {
    throw invalidArgument(REGISTER, 'maxBytes as a positive number', maxBytes)
  }
  return {
    id,
    maxBytes,
    mimeTypes: checkedNames('mimeTypes', mimeTypes, (type) => type),
    extensions: checkedNames('extensions', extensions, (extension) =>
      extension.replace(/^\./, '').toLowerCase()
    ),
    isEnabled: () =>
      enabled === undefined || Reflect.apply(enabled, importer, []),
    parse: (bytes, context) => Reflect.apply(parse, importer, [bytes, context])
  }
}

function checkedNames(
  field: string,
  names: unknown,
  normalized: (name: string) => string
): ReadonlySet<string> | undefined {
  if (names === undefined) return undefined
  if (!Array.isArray(names) || !names.every(isName)) {
    throw invalidArgument(REGISTER, `${field} as a list of names`, names)
  }
  return new Set(names.map(normalized))
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
