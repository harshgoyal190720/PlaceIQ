(function(){
  if(!window.isLoggedIn || !isLoggedIn()) return;
  if(getRole() !== 'admin'){ window.location.href='index.html'; return; }

  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  if(hamburger) hamburger.addEventListener('click', ()=> sidebar.classList.toggle('open'));

  document.querySelectorAll('.nav-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.section').forEach(sec=>sec.classList.remove('active'));
      document.getElementById(item.dataset.target).classList.add('active');
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });

  const charts = {};
  let overviewData = null;

  function skeletonList(container, count=5){
    container.innerHTML='';
    for(let i=0;i<count;i++){ const d=document.createElement('div'); d.className='skeleton'; container.appendChild(d); }
  }

  const studentsTable = document.getElementById('studentsTable');
  const studentsSkeleton = document.getElementById('studentsSkeleton');
  const companiesGrid = document.getElementById('companiesGrid');

  async function loadOverview(){
    try{
      const res = await fetch(`${API_BASE}/analytics/overview`, {headers:getHeaders()});
      overviewData = await res.json();
      renderOverview(overviewData);
      renderRecentActivity(overviewData.recent_activity || []);
      initCharts(overviewData);
    }catch(err){ showToast('Failed to load analytics','error'); }
  }

  function renderOverview(d){
    const cards = [
      {el:'statTotalStudents', label:'Total Students', value:d.total_students},
      {el:'statPlaced', label:'Total Offers', value:d.total_offers},
      {el:'statRate', label:'Placement Rate %', value:d.placement_rate},
      {el:'statCompanies', label:'Companies', value:d.total_companies},
      {el:'statApplications', label:'Applications', value:d.total_applications},
      {el:'statAvgPackage', label:'Avg Package (LPA)', value:d.avg_package}
    ];
    cards.forEach(c=>{
      const node = document.getElementById(c.el);
      node.innerHTML = `<div class='stat-label'>${c.label}</div><div class='stat-value'>${c.value}</div>`;
    });
  }

  function renderRecentActivity(list){
    const feed = document.getElementById('activityFeed');
    feed.innerHTML='';
    list.forEach(item=>{
      const d = document.createElement('div');
      d.className='item';
      d.innerHTML = `<strong>${item.student_name}</strong> &rarr; ${item.status} @ ${item.company_name} <br><span class='muted'>${new Date(item.applied_on).toLocaleString()}</span>`;
      feed.appendChild(d);
    });
  }

  function initCharts(d){
    const branchCtx = document.getElementById('branchChart');
    const sectorCtx = document.getElementById('sectorChart');
    const appsCtx = document.getElementById('applicationsChart');
    const skillsCtx = document.getElementById('skillsChart');

    charts.branch = new Chart(branchCtx, {type:'bar', data:{ labels:d.branch_stats.map(b=>b.branch), datasets:[{label:'Students', data:d.branch_stats.map(b=>b.count), backgroundColor:'#00D4AA'}]}, options:{scales:{x:{ticks:{color:'#cbd5e1'}}, y:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,0.08)'}}}, plugins:{legend:{labels:{color:'#e2e8f0'}}}}});

    const sectorLabels = d.sector_distribution.map(s=>s.sector);
    const sectorCounts = d.sector_distribution.map(s=>s.count);
    charts.sector = new Chart(sectorCtx, {type:'doughnut', data:{ labels:sectorLabels, datasets:[{data:sectorCounts, backgroundColor:['#00D4AA','#3B82F6','#F59E0B','#FF6B6B','#8b5cf6']}]}, options:{plugins:{legend:{labels:{color:'#e2e8f0'}}}}});

    const mockDates = Array.from({length:30},(_,i)=>{ const dt=new Date(); dt.setDate(dt.getDate()-i); return dt.toLocaleDateString(); }).reverse();
    const mockVals = mockDates.map(()=> Math.floor(Math.random()*6)+2);
    charts.apps = new Chart(appsCtx, {type:'line', data:{labels:mockDates, datasets:[{label:'Applications', data:mockVals, borderColor:'#00D4AA', fill:false}]}, options:{scales:{x:{ticks:{color:'#cbd5e1'}}, y:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,0.08)'}}}}});

    charts.skills = new Chart(skillsCtx, {type:'bar', data:{labels:d.skill_demand.map(s=>s.skill), datasets:[{label:'Demand', data:d.skill_demand.map(s=>s.count), backgroundColor:'#3B82F6'}]}, options:{indexAxis:'y', scales:{x:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,0.08)'}}, y:{ticks:{color:'#cbd5e1'}}}}});
  }

  let studentsCache = [];
  async function loadStudents(){
    skeletonList(studentsSkeleton,6);
    try{
      const res = await fetch(`${API_BASE}/students/all`, {headers:getHeaders()});
      if(!res.ok) throw new Error('students load failed');
      studentsCache = await res.json();
      studentsSkeleton.innerHTML='';
      renderStudents(studentsCache);
      renderTopStudents(studentsCache);
    }catch(err){ showToast('Failed to load students','error'); }
  }

  function renderStudents(list){
    studentsTable.innerHTML = '<tr><th>Name</th><th>Branch</th><th>CGPA</th><th>Skills</th><th>Applications</th><th>Status</th><th>Readiness%</th></tr>';
    list.forEach(s=>{
      const row = document.createElement('tr');
      const readiness = Math.min(100, Math.round((s.cgpa/10*50) + (s.skills.length*5)));
      row.innerHTML = `
        <td>${s.name}</td>
        <td>${s.branch}</td>
        <td>${s.cgpa}</td>
        <td>${(s.skills||[]).slice(0,3).map(sk=>`<span class='pill'>${sk}</span>`).join('')}</td>
        <td>${s.applications_count || 0}</td>
        <td><span class='badge ${s.offers>0?'excellent':'good'}'>${s.offers>0?'Placed':'Active'}</span></td>
        <td>${readiness}</td>
      `;
      studentsTable.appendChild(row);
    });
  }

  function renderTopStudents(list){
    const topTable = document.getElementById('topStudents');
    if(!topTable) return;
    const ranked = [...list].map(s=>{
      const readiness = Math.min(100, Math.round((s.cgpa/10*50) + (s.skills.length*5) + (s.offers||0)*15));
      return {...s, readiness};
    }).sort((a,b)=> b.readiness - a.readiness).slice(0,5);
    topTable.innerHTML = '<tr><th>Name</th><th>Branch</th><th>CGPA</th><th>Readiness</th></tr>';
    ranked.forEach(s=>{
      const row = document.createElement('tr');
      row.innerHTML = `<td>${s.name}</td><td>${s.branch}</td><td>${s.cgpa}</td><td>${s.readiness}</td>`;
      topTable.appendChild(row);
    });
  }

  async function loadCompanies(){
    try{
      const res = await fetch(`${API_BASE}/companies`, {headers:getHeaders()});
      if(!res.ok) throw new Error('companies load failed');
      const companies = await res.json();
      companiesGrid.innerHTML='';
      companies.forEach(c=>{
        const card=document.createElement('div');
        card.className='card company-card';
        card.innerHTML=`
          <div class='company-head'><div class='company-logo'>${c.name[0]}</div><div><strong>${c.name}</strong><div class='muted'>${c.sector}</div></div></div>
          <div class='muted'>CGPA >= ${c.required_cgpa}</div>
          <div class='pill-row'>${c.required_skills.map(s=>`<span class='pill'>${s}</span>`).join('')}</div>
          <div class='muted'>Rounds: ${c.rounds} - Package: Rs ${c.package} LPA</div>
        `;
        companiesGrid.appendChild(card);
      });
      buildAlerts(companies);
    }catch(err){ showToast('Failed to load companies','error'); }
  }

  function buildAlerts(companies){
    const zeroApps = document.getElementById('alertZeroApps');
    const highCgpa = document.getElementById('alertHighCgpa');
    const deadlines = document.getElementById('alertDeadlines');
    zeroApps.innerHTML=''; highCgpa.innerHTML=''; deadlines.innerHTML='';
    studentsCache.filter(s=>s.applications_count===0).forEach(s=>{ zeroApps.innerHTML += `<div class='item'>${s.name} (${s.branch})</div>`; });
    studentsCache.filter(s=>s.cgpa>=7.5 && s.applications_count<2).forEach(s=>{ highCgpa.innerHTML += `<div class='item'>${s.name} - CGPA ${s.cgpa}</div>`; });
    companies.slice(0,5).forEach((c,i)=>{ const dt=new Date(); dt.setDate(dt.getDate()+i+2); deadlines.innerHTML += `<div class='item'>${c.name} - ${dt.toLocaleDateString()}</div>`; });
  }

  // Search and filters
  document.getElementById('search').addEventListener('input', debounce(filterStudents,300));
  document.getElementById('branchFilter').addEventListener('change', filterStudents);
  document.getElementById('cgpaFilter').addEventListener('change', filterStudents);
  document.getElementById('placedFilter').addEventListener('change', filterStudents);

  function filterStudents(){
    const q = document.getElementById('search').value.toLowerCase();
    const branch = document.getElementById('branchFilter').value;
    const cgpa = Number(document.getElementById('cgpaFilter').value||0);
    const placed = document.getElementById('placedFilter').value;
    const filtered = studentsCache.filter(s=>{
      const matchesQ = s.name.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q) || (s.skills||[]).some(sk=>sk.toLowerCase().includes(q));
      const matchesBranch = !branch || s.branch===branch;
      const matchesCgpa = !cgpa || s.cgpa >= cgpa;
      const matchesPlaced = !placed || (placed==='placed'? s.offers>0 : s.offers===0);
      return matchesQ && matchesBranch && matchesCgpa && matchesPlaced;
    });
    renderStudents(filtered);
  }

  function debounce(fn, delay){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }

  // Export CSV
  document.getElementById('exportCsv').addEventListener('click', ()=>{
    const headers = ['Name','Branch','CGPA','Skills','Applications','Offers'];
    const rows = studentsCache.map(s=>[s.name, s.branch, s.cgpa, (s.skills||[]).join('|'), s.applications_count||0, s.offers||0]);
    const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='students.csv'; a.click(); URL.revokeObjectURL(url);
  });

  // Add company form
  const formPanel = document.getElementById('companyFormPanel');
  document.getElementById('addCompanyBtn').addEventListener('click', ()=> formPanel.classList.add('active'));
  document.getElementById('closeForm').addEventListener('click', ()=> formPanel.classList.remove('active'));
  document.getElementById('companyForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value,
      package: Number(form.package.value),
      required_cgpa: Number(form.required_cgpa.value),
      required_skills: form.required_skills.value.split(',').map(s=>s.trim()).filter(Boolean),
      sector: form.sector.value,
      rounds: Number(form.rounds.value)
    };
    const res = await fetch(`${API_BASE}/companies`, {method:'POST', headers:getHeaders(), body: JSON.stringify(payload)});
    if(res.ok){ showToast('Company added','success'); form.reset(); formPanel.classList.remove('active'); loadCompanies(); }
    else showToast('Failed to add company','error');
  });

  loadOverview();
  loadStudents();
  loadCompanies();
})();

