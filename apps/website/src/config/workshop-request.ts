import type {
  WorkshopContract,
  WorkshopMediaBinding
} from './workshop-contract'
import { formForContract } from './workshop-contract'
import {
  fieldsForDefinition,
  usesRequestBodyEditor
} from './workshop-form-definition'
import { validateWorkshopInput, validatorFor } from './workshop-json-schema'
import { pointerKeys, setAtPointer } from './workshop-json-pointer'
import type { FieldErrors, FormValues } from './workshop-playground'
import {
  MAX_UPLOAD_BYTES,
  schemaForModel,
  validateForm
} from './workshop-playground'
import { WorkshopRouterError } from './workshop-router-errors'
import { workshopFileBase64 } from './workshop-file-encoding'
import { prepareWorkshopCreatorRequest } from './workshop-creator-request'
import type { WorkshopUrlEncoder } from './workshop-url-input'
import { resolveWorkshopUrlInputs } from './workshop-url-input'
import { loadWorkshopExampleFile } from './workshop-example-file'
import { MAX_REQUEST_BYTES } from './workshop-limits'

const ACCEPT: Record<WorkshopMediaBinding['accept'], readonly string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'],
  file: []
}

export function serializeRouterInput(
  body: Readonly<Record<string, unknown>>
): string {
  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).byteLength > MAX_REQUEST_BYTES)
    throw new WorkshopRouterError('validation', null, {
      request_body: 'requestTooLarge'
    })
  return serialized
}

function validationErrors(
  contract: WorkshopContract,
  body: Record<string, unknown>
): FieldErrors {
  const validator = validatorFor(contract.inputSchema)
  if (validator(body)) return {}
  const mediaRoots = new Map(
    contract.media.flatMap((field) =>
      field.targets.map((path) => [pointerKeys(path)[0], field.name])
    )
  )
  return Object.fromEntries(
    (validator.errors ?? []).map((error) => {
      const parameter: unknown = error.params.missingProperty
      const root =
        pointerKeys(error.instancePath)[0] ??
        (typeof parameter === 'string' ? parameter : 'request_body')
      return [mediaRoots.get(root) ?? root, 'rejected']
    })
  )
}

export async function prepareWorkshopRouterInput(
  contract: WorkshopContract | undefined,
  values: FormValues,
  signal: AbortSignal,
  encodeFile = workshopFileBase64,
  uploadFile?: WorkshopUrlEncoder
): Promise<Record<string, unknown>> {
  if (!contract) throw new WorkshopRouterError('unavailable')
  signal.throwIfAborted()
  if (
    typeof values.request_body === 'string' &&
    !(contract.media.length && usesRequestBodyEditor(formForContract(contract)))
  ) {
    if (
      Object.entries(values).some(
        ([name, value]) =>
          name !== 'request_body' && value !== undefined && value !== ''
      )
    )
      throw new WorkshopRouterError('validation', null, {
        request_body: 'rejected'
      })
    let body: unknown
    try {
      body = JSON.parse(values.request_body)
    } catch {
      throw new WorkshopRouterError('validation', null, {
        request_body: 'rejected'
      })
    }
    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !validateWorkshopInput(
        { ...contract.defaultInput, ...body },
        contract.inputSchema
      )
    )
      throw new WorkshopRouterError('validation', null, {
        request_body: 'rejected'
      })
    const nativeBody = { ...contract.defaultInput, ...body }
    serializeRouterInput(nativeBody)
    return nativeBody
  }
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  values = await resolveWorkshopUrlInputs(schema, values, signal, uploadFile)
  if (contract.creator) {
    const errors = validateForm(schema, values)
    if (Object.keys(errors).length)
      throw new WorkshopRouterError('validation', null, errors)
    const body = {
      ...contract.defaultInput,
      ...(await prepareWorkshopCreatorRequest(
        contract.creator,
        values,
        signal,
        encodeFile
      ))
    }
    const nativeErrors = validationErrors(contract, body)
    if (Object.keys(nativeErrors).length)
      throw new WorkshopRouterError('validation', null, nativeErrors)
    serializeRouterInput(body)
    return body
  }
  const definition = formForContract(contract)
  const fields = fieldsForDefinition(definition)
  const fieldByName = new Map(fields.map((field) => [field.name, field]))
  const mediaNames = new Set(contract.media.map((field) => field.name))
  let body: Record<string, unknown> = { ...contract.defaultInput }
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === '' || mediaNames.has(name)) continue
    const field = fieldByName.get(name)
    if (!field)
      throw new WorkshopRouterError('validation', null, { [name]: 'rejected' })
    let parsed: unknown = value
    if (field.kind === 'text' && field.valueType === 'json') {
      try {
        if (typeof value !== 'string') throw new Error('Invalid JSON field')
        parsed = JSON.parse(value)
      } catch {
        throw new WorkshopRouterError('validation', null, {
          [name]: 'rejected'
        })
      }
    }
    if (usesRequestBodyEditor(definition) && name === 'request_body') {
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      )
        throw new WorkshopRouterError('validation', null, {
          [name]: 'rejected'
        })
      body = { ...contract.defaultInput, ...parsed }
    } else {
      if (
        field.kind === 'text' &&
        field.required &&
        typeof value === 'string' &&
        !value.trim()
      )
        throw new WorkshopRouterError('validation', null, {
          [name]: 'required'
        })
      if (
        field.inputSchema &&
        !validateWorkshopInput(parsed, field.inputSchema)
      )
        throw new WorkshopRouterError('validation', null, {
          [name]: 'rejected'
        })
      Object.defineProperty(body, name, {
        value: parsed,
        enumerable: true,
        configurable: true,
        writable: true
      })
    }
  }
  let estimatedBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength
  function reserve(
    file: { size: number; type: string },
    name: string,
    target: string
  ) {
    estimatedBytes +=
      4 * Math.ceil(file.size / 3) + file.type.length + target.length + 128
    if (estimatedBytes > MAX_REQUEST_BYTES)
      throw new WorkshopRouterError('validation', null, {
        [name]: 'requestTooLarge'
      })
  }
  const uploads = contract.media.flatMap((media) => {
    const value = values[media.name]
    const files =
      value === undefined ? [] : Array.isArray(value) ? value : [value]
    if (
      (media.required && files.length === 0) ||
      files.length > media.targets.length
    )
      throw new WorkshopRouterError('validation', null, {
        [media.name]: files.length ? 'rejected' : 'required'
      })
    return files.map((upload, index) => {
      signal.throwIfAborted()
      if (
        typeof upload !== 'object' ||
        (!(upload.file instanceof File) && !upload.sourceUrl)
      )
        throw new WorkshopRouterError('validation', null, {
          [media.name]: 'required'
        })
      const file = upload.file ?? upload
      if (
        ACCEPT[media.accept].length &&
        !ACCEPT[media.accept].includes(file.type)
      )
        throw new WorkshopRouterError('validation', null, {
          [media.name]: 'badType'
        })
      if (file.size > MAX_UPLOAD_BYTES)
        throw new WorkshopRouterError('validation', null, {
          [media.name]: 'tooLarge'
        })
      if (upload.file instanceof File)
        reserve(upload.file, media.name, media.targets[index])
      return { media, index, upload }
    })
  })
  for (const { media, index, upload } of uploads) {
    let file: File
    try {
      file =
        upload.file instanceof File
          ? upload.file
          : await loadWorkshopExampleFile(upload, signal)
    } catch {
      signal.throwIfAborted()
      throw new WorkshopRouterError('validation', null, {
        [media.name]: 'uploadFailed'
      })
    }
    if (
      ACCEPT[media.accept].length &&
      !ACCEPT[media.accept].includes(file.type)
    )
      throw new WorkshopRouterError('validation', null, {
        [media.name]: 'badType'
      })
    if (!(upload.file instanceof File))
      reserve(file, media.name, media.targets[index])
    const encoded = await encodeFile(file, signal)
    try {
      setAtPointer(
        body,
        media.targets[index],
        media.encoding === 'data-url'
          ? `data:${file.type};base64,${encoded}`
          : encoded
      )
    } catch {
      throw new WorkshopRouterError('validation', null, {
        [media.name]: 'rejected'
      })
    }
  }
  const errors = validationErrors(contract, body)
  if (Object.keys(errors).length)
    throw new WorkshopRouterError('validation', null, errors)
  serializeRouterInput(body)
  return body
}
