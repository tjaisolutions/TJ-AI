
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Project, CRMLead, Cost } from '../types';
import { TrendingUp, Users, DollarSign, Activity, Filter, Calendar } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  leads: CRMLead[];
  costs: Cost[];
}

const Dashboard: React.FC<DashboardProps> = ({ projects, leads, costs }) => {
  const [filterPeriod, setFilterPeriod] = useState('Year'); // Default to Year to show more data if available
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- LÓGICA DE DADOS REAIS ---
  const processedData = useMemo(() => {
    const today = new Date();
    let dataPoints: { name: string; value: number; costs: number }[] = [];
    let startPeriodDate = new Date();

    // 1. Definir os Buckets (Eixo X) e o período de filtro
    if (filterPeriod === 'Year') {
        startPeriodDate = new Date(today.getFullYear(), 0, 1); // 1 Jan do ano atual
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        dataPoints = monthNames.map(m => ({ name: m, value: 0, costs: 0 }));
    } else if (filterPeriod === 'Quarter') {
        startPeriodDate = new Date(today.getFullYear(), today.getMonth() - 2, 1); // 3 meses atrás
        // Gera os nomes dos últimos 3 meses
        for (let i = 0; i < 3; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - 2 + i, 1);
            const monthName = d.toLocaleDateString('pt-BR', { month: 'short' });
            dataPoints.push({ name: monthName, value: 0, costs: 0 });
        }
    } else {
        // Mês atual (dividido em semanas)
        startPeriodDate = new Date(today.getFullYear(), today.getMonth(), 1);
        dataPoints = [
            { name: 'Sem 1', value: 0, costs: 0 },
            { name: 'Sem 2', value: 0, costs: 0 },
            { name: 'Sem 3', value: 0, costs: 0 },
            { name: 'Sem 4', value: 0, costs: 0 },
            { name: 'Sem 5', value: 0, costs: 0 }, // Alguns meses tem 5 semanas
        ];
    }

    // Se houver datas manuais, elas sobrescrevem a lógica de período para filtragem, mas mantemos o bucket do filtro selecionado visualmente por simplicidade ou adaptamos.
    // Para manter simples: O filtro manual apenas restringe quais dados entram nos buckets já definidos.

    // 2. Agregar Receita (Leads Ganhos)
    leads.forEach(lead => {
        if (lead.stage === 'Ganho') {
            const leadDate = new Date(lead.lastContact); // Usando data de contato como fechamento
            
            // Filtro de Data
            if (leadDate < startPeriodDate) return;
            if (startDate && leadDate < new Date(startDate)) return;
            if (endDate && leadDate > new Date(endDate)) return;

            // Mapear para o Bucket
            if (filterPeriod === 'Year') {
                if (leadDate.getFullYear() === today.getFullYear()) {
                    dataPoints[leadDate.getMonth()].value += lead.value;
                }
            } else if (filterPeriod === 'Quarter') {
                // Acha o índice baseado na diferença de meses
                // Simplificação: apenas itera os datapoints e vê se o nome do mês bate (não ideal para virada de ano, mas funcional para simples)
                const monthName = leadDate.toLocaleDateString('pt-BR', { month: 'short' });
                const bucket = dataPoints.find(dp => dp.name.toLowerCase() === monthName.toLowerCase());
                if (bucket) bucket.value += lead.value;
            } else {
                // Month (Semanas)
                if (leadDate.getMonth() === today.getMonth() && leadDate.getFullYear() === today.getFullYear()) {
                    const day = leadDate.getDate();
                    const weekIndex = Math.floor((day - 1) / 7);
                    if (dataPoints[weekIndex]) dataPoints[weekIndex].value += lead.value;
                }
            }
        }
    });

    // 3. Agregar Custos
    costs.forEach(cost => {
        const costDate = new Date(cost.date);
        
        // Filtro de Data
        if (costDate < startPeriodDate) return;
        if (startDate && costDate < new Date(startDate)) return;
        if (endDate && costDate > new Date(endDate)) return;

        if (filterPeriod === 'Year') {
            if (costDate.getFullYear() === today.getFullYear()) {
                dataPoints[costDate.getMonth()].costs += cost.amount;
            }
        } else if (filterPeriod === 'Quarter') {
             const monthName = costDate.toLocaleDateString('pt-BR', { month: 'short' });
             const bucket = dataPoints.find(dp => dp.name.toLowerCase() === monthName.toLowerCase());
             if (bucket) bucket.costs += cost.amount;
        } else {
            if (costDate.getMonth() === today.getMonth() && costDate.getFullYear() === today.getFullYear()) {
                const day = costDate.getDate();
                const weekIndex = Math.floor((day - 1) / 7);
                if (dataPoints[weekIndex]) dataPoints[weekIndex].costs += cost.amount;
            }
        }
    });

    // Totais
    const totalRev = dataPoints.reduce((acc, curr) => acc + curr.value, 0);
    const totalCst = dataPoints.reduce((acc, curr) => acc + curr.costs, 0);

    return { chartData: dataPoints, totalRevenue: totalRev, totalCosts: totalCst };
  }, [leads, costs, filterPeriod, startDate, endDate]);

  const { chartData, totalRevenue, totalCosts } = processedData;
  
  const activeProjects = projects.length; // Projetos totais (pode filtrar por status se desejar)
  const pipelineValue = leads.filter(l => l.stage !== 'Ganho' && l.stage !== 'Novo').length; // Leads em andamento

  const projectStatusData = [
    { name: 'Protótipo', value: projects.filter(p => p.phase === 'Criação do Protótipo').length },
    { name: 'Revisão', value: projects.filter(p => p.phase === 'Revisão').length },
    { name: 'Testes', value: projects.filter(p => p.phase === 'Testes').length },
    { name: 'Entrega', value: projects.filter(p => p.phase === 'Entrega').length },
  ].filter(item => item.value > 0);

  const COLORS = ['#20bbe3', '#1687cb', '#8b5cf6', '#34d399'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-white">Visão Geral</h2>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 w-full sm:w-auto">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2 bg-[#1e2e41] p-1.5 rounded-lg border border-[#1687cb]/20 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center">
                    <Calendar size={16} className="text-[#20bbe3] ml-2" />
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent text-xs text-slate-300 outline-none border-none p-1 w-24 sm:w-auto" 
                    />
                </div>
                <span className="text-slate-500">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-300 outline-none border-none p-1 w-24 sm:w-auto" 
                />
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-2 bg-[#1e2e41] p-1 rounded-lg border border-[#1687cb]/20 w-full sm:w-auto">
            <div className="px-2 text-slate-400">
                <Filter size={18} />
            </div>
            <select 
                value={filterPeriod} 
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white outline-none border-none p-2 cursor-pointer hover:text-[#20bbe3] transition-colors flex-1"
            >
                <option value="Month" className="bg-[#1e2e41]">Este Mês</option>
                <option value="Quarter" className="bg-[#1e2e41]">Último Trimestre</option>
                <option value="Year" className="bg-[#1e2e41]">Ano Atual</option>
            </select>
            </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: filterPeriod === 'Month' ? 'Receita Mensal' : 'Receita do Período', value: `R$ ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#20bbe3]' },
          { label: 'Projetos Ativos', value: activeProjects, icon: Activity, color: 'text-[#1687cb]' },
          { label: filterPeriod === 'Month' ? 'Custos Mensais' : 'Custos do Período', value: `R$ ${totalCosts.toLocaleString()}`, icon: TrendingUp, color: 'text-red-400' },
          { label: 'Oportunidades (Pipeline)', value: pipelineValue, icon: Users, color: 'text-emerald-400' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-[#1e2e41] p-6 rounded-2xl border border-[#1687cb]/10 shadow-lg hover:border-[#20bbe3]/30 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl bg-[#111623] ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Area Chart */}
        <div className="bg-[#1e2e41] p-6 rounded-2xl border border-[#1687cb]/10">
          <h3 className="text-lg font-semibold text-white mb-6">Receita {filterPeriod === 'Year' ? 'Anual' : filterPeriod === 'Quarter' ? 'Trimestral' : 'Mensal'}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#20bbe3" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#20bbe3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3f57" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111623', border: '1px solid #2d3f57', borderRadius: '8px' }}
                  itemStyle={{ color: '#20bbe3' }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString()}`, 'Receita']}
                />
                <Area type="monotone" dataKey="value" stroke="#20bbe3" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Phase Distribution (Pie Chart) */}
        <div className="bg-[#1e2e41] p-6 rounded-2xl border border-[#1687cb]/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Distribuição por Fase</h3>
            <span className="text-xs text-slate-400 bg-[#111623] px-2 py-1 rounded">Quantidade de Projetos</span>
          </div>
          <div className="h-80 relative">
            {activeProjects > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    >
                    {projectStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip 
                    contentStyle={{ backgroundColor: '#111623', border: '1px solid #2d3f57', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    />
                    <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle"
                        formatter={(value, entry: any) => <span className="text-slate-300 ml-1">{value} ({entry.payload.value})</span>}
                    />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    Nenhum projeto ativo
                </div>
            )}
            {/* Center Text overlay */}
            {activeProjects > 0 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[65%] text-center pointer-events-none">
                    <span className="text-3xl font-bold text-white">{activeProjects}</span>
                    <p className="text-[10px] text-slate-400 uppercase">Projetos</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
