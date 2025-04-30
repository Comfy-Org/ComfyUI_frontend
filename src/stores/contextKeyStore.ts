import { get, set, unset } from 'lodash'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { ContextValue, evaluateExpression } from '@/utils/expressionParserUtil'

export const useContextKeyStore = defineStore('contextKeys', () => {
  const contextKeys = reactive<Record<string, ContextValue>>({})

  /**
   * Get a stored context key by path
   * @param {string} path - The path to the context key (e.g., 'a.b.c').
   * @returns {boolean|undefined} The value of the context key, or undefined if not found.
   */
  function getContextKey(path: string): ContextValue | undefined {
    return get(contextKeys, path)
  }

  /**
   * Set or update a context key value at a given path
   * @param {string} path - The path to the context key (e.g., 'a.b.c').
   * @param {boolean} value - The value to set for the context key.
   */
  function setContextKey(path: string, value: ContextValue) {
    set(contextKeys, path, value)
  }

  /**
   * Remove a context key by path
   * @param {string} path - The path to the context key to remove (e.g., 'a.b.c').
   */
  function removeContextKey(path: string) {
    unset(contextKeys, path)
  }

  /**
   * Clear all context keys
   */
  function clearAllContextKeys() {
    for (const key in contextKeys) {
      delete contextKeys[key]
    }
  }

  /**
   * Evaluates a context key expression string using the current context keys.
   * Returns false if the expression is invalid or if any referenced key is undefined.
   * @param {string} expr - The expression string (e.g., "key1 && !key2 || (key3 && key4)").
   * @returns {boolean} The result of the expression evaluation.
   */
  function evaluateCondition(expr: string): boolean {
    return evaluateExpression(expr, getContextKey)
  }

  return {
    contextKeys,
    getContextKey,
    setContextKey,
    removeContextKey,
    clearAllContextKeys,
    evaluateCondition
  }
})
