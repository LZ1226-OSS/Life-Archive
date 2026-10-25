// 应用配置纯函数模块：默认值、主题表、字段校验规则。
// 本模块不依赖 React/DOM，可被 QA 直接单测。

// 全局唯一默认值来源（R03/R10/R18）：禁止在组件中硬编码默认文案。
// 共 10 个键：7 项基础配置 + 3 项时段边界（早/中/晚开始时间，小时，R18）。
export const DEFAULT_CONFIG = {
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
};

// 4 套预设主题（R04）：每套为一组 PRD 规定名 CSS 变量映射。
export const THEMES = [
  {
    id: 'warm-orange',
    name: '暖橙治愈',
    vars: {
      '--bg': '#FAF7F0',
      '--primary': '#FF8C42',
      '--accent': '#A8C8E8',
      '--text': '#333333',
      '--text-sub': '#666666',
    },
  },
  {
    id: 'sea-salt-blue',
    name: '海盐蓝',
    vars: {
      '--bg': '#F0F6FA',
      '--primary': '#6FA8DC',
      '--accent': '#B7D7E8',
      '--text': '#2F3B45',
      '--text-sub': '#5A6B7A',
    },
  },
  {
    id: 'peach-sunset',
    name: '蜜桃日落',
    vars: {
      '--bg': '#FFF5EE',
      '--primary': '#FF7B54',
      '--accent': '#FFD1B3',
      '--text': '#4A3B32',
      '--text-sub': '#8A6F5E',
    },
  },
  {
    id: 'mint-soda',
    name: '薄荷苏打',
    vars: {
      '--bg': '#F0FAF6',
      '--primary': '#57B894',
      '--accent': '#BEE3D2',
      '--text': '#2E4038',
      '--text-sub': '#5F7A6E',
    },
  },
];

// 字段校验规则（R03/校验规则表）：trim 后非空 + 长度上限。
export const FIELD_RULES = {
  greeter: { max: 20, label: '提示人' },
  msg_morning: { max: 50, label: '早上提示文本' },
  msg_noon: { max: 50, label: '中午提示文本' },
  msg_night: { max: 50, label: '晚上提示文本' },
  btn_label: { max: 6, label: '存档按钮文字' },
};

// 时间分段字段规则（R18）：0-23 整数小时，三个边界须严格递增（早 < 午 < 晚）。
export const TIME_FIELD_RULES = {
  time_morning_start: { label: '早间开始时间' },
  time_noon_start: { label: '午间开始时间' },
  time_evening_start: { label: '晚间开始时间' },
};

// 把原始输入解析为小时整数：number 或纯数字字符串均可；
// 空串 / undefined / null / 小数 / 非数字字符串一律返回 NaN（调用方按非法处理）。
function toHourValue(raw) {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : NaN;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const value = Number(raw.trim());
    return Number.isInteger(value) ? value : NaN;
  }
  return NaN;
}

// 校验时间分段（R18）：三个字段均须为 0-23 之间的整数，且严格递增（早 < 午 < 晚）。
// 返回 { valid, errors }，结构与 validateConfig 一致（字段名为键、行内提示文案为值），
// 既可供设置页单独使用，也由 validateConfig 合并进统一保存校验。
export function validateTimeBounds(times) {
  const errors = {};
  const draft = times && typeof times === 'object' ? times : {};
  const values = {};

  Object.keys(TIME_FIELD_RULES).forEach((key) => {
    const value = toHourValue(draft[key]);
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      errors[key] = `${TIME_FIELD_RULES[key].label}须为 0-23 之间的整数`;
    } else {
      values[key] = value;
    }
  });

  // 全部字段合法才做递增判定，避免错误值参与比较。
  if (Object.keys(errors).length === 0) {
    if (values.time_morning_start >= values.time_noon_start) {
      errors.time_noon_start = '午间开始时间须晚于早间开始时间';
    } else if (values.time_noon_start >= values.time_evening_start) {
      errors.time_evening_start = '晚间开始时间须晚于午间开始时间';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// 按 theme_id 取主题；未命中时回退默认主题（暖橙治愈）。
export function getThemeById(themeId) {
  return THEMES.find((theme) => theme.id === themeId) || THEMES[0];
}

// 校验自定义配置：任一字段 trim 后为空或超长即不合法。
// 返回 { valid, errors }，errors 以字段名为键、行内提示文案为值。
export function validateConfig(config) {
  const errors = {};
  const draft = config && typeof config === 'object' ? config : {};

  Object.keys(FIELD_RULES).forEach((field) => {
    const rule = FIELD_RULES[field];
    const raw = draft[field];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) {
      errors[field] = `${rule.label}不能为空`;
    } else if (value.length > rule.max) {
      errors[field] = `${rule.label}不能超过 ${rule.max} 个字符`;
    }
  });

  // 时间分段校验（R18）：与文案字段错误合并后统一返回。
  const timeResult = validateTimeBounds(draft);
  Object.keys(timeResult.errors).forEach((key) => {
    errors[key] = timeResult.errors[key];
  });

  return { valid: Object.keys(errors).length === 0, errors };
}
