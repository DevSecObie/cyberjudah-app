export type LegalBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }

export type LegalPage = {
  title: string
  updated?: string
  blocks: LegalBlock[]
}

// Text segments wrapped in **double asterisks** render bold.
export const CYBERJUDAH_CONTACT_EMAIL = 'privacy@cyberjudah.io'

const UPDATED = 'Last updated November 4, 2026'

export const privacyPolicy: LegalPage = {
  title: 'Privacy Policy',
  updated: UPDATED,
  blocks: [
    {
      type: 'paragraph',
      text: 'CyberJudah is a free Bible study app for iPhone, Android and the web. This page explains what it collects, why, who else handles it, how long it is kept, and how to delete it.',
    },
    { type: 'heading', text: 'Without an account' },
    {
      type: 'paragraph',
      text: 'You can read, search, watch classes and study without an account. Your highlights, notes, bookmarks, studies, reading history and settings then stay on your device.',
    },
    { type: 'heading', text: 'With an account' },
    { type: 'paragraph', text: 'If you sign in with email, Google or Apple, we keep:' },
    {
      type: 'bullets',
      items: [
        '**Your email address, your name and an account ID**, to sign you in.',
        '**What you create**: notes, highlights, bookmarks, tags, links and studies, with their earlier versions, so they stay in sync across your devices.',
        '**Studies you choose to publish**: the title, the name you give and the text. Anyone with the link can read a published study until you unpublish it.',
      ],
    },
    {
      type: 'paragraph',
      text: 'These are stored with Google Firebase (Authentication and Cloud Firestore). Each account can read only its own data.',
    },
    { type: 'heading', text: 'Ask' },
    {
      type: 'paragraph',
      text: 'When you are signed in, you can ask questions about scripture and the classes. Your question, and the earlier questions in that conversation, go to our server. Our server sends them, with matching passages from the library, to the AI provider that writes the answer: Anthropic, or an open model run by Cloudflare Workers AI. Your name and email are not sent. Our server does not keep your questions. If you ask by voice, the recording is turned into text by Cloudflare Workers AI and is not kept.',
    },
    { type: 'heading', text: 'How the app is used' },
    {
      type: 'paragraph',
      text: "The iPhone and Android apps use Google Firebase Analytics to count which screens and features are used, linked to your account ID when you are signed in. We use this only to improve the app. There is no advertising, and we do not track you across other companies' apps or websites.",
    },
    { type: 'heading', text: 'Other services' },
    {
      type: 'bullets',
      items: [
        '**Cloudflare** hosts our server and the study library.',
        "**YouTube** plays the class videos. When you play one, YouTube receives your device's request, as it does on its own site.",
        '**Apple App Attest and Google Play Integrity** confirm that requests come from the real app. They carry no personal information.',
      ],
    },
    {
      type: 'paragraph',
      text: 'We do not sell your data, and we do not share it with anyone else.',
    },
    { type: 'heading', text: 'How long it is kept' },
    {
      type: 'paragraph',
      text: 'Account data is kept until you delete it or delete your account.',
    },
    { type: 'heading', text: 'Delete your data' },
    {
      type: 'paragraph',
      text: `In the app, go to **More → Delete account**. This deletes your sign-in, your synced data and your published studies. You can also email ${CYBERJUDAH_CONTACT_EMAIL}. We answer within 30 days.`,
    },
    { type: 'heading', text: 'Children' },
    { type: 'paragraph', text: 'CyberJudah is not directed to children under 13.' },
    { type: 'heading', text: 'Changes' },
    {
      type: 'paragraph',
      text: 'When this policy changes, we update this page and the date at the top.',
    },
    { type: 'heading', text: 'Contact' },
    { type: 'paragraph', text: CYBERJUDAH_CONTACT_EMAIL },
  ],
}

export const termsOfUse: LegalPage = {
  title: 'Terms of Use',
  updated: UPDATED,
  blocks: [
    {
      type: 'numbered',
      items: [
        '**Free study tool.** CyberJudah is free and non-commercial. Use it for personal Bible study.',
        '**Scripture and classes.** The scripture is the King James Version with the Apocrypha, which is in the public domain. Classes play from their public YouTube recordings, and the class notes follow what was taught.',
        '**Your content.** What you write stays yours. If you publish a study, you are responsible for it. Do not publish anything unlawful, hateful or that you do not have the right to share.',
        '**Ask.** Answers are written by AI from the classes and the library, and they can be wrong. Check them against the scripture.',
        '**No warranty.** The app is provided as it is. As far as the law allows, we are not liable for loss that comes from using it.',
        '**Changes.** We may change or stop features, and we may update these terms. The date at the top shows the latest version.',
        '**Ending.** You can stop using CyberJudah and delete your account at any time from More → Delete account.',
        "**App stores.** If you got the app from the App Store, Apple's standard license agreement also applies.",
      ],
    },
    { type: 'paragraph', text: `Contact: ${CYBERJUDAH_CONTACT_EMAIL}` },
  ],
}

export const supportPage: LegalPage = {
  title: 'Support',
  blocks: [
    {
      type: 'paragraph',
      text: `**Need help?** Email **${CYBERJUDAH_CONTACT_EMAIL}**. We answer within a few days.`,
    },
    {
      type: 'bullets',
      items: [
        '**Sign in or out:** More → your account.',
        '**Sync across devices:** sign in with the same account on each device. Your notes, highlights and studies follow you.',
        '**Delete your account:** More → Delete account. This removes your sign-in and your synced data.',
        '**Report a mistake** in a class note or a scripture link: email us with the class, or the book, chapter and verse.',
        '**Privacy:** see the Privacy Policy.',
      ],
    },
  ],
}

export const splitBold = (text: string): { text: string; bold: boolean }[] =>
  text
    .split('**')
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter(part => part.text.length > 0)
