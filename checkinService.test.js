import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTodayRecord,
  canCheckin,
  createCheckinRecord,
  saveCheckin,
  calcStreakDays,
  getMonthCheckinDates,
} from '../src/services/checkinService.js';
import { readRecords, writeRecords } from '../src/utils/storage.js';
import { installLocalStorageMock } from './mockLocalStorage.js';

const CONFIG = {
  greeter: 'Deep seek',
  msg_morning: '劳累的一天又开始了',
  msg_noon: '今天已经活一半了',
  msg_night: '您又活了一天呢！存个档吧',
  btn_label: '存档',
  theme_id: 'warm-orange',
  city: '北京',
};

// 晚间存档时刻：2026-10-24 21:30:12（本地时间）。
const NOW = new Date(2026, 9, 24, 21, 30, 12);

let storage;

beforeEach(() => {
  storage = installLocalStorageMock();
});

afterEach(() => {
  storage.uninstall();
});

describe('checkinService.getTodayRecord / canCheckin', () => {
  it('无记录时 getTodayRecord 为 null、canCheckin 为 true', () => {
    expect(getTodayRecord([], '2026-10-24')).toBeNull();
    expect(canCheckin([], '2026-10-24')).toBe(true);
  });

  it('命中当日记录 / 当日不可再存', () => {
    const records = [{ checkin_date: '2026-10-24', checkin_time: '21:30:00' }];
    expect(getTodayRecord(records, '2026-10-24')).toEqual(records[0]);
    expect(canCheckin(records, '2026-10-24')).toBe(false);
  });

  it('非当日记录不影响当日判定（跨日自动复位，IR4）', () => {
    const records = [{ checkin_date: '2026-10-23' }];
    expect(getTodayRecord(records, '2026-10-24')).toBeNull();
    expect(canCheckin(records, '2026-10-24')).toBe(true);
  });

  it('records 非数组时安全兜底', () => {
    expect(getTodayRecord(null, '2026-10-24')).toBeNull();
    expect(canCheckin(undefined, '2026-10-24')).toBe(true);
  });
});

describe('checkinService.saveCheckin 当日唯一 + 文案快照', () => {
  it('首次存档写入完整字段（快照 greeter/msg_night）', () => {
    const record = saveCheckin(CONFIG, NOW);
    expect(record).not.toBeNull();
    expect(record.checkin_date).toBe('2026-10-24');
    expect(record.checkin_time).toBe('21:30:12');
    expect(record.greeter).toBe('Deep seek');
    expect(record.message).toBe('您又活了一天呢！存个档吧');
    expect(record.created_at).toBe('2026-10-24 21:30:12');
    expect(typeof record.id).toBe('string');
    expect(record.id.length).toBeGreaterThan(0);
    expect(readRecords()).toEqual([record]);
  });

  it('同日第二次存档返回 null 且不产生第二条记录（R02/IR1）', () => {
    expect(saveCheckin(CONFIG, NOW)).not.toBeNull();
    expect(saveCheckin(CONFIG, new Date(2026, 9, 24, 22, 0, 0))).toBeNull();
    expect(readRecords()).toHaveLength(1);
    expect(canCheckin(readRecords(), '2026-10-24')).toBe(false);
  });

  it('跨日后可再次存档（IR4 复位）', () => {
    saveCheckin(CONFIG, NOW);
    const nextDay = saveCheckin(CONFIG, new Date(2026, 9, 25, 21, 0, 0));
    expect(nextDay).not.toBeNull();
    expect(readRecords()).toHaveLength(2);
    expect(canCheckin(readRecords(), '2026-10-25')).toBe(false);
    expect(canCheckin(readRecords(), '2026-10-24')).toBe(false);
  });

  it('文案快照冻结：存档后改配置不影响历史记录（R08/G3）', () => {
    const record = saveCheckin(CONFIG, NOW);
    const changed = { ...CONFIG, greeter: '另一个人', msg_night: '别的文案' };
    const stored = getTodayRecord(readRecords(), '2026-10-24');
    expect(stored.greeter).toBe('Deep seek');
    expect(stored.message).toBe('您又活了一天呢！存个档吧');
    expect(stored).toEqual(record);
    // 次日存档才使用新配置
    const nextDay = saveCheckin(changed, new Date(2026, 9, 25, 21, 0, 0));
    expect(nextDay.greeter).toBe('另一个人');
    expect(nextDay.message).toBe('别的文案');
  });

  it('createCheckinRecord 生成带快照的记录', () => {
    const record = createCheckinRecord(CONFIG, NOW);
    expect(record).toMatchObject({
      checkin_date: '2026-10-24',
      checkin_time: '21:30:12',
      greeter: 'Deep seek',
      message: '您又活了一天呢！存个档吧',
      created_at: '2026-10-24 21:30:12',
    });
  });
});

describe('checkinService.calcStreakDays 连续存档天数（R09）', () => {
  const rec = (dateStr) => ({ checkin_date: dateStr, checkin_time: '21:00:00' });

  it('今昨连续 = 2', () => {
    expect(calcStreakDays([rec('2026-10-23'), rec('2026-10-24')], '2026-10-24')).toBe(2);
  });

  it('仅今日 = 1', () => {
    expect(calcStreakDays([rec('2026-10-24')], '2026-10-24')).toBe(1);
  });

  it('中间断档：昨日缺失，只计今日 = 1（断档前记录不计入）', () => {
    expect(calcStreakDays([rec('2026-10-22'), rec('2026-10-24')], '2026-10-24')).toBe(1);
  });

  it('今日未存从昨日起算：昨日有 = 1；昨日断档 = 0；无记录 = 0', () => {
    expect(calcStreakDays([rec('2026-10-23')], '2026-10-24')).toBe(1);
    expect(calcStreakDays([rec('2026-10-22')], '2026-10-24')).toBe(0);
    expect(calcStreakDays([], '2026-10-24')).toBe(0);
  });

  it('长连续：今日向前 5 天 = 5', () => {
    const records = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map(rec);
    expect(calcStreakDays(records, '2026-10-24')).toBe(5);
  });

  it('跨月连续（1/31 → 2/1 → 2/2）', () => {
    expect(calcStreakDays([rec('2026-01-31'), rec('2026-02-01')], '2026-02-02')).toBe(2);
    expect(
      calcStreakDays([rec('2026-01-31'), rec('2026-02-01'), rec('2026-02-02')], '2026-02-02'),
    ).toBe(3);
  });

  it('跨年连续（2025-12-30/31 → 2026-01-01）', () => {
    const records = [rec('2025-12-30'), rec('2025-12-31'), rec('2026-01-01')];
    expect(calcStreakDays(records, '2026-01-01')).toBe(3);
  });

  it('乱序与重复记录不影响计数', () => {
    const records = [rec('2026-10-24'), rec('2026-10-22'), rec('2026-10-23'), rec('2026-10-23')];
    expect(calcStreakDays(records, '2026-10-24')).toBe(3);
  });

  it('records 非数组时返回 0', () => {
    expect(calcStreakDays(null, '2026-10-24')).toBe(0);
    expect(calcStreakDays(undefined, '2026-10-24')).toBe(0);
  });
});

describe('checkinService.getMonthCheckinDates 月视图标记', () => {
  const rec = (dateStr) => ({ checkin_date: dateStr });

  it('只返回指定年月的已存日期', () => {
    const records = [
      rec('2026-10-01'),
      rec('2026-10-15'),
      rec('2026-10-31'),
      rec('2026-09-30'),
      rec('2026-11-01'),
    ];
    const dates = getMonthCheckinDates(records, 2026, 10);
    expect(dates).toBeInstanceOf(Set);
    expect([...dates].sort()).toEqual(['2026-10-01', '2026-10-15', '2026-10-31']);
  });

  it('月份补零前缀比较（2 月不误匹配 12 月）', () => {
    const records = [rec('2026-02-05'), rec('2026-12-05'), rec('2026-02-28')];
    const dates = getMonthCheckinDates(records, 2026, 2);
    expect([...dates].sort()).toEqual(['2026-02-05', '2026-02-28']);
  });

  it('无记录 / 非数组返回空集合', () => {
    expect(getMonthCheckinDates([], 2026, 10).size).toBe(0);
    expect(getMonthCheckinDates(null, 2026, 10).size).toBe(0);
  });
});
