
export enum ProjectPhase {
  PROTOTYPE = 'Criação do Protótipo',
  REVIEW = 'Revisão',
  TESTING = 'Testes',
  DELIVERY = 'Entrega'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In real app, never store plain text
  role: 'Admin' | 'Manager' | 'Viewer';
  avatar?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  cnpj: string; 
  contractDetails: string; 
  avatar: string;
  status: 'Active' | 'Inactive';
  createdBy?: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  deadline: string; 
  budget: number;
  phase: ProjectPhase;
  progress: number; 
  description: string;
  phaseDeadlines: {
    [key in ProjectPhase]: string; 
  };
  phaseDetails: {
    [key in ProjectPhase]: {
        done: string;
        todo: string;
    };
  };
  statusReport?: {
    done: string;
    todo: string;
  };
  createdBy?: string;
  createdAt?: string;
  lastUpdatedBy?: string;
}

export interface PaymentRecord {
  month: number;
  year: number;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  paidDate?: string;
  updatedBy?: string;
}

export interface RecurringPlan {
  id: string;
  title: string;
  clientId: string;
  value: number;
  frequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
  nextBillingDate: string;
  status: 'Active' | 'Paused' | 'Cancelled';
  servicesIncluded: string[];
  paymentHistory: PaymentRecord[];
  createdBy?: string;
}

export interface Budget {
  id: string;
  title: string;
  clientId: string;
  amount: number;
  date: string;
  contractDuration: string; 
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  items: { description: string; cost: number }[];
  createdBy?: string;
}

export interface Cost {
  id: string;
  description: string;
  category: 'Software' | 'Personnel' | 'Marketing' | 'Office' | 'Infrastructure';
  type: 'Fixed' | 'Project';
  projectName?: string; 
  amount: number;
  date: string;
  createdBy?: string;
}

export interface Receivable {
  id: string;
  description: string;
  clientId: string;
  value: number;
  dueDate: string;
  receivedDate?: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  category: 'Projeto' | 'Mensalidade' | 'Consultoria' | 'Outros';
  createdBy?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; 
  time: string; 
  clientId?: string;
  projectId?: string;
  type: 'Online' | 'Presencial';
  linkOrLocation?: string;
  participants: string[];
  createdBy?: string;
}

export interface TranscriptItem {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
}

export interface RecordedMeeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  participants: string[];
  fullTranscript: TranscriptItem[];
  aiSummary: string;
  aiActionPlan: string;
  createdBy?: string;
}

export enum LeadStage {
  NEW = 'Novo',
  CONTACTED = 'Contatado',
  QUALIFIED = 'Qualificado',
  PROPOSAL = 'Proposta',
  WON = 'Ganho'
}

export interface CRMLead {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: LeadStage;
  email: string;
  lastContact: string;
  createdBy?: string;
}

export type ViewState = 'DASHBOARD' | 'PROJECTS' | 'CLIENTS' | 'BUDGETS' | 'COSTS' | 'RECEIVABLES' | 'CRM' | 'AGENDA' | 'MEETING_ROOM' | 'REPORTS' | 'SETTINGS';
