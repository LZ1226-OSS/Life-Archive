import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/utils/appConfig.js';
import {
  getTimePeriod,
  getGreeting,
  resolveTimeBounds,
  DEFAULT_TIME_BOUNDS,
} from '../src/services/timeService.js';

// 统一用 2026-10-24 本地时间构造边界用例（PRD R01：左闭右开）。
function at(hour, minute = 0) {
  return new Date(2026, 9, 24, hour, minute, 0);
}

describe('timeService.getTimePeriod 四时段边界（左闭右开，R01）', () => {
  const boundaryCases = [
    [0, 0, 'night', '00:00 → 深夜'],
    [4, 59, 'night', '04:59 → 深夜'],
    [5, 0, 'morning', '05:00 → 早'],
    [11, 59, 'morning', '11:59 → 早'],
    [12, 0, 'noon', '12:00 → 午'],
    [17, 59, 'noon', '17:59 → 午'],
    [18, 0, 'evening', '18:00 → 晚'],
    [23, 59, 'evening', '23:59 → 晚'],
  ];

  boundaryCases.forEach(([hour, minute, expected, label]) => {
    it(`${label}（${expected}）`, () => {
      expect(getTimePeriod(at(hour, minute))).toBe(expected);
    });
  });

  it('各时段中间值', () => {
    expect(getTimePeriod(at(8, 30))).toBe('morning');
    expect(getTimePeriod(at(15, 0))).toBe('noon');
    expect(getTimePeriod(at(21, 0))).toBe('evening');
    expect(getTimePeriod(at(2, 0))).toBe('night');
  });
});

describe('timeService.getGreeting 四时段文案', () => {
  const config = {
    greeter: 'Deep seek',
    msg_morning: '劳累的一天又开始了',
    msg_noon: '今天已经活一半了',
    msg_night: '您又活了一天呢！存个档吧',
  };

  it('早：标题「早上好」+ 副标题「用户X提醒您，Y」', () => {
    expect(getGreeting('morning', config)).toEqual({
      title: '早上好',
      subtitle: '用户Deep seek提醒您，劳累的一天又开始了',
    });
  });

  it('午：标题「中午好」+ 副标题拼接', () => {
    expect(getGreeting('noon', config)).toEqual({
      title: '中午好',
      subtitle: '用户Deep seek提醒您，今天已经活一半了',
    });
  });

  it('晚：无标题、不加前缀的完整句', () => {
    expect(getGreeting('evening', config)).toEqual({
      title: '',
      subtitle: '用户Deep seek提醒您，您又活了一天呢！存个档吧',
    });
  });

  it('深夜：标题「夜深了」+ 可配置副标题（BugFix v1.1，24 小时均有问好）', () => {
    expect(getGreeting('night', config)).toEqual({
      title: '夜深了',
      subtitle: '用户Deep seek提醒您，您又活了一天呢！存个档吧',
    });
  });

  it('未知时段按深夜兜底', () => {
    expect(getGreeting('unknown-period', config)).toEqual({
      title: '夜深了',
      subtitle: '用户Deep seek提醒您，您又活了一天呢！存个档吧',
    });
  });

  it('自定义文案即时生效（IR7）', () => {
    const custom = { ...config, greeter: '小圆圆', msg_night: '晚安，好梦' };
    expect(getGreeting('evening', custom).subtitle).toBe('用户小圆圆提醒您，晚安，好梦');
    expect(getGreeting('morning', custom).subtitle).toBe('用户小圆圆提醒您，劳累的一天又开始了');
  });

  it('config 缺失 / 为 null 不抛错', () => {
    expect(() => getGreeting('night', null)).not.toThrow();
    expect(getGreeting('night', null).title).toBe('夜深了');
    expect(getGreeting('night', null).subtitle).toBe('用户提醒您，undefined');
    expect(() => getGreeting('morning', undefined)).not.toThrow();
    expect(() => getGreeting('evening', {})).not.toThrow();
  });
});

describe('timeService.getTimePeriod 自定义时段边界（R18，v1.2）', () => {
  // 用户配置：早 6 点起、午 11 点起、晚 20 点起（合法严格递增）。
  const config = { time_morning_start: 6, time_noon_start: 11, time_evening_start: 20 };

  const boundaryCases = [
    [0, 0, 'night', '00:00 → 深夜（早于自定义 06:00）'],
    [5, 59, 'night', '05:59 → 深夜'],
    [6, 0, 'morning', '06:00 → 早'],
    [10, 59, 'morning', '10:59 → 早'],
    [11, 0, 'noon', '11:00 → 午'],
    [19, 59, 'noon', '19:59 → 午'],
    [20, 0, 'evening', '20:00 → 晚'],
    [23, 59, 'evening', '23:59 → 晚'],
  ];

  boundaryCases.forEach(([hour, minute, expected, label]) => {
    it(`${label}（${expected}）`, () => {
      expect(getTimePeriod(at(hour, minute), config)).toBe(expected);
    });
  });

  it('深夜型配置：早 1 / 午 9 / 晚 17', () => {
    const nightOwl = { time_morning_start: 1, time_noon_start: 9, time_evening_start: 17 };
    expect(getTimePeriod(at(0, 0), nightOwl)).toBe('night');
    expect(getTimePeriod(at(0, 59), nightOwl)).toBe('night');
    expect(getTimePeriod(at(1, 0), nightOwl)).toBe('morning');
    expect(getTimePeriod(at(8, 59), nightOwl)).toBe('morning');
    expect(getTimePeriod(at(9, 0), nightOwl)).toBe('noon');
    expect(getTimePeriod(at(16, 59), nightOwl)).toBe('noon');
    expect(getTimePeriod(at(17, 0), nightOwl)).toBe('evening');
    expect(getTimePeriod(at(23, 59), nightOwl)).toBe('evening');
  });

  it('极值配置：早 0 / 午 12 / 晚 23（23 点仅一小时晚间，无深夜）', () => {
    const extreme = { time_morning_start: 0, time_noon_start: 12, time_evening_start: 23 };
    expect(getTimePeriod(at(0, 0), extreme)).toBe('morning');
    expect(getTimePeriod(at(11, 59), extreme)).toBe('morning');
    expect(getTimePeriod(at(12, 0), extreme)).toBe('noon');
    expect(getTimePeriod(at(22, 59), extreme)).toBe('noon');
    expect(getTimePeriod(at(23, 0), extreme)).toBe('evening');
    expect(getTimePeriod(at(23, 59), extreme)).toBe('evening');
  });

  it('config 缺时间键时回退默认边界（向后兼容 v1.1 行为）', () => {
    expect(getTimePeriod(at(5, 0), { greeter: 'x' })).toBe('morning');
    expect(getTimePeriod(at(11, 59), {})).toBe('morning');
    expect(getTimePeriod(at(18, 0), null)).toBe('evening');
    expect(getTimePeriod(at(2, 0), undefined)).toBe('night');
  });

  it('非法时间值逐个回退默认边界', () => {
    const bad = { time_morning_start: 'abc', time_noon_start: 25, time_evening_start: '' };
    expect(getTimePeriod(at(5, 0), bad)).toBe('morning');
    expect(getTimePeriod(at(12, 0), bad)).toBe('noon');
    expect(getTimePeriod(at(18, 0), bad)).toBe('evening');
    expect(getTimePeriod(at(2, 0), bad)).toBe('night');
  });

  it('字符串数字被正确解析（输入框回填场景）', () => {
    const strConfig = { time_morning_start: '6', time_noon_start: '11', time_evening_start: '20' };
    expect(getTimePeriod(at(5, 59), strConfig)).toBe('night');
    expect(getTimePeriod(at(6, 0), strConfig)).toBe('morning');
    expect(getTimePeriod(at(11, 0), strConfig)).toBe('noon');
    expect(getTimePeriod(at(20, 0), strConfig)).toBe('evening');
  });
});

describe('timeService.resolveTimeBounds 边界解析（R18，v1.2）', () => {
  it('空 config / null / undefined 返回默认边界', () => {
    expect(resolveTimeBounds({})).toEqual({ morningStart: 5, noonStart: 12, eveningStart: 18 });
    expect(resolveTimeBounds(null)).toEqual(DEFAULT_TIME_BOUNDS);
    expect(resolveTimeBounds(undefined)).toEqual(DEFAULT_TIME_BOUNDS);
  });

  it('合法自定义值透传', () => {
    expect(resolveTimeBounds({ time_morning_start: 6, time_noon_start: 11, time_evening_start: 20 }))
      .toEqual({ morningStart: 6, noonStart: 11, eveningStart: 20 });
  });

  it('逐个字段独立回退：仅 noon 非法时其余保持', () => {
    expect(resolveTimeBounds({ time_morning_start: 6, time_noon_start: 'x', time_evening_start: 20 }))
      .toEqual({ morningStart: 6, noonStart: 12, eveningStart: 20 });
  });

  it('越界 / 小数 / 布尔回退', () => {
    expect(resolveTimeBounds({ time_morning_start: -1, time_noon_start: 12.5, time_evening_start: 24 }))
      .toEqual(DEFAULT_TIME_BOUNDS);
    expect(resolveTimeBounds({ time_morning_start: true, time_noon_start: 12, time_evening_start: 18 }))
      .toEqual({ morningStart: 5, noonStart: 12, eveningStart: 18 });
  });

  it('空串 / null / undefined 单键回退', () => {
    expect(resolveTimeBounds({ time_morning_start: '', time_noon_start: null, time_evening_start: undefined }))
      .toEqual(DEFAULT_TIME_BOUNDS);
  });

  it('空格串回退（防 Number(" ")===0 陷阱），纯数字字符串透传', () => {
    expect(resolveTimeBounds({ time_noon_start: ' ' }))
      .toEqual({ morningStart: 5, noonStart: 12, eveningStart: 18 });
    expect(resolveTimeBounds({ time_morning_start: '7', time_noon_start: 1.5 }))
      .toEqual({ morningStart: 7, noonStart: 12, eveningStart: 18 });
  });

  it('小数越界值回退默认后 getTimePeriod 仍按默认 5/12/18 判定', () => {
    const decimalCfg = { time_morning_start: 1.5 };
    expect(getTimePeriod(at(7, 0), decimalCfg)).toBe('morning');
    expect(getTimePeriod(at(2, 0), decimalCfg)).toBe('night');
    expect(getTimePeriod(at(18, 0), decimalCfg)).toBe('evening');
  });

  it('返回新对象且不修改 DEFAULT_TIME_BOUNDS（防共享引用污染）', () => {
    const result = resolveTimeBounds({});
    expect(result).not.toBe(DEFAULT_TIME_BOUNDS);
    result.morningStart = 99;
    expect(DEFAULT_TIME_BOUNDS.morningStart).toBe(5);
  });

  it('非严格递增整体回退默认（存储损坏/篡改防御，QA 回归 v1.2）', () => {
    const reversed = { time_morning_start: 10, time_noon_start: 8, time_evening_start: 20 };
    const equal = { time_morning_start: 8, time_noon_start: 8, time_evening_start: 20 };
    expect(resolveTimeBounds(reversed)).toEqual({ morningStart: 5, noonStart: 12, eveningStart: 18 });
    expect(resolveTimeBounds(equal)).toEqual(DEFAULT_TIME_BOUNDS);
    // 回退后时段判定自洽：07:00 属早、02:00 属深夜（QA 实证场景）。
    expect(getTimePeriod(at(7, 0), reversed)).toBe('morning');
    expect(getTimePeriod(at(2, 0), reversed)).toBe('night');
    expect(getTimePeriod(at(7, 0), equal)).toBe('morning');
    expect(getTimePeriod(at(2, 0), equal)).toBe('night');
  });

  it('新旧键合并出的非递增整体回退（如仅存 time_morning_start:20 → {20,12,18}）', () => {
    const merged = { time_morning_start: 20 };
    expect(resolveTimeBounds(merged)).toEqual(DEFAULT_TIME_BOUNDS);
    expect(getTimePeriod(at(7, 0), merged)).toBe('morning');
    expect(getTimePeriod(at(2, 0), merged)).toBe('night');
  });
});

describe('timeService 24 小时问好不变式（BugFix v1.1 + R18，v1.2）', () => {
  // 任何配置下每个小时都必须命中唯一合法时段，保证 24 小时均有问好。
  const configs = [
    undefined,
    {},
    { time_morning_start: 5, time_noon_start: 12, time_evening_start: 18 },
    { time_morning_start: 0, time_noon_start: 12, time_evening_start: 23 },
    { time_morning_start: 6, time_noon_start: 11, time_evening_start: 20 },
  ];

  configs.forEach((config, index) => {
    it(`配置 #${index}：0-23 每小时均命中唯一时段`, () => {
      for (let hour = 0; hour < 24; hour += 1) {
        const period = getTimePeriod(at(hour, 30), config);
        expect(['morning', 'noon', 'evening', 'night']).toContain(period);
      }
    });
  });

  it('默认配置下四时段覆盖小时数恰为 7/6/6/5', () => {
    const counts = { morning: 0, noon: 0, evening: 0, night: 0 };
    for (let hour = 0; hour < 24; hour += 1) {
      counts[getTimePeriod(at(hour, 0))] += 1;
    }
    expect(counts).toEqual({ morning: 7, noon: 6, evening: 6, night: 5 });
  });

  it('默认配置下四时段 subtitle 均非空且深夜标题为「夜深了」（BugFix v1.1 固化）', () => {
    (['morning', 'noon', 'evening', 'night']).forEach((period) => {
      const greeting = getGreeting(period, {
        ...DEFAULT_CONFIG,
        greeter: 'Deep seek',
      });
      expect(greeting.subtitle.length).toBeGreaterThan(0);
    });
    expect(getGreeting('night', DEFAULT_CONFIG).title).toBe('夜深了');
    expect(getGreeting('morning', DEFAULT_CONFIG).title.length).toBeGreaterThan(0);
    expect(getGreeting('noon', DEFAULT_CONFIG).title.length).toBeGreaterThan(0);
  });
});
