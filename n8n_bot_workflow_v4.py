#!/usr/bin/env python3
"""
Bot v4 — Humanização completa do DentalFlow WhatsApp Bot.

Mudanças (somente copy/UX, arquitetura preservada):
  - Linguagem natural de recepcionista
  - Saudação por período (Bom dia / Boa tarde / Boa noite)
  - Nome do paciente (primeiro nome) em mensagens relevantes
  - Detecção de intenção no estado menu (agendamento, cancelar, ver)
  - Delay aleatório 700–2000ms para parecer humano
  - Fallback inteligente por contexto
  - Emojis leves e apropriados
  - Mensagens de transição naturais entre etapas
  - Rodapé compacto e discreto
  - Zero "Opção inválida" / "Erro" / linguagem robótica
"""

import sqlite3, json
from datetime import datetime

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
WF_ID   = '7493d378-f9fc-4763-a146-8909e697fb3f'

# ================================================================
# EXTRAIR PAYLOAD — inalterado (apenas adiciona msgType)
# ================================================================
CODE_EXTRAIR_PAYLOAD = r"""
const raw     = $input.first().json;
const payload = raw.body || raw;

if (payload.system === true) {
  const p    = String(payload.phone       || '');
  const inst = String(payload.instanceName || '');
  if (!p || !inst) return [];
  return [{ json: { phone: p, instanceName: inst, isSystem: true, msgText: '', msgType: 'system', rawPayload: payload } }];
}

const msgData  = payload.data || {};
const key      = msgData.key  || {};
if (key.fromMe === true)                       return [];
if ((key.remoteJid || '').includes('@g.us'))   return [];
const instanceName = payload.instance || '';
const phone        = (key.remoteJid || '').split('@')[0];
if (!phone || phone.length < 8)                return [];

const msgContent = msgData.message || {};

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
# LÓGICA PRINCIPAL — humanizada
# ================================================================
CODE_LOGICA_PRINCIPAL = r"""
// ================================================================
// Dental SaaS - WhatsApp Bot v4.0 (humanizado)
// ================================================================

const FOOTER = '\n\n🤖 _Atendimento automático · *ATENDENTE* para a equipe · *MENU* para reiniciar · apenas texto_';

const sessionRow = $input.first().json;
let step        = sessionRow.step || 'initial';
let sessionData = { ...(sessionRow.data || {}) };

const ep = $('Extrair Payload').first().json;
const { phone, instanceName, isSystem, msgText, msgType, rawPayload } = ep;

const SURL = $vars.DENTAL_SUPABASE_URL;

// ── Helpers ──────────────────────────────────────────────────────
function firstName(name) {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}
function greeting() {
  const h = parseInt(new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false
  }), 10);
  if (h >= 5  && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}
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
    message: msg + FOOTER,
    supabaseUrl: '', supabaseMethod: 'GET', supabaseBody: null,
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
  const greet  = greeting();
  const fn     = firstName(sessionData.patient_name);
  const suf    = fn ? `, ${fn}` : '';
  const clinic = sessionData.company_name ? ` à *${sessionData.company_name}*` : '';
  return `${greet}${suf}! 😊 Seja bem-vindo(a)${clinic} 🦷\n\nComo posso te ajudar hoje?\n\n1️⃣ Agendar consulta\n2️⃣ Minhas consultas\n3️⃣ Cancelar agendamento\n4️⃣ Falar com a equipe\n\n_Responda com o número da opção_`;
}

// ── SYSTEM ───────────────────────────────────────────────────────
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

// ── MÍDIA ────────────────────────────────────────────────────────
if (msgType === 'media') {
  return direct('Oi! Por enquanto só consigo ler mensagens de texto 😊\nDigite o que precisa ou envie *MENU* para ver as opções.');
}

const text = msgText.toLowerCase().trim();

// ── ATENDENTE — qualquer etapa ────────────────────────────────────
if (text === 'atendente') {
  step = 'atendente';
  return direct('Tudo bem 😊\nVou encaminhar seu atendimento para nossa equipe.\n\nAssim que possível alguém vai te chamar por aqui!');
}

// ── MENU — qualquer etapa ────────────────────────────────────────
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

// ── AWAITING CONFIRMATION (lembrete) ─────────────────────────────
if (step === 'awaiting_confirmation') {
  const apptId = sessionData.pending_appointment_id   || '';
  const info   = sessionData.pending_appointment_info || 'sua consulta agendada';
  const cid    = sessionData.company_id;

  if (text === '1') {
    step = 'menu';
    return sb('CONFIRM_APPOINTMENT', `${SURL}/rest/v1/appointments?id=eq.${apptId}`, 'PATCH', { status: 'confirmed' });
  }
  if (text === '2') {
    if (!cid) { step = 'menu'; return direct('Não consegui processar 😊\nEnvie *MENU* para recomeçar.'); }
    step = 'sel_cancel';
    return sb('GET_APPTS_CANCEL',
      `${SURL}/rest/v1/patients?company_id=eq.${cid}&phone=eq.${phone}&select=id,full_name,appointments:appointments!patient_id(id,start_at,status,professionals(name),procedures(name))&limit=1`);
  }
  if (text === '3') {
    step = 'menu';
    return direct('Sem problemas 😊\nPara remarcar, entre em contato com a recepção — eles vão encontrar o melhor horário pra você 📞');
  }
  return direct(`Não entendi muito bem 😊\n\nSobre sua consulta:\n${info}\n\nResponda com:\n*1* — Confirmar ✅\n*2* — Cancelar ❌\n*3* — Remarcar 🔄`);
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
    return direct('Hmm, preciso do seu nome completo — nome e sobrenome 😊\nPode me informar novamente?');
  }
  sessionData.patient_name = fullName;
  step = 'menu';
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
    return direct('Tudo bem 😊\nVou encaminhar seu atendimento para nossa equipe.\n\nAssim que possível alguém vai te chamar por aqui!');
  }
  // Detecção de intenção por texto livre
  if (/agend|marcar|consult|limpeza|tratamento|implante|clareamento|canal|extraç/i.test(msgText)) {
    step = 'sel_proc';
    return sb('GET_PROCEDURES', `${SURL}/rest/v1/procedures?company_id=eq.${sessionData.company_id}&active=eq.true&select=id,name,duration_minutes&order=name.asc`);
  }
  if (/cancelar|desmarcar/i.test(msgText)) {
    step = 'sel_cancel';
    return sb('GET_APPTS_CANCEL',
      `${SURL}/rest/v1/patients?company_id=eq.${sessionData.company_id}&phone=eq.${phone}&select=id,full_name,appointments:appointments!patient_id(id,start_at,status,professionals(name),procedures(name))&limit=1`);
  }
  if (/minha.*consult|ver.*consult|meu.*agend|minhas/i.test(msgText)) {
    return sb('GET_APPOINTMENTS',
      `${SURL}/rest/v1/patients?company_id=eq.${sessionData.company_id}&phone=eq.${phone}&select=id,full_name,appointments:appointments!patient_id(id,start_at,status,professionals(name),procedures(name))&limit=1`);
  }
  return direct(menu());
}

// ── SEL_PROC ─────────────────────────────────────────────────────
if (step === 'sel_proc') {
  const idx   = parseInt(text, 10) - 1;
  const procs = sessionData.procedures || [];
  if (isNaN(idx) || idx < 0 || idx >= procs.length) {
    const list = procs.map((p,i) => `${i+1}️⃣ *${p.name}*`).join('\n');
    return direct(`Não encontrei essa opção 😅\nEscolha um dos procedimentos abaixo:\n\n${list}`);
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
    return direct(`Não encontrei essa opção 😅\nEscolha um dos profissionais:\n\n${list}`);
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
    return direct(`Não encontrei esse horário 😅\nEscolha um dos disponíveis:\n\n${list}`);
  }
  const slot = slots[idx];
  sessionData.slot_id    = slot.id;
  sessionData.slot_start = slot.start_time;
  sessionData.slot_end   = slot.end_time;
  step = 'confirmar';
  const dt = new Date(slot.start_time).toLocaleString('pt-BR',
    { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return direct(`Quase lá! 😊\nConfirma o agendamento?\n\n📅 ${dt}\n🦷 ${sessionData.procedure_name}\n👨‍⚕️ ${sessionData.professional_name}\n\n*1* — Confirmar ✅\n*MENU* — Cancelar`);
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
  return direct('Tudo bem 😊\nNão confirmei o agendamento.\nSe quiser tentar novamente, é só digitar *MENU*.');
}

// ── SEL_CANCEL ───────────────────────────────────────────────────
if (step === 'sel_cancel') {
  const appts = sessionData.appointments_to_cancel || [];
  if (!appts.length) return direct('Não encontrei consultas ativas para cancelar 😊\nSe precisar de ajuda, é só digitar *MENU*.');
  const idx = parseInt(text, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= appts.length) {
    const list = appts.map((a,i) => {
      const dt = new Date(a.start_at).toLocaleString('pt-BR',
        { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${i+1}️⃣ ${dt} — ${a.procedures?.name || '?'}`;
    }).join('\n');
    return direct(`Não encontrei essa opção 😅\nQual dessas consultas deseja cancelar?\n\n${list}`);
  }
  const appt = appts[idx];
  step = 'menu';
  return sb('CANCEL_APPOINTMENT', `${SURL}/rest/v1/appointments?id=eq.${appt.id}`, 'PATCH', { status: 'cancelled' });
}

// ── ATENDENTE ────────────────────────────────────────────────────
if (step === 'atendente') {
  return skip();
}

// ── FALLBACK inteligente ──────────────────────────────────────────
step = 'menu';
if (/^(bom dia|boa tarde|boa noite|oi|ol[aá]|oie|hey|hi)[\s!.]*$/i.test(msgText)) {
  return direct(menu());
}
if (/agend|marcar|consult|limpeza|tratamento|implante|clareamento|canal|extraç/i.test(msgText)) {
  return direct(`Entendido 😊\nPara agendar, é só escolher uma das opções abaixo!\n\n${menu()}`);
}
const fn0 = firstName(sessionData.patient_name);
return direct(`Não entendi muito bem${fn0 ? `, ${fn0}` : ''} 😅\nMas posso te ajudar!\n\n${menu()}`);
"""

# ================================================================
# PROCESSAR SUPABASE — humanizado
# ================================================================
CODE_PROCESSAR_SUPABASE = r"""
const orig = $('Lógica Principal').first().json;
const { phone, instanceName, action } = orig;

let step        = orig._session?.step || 'initial';
let sessionData = { ...(orig._session?.data || {}) };

const raw  = $input.first().json;
const data = Array.isArray(raw) ? raw : (raw ? [raw] : []);

const FOOTER = '\n\n🤖 _Atendimento automático · *ATENDENTE* para a equipe · *MENU* para reiniciar · apenas texto_';

// ── Helpers ──────────────────────────────────────────────────────
const tz = 'America/Sao_Paulo';
function fdt(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: tz, weekday: 'long', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
function fdtShort(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}
function firstName(name) {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}
function greeting() {
  const h = parseInt(new Date().toLocaleString('pt-BR', {
    timeZone: tz, hour: 'numeric', hour12: false
  }), 10);
  if (h >= 5  && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
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
  const greet  = greeting();
  const fn     = firstName(sessionData.patient_name);
  const suf    = fn ? `, ${fn}` : '';
  const clinic = sessionData.company_name ? ` à *${sessionData.company_name}*` : '';
  return `${greet}${suf}! 😊 Seja bem-vindo(a)${clinic} 🦷\n\nComo posso te ajudar hoje?\n\n1️⃣ Agendar consulta\n2️⃣ Minhas consultas\n3️⃣ Cancelar agendamento\n4️⃣ Falar com a equipe\n\n_Responda com o número da opção_`;
}

const STATUS_BADGE = { scheduled: '⏳', confirmed: '✅', cancelled: '❌', completed: '✔️', no_show: '🚫' };

switch (action) {

  // ── Identificação da clínica ────────────────────────────────────
  case 'GET_COMPANY': {
    const row = data[0];
    if (!row?.company_id) {
      step = 'initial';
      return out('Olá! Não encontrei esse número cadastrado em nenhuma clínica 😊\nSe acha que é um engano, entre em contato com a clínica pelo canal oficial.');
    }
    sessionData.company_id   = row.company_id;
    sessionData.company_name = row.companies?.name || '';
    if (isFullName(sessionData.patient_name)) {
      step = 'menu';
      return out(menu());
    }
    step = 'get_name';
    return out('Olá! Antes de começar, preciso do seu nome completo 😊\nComo você se chama?');
  }

  // ── Salvar nome do paciente ─────────────────────────────────────
  case 'SAVE_PATIENT_NAME': {
    const patient = data[0];
    if (patient?.id && !sessionData.patient_id) {
      sessionData.patient_id = patient.id;
    }
    step = 'menu';
    const fn     = firstName(sessionData.patient_name);
    const clinic = sessionData.company_name ? ` à *${sessionData.company_name}*` : '';
    const greet  = greeting();
    return out(`Prazer em te conhecer, ${fn}! 😊\n\n${greet}! Seja bem-vindo(a)${clinic} 🦷\n\nComo posso te ajudar hoje?\n\n1️⃣ Agendar consulta\n2️⃣ Minhas consultas\n3️⃣ Cancelar agendamento\n4️⃣ Falar com a equipe\n\n_Responda com o número da opção_`);
  }

  // ── Procedimentos ───────────────────────────────────────────────
  case 'GET_PROCEDURES': {
    if (!data.length) {
      step = 'menu';
      return out('Poxa, no momento não há procedimentos disponíveis para agendamento 😅\nSugiro entrar em contato com a recepção para verificar outras opções.');
    }
    sessionData.procedures = data;
    const lista = data.map((p,i) => `${i+1}️⃣ *${p.name}* _(${p.duration_minutes} min)_`).join('\n');
    return out(`Ótimo! 😊\nQue tipo de atendimento você precisa?\n\n${lista}\n\n_Responda com o número_`);
  }

  // ── Profissionais ───────────────────────────────────────────────
  case 'GET_PROFESSIONALS': {
    if (!data.length) {
      step = 'menu';
      return out('Hmm, no momento não há profissionais disponíveis 😅\nTente novamente mais tarde ou entre em contato com a recepção.');
    }
    sessionData.professionals = data;
    const lista = data.map((p,i) => `${i+1}️⃣ *${p.name}*${p.specialty ? ` — _${p.specialty}_` : ''}`).join('\n');
    return out(`Perfeito 😊\nCom qual profissional você prefere ser atendido(a)?\n\n${lista}\n\n_Responda com o número_`);
  }

  // ── Horários ────────────────────────────────────────────────────
  case 'GET_SLOTS': {
    if (!data.length) {
      step = 'menu';
      return out('Hmm, não encontrei horários disponíveis nos próximos 14 dias 😔\nSugiro entrar em contato com a recepção para verificar outras opções.');
    }
    sessionData.slots = data;
    const lista = data.map((s,i) => {
      const dt = new Date(s.start_time).toLocaleString('pt-BR',
        { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${i+1}️⃣ ${dt}`;
    }).join('\n');
    return out(`Encontrei esses horários disponíveis 😊\n\n${lista}\n\n_Qual você prefere? Responda com o número_`);
  }

  // ── Ver agendamentos ────────────────────────────────────────────
  case 'GET_APPOINTMENTS': {
    const patient = data[0];
    if (!patient) return out('Não encontrei seu cadastro na clínica ainda 😊\nSe quiser agendar, é só digitar *MENU* e escolher a opção 1.');
    if (!sessionData.patient_id) {
      sessionData.patient_id   = patient.id;
      sessionData.patient_name = patient.full_name || sessionData.patient_name || '';
    }
    const fn  = firstName(sessionData.patient_name);
    const now = new Date().toISOString();
    const appts = (patient.appointments || [])
      .filter(a => ['scheduled','confirmed'].includes(a.status) && a.start_at >= now)
      .sort((a,b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 5);
    if (!appts.length) return out(`${fn ? `${fn}, você` : 'Você'} não tem consultas agendadas no momento 😊\nSe quiser marcar uma, é só digitar *MENU* e escolher a opção 1.`);
    const lista = appts.map(a => {
      const badge = STATUS_BADGE[a.status] || '📋';
      return `${badge} *${fdt(a.start_at)}*\n🦷 ${a.procedures?.name||'-'}\n👨‍⚕️ ${a.professionals?.name||'-'}`;
    }).join('\n\n');
    return out(`${fn ? `${fn}, aqui` : 'Aqui'} estão suas próximas consultas 😊\n\n${lista}\n\n⏳ aguardando confirmação  ✅ confirmada`);
  }

  // ── Cancelar agendamento — lista ────────────────────────────────
  case 'GET_APPTS_CANCEL': {
    const patient = data[0];
    if (!patient) {
      step = 'menu';
      return out('Não encontrei consultas para cancelar 😊\nSe precisar de ajuda, é só digitar *MENU*.');
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
      return out('Não encontrei consultas ativas para cancelar 😊\nSe precisar de ajuda, é só digitar *MENU*.');
    }
    sessionData.appointments_to_cancel = appts;
    const lista = appts.map((a,i) => `${i+1}️⃣ ${fdt(a.start_at)} — ${a.procedures?.name||'-'}`).join('\n');
    return out(`Entendido 😊\nQual dessas consultas você gostaria de cancelar?\n\n${lista}\n\n_Responda com o número_`);
  }

  // ── Criar agendamento ───────────────────────────────────────────
  case 'CREATE_APPOINTMENT': {
    const fn   = firstName(sessionData.patient_name);
    const dt   = fdt(sessionData.slot_start || new Date().toISOString());
    const proc = sessionData.procedure_name    || '';
    const prof = sessionData.professional_name || '';
    ['procedure_id','procedure_name','professional_id','professional_name',
     'slot_id','slot_start','slot_end','slots','procedures','professionals'].forEach(k => delete sessionData[k]);
    return out(`Perfeito${fn ? `, ${fn}` : ''}! 😊\nSua consulta ficou agendada:\n\n📅 ${dt}\n🦷 ${proc}\n👨‍⚕️ ${prof}\n\nEm breve você vai receber um lembrete.\nEstamos te esperando ✨`);
  }

  // ── Confirmar agendamento ───────────────────────────────────────
  case 'CONFIRM_APPOINTMENT': {
    const fn = firstName(sessionData.patient_name);
    return out(`Ótimo${fn ? `, ${fn}` : ''}! ✨\nSua consulta está confirmada.\nEstamos te esperando 😊`);
  }

  // ── Cancelar agendamento ────────────────────────────────────────
  case 'CANCEL_APPOINTMENT':
    return out('Tudo certo 😊\nSua consulta foi cancelada com sucesso.\nSe precisar de mais alguma coisa, estou por aqui!');

  default:
    return out('Ops, algo deu errado por aqui 😅\nEnvia *MENU* para recomeçar, por favor.');
}
"""

# ================================================================
# MENSAGEM DIRETA — inalterado
# ================================================================
CODE_MENSAGEM_DIRETA = r"""
const { phone, instanceName, message, _session, _skip } = $input.first().json;
return [{ json: { phone, instanceName, text: message, _session, _skip } }];
"""

# ================================================================
# Nós do workflow (arquitetura preservada)
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
    "parameters": { "jsCode": CODE_EXTRAIR_PAYLOAD.strip() }
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
    "parameters": { "jsCode": CODE_LOGICA_PRINCIPAL.strip() }
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
    "parameters": { "jsCode": CODE_PROCESSAR_SUPABASE.strip() }
  },
  {
    "id": "dental-code-0000006",
    "name": "Mensagem Direta",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1800, 420],
    "parameters": { "jsCode": CODE_MENSAGEM_DIRETA.strip() }
  },
  # Delay aleatório 700–2000ms para naturalidade
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
      "jsonBody": "={{ JSON.stringify({ number: $json.phone, delay: Math.floor(700 + Math.random() * 1300), text: $json.text }) }}",
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
# Conexões — inalteradas
# ================================================================
connections = {
  "Webhook Dental":    { "main": [[{"node": "Extrair Payload",   "type": "main", "index": 0}]] },
  "Extrair Payload":   { "main": [[{"node": "Obter Sessão",      "type": "main", "index": 0}]] },
  "Obter Sessão":      { "main": [[{"node": "Lógica Principal",  "type": "main", "index": 0}]] },
  "Lógica Principal":  { "main": [[{"node": "Pular?",            "type": "main", "index": 0}]] },
  "Pular?": {
    "main": [
      [{"node": "Salvar Sessão",     "type": "main", "index": 0}],
      [{"node": "Precisa Supabase?", "type": "main", "index": 0}]
    ]
  },
  "Precisa Supabase?": {
    "main": [
      [{"node": "Supabase API",    "type": "main", "index": 0}],
      [{"node": "Mensagem Direta", "type": "main", "index": 0}]
    ]
  },
  "Supabase API":       { "main": [[{"node": "Processar Supabase", "type": "main", "index": 0}]] },
  "Processar Supabase": { "main": [[
    {"node": "Enviar WhatsApp", "type": "main", "index": 0},
    {"node": "Salvar Sessão",   "type": "main", "index": 0}
  ]]},
  "Mensagem Direta": { "main": [[
    {"node": "Enviar WhatsApp", "type": "main", "index": 0},
    {"node": "Salvar Sessão",   "type": "main", "index": 0}
  ]]}
}

settings = { "executionOrder": "v1" }

# ================================================================
# Gravar no SQLite
# ================================================================
conn   = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

now_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
new_ver = 'bot-v4-humanized'

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
    cursor.execute("UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?",
                   (nodes_json, conns_json, row[0]))

cursor.execute("SELECT publishedVersionId FROM workflow_published_version WHERE workflowId=?", (WF_ID,))
row = cursor.fetchone()
if row:
    cursor.execute("UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?",
                   (nodes_json, conns_json, row[0]))

conn.commit()
conn.close()

print(f"✅ Bot workflow atualizado — versão '{new_ver}'")
print("   Humanização completa:")
print("   · Saudação por período (Bom dia / Boa tarde / Boa noite)")
print("   · Primeiro nome do paciente em mensagens relevantes")
print("   · Detecção de intenção no menu (texto livre)")
print("   · Delay aleatório 700–2000ms no Enviar WhatsApp")
print("   · Fallback inteligente com contexto")
print("   · Sem 'Opção inválida' / 'Erro' / linguagem robótica")
print("   · Emojis leves e naturais")
print("   · Rodapé compacto e discreto")
print("   · Arquitetura, sessões e regras de negócio preservadas")
