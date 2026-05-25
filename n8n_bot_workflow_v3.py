#!/usr/bin/env python3
"""
Atualiza o bot "Dental SaaS - WhatsApp Bot" para v3.

Novas funcionalidades:
  - Captura nome completo do paciente antes do menu
  - Aviso/rodapé padrão em todas as mensagens principais
  - ATENDENTE funciona em qualquer etapa
  - MENU funciona em qualquer etapa
  - Mídia (áudio/imagem/doc) recebe mensagem explicativa
  - step 'get_name' para coletar e salvar full_name no Supabase
"""

import sqlite3, json
from datetime import datetime

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
WF_ID   = '7493d378-f9fc-4763-a146-8909e697fb3f'

# ================================================================
# EXTRAIR PAYLOAD — valida, extrai e detecta tipo de mídia
# ================================================================
CODE_EXTRAIR_PAYLOAD = r"""
const raw     = $input.first().json;
const payload = raw.body || raw;

// Mensagem de sistema (enviada pelo workflow de lembretes)
if (payload.system === true) {
  const p    = String(payload.phone       || '');
  const inst = String(payload.instanceName || '');
  if (!p || !inst) return [];
  return [{ json: { phone: p, instanceName: inst, isSystem: true, msgText: '', msgType: 'system', rawPayload: payload } }];
}

// Mensagem normal do WhatsApp
const msgData  = payload.data || {};
const key      = msgData.key  || {};
if (key.fromMe === true)                       return [];
if ((key.remoteJid || '').includes('@g.us'))   return [];
const instanceName = payload.instance || '';
const phone        = (key.remoteJid || '').split('@')[0];
if (!phone || phone.length < 8)                return [];

const msgContent = msgData.message || {};

// Detectar mídia (sem legenda = mensagem opaca ao bot)
const hasAudio    = !!(msgContent.audioMessage);
const hasSticker  = !!(msgContent.stickerMessage);
const hasDocument = !!(msgContent.documentMessage);
const hasImage    = !!(msgContent.imageMessage) && !msgContent.imageMessage.caption;
const hasVideo    = !!(msgContent.videoMessage)  && !msgContent.videoMessage.caption;
const isMedia     = hasAudio || hasSticker || hasDocument || hasImage || hasVideo;

const rawText = (
  msgContent.conversation                 ||
  msgContent.extendedTextMessage?.text    ||
  msgContent.imageMessage?.caption        ||
  msgContent.videoMessage?.caption        ||
  ''
).trim();

const msgType = isMedia ? 'media' : 'text';

return [{ json: { phone, instanceName, isSystem: false, msgText: rawText, msgType, rawPayload: payload } }];
"""

# ================================================================
# LÓGICA PRINCIPAL — máquina de estados + comandos globais
# ================================================================
CODE_LOGICA_PRINCIPAL = r"""
// ================================================================
// Dental SaaS - WhatsApp Bot v3.0 (nome completo + aviso padrão)
// ================================================================

const FOOTER = '\n\n\u{1F916} Atendimento automático.\nDigite ATENDENTE para falar com uma pessoa.\nDigite MENU para voltar ao início.\nPor enquanto, envie apenas mensagens de texto. Áudios e imagens não são processados.';

const sessionRow = $input.first().json;
let step        = sessionRow.step || 'initial';
let sessionData = { ...(sessionRow.data || {}) };

const ep = $('Extrair Payload').first().json;
const { phone, instanceName, isSystem, msgText, msgType, rawPayload } = ep;

const SURL = $vars.DENTAL_SUPABASE_URL;

function isFullName(s) {
  const parts = (s || '').trim().split(/\s+/);
  return parts.length >= 2 && parts.every(p => p.length >= 2);
}
function getSession() {
  return { phone, instanceName, step, data: sessionData };
}
function skip() {
  return [{ json: { _skip: true, phone, instanceName, _session: getSession() } }];
}
function direct(msg) {
  return [{ json: {
    _skip: false, phone, instanceName, action: 'DIRECT',
    message: msg + FOOTER, supabaseUrl: '', supabaseMethod: 'GET', supabaseBody: null,
    supabasePrefer: 'return=representation',
    _session: getSession()
  }}];
}
function sb(action, url, method, body, prefer) {
  return [{ json: {
    _skip: false, phone, instanceName, action,
    message: null, supabaseUrl: url, supabaseMethod: method || 'GET', supabaseBody: body || null,
    supabasePrefer: prefer || 'return=representation',
    _session: getSession()
  }}];
}
function menu() {
  const n = sessionData.patient_name ? `Olá, *${sessionData.patient_name}*! 👋` : 'Olá! 👋';
  const c = sessionData.company_name  ? ` à *${sessionData.company_name}*` : '';
  return `${n} Bem-vindo(a)${c}.\n\nComo posso te ajudar?\n\n1️⃣ Agendar consulta\n2️⃣ Ver meus agendamentos\n3️⃣ Cancelar agendamento\n4️⃣ Falar com atendente\n\n_Envie o número da opção_`;
}

// ── SYSTEM messages ──────────────────────────────────────────────
if (isSystem) {
  if (rawPayload.action === 'SET_AWAITING') {
    step = 'awaiting_confirmation';
    sessionData.pending_appointment_id   = String(rawPayload.appointment_id || '');
    sessionData.pending_appointment_info = String(rawPayload.info           || '');
    sessionData.patient_id               = String(rawPayload.patient_id     || '');
    sessionData.company_id               = String(rawPayload.company_id     || '');
  }
  return skip();
}

// ── MÍDIA — resposta imediata ────────────────────────────────────
if (msgType === 'media') {
  return direct('Por enquanto consigo entender apenas mensagens de texto 😊\nDigite sua dúvida ou envie MENU para voltar ao início.');
}

const text = msgText.toLowerCase().trim();

// ── ATENDENTE — funciona em qualquer etapa ────────────────────────
if (text === 'atendente') {
  step = 'atendente';
  return direct('Aguarde, um atendente vai te chamar em breve! ☎️\n\nSe quiser voltar ao menu automático, digite *menu*.');
}

// ── MENU — funciona em qualquer etapa ────────────────────────────
if (['menu','voltar','reiniciar','0','inicio','início'].includes(text)) {
  step = 'menu';
  sessionData = {
    company_id:   sessionData.company_id,
    company_name: sessionData.company_name,
    patient_id:   sessionData.patient_id,
    patient_name: sessionData.patient_name
  };
  return direct(menu());
}

// ── AWAITING CONFIRMATION ────────────────────────────────────────
if (step === 'awaiting_confirmation') {
  const apptId = sessionData.pending_appointment_id   || '';
  const info   = sessionData.pending_appointment_info || 'sua consulta agendada';
  const cid    = sessionData.company_id;

  if (text === '1') {
    step = 'menu';
    return sb('CONFIRM_APPOINTMENT', `${SURL}/rest/v1/appointments?id=eq.${apptId}`, 'PATCH', { status: 'confirmed' });
  }
  if (text === '2') {
    if (!cid) { step = 'menu'; return direct('Não foi possível processar. Digite *menu* para ver as opções.'); }
    step = 'sel_cancel';
    return sb('GET_APPTS_CANCEL',
      `${SURL}/rest/v1/patients?company_id=eq.${cid}&phone=eq.${phone}&select=id,full_name,appointments:appointments!patient_id(id,start_at,status,professionals(name),procedures(name))&limit=1`);
  }
  if (text === '3') {
    step = 'menu';
    return direct('Para remarcar sua consulta, entre em contato com nossa recepção. 📞\n\nDigite *menu* para ver as opções.');
  }
  return direct(`${info}\n\nResponda:\n*1* - Confirmar ✅\n*2* - Cancelar ❌\n*3* - Remarcar 🔄`);
}

// ── INITIAL ──────────────────────────────────────────────────────
if (step === 'initial') {
  return sb('GET_COMPANY',
    `${SURL}/rest/v1/integrations?type=eq.whatsapp&config->>instance_name=eq.${encodeURIComponent(instanceName)}&select=company_id,companies(id,name)&limit=1`);
}

// ── GET_NAME — coletar nome completo ─────────────────────────────
if (step === 'get_name') {
  const fullName = msgText.trim();
  if (!isFullName(fullName)) {
    return direct('Por favor, informe seu *nome completo* (nome e sobrenome) 😊');
  }
  sessionData.patient_name = fullName;
  step = 'menu';
  // Atualiza paciente existente no Supabase (PATCH não cria, só atualiza)
  const patchUrl = sessionData.patient_id
    ? `${SURL}/rest/v1/patients?id=eq.${sessionData.patient_id}`
    : `${SURL}/rest/v1/patients?company_id=eq.${sessionData.company_id}&phone=eq.${phone}`;
  return sb('SAVE_PATIENT_NAME', patchUrl, 'PATCH', { full_name: fullName });
}

// ── MENU ─────────────────────────────────────────────────────────
if (step === 'menu') {
  if (text === '1') {
    step = 'sel_proc';
    return sb('GET_PROCEDURES', `${SURL}/rest/v1/procedures?company_id=eq.${sessionData.company_id}&active=eq.true&select=id,name,duration_minutes&order=name.asc`);
  }
  if (text === '2') {
    return sb('GET_APPOINTMENTS',
      `${SURL}/rest/v1/patients?company_id=eq.${sessionData.company_id}&phone=eq.${phone}&select=id,full_name,appointments:appointments!patient_id(id,start_at,status,professionals(name),procedures(name))&limit=1`);
  }
  if (text === '3') {
    step = 'sel_cancel';
    return sb('GET_APPTS_CANCEL',
      `${SURL}/rest/v1/patients?company_id=eq.${sessionData.company_id}&phone=eq.${phone}&select=id,full_name,appointments:appointments!patient_id(id,start_at,status,professionals(name),procedures(name))&limit=1`);
  }
  if (text === '4') {
    step = 'atendente';
    return direct('Aguarde, um atendente vai te chamar em breve! ☎️\n\nSe quiser voltar ao menu automático, digite *menu*.');
  }
  return direct(menu());
}

// ── SEL_PROC ─────────────────────────────────────────────────────
if (step === 'sel_proc') {
  const idx   = parseInt(text, 10) - 1;
  const procs = sessionData.procedures || [];
  if (isNaN(idx) || idx < 0 || idx >= procs.length) {
    const list = procs.map((p,i) => `${i+1}️⃣ *${p.name}*`).join('\n');
    return direct(`Opção inválida.\n\nEscolha o procedimento:\n${list}\n\nDigite *menu* para voltar.`);
  }
  sessionData.procedure_id   = procs[idx].id;
  sessionData.procedure_name = procs[idx].name;
  step = 'sel_prof';
  return sb('GET_PROFESSIONALS',
    `${SURL}/rest/v1/professionals?company_id=eq.${sessionData.company_id}&active=eq.true&select=id,name,specialty&order=name.asc`);
}

// ── SEL_PROF ─────────────────────────────────────────────────────
if (step === 'sel_prof') {
  const idx   = parseInt(text, 10) - 1;
  const profs = sessionData.professionals || [];
  if (isNaN(idx) || idx < 0 || idx >= profs.length) {
    const list = profs.map((p,i) => `${i+1}️⃣ *${p.name}*`).join('\n');
    return direct(`Opção inválida.\n\nEscolha o profissional:\n${list}\n\nDigite *menu* para voltar.`);
  }
  sessionData.professional_id   = profs[idx].id;
  sessionData.professional_name = profs[idx].name;
  step = 'sel_slot';
  const today  = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  return sb('GET_SLOTS',
    `${SURL}/rest/v1/availability_slots?professional_id=eq.${sessionData.professional_id}&is_available=eq.true&start_time=gte.${today}&start_time=lte.${future}&select=id,start_time,end_time&order=start_time.asc&limit=10`);
}

// ── SEL_SLOT ─────────────────────────────────────────────────────
if (step === 'sel_slot') {
  const idx   = parseInt(text, 10) - 1;
  const slots = sessionData.slots || [];
  if (isNaN(idx) || idx < 0 || idx >= slots.length) {
    const list = slots.map((s,i) => {
      const dt = new Date(s.start_time).toLocaleString('pt-BR',
        { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${i+1}️⃣ ${dt}`;
    }).join('\n');
    return direct(`Opção inválida.\n\nEscolha o horário:\n${list}\n\nDigite *menu* para voltar.`);
  }
  const slot = slots[idx];
  sessionData.slot_id    = slot.id;
  sessionData.slot_start = slot.start_time;
  sessionData.slot_end   = slot.end_time;
  step = 'confirmar';
  const dt = new Date(slot.start_time).toLocaleString('pt-BR',
    { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return direct(`📋 *Resumo do agendamento:*\n\nProcedimento: ${sessionData.procedure_name}\nProfissional: ${sessionData.professional_name}\nData/Hora: ${dt}\n\nDigite *1* para confirmar ou *menu* para cancelar.`);
}

// ── CONFIRMAR ────────────────────────────────────────────────────
if (step === 'confirmar') {
  if (text === '1') {
    step = 'menu';
    const title = `${sessionData.procedure_name} - ${sessionData.patient_name || phone}`;
    return sb('CREATE_APPOINTMENT', `${SURL}/rest/v1/appointments`, 'POST', {
      company_id:           sessionData.company_id,
      patient_id:           sessionData.patient_id || null,
      professional_id:      sessionData.professional_id,
      procedure_id:         sessionData.procedure_id,
      availability_slot_id: sessionData.slot_id,
      start_at:             sessionData.slot_start,
      end_at:               sessionData.slot_end,
      title,
      status:               'scheduled',
      reminder_sent:        false
    });
  }
  return direct('Agendamento cancelado. Digite *menu* para voltar.');
}

// ── SEL_CANCEL ───────────────────────────────────────────────────
if (step === 'sel_cancel') {
  const appts = sessionData.appointments_to_cancel || [];
  if (!appts.length) return direct('Você não tem consultas para cancelar.\n\nDigite *menu* para voltar.');
  const idx = parseInt(text, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= appts.length) {
    const list = appts.map((a,i) => {
      const dt = new Date(a.start_at).toLocaleString('pt-BR',
        { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${i+1}️⃣ ${dt} - ${a.procedures?.name || '?'}`;
    }).join('\n');
    return direct(`Escolha a consulta para cancelar:\n\n${list}\n\nDigite *menu* para voltar.`);
  }
  const appt = appts[idx];
  step = 'menu';
  return sb('CANCEL_APPOINTMENT', `${SURL}/rest/v1/appointments?id=eq.${appt.id}`, 'PATCH', { status: 'cancelled' });
}

// ── ATENDENTE ────────────────────────────────────────────────────
if (step === 'atendente') {
  return skip();
}

// Fallback
step = 'menu';
return direct(menu());
"""

# ================================================================
# PROCESSAR SUPABASE — formata respostas e atualiza sessão
# ================================================================
CODE_PROCESSAR_SUPABASE = r"""
const orig = $('Lógica Principal').first().json;
const { phone, instanceName, action } = orig;

let step        = orig._session?.step || 'initial';
let sessionData = { ...(orig._session?.data || {}) };

const raw  = $input.first().json;
const data = Array.isArray(raw) ? raw : (raw ? [raw] : []);

const FOOTER = '\n\n\u{1F916} Atendimento automático.\nDigite ATENDENTE para falar com uma pessoa.\nDigite MENU para voltar ao início.\nPor enquanto, envie apenas mensagens de texto. Áudios e imagens não são processados.';

const tz = 'America/Sao_Paulo';
function fdt(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: tz, weekday: 'long', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
function isFullName(s) {
  const parts = (s || '').trim().split(/\s+/);
  return parts.length >= 2 && parts.every(p => p.length >= 2);
}
function getSession() { return { phone, instanceName, step, data: sessionData }; }
function out(text) {
  return [{ json: { phone, instanceName, text: text + FOOTER, _skip: false, _session: getSession() } }];
}
function menu() {
  const n = sessionData.patient_name ? `Olá, *${sessionData.patient_name}*! 👋` : 'Olá! 👋';
  const c = sessionData.company_name  ? ` à *${sessionData.company_name}*` : '';
  return `${n} Bem-vindo(a)${c}.\n\nComo posso te ajudar?\n\n1️⃣ Agendar consulta\n2️⃣ Ver meus agendamentos\n3️⃣ Cancelar agendamento\n4️⃣ Falar com atendente\n\n_Envie o número da opção_`;
}

const STATUS_BADGE = { scheduled: '⏳', confirmed: '✅', cancelled: '❌', completed: '✔️', no_show: '🚫' };

switch (action) {

  case 'GET_COMPANY': {
    const row = data[0];
    if (!row?.company_id) {
      step = 'initial';
      return out('Olá! Este número não está associado a nenhuma clínica cadastrada. Por favor, entre em contato pelo canal oficial.');
    }
    sessionData.company_id   = row.company_id;
    sessionData.company_name = row.companies?.name || '';
    // Verificar se já temos nome completo na sessão
    if (isFullName(sessionData.patient_name)) {
      step = 'menu';
      return out(menu());
    }
    // Pedir nome completo antes do menu
    step = 'get_name';
    return out('Antes de começar, me informe seu *nome completo*, por favor.');
  }

  case 'SAVE_PATIENT_NAME': {
    // PATCH retornou o paciente atualizado (ou array vazio se não existe)
    const patient = data[0];
    if (patient?.id && !sessionData.patient_id) {
      sessionData.patient_id = patient.id;
    }
    // patient_name já foi salvo na sessão pelo Lógica Principal
    step = 'menu';
    return out(menu());
  }

  case 'GET_PROCEDURES': {
    if (!data.length) {
      step = 'menu';
      return out('Nenhum procedimento disponível no momento.\n\nDigite *menu* para ver as opções.');
    }
    sessionData.procedures = data;
    const lista = data.map((p,i) => `${i+1}️⃣ *${p.name}* _(${p.duration_minutes} min)_`).join('\n');
    return out(`Qual procedimento você precisa?\n\n${lista}\n\n_Envie o número_`);
  }

  case 'GET_PROFESSIONALS': {
    if (!data.length) {
      step = 'menu';
      return out('Nenhum profissional disponível no momento.\n\nDigite *menu* para ver as opções.');
    }
    sessionData.professionals = data;
    const lista = data.map((p,i) => `${i+1}️⃣ *${p.name}*${p.specialty ? ` - _${p.specialty}_` : ''}`).join('\n');
    return out(`Com qual profissional prefere ser atendido(a)?\n\n${lista}\n0️⃣ Qualquer disponível\n\n_Envie o número_`);
  }

  case 'GET_SLOTS': {
    if (!data.length) {
      step = 'menu';
      return out('Não há horários disponíveis nos próximos 14 dias. 😔\n\nEntre em contato com a recepção ou tente novamente mais tarde.\n\nDigite *menu* para voltar.');
    }
    sessionData.slots = data;
    const lista = data.map((s,i) => {
      const dt = new Date(s.start_time).toLocaleString('pt-BR',
        { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${i+1}️⃣ ${dt}`;
    }).join('\n');
    return out(`Horários disponíveis:\n\n${lista}\n\n_Envie o número do horário desejado_`);
  }

  case 'GET_APPOINTMENTS': {
    const patient = data[0];
    if (!patient) return out('Você não possui cadastro na nossa clínica. 😊\n\nDigite *menu* para ver as opções.');
    if (!sessionData.patient_id) {
      sessionData.patient_id   = patient.id;
      sessionData.patient_name = patient.full_name || sessionData.patient_name || '';
    }
    const now = new Date().toISOString();
    const appts = (patient.appointments || [])
      .filter(a => ['scheduled','confirmed'].includes(a.status) && a.start_at >= now)
      .sort((a,b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 5);
    if (!appts.length) return out('Você não possui agendamentos futuros. 😊\n\nDigite *menu* para ver as opções.');
    const lista = appts.map(a => {
      const badge = STATUS_BADGE[a.status] || '📋';
      return `${badge} *${fdt(a.start_at)}*\n🦷 ${a.procedures?.name||'-'}\n👨‍⚕️ ${a.professionals?.name||'-'}`;
    }).join('\n\n');
    return out(`Seus próximos agendamentos:\n\n${lista}\n\n⏳ = aguardando confirmação  ✅ = confirmado`);
  }

  case 'GET_APPTS_CANCEL': {
    const patient = data[0];
    if (!patient) {
      step = 'menu';
      return out('Você não possui agendamentos para cancelar.\n\nDigite *menu* para voltar.');
    }
    if (!sessionData.patient_id) {
      sessionData.patient_id   = patient.id;
      sessionData.patient_name = patient.full_name || sessionData.patient_name || '';
    }
    const now = new Date().toISOString();
    const appts = (patient.appointments || [])
      .filter(a => ['scheduled','confirmed'].includes(a.status) && a.start_at >= now)
      .sort((a,b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 5);
    if (!appts.length) {
      step = 'menu';
      return out('Você não possui agendamentos para cancelar.\n\nDigite *menu* para voltar.');
    }
    sessionData.appointments_to_cancel = appts;
    const lista = appts.map((a,i) => `${i+1}️⃣ ${fdt(a.start_at)} - ${a.procedures?.name||'-'}`).join('\n');
    return out(`Qual agendamento deseja cancelar?\n\n${lista}\n\n_Envie o número ou *menu* para cancelar_`);
  }

  case 'CREATE_APPOINTMENT': {
    const dt   = fdt(sessionData.slot_start || new Date().toISOString());
    const proc = sessionData.procedure_name    || '';
    const prof = sessionData.professional_name || '';
    ['procedure_id','procedure_name','professional_id','professional_name',
     'slot_id','slot_start','slot_end','slots','procedures','professionals'].forEach(k => delete sessionData[k]);
    return out(`✅ *Agendamento realizado!*\n\n📅 ${dt}\n🦷 ${proc}\n👨‍⚕️ ${prof}\n\nVocê receberá um lembrete 24h antes.\nPara alterar ou cancelar, envie *menu*. Até lá! 😊`);
  }

  case 'CONFIRM_APPOINTMENT':
    return out('✅ *Consulta confirmada com sucesso!*\n\nTe esperamos! 😊');

  case 'CANCEL_APPOINTMENT':
    return out('✅ Agendamento cancelado com sucesso.');

  default:
    return out('Desculpe, ocorreu um erro. Por favor, envie *menu* para recomeçar.');
}
"""

# ================================================================
# MENSAGEM DIRETA — passa _session e supabasePrefer adiante
# ================================================================
CODE_MENSAGEM_DIRETA = r"""
const { phone, instanceName, message, _session, _skip } = $input.first().json;
return [{ json: { phone, instanceName, text: message, _session, _skip } }];
"""

# ================================================================
# Nós do workflow
# ================================================================
nodes = [
  {
    "id": "dental-wh-00000001",
    "name": "Webhook Dental",
    "type": "n8n-nodes-base.webhook",
    "typeVersion": 2,
    "position": [240, 300],
    "webhookId": "dental-whatsapp",
    "parameters": {
      "path": "dental-whatsapp",
      "httpMethod": "POST",
      "responseMode": "onReceived",
      "responseData": "firstEntryJson"
    }
  },

  {
    "id": "dental-code-0000010",
    "name": "Extrair Payload",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [500, 300],
    "parameters": {
      "jsCode": CODE_EXTRAIR_PAYLOAD.strip()
    }
  },

  {
    "id": "dental-http-0000011",
    "name": "Obter Sessão",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [760, 300],
    "parameters": {
      "method": "POST",
      "url": "={{ $vars.DENTAL_SUPABASE_URL }}/rest/v1/n8n_bot_sessions",
      "sendHeaders": True,
      "headerParameters": {
        "parameters": [
          { "name": "apikey",        "value": "={{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Authorization", "value": "=Bearer {{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Content-Type",  "value": "application/json" },
          { "name": "Prefer",        "value": "resolution=merge-duplicates,return=representation" }
        ]
      },
      "sendBody": True,
      "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ phone: $json.phone, instance_name: $json.instanceName, updated_at: new Date().toISOString() }) }}",
      "options": {}
    }
  },

  {
    "id": "dental-code-0000002",
    "name": "Lógica Principal",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1020, 300],
    "parameters": {
      "jsCode": CODE_LOGICA_PRINCIPAL.strip()
    }
  },

  {
    "id": "dental-if-00000012",
    "name": "Pular?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [1280, 300],
    "parameters": {
      "conditions": {
        "options": { "caseSensitive": True, "leftValue": "", "typeValidation": "strict" },
        "combinator": "and",
        "conditions": [{
          "id": "cond-skip-001",
          "leftValue": "={{ $json._skip }}",
          "rightValue": True,
          "operator": { "type": "boolean", "operation": "true" }
        }]
      }
    }
  },

  {
    "id": "dental-if-00000003",
    "name": "Precisa Supabase?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [1540, 300],
    "parameters": {
      "conditions": {
        "options": { "caseSensitive": True, "leftValue": "", "typeValidation": "strict" },
        "combinator": "and",
        "conditions": [{
          "id": "cond-supa-001",
          "leftValue": "={{ $json.supabaseUrl }}",
          "rightValue": "",
          "operator": { "type": "string", "operation": "notEmpty" }
        }]
      }
    }
  },

  {
    "id": "dental-http-0000004",
    "name": "Supabase API",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1800, 200],
    "parameters": {
      "method": "={{ $json.supabaseMethod }}",
      "url":    "={{ $json.supabaseUrl }}",
      "sendHeaders": True,
      "headerParameters": {
        "parameters": [
          { "name": "apikey",        "value": "={{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Authorization", "value": "=Bearer {{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Content-Type",  "value": "application/json" },
          { "name": "Prefer",        "value": "={{ $json.supabasePrefer || 'return=representation' }}" }
        ]
      },
      "sendBody": True,
      "specifyBody": "json",
      "jsonBody": "={{ $json.supabaseBody ? JSON.stringify($json.supabaseBody) : '{}' }}",
      "options": {}
    }
  },

  {
    "id": "dental-code-0000005",
    "name": "Processar Supabase",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [2060, 200],
    "parameters": {
      "jsCode": CODE_PROCESSAR_SUPABASE.strip()
    }
  },

  {
    "id": "dental-code-0000006",
    "name": "Mensagem Direta",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1800, 420],
    "parameters": {
      "jsCode": CODE_MENSAGEM_DIRETA.strip()
    }
  },

  {
    "id": "dental-http-0000007",
    "name": "Enviar WhatsApp",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [2320, 300],
    "parameters": {
      "method": "POST",
      "url": "=http://evolution_api:8080/message/sendText/{{ $json.instanceName }}",
      "sendHeaders": True,
      "headerParameters": {
        "parameters": [
          { "name": "apikey", "value": "={{ $vars.DENTAL_EVOLUTION_KEY }}" }
        ]
      },
      "sendBody": True,
      "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ number: $json.phone, delay: 1200, text: $json.text }) }}",
      "options": {}
    }
  },

  {
    "id": "dental-http-0000013",
    "name": "Salvar Sessão",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [2580, 300],
    "parameters": {
      "method": "POST",
      "url": "={{ $vars.DENTAL_SUPABASE_URL }}/rest/v1/n8n_bot_sessions",
      "sendHeaders": True,
      "headerParameters": {
        "parameters": [
          { "name": "apikey",        "value": "={{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Authorization", "value": "=Bearer {{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Content-Type",  "value": "application/json" },
          { "name": "Prefer",        "value": "resolution=merge-duplicates,return=minimal" }
        ]
      },
      "sendBody": True,
      "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ phone: $json._session.phone, instance_name: $json._session.instanceName, step: $json._session.step, data: $json._session.data, updated_at: new Date().toISOString() }) }}",
      "options": {}
    }
  }
]

# ================================================================
# Conexões
# ================================================================
connections = {
  "Webhook Dental": {
    "main": [[{"node": "Extrair Payload", "type": "main", "index": 0}]]
  },
  "Extrair Payload": {
    "main": [[{"node": "Obter Sessão", "type": "main", "index": 0}]]
  },
  "Obter Sessão": {
    "main": [[{"node": "Lógica Principal", "type": "main", "index": 0}]]
  },
  "Lógica Principal": {
    "main": [[{"node": "Pular?", "type": "main", "index": 0}]]
  },
  "Pular?": {
    "main": [
      [{"node": "Salvar Sessão",      "type": "main", "index": 0}],
      [{"node": "Precisa Supabase?",  "type": "main", "index": 0}]
    ]
  },
  "Precisa Supabase?": {
    "main": [
      [{"node": "Supabase API",    "type": "main", "index": 0}],
      [{"node": "Mensagem Direta", "type": "main", "index": 0}]
    ]
  },
  "Supabase API": {
    "main": [[{"node": "Processar Supabase", "type": "main", "index": 0}]]
  },
  "Processar Supabase": {
    "main": [[
      {"node": "Enviar WhatsApp", "type": "main", "index": 0},
      {"node": "Salvar Sessão",   "type": "main", "index": 0}
    ]]
  },
  "Mensagem Direta": {
    "main": [[
      {"node": "Enviar WhatsApp", "type": "main", "index": 0},
      {"node": "Salvar Sessão",   "type": "main", "index": 0}
    ]]
  }
}

settings = { "executionOrder": "v1" }

# ================================================================
# Gravar no SQLite
# ================================================================
conn   = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

now_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
new_ver = 'bot-v3-name-capture'

nodes_json    = json.dumps(nodes,       ensure_ascii=False)
conns_json    = json.dumps(connections, ensure_ascii=False)
settings_json = json.dumps(settings,   ensure_ascii=False)

cursor.execute("""
  UPDATE workflow_entity
  SET nodes=?, connections=?, settings=?, updatedAt=?, versionId=?
  WHERE id=?
""", (nodes_json, conns_json, settings_json, now_str, new_ver, WF_ID))

cursor.execute("SELECT versionId FROM workflow_history WHERE workflowId=? ORDER BY createdAt DESC LIMIT 1", (WF_ID,))
row = cursor.fetchone()
if row:
    cursor.execute("""
      UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?
    """, (nodes_json, conns_json, row[0]))

cursor.execute("SELECT publishedVersionId FROM workflow_published_version WHERE workflowId=?", (WF_ID,))
row = cursor.fetchone()
if row:
    cursor.execute("""
      UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?
    """, (nodes_json, conns_json, row[0]))

conn.commit()
conn.close()

print(f"✅ Bot workflow atualizado — versão '{new_ver}'")
print(f"   + Captura de nome completo (step 'get_name')")
print(f"   + Rodapé padrão em todas as mensagens")
print(f"   + ATENDENTE e MENU globais em qualquer etapa")
print(f"   + Resposta para mídia (áudio/imagem/doc)")
print(f"   + Header Prefer dinâmico no Supabase API node")
