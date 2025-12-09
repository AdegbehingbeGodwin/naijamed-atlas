// Type declaration file to resolve import issues

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_AI_PROVIDER?: string;
  readonly VITE_GROQ_MODEL?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}