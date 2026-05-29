<script>
import { getToken } from './stores.svelte.js'
import { startSessionMonitor, stopSessionMonitor } from './api.js'
import Layout from './components/Layout.svelte'
import Toast from './components/Toast.svelte'
import Login from './pages/Login.svelte'
import Dashboard from './pages/Dashboard.svelte'
import Posts from './pages/Posts.svelte'
import PostEditor from './pages/PostEditor.svelte'
import Categories from './pages/Categories.svelte'
import Comments from './pages/Comments.svelte'
import SiteConfig from './pages/SiteConfig.svelte'
import EmailSettings from './pages/EmailSettings.svelte'
import Profile from './pages/Profile.svelte'
import FriendLinks from './pages/FriendLinks.svelte'
import Media from './pages/Media.svelte'
import MusicManager from './pages/MusicManager.svelte'
import ThemeSettings from './pages/ThemeSettings.svelte'
import { onMount } from 'svelte'

let currentRoute = $state('')
let routeParams = $state({})
let navigating = $state(false)

function parseHash() {
  const hash = location.hash.slice(1) || '/'
  const qIndex = hash.indexOf('?')
  return qIndex > -1 ? hash.slice(0, qIndex) : hash
}

function navigate() {
  if (navigating) return
  navigating = true
  try {
    const hash = parseHash()
    const token = getToken()

    if (!token && hash !== '/login') {
      stopSessionMonitor()
      location.hash = '#/login'
      return
    }
    if (token && hash === '/login') {
      location.hash = '#/'
      return
    }

    currentRoute = hash

    const matchPostEdit = hash.match(/^\/posts\/([^/]+)\/edit$/)
    if (matchPostEdit) {
      routeParams = { id: matchPostEdit[1] }
    } else {
      routeParams = {}
    }
  } finally {
    navigating = false
  }
}

onMount(() => {
  navigate()
  window.addEventListener('hashchange', navigate)

  const token = getToken()
  if (token) {
    startSessionMonitor()
  }

  return () => {
    window.removeEventListener('hashchange', navigate)
    stopSessionMonitor()
  }
})

let isLoginPage = $derived(currentRoute === '/login')
</script>

<Toast />

{#if isLoginPage}
  <Login />
{:else if currentRoute === '/'}
  <Layout route={currentRoute}>
    <Dashboard />
  </Layout>
{:else if currentRoute === '/posts'}
  <Layout route={currentRoute}>
    <Posts />
  </Layout>
{:else if currentRoute === '/posts/new'}
  <Layout route={currentRoute}>
    <PostEditor routeParams={routeParams} route={currentRoute} />
  </Layout>
{:else if currentRoute.match(/^\/posts\/[^/]+\/edit$/)}
  <Layout route={currentRoute}>
    <PostEditor routeParams={routeParams} route={currentRoute} />
  </Layout>
{:else if currentRoute === '/categories'}
  <Layout route={currentRoute}>
    <Categories />
  </Layout>
{:else if currentRoute === '/comments'}
  <Layout route={currentRoute}>
    <Comments />
  </Layout>
{:else if currentRoute === '/config'}
  <Layout route={currentRoute}>
    <SiteConfig />
  </Layout>
{:else if currentRoute === '/email'}
  <Layout route={currentRoute}>
    <EmailSettings />
  </Layout>
{:else if currentRoute === '/profile'}
  <Layout route={currentRoute}>
    <Profile />
  </Layout>
{:else if currentRoute === '/links'}
  <Layout route={currentRoute}>
    <FriendLinks />
  </Layout>
{:else if currentRoute === '/media'}
  <Layout route={currentRoute}>
    <Media />
  </Layout>
{:else if currentRoute === '/music'}
  <Layout route={currentRoute}>
    <MusicManager />
  </Layout>
{:else if currentRoute === '/theme'}
  <Layout route={currentRoute}>
    <ThemeSettings />
  </Layout>
{:else}
  <Layout route={currentRoute}>
    <Dashboard />
  </Layout>
{/if}
