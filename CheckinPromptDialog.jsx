import DiaoDiaoYu from './DiaoDiaoYu.jsx';

// 晚间未存档提醒对话框（R17，v1.2）：evening 且当日未存档时弹出。
// 主按钮执行存档（复用父级 handleCheckin 链路）；次按钮/点遮罩 = 本次会话关闭。
// 存档成功后父级 todayRecord 更新，弹出条件自动失效，无需组件内感知存档结果。
export default function CheckinPromptDialog({ btnLabel, message, onArchive, onDismiss }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-xs rounded-card bg-white p-6 text-center shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center">
          <DiaoDiaoYu period="evening" size={96} />
        </div>
        <p className="mt-4 text-lg font-bold text-ink">今晚还没存档哦</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-sub">{message}</p>
        <button
          type="button"
          onClick={onArchive}
          className="mt-5 w-full rounded-btn bg-brand py-3 text-base font-bold text-white transition-opacity active:opacity-90"
        >
          {btnLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-xs text-ink-sub"
        >
          稍后再说
        </button>
      </div>
    </div>
  );
}
