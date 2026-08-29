# ADR-0005: Direct Lamport counter semantics

Status: accepted for private alpha.

## Decision

The single op format retains `base_version` and `stamp`, but producers now mint
the numeric element as a durable, creator-owned Lamport counter. The total
winner key remains `[counter, actor, op_id]`; the tuple-generic comparator and
DQ-11 incarnation-qualified target keys are unchanged.

```text
observed counters -> durable producer tick -> op.base_version / op.stamp
                                              |
                                              +-> applyOps -> __stamps
```

There is no schema-v3 document, v2→v3 migration, alternate reader, compatibility
shim, or parallel apply/project API. The previously shipped DQ-11 legacy
incarnation token `"0"` remains part of the one current format.

Lamport is the smallest creator-owned logical clock that preserves offline
evaluation and deterministic total order. It does not detect concurrency; a
future need for that property would be a new direct format decision.

## Glossary

- **DQ-10**: the decision to use Lamport logical counters for ordering.
- **DQ-11**: incarnation-qualified target keys, recorded as schema Amendment A16.
- **Lamport counter**: a durable counter advanced above every locally observed event.
- **LWW**: last-writer-wins register using the total tuple key.
