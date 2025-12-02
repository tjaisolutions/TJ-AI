
import { ProjectPhase, LeadStage, Client, Project, Budget, Cost, CRMLead, Meeting, RecurringPlan, Receivable, User } from './types';

export const COLORS = {
  bgDark: '#111623',
  bgCard: '#1e2e41',
  primary: '#20bbe3',
  secondary: '#1687cb',
  text: '#e2e8f0',
  muted: '#94a3b8'
};

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'João Admin',
    email: 'joao', // Used as login identifier
    password: '123', 
    role: 'Admin',
    avatar: 'https://ui-avatars.com/api/?name=Joao&background=20bbe3&color=fff'
  }
];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_PROJECTS: Project[] = [];

export const MOCK_BUDGETS: Budget[] = [];

export const MOCK_RECURRING_PLANS: RecurringPlan[] = [];

export const MOCK_COSTS: Cost[] = [];

export const MOCK_RECEIVABLES: Receivable[] = [];

export const MOCK_LEADS: CRMLead[] = [];

export const MOCK_MEETINGS: Meeting[] = [];
