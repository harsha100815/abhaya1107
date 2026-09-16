# Demo mode runbook

Demo mode is enabled by default in development and does not use paid external services.

## Demo credentials

- User: `demo@abhaya.app` / `Password123!`
- Admin: `admin@abhaya.app` / `Admin123!`

## Walkthrough

1. Sign in as the demo user.
2. Open Trusted circle and send a test notification.
3. Plan a safe journey, optionally choose Maya, then start it.
4. Set a 5-minute safety timer and confirm it.
5. Tap SOS, wait for or skip the cancellation countdown, and inspect delivery status.
6. Copy the expiring share URL. Open it in a private window to see the minimal public viewer.
7. Mark safe; the event resolves and location sharing ends.
8. Sign in as admin in a separate window and inspect the Operations view.

The API seeds realistic fake Hyderabad data on first boot. Use `POST /api/v1/demo/reset` with an admin bearer token to reset the JSON demo store.

## Explicit simulation endpoints

```bash
curl -X POST -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  http://localhost:4000/api/v1/journeys/journey-001/simulate-deviation

curl -X POST -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  http://localhost:4000/api/v1/timers/timer-001/simulate-expiry
```

Simulation is guarded by `DEMO_MODE=true` and `NODE_ENV!=production` and never sends a real emergency-service request.
