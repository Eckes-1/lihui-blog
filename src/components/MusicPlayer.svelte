<script>
  import { onMount } from 'svelte';

  let songs = $state([]);
  let currentIndex = $state(-1);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(0.7);
  let showPlaylist = $state(false);
  let showPlayer = $state(false);
  let isDragging = $state(false);
  let isVolumeDragging = $state(false);
  let isLoading = $state(true);
  let audioError = $state('');
  let playMode = $state('sequence');
  let progressBarEl = $state(null);
  let volumeBarEl = $state(null);

  let currentSong = $derived(currentIndex >= 0 && currentIndex < songs.length ? songs[currentIndex] : null);
  let progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
  let formattedCurrentTime = $derived(formatTime(currentTime));
  let formattedDuration = $derived(formatTime(duration));

  let audio = null;

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  function getGradient(str) {
    if (!str) return 'linear-gradient(135deg, #667eea, #764ba2)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = ((hash % 360) + 360) % 360;
    const h2 = (((hash * 7) % 360) + 360) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 65%, 55%), hsl(${h2}, 65%, 45%))`;
  }

  function getCoverUrl(song) {
    if (!song) return '';
    if (song.cover_path) return song.cover_path;
    return '';
  }

  async function fetchSongs() {
    try {
      const res = await fetch('/api/music');
      if (res.ok) {
        const data = await res.json();
        songs = data.songs || [];
        if (songs.length > 0) {
          showPlayer = true;
          document.body.classList.add('has-music-player');
        }
      }
    } catch (e) {
      console.error('Failed to fetch songs:', e);
    }
    isLoading = false;
  }

  function playSong(index) {
    if (index < 0 || index >= songs.length) return;
    currentIndex = index;
    audioError = '';
    const song = songs[index];
    audio.src = song.path;
    audio.load();
    audio.play().then(() => {
      isPlaying = true;
    }).catch(e => {
      console.error('Play failed:', e);
      audioError = '播放失败';
      isPlaying = false;
    });
  }

  function togglePlay() {
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play().then(() => {
        isPlaying = true;
      }).catch(() => {
        isPlaying = false;
      });
    }
  }

  function nextSong() {
    if (songs.length === 0) return;
    if (playMode === 'shuffle') {
      let next = Math.floor(Math.random() * songs.length);
      if (songs.length > 1) {
        while (next === currentIndex) {
          next = Math.floor(Math.random() * songs.length);
        }
      }
      playSong(next);
    } else {
      playSong((currentIndex + 1) % songs.length);
    }
  }

  function prevSong() {
    if (songs.length === 0) return;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (playMode === 'shuffle') {
      let prev = Math.floor(Math.random() * songs.length);
      if (songs.length > 1) {
        while (prev === currentIndex) {
          prev = Math.floor(Math.random() * songs.length);
        }
      }
      playSong(prev);
    } else {
      playSong((currentIndex - 1 + songs.length) % songs.length);
    }
  }

  function handleEnded() {
    if (playMode === 'single') {
      audio.currentTime = 0;
      audio.play();
    } else {
      nextSong();
    }
  }

  function handleProgressClick(e) {
    if (!progressBarEl || !audio || !duration) return;
    const rect = progressBarEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * duration;
    currentTime = audio.currentTime;
  }

  function handleProgressMouseDown(e) {
    isDragging = true;
    handleProgressClick(e);

    const onMouseMove = (ev) => {
      if (!progressBarEl || !audio || !duration) return;
      const rect = progressBarEl.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      audio.currentTime = pct * duration;
      currentTime = audio.currentTime;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function handleVolumeClick(e) {
    if (!volumeBarEl || !audio) return;
    const rect = volumeBarEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    volume = pct;
    audio.volume = pct;
  }

  function handleVolumeMouseDown(e) {
    isVolumeDragging = true;
    handleVolumeClick(e);

    const onMouseMove = (ev) => {
      if (!volumeBarEl || !audio) return;
      const rect = volumeBarEl.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      volume = pct;
      audio.volume = pct;
    };

    const onMouseUp = () => {
      isVolumeDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function toggleMute() {
    if (!audio) return;
    if (audio.volume > 0) {
      audio._prevVolume = audio.volume;
      volume = 0;
      audio.volume = 0;
    } else {
      volume = audio._prevVolume || 0.7;
      audio.volume = volume;
    }
  }

  function cyclePlayMode() {
    const modes = ['sequence', 'single', 'shuffle'];
    const idx = modes.indexOf(playMode);
    playMode = modes[(idx + 1) % modes.length];
  }

  function getVolumeIcon() {
    if (volume === 0) return 'mute';
    if (volume < 0.5) return 'low';
    return 'high';
  }

  function getPlayModeTitle() {
    if (playMode === 'single') return '单曲循环';
    if (playMode === 'shuffle') return '随机播放';
    return '列表循环';
  }

  $effect(() => {
    localStorage.setItem('music-volume', String(volume));
  });

  $effect(() => {
    localStorage.setItem('music-play-mode', playMode);
  });

  onMount(async () => {
    if (typeof window !== 'undefined' && window.__musicAudio) {
      audio = window.__musicAudio;
      if (audio.src) {
        isPlaying = !audio.paused;
        currentTime = audio.currentTime;
        duration = audio.duration || 0;
      }
    } else {
      audio = new Audio();
      audio.preload = 'metadata';
      if (typeof window !== 'undefined') {
        window.__musicAudio = audio;
      }
    }

    const savedVolume = localStorage.getItem('music-volume');
    if (savedVolume !== null) {
      volume = parseFloat(savedVolume);
      audio.volume = volume;
    }

    const savedMode = localStorage.getItem('music-play-mode');
    if (savedMode) {
      playMode = savedMode;
    }

    const onTimeUpdate = () => {
      if (!isDragging) {
        currentTime = audio.currentTime;
      }
    };
    const onLoadedMetadata = () => {
      duration = audio.duration;
    };
    const onDurationChange = () => {
      duration = audio.duration;
    };
    const onError = () => {
      audioError = '加载失败';
      isPlaying = false;
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', onError);

    await fetchSongs();

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', onError);
    };
  });
</script>

{#if showPlayer && !isLoading}
<div class="music-player" class:playlist-open={showPlaylist}>
  <div class="player-progress-bar"
    bind:this={progressBarEl}
    onmousedown={handleProgressMouseDown}
    role="slider"
    aria-label="播放进度"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(progress)}
  >
    <div class="progress-track">
      <div class="progress-filled" style="width: {progress}%"></div>
      <div class="progress-thumb" style="left: {progress}%"></div>
    </div>
  </div>

  <div class="player-bar">
    <div class="player-left">
      <div class="cover-wrapper" onclick={togglePlay}>
        {#if currentSong && getCoverUrl(currentSong)}
          <img src={getCoverUrl(currentSong)} alt={currentSong?.title || ''} class="cover-img" class:spinning={isPlaying} />
        {:else}
          <div class="cover-placeholder" style={getGradient(currentSong?.title || 'music')} class:spinning={isPlaying}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        {/if}
      </div>
      <div class="song-info">
        <div class="song-title">{currentSong?.title || '未选择歌曲'}</div>
        <div class="song-artist">{currentSong?.artist || '未知艺术家'}</div>
      </div>
    </div>

    <div class="player-center">
      <button class="ctrl-btn mode-btn" onclick={cyclePlayMode} title={getPlayModeTitle()}>
        {#if playMode === 'single'}
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            <text x="12" y="15" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">1</text>
          </svg>
        {:else if playMode === 'shuffle'}
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        {/if}
      </button>
      <button class="ctrl-btn" onclick={prevSong} title="上一首" disabled={songs.length === 0}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>
      <button class="ctrl-btn play-btn" onclick={togglePlay} title={isPlaying ? '暂停' : '播放'} disabled={songs.length === 0}>
        {#if isPlaying}
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        {/if}
      </button>
      <button class="ctrl-btn" onclick={nextSong} title="下一首" disabled={songs.length === 0}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
      <button class="ctrl-btn playlist-toggle" onclick={() => showPlaylist = !showPlaylist} title="播放列表" class:active={showPlaylist}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
        </svg>
      </button>
    </div>

    <div class="player-right">
      <span class="time-display">{formattedCurrentTime} / {formattedDuration}</span>
      <div class="volume-wrapper">
        <button class="ctrl-btn volume-btn" onclick={toggleMute} title="音量">
          {#if getVolumeIcon() === 'mute'}
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          {:else if getVolumeIcon() === 'low'}
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          {/if}
        </button>
        <div class="volume-bar"
          bind:this={volumeBarEl}
          onmousedown={handleVolumeMouseDown}
        >
          <div class="volume-track">
            <div class="volume-filled" style="width: {volume * 100}%"></div>
            <div class="volume-thumb" style="left: {volume * 100}%"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if showPlaylist}
    <div class="playlist-panel">
      <div class="playlist-header">
        <span class="playlist-title">播放列表</span>
        <span class="playlist-count">{songs.length} 首</span>
      </div>
      <div class="playlist-body">
        {#each songs as song, i}
          <button
            class="playlist-item"
            class:active={i === currentIndex}
            onclick={() => playSong(i)}
          >
            <span class="item-index">
              {#if i === currentIndex && isPlaying}
                <span class="playing-indicator">
                  <span class="bar"></span><span class="bar"></span><span class="bar"></span>
                </span>
              {:else}
                {i + 1}
              {/if}
            </span>
            <span class="item-cover">
              {#if getCoverUrl(song)}
                <img src={getCoverUrl(song)} alt="" />
              {:else}
                <span class="mini-cover" style={getGradient(song.title)}></span>
              {/if}
            </span>
            <span class="item-info">
              <span class="item-title">{song.title}</span>
              <span class="item-artist">{song.artist || '未知艺术家'}</span>
            </span>
            <span class="item-duration">{song.duration ? formatTime(song.duration) : ''}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
{/if}

<style>
  .music-player {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 999;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.08);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global([data-theme="dark"]) .music-player {
    background: rgba(24, 24, 27, 0.88);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.3);
  }

  .player-progress-bar {
    position: absolute;
    top: -3px;
    left: 0;
    right: 0;
    height: 6px;
    cursor: pointer;
    z-index: 10;
    padding: 2px 0;
  }

  .progress-track {
    position: relative;
    width: 100%;
    height: 2px;
    background: rgba(0, 0, 0, 0.08);
    border-radius: 1px;
    transition: height 0.15s ease;
  }

  .player-progress-bar:hover .progress-track {
    height: 4px;
  }

  :global([data-theme="dark"]) .progress-track {
    background: rgba(255, 255, 255, 0.1);
  }

  .progress-filled {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 1px;
    transition: width 0.1s linear;
  }

  :global([data-theme="dark"]) .progress-filled {
    background: linear-gradient(90deg, #818cf8, #a78bfa);
  }

  .progress-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: #6366f1;
    border-radius: 50%;
    transform: translate(-50%, -50%) scale(0);
    transition: transform 0.15s ease;
    box-shadow: 0 1px 4px rgba(99, 102, 241, 0.3);
  }

  :global([data-theme="dark"]) .progress-thumb {
    background: #818cf8;
    box-shadow: 0 1px 4px rgba(129, 140, 248, 0.3);
  }

  .player-progress-bar:hover .progress-thumb {
    transform: translate(-50%, -50%) scale(1);
  }

  .player-bar {
    display: flex;
    align-items: center;
    height: 60px;
    padding: 0 16px;
    gap: 12px;
  }

  @media (min-width: 768px) {
    .player-bar {
      height: 64px;
      padding: 0 24px;
      gap: 20px;
    }
  }

  .player-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  @media (min-width: 768px) {
    .player-left {
      flex: 0 0 240px;
    }
  }

  .cover-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .cover-wrapper:hover {
    transform: scale(1.05);
  }

  @media (min-width: 768px) {
    .cover-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 10px;
    }
  }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.9);
  }

  .spinning {
    animation: spin 8s linear infinite;
  }

  .spinning.paused {
    animation-play-state: paused;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .song-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .song-title {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  :global([data-theme="dark"]) .song-title {
    color: #f3f4f6;
  }

  .song-artist {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  :global([data-theme="dark"]) .song-artist {
    color: #6b7280;
  }

  .player-center {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }

  @media (min-width: 768px) {
    .player-center {
      gap: 6px;
    }
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #4b5563;
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.15s ease;
    padding: 0;
    flex-shrink: 0;
  }

  :global([data-theme="dark"]) .ctrl-btn {
    color: #d1d5db;
  }

  .ctrl-btn:hover {
    background: rgba(0, 0, 0, 0.06);
    color: #1f2937;
  }

  :global([data-theme="dark"]) .ctrl-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f3f4f6;
  }

  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ctrl-btn:disabled:hover {
    background: transparent;
    color: #4b5563;
  }

  .play-btn {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .play-btn:hover {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }

  :global([data-theme="dark"]) .play-btn {
    background: linear-gradient(135deg, #818cf8, #a78bfa);
    box-shadow: 0 2px 8px rgba(129, 140, 248, 0.3);
  }

  :global([data-theme="dark"]) .play-btn:hover {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
  }

  .mode-btn {
    color: #9ca3af;
  }

  .mode-btn:hover {
    color: #6366f1;
  }

  :global([data-theme="dark"]) .mode-btn {
    color: #6b7280;
  }

  :global([data-theme="dark"]) .mode-btn:hover {
    color: #818cf8;
  }

  .playlist-toggle {
    color: #9ca3af;
  }

  .playlist-toggle:hover,
  .playlist-toggle.active {
    color: #6366f1;
  }

  :global([data-theme="dark"]) .playlist-toggle {
    color: #6b7280;
  }

  :global([data-theme="dark"]) .playlist-toggle:hover,
  :global([data-theme="dark"]) .playlist-toggle.active {
    color: #818cf8;
  }

  .player-right {
    display: none;
    align-items: center;
    gap: 10px;
    flex: 1;
    justify-content: flex-end;
  }

  @media (min-width: 768px) {
    .player-right {
      display: flex;
      flex: 0 0 240px;
    }
  }

  .time-display {
    font-size: 11px;
    color: #9ca3af;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    min-width: 72px;
  }

  :global([data-theme="dark"]) .time-display {
    color: #6b7280;
  }

  .volume-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .volume-btn {
    width: 28px;
    height: 28px;
  }

  .volume-bar {
    width: 80px;
    height: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .volume-track {
    position: relative;
    width: 100%;
    height: 3px;
    background: rgba(0, 0, 0, 0.08);
    border-radius: 1.5px;
  }

  :global([data-theme="dark"]) .volume-track {
    background: rgba(255, 255, 255, 0.1);
  }

  .volume-filled {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: #6366f1;
    border-radius: 1.5px;
  }

  :global([data-theme="dark"]) .volume-filled {
    background: #818cf8;
  }

  .volume-thumb {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    background: #6366f1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
  }

  :global([data-theme="dark"]) .volume-thumb {
    background: #818cf8;
  }

  .playlist-panel {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    max-height: 320px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global([data-theme="dark"]) .playlist-panel {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .playlist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  }

  :global([data-theme="dark"]) .playlist-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .playlist-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  :global([data-theme="dark"]) .playlist-title {
    color: #e5e7eb;
  }

  .playlist-count {
    font-size: 11px;
    color: #9ca3af;
  }

  :global([data-theme="dark"]) .playlist-count {
    color: #6b7280;
  }

  .playlist-body {
    overflow-y: auto;
    overscroll-behavior: contain;
    max-height: 280px;
    padding: 4px 0;
  }

  .playlist-body::-webkit-scrollbar {
    width: 4px;
  }

  .playlist-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .playlist-body::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 2px;
  }

  :global([data-theme="dark"]) .playlist-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
  }

  .playlist-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .playlist-item:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  :global([data-theme="dark"]) .playlist-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .playlist-item.active {
    background: rgba(99, 102, 241, 0.06);
  }

  :global([data-theme="dark"]) .playlist-item.active {
    background: rgba(129, 140, 248, 0.08);
  }

  .item-index {
    width: 24px;
    font-size: 12px;
    color: #9ca3af;
    text-align: center;
    flex-shrink: 0;
  }

  :global([data-theme="dark"]) .item-index {
    color: #6b7280;
  }

  .playlist-item.active .item-index {
    color: #6366f1;
  }

  :global([data-theme="dark"]) .playlist-item.active .item-index {
    color: #818cf8;
  }

  .playing-indicator {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }

  .playing-indicator .bar {
    width: 3px;
    background: #6366f1;
    border-radius: 1px;
    animation: barBounce 0.8s ease-in-out infinite;
  }

  :global([data-theme="dark"]) .playing-indicator .bar {
    background: #818cf8;
  }

  .playing-indicator .bar:nth-child(1) {
    height: 6px;
    animation-delay: 0s;
  }

  .playing-indicator .bar:nth-child(2) {
    height: 10px;
    animation-delay: 0.2s;
  }

  .playing-indicator .bar:nth-child(3) {
    height: 4px;
    animation-delay: 0.4s;
  }

  @keyframes barBounce {
    0%, 100% { height: 4px; }
    50% { height: 14px; }
  }

  .item-cover {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .item-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mini-cover {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }

  .item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .item-title {
    font-size: 13px;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  :global([data-theme="dark"]) .item-title {
    color: #e5e7eb;
  }

  .playlist-item.active .item-title {
    color: #6366f1;
    font-weight: 500;
  }

  :global([data-theme="dark"]) .playlist-item.active .item-title {
    color: #818cf8;
  }

  .item-artist {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  :global([data-theme="dark"]) .item-artist {
    color: #6b7280;
  }

  .item-duration {
    font-size: 11px;
    color: #9ca3af;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  :global([data-theme="dark"]) .item-duration {
    color: #6b7280;
  }
</style>
