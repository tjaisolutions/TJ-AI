
import React, { useState } from 'react';
import { Receivable, Client, RecurringPlan, PaymentRecord, User } from '../types';
import { Plus, CheckCircle2, AlertCircle, Clock, CalendarCheck, TrendingUp, ArrowUpRight, Search, Wallet, AlertTriangle } from 'lucide-react';
import { MOCK_RECURRING_PLANS } from '../constants';

interface ReceivablesProps {
  receivables: Receivable[];
  setReceivables: React.Dispatch<React.SetStateAction<Receivable[]>>;
  clients: Client[];
  currentUser: User;
}

const Receivables: React.FC<ReceivablesProps> = ({ clients, currentUser }) => {
  // We are shifting from flat receivables to Recurring Plans management
  // In a real app, 'plans' would come from props or a robust context
  const [plans, setPlans] = useState<RecurringPlan[]>(MOCK_RECURRING_PLANS);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // --- Logic Helpers ---

  const getStatusForMonth = (plan: RecurringPlan, monthIndex: number, year: number): PaymentRecord['status'] | 'Empty' => {
      const record = plan.paymentHistory.find(r => r.month === monthIndex && r.year === year);
      if (record) return record.status;
      return 'Empty';
  };

  const handleUpdateStatus = (planId: string, month: number, year: number, newStatus: 'Paid' | 'Pending' | 'Overdue') => {
      setPlans(prevPlans => prevPlans.map(plan => {
          if (plan.id !== planId) return plan;

          const existingRecordIndex = plan.paymentHistory.findIndex(r => r.month === month && r.year === year);
          let newHistory = [...plan.paymentHistory];

          if (existingRecordIndex >= 0) {
              // Update existing
              newHistory[existingRecordIndex] = {
                  ...newHistory[existingRecordIndex],
                  status: newStatus,
                  paidDate: newStatus === 'Paid' ? new Date().toISOString().split('T')[0] : undefined,
                  updatedBy: currentUser.name
              };
          } else {
              // Create new record
              newHistory.push({
                  month,
                  year: year,
                  amount: plan.value,
                  status: newStatus,
                  paidDate: newStatus === 'Paid' ? new Date().toISOString().split('T')[0] : undefined,
                  updatedBy: currentUser.name
              });
          }
          return { ...plan, paymentHistory: newHistory };
      }));
  };

  // --- Statistics & Lists ---
  const activePlans = plans.filter(p => p.status === 'Active');
  
  const mrr = activePlans.reduce((acc, p) => {
      if (p.frequency === 'Mensal') return acc + p.value;
      if (p.frequency === 'Trimestral') return acc + (p.value / 3);
      if (p.frequency === 'Anual') return acc + (p.value / 12);
      return acc;
  }, 0);

  const totalDueThisMonth = plans.length;
  const paidThisMonth = plans.filter(p => {
      const rec = p.paymentHistory.find(r => r.month === currentMonth && r.year === currentYear);
      return rec?.status === 'Paid';
  }).length;

  // Items for "Pending this Month" list
  const pendingThisMonthList = activePlans.filter(p => {
      const status = getStatusForMonth(p, currentMonth, currentYear);
      return status !== 'Paid'; // Show Pending, Overdue or Empty
  });

  // Items for "Overdue" list (Any past month not paid)
  // Simplified check: Check records with status 'Overdue' or 'Pending' in past
  // For this mock, we just check explicitly marked 'Overdue' or missing in past months of current year
  const overdueList = plans.flatMap(p => {
      const overdueRecords = p.paymentHistory.filter(r => 
          (r.year < currentYear || (r.year === currentYear && r.month < currentMonth)) && 
          (r.status === 'Overdue' || r.status === 'Pending')
      );
      return overdueRecords.map(r => ({ ...p, record: r }));
  });

  const filteredPlans = plans.filter(p => {
      const client = clients.find(c => c.id === p.clientId);
      const searchStr = (p.title + (client?.name || '') + (client?.company || '')).toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
            <h2 className="text-3xl font-bold text-white">Gestão de Recorrência</h2>
            <p className="text-slate-400 text-sm mt-1">Controle de assinaturas e histórico de pagamentos.</p>
        </div>
        
        <div className="flex items-center bg-[#1e2e41] p-1 rounded-lg border border-[#1687cb]/20 self-start md:self-auto">
            <button className="px-3 py-1.5 text-slate-300 hover:text-white" onClick={() => setFilterYear(filterYear - 1)}>&lt;</button>
            <span className="px-3 font-bold text-[#20bbe3]">{filterYear}</span>
            <button className="px-3 py-1.5 text-slate-300 hover:text-white" onClick={() => setFilterYear(filterYear + 1)}>&gt;</button>
        </div>
      </div>

      {/* Action Dashboard */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Pending This Month */}
          <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden flex flex-col shadow-lg">
              <div className="p-4 bg-[#111623]/30 border-b border-[#1687cb]/10 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-white font-bold">
                      <Wallet className="text-[#20bbe3]" size={20} />
                      <h3 className="text-sm sm:text-base">A Receber ({months[currentMonth]})</h3>
                  </div>
                  <span className="bg-[#20bbe3]/20 text-[#20bbe3] text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                      {pendingThisMonthList.length} pendentes
                  </span>
              </div>
              <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {pendingThisMonthList.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                          <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-500/50" />
                          <p>Todos os pagamentos deste mês foram recebidos!</p>
                      </div>
                  ) : (
                      pendingThisMonthList.map(plan => {
                          const client = clients.find(c => c.id === plan.clientId);
                          return (
                            <div key={plan.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#111623] p-3 rounded-xl border border-[#1687cb]/10 hover:border-[#20bbe3]/30 transition-colors gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#1e2e41] flex items-center justify-center text-[#20bbe3] font-bold border border-[#1687cb]/20 shrink-0">
                                        {client?.company.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">{client?.company}</p>
                                        <p className="text-xs text-slate-400">{plan.title}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end ml-12 sm:ml-0">
                                    <span className="text-sm font-mono text-slate-300">R$ {plan.value}</span>
                                    <button 
                                        onClick={() => handleUpdateStatus(plan.id, currentMonth, currentYear, 'Paid')}
                                        className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-[#20bbe3]/10 hover:scale-105 active:scale-95 flex items-center gap-2"
                                    >
                                        <CheckCircle2 size={14} />
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                          );
                      })
                  )}
              </div>
          </div>

          {/* Overdue / Stats */}
          <div className="flex flex-col gap-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-[#1e2e41] p-5 rounded-2xl border border-[#1687cb]/10 shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-slate-400 text-xs font-bold uppercase">Receita Mensal (MRR)</p>
                        <h3 className="text-2xl font-bold text-white mt-1">R$ {mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                    </div>
                    <TrendingUp className="absolute right-4 bottom-4 text-[#20bbe3]/20" size={48} />
                 </div>
                 <div className="bg-[#1e2e41] p-5 rounded-2xl border border-[#1687cb]/10 shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-slate-400 text-xs font-bold uppercase">Recebidos Hoje</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">{paidThisMonth} / {totalDueThisMonth}</h3>
                    </div>
                    <CalendarCheck className="absolute right-4 bottom-4 text-emerald-500/20" size={48} />
                 </div>
              </div>

              {/* Overdue List */}
              <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 flex-1 overflow-hidden flex flex-col">
                 <div className="p-3 bg-[#111623]/30 border-b border-[#1687cb]/10 flex items-center gap-2">
                     <AlertTriangle size={16} className="text-red-400" />
                     <h3 className="font-bold text-slate-300 text-sm">Em Atraso (Meses Anteriores)</h3>
                 </div>
                 <div className="p-3 space-y-2 overflow-y-auto max-h-[200px] custom-scrollbar">
                    {overdueList.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">Nenhuma pendência antiga.</p>
                    ) : (
                        overdueList.map((item, idx) => {
                             const client = clients.find(c => c.id === item.clientId);
                             return (
                                <div key={idx} className="flex justify-between items-center bg-red-500/5 border border-red-500/10 p-2 rounded-lg">
                                    <div>
                                        <p className="text-xs font-bold text-white">{client?.company}</p>
                                        <p className="text-[10px] text-red-400">{months[item.record.month]}/{item.record.year} - R$ {item.record.amount}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleUpdateStatus(item.id, item.record.month, item.record.year, 'Paid')}
                                        className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/20"
                                    >
                                        Regularizar
                                    </button>
                                </div>
                             );
                        })
                    )}
                 </div>
              </div>
          </div>
      </div>

      {/* Main Matrix View */}
      <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden shadow-xl mt-6">
         <div className="p-4 bg-[#111623]/30 border-b border-[#1687cb]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-white">Histórico Completo - {filterYear}</h3>
            {/* Search */}
            <div className="flex items-center bg-[#111623] px-3 py-1.5 rounded-lg border border-[#1687cb]/20 focus-within:border-[#20bbe3]/50 transition-colors w-full sm:w-64">
                <Search size={14} className="text-slate-500" />
                <input 
                    className="bg-transparent border-none outline-none text-white text-xs ml-2 w-full placeholder-slate-600"
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
         </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                    <tr className="bg-[#111623] text-slate-400 text-xs uppercase font-semibold border-b border-[#1687cb]/20">
                        <th className="p-4 sticky left-0 bg-[#111623] z-10 w-[200px] md:w-[250px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Cliente / Plano</th>
                        <th className="p-4 w-[100px]">Valor</th>
                        {months.map((m, i) => (
                            <th key={m} className={`p-3 text-center min-w-[60px] ${i === currentMonth && filterYear === currentYear ? 'text-[#20bbe3] bg-[#20bbe3]/5' : ''}`}>
                                {m}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#1687cb]/10 text-sm">
                    {filteredPlans.map(plan => {
                        const client = clients.find(c => c.id === plan.clientId);
                        return (
                            <tr key={plan.id} className="hover:bg-[#111623]/30 transition-colors group">
                                <td className="p-4 sticky left-0 bg-[#1e2e41] group-hover:bg-[#182433] transition-colors z-10 border-r border-[#1687cb]/10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1687cb] to-[#20bbe3] p-[1px] shrink-0">
                                            <img src={client?.avatar} alt="" className="w-full h-full rounded-full bg-[#111623] object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white leading-tight truncate">{client?.company}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{plan.title}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-slate-300 border-r border-[#1687cb]/10">
                                    R$ {plan.value.toLocaleString(undefined, { notation: 'compact' })}
                                </td>
                                {months.map((_, i) => {
                                    const status = getStatusForMonth(plan, i, filterYear);
                                    const isFuture = (i > currentMonth && filterYear === currentYear) || filterYear > currentYear;
                                    
                                    return (
                                        <td key={i} className={`p-2 text-center border-r border-[#1687cb]/5 relative ${i === currentMonth && filterYear === currentYear ? 'bg-[#20bbe3]/5' : ''}`}>
                                            {status === 'Paid' ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(plan.id, i, filterYear, 'Pending')}
                                                    title="Marcar como Pendente (Desfazer)"
                                                    className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto hover:bg-emerald-500/30 transition-colors"
                                                >
                                                    <CheckCircle2 size={18} />
                                                </button>
                                            ) : status === 'Overdue' ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(plan.id, i, filterYear, 'Paid')}
                                                    title="Confirmar Pagamento (Atrasado)"
                                                    className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center mx-auto hover:bg-red-500/30 transition-colors animate-pulse"
                                                >
                                                    <AlertCircle size={18} />
                                                </button>
                                            ) : status === 'Pending' ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(plan.id, i, filterYear, 'Paid')}
                                                    title="Confirmar Pagamento"
                                                    className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto hover:bg-yellow-500/20 transition-colors border border-yellow-500/30"
                                                >
                                                    <Clock size={16} />
                                                </button>
                                            ) : (
                                                // Empty State
                                                !isFuture ? (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(plan.id, i, filterYear, 'Paid')}
                                                        className="w-2 h-2 rounded-full bg-slate-700 mx-auto hover:w-8 hover:h-8 hover:bg-[#20bbe3]/20 hover:text-[#20bbe3] hover:rounded-lg flex items-center justify-center transition-all group/btn"
                                                    >
                                                        <Plus size={16} className="hidden group-hover/btn:block" />
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-700">-</span>
                                                )
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Receivables;
