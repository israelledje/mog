import type { Resolver, FieldValues } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Résolveur react-hook-form basé sur un schéma zod, sans dépendance externe
 * (@hookform/resolvers n'est pas installé). Mappe les erreurs zod vers le
 * format attendu par react-hook-form pour l'affichage inline par champ.
 */
export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as T, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      // On garde la première erreur rencontrée par champ.
      if (!errors[path]) {
        errors[path] = { type: String(issue.code), message: issue.message };
      }
    }

    return { values: {}, errors: errors as any };
  };
}
