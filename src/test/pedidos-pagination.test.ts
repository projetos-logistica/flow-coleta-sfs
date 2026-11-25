import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
import { fetchPedidos } from "@/hooks/use-coletas";

function page(data: { numero_pedido: string }[], error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({ data, error }),
  };
  return query;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Pending order pagination", () => {
  it("uses a fresh 30000ms timeout for each sequential 1000-row page and skips the initial cursor", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const rows = Array.from({ length: 1000 }, (_, i) => ({ numero_pedido: String(i).padStart(4, "0") }));
    const first = page(rows);
    const second = page([{ numero_pedido: "1000" }]);
    mock.from.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const result = await fetchPedidos();
    expect(result).toHaveLength(1001);
    expect(first.limit).toHaveBeenCalledWith(1000);
    expect(second.limit).toHaveBeenCalledWith(1000);
    expect(first.gt).not.toHaveBeenCalled();
    expect(second.gt).toHaveBeenCalledWith("numero_pedido", "0999");
    expect(first.eq).toHaveBeenCalledWith("status_coleta", "Pendente");
    expect(timeout.mock.calls).toEqual([[30000], [30000]]);
    expect(second.abortSignal.mock.invocationCallOrder[0]).toBeGreaterThan(first.abortSignal.mock.invocationCallOrder[0] ?? 0);
  });

  it("returns previously loaded orders after a later page exhausts network retries", async () => {
    vi.useFakeTimers();
    const rows = Array.from({ length: 1000 }, (_, i) => ({ numero_pedido: String(i) }));
    const first = page(rows);
    const failed = page([], new TypeError("Failed to fetch"));
    mock.from.mockReturnValueOnce(first).mockReturnValue(failed);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const promise = fetchPedidos();
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.map((row) => row.numero_pedido)).toEqual(rows.map((row) => row.numero_pedido));
    expect(failed.abortSignal).toHaveBeenCalledTimes(4);
  });

  it("still reports a first-page failure rather than returning a false empty result", async () => {
    const error = { message: "permission denied" };
    mock.from.mockReturnValue(page([], error));
    await expect(fetchPedidos()).rejects.toEqual(error);
  });
});