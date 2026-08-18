// ============================================================
// ParcIT — logique de l'application.02
// ============================================================
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let equipements = [];
let lieux = [];
let personnes = [];
let maintenances = [];
let campagnes = [];
let scansCampagneActive = [];
let typesMateriel = [];
let currentEquip = null;
let html5QrCode = null;

// ---------- Connexion ----------
async function login(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  errBox.style.display = 'none';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    errBox.textContent = "Connexion refusée : vérifie l'email et le mot de passe.";
    errBox.style.display = 'block';
    return;
  }
  document.getElementById('whoName').textContent = email;
  document.getElementById('avatarInitials').textContent = email.slice(0,2).toUpperCase();
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('app').style.display = 'flex';
  await loadAll();
}

async function logout(){
  await sb.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('screen-login').classList.add('active');
}

// Reste connecté si une session existe déjà (évite de se reconnecter à chaque visite)
async function checkSession(){
  const { data } = await sb.auth.getSession();
  if(data.session){
    const email = data.session.user.email;
    document.getElementById('whoName').textContent = email;
    document.getElementById('avatarInitials').textContent = email.slice(0,2).toUpperCase();
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('app').style.display = 'flex';
    await loadAll();
  }
}
checkSession();

// ---------- Navigation ----------
function go(name, el){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const match = el || document.querySelector('.nav-item[data-screen="'+name+'"]');
  if(match) match.classList.add('active');
  if(name === 'scan') startScanner(); else stopScanner();
}

// ---------- Chargement des données ----------
async function loadAll(){
  const [eqRes, lieuxRes, persRes, maintRes, campRes, typesRes] = await Promise.all([
    sb.from('equipements').select('*, lieux(nom), personnes(nom)').order('created_at', { ascending:false }),
    sb.from('lieux').select('*'),
    sb.from('personnes').select('*'),
    sb.from('maintenances').select('*, equipements(reference, marque, modele)').order('date_declaration', { ascending:false }),
    sb.from('inventaire_campagnes').select('*').order('date_debut', { ascending:false }),
    sb.from('types_materiel').select('*').order('nom')
  ]);
  equipements = eqRes.data || [];
  lieux = lieuxRes.data || [];
  personnes = persRes.data || [];
  maintenances = maintRes.data || [];
  campagnes = campRes.data || [];
  typesMateriel = typesRes.data || [];
  renderDashboard();
  renderEquipList();
  populateSelects();
  populateTypeSelects();
  renderMaintenance();
  renderAdmin();
  renderRapports();
  renderInventaire();
}

function pillClass(statut){
  return {'En service':'service','En stock':'stock','En panne':'panne','En reparation':'reparation','Au rebut':'rebut'}[statut] || 'stock';
}

// ---------- Accueil ----------
function renderDashboard(){
  document.getElementById('statTotal').textContent = equipements.length;
  document.getElementById('statService').textContent = equipements.filter(e=>e.statut==='En service').length;
  document.getElementById('statPanne').textContent = equipements.filter(e=>e.statut==='En panne').length;
  document.getElementById('statStock').textContent = equipements.filter(e=>e.statut==='En stock').length;
  const recent = equipements.slice(0,5);
  document.getElementById('recentList').innerHTML = recent.length ? recent.map(e => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px;">
      <span>${e.marque||''} ${e.modele||''} <span class="mono">${e.reference}</span></span>
      <span class="pill ${pillClass(e.statut)}">${e.statut}</span>
    </div>`).join('') : '<p style="color:var(--ink-faint);">Aucun équipement pour le moment.</p>';
}

// ---------- Liste matériel ----------
function renderEquipList(){
  const q = (document.getElementById('searchBox')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('filterType')?.value || '';
  document.getElementById('materielCount').textContent = equipements.length + ' équipements enregistrés';
  const filtered = equipements.filter(e => {
    const matchQ = !q || (e.reference||'').toLowerCase().includes(q) || (e.modele||'').toLowerCase().includes(q) || (e.marque||'').toLowerCase().includes(q);
    const matchType = !typeFilter || e.type === typeFilter;
    return matchQ && matchType;
  });
  document.getElementById('equipTableBody').innerHTML = filtered.length ? filtered.map(e => `
    <tr onclick="openDetail('${e.id}')">
      <td><b>${e.marque||''} ${e.modele||''}</b><br><span style="color:var(--ink-faint);font-size:12px;">${e.type}</span></td>
      <td class="mono">${e.reference}</td>
      <td><span class="pill ${pillClass(e.statut)}">${e.statut}</span></td>
      <td>${e.personnes?.nom || '—'}</td>
      <td>${e.lieux?.nom || '—'}</td>
    </tr>`).join('') : '<tr><td colspan="5">Aucun résultat.</td></tr>';
}

function populateTypeSelects(){
  const filterSel = document.getElementById('filterType');
  if(filterSel){
    const current = filterSel.value;
    filterSel.innerHTML = '<option value="">Tous les types</option>' +
      typesMateriel.map(t => `<option value="${t.nom}">${t.nom}</option>`).join('');
    filterSel.value = current;
  }
  const formSel = document.getElementById('f_type');
  if(formSel){
    formSel.innerHTML = typesMateriel.map(t => `<option value="${t.nom}">${t.nom}</option>`).join('')
      + '<option value="__new__">+ Créer un nouveau type…</option>';
  }
  const adminList = document.getElementById('typesList');
  if(adminList){
    adminList.innerHTML = typesMateriel.length ? typesMateriel.map(t => `<div class="admin-row"><span>${t.nom}</span></div>`).join('') : '<p style="color:var(--ink-faint);">Aucun type.</p>';
  }
}

async function handleTypeChange(sel){
  if(sel.value !== '__new__') return;
  const nom = prompt("Nom du nouveau type de matériel (ex: Tablette, Vidéoprojecteur…)");
  if(!nom || !nom.trim()){ sel.value = typesMateriel[0]?.nom || ''; return; }
  const { data, error } = await sb.from('types_materiel').insert({ nom: nom.trim() }).select().single();
  if(error){ alert("Impossible de créer ce type : " + error.message); sel.value = typesMateriel[0]?.nom || ''; return; }
  typesMateriel.push(data);
  typesMateriel.sort((a,b) => a.nom.localeCompare(b.nom));
  populateTypeSelects();
  sel.value = data.nom;
}

async function addType(){
  const nom = document.getElementById('newTypeNom').value.trim();
  if(!nom) return;
  await sb.from('types_materiel').insert({ nom });
  document.getElementById('newTypeNom').value = '';
  await loadAll();
}

function populateSelects(){
  const persSel = document.getElementById('assignPersonne');
  const lieuSel = document.getElementById('assignLieu');
  persSel.innerHTML = '<option value="">— Aucun (équipement partagé) —</option>' +
    personnes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
  lieuSel.innerHTML = lieux.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
}

// ---------- Nouvel équipement ----------
function openNewEquip(){ go('nouveau'); }

async function createEquip(){
  const payload = {
    type: document.getElementById('f_type').value,
    reference: document.getElementById('f_reference').value.trim(),
    marque: document.getElementById('f_marque').value.trim(),
    modele: document.getElementById('f_modele').value.trim(),
    numero_serie: document.getElementById('f_serie').value.trim(),
    date_achat: document.getElementById('f_achat').value || null,
    garantie_fin: document.getElementById('f_garantie').value || null,
    statut: document.getElementById('f_statut').value
  };
  const msg = document.getElementById('createMsg');
  if(!payload.reference){
    msg.style.color = 'var(--status-panne)';
    msg.textContent = 'La référence est obligatoire.';
    return;
  }
  const { data, error } = await sb.from('equipements').insert(payload).select().single();
  if(error){
    msg.style.color = 'var(--status-panne)';
    msg.textContent = "Erreur : " + error.message;
    return;
  }
  msg.style.color = 'var(--status-service)';
  msg.textContent = 'Équipement créé.';
  await loadAll();
  openDetail(data.id);
}

// ---------- Fiche matériel ----------
function openDetail(id){
  currentEquip = equipements.find(e => e.id === id);
  if(!currentEquip) return;
  document.getElementById('ficheTitre').textContent = `${currentEquip.marque||''} ${currentEquip.modele||''}`.trim() || currentEquip.type;
  document.getElementById('ficheRef').textContent = currentEquip.reference;
  const pill = document.getElementById('fichePill');
  pill.className = 'pill ' + pillClass(currentEquip.statut);
  pill.textContent = currentEquip.statut;
  document.getElementById('ficheStatutSelect').value = currentEquip.statut;

  document.getElementById('ficheInfo').innerHTML = `
    <div class="info-item"><div class="k">Type</div><div class="v">${currentEquip.type||'—'}</div></div>
    <div class="info-item"><div class="k">N° de série</div><div class="v">${currentEquip.numero_serie||'—'}</div></div>
    <div class="info-item"><div class="k">Date d'achat</div><div class="v">${currentEquip.date_achat||'—'}</div></div>
    <div class="info-item"><div class="k">Garantie jusqu'au</div><div class="v">${currentEquip.garantie_fin||'—'}</div></div>
    <div class="info-item"><div class="k">Utilisateur</div><div class="v">${currentEquip.personnes?.nom||'—'}</div></div>
    <div class="info-item"><div class="k">Lieu</div><div class="v">${currentEquip.lieux?.nom||'—'}</div></div>
  `;
  QRCode.toCanvas(document.getElementById('qrCanvas'), currentEquip.reference, { width:72, margin:1 });
  go('fiche');
}

async function updateStatut(){
  const nouveauStatut = document.getElementById('ficheStatutSelect').value;
  await sb.from('equipements').update({ statut: nouveauStatut }).eq('id', currentEquip.id);
  await loadAll();
  openDetail(currentEquip.id);
}

// ---------- Affectation ----------
function openAssign(){
  document.getElementById('assignRef').textContent = currentEquip.reference;
  go('affectation');
}

async function confirmAssign(){
  const personneId = document.getElementById('assignPersonne').value || null;
  const lieuId = document.getElementById('assignLieu').value || null;
  await sb.from('equipements').update({ utilisateur_id: personneId, lieu_id: lieuId, statut: 'En service' }).eq('id', currentEquip.id);
  await sb.from('affectations').insert({ equipement_id: currentEquip.id, personne_id: personneId, lieu_id: lieuId });
  document.getElementById('assignMsg').style.color = 'var(--status-service)';
  document.getElementById('assignMsg').textContent = 'Affectation enregistrée.';
  await loadAll();
  openDetail(currentEquip.id);
}

// ---------- Étiquette ----------
function renderLabel(){
  if(!currentEquip) return;
  document.getElementById('lblType').textContent = 'ParcIT — ' + currentEquip.type;
  document.getElementById('lblRef').textContent = currentEquip.reference;
  document.getElementById('lblModele').textContent = `${currentEquip.marque||''} ${currentEquip.modele||''}`.trim();
  document.getElementById('lblSerie').textContent = currentEquip.numero_serie ? 'N° série : ' + currentEquip.numero_serie : '';
  QRCode.toCanvas(document.getElementById('qrCanvasPrint'), currentEquip.reference, { width:70, margin:0 });
}
const origGo = go;
go = function(name, el){ origGo(name, el); if(name === 'etiquette') renderLabel(); };

// ---------- Scan QR ----------
function startScanner(){
  if(html5QrCode) return;
  html5QrCode = new Html5Qrcode("qrReader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 220 },
    (decodedText) => {
      const found = equipements.find(e => e.reference === decodedText.trim());
      const box = document.getElementById('scanResult');
      if(found){
        registerScanInventaire(found.id);
        box.innerHTML = `<div class="card"><b>${found.marque||''} ${found.modele||''}</b> <span class="mono">${found.reference}</span>
          <br><button class="btn" style="margin-top:10px;" onclick="stopScanner();openDetail('${found.id}')">Ouvrir la fiche</button></div>`;
      } else {
        box.innerHTML = `<div class="card">Aucun équipement ne correspond à ce code : <span class="mono">${decodedText}</span></div>`;
      }
    },
    () => {}
  ).catch(()=>{
    document.getElementById('qrReader').innerHTML = '<p style="color:var(--status-panne);">Impossible d\'accéder à la caméra. Vérifie les autorisations du navigateur.</p>';
  });
}
function stopScanner(){
  if(html5QrCode){ html5QrCode.stop().catch(()=>{}); html5QrCode = null; }
}

// ============================================================
// MAINTENANCE
// ============================================================
function ticketClass(statut){
  return { 'Ouvert':'open', 'En cours':'progress', 'Resolu':'done' }[statut] || 'open';
}

function renderMaintenance(){
  document.getElementById('maintCount').textContent = maintenances.length + ' tickets';
  document.getElementById('ticketsList').innerHTML = maintenances.length ? maintenances.map(t => `
    <div class="ticket ${ticketClass(t.statut)}">
      <div class="flag"></div>
      <div class="body">
        <div class="title">${t.equipements?.reference || '—'} — ${t.probleme}</div>
        <div class="foot">Déclaré le ${new Date(t.date_declaration).toLocaleDateString('fr-FR')}${t.intervenant ? ' — ' + t.intervenant : ''}</div>
        <select onchange="updateTicket('${t.id}', this.value)">
          <option ${t.statut==='Ouvert'?'selected':''}>Ouvert</option>
          <option ${t.statut==='En cours'?'selected':''}>En cours</option>
          <option ${t.statut==='Resolu'?'selected':''}>Resolu</option>
        </select>
      </div>
    </div>`).join('') : '<p style="color:var(--ink-faint);">Aucun ticket de maintenance.</p>';
}

function openNewTicket(){
  document.getElementById('t_equip').innerHTML = equipements.map(e => `<option value="${e.id}">${e.reference} — ${e.marque||''} ${e.modele||''}</option>`).join('');
  go('nouveau-ticket');
}

async function createTicket(){
  const equipId = document.getElementById('t_equip').value;
  const probleme = document.getElementById('t_probleme').value.trim();
  const msg = document.getElementById('ticketMsg');
  if(!probleme){ msg.style.color='var(--status-panne)'; msg.textContent='Décris le problème.'; return; }
  await sb.from('maintenances').insert({ equipement_id: equipId, probleme, statut:'Ouvert' });
  await sb.from('equipements').update({ statut:'En panne' }).eq('id', equipId);
  msg.style.color='var(--status-service)'; msg.textContent='Ticket créé.';
  await loadAll();
  go('maintenance');
}

async function updateTicket(id, statut){
  const payload = { statut };
  if(statut === 'Resolu') payload.date_resolution = new Date().toISOString();
  await sb.from('maintenances').update(payload).eq('id', id);
  if(statut === 'Resolu'){
    const ticket = maintenances.find(t => t.id === id);
    if(ticket) await sb.from('equipements').update({ statut:'En service' }).eq('id', ticket.equipement_id);
  }
  await loadAll();
}

// ============================================================
// INVENTAIRE
// ============================================================
function renderInventaire(){
  const active = campagnes.find(c => c.statut === 'En cours');
  document.getElementById('campagneSub').textContent = active ? 'Campagne active : ' + active.nom : 'Aucune campagne en cours';
  document.getElementById('btnNewCampagne').style.display = active ? 'none' : 'inline-flex';

  if(!active){
    document.getElementById('campagneZone').innerHTML = '<p style="color:var(--ink-faint);">Démarre une nouvelle campagne pour commencer le recensement.</p>';
    return;
  }
  loadScansCampagne(active.id);
}

async function createCampagne(){
  const nom = prompt("Nom de la campagne (ex: Inventaire Août 2026)", "Inventaire " + new Date().toLocaleDateString('fr-FR'));
  if(!nom) return;
  await sb.from('inventaire_campagnes').insert({ nom, statut:'En cours' });
  await loadAll();
}

async function loadScansCampagne(campagneId){
  const { data } = await sb.from('inventaire_scans').select('*, equipements(reference, marque, modele)').eq('campagne_id', campagneId);
  scansCampagneActive = data || [];
  const scannedIds = scansCampagneActive.map(s => s.equipement_id);
  const manquants = equipements.filter(e => !scannedIds.includes(e.id) && e.statut !== 'Au rebut');
  const pct = equipements.length ? Math.round((scannedIds.length / equipements.length) * 100) : 0;

  document.getElementById('campagneZone').innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <h3>Progression</h3>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink-soft);">
        <span>${scannedIds.length} / ${equipements.length} équipements scannés</span><span>${pct}%</span>
      </div>
      <div class="inv-progress"><div class="fill" style="width:${pct}%;"></div></div>
      <button class="btn" style="margin-top:10px;" onclick="go('scan')">Scanner un équipement</button>
    </div>
    <div class="card">
      <h3>Non encore trouvés (${manquants.length})</h3>
      ${manquants.length ? manquants.map(e => `<div class="inv-row"><span>${e.reference} — ${e.marque||''} ${e.modele||''}</span><span class="pill panne">Manquant</span></div>`).join('') : '<p style="color:var(--ink-faint);">Tout a été scanné 🎉</p>'}
    </div>`;
}

// Appelé automatiquement quand un scan réussit (voir startScanner) s'il y a une campagne active
async function registerScanInventaire(equipementId){
  const active = campagnes.find(c => c.statut === 'En cours');
  if(!active) return;
  const already = scansCampagneActive.find(s => s.equipement_id === equipementId);
  if(already) return;
  await sb.from('inventaire_scans').insert({ campagne_id: active.id, equipement_id: equipementId, trouve: true });
}

// ============================================================
// RAPPORTS
// ============================================================
function renderRapports(){
  const types = {};
  equipements.forEach(e => { types[e.type] = (types[e.type]||0) + 1; });
  const max = Math.max(1, ...Object.values(types));
  document.getElementById('typeChart').innerHTML = Object.entries(types).map(([type,n]) => `
    <div class="bar-row">
      <div class="lbl">${type}</div>
      <div class="track"><div class="fill" style="width:${(n/max*100)}%;"></div></div>
      <div class="val">${n}</div>
    </div>`).join('') || '<p style="color:var(--ink-faint);">Aucune donnée.</p>';

  const dans60j = new Date(); dans60j.setDate(dans60j.getDate() + 60);
  const expirant = equipements.filter(e => e.garantie_fin && new Date(e.garantie_fin) <= dans60j && new Date(e.garantie_fin) >= new Date());
  document.getElementById('warrantyList').innerHTML = expirant.length ? expirant.map(e => {
    const jours = Math.round((new Date(e.garantie_fin) - new Date()) / 86400000);
    return `<div class="warn-row"><span>${e.reference} — ${e.marque||''} ${e.modele||''}</span><span class="pill reparation">${jours} j</span></div>`;
  }).join('') : '<p style="color:var(--ink-faint);">Aucune garantie proche de l\'expiration.</p>';
}

function exportCSV(){
  const headers = ['Reference','Type','Marque','Modele','Statut','Utilisateur','Lieu','Garantie'];
  const rows = equipements.map(e => [e.reference, e.type, e.marque, e.modele, e.statut, e.personnes?.nom||'', e.lieux?.nom||'', e.garantie_fin||'']);
  const csv = [headers.join(';'), ...rows.map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(';'))].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'parc-informatique.csv';
  a.click();
}

// ============================================================
// ADMINISTRATION
// ============================================================
function renderAdmin(){
  document.getElementById('lieuxList').innerHTML = lieux.length ? lieux.map(l => `<div class="admin-row"><span>${l.nom}</span><span style="color:var(--ink-faint);">${l.type||''}</span></div>`).join('') : '<p style="color:var(--ink-faint);">Aucun lieu.</p>';
  document.getElementById('personnesList').innerHTML = personnes.length ? personnes.map(p => `<div class="admin-row"><span>${p.nom}</span><span style="color:var(--ink-faint);">${p.fonction||''}</span></div>`).join('') : '<p style="color:var(--ink-faint);">Aucune personne.</p>';
}

async function addLieu(){
  const nom = document.getElementById('newLieuNom').value.trim();
  if(!nom) return;
  await sb.from('lieux').insert({ nom });
  document.getElementById('newLieuNom').value = '';
  await loadAll();
}

async function addPersonne(){
  const nom = document.getElementById('newPersonneNom').value.trim();
  if(!nom) return;
  await sb.from('personnes').insert({ nom });
  document.getElementById('newPersonneNom').value = '';
  await loadAll();
}
