# Code Review Summary — PR #12163

**feat(widgets): atomize RichComboWidget + TanStack Query foundation (master plan)**

## Statistics

- **Agents dispatched:** 22 standard completed + 3 adversarial (rate-limited)
- **Files changed:** 49 (+3225 / -951)
- **Critical findings:** 4
- **Major findings:** 12
- **Minor findings:** ~25
- **Nitpicks:** ~20

> **Note:** Adversarial reviewers (Skeptic, Architect, Minimalist) hit rate limits due to diff size (67K tokens). Standard agent coverage is comprehensive.

---

## Critical Issues (Must Fix)

### [C1] Test File Deleted - 753 Lines of Regression Coverage Lost
- **File:** `src/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.test.ts` (deleted)
- **Source:** C1 Regression Risk, A5 Architecture, A7 Test Quality, A11 API Contract
- **Issue:** The entire test file for `useRemoteWidget` was deleted. This covered cache management, exponential backoff, retry logic, refresh behavior, auth header injection, auto-refresh toggle, concurrent access, and error recovery. The refactored `useRemoteWidget` is still used in production but now has no direct tests.
- **Fix:** Migrate relevant tests to new test files covering the TanStack Query integration, or add tests for the refactored `useRemoteWidget` covering the same scenarios.

### [C2] XOR Validation Not Enforced at Runtime
- **File:** `src/schemas/nodeDefSchema.ts:127-136`
- **Source:** A5 Architecture, C1 Regression Risk
- **Issue:** `zComboInputOptionsValidated` enforces XOR between `remote` and `remote_combo`, but `zComboInputOptions` (without validation) is what's used in `ComboInputOptions` type and likely in runtime parsing. The validation schema appears test-only. Invalid combinations could slip through.
- **Fix:** Ensure `zComboInputOptionsValidated` is used in production parsing paths where node definitions are validated.

### [C3] Type Allows Empty ID After Mapping
- **File:** `src/base/remote/itemSchema.ts:54-61`
- **Source:** A17 Structural Discipline
- **Issue:** `mapToDropdownItem` allows `id: ''` (empty string) when `value_field` path doesn't resolve. Items pass type checks but are functionally invalid. `displayName` falls back to `id`, so empty `id` renders nothing.
- **Fix:** Either throw/warn when `value_field` doesn't resolve, or use a sentinel value explicitly handled in display logic.

---

## Major Issues (Should Fix)

### [M1] Breaking Change: cacheKey/getCacheEntry Removed from useRemoteWidget
- **File:** `src/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts:196`
- **Source:** C1 Regression Risk, A8 Ecosystem Compat, A11 API Contract
- **Issue:** Return object no longer exports `getCacheEntry` and `cacheKey`. Instead exports `getQueryKey`. Custom nodes relying on these will break.
- **Fix:** Document migration from `getCacheEntry`/`cacheKey` to `getQueryKey()` and TanStack Query APIs in release notes.

### [M2] Race Condition in Auto-Select Watch
- **File:** `src/renderer/extensions/vueNodes/widgets/composables/useRemoteCombo.ts:130-138`
- **Source:** A2 Bug Hunter
- **Issue:** The `watch` on `items` with `immediate: true` may trigger `applyAutoSelect` before `modelValue` is hydrated from serialized state. Could overwrite saved values.
- **Fix:** Add guard checking if component is fully mounted/hydrated before auto-selecting.

### [M3] RemoteComboContext Allows Impossible State Combinations
- **File:** `src/renderer/extensions/vueNodes/widgets/components/RemoteCombo/state.ts:6-18`
- **Source:** A17 Structural Discipline
- **Issue:** Interface allows `isLoading: true` AND `errorMessage: non-null` simultaneously, which is logically impossible.
- **Fix:** Use discriminated union for fetch state: `{ status: 'idle' | 'loading' | 'error' | 'success'; message?: string }`

### [M4] Missing AbortController Cleanup in useRemoteOptions
- **File:** `src/platform/remote/composables/useRemoteOptions.ts:92-110`
- **Source:** A2 Bug Hunter
- **Issue:** If component unmounts while auth headers are being fetched (async before axios call), abort may not be respected.
- **Fix:** Check `signal.aborted` after `await getAuthHeader()`.

### [M5] Missing Test Coverage for useRemoteCombo Composable
- **File:** `src/renderer/extensions/vueNodes/widgets/composables/useRemoteCombo.ts`
- **Source:** A7 Test Quality
- **Issue:** The new composable (163 lines) has no dedicated unit tests. Tests exist only via integration tests. Key behaviors untested: `applyAutoSelect`, `searchIndex` building, filtering, error handling.
- **Fix:** Add `useRemoteCombo.test.ts` covering composable contract directly.

### [M6] Changed Backoff Algorithm May Affect UX
- **File:** `src/base/remote/retry.ts:6-7`
- **Source:** C1 Regression Risk
- **Issue:** Backoff cap changed from 512ms to 16000ms. Old: `getBackoff(1) = 512ms`. New: `getBackoff(1) = 2000ms`, `getBackoff(4) = 16000ms`. Users may wait longer for retries.
- **Fix:** Verify timing change doesn't cause UX issues.

### [M7] Global QueryClient Singleton Pattern Concerns
- **File:** `src/platform/remote/queryClient.ts:5,15-19`
- **Source:** C1 Regression Risk, A5 Architecture, A2 Bug Hunter
- **Issue:** Module-level singleton can cause test pollution, issues if accessed before `createAppQueryClient`, and problems with multiple entry points.
- **Fix:** Consider using dependency injection or add guards ensuring `createAppQueryClient` is called first.

### [M8] useRemoteCombo Couples Data Fetching with UI Filtering
- **File:** `src/renderer/extensions/vueNodes/widgets/composables/useRemoteCombo.ts:45-163`
- **Source:** A5 Architecture
- **Issue:** Composable mixes remote data orchestration, local search/filter, auto-select, and state management - tight coupling.
- **Fix:** Extract `useSearchFilter` as separate composable.

### [M9] Missing Contract Enforcement for RemoteItemSchema
- **File:** `src/schemas/nodeDefSchema.ts:25-32`
- **Source:** A17 Structural Discipline
- **Issue:** Schema validates field presence but not that `value_field`/`label_field` are valid dot-paths. Runtime errors occur silently when paths don't match.
- **Fix:** Add runtime warning in `mapToDropdownItem` when path resolves to undefined.

### [M10] RemoteComboContext Has Multiple Responsibilities
- **File:** `src/renderer/extensions/vueNodes/widgets/components/RemoteCombo/state.ts:6-21`
- **Source:** A5 Architecture
- **Issue:** Interface bundles UI state, data state, async state, and behavior. Violates SRP.
- **Fix:** Consider splitting into separate contexts.

### [M11] Auth Scope Partitioning Without Tests
- **File:** `src/platform/remote/queryKeys.ts:10-11`
- **Source:** C1 Regression Risk
- **Issue:** Query keys partition by workspaceId/userId/apiKeyBucket. If these change mid-session, cached data may become stale without invalidation.
- **Fix:** Add tests for cache behavior across auth state transitions.

### [M12] useRemoteOptions Test Coverage is Shallow
- **File:** `src/platform/remote/composables/useRemoteOptions.test.ts`
- **Source:** A7 Test Quality
- **Issue:** Tests only verify query key structure. Missing: fetch execution, error handling, retry behavior, refetch/invalidate methods.
- **Fix:** Add tests mocking axios responses and verifying data flows.

---

## Minor Issues (Consider)

- **A1/A2:** Audio play Promise rejection unhandled in Item.vue:53
- **A3:** Unvalidated preview URL protocols (javascript: etc) in Item.vue
- **A12:** Missing aria-describedby for error states on ComboboxTrigger
- **A12:** Audio preview lacks aria-live feedback
- **A12:** Video preview missing keyboard controls
- **A14:** Non-reactive context access in Root.vue
- **A14:** Synchronous throw in inject pattern (multiple components)
- **A6:** Magic number `PAYLOAD_KEY_SAMPLE = 10` undocumented
- **A6:** Missing JSDoc on RemoteRequestDescriptor interface
- **B2:** URL path traversal risk in resolvePreviewUrl
- **B4:** Deep import chain in useRemoteCombo (4 directory levels)
- **C2:** `void props` pattern in LayoutSwitcher.vue

---

## What Went Well

1. **Clean layer separation**: `base/remote/` (pure utils), `platform/remote/` (TanStack integration), `renderer/` (UI components)
2. **Good ARIA implementation**: Error.vue, Loading.vue, Empty.vue all have proper roles and live regions
3. **Property-based testing**: `fast-check` tests in itemSchema.property.test.ts provide excellent coverage
4. **No circular dependencies**: Import graph analysis found 0 circular chains
5. **Security**: No hardcoded secrets, error summaries sanitize sensitive data, route validation prevents SSRF

---

## Tensions

### Test Strategy: Delete vs Migrate
- **C1/A7 argue:** 753 lines of tests deleted leaves useRemoteWidget untested
- **PR author argues:** Tests covered old cache implementation; new TanStack Query handles caching
- **Classification:** Resolvable
- **Resolution:** Add integration tests verifying behavior is preserved through new architecture

### Singleton vs Dependency Injection for QueryClient
- **A5/C1 argue:** Singleton pattern causes test pollution, unclear lifecycle
- **PR author argues:** Comment explains auth-state teardown evicts cache naturally
- **Classification:** Context-dependent
- **Resolution:** Document the lifecycle clearly; add resetAppQueryClient() for testing

---

## Blind Spots

Areas NO agent examined:

1. **SSR compatibility** - will getAppQueryClient() work in SSR contexts?
2. **Bundle size impact** - exact gzip increase from @tanstack/vue-query not measured
3. **Custom node migration path** - no guidance for affected external repos
4. **Storybook visual regression** - stories added but not tested against visual baseline

---

## Confidence Map

| Aspect | Confidence | Signal |
|--------|------------|--------|
| Breaking API changes | High | C1, A8, A11 unanimous |
| Test coverage regression | High | C1, A5, A7, A11 unanimous |
| XOR validation gap | Medium | A5, C1 flagged; may be intentional |
| Race condition risk | Medium | A2 flagged; needs verification |
| Security | High | A3, B2 found no critical issues |
| Performance | High | A4 found no O(n²) or major issues |
| Vue patterns | High | A14 found mostly good practices |
| Accessibility | High | A12 found good ARIA, minor gaps |

---

## Recommended Actions

1. **Before merge:** Add tests for refactored useRemoteWidget (C1)
2. **Before merge:** Fix empty-id mapping issue (C3)
3. **Before merge:** Guard auto-select race condition (M2)
4. **Document:** Migration path for cacheKey -> getQueryKey (M1)
5. **Consider:** Enforce XOR validation at runtime (C2)
6. **Consider:** Add aria-describedby for error states (A12)
