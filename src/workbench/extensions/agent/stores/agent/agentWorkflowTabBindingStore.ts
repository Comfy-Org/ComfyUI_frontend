import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'Comfy.Agent.WorkflowTabBindings'

export const useAgentWorkflowTabBindingStore = defineStore(
  'agentWorkflowTabBinding',
  () => {
    const bindingsBySubject = useLocalStorage<
      Record<string, Record<string, string>>
    >(STORAGE_KEY, {}, { writeDefaults: false })
    const subject = ref<string | null>(null)

    function current(): Record<string, string> {
      return subject.value === null
        ? {}
        : (bindingsBySubject.value[subject.value] ?? {})
    }

    function replace(bindings: Record<string, string>): void {
      if (subject.value === null) return
      bindingsBySubject.value = {
        ...bindingsBySubject.value,
        [subject.value]: bindings
      }
    }

    function setSubject(next: string | null): void {
      if (
        next !== null &&
        Object.values(bindingsBySubject.value).every(
          (bindings) => typeof bindings === 'string'
        ) &&
        Object.keys(bindingsBySubject.value).length > 0
      ) {
        bindingsBySubject.value = {
          [next]: bindingsBySubject.value as unknown as Record<string, string>
        }
      }
      subject.value = next
    }

    function bind(workflowId: string, tabPath: string): void {
      const next = Object.fromEntries(
        Object.entries(current()).filter(
          ([, boundPath]) => boundPath !== tabPath
        )
      )
      next[workflowId] = tabPath
      replace(next)
    }

    function tabPathFor(workflowId: string): string | undefined {
      const bindings = current()
      return Object.hasOwn(bindings, workflowId)
        ? bindings[workflowId]
        : undefined
    }

    function workflowIdFor(tabPath: string): string | undefined {
      for (const [workflowId, boundPath] of Object.entries(current())) {
        if (boundPath === tabPath) return workflowId
      }
      return undefined
    }

    function unbindWorkflow(workflowId: string): void {
      replace(
        Object.fromEntries(
          Object.entries(current()).filter(([id]) => id !== workflowId)
        )
      )
    }

    function unbindTab(tabPath: string): void {
      replace(
        Object.fromEntries(
          Object.entries(current()).filter(([, path]) => path !== tabPath)
        )
      )
    }

    function pruneClosed(openTabPaths: readonly string[]): void {
      const open = new Set(openTabPaths)
      replace(
        Object.fromEntries(
          Object.entries(current()).filter(([, path]) => open.has(path))
        )
      )
    }

    function reset(): void {
      if (subject.value === null) return
      const remaining = { ...bindingsBySubject.value }
      delete remaining[subject.value]
      bindingsBySubject.value = remaining
    }

    return {
      bind,
      pruneClosed,
      reset,
      setSubject,
      tabPathFor,
      unbindTab,
      unbindWorkflow,
      workflowIdFor
    }
  }
)
