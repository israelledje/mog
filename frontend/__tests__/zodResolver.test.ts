import { z } from 'zod';
import { zodResolver } from '../src/utils/zodResolver';

const schema = z.object({
  email: z.string().email('email invalide'),
  password: z.string().min(6, '6 min'),
});

describe('zodResolver', () => {
  it('renvoie les valeurs sans erreur quand tout est valide', async () => {
    const resolver = zodResolver(schema);
    const result = await resolver({ email: 'a@b.com', password: '123456' } as any, undefined as any, {} as any);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ email: 'a@b.com', password: '123456' });
  });

  it('mappe les erreurs zod par champ', async () => {
    const resolver = zodResolver(schema);
    const result: any = await resolver({ email: 'nope', password: '12' } as any, undefined as any, {} as any);
    expect(result.errors.email.message).toBe('email invalide');
    expect(result.errors.password.message).toBe('6 min');
  });

  it('ne garde que la première erreur par champ', async () => {
    const resolver = zodResolver(z.object({ v: z.string().min(3, 'trop court') }));
    const result: any = await resolver({ v: 'a' } as any, undefined as any, {} as any);
    expect(result.errors.v.message).toBe('trop court');
  });
});
