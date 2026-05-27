<script>
import { email } from '../api.js'
import { addToast } from '../stores.svelte.js'
import { onMount } from 'svelte'
import Icon from '@iconify/svelte'

let loading = $state(true)
let saving = $state(false)
let emailSettings = $state({
  user: '', pass: '', fromName: '', emailMode: 'smtp',
  smtpHost: 'smtp.qq.com', smtpPort: '465',
  resendKey: '', resendFrom: ''
})
let emailConfigured = $state(false)
let testing = $state(false)
let testTo = $state('')
let savedPass = $state('')
let savedResendKey = $state('')
let activeTab = $state('config')
let stats = $state({ total: 0, success: 0, failed: 0, last24h: 0 })
let logs = $state([])
let diagnosing = $state(false)
let diagnoseResult = $state(null)

let turnstileSettings = $state({ siteKey: '', secretKey: '' })
let savedSecretKey = $state('')
let turnstileSaving = $state(false)
let turnstileEnabled = $state(false)

const smtpPresets = [
  { name: 'QQ 邮箱', host: 'smtp.qq.com', port: '465' },
  { name: '163 邮箱', host: 'smtp.163.com', port: '465' },
  { name: '126 邮箱', host: 'smtp.126.com', port: '465' },
  { name: 'Gmail', host: 'smtp.gmail.com', port: '465' },
  { name: 'Outlook', host: 'smtp.office365.com', port: '587' },
  { name: '阿里企业邮', host: 'smtp.qiye.aliyun.com', port: '465' },
  { name: '腾讯企业邮', host: 'smtp.exmail.qq.com', port: '465' },
]

function onPresetSelect(e) {
  const preset = smtpPresets.find(p => p.host === e.target.value)
  if (preset) {
    emailSettings.smtpHost = preset.host
    emailSettings.smtpPort = preset.port
  }
}

async function loadConfig() {
  loading = true
  try {
    const data = await email.getConfig()
    const MASK = '••••••'
    savedPass = data.pass === MASK ? MASK : ''
    savedResendKey = data.resendKey === MASK ? MASK : ''
    emailSettings = {
      user: data.user || '',
      pass: '',
      fromName: data.fromName || '',
      emailMode: data.emailMode || 'smtp',
      smtpHost: data.smtpHost || 'smtp.qq.com',
      smtpPort: data.smtpPort || '465',
      resendKey: '',
      resendFrom: data.resendFrom || '',
    }
    updateConfigured()
  } catch (e) {
    addToast('加载配置失败: ' + (e.message || ''), 'error')
  } finally {
    loading = false
  }
}

function updateConfigured() {
  if (emailSettings.emailMode === 'smtp') {
    emailConfigured = !!(emailSettings.user && emailSettings.pass && emailSettings.smtpHost)
  } else {
    emailConfigured = !!emailSettings.resendKey
  }
}

async function loadStats() {
  try { stats = await email.getStats() } catch {}
}

async function loadLogs() {
  try { logs = await email.getLogs(30) } catch {}
}

async function loadTurnstileConfig() {
  try {
    const res = await fetch('/api/auth/turnstile-config', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
    const data = await res.json()
    const MASK = '••••••'
    savedSecretKey = data.secretKey === MASK ? MASK : ''
    turnstileSettings = {
      siteKey: data.siteKey || '',
      secretKey: ''
    }
    turnstileEnabled = data.enabled === true
  } catch {}
}

async function handleTurnstileSave() {
  turnstileSaving = true
  try {
    const MASK = '••••••'
    const payload = { siteKey: turnstileSettings.siteKey }
    if (!turnstileSettings.secretKey && savedSecretKey === MASK) {
      payload.secretKey = MASK
    } else if (turnstileSettings.secretKey) {
      payload.secretKey = turnstileSettings.secretKey
    }
    const res = await fetch('/api/auth/turnstile-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '保存失败')
    savedSecretKey = data.secretKey === MASK ? MASK : ''
    turnstileSettings.secretKey = ''
    turnstileEnabled = data.enabled === true
    addToast('Turnstile 配置已保存', 'success')
  } catch (e) {
    addToast(e.message || '保存失败', 'error')
  } finally {
    turnstileSaving = false
  }
}

onMount(async () => {
  await loadConfig()
  await Promise.all([loadStats(), loadLogs(), loadTurnstileConfig()])
})

async function handleSave() {
  saving = true
  try {
    const MASK = '••••••'
    const payload = { ...emailSettings }
    if (!payload.pass && savedPass === MASK) {
      payload.pass = MASK
    }
    if (!payload.resendKey && savedResendKey === MASK) {
      payload.resendKey = MASK
    }
    const data = await email.save(payload)
    savedPass = data.pass === MASK ? MASK : ''
    savedResendKey = data.resendKey === MASK ? MASK : ''
    emailSettings.pass = ''
    emailSettings.resendKey = ''
    updateConfigured()
    addToast('保存成功', 'success')
  } catch (e) {
    addToast(e.message || '保存失败', 'error')
  } finally {
    saving = false
  }
}

async function handleTest() {
  testing = true
  try {
    await email.test(testTo || undefined)
    addToast('测试邮件已发送，请查收', 'success')
  } catch (e) { addToast(e.message || '测试失败', 'error') }
  finally {
    testing = false
    loadStats()
    loadLogs()
  }
}

async function handleDiagnose() {
  diagnosing = true; diagnoseResult = null
  try { diagnoseResult = await email.diagnose() }
  catch (e) { addToast('诊断失败: ' + (e.message || ''), 'error') }
  finally { diagnosing = false }
}

async function handleClearLogs() {
  try { await email.clearLogs(); Promise.all([loadStats(), loadLogs()]); addToast('日志已清空', 'success') }
  catch { addToast('清空失败', 'error') }
}

function formatTime(t) {
  if (!t) return '-'
  return t.replace('T', ' ').substring(0, 16)
}
</script>

<div class="space-y-4 md:space-y-6">
  <div class="flex items-center justify-between gap-2">
    <div class="min-w-0 flex-1">
      <h1 class="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">邮件设置</h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">支持 SMTP 直连和 Resend API 两种发送方式</p>
    </div>
    {#if emailConfigured}
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/50 shrink-0">
        <span class="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse"></span>
        已配置
      </span>
    {:else}
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/50 shrink-0">
        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
        未配置
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-700 p-3 md:p-4">
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5">总发送</p>
        <p class="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
      </div>
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-700 p-3 md:p-4">
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5">成功</p>
        <p class="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">{stats.success}</p>
      </div>
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-700 p-3 md:p-4">
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5">失败</p>
        <p class="text-xl md:text-2xl font-bold text-red-500 dark:text-red-400">{stats.failed}</p>
      </div>
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-700 p-3 md:p-4">
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mb-0.5">24小时</p>
        <p class="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.last24h}</p>
      </div>
    </div>

    <div class="flex bg-gray-100/80 dark:bg-gray-700/50 rounded-xl p-1 gap-0.5">
      <button onclick={() => activeTab = 'config'}
        class="flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-lg text-xs font-medium transition-all {activeTab === 'config' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}">
        <Icon icon="mdi:cog-outline" width="14" height="14" />
        <span>配置</span>
      </button>
      <button onclick={() => activeTab = 'test'}
        class="flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-lg text-xs font-medium transition-all {activeTab === 'test' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}">
        <Icon icon="mdi:send-outline" width="14" height="14" />
        <span>测试</span>
      </button>
      <button onclick={() => activeTab = 'diagnose'}
        class="flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-lg text-xs font-medium transition-all {activeTab === 'diagnose' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}">
        <Icon icon="mdi:stethoscope" width="14" height="14" />
        <span>诊断</span>
      </button>
      <button onclick={() => activeTab = 'logs'}
        class="flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-lg text-xs font-medium transition-all {activeTab === 'logs' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}">
        <Icon icon="mdi:history" width="14" height="14" />
        <span>记录</span>
      </button>
      <button onclick={() => activeTab = 'security'}
        class="flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-lg text-xs font-medium transition-all {activeTab === 'security' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}">
        <Icon icon="mdi:shield-lock-outline" width="14" height="14" />
        <span>安全</span>
      </button>
    </div>

    {#if activeTab === 'config'}
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4 md:space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">发送方式</label>
          <div class="grid grid-cols-2 gap-2">
            <button onclick={() => { emailSettings.emailMode = 'smtp'; updateConfigured() }}
              class="relative p-3 rounded-xl border-2 text-left transition-all {emailSettings.emailMode === 'smtp' ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'}">
              <div class="flex items-center gap-2 mb-1">
                <Icon icon="mdi:email-fast-outline" width="18" height="18" class={emailSettings.emailMode === 'smtp' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} />
                <span class="text-sm font-medium {emailSettings.emailMode === 'smtp' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}">SMTP 直连</span>
              </div>
              <p class="text-[11px] {emailSettings.emailMode === 'smtp' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}">使用邮箱账号的 SMTP 服务发送，支持 QQ/163/Gmail 等</p>
            </button>
            <button onclick={() => { emailSettings.emailMode = 'resend'; updateConfigured() }}
              class="relative p-3 rounded-xl border-2 text-left transition-all {emailSettings.emailMode === 'resend' ? 'border-purple-500 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'}">
              <div class="flex items-center gap-2 mb-1">
                <Icon icon="mdi:api" width="18" height="18" class={emailSettings.emailMode === 'resend' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'} />
                <span class="text-sm font-medium {emailSettings.emailMode === 'resend' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}">Resend API</span>
              </div>
              <p class="text-[11px] {emailSettings.emailMode === 'resend' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}">通过 Resend HTTPS API 发送，免费 100 封/天</p>
            </button>
          </div>
        </div>

        {#if emailSettings.emailMode === 'smtp'}
          <div class="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-900/30 border border-blue-100/50 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-400">
            <p class="font-medium mb-1">SMTP 直连模式</p>
            <p class="text-xs text-blue-600 dark:text-blue-400">通过 Cloudflare Workers TCP Sockets 直连 SMTP 服务器发送邮件。使用你自己的邮箱账号，无需第三方服务。端口 25 已被 Cloudflare 禁止，请使用 465（SSL）或 587（STARTTLS）。</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">快速选择邮箱服务</label>
              <select onchange={onPresetSelect}
                class="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none">
                {#each smtpPresets as preset}
                  <option value={preset.host} selected={emailSettings.smtpHost === preset.host}>{preset.name} ({preset.host}:{preset.port})</option>
                {/each}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">SMTP 服务器 <span class="text-red-500">*</span></label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:server" width="16" height="16" /></span>
                  <input type="text" bind:value={emailSettings.smtpHost} placeholder="smtp.qq.com"
                    class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">端口 <span class="text-red-500">*</span></label>
                <select bind:value={emailSettings.smtpPort}
                  class="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none">
                  <option value="465">465 (SSL)</option>
                  <option value="587">587 (STARTTLS)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">邮箱账号 <span class="text-red-500">*</span></label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:email-outline" width="16" height="16" /></span>
                <input type="email" bind:value={emailSettings.user} placeholder="your@qq.com"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none" />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">此邮箱同时作为发件邮箱和管理员收件邮箱</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">授权码 <span class="text-red-500">*</span></label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:key-variant" width="16" height="16" /></span>
                <input type="text" bind:value={emailSettings.pass} placeholder={savedPass === '••••••' ? '已保存，留空则不修改' : '邮箱授权码（非登录密码）'}
                    class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none" />
              </div>
              <div class="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p class="font-medium text-gray-700 dark:text-gray-300">如何获取授权码：</p>
                <p><strong>QQ邮箱：</strong>设置 → 账户 → POP3/SMTP服务 → 开启 → 生成授权码</p>
                <p><strong>163邮箱：</strong>设置 → POP3/SMTP/IMAP → 开启 → 设置客户端授权密码</p>
                <p><strong>Gmail：</strong>Google账户 → 安全 → 两步验证 → 应用专用密码</p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">发件人名称</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:account-outline" width="16" height="16" /></span>
                <input type="text" bind:value={emailSettings.fromName} placeholder="如：LiHui Blog"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {#if emailSettings.user && emailSettings.pass && emailSettings.smtpHost}
            <div class="p-3 rounded-xl bg-green-50/60 dark:bg-green-900/30 border border-green-100/50 dark:border-green-800/50 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <Icon icon="mdi:shield-check-outline" width="16" height="16" class="shrink-0" />
              <span>SMTP 配置完整，邮件发送功能可用</span>
            </div>
          {:else}
            <div class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/30 border border-amber-100/50 dark:border-amber-800/50 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" width="16" height="16" class="shrink-0" />
              <span>请填写 SMTP 服务器、邮箱账号和授权码</span>
            </div>
          {/if}
        {:else}
          <div class="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-900/30 border border-purple-100/50 dark:border-purple-800/50 text-sm text-purple-700 dark:text-purple-400">
            <p class="font-medium mb-1">Resend API 模式</p>
            <p class="text-xs text-purple-600 dark:text-purple-400">通过 Resend HTTPS API 发送邮件，无需 SMTP。免费账号每天可发送 100 封邮件。</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Resend API Key <span class="text-red-500">*</span></label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:key-variant" width="16" height="16" /></span>
                <input type="text" bind:value={emailSettings.resendKey} placeholder={savedResendKey === '••••••' ? '已保存，留空则不修改' : 're_xxxxxxxxxxxx'}
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-purple-300/50 dark:focus:ring-purple-500/50 focus:border-transparent outline-none" />
              </div>
              <div class="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p class="font-medium text-gray-700 dark:text-gray-300">获取 API Key 步骤：</p>
                <p>1. 打开 <a href="https://resend.com/signup" target="_blank" class="text-blue-600 dark:text-blue-400 underline">resend.com/signup</a> 注册免费账号</p>
                <p>2. 登录后进入 Dashboard → API Keys</p>
                <p>3. 点击 "Create API Key" → 选择 "Sending access" → 复制 Key</p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">发件邮箱 <span class="text-red-500">*</span></label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:email-check-outline" width="16" height="16" /></span>
                <input type="email" bind:value={emailSettings.resendFrom} placeholder="noreply@yourdomain.com"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-purple-300/50 dark:focus:ring-purple-500/50 focus:border-transparent outline-none" />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">需要在 Resend 后台验证的域名邮箱。测试可用 <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">onboarding@resend.dev</code></p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">收件邮箱（管理员邮箱）</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:email-outline" width="16" height="16" /></span>
                <input type="email" bind:value={emailSettings.user} placeholder="your@email.com"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-purple-300/50 dark:focus:ring-purple-500/50 focus:border-transparent outline-none" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">发件人名称</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:account-outline" width="16" height="16" /></span>
                <input type="text" bind:value={emailSettings.fromName} placeholder="如：LiHui Blog"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-purple-300/50 dark:focus:ring-purple-500/50 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {#if emailSettings.resendKey}
            <div class="p-3 rounded-xl bg-green-50/60 dark:bg-green-900/30 border border-green-100/50 dark:border-green-800/50 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <Icon icon="mdi:shield-check-outline" width="16" height="16" class="shrink-0" />
              <span>Resend API Key 已配置，邮件发送功能可用</span>
            </div>
          {:else}
            <div class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/30 border border-amber-100/50 dark:border-amber-800/50 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" width="16" height="16" class="shrink-0" />
              <span>请配置 Resend API Key 以启用邮件发送</span>
            </div>
          {/if}
        {/if}

        <button onclick={handleSave} disabled={saving}
          class="w-full md:w-auto px-6 py-2.5 rounded-xl bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-900 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium transition-all disabled:opacity-50">
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>
    {:else if activeTab === 'test'}
      <div class="space-y-3">
        <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-3">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
            <Icon icon="mdi:send-outline" width="18" height="18" />
            邮件发送测试
          </h3>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">收件邮箱</label>
            <input type="email" bind:value={testTo} placeholder="不填则发送到管理员邮箱"
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-300/50 dark:focus:ring-blue-500/50 focus:border-transparent outline-none" />
          </div>
          <button onclick={handleTest} disabled={testing}
            class="w-full px-5 py-2.5 rounded-xl bg-blue-600/80 dark:bg-blue-500/80 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium transition-all disabled:opacity-50">
            {testing ? '发送中...' : '发送测试邮件'}
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400">使用当前保存的配置发送测试邮件（需先保存配置）</p>
        </div>

        <div class="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-900/30 border border-blue-100/50 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-400">
          <p class="font-medium mb-1">验证码邮件模板</p>
          <p class="text-blue-600 dark:text-blue-400 text-xs">包含：站点名称 + 6位验证码 + 有效期提示</p>
          <div class="mt-3 p-3 bg-white/80 dark:bg-gray-800/80 rounded-lg border border-blue-100/50 dark:border-blue-800/50 w-40 mx-auto text-center">
            <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">验证码</p>
            <p class="text-2xl font-bold tracking-widest text-gray-900 dark:text-gray-100">847295</p>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">5分钟内有效</p>
          </div>
        </div>
      </div>
    {:else if activeTab === 'diagnose'}
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
            <Icon icon="mdi:stethoscope" width="18" height="18" />
            连接诊断
          </h3>
          <button onclick={handleDiagnose} disabled={diagnosing}
            class="px-3 py-2 rounded-xl bg-blue-600/80 dark:bg-blue-500/80 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-medium transition-all disabled:opacity-50 shrink-0">
            {diagnosing ? '诊断中...' : '开始诊断'}
          </button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">检测邮件服务配置和连通性</p>

        {#if diagnoseResult}
          <div class="space-y-2">
            {#each diagnoseResult as item}
              <div class="flex items-start gap-2 p-3 rounded-xl {item.status === 'success' ? 'bg-green-50/60 dark:bg-green-900/30 border border-green-100/50 dark:border-green-800/50' : 'bg-red-50/60 dark:bg-red-900/30 border border-red-100/50 dark:border-red-800/50'}">
                <Icon icon={item.status === 'success' ? 'mdi:check-circle' : 'mdi:close-circle'} width="16" height="16"
                  class={item.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'} />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium {item.status === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}">{item.step}</p>
                  <p class="text-[11px] {item.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} break-all mt-0.5">{item.detail}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else if !diagnosing}
          <div class="py-10 text-center text-gray-400 dark:text-gray-500">
            <Icon icon="mdi:lan-disconnect" width="36" height="36" class="mx-auto mb-2 opacity-40" />
            <p class="text-xs">点击"开始诊断"检测配置</p>
          </div>
        {:else}
          <div class="py-10 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-2"></div>
            <p class="text-xs text-gray-500 dark:text-gray-400">正在检测连通性...</p>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'logs'}
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
            <Icon icon="mdi:history" width="18" height="18" />
            发送记录
          </h3>
          <button onclick={handleClearLogs}
            class="px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
            清空
          </button>
        </div>

        {#if logs.length === 0}
          <div class="py-10 text-center text-gray-400 dark:text-gray-500">
            <Icon icon="mdi:email-off-outline" width="36" height="36" class="mx-auto mb-2 opacity-40" />
            <p class="text-xs">暂无发送记录</p>
          </div>
        {:else}
          <div class="space-y-1.5 max-h-72 md:max-h-96 overflow-y-auto">
            {#each logs as log}
              <div class="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <Icon icon={log.status === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'} width="14" height="14"
                  class={log.status === 'success' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'} />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{log.subject || log.type}</span>
                    <span class="px-1 py-0.5 rounded text-[9px] font-medium shrink-0 {log.method === 'smtp' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : log.method === 'resend' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'}">
                      {log.method}
                    </span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-500">{formatTime(log.created_at)}</span>
                  </div>
                  <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{log.recipient}{#if log.error} · <span class="text-red-500 dark:text-red-400">{log.error}</span>{/if}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'security'}
      <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
            <Icon icon="mdi:shield-lock-outline" width="18" height="18" />
            Cloudflare Turnstile 人机验证
          </h3>
          {#if turnstileEnabled}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/50">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse"></span>
              已启用
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/50">
              <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
              未启用
            </span>
          {/if}
        </div>

        <div class="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-900/30 border border-amber-100/50 dark:border-amber-800/50 text-sm text-amber-700 dark:text-amber-400">
          <p class="font-medium mb-1">Turnstile 人机验证</p>
          <p class="text-xs text-amber-600 dark:text-amber-400">启用后，登录页面将显示 Cloudflare Turnstile 验证组件，用户必须通过人机验证才能登录，有效防止暴力破解和自动化攻击。</p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Site Key（站点密钥）<span class="text-red-500">*</span></label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:key-outline" width="16" height="16" /></span>
              <input type="text" bind:value={turnstileSettings.siteKey} placeholder="0x4AAAAAAA..."
                class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-amber-300/50 dark:focus:ring-amber-500/50 focus:border-transparent outline-none font-mono" />
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">在 Cloudflare Dashboard → Turnstile 中创建站点后获取</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Secret Key（密钥）<span class="text-red-500">*</span></label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><Icon icon="mdi:key-variant" width="16" height="16" /></span>
              <input type="text" bind:value={turnstileSettings.secretKey} placeholder={savedSecretKey === '••••••' ? '已保存，留空则不修改' : '0x4AAAAAAA...'}
                class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-amber-300/50 dark:focus:ring-amber-500/50 focus:border-transparent outline-none font-mono" />
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">用于后端验证 Turnstile token 的密钥，请妥善保管</p>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
          <p class="font-medium text-gray-700 dark:text-gray-300">如何获取 Turnstile 密钥：</p>
          <p>1. 登录 <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" class="text-blue-600 dark:text-blue-400 underline">Cloudflare Dashboard</a> → 左侧菜单选择 Turnstile</p>
          <p>2. 点击"Add site"添加站点</p>
          <p>3. 填写站点名称（如：LiHui Blog），域名填写 <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">eckes.de5.net</code></p>
          <p>4. Widget Mode 选择 <strong>Managed</strong></p>
          <p>5. 创建完成后复制 Site Key 和 Secret Key 填入上方</p>
        </div>

        {#if turnstileEnabled}
          <div class="p-3 rounded-xl bg-green-50/60 dark:bg-green-900/30 border border-green-100/50 dark:border-green-800/50 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Icon icon="mdi:shield-check-outline" width="16" height="16" class="shrink-0" />
            <span>Turnstile 已启用，登录页面将显示人机验证</span>
          </div>
        {:else if turnstileSettings.siteKey || savedSecretKey}
          <div class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/30 border border-amber-100/50 dark:border-amber-800/50 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Icon icon="mdi:alert-circle-outline" width="16" height="16" class="shrink-0" />
            <span>请同时填写 Site Key 和 Secret Key 才能启用 Turnstile</span>
          </div>
        {:else}
          <div class="p-3 rounded-xl bg-gray-50/60 dark:bg-gray-800/60 border border-gray-100/50 dark:border-gray-800/50 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Icon icon="mdi:information-outline" width="16" height="16" class="shrink-0" />
            <span>未配置 Turnstile，登录页面不会显示人机验证</span>
          </div>
        {/if}

        <button onclick={handleTurnstileSave} disabled={turnstileSaving}
          class="w-full md:w-auto px-6 py-2.5 rounded-xl bg-gray-900/80 dark:bg-gray-100/80 hover:bg-gray-900 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium transition-all disabled:opacity-50">
          {turnstileSaving ? '保存中...' : '保存 Turnstile 配置'}
        </button>
      </div>
    {/if}
  {/if}
</div>
