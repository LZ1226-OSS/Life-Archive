import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  wmoToText,
  wmoToIcon,
  resolveCityCoords,
  saveCityCoords,
  searchCity,
  fetchCurrentWeather,
  fetchDailyForecast,
} from '../src/services/weatherService.js';
import { readCache, writeCache } from '../src/utils/storage.js';
import { installLocalStorageMock } from './mockLocalStorage.js';

const CURRENT_TTL = 30 * 60 * 1000;
const DAILY_TTL = 3 * 60 * 60 * 1000;
const BEIJING = { name: '北京', latitude: 39.9042, longitude: 116.4074 };

let storage;
let fetchMock;
const originalFetch = globalThis.fetch;

// 构造 Open-Meteo 风格的 2xx 响应 mock。
function okResponse(json) {
  return { ok: true, status: 200, json: async () => json };
}

beforeEach(() => {
  storage = installLocalStorageMock();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  storage.uninstall();
  globalThis.fetch = originalFetch;
});

describe('weatherService WMO code → 中文/图标映射（PRD 4.4）', () => {
  it('wmoToText：0 晴 / 1-2 多云 / 3 阴 / 45、48 雾', () => {
    expect(wmoToText(0)).toBe('晴');
    expect(wmoToText(1)).toBe('多云');
    expect(wmoToText(2)).toBe('多云');
    expect(wmoToText(3)).toBe('阴');
    expect(wmoToText(45)).toBe('雾');
    expect(wmoToText(48)).toBe('雾');
  });

  it('wmoToText：51-55 小雨/毛毛雨', () => {
    expect(wmoToText(51)).toBe('小雨');
    expect(wmoToText(53)).toBe('小雨');
    expect(wmoToText(55)).toBe('毛毛雨');
  });

  it('wmoToText：61-67 雨（PRD 4.4 明文规定）', () => {
    expect(wmoToText(61)).toBe('雨');
    expect(wmoToText(63)).toBe('雨');
    expect(wmoToText(65)).toBe('雨');
    expect(wmoToText(66)).toBe('雨');
    expect(wmoToText(67)).toBe('雨');
  });

  it('wmoToText：71-77 雪 / 80-82 阵雨 / 95-99 雷雨', () => {
    expect(wmoToText(71)).toBe('雪');
    expect(wmoToText(73)).toBe('雪');
    expect(wmoToText(75)).toBe('雪');
    expect(wmoToText(77)).toBe('雪');
    expect(wmoToText(80)).toBe('阵雨');
    expect(wmoToText(81)).toBe('阵雨');
    expect(wmoToText(82)).toBe('阵雨');
    expect(wmoToText(95)).toBe('雷雨');
    expect(wmoToText(96)).toBe('雷雨');
    expect(wmoToText(99)).toBe('雷雨');
  });

  it('wmoToText：未知码返回「未知天气」', () => {
    expect(wmoToText(999)).toBe('未知天气');
    expect(wmoToText(-1)).toBe('未知天气');
  });

  it('wmoToIcon：代表性天气码', () => {
    expect(wmoToIcon(0)).toBe('☀️');
    expect(wmoToIcon(3)).toBe('☁️');
    // 注：PRD 未规定具体图标，以下锁定当前映射行为；51（小雨档 🌦️）与
    // 61（雨 🌧️）是两个不同键，分别断言防止混淆或误删。
    expect(wmoToIcon(51)).toBe('🌦️');
    expect(wmoToIcon(61)).toBe('🌧️');
    expect(wmoToIcon(95)).toBe('⛈️');
    expect(wmoToIcon(999)).toBe('🌡️');
  });
});

describe('weatherService 城市坐标 resolveCityCoords/saveCityCoords（R15）', () => {
  it('无缓存时回退默认北京坐标', () => {
    expect(resolveCityCoords('北京')).toEqual(BEIJING);
    expect(resolveCityCoords('上海')).toEqual(BEIJING);
    expect(resolveCityCoords('')).toEqual(BEIJING);
    expect(resolveCityCoords(undefined)).toEqual(BEIJING);
  });

  it('保存后命中缓存坐标', () => {
    expect(saveCityCoords({ name: '上海', latitude: 31.2304, longitude: 121.4737 })).toBe(true);
    expect(resolveCityCoords('上海')).toEqual({
      name: '上海',
      latitude: 31.2304,
      longitude: 121.4737,
    });
    // 其他城市仍走默认北京
    expect(resolveCityCoords('广州')).toEqual(BEIJING);
  });

  it('保存北京坐标后同样命中', () => {
    saveCityCoords({ name: '北京', latitude: 39.9, longitude: 116.4 });
    expect(resolveCityCoords('北京')).toEqual({ name: '北京', latitude: 39.9, longitude: 116.4 });
  });

  it('非法坐标拒绝保存', () => {
    expect(saveCityCoords(null)).toBe(false);
    expect(saveCityCoords({ name: 'x' })).toBe(false);
    expect(saveCityCoords({ name: 'x', latitude: '31', longitude: 121 })).toBe(false);
    expect(saveCityCoords({ name: 'x', latitude: Number.NaN, longitude: 121 })).toBe(false);
  });
});

describe('weatherService.fetchCurrentWeather 当日天气降级链（R13/R16）', () => {
  const currentJson = {
    current: {
      temperature_2m: 22.5,
      relative_humidity_2m: 60,
      apparent_temperature: 20.1,
      weather_code: 0,
    },
  };

  it('mock fetch 成功时正确 normalize 中文文案并写缓存', async () => {
    fetchMock.mockResolvedValue(okResponse(currentJson));
    const result = await fetchCurrentWeather('北京');
    expect(result.stale).toBe(false);
    expect(result.data).toEqual({
      temp: 22.5,
      feels_like: 20.1,
      humidity: 60,
      weather_code: 0,
      weather_text: '晴',
      stale: false,
      fetched_at: expect.any(Number),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const cached = readCache('archive.weather_current', CURRENT_TTL);
    expect(cached.fresh).toBe(true);
    expect(cached.value.weather_text).toBe('晴');
  });

  it('天气码 3 归一化为「阴」', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        current: {
          temperature_2m: 18,
          relative_humidity_2m: 80,
          apparent_temperature: 17,
          weather_code: 3,
        },
      }),
    );
    const result = await fetchCurrentWeather('北京');
    expect(result.data.weather_text).toBe('阴');
    expect(result.data.temp).toBe(18);
  });

  it('缓存新鲜时直接返回，不请求网络', async () => {
    writeCache('archive.weather_current', {
      temp: 22,
      feels_like: 20,
      humidity: 60,
      weather_code: 0,
      weather_text: '晴',
      stale: false,
      fetched_at: Date.now(),
    });
    const result = await fetchCurrentWeather('北京');
    expect(result.stale).toBe(false);
    expect(result.data.temp).toBe(22);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('已选城市使用缓存坐标请求且缓存键带城市后缀（R15）', async () => {
    saveCityCoords({ name: '上海', latitude: 31.2304, longitude: 121.4737 });
    fetchMock.mockResolvedValue(okResponse(currentJson));
    await fetchCurrentWeather('上海');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('latitude=31.2304');
    expect(fetchMock.mock.calls[0][0]).toContain('longitude=121.4737');
    expect(readCache('archive.weather_current:上海', CURRENT_TTL).fresh).toBe(true);
    expect(readCache('archive.weather_current', CURRENT_TTL).fresh).toBe(false);
  });

  it('fetch 抛错且无缓存 → mock 兜底 stale=true，不 reject（IR8）', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const result = await fetchCurrentWeather('北京');
    expect(result.stale).toBe(true);
    expect(result.data.temp).toBe(22);
    expect(result.data.weather_text).toBe('晴');
    expect(result.data.stale).toBe(true);
  });

  it('fetch 同步抛错 → 同样兜底不 reject', async () => {
    fetchMock.mockImplementation(() => {
      throw new Error('sync boom');
    });
    await expect(fetchCurrentWeather('北京')).resolves.toMatchObject({ stale: true });
  });

  it('非 2xx 响应 → mock 兜底 stale=true', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const result = await fetchCurrentWeather('北京');
    expect(result.stale).toBe(true);
    expect(result.data.temp).toBe(22);
  });

  it('响应缺 current 字段 → mock 兜底 stale=true', async () => {
    fetchMock.mockResolvedValue(okResponse({}));
    const result = await fetchCurrentWeather('北京');
    expect(result.stale).toBe(true);
  });

  it('网络失败但有旧缓存 → 返回旧缓存 stale=true（不抛错）', async () => {
    localStorage.setItem(
      'archive.weather_current',
      JSON.stringify({
        cached_at: Date.now() - CURRENT_TTL - 60_000,
        value: {
          temp: 15,
          feels_like: 14,
          humidity: 50,
          weather_code: 3,
          weather_text: '阴',
          stale: false,
          fetched_at: 1,
        },
      }),
    );
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await fetchCurrentWeather('北京');
    expect(result.stale).toBe(true);
    expect(result.data.temp).toBe(15);
    expect(result.data.weather_text).toBe('阴');
  });
});

describe('weatherService.fetchDailyForecast 未来预报降级链（R14/R16）', () => {
  // 8 天窗口：today + 未来 7 天；实现从「明天」（下标 1）起取 7 天。
  const dailyJson = () => ({
    daily: {
      time: [
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
      ],
      weather_code: [0, 1, 2, 3, 61, 80, 95, 0],
      temperature_2m_max: [26, 27, 28, 25, 24, 23, 22, 21],
      temperature_2m_min: [18, 19, 20, 17, 16, 15, 14, 13],
    },
  });

  it('成功时从「明天」起取 7 天并映射中文文案、写缓存', async () => {
    fetchMock.mockResolvedValue(okResponse(dailyJson()));
    const result = await fetchDailyForecast('北京');
    expect(result.stale).toBe(false);
    expect(result.data).toHaveLength(7);
    expect(result.data[0]).toEqual({
      date: '2026-10-25',
      temp_max: 27,
      temp_min: 19,
      weather_code: 1,
      weather_text: '多云',
    });
    // data[i] 对应响应 daily 数组下标 i+1（从「明天」起算，跳过今天）
    expect(result.data[3].weather_text).toBe('雨'); // code 61
    expect(result.data[4].weather_text).toBe('阵雨'); // code 80
    expect(result.data[5].weather_text).toBe('雷雨'); // code 95
    expect(result.data[6].date).toBe('2026-10-31');
    expect(readCache('archive.weather_daily', DAILY_TTL).fresh).toBe(true);
  });

  it('缓存新鲜时直接返回，不请求网络', async () => {
    const items = [
      { date: '2026-10-25', temp_max: 27, temp_min: 19, weather_code: 1, weather_text: '多云' },
    ];
    writeCache('archive.weather_daily', items);
    const result = await fetchDailyForecast('北京');
    expect(result.stale).toBe(false);
    expect(result.data).toEqual(items);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetch 抛错且无缓存 → mock 7 天兜底 stale=true，不 reject', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await fetchDailyForecast('北京');
    expect(result.stale).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(7);
  });

  it('非 2xx → mock 兜底 stale=true', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const result = await fetchDailyForecast('北京');
    expect(result.stale).toBe(true);
    expect(result.data).toHaveLength(7);
  });

  it('响应缺 daily 字段 → mock 兜底 stale=true', async () => {
    fetchMock.mockResolvedValue(okResponse({}));
    const result = await fetchDailyForecast('北京');
    expect(result.stale).toBe(true);
    expect(result.data).toHaveLength(7);
  });

  it('网络失败但有旧缓存 → 旧缓存 stale=true', async () => {
    localStorage.setItem(
      'archive.weather_daily',
      JSON.stringify({
        cached_at: Date.now() - DAILY_TTL - 60_000,
        value: [
          { date: '2026-10-25', temp_max: 27, temp_min: 19, weather_code: 1, weather_text: '多云' },
        ],
      }),
    );
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await fetchDailyForecast('北京');
    expect(result.stale).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].date).toBe('2026-10-25');
  });
});

describe('weatherService.searchCity 城市搜索', () => {
  it('空查询返回 [] 且不请求网络', async () => {
    expect(await searchCity('')).toEqual([]);
    expect(await searchCity('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('成功时映射城市选项（language=zh）', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        results: [
          { name: '上海', country: '中国', admin1: '上海市', latitude: 31.2304, longitude: 121.4737 },
          { name: '上海', country: '美国', admin: '某州', latitude: 40.5, longitude: -80.2 },
        ],
      }),
    );
    const results = await searchCity('上海');
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      name: '上海',
      country: '中国',
      admin: '上海市',
      latitude: 31.2304,
      longitude: 121.4737,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('language=zh');
  });

  it('失败返回 [] 不 reject', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await searchCity('上海')).toEqual([]);
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await searchCity('上海')).toEqual([]);
  });
});
