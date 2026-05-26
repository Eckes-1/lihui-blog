<script>
import { getSidebarCollapsed, toggleSidebar } from '../stores.svelte.js'
import Sidebar from './Sidebar.svelte'
import Header from './Header.svelte'

let { route, children } = $props()

let collapsed = $derived(getSidebarCollapsed())
</script>

<div class="flex h-screen overflow-hidden bg-[#f5f5f7] dark:bg-[#0f1117]">
  <div class="hidden md:block">
    <Sidebar {collapsed} currentRoute={route} />
  </div>

  {#if !collapsed}
    <button class="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden cursor-auto" onclick={toggleSidebar} aria-label="关闭侧边栏"></button>
    <div class="fixed left-0 top-0 z-40 md:hidden">
      <Sidebar {collapsed} currentRoute={route} mobile={true} />
    </div>
  {/if}

  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="overflow-visible z-50">
      <Header {route} />
    </div>
    <main class="flex-1 overflow-y-auto p-4 md:p-6">
      {@render children()}
    </main>
  </div>
</div>
