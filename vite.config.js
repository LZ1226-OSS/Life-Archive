import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vite 构建配置 + Vitest 单元测试配置（测试环境：node，覆盖全部纯函数）。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
  },
});
