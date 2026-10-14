import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui class-merge helper (Tailwind v4 aware). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
