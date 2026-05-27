import { getConfig as fetchConfig, getProfile as fetchProfile, getFriendLinks as fetchLinks } from './api';
import type { SiteConfig, ProfileConfig, LicenseConfig } from '../types/config';
import type { FriendLink } from '../types/friend';

let cachedConfig: any = null;
let cachedProfile: any = null;
let cachedLinks: FriendLink[] = [];
let cacheTime = 0;
const CACHE_TTL = 60000;

async function refreshCache(db?: any) {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) return;
  try {
    const [configData, profileData, linksData] = await Promise.all([
      fetchConfig(db),
      fetchProfile(db),
      fetchLinks(db)
    ]);
    cachedConfig = configData;
    cachedProfile = profileData;
    cachedLinks = Array.isArray(linksData) ? linksData : (linksData.links || []);
    cacheTime = now;
  } catch (e) {
    if (!cachedConfig) throw e;
    console.warn('[DynamicConfig] API 请求失败，使用缓存数据:', (e as Error).message)
  }
}

export async function getDynamicSiteConfig(db?: any): Promise<SiteConfig> {
  await refreshCache(db);
  const c = cachedConfig;
  return {
    title: c?.site?.title || 'LiHui',
    subTitle: c?.site?.subTitle || 'Blog',
    favicon: c?.site?.favicon || '/favicon/favicon.ico',
    pageSize: parseInt(c?.site?.pageSize) || 6,
    toc: { enable: c?.toc?.enable === 'true', depth: parseInt(c?.toc?.depth) || 3 },
    blogNavi: { enable: c?.blogNavi?.enable === 'true' },
    comments: {
      enable: c?.comments?.enable === 'true',
      platform: c?.comments?.platform || 'default',
      backendUrl: c?.comments?.backendUrl || ''
    },
    theme: {
      AOS: c?.theme?.AOS === 'true',
      LQIP: c?.theme?.LQIP === 'true',
      PhotoSwipe: c?.theme?.PhotoSwipe === 'true'
    }
  };
}

export async function getDynamicProfileConfig(db?: any): Promise<ProfileConfig> {
  await refreshCache(db);
  const p = cachedProfile;
  return {
    avatar: p?.avatar || 'assets/lihui.jpg',
    name: p?.name || '栗辉',
    description: p?.description || '以坚实之根，绽放思想之光',
    indexPage: p?.indexPage || '',
    startYear: parseInt(p?.startYear) || 2024,
  };
}

export async function getDynamicLicenseConfig(db?: any): Promise<LicenseConfig> {
  await refreshCache(db);
  const c = cachedConfig;
  return {
    enable: c?.license?.enable === 'true',
    name: c?.license?.name || 'CC BY-NC-SA 4.0',
    url: c?.license?.url || 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  };
}

export async function getDynamicFriendLinks(db?: any): Promise<FriendLink[]> {
  await refreshCache(db);
  return cachedLinks;
}
