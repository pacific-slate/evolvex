# Opportunity Matrix — 2026-03-18

Ranked by `novelty x usefulness x feasibility this week`, using the shipped branch as the baseline truth.

| direction | thesis | local_gap | smallest_test | expected_upside |
| --- | --- | --- | --- | --- |
| Verified Growth Registry | Turn validated research and build runs into append-only records for signals, artifacts, claim checks, and promotions. | No shipped growth schema, promotion queue, or durable registry existed yet. | Add record types, registry persistence, and read surfaces. | Creates durable compounding across runs and a substrate for future promotion-safe capabilities. |
| Growth HUD and Promotion Queue | Add a persistent operator surface for what was learned, what is promotable, and what remains blocked. | Dashboard is visually strong but lacks cross-run growth state. | Show latest run summary, top candidate, and promotion queue. | Makes EvolveX feel like an operator console rather than a static demo. |
| Reality Contract / Claim Verifier | Treat docs and product claims as testable artifacts against the code contract. | Product story can drift ahead of shipped routes or landed branches. | Add claim checks and expose them in the registry. | Prevents narrative drift and bad promotions. |

## Recommendation

1. Ship the registry foundation first.
2. Layer the growth HUD and promotion queue immediately after.
3. Keep the truth gate active so claims do not outrun the actual product surface.
