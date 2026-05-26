<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import CommentItem from './CommentItem.svelte';
  import i18nit from '../../i18n/translation.ts';
  import { parseMarkdown, validateMarkdown } from '@utils/markdown';
  import { siteConfig } from '@/config.ts';
  import { formatDateTime } from '@/utils/time';

  export let c: any;
  export let postSlug: string;
  export let replyingToId: number | null = null;
  export let author: string = '';
  export let email: string = '';
  export let url: string = '';
  export let language: string = 'zh-cn';
  export let bloggerBadgeEnabled: boolean = false;
  export let bloggerBadgeText: string = '博主';
  export let adminCommentKeyConfigured: boolean = false;

  export let depth: number = 0;
  export let isFlattened: boolean = false;
  export let parentAuthorName: string = '';
  export let parentCommentId: string | number | null = null;

  let isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false;

  onMount(() => {
    apiUrl = resolveApiUrl();
    const mql = window.matchMedia('(max-width: 767px)');
    isMobile = mql.matches;
    const listener = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  });

  const t = i18nit(language);

  let replyAuthor = '';
  let replyEmail = '';
  let replyUrl = '';
  let replyContent = '';
  let replyAdminKey = '';

  let replySubmitting = false;
  let replyShowPreview = false;
  let replyPreviewHtml = '';
  let replyMarkdownWarnings: string[] = [];

  // QQ 邮箱头像和昵称
  function getQQAvatar(emailStr: string): string {
    if (!emailStr) return '';
    const match = emailStr.match(/^(\d+)@qq\.com$/i);
    if (match) {
      return `https://q1.qlogo.cn/g?b=qq&nk=${match[1]}&s=100`;
    }
    return '';
  }

  function getQQNickname(emailStr: string): string | null {
    if (!emailStr) return null;
    const match = emailStr.match(/^(\d+)@qq\.com$/i);
    if (match) {
      return `QQ用户${match[1].slice(-4)}`;
    }
    return null;
  }

  $: displayAvatar = c.avatar || getQQAvatar(c.email) || '';
  $: displayAuthor = c.author || getQQNickname(c.email) || '匿名';

  $: isAdminEmail = adminCommentKeyConfigured;

  function toggleReplyPreview() {
    if (!replyShowPreview) {
      replyPreviewHtml = parseMarkdown(replyContent);
      replyMarkdownWarnings = validateMarkdown(replyContent);
    }
    replyShowPreview = !replyShowPreview;
  }

  const dispatch = createEventDispatcher();

  function getWordCount(text: string): { chars: number; words: number } {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { chars, words };
  }

  function isContentWithinLimit(text: string): boolean {
    const { chars, words } = getWordCount(text);
    return chars <= 2000 && words <= 1000;
  }

  let apiUrl = '';

  function resolveApiUrl() {
    if (siteConfig.comments.backendUrl) return siteConfig.comments.backendUrl;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }

  function flattenRepliesWithParent(replies: any[], pName: string, pId: any): any[] {
    if (!replies || !replies.length) return [];
    let res: any[] = [];
    for (const r of replies) {
      res.push({ ...r, _parentName: pName, _parentId: pId });
      if (r.replies && r.replies.length > 0) {
        res = res.concat(flattenRepliesWithParent(r.replies, r.author, r.id));
      }
    }
    return res;
  }

  $: mobileFlattenedReplies = (depth === 0 && c.replies)
    ? flattenRepliesWithParent(c.replies, c.author, c.id).sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime())
    : [];

</script>

<div id="comment-{c.id}" class="flex gap-2 md:gap-3 w-full max-w-full {c.deleted ? 'opacity-60' : ''}">
  {#if c.deleted}
    <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm shrink-0">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </div>
  {:else if c.url}
  <a href={c.url} target="_blank" rel="noopener noreferrer" class="w-10 h-10 shrink-0">
    {#if displayAvatar}
      <img src={displayAvatar} alt="avatar" class="w-10 h-10 rounded-full object-cover"/>
    {:else}
      <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
        {(displayAuthor || '?').charAt(0).toUpperCase()}
      </div>
    {/if}
  </a>
  {:else}
    {#if displayAvatar}
      <img src={displayAvatar} alt="avatar" class="w-10 h-10 rounded-full object-cover shrink-0"/>
    {:else}
      <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">
        {(displayAuthor || '?').charAt(0).toUpperCase()}
      </div>
    {/if}
  {/if}

  <div class="flex-1 min-w-0">
    {#if c.deleted}
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400 italic">该评论已删除</span>
        <span class="text-sm text-[var(--text-color-70)]">{formatDateTime(new Date(c.pubDate), language)}</span>
      </div>
    {:else}
    <div class="flex items-center flex-wrap gap-x-2 gap-y-1">
      {#if c.url}
        <a href={c.url} target="_blank" rel="noopener noreferrer" class="font-semibold text-[var(--text-color)] hover:text-[var(--link-color)] transition-colors">
          {displayAuthor}
        </a>
      {:else}
        <span class="font-semibold text-[var(--text-color)]">{displayAuthor}</span>
      {/if}

      {#if c.isAdmin || c.isBlogger}
        {#if bloggerBadgeText}
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{bloggerBadgeText}</span>
        {:else}
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">博主</span>
        {/if}
      {/if}

      {#if isFlattened && parentAuthorName}
        <span class="text-sm text-[var(--text-color-70)]">{t('comments.replyTo') || '回复'}</span>
        <a
          href="#comment-{parentCommentId}"
          class="text-sm font-semibold text-[var(--link-color)] hover:underline transition-colors"
          on:click|preventDefault={(e) => {
          const target = document.getElementById(`comment-${parentCommentId}`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            target.classList.add('highlight-flash');
            setTimeout(() => target.classList.remove('highlight-flash'), 2000);
          }
        }}>
          {parentAuthorName}
        </a>
      {/if}

      <span class="text-sm text-[var(--text-color-70)]">{formatDateTime(new Date(c.pubDate), language)}</span>
    </div>

    <div class="text-[var(--text-color)] mt-1 leading-relaxed w-full max-w-full min-w-0 text-sm comment-markdown">
      {#if c.contentText && typeof c.contentText === 'string' && c.contentText.trim() !== ''}
        <p class="break-words whitespace-pre-wrap w-full max-w-full min-w-0">
          {c.contentText}
        </p>
      {:else if c.content && typeof c.content === 'string' && c.content.trim() !== ''}
        <p class="break-words whitespace-pre-wrap w-full max-w-full min-w-0">
          {c.content}
        </p>
      {:else}
        <p class="break-words whitespace-pre-wrap w-full max-w-full min-w-0 text-gray-500">
          {t('comments.noContent') || '评论内容为空'}
        </p>
      {/if}
    </div>

    <div class="mt-1 flex items-center gap-4 text-sm text-[var(--text-color-70)]">
      <button on:click={() => {
        dispatch('reply', c.id);
        replyAuthor = author;
        replyEmail = email;
        replyUrl = url;
      }} class="hover:text-[var(--link-color)]">
        {t('comments.reply')}
      </button>
    </div>
    {/if}

    {#if replyingToId === c.id}
      <div transition:slide={{ duration: 300 }} class="mt-4 pl-4 border-l-2 border-gray-200">
        <form on:submit|preventDefault={() => {
          if (replySubmitting) return;

          if (!replyAuthor || !replyEmail || !replyContent) {
            dispatch('showToast', { message: t('comments.fillRequired') || '请填写昵称、邮箱和评论内容', type: 'warning' });
            return;
          }

          if (!isContentWithinLimit(replyContent)) {
            dispatch('showToast', { message: t('comments.contentTooLong') || '评论内容超出限制：不超过2000汉字或1000单词', type: 'warning' });
            return;
          }

          replySubmitting = true;
          dispatch('submit', {
            parentId: c.id,
            author: replyAuthor,
            email: replyEmail,
            url: replyUrl,
            content: replyContent,
            post_url: window.location.href,
            admin_key: replyAdminKey || undefined,
          });
          replyContent = '';
          replyAdminKey = '';
        }} class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label for="reply-email-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">
                {t('comments.email')}<span class="text-red-500">*</span>
                <span class="text-[10px] text-[var(--link-color)] ml-0.5">QQ邮箱自动获取</span>
              </label>
              <input id="reply-email-{c.id}" type="email" placeholder={t('comments.required')} bind:value={replyEmail}
                on:input={() => dispatch('userInfoChange', { author: replyAuthor, email: replyEmail, url: replyUrl })}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
            <div>
              <label for="reply-author-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.name')}<span class="text-red-500">*</span></label>
              <input id="reply-author-{c.id}" type="text" placeholder={t('comments.required')} bind:value={replyAuthor}
                on:input={() => dispatch('userInfoChange', { author: replyAuthor, email: replyEmail, url: replyUrl })}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
            <div>
              <label for="reply-url-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.site')}</label>
              <input id="reply-url-{c.id}" type="url" placeholder={t('comments.optional')} bind:value={replyUrl}
                on:input={() => dispatch('userInfoChange', { author: replyAuthor, email: replyEmail, url: replyUrl })}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
          </div>

          {#if adminCommentKeyConfigured && isAdminEmail}
            <div>
              <label for="reply-admin-key-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">管理员验证密钥<span class="text-red-500">*</span></label>
              <input id="reply-admin-key-{c.id}" type="password" placeholder="请输入管理员评论密钥" bind:value={replyAdminKey}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
          {/if}

          <div>
            {#if replyShowPreview}
              <div class="rounded border text-[var(--text-color)] border-[var(--button-border-color)] p-2 min-h-[80px] text-sm leading-relaxed comment-markdown">
                {#if replyContent.trim() === ''}
                  <p>{t('comments.preview') || '预览'}</p>
                {:else}
                  <div>{@html replyPreviewHtml}</div>
                {/if}
              </div>
              {#if replyMarkdownWarnings.length > 0}
                <div class="mt-1 text-xs text-amber-500">
                  {#each replyMarkdownWarnings as warning}
                    <p>{warning === 'codeFence' ? (t('comments.codeFence') || '代码块标记 ``` 未闭合') : (t('comments.inlineCode') || '行内代码标记 ` 未闭合')}</p>
                  {/each}
                </div>
              {/if}
            {:else}
              <textarea placeholder={t('comments.replyPlaceholder') || "写下你的回复..."}
                class="rounded w-full border text-[var(--text-color)] border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-2 min-h-[80px]"
                bind:value={replyContent}></textarea>
            {/if}
            <div class="text-right text-xs text-[var(--text-color)]/70 mt-1">
              {#if !isContentWithinLimit(replyContent)}
                <span class="text-red-500 ml-2">{t('comments.contentTooLong') || '内容超出限制'}</span>
              {/if}
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" on:click={toggleReplyPreview}
              class="rounded px-3 py-1 text-sm text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)]">
              {replyShowPreview ? (t('comments.write') || '撰写') : (t('comments.preview') || '预览')}
            </button>
            <button type="button" on:click={() => {
              dispatch('cancel');
              replySubmitting = false;
            }} class="rounded px-3 py-1 text-sm text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)]">
              {t('comments.cancel')}
            </button>
            <button type="submit" disabled={replySubmitting || !isContentWithinLimit(replyContent)} class="rounded px-3 py-1 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)] disabled:opacity-50">
              {replySubmitting ? t('comments.sending') : t('comments.reply')}
            </button>
          </div>
        </form>
      </div>
    {/if}

    <div class="border-l border-[var(--text-color)]/50 space-y-3 w-full pl-2 md:pl-3">
    {#if !isMobile}
      {#if c.replies && c.replies.length}
        {#each c.replies as reply (reply.id)}
          <div class="w-full mt-4">
            <CommentItem
              c={reply}
              {postSlug}
              {author}
              {email}
              {url}
              {language}
              {bloggerBadgeEnabled}
              {bloggerBadgeText}
              {adminCommentKeyConfigured}
              depth={depth + 1}
              isFlattened={false}
              on:reply={(e) => dispatch('reply', e.detail)}
              on:submit={(e) => dispatch('submit', e.detail)}
              on:cancel={() => dispatch('cancel')}
              replyingToId={replyingToId}
              on:userInfoChange={(e) => dispatch('userInfoChange', e.detail)}
              on:showToast
            />
          </div>
        {/each}
      {/if}
    {:else}
      {#if depth === 0 && mobileFlattenedReplies.length > 0}
        {#each mobileFlattenedReplies as flatReply (flatReply.id)}
          <div class="w-full mt-4">
            <CommentItem
              c={flatReply}
              {postSlug}
              {author}
              {email}
              {url}
              {language}
              {bloggerBadgeEnabled}
              {bloggerBadgeText}
              {adminCommentKeyConfigured}
              depth={1}
              isFlattened={true}
              parentAuthorName={flatReply._parentName}
              parentCommentId={flatReply._parentId}
              on:reply={(e) => dispatch('reply', e.detail)}
              on:submit={(e) => dispatch('submit', e.detail)}
              on:cancel={() => dispatch('cancel')}
              replyingToId={replyingToId} on:userInfoChange={(e) => dispatch('userInfoChange', e.detail)}
              on:showToast
            />
          </div>
        {/each}
      {/if}
    {/if}
  </div>
  </div>
</div>

<style>
  .comment-markdown :global(h1),
  .comment-markdown :global(h2),
  .comment-markdown :global(h3),
  .comment-markdown :global(h4) {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .comment-markdown :global(h1) { font-size: 1.5rem; }
  .comment-markdown :global(h2) { font-size: 1.25rem; }
  .comment-markdown :global(h3) { font-size: 1.1rem; }
  .comment-markdown :global(p) { margin-bottom: 0.5rem; }
  .comment-markdown :global(ul),
  .comment-markdown :global(ol) {
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
  }
  .comment-markdown :global(ul) { list-style-type: disc; }
  .comment-markdown :global(ol) { list-style-type: decimal; }
  .comment-markdown :global(li) { margin-bottom: 0.25rem; }
  .comment-markdown :global(blockquote) {
    border-left: 3px solid var(--link-color, #6366f1);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    opacity: 0.85;
  }
  .comment-markdown :global(pre) {
    background: rgba(0,0,0,0.08);
    border-radius: 4px;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
    font-size: 0.85rem;
  }
  .comment-markdown :global(code) {
    background: rgba(0,0,0,0.06);
    border-radius: 3px;
    padding: 0.15rem 0.3rem;
    font-size: 0.85rem;
    font-family: monospace;
  }
  .comment-markdown :global(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
  }
  .comment-markdown :global(a) {
    color: var(--link-color, #6366f1);
    text-decoration: underline;
  }
  .comment-markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.5rem 0;
  }
  .comment-markdown :global(hr) {
    border: none;
    border-top: 1px solid var(--button-border-color, #ddd);
    margin: 1rem 0;
  }
  .comment-markdown :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  .comment-markdown :global(th),
  .comment-markdown :global(td) {
    border: 1px solid var(--button-border-color, #ddd);
    padding: 0.4rem 0.6rem;
    text-align: left;
  }
  .comment-markdown :global(th) {
    font-weight: 600;
    background: rgba(0,0,0,0.04);
  }
  .comment-markdown :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>
