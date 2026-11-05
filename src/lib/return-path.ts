/** Keeps post-login navigation inside the app. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.startsWith('/login') || value.startsWith('/accept-invitation')) return '/';
  if (value.includes('://') || value.includes('\\')) return '/';
  return value;
}
