// The web app opened as a Telegram Mini App. index.html loads Telegram's script and this file
// only when Telegram started the page (its launch data is in the address or was kept for this
// tab), so visitors on the open web load neither. Nothing here changes the app's screens: it
// fills Telegram's window, matches Telegram's bar to the app's colors, makes Telegram's own Back
// button go back in the app, and keeps the app clear of the phone's edges.
;(() => {
  const app = window.Telegram && window.Telegram.WebApp
  if (!app || !app.initData) return
  const root = document.documentElement
  root.classList.add('tg')

  const call = (name, ...args) => {
    try {
      if (typeof app[name] === 'function') app[name](...args)
    } catch {
      // An older Telegram without this call keeps its default.
    }
  }
  const supports = version => {
    try {
      return app.isVersionAtLeast(version)
    } catch {
      return false
    }
  }

  call('ready')
  call('expand')
  // Scrolling a chapter down must not pull the whole app closed.
  if (supports('7.7')) call('disableVerticalSwipes')

  // Telegram's bar and the area under the app take the color of the screen showing.
  let lastColor = ''
  const paint = () => {
    let el = document.elementFromPoint(Math.floor(window.innerWidth / 2), 4)
    let color = ''
    while (el && el !== root) {
      const bg = getComputedStyle(el).backgroundColor
      if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) {
        color = bg
        break
      }
      el = el.parentElement
    }
    const m = color.match(/\d+/g)
    if (!m || m.length < 3) return
    const hex =
      '#' +
      m
        .slice(0, 3)
        .map(n => ('0' + Number(n).toString(16)).slice(-2))
        .join('')
    if (hex === lastColor) return
    lastColor = hex
    // The strip Telegram keeps clear at the bottom edge shows the same color.
    document.body.style.backgroundColor = hex
    if (supports('6.1')) {
      call('setHeaderColor', hex)
      call('setBackgroundColor', hex)
    }
    if (supports('7.10')) call('setBottomBarColor', hex)
  }
  const repaint = () => setTimeout(paint, 300)

  // Telegram's Back button: shown away from the first screen, it goes back one screen.
  const home = new Set(['/', '/home'])
  let depth = 0
  const route = () => {
    try {
      if (!home.has(location.pathname) || depth > 0) app.BackButton.show()
      else app.BackButton.hide()
    } catch {
      // No Back button in this Telegram.
    }
    repaint()
  }
  try {
    app.BackButton.onClick(() => {
      if (depth > 0) history.back()
      else location.replace('/home')
    })
  } catch {
    // No Back button in this Telegram.
  }
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name]
    history[name] = function (...args) {
      const result = original.apply(this, args)
      if (name === 'pushState') depth++
      route()
      return result
    }
  }
  window.addEventListener('popstate', () => {
    if (depth > 0) depth--
    route()
  })
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', repaint)
  try {
    app.onEvent('themeChanged', repaint)
  } catch {
    // Telegram without theme events.
  }
  // The app draws its first screen a moment after this runs.
  route()
  setTimeout(paint, 1500)
  setTimeout(paint, 4000)
})()
