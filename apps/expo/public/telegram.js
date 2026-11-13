// The web app opened as a Telegram Mini App. index.html loads Telegram's script and this file
// only when Telegram started the page (its launch data is in the address or was kept for this
// tab), so visitors on the open web load neither. Nothing here changes the app's screens: it
// fills Telegram's window, matches Telegram's bar to the app's colors, makes Telegram's own Back
// button go back in the app, and keeps the app clear of the phone's edges.
;(function () {
  var app = window.Telegram && window.Telegram.WebApp
  if (!app || !app.initData) return
  var root = document.documentElement
  root.classList.add('tg')

  function call(name) {
    try {
      if (typeof app[name] === 'function') app[name].apply(app, [].slice.call(arguments, 1))
    } catch (e) {}
  }
  var supports = function (version) {
    try {
      return app.isVersionAtLeast(version)
    } catch (e) {
      return false
    }
  }

  call('ready')
  call('expand')
  // Scrolling a chapter down must not pull the whole app closed.
  if (supports('7.7')) call('disableVerticalSwipes')

  // Telegram's bar and the area under the app take the color of the screen showing.
  var lastColor = ''
  function paint() {
    var el = document.elementFromPoint(Math.floor(window.innerWidth / 2), 4)
    var color = ''
    while (el && el !== root) {
      var bg = getComputedStyle(el).backgroundColor
      if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) {
        color = bg
        break
      }
      el = el.parentElement
    }
    var m = color.match(/\d+/g)
    if (!m || m.length < 3) return
    var hex =
      '#' +
      m
        .slice(0, 3)
        .map(function (n) {
          return ('0' + Number(n).toString(16)).slice(-2)
        })
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

  // Telegram's Back button: shown away from the first screen, it goes back one screen.
  var home = { '/': 1, '/home': 1 }
  var depth = 0
  function route() {
    var away = !home[location.pathname]
    try {
      if (away || depth > 0) app.BackButton.show()
      else app.BackButton.hide()
    } catch (e) {}
    setTimeout(paint, 300)
  }
  try {
    app.BackButton.onClick(function () {
      if (depth > 0) history.back()
      else location.replace('/home')
    })
  } catch (e) {}
  ;['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name]
    history[name] = function () {
      var result = original.apply(this, arguments)
      if (name === 'pushState') depth++
      route()
      return result
    }
  })
  window.addEventListener('popstate', function () {
    if (depth > 0) depth--
    route()
  })
  if (window.matchMedia) {
    var dark = window.matchMedia('(prefers-color-scheme: dark)')
    if (dark.addEventListener)
      dark.addEventListener('change', function () {
        setTimeout(paint, 300)
      })
  }
  try {
    app.onEvent('themeChanged', function () {
      setTimeout(paint, 300)
    })
  } catch (e) {}
  // The app draws its first screen a moment after this runs.
  route()
  setTimeout(paint, 1500)
  setTimeout(paint, 4000)
})()
