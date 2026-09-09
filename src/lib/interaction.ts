export const COMPLETION_FEEDBACK_MS = 720;
export const COMPLETION_UNDO_MS = 5_000;
export const DIALOG_EXIT_MS = 220;

export function completionLabel(title: string, completed: boolean) {
  return completed ? `Reopen ${title}` : `Complete ${title}`;
}
