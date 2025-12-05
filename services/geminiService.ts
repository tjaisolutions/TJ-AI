
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

export const findProspects = async (niche: string, region: string): Promise<Prospect[]> => {
  if (!apiKey) {
    console.error("API Key missing");
    return [];
  }

  try {
    // Nota: Usamos googleSearch tool. Com googleSearch, não podemos usar responseMimeType: 'application/json'.
    // Devemos pedir JSON no texto e fazer parse manual.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Modelo atualizado
      contents: `Atue como um especialista em prospecção B2B (SDR).
      Utilize o Google Search para encontrar empresas reais do nicho "${niche}" localizadas em "${region}".
      
      Liste pelo menos 5 a 10 empresas relevantes encontradas agora.
      Para cada empresa, extraia ou infira dos resultados:
      1. Nome da Empresa
      2. Website (URL)
      3. Telefone (se disponível publicamente)
      4. Email de contato (se disponível publicamente)
      5. WhatsApp: Tente identificar se existe um número de celular ou link de WhatsApp explícito. Se o telefone principal parecer ser celular, repita-o aqui.
      6. Uma brevíssima descrição do que fazem.

      IMPORTANTE: Retorne a resposta ESTRITAMENTE como um array JSON cru, sem formatação markdown (sem \`\`\`json).
      O formato de cada objeto deve ser:
      {
        "name": "Nome da Empresa",
        "company": "Nome da Empresa",
        "email": "email@exemplo.com ou 'Não disponível'",
        "phone": "(XX) XXXX-XXXX ou 'Não disponível'",
        "whatsapp": "(XX) 9XXXX-XXXX ou 'Não disponível'", 
        "website": "url do site ou 'Não disponível'",
        "description": "descrição curta"
      }
      `,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text || "[]";
    
    // Limpeza básica caso o modelo retorne markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Tenta encontrar o array JSON no texto
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [];

  } catch (error) {
    console.error("Gemini API Error (Prospecting):", error);
    return [];
  }
};
