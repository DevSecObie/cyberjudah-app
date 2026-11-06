// index.html shows the lion from the first byte; the app takes it down once its first screen is up.
// When index.html drew the opening chapter instead (scripts/web-first-screen.js), that stays up
// until the app's own verses are on screen, so the text never blinks out in between.
const APP_VERSES = '[data-verse-text]'
const FIRST_SCREEN_WAIT_MS = 15000

export const hideBootSplash = () => {
  const boot = document.getElementById('boot')
  if (!boot) return
  const fade = () => {
    boot.style.opacity = '0'
    setTimeout(() => boot.remove(), 200)
  }
  const root = document.getElementById('root')
  if (!boot.hasAttribute('data-first-screen') || !root || root.querySelector(APP_VERSES)) {
    fade()
    return
  }
  const done = () => {
    observer.disconnect()
    clearTimeout(timer)
    requestAnimationFrame(fade)
  }
  const observer = new MutationObserver(() => {
    if (root.querySelector(APP_VERSES)) done()
  })
  const timer = setTimeout(done, FIRST_SCREEN_WAIT_MS)
  observer.observe(root, { childList: true, subtree: true })
}
