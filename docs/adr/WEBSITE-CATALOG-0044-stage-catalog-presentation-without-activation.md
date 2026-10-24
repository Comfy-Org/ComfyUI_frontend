# ADR-WEBSITE-CATALOG-0044: Stage catalog presentation without activation

Date: 2026-10-13

## Status

Proposed

## Context

The Comfy Content Catalog is being checked in as independently reviewable
backend and frontend layers. Every layer must be deployable without changing
existing production content, Cloud endpoints, or website consumers. A working
local demo is not permission to activate production routes or its test identity.

## Decision

Land the admin shell and Preview presentation separately from session,
authoring, delivery, and website cutover adapters. These components receive
verified display data and emit user intent, with no credential handling or
network transport. They remain unmounted on all existing production pages.

Later adapters must be server-authorized and explicitly off by default.
Publication and public media visibility remain backend decisions. Clock and
locale controls only request a Preview change; the caller must commit it before
passing confirmed state back. Normal LIVE has no Preview warning banner.

Reject importing the entire demo branch: its local invitation bridge and
temporary publication controls are not production authorization. Reject using
client-only visibility or `noindex` as a staff access boundary.

## Consequences

The first layer can merge independently of backend activation. Existing routes,
data sources, credentials, and deployment configuration remain unchanged.
Reviewers can validate the UI behavior in isolated component tests while later
layers establish real session, exact media, and publication acceptance gates.
The first layer intentionally provides no usable production admin interface.

## References

- [CCC design](https://app.notion.com/p/3f06d73d365081cf9225d3c34f262b63)
- Mar's admin design: frontend PR20640, source76f448638719603ad6ecc032d8a46ee6ae601472.
