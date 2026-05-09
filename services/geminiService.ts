
import { GoogleGenAI } from "@google/genai";

// Always use const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getTacticalBriefing = async (activeAirfields: string[]) => {
  try {
    const prompt = activeAirfields.length > 0 
      ? `Наразі зафіксовано пуски з таких аеродромів: ${activeAirfields.join(", ")}. Сформуй коротку тактичну пораду (до 3 речень) для цивільного населення України щодо безпеки під час загрози БПЛА "Шахед". Використовуй професійний, але спокійний тон.`
      : `Наразі активних пусків не зафіксовано. Напиши коротку пораду (1-2 речення) щодо готовності та перевірки найближчих укриттів.`;

    // Must use ai.models.generateContent to query GenAI with both the model name and prompt.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    // Directly access the .text property from the response object.
    return response.text;
  } catch (error) {
    console.error("Gemini Briefing Error:", error);
    return "Стежте за офіційними повідомленнями Повітряних Сил. Не ігноруйте сигнали повітряної тривоги.";
  }
};

export const getHistoricalAnalysis = async () => {
  try {
    const prompt = `Проаналізуй тенденцію атак БПЛА "Шахед" на основі загальної статистики: близько 400-600 пусків на місяць, основні напрямки - Приморсько-Ахтарськ та Курськ. Напиши короткий аналітичний висновок (до 3 речень) про те, як змінюється тактика ворога (використання нових маршрутів або зміна часу атак).`;
    
    // Must use ai.models.generateContent to query GenAI with both the model name and prompt.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    // Directly access the .text property from the response object.
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Аналіз недоступний. Спостерігається стабільно висока інтенсивність запусків у нічний час.";
  }
};
