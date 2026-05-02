export type AuthorizedUser = {
  name: string;
  pin: string;
};

export function getAuthorizedUsers(): AuthorizedUser[] {
  try {
    const raw = process.env.AUTHORIZED_USERS || '[]';
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (u): u is AuthorizedUser =>
        typeof u?.name === 'string' && typeof u?.pin === 'string',
    );
  } catch {
    return [];
  }
}
