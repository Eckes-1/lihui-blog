<script>
import { posts, categories, media } from '../api.js'
import Icon from '@iconify/svelte'
import { addToast } from '../stores.svelte.js'
import { marked } from 'marked'
import { onSSE } from '../lib/sse.js'
import { onMount, onDestroy } from 'svelte'

let { routeParams, route } = $props()

let isEdit = $derived(route.includes('/edit'))
let postId = $derived(routeParams?.id || null)

let title = $state('')
let slug = $state('')
let categoryId = $state('')
let description = $state('')
let cover = $state('')
let content = $state('')
let pin = $state(0)
let draft = $state(true)
let pubDate = $state('')
let tags = $state('')
let categoryList = $state([])
let loading = $state(false)
let saving = $state(false)
let showPreview = $state(false)
let splitView = $state(true)
let showMediaPicker = $state(false)
let mediaList = $state([])
let mediaLoading = $state(false)
let lastSavedContent = $state('')
let autoSaveTimer = null
let hasUnsavedChanges = $state(false)
let showSeoPreview = $state(false)
let showShortcuts = $state(false)
let textareaEl = $state(null)

let htmlPreview = $state('')
let previewDebounce = null

let wordCount = $derived(content ? content.replace(/\s+/g, '').length : 0)
let readingTime = $derived(Math.max(1, Math.ceil(wordCount / 500)))
let charCount = $derived(content.length)

$effect(() => {
  const c = content
  if (previewDebounce) clearTimeout(previewDebounce)
  previewDebounce = setTimeout(() => {
    htmlPreview = c ? marked(c) : ''
  }, 100)
})

$effect(() => {
  hasUnsavedChanges = content !== lastSavedContent || title !== lastSavedTitle
})

let lastSavedTitle = $state('')

async function loadCategories() {
  try {
    const data = await categories.list()
    categoryList = data.data || data || []
  } catch (e) {}
}

async function loadPost() {
  if (!postId) return
  loading = true
  try {
    const data = await posts.get(postId)
    title = data.title || ''
    slug = data.slug_id || data.slug || ''
    categoryId = data.category || ''
    description = data.description || ''
    cover = data.image || data.cover || ''
    content = data.content || ''
    pin = data.pin_top ?? data.pin ?? 0
    draft = data.draft === 1 || data.draft === true
    pubDate = data.pub_date || ''
    tags = data.tags || ''
    lastSavedContent = content
    lastSavedTitle = title
  } catch (e) {
    addToast('加载文章失败', 'error')
  } finally {
    loading = false
  }
}

onMount(() => {
  loadCategories()
  loadPost()
  const off = onSSE((data) => {
    if (data.resources.includes('categories')) loadCategories()
  })
  startAutoSave()
  return () => { off(); stopAutoSave() }
})

function startAutoSave() {
  stopAutoSave()
  autoSaveTimer = setInterval(() => {
    if (hasUnsavedChanges && isEdit && postId && title && content) {
      handleSave(true)
    }
  }, 30000)
}

function stopAutoSave() {
  if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null }
}

async function handleSave(silent = false) {
  if (!title) { if (!silent) addToast('请输入标题', 'error'); return }
  if (!content) { if (!silent) addToast('请输入内容', 'error'); return }
  if (!slug) generateSlug()
  if (!slug) { if (!silent) addToast('无法生成有效的 slug，请手动输入', 'error'); return }

  saving = true
  try {
    const data = {
      title,
      slug_id: slug,
      category: categoryId,
      description,
      image: cover,
      content,
      pin_top: pin || 0,
      draft: draft ? 1 : 0,
      pub_date: pubDate || '',
      tags: tags || ''
    }
    if (isEdit && postId) {
      await posts.update(postId, data)
      lastSavedContent = content
      lastSavedTitle = title
      hasUnsavedChanges = false
      if (!silent) addToast('保存成功', 'success')
    } else {
      await posts.create(data)
      addToast('创建成功', 'success')
      location.hash = '#/posts'
    }
  } catch (e) {
    if (!silent) addToast(e.message || '保存失败', 'error')
  } finally {
    saving = false
  }
}

function generateSlug() {
  if (slug && isEdit) return
  slug = title.toLowerCase()
    .replace(/[\u4e00-\u9fa5]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function insertMarkdown(prefix, suffix = '', placeholder = '') {
  if (!textareaEl) return
  const start = textareaEl.selectionStart
  const end = textareaEl.selectionEnd
  const selected = content.substring(start, end)
  const text = selected || placeholder
  const before = content.substring(0, start)
  const after = content.substring(end)
  content = before + prefix + text + suffix + after
  textareaEl.focus()
  const newPos = start + prefix.length + text.length
  requestAnimationFrame(() => {
    textareaEl.setSelectionRange(newPos, newPos)
  })
}

function insertAtCursor(text) {
  if (!textareaEl) return
  const start = textareaEl.selectionStart
  const before = content.substring(0, start)
  const after = content.substring(start)
  content = before + text + after
  textareaEl.focus()
  requestAnimationFrame(() => {
    textareaEl.setSelectionRange(start + text.length, start + text.length)
  })
}

const toolbarActions = [
  { icon: 'mdi:format-header-1', title: '一级标题', action: () => insertMarkdown('# ', '', '标题') },
  { icon: 'mdi:format-header-2', title: '二级标题', action: () => insertMarkdown('## ', '', '标题') },
  { icon: 'mdi:format-header-3', title: '三级标题', action: () => insertMarkdown('### ', '', '标题') },
  { icon: 'mdi:format-bold', title: '加粗 (Ctrl+B)', action: () => insertMarkdown('**', '**', '粗体文字') },
  { icon: 'mdi:format-italic', title: '斜体 (Ctrl+I)', action: () => insertMarkdown('*', '*', '斜体文字') },
  { icon: 'mdi:format-strikethrough', title: '删除线', action: () => insertMarkdown('~~', '~~', '删除线文字') },
  { icon: 'mdi:code-tags', title: '行内代码', action: () => insertMarkdown('`', '`', 'code') },
  { icon: 'mdi:code-braces', title: '代码块', action: () => insertMarkdown('\n```\n', '\n```\n', '代码') },
  { icon: 'mdi:link-variant', title: '链接', action: () => insertMarkdown('[', '](url)', '链接文字') },
  { icon: 'mdi:image-outline', title: '图片', action: () => insertMarkdown('![', '](url)', '图片描述') },
  { icon: 'mdi:format-list-bulleted', title: '无序列表', action: () => insertMarkdown('\n- ', '', '列表项') },
  { icon: 'mdi:format-list-numbered', title: '有序列表', action: () => insertMarkdown('\n1. ', '', '列表项') },
  { icon: 'mdi:format-quote-close', title: '引用', action: () => insertMarkdown('\n> ', '', '引用文字') },
  { icon: 'mdi:minus', title: '分割线', action: () => insertAtCursor('\n---\n') },
  { icon: 'mdi:table', title: '表格', action: () => insertAtCursor('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n') },
]

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault()
    showPreview = !showPreview
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    insertMarkdown('**', '**', '粗体文字')
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    insertMarkdown('*', '*', '斜体文字')
  }
}

function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      if (!content) {
        const lines = text.split('\n')
        if (lines[0]?.startsWith('# ')) {
          title = lines[0].replace(/^# /, '')
          content = lines.slice(1).join('\n').trim()
        } else {
          content = text
        }
      } else {
        content += '\n\n' + text
      }
      addToast(`已导入 ${file.name}`, 'success')
    } catch {
      addToast('导入失败', 'error')
    }
  }
  input.click()
}

function handleExport() {
  const md = `# ${title}\n\n${content}`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug || 'post'}.md`
  a.click()
  URL.revokeObjectURL(url)
  addToast('已导出 Markdown', 'success')
}

async function loadMedia() {
  mediaLoading = true
  try {
    const data = await media.list({ pageSize: 30 })
    mediaList = data.media || data.data || []
  } catch {}
  mediaLoading = false
}

function selectMedia(item) {
  cover = item.path || item.url || ''
  showMediaPicker = false
  addToast('已选择封面', 'success')
}

async function uploadCover() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      addToast('上传中...', 'info')
      const data = await media.upload(file)
      cover = data.url
      addToast('封面上传成功', 'success')
    } catch (err) {
      addToast(err.message || '上传失败', 'error')
    }
  }
  input.click()
}

function handleBeforeUnload(e) {
  if (hasUnsavedChanges) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMount(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onDestroy(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  stopAutoSave()
})

let seoTitle = $derived(title || '文章标题')
let seoDesc = $derived(description || content.substring(0, 160).replace(/[#*`\n]/g, ' ').trim() || '文章描述...')
let seoUrl = $derived(`momo-blog.pages.dev/blog/${slug || 'post-slug'}`)
</script>

<svelte:window onkeydown={handleKeydown} />

{#if loading}
  <div class="flex items-center justify-center h-64">
    <div class="text-gray-400 dark:text-gray-500">加载中...</div>
  </div>
{:else}
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-3">
        <a href="#/posts" class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <Icon icon="mdi:arrow-left" width="16" height="16" />
          返回列表
        </a>
        {#if hasUnsavedChanges}
          <span class="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 animate-pulse"></span>
            未保存
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick={handleImport} title="导入 Markdown" class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Icon icon="mdi:import" width="18" height="18" />
        </button>
        <button onclick={handleExport} title="导出 Markdown" class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Icon icon="mdi:export" width="18" height="18" />
        </button>
        <button onclick={() => showShortcuts = !showShortcuts} title="快捷键" class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Icon icon="mdi:keyboard" width="18" height="18" />
        </button>
        <div class="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>{draft ? '草稿' : '已发布'}</span>
          <button
            onclick={() => draft = !draft}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {draft ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-green-500 dark:bg-green-400'}"
          >
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {draft ? 'translate-x-1' : 'translate-x-6'}"></span>
          </button>
        </label>
        <button
          onclick={() => handleSave()}
          disabled={saving}
          class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 disabled:bg-gray-600/60 dark:disabled:bg-gray-500/60 text-white dark:text-gray-900 text-sm font-medium transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>

    {#if showShortcuts}
      <div class="bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-4 text-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="font-medium text-blue-800 dark:text-blue-300">快捷键</span>
          <button onclick={() => showShortcuts = false} class="text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-400">
            <Icon icon="mdi:close" width="16" height="16" />
          </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-blue-700 dark:text-blue-400">
          <div><kbd class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">Ctrl+S</kbd> 保存</div>
          <div><kbd class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">Ctrl+B</kbd> 加粗</div>
          <div><kbd class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">Ctrl+I</kbd> 斜体</div>
          <div><kbd class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">Ctrl+P</kbd> 预览</div>
        </div>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 space-y-3">
        <input
          type="text"
          bind:value={title}
          onblur={generateSlug}
          placeholder="文章标题"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none text-xl font-semibold"
        />

        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex gap-1">
            <button
              onclick={() => { showPreview = false; splitView = false }}
              class="px-3 py-1.5 rounded-lg text-sm {!showPreview && !splitView ? 'bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'} transition-colors"
            >
              <Icon icon="mdi:pencil" width="16" height="16" class="inline-block mr-1 -mt-0.5" />编辑
            </button>
            <button
              onclick={() => { showPreview = false; splitView = true }}
              class="px-3 py-1.5 rounded-lg text-sm {!showPreview && splitView ? 'bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'} transition-colors"
            >
              <Icon icon="mdi:split-vertical" width="16" height="16" class="inline-block mr-1 -mt-0.5" />分屏
            </button>
            <button
              onclick={() => { showPreview = true; splitView = false }}
              class="px-3 py-1.5 rounded-lg text-sm {showPreview ? 'bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'} transition-colors"
            >
              <Icon icon="mdi:eye" width="16" height="16" class="inline-block mr-1 -mt-0.5" />预览
            </button>
          </div>

          {#if !showPreview}
            <div class="flex items-center gap-0.5 flex-wrap">
              {#each toolbarActions as btn}
                <button
                  onclick={btn.action}
                  title={btn.title}
                  class="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <Icon icon={btn.icon} width="18" height="18" />
                </button>
              {/each}
            </div>
          {/if}
        </div>

        {#if showPreview}
          <div class="min-h-[500px] p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur prose max-w-none overflow-y-auto">
            {#if htmlPreview}
              {@html htmlPreview}
            {:else}
              <p class="text-gray-400 dark:text-gray-500">暂无内容可预览</p>
            {/if}
          </div>
        {:else if splitView}
          <div class="grid grid-cols-2 gap-0 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" style="min-height: 500px">
            <textarea
              bind:this={textareaEl}
              bind:value={content}
              placeholder="在此输入 Markdown 内容..."
              class="w-full h-full min-h-[500px] px-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 focus:outline-none font-mono text-sm leading-relaxed resize-none border-r border-gray-200 dark:border-gray-700"
            ></textarea>
            <div class="h-full min-h-[500px] p-4 bg-white/30 dark:bg-gray-800/30 backdrop-blur prose max-w-none overflow-y-auto text-sm">
              {#if htmlPreview}
                {@html htmlPreview}
              {:else}
                <p class="text-gray-400 dark:text-gray-500">预览区域</p>
              {/if}
            </div>
          </div>
        {:else}
          <textarea
            bind:this={textareaEl}
            bind:value={content}
            placeholder="在此输入 Markdown 内容..."
            class="w-full min-h-[500px] px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none font-mono text-sm leading-relaxed resize-y"
          ></textarea>
        {/if}

        <div class="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>{charCount} 字符</span>
          <span>{wordCount} 字</span>
          <span>约 {readingTime} 分钟阅读</span>
          <span>{content.split('\n').length} 行</span>
        </div>
      </div>

      <div class="space-y-4">
        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Icon icon="mdi:cog" width="16" height="16" />
            发布设置
          </h3>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug ID</label>
            <input
              type="text"
              bind:value={slug}
              placeholder="url-friendly-id"
              class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
            <select
              bind:value={categoryId}
              class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 text-sm outline-none"
            >
              <option value="">未分类</option>
              {#each categoryList as cat}
                <option value={cat.name}>{cat.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标签</label>
            <input
              type="text"
              bind:value={tags}
              placeholder="用逗号分隔，如：技术,前端,教程"
              class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">发布日期</label>
            <input
              type="date"
              bind:value={pubDate}
              class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">置顶排序</label>
            <input
              type="number"
              bind:value={pin}
              min="0"
              placeholder="0 = 不置顶，数字越大越靠前"
              class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Icon icon="mdi:text" width="16" height="16" />
            文章描述
          </h3>
          <textarea
            bind:value={description}
            placeholder="文章简短描述，用于 SEO 和摘要展示"
            rows="3"
            maxlength="300"
            class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none resize-y"
          ></textarea>
          <div class="text-xs text-gray-400 dark:text-gray-500 text-right">{(description || '').length}/300</div>
        </div>

        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Icon icon="mdi:image" width="16" height="16" />
            封面图片
          </h3>
          <input
            type="text"
            bind:value={cover}
            placeholder="https://..."
            class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none"
          />
          <div class="flex gap-2">
            <button
              onclick={uploadCover}
              class="flex-1 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Icon icon="mdi:upload" width="14" height="14" class="inline-block mr-1 -mt-0.5" />上传
            </button>
            <button
              onclick={() => { showMediaPicker = !showMediaPicker; if (showMediaPicker) loadMedia() }}
              class="flex-1 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
            >
              <Icon icon="mdi:folder-image" width="14" height="14" class="inline-block mr-1 -mt-0.5" />媒体库
            </button>
            {#if cover}
              <button
                onclick={() => { cover = '' }}
                class="py-2 px-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                <Icon icon="mdi:delete" width="14" height="14" />
              </button>
            {/if}
          </div>
          {#if cover}
            <img src={cover} alt="封面预览" class="w-full rounded-xl max-h-40 object-cover border border-gray-100 dark:border-gray-800" onerror={() => {}} />
          {/if}

          {#if showMediaPicker}
            <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-3 max-h-48 overflow-y-auto bg-white/50 dark:bg-gray-800/50">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400">选择文件</span>
                <button onclick={() => showMediaPicker = false} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                  <Icon icon="mdi:close" width="14" height="14" />
                </button>
              </div>
              {#if mediaLoading}
                <div class="text-center text-xs text-gray-400 dark:text-gray-500 py-4">加载中...</div>
              {:else if mediaList.length === 0}
                <div class="text-center text-xs text-gray-400 dark:text-gray-500 py-4">暂无媒体文件</div>
              {:else}
                <div class="grid grid-cols-3 gap-2">
                  {#each mediaList as item}
                    <button
                      onclick={() => selectMedia(item)}
                      class="aspect-square rounded-lg overflow-hidden border-2 hover:border-blue-400 dark:hover:border-blue-300 transition-colors {cover === (item.path || item.url) ? 'border-blue-500 dark:border-blue-400' : 'border-transparent'} bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
                    >
                      {#if (item.mime_type || '').startsWith('image/')}
                        <img src={item.path || item.url} alt="" class="w-full h-full object-cover" />
                      {:else}
                        <div class="flex flex-col items-center gap-1 p-1">
                          <Icon icon="mdi:file" width="20" height="20" class="text-gray-400 dark:text-gray-500" />
                          <span class="text-[9px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{item.filename || '文件'}</span>
                        </div>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Icon icon="mdi:magnify" width="16" height="16" />
              SEO 预览
            </h3>
            <button
              onclick={() => showSeoPreview = !showSeoPreview}
              class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showSeoPreview ? '收起' : '展开'}
            </button>
          </div>
          {#if showSeoPreview}
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
              <div class="text-blue-700 dark:text-blue-400 text-base font-medium truncate hover:underline cursor-pointer">{seoTitle}</div>
              <div class="text-green-700 dark:text-green-400 text-xs mt-0.5">{seoUrl}</div>
              <div class="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-2">{seoDesc}</div>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">
              标题 {(seoTitle || '').length}/60 · 描述 {(seoDesc || '').length}/160
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
