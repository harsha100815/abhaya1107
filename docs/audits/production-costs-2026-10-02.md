# Abhaya production audit and ongoing costs

Date: 2 October 2026. Scope: up to 1,000 users, Android and iPhone.

**Production release is blocked pending live provider, physical-device, cloud and load validation.** The code passes local functional checks; that does not establish a working emergency service or capacity for 1,000 simultaneous users. The budget below excludes trial credits, promotional offers and expiring free hosting.

## Verified software and fixes

- Clean release baseline: `7270aed`, `rebuild/fresh-start`. Its [GitHub CI](https://github.com/harsha100815/abhaya1107/actions/runs/36961845948) passed clean dependency installation, migration, lint, all workspace type checks, tests, API/web builds, Android/iOS JavaScript exports and four browser flows.
- Added 15 provider-boundary tests, bringing unit tests to 36. These mock all network calls and do not send SMS, email or push.
- Contained corrupt encrypted notification payloads so one bad queue record cannot interrupt the worker's remaining deliveries.
- Explicit provider HTTP 4xx rejection (excluding ambiguous HTTP 408 timeout) is now FAILED; ambiguous network/5xx outcomes remain UNKNOWN and are never blindly resent. No automatic retry for failed/throttled notifications is promised.
- Authenticated API limits now apply per account, avoiding one shared 300-request bucket for all signed-in web users. Public, authentication and tracking IP limits remain intact. Rejected/missing session credentials also retain an IP limit; its exhaustion does not block signed-in accounts.
- Added concurrent SOS retry and shared-IP regression checks; 16 database integration tests pass.
- Maps support configured provider attribution and show tile-load failures while retaining coordinates.
- API/worker and optimized web builds, lint and workspace type checks passed after these changes. Four browser E2E flows also passed after the API/rate-limit/map changes (59 seconds).
- `render.production.yaml` and the existing TEST `render.yaml` both pass Render's current published JSON Schema. The production candidate has not been applied or authenticated with Render.

## Feature verification boundaries

| Feature                                        | Evidence now                                                             | Still required                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Registration/login/session recovery            | Automated local and CI checks                                            | Live HTTPS account flows and multi-tab refresh behavior                                                                        |
| SOS/contact ownership and duplicate protection | Integration tests and synthetic browser flows                            | Consenting recipients and actual carrier delivery receipts                                                                     |
| Journey check-ins/overdue escalation           | Database integration tests                                               | Healthy deployed worker and real overdue delivery timing                                                                       |
| Foreground GPS                                 | Native implementation and synthetic browser tests                        | Real Android/iPhone coordinates, permission denial, GPS off, stale timestamps                                                  |
| Background GPS                                 | Expo permission/background-task/foreground-service configuration present | Signed device builds, screen locked, background, battery saver, force-stop and reconnect checks                                |
| SMS                                            | Twilio request/receipt code and mocked boundary tests                    | Paid credentials, sender routing approval, actual Indian carrier tests and consent                                             |
| Email verification/reset                       | Resend request, idempotency and receipt code; mocked tests               | Paid provider, verified sending domain/DNS and delivered verification/reset links                                              |
| Push                                           | Expo registration and receipt code; mocked tests                         | EAS project ID, FCM/APNs credentials, signed builds and real devices. Receipt is provider handoff, not proof of device display |
| Maps                                           | Google Maps Android, Apple Maps iOS, configurable Leaflet web tiles      | Restricted Android key, configured web tile service, production attribution and device rendering                               |
| Evidence/private images                        | Bounded image validation, re-encoding and encryption in database         | Upload stress, storage growth and backup/restore validation                                                                    |
| Public safety map/police dispatch              | No verified public dataset or police integration exists                  | Separate integrations if desired; do not describe these as working features                                                    |

SMS, Resend, Expo access token, EAS project ID and Android maps key are absent/empty in the inspected local configuration. No secrets were printed. API production startup requires SMS/email; push must additionally be configured even though its token is not currently enforced by the API startup guard. Native production config rejects missing HTTPS API URL, EAS project ID and Android maps key.

## Capacity and operational blockers

1. **Public web login/tracking limits:** the web proxy still presents shared server IPs to the API's public endpoint limits. Authentication allows 50 requests per IP per 15 minutes and tracking 60 per minute. Fix this with a reviewed, trusted client-IP forwarding design or a same-origin routing architecture before a broad rollout; do not trust arbitrary client-supplied IP headers or simply remove abuse controls.
2. **Worker lag:** delivery/receipt calls are processed sequentially, with up to 12 seconds per provider request and up to 50 jobs per cycle. Provider slowness can delay later alerts and overdue-journey detection. Add measured bounded concurrency/worker separation, backlog-age monitoring and throughput validation before promising timely alerts at scale.
3. **No production load measurement:** 1,000 users is not 1,000 simultaneous users. At current intervals, 1,000 open dashboards can generate about 100 requests/second; 1,000 active single-subject trackers about 67 additional location requests/second, excluding contact viewers, media and logins. These are calculated demand rates, not a benchmark or a proven capacity limit.
4. **No operational recovery proof:** configure uptime and worker heartbeat/backlog alerts; exercise database restore, encryption-key recovery, deployment rollback and expired provider credentials. A database health response does not prove worker health or SMS delivery.
5. **No signed/native/live release evidence:** platform-store permission requirements and background behavior must be checked on real phones. OS force-stop, GPS denial, no signal and provider/carrier outages cannot be eliminated by buying hosting.
6. **Map service:** public OpenStreetMap tiles have no SLA and can block unsuitable/heavy usage. Use a paid tile provider for the budgeted web map. Do not buy unrelated routing/geocoding products; the current app does not call them.

## Paid baseline candidate

This is a starting configuration to benchmark for 1,000 registered/light-to-moderate active users. It is not a validated sizing guarantee and does not include high availability or automatic scaling.

| Service                      | Paid choice                                                                  | Monthly USD |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------: |
| Web companion                | Render 1 CPU / 2 GB (`1c-2g`)                                                |          25 |
| API                          | Render 1 CPU / 2 GB (`1c-2g`)                                                |          25 |
| Worker                       | Render 0.5 CPU / 512 MB (`0.5c-512mb`)                                       |           7 |
| PostgreSQL                   | Render 0.5 CPU / 1 GB (`0.5c-1g`)                                            |          19 |
| Database storage             | 20 GB at $0.30/GB                                                            |           6 |
| Transactional email          | Resend Pro, 50,000 emails/month                                              |          20 |
| Mobile cloud builds          | Expo EAS Starter; included paid-plan build credits, usage beyond quota extra |          19 |
| Web map tiles                | MapTiler Flex; usage beyond quota extra                                      |          30 |
| Uptime/on-call monitoring    | Better Stack, one responder, monthly billing; telemetry extras excluded      |          34 |
| **Fixed candidate subtotal** | **Before SMS, domain, app-store fees, taxes and usage overages**             |     **185** |

Render infrastructure alone is $82/month in the prepared candidate. Email, maps, builds and monitoring accounts still need configuration. No provider accounts or paid resources were created. Paid builds are included to avoid budgeting around free build quotas; local signed builds can remove EAS subscription cost if a maintained build environment is used instead.

GPS sensors and basic native maps need no separate per-position fee. Expo's push service has no per-notification charge; this is an ongoing service policy, not a temporary trial. Google lists the Maps SDK SKU as unlimited/no charge, but the Android key and billing setup are still required. Other Google Maps SKUs can be chargeable and are not used by this implementation.

Sources checked today: [Render pricing](https://render.com/pricing), [Render compute plans](https://render.com/docs/compute-plans), [Render backups](https://render.com/docs/postgresql-backups), [Resend](https://resend.com/pricing), [Expo EAS](https://expo.dev/pricing), [MapTiler](https://www.maptiler.com/cloud/pricing/), [Better Stack](https://betterstack.com/pricing), [Expo push costs/limits](https://docs.expo.dev/push-notifications/faq/), [Google Maps SKUs](https://developers.google.com/maps/billing-and-pricing/pricing), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## SMS cost with the currently implemented provider

Twilio lists India outbound SMS at **$0.0832 per segment**, plus sender/number and applicable carrier/processing charges. International number rental starts at $1.15/month but the actual approved sender route must be confirmed. No trial balance is deducted from these estimates.

Current ASCII alert examples with the full private tracking link are about 241 characters (SOS) and 266 (missed journey), typically two GSM-7 segments. Non-Latin names/text can require Unicode encoding and more segments. These examples use a representative hostname, not a deployed URL.

Formula: **alert events × contacts alerted × billable segments per SMS × $0.0832**.

| Monthly alert events, SOS + missed check-ins | Contacts each | Segments per contact assumed | Total segments | SMS USD | Fixed + SMS USD |
| -------------------------------------------: | ------------: | ---------------------------: | -------------: | ------: | --------------: |
|                                          100 |             3 |                            2 |            600 |   49.92 |          234.92 |
|                                          500 |             3 |                            2 |          3,000 |  249.60 |          434.60 |
|                                        1,000 |             3 |                            2 |          6,000 |  499.20 |          684.20 |

Location updates are not SMS; the code sends an alert when SOS/overdue events occur. Normal journey check-ins do not send recurring SMS. More contacts, repeat overdue deadlines, Unicode and longer URLs increase cost. Twilio account restrictions and destination permissions must be tested before launch.

Sources: [Twilio India pricing](https://www.twilio.com/en-us/sms/pricing/in), [segmentation](https://www.twilio.com/docs/glossary/what-sms-character-limit), [India routing guidelines](https://www.twilio.com/en-us/guidelines/in/sms).

## Cheaper domestic SMS alternative — not integrated yet

MSG91's published paid India-to-India pack is **5,000 SMS for ₹1,250 before 18% GST** (₹0.25 each); that pack costs ₹1,475 including the stated GST. Larger published packs offer lower rates. This is prepaid paid pricing, not a free-trial offer. Confirm segment/Unicode billing, credit validity and sender/template fees in the account quote.

Using this option requires a new provider adapter, receipt handling, approved DLT entity/sender/templates, provider-approved tracking URL variables and real carrier tests. The present code cannot use MSG91 credentials. Do not buy credits assuming it is already connected. DLT/registration charges and approval eligibility need an operator/provider quote; they are additional setup costs.

Sources: [MSG91 paid SMS packs](https://msg91.com/in/pricing/sms), [DLT requirements](https://msg91.com/help/dlt-registration-in-india/dlt-faqs).

## Rupee planning totals and app distribution

For transparent budgeting only, use **₹100 per US$1** as a conservative round conversion assumption. This is not a quoted live exchange rate. Actual card FX, taxes, regional invoices and overages determine the bill.

- Fixed candidate: **about ₹18,500/month**, before SMS and taxes.
- Domestic alternative with one 5,000-SMS pack: about **₹20,000/month**, with the SMS pack's stated GST included but foreign-service taxes excluded. A **₹25,000/month planning allowance** provides modest room for domain, taxes and small usage changes; it is not a price cap or a capacity guarantee.
- Existing Twilio path: about **₹23,500 / ₹43,500 / ₹68,500 per month**, before taxes/sender fees, for the three SMS scenarios above. Plan additional headroom.
- Apple Developer Program: **US$99/year** (about ₹9,900/year at the planning conversion), recurring.
- Google Play developer registration: **US$25 once** (about ₹2,500).
- Domain registration/renewal: reserve roughly **₹1,500–₹2,500/year**; this is a budgeting allowance pending the chosen name's registrar quote, not a sourced fixed fee.
- Domestic DLT/sender/template onboarding, security review, devices, support labour, high availability, additional replicas/autoscaling, bandwidth/storage/build/map/email overages are additional and not included.

[Apple membership](https://developer.apple.com/programs/enroll/) and [Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435). This budget buys infrastructure and services; it does not buy a guarantee against outages or bugs.

## Next release steps

1. Decide Twilio versus domestic SMS before buying messaging credits. The domestic option is the recommended cost direction for Indian users, subject to eligibility, integration and delivery testing.
2. Configure paid provider accounts, verified sending domain, map keys and native signing through secure account settings. Never paste secrets into chat or commit them.
3. Address public proxy limits and worker throughput, then benchmark a real staging deployment at defined concurrency and alert bursts with provider calls mocked for load tests.
4. Complete the real-device/provider matrix above, a restore drill and monitoring setup. Only then apply the reviewed production Blueprint and run a small monitored rollout.

No cloud deployment, live SMS/email/push delivery, physical-device GPS or 1,000-user load validation was completed by this audit. No trial credits or expiring hosting are used in the candidate estimate.
