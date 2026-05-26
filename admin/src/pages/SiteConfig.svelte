<script>
import { config } from '../api.js'
import { addToast } from '../stores.svelte.js'
import { onMount } from 'svelte'

let siteConfig = $state({})
let loading = $state(true)
let saving = $state(false)

let siteInfo = $state({ title: '', subTitle: '', favicon: '', pageSize: 10 })
let tocSettings = $state({ enable: true, depth: 3 })
let blogNavi = $state({ enable: true })
let commentSettings = $state({ enable: true, platform: '', backendUrl: '' })
let licenseSettings = $state({ enable: false, name: '', url: '' })

async function loadConfig() {
  loading = true
  try {
    const data = await config.getAll()
    siteConfig = data
    siteInfo = {
      title: data.site?.title || '',
      subTitle: data.site?.subTitle || '',
      favicon: data.site?.favicon || '',
      pageSize: data.site?.pageSize ? parseInt(data.site.pageSize) : 10,
    }
    tocSettings = {
      enable: data.toc?.enable === 'true',
      depth: parseInt(data.toc?.depth) || 3,
    }
    blogNavi = {
      enable: data.blogNavi?.enable === 'true',
    }
    commentSettings = {
      enable: data.comments?.enable === 'true',
      platform: data.comments?.platform || '',
      backendUrl: data.comments?.backendUrl || '',
    }
    licenseSettings = {
      enable: data.license?.enable === 'true',
      name: data.license?.name || '',
      url: data.license?.url || '',
    }
  } catch (e) {
    addToast('加载配置失败', 'error')
  } finally {
    loading = false
  }
}

onMount(() => {
  loadConfig()
})

async function handleSave() {
  saving = true
  try {
    const data = {
      site: siteInfo,
      toc: tocSettings,
      blogNavi,
      comments: commentSettings,
      license: licenseSettings,
    }
    await config.updateAll(data)
    addToast('保存成功', 'success')
  } catch (e) {
    addToast(e.message || '保存失败', 'error')
  } finally {
    saving = false
  }
}

async function handleSaveSection(section) {
  saving = true
  try {
    const data = {
      site: siteInfo,
      toc: tocSettings,
      blogNavi,
      comments: commentSettings,
      license: licenseSettings,
    }
    await config.updateAll(data)
    addToast('保存成功', 'success')
  } catch (e) {
    addToast(e.message || '保存失败', 'error')
  } finally {
    saving = false
  }
}
</script>

{#if loading}
  <div class="flex items-center justify-center h-64">
    <div class="text-gray-400 dark:text-gray-500">加载中...</div>
  </div>
{:else}
  <div class="space-y-6 max-w-3xl">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">站点配置</h2>
      <button onclick={handleSave} disabled={saving} class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 disabled:bg-gray-600/70 dark:disabled:bg-gray-500/70 text-white dark:text-gray-900 text-sm font-medium transition-colors">
        {saving ? '保存中...' : '全部保存'}
      </button>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">站点信息</h3>
        <button onclick={() => handleSaveSection('site')} class="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">保存</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">站点标题</label>
          <input type="text" bind:value={siteInfo.title} class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">副标题</label>
          <input type="text" bind:value={siteInfo.subTitle} class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Favicon 路径</label>
          <input type="text" bind:value={siteInfo.favicon} placeholder="/favicon/favicon.ico" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">每页文章数</label>
          <input type="number" bind:value={siteInfo.pageSize} min="1" max="50" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
      </div>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">目录设置</h3>
        <button onclick={() => handleSaveSection('toc')} class="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">保存</button>
      </div>
      <div class="space-y-3">
        <label class="flex items-center gap-3">
          <button onclick={() => tocSettings.enable = !tocSettings.enable} class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {tocSettings.enable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {tocSettings.enable ? 'translate-x-6' : 'translate-x-1'}"></span>
          </button>
          <span class="text-sm text-gray-700 dark:text-gray-300">启用目录</span>
        </label>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目录深度</label>
          <input type="number" bind:value={tocSettings.depth} min="1" max="6" class="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
      </div>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">博客导航</h3>
        <button onclick={() => handleSaveSection('navi')} class="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">保存</button>
      </div>
      <label class="flex items-center gap-3">
        <button onclick={() => blogNavi.enable = !blogNavi.enable} class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {blogNavi.enable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}">
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {blogNavi.enable ? 'translate-x-6' : 'translate-x-1'}"></span>
        </button>
        <span class="text-sm text-gray-700 dark:text-gray-300">启用博客导航</span>
      </label>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">评论设置</h3>
        <button onclick={() => handleSaveSection('comments')} class="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">保存</button>
      </div>
      <div class="space-y-3">
        <label class="flex items-center gap-3">
          <button onclick={() => commentSettings.enable = !commentSettings.enable} class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {commentSettings.enable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {commentSettings.enable ? 'translate-x-6' : 'translate-x-1'}"></span>
          </button>
          <span class="text-sm text-gray-700 dark:text-gray-300">启用评论</span>
        </label>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">评论平台</label>
          <input type="text" bind:value={commentSettings.platform} placeholder="如：waline, disqus" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">后端地址</label>
          <input type="text" bind:value={commentSettings.backendUrl} placeholder="https://..." class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
      </div>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">许可证</h3>
        <button onclick={() => handleSaveSection('license')} class="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">保存</button>
      </div>
      <div class="space-y-3">
        <label class="flex items-center gap-3">
          <button onclick={() => licenseSettings.enable = !licenseSettings.enable} class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {licenseSettings.enable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {licenseSettings.enable ? 'translate-x-6' : 'translate-x-1'}"></span>
          </button>
          <span class="text-sm text-gray-700 dark:text-gray-300">启用许可证</span>
        </label>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">许可证名称</label>
          <input type="text" bind:value={licenseSettings.name} placeholder="如：CC BY-NC-SA 4.0" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">许可证链接</label>
          <input type="text" bind:value={licenseSettings.url} placeholder="https://..." class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
      </div>
    </div>
  </div>
{/if}
