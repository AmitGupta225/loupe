import type { AnalyzeRequest, AnalyzeResponse, HealthResponse } from "../types/contract";

// Use direct backend URL in dev to avoid Vite proxy buffering SSE streams.
// In production, VITE_API_URL is set or fallback to relative /api/v1.
const API_BASE = (() => {
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "http://localhost:8000/api/v1";
  }
  if (typeof window !== "undefined" && window.location.port === "5174") {
    return "http://localhost:8000/api/v1";
  }
  return "/api/v1";
})();

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as { detail?: string; message?: string };
      detail = json.detail ?? json.message ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse<HealthResponse>(res);
}

export async function analyzeContract(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AnalyzeResponse>(res);
}

export async function analyzeUpload(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/analyze/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<AnalyzeResponse>(res);
}

export async function analyzeUploadMultiple(files: File[]): Promise<AnalyzeResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(`${API_BASE}/analyze/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<AnalyzeResponse>(res);
}

export interface StreamProgress {
  node: string;
  status: string;
  progress: number;
  label: string;
  current_file?: string;
  current_file_index?: number;
  total_files?: number;
}

export async function analyzeContractStream(payload: AnalyzeRequest, onProgress: (p: StreamProgress) => void): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    let detail = txt;
    try {
      const j = JSON.parse(txt) as { detail?: string; message?: string };
      detail = j.detail ?? j.message ?? txt;
    } catch {}
    throw new Error(detail);
  }
  return readSseStream(res, onProgress);
}

export async function analyzeUploadStream(files: File[], onProgress: (p: StreamProgress) => void): Promise<AnalyzeResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(`${API_BASE}/analyze/upload/stream`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const txt = await res.text();
    let detail = txt;
    try {
      const j = JSON.parse(txt) as { detail?: string; message?: string };
      detail = j.detail ?? j.message ?? txt;
    } catch {}
    throw new Error(detail);
  }
  return readSseStream(res, onProgress);
}

async function readSseStream(res: Response, onProgress: (p: StreamProgress) => void): Promise<AnalyzeResponse> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  let final: AnalyzeResponse | null = null;
  const processEventBlock = (block: string) => {
    const lines = block.split("\n");
    let event = "";
    let data = "";
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      const trimmed = line.trim();
      if (!trimmed) {
        if (event && data) {
          if (event === "progress") {
            try {
              const p = JSON.parse(data) as StreamProgress;
              onProgress(p);
            } catch {}
          } else if (event === "complete") {
            try {
              final = JSON.parse(data) as AnalyzeResponse;
            } catch {}
          } else if (event === "error") {
            try {
              const j = JSON.parse(data) as { message?: string };
              throw new Error(j.message || data);
            } catch (e) {
              if (e instanceof Error) throw e;
            }
          }
          event = "";
          data = "";
        }
        continue;
      }
      if (trimmed.startsWith(":")) continue;
      if (trimmed.startsWith("event:")) event = trimmed.slice(6).trim();
      else if (trimmed.startsWith("data:")) data = trimmed.slice(5).trim();
    }
    if (event && data) {
      if (event === "progress") {
        try {
          const p = JSON.parse(data) as StreamProgress;
          onProgress(p);
        } catch {}
      } else if (event === "complete") {
        try {
          final = JSON.parse(data) as AnalyzeResponse;
        } catch {}
      } else if (event === "error") {
        try {
          const j = JSON.parse(data) as { message?: string };
          throw new Error(j.message || data);
        } catch (e) {
          if (e instanceof Error) throw e;
        }
      }
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk.replace(/\r\n/g, "\n");
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      processEventBlock(part + "\n\n");
    }
  }
  if (buffer.trim()) processEventBlock(buffer + "\n\n");
  if (!final) throw new Error("Stream ended without complete event");
  return final;
}

export interface AnalyzeUrlRequest {
  url: string;
  document_id?: string;
}

export async function analyzeUrl(payload: AnalyzeUrlRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AnalyzeResponse>(res);
}

export async function analyzeUrlStream(payload: AnalyzeUrlRequest, onProgress: (p: StreamProgress) => void): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze/url/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    let detail = txt;
    try {
      const j = JSON.parse(txt) as { detail?: string; message?: string };
      detail = j.detail ?? j.message ?? txt;
    } catch {}
    throw new Error(detail);
  }
  return readSseStream(res, onProgress);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  document_id?: string;
  raw_text?: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  answer: string;
  citations: string[];
}

export async function sendChat(payload: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<ChatResponse>(res);
}
