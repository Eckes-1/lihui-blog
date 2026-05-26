let token = $state(typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || null) : null)

function safeParseJSON(str, fallback = null) {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

let user = $state(
  typeof localStorage !== 'undefined'
    ? safeParseJSON(localStorage.getItem('user') || 'null')
    : null
)

let sidebarCollapsed = $state(typeof window !== 'undefined' && window.innerWidth < 768)
let toasts = $state([])

let toastId = 0
let toastTimers = []

let themeMode = $state(typeof localStorage !== 'undefined' ? (localStorage.getItem('admin-theme') || 'system') : 'system')

function applyTheme(mode) {
  if (typeof document === 'undefined') return
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

if (typeof window !== 'undefined') {
  applyTheme(themeMode)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode === 'system') applyTheme('system')
  })
}

export function getThemeMode() { return themeMode }
export function setThemeMode(mode) {
  themeMode = mode
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('admin-theme', mode)
  }
  applyTheme(mode)
}
export function isDarkMode() {
  if (typeof window === 'undefined') return false
  return themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function getToken() { return token }
export function setToken(t) {
  token = t
  if (typeof localStorage !== 'undefined') {
    if (t) localStorage.setItem('token', t)
    else localStorage.removeItem('token')
  }
}
export function getUser() { return user }
export function setUser(u) {
  user = u
  if (typeof localStorage !== 'undefined') {
    if (u) localStorage.setItem('user', JSON.stringify(u))
    else localStorage.removeItem('user')
  }
}
export function getSidebarCollapsed() { return sidebarCollapsed }
export function setSidebarCollapsed(v) { sidebarCollapsed = v }
export function toggleSidebar() { sidebarCollapsed = !sidebarCollapsed }

export function getToasts() { return toasts }
export function addToast(message, type = 'info') {
  const id = ++toastId
  toasts = [...toasts, { id, message, type }]
  const timer = setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    toastTimers = toastTimers.filter(t => t.id !== id)
  }, 3000)
  toastTimers.push({ id, timer })
}
export function removeToast(id) {
  toasts = toasts.filter(t => t.id !== id)
  const entry = toastTimers.find(t => t.id === id)
  if (entry) {
    clearTimeout(entry.timer)
    toastTimers = toastTimers.filter(t => t.id !== id)
  }
}

export function logout() {
  setToken(null)
  setUser(null)
  if (typeof location !== 'undefined') {
    location.hash = '#/login'
  }
}
