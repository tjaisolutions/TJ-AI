
import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Project, CRMLead, Cost } from '../types';
import { TrendingUp, Users, DollarSign, Activity, Filter, Calendar } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  leads: CRMLead[];
  costs: Cost[];
}

const Dashboard: React.FC<DashboardProps> = ({ projects, leads, costs }) => {
  const [filterPeriod, setFilterPeriod] = useState('Month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mock data simulation based on filter
  // In a real app, this would filter 'projects', 'leads', and 'costs' by date
  const getMockData = () => {
    // If specific dates are selected, we could use them here to filter logic
    if (filterPeriod === 'Quarter') {
       return {
         revenueData: [
            { name: 'Jul', value: 3490 },
            { name: 'Ago', value: 4200 },
            { name: 'Set', value: 3800 },
         ],
         multiplier: 3
       };
    } else if (filterPeriod === 'Year') {
      return {
        revenueData: [
           { name: 'Jan', value: 4000 }, { name: 'Fev', value: 3000 },
           { name: 'Mar', value: 2000 }, { name: 'Abr', value: 2780 },
           { name: 'Mai', value: 1890 }, { name: 'Jun', value: 2390 },
           { name: 'Jul', value: 3490 }, { name: 'Ago', value: 4200 },
           { name: 'Set', value: 3800 }, { name: 'Out', value: 5000 },
           { name: 'Nov', value: 4800 }, { name: 'Dez', value: 6000 },
        ],
        multiplier: 12
      };
    } else {
      // Month (Daily or Weekly view simulation)
       return {
         revenueData: [
           { name: 'Sem 1', value: 1200 },
           { name: 'Sem 2', value: 1800 },
           { name: 'Sem 3', value: 1400 },
           { name: 'Sem 4', value: 2100 },
         ],
         multiplier: 1
       };
    }
  };

  const { revenueData, multiplier } = getMockData();

  // Recalculate stats based on simulation
  const totalRevenue = leads.reduce((acc, lead) => lead.stage === 'Ganho' ? acc + lead.value : acc, 0) * (multiplier === 12 ? 3 : 1);
  const activeProjects = projects.length;
  const totalCosts = costs.reduce((acc, cost) => acc + cost.amount, 0) * (multiplier === 12 ? 10 : 1);
  const pipelineValue = leads.length;

  const projectStatusData = [
    { name: 'Protótipo', value: projects.filter(p => p.phase === 'Criação do Protótipo').length },
    { name: 'Revisão', value: projects.filter(p => p.phase === 'Revisão').length },
    { name: 'Testes', value: projects.filter(p => p.phase === 'Testes').length },
    { name: 'Entrega', value: projects.filter(p => p.phase === 'Entrega').length },
  ].filter(item => item.value > 0);

  // Updated Colors: Replaced invisible #1e2e41 with Purple #8b5cf6, and Slate with Emerald #34d399
  const COLORS = ['#20bbe3', '#1687cb', '#8b5cf6', '#34d399'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-white">Visão Geral</h2>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2 bg-[#1e2e41] p-1.5 rounded-lg border border-[#1687cb]/20 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center flex-1">
                    <Calendar size={16} className="text-[#20bbe3] ml-2 shrink-0" />
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent text-xs text-slate-300 outline-none border-none p-1 w-full sm:w-24" 
                    />
                </div>
                <span className="text-slate-500 shrink-0">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-300 outline-none border-none p-1 w-full sm:w-24 text-right sm:text-left" 
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
                className="bg-transparent text-sm font-semibold text-white outline-none border-none p-2 cursor-pointer hover:text-[#20bbe3] transition-colors flex-1 w-full"
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
          { label: filterPeriod === 'Month' ? 'Receita Mensal' : 'Receita Acumulada', value: `R$ ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#20bbe3]' },
          { label: 'Projetos Ativos', value: activeProjects, icon: Activity, color: 'text-[#1687cb]' },
          { label: filterPeriod === 'Month' ? 'Custos Mensais' : 'Custos Totais', value: `R$ ${totalCosts.toLocaleString()}`, icon: TrendingUp, color: 'text-red-400' },
          { label: 'Leads no Pipeline', value: pipelineValue, icon: Users, color: 'text-emerald-400' },
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
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#20bbe3" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#20bbe3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3f57" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} dy={10} interval={0} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111623', border: '1px solid #2d3f57', borderRadius: '8px' }}
                  itemStyle={{ color: '#20bbe3' }}
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
          <div className="h-64 sm:h-80 relative">
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
            {/* Center Text overlay */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[65%] text-center pointer-events-none">
                <span className="text-3xl font-bold text-white">{activeProjects}</span>
                <p className="text-[10px] text-slate-400 uppercase">Projetos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
