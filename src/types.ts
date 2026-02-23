import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'technician' | 'viewer';
  name: string;
}

export interface CompanySettings {
  name: string;
  cnpj: string;
  logo: string;
  technical_responsible: string;
  email: string;
  phone: string;
  default_checklist: string; // JSON stringified array
}

export interface Construction {
  id: number;
  name: string;
  photo: string;
  address: string;
  responsible: string;
  contractor: string;
  contract_number: string;
  start_date: string;
  end_date: string;
  status: 'em_andamento' | 'pausada' | 'concluida';
}

export interface ReportPhoto {
  id?: number;
  report_id?: number;
  image_data: string;
  caption: string;
  order_index: number;
}

export interface ReportChecklistItem {
  id?: number;
  report_id?: number;
  item_name: string;
  status: boolean;
  observation: string;
}

export interface Report {
  id: number;
  construction_id: number;
  construction_name?: string;
  date: string;
  technical_observations: string;
  status: 'em_preenchimento' | 'finalizado';
  created_by?: number;
  revision: number;
  photos?: ReportPhoto[];
  checklist?: ReportChecklistItem[];
}
