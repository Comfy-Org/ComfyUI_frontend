<template>
  <div v-show="false" class="comfy-user-selection">
    <main class="comfy-user-selection-inner">
      <h1>ComfyUI</h1>
      <form>
        <section>
          <label
            >New user:
            <input placeholder="Enter a username" />
          </label>
        </section>
        <div class="comfy-user-existing">
          <span class="or-separator">OR</span>
          <section>
            <label>
              Existing user:
              <select>
                <option hidden disabled selected value>Select a user</option>
              </select>
            </label>
          </section>
        </div>
        <footer>
          <span class="comfy-user-error">&nbsp;</span>
          <button class="comfy-btn comfy-user-button-next">Next</button>
        </footer>
      </form>
    </main>
  </div>
</template>
