# How-To: execution and services

This pack combines small backend nodes/routes with the published frontend API:

- **Mask Editor Image** uses the backend's ordinary upload image node and adds
  an Open Mask Editor action through the host command service. Load and run an
  image before opening the editor.
- **Text Output** queues itself from a context-menu action and consumes its
  correlated `onExecuted` text result in a dynamic badge.
- **Backend Ping** calls a pack-owned authenticated route, validates the JSON,
  updates a widget, and raises a host notification.
- **Backend Event** posts to a pack route and consumes the validated custom
  websocket event through `backend.on()`.
- **Settings and Storage** declares a preference and command, then saves and
  restores a named per-user greeting.

The Python is deliberately small. It exists only where the demonstrated
frontend behavior needs a real executable node, upload widget, route, or event.
