<script lang="ts">
  import { onMount } from 'svelte';
  import { siteConfig } from '@/config.ts';
  import CommentItem from './CommentItem.svelte';
  import i18nit from '../../i18n/translation.ts';
  import { parseMarkdown, validateMarkdown } from '@utils/markdown';
  import { fly } from 'svelte/transition';

  export let postSlug: string;
  export let language: string = 'zh-cn';
  export let postTitle: string;

  const t = i18nit(language);
  let apiUrl = '';

  function resolveApiUrl() {
    if (siteConfig.comments.backendUrl) return siteConfig.comments.backendUrl;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }

  let comments: any[] = [];
  let loading = true;
  let loadingMore = false;
  let error = '';
  let page = 1;
  let limit = 20;
  let hasMore = false;

  let bloggerBadgeEnabled = false;
  let bloggerBadgeText = '';
  let placeholderName = '';
  let placeholderEmail = '';
  let placeholderContent = '';
  let placeholderUrl = '';
  let adminCommentKeyConfigured = false;
  let adminKey = '';
  let isAdminEmail = false;

  // Toast 弹窗状态
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'warning' | 'info' = 'info';
  let showToast = false;
  let toastTimer: any = null;

  function showToastMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    toastMessage = message;
    toastType = type;
    showToast = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { showToast = false; }, 3000);
  }

  $: isAdminEmail = adminCommentKeyConfigured;

  let author = '';
  let email = '';
  let url = '';
  let content = '';
  let submitting = false;

  // 表单验证状态
  let showValidationErrors = false;
  let validationErrors = { author: false, email: false, content: false };

  function validateForm(): boolean {
    validationErrors = {
      author: !author.trim(),
      email: !email.trim(),
      content: !content.trim()
    };
    showValidationErrors = true;
    return !validationErrors.author && !validationErrors.email && !validationErrors.content;
  }

  function clearValidation(field: string) {
    if (showValidationErrors) {
      validationErrors = { ...validationErrors, [field]: false };
    }
  }

  function getQQAvatar(emailStr: string): string {
    if (!emailStr) return '';
    const match = emailStr.match(/^(\d{5,11})@qq\.com$/i);
    if (match) return `https://q1.qlogo.cn/g?b=qq&nk=${match[1]}&s=100`;
    return '';
  }

  $: currentAvatar = getQQAvatar(email);

  let qqNicknameLoading = false;
  let qqDebounceTimer: any = null;

  function handleEmailInput() {
    if (qqDebounceTimer) clearTimeout(qqDebounceTimer);
    qqDebounceTimer = setTimeout(async () => {
      if (!email) return;
      const match = email.match(/^(\d{5,11})@qq\.com$/i);
      if (!match) return;
      const qq = match[1];

      qqNicknameLoading = true;
      try {
        const res = await fetch(`${apiUrl}/api/comments/qq-info?qq=${qq}`);
        const data = await res.json();
        if (data.success && data.data.nickname && data.data.nickname.length >= 2 && !data.data.nickname.startsWith('QQ用户')) {
          author = data.data.nickname;
        } else {
          author = `QQ用户${qq.slice(-4)}`;
        }
      } catch (e) {
        author = `QQ用户${qq.slice(-4)}`;
      } finally {
        qqNicknameLoading = false;
      }
    }, 500);
  }
  let replyingToId: number | null = null;
  let showPreview = false;
  let previewHtml = '';
  let markdownWarnings: string[] = [];

  function togglePreview() {
    if (!showPreview) {
      previewHtml = parseMarkdown(content);
      markdownWarnings = validateMarkdown(content);
    }
    showPreview = !showPreview;
  }

  const STORAGE_KEY = 'comment_user_info';
  const STORAGE_KEY_DRAFT = 'lihui_comment_draft';
  let loaded = false;

  function loadUserInfoFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userInfo = JSON.parse(stored);
        author = userInfo.author || '';
        email = userInfo.email || '';
        url = userInfo.url || '';
      }
    } catch (e) {
      console.warn('Failed to load user info from localStorage:', e);
    }
  }

  let saveTimer = null;
  $: if (loaded) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ author, email, url }));
      if (content) {
        localStorage.setItem(STORAGE_KEY_DRAFT, content);
      } else {
        localStorage.removeItem(STORAGE_KEY_DRAFT);
      }
    }, 500);
  }

  function getWordCount(text: string): { chars: number; words: number } {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { chars, words };
  }

  function isContentWithinLimit(text: string): boolean {
    const { chars, words } = getWordCount(text);
    return chars <= 2000 && words <= 1000;
  }

  function countComments(comments: any[]): number {
    let count = 0;
    for (const c of comments) {
      count += 1;
      if (c.replies && c.replies.length > 0) {
        count += countComments(c.replies);
      }
    }
    return count;
  }

  async function loadComments(loadMore = false) {
    if (loadMore) {
      loadingMore = true;
    } else {
      loading = true;
    }
    try {
      const res = await fetch(
        `${apiUrl}/api/comments?post_slug=${encodeURIComponent(postSlug)}&nested=true&page=${page}&limit=${limit}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(t('comments.loadFailed') || '加载失败');
      const data = await res.json();
      const newComments = data.data?.comments || [];
      if (page === 1) {
        comments = newComments;
      } else {
        comments = [...comments, ...newComments];
      }
      hasMore = (data.data?.pagination?.totalPage || 0) > page;
      bloggerBadgeEnabled = data.data.blogger_badge_enabled === 'true';
      bloggerBadgeText = data.data.blogger_badge_text || '';
      placeholderName = data.data.placeholder_name || '';
      placeholderEmail = data.data.placeholder_email || '';
      placeholderContent = data.data.placeholder_content || '';
      placeholderUrl = data.data.placeholder_url || '';
      adminCommentKeyConfigured = data.data.admin_comment_key_configured === 'true';
      if (!adminCommentKeyConfigured) adminKey = '';
    } catch (err: any) {
      error = err.message;
    } finally {
      if (loadMore) loadingMore = false;
      else loading = false;
    }
  }

  async function submitComment(parentId: number | null = null, replyData: any = null) {
    if (submitting) return;

    let submitAuthor, submitEmail, submitUrl, submitContent, submitAdminKey;

    if (replyData) {
      submitAuthor = replyData.author;
      submitEmail = replyData.email;
      submitUrl = replyData.url;
      submitContent = replyData.content;
      submitAdminKey = replyData.admin_key;
    } else {
      submitAuthor = author;
      submitEmail = email;
      submitUrl = url;
      submitContent = content;
      submitAdminKey = adminKey;
    }

    if (!submitAuthor || !submitEmail || !submitContent) {
      if (!replyData) {
        validateForm();
      }
      showToastMessage(t('comments.fillRequired') || '请填写昵称、邮箱和评论内容', 'warning');
      return;
    }

    if (!isContentWithinLimit(submitContent)) {
      showToastMessage(t('comments.contentTooLong') || '评论内容超出限制：不超过2000汉字或1000单词', 'warning');
      return;
    }

    if (!parentId) {
      submitting = true;
    }

    try {
      const res = await fetch(`${apiUrl}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          post_slug: postSlug,
          author: submitAuthor,
          email: submitEmail,
          url: submitUrl || null,
          content: submitContent,
          parent_id: parentId,
          post_url: window.location.href,
          post_title: postTitle,
          admin_key: submitAdminKey || undefined,
        }),
      });
      const data = await res.json();
      showToastMessage(data.message || t('comments.submitSuccess') || '提交成功', 'success');

      if (!replyData) {
        content = '';
        localStorage.removeItem(STORAGE_KEY_DRAFT);
      }
      replyingToId = null;
      await loadComments();
    } catch (err) {
      showToastMessage(t('comments.submitFailed') || '提交失败，请稍后再试', 'error');
    } finally {
      if (!parentId) {
        submitting = false;
      }
    }
  }

  async function handleCommentDelete(e: CustomEvent) {
    await loadComments();
  }

  function setReplyingTo(id: number | null) {
    replyingToId = id;
  }

  onMount(() => {
    apiUrl = resolveApiUrl();
    loadUserInfoFromStorage();
    const draft = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (draft) content = draft;
    loaded = true;
    loadComments();
  });
</script>

<!-- Toast 弹窗 -->
{#if showToast}
  <div class="fixed top-4 right-4 z-[100]" transition:fly={{ x: 100, duration: 300 }}>
    <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg max-w-[360px]"
      class:bg-[#ecfdf5]={toastType === 'success'}
      class:border-[#bbf7d0]={toastType === 'success'}
      class:text-[#166534]={toastType === 'success'}
      class:bg-[#fef2f2]={toastType === 'error'}
      class:border-[#fecaca]={toastType === 'error'}
      class:text-[#991b1b]={toastType === 'error'}
      class:bg-[#fffbeb]={toastType === 'warning'}
      class:border-[#fde68a]={toastType === 'warning'}
      class:text-[#92400e]={toastType === 'warning'}
      class:bg-[#eff6ff]={toastType === 'info'}
      class:border-[#bfdbfe]={toastType === 'info'}
      class:text-[#1e40af]={toastType === 'info'}
    >
      {#if toastType === 'success'}
        <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      {:else if toastType === 'error'}
        <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      {:else if toastType === 'warning'}
        <svg class="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      {:else}
        <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      {/if}
      <span class="text-sm font-medium">{toastMessage}</span>
      <button on:click={() => showToast = false} class="ml-1 hover:opacity-60">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  </div>
{/if}

<div class="mt-4 max-w-3xl mx-auto border-t border-[var(--button-border-color)]" id="comments">
  <div class="mt-4">
    <form on:submit|preventDefault={() => submitComment()} class="space-y-4">
      <div class="flex gap-3">
        <div class="shrink-0 pt-6">
          {#if currentAvatar}
            <img src={currentAvatar} alt="avatar" class="w-10 h-10 rounded-full object-cover" />
          {:else}
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
              {author ? author.charAt(0).toUpperCase() : '?'}
            </div>
          {/if}
        </div>
        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="">
            <label for="email" class="block text-sm text-[var(--text-color)] mb-1">
              {t('comments.email')}<span class="text-red-500">*</span>
              <span class="text-xs text-[var(--link-color)] ml-1">输入QQ邮箱自动获取头像和昵称</span>
            </label>
            <input id="email" type="email" placeholder={placeholderEmail || t('comments.required')} bind:value={email}
              on:input={() => { handleEmailInput(); clearValidation('email'); }}
              class="rounded w-full text-[var(--text-color)] border text-sm p-2 transition-colors
                {showValidationErrors && validationErrors.email ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)]'}" />
            {#if showValidationErrors && validationErrors.email}
              <p class="text-xs text-red-500 mt-1">请输入邮箱</p>
            {/if}
          </div>
          <div class="">
            <label for="author" class="block text-sm text-[var(--text-color)] mb-1">
              {t('comments.name')}<span class="text-red-500">*</span>
              {#if qqNicknameLoading}
                <span class="text-xs text-[var(--text-color-70)] ml-1">获取中...</span>
              {/if}
            </label>
            <input id="author" type="text" placeholder={placeholderName || t('comments.required')} bind:value={author}
              on:input={() => clearValidation('author')}
              class="rounded w-full text-[var(--text-color)] border text-sm p-2 transition-colors
                {showValidationErrors && validationErrors.author ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)]'}" />
            {#if showValidationErrors && validationErrors.author}
              <p class="text-xs text-red-500 mt-1">请输入昵称</p>
            {/if}
          </div>
          <div class="">
            <label for="url" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.site')}</label>
            <input id="url" type="url" placeholder={placeholderUrl || t('comments.optional')} bind:value={url}
              class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
          </div>

          {#if adminCommentKeyConfigured && isAdminEmail}
            <div>
              <label for="admin-key" class="block text-sm text-[var(--text-color)] mb-1">管理员验证密钥<span class="text-red-500">*</span></label>
              <input id="admin-key" type="password" placeholder="请输入管理员评论密钥" bind:value={adminKey}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
            </div>
          {/if}
        </div>
      </div>

       <div>
        {#if showPreview}
          <div class="rounded border text-[var(--text-color)] border-[var(--button-border-color)] p-3 min-h-[100px] text-sm leading-relaxed comment-preview">
            {#if content.trim() === ''}
              <p>{t('comments.preview') || '预览'}</p>
            {:else}
              <div>{@html previewHtml}</div>
            {/if}
          </div>
          {#if markdownWarnings.length > 0}
            <div class="mt-1 text-xs text-amber-500">
              {#each markdownWarnings as warning}
                <p>{warning === 'codeFence' ? (t('comments.codeFence') || '代码块标记 ``` 未闭合') : (t('comments.inlineCode') || '行内代码标记 ` 未闭合')}</p>
              {/each}
            </div>
          {/if}
        {:else}
          <textarea placeholder={placeholderContent || t('comments.welcome')}
            class="rounded w-full border text-[var(--text-color)] text-sm p-3 min-h-[100px] transition-colors
              {showValidationErrors && validationErrors.content ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)]'}"
            bind:value={content}
            on:input={() => clearValidation('content')}></textarea>
          {#if showValidationErrors && validationErrors.content}
            <p class="text-xs text-red-500 mt-1">请输入评论内容</p>
          {/if}
        {/if}

        <div class="text-right text-sm text-[var(--text-color)]/70 mt-1">
          {#if !isContentWithinLimit(content)}
            <span class="text-red-500 ml-2">{t('comments.contentTooLong') || '内容超出限制'}</span>
          {/if}
        </div>
      </div>

      <div class="flex justify-end gap-3">
      <button type="button" on:click={togglePreview}
          class="rounded px-4 py-2 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)]">
          {showPreview ? t('comments.write') : t('comments.preview')}
        </button>
        <button type="submit" disabled={submitting || !isContentWithinLimit(content)}
          class="rounded px-4 py-2 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)] disabled:opacity-50">
          {submitting ? t('comments.sending') : t('comments.send')}
        </button>
      </div>
    </form>
  </div>

  <div class="" id="comments-content">
    {#if !loadingMore && loading}
      <p class="text-[var(--text-color)] text-center">{t('comments.loading') || '正在加载评论...'}</p>
    {:else if error}
      <p class="text-red-500 text-center">{t('comments.loadFailed') || '加载失败：'}{error}</p>
    {:else}
      <h4 class="text-[var(--text-color)] text-base font-semibold mb-4">{countComments(comments)} {t('comments.comments')}</h4>

      <div class="space-y-6">
        {#each comments as c (c.id)}
          <div>
            <CommentItem {c} {postSlug} {author} {email} {url} {language}
              {bloggerBadgeEnabled} {bloggerBadgeText}
              {adminCommentKeyConfigured}
              on:reply={(e) => setReplyingTo(e.detail)}
              on:cancel={() => setReplyingTo(null)}
              on:submit={async (e) => {
                await submitComment(e.detail.parentId, e.detail);
              }}
              on:delete={handleCommentDelete}
              replyingToId={replyingToId}
              on:userInfoChange={(e) => {
                author = e.detail.author;
                email = e.detail.email;
                url = e.detail.url;
              }}
              on:showToast={(e) => showToastMessage(e.detail.message, e.detail.type)} />
          </div>
        {/each}
      </div>

      {#if hasMore}
        <div class="flex justify-center mt-8">
          <button on:click={() => { page++; loadComments(true); }}
            disabled={loadingMore}
            class="px-6 py-2.5 rounded-lg border border-[var(--button-border-color)] text-sm font-medium text-[var(--text-color)] bg-transparent hover:bg-[var(--button-hover-color)] hover:border-[var(--link-color)] transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {#if loadingMore}
              <svg class="animate-spin h-4 w-4 text-[var(--text-color)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            {loadingMore ? (t('comments.loading') || '加载中...') : (t('comments.loadMore') || '加载更多')}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .comment-preview :global(h1),
  .comment-preview :global(h2),
  .comment-preview :global(h3),
  .comment-preview :global(h4) {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .comment-preview :global(h1) { font-size: 1.5rem; }
  .comment-preview :global(h2) { font-size: 1.25rem; }
  .comment-preview :global(h3) { font-size: 1.1rem; }
  .comment-preview :global(p) { margin-bottom: 0.5rem; }
  .comment-preview :global(ul),
  .comment-preview :global(ol) {
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
  }
  .comment-preview :global(ul) { list-style-type: disc; }
  .comment-preview :global(ol) { list-style-type: decimal; }
  .comment-preview :global(li) { margin-bottom: 0.25rem; }
  .comment-preview :global(blockquote) {
    border-left: 3px solid var(--link-color, #6366f1);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    opacity: 0.85;
  }
  .comment-preview :global(pre) {
    background: rgba(0,0,0,0.08);
    border-radius: 4px;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
    font-size: 0.85rem;
  }
  .comment-preview :global(code) {
    background: rgba(0,0,0,0.06);
    border-radius: 3px;
    padding: 0.15rem 0.3rem;
    font-size: 0.85rem;
    font-family: monospace;
  }
  .comment-preview :global(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
  }
  .comment-preview :global(a) {
    color: var(--link-color, #6366f1);
    text-decoration: underline;
  }
  .comment-preview :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.5rem 0;
  }
  .comment-preview :global(hr) {
    border: none;
    border-top: 1px solid var(--button-border-color, #ddd);
    margin: 1rem 0;
  }
  .comment-preview :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  .comment-preview :global(th),
  .comment-preview :global(td) {
    border: 1px solid var(--button-border-color, #ddd);
    padding: 0.4rem 0.6rem;
    text-align: left;
  }
  .comment-preview :global(th) {
    font-weight: 600;
    background: rgba(0,0,0,0.04);
  }
  .comment-preview :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>
