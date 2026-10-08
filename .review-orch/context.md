XL diff: 3225 insertions, 49 files - Full 4 waves + adversarial

## PR Context
**Title:** feat(widgets): atomize RichComboWidget + TanStack Query foundation (master plan)
**Author:** christian-byrne (Glary-Bot Agent)
**Base:** origin/main
**Changes:** 49 files, +3225 / -951 lines

## Intent
Implement the full master plan from #11955:
- P1: Add @tanstack/vue-query, wire VueQueryPlugin
- P2: Pure helpers to base/remote/
- P3: useRemoteOptions composable with TanStack Query
- P4: Atomized RemoteCombo/ component family over reka-ui Combobox
- P5: useRemoteCombo + useRemoteWidget rewritten on getAppQueryClient()
- P6: zComboInputOptionsValidated XOR schema
- P7: Tests for all new code
- P8: A11y attributes
- P9: Storybook stories

## Key Signals
- Vue components (*.vue): A14, A12, A6
- Tests (*.test.*): A7, A18
- Composables: A5, A14
- package.json: B3, A8
- API/platform code: A3, A4, A10, A11
