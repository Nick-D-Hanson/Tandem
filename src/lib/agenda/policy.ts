export function canReadAgenda(input: { viewerUserId: string; ownerUserId: string; sameWorkspace: boolean; isShared: boolean }) {
  return input.sameWorkspace && (input.viewerUserId === input.ownerUserId || input.isShared);
}

export function assertAgendaOwner(viewerUserId: string, ownerUserId: string) {
  if (viewerUserId !== ownerUserId) throw new Error("NOT_FOUND");
}

export function assertAgendaReadAccess(input: { viewerUserId: string; ownerUserId: string; sameWorkspace: boolean; isShared: boolean }) {
  if (!canReadAgenda(input)) throw new Error("NOT_FOUND");
}
