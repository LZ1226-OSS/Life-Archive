// 天气服务：Open-Meteo（免 key）+ Geocoding 城市搜索 + 缓存降级链 + WMO 映射 + mock 兜底。
// 降级链（R16）：新鲜缓存（current TTL 30min / daily TTL 3h）→ 网络请求 →
// 旧缓存（stale 标记）→ mock 兜底。任何网络失败都不得 throw：统一返回 { data, stale }。
import { formatDate } from '../utils/date.js';
import { readCache, readJSON, writeCache, writeJSON } from '../utils/storage.js';

const CURRENT_TTL_MS = 30 * 60 * 1000;
const DAILY_TTL_MS = 3 * 60 * 60 * 1000;
const CURRENT_CACHE_KEY = 'archive.weather_current';
const DAILY_CACHE_KEY = 'archive.weather_daily';
const CITY_COORDS_KEY = 'archive.city_coords';
const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REQUEST_TIMEOUT_MS = 8000;
const DAILY_FORECAST_DAYS = 7;
const FORECAST_REQUEST_WINDOW_DAYS = 8;

// 默认城市「北京」内置坐标（不做浏览器地理定位授权，见设计 5.1）。
const DEFAULT_CITY_COORDS = { name: '北京', latitude: 39.9042, longitude: 116.4074 };

// WMO code → 中文映射（前端常量表，与 PRD 4.4 对齐，可单测）。
const WMO_TEXT_TABLE = {
  0: '晴',
  1: '多云',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾',
  51: '小雨',
  53: '小雨',
  55: '毛毛雨',
  56: '冻雨',
  57: '冻雨',
  61: '雨',
  63: '雨',
  65: '雨',
  66: '雨',
  67: '雨',
  71: '雪',
  73: '雪',
  75: '雪',
  77: '雪',
  80: '阵雨',
  81: '阵雨',
  82: '阵雨',
  85: '阵雪',
  86: '阵雪',
  95: '雷雨',
  96: '雷雨',
  99: '雷雨',
};

// WMO code → 图标 emoji 映射。
const WMO_ICON_TABLE = {
  0: '☀️',
  1: '⛅',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌦️',
  56: '🌧️',
  57: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '🌨️',
  80: '🌦️',
  81: '🌦️',
  82: '⛈️',
  85: '🌨️',
  86: '🌨️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
};

// WMO code → 中文天气描述；未知码返回「未知天气」。
export function wmoToText(code) {
  const key = Number(code);
  if (Number.isFinite(key) && Object.prototype.hasOwnProperty.call(WMO_TEXT_TABLE, key)) {
    return WMO_TEXT_TABLE[key];
  }
  return '未知天气';
}

// WMO code → 图标 emoji；未知码返回温度计图标。
export function wmoToIcon(code) {
  const key = Number(code);
  if (Number.isFinite(key) && Object.prototype.hasOwnProperty.call(WMO_ICON_TABLE, key)) {
    return WMO_ICON_TABLE[key];
  }
  return '🌡️';
}

// 缓存 key 派生：默认城市使用设计约定的基础 key，其余城市追加城市名后缀，
// 避免切换城市后读到旧城市的新鲜缓存（R15：选中后刷新天气）。
function buildCacheKey(baseKey, city) {
  const name = typeof city === 'string' ? city.trim() : '';
  return name && name !== DEFAULT_CITY_COORDS.name ? `${baseKey}:${name}` : baseKey;
}

function isValidCoords(value) {
  return Boolean(value)
    && typeof value === 'object'
    && typeof value.name === 'string'
    && typeof value.latitude === 'number'
    && Number.isFinite(value.latitude)
    && typeof value.longitude === 'number'
    && Number.isFinite(value.longitude);
}

// 城市坐标解析：优先 archive.city_coords 缓存；未命中（含默认城市）按默认北京坐标兜底。
export function resolveCityCoords(name) {
  const saved = readJSON(CITY_COORDS_KEY, null);
  if (isValidCoords(saved) && saved.name === name) {
    return { name: saved.name, latitude: saved.latitude, longitude: saved.longitude };
  }
  return { ...DEFAULT_CITY_COORDS };
}

// 保存用户搜索选中的城市坐标（R15：重启后保持）。
export function saveCityCoords(option) {
  if (!isValidCoords(option)) {
    return false;
  }
  return writeJSON(CITY_COORDS_KEY, {
    name: option.name,
    latitude: option.latitude,
    longitude: option.longitude,
  });
}

// 带超时的 fetch：AbortController 不可用时降级为普通 fetch。
function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (typeof AbortController !== 'function') {
    return fetch(url);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.resolve(fetch(url, { signal: controller.signal })).finally(() => {
    clearTimeout(timer);
  });
}

// 城市搜索（Open-Meteo Geocoding，language=zh）。
// 失败（断网/超时/非 2xx）返回 []，绝不 reject。
export async function searchCity(query) {
  const keyword = typeof query === 'string' ? query.trim() : '';
  if (!keyword) {
    return [];
  }
  const url = `${GEOCODING_BASE_URL}?name=${encodeURIComponent(keyword)}&count=10&language=zh&format=json`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return [];
    }
    const json = await response.json();
    const results = json && Array.isArray(json.results) ? json.results : [];
    return results
      .map((item) => ({
        name: String(item.name || ''),
        country: String(item.country || ''),
        admin: String(item.admin || item.admin1 || ''),
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
      }))
      .filter((item) => item.name && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  } catch (error) {
    return [];
  }
}

function isWeatherCurrent(value) {
  return Boolean(value)
    && typeof value === 'object'
    && typeof value.temp === 'number'
    && typeof value.weather_text === 'string';
}

function isDailyForecast(value) {
  return Array.isArray(value) && value.length > 0;
}

function createMockCurrent() {
  return {
    temp: 22,
    feels_like: 20,
    humidity: 60,
    weather_code: 0,
    weather_text: wmoToText(0),
    stale: true,
    fetched_at: Date.now(),
  };
}

function createMockDaily() {
  const codes = [0, 1, 2, 3, 61, 80, 95];
  const today = new Date();
  const items = [];
  for (let i = 1; i <= DAILY_FORECAST_DAYS; i += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const code = codes[(i - 1) % codes.length];
    items.push({
      date: formatDate(date),
      temp_max: 24 + (i % 3),
      temp_min: 15 + (i % 4),
      weather_code: code,
      weather_text: wmoToText(code),
    });
  }
  return items;
}

// 当日天气：缓存优先（TTL 30min）→ 网络 → 旧缓存（stale）→ mock 兜底。
// 返回 { data: WeatherCurrent, stale: boolean }，永不 reject。
export async function fetchCurrentWeather(city) {
  const coords = resolveCityCoords(city);
  const cacheKey = buildCacheKey(CURRENT_CACHE_KEY, city);
  const cached = readCache(cacheKey, CURRENT_TTL_MS);

  if (cached.fresh && isWeatherCurrent(cached.value)) {
    return { data: { ...cached.value, stale: false }, stale: false };
  }

  try {
    const url = `${FORECAST_BASE_URL}?latitude=${coords.latitude}&longitude=${coords.longitude}`
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=auto';
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`天气请求失败: HTTP ${response.status}`);
    }
    const json = await response.json();
    const current = json && typeof json === 'object' ? json.current : null;
    if (!current) {
      throw new Error('天气响应缺少 current 字段');
    }
    const data = {
      temp: Number(current.temperature_2m),
      feels_like: Number(current.apparent_temperature),
      humidity: Number(current.relative_humidity_2m),
      weather_code: Number(current.weather_code),
      weather_text: wmoToText(Number(current.weather_code)),
      stale: false,
      fetched_at: Date.now(),
    };
    writeCache(cacheKey, data);
    return { data, stale: false };
  } catch (error) {
    if (isWeatherCurrent(cached.value)) {
      return { data: { ...cached.value, stale: true }, stale: true };
    }
    return { data: createMockCurrent(), stale: true };
  }
}

// 未来预报：缓存优先（TTL 3h）→ 网络 → 旧缓存（stale）→ mock 兜底。
// 预报从「明天」起算，请求 8 天窗口取明天起 7 天（R14）。
// 返回 { data: DailyForecastItem[], stale: boolean }，永不 reject。
export async function fetchDailyForecast(city) {
  const coords = resolveCityCoords(city);
  const cacheKey = buildCacheKey(DAILY_CACHE_KEY, city);
  const cached = readCache(cacheKey, DAILY_TTL_MS);

  if (cached.fresh && isDailyForecast(cached.value)) {
    return { data: cached.value, stale: false };
  }

  try {
    const url = `${FORECAST_BASE_URL}?latitude=${coords.latitude}&longitude=${coords.longitude}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
      + `&timezone=auto&forecast_days=${FORECAST_REQUEST_WINDOW_DAYS}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`预报请求失败: HTTP ${response.status}`);
    }
    const json = await response.json();
    const daily = json && typeof json === 'object' ? json.daily : null;
    if (!daily || !Array.isArray(daily.time)) {
      throw new Error('预报响应缺少 daily 字段');
    }
    const items = [];
    for (let i = 1; i < daily.time.length && items.length < DAILY_FORECAST_DAYS; i += 1) {
      const code = Number(daily.weather_code[i]);
      items.push({
        date: String(daily.time[i]),
        temp_max: Number(daily.temperature_2m_max[i]),
        temp_min: Number(daily.temperature_2m_min[i]),
        weather_code: code,
        weather_text: wmoToText(code),
      });
    }
    if (items.length === 0) {
      throw new Error('预报响应无有效数据');
    }
    writeCache(cacheKey, items);
    return { data: items, stale: false };
  } catch (error) {
    if (isDailyForecast(cached.value)) {
      return { data: cached.value, stale: true };
    }
    return { data: createMockDaily(), stale: true };
  }
}
