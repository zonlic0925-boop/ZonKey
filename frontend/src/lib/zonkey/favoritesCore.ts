/**
 * 工具收藏 — localStorage 持久化（零后端依赖，手机网页版同样生效）。
 *
 * 数据模型：ToolId 有序集合（数组保序，收藏页按收藏先后展示）。
 * 写入即广播 window 事件，多组件实例（底部导航徽标 / 收藏页 / 星标按钮）同步刷新。
 */
import type { ToolId } from '../../types';

const STORAGE_KEY = 'zonkey.favoriteTools.v1';
const MAX_FAVORITES = 12;
const CHANGE_EVENT = 'zonkey:favorites-changed';

let cache: ToolId[] | null = null;

function read(): ToolId[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed.filter((x) => typeof x === 'string') as ToolId[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: ToolId[]): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式/配额满：内存态兜底，本次会话内仍可用 */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getFavorites(): ToolId[] {
  return [...read()];
}

export function isFavorite(toolId: ToolId): boolean {
  return read().includes(toolId);
}

/** 返回切换后的收藏状态；超出上限时新增失败返回 null（调用方提示）。 */
export function toggleFavorite(toolId: ToolId): boolean | null {
  const current = read();
  if (current.includes(toolId)) {
    write(current.filter((id) => id !== toolId));
    return false;
  }
  if (current.length >= MAX_FAVORITES) return null;
  write([...current, toolId]);
  return true;
}

export function removeFavorite(toolId: ToolId): void {
  write(read().filter((id) => id !== toolId));
}

export const FAVORITES_LIMIT = MAX_FAVORITES;

/** React 订阅：任何组件写入后所有订阅者同步刷新。返回清理函数。 */
export function subscribeFavorites(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
