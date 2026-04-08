import React from 'react';
import { Megaphone } from 'lucide-react';

export default function MarketingTab() {
  return (
    <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 w-full max-w-4xl mx-auto">
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center h-64">
        <Megaphone size={48} className="text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-[#17161A] mb-2">Divulgação</h2>
        <p className="text-gray-500">Módulo em desenvolvimento.</p>
      </div>
    </main>
  );
}
