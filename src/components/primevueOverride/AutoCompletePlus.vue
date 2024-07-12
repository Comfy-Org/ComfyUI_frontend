<!-- Auto complete with extra event "focused-option-changed" -->
<script>
import AutoComplete from "primevue/autocomplete";

export default {
  name: "AutoCompletePlus",
  extends: AutoComplete,
  emits: ["focused-option-changed"],
  mounted() {
    if (typeof AutoComplete.mounted === "function") {
      AutoComplete.mounted.call(this);
    }

    // Add a watcher on the focusedOptionIndex property
    this.$watch(
      () => this.focusedOptionIndex,
      (newVal, oldVal) => {
        // Emit a custom event when focusedOptionIndex changes
        this.$emit("focused-option-changed", newVal);
      }
    );
  },
};
</script>
