// Inlined into the exported index.html by web-first-screen.mjs, right after the launch screen.
// When the app opens on a Bible tab, it shows that chapter's text in the reading layout at once,
// read from the same chapter API the app uses, instead of the lion. hideBootSplash
// (src/helpers/bootSplash.web.ts) keeps it up until the app's own verses are on screen.
// It only draws the plain default layout: any other reading setting keeps the lion.
;(function (config) {
  let boot = document.getElementById('boot')
  if (!boot || !config || !config.api || location.pathname !== '/') return

  let read = function (key, json) {
    try {
      let value = localStorage.getItem('bible-strong:' + key)
      return value == null ? null : json === false ? value : JSON.parse(value)
    } catch {
      return null
    }
  }

  let tab
  let groups = read('tabGroupsAtom')
  if (!groups) {
    tab = {
      type: 'bible',
      data: {
        selectedVersion: 'KJV',
        selectedBook: { Numero: 1 },
        selectedChapter: 1,
        selectedVerse: 1,
      },
    }
  } else {
    let groupId = read('activeGroupIdAtom') || 'default-group'
    let group = null
    for (let i = 0; i < groups.length; i++)
      if (groups[i] && groups[i].id === groupId) group = groups[i]
    group = group || groups[0]
    tab = group && group.tabs && group.tabs[group.activeTabIndex || 0]
  }
  let data = tab && tab.type === 'bible' && tab.data
  if (!data || data.selectedVersion !== 'KJV' || !data.selectedBook) return
  if (data.parallelVersions && data.parallelVersions.length) return
  if (
    (data.strongMode && data.strongMode !== 'hidden') ||
    (data.interlinearMode && data.interlinearMode !== 'hidden')
  )
    return
  if (data.contextDisplayMode && data.contextDisplayMode !== 'fullChapter') return
  let book = data.selectedBook.Numero
  let chapter = data.selectedChapter
  let name = config.books[book]
  if (!name || !(chapter >= 1)) return

  let language = read('lang', false)
  if (language && language !== 'en') return

  let settings = {}
  let fontFamily = 'Literata Book'
  try {
    let user = JSON.parse((read('root') || {}).user || 'null')
    if (user) {
      settings = (user.bible && user.bible.settings) || {}
      fontFamily = user.fontFamily || fontFamily
    }
  } catch {
    return
  }
  if (fontFamily !== 'Literata Book') return
  if ((settings.fontSizeScale || 0) !== 0) return
  if ((settings.lineHeight || 'normal') !== 'normal') return
  if ((settings.alignContent || 'left') !== 'left') return
  if ((settings.textDisplay || 'inline') !== 'inline') return
  let scheme = settings.preferredColorScheme || 'auto'
  let dark =
    scheme === 'dark' ||
    (scheme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
  if (
    dark
      ? (settings.preferredDarkTheme || 'dark') !== 'dark'
      : (settings.preferredLightTheme || 'default') !== 'default'
  )
    return

  let url = config.api.replace(/\/$/, '') + '/v1/bibles/KJV/books/' + book + '/chapters/' + chapter
  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status))
      return response.json()
    })
    .then(function (body) {
      let verses = body && body.verses
      // The app may have taken the launch screen down already.
      if (!verses || !verses.length || !boot.isConnected || boot.style.opacity === '0') return
      let el = function (tag, className, text) {
        let node = document.createElement(tag)
        if (className) node.className = className
        if (text != null) node.textContent = text
        return node
      }
      let screen = el('div', 'fs' + (dark ? ' fs-dark' : ''))
      let top = el('div', 'fs-top')
      let pill = el('div', 'fs-pill')
      pill.appendChild(el('span', 'fs-ref', name + ' ' + chapter))
      pill.appendChild(el('span', 'fs-version', 'KJV'))
      top.appendChild(pill)
      let scroll = el('div', 'fs-scroll')
      let header = el('header', 'fs-header')
      header.appendChild(el('h1', 'fs-title', name))
      header.appendChild(el('div', 'fs-rule'))
      header.appendChild(el('span', 'fs-chapter', config.chapter + ' ' + chapter))
      scroll.appendChild(header)
      let text = el('div', 'fs-text')
      let target = null
      for (let v = 0; v < verses.length; v++) {
        let verse = el('span', 'fs-verse')
        verse.appendChild(el('span', 'fs-number', verses[v].number + ' '))
        verse.appendChild(el('span', 'fs-words', verses[v].text))
        text.appendChild(verse)
        text.appendChild(document.createTextNode(' '))
        if (verses[v].number === data.selectedVerse && data.selectedVerse > 1) target = verse
      }
      scroll.appendChild(text)
      screen.appendChild(top)
      screen.appendChild(scroll)
      screen.appendChild(el('div', 'fs-bottom'))
      boot.textContent = ''
      boot.appendChild(screen)
      boot.setAttribute('data-first-screen', '')
      boot.removeAttribute('role')
      boot.removeAttribute('aria-label')
      if (target) scroll.scrollTop = Math.max(0, target.offsetTop - 80)
    })
    .catch(function () {})
})(__FIRST_SCREEN_CONFIG__)
/* global __FIRST_SCREEN_CONFIG__:readonly */
