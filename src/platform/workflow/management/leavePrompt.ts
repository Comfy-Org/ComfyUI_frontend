let skipNextPrompt = false

/** Lets the next unload skip the leave prompt; the result takes that back. */
export function skipLeavePromptOnce(): () => void {
  skipNextPrompt = true
  return () => {
    skipNextPrompt = false
  }
}

/** True once after `skipLeavePromptOnce`, for the unload it allowed. */
export function takeLeavePromptSkip(): boolean {
  const skip = skipNextPrompt
  skipNextPrompt = false
  return skip
}
