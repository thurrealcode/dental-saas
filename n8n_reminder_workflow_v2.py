#!/usr/bin/env python3
"""
Atualiza o workflow "Dental SaaS - Lembretes de Consulta" para usar
appointment_reminders como fonte de verdade para deduplicação.

Mudanças:
- Adiciona nó "Reservar Lembrete" (POST appointment_reminders com ignore-duplicates)
  ANTES de Enviar WA → se já enviado, retorna [] e fluxo para automaticamente
- Remove dependência de reminder_sent=true para deduplicar (mantém como cache)
- Mantém "Marcar Lembrete Enviado" como otimização de cache
"""

import sqlite3, json
from datetime import datetime

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
WF_ID   = 'ddd29e8e-5536-4987-9f0b-05a8c401176e'

# Lê nós e conexões atuais
conn   = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
row    = cursor.execute("SELECT nodes, connections FROM workflow_entity WHERE id=?", (WF_ID,)).fetchone()
nodes  = json.loads(row[0])
conns  = json.loads(row[1])
conn.close()

# ── Novo nó: Reservar Lembrete ────────────────────────────────────
# POST com ignore-duplicates:
#   → INSERT bem-sucedido (novo): retorna a linha → fluxo continua
#   → Conflito de chave (já enviado): retorna [] → fluxo para para este appointment
reservar_node = {
  "id": "remind-node-009",
  "name": "Reservar Lembrete",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [1540, 120],
  "parameters": {
    "method": "POST",
    "url": "={{ $vars.DENTAL_SUPABASE_URL }}/rest/v1/appointment_reminders",
    "sendHeaders": True,
    "headerParameters": {
      "parameters": [
        { "name": "apikey",        "value": "={{ $vars.DENTAL_SUPABASE_KEY }}" },
        { "name": "Authorization", "value": "=Bearer {{ $vars.DENTAL_SUPABASE_KEY }}" },
        { "name": "Content-Type",  "value": "application/json" },
        # ignore-duplicates + return=representation:
        #   INSERT novo → retorna a linha (1 item) → continua
        #   Conflito UNIQUE(appointment_id, reminder_type) → retorna [] → para
        { "name": "Prefer",        "value": "resolution=ignore-duplicates,return=representation" }
      ]
    },
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ appointment_id: $json.appointment_id, reminder_type: '24h', status: 'sent' }) }}",
    "options": {}
  }
}

# Insere o novo nó na lista (após Formatar Lembrete, antes de Enviar WA)
updated_nodes = []
for n in nodes:
    updated_nodes.append(n)
    if n['name'] == 'Formatar Lembrete':
        updated_nodes.append(reservar_node)

# ── Atualiza conexões ─────────────────────────────────────────────
# Antes: Formatar → Enviar WA → Setar Sessão Bot → Marcar Lembrete
# Depois: Formatar → Reservar → Enviar WA → Setar Sessão Bot → Marcar Lembrete
updated_conns = dict(conns)
updated_conns["Formatar Lembrete"] = {
    "main": [[{"node": "Reservar Lembrete", "type": "main", "index": 0}]]
}
updated_conns["Reservar Lembrete"] = {
    "main": [[{"node": "Enviar WA", "type": "main", "index": 0}]]
}
# Demais conexões (Enviar WA → Setar → Marcar) permanecem iguais

now_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
new_ver = 'remind-v2-supabase-reminders'

nodes_json = json.dumps(updated_nodes, ensure_ascii=False)
conns_json = json.dumps(updated_conns, ensure_ascii=False)

conn   = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("""
  UPDATE workflow_entity
  SET nodes=?, connections=?, updatedAt=?, versionId=?
  WHERE id=?
""", (nodes_json, conns_json, now_str, new_ver, WF_ID))

cursor.execute("SELECT versionId FROM workflow_history WHERE workflowId=? ORDER BY createdAt DESC LIMIT 1", (WF_ID,))
hist_row = cursor.fetchone()
if hist_row:
    cursor.execute("UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?",
                   (nodes_json, conns_json, hist_row[0]))

cursor.execute("SELECT publishedVersionId FROM workflow_published_version WHERE workflowId=?", (WF_ID,))
pub_row = cursor.fetchone()
if pub_row:
    cursor.execute("UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?",
                   (nodes_json, conns_json, pub_row[0]))

conn.commit()
conn.close()

print(f"✅ Reminder workflow atualizado — versão '{new_ver}'")
print(f"   Nós: {len(updated_nodes)} (+1 Reservar Lembrete)")
print(f"   Deduplicação: appointment_reminders (UNIQUE appointment_id + reminder_type)")
print(f"   Fluxo: Formatar → Reservar → Enviar WA → Setar Bot → Marcar Enviado")
