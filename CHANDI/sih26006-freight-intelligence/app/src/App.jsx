import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ForecastScreen from './screens/ForecastScreen';
import OptimizerScreen from './screens/OptimizerScreen';
import ScenariosScreen from './screens/ScenariosScreen';
import InsightsScreen from './screens/InsightsScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('forecast');

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl">
          {activeTab === 'forecast' && <ForecastScreen />}
          {activeTab === 'optimizer' && <OptimizerScreen />}
          {activeTab === 'scenarios' && <ScenariosScreen />}
          {activeTab === 'insights' && <InsightsScreen />}
        </main>
      </div>
    </div>
  );
}
