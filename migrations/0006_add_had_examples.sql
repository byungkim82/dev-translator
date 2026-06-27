-- P16 Phase 2: mark translations produced WITH opt-in TM few-shot examples so the
-- W9 exact-match cache never returns an example-influenced translation to a plain
-- request (and vice versa). Plain lookups filter had_examples = 0; example
-- requests skip the cache (force-fresh) and store had_examples = 1. Existing rows
-- default to 0 (plain), which is correct.
ALTER TABLE translations ADD COLUMN had_examples INTEGER NOT NULL DEFAULT 0;
