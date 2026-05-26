<script>
import { config } from '../api.js'
import { addToast } from '../stores.svelte.js'
import { onMount } from 'svelte'

let loading = $state(true)
let saving = $state(false)
let loadError = $state(false)

let aosEnable = $state(false)
let lqipEnable = $state(false)
let photoSwipeEnable = $state(false)

async function loadConfig() {
  loading = true
  loadError = false
  try {
    const data = await config.getAll()
    aosEnable = data.theme?.AOS === 'true'
    lqipEnable = data.theme?.LQIP === 'true'
    photoSwipeEnable = data.theme?.PhotoSwipe === 'true'
  } catch (e) {
    addToast('加载配置失败', 'error')
    loadError = true
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
    await config.updateAll({
      theme: { AOS: String(aosEnable), LQIP: String(lqipEnable), PhotoSwipe: String(photoSwipeEnable) },
    })
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
  <div class="space-y-6 max-w-2xl">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">主题设置</h2>
      <button onclick={handleSave} disabled={saving} class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 disabled:bg-gray-600/70 dark:disabled:bg-gray-500/70 text-white dark:text-gray-900 text-sm font-medium transition-colors">
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">AOS 动画</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">启用页面元素的滚动动画效果，让页面更具动态感</p>
        </div>
        <button
          onclick={() => aosEnable = !aosEnable}
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {aosEnable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {aosEnable ? 'translate-x-6' : 'translate-x-1'}"></span>
        </button>
      </div>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">LQIP 低质量图片占位符</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">在图片加载完成前显示低质量占位图，提升用户感知加载速度</p>
        </div>
        <button
          onclick={() => lqipEnable = !lqipEnable}
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {lqipEnable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {lqipEnable ? 'translate-x-6' : 'translate-x-1'}"></span>
        </button>
      </div>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">PhotoSwipe 图片查看器</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">启用图片灯箱效果，点击图片可放大查看并滑动浏览</p>
        </div>
        <button
          onclick={() => photoSwipeEnable = !photoSwipeEnable}
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {photoSwipeEnable ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {photoSwipeEnable ? 'translate-x-6' : 'translate-x-1'}"></span>
        </button>
      </div>
    </div>
  </div>
{/if}
