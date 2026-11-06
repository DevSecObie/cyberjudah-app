# Native resource integration candidate — 5 November 2026

This branch retains the existing Bible Strong application and resource clients. Its contract reference is upstream `61cf39c8c4a65220212dbac9536794e43ae8207e`; CyberJudah adaptations keep the existing rendering, navigation, offline lifecycle and text/token pairing rules.

- Interlinear HTTP access accepts the distinct `CYBERJUDAH` dataset for this profile and rejects mismatched dataset/language/text identity. The server projects the existing WLC/Open Scriptures and Scrivener/Robinson-based BHG archives without fabricating alignment. No STEP dataset is restored.
- The existing PR79 Nave implementation is integrated: original English/French archives, catalog entries, optional separate HTTP base, and Resource service entrypoint/manifests. Production candidate settings select `https://cyberjudah.io/bs/reference`; preview selects the existing staging `/bs`. Existing CyberJudah teaching links retain `/bs` and their own publication. No active release branch, deployed environment or workflow is changed.
- The timeline archive, catalog and publication metadata agree with the server publication at revision `cj-timeline-c0fa41b927b1fe8acf6ff4174f61efcf52cece3da9cd0bed1edb286b69622722`. On 6 November, Abraham's birth moved from 1950 BC to 1946 BC, restoring the stated 175-year lifespan and agreeing with the existing Ishmael, Sarah and Haran-departure anchors. The other event geometry/identities are unchanged. Isaac's birth and the circumcision dates remain unresolved release blockers; see the server's `docs/TIMELINE-CHRONOLOGY.md`. These inherited BC positions are not absolute dates established by the KJV.
- 28 custom screens/components now use the shared surface radius scale and readable `text-link` accents. Static card shadows were removed, the floating player uses `floatingShadow`, and the notes sheet uses the correct canvas ground. The splash logo's drawn light effects have a documented illustration exception. No baseline was raised.

Validation: 12 interlinear tests, 52 Nave/search/availability/timeline tests, 50 Resource service Nave/Worker tests, full offline archive/SQLite verification, native/resource-domain/Resource Worker typechecks, changed-file lint/format and surface/resource architecture checks. The server candidate has 106 API tests plus local staging and mock indexing tests. Public production Nave GET smoke passed English/French edition pins, topic/verse lookup, search, cursor continuity, random selection and missing-topic behavior. Staging passed the same public smoke on retry; the earlier timeout is superseded. Browser verification opened guest Genesis, home, Nave search and the Faith topic. It exposed French scripture labels in English Nave on the direct web HTTP path; the existing localization helper now applies there, with 18 focused tests passing.

The local dependency overlay resolves workspace packages to this candidate, but reuses installed Firebase 26.4.0/Nitro 0.37.1 while the candidate lockfile requests 26.4.1/0.37.2. An isolated clean install at cf93599e failed during dependency fetch with ENOSPC; incomplete task-only caches were removed. EAS had no builds for that commit. A clean cloud iOS/Android build is still required. The new internal cyberjudah-acceptance profile inherits the existing preview identity but disables OTA loading so an acceptance run tests its embedded candidate. Candidate numbers are iOS 312 and Android 517; store availability is not established. Expo web export completed, and a refreshed export follows the Nave fix; browser/physical-device acceptance are separate checks; passing unit tests is not store readiness. Cloud acceptance builds may use existing frozen credentials; they do not authorize store submission. The full candidate remains unaccepted until resource, content and physical-device checks pass. Bounded staging semantic/BHG requests were denied by Cloudflare 403/error 1010; no alternate-identity retry or security-setting change was made.

The user requested completion of all in-progress features/resources before the later licensing work. Source and edition questions are tracked separately in the Obsidian coordination/audit notes; they are not being used to defer implementation. This document does not claim clearance for distribution. Existing app code licenses and required attribution remain in place.

A second browser finding corrected the dictionary identity: CyberJudah publishes `easton`, whereas inherited English defaults selected `easton-webster`. HTTP defaults and the home widget now use the profile’s actual Easton identity and title. The current Easton publication is online-only; its metadata does not advertise a new offline download. Existing installed legacy copies remain readable. The 39 focused dictionary/widget/SQLite tests cover profile routing and offline preservation; browser evidence is recorded separately.

## Fresh dependency verification — 6 November 2026

A new clone based on `198c31124fd6e4c424979839aa0b72f49dfbe90f` completed
`yarn workspaces focus @bible-strong/expo` with Yarn 4.12.0 and immutable installs
enabled. The lockfile is unchanged. This run installed Firebase 26.4.1 and Nitro
0.37.2 from the candidate lock, replacing the dependency-overlay limitation
described above. The install reported existing peer dependency warnings. In the
managed environment, Yarn required its `httpProxy`/`httpsProxy` settings to use
the inherited proxy, and its global cache was placed in the writable workspace.

The Expo app typecheck, three timeline tests, and 80 critical account/offline/
dictionary/Nave/interlinear tests passed. The full offline archive verifier
passed: 81 books, 1,362 chapters, 36,821 verses and 320,356 Strong's spans.
The regenerated timeline matches the backend geometry and preserves all 991
events in 21 periods, with 517 readable records. Only the English/French
TIMELINE catalog entries changed; the other ten entries are identical. Repeating
the backend build and native import produces byte-for-byte identical artifacts.

The server's strict chronology check still exits 1 (Isaac: 95 versus 100), and
now gates its normal release workflow and root deploy script. No production
resource was published. A signed iOS/Android build and physical-device acceptance
are still required; local compilation and unit tests do not establish store
readiness.
