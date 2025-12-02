
import React, { useState } from 'react';
import { CRMLead, LeadStage, User } from '../types';
import { DollarSign, Mail, CalendarDays, Plus, User as UserIcon } from 'lucide-react';
import { Modal, FormInput, FormSelect } from './Modal';

interface CRMProps {
  leads: CRMLead[];
  setLeads: React.Dispatch<React.SetStateAction<CRMLead[]>>;
  currentUser: User;
}

const CRM: React.FC<CRMProps> = ({ leads, setLeads, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState<Partial<CRMLead>>({
      name: '', company: '', value: 0, email: '', stage: LeadStage.NEW
  });

  const stages = Object.values(LeadStage);

  const handleSave = () => {
    if (newLead.name && newLead.company) {
        const lead: CRMLead = {
            id: `lead-${Date.now()}`,
            name: newLead.name!,
            company: newLead.company!,
            value: Number(newLead.value) || 0,
            email: newLead.email || '',
            stage: newLead.stage || LeadStage.NEW,
            lastContact: new Date().toISOString(),
            createdBy: currentUser.name
        };
        setLeads([...leads, lead]);
        setIsModalOpen(false);
        setNewLead({ name: '', company: '', value: 0, email: '', stage: LeadStage.NEW });
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Pipeline de Vendas</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
        >
           <Plus size={18} />
           Novo Lead
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-[1200px] h-full pb-4">
          {stages.map((stage) => {
            const stageLeads = leads.filter(l => l.stage === stage);
            const stageValue = stageLeads.reduce((acc, l) => acc + l.value, 0);

            return (
              <div key={stage} className="flex-1 min-w-[280px] bg-[#1e2e41]/50 rounded-xl flex flex-col border border-[#1687cb]/10">
                {/* Header */}
                <div className="p-4 border-b border-[#1687cb]/10 bg-[#1e2e41] rounded-t-xl sticky top-0 z-10">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-slate-200">{stage}</h3>
                    <span className="bg-[#111623] text-xs px-2 py-1 rounded-full text-slate-400">{stageLeads.length}</span>
                  </div>
                  <p className="text-sm text-[#20bbe3] font-medium">R$ {stageValue.toLocaleString()}</p>
                </div>

                {/* Cards Container */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="bg-[#1e2e41] p-4 rounded-lg shadow-sm border border-[#1687cb]/10 hover:border-[#20bbe3]/50 transition-all cursor-pointer group">
                      <h4 className="font-bold text-white mb-1 group-hover:text-[#20bbe3] transition-colors">{lead.company}</h4>
                      <p className="text-slate-400 text-sm mb-3">{lead.name}</p>
                      
                      <div className="flex items-center gap-2 text-[#20bbe3] font-semibold text-sm mb-3">
                        <DollarSign size={14} />
                        <span>{lead.value.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-500 border-t border-[#1687cb]/10 pt-3">
                        <div className="flex items-center gap-1">
                          <Mail size={12} />
                          <span className="truncate max-w-[80px]">{lead.email.split('@')[0]}...</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarDays size={12} />
                          <span>{new Date(lead.lastContact).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                        </div>
                      </div>
                      
                      {lead.createdBy && (
                         <div className="mt-2 pt-2 border-t border-[#1687cb]/5 text-[10px] text-slate-600 flex items-center gap-1">
                             <UserIcon size={10} /> Criado por: {lead.createdBy}
                         </div>
                      )}
                    </div>
                  ))}
                  
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-sm border-2 border-dashed border-slate-700 rounded-lg">
                      Sem leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

       {/* New Lead Modal */}
       <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Novo Lead / Oportunidade"
          onSave={handleSave}
        >
          <FormInput label="Nome do Lead" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} placeholder="Ex: Maria Oliveira" autoFocus />
          <FormInput label="Empresa" value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} placeholder="Ex: Varejo Ltda" />
          <FormInput label="Valor Estimado (R$)" type="number" value={newLead.value} onChange={e => setNewLead({...newLead, value: Number(e.target.value)})} placeholder="0.00" />
          <FormInput label="Email de Contato" type="email" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} placeholder="email@empresa.com" />
          
          <FormSelect label="Estágio Inicial" value={newLead.stage} onChange={e => setNewLead({...newLead, stage: e.target.value as any})}>
              {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </FormSelect>
        </Modal>
    </div>
  );
};

export default CRM;
