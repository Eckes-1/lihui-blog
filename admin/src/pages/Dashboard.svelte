<script>
import { onMount } from 'svelte'
import Icon from '@iconify/svelte'
import { dashboard } from '../api.js'
import { addToast } from '../stores.svelte.js'
import { onSSE } from '../lib/sse.js'
let stats = $state({ totalPosts: 0, totalComments: 0, pendingComments: 0, totalCategories: 0 })
let recentPosts = $state([])
let recentComments = $state([])
let loading = $state(true)
function formatDate(date) { if (!date) return '-'; const d = new Date(date); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('zh-CN') }
async function loadData(silent = false) {
  if (!silent) loading = true
  try {
    const data = await dashboard.getStats()
    stats = { totalPosts: data.totalPosts || 0, totalComments: data.totalComments || 0, pendingComments: data.pendingComments || 0, totalCategories: data.totalCategories || 0 }
    recentPosts = data.recentPosts || []; recentComments = data.recentComments || []
  } catch (e) { if (!silent) addToast('加载数据失败: ' + e.message, 'error') }
  finally { if (!silent) loading = false }
}
onMount(() => {
  loadData()
  const off = onSSE((data) => {
    if (data.resources.some(r => ['posts', 'comments', 'categories', 'pendingComments'].includes(r))) {
      loadData(true)
    }
  })
  return off
})
const statCards = $derived([
  { icon: 'mdi:pencil-outline', label: '文章总数', value: stats.totalPosts, colorClass: 'text-gray-700 dark:text-gray-300', bgClass: 'bg-gray-100/80 dark:bg-gray-700/50', href: '#/posts' },
  { icon: 'mdi:comment-outline', label: '评论总数', value: stats.totalComments, colorClass: 'text-green-500 dark:text-green-400', bgClass: 'bg-green-50/80 dark:bg-green-900/30', href: '#/comments' },
  { icon: 'mdi:clock-outline', label: '待审核评论', value: stats.pendingComments, colorClass: 'text-yellow-500 dark:text-yellow-400', bgClass: 'bg-yellow-50/80 dark:bg-yellow-900/30', href: '#/comments?filterStatus=pending' },
  { icon: 'mdi:folder-outline', label: '分类数量', value: stats.totalCategories, colorClass: 'text-purple-500 dark:text-purple-400', bgClass: 'bg-purple-50/80 dark:bg-purple-900/30', href: '#/categories' },
])
</script>
{#if loading}
  <div class="flex items-center justify-center h-64"><div class="text-gray-400 dark:text-gray-500">加载中...</div></div>
{:else}
  <div class="space-y-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each statCards as card (card.label)}
        <a href={card.href} class="block bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200">
          <div class="flex items-center gap-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl {card.bgClass} flex items-center justify-center"><Icon icon={card.icon} width="24" height="24" class={card.colorClass} /></div>
            <div><div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</div><div class="text-sm text-gray-500 dark:text-gray-400">{card.label}</div></div>
          </div>
        </a>
      {/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-gray-700">
        <div class="px-5 py-4 border-b border-white/30 dark:border-gray-700/30"><h3 class="font-semibold text-gray-900 dark:text-gray-100">最近文章</h3></div>
        <div class="divide-y divide-white/20 dark:divide-gray-700/20">
          {#if recentPosts.length === 0}<div class="px-5 py-8 text-center text-gray-400 dark:text-gray-500">暂无文章</div>
          {:else}{#each recentPosts as post (post.id)}
            <a href="#/posts/{post.id}/edit" class="block px-5 py-3 hover:bg-gray-100/60 dark:hover:bg-gray-700/60 transition-colors">
              <div class="flex items-center justify-between"><span class="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{post.title}</span><span class="text-xs px-2 py-0.5 rounded-full {post.draft ? 'bg-amber-50/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-green-50/80 dark:bg-green-900/30 text-green-700 dark:text-green-400'}">{post.draft ? '草稿' : '已发布'}</span></div>
            </a>
          {/each}{/if}
        </div>
      </div>
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-gray-700">
        <div class="px-5 py-4 border-b border-white/30 dark:border-gray-700/30"><h3 class="font-semibold text-gray-900 dark:text-gray-100">最近评论</h3></div>
        <div class="divide-y divide-white/20 dark:divide-gray-700/20">
          {#if recentComments.length === 0}<div class="px-5 py-8 text-center text-gray-400 dark:text-gray-500">暂无评论</div>
          {:else}{#each recentComments as comment (comment.id)}
            <div class="px-5 py-3"><div class="flex items-center justify-between mb-1"><span class="text-sm font-medium text-gray-900 dark:text-gray-100">{comment.username || '匿名'}</span><span class="text-xs text-gray-400 dark:text-gray-500">{formatDate(comment.created_at)}</span></div><p class="text-sm text-gray-500 dark:text-gray-400 truncate">{comment.content || ''}</p></div>
          {/each}{/if}
        </div>
      </div>
    </div>
  </div>
{/if}
