import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../context/ConfigContext.jsx';
import DiaoDiaoYu from '../components/DiaoDiaoYu.jsx';
import { DEFAULT_CONFIG, FIELD_RULES, THEMES, TIME_FIELD_RULES, validateConfig } from '../utils/appConfig.js';
import { getGreeting, getTimePeriod } from '../services/timeService.js';
import { saveCityCoords, searchCity } from '../services/weatherService.js';
import { useNow } from './GreetingPage.jsx';

// 自定义设置页（R03-R06/R15/R18）：5 项文案输入 / 时间分段 / 实时预览 / 主题 / 城市搜索 /
// 恢复默认（行内二次确认）/ 保存校验（红描边行内报错，不弹窗 IR8）。

// 实时预览三段并列高亮：key → 对应时段。
const MESSAGE_FIELDS = [
  { key: 'msg_morning', period: 'morning' },
  { key: 'msg_noon', period: 'noon' },
  { key: 'msg_night', period: 'evening' },
];

// 时间分段字段（R18）：展示顺序与 config 键名；标签统一取 TIME_FIELD_RULES 单一来源。
const TIME_FIELDS = [
  { key: 'time_morning_start' },
  { key: 'time_noon_start' },
  { key: 'time_evening_start' },
];

// 时间输入解析（R18）：可解析为整数的（number 或纯数字字符串）返回该数字；
// 空串 / 小数 / 非数字返回 null。null 时保留原始输入串，供保存校验行内报错（IR8）。
function parseHour(raw) {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const value = Number(raw.trim());
    return Number.isInteger(value) ? value : null;
  }
  return null;
}

export default function SettingsPage() {
  const { config, saveConfig, resetConfig } = useConfig();
  // 草稿与生效配置分离（8.6）：draft 驱动实时预览，saveConfig 才落库生效。
  const [draft, setDraft] = useState(() => ({ ...config }));
  const [errors, setErrors] = useState({});
  const [tip, setTip] = useState('');
  const [resetArmed, setResetArmed] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const [citySearchError, setCitySearchError] = useState('');
  const cityInputRef = useRef(null);
  const tipTimerRef = useRef(null);

  const now = useNow(30000);
  // 时段判定随草稿的时间边界实时变化（R18）：改边界即时影响预览高亮与呆呆鱼表情。
  const period = getTimePeriod(now, draft);
  const preview = getGreeting(period, draft);

  // 卸载时清理行内提示定时器。
  useEffect(
    () => () => {
      if (tipTimerRef.current) {
        clearTimeout(tipTimerRef.current);
      }
    },
    [],
  );

  // 行内提示：2s 后自动消失，不弹窗（IR3/IR8）。
  const showTip = (message) => {
    setTip(message);
    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current);
    }
    tipTimerRef.current = setTimeout(() => {
      setTip('');
      tipTimerRef.current = null;
    }, 2000);
  };

  const updateField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  // 时间输入（R18）：可解析为整数的存数字（预览与保存直接用）；无法解析时保留原始字符串，
  // 让输入框回显用户所填内容，保存时由 validateConfig 统一行内报错（IR8）。
  const updateTimeField = (key, value) => {
    const parsed = parseHour(value);
    setDraft((prev) => ({ ...prev, [key]: parsed === null ? value : parsed }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  // 保存：validateConfig → 红描边行内报错 / 通过则 saveConfig + 「已保存」行内提示。
  const handleSave = () => {
    const result = validateConfig(draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    const next = {
      greeter: draft.greeter.trim(),
      msg_morning: draft.msg_morning.trim(),
      msg_noon: draft.msg_noon.trim(),
      msg_night: draft.msg_night.trim(),
      btn_label: draft.btn_label.trim(),
      theme_id: draft.theme_id,
      city: draft.city,
      // validateConfig 已保证三个时间字段为 0-23 整数，此处统一转数字落库（R18）。
      time_morning_start: Number(draft.time_morning_start),
      time_noon_start: Number(draft.time_noon_start),
      time_evening_start: Number(draft.time_evening_start),
    };
    if (!saveConfig(next)) {
      setErrors({ form: '保存失败，请检查浏览器存储空间后重试' });
      return;
    }
    setDraft(next);
    setErrors({});
    setResetArmed(false);
    showTip('已保存');
  };

  // 恢复默认：行内二次确认（按钮变「确认恢复？」）后还原默认配置（6 项文案 + 默认主题 +
  // 默认时段边界 5/12/18），city 不重置（R06/设计 5.7）。
  const handleReset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    resetConfig();
    setDraft({ ...DEFAULT_CONFIG, city: draft.city });
    setErrors({});
    setResetArmed(false);
    showTip('已恢复默认');
  };

  // 城市搜索（R15）：输入 → searchCity → 结果列表。
  const handleSearchCity = async () => {
    // Android WebView + 中文输入法组合输入时，受控组件 state 可能与 DOM 实际值
    // 不同步（onChange 未触发/滞后）。搜索时以 DOM 真实值为准，state 仅作回退，
    // 避免误报「请输入城市名称」（BugFix v1.1）。
    const domValue = cityInputRef.current && typeof cityInputRef.current.value === 'string'
      ? cityInputRef.current.value
      : '';
    const query = (domValue || cityQuery).trim();
    if (!query) {
      setCitySearchError('请输入城市名称');
      setCityResults([]);
      return;
    }
    setSearchingCity(true);
    setCitySearchError('');
    const results = await searchCity(query);
    setSearchingCity(false);
    if (results.length === 0) {
      setCityResults([]);
      setCitySearchError('未找到相关城市，换个关键词试试');
      return;
    }
    setCityResults(results);
  };

  // 选中城市：写 archive.city_coords 并立即持久化 city（R15：搜索→选择→天气更新），
  // 同时更新草稿；未保存的文案编辑不受影响。
  const handleSelectCity = (option) => {
    saveCityCoords(option);
    if (saveConfig({ ...config, city: option.name })) {
      setDraft((prev) => ({ ...prev, city: option.name }));
      showTip(`已切换城市：${option.name}`);
    }
    setCityResults([]);
    setCityQuery('');
  };

  return (
    <div className="px-5 pb-8 pt-5">
      <h1 className="text-xl font-bold text-ink">自定义</h1>

      {/* 文案区：5 个输入行（label + maxLength + n/上限计数） */}
      <section className="mt-4 rounded-card bg-white p-4 shadow-card">
        {Object.keys(FIELD_RULES).map((key) => {
          const rule = FIELD_RULES[key];
          const value = typeof draft[key] === 'string' ? draft[key] : '';
          const hasError = Boolean(errors[key]);
          return (
            <div key={key} className="mt-3 first:mt-0">
              <div className="flex items-center justify-between">
                <label htmlFor={`field-${key}`} className="text-sm text-ink-sub">
                  {rule.label}
                </label>
                <span className="text-xs text-ink-sub/70">
                  {value.length}/{rule.max}
                </span>
              </div>
              <input
                id={`field-${key}`}
                type="text"
                value={value}
                maxLength={rule.max}
                onChange={(event) => updateField(key, event.target.value)}
                className={`mt-1 w-full rounded-btn border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand ${
                  hasError ? 'border-danger' : 'border-black/5'
                }`}
              />
              {hasError && <p className="mt-1 text-xs text-danger">{errors[key]}</p>}
            </div>
          );
        })}
      </section>

      {/* 时间分区间（R18）：早/中/晚开始时间，0-23 整数严格递增，改动即时影响预览时段 */}
      <section className="mt-4 rounded-card bg-white p-4 shadow-card">
        <p className="text-sm text-ink-sub">时间分段</p>
        <p className="mt-1 text-xs text-ink-sub/70">调整早/中/晚时段的开始时间（0-23 点，须依次递增）</p>
        <div className="mt-3 space-y-3">
          {TIME_FIELDS.map((field) => {
            const raw = draft[field.key];
            const value = typeof raw === 'number' || typeof raw === 'string' ? raw : '';
            const hasError = Boolean(errors[field.key]);
            return (
              <div key={field.key} className="flex items-center justify-between">
                <label htmlFor={`field-${field.key}`} className="text-sm text-ink-sub">
                  {TIME_FIELD_RULES[field.key].label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`field-${field.key}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={value}
                    onChange={(event) => updateTimeField(field.key, event.target.value)}
                    className={`w-16 rounded-btn border bg-surface px-3 py-2 text-center text-sm tabular-nums text-ink outline-none transition-colors focus:border-brand ${
                      hasError ? 'border-danger' : 'border-black/5'
                    }`}
                  />
                  <span className="text-xs text-ink-sub">点</span>
                </div>
              </div>
            );
          })}
        </div>
        {TIME_FIELDS.some((field) => errors[field.key]) && (
          <div className="mt-3 space-y-1">
            {TIME_FIELDS.map((field) =>
              errors[field.key] ? (
                <p key={field.key} className="text-xs text-danger">
                  {errors[field.key]}
                </p>
              ) : null,
            )}
          </div>
        )}
      </section>

      {/* 实时预览卡（R05）：当前时段问候 + 自定义按钮 + 三段并列高亮 + 呆呆鱼引导气泡 */}
      <section className="mt-4 rounded-card bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {preview.title && <p className="text-xl font-bold text-ink">{preview.title}</p>}
            <p className="mt-1 text-base leading-relaxed text-ink-sub">{preview.subtitle}</p>
            <div className="mt-3 inline-flex rounded-btn bg-brand px-5 py-2 text-sm font-bold text-white">
              {draft.btn_label || DEFAULT_CONFIG.btn_label}
            </div>
            <div className="mt-4 space-y-1.5">
              {MESSAGE_FIELDS.map((field) => {
                const active = field.period === period;
                return (
                  <div
                    key={field.key}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      active ? 'bg-tint/15' : ''
                    }`}
                  >
                    {active && (
                      <span className="h-4 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    )}
                    <span className="text-ink-sub">{draft[field.key]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative shrink-0">
            <span className="absolute -left-3 top-2 z-10 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[11px] text-ink-sub shadow-card">
              改点什么吧～
              <span
                className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-white"
                aria-hidden="true"
              />
            </span>
            <DiaoDiaoYu period={period} size={88} animated={false} />
          </div>
        </div>
      </section>

      {/* 主题区：4 个色板单选卡，选中者主橙描边 */}
      <section className="mt-4 rounded-card bg-white p-4 shadow-card">
        <p className="text-sm text-ink-sub">主题配色</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {THEMES.map((theme) => {
            const selected = draft.theme_id === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => updateField('theme_id', theme.id)}
                className={`rounded-btn border-2 bg-surface p-3 text-left transition-colors ${
                  selected ? 'border-brand' : 'border-transparent'
                }`}
              >
                <div className="flex gap-1.5" aria-hidden="true">
                  {[theme.vars['--primary'], theme.vars['--accent'], theme.vars['--bg']].map((color) => (
                    <span
                      key={color}
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-ink">{theme.name}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 城市搜索区（R15） */}
      <section className="mt-4 rounded-card bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-sub">当前城市</p>
          <p className="text-sm font-medium text-ink">{draft.city}</p>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            ref={cityInputRef}
            type="text"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            onCompositionEnd={(event) => setCityQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSearchCity();
              }
            }}
            enterKeyHint="search"
            placeholder="搜索城市，如：上海"
            className="flex-1 rounded-btn border border-black/5 bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
          />
          <button
            type="button"
            onClick={handleSearchCity}
            disabled={searchingCity}
            className="rounded-btn bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
          >
            {searchingCity ? '搜索中' : '搜索'}
          </button>
        </div>
        {citySearchError && <p className="mt-1 text-xs text-danger">{citySearchError}</p>}
        {cityResults.length > 0 && (
          <ul className="mt-2 divide-y divide-black/5 rounded-btn border border-black/5">
            {cityResults.map((option) => (
              <li key={`${option.name}-${option.latitude}-${option.longitude}`}>
                <button
                  type="button"
                  onClick={() => handleSelectCity(option)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink transition-colors active:bg-tint/10"
                >
                  <span>{option.name}</span>
                  <span className="text-xs text-ink-sub">
                    {[option.admin, option.country].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 底部操作区：恢复默认（行内二次确认）+ 保存 */}
      {errors.form && <p className="mt-3 text-xs text-danger">{errors.form}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          className={`rounded-btn border px-4 py-3 text-sm font-medium transition-colors ${
            resetArmed ? 'border-danger text-danger' : 'border-black/10 text-ink-sub active:bg-black/5'
          }`}
        >
          {resetArmed ? '确认恢复？' : '恢复默认'}
        </button>
        {resetArmed && (
          <button
            type="button"
            onClick={() => setResetArmed(false)}
            className="text-xs text-ink-sub"
          >
            取消
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="mt-3 w-full rounded-btn bg-brand py-3.5 text-lg font-bold text-white transition-opacity active:opacity-90"
      >
        保存
      </button>
      {tip && <p className="mt-2 text-center text-xs text-brand">{tip}</p>}
    </div>
  );
}
