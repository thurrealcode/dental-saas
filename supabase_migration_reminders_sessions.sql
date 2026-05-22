-- ================================================================
-- Dental SaaS — Novas tabelas para persistência em Supabase
-- Executar no SQL Editor do projeto Supabase
-- ================================================================

-- 1. Tabela de auditoria de lembretes enviados
--    Fonte de verdade para "já foi enviado este lembrete?"
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type    TEXT        NOT NULL DEFAULT '24h',   -- '24h', '2h', etc.
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           TEXT        NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointment_reminders_unique UNIQUE (appointment_id, reminder_type)
);

-- Index para lookup por appointment
CREATE INDEX IF NOT EXISTS idx_appt_reminders_appointment_id
  ON appointment_reminders(appointment_id);

-- RLS
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_for_service_role" ON appointment_reminders
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------

-- 2. Tabela de sessões do bot (substitui $getWorkflowStaticData)
--    Persiste estado de conversa: sobrevive reinício do n8n e da VPS
CREATE TABLE IF NOT EXISTS bot_sessions (
  phone         TEXT        NOT NULL,
  instance_name TEXT        NOT NULL,
  step          TEXT        NOT NULL DEFAULT 'initial',
  data          JSONB       NOT NULL DEFAULT '{}',
  expires_at    TIMESTAMPTZ          DEFAULT (now() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (phone, instance_name)
);

-- Index para limpeza de sessões expiradas
CREATE INDEX IF NOT EXISTS idx_bot_sessions_expires_at
  ON bot_sessions(expires_at);

-- RLS
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_for_service_role" ON bot_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- Verificação
SELECT 'appointment_reminders' AS tabela, count(*) FROM appointment_reminders
UNION ALL
SELECT 'bot_sessions', count(*) FROM bot_sessions;
