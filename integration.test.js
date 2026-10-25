import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveCheckin,
  getTodayRecord,
  canCheckin,
  calcStreakDays,
  getMonthCheckinDates,
} from '../src/services/checkinService.js';
import { readRecords, writeRecords } from '../src/utils/storage.js';
import { DEFAULT_CONFIG } from '../src/utils/appConfig.js';
import { formatDate, formatDateTime } from '../src/utils/date.js';
import { installLocalStorageMock } from './mockLocalStorage.js';

// 集成冒烟：saveCheckin → readRecords → getTodayRecord → calcStreakDays 全链路，
// 经 mock localStorage 验证存档状态机与数据落盘的一致性（R02/R09/R10）。

let storage;

beforeEach(() => {
  storage = installLocalStorageMock();
});

afterEach(() => {
  storage.uninstall();
});

describe('集成冒烟：晚间一键存档全链路', () => {
  it('存档 → 读回 → 当日查询 → 连续天数', () => {
    const now = new Date(2026, 9, 24, 21, 30, 12); // 2026-10-24 晚间
    const today = formatDate(now);

    // 1. 存档前：当日无记录、可存档、连续 0 天
    expect(getTodayRecord(readRecords(), today)).toBeNull();
    expect(canCheckin(readRecords(), today)).toBe(true);
    expect(calcStreakDays(readRecords(), today)).toBe(0);

    // 2. 一键存档（零输入，IR1）
    const record = saveCheckin(DEFAULT_CONFIG, now);
    expect(record).not.toBeNull();
    expect(record.checkin_date).toBe(today);
    expect(record.created_at).toBe(formatDateTime(now));

    // 3. 读回校验：落盘一条，字段完整
    const stored = readRecords();
    expect(stored).toHaveLength(1);
    expect(getTodayRecord(stored, today)).toEqual(record);

    // 4. 当日唯一：重复存档返回 null，不产生第二条（R02）
    expect(saveCheckin(DEFAULT_CONFIG, now)).toBeNull();
    expect(readRecords()).toHaveLength(1);
    expect(canCheckin(readRecords(), today)).toBe(false);

    // 5. 补一条昨日记录 → 连续 2 天
    writeRecords([
      {
        id: 'rec-yesterday',
        checkin_date: '2026-10-23',
        checkin_time: '21:00:00',
        greeter: 'Deep seek',
        message: '您又活了一天呢！存个档吧',
        created_at: '2026-10-23 21:00:00',
      },
      ...readRecords(),
    ]);
    expect(calcStreakDays(readRecords(), today)).toBe(2);

    // 6. 月视图标记含今日与昨日
    const monthDates = getMonthCheckinDates(readRecords(), 2026, 10);
    expect([...monthDates].sort()).toEqual(['2026-10-23', '2026-10-24']);
  });

  it('跨日后自动复位：次日可再次存档且连续天数接续', () => {
    const day1 = new Date(2026, 9, 24, 21, 30, 12);
    const day2 = new Date(2026, 9, 25, 21, 0, 0);

    expect(saveCheckin(DEFAULT_CONFIG, day1)).not.toBeNull();
    expect(canCheckin(readRecords(), formatDate(day1))).toBe(false);

    // 跨日后按钮复位（IR4）
    expect(canCheckin(readRecords(), formatDate(day2))).toBe(true);
    expect(saveCheckin(DEFAULT_CONFIG, day2)).not.toBeNull();

    expect(readRecords()).toHaveLength(2);
    expect(calcStreakDays(readRecords(), formatDate(day2))).toBe(2);
    expect(getTodayRecord(readRecords(), formatDate(day2)).checkin_date).toBe('2026-10-25');
  });
});
