import { useEffect, useState } from 'react';
import { fetchCurrentWeather, fetchDailyForecast, wmoToIcon } from '../services/weatherService.js';
import { getWeekdayLabel } from '../utils/date.js';
import { DEFAULT_CONFIG } from '../utils/appConfig.js';

// 天气卡双形态：props { variant: 'current' | 'compact' | 'forecast', city }。
//   current  问候页当日卡（温度/状况/体感/湿度）
//   compact  问候页午间紧凑单行简讯
//   forecast 日历页未来预报横滚列表（默认 5 天，可展开至 7 天）
// mount 时经 weatherService 拉取（city 变自动重取）；stale 时标注「数据可能不是最新」。
// weatherService 永不抛异常，任何失败均走兜底，页面不白屏（R16/IR8）。

function displayTemp(value) {
  return Number.isFinite(value) ? Math.round(value) : '--';
}

// 预报日期标签：第一天显示「明天」，其余显示「周X」（本地时区解析）。
function forecastDayLabel(dateStr, index) {
  if (index === 0) {
    return '明天';
  }
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) {
    return '';
  }
  return getWeekdayLabel(new Date(year, month - 1, day));
}

function StaleNote({ align = 'right' }) {
  return (
    <span className={`text-xs text-ink-sub/70 ${align === 'right' ? 'ml-auto' : ''}`}>
      数据可能不是最新
    </span>
  );
}

export default function WeatherCard({ variant = 'current', city = DEFAULT_CONFIG.city }) {
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpanded(false);

    const load = async () => {
      try {
        if (variant === 'forecast') {
          const result = await fetchDailyForecast(city);
          if (cancelled) {
            return;
          }
          setForecast(Array.isArray(result.data) ? result.data : []);
          setStale(Boolean(result.stale));
        } else {
          const result = await fetchCurrentWeather(city);
          if (cancelled) {
            return;
          }
          setCurrent(result.data || null);
          setStale(Boolean(result.stale));
        }
      } catch (error) {
        // weatherService 保证不抛异常，此处为双保险：保持静默降级，不白屏不报错。
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [variant, city]);

  if (variant === 'forecast') {
    const days = expanded ? forecast : forecast.slice(0, 5);
    return (
      <div>
        {loading && forecast.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-sub">预报加载中…</p>
        ) : (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {days.map((item, index) => (
              <div
                key={item.date}
                className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-card bg-surface py-3"
              >
                <span className="text-xs text-ink-sub">{forecastDayLabel(item.date, index)}</span>
                <span className="text-2xl" aria-hidden="true">{wmoToIcon(item.weather_code)}</span>
                <span className="text-xs text-ink-sub">
                  {displayTemp(item.temp_max)}°/{displayTemp(item.temp_min)}°
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center">
          {stale && <StaleNote />}
          {forecast.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="ml-auto text-xs text-brand"
            >
              {expanded ? '收起' : '展开 7 天'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 rounded-card bg-white px-4 py-2.5 shadow-card">
        {loading && !current ? (
          <span className="text-xs text-ink-sub">天气加载中…</span>
        ) : (
          <>
            <span className="text-xl" aria-hidden="true">
              {current ? wmoToIcon(current.weather_code) : '🌡️'}
            </span>
            <span className="text-sm font-bold text-ink">
              {current ? `${displayTemp(current.temp)}°C` : '--°C'}
            </span>
            <span className="text-sm text-ink-sub">{current ? current.weather_text : ''}</span>
            {stale && <StaleNote />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      {loading && !current ? (
        <p className="py-3 text-center text-xs text-ink-sub">天气加载中…</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tint/20 text-2xl"
              aria-hidden="true"
            >
              {current ? wmoToIcon(current.weather_code) : '🌡️'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-ink">
                {city} · {current ? `${displayTemp(current.temp)}°C` : '--°C'} ·{' '}
                {current ? current.weather_text : '暂无数据'}
              </p>
              <p className="mt-0.5 text-sm text-ink-sub">
                体感 {current ? `${displayTemp(current.feels_like)}°C` : '--°C'} · 湿度{' '}
                {current ? `${current.humidity}%` : '--%'}
              </p>
            </div>
          </div>
          {stale && (
            <p className="mt-1 text-right text-xs text-ink-sub/70">数据可能不是最新</p>
          )}
        </>
      )}
    </div>
  );
}
