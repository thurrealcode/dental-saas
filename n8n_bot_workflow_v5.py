#!/usr/bin/env python3
"""
Bot v5 — Correção do bug de silêncio após profissional + step period.

Bug corrigido:
  - availability_slots não existe no Supabase → HTTP 404 → workflow parava
    silenciosamente sem enviar mensagem ao paciente
  - appointments.availability_slot_id também não existe → CREATE_APPOINTMENT falhava

Mudanças:
  - Novo step 'period' entre sel_prof e sel_slot
  - Geração dinâmica de horários a partir de professional_availability
  - Remoção de availability_slot_id do CREATE_APPOINTMENT
  - procedure_duration salvo na sessão para gerar slots corretos
  - console.log em pontos críticos para debug
"""

import sqlite3, json
from datetime import datetime

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
WF_ID   = '7493d378-f9fc-4763-a146-8909e697fb3f'

# ================================================================
# EXTRAIR PAYLOAD — inalterado
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
# LÓGICA PRINCIPAL — v5: period step + logs + fix CREATE_APPOINTMENT
# ================================================================
CODE_LOGICA_PRINCIPAL = r"""
// ================================================================
// Dental SaaS - WhatsApp Bot v5.0
// Fix: period step + dynamic slots + remove availability_slot_id
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
function periodMenu() {
  return 'Perfeito 😊\nQual período você prefere?\n\n1️⃣ Manhã\n2️⃣ Tarde\n3️⃣ Noite\n4️⃣ Qualquer horário disponível\n\n0️⃣ Voltar';
}

// Log de debug em todo request
console.log(`[BOT-v5] phone=${phone} step=${step} input="${msgType==='text'?msgText:'[media]'}" proc_id=${(sessionData.procedure_id||'').slice(0,8)||'none'} prof_id=${(sessionData.professional_id||'').slice(0,8)||'none'} period=${sessionData.period||'none'}`);

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

// ── ATENDENTE ────────────────────────────────────────────────────
if (text === 'atendente') {
  step = 'atendente';
  return direct('Tudo bem 😊\nVou encaminhar seu atendimento para nossa equipe.\n\nAssim que possível alguém vai te chamar por aqui!');
}

// ── MENU ─────────────────────────────────────────────────────────
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

// ── AWAITING CONFIRMATION ─────────────────────────────────────────
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

// ── GET_NAME ──────────────────────────────────────────────────────
if (step === 'get_name') {
  const fullName = msgText.trim();
  if (!isFullName(fullName)) {
    return direct('Hmm, preciso do seu nome completo — nome e sobrenome 😊\nPode me informar novamente?');
  }
  sessionData.patient_name = fullName;
  step = 'menu';
  // Usar direct() evita chamar Supabase PATCH que pode retornar [] (paciente não cadastrado)
  // e causaria o workflow parar silenciosamente (n8n não executa nós downstream com 0 itens).
  // O nome fica salvo em sessionData / n8n_bot_sessions.
  const fn     = firstName(fullName);
  const clinic = sessionData.company_name ? ` à *${sessionData.company_name}*` : '';
  const greet  = greeting();
  return direct(`Prazer em te conhecer, ${fn}! 😊\n\n${greet}! Seja bem-vindo(a)${clinic} 🦷\n\nComo posso te ajudar hoje?\n\n1️⃣ Agendar consulta\n2️⃣ Minhas consultas\n3️⃣ Cancelar agendamento\n4️⃣ Falar com a equipe\n\n_Responda com o número da opção_`);
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
  sessionData.procedure_id       = procs[idx].id;
  sessionData.procedure_name     = procs[idx].name;
  sessionData.procedure_duration = procs[idx].duration_minutes || 30;
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
  step = 'period';
  console.log(`[BOT-v5] sel_prof: idx=${idx} prof_id=${sessionData.professional_id.slice(0,8)} → step=period`);
  return direct(periodMenu());
}

// ── PERIOD — escolha de período ───────────────────────────────────
if (step === 'period') {
  // 0 = Voltar para profissionais
  if (text === '0') {
    step = 'sel_prof';
    const profs = sessionData.professionals || [];
    if (!profs.length) {
      return sb('GET_PROFESSIONALS',
        `${SURL}/rest/v1/professionals?company_id=eq.${sessionData.company_id}&active=eq.true&select=id,name,specialty&order=name.asc`);
    }
    const list = profs.map((p,i) => `${i+1}️⃣ *${p.name}*${p.specialty ? ` — _${p.specialty}_` : ''}`).join('\n');
    return direct(`Tudo bem 😊\nCom qual profissional prefere?\n\n${list}`);
  }

  const periodMap = { '1': 'manha', '2': 'tarde', '3': 'noite', '4': 'qualquer' };
  if (!periodMap[text]) {
    return direct(`Não entendi 😅\n\n${periodMenu()}`);
  }

  sessionData.period = periodMap[text];
  step = 'sel_slot';
  console.log(`[BOT-v5] period: escolha="${text}" period=${sessionData.period} prof_id=${sessionData.professional_id.slice(0,8)}`);

  return sb('GET_AVAILABILITY',
    `${SURL}/rest/v1/professional_availability?professional_id=eq.${sessionData.professional_id}&active=eq.true&select=day_of_week,start_time,end_time&order=day_of_week.asc`);
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
    const apptBody = {
      company_id:      sessionData.company_id,
      patient_id:      sessionData.patient_id || null,
      professional_id: sessionData.professional_id,
      procedure_id:    sessionData.procedure_id,
      start_at:        sessionData.slot_start,
      end_at:          sessionData.slot_end,
      title,
      status:          'scheduled',
      reminder_sent:   false
    };
    if (!sessionData.patient_id) {
      // patient_id NOT NULL na tabela: precisamos upsert o paciente primeiro.
      // Salva apptBody na sessão para usar em Processar Supabase.
      sessionData.pending_appt = apptBody;
      return sb('UPSERT_PATIENT',
        `${SURL}/rest/v1/patients`,
        'POST',
        { company_id: sessionData.company_id, phone, full_name: sessionData.patient_name || phone },
        'resolution=merge-duplicates,return=representation'
      );
    }
    return sb('CREATE_APPOINTMENT', `${SURL}/rest/v1/appointments`, 'POST', apptBody);
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
# PROCESSAR SUPABASE — v5: GET_AVAILABILITY + geração dinâmica de slots
# ================================================================
CODE_PROCESSAR_SUPABASE = r"""
const orig = $('Lógica Principal').first().json;
const { phone, instanceName, action } = orig;

let step        = orig._session?.step || 'initial';
let sessionData = { ...(orig._session?.data || {}) };

const raw  = $input.first().json;
const data = Array.isArray(raw) ? raw : (raw ? [raw] : []);

const FOOTER = '\n\n🤖 _Atendimento automático · *ATENDENTE* para a equipe · *MENU* para reiniciar · apenas texto_';

const tz = 'America/Sao_Paulo';

// ── Helpers ──────────────────────────────────────────────────────
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
function periodMenu() {
  return 'Perfeito 😊\nQual período você prefere?\n\n1️⃣ Manhã\n2️⃣ Tarde\n3️⃣ Noite\n4️⃣ Qualquer horário disponível\n\n0️⃣ Voltar';
}

const STATUS_BADGE = { scheduled: '⏳', confirmed: '✅', cancelled: '❌', completed: '✔️', no_show: '🚫' };

// ── Gera horários a partir da agenda semanal ──────────────────────
function generateSlots(availRows, period, durationMin) {
  // Monta mapa: day_of_week → { start, end }
  // day_of_week: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  const avail = {};
  for (const row of availRows) {
    avail[row.day_of_week] = { start: row.start_time, end: row.end_time };
  }

  const slots = [];
  // Data atual em São Paulo
  const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

  for (let d = 1; d <= 14 && slots.length < 20; d++) {
    const target = new Date(brNow);
    target.setDate(brNow.getDate() + d);
    const dayOfWeek = target.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb

    if (!avail[dayOfWeek]) continue; // Profissional não trabalha neste dia

    const { start, end } = avail[dayOfWeek];
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM]     = end.split(':').map(Number);
    const endTotalMin      = endH * 60 + endM;

    const y  = target.getFullYear();
    const mo = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const dateStr = `${y}-${mo}-${dd}`;

    let slotMin = startH * 60 + startM;
    while (slotMin + durationMin <= endTotalMin) {
      const sH = Math.floor(slotMin / 60);
      const sM = slotMin % 60;

      // Filtrar por período
      const inPeriod = (
        period === 'qualquer' ||
        (period === 'manha'  && sH >= 5  && sH < 12) ||
        (period === 'tarde'  && sH >= 12 && sH < 18) ||
        (period === 'noite'  && (sH >= 18 || sH < 5))
      );

      if (inPeriod) {
        const eMin = slotMin + durationMin;
        const eH   = Math.floor(eMin / 60);
        const eM   = eMin % 60;
        const startISO = `${dateStr}T${String(sH).padStart(2,'0')}:${String(sM).padStart(2,'0')}:00-03:00`;
        const endISO   = `${dateStr}T${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}:00-03:00`;
        slots.push({ start_time: startISO, end_time: endISO });
      }
      slotMin += durationMin;
    }
  }

  return slots.slice(0, 10);
}

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

  // ── Salvar nome ─────────────────────────────────────────────────
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
      return out('Poxa, no momento não há procedimentos disponíveis para agendamento 😅\nSugiro entrar em contato com a recepção.');
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

  // ── Disponibilidade → gera horários dinamicamente ───────────────
  case 'GET_AVAILABILITY': {
    console.log(`[BOT-v5] GET_AVAILABILITY: rows=${data.length} period=${sessionData.period} duration=${sessionData.procedure_duration}`);
    if (!data.length) {
      step = 'period';
      return out(`Hmm, não encontrei a agenda desse profissional 😔\nTente escolher outro profissional ou entre em contato com a recepção.\n\n${periodMenu()}`);
    }

    const period   = sessionData.period || 'qualquer';
    const duration = sessionData.procedure_duration || 30;
    const slots    = generateSlots(data, period, duration);

    console.log(`[BOT-v5] GET_AVAILABILITY: gerados ${slots.length} slots para period=${period}`);

    if (!slots.length) {
      step = 'period';
      return out(`Não encontrei horários no período selecionado 😔\nEscolha outro período:\n\n${periodMenu()}`);
    }

    sessionData.slots = slots;
    const lista = slots.map((s,i) => `${i+1}️⃣ ${fdtShort(s.start_time)}`).join('\n');
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

  // ── Cancelar — lista ────────────────────────────────────────────
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

  // ── Upsert paciente → agendamento criado via nó paralelo HTTP ────
  case 'UPSERT_PATIENT': {
    const patient = data[0];
    const fn   = firstName(sessionData.patient_name);
    const dt   = fdt(sessionData.slot_start || new Date().toISOString());
    const proc = sessionData.procedure_name    || '';
    const prof = sessionData.professional_name || '';

    let apptBody = null;
    if (patient?.id) {
      sessionData.patient_id = patient.id;
      apptBody = sessionData.pending_appt || {};
      apptBody.patient_id = patient.id;
    }
    delete sessionData.pending_appt;

    ['procedure_id','procedure_name','procedure_duration','professional_id','professional_name',
     'slot_start','slot_end','slots','procedures','professionals','period','pending_appt'].forEach(k => delete sessionData[k]);

    // _apptBody no output dispara nó "Criar Appt?" que cria a consulta via HTTP
    const msg = `Perfeito${fn ? `, ${fn}` : ''}! 😊\nSua consulta ficou agendada:\n\n📅 ${dt}\n🦷 ${proc}\n👨‍⚕️ ${prof}\n\nEm breve você vai receber um lembrete.\nEstamos te esperando ✨`;
    return [{ json: {
      phone, instanceName, text: msg + FOOTER,
      _skip: false, _apptBody: apptBody,
      _session: getSession()
    }}];
  }

  // ── Criar agendamento (paciente já existente) ─────────────────────
  case 'CREATE_APPOINTMENT': {
    const fn   = firstName(sessionData.patient_name);
    const dt   = fdt(sessionData.slot_start || new Date().toISOString());
    const proc = sessionData.procedure_name    || '';
    const prof = sessionData.professional_name || '';
    ['procedure_id','procedure_name','procedure_duration','professional_id','professional_name',
     'slot_start','slot_end','slots','procedures','professionals','period'].forEach(k => delete sessionData[k]);
    return out(`Perfeito${fn ? `, ${fn}` : ''}! 😊\nSua consulta ficou agendada:\n\n📅 ${dt}\n🦷 ${proc}\n👨‍⚕️ ${prof}\n\nEm breve você vai receber um lembrete.\nEstamos te esperando ✨`);
  }

  // ── Confirmar ───────────────────────────────────────────────────
  case 'CONFIRM_APPOINTMENT': {
    const fn = firstName(sessionData.patient_name);
    return out(`Ótimo${fn ? `, ${fn}` : ''}! ✨\nSua consulta está confirmada.\nEstamos te esperando 😊`);
  }

  // ── Cancelar ────────────────────────────────────────────────────
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
    "id": "dental-if-00000014",
    "name": "Criar Appt?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [2320, 500],
    "parameters": {
      "conditions": {
        "options": { "caseSensitive": True, "leftValue": "", "typeValidation": "loose" },
        "combinator": "and",
        "conditions": [{
          "id": "cond-appt-001",
          "leftValue": "={{ !!$json._apptBody }}",
          "rightValue": True,
          "operator": { "type": "boolean", "operation": "true" }
        }]
      }
    }
  },
  {
    "id": "dental-http-0000015",
    "name": "Criar Consulta Supabase",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [2580, 500],
    "parameters": {
      "method": "POST",
      "url": "={{ $vars.DENTAL_SUPABASE_URL }}/rest/v1/appointments",
      "sendHeaders": True,
      "headerParameters": {
        "parameters": [
          { "name": "apikey",        "value": "={{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Authorization", "value": "=Bearer {{ $vars.DENTAL_SUPABASE_KEY }}" },
          { "name": "Content-Type",  "value": "application/json" },
          { "name": "Prefer",        "value": "return=minimal" }
        ]
      },
      "sendBody": True,
      "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify($('Processar Supabase').first().json._apptBody) }}",
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
    {"node": "Criar Appt?",     "type": "main", "index": 0},
    {"node": "Enviar WhatsApp", "type": "main", "index": 0},
    {"node": "Salvar Sessão",   "type": "main", "index": 0}
  ]]},
  "Criar Appt?": {
    "main": [
      [{"node": "Criar Consulta Supabase", "type": "main", "index": 0}],
      []
    ]
  },
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
new_ver = 'bot-v5-period-step'

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
print("   Bugs corrigidos:")
print("   · availability_slots não existe → workflow parava silenciosamente")
print("   · appointments.availability_slot_id removido do CREATE_APPOINTMENT")
print("   · SAVE_PATIENT_NAME PATCH retornava [] para novos pacientes → step não avançava")
print("   · patient_id NOT NULL em appointments → upsert paciente antes de criar consulta")
print("   Novo fluxo de agendamento:")
print("   · sel_proc → GET_PROCEDURES (salva procedure_duration)")
print("   · sel_prof → period (menu de período, direct — sem Supabase)")
print("   · period   → GET_AVAILABILITY (professional_availability)")
print("   · Processar: gera horários dinâmicos da agenda semanal")
print("   · sel_slot  → confirmar → UPSERT_PATIENT (se novo) ou CREATE_APPOINTMENT (se existente)")
print("   · UPSERT_PATIENT: cria paciente + chama appointments via $helpers.httpRequest")
