export type PlannerRpcSuccess<T> = {
  ok: true;
  idempotent?: boolean;
  unchanged?: boolean;
} & T;

export type PlannerRpcFailure = {
  ok: false;
  code: "invalid_state" | "not_found" | "stale";
  message?: string;
  current_revision?: number;
};

export type PlannerRpcResult<T> =
  | PlannerRpcSuccess<T>
  | PlannerRpcFailure;

export function isPlannerRpcFailure<T>(
  result: PlannerRpcResult<T>,
): result is PlannerRpcFailure {
  return !result.ok;
}
