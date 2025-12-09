declare module '@google/genai' {
    export class GoogleGenerativeAI {
        constructor(apiKey: string);
        getGenerativeModel(options: { model: string; generationConfig?: { temperature?: number; maxOutputTokens?: number } }): any;
    }
}
