# Jesus is shown as "Jesus Christ"

Obie (2026-11-03): his name shows as "Jesus Christ", never "Jesus" alone. Data only, no
behavior change.

- People module (`bible_entities.cyberjudah.sqlite.zip`): rebuilt with
  `scripts/build-cyberjudah-entities.mjs` from DevSecObie/cyberjudah 49681d58. The only row that
  changed is `jesus-mat-1-1`, whose name is now "Jesus Christ". Its id, verses and family links
  are unchanged, and "Jesus" is still one of its names, so word taps in the verses still find him.
- Timeline: the `jesus` event's title (and its picture caption) say "Jesus Christ". Patched from
  the app's own timeline publication, so no other Timeline change comes along with it.
- The KJV text is untouched.
