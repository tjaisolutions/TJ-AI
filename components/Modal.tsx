import React from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave: () => void;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, onSave }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e2e41] w-full max-w-lg rounded-2xl border border-[#1687cb]/30 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-[#1687cb]/20 bg-[#111623]/50">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
        <div className="p-4 border-t border-[#1687cb]/20 bg-[#111623]/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white text-sm font-medium transition-colors">Cancelar</button>
          <button onClick={onSave} className="bg-[#20bbe3] hover:bg-[#1687cb] text-[#111623] px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-[#20bbe3]/10">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export const FormInput = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">{label}</label>
    <input className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-colors" {...props} />
  </div>
);

export const FormSelect = ({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">{label}</label>
    <select className="w-full bg-[#111623] border border-[#1687cb]/30 rounded-lg px-3 py-2 text-white focus:border-[#20bbe3] outline-none transition-colors appearance-none" {...props}>
      {children}
    </select>
  </div>
);
