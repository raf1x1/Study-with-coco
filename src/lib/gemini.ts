import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getAI = () => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

export const MODELS = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
};

export async function generateFlashcards(content: string, count: number, focus?: string) {
  const ai = getAI();
  const prompt = `Create exactly ${count} high-quality study flashcards from the material below.${focus ? ` Focus on: ${focus}.` : ""}
Return ONLY a valid JSON array with no other text, preamble, or backticks:
[{"front":"Clear question here","back":"Concise answer here"}]
Make varied questions covering key concepts. Answers should be complete but brief.

STUDY MATERIAL:
${content}`;

  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING },
          },
          required: ["front", "back"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

export async function generateQuiz(content: string, count: number, focus?: string) {
  const ai = getAI();
  const prompt = `Create exactly ${count} multiple-choice questions from the provided material.${focus ? ` Focus on: ${focus}.` : ""}
Each must have exactly 4 answer options with one correct answer.
Return ONLY a valid JSON array with no other text, preamble, or backticks:
[{"question":"Question text?","options":["A","B","C","D"],"correct":0,"explanation":"Brief reason why A is correct"}]
"correct" is the 0-based index of the right answer.

STUDY MATERIAL:
${content}`;

  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
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
            correct: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
          },
          required: ["question", "options", "correct", "explanation"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

export async function getAIHint(front: string, back: string) {
  const ai = getAI();
  const prompt = `Give a short, fun memory hint or mnemonic for this flashcard. Max 2 sentences.
Question: ${front}
Answer: ${back}
Just the hint, nothing else.`;

  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
  });

  return response.text;
}
