<script>
import { logout, toggleSidebar } from '../stores.svelte.js'
import { stopSessionMonitor } from '../api.js'
import Icon from '@iconify/svelte'

let { collapsed, currentRoute = '/', mobile = false } = $props()

const navItems = [
  { icon: 'mdi:chart-bar', label: '仪表盘', hash: '#/' },
  { icon: 'mdi:pencil-outline', label: '文章管理', hash: '#/posts' },
  { icon: 'mdi:folder-outline', label: '分类管理', hash: '#/categories' },
  { icon: 'mdi:comment-outline', label: '评论管理', hash: '#/comments' },
  { icon: 'mdi:link-variant', label: '友链管理', hash: '#/links' },
  { icon: 'mdi:image-outline', label: '媒体库', hash: '#/media' },
  { icon: 'mdi:cog-outline', label: '站点配置', hash: '#/config' },
  { icon: 'mdi:email-outline', label: '邮件设置', hash: '#/email' },
  { icon: 'mdi:palette-outline', label: '主题设置', hash: '#/theme' },
  { icon: 'mdi:account-outline', label: '个人资料', hash: '#/profile' },
]

let showFrontendModal = $state(false)

function openFrontendModal() {
  showFrontendModal = true
}
function goToFrontendCurrent() {
  showFrontendModal = false
  window.location.href = '/'
}
function goToFrontendNewTab() {
  showFrontendModal = false
  window.open('/', '_blank', 'noopener,noreferrer')
}
function closeFrontendModal() {
  showFrontendModal = false
}
function isActive(hash) {
  const route = hash.replace('#', '') || '/'
  if (route === '/') return currentRoute === '/'
  return currentRoute === route || currentRoute.startsWith(route + '/')
}
function handleLogout() {
  stopSessionMonitor()
  logout()
}
function handleNavClick() {
  if (mobile) toggleSidebar()
}
</script>

<aside
  class="h-screen w-64 flex flex-col transition-all duration-300 bg-white/60 dark:bg-gray-900/60 backdrop-blur-2xl shrink-0 border-r border-gray-100 dark:border-gray-800/50"
  class:w-16={collapsed}
>
  <div class="flex items-center justify-between h-16 px-4">
    <span class="text-xl font-bold tracking-wider">
      {#if collapsed}
        <span class="text-gray-900 dark:text-gray-100">L</span>
      {:else}
        <span class="text-gray-900 dark:text-gray-100">LiHui</span>
        <span class="text-gray-400 dark:text-gray-500 ml-1 text-sm font-normal">管理后台</span>
      {/if}
    </span>
    {#if mobile && !collapsed}
      <button onclick={toggleSidebar} class="p-1 rounded-full hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors text-gray-500 dark:text-gray-400" aria-label="关闭侧边栏">
        <Icon icon="mdi:close" width="20" height="20" />
      </button>
    {/if}
  </div>

  <nav class="flex-1 py-4 overflow-y-auto">
    {#each navItems as item}
      <a
        href={item.hash}
        onclick={handleNavClick}
        class="flex items-center px-3 py-2.5 mx-2 rounded-xl transition-all duration-200 {isActive(item.hash)
          ? 'bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
          : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'}"
      >
        <span class="shrink-0"><Icon icon={item.icon} width="20" height="20" /></span>
        {#if !collapsed}
          <span class="ml-3 text-sm font-medium">{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <div class="p-2">
    <button
      onclick={openFrontendModal}
      class="flex items-center w-full px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200"
    >
      <span class="shrink-0"><Icon icon="mdi:open-in-new" width="20" height="20" /></span>
      {#if !collapsed}
        <span class="ml-3 text-sm font-medium">返回前台</span>
      {/if}
    </button>
    <button
      onclick={handleLogout}
      class="flex items-center w-full px-3 py-2.5 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors duration-200"
    >
      <span class="shrink-0"><Icon icon="mdi:logout" width="20" height="20" /></span>
      {#if !collapsed}
        <span class="ml-3 text-sm font-medium">退出登录</span>
      {/if}
    </button>
  </div>
</aside>

{#if showFrontendModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" onclick={closeFrontendModal}></div>
    <div class="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/50 dark:border-gray-700/50 p-6 w-80 mx-4">
      <h3 class="text-gray-900 dark:text-gray-100 text-lg font-semibold mb-4">返回前台</h3>
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">请选择打开方式</p>
      <div class="flex flex-col gap-3">
        <button
          onclick={goToFrontendCurrent}
          class="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-white/60 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors duration-200"
        >
          <Icon icon="mdi:arrow-left" width="20" height="20" />
          <div class="text-left">
            <div class="text-sm font-medium">当前窗口跳转</div>
            <div class="text-xs text-gray-400 dark:text-gray-500">离开后台，在当前标签页打开前台</div>
          </div>
        </button>
        <button
          onclick={goToFrontendNewTab}
          class="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-white/40 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors duration-200"
        >
          <Icon icon="mdi:open-in-new" width="20" height="20" />
          <div class="text-left">
            <div class="text-sm font-medium">新标签页打开</div>
            <div class="text-xs text-gray-400 dark:text-gray-500">保留后台，在新标签页打开前台</div>
          </div>
        </button>
      </div>
      <button
        onclick={closeFrontendModal}
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="关闭"
      >
        <Icon icon="mdi:close" width="18" height="18" />
      </button>
    </div>
  </div>
{/if}
