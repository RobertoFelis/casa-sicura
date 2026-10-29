/* ============ ACCOUNT GENITORE, PROFILI E CLASSIFICHE ============ */
// Raccogliamo il minimo indispensabile: l'email del genitore e, per ogni bambino,
// solo soprannome, mascotte e progressi. Tutto ciò che condivide dati passa da un adulto.
(()=>{
const SB_URL = 'https://bvcrpovnmvcdbleoxegd.supabase.co';
const SB_KEY = 'sb_publishable_y13b__XT2FTenM4pmMUQ5w_VTWQIlQR'; // chiave pubblica: i dati sono protetti dalle regole del database
const sb = window.supabase ? supabase.createClient(SB_URL, SB_KEY) : null;
const fromLink = /access_token|token_hash|code=/.test(location.hash + location.search);

const EMOJI = { otto:'🦉', lia:'🦊', robi:'🤖' };
const BAD = ['cazz','merd','stronz','puttan','troia','vaffa','fancul','coglion','minchia','porco','culo','figa','fica','sesso','sex','fuck','shit','bitch','nazi','duce','negr','frocio','ricchion','bastard','idiot','scem','deficien','suca','pirla'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const okName = s => /^[A-Za-zÀ-ÿ0-9 _.-]{2,16}$/.test(s) && !BAD.some(w=>s.toLowerCase().replace(/[^a-zà-ÿ]/g,'').includes(w));
const okGroup = s => s.length>=2 && s.length<=30 && !BAD.some(w=>s.toLowerCase().replace(/[^a-zà-ÿ]/g,'').includes(w));
const errMsg = e => (e && (e.message||'').replace(/^.*?:\s*/, '')) || 'Qualcosa non ha funzionato, riprova.';

let user = null, kids = [], kid = null, view = 'intro', after = null, tab = 'group';
let groups = [], curGroup = store.get('group', null), sentTo = '';

/* ---- salvataggio online dei progressi ---- */
const save = store.set;
let syncT = null;
store.set = (k, v)=>{ save(k, v); if(['topics','finals','char'].includes(k) && kid){ save('dirty', true); clearTimeout(syncT); syncT = setTimeout(push, 1500); } };
async function push(){
  if(!sb || !kid || !navigator.onLine) return;
  const { data, error } = await sb.from('kids').update({ topics:topicsDone, finals, mascot:charId||'otto' })
    .eq('id', kid.id).select().single();
  if(!error){ kid = data; kids = kids.map(k=>k.id===data.id?data:k); save('dirty', false); }
}
window.addEventListener('online', ()=>{ if(store.get('dirty', false)) push(); });

const merge = (a, b)=>{ const o = {...a}; for(const k in b) o[k] = Math.max(o[k]||0, b[k]||0); return o; };
// Attiva un profilo: i progressi da ospite passano al primo profilo scelto, poi ognuno ha i suoi
function useKid(k){
  const guest = !store.get('kid', null);
  topicsDone = guest ? merge(k.topics||{}, topicsDone) : {...(k.topics||{})};
  finals = guest ? merge(k.finals||{}, finals) : {...(k.finals||{})};
  if(CHARS[k.mascot]) charId = k.mascot;
  kid = k; save('kid', k.id); save('topics', topicsDone); save('finals', finals); save('char', charId);
  if(guest) push();
  renderHome();
}
function clearLocal(){
  kid = null; kids = []; groups = []; curGroup = null;
  save('kid', null); save('group', null); save('dirty', false);
  topicsDone = {}; finals = {}; save('topics', topicsDone); save('finals', finals);
  renderHome();
}
async function loadKids(){
  const { data } = await sb.from('kids').select('*').order('created_at');
  kids = data || [];
  const k = kids.find(x=>x.id===store.get('kid', null));
  if(k){ kid = k; if(store.get('dirty', false)) push(); else useKid(k); }
  else if(store.get('kid', null)){ save('kid', null); }
}

/* ---- finestra ---- */
document.body.insertAdjacentHTML('beforeend', '<div class="modal" id="acct"><div class="box" id="acctBox"></div></div>');
const box = $('#acctBox'), modal = $('#acct');
modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('show'); });
function open(v){ view = v; modal.classList.add('show'); render(); }
function close(){ modal.classList.remove('show'); }
// Prima di condividere dati serve un adulto: una piccola moltiplicazione
function gate(next){ after = next; open('gate'); }

const lbRows = rows => rows.length ? `<div class="lb">${rows.map(r=>`
  <div class="it ${r.mine?'me':''}"><span class="ps">${r.pos<=3?['🥇','🥈','🥉'][r.pos-1]:r.pos}</span>
    <span class="em">${EMOJI[r.mascot]||'🦉'}</span>
    <span class="nm"><b>${esc(r.nickname)}</b><small>${r.stickers} adesivi · ${r.stars} ⭐</small></span>
    <span class="pt">${r.score}</span></div>`).join('')}</div>` : '<p class="note">Ancora nessuno qui: gioca per conquistare il primo posto!</p>';

async function render(){
  const V = {
    offline: ()=>`<h3>🏆 Classifica</h3><p class="note">Serve una connessione a internet. Riprova più tardi!</p><button class="btn big" data-x>Chiudi</button>`,
    intro: ()=>`<h3>🏆 Classifica</h3>
      <div class="sect"><p>Vuoi sfidare i tuoi amici e salvare i tuoi adesivi?</p>
      <p class="note">Chiedi a mamma, papà o a un adulto di creare il tuo profilo.</p></div>
      <button class="btn big" id="aGo">👨‍👩‍👧 Sono un adulto</button><button class="btn ghost big" data-x>Non ora</button>`,
    gate: ()=>{ const a=6+Math.floor(Math.random()*4), b=6+Math.floor(Math.random()*4); box.dataset.g=a*b;
      return `<h3>👋 Solo per i grandi</h3><div class="sect"><label for="gIn">Quanto fa <b>${a} × ${b}</b>?</label>
      <input class="field" id="gIn" inputmode="numeric" autocomplete="off"><p class="err" id="aErr"></p></div>
      <button class="btn big" id="aGo">Continua</button><button class="btn ghost big" data-x>Annulla</button>`; },
    login: ()=>`<h3>👨‍👩‍👧 Area genitori</h3>
      <div class="sect"><p>Entra con la tua email: ti mandiamo un link per accedere, senza password.</p>
      <input class="field" id="aMail" type="email" autocomplete="email" placeholder="la-tua@email.it">
      <label class="consent"><input type="checkbox" id="aOk"><span>Sono il genitore o chi ne fa le veci e ho letto l'<a href="privacy.html" target="_blank">informativa privacy</a>.</span></label>
      <p class="note">Ai bambini chiediamo solo un soprannome: niente nomi veri, foto o altri dati.</p>
      <p class="err" id="aErr"></p></div>
      <button class="btn big" id="aGo">Inviami il link</button><button class="btn ghost big" data-x>Annulla</button>`,
    sent: ()=>`<h3>📬 Controlla la posta</h3>
      <div class="sect"><p>Abbiamo scritto a <b>${esc(sentTo)}</b>. Apri il link nell'email <b>da questo dispositivo</b>.</p>
      <p class="note">Se l'email contiene un codice, puoi scriverlo qui:</p>
      <input class="field" id="aCode" inputmode="numeric" autocomplete="one-time-code" placeholder="Codice">
      <p class="err" id="aErr"></p></div>
      <button class="btn big" id="aGo">Conferma il codice</button><button class="btn ghost big" id="aBack">Usa un'altra email</button>`,
    kids: ()=>`<h3>🧒 Chi gioca?</h3>
      ${kids.length?`<div class="lb">${kids.map(k=>`<button class="it ${kid&&kid.id===k.id?'me':''}" data-kid="${k.id}">
        <span class="em">${EMOJI[k.mascot]||'🦉'}</span><span class="nm"><b>${esc(k.nickname)}</b><small>${k.stickers} adesivi · ${k.score} punti</small></span><span>▶</span></button>`).join('')}</div>`:''}
      ${kids.length<6?`<div class="sect"><h4>➕ Nuovo profilo</h4>
        <input class="field" id="aNick" maxlength="16" placeholder="Soprannome (es. Leo, Stella23)">
        <p class="note">Usa un soprannome, non il nome e cognome vero: sarà visibile nelle classifiche.</p>
        <div class="emopick">${Object.keys(CHARS).map(id=>`<button data-m="${id}" class="${id===(charId||'otto')?'on':''}" aria-label="${CHARS[id].full}">${EMOJI[id]}</button>`).join('')}</div>
        <p class="err" id="aErr"></p><button class="btn" id="aGo">Crea profilo</button></div>`:''}
      <button class="btn ghost big" id="aPar">⚙️ Gestisci account</button><button class="btn ghost big" data-x>Chiudi</button>`,
    rank: ()=>`<h3>🏆 Classifica</h3>
      <div class="sect row"><span class="em big">${EMOJI[kid.mascot]||'🦉'}</span><span class="grow"><b>${esc(kid.nickname)}</b><br><span class="note">${kid.stickers} adesivi · ${kid.stars} ⭐</span></span><span class="pt big">${kid.score} punti</span></div>
      <div class="tabs"><button data-t="group" class="${tab==='group'?'on':''}">👫 Amici</button><button data-t="world" class="${tab==='world'?'on':''}">🌍 Mondo</button></div>
      <div id="aTab"><p class="note">Carico…</p></div>
      <p class="note">Punti: 10 per adesivo, +5 se è d'oro, 20 per ogni stella nelle sfide.</p>
      <button class="btn ghost big" id="aKids">🧒 Cambia profilo</button><button class="btn big" data-x>Chiudi</button>`,
    parent: ()=>`<h3>👨‍👩‍👧 Area genitori</h3>
      <div class="sect"><h4>Account</h4><p class="note">${esc(user?.email)}</p></div>
      ${kids.map(k=>`<div class="sect"><div class="row"><span class="em">${EMOJI[k.mascot]||'🦉'}</span><span class="grow"><b>${esc(k.nickname)}</b><br><span class="note">${k.score} punti</span></span>
        <button class="btn ghost danger-t" data-del="${k.id}" style="padding:8px 14px">Elimina</button></div>
        <div class="row"><span class="grow note">Mostra nella classifica del mondo (solo soprannome e punti)</span>
        <button class="switch" role="switch" aria-label="Classifica del mondo" aria-checked="${k.public_rank}" data-pub="${k.id}"></button></div></div>`).join('')}
      <div class="sect"><h4>I tuoi dati</h4>
        <button class="btn ghost" id="aDl">⬇️ Scarica i dati</button>
        <a class="note" href="privacy.html" target="_blank">Leggi l'informativa privacy</a></div>
      <button class="btn ghost big" id="aOut">Esci da questo dispositivo</button>
      <button class="btn big danger" id="aWipe">Elimina account e tutti i dati</button>
      <button class="btn ghost big" id="aKids">◀ Profili</button>`,
  };
  box.innerHTML = V[view]();
  box.querySelectorAll('[data-x]').forEach(b=>b.onclick=close);
  const go = $('#aGo'), err = t=>{ const e=$('#aErr'); if(e) e.textContent=t; };
  const busy = async (btn, fn)=>{ btn.disabled=true; try{ await fn(); }catch(e){ err(errMsg(e)); } btn.disabled=false; };

  if(view==='intro') go.onclick = ()=>gate(()=>open('login'));
  if(view==='gate'){
    $('#gIn').focus();
    const ok = ()=>{ if(+$('#gIn').value===+box.dataset.g){ const f=after; after=null; f(); } else { err('Non è giusto, riprova.'); $('#gIn').value=''; } };
    go.onclick = ok; $('#gIn').onkeydown = e=>{ if(e.key==='Enter') ok(); };
  }
  if(view==='login') go.onclick = ()=>busy(go, async ()=>{
    const email = $('#aMail').value.trim();
    if(!/^\S+@\S+\.\S+$/.test(email)) return err('Scrivi un indirizzo email valido.');
    if(!$('#aOk').checked) return err("Serve la conferma del genitore e la presa visione dell'informativa.");
    const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.origin + location.pathname } });
    if(error) throw error;
    sentTo = email; open('sent');
  });
  if(view==='sent'){
    $('#aBack').onclick = ()=>open('login');
    go.onclick = ()=>busy(go, async ()=>{
      const { error } = await sb.auth.verifyOtp({ email:sentTo, token:$('#aCode').value.trim(), type:'email' });
      if(error) throw error;
    });
  }
  if(view==='kids'){
    let m = charId || 'otto';
    box.querySelectorAll('[data-kid]').forEach(b=>b.onclick=()=>{ useKid(kids.find(k=>k.id===b.dataset.kid)); tone('beep'); open('rank'); });
    box.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ m=b.dataset.m; box.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on', x===b)); });
    $('#aPar').onclick = ()=>open('parent');
    if(go) go.onclick = ()=>busy(go, async ()=>{
      const nickname = $('#aNick').value.trim().replace(/\s+/g,' ');
      if(!okName(nickname)) return err('Scegli un soprannome gentile di 2-16 lettere o numeri.');
      const { data, error } = await sb.from('kids').insert({ nickname, mascot:m }).select().single();
      if(error) throw error;
      kids.push(data); useKid(data); open('rank');
    });
  }
  if(view==='rank'){
    box.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; render(); });
    $('#aKids').onclick = ()=>open('kids');
    renderTab();
  }
  if(view==='parent'){
    $('#aKids').onclick = ()=>open('kids');
    box.querySelectorAll('[data-pub]').forEach(b=>b.onclick=async ()=>{
      const on = b.getAttribute('aria-checked')!=='true';
      const { data, error } = await sb.from('kids').update({ public_rank:on }).eq('id', b.dataset.pub).select().single();
      if(!error){ kids = kids.map(k=>k.id===data.id?data:k); if(kid?.id===data.id) kid=data; b.setAttribute('aria-checked', String(on)); }
    });
    box.querySelectorAll('[data-del]').forEach(b=>b.onclick=async ()=>{
      const k = kids.find(x=>x.id===b.dataset.del);
      if(!confirm(`Eliminare il profilo "${k.nickname}" con tutti i suoi progressi? Non si può annullare.`)) return;
      const { error } = await sb.from('kids').delete().eq('id', k.id);
      if(error) return alert(errMsg(error));
      kids = kids.filter(x=>x.id!==k.id);
      if(kid?.id===k.id) clearLocal();
      render();
    });
    $('#aDl').onclick = async ()=>{
      const out = { account:{ email:user.email, creato:user.created_at }, profili:[] };
      for(const k of kids){ const { data } = await sb.rpc('my_groups', { p_kid:k.id }); out.profili.push({ ...k, gruppi:(data||[]).map(g=>({ nome:g.name, codice:g.code })) }); }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type:'application/json' }));
      a.download = 'safehome-kids-dati.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#aOut').onclick = async ()=>{
      if(!confirm('Uscire? I progressi restano salvati nel tuo account.')) return;
      await sb.auth.signOut(); clearLocal(); close();
    };
    $('#aWipe').onclick = async ()=>{
      if(!confirm("Eliminare l'account, tutti i profili e i progressi? Non si può annullare.")) return;
      if(!confirm('Sei sicuro? Verranno cancellati per sempre.')) return;
      const { error } = await sb.rpc('delete_my_account');
      if(error) return alert(errMsg(error));
      await sb.auth.signOut(); clearLocal(); close(); alert('Account e dati eliminati.');
    };
  }
}

async function renderTab(){
  const el = $('#aTab');
  if(tab==='world'){
    if(!kid.public_rank){
      el.innerHTML = `<div class="sect"><p>La classifica del mondo è spenta.</p><p class="note">Un adulto può accenderla: gli altri vedranno solo il soprannome e i punti.</p>
        <button class="btn" id="aPub">Accendi (per i grandi)</button></div>`;
      $('#aPub').onclick = ()=>gate(async ()=>{
        const { data } = await sb.from('kids').update({ public_rank:true }).eq('id', kid.id).select().single();
        if(data){ kid = data; kids = kids.map(k=>k.id===data.id?data:k); }
        tab = 'world'; open('rank');
      });
      return;
    }
    const { data, error } = await sb.rpc('leaderboard_global');
    el.innerHTML = error ? `<p class="err">${esc(errMsg(error))}</p>` : lbRows(data);
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
    <p class="note">Serve un adulto per entrare o creare un gruppo.</p><p class="err" id="aErr"></p></div>`;
  el.innerHTML = html;
  const err = t=>{ $('#aErr').textContent=t; };
  el.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ curGroup=b.dataset.g; renderTab(); });
  if(g){
    $('#aShare').onclick = ()=>{
      const text = `Gioca con noi su SafeHome Kids! Entra nel gruppo "${g.name}" con il codice ${g.code}`;
      if(navigator.share) navigator.share({ text, url:'https://safehome-kids.netlify.app' }).catch(()=>{});
      else { navigator.clipboard?.writeText(`${text}: https://safehome-kids.netlify.app`); alert('Invito copiato! Incollalo in un messaggio.'); }
    };
    $('#aLeave').onclick = async ()=>{ if(!confirm(`Uscire dal gruppo "${g.name}"?`)) return; await sb.rpc('leave_group', { p_group:g.id, p_kid:kid.id }); curGroup=null; renderTab(); };
  }
  $('#aJoinGo').onclick = ()=>{
    const code = $('#aJoin').value.trim().toUpperCase();
    if(code.length!==6) return err('Il codice ha 6 caratteri.');
    gate(async ()=>{ open('rank'); const { error } = await sb.rpc('join_group', { p_code:code, p_kid:kid.id }); if(error) return setTimeout(()=>err(errMsg(error)), 300); curGroup=null; renderTab(); });
  };
  $('#aNewGo').onclick = ()=>{
    const name = $('#aNew').value.trim();
    if(!okGroup(name)) return err('Scegli un nome gentile di 2-30 caratteri.');
    gate(async ()=>{ open('rank'); const { data, error } = await sb.rpc('create_group', { p_name:name, p_kid:kid.id }); if(error) return setTimeout(()=>err(errMsg(error)), 300);
      curGroup = (await sb.rpc('my_groups', { p_kid:kid.id })).data?.find(x=>x.code===data)?.id || null; renderTab(); });
  };
}

/* ---- pulsanti nell'app ---- */
function openRank(){
  if(!sb || !navigator.onLine) return open('offline');
  if(!user) return open('intro');
  open(kid ? 'rank' : 'kids');
}
$('#rankBtn').onclick = openRank;
$('#parentBtn').onclick = ()=>{ $('#settings').classList.remove('show'); if(!sb || !navigator.onLine) return open('offline'); gate(()=>open(user ? 'parent' : 'login')); };

// Nella testata mostriamo chi sta giocando
const baseRenderHome = renderHome;
renderHome = function(){ baseRenderHome(); if(kid) $('#hSub').textContent = `${kid.nickname} · ${stickerCount()} adesivi`; };

if(sb){
  let seen = null;
  sb.auth.onAuthStateChange((ev, session)=>{
    const u = session?.user || null;
    if((u?.id||null) === seen) return;
    seen = u?.id || null; user = u;
    // il caricamento avviene fuori dalla callback, come consigliato da Supabase
    setTimeout(async ()=>{
      if(!user){ if(store.get('kid', null)) clearLocal(); return; }
      await loadKids();
      if(!kid && (fromLink || modal.classList.contains('show'))) open('kids');
    }, 0);
  });
}
})();
