// src/types/vercel.ts - Tipos específicos para Vercel

export interface VercelRequest {
  method: string;
  body: any;
  query: { [key: string]: string | string[] };
  headers: { [key: string]: string };
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  send: (data: string) => void;
  end: () => void;
}