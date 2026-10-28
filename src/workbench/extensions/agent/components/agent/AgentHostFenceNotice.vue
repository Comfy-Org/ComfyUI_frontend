<script setup lang="ts">
/**
 * Why the local agent will not answer this page: ComfyUI was opened by an
 * address that is not on the machine the agent runs on, so its loopback fence
 * refuses every request (Comfy-Org/cloud#14874).
 *
 * Rendered on panel open rather than on send. The fence refuses the panel's
 * first reads - threads, identity, run mode - so a message shown only at send
 * time is never reached: the panel was measured sitting in its ordinary empty
 * state while all three came back 403.
 *
 * `message` is the host's own complete sentence, which names the local URL to
 * open and is the only text here: the port and scheme are the host's to report,
 * and restating them in the frontend would be a second, drifting copy.
 */
const { message } = defineProps<{ message: string }>()
</script>

<template>
  <div
    role="alert"
    data-testid="agent-host-fence-notice"
    class="flex items-start gap-3 rounded-lg border border-destructive/40 bg-background p-3 text-sm"
  >
    <i
      aria-hidden="true"
      class="icon-[lucide--circle-alert] size-5 text-destructive"
    />
    <p class="m-0 min-w-0 flex-1">{{ message }}</p>
  </div>
</template>
