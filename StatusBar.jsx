import { getWeekdayLabel } from '../utils/date.js';

// 顶部淡蓝状态栏：props { now: Date }，左 HH:mm、右「M月D日 周X」。
export default function StatusBar({ now }) {
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 ${getWeekdayLabel(now)}`;

  return (
    <div className="flex shrink-0 items-center justify-between bg-tint/20 px-5 py-2 text-sm text-ink-sub">
      <span className="font-medium tabular-nums text-ink">{time}</span>
      <span>{dateLabel}</span>
    </div>
  );
}
