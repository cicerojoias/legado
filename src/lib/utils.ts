import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getContactInitials(name: string | null | undefined, phone: string): string {
  // 1. Limpa o nome removendo tudo que não for letra, número ou espaço (substitui por espaço)
  const cleanName = (name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (cleanName.length > 0) {
    const parts = cleanName.split(' ');
    if (parts.length === 1) {
      // Apenas um nome: pega as duas primeiras letras se houver
      return parts[0].slice(0, 2).toUpperCase();
    } else {
      // Dois ou mais nomes: pega a primeira letra do primeiro e a do segundo nome
      const first = parts[0]?.[0] || '';
      const second = parts[1]?.[0] || '';
      return (first + second).toUpperCase();
    }
  }

  // 2. Fallback para o telefone se o nome for inválido ou vazio
  let phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.startsWith('55') && phoneDigits.length > 10) {
    phoneDigits = phoneDigits.substring(2);
  }
  
  if (phoneDigits.length > 0) {
    return phoneDigits.slice(0, 2);
  }

  return 'WA';
}
