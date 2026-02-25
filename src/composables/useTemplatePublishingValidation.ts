/**
 * Validates template data at each step of the publishing wizard and
 * provides a completeness check before final submission.
 */
import type { MarketplaceTemplate } from '@/types/templateMarketplace'

/** Validation result for a single publishing step. */
export interface StepValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Maps each publishing step (1-indexed) to the set of template fields
 * that must be present and non-empty for the step to be valid.
 */
const STEP_REQUIRED_FIELDS: Record<
  number,
  Array<{ field: keyof MarketplaceTemplate; label: string }>
> = {
  2: [
    { field: 'title', label: 'Title' },
    { field: 'difficulty', label: 'Difficulty' },
    { field: 'license', label: 'License' }
  ],
  3: [{ field: 'description', label: 'Description' }],
  4: [
    { field: 'thumbnail', label: 'Thumbnail' },
    { field: 'workflowPreview', label: 'Workflow preview' }
  ],
  5: [{ field: 'categories', label: 'Categories' }]
}

/**
 * Checks whether a template field has a non-empty value.
 *
 * @param value - The field value to check.
 * @returns `true` if the value is present and non-empty.
 */
function isFieldPresent(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Validates template data for a specific publishing step.
 *
 * Steps without defined required fields (1, 6, 7, 8) are always valid.
 *
 * @param step - The 1-indexed step number to validate.
 * @param template - The current partial template data.
 * @returns A result indicating validity and any missing field errors.
 */
export function validateStep(
  step: number,
  template: Partial<MarketplaceTemplate>
): StepValidationResult {
  const requiredFields = STEP_REQUIRED_FIELDS[step]
  if (!requiredFields) return { valid: true, errors: [] }

  const errors: string[] = []
  for (const { field, label } of requiredFields) {
    if (!isFieldPresent(template[field])) {
      errors.push(`${label} is required`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Checks whether a template has all mandatory fields populated for
 * submission. This is a superset of per-step validation — the template
 * must pass validation for every step that has required fields.
 *
 * @param template - The template to check.
 * @returns `true` when all required fields across all steps are present.
 */
export function isTemplateComplete(
  template: Partial<MarketplaceTemplate>
): boolean {
  for (const step of Object.keys(STEP_REQUIRED_FIELDS)) {
    const { valid } = validateStep(Number(step), template)
    if (!valid) return false
  }
  return true
}
