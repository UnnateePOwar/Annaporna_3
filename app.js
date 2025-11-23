const STORAGE_KEYS = {
  REQUESTS: 'foodbridge_requests_v1',
  USERS: 'foodbridge_users_v1',
  SESSION: 'foodbridge_session_v1'
};

function loadRequests(){const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);if(!raw) return [];try{return JSON.parse(raw);}catch(e){console.error(e);return []}}
function saveRequests(requests){localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests))}
function createRequest(obj){const requests = loadRequests();const id = Date.now() + Math.floor(Math.random()*1000);const newReq = {id,created_date:new Date().toISOString(),status:'active',...obj};requests.unshift(newReq);saveRequests(requests);return newReq}
function updateRequest(id, updates){const requests = loadRequests();const idx = requests.findIndex(r => r.id === id);if(idx>=0){requests[idx] = {...requests[idx], ...updates};saveRequests(requests)}}

function getUsers(){const raw = localStorage.getItem(STORAGE_KEYS.USERS);if(!raw) return {};try{return JSON.parse(raw);}catch(e){return {}}}
function saveUsers(u){localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(u))}
function getSession(){const raw = localStorage.getItem(STORAGE_KEYS.SESSION);if(!raw) return null;try{return JSON.parse(raw);}catch(e){return null}}
function saveSession(s){localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(s))}
function clearSession(){localStorage.removeItem(STORAGE_KEYS.SESSION)}

(function seed(){if(loadRequests().length===0){createRequest({requester_name:'Dia Sharma(Mock)',contact_phone:'+91 9988776655',address:'123 Park Lane',city:'Mumbai',state:'MH',zip_code:'400001',latitude:19.0760,longitude:72.8777,household_size:4,dietary_restrictions:'',urgency_level:'medium',food_types_needed:['meals','bread'],additional_notes:'Can collect after 5pm'});createRequest({requester_name:'Ravi Kumar',contact_phone:'+91 8877665544',address:'45 Main Road',city:'Delhi',state:'DL',zip_code:'110001',latitude:28.6139,longitude:77.2090,household_size:2,dietary_restrictions:'vegetarian',urgency_level:'high',food_types_needed:['fresh_produce','snacks'],additional_notes:''});}})()

const root = document.getElementById('view');
const pageTitle = document.getElementById('pageTitle');
const userSummary = document.getElementById('userSummary');
const quickActions = document.getElementById('quickActions');

function renderSidebarQuickActions(){
  const session = getSession();
  quickActions.innerHTML = '';
  const actions = [
    {title:'Request Food', show: !session || session.user_type==='recipient' || session.user_type==='both', href:'#request'},
    {title:'Help Others', show: !session || session.user_type==='donor' || session.user_type==='both', href:'#browse'},
  ];
  actions.forEach(a=>{
    if(a.show){
      const el = document.createElement('div');
      el.className='action';
      el.innerHTML = '<div style="font-size:18px">➕</div><div><div class="title">'+a.title+'</div><div class="muted small">'+(a.href)+'</div></div>';
      el.onclick = ()=> location.hash = a.href;
      quickActions.appendChild(el);
    }
  });
  if(!session){
    const sign = document.createElement('div');
    sign.className='signin';
    sign.textContent='Sign In / Register';
    sign.onclick = ()=> location.hash = '#profile';
    quickActions.appendChild(sign);
  } else {
    const out = document.createElement('div');
    out.className='action';
    out.innerHTML = '<div style="font-size:18px">👤</div><div><div class="title">Signed in as</div><div class="muted small">'+escapeHtml(session.full_name)+'</div></div>';
    out.onclick = ()=> location.hash = '#profile';
    quickActions.appendChild(out);
  }
}

function renderUserSummary(){
  const s = getSession();
  if(!s){
    userSummary.innerHTML = '<button class="button" onclick="location.hash=\'#profile\'">Sign In / Profile</button>';
    return;
  }
  userSummary.innerHTML = '<div style="text-align:right"><strong>'+escapeHtml(s.full_name || 'User')+'</strong><br><small>'+escapeHtml(s.user_type || 'Community Member')+'</small></div>';
}

function escapeHtml(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

window.addEventListener('hashchange', ()=> navigateTo(location.hash));
function navigateTo(hash){const h = (hash || '#home').replace('#','');if(h==='') return navigateTo('#home');const routes = {home: renderHome, request: renderRequestForm, browse: renderBrowse, profile: renderProfile};const fn = routes[h] || renderHome;fn();}navigateTo(location.hash);

function renderHome(){
  pageTitle.textContent = 'Community Map';
  root.innerHTML = '';
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="card"><h3>Welcome to Food Bridge</h3><p>Connecting donors with families in need.</p></div>
    <div class="card"><h3>Stats Overview</h3><div id="stats"></div></div>
    <div class="card"><h3>Local Area Map</h3><div id="map" class="fade-in"></div></div>
  `;
  root.appendChild(container);
  renderStats();
  initMapLocalArea();
}

function renderStats(){
  const statsEl = document.getElementById('stats');
  const requests = loadRequests();
  const families = requests.reduce((s,r)=> s + (Number(r.household_size)||0),0);
  const cities = new Set(requests.map(r=> r.city).filter(Boolean)).size;
  const critical = requests.filter(r=> r.urgency_level==='critical').length;
  statsEl.innerHTML = '<div style="display:flex;gap:12px"><div class="card small">Active<br><strong>'+requests.length+'</strong></div><div class="card small">Families<br><strong>'+families+'</strong></div><div class="card small">Cities<br><strong>'+cities+'</strong></div><div class="card small">Critical<br><strong>'+critical+'</strong></div></div>';
}

let leafletMap;
function initMapLocalArea(){
  const mapEl = document.getElementById('map');
  mapEl.style.height = '420px';
  if(leafletMap) leafletMap.remove();
  const defaultCenter = [20.5937,78.9629];
  leafletMap = L.map(mapEl).setView(defaultCenter, 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(leafletMap);

  let added = false;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      leafletMap.setView([lat, lon], 12);
      L.circle([lat, lon], {radius:1000, color:'#10b981', fillOpacity:0.05}).addTo(leafletMap);
      addNearbyMarkers(lat, lon, 12);
      added = true;
    }, ()=>{ addNearbyMarkers(defaultCenter[0], defaultCenter[1], 5); });
  } else {
    addNearbyMarkers(defaultCenter[0], defaultCenter[1], 5);
  }
  setTimeout(()=>{ if(!added) addNearbyMarkers(defaultCenter[0], defaultCenter[1], 5); }, 900);
}

function addNearbyMarkers(lat, lon, zoom){
  const reqs = loadRequests().filter(r=> r.latitude && r.longitude);
  reqs.forEach(r=>{
    const marker = L.marker([r.latitude, r.longitude]).addTo(leafletMap);
    const html = `<strong>${escapeHtml(r.requester_name)}</strong><br>${escapeHtml(r.city||'')}<br><span class="badge">${escapeHtml(r.urgency_level)}</span><br>Household: ${escapeHtml(r.household_size)}`;
    marker.bindPopup(html);
  });
}

function renderRequestForm(){
  pageTitle.textContent = 'Request Food Assistance';
  root.innerHTML = '';
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="card">
      <h3>Food Assistance Request Form</h3>
      <form id="requestForm">
        <div class="form-row">
          <div>
            <label for="requester_name">Your Name *</label>
            <input id="requester_name" class="input" required />
          </div>
          <div>
            <label for="contact_phone">Phone Number *</label>
            <input id="contact_phone" class="input" required />
          </div>
        </div>
        <div>
          <label for="address">Street Address *</label>
          <input id="address" class="input" required />
        </div>
        <div class="form-row">
          <div><label for="city">City *</label><input id="city" class="input" required /></div>
          <div><label for="state">State</label><input id="state" class="input" /></div>
        </div>
        <div class="form-row">
          <div><label for="household_size">Number of People *</label><input id="household_size" type="number" min="1" class="input" value="1" required /></div>
          <div><label for="urgency_level">Urgency Level</label>
            <select id="urgency_level" class="input">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div>
          <label for="dietary_restrictions">Dietary Restrictions</label>
          <input id="dietary_restrictions" class="input" placeholder="e.g., vegetarian, nut allergy" />
        </div>
        <div>
          <label>Types of Food Needed</label>
          <div id="foodTypes" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px"></div>
        </div>
        <div>
          <label for="additional_notes">Additional Notes</label>
          <textarea id="additional_notes" rows="3" class="input"></textarea>
        </div>
        <div style="margin-top:12px">
          <button class="button" type="submit">Submit Food Request</button>
        </div>
      </form>
    </div>
  `;
  root.appendChild(el);
  const foodTypes = [
    {id:'fresh_produce', label:'Fresh Produce'},
    {id:'canned_goods', label:'Canned Goods'},
    {id:'dairy', label:'Dairy'},
    {id:'meat', label:'Meat'},
    {id:'bread', label:'Bread & Grains'},
    {id:'baby_food', label:'Baby Food'},
    {id:'snacks', label:'Snacks'},
    {id:'beverages', label:'Beverages'},
    {id:'meals', label:'Prepared Meals'}
  ];
  const ftEl = document.getElementById('foodTypes');
  foodTypes.forEach(t=>{
    const d = document.createElement('div');
    d.innerHTML = `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" value="${t.id}" /> <span>${t.label}</span></label>`;
    ftEl.appendChild(d);
  });

  document.getElementById('requestForm').onsubmit = async (e)=>{
    e.preventDefault();
    const form = e.target;
    const data = {
      requester_name: form.requester_name.value.trim(),
      contact_phone: form.contact_phone.value.trim().replace(/[^\d+]/g,''),
      address: form.address.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      zip_code: '',
      household_size: Number(form.household_size.value) || 1,
      dietary_restrictions: form.dietary_restrictions.value.trim(),
      urgency_level: form.urgency_level.value,
      food_types_needed: Array.from(ftEl.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.value),
      additional_notes: form.additional_notes.value.trim()
    };
    const coords = await geocodeAddress(`${data.address}, ${data.city} ${data.state}`);
    if(coords){data.latitude = coords.lat;data.longitude = coords.lon}else{data.latitude = null;data.longitude = null}
    createRequest(data);
    alert('Request submitted! Redirecting to Home.');
    location.hash = '#home';
  };
}

async function geocodeAddress(query){
  try{
    const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query);
    const res = await fetch(url, {headers:{'Accept':'application/json','User-Agent':'FoodBridgeApp/1.0 (you@example.com)'}});
    const arr = await res.json();
    if(arr && arr.length>0){return {lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon)}}
  }catch(err){console.error('Geocode error', err)}
  return null;
}

function renderBrowse(){
  pageTitle.textContent = 'Browse Requests';
  root.innerHTML = '';
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="card">
      <h3>Filter Requests</h3>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input id="searchTerm" class="input" placeholder="Search by name, city, notes..." />
        <select id="urgencyFilter" class="input" style="width:160px">
          <option value="all">All Urgency Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium" selected>Medium</option>
          <option value="low">Low</option>
        </select>
        <button id="applyFilter" class="button">Apply</button>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center"><h3>Requests</h3><div id="summaryText"></div></div>
      <div id="requestsGrid" class="request-list" style="margin-top:12px"></div>
    </div>
  `;
  root.appendChild(container);
  document.getElementById('applyFilter').onclick = renderRequestsGrid;
  renderRequestsGrid();
}

function renderRequestsGrid(){
  const search = document.getElementById('searchTerm') ? document.getElementById('searchTerm').value.toLowerCase() : '';
  const urgency = document.getElementById('urgencyFilter') ? document.getElementById('urgencyFilter').value : 'all';
  let requests = loadRequests();
  if(search){
    requests = requests.filter(r => (r.requester_name||'').toLowerCase().includes(search) || (r.city||'').toLowerCase().includes(search) || (r.additional_notes||'').toLowerCase().includes(search));
  }
  if(urgency !== 'all') requests = requests.filter(r=> r.urgency_level === urgency);
  const grid = document.getElementById('requestsGrid');
  grid.innerHTML = '';
  if(requests.length===0){grid.innerHTML = '<div class="small">No requests found</div>'}
  requests.forEach(r=>{
    const card = document.createElement('div');
    card.className = 'request fade-in';
    card.innerHTML = `<h4>${escapeHtml(r.requester_name)}</h4>
      <div class="small">${escapeHtml(r.address)}, ${escapeHtml(r.city)}</div>
      <div style="margin-top:8px"><strong>${escapeHtml(r.household_size)} people</strong> • <span class="badge">${escapeHtml(r.urgency_level)}</span></div>
      <div style="margin-top:8px">${r.food_types_needed ? r.food_types_needed.slice(0,3).join(', ') : ''}</div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="button" onclick="contactRequest(${r.id})">Help This Family</button>
        <button onclick="openInMaps('${escapeHtml(r.address)}','${escapeHtml(r.city)}')" style="padding:8px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer">Directions</button>
      </div>
    `;
    grid.appendChild(card);
  });
  document.getElementById('summaryText').innerHTML = `Showing <strong>${requests.length}</strong> requests`;
}

function contactRequest(id){
  const requests = loadRequests();
  const r = requests.find(x=> x.id===id);
  if(!r) return alert('Request not found');
  const tel = r.contact_phone || '';
  if(tel){window.open('tel:' + tel, '_self')} else {alert('Phone number not available')}
}

function openInMaps(address, city){
  const full = `${address}, ${city}`;
  const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(full);
  window.open(url,'_blank');
}

function renderProfile(){
  pageTitle.textContent = 'My Profile';
  root.innerHTML = '';
  const user = getSession() || {};
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="card">
      <h3>Profile / Sign In</h3>
      <div id="authWrap">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <button id="showLogin" class="button">Login</button>
          <button id="showRegister" class="button">Register</button>
          <button id="signOutBtn" class="button" style="background:#fff;color:#064e3b;border:1px solid #ddd;display:none">Sign Out</button>
        </div>
        <div id="authArea"></div>
      </div>
    </div>
  `;
  root.appendChild(el);
  const signOutBtn = document.getElementById('signOutBtn');
  if(getSession()) signOutBtn.style.display = 'inline-block';
  signOutBtn.onclick = ()=>{clearSession();renderUserSummary();renderSidebarQuickActions();location.hash='#home'}
  document.getElementById('showLogin').onclick = ()=> renderLogin();
  document.getElementById('showRegister').onclick = ()=> renderRegister();
  renderAuthUI();
}

function renderAuthUI(){const authArea = document.getElementById('authArea');authArea.innerHTML='';if(getSession()){authArea.innerHTML = `<div class="small">Signed in as <strong>${escapeHtml(getSession().full_name)}</strong></div><div class="footer-note">Change details by registering a new account.</div>`;return}renderLogin()}

function renderLogin(){
  const authArea = document.getElementById('authArea');
  authArea.innerHTML = `
    <form id="loginForm">
      <div><label for="login_email">Email</label><input id="login_email" class="input" type="email" required /></div>
      <div><label for="login_password">Password</label><input id="login_password" class="input" type="password" required /></div>
      <div style="margin-top:10px"><button class="button" type="submit">Login</button></div>
    </form>
  `;
  document.getElementById('loginForm').onsubmit = async (e)=>{
    e.preventDefault();
    const email = document.getElementById('login_email').value.trim().toLowerCase();
    const pass = document.getElementById('login_password').value;
    const users = getUsers();
    if(!users[email]) return alert('Account not found');
    const hash = await sha256(pass);
    if(hash !== users[email].passwordHash) return alert('Incorrect password');
    const sess = {email,full_name:users[email].full_name,user_type:users[email].user_type};
    saveSession(sess);
    alert('Signed in');
    renderUserSummary();
    renderSidebarQuickActions();
    location.hash = '#home';
  };
}

function renderRegister(){
  const authArea = document.getElementById('authArea');
  authArea.innerHTML = `
    <form id="registerForm">
      <div><label for="reg_name">Full Name</label><input id="reg_name" class="input" required /></div>
      <div><label for="reg_email">Email</label><input id="reg_email" class="input" type="email" required /></div>
      <div><label for="reg_password">Password</label><input id="reg_password" class="input" type="password" required /></div>
      <div><label for="reg_type">I am a...</label>
        <select id="reg_type" class="input">
          <option value="">Select</option>
          <option value="donor">Food Donor</option>
          <option value="recipient">Person in Need</option>
          <option value="both">Both</option>
        </select>
      </div>
      <div style="margin-top:10px"><button class="button" type="submit">Register</button></div>
    </form>
  `;
  document.getElementById('registerForm').onsubmit = async (e)=>{
    e.preventDefault();
    const name = document.getElementById('reg_name').value.trim();
    const email = document.getElementById('reg_email').value.trim().toLowerCase();
    const pass = document.getElementById('reg_password').value;
    const type = document.getElementById('reg_type').value;
    if(!email || !pass) return alert('Provide email and password');
    const users = getUsers();
    if(users[email]) return alert('Account already exists');
    const hash = await sha256(pass);
    users[email] = {full_name:name,email,passwordHash:hash,user_type:type};
    saveUsers(users);
    saveSession({email,full_name:name,user_type:type});
    alert('Registered and signed in');
    renderUserSummary();
    renderSidebarQuickActions();
    location.hash = '#home';
  };
}

async function sha256(message){
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b=>b.toString(16).padStart(2,'0')).join('');
}

renderUserSummary();
renderSidebarQuickActions();
