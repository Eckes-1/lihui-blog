<script>
import { auth, email } from '../api.js'
import { addToast, getThemeMode } from '../stores.svelte.js'
import { onMount, onDestroy } from 'svelte'

let username = $state('')
let password = $state('')
let code = $state('')
let emailAddr = $state('')
let loading = $state(false)
let error = $state('')
let emailRequired = $state(false)
let sendingCode = $state(false)
let countdown = $state(0)
let countdownTimer = null

let turnstileSiteKey = $state(null)
let turnstileEnabled = $state(false)
let turnstileToken = $state(null)
let turnstileVerified = $state(false)
let turnstileWidgetId = null
let turnstileLoading = $state(false)
let turnstileError = $state(false)

let currentTheme = $derived(getThemeMode())

async function checkEmailConfig() {
  try {
    const res = await email.configured()
    emailRequired = res.configured === true
  } catch {
    emailRequired = false
  }
}

async function checkTurnstile() {
  try {
    const res = await fetch('/api/auth/turnstile-sitekey')
    const data = await res.json()
    if (data.enabled && data.siteKey) {
      turnstileSiteKey = data.siteKey
      turnstileEnabled = true
    }
  } catch {
    turnstileEnabled = false
  }
}

function waitForTurnstile(timeout = 15000) {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve(true)
    const start = Date.now()
    const check = () => {
      if (window.turnstile) return resolve(true)
      if (Date.now() - start > timeout) return resolve(false)
      setTimeout(check, 100)
    }
    check()
  })
}

function turnstileAction(node) {
  let widgetId = null
  let rendered = false

  async function render() {
    turnstileLoading = true
    turnstileError = false
    const available = await waitForTurnstile()
    if (!available || !turnstileSiteKey || rendered) {
      turnstileLoading = false
      turnstileError = !available
      return
    }
    rendered = true
    try {
      const isDark = currentTheme === 'dark' || (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      widgetId = window.turnstile.render(node, {
        sitekey: turnstileSiteKey,
        callback: (token) => {
          turnstileToken = token
          turnstileVerified = true
          turnstileLoading = false
        },
        'error-callback': () => {
          turnstileToken = null
          turnstileVerified = false
          turnstileLoading = false
          turnstileError = true
        },
        'expired-callback': () => {
          turnstileToken = null
          turnstileVerified = false
          turnstileLoading = false
        },
        'timeout-callback': () => {
          turnstileToken = null
          turnstileVerified = false
          turnstileLoading = false
          turnstileError = true
        },
        'after-interactive-callback': () => {
          turnstileLoading = false
        },
        'before-interactive-callback': () => {
          turnstileLoading = true
        },
        theme: isDark ? 'dark' : 'light',
        size: 'normal',
        appearance: 'always',
        'refresh-expired': 'auto',
      })
      turnstileWidgetId = widgetId
    } catch (e) {
      turnstileError = true
      turnstileLoading = false
    }
  }

  render()

  return {
    destroy() {
      if (window.turnstile && widgetId !== null) {
        try { window.turnstile.remove(widgetId) } catch {}
      }
      rendered = false
    }
  }
}

function resetTurnstile() {
  if (window.turnstile && turnstileWidgetId !== null) {
    try { window.turnstile.reset(turnstileWidgetId) } catch {}
  }
  turnstileToken = null
  turnstileVerified = false
  turnstileLoading = true
  turnstileError = false
}

onMount(async () => {
  await Promise.all([checkEmailConfig(), checkTurnstile()])
})

onDestroy(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

let captchaSvg = $state('')
let captchaId = $state('')
let captchaAnswer = $state('')
let showCaptcha = $state(false)
let captchaLoading = $state(false)
let captchaError = $state('')

async function loadCaptcha() {
  try {
    const res = await fetch('/api/auth/captcha')
    const data = await res.json()
    captchaId = data.captchaId
    captchaSvg = data.svg
    captchaAnswer = ''
    captchaError = ''
  } catch {
    captchaError = '加载验证码失败'
  }
}

async function openCaptchaModal() {
  if (!emailAddr) {
    error = '请输入管理员邮箱'
    return
  }
  showCaptcha = true
  await loadCaptcha()
}

async function verifyCaptchaAndSend() {
  if (!captchaAnswer.trim()) {
    captchaError = '请输入验证码'
    return
  }
  captchaLoading = true
  captchaError = ''
  try {
    const res = await fetch('/api/auth/verify-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaId, captchaAnswer: captchaAnswer.trim() })
    })
    const data = await res.json()
    if (!res.ok) {
      captchaError = data.error || '验证失败'
      await loadCaptcha()
      return
    }
    showCaptcha = false
    await doSendCode(data.captchaToken)
  } catch {
    captchaError = '验证失败，请重试'
    await loadCaptcha()
  } finally {
    captchaLoading = false
  }
}

async function doSendCode(captchaToken) {
  sendingCode = true
  error = ''
  try {
    await email.sendCode(emailAddr, captchaToken)
    addToast('验证码已发送', 'success')
    countdown = 60
    countdownTimer = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch (e) {
    error = e.message || '发送验证码失败'
  } finally {
    sendingCode = false
  }
}

async function sendVerifyCode() {
  if (!emailAddr) {
    error = '请输入管理员邮箱'
    return
  }
  openCaptchaModal()
}

async function handleLogin() {
  if (!username || !password) {
    error = '请输入用户名和密码'
    return
  }
  if (emailRequired && (!code || !emailAddr)) {
    error = '请输入邮箱和验证码'
    return
  }
  if (turnstileEnabled && !turnstileVerified) {
    error = '请完成人机验证'
    return
  }
  loading = true
  error = ''
  try {
    const data = await auth.login(username, password, code, emailAddr, turnstileToken)
    addToast('登录成功', 'success')
    location.hash = '#/'
  } catch (e) {
    error = e.message || '登录失败'
    resetTurnstile()
  } finally {
    loading = false
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !turnstileEnabled) handleLogin()
}
</script>

<div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#f5f5f7] dark:bg-[#0f1117]">
  <div class="absolute top-[-15%] left-[-10%] w-[50%] h-[60%] bg-gray-200/60 dark:bg-gray-700/20 rounded-full filter blur-[100px] pointer-events-none"></div>
  <div class="absolute bottom-[-15%] right-[-10%] w-[45%] h-[55%] bg-gray-300/40 dark:bg-gray-600/15 rounded-full filter blur-[120px] pointer-events-none"></div>

  <div class="z-10 w-full max-w-[420px] px-6">
    <div class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl p-10 rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div class="flex flex-col items-center mb-8">
        <div class="flex items-center gap-2">
          <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-100">
            <span class="text-sm font-bold text-white dark:text-gray-900">M</span>
          </div>
          <h2 class="text-gray-900 dark:text-gray-100 text-2xl font-bold tracking-tight">欢迎登录管理后台</h2>
        </div>
      </div>

      {#if error}
        <div class="mb-4 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/30 backdrop-blur border border-red-200/50 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      {/if}

      <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleLogin() }}>
        <div class="space-y-1">
          <input
            type="text"
            bind:value={username}
            onkeydown={handleKeydown}
            placeholder="用户名"
            autocomplete="username"
            class="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 backdrop-blur border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-gray-300/50 dark:focus:ring-gray-500/50 transition-all outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div class="space-y-1">
          <input
            type="password"
            bind:value={password}
            onkeydown={handleKeydown}
            placeholder="密码"
            autocomplete="current-password"
            class="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 backdrop-blur border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-gray-300/50 dark:focus:ring-gray-500/50 transition-all outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {#if emailRequired}
          <div class="space-y-1">
            <input
              type="email"
              bind:value={emailAddr}
              onkeydown={handleKeydown}
              placeholder="管理员邮箱"
              autocomplete="email"
              class="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 backdrop-blur border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-gray-300/50 dark:focus:ring-gray-500/50 transition-all outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <div class="flex gap-2">
            <div class="flex-1">
              <input
                type="text"
                bind:value={code}
                onkeydown={handleKeydown}
                placeholder="验证码"
                maxlength="6"
                class="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 backdrop-blur border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-gray-300/50 dark:focus:ring-gray-500/50 transition-all outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 tracking-widest"
              />
            </div>
            <button
              type="button"
              onclick={sendVerifyCode}
              disabled={sendingCode || countdown > 0 || !emailAddr}
              class="px-4 py-3 bg-blue-600/80 backdrop-blur text-white rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
            >
              {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
            </button>
          </div>
        {/if}

        {#if turnstileEnabled && turnstileSiteKey}
          <div class="flex flex-col items-center gap-2">
            <div use:turnstileAction></div>
            {#if turnstileLoading}
              <p class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                人机验证加载中...
              </p>
            {/if}
            {#if turnstileError}
              <div class="flex items-center gap-2">
                <p class="text-xs text-red-500 dark:text-red-400">人机验证加载失败</p>
                <button type="button" onclick={resetTurnstile} class="text-xs text-blue-600 dark:text-blue-400 hover:underline">重试</button>
              </div>
            {/if}
            {#if turnstileVerified}
              <p class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                验证通过
              </p>
            {/if}
          </div>
        {/if}

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            onclick={() => { username = ''; password = ''; code = ''; emailAddr = ''; error = ''; resetTurnstile() }}
            class="flex-1 py-3 bg-white/40 dark:bg-gray-700/40 backdrop-blur text-gray-600 dark:text-gray-300 rounded-full font-bold border border-white/50 dark:border-gray-600/50 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
          >
            清除
          </button>
          <button
            type="submit"
            disabled={loading || (turnstileEnabled && !turnstileVerified)}
            class="flex-1 py-3 bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur text-white dark:text-gray-900 rounded-full font-bold hover:bg-gray-900 dark:hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '验证中...' : '登录'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

{#if showCaptcha}
  <div class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onclick={() => showCaptcha = false}>
    <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-2xl rounded-2xl shadow-lg p-6 w-80 mx-3 border border-white/20 dark:border-gray-700/20" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 text-center">请完成图形验证码</h3>
      <div class="flex justify-center mb-3">
        {#if captchaSvg}
          <div class="cursor-pointer rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:opacity-80 transition-opacity" onclick={loadCaptcha} title="点击刷新">
            {@html captchaSvg}
          </div>
        {:else}
          <div class="w-40 h-[60px] bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <p class="text-xs text-gray-400 dark:text-gray-500">加载中...</p>
          </div>
        {/if}
      </div>
      <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center mb-3">点击图片可刷新验证码</p>
      {#if captchaError}
        <p class="text-xs text-red-500 dark:text-red-400 text-center mb-2">{captchaError}</p>
      {/if}
      <div class="flex gap-2 mb-4">
        <input
          type="text"
          bind:value={captchaAnswer}
          placeholder="请输入验证码"
          maxlength="6"
          class="flex-1 px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-center text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 tracking-widest text-lg font-medium outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
          onkeydown={(e) => { if (e.key === 'Enter') verifyCaptchaAndSend() }}
        />
      </div>
      <div class="flex gap-2">
        <button
          onclick={() => showCaptcha = false}
          class="flex-1 py-2 bg-white/40 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300 rounded-full text-sm font-medium border border-white/50 dark:border-gray-600/50 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
        >
          取消
        </button>
        <button
          onclick={verifyCaptchaAndSend}
          disabled={captchaLoading || !captchaAnswer.trim()}
          class="flex-1 py-2 bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900 rounded-full text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {captchaLoading ? '验证中...' : '确认'}
        </button>
      </div>
    </div>
  </div>
{/if}
