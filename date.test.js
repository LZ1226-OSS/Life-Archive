import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  shiftDate,
  getMonthMatrix,
  getWeekdayLabel,
} from '../src/utils/date.js';

// 注意：所有用本地时间构造 Date（new Date(y, m, d, ...)），避免 toISOString 的 UTC 漂移
// 影响断言；date.js 的实现同样只使用本地 getter，测试与实现对时区假设一致。

describe('utils/date 本地时区格式化', () => {
  it('formatDate 拼接 YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 9, 24))).toBe('2026-10-24');
    expect(formatDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatDate(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(formatDate(new Date(2024, 1, 29))).toBe('2024-02-29');
  });

  it('formatTime 补零拼接 HH:mm:ss', () => {
    expect(formatTime(new Date(2026, 9, 24, 0, 0, 0))).toBe('00:00:00');
    expect(formatTime(new Date(2026, 9, 24, 9, 5, 3))).toBe('09:05:03');
    expect(formatTime(new Date(2026, 9, 24, 23, 59, 59))).toBe('23:59:59');
  });

  it('formatDateTime 拼接 YYYY-MM-DD HH:mm:ss', () => {
    expect(formatDateTime(new Date(2026, 9, 24, 23, 15, 46))).toBe('2026-10-24 23:15:46');
    expect(formatDateTime(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01 00:00:00');
  });

  it('深夜本地时间不漂移到次日（禁 toISOString 回归）', () => {
    // 若误用 toISOString，非 UTC+0 时区下 23:30 会漂到次日；本地构造必须原样输出。
    const lateNight = new Date(2026, 9, 24, 23, 30, 0);
    expect(formatDate(lateNight)).toBe('2026-10-24');
    expect(formatTime(lateNight)).toBe('23:30:00');
    const earlyMorning = new Date(2026, 9, 25, 0, 30, 0);
    expect(formatDate(earlyMorning)).toBe('2026-10-25');
  });
});

describe('utils/date shiftDate 日历日加减（跨月跨年）', () => {
  it('同月内加减与 0 天', () => {
    expect(shiftDate('2026-10-24', 0)).toBe('2026-10-24');
    expect(shiftDate('2026-10-24', 1)).toBe('2026-10-25');
    expect(shiftDate('2026-10-24', -1)).toBe('2026-10-23');
    expect(shiftDate('2026-10-24', 7)).toBe('2026-10-31');
  });

  it('跨月：月初回退 / 月末前进', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28'); // 2026 非闰年
    expect(shiftDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('闰年 2 月 29 日', () => {
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDate('2024-02-29', 1)).toBe('2024-03-01');
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('跨年连续回溯（连续天数计算依赖）', () => {
    expect(shiftDate('2026-01-01', -2)).toBe('2025-12-30');
    expect(shiftDate('2025-12-31', 2)).toBe('2026-01-02');
  });

  it('大跨度加减', () => {
    expect(shiftDate('2026-10-24', 40)).toBe('2026-12-03');
    expect(shiftDate('2026-10-24', -40)).toBe('2026-09-14');
  });
});

describe('utils/date getMonthMatrix 月视图矩阵', () => {
  it('固定 42 格（6×7）', () => {
    expect(getMonthMatrix(2026, 10)).toHaveLength(42);
    expect(getMonthMatrix(2026, 2)).toHaveLength(42);
    expect(getMonthMatrix(2024, 2)).toHaveLength(42);
  });

  it('周日起始：首格为周日、末格为周六', () => {
    const cells = getMonthMatrix(2026, 10);
    const first = new Date(`${cells[0].dateStr}T00:00:00`);
    const last = new Date(`${cells[41].dateStr}T00:00:00`);
    expect(first.getDay()).toBe(0);
    expect(last.getDay()).toBe(6);
  });

  it('2026-10-01 是周四：矩阵从 2026-09-27（周日）开始', () => {
    const cells = getMonthMatrix(2026, 10);
    expect(cells[0].dateStr).toBe('2026-09-27');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[4].dateStr).toBe('2026-10-01');
    expect(cells[4].inMonth).toBe(true);
  });

  it('当月格子数 = 当月天数，且 1 日/末日在矩阵内', () => {
    const october = getMonthMatrix(2026, 10).filter((cell) => cell.inMonth);
    expect(october).toHaveLength(31);
    expect(october[0].day).toBe(1);
    expect(october[0].dateStr).toBe('2026-10-01');
    expect(october[october.length - 1].dateStr).toBe('2026-10-31');

    expect(getMonthMatrix(2026, 2).filter((cell) => cell.inMonth)).toHaveLength(28);
    expect(getMonthMatrix(2024, 2).filter((cell) => cell.inMonth)).toHaveLength(29);
  });

  it('day 与 dateStr 中的日一致', () => {
    getMonthMatrix(2026, 10).forEach((cell) => {
      const [, , day] = cell.dateStr.split('-');
      expect(cell.day).toBe(Number(day));
    });
  });

  it('跨月矩阵：12 月矩阵含次年 1 月补位', () => {
    const cells = getMonthMatrix(2026, 12);
    const inMonth = cells.filter((cell) => cell.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(cells.some((cell) => cell.dateStr.startsWith('2027-01'))).toBe(true);
  });
});

describe('utils/date getWeekdayLabel 星期标签', () => {
  it('周日到周六（2026-10-25 是周日）', () => {
    expect(getWeekdayLabel(new Date(2026, 9, 25))).toBe('周日');
    expect(getWeekdayLabel(new Date(2026, 9, 26))).toBe('周一');
    expect(getWeekdayLabel(new Date(2026, 9, 27))).toBe('周二');
    expect(getWeekdayLabel(new Date(2026, 9, 28))).toBe('周三');
    expect(getWeekdayLabel(new Date(2026, 9, 29))).toBe('周四');
    expect(getWeekdayLabel(new Date(2026, 9, 30))).toBe('周五');
    expect(getWeekdayLabel(new Date(2026, 9, 31))).toBe('周六');
  });

  it('已知日期：2026-10-01 是周四', () => {
    expect(getWeekdayLabel(new Date(2026, 9, 1))).toBe('周四');
  });
});
