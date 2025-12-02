
import { GoogleGenAI } from "@google/genai";

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
