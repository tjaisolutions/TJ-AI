
import React, { useState } from 'react';
import { User } from '../types';
import { Plus, Trash2, Shield, Mail, User as UserIcon } from 'lucide-react';
import { Modal, FormInput, FormSelect } from './Modal';

interface SettingsProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ users, setUsers, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '', email: '', password: '', role: 'Viewer'
  });

  const handleSaveUser = () => {
    if (newUser.name && newUser.email && newUser.password) {
      const userToAdd: User = {
        id: `u-${Date.now()}`,
        name: newUser.name!,
        email: newUser.email!,
        password: newUser.password!,
        role: newUser.role as 'Admin' | 'Manager' | 'Viewer',
        avatar: `https://ui-avatars.com/api/?name=${newUser.name}&background=random`
      };
      setUsers([...users, userToAdd]);
      setIsModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'Viewer' });
    }
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Tem certeza que deseja remover este usuário?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-3xl font-bold text-white">Configurações & Usuários</h2>
           <p className="text-slate-400 text-sm mt-1">Gerencie acesso e permissões do sistema.</p>
        </div>
        
        {currentUser.role === 'Admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#20bbe3]/20 active:scale-95"
          >
            <Plus size={18} />
            Novo Usuário
          </button>
        )}
      </div>

      <div className="bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden">
        <div className="p-4 border-b border-[#1687cb]/20 bg-[#111623]/30">
          <h3 className="font-bold text-white flex items-center gap-2">
            <UserIcon size={20} className="text-[#20bbe3]" />
            Usuários Cadastrados
          </h3>
        </div>
        
        <div className="divide-y divide-[#1687cb]/10">
          {users.map(user => (
            <div key={user.id} className="p-4 flex items-center justify-between hover:bg-[#111623]/30 transition-colors">
              <div className="flex items-center gap-4">
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-[#1687cb]/30" />
                <div>
                  <p className="text-white font-bold flex items-center gap-2">
                    {user.name}
                    {user.id === currentUser.id && <span className="text-[10px] bg-[#20bbe3]/20 text-[#20bbe3] px-2 py-0.5 rounded-full">Você</span>}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Mail size={12} /> {user.email}</span>
                    <span className="flex items-center gap-1"><Shield size={12} /> {user.role}</span>
                  </div>
                </div>
              </div>
              
              {currentUser.role === 'Admin' && user.id !== currentUser.id && (
                <button 
                  onClick={() => handleDeleteUser(user.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remover Usuário"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Novo Usuário"
        onSave={handleSaveUser}
      >
        <FormInput label="Nome Completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Ex: Ana Souza" autoFocus />
        <FormInput label="Email de Acesso" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@empresa.com" />
        <FormInput label="Senha Temporária" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="******" />
        <FormSelect label="Nível de Permissão" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
          <option value="Viewer">Viewer (Apenas Visualizar)</option>
          <option value="Manager">Manager (Editar Projetos/Custos)</option>
          <option value="Admin">Admin (Acesso Total)</option>
        </FormSelect>
      </Modal>
    </div>
  );
};

export default Settings;
