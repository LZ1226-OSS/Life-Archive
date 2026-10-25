import { useEffect, useRef, useState } from 'react';
import { getWeekdayLabel } from '../utils/date.js';

// 晚间打卡卡（R02）：props { btnLabel, todayRecord, onCheckin }。
// 状态机三态：未存档（主橙可点）→ 点击写入 → 已存档（置灰「已存档」+「今日已存档，明天见」）
// + 庆祝中。点击 → onCheckin() 返回 record → 庆祝动效 + navigator.vibrate(40)（存在性守卫）。
// 重复点击因 disabled 拦截，不产生第二条记录（IR1/IR2/IR4）。

export default function CheckinCard({ btnLabel, todayRecord, onCheckin }) {
  const [celebrating, setCelebrating] = useState(false);
  const timerRef = useRef(null);
  const archived = Boolean(todayRecord);

  // 卸载时清理庆祝定时器，避免内存泄漏。
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  const handleClick = async () => {
    if (archived || celebrating) {
      return;
    }
    let record = null;
    try {
      record = await onCheckin();
    } catch (error) {
      record = null;
    }
    if (!record) {
      return;
    }
    // 震动反馈：存在性守卫，桌面端无感降级（IR3）。
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(40);
    }
    setCelebrating(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCelebrating(false);
      timerRef.current = null;
    }, 800);
  };

  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 ${getWeekdayLabel(now)}`;

  return (
    <div
      className={`rounded-card bg-white p-5 shadow-card transition-transform duration-200 ${
        celebrating ? 'scale-[1.02]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-ink">{dateLabel}</p>
          <p className="mt-1 text-xs text-ink-sub">
            {archived ? `存档时间 ${todayRecord.checkin_time}` : '零输入，一键存档今天'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs ${
            archived ? 'bg-tint/15 text-ink-sub' : 'bg-brand/10 text-brand'
          }`}
        >
          {archived ? '已完成' : '待存档'}
        </span>
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={archived || celebrating}
        className={`mt-4 w-full rounded-btn py-3.5 text-lg font-bold text-white transition-colors ${
          archived
            ? 'cursor-not-allowed bg-neutral-300 text-neutral-500'
            : 'bg-brand active:bg-brand/90'
        }`}
      >
        {archived ? '已存档' : btnLabel}
      </button>

      <p className="mt-2 text-center text-xs text-ink-sub">
        {archived ? '今日已存档，明天见' : '点击即记录，无需输入'}
      </p>
    </div>
  );
}
