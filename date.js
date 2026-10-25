// 本地时区日期纯函数模块。
// 全站禁用 toISOString()（UTC 漂移），统一使用 getFullYear/getMonth/getDate/getHours...
// 配合 pad2 手工拼接，日期串一律为本地时区（R10/8.2）。

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(value) {
  return String(value).padStart(2, '0');
}

// Date → 'YYYY-MM-DD'（本地时区）
export function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Date → 'HH:mm:ss'（本地时区）
export function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

// Date → 'YYYY-MM-DD HH:mm:ss'（本地时区，created_at 使用）
export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// 日历日加减：'YYYY-MM-DD' + days → 'YYYY-MM-DD'（供连续天数计算，跨月跨年正确）
export function shiftDate(dateStr, days) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return formatDate(date);
}

// 月视图矩阵：固定 42 格（6×7），周日起始（日 一 二 三 四 五 六）。
// month 为自然月（1-12）。返回 [{ dateStr, day, inMonth }]。
export function getMonthMatrix(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const gridStart = new Date(year, month - 1, 1 - firstDay.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      dateStr: formatDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    });
  }
  return cells;
}

// Date → '周日' | '周一' | … | '周六'
export function getWeekdayLabel(date) {
  return WEEKDAY_LABELS[date.getDay()] || WEEKDAY_LABELS[0];
}
