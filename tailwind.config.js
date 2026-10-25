/** @type {import('tailwindcss').Config} */

// Tailwind 主题 token 与自定义动效。
// 颜色 token 与 CSS 变量（--bg/--primary/--accent/--text/--text-sub）映射：
// 业务代码只写语义 class（bg-surface / bg-brand / text-ink ...），主题切换对组件透明。
// 变量同时提供 --*-rgb 通道值（由 ConfigContext 依据主题十六进制值自动派生），
// 使 Tailwind 透明度修饰符（如 bg-tint/20）在 CSS 变量主题下可用。
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(var(--bg-rgb) / <alpha-value>)',
        brand: 'rgb(var(--primary-rgb) / <alpha-value>)',
        tint: 'rgb(var(--accent-rgb) / <alpha-value>)',
        ink: 'rgb(var(--text-rgb) / <alpha-value>)',
        'ink-sub': 'rgb(var(--text-sub-rgb) / <alpha-value>)',
        danger: '#E5484D',
      },
      borderRadius: {
        card: '18px',
        btn: '14px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        // 呆呆鱼·早：上下跳跃（2s 循环）
        jump: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        // 呆呆鱼·午：缓慢摇摆（3s 循环）
        sway: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        // 呆呆鱼·午/晚：呼吸缩放
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        // 呆呆鱼·深夜：极慢浮动（灰度态）
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        // 存档成功庆祝：上浮 + 旋转，总时长 800ms（R12 上限内）
        celebrate: {
          '0%': { transform: 'translateY(0) scale(1) rotate(0deg)' },
          '40%': { transform: 'translateY(-16px) scale(1.08) rotate(8deg)' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0deg)' },
        },
        // 庆祝星星粒子：淡入淡出闪烁
        twinkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0.5)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
      animation: {
        jump: 'jump 2s ease-in-out infinite',
        sway: 'sway 3s ease-in-out infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        'float-slow': 'float-slow 4s ease-in-out infinite',
        celebrate: 'celebrate 0.8s ease-out 1',
        twinkle: 'twinkle 0.5s ease-in-out 1',
      },
    },
  },
  plugins: [],
};
