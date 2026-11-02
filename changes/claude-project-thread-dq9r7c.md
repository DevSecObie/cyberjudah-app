# Web app builds again and ships less code

Web only. The iPhone and Android apps are unchanged.

- The web export failed with "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm": class search
  imported the phone's SQLite connection, which pulled expo-sqlite's web worker in. The web keeps
  no databases, so the connection now has a web stand-in (`sqliteConnection.web.ts`), like the
  other databases already do.
- Each web screen is its own file (expo-router async routes, web only), so the largest file
  stays under Cloudflare's 25 MiB limit for one asset.
- The web export drops code no screen uses (Expo tree shaking, set only in `web:export` and
  `web:build`): the largest file goes from 23.5 MB to 17.0 MB. The whole icon set and every date
  language no longer ship.
- The staging web build in CI uses `web:export`, so it gets the same settings.
- Ask on web opens Ask CyberJudah, as on the phone. The web copy of the assistant screen still
  opened Bible Strong's own assistant; it now picks the same way the phone's screen does.
- Bible Strong's floating assistant button stays off on web for CyberJudah, as on the phone
  (CyberJudah has Ask).
