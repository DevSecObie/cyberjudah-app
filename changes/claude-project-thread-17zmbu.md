# Remove the last Bible Strong pictures and timeline file from the app

Obie asked (2026-11-01) to drop every Bible Strong file still packed in the app. None of these were
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
