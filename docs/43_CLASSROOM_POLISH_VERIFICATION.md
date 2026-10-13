# Classroom polish verification — 13 October 2026

Production website: https://syncvas-pratzys-projects.vercel.app

Realtime relay: https://syncvas-relay.onrender.com

Repository: https://github.com/peterish8/SyncVas

## Delivered behavior

- Follow applies the latest teacher camera directly at the existing bounded rate. Manual student navigation exits follow immediately and stays local. Camera packets retain their latest value without causing a whole-board React render on every frame.
- Drawing updates preserve the relay's camera cache. Canvas change detection snapshots element revision metadata, including in-place Excalidraw mutations, rather than repeatedly serializing stroke points. Full scenes are serialized behind the publication throttle.
- Undrawn boards return a schema-valid empty scene, including camera-only cached rooms. This prevents late students from discarding the initial camera before the teacher draws anything.
- Teachers can prepare, save, reopen and select a private opening board before starting a classroom. Accepted AI drafts select their saved board; failed saves retain the draft for review. Preparation is disabled until teacher access is available.
- The landing and classroom use the existing lime, warm paper and serif visual language with quieter backgrounds. Native canvas themes preserve scene/camera state. Mobile navigation avoids cramped links and uses larger touch targets.
- The relay Docker image installs only its workspace dependencies. Production installs 34 packages; it does not install the website's dependency tree. Room state and advisory streams remain bounded, with one relay instance.

## Browser evidence

Tests used separate teacher and account-free student tabs in the Codex in-app browser, local teacher access, the existing development Convex database and the local relay. Test rooms were ended after verification. These checks do not establish production Google OAuth readiness.

| Journey | Observed result |
| --- | --- |
| Manual preparation | Created an ellipse privately, saved and selected the opening board, reopened it intact, then started a classroom on it. |
| Student join | Joined with the six-character code; the opening ellipse appeared in a read-only canvas. |
| Blank-board follow | Before any drawing or camera gesture, Return to Teacher became available and switched the student to Following at 100%. Both empty-room and camera-only responses are covered by Socket.IO regressions. |
| Follow and explore | Teacher zoom 110%; Return to Teacher matched 110%. Student zoom 120% exited follow; teacher stayed at 110% with the same board version. |
| Anonymous doubt | Student submitted a question, teacher received an anonymous doubt, answering cleared the open count. |
| End classroom | Teacher confirmation saved the final board and displayed Ended. |
| Continuous pen | A continuous stroke reached the student's read-only canvas at version 10 with its complete endpoint. |
| Mobile landing | Narrow viewport displayed brand, theme and join controls without wrapping navigation links or document horizontal overflow. |

The inaccessible old development project's relay-revocation environment cannot be changed with the current account. Immediate end-room disconnect was therefore verified against the hosted relay separately, rather than claimed from this local UI test.

## Hosted relay evidence

Using two isolated, short-lived signed test clients from the production website origin, the hosted relay accepted WebSocket admission, acknowledged teacher drawing, delivered the update to the student, preserved camera state for a subsequent current-board request, rejected student camera writes with FORBIDDEN and disconnected clients after a signed room revocation with ROOM_REVOKED. The isolated relay room was revoked and clients disconnected afterward. This exercises the real hosted Socket.IO service, but not production teacher OAuth or Convex-issued account tokens.

## Automated verification and delivery

`npm run verify` covers lint, strict TypeScript, application/permission tests, relay tests and a production website build. GitHub CI additionally builds the production relay Docker image and checks its health endpoint. The first integrated release passed both jobs: https://github.com/peterish8/SyncVas/actions/runs/38388796878

Production follows `main`: GitHub Actions verifies changes, Vercel builds the frontend and deploys matching production Convex functions, and Render waits for passing checks before deploying relevant relay changes. Preview builds do not deploy production Convex. See `42_HOSTING_SETUP.md` for configuration and operational limits.

## Explicit remaining verification

- **Google sign-in:** left for the user at their request. Production credentials and signing keys/JWKS are configured, and the public JWKS endpoint returns valid JSON. The Google client must allow `https://rightful-spider-652.convex.site/api/auth/callback/google`; an actual sign-in and authenticated production teacher/student journey remain unverified.
- **AI generation:** no board-authoring service URL/key is configured. Manual preparation works; automated AI acceptance/error tests use a fixture through the provider-neutral adapter. Real AI generation is not claimed.
- **Free hosting:** Render can sleep after inactivity and take roughly a minute to wake. This is a hosting limitation, not an FPS or latency benchmark. No paid service was selected.
- **Dependencies:** the update removed the critical audit finding without forced downgrades. Eighteen transitive audit advisories remain; the application is not claimed to be audit-clean.

No FPS, memory or end-to-end production latency improvement percentage is claimed. Resource reductions are supported by the workspace install and bounded update mechanisms above.
