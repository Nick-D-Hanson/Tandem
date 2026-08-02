export function absoluteInviteUrl(invitePath: string, origin: string) {
  return new URL(invitePath, origin).toString();
}
