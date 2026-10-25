import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  THEMES,
  FIELD_RULES,
  TIME_FIELD_RULES,
  validateConfig,
  validateTimeBounds,
  getThemeById,
} from '../src/utils/appConfig.js';

// PRD 规定的 5 个 CSS 变量名（--bg / --primary / --accent / --text / --text-sub）。
const EXPECTED_CSS_VARS = ['--bg', '--primary', '--accent', '--text', '--text-sub'];

describe('utils/appConfig DEFAULT_CONFIG 与 PRD R03 一致', () => {
  it('默认值逐项匹配', () => {
    expect(DEFAULT_CONFIG).toEqual({
      greeter: 'Deep seek',
      msg_morning: '劳累的一天又开始了',
      msg_noon: '今天已经活一半了',
      msg_night: '您又活了一天呢！存个档吧',
      btn_label: '存档',
      theme_id: 'warm-orange',
      city: '北京',
      time_morning_start: 5,
      time_noon_start: 12,
      time_evening_start: 18,
    });
  });
});

describe('utils/appConfig THEMES 主题表（R04）', () => {
  it('恰为 4 套主题且 id/name 符合 PRD', () => {
    expect(THEMES).toHaveLength(4);
    expect(THEMES.map((theme) => theme.id)).toEqual([
      'warm-orange',
      'sea-salt-blue',
      'peach-sunset',
      'mint-soda',
    ]);
    expect(THEMES.map((theme) => theme.name)).toEqual(['暖橙治愈', '海盐蓝', '蜜桃日落', '薄荷苏打']);
  });

  it('每套主题恰含 PRD 规定的 5 个 CSS 变量名且值为十六进制色值', () => {
    THEMES.forEach((theme) => {
      expect(Object.keys(theme.vars).sort()).toEqual([...EXPECTED_CSS_VARS].sort());
      EXPECTED_CSS_VARS.forEach((name) => {
        expect(typeof theme.vars[name]).toBe('string');
        expect(theme.vars[name]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  it('暖橙治愈（默认）色值与 PRD 4.0 一致', () => {
    expect(THEMES[0].vars).toEqual({
      '--bg': '#FAF7F0',
      '--primary': '#FF8C42',
      '--accent': '#A8C8E8',
      '--text': '#333333',
      '--text-sub': '#666666',
    });
  });

  it('FIELD_RULES 字符上限与 PRD 校验规则表一致', () => {
    expect(FIELD_RULES.greeter.max).toBe(20);
    expect(FIELD_RULES.msg_morning.max).toBe(50);
    expect(FIELD_RULES.msg_noon.max).toBe(50);
    expect(FIELD_RULES.msg_night.max).toBe(50);
    expect(FIELD_RULES.btn_label.max).toBe(6);
  });
});

describe('utils/appConfig getThemeById', () => {
  it('命中返回对应主题', () => {
    expect(getThemeById('sea-salt-blue').id).toBe('sea-salt-blue');
    expect(getThemeById('peach-sunset').name).toBe('蜜桃日落');
    expect(getThemeById('mint-soda').name).toBe('薄荷苏打');
  });

  it('未知 id / 空值回退默认主题（暖橙治愈）', () => {
    expect(getThemeById('not-exist').id).toBe('warm-orange');
    expect(getThemeById(undefined).id).toBe('warm-orange');
    expect(getThemeById('').id).toBe('warm-orange');
    expect(getThemeById(null).id).toBe('warm-orange');
  });
});

describe('utils/appConfig validateConfig 保存校验', () => {
  const validDraft = () => ({ ...DEFAULT_CONFIG });

  it('合法配置通过且 errors 为空', () => {
    const result = validateConfig(validDraft());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('空值不通过（trim 后为空）', () => {
    const result = validateConfig({ ...validDraft(), greeter: '', msg_morning: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.greeter).toBe('提示人不能为空');
    expect(result.errors.msg_morning).toBe('早上提示文本不能为空');
  });

  it('边界长度通过：greeter 20 / 三段文本 50 / btn_label 6', () => {
    const draft = validDraft();
    draft.greeter = '长'.repeat(20);
    draft.msg_morning = '早'.repeat(50);
    draft.msg_noon = '午'.repeat(50);
    draft.msg_night = '晚'.repeat(50);
    draft.btn_label = '存'.repeat(6);
    expect(validateConfig(draft).valid).toBe(true);
  });

  it('超长不通过：21 / 51 / 7', () => {
    const r1 = validateConfig({ ...validDraft(), greeter: 'x'.repeat(21) });
    expect(r1.valid).toBe(false);
    expect(r1.errors.greeter).toBe('提示人不能超过 20 个字符');

    const r2 = validateConfig({ ...validDraft(), msg_noon: 'x'.repeat(51) });
    expect(r2.valid).toBe(false);
    expect(r2.errors.msg_noon).toBe('中午提示文本不能超过 50 个字符');

    const r3 = validateConfig({ ...validDraft(), btn_label: 'x'.repeat(7) });
    expect(r3.valid).toBe(false);
    expect(r3.errors.btn_label).toBe('存档按钮文字不能超过 6 个字符');
  });

  it('每个字段独立报错：errors 仅含错误字段', () => {
    const result = validateConfig({ ...validDraft(), greeter: '', btn_label: '' });
    expect(Object.keys(result.errors).sort()).toEqual(['btn_label', 'greeter']);
    expect(result.errors.msg_morning).toBeUndefined();
    expect(result.errors.msg_noon).toBeUndefined();
    expect(result.errors.msg_night).toBeUndefined();
  });

  it('长度按 trim 后判定（前后空格不计入）', () => {
    const draft = { ...validDraft(), greeter: `  ${'x'.repeat(20)}  ` };
    expect(validateConfig(draft).valid).toBe(true);
    const over = { ...validDraft(), greeter: `  ${'x'.repeat(21)}  ` };
    expect(validateConfig(over).valid).toBe(false);
  });

  it('非字符串字段按空值处理', () => {
    const result = validateConfig({ ...validDraft(), greeter: undefined, msg_night: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors.greeter).toBe('提示人不能为空');
    expect(result.errors.msg_night).toBe('晚上提示文本不能为空');
  });

  it('config 非对象时不抛错且判负', () => {
    expect(() => validateConfig(null)).not.toThrow();
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
  });
});

describe('utils/appConfig validateTimeBounds 时间分段校验（R18，v1.2）', () => {
  it('默认边界（5/12/18）通过且 errors 为空', () => {
    const result = validateTimeBounds(DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('合法自定义（6/11/20）通过', () => {
    expect(validateTimeBounds({ time_morning_start: 6, time_noon_start: 11, time_evening_start: 20 }).valid).toBe(true);
  });

  it('极值合法：0/12/23', () => {
    expect(validateTimeBounds({ time_morning_start: 0, time_noon_start: 12, time_evening_start: 23 }).valid).toBe(true);
  });

  it('TIME_FIELD_RULES 恰含三个时间键', () => {
    expect(Object.keys(TIME_FIELD_RULES).sort()).toEqual([
      'time_evening_start',
      'time_morning_start',
      'time_noon_start',
    ]);
  });

  it('非整数不通过（小数）', () => {
    const result = validateTimeBounds({ time_morning_start: 5.5, time_noon_start: 12, time_evening_start: 18 });
    expect(result.valid).toBe(false);
    expect(result.errors.time_morning_start).toBe('早间开始时间须为 0-23 之间的整数');
  });

  it('越界不通过：24 / -1', () => {
    const r1 = validateTimeBounds({ time_morning_start: 24, time_noon_start: 12, time_evening_start: 18 });
    expect(r1.valid).toBe(false);
    expect(r1.errors.time_morning_start).toBe('早间开始时间须为 0-23 之间的整数');

    const r2 = validateTimeBounds({ time_morning_start: -1, time_noon_start: 12, time_evening_start: 18 });
    expect(r2.valid).toBe(false);
    expect(r2.errors.time_morning_start).toBe('早间开始时间须为 0-23 之间的整数');
  });

  it('空串 / 非数字字符串 / undefined 不通过', () => {
    expect(validateTimeBounds({ time_morning_start: '', time_noon_start: 12, time_evening_start: 18 }).valid).toBe(false);
    expect(validateTimeBounds({ time_morning_start: 'abc', time_noon_start: 12, time_evening_start: 18 }).valid).toBe(false);
    expect(validateTimeBounds({ time_noon_start: 12, time_evening_start: 18 }).valid).toBe(false);
  });

  it('相等不通过（须严格递增）：早=午 / 午=晚', () => {
    const r1 = validateTimeBounds({ time_morning_start: 8, time_noon_start: 8, time_evening_start: 18 });
    expect(r1.valid).toBe(false);
    expect(r1.errors.time_noon_start).toBe('午间开始时间须晚于早间开始时间');

    const r2 = validateTimeBounds({ time_morning_start: 5, time_noon_start: 12, time_evening_start: 12 });
    expect(r2.valid).toBe(false);
    expect(r2.errors.time_evening_start).toBe('晚间开始时间须晚于午间开始时间');
  });

  it('逆序不通过（早>午）', () => {
    const result = validateTimeBounds({ time_morning_start: 15, time_noon_start: 10, time_evening_start: 20 });
    expect(result.valid).toBe(false);
    expect(result.errors.time_noon_start).toBe('午间开始时间须晚于早间开始时间');
  });

  it('字符串数字被正确解析（输入框回填场景）', () => {
    expect(validateTimeBounds({ time_morning_start: '6', time_noon_start: '11', time_evening_start: '20' }).valid).toBe(true);
  });

  it('非对象不抛错且判负', () => {
    expect(() => validateTimeBounds(null)).not.toThrow();
    expect(validateTimeBounds(null).valid).toBe(false);
    expect(validateTimeBounds(undefined).valid).toBe(false);
  });
});

describe('utils/appConfig validateConfig 合并时间校验（R18，v1.2）', () => {
  const validDraft = () => ({ ...DEFAULT_CONFIG });

  it('合法配置（含默认时间边界）通过', () => {
    const result = validateConfig(validDraft());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('文案错误与时间错误同时返回', () => {
    const draft = { ...validDraft(), greeter: '', time_noon_start: 5 };
    const result = validateConfig(draft);
    expect(result.valid).toBe(false);
    expect(result.errors.greeter).toBe('提示人不能为空');
    expect(result.errors.time_noon_start).toBe('午间开始时间须晚于早间开始时间');
  });

  it('仅时间非法时文案字段无错误', () => {
    const result = validateConfig({ ...validDraft(), time_morning_start: 24 });
    expect(result.valid).toBe(false);
    expect(result.errors.greeter).toBeUndefined();
    expect(result.errors.msg_morning).toBeUndefined();
    expect(result.errors.time_morning_start).toBe('早间开始时间须为 0-23 之间的整数');
  });
});
