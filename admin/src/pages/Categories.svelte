<script>
import { categories } from '../api.js'
import { addToast } from '../stores.svelte.js'
import { onMount } from 'svelte'

let categoryList = $state([])
let loading = $state(true)
let showModal = $state(false)
let editingCategory = $state(null)
let deleteTarget = $state(null)

let formName = $state('')
let formSlug = $state('')
let formDescription = $state('')

async function loadData() {
  loading = true
  try {
    const data = await categories.list()
    categoryList = data.data ?? data ?? []
  } catch (e) {
    addToast('加载分类失败', 'error')
  } finally {
    loading = false
  }
}

onMount(() => {
  loadData()
})

function openAdd() {
  editingCategory = null
  formName = ''
  formSlug = ''
  formDescription = ''
  showModal = true
}

function openEdit(cat) {
  editingCategory = cat
  formName = cat.name || ''
  formSlug = cat.slug || ''
  formDescription = cat.description || ''
  showModal = true
}

function closeModal() {
  showModal = false
  editingCategory = null
}

async function handleSave() {
  if (!formName) { addToast('请输入分类名称', 'error'); return }
  try {
    const data = { name: formName, slug: formSlug, description: formDescription }
    if (editingCategory) {
      await categories.update(editingCategory.id || editingCategory._id, data)
      addToast('更新成功', 'success')
    } else {
      await categories.create(data)
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
    await categories.delete(id)
    addToast('删除成功', 'success')
    deleteTarget = null
    loadData()
  } catch (e) {
    addToast(e.message || '删除失败', 'error')
    deleteTarget = null
  }
}
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">分类管理</h2>
    <button onclick={openAdd} class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 text-white dark:text-gray-900 text-sm font-medium transition-colors">
      + 新建分类
    </button>
  </div>

  <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-white/20 dark:border-gray-700/20 bg-white/40 dark:bg-gray-800/40">
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">名称</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Slug</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">描述</th>
            <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">文章数</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/10 dark:divide-gray-700/10">
          {#if loading}
            <tr><td colspan="5" class="px-5 py-8 text-center text-gray-400 dark:text-gray-500">加载中...</td></tr>
          {:else if categoryList.length === 0}
            <tr><td colspan="5" class="px-5 py-8 text-center text-gray-400 dark:text-gray-500">暂无分类</td></tr>
          {:else}
            {#each categoryList as cat}
              <tr class="hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">
                <td class="px-5 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">{cat.name}</td>
                <td class="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{cat.slug || '-'}</td>
                <td class="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell max-w-[200px] truncate">{cat.description || '-'}</td>
                <td class="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{cat.postCount ?? cat.count ?? 0}</td>
                <td class="px-5 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button onclick={() => openEdit(cat)} class="text-xs px-2.5 py-1 rounded-full text-gray-900 dark:text-gray-100 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">
                      编辑
                    </button>
                    <button onclick={() => deleteTarget = cat} class="text-xs px-2.5 py-1 rounded-full text-red-600 dark:text-red-400 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">
                      删除
                    </button>
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
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {editingCategory ? '编辑分类' : '新建分类'}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
          <input type="text" bind:value={formName} placeholder="分类名称" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
          <input type="text" bind:value={formSlug} placeholder="url-friendly-slug" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
          <textarea bind:value={formDescription} placeholder="分类描述" rows="3" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none resize-y"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button onclick={closeModal} class="px-5 py-2 rounded-full border border-white/30 dark:border-gray-700/30 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={handleSave} class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 text-white dark:text-gray-900 text-sm transition-colors">保存</button>
      </div>
    </div>
  </div>
{/if}

{#if deleteTarget}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => deleteTarget = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">确认删除</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">确定要删除分类「{deleteTarget.name}」吗？</p>
      <div class="flex justify-end gap-3">
        <button onclick={() => deleteTarget = null} class="px-5 py-2 rounded-full border border-white/30 dark:border-gray-700/30 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={() => handleDelete(deleteTarget.id || deleteTarget._id)} class="px-5 py-2 rounded-full bg-red-500/80 backdrop-blur hover:bg-red-600/80 text-white text-sm transition-colors">删除</button>
      </div>
    </div>
  </div>
{/if}
