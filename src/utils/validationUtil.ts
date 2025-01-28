export enum ValidationState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  VALID = 'VALID',
  INVALID = 'INVALID'
}

export const mergeValidationStates = (states: ValidationState[]) => {
  if (states.some((state) => state === ValidationState.INVALID)) {
    return ValidationState.INVALID
  }
  if (states.some((state) => state === ValidationState.LOADING)) {
    return ValidationState.LOADING
  }
  if (states.every((state) => state === ValidationState.VALID)) {
    return ValidationState.VALID
  }
  return ValidationState.IDLE
}
