/**
 * Utility functions for handling workbench events
 */

/**
 * Used by clipboard handlers to determine if copy/paste events should be
 * intercepted for graph operations vs. allowing default browser behavior
 * for text inputs and other UI elements.
 *
 * @param target - The event target to check
 * @returns true if copy paste events will be handled by target
 */
export function shouldIgnoreCopyPaste(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement &&
      ![
        'button',
        'checkbox',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'search',
        'submit'
      ].includes(target.type))
  )
}
