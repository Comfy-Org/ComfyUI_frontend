import { useFieldError } from 'vee-validate'
import { computed, inject } from 'vue'

import {
  FORM_FIELD_NAME_INJECTION_KEY,
  FORM_ITEM_ID_INJECTION_KEY
} from './injectionKeys'

export const useFormField = () => {
  const fieldName = inject(FORM_FIELD_NAME_INJECTION_KEY)
  const itemId = inject(FORM_ITEM_ID_INJECTION_KEY)

  if (!fieldName || !itemId) {
    throw new Error('useFormField must be used within FormField and FormItem')
  }

  const errorMessage = useFieldError(fieldName)
  const formItemId = `${itemId}-form-item`
  const formDescriptionId = `${itemId}-form-item-description`
  const formMessageId = `${itemId}-form-item-message`
  const describedBy = computed(() =>
    errorMessage.value
      ? `${formDescriptionId} ${formMessageId}`
      : formDescriptionId
  )

  return {
    errorMessage,
    formDescriptionId,
    formItemId,
    formMessageId,
    describedBy,
    name: fieldName
  }
}
