// 手机壳容器（R11）：桌面 md: 断点下 390×844 圆角手机壳居中（外层深色底衬托），移动端全屏。
// flex 列布局；内容区由使用方以 flex-1 overflow-y-auto 包裹。
export default function PhoneFrame({ children }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#20242B] md:p-8">
      <div className="flex h-screen w-full flex-col overflow-hidden bg-surface md:h-[844px] md:w-[390px] md:rounded-[2.75rem] md:border-[10px] md:border-[#101216] md:shadow-2xl">
        {children}
      </div>
    </div>
  );
}
