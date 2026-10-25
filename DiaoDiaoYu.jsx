// IP 形象「呆呆鱼」（R12）：单图 /assets/daidaiyu.jpg + 时段表情徽章 + 动效 + 庆祝粒子。
// props { period, celebrating, size, animated }：
//   period      'morning' | 'noon' | 'evening' | 'night'
//   celebrating 存档成功庆祝态（上浮+旋转+8 颗星星粒子，≤800ms）
//   size        形象边长（px）
//   animated    是否开启动效（日历/设置页静态陪伴形象传 false）
// v1.3 起全天彩色（去掉深夜灰度滤镜，用户反馈恢复 IP 原彩）；深夜仍保留「💤 休眠」徽章与极慢浮动动效。

const PERIOD_BADGES = {
  morning: { emoji: '☀️', text: '元气' },
  noon: { emoji: '😴', text: '慵懒' },
  evening: { emoji: '🌙', text: '欣慰' },
  night: { emoji: '💤', text: '休眠' },
};

const PERIOD_ANIMATIONS = {
  morning: 'animate-jump',
  noon: 'animate-sway',
  evening: 'animate-breathe',
  night: 'animate-float-slow',
};

// 庆祝粒子：8 颗星星，围绕形象分布，错峰闪烁。
const CELEBRATION_PARTICLES = [
  { top: '-8%', left: '6%', delay: '0ms' },
  { top: '-12%', left: '44%', delay: '40ms' },
  { top: '0%', left: '86%', delay: '80ms' },
  { top: '40%', left: '-12%', delay: '120ms' },
  { top: '76%', left: '-8%', delay: '160ms' },
  { top: '44%', left: '94%', delay: '200ms' },
  { top: '86%', left: '36%', delay: '240ms' },
  { top: '82%', left: '82%', delay: '280ms' },
];

export default function DiaoDiaoYu({ period = 'morning', celebrating = false, size = 112, animated = true }) {
  const badge = PERIOD_BADGES[period] || PERIOD_BADGES.morning;
  const wrapperAnimation = !animated
    ? ''
    : celebrating
      ? 'animate-celebrate'
      : PERIOD_ANIMATIONS[period] || '';
  // 午间：外层摇摆 + 本体呼吸缩放，两种动效叠加。
  const imageAnimation = animated && !celebrating && period === 'noon' ? 'animate-breathe' : '';
  const showBadge = size >= 72;

  return (
    <div className="inline-flex select-none flex-col items-center" style={{ width: size }}>
      <div className={`relative ${wrapperAnimation}`} style={{ width: size, height: size }}>
        <img
          src="/assets/daidaiyu.jpg"
          alt="呆呆鱼"
          width={size}
          height={size}
          className={`h-full w-full rounded-2xl object-cover shadow-card ${imageAnimation}`}
        />
        {animated && !celebrating && period === 'noon' && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-1 top-1 animate-float-slow text-xs text-ink-sub/60"
            >
              Z
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 top-4 animate-float-slow text-sm text-ink-sub/40"
              style={{ animationDelay: '600ms' }}
            >
              z
            </span>
          </>
        )}
        {celebrating &&
          CELEBRATION_PARTICLES.map((particle, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute animate-twinkle text-sm"
              style={{ top: particle.top, left: particle.left, animationDelay: particle.delay }}
            >
              ✨
            </span>
          ))}
      </div>
      {showBadge && (
        <span className="mt-2 rounded-full bg-tint/20 px-3 py-1 text-xs text-ink-sub">
          <span aria-hidden="true">{badge.emoji}</span> {badge.text}
        </span>
      )}
    </div>
  );
}
