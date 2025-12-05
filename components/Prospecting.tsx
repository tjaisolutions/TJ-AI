
import React, { useState } from 'react';
import { Search, MapPin, Briefcase, Globe, Phone, Mail, Plus, Loader2, UserPlus, Building2, MessageCircle } from 'lucide-react';
import { Prospect, CRMLead, LeadStage, User } from '../types';
import { findProspects } from '../services/geminiService';

interface ProspectingProps {
  onAddLead: (prospect: Prospect) => void;
  currentUser: User;
}

const Prospecting: React.FC<ProspectingProps> = ({ onAddLead, currentUser }) => {
  const [niche, setNiche] = useState('');
  const [region, setRegion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Prospect[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !region) return;

    setIsLoading(true);
    setSearched(true);
    setResults([]);

    try {
      const prospects = await findProspects(niche, region);
      setResults(prospects);
    } catch (error) {
      console.error("Erro na busca", error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanPhoneNumber = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      
      {/* Search Header */}
      <div className="bg-[#1e2e41] p-6 rounded-2xl border border-[#1687cb]/20 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4 text-[#20bbe3]">
            <div className="p-2 bg-[#20bbe3]/10 rounded-lg">
                <Search size={24} />
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">Prospecção Inteligente</h3>
                <p className="text-sm text-slate-400">Encontre novos clientes usando IA e Google Search em tempo real.</p>
            </div>
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nicho / Ramo</label>
                <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        placeholder="Ex: Clínicas Odontológicas, Escritórios de Advocacia..."
                        className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-[#20bbe3] outline-none transition-all placeholder-slate-600"
                    />
                </div>
            </div>

            <div className="md:col-span-5 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Região / Cidade</label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="Ex: São Paulo, Zona Sul RJ, Belo Horizonte..."
                        className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-[#20bbe3] outline-none transition-all placeholder-slate-600"
                    />
                </div>
            </div>

            <div className="md:col-span-2 flex items-end">
                <button 
                    type="submit" 
                    disabled={isLoading || !niche || !region}
                    className="w-full h-[46px] bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] font-bold rounded-xl transition-all shadow-lg shadow-[#20bbe3]/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    Buscar
                </button>
            </div>
        </form>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-[#20bbe3]/20 border-t-[#20bbe3] animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Globe size={24} className="text-[#20bbe3] animate-pulse" />
                    </div>
                </div>
                <p className="animate-pulse font-medium">Vasculhando a web por empresas...</p>
            </div>
        ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.map((prospect, index) => (
                    <div key={index} className="bg-[#1e2e41] p-5 rounded-2xl border border-[#1687cb]/10 hover:border-[#20bbe3]/40 transition-all group shadow-md flex flex-col h-full animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-[#111623] rounded-lg border border-[#1687cb]/20 text-white">
                                <Building2 size={20} />
                            </div>
                            <button 
                                onClick={() => onAddLead(prospect)}
                                className="px-3 py-1.5 bg-[#20bbe3]/10 hover:bg-[#20bbe3] text-[#20bbe3] hover:text-[#111623] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-[#20bbe3]/20"
                            >
                                <Plus size={14} />
                                Adicionar Lead
                            </button>
                        </div>

                        <h4 className="text-lg font-bold text-white mb-1 group-hover:text-[#20bbe3] transition-colors">{prospect.name}</h4>
                        <p className="text-xs text-slate-400 mb-4 line-clamp-2 min-h-[32px]">{prospect.description || "Empresa encontrada via busca."}</p>

                        <div className="space-y-2 mt-auto">
                             {/* Website */}
                            <div className="flex items-center gap-2 text-sm text-slate-300 bg-[#111623]/50 p-2 rounded-lg">
                                <Globe size={14} className="text-[#20bbe3]" />
                                <a href={prospect.website !== 'Não disponível' ? prospect.website : '#'} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[#20bbe3] hover:underline">
                                    {prospect.website}
                                </a>
                            </div>

                            {/* WhatsApp Button - Se disponível */}
                            {prospect.whatsapp && prospect.whatsapp !== 'Não disponível' && (
                                <a 
                                    href={`https://wa.me/55${cleanPhoneNumber(prospect.whatsapp)}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-white bg-green-600/20 hover:bg-green-600/40 p-2 rounded-lg border border-green-600/30 transition-colors cursor-pointer"
                                >
                                    <MessageCircle size={14} className="text-green-500" />
                                    <span className="truncate font-medium">WhatsApp: {prospect.whatsapp}</span>
                                </a>
                            )}

                            {/* Phone - Se não tiver WhatsApp explícito ou se quiser mostrar ambos */}
                            {(!prospect.whatsapp || prospect.whatsapp === 'Não disponível') && (
                                <div className="flex items-center gap-2 text-sm text-slate-300 bg-[#111623]/50 p-2 rounded-lg">
                                    <Phone size={14} className="text-yellow-400" />
                                    <span className="truncate">{prospect.phone}</span>
                                </div>
                            )}

                            {/* Email */}
                            <div className="flex items-center gap-2 text-sm text-slate-300 bg-[#111623]/50 p-2 rounded-lg">
                                <Mail size={14} className="text-emerald-400" />
                                <span className="truncate">{prospect.email}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : searched ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-[#1687cb]/20 rounded-2xl bg-[#1e2e41]/30">
                <Search size={40} className="mb-4 opacity-50" />
                <p>Nenhuma empresa encontrada com estes termos.</p>
                <p className="text-xs mt-1">Tente mudar a região ou o nicho.</p>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <UserPlus size={48} className="mb-4 text-[#20bbe3]/20" />
                <p className="font-medium">Comece sua prospecção</p>
                <p className="text-sm mt-1">Digite um nicho e uma região acima.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Prospecting;
