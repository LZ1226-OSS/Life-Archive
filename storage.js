// localStorage 统一封装（8.1）：全应用只有本模块与 services 允许直接接触 localStorage。
// 所有读写 try/catch 兜底：解析失败返回 fallback，写入失败返回 false，绝不向 UI 抛异常。

const RECORDS_KEY = 'archive.checkin_records';
const CONFIG_KEY = 'archive.app_config';

// 通用 JSON 读：key 不存在或解析失败时返回 fallback。
export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

// 通用 JSON 写：写入成功返回 true，失败返回 false。
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

// 读取存档记录数组；数据损坏时回退空数组。
export function readRecords() {
  const records = readJSON(RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

// 写入存档记录数组。
export function writeRecords(records) {
  return writeJSON(RECORDS_KEY, Array.isArray(records) ? records : []);
}

// 读取应用配置（原始对象）；与 DEFAULT_CONFIG 的合并由 ConfigContext 负责。
export function readConfig() {
  const config = readJSON(CONFIG_KEY, {});
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return config;
  }
  return {};
}

// 写入应用配置。
export function writeConfig(config) {
  return writeJSON(CONFIG_KEY, config);
}

// 读取天气缓存：返回 { value, fresh }。
// 缓存结构统一为 { cached_at, value }；fresh = 未超过 ttlMs。
// 缓存不存在或损坏时 value 为 null、fresh 为 false。
export function readCache(key, ttlMs) {
  const entry = readJSON(key, null);
  if (!entry || typeof entry !== 'object' || typeof entry.cached_at !== 'number') {
    return { value: null, fresh: false };
  }
  const age = Date.now() - entry.cached_at;
  return { value: entry.value, fresh: age < ttlMs };
}

// 写入天气缓存（自动包一层 { cached_at, value }）。
export function writeCache(key, value) {
  return writeJSON(key, { cached_at: Date.now(), value });
}
