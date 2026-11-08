import { getLanguage } from '~i18n'
import { getIfLocalResourceNeedsDownload } from '~features/resources/resourceAvailability'
import type { BibleCanonId } from './bibleBookCatalog'
import type { StrongBibleDatasetId } from './strongBiblePublications'
import { createOfflineCopyId } from './offlineCopyId'

export type BibleVersificationId =
  | 'bible-strong-default'
  | 'bible-strong-french-4-chapter-joel'
  | 'bible-strong-catholic-extended-esther-daniel'
  | 'theotex-septuagint'
  | 'clementine-vulgate'

export type BibleVersionLanguage =
  | 'fr'
  | 'en'
  | 'he'
  | 'grc'
  | 'he-grc'
  | 'la'
  | 'th'
  | 'sl'
  | 'pt'
  | 'ar'
  | 'nl'
  | 'fi'

export type TranslationReadingProfile =
  | 'word-for-word'
  | 'balanced'
  | 'thought-for-thought'
  | 'paraphrase'

export const getIfVersionNeedsUpdate = async (versionId: string) => {
  if (await getIfVersionNeedsDownload(versionId)) return false
  const { resolveResourceCatalogStatus } = await import('./resourcePublication')
  const status = await resolveResourceCatalogStatus(
    createOfflineCopyId({ kind: 'bible', versionId })
  )
  return status === 'update-available'
}

export const getIfVersionNeedsDownload = async (versionId: string) => {
  return getIfLocalResourceNeedsDownload({ kind: 'bible', versionId })
}

export interface Version {
  id: string
  name: string
  name_en?: string
  c?: string
  sourceUrl?: string
  type?: 'en' | 'fr' | 'other'
  language: BibleVersionLanguage
  readingProfile: TranslationReadingProfile | null
  hasAudio?: boolean
  hasRedWords?: boolean
  hasPericope?: boolean
  getAudioUrl?: (bookNum: number, chapterNum: number) => string
  canonId?: BibleCanonId
  versificationId?: BibleVersificationId
  strongDatasetId?: StrongBibleDatasetId
  hidden?: boolean
}

export const versions: Record<string, Version> = {
  LSG: {
    id: 'LSG',
    name: 'Bible Segond 1910',
    c: '1910 - Libre de droit',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: false,
    hasPericope: false,
    strongDatasetId: 'LSG',
  },
  NBS: {
    id: 'NBS',
    name: 'Nouvelle Bible Segond',
    c: '© 2002 Société Biblique Française',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  NEG79: {
    id: 'NEG79',
    name: 'Nouvelle Edition de Genève 1979',
    c: '© 1979 Société Biblique de Genève',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  NVS78P: {
    id: 'NVS78P',
    name: 'Nouvelle Segond révisée',
    c: '© Alliance Biblique Française',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  S21: {
    id: 'S21',
    name: 'Bible Segond 21',
    c: '© 2007 Société Biblique de Genève',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  BHG: {
    id: 'BHG',
    name: 'Bible hébraïque et grecque',
    name_en: 'Hebrew & Greek Bible',
    c: 'Westminster Leningrad Codex and Scrivener 1894 (public domain). Hebrew word tags: Open Scriptures Hebrew Bible Project, CC BY 4.0. Greek word tags: Maurice A. Robinson (public domain).',
    sourceUrl: 'https://github.com/openscriptures/morphhb',
    type: 'other',
    language: 'he-grc',
    readingProfile: null,
  },
  KJF: {
    id: 'KJF',
    name: 'King James Française',
    c: '© 1611 Traduction française, Bible des réformateurs 2006',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
  },
  DBY: {
    id: 'DBY',
    name: 'Bible Darby',
    c: '1890 Libre de droit',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    strongDatasetId: 'DBY',
  },
  DBR: {
    id: 'DBR',
    name: 'Bible Darby révisée',
    c: '© Bibles et Publications Chrétiennes - CC BY-NC-ND',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    strongDatasetId: 'DBYR',
  },
  OST: {
    id: 'OST',
    name: 'Ostervald',
    c: '1881 Libre de droit',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
  },
  // JER: {
  //   id: 'JER',
  //   name: 'Bible Jérusalem',
  //   c: '© 1966',
  // },
  CHU: {
    id: 'CHU',
    name: 'Bible Chouraqui 1985',
    c: '© 1977 Editions Desclée de Brouwer',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: true,
  },
  BDS: {
    id: 'BDS',
    name: 'Bible du Semeur',
    c: '© 2000 Société Biblique Internationale',
    type: 'fr',
    language: 'fr',
    readingProfile: 'thought-for-thought',
    hasRedWords: true,
    hasPericope: true,
  },
  FMAR: {
    id: 'FMAR',
    name: 'Martin 1744',
    c: '1744 Libre de droit',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: false,
    hasPericope: false,
  },
  LAU: {
    id: 'LAU',
    name: 'Bible de Lausanne 1872',
    name_en: 'Lausanne Bible 1872',
    c: '1872 - Domaine public',
    sourceUrl: 'https://sites.google.com/view/bibledelausanne',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    versificationId: 'bible-strong-french-4-chapter-joel',
  },
  BFC: {
    id: 'BFC',
    name: 'Bible en Français courant',
    c: '© Alliance Biblique Française',
    type: 'fr',
    language: 'fr',
    readingProfile: 'thought-for-thought',
    canonId: 'catholic-73',
    versificationId: 'bible-strong-default',
    hasRedWords: true,
    hasPericope: true,
  },
  FRC97: {
    id: 'FRC97',
    name: 'Français courant',
    c: '© Alliance Biblique Française',
    type: 'fr',
    language: 'fr',
    readingProfile: 'thought-for-thought',
    canonId: 'catholic-73',
    versificationId: 'bible-strong-default',
    hasRedWords: true,
    hasPericope: true,
  },
  NFC: {
    id: 'NFC',
    name: 'Nouvelle Français courant',
    c: "Alliance biblique française Bibli'0, ©2019",
    type: 'fr',
    language: 'fr',
    readingProfile: 'thought-for-thought',
    canonId: 'catholic-73',
    versificationId: 'bible-strong-default',
    hasRedWords: true,
    hasPericope: true,
  },
  KJV: {
    id: 'KJV',
    canonId: 'kjv-1611',
    name: 'King James Version',
    c: 'King James Version with Apocrypha (public domain). Strong’s dictionaries: Open Scriptures, CC BY-SA. Brown–Driver–Briggs transcription and Strong index: Open Scriptures Hebrew Bible Project, CC BY 4.0.',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
    strongDatasetId: 'KJV',
  },
  BSB: {
    id: 'BSB',
    name: 'Berean Standard Bible',
    c: '© Berean Bible — CC0 / Public Domain',
    sourceUrl: 'https://berean.bible/licensing.htm',
    type: 'en',
    language: 'en',
    readingProfile: 'balanced',
    hasPericope: false,
    strongDatasetId: 'BSB',
  },
  ASV: {
    id: 'ASV',
    name: 'American Standard Version',
    c: '1901 — Public Domain',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=ASV',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasPericope: false,
    strongDatasetId: 'ASV',
  },
  DARBY: {
    id: 'DARBY',
    name: 'Darby Bible',
    c: '1889 — Public Domain',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Darby',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasPericope: false,
    strongDatasetId: 'DARBY_EN',
  },
  RLT: {
    id: 'RLT',
    name: 'Revised Literal Translation',
    c: '© 2018 Michael W. Jones, Sr. — GPL',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=RLT',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
    strongDatasetId: 'RLT',
  },
  WEB1833: {
    id: 'WEB1833',
    name: 'Noah Webster Bible (1833)',
    sourceUrl: 'https://ebible.org/find/details.php?id=engwebster',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: false,
    hasPericope: false,
  },
  RWEBSTER: {
    id: 'RWEBSTER',
    name: "Revised Webster's Bible",
    c: '1833 — Public Domain',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=RWebster',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasPericope: true,
    strongDatasetId: 'RWEBSTER',
  },
  RV1895: {
    id: 'RV1895',
    name: 'Revised Version 1895',
    c: '1895 — Public Domain',
    sourceUrl: 'https://www.stepbible.org/',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasPericope: true,
    strongDatasetId: 'RV1895',
  },
  NKJV: {
    id: 'NKJV',
    name: 'New King James Version',
    c: '© 1982 Thomas Nelson, Inc',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  ESV: {
    id: 'ESV',
    name: 'English Standard Version',
    c: '© 2001 Crossway Bibles',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  NIV: {
    id: 'NIV',
    name: 'New International Version',
    c: '© NIV® 1973, 1978, 1984, 2011 Biblica',
    type: 'en',
    language: 'en',
    readingProfile: 'balanced',
    hasRedWords: true,
    hasPericope: true,
  },
  BCC1923: {
    id: 'BCC1923',
    name: 'Bible catholique Crampon 1923',
    c: '© mission-web.com',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    canonId: 'catholic-73',
    versificationId: 'bible-strong-catholic-extended-esther-daniel',
    hasRedWords: true,
    hasPericope: true,
  },
  PDV2017: {
    id: 'PDV2017',
    name: 'Parole de Vie 2017',
    c: "© 2000 Société biblique française - Bibli'O",
    type: 'fr',
    language: 'fr',
    readingProfile: 'thought-for-thought',
    canonId: 'catholic-73',
    versificationId: 'bible-strong-default',
    hasRedWords: true,
    hasPericope: true,
  },
  POV: {
    id: 'POV',
    name: 'Parole vivante (NT)',
    c: '© 2013',
    type: 'fr',
    language: 'fr',
    readingProfile: 'paraphrase',
    hasRedWords: true,
  },
  LXX_FR: {
    id: 'LXX_FR',
    name: 'Septante française (AT)',
    name_en: 'French Septuagint (OT)',
    c: 'Texte grec-français édité par ThéoTeX Éditions - theotex.org',
    sourceUrl: 'https://theotex.org/',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
  },
  EASY: {
    id: 'EASY',
    name: 'EasyEnglish Bible 2018',
    c: 'Copyright © MissionAssist 2018',
    type: 'en',
    language: 'en',
    readingProfile: 'thought-for-thought',
    hasRedWords: true,
    hasPericope: true,
  },
  TLV: {
    id: 'TLV',
    name: 'Tree of Life Version',
    c: '© 2015 The Messianic Jewish Family Bible Society',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
  },
  NASB2020: {
    id: 'NASB2020',
    name: 'New American Standard Bible 2020',
    c: '© 1960–2020 The Lockman Foundation. All rights reserved.',
    sourceUrl: 'https://www.lockman.org/new-american-standard-bible-nasb/',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
    strongDatasetId: 'NASB2020',
  },
  NASB1995: {
    id: 'NASB1995',
    name: 'New American Standard Bible 1995',
    c: '© 1960–1995 The Lockman Foundation. All rights reserved.',
    sourceUrl: 'https://www.lockman.org/new-american-standard-bible-nasb/',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    canonId: 'protestant-66',
    versificationId: 'bible-strong-default',
    hasRedWords: true,
    hasPericope: true,
    strongDatasetId: 'NASB1995',
  },
  NET: {
    id: 'NET',
    name: 'New English Translation',
    c: '© 1996-2016 Biblical Studies Press, L.L.C.',
    type: 'en',
    language: 'en',
    readingProfile: 'balanced',
    hasRedWords: true,
    hasPericope: true,
  },
  GW: {
    id: 'GW',
    name: 'God\u2019s Word Translation',
    c: '\u00a9 1995 God\u2019s Word to the Nations Bible Society',
    type: 'en',
    language: 'en',
    readingProfile: 'balanced',
    hasRedWords: true,
    hasPericope: true,
  },
  CSB: {
    id: 'CSB',
    name: 'Christian Standard Bible',
    c: '© 2017 Holman Bible Publishers',
    type: 'en',
    language: 'en',
    readingProfile: 'balanced',
    hasRedWords: true,
    hasPericope: true,
  },
  NLT: {
    id: 'NLT',
    name: 'New Living Translation',
    c: '© 1996, 2004, 2015 Tyndale House Foundation',
    type: 'en',
    language: 'en',
    readingProfile: 'thought-for-thought',
    hasRedWords: true,
    hasPericope: true,
  },
  AMP: {
    id: 'AMP',
    name: 'Amplified Bible',
    c: '© 2015 by The Lockman Foundation, La Habra, CA 90631',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: true,
    hasPericope: true,
  },
  BHS: {
    id: 'BHS',
    name: 'Biblia Hebraica Stuttgartensia (AT)',
    name_en: 'Biblia Hebraica Stuttgartensia (OT)',
    c: '© Deutsche Bibelgesellschaft, Stuttgart 1967/77',
    type: 'other',
    language: 'he',
    readingProfile: null,
  },
  LXX: {
    id: 'LXX',
    name: 'Septante (AT)',
    name_en: 'Septuagint (OT)',
    type: 'other',
    language: 'grc',
    readingProfile: null,
    c: 'Texte grec-français édité par ThéoTeX Éditions - theotex.org',
    sourceUrl: 'https://theotex.org/septuaginta/genese/genese_1.html',
    canonId: 'theotex-septuagint',
    versificationId: 'theotex-septuagint',
  },
  VUL: {
    id: 'VUL',
    name: 'Vulgate clémentine (latin)',
    name_en: 'Clementine Vulgate (Latin)',
    c: 'Domaine public - Clementine Text Project',
    sourceUrl:
      'https://bitbucket.org/clementinetextproject/text/src/edc85da058be630183d26e4deb6714ade80e600c/',
    type: 'other',
    language: 'la',
    readingProfile: null,
    canonId: 'clementine-vulgate',
    versificationId: 'clementine-vulgate',
  },
  SBLGNT: {
    id: 'SBLGNT',
    name: 'SBL NT. Grec (NT)',
    name_en: 'SBL NT. Greek (NT)',
    c: '© 2010 Society of Bible Litterature',
    type: 'other',
    language: 'grc',
    readingProfile: null,
  },
  TR1624: {
    id: 'TR1624',
    name: 'Elzevir Textus Receptus 1624 (NT)',
    type: 'other',
    language: 'grc',
    readingProfile: null,
  },
  TR1894: {
    id: 'TR1894',
    name: 'Scrivener’s Textus Receptus 1894 (NT)',
    type: 'other',
    language: 'grc',
    readingProfile: null,
  },
  DEL: {
    id: 'DEL',
    name: "Tanach and Delitzsch's Hebrew New Testament",
    c: '© Bible Society in Israel, 2018.',
    type: 'other',
    language: 'he',
    readingProfile: null,
  },
}

// Metadata and verbatim licence credits supplied by the content rebuild.
Object.assign(versions, {
  FMAR: {
    id: 'FMAR',
    name: 'Bible David Martin (1744)',
    c: 'La Sainte Bible, version David Martin 1744, domaine public. Texte : module SWORD FreBDM1744 (CrossWire Bible Society).',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreBDM1744',
    type: 'fr',
    language: 'fr',
    readingProfile: 'word-for-word',
    hasRedWords: false,
    hasPericope: false,
  },
  WEB1833: {
    id: 'WEB1833',
    name: 'Noah Webster Bible (1833)',
    c: 'The Holy Bible, in the Common Version, with Amendments of the language by Noah Webster, LL.D. (1833), public domain. Text: eBible.org (engwebster).',
    sourceUrl: 'https://ebible.org/find/details.php?id=engwebster',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: false,
    hasPericope: false,
  },
  KJVA: {
    id: 'KJVA',
    name: 'King James Version with Apocrypha (1769 text)',
    c: 'King James Version (1769 standard text) with Apocrypha, public domain (Crown patent applies to printing in the UK). Text: CrossWire Bible Society and eBible.org (eng-kjv).',
    sourceUrl: 'https://ebible.org/find/details.php?id=eng-kjv',
    type: 'en',
    language: 'en',
    readingProfile: 'word-for-word',
    hasRedWords: false,
    hasPericope: false,
    canonId: 'kjv-1611',
  },
  TR1624: {
    id: 'TR1624',
    name: 'Elzevir Textus Receptus (1624)',
    c: 'Elzevir Textus Receptus (1624), edited by Abraham and Bonaventure Elzevir; transcription by Maurice Robinson. CC BY-NC-SA 4.0. Text: CrossWire Bible Society (Elzevir module).',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Elzevir',
    type: 'other',
    language: 'grc',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
  },
  TR1894: {
    id: 'TR1894',
    name: 'Textus Receptus (Scrivener 1894)',
    c: 'Textus Receptus, Scrivener 1894 readings of the CrossWire TR module (base Stephens 1550 with Scrivener 1894 variants). CC BY-NC-SA 4.0. Text: CrossWire Bible Society (TR module).',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=TR',
    type: 'other',
    language: 'grc',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
  },
  THAIKJV: {
    id: 'THAIKJV',
    name: 'Thai King James Version',
    c: 'พระคัมภีร์ภาษาไทยฉบับ KJV (Thai KJV), copyright © 2003 Philip Pope, CC BY-NC-ND 4.0. Text: eBible.org (thaKJV).',
    sourceUrl: 'https://ebible.org/find/details.php?id=thaKJV',
    type: 'other',
    language: 'th',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
  },
  BLIVRETR: {
    id: 'BLIVRETR',
    name: 'Bíblia Livre, edição Textus Receptus',
    c: 'Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Texto: eBible.org (porbr2018).',
    sourceUrl: 'https://ebible.org/find/details.php?id=porbr2018',
    type: 'other',
    language: 'pt',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
  },
  SVD: {
    id: 'SVD',
    name: 'Smith–Van Dyck Arabic Bible',
    c: 'Smith–Van Dyck Arabic Bible (Syrian Mission, American Bible Society), public domain. Text: eBible.org (arb-vd).',
    sourceUrl: 'https://ebible.org/find/details.php?id=arb-vd',
    type: 'other',
    language: 'ar',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
  },
  SLOKJV: {
    id: 'SLOKJV',
    name: 'Sveto pismo Kralja Jakoba (Slovenian KJV)',
    c: 'Sveto pismo Kralja Jakoba (SloKJV), Marjan Šavli in Barbara Hojkar Šavli, CC BY-NC-ND 4.0. Besedilo: CrossWire Bible Society (SloKJV), https://github.com/msavli/SloKJV.',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=SloKJV',
    type: 'other',
    language: 'sl',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
  },
  DUTSVVA: {
    id: 'DUTSVVA',
    name: 'Statenvertaling (1637) met de apocriefe boeken',
    c: 'Statenvertaling (1637), met de apocriefe boeken, publiek domein. Tekst: CrossWire Bible Society (DutSVVA), naar github.com/Isidore-Guild/statenvertaling.',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=DutSVVA',
    type: 'other',
    language: 'nl',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
    canonId: 'statenvertaling-apocrypha',
  },
  FINBIBLIA: {
    id: 'FINBIBLIA',
    name: 'Biblia 1776',
    c: 'Biblia (1776), Suomen kirkkoraamattu, public domain. Text: CrossWire Bible Society (FinBiblia), SWORD version by Tero Favorin.',
    sourceUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FinBiblia',
    type: 'other',
    language: 'fi',
    readingProfile: null,
    hasRedWords: false,
    hasPericope: false,
    canonId: 'kjv-1611',
  },
})

export const getBibleVersionCanonId = (versionId: string): BibleCanonId =>
  versions[versionId]?.canonId ?? 'protestant-66'

export const getBibleVersionVersificationId = (versionId: string): BibleVersificationId =>
  versions[versionId]?.versificationId ?? 'bible-strong-default'

export const getVersions = () => {
  return versions
}

interface VersionsBySection {
  title: string
  data: Version[]
}
export const versionsBySections: VersionsBySection[] = Object.values(versions).reduce(
  (sectionArray, version) => {
    if (version.hidden) return sectionArray
    switch (version.id) {
      case 'LSG':
      case 'NBS':
      case 'NEG79':
      case 'NVS78P':
      case 'S21': {
        sectionArray[0].data.push(version)
        return sectionArray
      }
      case 'KJV':
      case 'NKJV':
      case 'NIV':
      case 'ESV':
      case 'AMP':
      case 'NASB1995':
      case 'NASB2020':
      case 'EASY':
      case 'TLV':
      case 'NET':
      case 'GW':
      case 'CSB':
      case 'NLT': {
        sectionArray[2].data.push(version)
        return sectionArray
      }
      case 'BHS':
      case 'SBLGNT':
      case 'TR1624':
      case 'TR1894':
      case 'DEL':
      case 'LXX':
      case 'VUL': {
        sectionArray[3].data.push(version)
        return sectionArray
      }
      default: {
        sectionArray[1].data.push(version)
        return sectionArray
      }
    }
  },
  [
    { title: 'Versions Louis Segond', data: [] },
    { title: 'Autres versions', data: [] },
    { title: 'Versions anglaises', data: [] },
    { title: 'Versions étrangères', data: [] },
  ] as VersionsBySection[]
)

export const versionsBySections_en: VersionsBySection[] = Object.values(versions).reduce(
  (sectionArray, version) => {
    if (version.hidden) return sectionArray
    const versionEn = { ...version, name: version.name_en || version.name }
    switch (version.id) {
      case 'KJV':
      case 'NKJV':
      case 'NIV':
      case 'AMP':
      case 'NASB1995':
      case 'NASB2020':
      case 'EASY':
      case 'TLV':
      case 'NET':
      case 'GW':
      case 'CSB':
      case 'NLT':
      case 'ESV': {
        sectionArray[0].data.push(versionEn)
        return sectionArray
      }
      case 'LSG':
      case 'NBS':
      case 'NEG79':
      case 'NVS78P':
      case 'S21':
      case 'KJF':
      case 'DBY':
      case 'DBR':
      case 'OST':
      case 'CHU':
      case 'BDS':
      case 'FMAR':
      case 'LAU':
      case 'BFC':
      case 'FRC97':
      case 'NFC':
      case 'BCC1923':
      case 'PDV2017':
      case 'LXX_FR':
      case 'POV': {
        sectionArray[1].data.push(versionEn)
        return sectionArray
      }
      case 'BHS':
      case 'SBLGNT':
      case 'TR1624':
      case 'TR1894':
      case 'DEL':
      case 'LXX':
      case 'VUL': {
        sectionArray[2].data.push(versionEn)
        return sectionArray
      }
      default: {
        return sectionArray
      }
    }
  },
  [
    { title: 'English versions', data: [] },
    { title: 'French versions', data: [] },
    { title: 'Other versions', data: [] },
  ] as VersionsBySection[]
)

export const getVersionsBySections = () => {
  if (getLanguage() === 'fr') {
    return versionsBySections
  }

  return versionsBySections_en
}
