# 16 — PDF Export and Class Archive

## End-class artifact hierarchy

1. Canonical saved board scene JSON
2. Board preview image
3. Board PDF/image export
4. Optional AI notes PDF

Never make AI-generated notes the only preserved artifact.

## Finalization

`End Class` mutation:
- changes session to `ending`
- prevents new student joins
- schedules internal finalization

Finalization:
- receives/confirms latest teacher board version
- persists final scene to file storage
- creates `final` snapshot record
- queues export job
- marks session `ended` once minimum durable state exists

AI note generation can continue after session is `ended`.

## File access

Convex storage IDs are not public URLs. Before handing a URL to a client, check authorization. Generated storage URLs behave like bearer URLs; if strict revocation/expiry is required later, introduce a guarded delivery layer or storage with expiring URLs.

## Student archive

MVP options:
- direct post-class session page accessible from same anonymous session token
- optional teacher-configurable public class artifact link later

Do not expose all past sessions just because someone knows one old join code.
