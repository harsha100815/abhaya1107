# WebSocket events

Connect to `/ws?token=<short-lived-access-token>`. The server validates the access token before registering a client. In production, use `wss://` behind TLS and a Redis pub/sub adapter for multiple API instances.

Server events are JSON:

```json
{
  "type": "safety.event",
  "payload": {
    "kind": "emergency.updated",
    "emergency": {}
  }
}
```

Event kinds:

- `emergency.updated`: status, delivery, resolution, cancellation, or acknowledgement changed.
- `location.updated`: a scoped emergency/journey latest location changed.
- `journey.updated`: journey state/progress changed.
- `journey.anomaly`: a configurable signal requires user confirmation; not an emergency classification.

The server scopes events to the owning user and admin role. Contact portal fan-out should be implemented as a separate explicitly authorized viewer session before exposing contact-specific streams.

Clients should reconnect with exponential backoff, show an offline indicator, and fall back to last-known state. Do not show “live” solely because a websocket object exists; use the latest timestamp and provider delivery state.
