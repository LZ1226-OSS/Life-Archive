// 时段判定纯函数模块：四时段左闭右开 + 四时段问候文案。
// 不依赖 React/DOM，可被 QA 直接单测。

// 默认时段边界（小时，左闭右开，R01）：05≤h<12 早、12≤h<18 午、18≤h<24 晚、00≤h<5 深夜。
export const DEFAULT_TIME_BOUNDS = {
  morningStart: 5,
  noonStart: 12,
  eveningStart: 18,
};

// 单个小时值解析（R18）：0-23 的整数（number 或纯数字字符串）透传，
// 其余（undefined / null / 空串 / 小数 / 非数字）回退 fallback，保证函数永不抛错。
function toValidHour(raw, fallback) {
  let value = NaN;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    value = Number(raw.trim());
  }
  return Number.isInteger(value) && value >= 0 && value <= 23 ? value : fallback;
}

// 从 config 解析时段边界（R18）：time_morning_start / time_noon_start / time_evening_start
// 三个键缺失或非法时逐个回退默认值；不传 config 时等价默认边界（向后兼容 v1.1 行为）。
// 逐字段回退后仍做整体单调性守卫：非严格递增（外部篡改/存储损坏/新旧键合并异常）
// 时整体回退默认边界，保证四时段判定自洽（QA 回归 v1.2）。
export function resolveTimeBounds(config) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const morningStart = toValidHour(safeConfig.time_morning_start, DEFAULT_TIME_BOUNDS.morningStart);
  const noonStart = toValidHour(safeConfig.time_noon_start, DEFAULT_TIME_BOUNDS.noonStart);
  const eveningStart = toValidHour(safeConfig.time_evening_start, DEFAULT_TIME_BOUNDS.eveningStart);

  // 整体非严格递增 → 整体回退默认边界，避免 morning/evening 区间塌缩导致判定错乱。
  if (!(morningStart < noonStart && noonStart < eveningStart)) {
    return { ...DEFAULT_TIME_BOUNDS };
  }

  return { morningStart, noonStart, eveningStart };
}

// 四时段判定（R01/R18）：左闭右开——
//  [morningStart, noonStart) 早 / [noonStart, eveningStart) 午 / [eveningStart, 24) 晚 / [0, morningStart) 深夜。
// 边界可由 config 配置；缺省回退默认边界 5/12/18（不传 config 时与 v1.1 完全一致）。
// 保存侧 validateTimeBounds 已保证传入值严格递增，四段合起来恰好覆盖 24 小时无重叠。
export function getTimePeriod(date, config) {
  const { morningStart, noonStart, eveningStart } = resolveTimeBounds(config);
  const hour = date.getHours();
  if (hour >= morningStart && hour < noonStart) {
    return 'morning';
  }
  if (hour >= noonStart && hour < eveningStart) {
    return 'noon';
  }
  if (hour >= eveningStart && hour < 24) {
    return 'evening';
  }
  return 'night';
}

// 四时段问候文案：
//  早 → { title: '早上好', subtitle: `用户${greeter}提醒您，${msg_morning}` }
//  午 → { title: '中午好', subtitle: `用户${greeter}提醒您，${msg_noon}` }
//  晚 → { title: '',       subtitle: `用户${greeter}提醒您，${msg_night}` }（不加前缀）
//  夜 → { title: '夜深了', subtitle: `用户${greeter}提醒您，${msg_night}` }（与早/午/晚结构一致，24 小时均有问好）
export function getGreeting(period, config) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const greeter = typeof safeConfig.greeter === 'string' ? safeConfig.greeter : '';

  switch (period) {
    case 'morning':
      return {
        title: '早上好',
        subtitle: `用户${greeter}提醒您，${safeConfig.msg_morning}`,
      };
    case 'noon':
      return {
        title: '中午好',
        subtitle: `用户${greeter}提醒您，${safeConfig.msg_noon}`,
      };
    case 'evening':
      return {
        title: '',
        subtitle: `用户${greeter}提醒您，${safeConfig.msg_night}`,
      };
    case 'night':
    default:
      return {
        title: '夜深了',
        subtitle: `用户${greeter}提醒您，${safeConfig.msg_night}`,
      };
  }
}
