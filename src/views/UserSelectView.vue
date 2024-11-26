<template>
  <div
    id="comfy-user-selection"
    class="font-sans flex flex-col items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <main
      class="mt-[5vh] 2xl:mt-[20vh] min-w-[365px] relative rounded-lg bg-[var(--comfy-menu-bg)] p-5 px-10 shadow-lg"
    >
      <h1 class="my-2.5 mb-7 font-normal">ComfyUI</h1>
      <form class="flex w-full flex-col items-center">
        <section class="w-full p-2.5 -m-2.5 transition-colors duration-200">
          <label class="flex w-full flex-col">
            New user:
            <input
              placeholder="Enter a username"
              class="mt-2.5 rounded bg-[var(--comfy-input-bg)] p-1.5 text-[var(--input-text)] placeholder-[var(--descrip-text)] border-0"
            />
          </label>
        </section>
        <div class="w-full">
          <span
            class="relative block w-full py-2.5 text-center text-[var(--descrip-text)] before:absolute before:left-0 before:top-1/2 before:w-[calc(50%-20px)] before:h-px before:bg-[var(--border-color)] after:absolute after:right-0 after:top-1/2 after:w-[calc(50%-20px)] after:h-px after:bg-[var(--border-color)]"
            >OR</span
          >
          <section class="w-full p-2.5 -m-2.5 transition-colors duration-200">
            <label class="flex w-full flex-col">
              Existing user:
              <select
                class="mt-2.5 rounded bg-[var(--comfy-input-bg)] p-1.5 text-[var(--input-text)] border-0"
              >
                <option hidden disabled selected value>Select a user</option>
              </select>
            </label>
          </section>
        </div>
        <footer class="mt-5 flex flex-col items-center">
          <span class="mb-2.5 text-[var(--error-text)]">&nbsp;</span>
          <button
            class="comfy-btn flex w-[100px] items-center justify-center gap-1.5 p-1.5 px-2.5 text-base"
          >
            Next
          </button>
        </footer>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts"></script>
