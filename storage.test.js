import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readJSON,
  writeJSON,
  readRecords,
  writeRecords,
  readConfig,
  writeConfig,
  readCache,
  writeCache,
} from '../src/utils/storage.js';
import { installLocalStorageMock } from './mockLocalStorage.js';

let storage;

beforeEach(() => {
  storage = installLocalStorageMock();
});

afterEach(() => {
  storage.uninstall();
  vi.restoreAllMocks();
});

describe('utils/storage 存档记录读写', () => {
  const sampleRecords = [
    {
      id: 'rec-1',
      checkin_date: '2026-10-24',
      checkin_time: '21:30:12',
      greeter: 'Deep seek',
      message: '您又活了一天呢！存个档吧',
      created_at: '2026-10-24 21:30:12',
    },
  ];

  it('writeRecords / readRecords 往返一致', () => {
    expect(writeRecords(sampleRecords)).toBe(true);
    expect(readRecords()).toEqual(sampleRecords);
  });

  it('空数组往返', () => {
    expect(writeRecords([])).toBe(true);
    expect(readRecords()).toEqual([]);
  });

  it('无记录时回退空数组', () => {
    expect(readRecords()).toEqual([]);
  });

  it('损坏 JSON 回退空数组（不抛错）', () => {
    localStorage.setItem('archive.checkin_records', '{损坏的 JSON');
    expect(() => readRecords()).not.toThrow();
    expect(readRecords()).toEqual([]);
  });

  it('非数组 JSON 回退空数组', () => {
    localStorage.setItem('archive.checkin_records', '{"a":1}');
    expect(readRecords()).toEqual([]);
  });

  it('写入落盘到约定键位 archive.checkin_records', () => {
    writeRecords(sampleRecords);
    expect(JSON.parse(localStorage.getItem('archive.checkin_records'))).toEqual(sampleRecords);
  });
});

describe('utils/storage 应用配置读写', () => {
  it('writeConfig / readConfig 往返一致', () => {
    const config = { greeter: '小圆', theme_id: 'mint-soda', city: '上海' };
    expect(writeConfig(config)).toBe(true);
    expect(readConfig()).toEqual(config);
  });

  it('无配置时回退空对象', () => {
    expect(readConfig()).toEqual({});
  });

  it('损坏 JSON 回退空对象（不抛错）', () => {
    localStorage.setItem('archive.app_config', 'not-json{');
    expect(() => readConfig()).not.toThrow();
    expect(readConfig()).toEqual({});
  });

  it('非对象 JSON（数组/null）回退空对象', () => {
    localStorage.setItem('archive.app_config', '[1,2]');
    expect(readConfig()).toEqual({});
    localStorage.setItem('archive.app_config', 'null');
    expect(readConfig()).toEqual({});
  });
});

describe('utils/storage 天气缓存 readCache/writeCache TTL', () => {
  const TTL = 30 * 60 * 1000; // current TTL 30min
  const BASE = 1_700_000_000_000;

  it('无缓存返回 { value: null, fresh: false }', () => {
    expect(readCache('archive.weather_current', TTL)).toEqual({ value: null, fresh: false });
  });

  it('writeCache 写入 { cached_at, value } 包层结构', () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE);
    expect(writeCache('archive.weather_current', { temp: 22 })).toBe(true);
    const raw = JSON.parse(localStorage.getItem('archive.weather_current'));
    expect(raw.cached_at).toBe(BASE);
    expect(raw.value).toEqual({ temp: 22 });
  });

  it('TTL 内未过期 fresh = true', () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE);
    writeCache('k', { temp: 22 });
    vi.spyOn(Date, 'now').mockReturnValue(BASE + TTL - 1);
    expect(readCache('k', TTL)).toEqual({ value: { temp: 22 }, fresh: true });
  });

  it('达到/超过 TTL fresh = false（age === ttl 即过期）', () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE);
    writeCache('k', { temp: 22 });
    vi.spyOn(Date, 'now').mockReturnValue(BASE + TTL);
    expect(readCache('k', TTL)).toEqual({ value: { temp: 22 }, fresh: false });
    vi.spyOn(Date, 'now').mockReturnValue(BASE + TTL + 60_000);
    expect(readCache('k', TTL).fresh).toBe(false);
  });

  it('缓存结构损坏（缺 cached_at / 非 JSON）时 value 为 null', () => {
    localStorage.setItem('k', JSON.stringify({ value: { temp: 22 } }));
    expect(readCache('k', TTL)).toEqual({ value: null, fresh: false });
    localStorage.setItem('k', '损坏JSON');
    expect(readCache('k', TTL)).toEqual({ value: null, fresh: false });
  });
});

describe('utils/storage 通用 JSON 与缺失 localStorage 兜底', () => {
  it('readJSON / writeJSON 往返与 fallback', () => {
    expect(writeJSON('some.key', { a: 1 })).toBe(true);
    expect(readJSON('some.key')).toEqual({ a: 1 });
    expect(readJSON('missing.key', 'fallback')).toBe('fallback');
    expect(readJSON('missing.key')).toBeNull();
  });

  it('缺失 localStorage 时全部安全兜底、不抛错（node 环境回归）', () => {
    storage.uninstall(); // 移除 mock，模拟无 localStorage 的 node 环境
    expect(() => readRecords()).not.toThrow();
    expect(readRecords()).toEqual([]);
    expect(writeRecords([{ checkin_date: '2026-10-24' }])).toBe(false);
    expect(readConfig()).toEqual({});
    expect(readCache('k', 1000)).toEqual({ value: null, fresh: false });
    expect(writeCache('k', 1)).toBe(false);
    expect(readJSON('k', 'fb')).toBe('fb');
    storage = installLocalStorageMock(); // 恢复，供 afterEach 卸载
  });
});
