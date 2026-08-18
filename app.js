// ============================================================
// ParcIT — logique de l'application
// ============================================================
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let equipements = [];
let lieux = [];
let personnes = [];
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
  const [eqRes, lieuxRes, persRes] = await Promise.all([
    sb.from('equipements').select('*, lieux(nom), personnes(nom)').order('created_at', { ascending:false }),
    sb.from('lieux').select('*'),
    sb.from('personnes').select('*')
  ]);
  equipements = eqRes.data || [];
  lieux = lieuxRes.data || [];
  personnes = persRes.data || [];
  renderDashboard();
  renderEquipList();
  populateSelects();
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
  document.getElementById('materielCount').textContent = equipements.length + ' équipements enregistrés';
  const filtered = equipements.filter(e =>
    !q || (e.reference||'').toLowerCase().includes(q) || (e.modele||'').toLowerCase().includes(q) || (e.marque||'').toLowerCase().includes(q)
  );
  document.getElementById('equipTableBody').innerHTML = filtered.length ? filtered.map(e => `
    <tr onclick="openDetail('${e.id}')">
      <td><b>${e.marque||''} ${e.modele||''}</b><br><span style="color:var(--ink-faint);font-size:12px;">${e.type}</span></td>
      <td class="mono">${e.reference}</td>
      <td><span class="pill ${pillClass(e.statut)}">${e.statut}</span></td>
      <td>${e.personnes?.nom || '—'}</td>
      <td>${e.lieux?.nom || '—'}</td>
    </tr>`).join('') : '<tr><td colspan="5">Aucun résultat.</td></tr>';
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
