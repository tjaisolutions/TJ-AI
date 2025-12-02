import { Project, Client, Budget, Cost, CRMLead, Meeting, RecordedMeeting, Receivable, User } from '../types';
import { MOCK_PROJECTS, MOCK_CLIENTS, MOCK_BUDGETS, MOCK_COSTS, MOCK_LEADS, MOCK_MEETINGS, MOCK_RECEIVABLES, MOCK_USERS } from '../constants';

// --- CONFIGURAÇÃO DA NUVEM ---
// Evita o uso de import.meta.env.PROD que pode causar erro em alguns ambientes.
// A estratégia agora é tentar usar a API sempre. Se falhar (erro de rede ou 404), o sistema faz fallback silencioso para o localStorage.
const USE_CLOUD = true; 

// Simula delay de rede para teste local quando usando mock/localstorage
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função genérica para carregar dados
async function loadData<T>(key: string, mockData: T): Promise<T> {
    // Tenta carregar do localStorage primeiro para exibição imediata (cache-first) ou fallback
    const localData = localStorage.getItem(`tj_ai_${key}`);
    const parsedLocalData = localData ? JSON.parse(localData) : null;

    if (USE_CLOUD) {
        try {
            // Tenta buscar do backend relativo (/api/projects, etc)
            const response = await fetch(`/api/${key}`);
            
            // Verifica se a resposta é válida e é JSON. 
            // Se o backend não estiver rodando (dev mode frontend only), isso vai falhar ou retornar HTML (404 page).
            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                 throw new Error(`API Indisponível ou Erro ${response.status}`);
            }
            
            const data = await response.json();
            
            // Se o backend retornar dados válidos, usamos eles.
            // Se retornar vazio (primeira vez no banco), e tivermos dados locais, podemos decidir mesclar ou usar o vazio.
            // Aqui, priorizamos a nuvem. Se a nuvem retornar vazio (null ou array vazio), assumimos que é uma conta nova ou limpa.
            if (data === null) {
                return parsedLocalData || mockData;
            }
            
            return data;
        } catch (error) {
            console.warn(`[DataService] Falha ao conectar na API (/api/${key}). Usando dados locais.`, error);
            // Se a API falhar, retornamos o que tem no local ou o mock
            return parsedLocalData || mockData;
        }
    } else {
        // Modo Apenas Local (Desenvolvimento explícito sem API)
        await delay(50); 
        return parsedLocalData || mockData;
    }
}

// Função genérica para salvar dados
async function saveData<T>(key: string, data: T): Promise<void> {
    // 1. Sempre salvamos no localStorage para garantir redundância e funcionamento offline/imediato
    localStorage.setItem(`tj_ai_${key}`, JSON.stringify(data));

    // 2. Se a nuvem estiver habilitada, tentamos enviar para a API
    if (USE_CLOUD) {
        try {
            const response = await fetch(`/api/${key}`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                 // Apenas loga o erro, não quebra a aplicação pois já salvou no local
                 console.warn(`[DataService] Erro ao salvar na nuvem: ${response.statusText}`);
            }
        } catch (error) {
            // Silencioso, pois já salvamos no localStorage
            console.warn(`[DataService] Não foi possível sincronizar ${key} com a nuvem (API offline).`);
        }
    }
}

export const dataService = {
    // Flag para UI saber se deve mostrar indicador de nuvem.
    // Como agora é dinâmico (tenta nuvem, falha para local), deixamos true para indicar a intenção.
    isCloudEnabled: true, 
    
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
