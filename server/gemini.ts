import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export function getGeminiAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

export interface GenerateOptions {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}

// Resilient model caller: tries primary model first, falls back on high-demand 503/429
export async function generateContentWithFallback(options: GenerateOptions): Promise<string> {
  const ai = getGeminiAI();
  const models = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

  let lastError: any = null;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: options.responseMimeType,
          temperature: options.temperature ?? 0.2,
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Fallback] Model ${model} encountered issue (${err?.status || err?.message}). Trying next model...`);
    }
  }

  throw lastError || new Error("All Gemini models temporarily unavailable");
}

