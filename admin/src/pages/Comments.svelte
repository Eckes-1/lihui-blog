<script>
import { comments } from '../api.js'
import Icon from '@iconify/svelte'
import { addToast } from '../stores.svelte.js'
import { onSSE } from '../lib/sse.js'
import { onMount } from 'svelte'

let commentList = $state([])
let loading = $state(true)
let search = $state('')
let filterStatus = $state('')
let sortOrder = $state('desc')
let startDate = $state('')
let endDate = $state('')
let page = $state(1)
let totalPages = $state(1)
let pageSize = $state(10)
let totalComments = $state(0)
let deleteTarget = $state(null)
let permanentDeleteTarget = $state(null)
let replyingTo = $state(null)
let replyContent = $state('')
let replyEmail = $state('')
let selectedIds = $state(new Set())
let selectAll = $state(false)
let showBatchBar = $state(false)
let showDateFilter = $state(false)
let viewMode = $state('card')
let jumpModalComment = $state(null)
let searchTimer = null

let expandedReplies = $state(new Set())

function toggleReplies(commentId) {
  const s = new Set(expandedReplies)
  if (s.has(commentId)) s.delete(commentId)
  else s.add(commentId)
  expandedReplies = s
}

let stats = $state({ total: 0, approved: 0, pending: 0, rejected: 0, deleted: 0, today: 0 })

let detailTarget = $state(null)
let editTarget = $state(null)
let editContent = $state('')

async function loadData(silent = false) {
  if (!silent) loading = true
  try {
    const params = { page, pageSize, sort: sortOrder }
    if (filterStatus) params.status = filterStatus
    if (search.trim()) params.search = search.trim()
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const res = await comments.list(params)
    const data = res.data || res
    commentList = data.comments ?? []
    const pag = data.pagination || {}
    totalPages = pag.totalPage || Math.ceil((pag.total || commentList.length) / pageSize) || 1
    totalComments = pag.total || 0
    if (data.stats) {
      stats = data.stats
    }
  } catch (e) {
    if (!silent) addToast('加载评论失败', 'error')
  } finally {
    if (!silent) loading = false
  }
}

async function loadStats() {
  try {
    const res = await comments.stats()
    stats = res.data || res
  } catch (e) {}
}

onMount(() => {
  loadData()
  loadStats()
  const off = onSSE((data) => {
    if (data.resources.includes('comments') || data.resources.includes('pendingComments')) {
      loadData(true)
      loadStats()
    }
  })
  return off
})

function handleSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page = 1
    loadData()
  }, 400)
}

function handleDateFilter() {
  page = 1
  loadData()
}

function clearDateFilter() {
  startDate = ''
  endDate = ''
  page = 1
  loadData()
}

function handleExport() {
  const url = comments.exportCsv(filterStatus)
  const link = document.createElement('a')
  link.href = url
  link.download = 'comments_export.csv'
  link.click()
  addToast('正在导出...', 'success')
}

async function handleUpdateStatus(comment, status) {
  try {
    await comments.updateStatus(comment.id, status)
    addToast(status === 'approved' ? '已通过' : '已拒绝', 'success')
    loadData()
    loadStats()
  } catch (e) {
    addToast(e.message || '操作失败', 'error')
  }
}

async function handleDelete(id) {
  try {
    await comments.delete(id)
    addToast('已移至回收站', 'success')
    deleteTarget = null
    selectedIds.delete(id)
    loadData()
    loadStats()
  } catch (e) {
    addToast(e.message || '删除失败', 'error')
    deleteTarget = null
  }
}

async function handleRestore(id) {
  try {
    await comments.restore(id)
    addToast('已恢复', 'success')
    loadData()
    loadStats()
  } catch (e) {
    addToast(e.message || '恢复失败', 'error')
  }
}

async function handlePermanentDelete(id) {
  try {
    await comments.permanentDelete(id)
    addToast('已彻底删除', 'success')
    permanentDeleteTarget = null
    loadData()
    loadStats()
  } catch (e) {
    addToast(e.message || '彻底删除失败', 'error')
    permanentDeleteTarget = null
  }
}

async function handleReply(id) {
  if (!replyContent.trim()) { addToast('请输入回复内容', 'error'); return }
  try {
    await comments.reply(id, replyContent, replyEmail)
    addToast('回复成功', 'success')
    replyingTo = null
    replyContent = ''
    replyEmail = ''
    loadData()
    loadStats()
  } catch (e) {
    addToast(e.message || '回复失败', 'error')
  }
}

async function handleBatch(action) {
  if (selectedIds.size === 0) { addToast('请先选择评论', 'warning'); return }
  try {
    const res = await comments.batch([...selectedIds], action)
    addToast(res.message || '操作成功', 'success')
    selectedIds = new Set()
    selectAll = false
    showBatchBar = false
    loadData()
    loadStats()
  } catch (e) {
    addToast(e.message || '操作失败', 'error')
  }
}

async function handleEditSave() {
  if (!editContent.trim()) { addToast('内容不能为空', 'error'); return }
  try {
    await comments.update(editTarget.id, { content: editContent })
    addToast('修改成功', 'success')
    editTarget = null
    editContent = ''
    loadData()
  } catch (e) {
    addToast(e.message || '修改失败', 'error')
  }
}

function toggleSelect(id) {
  const newSet = new Set(selectedIds)
  if (newSet.has(id)) newSet.delete(id)
  else newSet.add(id)
  selectedIds = newSet
  showBatchBar = newSet.size > 0
  selectAll = commentList.length > 0 && newSet.size === commentList.length
}

function toggleSelectAll() {
  if (selectAll) {
    selectedIds = new Set()
    selectAll = false
    showBatchBar = false
  } else {
    selectedIds = new Set(commentList.map(c => c.id))
    selectAll = true
    showBatchBar = true
  }
}

function formatDate(date) {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getRelativeTime(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d2 = Math.floor(h / 24)
  if (d2 < 30) return `${d2}天前`
  return formatDate(date)
}

function getStatus(comment) {
  if (comment.deleted) return 'deleted'
  return comment.status || 'pending'
}

function getStatusLabel(status) {
  if (status === 'approved') return '已通过'
  if (status === 'pending') return '待审核'
  if (status === 'rejected') return '已拒绝'
  if (status === 'deleted') return '已删除'
  return '待审核'
}

function getStatusClass(status) {
  if (status === 'approved') return 'bg-green-50/80 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (status === 'rejected') return 'bg-red-50/80 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (status === 'deleted') return 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
  return 'bg-amber-50/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
}
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-2">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">评论管理</h2>
    <div class="flex items-center gap-2 flex-wrap">
      <div class="relative">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input
          type="text"
          placeholder="搜索评论..."
          bind:value={search}
          oninput={handleSearchInput}
          class="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent w-40"
        />
      </div>
      <div class="flex rounded-full border border-gray-200 dark:border-gray-700 overflow-hidden bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl">
        <button
          onclick={() => viewMode = 'card'}
          class="px-3 py-1.5 text-xs font-medium transition-colors rounded-full {viewMode === 'card' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}"
        >
          卡片
        </button>
        <button
          onclick={() => viewMode = 'table'}
          class="px-3 py-1.5 text-xs font-medium transition-colors rounded-full {viewMode === 'table' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}"
        >
          表格
        </button>
      </div>
      <button
        onclick={() => showDateFilter = !showDateFilter}
        class="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 backdrop-blur text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors {showDateFilter || startDate || endDate ? 'ring-2 ring-gray-300 dark:ring-gray-600' : ''}"
      >
        日期
      </button>
      <span class="px-2 py-1 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 backdrop-blur text-green-600 dark:text-green-400">
        ● 自动刷新
      </span>
      <button
        onclick={handleExport}
        class="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 backdrop-blur text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
      >
        导出
      </button>
    </div>
  </div>

  {#if showDateFilter}
    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-3 flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">开始日期</label>
        <input type="date" bind:value={startDate} onchange={handleDateFilter} class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">结束日期</label>
        <input type="date" bind:value={endDate} onchange={handleDateFilter} class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500" />
      </div>
      <button onclick={clearDateFilter} class="px-3 py-1.5 rounded-full text-xs border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">
        清除
      </button>
    </div>
  {/if}

  <div class="flex gap-3 overflow-x-auto pb-1">
    <button onclick={() => { filterStatus = ''; page = 1; loadData() }} class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border p-3 min-w-[100px] flex-1 text-left transition-colors shadow-[0_8px_32px_rgba(0,0,0,0.06)] {filterStatus === '' ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}">
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">全部评论</p>
      <p class="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
    </button>
    <button onclick={() => { filterStatus = 'approved'; page = 1; loadData() }} class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border p-3 min-w-[100px] flex-1 text-left transition-colors shadow-[0_8px_32px_rgba(0,0,0,0.06)] {filterStatus === 'approved' ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}">
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">已通过</p>
      <p class="text-xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
    </button>
    <button onclick={() => { filterStatus = 'pending'; page = 1; loadData() }} class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border p-3 min-w-[100px] flex-1 text-left transition-colors shadow-[0_8px_32px_rgba(0,0,0,0.06)] {filterStatus === 'pending' ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}">
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">待审核</p>
      <p class="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
    </button>
    <button onclick={() => { filterStatus = 'rejected'; page = 1; loadData() }} class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border p-3 min-w-[100px] flex-1 text-left transition-colors shadow-[0_8px_32px_rgba(0,0,0,0.06)] {filterStatus === 'rejected' ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}">
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">已拒绝</p>
      <p class="text-xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
    </button>
    <button onclick={() => { filterStatus = 'deleted'; page = 1; loadData() }} class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border p-3 min-w-[100px] flex-1 text-left transition-colors shadow-[0_8px_32px_rgba(0,0,0,0.06)] {filterStatus === 'deleted' ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700/50' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}">
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">已删除</p>
      <p class="text-xl font-bold text-gray-500 dark:text-gray-400">{stats.deleted || 0}</p>
    </button>
    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 p-3 min-w-[100px] flex-1 text-left shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">今日新增</p>
      <p class="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.today || 0}</p>
    </div>
  </div>

  <div class="flex items-center justify-between gap-2 flex-wrap">
    <div class="flex items-center gap-1 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 p-1 overflow-x-auto">
      <button onclick={() => { filterStatus = ''; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {filterStatus === '' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        全部
      </button>
      <button onclick={() => { filterStatus = 'approved'; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {filterStatus === 'approved' ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        已通过
      </button>
      <button onclick={() => { filterStatus = 'pending'; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        待审核
      </button>
      <button onclick={() => { filterStatus = 'rejected'; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {filterStatus === 'rejected' ? 'bg-red-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        已拒绝
      </button>
      <button onclick={() => { filterStatus = 'deleted'; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {filterStatus === 'deleted' ? 'bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        已删除
      </button>
    </div>
    <div class="flex items-center gap-1 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 p-1">
      <button onclick={() => { sortOrder = 'desc'; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {sortOrder === 'desc' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        最新
      </button>
      <button onclick={() => { sortOrder = 'asc'; page = 1; loadData() }} class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {sortOrder === 'asc' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30'}">
        最旧
      </button>
    </div>
  </div>

  {#if showBatchBar}
    <div class="bg-gray-100/60 dark:bg-gray-700/60 backdrop-blur-xl border border-gray-400/20 dark:border-gray-500/20 rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span class="text-sm text-gray-700 dark:text-gray-300">已选择 <strong>{selectedIds.size}</strong> 条评论</span>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick={() => handleBatch('approve')} class="text-xs px-3 py-1.5 rounded-full bg-green-500/80 text-white hover:bg-green-600 transition-colors">批量通过</button>
        <button onclick={() => handleBatch('reject')} class="text-xs px-3 py-1.5 rounded-full bg-amber-500/80 text-white hover:bg-amber-600 transition-colors">批量拒绝</button>
        <button onclick={() => handleBatch('delete')} class="text-xs px-3 py-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors">批量删除</button>
        <button onclick={() => { selectedIds = new Set(); selectAll = false; showBatchBar = false }} class="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
      </div>
    </div>
  {/if}

  {#if viewMode === 'card'}
    <div class="space-y-3">
      {#if loading}
        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-gray-400 dark:text-gray-500">加载中...</div>
      {:else if commentList.length === 0}
        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-gray-400 dark:text-gray-500">暂无评论</div>
      {:else}
        <div class="flex items-center gap-2 px-1">
          <input type="checkbox" checked={selectAll} onchange={toggleSelectAll} class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-gray-400 dark:focus:ring-gray-500" />
          <span class="text-xs text-gray-500 dark:text-gray-400">全选</span>
          <span class="text-xs text-gray-400 dark:text-gray-500 ml-auto">共 {totalComments} 条</span>
        </div>
        {#each commentList as comment (comment.id)}
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 px-3 py-2.5 space-y-1.5 {selectedIds.has(comment.id) ? 'ring-2 ring-gray-400 dark:ring-gray-500' : ''} {comment.isAdmin ? 'border-l-[4px] border-l-gray-900 dark:border-l-gray-100 bg-gradient-to-r from-gray-200/70 dark:from-gray-600/70 to-white/60 dark:to-gray-800/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)]' : ''}">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={selectedIds.has(comment.id)} onchange={() => toggleSelect(comment.id)} class="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-gray-400 dark:focus:ring-gray-500 shrink-0" />
                {#if comment.avatar}
                  <img src={comment.avatar} alt="" class="w-7 h-7 rounded-full object-cover shrink-0 {comment.isAdmin ? 'ring-2 ring-gray-900 dark:ring-gray-100' : ''}" />
                {:else}
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 {comment.isAdmin ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold' : 'bg-gray-500/10 dark:bg-gray-400/10 text-gray-500 dark:text-gray-400'}">
                    {(comment.author || '匿').charAt(0)}
                  </div>
                {/if}
                <div class="min-w-0 overflow-hidden">
                  <div class="flex items-center gap-1 flex-wrap min-w-0">
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100 shrink-0">{comment.author || '匿名'}</span>
                    {#if comment.isAdmin}
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold inline-flex items-center gap-0.5 shrink-0">
                        <Icon icon="mdi:shield-crown" width="10" height="10" />
                        博主
                      </span>
                    {/if}
                    <span class="text-[10px] px-1.5 py-0 rounded-full {getStatusClass(getStatus(comment))} shrink-0">
                      {getStatusLabel(getStatus(comment))}
                    </span>
                    {#if comment.email}
                      <span class="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[100px] shrink-0">{comment.email}</span>
                    {/if}
                    {#if comment.postTitle || comment.postSlug}
                      <span class="text-[10px] text-gray-400 dark:text-gray-500 truncate shrink-0">
                        ·
                        {#if comment.postSlug}
                          <button onclick={() => jumpModalComment = comment} class="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline decoration-gray-300 dark:decoration-gray-600 underline-offset-1 transition-colors truncate max-w-[80px] text-left bg-transparent border-0 p-0 cursor-pointer">{comment.postTitle || comment.postSlug}</button>
                        {:else}
                          <span class="text-gray-500 dark:text-gray-400 truncate">{comment.postTitle}</span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
              <span class="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{getRelativeTime(comment.created_at)}</span>
            </div>

            <p class="text-sm text-gray-700 dark:text-gray-300 break-words pl-9">{comment.content || ''}</p>

            {#if replyingTo === comment.id}
              <div class="flex flex-col gap-1.5 pl-9">
                <input
                  type="email"
                  bind:value={replyEmail}
                  placeholder="邮箱（选填，QQ邮箱可获取头像和昵称）"
                  class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
                />
                <div class="flex flex-col sm:flex-row gap-1.5">
                  <input
                    type="text"
                    bind:value={replyContent}
                    placeholder="输入回复内容..."
                    onkeydown={(e) => e.key === 'Enter' && handleReply(replyingTo)}
                    class="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
                  />
                  <div class="flex gap-1.5 shrink-0">
                    <button onclick={() => handleReply(replyingTo)} class="px-3 py-1.5 rounded-full bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs transition-colors whitespace-nowrap">回复</button>
                    <button onclick={() => { replyingTo = null; replyEmail = '' }} class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors whitespace-nowrap">取消</button>
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex items-center gap-1 pl-9 flex-wrap">
                {#if comment.deleted}
                  <button onclick={() => handleRestore(comment.id)} class="text-[11px] px-2 py-0.5 rounded-full text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 hover:bg-blue-100/80 dark:hover:bg-blue-800/30 transition-colors whitespace-nowrap">恢复</button>
                  <button onclick={() => permanentDeleteTarget = comment} class="text-[11px] px-2 py-0.5 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors whitespace-nowrap">彻底删除</button>
                {:else}
                  {#if getStatus(comment) !== 'approved'}
                    <button onclick={() => handleUpdateStatus(comment, 'approved')} class="text-[11px] px-2 py-0.5 rounded-full text-green-600 dark:text-green-400 bg-green-50/80 dark:bg-green-900/30 hover:bg-green-100/80 dark:hover:bg-green-800/30 transition-colors whitespace-nowrap">通过</button>
                  {/if}
                  {#if getStatus(comment) !== 'rejected'}
                    <button onclick={() => handleUpdateStatus(comment, 'rejected')} class="text-[11px] px-2 py-0.5 rounded-full text-yellow-600 dark:text-yellow-400 bg-yellow-50/80 dark:bg-yellow-900/30 hover:bg-yellow-100/80 dark:hover:bg-yellow-800/30 transition-colors whitespace-nowrap">拒绝</button>
                  {/if}
                  <button onclick={() => { replyingTo = comment.id; replyContent = ''; replyEmail = '' }} class="text-[11px] px-2 py-0.5 rounded-full text-gray-900 dark:text-gray-100 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors whitespace-nowrap">回复</button>
                  <button onclick={() => { detailTarget = comment }} class="text-[11px] px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400 bg-gray-500/10 dark:bg-gray-400/10 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-colors whitespace-nowrap">详情</button>
                  <button onclick={() => { editTarget = comment; editContent = comment.content || '' }} class="text-[11px] px-2 py-0.5 rounded-full text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors whitespace-nowrap">编辑</button>
                  <button onclick={() => deleteTarget = comment} class="text-[11px] px-2 py-0.5 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors whitespace-nowrap">删除</button>
                {/if}
              </div>
            {/if}

            {#if comment.replies && comment.replies.length > 0}
              <div class="ml-9 space-y-1.5">
                {#if comment.replies.length > 2 && !expandedReplies.has(comment.id)}
                  <button
                    onclick={() => toggleReplies(comment.id)}
                    class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50/60 dark:bg-gray-800/60"
                  >
                    <Icon icon="mdi:chevron-down" width="14" height="14" />
                    展开 {comment.replies.length} 条回复
                  </button>
                  {#each comment.replies.slice(-2) as reply (reply.id)}
                    <div class="bg-gray-50/80 dark:bg-gray-800/80 rounded-xl px-3 py-2 {reply.isAdmin ? 'border-l-[3px] border-l-gray-900 dark:border-l-gray-100 bg-gradient-to-r from-gray-200/60 dark:from-gray-600/60 to-gray-50/80 dark:to-gray-800/80' : ''}">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-1.5 min-w-0">
                          {#if reply.avatar}
                            <img src={reply.avatar} alt="" class="w-5 h-5 rounded-full object-cover shrink-0 {reply.isAdmin ? 'ring-1.5 ring-gray-900 dark:ring-gray-100' : ''}" />
                          {:else}
                            <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 {reply.isAdmin ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold' : 'bg-gray-500/10 dark:bg-gray-400/10 text-gray-500 dark:text-gray-400'}">
                              {(reply.author || '匿').charAt(0)}
                            </div>
                          {/if}
                          <div class="min-w-0">
                            <div class="flex items-center gap-1 flex-wrap">
                              <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{reply.author || '匿名'}</span>
                              {#if reply.isAdmin}
                                <span class="text-[10px] px-1 py-0 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold inline-flex items-center gap-0.5">
                                  <Icon icon="mdi:shield-crown" width="9" height="9" />
                                  博主
                                </span>
                              {/if}
                            </div>
                          </div>
                        </div>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0 mt-0.5">{getRelativeTime(reply.created_at)}</span>
                      </div>
                      <p class="text-xs text-gray-700 dark:text-gray-300 break-words pl-6 mt-1">{reply.content || ''}</p>
                      <div class="flex items-center gap-1 pl-6 mt-1 flex-wrap">
                        <span class="text-[10px] px-1 py-0 rounded-full {getStatusClass(getStatus(reply))}">
                          {getStatusLabel(getStatus(reply))}
                        </span>
                        {#if reply.deleted}
                          <button onclick={() => handleRestore(reply.id)} class="text-[10px] px-1.5 py-0 rounded-full text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 hover:bg-blue-100/80 dark:hover:bg-blue-800/30 transition-colors whitespace-nowrap">恢复</button>
                          <button onclick={() => permanentDeleteTarget = reply} class="text-[10px] px-1.5 py-0 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors whitespace-nowrap">彻底删除</button>
                        {:else}
                          {#if getStatus(reply) !== 'approved'}
                            <button onclick={() => handleUpdateStatus(reply, 'approved')} class="text-[10px] px-1.5 py-0 rounded-full text-green-600 dark:text-green-400 bg-green-50/80 dark:bg-green-900/30 hover:bg-green-100/80 dark:hover:bg-green-800/30 transition-colors whitespace-nowrap">通过</button>
                          {/if}
                          {#if getStatus(reply) !== 'rejected'}
                            <button onclick={() => handleUpdateStatus(reply, 'rejected')} class="text-[10px] px-1.5 py-0 rounded-full text-yellow-600 dark:text-yellow-400 bg-yellow-50/80 dark:bg-yellow-900/30 hover:bg-yellow-100/80 dark:hover:bg-yellow-800/30 transition-colors whitespace-nowrap">拒绝</button>
                          {/if}
                          <button onclick={() => { editTarget = reply; editContent = reply.content || '' }} class="text-[10px] px-1.5 py-0 rounded-full text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors whitespace-nowrap">编辑</button>
                          <button onclick={() => deleteTarget = reply} class="text-[10px] px-1.5 py-0 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors whitespace-nowrap">删除</button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                {:else}
                  {#if comment.replies.length > 2}
                    <button
                      onclick={() => toggleReplies(comment.id)}
                      class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50/60 dark:bg-gray-800/60"
                    >
                      <Icon icon="mdi:chevron-up" width="14" height="14" />
                      收起回复
                    </button>
                  {/if}
                  {#each comment.replies as reply (reply.id)}
                    <div class="bg-gray-50/80 dark:bg-gray-800/80 rounded-xl px-3 py-2 {reply.isAdmin ? 'border-l-[3px] border-l-gray-900 dark:border-l-gray-100 bg-gradient-to-r from-gray-200/60 dark:from-gray-600/60 to-gray-50/80 dark:to-gray-800/80' : ''}">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-1.5 min-w-0">
                          {#if reply.avatar}
                            <img src={reply.avatar} alt="" class="w-5 h-5 rounded-full object-cover shrink-0 {reply.isAdmin ? 'ring-1.5 ring-gray-900 dark:ring-gray-100' : ''}" />
                          {:else}
                            <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 {reply.isAdmin ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold' : 'bg-gray-500/10 dark:bg-gray-400/10 text-gray-500 dark:text-gray-400'}">
                              {(reply.author || '匿').charAt(0)}
                            </div>
                          {/if}
                          <div class="min-w-0">
                            <div class="flex items-center gap-1 flex-wrap">
                              <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{reply.author || '匿名'}</span>
                              {#if reply.isAdmin}
                                <span class="text-[10px] px-1 py-0 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold inline-flex items-center gap-0.5">
                                  <Icon icon="mdi:shield-crown" width="9" height="9" />
                                  博主
                                </span>
                              {/if}
                            </div>
                          </div>
                        </div>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0 mt-0.5">{getRelativeTime(reply.created_at)}</span>
                      </div>
                      <p class="text-xs text-gray-700 dark:text-gray-300 break-words pl-6 mt-1">{reply.content || ''}</p>
                      <div class="flex items-center gap-1 pl-6 mt-1 flex-wrap">
                        <span class="text-[10px] px-1 py-0 rounded-full {getStatusClass(getStatus(reply))}">
                          {getStatusLabel(getStatus(reply))}
                        </span>
                        {#if reply.deleted}
                          <button onclick={() => handleRestore(reply.id)} class="text-[10px] px-1.5 py-0 rounded-full text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 hover:bg-blue-100/80 dark:hover:bg-blue-800/30 transition-colors whitespace-nowrap">恢复</button>
                          <button onclick={() => permanentDeleteTarget = reply} class="text-[10px] px-1.5 py-0 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors whitespace-nowrap">彻底删除</button>
                        {:else}
                          {#if getStatus(reply) !== 'approved'}
                            <button onclick={() => handleUpdateStatus(reply, 'approved')} class="text-[10px] px-1.5 py-0 rounded-full text-green-600 dark:text-green-400 bg-green-50/80 dark:bg-green-900/30 hover:bg-green-100/80 dark:hover:bg-green-800/30 transition-colors whitespace-nowrap">通过</button>
                          {/if}
                          {#if getStatus(reply) !== 'rejected'}
                            <button onclick={() => handleUpdateStatus(reply, 'rejected')} class="text-[10px] px-1.5 py-0 rounded-full text-yellow-600 dark:text-yellow-400 bg-yellow-50/80 dark:bg-yellow-900/30 hover:bg-yellow-100/80 dark:hover:bg-yellow-800/30 transition-colors whitespace-nowrap">拒绝</button>
                          {/if}
                          <button onclick={() => { editTarget = reply; editContent = reply.content || '' }} class="text-[10px] px-1.5 py-0 rounded-full text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors whitespace-nowrap">编辑</button>
                          <button onclick={() => deleteTarget = reply} class="text-[10px] px-1.5 py-0 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors whitespace-nowrap">删除</button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      {#if commentList.length > 0}
        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">共 {totalComments} 条</span>
              <select onchange={(e) => { pageSize = parseInt(e.target.value); page = 1; loadData() }} class="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500">
                <option value="10" selected={pageSize === 10}>10条/页</option>
                <option value="20" selected={pageSize === 20}>20条/页</option>
                <option value="50" selected={pageSize === 50}>50条/页</option>
                <option value="100" selected={pageSize === 100}>100条/页</option>
              </select>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={pageSize}
                  onchange={(e) => { const v = parseInt(e.target.value); if (v > 0) { pageSize = Math.min(v, 500); page = 1; loadData() } }}
                  class="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm text-gray-700 dark:text-gray-300 text-center outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                />
                <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">条/页</span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button onclick={() => { if (page > 1) { page--; loadData() } }} disabled={page <= 1} class="px-3 py-1 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">上一页</button>
              <button onclick={() => { if (page < totalPages) { page++; loadData() } }} disabled={page >= totalPages} class="px-3 py-1 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">下一页</button>
            </div>
          </div>
          <div class="flex items-center justify-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span class="text-sm text-gray-400 dark:text-gray-500">第 {page} / {totalPages} 页</span>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[700px]">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-10">
                <input type="checkbox" checked={selectAll} onchange={toggleSelectAll} class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-gray-400 dark:focus:ring-gray-500" />
              </th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">评论者</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">内容</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">状态</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell whitespace-nowrap">日期</th>
              <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            {#if loading}
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">加载中...</td></tr>
            {:else if commentList.length === 0}
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">暂无评论</td></tr>
            {:else}
              {#each commentList as comment (comment.id)}
                <tr class="hover:bg-gray-100/60 dark:hover:bg-gray-700/60 transition-colors {selectedIds.has(comment.id) ? 'bg-gray-100/60 dark:bg-gray-700/60' : ''} {comment.isAdmin ? 'bg-gray-100/70 dark:bg-gray-700/70 border-l-4 border-l-gray-900 dark:border-l-gray-100' : ''}">
                  <td class="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(comment.id)} onchange={() => toggleSelect(comment.id)} class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-gray-400 dark:focus:ring-gray-500" />
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      {#if comment.avatar}
                        <img src={comment.avatar} alt="" class="w-7 h-7 rounded-full object-cover shrink-0 {comment.isAdmin ? 'ring-[3px] ring-gray-900 dark:ring-gray-100' : ''}" />
                      {:else}
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 {comment.isAdmin ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold' : 'bg-gray-500/10 dark:bg-gray-400/10 text-gray-500 dark:text-gray-400'}">
                          {(comment.author || '匿').charAt(0)}
                        </div>
                      {/if}
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{comment.author || '匿名'}</span>
                        {#if comment.isAdmin}
                          <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold inline-flex items-center gap-0.5">
                            <Icon icon="mdi:shield-crown" width="10" height="10" />
                            博主
                          </span>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{comment.content || ''}</p>
                    {#if comment.postTitle || comment.postSlug}
                      <div class="flex items-center gap-1 mt-0.5">
                        {#if comment.postSlug}
                          <button onclick={() => jumpModalComment = comment} class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors truncate max-w-[150px] text-left bg-transparent border-0 p-0 cursor-pointer">
                            {comment.postTitle || comment.postSlug}
                          </button>
                        {:else}
                          <span class="text-xs text-gray-400 dark:text-gray-500 truncate">{comment.postTitle}</span>
                        {/if}
                      </div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <span class="text-xs px-2 py-0.5 rounded-full {getStatusClass(getStatus(comment))}">
                      {getStatusLabel(getStatus(comment))}
                    </span>
                  </td>
                  <td class="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                    <span class="text-sm text-gray-500 dark:text-gray-400">{formatDate(comment.created_at)}</span>
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1">
                      {#if comment.deleted}
                        <button onclick={() => handleRestore(comment.id)} class="text-xs px-2 py-1 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap">恢复</button>
                        <button onclick={() => permanentDeleteTarget = comment} class="text-xs px-2 py-1 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap">彻底删除</button>
                      {:else}
                        {#if getStatus(comment) !== 'approved'}
                          <button onclick={() => handleUpdateStatus(comment, 'approved')} class="text-xs px-2 py-1 rounded-full text-green-600 dark:text-green-400 hover:bg-green-50/80 dark:hover:bg-green-900/30 transition-colors whitespace-nowrap">通过</button>
                        {/if}
                        {#if getStatus(comment) !== 'rejected'}
                          <button onclick={() => handleUpdateStatus(comment, 'rejected')} class="text-xs px-2 py-1 rounded-full text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50/80 dark:hover:bg-yellow-900/30 transition-colors whitespace-nowrap">拒绝</button>
                        {/if}
                        <button onclick={() => { replyingTo = comment.id; replyContent = '' }} class="text-xs px-2 py-1 rounded-full text-gray-900 dark:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors whitespace-nowrap">回复</button>
                        <button onclick={() => { editTarget = comment; editContent = comment.content || '' }} class="text-xs px-2 py-1 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors whitespace-nowrap">编辑</button>
                        <button onclick={() => deleteTarget = comment} class="text-xs px-2 py-1 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap">删除</button>
                      {/if}
                    </div>
                  </td>
                </tr>
                {#if replyingTo === comment.id}
                  <tr>
                    <td colspan="6" class="px-4 py-3 bg-white/30 dark:bg-gray-800/30">
                      <div class="flex flex-col gap-2">
                        <input
                          type="email"
                          bind:value={replyEmail}
                          placeholder="邮箱（选填，QQ邮箱可获取头像和昵称）"
                          class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
                        />
                        <div class="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            bind:value={replyContent}
                            placeholder="输入回复内容..."
                            onkeydown={(e) => e.key === 'Enter' && handleReply(replyingTo)}
                            class="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
                          />
                          <div class="flex gap-2 shrink-0">
                            <button onclick={() => handleReply(replyingTo)} class="px-4 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm transition-colors whitespace-nowrap">回复</button>
                            <button onclick={() => { replyingTo = null; replyEmail = '' }} class="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors whitespace-nowrap">取消</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      {#if commentList.length > 0}
        <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">共 {totalComments} 条</span>
              <select onchange={(e) => { pageSize = parseInt(e.target.value); page = 1; loadData() }} class="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500">
                <option value="10" selected={pageSize === 10}>10条/页</option>
                <option value="20" selected={pageSize === 20}>20条/页</option>
                <option value="50" selected={pageSize === 50}>50条/页</option>
                <option value="100" selected={pageSize === 100}>100条/页</option>
              </select>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={pageSize}
                  onchange={(e) => { const v = parseInt(e.target.value); if (v > 0) { pageSize = Math.min(v, 500); page = 1; loadData() } }}
                  class="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm text-gray-700 dark:text-gray-300 text-center outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                />
                <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">条/页</span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button onclick={() => { if (page > 1) { page--; loadData() } }} disabled={page <= 1} class="px-3 py-1 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">上一页</button>
              <button onclick={() => { if (page < totalPages) { page++; loadData() } }} disabled={page >= totalPages} class="px-3 py-1 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">下一页</button>
            </div>
          </div>
          <div class="flex items-center justify-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span class="text-sm text-gray-400 dark:text-gray-500">第 {page} / {totalPages} 页</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if deleteTarget}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => deleteTarget = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4 border border-white/30 dark:border-gray-700/30" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">确认删除</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">该评论将移至回收站，可随时恢复。如需彻底删除，请先移至回收站再使用"彻底删除"功能。</p>
      <div class="bg-white/40 dark:bg-gray-800/40 backdrop-blur rounded-2xl p-3 mt-3 mb-4">
        <p class="text-sm text-gray-700 dark:text-gray-300 break-words">{deleteTarget.content || ''}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">—— {deleteTarget.author || '匿名'} · {formatDate(deleteTarget.created_at)}</p>
      </div>
      <div class="flex justify-end gap-3">
        <button onclick={() => deleteTarget = null} class="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={() => handleDelete(deleteTarget.id)} class="px-4 py-2 rounded-full bg-red-600/80 hover:bg-red-700 text-white text-sm transition-colors">移至回收站</button>
      </div>
    </div>
  </div>
{/if}

{#if permanentDeleteTarget}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => permanentDeleteTarget = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4 border border-white/30 dark:border-gray-700/30" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">彻底删除</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">此操作不可撤销，评论将被永久删除。</p>
      <div class="bg-white/40 dark:bg-gray-800/40 backdrop-blur rounded-2xl p-3 mt-3 mb-4">
        <p class="text-sm text-gray-700 dark:text-gray-300 break-words">{permanentDeleteTarget.content || ''}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">—— {permanentDeleteTarget.author || '匿名'} · {formatDate(permanentDeleteTarget.created_at)}</p>
      </div>
      <div class="flex justify-end gap-3">
        <button onclick={() => permanentDeleteTarget = null} class="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={() => handlePermanentDelete(permanentDeleteTarget.id)} class="px-4 py-2 rounded-full bg-red-600/80 hover:bg-red-700 text-white text-sm transition-colors">彻底删除</button>
      </div>
    </div>
  </div>
{/if}

{#if detailTarget}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => detailTarget = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto border border-white/30 dark:border-gray-700/30" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">评论详情</h3>
        <button onclick={() => detailTarget = null} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          {#if detailTarget.avatar}
            <img src={detailTarget.avatar} alt="" class="w-10 h-10 rounded-full object-cover {detailTarget.isAdmin ? 'ring-[3px] ring-gray-900 dark:ring-gray-100' : ''}" />
          {:else}
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm {detailTarget.isAdmin ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold' : 'bg-gray-500/10 dark:bg-gray-400/10 text-gray-500 dark:text-gray-400'}">
              {(detailTarget.author || '匿').charAt(0)}
            </div>
          {/if}
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900 dark:text-gray-100">{detailTarget.author || '匿名'}</span>
              {#if detailTarget.isAdmin}
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold inline-flex items-center gap-0.5 shadow-sm">
                  <Icon icon="mdi:shield-crown" width="11" height="11" />
                  博主
                </span>
              {/if}
              <span class="text-xs px-2 py-0.5 rounded-full {getStatusClass(getStatus(detailTarget))}">
                {getStatusLabel(getStatus(detailTarget))}
              </span>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500">{detailTarget.email || '未填写邮箱'}</p>
          </div>
        </div>
        <div class="backdrop-blur rounded-2xl p-4 {detailTarget.isAdmin ? 'bg-gray-100/80 dark:bg-gray-700/80 border border-gray-300/50 dark:border-gray-600/50' : 'bg-white/40 dark:bg-gray-800/40'}">
          <p class="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap">{detailTarget.content || ''}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>文章：{#if detailTarget.postSlug}<button onclick={() => jumpModalComment = detailTarget} class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 transition-colors bg-transparent border-0 p-0 cursor-pointer">{detailTarget.postTitle || detailTarget.postSlug}</button>{:else}{detailTarget.postTitle || '-'}{/if}</span>
          <span class="text-right">{formatDate(detailTarget.created_at)}</span>
          {#if detailTarget.ip}
            <span>IP：{detailTarget.ip}</span>
          {/if}
          {#if detailTarget.ua}
            <span class="col-span-2 truncate">UA：{detailTarget.ua}</span>
          {/if}
        </div>
        <div class="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {#if detailTarget.deleted}
            <button onclick={() => { handleRestore(detailTarget.id); detailTarget = null }} class="text-xs px-3 py-1.5 rounded-full text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 hover:bg-blue-100/80 dark:hover:bg-blue-800/30 transition-colors">恢复</button>
            <button onclick={() => { permanentDeleteTarget = detailTarget; detailTarget = null }} class="text-xs px-3 py-1.5 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors">彻底删除</button>
          {:else}
            {#if getStatus(detailTarget) !== 'approved'}
              <button onclick={() => { handleUpdateStatus(detailTarget, 'approved'); detailTarget = null }} class="text-xs px-3 py-1.5 rounded-full text-green-600 dark:text-green-400 bg-green-50/80 dark:bg-green-900/30 hover:bg-green-100/80 dark:hover:bg-green-800/30 transition-colors">通过</button>
            {/if}
            {#if getStatus(detailTarget) !== 'rejected'}
              <button onclick={() => { handleUpdateStatus(detailTarget, 'rejected'); detailTarget = null }} class="text-xs px-3 py-1.5 rounded-full text-yellow-600 dark:text-yellow-400 bg-yellow-50/80 dark:bg-yellow-900/30 hover:bg-yellow-100/80 dark:hover:bg-yellow-800/30 transition-colors">拒绝</button>
            {/if}
            <button onclick={() => { editTarget = detailTarget; editContent = detailTarget.content || ''; detailTarget = null }} class="text-xs px-3 py-1.5 rounded-full text-gray-700 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-colors">编辑</button>
            <button onclick={() => { deleteTarget = detailTarget; detailTarget = null }} class="text-xs px-3 py-1.5 rounded-full text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-800/30 transition-colors">删除</button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if editTarget}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => editTarget = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-lg w-full mx-4 border border-white/30 dark:border-gray-700/30" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">编辑评论</h3>
      <div class="mb-3">
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-1">评论者：{editTarget.author || '匿名'} · {formatDate(editTarget.created_at)}</p>
      </div>
      <textarea
        bind:value={editContent}
        rows="6"
        class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none resize-y"
      ></textarea>
      <div class="flex justify-end gap-3 mt-4">
        <button onclick={() => editTarget = null} class="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={handleEditSave} class="px-4 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm transition-colors">保存</button>
      </div>
    </div>
  </div>
{/if}

{#if jumpModalComment}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => jumpModalComment = null}>
    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 max-w-md w-full mx-4 border border-white/30 dark:border-gray-700/30" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">查看文章</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">选择打开「{jumpModalComment.postTitle || jumpModalComment.postSlug}」的方式</p>
      <div class="flex justify-end gap-3">
        <button onclick={() => jumpModalComment = null} class="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors">取消</button>
        <button onclick={() => { location.href = '/blog/' + jumpModalComment.postSlug; jumpModalComment = null }} class="px-4 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm transition-colors">当前窗口</button>
        <button onclick={() => { window.open('/blog/' + jumpModalComment.postSlug, '_blank'); jumpModalComment = null }} class="px-4 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm transition-colors">新标签页</button>
      </div>
    </div>
  </div>
{/if}
