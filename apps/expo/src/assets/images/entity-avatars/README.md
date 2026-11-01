# Entity placeholder avatars

Shown for a person or group that has no portrait (`src/features/lexique/strongEntityAvatars.ts`).

`male.png`, `female.png` and `group.png` are the owner-approved CyberJudah avatars from app PR #8 (`male-1`, `female-1` and `group-3`, with Judah in the middle), converted to this release's single 326-pixel PNG per kind. People are Black, Hispanic or Native American; men have full beards with heads uncovered; women wear a head wrap.

The other object avatars are unchanged from Bible Strong.

`<kind>-<nation>.jpg` are CyberJudah's own clay figures for the other nations, one man, woman and people for each nation on the classes' Table of Nations (Genesis 10) and for Japheth, made in Higgsfield in the "CyberJudah People Avatars" project. `src/features/lexique/peopleNations.ts` says which nation each person or people comes of. Bible Strong's grey clay statues are no longer used.

`<kind>-israel-<n>.webp` are the stand-in figures for Israelites with no portrait of their own. On
2026-10-31 Obie flagged a European-looking figure on a man of Judah (Shobab), so `male-israel-2`,
`male-israel-5`, `female-israel-2`, `female-israel-5`, `group-israel-3` and `group-israel-5` were
redrawn as Black Israelites in the same clay style (Higgsfield). The third man and woman are Native
American; `src/features/lexique/judahPeople.ts` lists the people of Judah, who never get them.
