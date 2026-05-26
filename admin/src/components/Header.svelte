<script>
import Icon from '@iconify/svelte'
import { toggleSidebar, getUser, getThemeMode, setThemeMode } from '../stores.svelte.js'
import { getSessionInfo } from '../api.js'
import { onMount } from 'svelte'

let { route } = $props()
let showUserMenu = $state(false)
let sessionTimeLeft = $state('')
let sessionWarning = $state(false)
let showThemeMenu = $state(false)

const pageTitles = {
  '/': '仪表盘',
  '/posts': '文章管理',
  '/posts/new': '新建文章',
  '/categories': '分类管理',
  '/comments': '评论管理',
  '/links': '友链管理',
  '/media': '媒体库',
  '/config': '站点配置',
  '/email': '邮件设置',
  '/theme': '主题设置',
  '/profile': '个人资料',
}

let title = $derived(pageTitles[route] || (route.match(/^\/posts\/[^/]+\/edit$/) ? '编辑文章' : '管理后台'))
let user = $derived(getUser())
let currentTheme = $derived(getThemeMode())

function formatTimeLeft(ms) {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

let timerInterval = null

onMount(() => {
  function closeMenu(e) {
    if (!e.target.closest('.user-menu-container')) {
      showUserMenu = false
    }
    if (!e.target.closest('.theme-menu-container')) {
      showThemeMenu = false
    }
  }
  document.addEventListener('click', closeMenu)

  timerInterval = setInterval(() => {
    const info = getSessionInfo()
    if (info.timeLeft > 0) {
      sessionTimeLeft = formatTimeLeft(info.timeLeft)
      sessionWarning = info.isExpiringSoon
    } else {
      sessionTimeLeft = ''
      sessionWarning = false
    }
  }, 1000)

  return () => {
    document.removeEventListener('click', closeMenu)
    if (timerInterval) clearInterval(timerInterval)
  }
})

const themeOptions = [
  { key: 'light', icon: 'mdi:white-balance-sunny', label: '浅色' },
  { key: 'dark', icon: 'mdi:moon-waning-crescent', label: '深色' },
  { key: 'system', icon: 'mdi:monitor', label: '跟随系统' },
]

function getThemeIcon() {
  if (currentTheme === 'dark') return 'mdi:moon-waning-crescent'
  if (currentTheme === 'light') return 'mdi:white-balance-sunny'
  return 'mdi:monitor'
}
</script>

<header class="h-16 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl shrink-0 overflow-visible border-b border-gray-100 dark:border-gray-800/50">
  <div class="flex items-center gap-3">
    <button
      onclick={toggleSidebar}
      class="p-2 rounded-full hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors md:hidden text-gray-600 dark:text-gray-400"
    >
      <Icon icon="mdi:menu" width="20" height="20" />
    </button>
    <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
  </div>

  <div class="flex items-center gap-3">
    {#if sessionTimeLeft}
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium {sessionWarning ? 'bg-amber-50/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800' : 'bg-gray-100/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400'}">
        <Icon icon={sessionWarning ? 'mdi:clock-alert-outline' : 'mdi:clock-outline'} width="14" height="14" />
        <span>{sessionTimeLeft}</span>
      </div>
    {/if}

    <div class="relative theme-menu-container">
      <button
        onclick={() => { showThemeMenu = !showThemeMenu; showUserMenu = false }}
        class="p-2 rounded-full hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors text-gray-500 dark:text-gray-400"
        title="主题切换"
      >
        <Icon icon={getThemeIcon()} width="18" height="18" />
      </button>

      {#if showThemeMenu}
        <div class="absolute right-0 top-full mt-2 w-36 bg-white/90 dark:bg-gray-800/90 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/50 dark:border-gray-700/50 py-1.5 z-50">
          {#each themeOptions as opt}
            <button
              onclick={() => { setThemeMode(opt.key); showThemeMenu = false }}
              class="flex items-center gap-2 px-3 py-2 text-sm w-full text-left transition-colors {currentTheme === opt.key ? 'text-gray-900 dark:text-white bg-gray-100/60 dark:bg-gray-700/60' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/40'}"
            >
              <Icon icon={opt.icon} width="16" height="16" />
              {opt.label}
              {#if currentTheme === opt.key}
                <Icon icon="mdi:check" width="14" height="14" class="ml-auto text-blue-500" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="relative user-menu-container">
      <button
        onclick={() => { showUserMenu = !showUserMenu; showThemeMenu = false }}
        class="flex items-center gap-2 p-2 rounded-full hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div class="w-8 h-8 rounded-full bg-gray-800 dark:bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
          {user?.username?.charAt(0)?.toUpperCase() || 'A'}
        </div>
        <span class="hidden md:block text-sm text-gray-700 dark:text-gray-300">{user?.username || '管理员'}</span>
      </button>

      {#if showUserMenu}
        <div class="absolute right-0 top-full mt-2 w-48 bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/50 dark:border-gray-700/50 py-2 z-50">
          <a href="#/profile" class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 rounded-xl mx-1 transition-colors whitespace-nowrap" onclick={() => showUserMenu = false}>
            <Icon icon="mdi:account-outline" width="16" height="16" />
            个人资料
          </a>
        </div>
      {/if}
    </div>
  </div>
</header>
