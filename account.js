/* ============ SOPRANNOME E CLASSIFICHE ============ */
// Niente email né password: ogni dispositivo ha un utente anonimo con un solo profilo.
// Raccogliamo solo soprannome, mascotte e progressi.
(()=>{
const SB_URL = 'https://bvcrpovnmvcdbleoxegd.supabase.co';
const SB_KEY = 'sb_publishable_y13b__XT2FTenM4pmMUQ5w_VTWQIlQR'; // chiave pubblica: i dati sono protetti dalle regole del database
const sb = window.supabase ? supabase.createClient(SB_URL, SB_KEY) : null;

const EMOJI = { otto:'🦉', lia:'🦊', robi:'🤖' };
const BAD = ['cazz','merd','stronz','puttan','troia','vaffa','fancul','coglion','minchia','porco','culo','figa','fica','sesso','sex','fuck','shit','bitch','nazi','duce','negr','frocio','ricchion','bastard','idiot','scem','deficien','suca','pirla'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = s => s.toLowerCase().replace(/[^a-zà-ÿ]/g,'');
const okName = s => /^[A-Za-zÀ-ÿ0-9 _.-]{2,16}$/.test(s) && !BAD.some(w=>clean(s).includes(w));
const okGroup = s => s.length>=2 && s.length<=30 && !BAD.some(w=>clean(s).includes(w));
const tidy = s => s.trim().replace(/\s+/g,' ');
const TAKEN = 'Questo soprannome è già preso: scegline un altro.';
const NICK_ERR = 'Scegli un soprannome gentile di 2-16 lettere o numeri.';
const errMsg = e => e?.code==='23505' ? TAKEN : (e && (e.message||'').replace(/^.*?:\s*/, '')) || 'Qualcosa non ha funzionato, riprova.';

let nick = store.get('nick', ''), kid = null, view = 'rank', tab = 'world';
let groups = [], curGroup = store.get('group', null);

/* ---- profilo online ---- */
const save = store.set;
const merge = (a, b)=>{ const o = {...a}; for(const k in b) o[k] = Math.max(o[k]||0, b[k]||0); return o; };
const same = (a, b)=>JSON.stringify(a)===JSON.stringify(b);
let ready = null;
// Collega il dispositivo al suo profilo (lo crea la prima volta). Restituisce un errore o null.
function ensure(){
  if(!sb || !navigator.onLine || !nick) return Promise.resolve(null);
  return ready ||= (async ()=>{
    try{
      const { data:{ session } } = await sb.auth.getSession();
      if(!session){ const r = await sb.auth.signInAnonymously(); if(r.error) throw r.error; }
      const { data:rows, error } = await sb.from('kids').select('*').limit(1);
      if(error) throw error;
      if(rows[0]){
        kid = rows[0];
        topicsDone = merge(kid.topics||{}, topicsDone); finals = merge(kid.finals||{}, finals);
        save('topics', topicsDone); save('finals', finals);
        if(!same(topicsDone, kid.topics) || !same(finals, kid.finals) || kid.mascot!==charId) await push();
        nick = kid.nickname; save('nick', nick);
      } else {
        const r = await sb.from('kids').insert({ nickname:nick, mascot:charId||'otto', topics:topicsDone, finals }).select().single();
        if(r.error) throw r.error;
        kid = r.data;
      }
      renderHome();
      return null;
    }catch(e){ ready = null; return e; }
  })();
}
async function push(){
  if(!sb || !kid || !navigator.onLine) return null;
  const { data, error } = await sb.from('kids').update({ topics:topicsDone, finals, mascot:charId||'otto', nickname:nick })
    .eq('id', kid.id).select().single();
  if(!error){ kid = data; save('dirty', false); }
  return error;
}

// Ogni progresso salvato sul dispositivo va anche online (con un piccolo ritardo)
let syncT = null;
store.set = (k, v)=>{ save(k, v); if(['topics','finals','char'].includes(k) && nick){ save('dirty', true); clearTimeout(syncT); syncT = setTimeout(()=>ensure().then(e=>{ if(!e) push(); }), 1500); } };
window.addEventListener('online', ()=>{ ensure().then(e=>{ if(!e && store.get('dirty', false)) push(); }); });

/* ---- soprannome nella prima schermata ---- */
$('#pickGo').insertAdjacentHTML('beforebegin', `<div class="nickbox">
  <label for="pNick">Quale soprannome vuoi usare?</label>
  <input class="field" id="pNick" maxlength="16" autocomplete="off" placeholder="Es. Leo, Stella23" value="${esc(nick)}">
  <p class="note">Inventa un soprannome: non usare il tuo vero nome e cognome.</p>
  <p class="err" id="pErr"></p></div>`);
const pNick = $('#pNick');
const pickOk = ()=>{ $('#pickGo').disabled = tidy(pNick.value).length<2; };
const baseRenderPick = renderPick;
renderPick = function(){ baseRenderPick(); pickOk(); if(charId) $('#pErr').textContent = ''; };
pickOk();
pNick.oninput = ()=>{ $('#pErr').textContent=''; pickOk(); };
$('#pickGo').onclick = async ()=>{
  const n = tidy(pNick.value);
  if(!charId) return $('#pErr').textContent = 'Prima scegli chi ti accompagna: tocca Otto, Lia o Robi.';
  if(!okName(n)) return $('#pErr').textContent = NICK_ERR;
  const btn = $('#pickGo'); btn.disabled = true;
  nick = n; save('nick', nick); ready = null;
  const e = await ensure();
  btn.disabled = false;
  if(e?.code==='23505'){ nick=''; save('nick', ''); return $('#pErr').textContent = TAKEN; }
  renderHome(); show('home');   // senza connessione si gioca lo stesso: il profilo si crea più tardi
};

/* ---- finestra classifica ---- */
document.body.insertAdjacentHTML('beforeend', '<div class="modal" id="acct"><div class="box" id="acctBox"></div></div>');
const box = $('#acctBox'), modal = $('#acct');
modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('show'); });
function open(v){ view = v; modal.classList.add('show'); render(); }
function close(){ modal.classList.remove('show'); }

const lbRows = rows => rows.length ? `<div class="lb">${rows.map(r=>`
  <div class="it ${r.mine?'me':''}"><span class="ps">${r.pos<=3?['🥇','🥈','🥉'][r.pos-1]:r.pos}</span>
    <span class="em">${EMOJI[r.mascot]||'🦉'}</span>
    <span class="nm"><b>${esc(r.nickname)}</b><small>${r.stickers} adesivi · ${r.stars} ⭐</small></span>
    <span class="pt">${r.score}</span></div>`).join('')}</div>` : '<p class="note">Ancora nessuno qui: gioca per conquistare il primo posto!</p>';

function render(){
  const V = {
    offline: ()=>`<h3>🏆 Classifica</h3><p class="note">Serve una connessione a internet. Riprova più tardi!</p><button class="btn big" data-x>Chiudi</button>`,
    nick: ()=>`<h3>🏆 Il tuo soprannome</h3>
      <div class="sect"><p>Scegli il nome con cui comparire in classifica.</p>
      <input class="field" id="aNick" maxlength="16" autocomplete="off" placeholder="Es. Leo, Stella23" value="${esc(nick)}">
      <p class="note">Inventa un soprannome: non usare il tuo vero nome e cognome.</p><p class="err" id="aErr"></p></div>
      <button class="btn big" id="aGo">Salva</button><button class="btn ghost big" data-x>Annulla</button>`,
    rank: ()=>`<h3>🏆 Classifica</h3>
      <div class="sect row"><span class="em big">${EMOJI[kid.mascot]||'🦉'}</span><span class="grow"><b>${esc(kid.nickname)}</b><br><span class="note">${kid.stickers} adesivi · ${kid.stars} ⭐</span></span><span class="pt big">${kid.score} punti</span></div>
      <div class="tabs"><button data-t="world" class="${tab==='world'?'on':''}">🌍 Mondo</button><button data-t="group" class="${tab==='group'?'on':''}">👫 Amici</button></div>
      <div id="aTab"><p class="note">Carico…</p></div>
      <p class="note">Punti: 10 per adesivo, +5 se è d'oro, 20 per ogni stella nelle sfide.</p>
      <button class="btn big" data-x>Chiudi</button>`,
    me: ()=>`<h3>🏆 Il mio profilo</h3>
      <div class="sect"><div class="row"><span class="em big">${EMOJI[kid.mascot]||'🦉'}</span><span class="grow"><b>${esc(kid.nickname)}</b><br><span class="note">${kid.score} punti</span></span>
        <button class="btn ghost" id="aRen" style="padding:8px 14px">Cambia nome</button></div>
        <div class="row"><span class="grow note">Mostrami nella classifica del mondo</span>
        <button class="switch" role="switch" aria-label="Classifica del mondo" aria-checked="${kid.public_rank}" id="aPub"></button></div></div>
      <div class="sect"><h4>I miei dati</h4>
        <p class="note">Salviamo solo soprannome, mascotte e punti.</p>
        <button class="btn ghost" id="aDl">⬇️ Scarica i miei dati</button>
        <a class="note" href="privacy.html" target="_blank">Leggi l'informativa privacy</a></div>
      <button class="btn big danger" id="aWipe">Cancella il mio profilo</button>
      <button class="btn ghost big" data-x>Chiudi</button>`,
  };
  box.innerHTML = V[view]();
  box.querySelectorAll('[data-x]').forEach(b=>b.onclick=close);
  const go = $('#aGo'), err = t=>{ const e=$('#aErr'); if(e) e.textContent=t; };

  if(view==='nick'){
    $('#aNick').focus();
    go.onclick = async ()=>{
      const n = tidy($('#aNick').value);
      if(!okName(n)) return err(NICK_ERR);
      go.disabled = true;
      const old = nick; nick = n; save('nick', n);
      let e;
      if(kid) e = await push(); else { ready = null; e = await ensure(); }
      go.disabled = false;
      if(e){ nick = old; save('nick', old); return err(errMsg(e)); }
      renderHome();
      if(kid) open('rank'); else close();
    };
  }
  if(view==='rank'){
    box.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; render(); });
    renderTab();
  }
  if(view==='me'){
    $('#aRen').onclick = ()=>open('nick');
    $('#aPub').onclick = async ()=>{
      const { data, error } = await sb.from('kids').update({ public_rank:!kid.public_rank }).eq('id', kid.id).select().single();
      if(!error){ kid = data; render(); }
    };
    $('#aDl').onclick = async ()=>{
      const { data } = await sb.rpc('my_groups', { p_kid:kid.id });
      const out = { ...kid, gruppi:(data||[]).map(g=>({ nome:g.name, codice:g.code })) };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type:'application/json' }));
      a.download = 'safehome-kids-dati.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#aWipe').onclick = async ()=>{
      if(!confirm('Cancellare il profilo online? Il soprannome e i punti spariranno dalle classifiche. Gli adesivi restano su questo dispositivo.')) return;
      const { error } = await sb.rpc('delete_my_account');
      if(error) return alert(errMsg(error));
      await sb.auth.signOut();
      kid = null; nick = ''; ready = null; save('nick', ''); save('group', null); save('dirty', false);
      close(); renderHome(); alert('Profilo cancellato.');
    };
  }
}

async function renderTab(){
  const el = $('#aTab');
  if(tab==='world'){
    const { data, error } = await sb.rpc('leaderboard_global');
    el.innerHTML = (kid.public_rank ? '' : '<p class="note">Non compari nella classifica del mondo: puoi cambiarlo in ⚙️ → Il mio profilo.</p>')
      + (error ? `<p class="err">${esc(errMsg(error))}</p>` : lbRows(data));
    return;
  }
  const { data } = await sb.rpc('my_groups', { p_kid:kid.id });
  groups = data || [];
  if(!groups.some(g=>g.id===curGroup)) curGroup = groups[0]?.id || null;
  save('group', curGroup);
  const g = groups.find(x=>x.id===curGroup);
  let html = groups.length>1 ? `<div class="tabs">${groups.map(x=>`<button data-g="${x.id}" class="${x.id===curGroup?'on':''}">${esc(x.name)}</button>`).join('')}</div>` : '';
  if(g){
    const lb = await sb.rpc('leaderboard_group', { p_group:g.id, p_kid:kid.id });
    html += `<div class="sect"><div class="row"><span class="grow"><b>${esc(g.name)}</b><br><span class="note">Codice per invitare: <b class="code">${esc(g.code)}</b></span></span>
      <button class="btn ghost" id="aShare" style="padding:8px 14px">📤 Invita</button></div></div>${lbRows(lb.data||[])}
      <button class="link" id="aLeave">Esci da questo gruppo</button>`;
  } else html += `<p class="note">Crea un gruppo con la famiglia, gli amici o la classe, oppure entra con il codice che ti hanno dato.</p>`;
  html += `<div class="sect"><h4>Entra in un gruppo</h4><div class="row"><input class="field" id="aJoin" maxlength="6" placeholder="CODICE" autocapitalize="characters"><button class="btn" id="aJoinGo">Entra</button></div>
    <h4>Crea un gruppo</h4><div class="row"><input class="field" id="aNew" maxlength="30" placeholder="Es. Famiglia Rossi, 3ªB"><button class="btn" id="aNewGo">Crea</button></div>
    <p class="err" id="aErr"></p></div>`;
  el.innerHTML = html;
  const err = t=>{ $('#aErr').textContent=t; };
  el.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ curGroup=b.dataset.g; renderTab(); });
  if(g){
    $('#aShare').onclick = ()=>{
      const text = `Gioca con me su SafeHome Kids! Entra nel gruppo "${g.name}" con il codice ${g.code}`;
      if(navigator.share) navigator.share({ text, url:'https://safehome-kids.netlify.app' }).catch(()=>{});
      else { navigator.clipboard?.writeText(`${text}: https://safehome-kids.netlify.app`); alert('Invito copiato! Incollalo in un messaggio.'); }
    };
    $('#aLeave').onclick = async ()=>{ if(!confirm(`Uscire dal gruppo "${g.name}"?`)) return; await sb.rpc('leave_group', { p_group:g.id, p_kid:kid.id }); curGroup=null; renderTab(); };
  }
  const pickGroup = async code=>{ curGroup = (await sb.rpc('my_groups', { p_kid:kid.id })).data?.find(x=>x.code===code)?.id || null; renderTab(); };
  $('#aJoinGo').onclick = async ()=>{
    const code = $('#aJoin').value.trim().toUpperCase();
    if(code.length!==6) return err('Il codice ha 6 caratteri.');
    const { error } = await sb.rpc('join_group', { p_code:code, p_kid:kid.id });
    if(error) return err(errMsg(error));
    pickGroup(code);
  };
  $('#aNewGo').onclick = async ()=>{
    const name = tidy($('#aNew').value);
    if(!okGroup(name)) return err('Scegli un nome gentile di 2-30 caratteri.');
    const { data, error } = await sb.rpc('create_group', { p_name:name, p_kid:kid.id });
    if(error) return err(errMsg(error));
    pickGroup(data);
  };
}

/* ---- pulsanti nell'app ---- */
async function openIn(v){
  if(!sb || !navigator.onLine) return open('offline');
  if(!nick) return open('nick');
  const e = await ensure();
  if(e?.code==='23505'){ open('nick'); return $('#aErr').textContent = TAKEN; }
  if(e || !kid) return open('offline');
  open(v);
}
$('#rankBtn').onclick = ()=>openIn('rank');
$('#parentBtn').onclick = ()=>{ $('#settings').classList.remove('show'); openIn('me'); };

// Nella testata mostriamo chi sta giocando
const baseRenderHome = renderHome;
renderHome = function(){ baseRenderHome(); if(nick) $('#hSub').textContent = `${nick} · ${stickerCount()} adesivi`; };
renderHome();

// Chi giocava già prima delle classifiche sceglie il soprannome al primo avvio
if(charId && !nick) setTimeout(()=>open('nick'), 800);
else ensure();
})();
