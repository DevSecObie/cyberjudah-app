// index.html shows the lion from the first byte; the app takes it down once its first screen is up.
export const hideBootSplash = () => {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.style.opacity = '0'
  setTimeout(() => boot.remove(), 200)
}
