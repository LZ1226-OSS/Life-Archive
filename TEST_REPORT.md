# 《存档吧！》QA 测试报告（最终版）

> 撰写：QA 工程师 严过关（Edward） · 2026-10-24 · 依据：PRD V1.0（许清楚）+ 系统设计 V1.0（高见远）
> 测试框架：Vitest 2.1.9（environment: node）· 测试目录：`tests/` · 运行方式：`npm test`

---

## Summary（最终结果）

- **Total Tests: 116** | **Passed: 116** | **Failed: 0**
- 测试文件：7 个全部通过 — date(17) / appConfig(15) / timeService(16) / storage(17) / checkinService(21) / weatherService(28) / integration(2)
- 覆盖率估计：**约 95%**（六个目标模块全部公开 API + 关键错误处理路径 + 集成冒烟全链路；未覆盖 UI 组件层——按设计约定 services/utils 零 React 依赖，node 环境不测组件）
- 构建验证：`npm run build` 通过（47 modules transformed，dist 产物正常）
- **Routing Decision: NoOne（全部通过，交付成功）**

---

## 测试轮次记录

### Round 1（首轮全量）
- 结果：116 用例，115 通过、1 失败
- 失败项为**源码规格偏差**：`wmoToText(66)/wmoToText(67)` 返回 `'冻雨'`，PRD 4.4 明文规定「61-67 雨」→ 路由给工程师（寇豆码），附期望 vs 实际、出错文件与函数（`src/services/weatherService.js` `WMO_TEXT_TABLE`）、修复建议
- 另有 1 个**测试代码 Bug 自行修复**：`fetchDailyForecast` 成功用例 `data[4]` 差一错误（响应 daily 下标 5 = code 80，误按 code 61 断言），改为断言 `data[3]='雨'`(61)、`data[4]='阵雨'`(80)、`data[5]='雷雨'`(95) 后通过

### Round 2（工程师修复后回归）
- 工程师修复：`WMO_TEXT_TABLE` `66/67: '冻雨'` → `'雨'`（依据 PRD 4.4，未动测试）
- 回归结果：**116/116 全部通过**（连续两次完整运行确认）
- 61-67 全区段（61/63/65/66/67）= 雨 ✓；51-57、71-77、80-82、95-99、未知码区段无回归 ✓
- `npm run build` 复验通过 ✓
- 达到退出条件：全部通过 → 输出成功报告，不进入第 3 轮

---

## 测试覆盖明细

| 模块 | 用例数 | 覆盖点 |
|------|-------|--------|
| `src/utils/date.js` | 17 | formatDate/Time/DateTime 本地时区（禁 toISOString 漂移回归）、shiftDate 跨月/跨年/闰年/大跨度、getMonthMatrix 固定 42 格 + 周日起始 + 当月天数 + 12 月跨年补位、getWeekdayLabel 全 7 标签 |
| `src/utils/appConfig.js` | 15 | DEFAULT_CONFIG 逐项对齐 PRD R03、THEMES 恰 4 套 + 规定 CSS 变量名 + 色值、FIELD_RULES 上限、getThemeById 未知 id 回退默认、validateConfig 空值/纯空格/超长 21·51·7/边界 20·50·6/每字段独立报错/trim 后定长/非字符串兜底 |
| `src/services/timeService.js` | 16 | getTimePeriod 八边界（04:59→night、05:00→morning、11:59→morning、12:00→noon、17:59→noon、18:00→evening、23:59→evening、00:00→night）+ 时段中值；getGreeting 四时段文案（早/午标题+副标题拼接「用户X提醒您，Y」、晚无前缀完整句、深夜「夜深了，好梦」）+ 未知时段兜底 + null config 不抛错 |
| `src/utils/storage.js` | 17 | readRecords/writeRecords 往返 + 损坏/非数组 JSON 回退、readConfig 往返 + 损坏/非对象回退、readCache 无缓存 null / TTL 内 fresh=true / 达到 TTL fresh=false（边界）/ 结构损坏回退、writeCache `{cached_at, value}` 结构、缺失 localStorage 全兜底不抛错 |
| `src/services/checkinService.js` | 21 | saveCheckin 当日唯一（第二次返回 null 不产第二条）+ 快照冻结 greeter/msg_night + 跨日复位、getTodayRecord/canCheckin、calcStreakDays（今昨连续=2、断档=1、今日未存从昨日起算、跨月/跨年连续、乱序重复）、getMonthCheckinDates 月过滤 + 补零前缀 |
| `src/services/weatherService.js` | 28 | wmoToText/wmoToIcon 全 PRD 码段 + 未知码兜底（含修复后 61-67 雨区段）、resolveCityCoords 默认北京 + 保存命中 + 非法拒存、fetchCurrentWeather/fetchDailyForecast 成功 normalize 中文 + 写缓存 + 缓存新鲜不请求 + fetch 抛错/同步抛错/非 2xx/缺字段 → stale 兜底**不 reject** + 旧缓存 stale 降级 + 城市后缀缓存键、searchCity 空查询/成功映射/失败返回 [] |
| `tests/integration.test.js` | 2 | saveCheckin → readRecords → getTodayRecord → calcStreakDays 全链路冒烟（mock localStorage）+ 跨日复位连续接续 |

## 关键验收标准对照（PRD）

| 验收项 | 状态 |
|--------|------|
| R01 四时段边界（11:59/12:00、17:59/18:00、23:59/00:00、04:59/05:00） | ✅ 16 用例 |
| R02 当日唯一 + 早/午/深夜无打卡卡逻辑（service 层） | ✅ 21 用例 |
| R03 默认值 + 自定义文案即时生效 | ✅ 15 + 16 用例 |
| R04 4 套主题 + 规定 CSS 变量 | ✅ 15 用例 |
| R08 文案快照冻结 | ✅ 21 用例 |
| R09 连续天数（断档清零/跨月跨年） | ✅ 21 用例 |
| R10 本地时区日期 + localStorage 持久化 + 损坏回退 | ✅ 17 + 17 用例 |
| R13-R16 天气 normalize/缓存 TTL/降级链不 reject/mock 兜底 | ✅ 28 用例 |
| IR8 所有错误路径无抛错 | ✅ 全覆盖 |

## 环境备注（非产品问题）

- 沙箱内 vitest **forks（子进程）池**偶发 fs broker IPC 竞态：`EPERM: operation not permitted`（vitest SSR 模块缓存写临时目录被 WorkBuddy 沙箱 broker 队列驱逐），并行跑时偶发导致部分测试文件不执行。改用 `--pool=threads` 或 `--no-file-parallelism` 后连续多次完整运行 116/116 全绿。该问题仅存在于本沙箱执行环境，工程师本地/CI 的 `npm test`（默认配置）不受影响；项目配置未做任何改动。

## 遗留问题 / Accepted Deviation（Known Issues）

- **无阻塞性遗留问题**。
- **Accepted Deviation（已接受偏差，主理人裁定，记录在案）**：`WMO_TEXT_TABLE` 56/57 为「冻雨」，PRD 4.4 对该区段仅写「51-57 小雨/毛毛雨」——这是档系粗略标签，非逐码单值规定（区别于「61-67 雨」的明文单值，故 66/67 必须修正而 56/57 不必）。WMO 标准语义中 56/57 即 freezing drizzle（冻毛毛雨/冻雨），实现用词更精确，属合理的产品化偏差。按主理人裁定：**不为此新增失败断言、不再路由工程师**，测试仅断言 PRD 无歧义的 51/53/55（小雨/小雨/毛毛雨），56/57 不断言具体值。

## Round 1 观察项复核结论（图标表 key 61）

- QA Round 1 曾提出「WMO_ICON_TABLE key 61 重复定义」的坏味道提醒；经按主理人要求自行 grep 复核（`^\s*6[17]:`），**证实为 QA 误读，该提醒已撤回**：
  - `src/services/weatherService.js:34` → `61: '雨',`（文本表）
  - `src/services/weatherService.js:38` → `67: '雨',`（文本表，Round 2 修复后）
  - `src/services/weatherService.js:66` → `61: '🌧️',`（图标表）
  - `src/services/weatherService.js:70` → `67: '🌧️',`（图标表）
  - key 61 全文件仅两处、分属两张表，表内无重复；第 61 行实为 `51: '🌦️'`（小雨档图标）。
- 测试侧已改正过时注释，并同时锁定两个易混淆键：`wmoToIcon(51) === '🌦️'`、`wmoToIcon(61) === '🌧️'`，防止未来误删 key 51。

## 最终验证记录（Round 2 确认跑）

- `npx vitest run --no-file-parallelism`：7 个文件 116/116 通过（00:31 复跑确认，与 00:28、00:29 `--pool=threads` 两次完整跑结果一致）
- `npm run build`：通过（47 modules transformed，dist 产物正常）

## 产出物

- 测试文件：`archive-app/tests/`（7 个 `.test.js` + `mockLocalStorage.js` 共享 localStorage mock 工厂）
- 本报告：`archive-app/docs/TEST_REPORT.md`

---

# 附：V1.1 / V1.2 增量测试记录（2026-10-25）

> V1.1（用户实测 2 Bug 修复）+ V1.2（2 项新需求：R17 晚间未存档弹窗 / R18 自定义时间分段）的 QA 回归记录。执行方式同前（`vitest run --no-file-parallelism`，node 环境）。

## V1.1 — Bug 修复回归

- **Bug 1（深夜无问候语 → 24 小时均有问好）**：`getGreeting('night')` 由 `{title:'', subtitle:'夜深了，好梦'}` 改为 `{title:'夜深了', subtitle:'用户X提醒您，{msg_night}'}`；GreetingPage 深夜分支补渲染问候标题（保留极简防打扰布局：无天气卡、无打卡入口）。timeService.test.js 深夜/未知时段/config 缺失断言同步更新。
- **Bug 2（手机 APK 城市搜索误报「请输入城市名称」）**：根因为 Android WebView + 中文输入法（IME）组合输入时 React 受控组件 state 与 DOM input 实际值不同步（onChange 未触发/滞后）。修复：SettingsPage `handleSearchCity` 改为 DOM 值优先（`cityInputRef.current.value`）、state 回退；input 增加 `onCompositionEnd` 同步、`onKeyDown` 回车搜索、`enterKeyHint="search"`；`capacitor.config.json` 删除 `captureInput`。组件层交互在 node 测试环境不可测，由代码审查 + 探针脚本覆盖（QA 第一轮 D 项）。
- 回归结果：116/116 通过（深夜断言转绿，其余零回归）。

## V1.2 — 新需求回归（QA 两轮）

- **R17 晚间未存档弹窗**：新建 `CheckinPromptDialog.jsx`；GreetingPage 条件 `period==='evening' && !todayRecord && !promptDismissed`，主按钮复用 `handleCheckin`（saveCheckin 当日查重，重复点击不产生第二条记录），遮罩/「稍后再说」会话级关闭，跨日 effect 复位。
- **R18 自定义时间分段**：DEFAULT_CONFIG 增 `time_morning_start/time_noon_start/time_evening_start`（默认 5/12/18，共 10 键）；`getTimePeriod(date, config)` 边界可配置且不传 config 与旧行为一致（向后兼容）；`resolveTimeBounds` 逐项回退 + 非递增整体回退；`validateTimeBounds`（0-23 整数、严格递增，顺序错误用 `time_bounds` 键）并入 `validateConfig`；SettingsPage 时间分区间行内报错；ConfigContext 按 DEFAULT_CONFIG 合并实现旧配置自动迁移。
- **第一轮回归**：155/155 + 构建通过；探针 54/56——发现 1 个**中危缺陷**：`resolveTimeBounds` 缺少非递增整体回退防御（`{10,8,20}`、`{8,8,20}` 时段判定错乱，07:00 误判 night）。QA 补 3 条回归用例（空格串回退、'7' 透传、1.5 回退、24 小时问好不变式）。
- **工程师修正**：resolveTimeBounds 补单调性守卫（`!(morningStart < noonStart && noonStart < eveningStart)` → 整体返回默认边界），新增 2 条非递增回退用例。
- **第二轮复归**：探针 32/32（逆序/相等/新旧键合并非递增均正确回退且合法配置零误伤）；**160/160 全绿**；构建成功（48 modules，dist 产物含全部新功能标记）；改动范围严格限定于 timeService.js + timeService.test.js，无意外改动。**结论：放行。**

## V1.1/V1.2 最终状态

- 测试：160/160 通过（timeService 46 / appConfig 29 / weatherService 28 / checkinService 21 / date 17 / storage 17 / integration 2）
- 交付：`存档吧-v1.2-debug.apk`（versionName 1.2 / versionCode 2，包名 com.cundangba.app，minSdk 24 / targetSdk 36，约 4.1MB；aapt 验证包名/权限/LAUNCHER/版本，资源含呆呆鱼图片与最新 JS bundle，capacitor 配置已移除 captureInput）
