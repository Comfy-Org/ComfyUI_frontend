# Billing Architecture Spec: Legacy → Workspace Transition

## Context

ComfyUI is transitioning from legacy user-scoped billing to workspace-level billing. During this transition period, both systems must coexist cleanly.

### Current State

**Two billing systems exist:**

1. **Legacy User-Scoped Billing (ComfyDashAPI)**
   - Uses `useSubscription` composable
   - Authenticates via Firebase auth token
   - Endpoints for balance, Stripe checkout URLs, subscription management
   - Tied to individual user identity

2. **New Workspace Billing (Cloudflare API)**
   - Uses `/billing/*` API endpoints
   - Workspace-scoped (billing tied to workspace, not user)
   - Supports team/collaborative billing model

### Transition Strategy

The "Personal Workspace" concept serves as a bridge:

- **Personal Workspace** = Legacy billing system dressed up to look like a workspace
- **Team/New Workspaces** = New workspace billing system

When a user switches workspaces, the entire billing context switches.

---

## Architecture Requirements

### Core Principles

1. **Single source of truth** for "which billing system is active"
2. **No UI leakage** — components should not need to know which system they're talking to
3. **Clean separation** — legacy and new billing code should not intermingle
4. **Pragmatic coexistence** — both systems can be loaded; only one is "active"

### Key Question

Should billing state live in:

- **Option A:** `teamWorkspaceStore` as centralized source of truth
- **Option B:** Bespoke checks scattered in components

**Recommendation: Option A** — Centralize in store with a clear abstraction layer.

---

## Proposed Architecture

### 1. Workspace Store as Billing Context Provider

```
teamWorkspaceStore
├── currentWorkspace
├── isPersonalWorkspace (computed) ← KEY DISCRIMINATOR
├── billingContext (computed)
│   ├── type: 'legacy' | 'workspace'
│   ├── api: ComfyDashAPI | WorkspaceBillingAPI
│   └── ... relevant billing state
```

The store determines billing context based on `currentWorkspace`. Components consume `billingContext` without knowing the underlying system.

### 2. Billing Abstraction Layer

Create a unified billing interface that both systems implement:

```typescript
interface BillingContext {
  // Common interface regardless of backend
  type: 'legacy' | 'workspace'

  // State
  subscription: SubscriptionInfo | null
  balance: number
  isLoading: boolean

  // Actions
  fetchSubscription(): Promise<void>
  getCheckoutUrl(plan: string): Promise<string>
  // ... other billing operations
}
```

### 3. Composable Structure

```
composables/
├── billing/
│   ├── useBillingContext.ts      ← Main entry point, reads from store
│   ├── useLegacyBilling.ts       ← Wraps useSubscription / ComfyDashAPI
│   └── useWorkspaceBilling.ts    ← Wraps /billing/* endpoints
```

**`useBillingContext`** is the ONLY composable components should import. It internally delegates to the appropriate system based on store state.

### 4. Component Guidelines

Components should:

```typescript
// ✅ DO: Use unified billing context
const { subscription, getCheckoutUrl } = useBillingContext()

// ❌ DON'T: Import system-specific composables
const { ... } = useSubscription()  // Legacy - don't use directly in components
```

### 5. Initialization Flow

```
App Mount
    │
    ▼
teamWorkspaceStore.initialize()
    │
    ├─► Determine current workspace
    │
    ├─► If Personal Workspace:
    │       └─► Initialize legacy billing (useSubscription)
    │
    └─► If Team Workspace:
            └─► Initialize workspace billing (/billing/*)
```

On workspace switch:

```
User switches workspace
    │
    ▼
teamWorkspaceStore.setCurrentWorkspace(workspace)
    │
    ├─► Update isPersonalWorkspace
    │
    ├─► Clear previous billing state
    │
    └─► Initialize appropriate billing system
```

---

## Implementation Checklist

### Phase 1: Abstraction Layer

- [ ] Define `BillingContext` interface
- [ ] Create `useBillingContext` composable
- [ ] Wrap `useSubscription` in `useLegacyBilling` (adapter pattern)
- [ ] Ensure `useWorkspaceBilling` conforms to interface

### Phase 2: Store Integration

- [ ] Add `isPersonalWorkspace` computed to `teamWorkspaceStore`
- [ ] Add `billingContextType` computed ('legacy' | 'workspace')
- [ ] Handle billing context switching on workspace change

### Phase 3: Component Migration

- [ ] Audit all components using `useSubscription` directly
- [ ] Replace with `useBillingContext`
- [ ] Remove any bespoke "which billing system" checks

### Phase 4: Cleanup

- [ ] Mark legacy composables as internal (not for direct component use)
- [ ] Add lint rule or code review guideline

---

## Edge Cases to Handle

1. **Workspace switch mid-checkout** — Cancel/invalidate any pending Stripe sessions
2. **Personal workspace with no legacy subscription** — Graceful empty state
3. **API errors** — Each system may have different error shapes; normalize in abstraction layer
4. **Loading states** — Unified loading state regardless of backend

---

## File References

Likely files to modify (verify paths in codebase):

- `stores/teamWorkspaceStore.ts`
- `composables/useSubscription.ts` (legacy)
- `composables/billing/` (new directory)
- Any component importing `useSubscription` directly

---

## Success Criteria

1. Components never directly reference legacy vs workspace billing
2. Switching workspaces cleanly switches billing context
3. No billing UI shows data from the "wrong" system
4. Architecture supports eventual removal of legacy system (just delete `useLegacyBilling` adapter)
