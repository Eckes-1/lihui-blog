<script>
import Icon from '@iconify/svelte'
import { getToasts, removeToast } from '../stores.svelte.js'

let toasts = $derived(getToasts())

const typeConfig = {
  success: { bg: 'bg-white/60 dark:bg-gray-800/60', border: 'border-white/30 dark:border-gray-700/30', text: 'text-[#166534] dark:text-green-400', icon: 'mdi:check-circle', iconColor: 'text-green-500 dark:text-green-400' },
  error: { bg: 'bg-white/60 dark:bg-gray-800/60', border: 'border-white/30 dark:border-gray-700/30', text: 'text-[#991b1b] dark:text-red-400', icon: 'mdi:alert-circle', iconColor: 'text-red-500 dark:text-red-400' },
  info: { bg: 'bg-white/60 dark:bg-gray-800/60', border: 'border-white/30 dark:border-gray-700/30', text: 'text-gray-700 dark:text-gray-300', icon: 'mdi:information', iconColor: 'text-gray-700 dark:text-gray-300' },
  warning: { bg: 'bg-white/60 dark:bg-gray-800/60', border: 'border-white/30 dark:border-gray-700/30', text: 'text-[#92400e] dark:text-amber-400', icon: 'mdi:alert', iconColor: 'text-amber-500 dark:text-amber-400' },
}
</script>

{#if toasts.length > 0}
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2">
    {#each toasts as toast (toast.id)}
      {@const config = typeConfig[toast.type] || typeConfig.info}
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-[slideIn_0.25s_ease-out] {config.bg} {config.border} {config.text}"
        style="max-width: 360px;"
      >
        <Icon icon={config.icon} width="18" height="18" class={config.iconColor} />
        <span class="text-sm font-medium flex-1">{toast.message}</span>
        <button onclick={() => removeToast(toast.id)} class="ml-1 hover:opacity-60 transition-opacity text-gray-900 dark:text-gray-100">
          <Icon icon="mdi:close" width="14" height="14" />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  :global {
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  }
</style>
