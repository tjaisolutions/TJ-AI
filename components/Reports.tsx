
import React, { useState } from 'react';
import { Project, Cost, Budget, CRMLead, Client } from '../types';
import { FileText, Download, Printer, PieChart, Sparkles, AlertCircle, Check, Settings2, LayoutTemplate, Users, Calendar } from 'lucide-react';
import { generateInsight } from '../services/geminiService';

interface ReportsProps {
  projects: Project[];
  costs: Cost[];
  budgets: Budget[];
  leads: CRMLead[];
  clients: Client[];
}

const Reports: React.FC<ReportsProps> = ({ projects, costs, budgets, leads, clients }) => {
  const [reportPeriod, setReportPeriod] = useState('month'); // Kept for quick presets if needed later, currently acting as visual
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  // Configuration State for Report Sections
  const [reportConfig, setReportConfig] = useState({
      financial: true,
      operational: true,
      projects: true,
      aiAnalysis: true
  });

  const toggleSection = (section: keyof typeof reportConfig) => {
      setReportConfig(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleClientSelection = (clientId: string) => {
      setSelectedClientIds(prev => 
          prev.includes(clientId) 
              ? prev.filter(id => id !== clientId) 
              : [...prev, clientId]
      );
  };

  // --- Filtering Logic ---
  
  const isFilteringByClient = selectedClientIds.length > 0;

  const isWithinDateRange = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    const itemDate = new Date(dateStr);
    // Reset times to ensure accurate comparison just by date part
    itemDate.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    
    return true;
  };

  // Filter Projects by Client and Date (Deadline)
  const filteredProjects = projects.filter(p => 
      (!isFilteringByClient || selectedClientIds.includes(p.clientId)) &&
      isWithinDateRange(p.deadline)
  );

  // Filter Costs by Client (if applicable) and Date
  const filteredCosts = costs.filter(c => {
      // Date Filter
      if (!isWithinDateRange(c.date)) return false;

      // Client Filter
      if (!isFilteringByClient) return true;
      // If filtering by client, hide fixed costs (unless general company view) and show only project costs for selected clients
      if (c.type === 'Fixed') return false; 
      if (c.type === 'Project') {
          // Find project to check client
          const project = projects.find(p => p.title === c.projectName);
          return project && selectedClientIds.includes(project.clientId);
      }
      return false;
  });

  // Calculate Revenue (Gain)
  // If filtering by client, we look at Project Budgets for that client.
  // If global (no filter), we use the aggregate Lead Revenue + Project Budgets.
  const calculateRevenue = () => {
      if (isFilteringByClient) {
          // Sum of Project Budgets for selected clients (filtered by date via filteredProjects)
          return filteredProjects.reduce((acc, p) => acc + p.budget, 0);
      } else {
          // Global Revenue (Leads 'Ganho')
          return leads
            .filter(l => l.stage === 'Ganho')
            .filter(l => isWithinDateRange(l.lastContact)) // Using lastContact/won date
            .reduce((acc, curr) => acc + curr.value, 0);
      }
  };

  const totalRevenue = calculateRevenue();
  const totalCosts = filteredCosts.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalRevenue - totalCosts;
  
  const totalProjects = filteredProjects.length;
  const completedProjects = filteredProjects.filter(p => p.progress === 100).length;

  const handleGenerateAIReport = async () => {
    setLoadingAi(true);
    
    const selectedClientNames = isFilteringByClient 
        ? clients.filter(c => selectedClientIds.includes(c.id)).map(c => c.company).join(', ')
        : "Todos os Clientes";
    
    const dateRangeText = startDate || endDate 
        ? `Período: ${startDate || 'Início'} até ${endDate || 'Hoje'}` 
        : "Período: Todo o histórico";

    let context = `Relatório Gerencial - Escopo: ${selectedClientNames}. ${dateRangeText}\n`;
    context += "Dados do Negócio (baseado nas seções selecionadas):\n";
    
    if (reportConfig.financial) {
        context += `
        [FINANCEIRO]
        - Receita/Orçamento Total no período: R$ ${totalRevenue}
        - Custos Totais (Diretos/Filtrados) no período: R$ ${totalCosts}
        - Lucro Líquido (Margem): R$ ${netProfit}
        ${isFilteringByClient ? "(Nota: Custos fixos da empresa foram excluídos para análise de rentabilidade específica do cliente)" : ""}
        `;
    }

    if (reportConfig.operational) {
        context += `
        [OPERACIONAL]
        - Total Projetos no Escopo/Período: ${totalProjects}
        - Projetos Concluídos: ${completedProjects}
        `;
    }

    if (reportConfig.projects) {
        context += `
        [DETALHES DE PROJETOS]
        - Lista: ${filteredProjects.map(p => `${p.title} (${p.phase}, ${p.progress}%)`).join('; ')}
        `;
    }

    if (!reportConfig.financial && !reportConfig.operational && !reportConfig.projects) {
        setAiReport("Por favor, selecione pelo menos uma seção de dados para gerar a análise.");
        setLoadingAi(false);
        return;
    }

    const prompt = `Gere um relatório executivo formal analisando os dados fornecidos para: ${selectedClientNames}. 
    Considere o período selecionado.
    Se for um cliente específico, foque na rentabilidade dele e no status dos projetos dele.
    Sugira pontos de atenção ou oportunidades de upsell baseados no progresso dos projetos.`;
    
    const report = await generateInsight(prompt, context);
    setAiReport(report);
    setLoadingAi(false);
  };

  const handleExport = () => {
    // In a real app, this would generate a PDF based on reportConfig
    alert("Iniciando download do relatório em PDF com as seções selecionadas...");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
           <h2 className="text-3xl font-bold text-white">Relatórios Gerenciais</h2>
           <p className="text-slate-400 text-sm mt-1">Geração e personalização de documentos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
             {/* Date Range Picker */}
             <div className="flex items-center gap-2 bg-[#1e2e41] p-1.5 rounded-lg border border-[#1687cb]/20">
                <Calendar size={16} className="text-[#20bbe3] ml-2" />
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-300 outline-none border-none p-1 placeholder-slate-500" 
                />
                <span className="text-slate-500">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-300 outline-none border-none p-1 placeholder-slate-500" 
                />
            </div>

            <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-[#111623] hover:bg-[#1e2e41] text-slate-300 border border-[#1687cb]/30 px-4 py-2 rounded-lg font-medium transition-colors"
            >
                <Download size={18} />
                Exportar PDF
            </button>
            <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-[#111623] hover:bg-[#1e2e41] text-slate-300 border border-[#1687cb]/30 px-4 py-2 rounded-lg font-medium transition-colors"
            >
                <Printer size={18} />
            </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-[#1e2e41] p-4 rounded-xl border border-[#1687cb]/20 mb-6">
          <div className="flex flex-col lg:flex-row gap-8">
              {/* Report Sections Config */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4 text-[#20bbe3]">
                    <Settings2 size={20} />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Seções do Relatório</h3>
                </div>
                <div className="flex flex-wrap gap-4">
                    {[
                        { id: 'financial', label: 'Resumo Financeiro' },
                        { id: 'operational', label: 'Métricas Operacionais' },
                        { id: 'projects', label: 'Tabela de Projetos' },
                        { id: 'aiAnalysis', label: 'Análise IA' },
                    ].map((item) => (
                        <label key={item.id} className="flex items-center gap-2 cursor-pointer select-none group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 
                                ${reportConfig[item.id as keyof typeof reportConfig] 
                                    ? 'bg-[#20bbe3] border-[#20bbe3]' 
                                    : 'bg-[#111623] border-slate-600 group-hover:border-[#20bbe3]'}`
                            }>
                                {reportConfig[item.id as keyof typeof reportConfig] && <Check size={14} className="text-[#111623] stroke-[3]" />}
                            </div>
                            <span className={`text-sm font-medium transition-colors ${reportConfig[item.id as keyof typeof reportConfig] ? 'text-white' : 'text-slate-400'}`}>
                                {item.label}
                            </span>
                            <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={reportConfig[item.id as keyof typeof reportConfig]}
                                onChange={() => toggleSection(item.id as keyof typeof reportConfig)}
                            />
                        </label>
                    ))}
                </div>
              </div>

              {/* Client Filtering */}
              <div className="flex-1 border-t lg:border-t-0 lg:border-l border-[#1687cb]/20 pt-4 lg:pt-0 lg:pl-8">
                 <div className="flex items-center gap-2 mb-4 text-[#20bbe3]">
                    <Users size={20} />
                    <h3 className="font-bold text-sm uppercase tracking-wide">Filtrar por Cliente</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setSelectedClientIds([])}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all
                           ${selectedClientIds.length === 0 
                                ? 'bg-[#20bbe3] text-[#111623] border-[#20bbe3]' 
                                : 'bg-[#111623] text-slate-400 border-slate-700 hover:border-[#20bbe3]'
                           }`}
                    >
                        Todos
                    </button>
                    {clients.map(client => (
                        <button 
                            key={client.id}
                            onClick={() => toggleClientSelection(client.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-2
                                ${selectedClientIds.includes(client.id)
                                    ? 'bg-[#20bbe3]/20 text-[#20bbe3] border-[#20bbe3]' 
                                    : 'bg-[#111623] text-slate-400 border-slate-700 hover:border-[#20bbe3]'
                                }`}
                        >
                            {client.company}
                        </button>
                    ))}
                </div>
                {isFilteringByClient && (
                    <p className="text-xs text-slate-500 mt-2 italic">
                        * Exibindo dados específicos para {selectedClientIds.length} cliente(s) selecionado(s). Custos fixos globais ocultos.
                    </p>
                )}
              </div>
          </div>
      </div>

      {/* AI Report Section */}
      {reportConfig.aiAnalysis && (
        <div className="bg-gradient-to-r from-[#1e2e41] to-[#111623] p-6 rounded-2xl border border-[#20bbe3]/30 shadow-lg relative overflow-hidden group animate-in fade-in slide-in-from-top-2">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles size={100} className="text-[#20bbe3]" />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-[#20bbe3]/20 rounded-lg text-[#20bbe3]">
                        <Sparkles size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Análise Inteligente (IA)</h3>
                </div>
                
                {!aiReport ? (
                    <div className="text-center py-6">
                        <p className="text-slate-400 mb-4">Gere uma análise completa baseada nas seções selecionadas acima.</p>
                        <button 
                            onClick={handleGenerateAIReport}
                            disabled={loadingAi}
                            className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-6 py-2 rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(32,187,227,0.3)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingAi ? 'Analisando Dados...' : 'Gerar Relatório com IA'}
                        </button>
                    </div>
                ) : (
                    <div className="bg-[#111623]/60 p-6 rounded-xl border border-[#1687cb]/20 animate-in fade-in slide-in-from-bottom-2">
                        <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-white">
                            <div className="whitespace-pre-wrap">{aiReport}</div>
                        </div>
                        <button 
                            onClick={() => setAiReport(null)}
                            className="mt-4 text-xs text-[#20bbe3] hover:underline"
                        >
                            Gerar Nova Análise
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Summary */}
          {reportConfig.financial && (
              <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 p-6 animate-in fade-in slide-in-from-left-2">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <PieChart size={20} className="text-[#20bbe3]" />
                      Resumo Financeiro {isFilteringByClient ? "(Filtrado)" : "(Global)"}
                  </h3>
                  
                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-[#111623] rounded-lg border-l-4 border-emerald-500">
                          <span className="text-slate-400">{isFilteringByClient ? "Orçamento Projetos" : "Receita Total"}</span>
                          <span className="text-emerald-400 font-bold">R$ {totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-[#111623] rounded-lg border-l-4 border-red-500">
                          <span className="text-slate-400">{isFilteringByClient ? "Custos de Projeto" : "Despesas Totais"}</span>
                          <span className="text-red-400 font-bold">R$ {totalCosts.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-[#111623] rounded-lg border-l-4 border-[#20bbe3]">
                          <span className="text-slate-400">Lucro / Margem</span>
                          <span className={`font-bold ${netProfit >= 0 ? 'text-[#20bbe3]' : 'text-red-400'}`}>
                              R$ {netProfit.toLocaleString()}
                          </span>
                      </div>
                  </div>
              </div>
          )}

          {/* Operational Metrics */}
          {reportConfig.operational && (
              <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 p-6 animate-in fade-in slide-in-from-right-2">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <FileText size={20} className="text-[#20bbe3]" />
                      Métricas Operacionais
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#111623] p-4 rounded-xl text-center">
                          <p className="text-3xl font-bold text-white">{totalProjects}</p>
                          <p className="text-xs text-slate-500 uppercase mt-1">Projetos no Período</p>
                      </div>
                      <div className="bg-[#111623] p-4 rounded-xl text-center">
                          <p className="text-3xl font-bold text-emerald-400">{completedProjects}</p>
                          <p className="text-xs text-slate-500 uppercase mt-1">Concluídos</p>
                      </div>
                      <div className="bg-[#111623] p-4 rounded-xl text-center">
                          <p className="text-3xl font-bold text-[#20bbe3]">{filteredProjects.length - completedProjects}</p>
                          <p className="text-xs text-slate-500 uppercase mt-1">Em Andamento</p>
                      </div>
                      <div className="bg-[#111623] p-4 rounded-xl text-center">
                          <p className="text-3xl font-bold text-yellow-500">{isFilteringByClient ? '-' : leads.length}</p>
                          <p className="text-xs text-slate-500 uppercase mt-1">Oportunidades</p>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Projects Table */}
      {reportConfig.projects && (
          <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 border-b border-[#1687cb]/20 bg-[#111623]/30">
                  <h3 className="font-bold text-white">Status Detalhado de Projetos</h3>
              </div>
              <table className="w-full text-left text-sm">
                  <thead className="bg-[#111623] text-slate-400">
                      <tr>
                          <th className="p-3">Projeto</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Fase</th>
                          <th className="p-3">Progresso</th>
                          <th className="p-3 text-right">Prazo</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1687cb]/10">
                      {filteredProjects.length === 0 ? (
                          <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                                  Nenhum projeto encontrado para o filtro selecionado.
                              </td>
                          </tr>
                      ) : (
                        filteredProjects.map(project => (
                          <tr key={project.id} className="hover:bg-[#111623]/50 transition-colors">
                              <td className="p-3 text-white font-medium">{project.title}</td>
                              <td className="p-3 text-slate-400">{project.clientName}</td>
                              <td className="p-3">
                                  <span className={`px-2 py-1 rounded text-xs border ${
                                      project.phase === 'Entrega' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                      'bg-[#20bbe3]/10 text-[#20bbe3] border-[#20bbe3]/30'
                                  }`}>
                                      {project.phase}
                                  </span>
                              </td>
                              <td className="p-3 text-slate-300">
                                  <div className="flex items-center gap-2">
                                      <div className="w-20 h-1.5 bg-[#111623] rounded-full overflow-hidden">
                                          <div className="h-full bg-[#20bbe3]" style={{ width: `${project.progress}%`}}></div>
                                      </div>
                                      <span>{project.progress}%</span>
                                  </div>
                              </td>
                              <td className="p-3 text-right text-slate-400 font-mono">
                                  {new Date(project.deadline).toLocaleDateString()}
                              </td>
                          </tr>
                      ))
                    )}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};

export default Reports;
