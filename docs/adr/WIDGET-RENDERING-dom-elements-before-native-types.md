# ADR-WIDGET-RENDERING-dom-elements-before-native-types: DOM elements before native widget types

Date: 2026-11-16

## Status

Accepted

## Context

Extensions register DOM widgets with type names that also identify native Vue
widgets. Choosing the native renderer by type discards the extension's element
and its event handlers. Widget names and serialization settings do not identify
the intended renderer.

Core widgets also register DOM elements for the canvas renderer, but use native
Vue replacements in Nodes 2.0. Component-backed widgets share the DOM-widget
classification without providing an HTML element.

## Decision

Nodes 2.0 renders a DOM widget's HTML element before looking up its native type.
Registration can request `vueNodeRenderer: 'native'` when a native replacement
is intentional. If no native renderer exists, the DOM fallback remains available.
The default and `vueNodeRenderer: 'dom'` both prefer the element.

Core multiline, Markdown, and audio registrations opt into native rendering.
Component-backed widgets retain their existing routing. Renderer preference is
registration metadata, independent of widget visibility.

The properties panel keeps its existing renderer selection. Moving an
extension's element between panel and node would leave one host without its
widget.

## Alternatives

- Native-first routing requires each extension to avoid every core type name.
- DOM-widget classification alone also selects component-backed widgets that
  have no element for the DOM renderer to mount.
- Inferring intent from names, element tags, or serialization settings replaces
  an explicit choice with conventions that extensions do not share.

## Consequences

Extensions with colliding native type names can keep their existing DOM widget
registration. Authors who intentionally want a native replacement declare that
choice when registering the widget. This does not enable widgets that explicitly
hide themselves in Vue nodes.
