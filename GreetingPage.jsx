import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../context/ConfigContext.jsx';
import StatusBar from '../components/StatusBar.jsx';
import WeatherCard from '../components/WeatherCard.jsx';
import DiaoDiaoYu from '../components/DiaoDiaoYu.jsx';
import CheckinCard from '../components/CheckinCard.jsx';
import CheckinPromptDialog from '../components/CheckinPromptDialog.jsx';
import { getGreeting, getTimePeriod } from '../services/timeService.js';
import { getTodayRecord, saveCheckin } from '../services/checkinService.js';
import { readRecords } from '../utils/storage.js';
import { formatDate, getWeekdayLabel } from '../utils/date.js';

// 当前时间 Hook：30s interval 兜底 + visibilitychange 回到前台立即重算（R01/IR6）。
// 导出供设置页实时预览复用。
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(new Date());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}

// 早/午时段快捷入口（设计 5.3：早/午问候区下方两个小按钮，点击切换 Tab）。
function QuickEntry({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-btn bg-white py-3 text-sm font-medium text-ink-sub shadow-card transition-colors active:bg-tint/10"
    >
      {label}
    </button>
  );
}

// 问候页：四时段渲染 + 跨时段自动刷新 + 晚间存档状态机。
export default function GreetingPage({ onNavigate }) {
  const { config } = useConfig();
  const now = useNow(30000);
  const period = getTimePeriod(now, config);
  const greeting = getGreeting(period, config);
  const todayStr = formatDate(now);

  const [todayRecord, setTodayRecord] = useState(() => getTodayRecord(readRecords(), todayStr));
  const [celebrating, setCelebrating] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const celebrateTimerRef = useRef(null);

  // 跨日（00:00）自动复位：todayStr 变化即重新读取当日记录（IR4），
  // 同时复位弹窗关闭状态（R17：跨日后若当晚仍未存档会再次提醒）。
  useEffect(() => {
    setTodayRecord(getTodayRecord(readRecords(), todayStr));
    setPromptDismissed(false);
  }, [todayStr]);

  // 卸载时清理庆祝定时器。
  useEffect(
    () => () => {
      if (celebrateTimerRef.current) {
        clearTimeout(celebrateTimerRef.current);
      }
    },
    [],
  );

  // 晚间存档：存储层查重当日唯一 + 文案快照；返回 record 供打卡卡触发庆祝序列。
  const handleCheckin = () => {
    const record = saveCheckin(config, new Date());
    if (!record) {
      return null;
    }
    setTodayRecord(record);
    setCelebrating(true);
    if (celebrateTimerRef.current) {
      clearTimeout(celebrateTimerRef.current);
    }
    celebrateTimerRef.current = setTimeout(() => {
      setCelebrating(false);
      celebrateTimerRef.current = null;
    }, 800);
    return record;
  };

  // 深夜（默认 00-05，边界可配置 R18）：极简防打扰——大号时间 + 日期 + 问候标题/副标题，无天气大卡（IR5）。
  // BugFix v1.1：深夜同样显示问候语（24 小时均有问好），标题「夜深了」+ 可配置副标题。
  // v1.3：补极简存档入口（用户反馈深夜找不到签到按钮）——未存档→描边按钮，已存档→弱提示；
  // 呆呆鱼同步支持庆祝态，存档成功后与其他时段一样有庆祝动效。
  if (period === 'night') {
    const bigTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 ${getWeekdayLabel(now)}`;
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <DiaoDiaoYu period="night" celebrating={celebrating} size={120} />
        <p className="mt-8 text-4xl font-bold tabular-nums text-ink">{bigTime}</p>
        <p className="mt-3 text-sm text-ink-sub">{dateLabel}</p>
        <p className="mt-6 text-lg font-medium text-ink">{greeting.title}</p>
        <p className="mt-2 text-sm text-ink-sub/80">{greeting.subtitle}</p>
        {!todayRecord ? (
          <button
            type="button"
            onClick={handleCheckin}
            className="mt-8 rounded-btn border border-brand px-6 py-2.5 text-sm font-medium text-brand transition-opacity active:opacity-80"
          >
            {config.btn_label}
          </button>
        ) : (
          <p className="mt-8 text-xs text-ink-sub/60">今日已存档 ✓</p>
        )}
      </div>
    );
  }

  // 晚间（默认 18-24，边界可配置 R18）：状态栏 → 天气卡 → 主视觉完整句（不加前缀）→ 打卡卡。
  if (period === 'evening') {
    // 晚间未存档提醒（R17）：当日未存档且本次会话未关闭过时弹出存档对话框。
    const shouldPrompt = period === 'evening' && !todayRecord && !promptDismissed;
    return (
      <div className="flex flex-col">
        <StatusBar now={now} />
        <div className="flex-1 px-6 pb-8 pt-4">
          <WeatherCard variant="current" city={config.city} />
          <div className="mt-6 flex flex-col items-center text-center">
            <DiaoDiaoYu period="evening" celebrating={celebrating} size={120} />
            <p className="mt-5 text-xl font-medium leading-relaxed text-ink">{greeting.subtitle}</p>
          </div>
          <div className="mt-6">
            <CheckinCard
              btnLabel={config.btn_label}
              todayRecord={todayRecord}
              onCheckin={handleCheckin}
            />
          </div>
        </div>
        {shouldPrompt && (
          <CheckinPromptDialog
            btnLabel={config.btn_label}
            message={config.msg_night}
            onArchive={handleCheckin}
            onDismiss={() => setPromptDismissed(true)}
          />
        )}
      </div>
    );
  }

  // 早/午（默认 05-18，边界可配置 R18）：状态栏 → 天气卡（午间紧凑简讯）→ 大标题 + 副标题 → 快捷入口。
  return (
    <div className="flex flex-col">
      <StatusBar now={now} />
      <div className="flex-1 px-6 pb-8 pt-4">
        <WeatherCard variant={period === 'noon' ? 'compact' : 'current'} city={config.city} />
        <div className="mt-8 flex flex-col items-center text-center">
          <DiaoDiaoYu period={period} size={120} />
          <h1 className="mt-5 text-3xl font-bold text-ink">{greeting.title}</h1>
          <p className="mt-2 text-lg leading-relaxed text-ink-sub">{greeting.subtitle}</p>
        </div>
        <div className="mt-10 flex gap-3">
          <QuickEntry label="日历" onClick={() => onNavigate?.('calendar')} />
          <QuickEntry label="设置" onClick={() => onNavigate?.('settings')} />
        </div>
      </div>
    </div>
  );
}
