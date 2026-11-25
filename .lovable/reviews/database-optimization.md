# Database optimization assessment

## Recorded runtime baseline

Recording window: November 12, 2026, 00:00 UTC through November 25, 2026, 22:56 UTC. Current day is partial; recording can lag activity.

| Runtime item | Recorded quantity | Requested credits |
| --- | ---: | ---: |
| Database compute (pico) | 45.18 instance-hours | 1.748899732 |
| Hosted worker days | 30 worker-days | 0.150000000 |
| Hosted worker requests | 140 requests | 0.000105000 |
| Realtime | 4,931 messages | 0.030818750 |
| Network transfer | 0.012579388 GB | 0.002830370 |
| **Runtime total** | | **1.932653852** |

Build usage requested another 1.2 credits and is separate from runtime. Database storage quantities were not returned; they are unknown. Current pico compute quote: 0.0387096 credits per instance-hour before allowances. This quote is not a measured savings amount.

## Inspected load

- Orders: 74,681 rows, comprising 23,533 pending and 51,148 collected. Table plus indexes approximately 40.7 MiB; this is not allocated billed disk capacity.
- Largest cumulative statement: all-order reads ordered by creation time and order number with OFFSET pagination, 322,283 calls, mean 157.46 ms, total elapsed query time 50,747,194.52 ms. An index on that ordering already exists.
- Pending cursor reads: 844 calls, mean 252.03 ms, max 7,459.97 ms. Existing indexes include order-number primary key and a separate collection-status index, but no combined status/order-number index.
- Cumulative statistics' reset time and representative resource load were not established; these call counts cannot be attributed exclusively to the credit recording window. Elapsed SQL time is not CPU time.
- No HTTP schedules returned. Source uses five-minute foreground refreshes and lightweight cross-client broadcast notices; refresh frequency remains unchanged.
- The current pending-order fetch already uses sequential cursor pagination. Historical OFFSET statements do not prove that this current fetch still uses OFFSET. Backup generation and restoration still use offset pages in `src/lib/importacao.ts`.
- History and backup tables were empty during inspection. No deletion or retention changes are justified by this snapshot.

## Prioritized next work

1. Benchmark pending first and late cursor pages, then evaluate a combined `(status_coleta, numero_pedido)` index. Verify the planner uses it and compare the same page workload before and after. This could avoid filtering collected rows while scanning pending pages; it adds index storage and write maintenance. Do not create speculative indexes before the plan can be measured.
2. Trace the high-volume historical all-order caller and replace offset traversal with deterministic cursor pagination where full snapshots are required. Validate full snapshot/restore correctness and counts. Do not silently truncate backups or remove recovery functionality.
3. Measure foreground refresh frequency and active instance-hours over a representative window. Keep existing freshness guarantees until the user chooses otherwise. Faster SQL alone does not reduce the hourly compute rate. Sustained memory/connection metrics are unavailable, so no resize recommendation is supported.

## Blocking infrastructure issue

Initial reads succeeded, but subsequent query-plan probes timed out and the database connection pooler became unavailable. Cloud diagnostics report the hosted backend healthy in its control plane but unreachable in its database/API plane, with auth still reachable. No recent exhaustion alerts were returned; current CPU, memory, connections, and disk metrics are unavailable.

No index migration, application behavior change, data deletion, pause, or resize was applied. The user approved a restart, which was requested November 25 at approximately 23:02 UTC. Five subsequent readiness checks through 23:07 UTC still reported the backend starting; no database probes or writes were issued during this state. All seven existing pagination and collection-rule tests passed. Measurements and fixes remain blocked by backend recovery. Resume the same bounded query-plan probes only after readiness is confirmed, implement confirmed improvements, then test and verify the live authenticated collection flow. Recorded credit reductions require a comparable later usage window after billing ingestion.

Workflow used: database-optimization.