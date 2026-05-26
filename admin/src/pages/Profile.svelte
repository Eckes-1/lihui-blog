<script>
import { profile, auth } from '../api.js'
import { addToast } from '../stores.svelte.js'
import { onMount } from 'svelte'

let loading = $state(true)
let saving = $state(false)
let changingPassword = $state(false)

let avatar = $state('')
let name = $state('')
let description = $state('')
let indexPage = $state('')
let startYear = $state('')

let oldPassword = $state('')
let newPassword = $state('')
let confirmPassword = $state('')

async function loadProfile() {
  loading = true
  try {
    const data = await profile.get()
    avatar = data.avatar || ''
    name = data.name || data.username || ''
    description = data.description || ''
    indexPage = data.indexPage || ''
    startYear = data.startYear || ''
  } catch (e) {
    addToast('加载资料失败', 'error')
  } finally {
    loading = false
  }
}

onMount(() => {
  loadProfile()
})

async function handleSave() {
  saving = true
  try {
    const data = { avatar, name, description, indexPage, startYear }
    await profile.update(data)
    addToast('保存成功', 'success')
  } catch (e) {
    addToast(e.message || '保存失败', 'error')
  } finally {
    saving = false
  }
}

async function handleChangePassword() {
  if (!oldPassword || !newPassword || !confirmPassword) {
    addToast('请填写所有密码字段', 'error')
    return
  }
  if (newPassword !== confirmPassword) {
    addToast('两次输入的新密码不一致', 'error')
    return
  }
  changingPassword = true
  try {
    await auth.changePassword(oldPassword, newPassword)
    addToast('密码修改成功', 'success')
    oldPassword = ''
    newPassword = ''
    confirmPassword = ''
  } catch (e) {
    addToast(e.message || '密码修改失败', 'error')
  } finally {
    changingPassword = false
  }
}
</script>

{#if loading}
  <div class="flex items-center justify-center h-64">
    <div class="text-gray-400 dark:text-gray-500">加载中...</div>
  </div>
{:else}
  <div class="space-y-6 max-w-2xl">
    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">个人资料</h3>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">头像 URL</label>
        <div class="flex items-center gap-4">
          <input type="text" bind:value={avatar} placeholder="https://..." class="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
          {#if avatar}
            <img src={avatar} alt="头像" class="w-12 h-12 rounded-full object-cover border border-white/30 dark:border-gray-700/30" onerror={(e) => { e.target.style.display = 'none' }} />
          {/if}
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
        <input type="text" bind:value={name} class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
        <textarea bind:value={description} rows="3" class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none resize-y"></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">首页 URL</label>
        <input type="text" bind:value={indexPage} placeholder="https://..." class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">建站年份</label>
        <input type="text" bind:value={startYear} placeholder="2024" class="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
      </div>

      <div class="pt-2">
        <button onclick={handleSave} disabled={saving} class="px-5 py-2 rounded-full bg-gray-900/80 dark:bg-gray-100/80 backdrop-blur hover:bg-gray-800/80 dark:hover:bg-gray-200/80 disabled:bg-gray-600/70 dark:disabled:bg-gray-500/70 text-white dark:text-gray-900 text-sm font-medium transition-colors">
          {saving ? '保存中...' : '保存资料'}
        </button>
      </div>
    </div>

    <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">修改密码</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">当前密码</label>
          <input type="password" bind:value={oldPassword} class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新密码</label>
          <input type="password" bind:value={newPassword} class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">确认新密码</label>
          <input type="password" bind:value={confirmPassword} onkeydown={(e) => e.key === 'Enter' && handleChangePassword()} class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent outline-none" />
        </div>
      </div>
      <div class="pt-2">
        <button onclick={handleChangePassword} disabled={changingPassword} class="px-5 py-2 rounded-full bg-gray-800/70 dark:bg-gray-200/70 backdrop-blur hover:bg-gray-900/70 dark:hover:bg-gray-100/70 text-white dark:text-gray-900 text-sm font-medium transition-colors">
          {changingPassword ? '修改中...' : '修改密码'}
        </button>
      </div>
    </div>
  </div>
{/if}
