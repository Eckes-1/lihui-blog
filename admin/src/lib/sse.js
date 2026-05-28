import { getToken, setToken, setUser, addToast } from '../stores.svelte.js'

const BASE = '/api'
const POLL_INTERVAL = 15000

let listeners = new Map()
let listenerId = 0
let pollTimer = null
let lastSnapshot = null
let activeCount = 0
let polling = false
let authFailed = false

async function fetchChanges() {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BASE}/dashboard/changes?_t=${Date.now()}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store'
    })
    if (res.status === 401) {
      if (!authFailed) {
        authFailed = true
        setToken(null)
        setUser(null)
        addToast('登录已过期，请重新登录', 'error')
        if (typeof location !== 'undefined') location.hash = '#/login'
      }
      return null
    }
    if (!res.ok) return null
    authFailed = false
    return await res.json()
  } catch {
    return null
  }
}

function snapshotMatches(a, b) {
  if (!a || !b) return false
  return a.posts === b.posts &&
    a.comments === b.comments &&
    a.categories === b.categories &&
    a.links === b.links &&
    a.media === b.media &&
    a.pendingComments === b.pendingComments
}

function getChangedResources(oldSnap, newSnap) {
  const changes = []
  if (!oldSnap) return ['posts', 'comments', 'categories', 'links', 'media']
  if (oldSnap.posts !== newSnap.posts) changes.push('posts')
  if (oldSnap.comments !== newSnap.comments) changes.push('comments')
  if (oldSnap.categories !== newSnap.categories) changes.push('categories')
  if (oldSnap.links !== newSnap.links) changes.push('links')
  if (oldSnap.media !== newSnap.media) changes.push('media')
  if (oldSnap.pendingComments !== newSnap.pendingComments) changes.push('pendingComments')
  return changes
}

async function poll() {
  if (polling) return
  if (typeof document !== 'undefined' && document.hidden) return
  if (authFailed) return

  polling = true
  try {
    const snap = await fetchChanges()
    if (!snap) { polling = false; return }

    if (lastSnapshot && !snapshotMatches(lastSnapshot, snap)) {
      const changed = getChangedResources(lastSnapshot, snap)
      for (const [, cb] of listeners) {
        try { cb({ resources: changed }) } catch {}
      }
    }
    lastSnapshot = snap
  } finally {
    polling = false
  }
}

export function isConnected() {
  return pollTimer !== null
}

export function resetSnapshot() {
  lastSnapshot = null
}

export function onSSE(callback) {
  const id = ++listenerId
  listeners.set(id, callback)

  if (!pollTimer) {
    authFailed = false
    fetchChanges().then(snap => { lastSnapshot = snap })
    pollTimer = setInterval(poll, POLL_INTERVAL)
  }
  activeCount++

  return () => {
    listeners.delete(id)
    activeCount--
    if (activeCount <= 0) {
      activeCount = 0
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      lastSnapshot = null
    }
  }
}
