# 存档吧！

> 分时段智能问候 + 晚间一键存档的治愈系日常打卡 App（移动端优先 Web 应用，可打包为 Android APK）

「存档吧！」以「您又活了一天呢！存个档吧」为核心情绪价值：白天分时段问候陪伴，晚上一键存档今日，日历回顾连续记录。IP 形象「呆呆鱼」全天彩色陪伴，按时段切换徽章与动效（元气 / 慵懒 / 欣慰 / 休眠）。

## 功能特性

- **四时段问候（24 小时均有问好）**：早（默认 5-12 点）/ 午（12-18）/ 晚（18-24）/ 深夜（0-5）左闭右开判定，各时段独立问候文案与呆呆鱼形态；深夜保持极简防打扰布局
- **晚间一键存档**：当日唯一（重复点击/重复进入不产生第二条记录），存档成功庆祝动效，文案快照冻结（历史记录不随后续改配置失真）
- **晚间未存档提醒**：晚间时段当日未存档时自动弹出存档对话框（可稍后再说，跨日自动复位）
- **深夜极简存档入口**：深夜时段提供描边存档按钮，已存档显示弱提示
- **自定义时间分段**：早/中/晚开始时间可调（默认 5/12/18 点，0-23 整数且须递增），全 App 时段判定跟随
- **日历回顾**：月视图橙点标记、日详情（含当日存档快照）、连续存档天数
- **天气**：Open-Meteo 免 key API，当日天气 + 未来 7 天预报，城市搜索（Geocoding），四级降级链（新鲜缓存 → 网络 → 旧缓存 → mock 兜底），任何网络异常不白屏
- **自定义系统**：提示人、早/中/晚三段文案、存档按钮文字、4 套主题（暖橙治愈/海盐蓝/蜜桃日落/薄荷苏打），设置页实时预览，行内校验报错不弹窗
- **本地优先**：无账号无后端，localStorage 持久化，重启不丢

## 技术栈

- **前端**：Vite 5 + React 18 + Tailwind CSS 3.4（JavaScript/JSX，无 TypeScript）
- **测试**：Vitest（node 环境，services/utils 纯函数层 160 条单测）
- **打包**：Capacitor 8 → Android APK（WebView 承载，compileSdk/targetSdk 36，minSdk 24）
- **架构**：SPI 三 Tab（问候/日历/设置）；services/utils 零 React/DOM 依赖的纯函数核心，可独立单测

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器（默认 http://localhost:5173）
npm test           # 运行单元测试（160 条）
npm run build      # 构建 Web 产物到 dist/
```

## 打包 Android APK

环境要求：JDK 21+、Android SDK（platform 36 / build-tools 36.0.0）、Gradle 8.14.3（或用 Android Studio 打开 `android/` 目录）。

```bash
npx cap sync android                          # 同步 Web 产物与配置到 Android 工程
cd android && ./gradlew assembleDebug         # 产出 app/build/outputs/apk/debug/app-debug.apk
```

> `android/local.properties` 含本机 SDK 路径，已被 .gitignore 排除，克隆后需按本机环境创建（`sdk.dir=/your/android/sdk/path`）或用 Android Studio 打开自动生成。

## 项目结构

```
archive-app/
├── src/
│   ├── components/    # UI 组件（DiaoDiaoYu 呆呆鱼 / WeatherCard / CheckinCard / CheckinPromptDialog 等）
│   ├── pages/         # 三个页面（GreetingPage 问候 / CalendarPage 日历 / SettingsPage 设置）
│   ├── services/      # 纯函数业务层（timeService 时段 / checkinService 存档 / weatherService 天气）
│   ├── context/       # ConfigContext 全局配置 + 主题变量注入
│   └── utils/         # 纯函数工具（appConfig / date / storage）
├── tests/             # Vitest 单测（7 个文件，160 条）
├── docs/              # PRD / 系统设计 / 测试报告 / 时序图
├── public/assets/     # 呆呆鱼 IP 图片
├── android/           # Capacitor Android 工程（构建产物已排除）
├── capacitor.config.json
└── vite/tailwind/postcss 配置文件
```

## 数据说明

- 存档记录：`localStorage` key `archive.checkin_records`（当日唯一，含文案快照）
- 应用配置：`archive.app_config`（10 键：提示人/三段文案/按钮文字/主题/城市/三个时段边界）
- 天气缓存：`archive.weather_current` / `archive.weather_daily`（TTL 30min / 3h）
- 城市坐标：`archive.city_coords`

## 文档

- `docs/PRD.md` — 产品需求文档（需求池 R01-R24、交互规则 IR1-IR9）
- `docs/system_design.md` — 系统设计（架构/文件清单/接口签名）
- `docs/TEST_REPORT.md` — QA 测试报告（160/160）
