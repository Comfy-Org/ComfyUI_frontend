# PR Title
[fix] use getter functions for sidebar tab command labels to resolve i18n collection issues

# PR Description
Fixes i18n collection script issues caused by PR #4213's change to use raw i18n keys in sidebar tab command labels. The collection script was generating incorrect entries in commands.json with i18n keys as values instead of translated text, causing the UI to display raw keys like "sideToolbar.queue" instead of "Queue".

**Solution:** Use getter functions `() => t(key)` for command labels/tooltips instead of raw i18n keys. This maintains the reactive functionality from #4213 while providing translated strings to the collection script, preventing incorrect locale file generation.