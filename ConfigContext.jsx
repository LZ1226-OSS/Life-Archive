import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG, getThemeById } from '../utils/appConfig.js';
import { readConfig, writeConfig } from '../utils/storage.js';

// 全局配置 Context（仅配置域）：config / theme / saveConfig / resetConfig + 主题 CSS 变量注入。

const ConfigContext = createContext(null);

// 十六进制色值 → Tailwind 透明度修饰符所需的 RGB 通道串（如 '#FF8C42' → '255 140 66'）。
function hexToRgbChannels(hex) {
  const matched = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!matched) {
    return '0 0 0';
  }
  const value = parseInt(matched[1], 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

// 挂载时读取配置并与 DEFAULT_CONFIG 合并；theme_id 非法时回退默认主题。
function loadConfig() {
  const stored = readConfig();
  const merged = { ...DEFAULT_CONFIG, ...stored };
  merged.theme_id = getThemeById(merged.theme_id).id;
  return merged;
}

// 过滤 undefined 后与默认值合并，保证 10 个配置键齐全（含 R18 三个时段边界）。
function mergeWithDefaults(next) {
  const merged = { ...DEFAULT_CONFIG };
  if (next && typeof next === 'object') {
    Object.keys(next).forEach((key) => {
      if (next[key] !== undefined) {
        merged[key] = next[key];
      }
    });
  }
  return merged;
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(loadConfig);
  const theme = useMemo(() => getThemeById(config.theme_id), [config.theme_id]);

  // 主题变化 → 写入 document.documentElement CSS 变量（--bg/--primary/--accent/--text/--text-sub
  // 及派生的 --*-rgb 通道值），全 App 即时生效（R04/IR7 基础）。
  useEffect(() => {
    const root = document.documentElement;
    Object.keys(theme.vars).forEach((name) => {
      const value = theme.vars[name];
      root.style.setProperty(name, value);
      root.style.setProperty(`${name}-rgb`, hexToRgbChannels(value));
    });
  }, [theme]);

  // 保存配置：合并默认值 → 持久化 → 同步 state。写入失败返回 false 且不更新 state。
  const saveConfig = useCallback((next) => {
    const merged = mergeWithDefaults(next);
    const finalConfig = {
      ...merged,
      theme_id: getThemeById(merged.theme_id).id,
    };
    if (!writeConfig(finalConfig)) {
      return false;
    }
    setConfig(finalConfig);
    return true;
  }, []);

  // 恢复默认：还原默认配置（6 项文案 + 默认主题 + 默认时段边界），city 不重置（保持用户所选城市，见设计 5.7）。
  const resetConfig = useCallback(() => {
    const city = typeof config.city === 'string' && config.city.trim()
      ? config.city
      : DEFAULT_CONFIG.city;
    const next = { ...DEFAULT_CONFIG, city };
    writeConfig(next);
    setConfig(next);
  }, [config.city]);

  const value = useMemo(
    () => ({ config, theme, saveConfig, resetConfig }),
    [config, theme, saveConfig, resetConfig],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

// 消费全局配置的 Hook；必须在 ConfigProvider 内部使用。
export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig 必须在 ConfigProvider 内部使用');
  }
  return context;
}
