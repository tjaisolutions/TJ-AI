
import { GoogleGenAI } from "@google/genai";
import { Prospect } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateInsight = async (prompt: string, contextData: string): Promise<string> => {
  if (!apiKey) {
    return "API Key não configurada. Configure process.env.API_KEY para usar a IA.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Você é um assistente especialista em gestão de projetos e CRM para uma empresa de software.
      Responda de forma concisa e profissional em Português.
      
      Contexto dos dados:
      ${contextData}

      Pergunta do usuário:
      ${prompt}`,
    });

    return response.text || "Não foi possível gerar uma resposta.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com a IA. Tente novamente mais tarde.";
  }
};

export const analyzeMeeting = async (transcriptText: string): Promise<{ summary: string; actionPlan: string }> => {
  if (!apiKey) {
    return { 
      summary: "API Key não configurada.", 
      actionPlan: "Não foi possível gerar o plano." 
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analise a seguinte transcrição de uma reunião de negócios e gere dois outputs distintos.
      
      TRANSCRIÇÃO:
      ${transcriptText}
      
      OUTPUT 1: Um resumo executivo curto (máximo 3 linhas).
      OUTPUT 2: Um plano de ação estruturado com "Pontos Discutidos", "Decisões Tomadas" e "Próximos Passos". Use formatação Markdown.
      
      Retorne no formato JSON: { "summary": "...", "actionPlan": "..." }`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    // Safety check for empty response
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error (Meeting Analysis):", error);
    return {
      summary: "Erro ao processar resumo.",
      actionPlan: "Não foi possível gerar o plano de ação devido a um erro na IA."
    };
  }
};

export const findProspects = async (niche: string, region: string, excludeNames: string[] = []): Promise<Prospect[]> => {
  if (!apiKey) {
    console.error("API Key missing");
    return [];
  }

  try {
    // Monta texto de exclusão para evitar repetidos na paginação
    const exclusionText = excludeNames.length > 0
        ? `IMPORTANTE: NÃO inclua na lista as seguintes empresas que já foram encontradas: ${excludeNames.join(', ')}.`
        : "";

    // Reduzindo o escopo para evitar timeout (Erro 500) da API
    // Solicitando ~10 resultados para garantir estabilidade da resposta
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Atue como um SDR experiente. Encontre 10 NOVAS empresas do nicho "${niche}" em "${region}" utilizando o Google Search.
      
      ${exclusionText}
      
      Para cada empresa, extraia os dados de contato disponíveis publicamente.
      Priorize empresas com site, telefone ou WhatsApp listado.
      Tente variar os resultados, buscando além da primeira página se necessário.

      Retorne os dados ESTRITAMENTE em formato JSON (array de objetos), sem markdown.
      Formato do Objeto:
      {
        "name": "Nome da Empresa",
        "company": "Nome da Empresa",
        "email": "email ou 'Não disponível'",
        "phone": "telefone ou 'Não disponível'",
        "whatsapp": "celular/zap ou 'Não disponível'", 
        "website": "url ou 'Não disponível'",
        "description": "breve descrição"
      }
      `,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text || "[]";
    
    // Limpeza para garantir JSON válido caso venha com markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback: Tentar parsear o texto inteiro se não achou array explicito
    if (text.startsWith('[') && text.endsWith(']')) {
        return JSON.parse(text);
    }

    console.warn("Gemini response format issue:", text);
    return [];

  } catch (error) {
    console.error("Gemini API Error (Prospecting):", error);
    return [];
  }
};
