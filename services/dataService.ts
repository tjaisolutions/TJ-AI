import { Project, Client, Budget, Cost, CRMLead, Meeting, RecordedMeeting, Receivable, User } from '../types';
import { MOCK_PROJECTS, MOCK_CLIENTS, MOCK_BUDGETS, MOCK_COSTS, MOCK_LEADS, MOCK_MEETINGS, MOCK_RECEIVABLES, MOCK_USERS } from '../constants';

// --- CONFIGURAÇÃO DA NUVEM ---
// Em produção (quando hospedado), usamos endpoints relativos '/api/...'
// Em desenvolvimento local, usamos localStorage a menos que configuemos o proxy
const IS_PROD = import.meta.env.PROD; 
const USE_CLOUD = IS_PROD; // Auto-detect: se for build de produção, tenta usar a API

// Simula delay de rede para teste local
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função genérica para carregar dados
async function loadData<T>(key: string, mockData: T): Promise<T> {
    if (USE_CLOUD) {
        try {
            // Tenta buscar do backend relativo (/api/projects, etc)
            const response = await fetch(`/api/${key}`);
            
            if (!response.ok) {
                // Se der 404 ou erro (ex: backend não configurado), cai no catch
                throw new Error(`API Error: ${response.statusText}`);
            }
            
            const data = await response.json();
            // Se o backend retornar null ou vazio (primeira vez), usa mock/local
            if (!data || (Array.isArray(data) && data.length === 0)) {
                // Opcional: retornar mockData na primeira vez para não começar zerado
                // return mockData; 
                return [] as any; 
            }
            return data;
        } catch (error) {
            console.warn(`[DataService] Falha ao carregar ${key} da nuvem. Usando cache local.`, error);
            const saved = localStorage.getItem(`tj_ai_${key}`);
            return saved ? JSON.parse(saved) : mockData;
        }
    } else {
        // Modo LocalStorage (Desenvolvimento)
        await delay(100); 
        const saved = localStorage.getItem(`tj_ai_${key}`);
        return saved ? JSON.parse(saved) : mockData;
    }
}

// Função genérica para salvar dados
async function saveData<T>(key: string, data: T): Promise<void> {
    if (USE_CLOUD) {
        try {
            await fetch(`/api/${key}`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error(`[DataService] Erro ao salvar ${key} na nuvem:`, error);
            // Fallback: salva no local para não perder trabalho se a net cair
            localStorage.setItem(`tj_ai_${key}`, JSON.stringify(data));
        }
    } else {
        // Modo LocalStorage
        localStorage.setItem(`tj_ai_${key}`, JSON.stringify(data));
    }
}

export const dataService = {
    isCloudEnabled: USE_CLOUD,
    users: {
        get: () => loadData<User[]>('users', MOCK_USERS),
        save: (data: User[]) => saveData('users', data)
    },
    clients: {
        get: () => loadData<Client[]>('clients', MOCK_CLIENTS),
        save: (data: Client[]) => saveData('clients', data)
    },
    projects: {
        get: () => loadData<Project[]>('projects', MOCK_PROJECTS),
        save: (data: Project[]) => saveData('projects', data)
    },
    budgets: {
        get: () => loadData<Budget[]>('budgets', MOCK_BUDGETS),
        save: (data: Budget[]) => saveData('budgets', data)
    },
    costs: {
        get: () => loadData<Cost[]>('costs', MOCK_COSTS),
        save: (data: Cost[]) => saveData('costs', data)
    },
    leads: {
        get: () => loadData<CRMLead[]>('leads', MOCK_LEADS),
        save: (data: CRMLead[]) => saveData('leads', data)
    },
    meetings: {
        get: () => loadData<Meeting[]>('meetings', MOCK_MEETINGS),
        save: (data: Meeting[]) => saveData('meetings', data)
    },
    recordedMeetings: {
        get: () => loadData<RecordedMeeting[]>('recorded_meetings', []),
        save: (data: RecordedMeeting[]) => saveData('recorded_meetings', data)
    },
    receivables: {
        get: () => loadData<Receivable[]>('receivables', MOCK_RECEIVABLES),
        save: (data: Receivable[]) => saveData('receivables', data)
    }
};
