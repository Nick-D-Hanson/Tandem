const COOKIE_MUTATION_RESTRICTION = "Cookies can only be modified in a Server Action or Route Handler";

export function isCookieMutationRestrictionError(error: unknown) {
  return error instanceof Error && error.message.includes(COOKIE_MUTATION_RESTRICTION);
}

export async function readServerSessionData<T>(getSession: () => Promise<{ data: T }>) {
  try {
    return (await getSession()).data;
  } catch (error) {
    if (isCookieMutationRestrictionError(error)) return null;
    throw error;
  }
}
