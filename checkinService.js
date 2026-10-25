// 存档状态机纯函数 + 存储层查重（R02/R08/R09）。
// 当日唯一性在存储层保证：saveCheckin 先读全量记录，按 checkin_date 查重，
// 当日已存在则直接返回 null（不写第二条），从机制上保证重复点击/重复进入不产生第二条记录。
import { formatDate, formatTime, formatDateTime, shiftDate } from '../utils/date.js';
import { readRecords, writeRecords } from '../utils/storage.js';

// 生成记录 id：优先 crypto.randomUUID()，不可用时降级时间戳+随机串。
function generateId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // 降级到下方实现
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 查询当日存档记录；无记录返回 null。
export function getTodayRecord(records, today) {
  const list = Array.isArray(records) ? records : [];
  return list.find((record) => record.checkin_date === today) || null;
}

// 当日是否可存档（当日无记录即可存）。
export function canCheckin(records, today) {
  return !getTodayRecord(records, today);
}

// 依据当前配置与时间创建一条存档记录。
// 写入时快照 greeter 与 msg_night（8.6）：历史日详情不随后续改配置失真。
export function createCheckinRecord(config, now) {
  return {
    id: generateId(),
    checkin_date: formatDate(now),
    checkin_time: formatTime(now),
    greeter: config.greeter,
    message: config.msg_night,
    created_at: formatDateTime(now),
  };
}

// 存档主入口：当日唯一 + 快照落库。
// 返回新记录；当日已存在（或写入失败）返回 null。
export function saveCheckin(config, now) {
  const records = readRecords();
  const today = formatDate(now);
  if (!canCheckin(records, today)) {
    return null;
  }
  const record = createCheckinRecord(config, now);
  const nextRecords = [...records, record];
  if (!writeRecords(nextRecords)) {
    return null;
  }
  return record;
}

// 连续存档天数（R09）：今日已存则从今日向前连续计数；
// 今日未存则从昨日向前连续计数（今天不打断连续）；昨日也断档则为 0。
export function calcStreakDays(records, todayStr) {
  const list = Array.isArray(records) ? records : [];
  const dates = new Set(list.map((record) => record.checkin_date));
  let cursor = dates.has(todayStr) ? todayStr : shiftDate(todayStr, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

// 指定年月的已存日期集合（Set<string>），供月视图橙点标记。
// month 为自然月（1-12），按月字符串前缀比较。
export function getMonthCheckinDates(records, year, month) {
  const list = Array.isArray(records) ? records : [];
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const dates = new Set();
  list.forEach((record) => {
    if (typeof record.checkin_date === 'string' && record.checkin_date.startsWith(prefix)) {
      dates.add(record.checkin_date);
    }
  });
  return dates;
}
