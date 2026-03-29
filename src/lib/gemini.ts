import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getAI = () => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

export const MODELS = {
  flash: "gemini-3-flash-preview",
  lite: "gemini-3.1-flash-lite-preview",
  pro: "gemini-3.1-pro-preview",
};

export async function generateFlashcards(content: string, count: number, focus?: string) {
  const ai = getAI();
  const prompt = `Generate exactly ${count} high-quality study flashcards from the provided material.${focus ? ` Focus on: ${focus}.` : ""}
Make sure to cover different aspects of the content. Each flashcard should have a clear question on the "front" and a concise, accurate answer on the "back".

STUDY MATERIAL:
${content}`;

  const response = await ai.models.generateContent({
    model: MODELS.lite,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      systemInstruction: `You are an expert educator. Your task is to create exactly ${count} flashcards in JSON format. Do not return fewer than ${count} items.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING, description: "The question or term to study" },
            back: { type: Type.STRING, description: "The answer or definition" },
          },
          required: ["front", "back"],
        },
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : [result];
  } catch (e) {
    console.error("Failed to parse flashcards:", e);
    return [];
  }
}

export async function generateQuiz(content: string, count: number, focus?: string) {
  const ai = getAI();
  const prompt = `Generate exactly ${count} multiple-choice quiz questions from the provided material.${focus ? ` Focus on: ${focus}.` : ""}
Each question must have exactly 4 options and one clear correct answer.

STUDY MATERIAL:
${content}`;

  const response = await ai.models.generateContent({
    model: MODELS.lite,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      systemInstruction: `You are an expert educator. Your task is to create exactly ${count} multiple-choice questions in JSON format. Each question must have exactly 4 options. Do not return fewer than ${count} items.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correct: { type: Type.INTEGER, description: "0-based index of the correct option" },
            explanation: { type: Type.STRING, description: "Why the answer is correct" },
          },
          required: ["question", "options", "correct", "explanation"],
        },
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : [result];
  } catch (e) {
    console.error("Failed to parse quiz:", e);
    return [];
  }
}

export async function getAIHint(front: string, back: string) {
  const ai = getAI();
  const prompt = `Give a short, fun memory hint or mnemonic for this flashcard. Max 2 sentences.
Question: ${front}
Answer: ${back}
Just the hint, nothing else.`;

  const response = await ai.models.generateContent({
    model: MODELS.lite,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
    }
  });

  return response.text;
}
