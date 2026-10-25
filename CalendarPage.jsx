import { useMemo, useState } from 'react';
import { useConfig } from '../context/ConfigContext.jsx';
import WeatherCard from '../components/WeatherCard.jsx';
import DiaoDiaoYu from '../components/DiaoDiaoYu.jsx';
import { calcStreakDays, getMonthCheckinDates } from '../services/checkinService.js';
import { readRecords } from '../utils/storage.js';
import { formatDate, getMonthMatrix, getWeekdayLabel } from '../utils/date.js';

// 日历页：月份切换 / 连续徽章 / 月视图 / 日详情 / 预报区块（R07/R08/R09/R14）。

const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

// 'YYYY-MM-DD' → 'M月D日 周X'（本地时区解析）。
function formatDateLabel(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) {
    return dateStr;
  }
  return `${month}月${day}日 ${getWeekdayLabel(new Date(year, month - 1, day))}`;
}

export default function CalendarPage() {
  const { config } = useConfig();
  const today = new Date();
  const todayStr = formatDate(today);

  // Tab 切换会重挂载本页，此处读取的即最新存档数据。
  const [records] = useState(() => readRecords());
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(null);

  const matrix = useMemo(() => getMonthMatrix(view.year, view.month), [view.year, view.month]);
  const monthDates = useMemo(
    () => getMonthCheckinDates(records, view.year, view.month),
    [records, view.year, view.month],
  );
  const streakDays = useMemo(() => calcStreakDays(records, todayStr), [records, todayStr]);
  const selectedRecord = useMemo(
    () => (selectedDate ? records.find((record) => record.checkin_date === selectedDate) || null : null),
    [records, selectedDate],
  );

  const isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth() + 1;

  const shiftMonth = (delta) => {
    setSelectedDate(null);
    setView((prev) => {
      const next = prev.month + delta;
      if (next < 1) {
        return { year: prev.year - 1, month: 12 };
      }
      if (next > 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: next };
    });
  };

  const goToCurrentMonth = () => {
    setSelectedDate(null);
    setView({ year: today.getFullYear(), month: today.getMonth() + 1 });
  };

  return (
    <div className="px-5 pb-8 pt-4">
      {/* 月份切换头 + 月份头旁 64px 静态呆呆鱼 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="上个月"
          className="px-2 py-1 text-lg text-ink-sub transition-colors active:text-brand"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-ink">
            {view.year}年{view.month}月
          </h1>
          <DiaoDiaoYu period="morning" size={64} animated={false} />
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="下个月"
          className="px-2 py-1 text-lg text-ink-sub transition-colors active:text-brand"
        >
          ›
        </button>
      </div>

      {!isCurrentMonth && (
        <div className="mt-1 flex justify-end">
          <button type="button" onClick={goToCurrentMonth} className="text-xs text-brand">
            回到当月
          </button>
        </div>
      )}

      {/* 连续存档徽章（R09） */}
      <div className="mt-3 flex items-center gap-2 rounded-card bg-white px-4 py-2.5 shadow-card">
        <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        <span className="text-sm text-ink-sub">已连续存档 {streakDays} 天</span>
      </div>

      {/* 月视图（R07）：已存日橙点 / 今日淡蓝描边 / 空白日 #CCC */}
      <div className="mt-3 rounded-card bg-white p-3 shadow-card">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((label) => (
            <span key={label} className="py-1 text-center text-xs text-ink-sub/70">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {matrix.map((cell) => {
            const isToday = cell.dateStr === todayStr;
            const hasCheckin = monthDates.has(cell.dateStr);
            const isSelected = cell.dateStr === selectedDate;
            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDate(cell.dateStr)}
                aria-label={formatDateLabel(cell.dateStr)}
                className={`flex h-10 flex-col items-center justify-center rounded-lg border transition-colors ${
                  isToday ? 'border-[1.5px] border-tint' : 'border-transparent'
                } ${isSelected ? 'bg-tint/15' : ''}`}
              >
                <span className={`text-sm ${cell.inMonth ? 'text-ink' : 'text-[#CCC]'}`}>
                  {cell.day}
                </span>
                {hasCheckin && (
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 日详情卡（R08）：只读文案快照，不随后续配置失真 */}
      {selectedDate && (
        <div className="mt-3 rounded-card bg-white p-4 shadow-card">
          <p className="text-base font-bold text-ink">{formatDateLabel(selectedDate)}</p>
          {selectedRecord ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-ink-sub">存档时间 {selectedRecord.checkin_time}</p>
              <p className="text-sm text-ink-sub">
                {selectedRecord.greeter}：{selectedRecord.message}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-sub/80">这一天没有留下记录</p>
          )}
        </div>
      )}

      {/* 天气区块：城市名 + 未来预报横滚列表 */}
      <div className="mt-3 rounded-card bg-white p-4 shadow-card">
        <p className="text-base font-bold text-ink">{config.city}</p>
        <div className="mt-3">
          <WeatherCard variant="forecast" city={config.city} />
        </div>
      </div>
    </div>
  );
}
