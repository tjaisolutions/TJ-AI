
import React from 'react';
import { LayoutDashboard, Users, FolderKanban, FileText, Wallet, BarChart3, Settings, CalendarDays, Video, FileBarChart, Banknote, X, Cloud, CloudOff } from 'lucide-react';
import { ViewState, User } from '../types';
import { dataService } from '../services/dataService';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentUser?: User;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentUser, isOpen, onClose }) => {
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

  const handleItemClick = (view: ViewState) => {
    setView(view);
    onClose(); // Close sidebar on mobile when item is clicked
  };

  const isCloud = dataService.isCloudEnabled;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-screen bg-[#1e2e41] border-r border-[#1687cb]/20 flex flex-col transition-transform duration-300 z-50
        w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-[#1687cb]/20 shrink-0">
          <div className="flex items-center">
            {/* TJ AI Solutions Logo Image */}
            <div className="w-10 h-10 flex-shrink-0 rounded-xl border border-[#20bbe3]/30 overflow-hidden relative group">
                <img src="https://i.ibb.co/Dg7jc52z/LOGO-TJ.jpg" alt="TJ AI Solutions" className="w-full h-full object-cover" />
            </div>

            <span className="ml-3 text-xl font-bold text-white tracking-tight">
              TJ AI <span className="text-[#20bbe3]">SOLUTIONS</span>
            </span>
          </div>
          
          {/* Mobile Close Button */}
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id as ViewState)}
                className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-gradient-to-r from-[#1687cb]/20 to-[#20bbe3]/10 text-[#20bbe3] border border-[#20bbe3]/30' 
                    : 'text-slate-400 hover:text-white hover:bg-[#111623]/50'
                  }`}
              >
                <Icon size={22} className={isActive ? 'text-[#20bbe3]' : 'text-slate-400 group-hover:text-white'} />
                <span className={`ml-3 font-medium ${isActive ? 'text-[#20bbe3]' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#20bbe3] shadow-[0_0_8px_#20bbe3]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1687cb]/20 shrink-0 space-y-2">
           <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-dashed ${isCloud ? 'border-[#20bbe3]/30 text-[#20bbe3] bg-[#20bbe3]/5' : 'border-slate-600 text-slate-500'}`}>
                {isCloud ? <Cloud size={14} /> : <CloudOff size={14} />}
                <span>Status: {isCloud ? 'Nuvem Conectada' : 'Armazenamento Local'}</span>
           </div>

          <button 
            onClick={() => handleItemClick('SETTINGS')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-colors ${currentView === 'SETTINGS' ? 'text-[#20bbe3] bg-[#20bbe3]/10' : 'text-slate-400 hover:text-white hover:bg-[#111623]/50'}`}
          >
            <Settings size={22} />
            <span className="ml-3 font-medium">Configurações</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
