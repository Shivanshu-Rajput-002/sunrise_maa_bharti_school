import * as bcrypt from 'bcrypt';

const ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);

/**
 * Compares against bcrypt hashes. Joomla stores "$2y$" hashes (PHP) —
 * same algorithm as "$2b$", so normalize the prefix to stay compatible with migrated users.
 */
export const verifyPassword = (plain: string, hash: string) =>
  bcrypt.compare(plain, hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash);
