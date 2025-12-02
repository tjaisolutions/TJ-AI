
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import CRM from './components/CRM';
import Agenda from './components/Agenda';
import MeetingRoom from './components/MeetingRoom';
import Reports from './components/Reports';
import Receivables from './components/Receivables';
import Settings from './components/Settings';
import Login from './components/Login';
import { ViewState, Cost, Client, Budget, Project, Meeting, RecordedMeeting, CRMLead, Receivable, User } from './types';
import { MOCK_PROJECTS, MOCK_CLIENTS, MOCK_LEADS, MOCK_BUDGETS, MOCK_COSTS, MOCK_MEETINGS, MOCK_RECEIVABLES, MOCK_USERS } from './constants';
import { Search, Bell, Plus, LogOut, X, ChevronRight, FolderKanban, Users, UserIcon } from 'lucide-react';
import { Modal, FormInput, FormSelect } from './components/Modal';

// --- LocalStorage Helper ---
const loadState = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(`tj_ai_${key}`);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Error loading key tj_ai_${key}`, error);
    return fallback;
  }
};

const App: React.FC = () => {
  const [currentView, setView] = useState<ViewState>('DASHBOARD');

  // User State - Persisted
  const [users, setUsers] = useState<User[]>(() => loadState('users', MOCK_USERS));
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadState('current_user', null));

  // Shared Data State - Persisted
  const [clients, setClients] = useState<Client[]>(() => loadState('clients', MOCK_CLIENTS));
  const [projects, setProjects] = useState<Project[]>(() => loadState('projects', MOCK_PROJECTS));
  const [budgets, setBudgets] = useState<Budget[]>(() => loadState('budgets', MOCK_BUDGETS));
  const [costs, setCosts] = useState<Cost[]>(() => loadState('costs', MOCK_COSTS));
  const [leads, setLeads] = useState<CRMLead[]>(() => loadState('leads', MOCK_LEADS));
  const [meetings, setMeetings] = useState<Meeting[]>(() => loadState('meetings', MOCK_MEETINGS));
  const [recordedMeetings, setRecordedMeetings] = useState<RecordedMeeting[]>(() => loadState('recorded_meetings', []));
  const [receivables, setReceivables] = useState<Receivable[]>(() => loadState('receivables', MOCK_RECEIVABLES));

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Guest Logic check on mount
  const isGuest = new URLSearchParams(window.location.search).get('guest') === 'true';

  // --- Persistence Effects ---
  useEffect(() => { localStorage.setItem('tj_ai_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { 
    if (currentUser) localStorage.setItem('tj_ai_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('tj_ai_current_user');
  }, [currentUser]);
  useEffect(() => { localStorage.setItem('tj_ai_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('tj_ai_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('tj_ai_budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { localStorage.setItem('tj_ai_costs', JSON.stringify(costs)); }, [costs]);
  useEffect(() => { localStorage.setItem('tj_ai_leads', JSON.stringify(leads)); }, [leads]);
  useEffect(() => { localStorage.setItem('tj_ai_meetings', JSON.stringify(meetings)); }, [meetings]);
  useEffect(() => { localStorage.setItem('tj_ai_recorded_meetings', JSON.stringify(recordedMeetings)); }, [recordedMeetings]);
  useEffect(() => { localStorage.setItem('tj_ai_receivables', JSON.stringify(receivables)); }, [receivables]);


  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setView('DASHBOARD');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('DASHBOARD');
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Logic
  const filteredProjectsSearch = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredClientsSearch = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchResultClick = (view: ViewState) => {
    setView(view);
    setShowSearchResults(false);
    setSearchQuery('');
  };


  // --- CLIENTS VIEW ---
  const ClientsView = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newClient, setNewClient] = useState<Partial<Client>>({
      name: '', company: '', email: '', cnpj: '', contractDetails: '', status: 'Active'
    });

    const handleSave = () => {
      if (newClient.name && newClient.company && currentUser) {
        const client: Client = {
          id: `cli-${Date.now()}`,
          name: newClient.name!,
          company: newClient.company!,
          email: newClient.email || '',
          cnpj: newClient.cnpj || '',
          contractDetails: newClient.contractDetails || '',
          avatar: `https://ui-avatars.com/api/?name=${newClient.name}&background=random`,
          status: newClient.status as 'Active' | 'Inactive' || 'Active',
          createdBy: currentUser.name,
          createdAt: new Date().toISOString()
        };
        setClients([...clients, client]);
        setIsModalOpen(false);
        setNewClient({ name: '', company: '', email: '', cnpj: '', contractDetails: '', status: 'Active' });
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Clientes</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
          >
            <Plus size={18} />
            Novo Cliente
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.length === 0 && (
             <div className="col-span-full text-center py-10 text-slate-500 border-2 border-dashed border-[#1687cb]/20 rounded-2xl">
                Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.
             </div>
          )}
          {clients.map(client => (
            <div key={client.id} className="bg-[#1e2e41] p-6 rounded-2xl border border-[#1687cb]/10 flex flex-col items-center text-center hover:border-[#20bbe3]/30 transition-all group relative">
              <div className="relative">
                 <img src={client.avatar} alt={client.name} className="w-20 h-20 rounded-full mb-4 border-2 border-[#20bbe3] object-cover" />
                 <div className={`absolute bottom-4 right-0 w-4 h-4 rounded-full border-2 border-[#1e2e41] ${client.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
              </div>
              <h3 className="text-xl font-bold text-white">{client.name}</h3>
              <p className="text-[#20bbe3] text-sm font-medium mb-1">{client.company}</p>
              <p className="text-slate-400 text-xs mb-3 font-mono">{client.cnpj}</p>
              
              <div className="w-full bg-[#111623]/50 p-3 rounded-lg text-left mb-4 border border-[#1687cb]/10">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Contrato</p>
                <p className="text-sm text-slate-300 line-clamp-2">{client.contractDetails}</p>
              </div>

              <div className="text-[10px] text-slate-500 w-full text-right mb-4">
                  Criado por: {client.createdBy || 'Sistema'}
              </div>

              <div className="flex gap-2 w-full mt-auto">
                 <button className="flex-1 py-2 rounded-lg bg-[#111623] text-slate-400 hover:text-white hover:bg-[#1687cb]/20 text-xs font-medium transition-colors border border-[#1687cb]/20">Ver Detalhes</button>
                 <button className="flex-1 py-2 rounded-lg bg-[#20bbe3]/10 text-[#20bbe3] hover:bg-[#20bbe3]/20 text-xs font-medium transition-colors border border-[#20bbe3]/20">Editar</button>
              </div>
            </div>
          ))}
        </div>

        {/* New Client Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Adicionar Novo Cliente"
          onSave={handleSave}
        >
          <FormInput label="Nome do Cliente" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Ex: João Silva" autoFocus />
          <FormInput label="Empresa" value={newClient.company} onChange={e => setNewClient({...newClient, company: e.target.value})} placeholder="Ex: Tech Solutions" />
          <FormInput label="CNPJ" value={newClient.cnpj} onChange={e => setNewClient({...newClient, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
          <FormInput label="Email de Contato" type="email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="contato@empresa.com" />
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Detalhes do Contrato</label>
            <textarea 
              className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-colors h-24 resize-none"
              placeholder="Descreva o escopo e termos principais..."
              value={newClient.contractDetails}
              onChange={e => setNewClient({...newClient, contractDetails: e.target.value})}
            />
          </div>
          <FormSelect label="Status" value={newClient.status} onChange={e => setNewClient({...newClient, status: e.target.value as any})}>
            <option value="Active">Ativo</option>
            <option value="Inactive">Inativo</option>
          </FormSelect>
        </Modal>
      </div>
    );
  };

  // --- BUDGETS VIEW ---
  const BudgetsView = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newBudget, setNewBudget] = useState<Partial<Budget>>({
      title: '', clientId: '', amount: 0, contractDuration: '', status: 'Draft'
    });
    const [contractFile, setContractFile] = useState<File | null>(null);

    const handleSave = () => {
      if (newBudget.title && newBudget.clientId && currentUser) {
        const budget: Budget = {
          id: `bdg-${Date.now()}`,
          title: newBudget.title!,
          clientId: newBudget.clientId!,
          amount: Number(newBudget.amount) || 0,
          date: new Date().toISOString(),
          contractDuration: newBudget.contractDuration || 'N/A',
          status: 'Draft',
          items: [],
          createdBy: currentUser.name
        };
        setBudgets([budget, ...budgets]);
        setIsModalOpen(false);
        setNewBudget({ title: '', clientId: '', amount: 0, contractDuration: '', status: 'Draft' });
        setContractFile(null);
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Orçamentos & Contratos</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
          >
            <Plus size={18} />
            Novo Contrato
          </button>
        </div>
        
        <div className="bg-[#1e2e41] rounded-2xl overflow-hidden border border-[#1687cb]/10">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#111623] text-slate-400 border-b border-[#1687cb]/20">
              <tr>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Contrato / Título</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Cliente</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Duração</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Valor Global</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Criado Por</th>
              </tr>
            </thead>
            <tbody className="text-slate-200 divide-y divide-[#1687cb]/10">
              {budgets.length === 0 && (
                 <tr><td colSpan={6} className="p-4 text-center text-slate-500 italic">Nenhum contrato cadastrado.</td></tr>
              )}
              {budgets.map(budget => {
                 const client = clients.find(c => c.id === budget.clientId);
                 return (
                  <tr key={budget.id} className="hover:bg-[#1687cb]/5 transition-colors group">
                    <td className="p-4 font-medium flex items-center gap-2">
                       <FileText size={16} className="text-[#20bbe3]" />
                       {budget.title}
                    </td>
                    <td className="p-4 text-slate-400">
                      <div className="flex items-center gap-2">
                         {client?.avatar && <img src={client.avatar} className="w-5 h-5 rounded-full" alt="" />}
                         {client?.name || 'Desconhecido'}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{budget.contractDuration}</td>
                    <td className="p-4 text-[#20bbe3] font-bold">R$ {budget.amount.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        budget.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        budget.status === 'Sent' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                        'bg-slate-500/10 border-slate-500/30 text-slate-400'
                      }`}>
                        {budget.status === 'Draft' ? 'Rascunho' : 
                         budget.status === 'Sent' ? 'Enviado' : 
                         budget.status === 'Approved' ? 'Ativo' : 'Rejeitado'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500 flex items-center gap-2">
                         <UserIcon size={12} /> {budget.createdBy || 'Sistema'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* New Budget Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Novo Contrato / Orçamento"
          onSave={handleSave}
        >
          <FormSelect 
            label="Cliente" 
            value={newBudget.clientId} 
            onChange={e => setNewBudget({...newBudget, clientId: e.target.value})}
          >
            <option value="">Selecione um cliente...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
          </FormSelect>
          <FormInput label="Título do Contrato" value={newBudget.title} onChange={e => setNewBudget({...newBudget, title: e.target.value})} placeholder="Ex: Contrato de Manutenção 2024" />
          <div className="grid grid-cols-2 gap-4">
             <FormInput label="Valor Global (R$)" type="number" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: Number(e.target.value)})} placeholder="0.00" />
             <FormInput label="Duração do Contrato" value={newBudget.contractDuration} onChange={e => setNewBudget({...newBudget, contractDuration: e.target.value})} placeholder="Ex: 12 meses" />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Documento do Contrato</label>
            <label className={`flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${contractFile ? 'border-[#20bbe3] bg-[#20bbe3]/10' : 'border-[#1687cb]/30 hover:border-[#20bbe3] hover:bg-[#1687cb]/5 bg-[#111623]'}`}>
                <input type="file" className="hidden" onChange={(e) => e.target.files && setContractFile(e.target.files[0])} accept=".pdf,.doc,.docx" />
                
                {contractFile ? (
                    <div className="flex items-center gap-3 text-[#20bbe3] animate-in fade-in zoom-in-95">
                        <FileText size={24} />
                        <span className="font-bold text-sm">{contractFile.name}</span>
                        <span className="text-xs text-slate-400 ml-2 font-normal">({(contractFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-[#20bbe3]">
                        <UploadCloud size={28} />
                        <span className="text-sm font-medium">Clique para carregar o contrato</span>
                        <span className="text-[10px] opacity-70">PDF, DOCX ou Imagens</span>
                    </div>
                )}
            </label>
          </div>
        </Modal>
      </div>
    );
  };

  // --- COSTS VIEW ---
  const CostsView = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [costTypeTab, setCostTypeTab] = useState<'Fixed' | 'Project'>('Fixed');
    const [newCost, setNewCost] = useState<Partial<Cost>>({
      description: '', category: 'Office', amount: 0, projectName: ''
    });

    const handleSave = () => {
       if (newCost.description && newCost.amount && currentUser) {
         const cost: Cost = {
           id: `cost-${Date.now()}`,
           description: newCost.description!,
           category: newCost.category as any,
           type: costTypeTab,
           projectName: costTypeTab === 'Project' ? newCost.projectName : undefined,
           amount: Number(newCost.amount),
           date: new Date().toISOString(),
           createdBy: currentUser.name
         };
         setCosts([cost, ...costs]);
         setIsModalOpen(false);
         setNewCost({ description: '', category: 'Office', amount: 0, projectName: '' });
       }
    };

    const fixedCosts = costs.filter(c => c.type === 'Fixed');
    const projectCosts = costs.filter(c => c.type === 'Project');

    // Group Project Costs by Client
    const clientGroups: Record<string, Cost[]> = {};
    projectCosts.forEach(cost => {
      // Find the project to get the client name
      const project = projects.find(p => p.title === cost.projectName);
      const clientName = project ? project.clientName : 'Sem Cliente / Outros';
      
      if (!clientGroups[clientName]) {
        clientGroups[clientName] = [];
      }
      clientGroups[clientName].push(cost);
    });

    const CostCard = ({ cost }: { cost: Cost }) => (
      <div className="bg-[#1e2e41] p-4 rounded-xl border border-[#1687cb]/10 flex justify-between items-center hover:border-[#20bbe3]/30 transition-all group">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
               <h4 className="text-white font-bold group-hover:text-[#20bbe3] transition-colors">{cost.description}</h4>
               {cost.type === 'Project' && cost.projectName && (
                  <span className="text-[10px] bg-[#1687cb]/20 text-[#20bbe3] px-2 py-0.5 rounded-full border border-[#1687cb]/30 flex items-center gap-1">
                      <Tag size={10} />
                      {cost.projectName}
                  </span>
               )}
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-xs">
              <span className="bg-[#111623] px-2 py-0.5 rounded text-slate-500 border border-slate-800">{cost.category}</span> 
              <span>{new Date(cost.date).toLocaleDateString()}</span>
              <span className="flex items-center gap-1 text-slate-500"><UserIcon size={10} /> {cost.createdBy}</span>
            </div>
          </div>
          <div className="text-red-400 font-mono font-bold bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
            - R$ {cost.amount.toLocaleString()}
          </div>
      </div>
    );

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Custos e Despesas</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
          >
            <Plus size={18} />
            Novo Custo
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Fixed Costs Column */}
          <div className="bg-[#111623]/30 p-4 rounded-2xl border border-dashed border-[#1687cb]/20 h-fit">
              <div className="flex items-center gap-2 mb-4 text-slate-300 border-b border-[#1687cb]/20 pb-3">
                  <div className="p-2 bg-[#1e2e41] rounded-lg text-[#20bbe3]">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Custos Fixos</h3>
                    <p className="text-xs text-slate-500">Despesas recorrentes e operacionais</p>
                  </div>
                  <span className="ml-auto text-xs bg-[#1e2e41] px-2 py-1 rounded text-white">{fixedCosts.length}</span>
              </div>
              <div className="space-y-3">
                  {fixedCosts.map(cost => <CostCard key={cost.id} cost={cost} />)}
                  {fixedCosts.length === 0 && <p className="text-slate-500 text-sm italic text-center py-4">Nenhum custo fixo registrado.</p>}
              </div>
          </div>

          {/* Project Costs Column (Grouped by Client) */}
          <div className="bg-[#111623]/30 p-4 rounded-2xl border border-dashed border-[#1687cb]/20 h-fit">
              <div className="flex items-center gap-2 mb-4 text-slate-300 border-b border-[#1687cb]/20 pb-3">
                  <div className="p-2 bg-[#1e2e41] rounded-lg text-[#1687cb]">
                     <Briefcase size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Custos por Projeto</h3>
                    <p className="text-xs text-slate-500">Organizado por Cliente</p>
                  </div>
                  <span className="ml-auto text-xs bg-[#1e2e41] px-2 py-1 rounded text-white">{projectCosts.length}</span>
              </div>
              
              <div className="space-y-6">
                 {Object.entries(clientGroups).map(([clientName, costs]) => (
                   <div key={clientName} className="animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#20bbe3]"></div>
                        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide">{clientName}</h4>
                      </div>
                      <div className="space-y-2 pl-3 border-l-2 border-[#1687cb]/10">
                         {costs.map(cost => <CostCard key={cost.id} cost={cost} />)}
                      </div>
                   </div>
                 ))}

                 {projectCosts.length === 0 && <p className="text-slate-500 text-sm italic text-center py-4">Nenhum custo de projeto registrado.</p>}
              </div>
          </div>
        </div>

        {/* Cost Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Adicionar Novo Custo"
          onSave={handleSave}
        >
          {/* Flaps (Tabs) */}
          <div className="flex bg-[#111623] p-1 rounded-lg mb-6 border border-[#1687cb]/20">
            <button 
              onClick={() => setCostTypeTab('Fixed')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                costTypeTab === 'Fixed' ? 'bg-[#1687cb] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Custos Fixos
            </button>
            <button 
              onClick={() => setCostTypeTab('Project')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                costTypeTab === 'Project' ? 'bg-[#20bbe3] text-[#111623] shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Custos por Projeto
            </button>
          </div>

          <FormInput label="Descrição do Gasto" value={newCost.description} onChange={e => setNewCost({...newCost, description: e.target.value})} placeholder="Ex: Servidor AWS, Café, Freelancer..." />
          
          <div className="grid grid-cols-2 gap-4">
             <FormInput label="Valor (R$)" type="number" value={newCost.amount} onChange={e => setNewCost({...newCost, amount: Number(e.target.value)})} placeholder="0.00" />
             <FormSelect label="Categoria" value={newCost.category} onChange={e => setNewCost({...newCost, category: e.target.value as any})}>
                <option value="Software">Software & SaaS</option>
                <option value="Personnel">Pessoal / Terceiros</option>
                <option value="Marketing">Marketing & Ads</option>
                <option value="Office">Escritório</option>
                <option value="Infrastructure">Infraestrutura</option>
             </FormSelect>
          </div>

          {costTypeTab === 'Project' && (
            <div className="animate-in fade-in slide-in-from-top-2">
               <FormSelect 
                 label="Vincular ao Projeto" 
                 value={newCost.projectName} 
                 onChange={e => setNewCost({...newCost, projectName: e.target.value})}
                >
                  <option value="">Selecione o projeto...</option>
                  {projects.map(p => <option key={p.id} value={p.title}>{p.title} ({p.clientName})</option>)}
               </FormSelect>
            </div>
          )}
        </Modal>
      </div>
    );
  };

  const handleSaveMeeting = (meeting: RecordedMeeting) => {
    setRecordedMeetings(prev => [meeting, ...prev]);
    setView('AGENDA');
  };

  // If Guest URL detected, render Guest View immediately
  if (isGuest) {
     return (
        <div className="min-h-screen bg-[#111623] text-slate-200 font-sans">
             <MeetingRoom onLeave={() => {}} onSaveMeeting={() => {}} isGuest={true} />
        </div>
     );
  }

  // Authentication Guard
  if (!currentUser) {
     return <Login users={users} onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return <Dashboard projects={projects} leads={leads} costs={costs} />;
      case 'REPORTS':
        return <Reports projects={projects} costs={costs} budgets={budgets} leads={leads} clients={clients} />;
      case 'PROJECTS':
        return <Projects projects={projects} setProjects={setProjects} currentUser={currentUser} />;
      case 'CRM':
        return <CRM leads={leads} setLeads={setLeads} currentUser={currentUser} />;
      case 'CLIENTS':
        return <ClientsView />;
      case 'BUDGETS':
        return <BudgetsView />;
      case 'RECEIVABLES':
        return <Receivables receivables={receivables} setReceivables={setReceivables} clients={clients} currentUser={currentUser} />;
      case 'COSTS':
        return <CostsView />;
      case 'AGENDA':
        return <Agenda clients={clients} projects={projects} meetings={meetings} setMeetings={setMeetings} recordedMeetings={recordedMeetings} currentUser={currentUser} />;
      case 'MEETING_ROOM':
        return <MeetingRoom onLeave={() => setView('AGENDA')} onSaveMeeting={handleSaveMeeting} isGuest={false} />;
      case 'SETTINGS':
        return <Settings users={users} setUsers={setUsers} currentUser={currentUser} />;
      default:
        return <Dashboard projects={projects} leads={leads} costs={costs} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#111623] text-slate-200 font-sans selection:bg-[#20bbe3] selection:text-[#111623]">
      <Sidebar currentView={currentView} setView={setView} />
      
      <main className="pl-20 lg:pl-64 min-h-screen flex flex-col transition-all duration-300">
        {/* Top Header */}
        <header className="h-20 bg-[#111623]/80 backdrop-blur-md sticky top-0 z-40 border-b border-[#1687cb]/20 px-6 flex items-center justify-between">
          <div className="hidden md:flex flex-col relative" ref={searchRef}>
            <div className="flex items-center w-96 bg-[#1e2e41] rounded-lg px-4 py-2 border border-[#1687cb]/10 focus-within:border-[#20bbe3]/50 transition-colors">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar projetos ou clientes..." 
                className="bg-transparent border-none outline-none text-sm ml-3 w-full text-white placeholder-slate-500"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchQuery.length > 0)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute top-full mt-2 w-96 bg-[#1e2e41] border border-[#1687cb]/30 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="p-2">
                   {filteredProjectsSearch.length === 0 && filteredClientsSearch.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Nenhum resultado encontrado.
                      </div>
                   ) : (
                      <>
                        {filteredProjectsSearch.length > 0 && (
                          <div className="mb-2">
                             <div className="px-3 py-1 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <FolderKanban size={12} /> Projetos
                             </div>
                             {filteredProjectsSearch.slice(0, 3).map(p => (
                               <div 
                                  key={p.id} 
                                  onClick={() => handleSearchResultClick('PROJECTS')}
                                  className="px-3 py-2 hover:bg-[#111623] rounded-lg cursor-pointer group flex items-center justify-between"
                               >
                                  <div>
                                    <p className="text-sm font-bold text-white group-hover:text-[#20bbe3]">{p.title}</p>
                                    <p className="text-xs text-slate-500">{p.clientName}</p>
                                  </div>
                                  <ChevronRight size={14} className="text-slate-600 group-hover:text-[#20bbe3]" />
                               </div>
                             ))}
                          </div>
                        )}

                        {filteredClientsSearch.length > 0 && (
                          <div>
                             <div className="px-3 py-1 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Users size={12} /> Clientes
                             </div>
                             {filteredClientsSearch.slice(0, 3).map(c => (
                               <div 
                                  key={c.id} 
                                  onClick={() => handleSearchResultClick('CLIENTS')}
                                  className="px-3 py-2 hover:bg-[#111623] rounded-lg cursor-pointer group flex items-center justify-between"
                               >
                                  <div>
                                    <p className="text-sm font-bold text-white group-hover:text-[#20bbe3]">{c.name}</p>
                                    <p className="text-xs text-slate-500">{c.company}</p>
                                  </div>
                                  <ChevronRight size={14} className="text-slate-600 group-hover:text-[#20bbe3]" />
                               </div>
                             ))}
                          </div>
                        )}
                      </>
                   )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-[#1687cb]/20">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-white">{currentUser.name}</p>
                <p className="text-xs text-[#20bbe3]">{currentUser.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1687cb] to-[#20bbe3] p-[1px] cursor-pointer" onClick={() => setView('SETTINGS')}>
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full rounded-full bg-[#111623] object-cover" />
              </div>
              
              <button 
                onClick={handleLogout}
                className="ml-2 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Sair do Sistema"
              >
                  <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 flex-1 overflow-auto custom-scrollbar">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
