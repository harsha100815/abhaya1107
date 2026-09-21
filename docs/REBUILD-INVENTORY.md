# Fresh rebuild inventory

The rebuild began from the supplied specification before GitHub repository tools became available. The original `harsha100815/abhaya1107` main branch was subsequently inspected at `7ae4120a08edc0d2532d5949427826160c8f763e`.

The original README described a Vite web client, Expo mobile app, Express/WebSocket API, local JSON demo store, a PostgreSQL snapshot adapter, OTP flows, SOS, journeys, timers, trusted contacts, resources, evidence metadata, and admin demo operations. Inspection of `apps/api/src/db/store.ts` confirmed the PostgreSQL adapter stored a shared JSON snapshot in `abhaya_runtime_state` rather than using the relational domain tables. This makes concurrent updates and domain constraints hard to enforce.

The fresh branch replaces that architecture with real Prisma domain queries, transactions, row locks, ownership checks, a durable notification outbox, rotating refresh tokens, private encrypted image storage and a Next.js companion. SOS/journey/contact/report/privacy flows connect to the same API from both clients. Simulation is confined to test notifications; production refuses test mode.

No automatic migration from the old demo JSON store is included. Start with a new database. The existing main branch preserves the old demo implementation. Its admin demo console, simulated route-deviation controls, separately branded timer and unverified resource seeds are not represented as working production features in this rebuild. Journey check-in deadlines provide the timed escalation workflow. Public map resources remain empty until a verified dataset is integrated.

Phone verification is intentionally not claimed: phone numbers are validated for format, while email verification is implemented through one-time tokens and a configured provider. Add a reviewed phone verification provider before relying on phone ownership.
