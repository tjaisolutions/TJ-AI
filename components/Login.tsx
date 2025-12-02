
import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, ArrowRight } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simplified login check to allow 'joao' or email
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Credenciais inválidas. Tente login: joao / senha: 123');
    }
  };

  return (
    <div className="min-h-screen bg-[#111623] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e2e41] rounded-2xl border border-[#1687cb]/20 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8 text-center bg-gradient-to-b from-[#1687cb]/10 to-transparent flex flex-col items-center">
          
          {/* TJ AI Solutions Logo Image */}
          <div className="w-24 h-24 rounded-2xl border border-[#20bbe3]/30 overflow-hidden shadow-2xl shadow-[#20bbe3]/20 mb-6 relative group">
              <img src="https://i.ibb.co/Dg7jc52z/LOGO-TJ.jpg" alt="TJ AI Solutions" className="w-full h-full object-cover" />
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">TJ AI <span className="text-[#20bbe3]">SOLUTIONS</span></h1>
          <p className="text-slate-400 text-sm mt-2">Sistema de Gestão Integrada</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 pt-0">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Login</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#20bbe3] outline-none transition-colors"
                placeholder="Ex: joao"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#20bbe3] outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded border border-red-500/20">{error}</p>}

          <button 
            type="submit"
            className="w-full bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] font-bold py-3 rounded-lg transition-all shadow-lg shadow-[#20bbe3]/20 hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            Entrar no Sistema
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="p-4 bg-[#111623]/50 text-center text-xs text-slate-500 border-t border-[#1687cb]/10">
          TJ AI SOLUTIONS v2.0 • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

export default Login;
