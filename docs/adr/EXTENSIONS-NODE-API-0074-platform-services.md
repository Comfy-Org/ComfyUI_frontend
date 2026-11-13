# ADR-EXTENSIONS-NODE-API-0074: Platform services of the V4 node API

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
set out the V4 node API: one versioned object, `comfy`, and handles that
belong to a document. Packs also use services around the graph: their
settings, text they keep for the user, commands and keys, calls to the
backend, model lists, and contributions to the app's chrome. Today they reach
each through `app`, `api` or a store, so a pack breaks when one of those
changes.

Each service here is a thin wrapper over a host owner that already exists: a
store, the backend client, or a service. It adds no capability a pack does not
have today. A pack gets values and its own registrations back, never a store
or a host object. No member takes or returns a node handle.

The members are those of the earlier contract that at least one stored pack
calls, counted by the census of 128 stored packs (`census/CENSUS.md`,
2026-11-11). Counts below are "packs / call sites".

## Decision

### Common rules

1. Every member validates what a pack passes before it reads or changes
   anything, and refuses a value it cannot use with the `TypeError` of
   decision 13 of ADR-EXTENSIONS-NODE-API-0070, naming the member the pack
   called, the field and the value
   (`settings.declare needs attrs.min as a finite number, not -Infinity.`).
   An object a pack passes is read field by field, once each, through
   `packArguments.ts`; an extra field is ignored. A number must be finite.

2. A failure the pack cannot prevent, such as a server that refuses a request
   or cannot be reached, is a value and not a throw, as
   `docs/guidance/error-handling.md` asks: `false`, `undefined`, or
   `{ ok: false }` where `undefined` already means something.

3. Every callback a pack supplies runs through `shared/listeners.ts`: a
   listener set from `createListeners`, or `callListener` for one callback.
   One that throws is reported through `reportError`
   (`node_api_listener_failure`, tagged with the member) and stops neither
   the host nor another pack. An event a pack subscribes to follows its host
   source through `createHostEvent` only while a listener is registered.

4. A value handed to a pack is a string, a frozen copy the API made for that
   delivery. `jsonValues.ts` checks that a value
   holds only what JSON can (finite numbers, strings, booleans, `null`, lists
   and plain objects, refusing a cycle); a setting value that passes is copied
   with `savedCopy`, the shared copy handles use.

### Settings (`comfy.settings`, 22 / 177)

5. `declare(setting)` (18 / 66) turns a pack's definition into the settings
   store's `SettingParams` and adds it with `addSetting`, the call
   `extension.settings` reaches. The value a user stored under the id is
   kept. The store skips a second registration of an id with a console
   warning; the API refuses it instead, so a pack learns its id is taken and
   cannot replace core's setting or another pack's. A declaration lasts for
   the page: the settings store has no removal, and `extension.settings` has
   none either.
6. The setting types are those packs declare: `boolean`, `number`, `slider`,
   `combo`, `text` and `color`. `knob`, `radio`, `password`, `image` and `url`
   have no use and are left out. The default must suit the type: a boolean, a
   finite number, a string or a number for a `combo`, a string. An option is a
   string or `{ value, label }`, mapped to the store's `{ value, text }`;
   `attrs` passes only the bounds given.
7. `get(id)` (22 / 104) reads the store's value or default, for any id, core's
   included. `set(id, value)` (7 / 11) takes a value JSON can hold, applies it
   at once through the store and returns the store's promise, which settles
   as the request to save it does.
8. `onChange(id, listener)` (6 / 7) hears the store's `onSettingChanged`, the
   event the host itself watches. All listeners share one subscription,
   started with the first and stopped when the last leaves (finding B-12);
   each disposer removes only its own listener. The store announces a declared
   setting when it is declared and after each change, so a listener hears
   both. A `declare` definition's `onChange` (12 / 23) is called the same way,
   through `callListener`.

### Per-user storage (`comfy.storage`, 17 / 43)

9. `get`, `set`, `remove` and `list` call the backend client's user-data
   methods, which packs called directly before: `getUserData`,
   `storeUserData` (as text, overwriting, without throwing), `deleteUserData`
   and `listUserDataFullInfo`. A name is a relative path in the user's data,
   refused if it is absolute or has an empty, `.` or `..` segment, a backslash
   or a NUL, before any request.
10. `get` (17 / 26) resolves `{ ok: true, text }`, with `text` `undefined` when
    nothing is stored, or `{ ok: false }` when the server refused or could not
    be reached. `set` (17 / 23) and `remove` (4 / 7) resolve `true` or
    `false`; removing a name that holds nothing succeeds. `list` (3 / 4)
    resolves the names under a folder as `get` takes them, or `undefined`. The
    earlier contract rejected on a failed request; a stored conversion that
    wrote `await comfy.storage.get(name)` reads `.text` and checks `.ok`.

### Left out

The sandbox the earlier contract served is out of scope, and nothing here
exists only for it. A pack is trusted code in the page. The guest SDK's
`comfy.files`, `comfy.clipboard`, `comfy.media`, `comfy.crypto` and
`comfy.element` are not built; a pack uses the browser's own APIs.

## Alternatives considered

- Reach settings through `app.extensionManager.setting`, the adapter legacy
  extensions use, which takes any id without a cast. Its store,
  `workspaceStore`, imports the dialog and account services, which start
  Firebase authentication; the API would have depended on them for a settings
  read. The settings store is used directly and the id and value are cast to
  its schema in one function each, as that adapter casts them.
- Reject the promise of a storage call whose request fails, as the earlier
  contract did. The frontend's error-handling guidance asks for failure as a
  value on an extension-facing API, and a rejection is the throw it rules out.
- Watch a setting with a Vue watcher on the store's getter. It fires for an
  undeclared id too, but it clones the value on every evaluation and runs a
  reactive effect per listener; the store's own event is cheaper and is what
  the host listens to.

## Consequences

- The settings store cannot remove a setting, so `declare` lasts for the
  page, as `extension.settings` does. A removal method in the store would let
  it return a disposer.
- A pack's setting and its stored text live under the ids and paths it
  chooses. Nothing stops a pack from writing core's settings or another
  pack's files, as nothing stops it today through `api`.

## What this feature replaces or duplicates, and why

- **Copying a value.** A setting value is copied with `savedCopy` from
  `shared/savedCopy.ts`, after `isJsonValue` has checked it, so the JSON
  round trip drops nothing.
- **Checking a JSON value.** `isJsonValue` walks the value once. A JSON round
  trip would drop `undefined` and functions and turn `NaN` into `null`
  without saying so, which is the silent change the check exists to refuse.
- **Reading a server's list.** `textFieldOfEach` reads one string field of
  each entry of a reply, for the storage list, which the
  client returns unchecked.
- **Reading a pack's object.** `packArguments.ts` reads each field once with
  `Reflect.get` and checks it. `isPlainObject` from `es-toolkit` is used for
  setting values, but a definition may be any object a pack built, an
  instance of its own class included.
