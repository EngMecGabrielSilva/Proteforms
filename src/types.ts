import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  id: string; // UUID
  email: string;
  role: 'admin' | 'technician' | 'viewer';
  name: string;
}

export interface TechnicalResponsible {
  name: string;
  reg_name: string;
  reg_num: string;
  title: string;
  signature: string;
}

export interface CompanySettings {
  id?: number;
  name: string;
  cnpj: string;
  logo: string;
  technical_responsible: string;
  email: string;
  phone: string;
  default_checklist: string;
  resp1_name?: string;
  resp1_reg_name?: string;
  resp1_reg_num?: string;
  resp1_title?: string;
  resp1_signature?: string;
  resp2_name?: string;
  resp2_reg_name?: string;
  resp2_reg_num?: string;
  resp2_title?: string;
  resp2_signature?: string;
  primary_resp?: 'resp1' | 'resp2';
}

export interface ChecklistTemplate {
  id: number;
  title: string;
  items: string[]; // Array of strings
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
  image_url: string;
  caption: string;
  order_index: number;
}

export interface ReportChecklistItem {
  id?: number;
  report_id?: number;
  item_name: string;
  status: 'C' | 'NC' | 'NA' | '';
  observation: string;
}

export interface Report {
  id: number;
  construction_id: number;
  construction_name?: string;
  contract_number?: string;
  sequence_number?: number;
  inspection_date: string;
  technical_observations: string;
  status: 'em_preenchimento' | 'finalizado';
  created_by?: string; // UUID
  revision: number;
  photos?: ReportPhoto[];
  checklist?: ReportChecklistItem[];
}
