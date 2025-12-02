import React, { useState } from 'react';
import { Project, ProjectPhase, User } from '../types';
import { Calendar, CheckCircle2, Circle, Clock, Sparkles, Pencil, Save, X, Plus, ClipboardList, CheckSquare, User as UserIcon, Trash2 } from 'lucide-react';
import { generateInsight } from '../services/geminiService';

interface ProjectsProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  currentUser: User;
}

const Projects: React.FC<ProjectsProps> = ({ projects, setProjects, currentUser }) => {
  const [loadingAi, setLoadingAi] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<{id: string, text: string} | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Project | null>(null);

  const phases = Object.values(ProjectPhase);
  const getPhaseIndex = (phase: ProjectPhase) => phases.indexOf(phase);

  const handlePhaseChange = (projectId: string, newPhase: ProjectPhase) => {
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === projectId) {
        let newProgress = p.progress;
        const newIndex = getPhaseIndex(newPhase);
        if (newIndex === 0) newProgress = 25;
        if (newIndex === 1) newProgress = 50;
        if (newIndex === 2) newProgress = 75;
        if (newIndex === 3) newProgress = 100;
        
        return { 
          ...p, 
          phase: newPhase, 
          progress: newProgress,
          lastUpdatedBy: currentUser.name 
        };
      }
      return p;
    }));
  };

  const handleAddProject = () => {
    const newProject: Project = {
        id: `new-${Date.now()}`,
        title: 'Novo Projeto',
        clientId: '1',
        clientName: 'Cliente Novo',
        deadline: new Date().toISOString().split('T')[0],
        budget: 0,
        phase: ProjectPhase.PROTOTYPE,
        progress: 0,
        description: 'Descrição do novo projeto.',
        phaseDeadlines: {
            [ProjectPhase.PROTOTYPE]: new Date().toISOString().split('T')[0],
            [ProjectPhase.REVIEW]: new Date().toISOString().split('T')[0],
            [ProjectPhase.TESTING]: new Date().toISOString().split('T')[0],
            [ProjectPhase.DELIVERY]: new Date().toISOString().split('T')[0],
        },
        phaseDetails: {
            [ProjectPhase.PROTOTYPE]: { done: '', todo: '' },
            [ProjectPhase.REVIEW]: { done: '', todo: '' },
            [ProjectPhase.TESTING]: { done: '', todo: '' },
            [ProjectPhase.DELIVERY]: { done: '', todo: '' },
        },
        createdBy: currentUser.name,
        createdAt: new Date().toISOString()
    };
    setProjects([newProject, ...projects]);
    startEditing(newProject);
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.")) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (editingId === projectId) {
        cancelEditing();
      }
    }
  };

  const handleAiAnalysis = async (project: Project) => {
    setLoadingAi(project.id);
    setAiInsight(null);
    const currentDetails = project.phaseDetails[project.phase] || { done: '', todo: '' };
    const context = `Projeto: ${project.title}, Cliente: ${project.clientName}, Fase: ${project.phase}, Progresso: ${project.progress}%, Deadline: ${project.deadline}, Descrição: ${project.description}, Feito Recentemente: ${currentDetails.done}, Pendente: ${currentDetails.todo}`;
    const prompt = "Gere um resumo executivo curto de 2 frases sobre o status atual e sugira o próximo passo prioritário.";
    
    const insight = await generateInsight(prompt, context);
    setAiInsight({ id: project.id, text: insight });
    setLoadingAi(null);
  };

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditForm({ ...project });
    setAiInsight(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEditing = () => {
    if (editForm) {
      setProjects(prev => prev.map(p => p.id === editForm.id ? { ...editForm, lastUpdatedBy: currentUser.name } : p));
      setEditingId(null);
      setEditForm(null);
    }
  };

  const updateEditForm = (field: keyof Project, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const updateStatusReport = (field: 'done' | 'todo', value: string) => {
      if (editForm) {
          setEditForm({
              ...editForm,
              phaseDetails: {
                  ...editForm.phaseDetails,
                  [editForm.phase]: {
                      ...editForm.phaseDetails[editForm.phase],
                      [field]: value
                  }
              }
          });
      }
  };

  const updatePhaseDeadline = (phase: ProjectPhase, date: string) => {
    if (editForm) {
      setEditForm({
        ...editForm,
        phaseDeadlines: {
          ...editForm.phaseDeadlines,
          [phase]: date
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Gestão de Projetos</h2>
        <button 
            onClick={handleAddProject}
            className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
        >
           <Plus size={18} />
           Novo Projeto
        </button>
      </div>

      <div className="grid gap-6">
        {projects.map((project) => {
          const isEditing = editingId === project.id;
          const currentData = isEditing && editForm ? editForm : project;
          const currentPhaseDetails = currentData.phaseDetails[currentData.phase] || { done: '', todo: '' };

          return (
            <div key={project.id} className="bg-[#1e2e41] rounded-2xl p-6 border border-[#1687cb]/10 hover:border-[#20bbe3]/30 transition-all shadow-lg group relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div className="flex-1 w-full md:w-auto">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={currentData.title}
                      onChange={(e) => updateEditForm('title', e.target.value)}
                      className="text-xl font-bold text-white bg-[#111623] border border-[#1687cb]/30 rounded px-3 py-1 mb-1 focus:border-[#20bbe3] outline-none w-full md:w-auto"
                      placeholder="Nome do Projeto"
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-white group-hover:text-[#20bbe3] transition-colors">{project.title}</h3>
                  )}
                  <p className="text-slate-400 text-sm mt-1">{project.clientName}</p>
                </div>
                
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                  {isEditing ? (
                    <>
                      <button onClick={saveEditing} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors" title="Salvar">
                        <Save size={20} />
                      </button>
                      <button onClick={cancelEditing} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors" title="Cancelar">
                        <X size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleAiAnalysis(project)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#111623] border border-[#20bbe3]/30 text-[#20bbe3] rounded-lg text-xs hover:bg-[#20bbe3]/10 transition-colors"
                        disabled={loadingAi === project.id}
                      >
                        <Sparkles size={14} />
                        AI Insights
                      </button>
                      <div className="flex items-center gap-2 text-slate-400 bg-[#111623] px-3 py-1.5 rounded-lg text-sm border border-[#1687cb]/20">
                        <Calendar size={16} className="text-[#1687cb]" />
                        <span className="font-mono text-xs">{new Date(project.deadline).toLocaleDateString()}</span>
                      </div>
                      <button 
                        onClick={() => startEditing(project)}
                        className="text-slate-400 hover:text-white p-2 hover:bg-[#111623] rounded-lg transition-colors"
                        title="Editar Projeto"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-slate-400 hover:text-red-400 p-2 hover:bg-[#111623] rounded-lg transition-colors"
                        title="Excluir Projeto"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-[#111623]/30 p-4 rounded-xl border border-[#1687cb]/10">
                  <div>
                      <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2">
                          <CheckSquare size={14} /> Feito ({currentData.phase})
                      </h4>
                      {isEditing ? (
                          <textarea 
                              className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white text-sm focus:border-[#20bbe3] outline-none h-20 resize-none"
                              value={currentPhaseDetails.done}
                              onChange={(e) => updateStatusReport('done', e.target.value)}
                          />
                      ) : (
                          <p className="text-sm text-slate-300 min-h-[40px] whitespace-pre-line">{currentPhaseDetails.done || "N/A"}</p>
                      )}
                  </div>
                  <div>
                      <h4 className="flex items-center gap-2 text-xs font-bold text-[#20bbe3] uppercase tracking-wide mb-2">
                          <ClipboardList size={14} /> Pendente ({currentData.phase})
                      </h4>
                      {isEditing ? (
                          <textarea 
                              className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white text-sm focus:border-[#20bbe3] outline-none h-20 resize-none"
                              value={currentPhaseDetails.todo}
                              onChange={(e) => updateStatusReport('todo', e.target.value)}
                          />
                      ) : (
                          <p className="text-sm text-slate-300 min-h-[40px] whitespace-pre-line">{currentPhaseDetails.todo || "N/A"}</p>
                      )}
                  </div>
              </div>

              {/* Progress & Phases */}
              <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm text-slate-400">
                    <span>Progresso do Projeto</span>
                    <span className="text-white font-bold">{currentData.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#111623] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#1687cb] to-[#20bbe3] transition-all duration-500"
                      style={{ width: `${currentData.progress}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {phases.map((phase, idx) => {
                      const isActive = phase === currentData.phase;
                      const isPast = getPhaseIndex(currentData.phase) > idx;
                      const deadline = currentData.phaseDeadlines[phase];

                      return (
                        <div 
                          key={phase} 
                          className={`relative p-3 rounded-lg border transition-all ${
                            isActive 
                              ? 'bg-[#20bbe3]/10 border-[#20bbe3] text-white shadow-[0_0_10px_rgba(32,187,227,0.1)]' 
                              : isPast 
                                ? 'bg-[#111623] border-[#1687cb]/20 text-slate-400 opacity-70'
                                : 'bg-[#111623] border-[#1687cb]/10 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-[10px] uppercase font-bold tracking-wider truncate">{phase}</span>
                             {isActive && !isEditing && <div className="w-2 h-2 rounded-full bg-[#20bbe3] animate-pulse" />}
                          </div>
                          
                          {isEditing ? (
                             <input 
                               type="date" 
                               value={deadline} 
                               onChange={(e) => updatePhaseDeadline(phase, e.target.value)}
                               className="w-full bg-[#111623] text-[10px] text-slate-300 border border-[#1687cb]/30 rounded px-1 py-0.5"
                             />
                          ) : (
                             <div className="flex items-center gap-1 text-[10px]">
                                <Clock size={10} />
                                {new Date(deadline).toLocaleDateString()}
                             </div>
                          )}

                          {!isEditing && !isActive && !isPast && (
                             <button 
                               onClick={() => handlePhaseChange(project.id, phase)}
                               className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 bg-[#20bbe3]/10 flex items-center justify-center text-[#20bbe3] text-xs font-bold transition-opacity"
                             >
                               Mover
                             </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
              </div>

              {/* AI Insight Result */}
              {aiInsight && aiInsight.id === project.id && (
                <div className="mt-6 bg-gradient-to-r from-[#1e2e41] to-[#111623] p-4 rounded-xl border border-[#20bbe3]/30 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#20bbe3]/20 rounded-lg text-[#20bbe3]">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm mb-1">Nexus AI Insight</h4>
                      <p className="text-sm text-slate-300 leading-relaxed">{aiInsight.text}</p>
                    </div>
                    <button 
                      onClick={() => setAiInsight(null)}
                      className="ml-auto text-slate-500 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;
