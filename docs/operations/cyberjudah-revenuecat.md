# CyberJudah prepaid AI credits

Updated 2026-10-29. RevenueCat project: <https://app.revenuecat.com/projects/5f4cc586/overview>.

## Accepted product direction

The owner chose **“Choose a budget; higher payment buys more AI credit.”** Purchases fund Ask CyberJudah usage. Bible reading, notes, dictionary, Nave, timeline and normal study tools remain free. No subscription, lifetime AI access, automatic top-up or expiry of purchased credits is intended.

The previous monthly/yearly/lifetime Test Store products were onboarding placeholders. The existing `default` offering and `cyberjudah_pro` entitlement are not used by the new credit flow. The unpublished subscription paywall is marked **Superseded — subscription prototype — DO NOT PUBLISH**. Do not reinterpret a lifetime non-consumable as a consumable pack.

## Research and proposed launch experience

- Rocket Money lets customers choose a price for the same Premium functionality. CyberJudah's approved model instead gives proportionally more AI usage for a larger purchase. [Rocket Money terms](https://www.rocketmoney.com/terms)
- AI products use balances and usage tracking: Poe offers compute points; Lovable provides top-ups and credit usage information. Their subscription requirements and expiration policies should not be copied blindly into an App Store consumable product. [Poe](https://help.poe.com/hc/en-us/articles/19945140063636-Poe-Purchases-FAQs), [Lovable](https://docs.lovable.dev/introduction/credits-and-usage)
- Apple supports consumable purchases with predefined products and price points. A budget selector in the iPhone app should select an actual configured store product, not charge an arbitrary amount entered in a text box. Purchased credits may not expire. [Apple product setup](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases), [Apple pricing API](https://developer.apple.com/documentation/appstoreconnectapi/managing-in-app-purchases), [Review guidelines](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- RevenueCat can grant currency after verified purchases. The app can read balances; debits require a trusted backend. Refresh currency caches after purchases and server-side spending. [RevenueCat in-app currency](https://www.revenuecat.com/docs/offerings/virtual-currency)

Suggested initial purchase amounts for owner review: **$5, $10 and $20**, localized by the store. These are proposals, not created products, approved prices or promised AI dollar amounts. Show the exact number of credits received beside the localized price; use the same base conversion across packs initially. A credit is not a guaranteed number of answers: cost depends on the model, context, output and search work. Show an estimated/max cost before expensive requests, charge only the settled amount, and release unused reservations. Failed requests without a usable answer should not spend customer credits. No auto-reload.

Before deciding credit quantities, budget from **net proceeds**, not the purchase's gross price. Apple Small Business enrollment can qualify for a 15% rate, but membership in that program has not been verified for this account; Google also has an enrolled 15% service-fee tier. Taxes, RevenueCat costs, search/hosting, refunds and any operating reserve must also be accounted for. A $5 purchase does not automatically fund $5 of model-provider spending. Do not copy Telegram's Stars conversion into store billing. [Apple program](https://developer.apple.com/app-store/small-business-program/), [Google fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)

The existing Telegram implementation uses non-expiring top-ups and integer cost accounting in `shared/credits.mjs`, with reserved/settled requests in `bot/src/credits.ts`. Reuse that accounting design, not Telegram account identity or payment receipts. Telegram linking remains parked.

## Implemented locally

- React Native / Expo with Yarn; `react-native-purchases` and `react-native-purchases-ui` pinned to **10.16.0**. RevenueCat 11's required native pod was unavailable; its official release notes instruct Expo users to stay on 10.x for now. [Release notes](https://github.com/RevenueCat/react-native-purchases/releases/tag/11.0.0)
- Scoped Firebase UID: `staging:<uid>` for staging; UID for production. Never email or Telegram ID.
- SDK key validation permits the supplied Test Store public key only in a staging development build. TestFlight/store builds need platform keys. Test Store keys deliberately crash release builds in the SDK. [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- `ASK` currency, dedicated `ask_credits` offering, custom package IDs `ask_small`, `ask_medium`, `ask_large`. Only actual consumable, non-subscription products pass the purchase guard. Old subscription/lifetime offerings are refused.
- `presentPaywall`, not `presentPaywallIfNeeded`: customers can buy more credits even with an existing balance. An entitlement never unlocks AI access or acts as a wallet.
- Fresh balances after purchase, support dismissal, app foreground and reopening the model sheet. Purchase events are observed; listener cleanup is included.
- Checkout and account switching are serialized and Firebase UID is rechecked before/after operations and at purchase initiation. No client-side balance minting, grants or deductions.
- “Your AI balance”, “Choose your AI budget”, “Refresh balance” and Customer Center “Purchase help” in Ask's existing model sheet. Bible Strong study screens are unchanged.
- Live checkout requires both the app's live-purchase flag and server readiness. The server still advertises `purchasesEnabled: false`. Test Store checkout can be exercised only after its credit catalog and native build are ready.

## Installation and configuration

Already installed from the monorepo root:

```sh
yarn workspace @bible-strong/expo add react-native-purchases@10.16.0 react-native-purchases-ui@10.16.0
```

Local staging debug settings in ignored `apps/expo/.env.local`:

```dotenv
EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE=staging
EXPO_PUBLIC_REVENUECAT_TEST_KEY=<public Test Store key>
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
EXPO_PUBLIC_ASK_PURCHASES_ENABLED=false
```

For TestFlight use `appl_...`; for Play testing use `goog_...`. Never embed a secret REST API key in `EXPO_PUBLIC_*`. These packages contain native code: a Metro reload alone cannot add them to an installed app. CyberJudah version/runtime is now 28.1.0 / 28.1 to separate the new native dependency from 28.0 builds.

From `apps/expo`, using CyberJudah's current signing configuration:

```sh
yarn expo prebuild --platform ios --no-install
cd ios
pod install
cd ..
yarn expo run:ios --device
```

Do not use the upstream Bible Strong EAS submit profile; its App Store Connect ID belongs to upstream. The Android plugin sets the main activity to `singleTop`, preserving store handoffs. Retest sign-in deep links on the next Android build.

## Dashboard configuration still needed

The project, Test Store, legacy default offering and legacy entitlement were verified. **Keep with original App User ID** was saved after explicit owner approval. Customer Center has its default purchase-help flows. Currency **ASK / Ask credits** and named offering **ask_credits** (`ofrng949e571933`) have now been created, with no products, grants or paywall attached. Email confirmation remains outstanding. No real store products, purchase, upload or paywall publication was performed.

Prepare the following after the owner approves amounts and unit economics:

| Package ID   | Suggested product ID | Type       | Grant                           |
| ------------ | -------------------- | ---------- | ------------------------------- |
| `ask_small`  | `ask_credits_small`  | Consumable | Approved small amount of `ASK`  |
| `ask_medium` | `ask_credits_medium` | Consumable | Approved medium amount of `ASK` |
| `ask_large`  | `ask_credits_large`  | Consumable | Approved large amount of `ASK`  |

Use the existing currency `ASK` (Ask credits), with **no expiration** on purchased grants. Associate the consumable products and their approved credit amounts. Put only these packages in the existing named offering `ask_credits`. Do not attach packs to the old `cyberjudah_pro` entitlement. Keep product names, grant counts, localized prices and checkout disclosure consistent. Add balance/purchase history in Customer Center where supported. Create a new credit-purchase paywall; do not publish the superseded subscription draft.

Signing into the same Firebase account recovers its remaining balance across devices. Store “Restore purchases” must not regrant spent consumables; the authoritative account ledger preserves them. The app offers refresh and purchase help instead of promising consumable restoration. [RevenueCat consumable restoration limitation](https://www.revenuecat.com/docs/known-store-issues/play-billing-library/restore-consumable-purchases-bc8)

## Complete app integration

Local implementations (not yet committed/pushed):

- `apps/expo/src/features/study-assistant/revenueCatConfiguration.ts`: safe platform/build key selection.
- `apps/expo/src/features/study-assistant/revenueCat.ts`: SDK identity, wallet reads, consumable validation, purchases, native paywall and Customer Center.
- `apps/expo/src/features/study-assistant/AskCreditsCard.tsx`: state, errors, account lifecycle and controls.

Minimal usage of the complete guarded implementation:

```tsx
import { useEffect, useState } from 'react'
import { Button, Text, View } from 'react-native'
import { observeAskCredits, presentAskCreditsPaywall, type AskCredits } from './revenueCat'

export function Credits({ uid, serverReady }: { uid: string; serverReady: boolean }) {
  const [wallet, setWallet] = useState<AskCredits | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => observeAskCredits(uid, setWallet, () => setError('Balance unavailable.')), [uid])
  async function buy() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      setWallet(await presentAskCreditsPaywall(uid, serverReady))
    } catch (cause) {
      if (!(cause as { userCancelled?: boolean })?.userCancelled)
        setError('Unable to complete checkout. Check your purchase history before retrying.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <View>
      <Text>{wallet?.available ? `${wallet.balance} credits` : 'Balance unavailable'}</Text>
      <Button
        title="Choose your AI budget"
        disabled={busy || !wallet?.packages.length}
        onPress={() => void buy()}
      />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
    </View>
  )
}
```

Mount under `key={uid}` after Firebase sign-in, as the actual chat screen does. A `PURCHASED` result alone never changes the displayed balance; the integration reads RevenueCat's verified currency balance.

## Backend and release gates

### Model recommendation, pending content evaluation

Start the evaluation with **GPT-6 Luna** for everyday questions and **Claude Sonnet 5.5** for deeper study. Compare **GPT-6.1 Sol** against Sonnet before settling the premium default. These are recommendations, not a completed migration or a Bible-specific quality benchmark. Use the same CyberJudah source retrieval and citation checks for every model. Test quotations, verse references, source IDs, relevant class timestamps, conflicting interpretations, unsupported questions, latency, and total cost over all research rounds.

Official standard text rates checked during this work, per million input/output tokens: Luna $0.10/$0.50; Sonnet 5.5 $2/$10; Sol $2/$10. Account-specific access, gateway pricing and any long-context rates still need verification. Tool calls, reasoning output, repeated context, storage and store fees are additional cost considerations. The local gateway catalog contains Luna but only older Sonnet entries, so verify gateway availability and provider API compatibility before changing the model list. Do not enable a paid model or spend customer credits merely because it appears in a model catalog. [OpenAI models](https://developers.openai.com/api/docs/models), [Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)

Still required before real paid Ask: authenticated server balance checks/spending, a server-only RevenueCat key with minimal required permissions, model-cost conversion, atomic reservations/settlement, idempotent purchase/refund handling, retry protection, account deletion policy for unused credit, and separation of sandbox versus production balances. Do not make both RevenueCat and a separate ledger independently mint the same purchase. Production must reject sandbox-funded usage even when a client supplies a real-looking balance.

The new native Ask streaming endpoint remains undeployed. Free Ask can continue through the existing service; paid models and live purchases remain closed. This document does not claim paid AI is operational.

## Validation and known limits

The final focused credit/Ask/timeline run passed **160 tests in 26 suites**. Final root typecheck and lint passed (0 errors, 47 warnings), as did targeted formatting and `git diff --check`. Coverage includes consumable-only purchases, repeat purchases, stale-account rejection, server balance refresh and refusal to mint credit from a checkout result. The earlier subscription implementation's test count is superseded. Earlier architecture/style/quality checks and iOS JavaScript export/prebuild passed. The compatible 10.16.0 native pods installed successfully. The separate **unsigned iPhone Debug compilation succeeded**, verifying the new native dependency without modifying the shared generated iOS project. This is not a signed installable IPA, TestFlight upload or device purchase test; the build snapshot also precedes the final empty-catalog explanatory-message adjustment.

The expanded repository test run found 4 failing suites: Downloads catalog parity (Jewish Encyclopedia entry), Back, NoteScreen, and onboarding's vector-icons test import. It reported 502 passed suites and 3308 passed tests; the remaining workspaces did not run after the Expo failure. These failures are outside the billing files and must be resolved before calling the whole app release-ready.

Device purchase tests require a fresh native build and configured credit catalog. Test cancellation, failed/pending payment, success, delayed grant, duplicate delivery, account switch, refund, insufficient funds, interrupted answer, retry, reinstall, foreground refresh, and concurrent questions on two devices. No test or real purchase has been made in this work.
