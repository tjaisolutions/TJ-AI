
import React, { useState } from 'react';
import { Meeting, Client, Project, RecordedMeeting, User } from '../types';
import { Plus, ChevronLeft, ChevronRight, X, Clock, Video, MapPin, User as UserIcon, Briefcase, Calendar as CalendarIcon, History, FileText, BrainCircuit, PlayCircle } from 'lucide-react';

interface AgendaProps {
  clients: Client[];
  projects: Project[];
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  recordedMeetings: RecordedMeeting[];
  currentUser: User;
}

const Agenda: React.FC<AgendaProps> = ({ clients, projects, meetings, setMeetings, recordedMeetings, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'HISTORY'>('CALENDAR');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Partial<Meeting>>({
    title: '', date: '', time: '', type: 'Online', linkOrLocation: '', participants: []
  });
  const [selectedRecord, setSelectedRecord] = useState<RecordedMeeting | null>(null);

  // Calendar Logic
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
    setCurrentDate(new Date(newDate));
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setNewMeeting({ ...newMeeting, date: dateStr, time: '10:00' });
    setIsModalOpen(true);
  };

  const handleAddMeeting = () => {
    if (newMeeting.title && newMeeting.date && newMeeting.time) {
      setMeetings([
        ...meetings,
        {
          id: `meet-${Date.now()}`,
          title: newMeeting.title,
          date: newMeeting.date,
          time: newMeeting.time,
          clientId: newMeeting.clientId,
          projectId: newMeeting.projectId,
          type: newMeeting.type as 'Online' | 'Presencial',
          linkOrLocation: newMeeting.linkOrLocation,
          participants: newMeeting.participants || [],
          createdBy: currentUser.name
        }
      ]);
      setIsModalOpen(false);
      setNewMeeting({ title: '', date: '', time: '', type: 'Online', linkOrLocation: '', participants: [] });
    }
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Helper for markdown rendering
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h4 key={i} className="text-[#20bbe3] font-bold text-lg mt-4 mb-2">{line.replace('## ', '')}</h4>;
        if (line.startsWith('### ')) return <h5 key={i} className="text-white font-bold mt-3 mb-1">{line.replace('### ', '')}</h5>;
        if (line.startsWith('- ')) return <li key={i} className="ml-4 text-slate-300">{line.replace('- ', '')}</li>;
        if (line.startsWith('* ')) return <li key={i} className="ml-4 text-slate-300">{line.replace('* ', '')}</li>;
        return <p key={i} className="text-slate-300 text-sm leading-relaxed mb-1">{line}</p>;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-3xl font-bold text-white">Agenda & Reuniões</h2>
        
        <div className="flex bg-[#1e2e41] p-1 rounded-lg border border-[#1687cb]/20">
            <button 
                onClick={() => setActiveTab('CALENDAR')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'CALENDAR' ? 'bg-[#20bbe3] text-[#111623] shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                <CalendarIcon size={18} />
                Calendário
            </button>
            <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-[#20bbe3] text-[#111623] shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                <History size={18} />
                Histórico & Gravações
            </button>
        </div>

        {activeTab === 'CALENDAR' && (
             <button 
                onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setNewMeeting({...newMeeting, date: today, time: '09:00'});
                    setIsModalOpen(true);
                }}
                className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
            >
            <Plus size={18} />
            Agendar
            </button>
        )}
      </div>

      {activeTab === 'CALENDAR' ? (
        <>
            <div className="flex items-center gap-4 bg-[#1e2e41] p-1 rounded-lg border border-[#1687cb]/20 w-fit mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-[#111623] rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div className="text-lg font-bold text-white min-w-[150px] text-center select-none">
                    {monthNames[currentDate.getMonth()]} <span className="text-[#20bbe3]">{currentDate.getFullYear()}</span>
                </div>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-[#111623] rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden flex flex-col shadow-xl">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-[#111623] border-b border-[#1687cb]/20">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500 uppercase tracking-wider">
                        {day}
                    </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {blanks.map(blank => (
                    <div key={`blank-${blank}`} className="bg-[#111623]/30 border-r border-b border-[#1687cb]/10 min-h-[100px]"></div>
                    ))}
                    
                    {days.map(day => {
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayMeetings = meetings.filter(m => m.date === dateStr);
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    return (
                        <div 
                            key={day} 
                            onClick={() => handleDayClick(day)}
                            className={`border-r border-b border-[#1687cb]/10 p-2 min-h-[120px] cursor-pointer transition-colors relative group hover:bg-[#1687cb]/5
                                ${isToday ? 'bg-[#20bbe3]/5' : ''}
                            `}
                        >
                            <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-2
                                ${isToday ? 'bg-[#20bbe3] text-[#111623] font-bold shadow-lg shadow-[#20bbe3]/30' : 'text-slate-400 group-hover:text-white'}
                            `}>
                                {day}
                            </span>
                            
                            <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                {dayMeetings.map(meeting => (
                                <div key={meeting.id} className={`text-[10px] px-2 py-1 rounded border truncate flex flex-col gap-0.5
                                    ${meeting.type === 'Online' 
                                        ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' 
                                        : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'}
                                `}>
                                    <div className="flex justify-between items-center">
                                       <span className="font-bold opacity-75">{meeting.time}</span>
                                       {meeting.createdBy && <span className="opacity-50 text-[8px] flex items-center gap-0.5"><UserIcon size={8} /> {meeting.createdBy.split(' ')[0]}</span>}
                                    </div>
                                    <span>{meeting.title}</span>
                                </div>
                                ))}
                            </div>
                        </div>
                    );
                    })}
                </div>
            </div>
        </>
      ) : (
        /* HISTORY VIEW */
        <div className="flex-1 flex gap-6 overflow-hidden">
            {/* List of Recordings */}
            <div className="w-1/3 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#1687cb]/10 bg-[#111623]/20">
                    <h3 className="font-bold text-white">Gravações Recentes</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {recordedMeetings.length === 0 && (
                        <div className="text-center py-10 text-slate-500">
                            <History size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Nenhuma reunião gravada.</p>
                        </div>
                    )}
                    {recordedMeetings.map(rec => (
                        <div 
                            key={rec.id} 
                            onClick={() => setSelectedRecord(rec)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all group
                                ${selectedRecord?.id === rec.id 
                                    ? 'bg-[#20bbe3]/10 border-[#20bbe3] shadow-[0_0_15px_rgba(32,187,227,0.1)]' 
                                    : 'bg-[#111623] border-[#1687cb]/10 hover:border-[#20bbe3]/50'}
                            `}
                        >
                            <h4 className={`font-bold text-sm mb-1 ${selectedRecord?.id === rec.id ? 'text-[#20bbe3]' : 'text-slate-200'}`}>
                                {rec.title}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                <span className="flex items-center gap-1"><CalendarIcon size={12} /> {rec.date}</span>
                                <span className="flex items-center gap-1"><Clock size={12} /> {rec.duration}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] border border-indigo-500/20">
                                    AI Summary
                                </span>
                                {selectedRecord?.id === rec.id && <PlayCircle size={14} className="text-[#20bbe3] ml-auto animate-pulse" />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail View */}
            <div className="flex-1 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 flex flex-col overflow-hidden">
                {selectedRecord ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-[#1687cb]/10 bg-[#111623]/20">
                            <h3 className="text-2xl font-bold text-white mb-2">{selectedRecord.title}</h3>
                            <div className="flex gap-4 text-sm text-slate-400">
                                <span>Participantes: {selectedRecord.participants.join(', ')}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {/* AI Summary Section */}
                            <div className="mb-8 bg-gradient-to-br from-[#20bbe3]/10 to-transparent p-6 rounded-xl border border-[#20bbe3]/20">
                                <div className="flex items-center gap-2 mb-4 text-[#20bbe3]">
                                    <BrainCircuit size={24} />
                                    <h4 className="font-bold text-lg">Planejamento & Insights IA</h4>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="bg-[#111623]/50 p-4 rounded-lg">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Resumo Executivo</h5>
                                        <p className="text-slate-200 text-sm leading-relaxed">{selectedRecord.aiSummary}</p>
                                    </div>
                                    <div className="bg-[#111623]/50 p-4 rounded-lg">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Plano de Ação</h5>
                                        <div className="prose prose-invert prose-sm">
                                            {renderMarkdown(selectedRecord.aiActionPlan)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Full Transcript Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-4 text-slate-300">
                                    <FileText size={20} />
                                    <h4 className="font-bold">Transcrição Completa</h4>
                                </div>
                                <div className="space-y-4 bg-[#111623] p-4 rounded-xl border border-[#1687cb]/10">
                                    {selectedRecord.fullTranscript.map((t) => (
                                        <div key={t.id} className="flex gap-4">
                                            <div className="min-w-[60px] text-xs text-slate-500 pt-1 text-right">{t.timestamp}</div>
                                            <div>
                                                <p className="text-xs font-bold text-[#20bbe3] mb-1">{t.speaker}</p>
                                                <p className="text-sm text-slate-300">{t.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p>Selecione uma reunião para ver os detalhes e análise da IA.</p>
                    </div>
                )}
            </div>
        </div>
      )}

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1e2e41] w-full max-w-lg rounded-2xl border border-[#1687cb]/30 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-[#1687cb]/20 bg-[#111623]/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <CalendarIcon className="text-[#20bbe3]" />
                 Nova Reunião
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Título da Reunião</label>
                  <input className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-all" 
                     value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} placeholder="Ex: Daily Scrum" autoFocus />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Data</label>
                    <input type="date" className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-all" 
                       value={newMeeting.date} onChange={e => setNewMeeting({...newMeeting, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Hora</label>
                    <input type="time" className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-all" 
                       value={newMeeting.time} onChange={e => setNewMeeting({...newMeeting, time: e.target.value})} />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Tipo</label>
                      <select className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none appearance-none transition-all"
                         value={newMeeting.type} onChange={e => setNewMeeting({...newMeeting, type: e.target.value as any})}>
                         <option value="Online">Online</option>
                         <option value="Presencial">Presencial</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Cliente (Opcional)</label>
                      <select className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none appearance-none transition-all"
                         value={newMeeting.clientId || ''} onChange={e => setNewMeeting({...newMeeting, clientId: e.target.value})}>
                         <option value="">Selecione...</option>
                         {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
               </div>

               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Link ou Localização</label>
                  <input className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-all" 
                     value={newMeeting.linkOrLocation} onChange={e => setNewMeeting({...newMeeting, linkOrLocation: e.target.value})} placeholder="URL do Meet ou Endereço" />
               </div>
            </div>
            <div className="p-4 border-t border-[#1687cb]/20 bg-[#111623]/30 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleAddMeeting} className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-[#20bbe3]/10">
                Agendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
