-- P16 Phase 1: store bge-m3 (1024-dim) edge embeddings in a new column, gated by
-- a version tag, so vectors from different models are never compared. The old
-- OpenAI `embedding` column (1536-dim) is left untouched for existing rows.
ALTER TABLE translations ADD COLUMN embedding_version TEXT;
ALTER TABLE translations ADD COLUMN embedding_v2 TEXT;
