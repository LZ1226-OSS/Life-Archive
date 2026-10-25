import { useState } from 'react';
import { ConfigProvider } from './context/ConfigContext.jsx';
import PhoneFrame from './components/PhoneFrame.jsx';
import TabBar from './components/TabBar.jsx';
import GreetingPage from './pages/GreetingPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

// 应用外壳：ConfigProvider 全局配置挂载 + activeTab 单页三页切换（问候/日历/设置）。
export default function App() {
  const [activeTab, setActiveTab] = useState('greeting');

  const renderPage = () => {
    switch (activeTab) {
      case 'calendar':
        return <CalendarPage />;
      case 'settings':
        return <SettingsPage />;
      case 'greeting':
      default:
        return <GreetingPage onNavigate={setActiveTab} />;
    }
  };

  return (
    <ConfigProvider>
      <PhoneFrame>
        <main className="flex-1 overflow-y-auto">{renderPage()}</main>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </PhoneFrame>
    </ConfigProvider>
  );
}
