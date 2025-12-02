
import React from 'react';
import { LayoutDashboard, Users, FolderKanban, FileText, Wallet, BarChart3, Settings, CalendarDays, Video, FileBarChart, Banknote } from 'lucide-react';
import { ViewState, User } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentUser?: User;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentUser }) => {
  const menuItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'REPORTS', label: 'Relatórios', icon: FileBarChart },
    { id: 'AGENDA', label: 'Agenda', icon: CalendarDays },
    { id: 'MEETING_ROOM', label: 'Sala de Reunião', icon: Video },
    { id: 'CRM', label: 'CRM & Leads', icon: BarChart3 },
    { id: 'PROJECTS', label: 'Projetos', icon: FolderKanban },
    { id: 'CLIENTS', label: 'Clientes', icon: Users },
    { id: 'BUDGETS', label: 'Orçamentos', icon: FileText },
    { id: 'RECEIVABLES', label: 'Recebimentos', icon: Banknote },
    { id: 'COSTS', label: 'Custos', icon: Wallet },
  ];

  return (
    <div className="w-20 lg:w-64 h-screen bg-[#1e2e41] border-r border-[#1687cb]/20 flex flex-col fixed left-0 top-0 transition-all duration-300 z-50">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-[#1687cb]/20">
        {/* TJ AI Solutions Logo Image */}
        <div className="w-10 h-10 flex-shrink-0 rounded-xl border border-[#20bbe3]/30 overflow-hidden relative group">
            <img src="https://i.ibb.co/Dg7jc52z/LOGO-TJ.jpg" alt="TJ AI Solutions" className="w-full h-full object-cover" />
        </div>

        <span className="ml-3 text-xl font-bold text-white hidden lg:block tracking-tight">
          TJ AI <span className="text-[#20bbe3]">SOLUTIONS</span>
        </span>
      </div>

      <nav className="flex-1 py-6 space-y-2 px-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`w-full flex items-center justify-center lg:justify-start px-3 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-gradient-to-r from-[#1687cb]/20 to-[#20bbe3]/10 text-[#20bbe3] border border-[#20bbe3]/30' 
                  : 'text-slate-400 hover:text-white hover:bg-[#111623]/50'
                }`}
            >
              <Icon size={22} className={isActive ? 'text-[#20bbe3]' : 'text-slate-400 group-hover:text-white'} />
              <span className={`ml-3 font-medium hidden lg:block ${isActive ? 'text-[#20bbe3]' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#20bbe3] hidden lg:block shadow-[0_0_8px_#20bbe3]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1687cb]/20">
        <button 
          onClick={() => setView('SETTINGS')}
          className={`w-full flex items-center justify-center lg:justify-start px-3 py-3 rounded-xl transition-colors ${currentView === 'SETTINGS' ? 'text-[#20bbe3] bg-[#20bbe3]/10' : 'text-slate-400 hover:text-white hover:bg-[#111623]/50'}`}
        >
          <Settings size={22} />
          <span className="ml-3 font-medium hidden lg:block">Configurações</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
