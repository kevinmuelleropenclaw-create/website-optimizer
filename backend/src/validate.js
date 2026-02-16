import { z } from 'zod';

const urlSchema = z
  .string()
  .trim()
  .min(4)
  .refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Bitte eine gültige http/https URL angeben.');

export function validateUrl(input) {
  return urlSchema.parse(input);
}
