<!-- Auto complete with extra event "focused-option-changed" -->
<script>
import AutoComplete from 'primevue/autocomplete'

export default {
  name: 'AutoCompletePlus',
  extends: AutoComplete,
  props: {
    blurOnOptionSelect: {
      type: Boolean,
      default: false
    },
    keepOpenOnEmptyInput: {
      type: Boolean,
      default: false
    }
  },
  emits: ['focused-option-changed', 'clear', 'complete'],
  data() {
    return {
      // Flag to determine if IME is active
      isComposing: false
    }
  },
  mounted() {
    if (typeof AutoComplete.mounted === 'function') {
      AutoComplete.mounted.call(this)
    }

    // Retrieve the actual <input> element and attach IME events
    const inputEl = this.$el.querySelector('input')
    if (inputEl) {
      inputEl.addEventListener('compositionstart', () => {
        this.isComposing = true
      })
      inputEl.addEventListener('compositionend', () => {
        this.isComposing = false
      })
    }
    // Add a watcher on the focusedOptionIndex property
    this.$watch(
      () => this.focusedOptionIndex,
      (newVal) => {
        // Emit a custom event when focusedOptionIndex changes
        this.$emit('focused-option-changed', newVal)
      }
    )
  },
  methods: {
    onInput(event) {
      if (!this.typeahead) {
        return
      }

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }

      const query = event.target.value

      if (!this.multiple) {
        this.updateModel(event, query)
      }

      if (query.length === 0) {
        if (this.keepOpenOnEmptyInput) {
          this.searching = true
          this.$emit('clear')
          this.$emit('complete', { originalEvent: event, query: '' })
          if (!this.overlayVisible) {
            this.show()
          }
          return
        }

        this.hide()
        this.$emit('clear')
        return
      }

      if (query.length >= this.minLength) {
        this.focusedOptionIndex = -1
        this.searchTimeout = setTimeout(() => {
          this.search(event, query, 'input')
        }, this.delay)
      } else {
        this.hide()
      }
    },
    onOptionSelect(event, option, isHide = true) {
      if (!this.blurOnOptionSelect) {
        AutoComplete.methods.onOptionSelect.call(this, event, option, isHide)
        return
      }

      AutoComplete.methods.onOptionSelect.call(this, event, option, false)

      if (!this.multiple) {
        const label = this.getOptionLabel(option)
        const inputEl = this.$refs.focusInput?.$el
        if (inputEl) {
          inputEl.value = label != null ? String(label) : ''
        }
      }

      this.hide(false)

      const focusTarget = this.multiple
        ? this.$refs.focusInput
        : this.$refs.focusInput?.$el
      focusTarget?.blur?.()
    },
    // Override onKeyDown to block Enter when IME is active
    onKeyDown(event) {
      if (event.key === 'Enter' && this.isComposing) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      AutoComplete.methods.onKeyDown.call(this, event)
    }
  }
}
</script>
