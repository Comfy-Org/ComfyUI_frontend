import type {
  FieldErrorCode,
  FieldSchema,
  FieldValue
} from '../src/config/workshop-playground'
import { urlUploadField } from '../src/config/workshop-playground'

interface InvalidInput {
  rule: string
  value: FieldValue
  error: FieldErrorCode
}

function textCases(
  field: Extract<FieldSchema, { kind: 'text' }>
): InvalidInput[] {
  return [
    { rule: 'text type', value: true, error: 'required' },
    ...(field.required
      ? [
          {
            rule: 'blank text',
            value: '   ',
            error: 'required'
          } satisfies InvalidInput
        ]
      : []),
    ...(field.minLength && field.minLength > 1
      ? [
          {
            rule: 'minimum length',
            value: 'x'.repeat(field.minLength - 1),
            error: 'rejected'
          } satisfies InvalidInput
        ]
      : []),
    ...(field.maxLength !== undefined
      ? [
          {
            rule: 'maximum length',
            value: 'x'.repeat(field.maxLength + 1),
            error: 'rejected'
          } satisfies InvalidInput
        ]
      : []),
    ...(field.valueType === 'json'
      ? [
          {
            rule: 'JSON syntax',
            value: '{',
            error: 'rejected'
          } satisfies InvalidInput
        ]
      : [])
  ]
}

function numberCases(
  field: Extract<FieldSchema, { kind: 'number' }>
): InvalidInput[] {
  return [
    { rule: 'number type', value: 'not a number', error: 'outOfRange' },
    { rule: 'finite number', value: Infinity, error: 'outOfRange' },
    ...(field.min !== undefined
      ? [
          {
            rule: 'minimum',
            value:
              field.min - Math.max(1, Math.abs(field.min) * Number.EPSILON),
            error: 'outOfRange'
          } satisfies InvalidInput
        ]
      : []),
    ...(field.max !== undefined
      ? [
          {
            rule: 'maximum',
            value:
              field.max + Math.max(1, Math.abs(field.max) * Number.EPSILON),
            error: 'outOfRange'
          } satisfies InvalidInput
        ]
      : [])
  ]
}

function fileCases(
  field: Extract<FieldSchema, { kind: 'file' }>
): InvalidInput[] {
  const file = {
    name: 'validation-input',
    size: 1,
    type: field.accept[0] ?? 'application/octet-stream'
  }
  const maximum = field.multiple ? field.maxItems : 1
  return [
    { rule: 'file type', value: false, error: 'badType' },
    {
      rule: 'file bytes',
      value: { ...file, size: field.maxBytes + 1 },
      error: 'tooLarge'
    },
    ...(field.required
      ? [
          {
            rule: 'empty file list',
            value: [],
            error: 'required'
          } satisfies InvalidInput
        ]
      : []),
    ...(field.accept.length
      ? [
          {
            rule: 'file MIME type',
            value: { ...file, type: 'application/x-invalid-validation-input' },
            error: 'badType'
          } satisfies InvalidInput
        ]
      : []),
    ...(maximum !== undefined
      ? [
          {
            rule: 'file count',
            value: Array.from({ length: maximum + 1 }, () => file),
            error: 'rejected'
          } satisfies InvalidInput
        ]
      : [])
  ]
}

function controlCases(field: FieldSchema): InvalidInput[] {
  switch (field.kind) {
    case 'text':
      return textCases(field)
    case 'number':
      return numberCases(field)
    case 'file':
      return fileCases(field)
    case 'select':
      return [
        {
          rule: 'allowed option',
          value: '__invalid_catalogue_option__',
          error: 'badOption'
        }
      ]
    case 'toggle':
      return [{ rule: 'boolean type', value: 'true', error: 'badType' }]
  }
}

export function invalidRouterModelInputs(schema: readonly FieldSchema[]) {
  return schema.flatMap((field) => {
    const upload = urlUploadField(field)
    const cases: InvalidInput[] = [
      ...(field.required
        ? [
            {
              rule: 'required',
              value: undefined,
              error: 'required'
            } satisfies InvalidInput
          ]
        : []),
      ...controlCases(field),
      ...(upload
        ? fileCases(upload).filter((testCase) => testCase.rule !== 'file type')
        : [])
    ]
    return cases.map((testCase) => ({ ...testCase, field: field.name }))
  })
}
