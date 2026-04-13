-- Migration to add branch attendance tokens for rotating WiFi-based verification
CREATE TABLE branch_attendance_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branch_tokens_branch_id ON branch_attendance_tokens(branch_id);

-- Helper to clean old tokens periodically (optional, or just handle in logic)
ALTER TABLE branch_attendance_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_tokens" ON branch_attendance_tokens FOR ALL USING (auth.role() = 'service_role');
