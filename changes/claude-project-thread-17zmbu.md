# Remove the last Bible Strong pictures and timeline file from the app

2026-11-01: drop every Bible Strong file still packed in the app. None of these were
shown in the CyberJudah build, but they shipped inside it.

- Timeline: Bible Strong's 13 period paintings and its `events.txt` timeline file are gone. The
  app reads only the published CyberJudah timeline; period pictures load from cyberjudah.io.
- Home: the BibleProject plan card (and its picture) and the "Try Audibible" row (and its icon) are
  removed. Both were already hidden in the CyberJudah build; the desktop web home loses its
  BibleProject card.
- Onboarding: Bible Strong's unused welcome slides (`slides.ts`, `OnBoardingSlides.tsx`, 5 PNGs)
  and 8 unused proposal drawings plus `offline-resource-folder.svg` are deleted. Our own approved
  onboarding pictures stay.
- `apps/site` (Bible Strong's marketing site, not shipped) still names `events.txt` in its layout
  script; it is not part of the app.

## Clay figures follow the genealogies (data only)

Edomites were wearing Judah figures (flagged 2026-11-03); these were approved on the clay figure sheet:

- The kings and dukes of Edom (Genesis 36: Teman, Kenaz, Korah and the rest), Hadad the Edomite and
  Genubath, Herod's brothers named Philip and Herodias' daughter, and the Greek and Roman rulers
  that had been missed now wear the Edom figure.
- Canaanites, Amorites, Hittites, men of Tyre and Sidon, and Seir the Horite's family wear Canaan.
  Moab, Ammon, Syria (Aram) and Assyria get their own nations, and the Ethiopians and the kings of
  Midian get Cush. Heber the Kenite and Jael get Cush, like Hobab, and the kings and princes of
  Persia and Media get Elam.
- The families of Israel in Numbers 26 (and the Korhites) show the Israel group instead of Bible
  Strong's grey group.

Only `peopleNations.ts` and `israeliteGroups.ts` change; how figures are chosen does not.

## New clay figures (approved 2026-11-03)

- Egypt (Mizraim): man, woman and group redrawn as dark Sudanese Africans ("the Egyptians were the
  Africans today, the ones in Sudan").
- Elam: man, woman and group redrawn as East Indians ("Elam is who the East Indians are today").
- Israel man #3 redrawn darker, as Gad (Native American) on the 12 tribes chart.

Same clay style and blue ground, 256 px, drawn in Higgsfield ("CyberJudah People Avatars").
