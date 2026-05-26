<script>
import { links } from '../api.js'
import Icon from '@iconify/svelte'
import { addToast } from '../stores.svelte.js'
import { onSSE } from '../lib/sse.js'
import { onMount } from 'svelte'

let linkList = $state([])
let loading = $state(true)
let showModal = $state(false)
let editingLink = $state(null)
let deleteTarget = $state(null)

let formName = $state('')
let formAvatar = $state('')
let formUrl = $state('')
let formDescription = $state('')
let formOrder = $state(0)

async function loadData(silent = false) {
  if (!silent) loading = true
  try {
    const data = await links.list()
    linkList = data.data ?? data ?? []
  } catch (e) {
    if (!silent) addToast('加载友链失败', 'error')
  } finally {
    if (!silent) loading = false
  }
}

onMount(() => {
  loadData()
  const off = onSSE((data) => {
    if (data.resources.includes('links')) {
      loadData(true)
    }
  })
  return off
})

function openAdd() {
  editingLink = null
  formName = ''
  formAvatar = ''
  formUrl = ''
  formDescription = ''
  formOrder = linkList.length + 1
  showModal = true
}

function openEdit(link) {
  editingLink = link
  formName = link.name || ''
  formAvatar = link.avatar || ''
  formUrl = link.url || ''
  formDescription = link.description || ''
  formOrder = link.sort_order ?? link.order ?? 0
  showModal = true
}

function closeModal() {
  showModal = false
  editingLink = null
}

async function handleSave() {
  if (!formName || !formUrl) { addToast('请填写名称和链接', 'error'); return }
  try {
    const data = { name: formName, avatar: formAvatar, url: formUrl, description: formDescription, sort_order: formOrder }
    if (editingLink) {
      await links.update(editingLink.id || editingLink._id, data)
      addToast('更新成功', 'success')
    } else {
      await links.create(data)
      addToast('创建成功', 'success')
    }
    closeModal()
    loadData()
  } catch (e) {
    addToast(e.message || '保存失败', 'error')
  }
}

async function handleDelete(id) {
  try {
    await links.delete(id)
    addToast('删除成功', 'success')
    deleteTarget = null
    loadData()
  } catch (e) {
    addToast(e.message || '删除失败', 'error')
  }
}

async function moveUp(index) {
  if (index <= 0) return
  const newList = [...linkList]
  const temp = newList[index]
  newList[index] = newList[index - 1]
  newList[index - 1] = temp
  try {
    await links.reorder(newList.map((l, i) => l.id || l._id))
    loadData()
  } catch (e) {
    addToast('排序失败', 'error')
  }
}

async function moveDown(index) {
  if (index >= linkList.length - 1) return
  const newList = [...linkList]
  const temp = newList[index]
  newList[index] = newList[index + 1]
  newList[index + 1] = temp
  try {
    await links.reorder(newList.map((l, i) => l.id || l._id))
    loadData()
  } catch (e) {
    addToast('排序失败', 'error')
  }
}
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">友链管理</h2>
    <button onclick={openAdd} class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 text-white dark:text-gray-900 text-sm font-medium transition-colors">
      + 新建友链
    </button>
  </div>

  <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-white/20 dark:border-gray-700/20 bg-white/40 dark:bg-gray-800/40">
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">名称</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">头像</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">URL</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">描述</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">排序</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/10 dark:divide-gray-700/10">
          {#if loading}
            <tr><td colspan="6" class="px-5 py-8 text-center text-gray-400 dark:text-gray-500">加载中...</td></tr>
          {:else if linkList.length === 0}
            <tr><td colspan="6" class="px-5 py-8 text-center text-gray-400 dark:text-gray-500">暂无友链</td></tr>
          {:else}
            {#each linkList as link, i (link.id || link._id)}
              <tr class="hover:bg-white/30 dark:hover:bg-gray-700/30 transition-colors">
                <td class="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{link.name}</td>
                <td class="px-5 py-3 hidden sm:table-cell">
                  {#if link.avatar}
                    <img src={link.avatar} alt={link.name} class="w-8 h-8 rounded-full object-cover" onerror={(e) => { e.target.style.display = 'none' }} />
                  {:else}
                    <div class="w-8 h-8 rounded-full bg-gray-200/50 dark:bg-gray-700/50"></div>
                  {/if}
                </td>
                <td class="px-5 py-3">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" class="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 truncate block max-w-[150px]">{link.url}</a>
                </td>
                <td class="px-5 py-3 hidden md:table-cell">
                  <span class="text-sm text-gray-500 dark:text-gray-400 truncate block max-w-[150px]">{link.description || '-'}</span>
                </td>
                <td class="px-5 py-3">
                  <div class="flex items-center gap-1">
                    <button onclick={() => moveUp(i)} disabled={i === 0} class="p-1 rounded-full hover:bg-white/40 dark:hover:bg-gray-700/40 disabled:opacity-30 transition-colors">
                      <Icon icon="mdi:chevron-up" width="16" height="16" />
                    </button>
                    <button onclick={() => moveDown(i)} disabled={i === linkList.length - 1} class="p-1 rounded-full hover:bg-white/40 dark:hover:bg-gray-700/40 disabled:opacity-30 transition-colors">
                      <Icon icon="mdi:chevron-down" width="16" height="16" />
                    </button>
                    <span class="text-sm text-gray-500 dark:text-gray-400 ml-1">{link.sort_order ?? link.order ?? i}</span>
                  </div>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button onclick={() => openEdit(link)} class="text-xs px-3 py-1 rounded-full text-gray-900 dark:text-gray-100 hover:bg-gray-50/60 dark:hover:bg-gray-700/60 transition-colors">编辑</button>
                    <button onclick={() => deleteTarget = link} class="text-xs px-3 py-1 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-900/30 transition-colors">删除</button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={closeModal}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4 border border-white/20 dark:border-gray-700/20" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {editingLink ? '编辑友链' : '新建友链'}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
          <input type="text" bind:value={formName} placeholder="站点名称" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">头像 URL</label>
          <input type="text" bind:value={formAvatar} placeholder="https://..." class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">链接</label>
          <input type="text" bind:value={formUrl} placeholder="https://..." class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
          <textarea bind:value={formDescription} placeholder="站点描述" rows="2" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none resize-y"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">排序</label>
          <input type="number" bind:value={formOrder} min="0" class="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button onclick={closeModal} class="px-4 py-2 rounded-full border border-white/30 dark:border-gray-700/30 bg-white/40 dark:bg-gray-800/40 backdrop-blur text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={handleSave} class="px-4 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 text-white dark:text-gray-900 text-sm transition-colors">保存</button>
      </div>
    </div>
  </div>
{/if}

{#if deleteTarget}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => deleteTarget = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4 border border-white/20 dark:border-gray-700/20" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">确认删除</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">确定要删除友链「{deleteTarget.name}」吗？</p>
      <div class="flex justify-end gap-3">
        <button onclick={() => deleteTarget = null} class="px-4 py-2 rounded-full border border-white/30 dark:border-gray-700/30 bg-white/40 dark:bg-gray-800/40 backdrop-blur text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={() => handleDelete(deleteTarget.id || deleteTarget._id)} class="px-4 py-2 rounded-full bg-red-500/70 dark:bg-red-600/70 backdrop-blur hover:bg-red-600/70 dark:hover:bg-red-700/70 text-white dark:text-gray-100 text-sm transition-colors">删除</button>
      </div>
    </div>
  </div>
{/if}
