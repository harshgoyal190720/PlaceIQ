(function(){
  console.log('student.js start');
  if (!window.isLoggedIn) { alert('Auth script failed to load'); return; }
  if (!isLoggedIn()) return;

  const API_BASE = window.API_BASE || 'http://localhost:8600';
  const studentId = localStorage.getItem('placeiq_student_id');
  if(!studentId){ alert('No student id found. Please login again.'); logout(); return; }

  const recsGrid = document.getElementById('recsGrid');
  const recsSkeleton = document.getElementById('recsSkeleton');
  const appsTimeline = document.getElementById('appsTimeline');
  const appsSkeleton = document.getElementById('appsSkeleton');
  const readinessRing = document.getElementById('readinessRing');
  const readinessValue = document.getElementById('readinessValue');
  let radarChart;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
      document.getElementById(item.dataset.target).classList.add('active');
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });

  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  if(hamburger) hamburger.addEventListener('click', ()=> sidebar.classList.toggle('open'));

  function skeletonCards(container, count=6){
    container.innerHTML = '';
    for(let i=0;i<count;i++){
      const div = document.createElement('div');
      div.className='skeleton';
      container.appendChild(div);
    }
  }
  skeletonCards(recsSkeleton,6);
  skeletonCards(appsSkeleton,4);

  async function fetchStudent(){
    const res = await fetch(`${API_BASE}/students/me`, {headers: getHeaders()});
    if(!res.ok){ const txt = await res.text(); throw new Error(`Profile load failed ${res.status}: ${txt}`); }
    const data = await res.json();
    populateProfile(data);
    return data;
  }

  function populateProfile(s){
    document.getElementById('studentName').textContent = s.name;
    document.getElementById('studentBranch').textContent = s.branch;
    document.getElementById('avatar').textContent = (s.name||'PIQ').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('profileName').textContent = s.name;
    document.getElementById('profileEmail').textContent = s.email;
    document.getElementById('profileBranch').textContent = s.branch;
    document.getElementById('profileCgpa').textContent = s.cgpa;
    document.getElementById('profileYear').textContent = s.year;
    document.getElementById('profileProjects').textContent = s.projects;
    document.getElementById('profileInternships').textContent = s.internships;
    document.getElementById('profileBacklogs').textContent = s.backlogs;
    const skillsRow = document.getElementById('profileSkills');
    skillsRow.innerHTML = '';
    (s.skills||[]).forEach(sk=>{
      const pill = document.createElement('span');
      pill.className = 'pill teal';
      pill.textContent = sk;
      skillsRow.appendChild(pill);
    });
  }

  function animateRing(value){
    const circumference = 326;
    const offset = circumference - (value/100)*circumference;
    readinessRing.style.strokeDashoffset = offset;
    readinessValue.textContent = Math.round(value);
  }

  function countUp(el, to){
    let start=0; const step = () => {
      start += Math.max(1, Math.floor(to/20));
      if(start >= to){ el.textContent = to; return; }
      el.textContent = start; requestAnimationFrame(step);
    }; step();
  }

  function buildDeadlines(companies){
    const container = document.getElementById('deadlinesList');
    container.innerHTML = '';
    companies.slice(0,4).forEach((c,i)=>{
      const d = document.createElement('div');
      d.className='item';
      const date = new Date(); date.setDate(date.getDate()+ (i+1)*3);
      const remaining = Math.max(1, Math.floor((date - new Date())/(1000*60*60*24)));
      d.innerHTML = `<strong>${c.name}</strong><br><span class='muted'>Deadline: ${date.toLocaleDateString()} · ${remaining} days left</span>`;
      container.appendChild(d);
    });
  }

  function renderRadar(student, topCompany){
    const ctx = document.getElementById('radarChart');
    if(!ctx) return;
    const labels = (topCompany?.required_skills || student.skills || []).slice(0,6);
    const studentData = labels.map(l => student.skills.includes(l) ? 1 : 0.4);
    const companyData = labels.map(()=>1);
    if(radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          { label: 'You', data: studentData, backgroundColor: 'rgba(0,212,170,0.2)', borderColor: '#00D4AA' },
          { label: topCompany?.name || 'Target', data: companyData, backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' }
        ]
      },
      options: { plugins:{legend:{labels:{color:'#cbd5e1'}}}, scales:{ r:{ angleLines:{color:'rgba(255,255,255,0.08)'}, grid:{color:'rgba(255,255,255,0.08)'}, pointLabels:{color:'#e2e8f0'}, ticks:{display:false} } }, responsive:true }
    });
  }

  function renderRecommendations(data){
    recsSkeleton.innerHTML=''; recsGrid.innerHTML='';
    data.forEach((c,idx)=>{
      const card = document.createElement('div');
      card.className='card company-card';
      card.style.animationDelay = `${idx*0.1}s`;
      const probColor = c.selection_probability>70 ? 'teal' : c.selection_probability>40 ? 'amber' : 'coral';
      card.innerHTML = `
        <div class='company-head'>
          <div class='company-logo'>${c.name[0]}</div>
          <div>
            <div><strong>${c.name}</strong></div>
            <div class='muted'>₹${c.package} LPA · ${c.sector}</div>
          </div>
          <span class='badge ${c.match_label.toLowerCase() === 'excellent' ? 'excellent' : c.match_label.toLowerCase()==='good'?'good':'fair'}'>${c.match_label} Match</span>
        </div>
        <div class='bar'><div class='bar-fill' style='width:${c.skill_match_score*100}%' ></div></div>
        <div class='stat-value ${probColor}'>${c.selection_probability}%</div>
        <div class='muted'>Selection probability</div>
        <div class='pill-row'>${(c.missing_skills||[]).map(ms=>`<span class='pill coral'>${ms}</span>`).join('')}</div>
        <button class='primary' ${c.already_applied?'disabled':''}>Apply Now</button>
      `;
      recsGrid.appendChild(card);
    });
  }

  function renderApplications(apps){
    appsSkeleton.innerHTML=''; appsTimeline.innerHTML='';
    let shortlisted=0, offers=0;
    apps.forEach(app=>{
      if(app.status==='shortlisted') shortlisted++; if(app.status==='offer') offers++;
      const item = document.createElement('div');
      item.className='timeline-item';
      item.innerHTML = `
        <div><strong>${app.company_name}</strong> · ₹${app.package} LPA</div>
        <div class='status ${app.status}'>${app.status}</div>
        <div class='muted'>Applied on ${new Date(app.applied_on).toLocaleDateString()}</div>
      `;
      appsTimeline.appendChild(item);
    });
    countUp(document.getElementById('statShortlisted'), shortlisted);
    countUp(document.getElementById('statOffers'), offers);
    countUp(document.getElementById('statApplications'), apps.length);
  }

  function computeReadiness(student, apps){
    const skillAvg = Math.min(student.skills.length/8, 1);
    const cgpaNorm = Math.min(student.cgpa/10, 1);
    const appsSent = Math.min(apps.length, 10);
    const score = Math.min(100, (skillAvg*100*0.4) + (cgpaNorm*100*0.3) + (appsSent*5) + (student.projects*5) + (student.internships*10));
    animateRing(score);
  }

  async function loadAll(){
    try {
      const student = await fetchStudent();
      const [recsRes, appsRes] = await Promise.all([
        fetch(`${API_BASE}/students/recommendations/${student._id}`, {headers: getHeaders()}),
        fetch(`${API_BASE}/applications/student/${student._id}`, {headers: getHeaders()})
      ]);
      const recs = recsRes.ok ? await recsRes.json() : [];
      const apps = appsRes.ok ? await appsRes.json() : [];
      renderRecommendations(recs);
      renderApplications(apps);
      computeReadiness(student, apps);
      buildDeadlines(recs);
      renderRadar(student, recs[0]);
    } catch (err){
      alert(`Dashboard load failed: ${err.message}`);
      showToast(err.message || 'Failed to load dashboard', 'error');
      console.error(err);
    }
  }

  // AI Advisor
  const adviceBtn = document.getElementById('adviceBtn');
  const refreshAdvice = document.getElementById('refreshAdvice');
  const adviceLoader = document.getElementById('adviceLoader');
  const adviceCards = document.getElementById('adviceCards');
  const adviceScore = document.getElementById('adviceScore');
  const adviceSummary = document.getElementById('adviceSummary');
  if(adviceLoader){ adviceLoader.innerHTML = '<span></span><span></span><span></span>'; }

  async function fetchAdvice(){
    console.log('AI advice click', `${API_BASE}/students/ai-advice/${studentId}`);
    adviceLoader.classList.remove('hidden');
    adviceCards.innerHTML='';
    try{
      const res = await fetch(`${API_BASE}/students/ai-advice/${studentId}`, {headers: getHeaders()});
      if(!res.ok){ const t = await res.text(); throw new Error(`API ${res.status}: ${t}`); }
      const data = await res.json();
      console.log('AI advice response', data);
      renderAdvice(data);
      showToast('AI advice updated','success');
    }catch(err){
      alert(`AI advice error: ${err.message}`);
      showToast('AI advice unavailable', 'warning');
      console.error(err);
    } finally {
      adviceLoader.classList.add('hidden');
    }
  }

  function renderAdvice(data){
    adviceCards.innerHTML='';
    (data.steps||[]).forEach(step=>{
      const card = document.createElement('div');
      card.className='card';
      const priorityColor = step.priority==='high'?'coral':step.priority==='medium'?'amber':'teal';
      card.innerHTML = `
        <div class='badge ${priorityColor}'>${step.icon || '✅'} ${step.priority?.toUpperCase()}</div>
        <h3>${step.action}</h3>
        <p class='muted'>${step.reason}</p>
        <span class='pill'>Deadline: ${step.deadline}</span>
      `;
      adviceCards.appendChild(card);
    });
    adviceScore.textContent = data.readiness_score ?? '--';
    adviceSummary.textContent = data.summary || '';
    const angle = Math.min(180, Math.max(0, (data.readiness_score||0)/100*180));
    document.getElementById('gaugeNeedle').style.transform = `rotate(${angle-90}deg)`;
  }

  // Resume upload & prediction
  const uploadBtn = document.getElementById('uploadResume');
  const resumeFile = document.getElementById('resumeFile');
  const resumeStatus = document.getElementById('resumeStatus');
  const resumePredictions = document.getElementById('resumePredictions');

  if(uploadBtn){
    uploadBtn.addEventListener('click', async ()=>{
      if(!resumeFile.files.length){ alert('Choose a resume PDF or TXT'); return; }
      const file = resumeFile.files[0];
      resumeStatus.textContent = 'Uploading...';
      const form = new FormData();
      form.append('file', file);
      try{
        const res = await fetch(`${API_BASE}/students/resume/${studentId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` },
          body: form
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || 'Upload failed');
        resumeStatus.textContent = `Extracted ${data.chars} characters`;
        await loadResumePredictions();
      }catch(err){
        resumeStatus.textContent = err.message;
      }
    });
  }

  async function loadResumePredictions(){
    try{
      const res = await fetch(`${API_BASE}/students/resume-prediction/${studentId}`, {headers:getHeaders()});
      if(!res.ok){ const t=await res.text(); throw new Error(t); }
      const data = await res.json();
      renderResumePredictions(data);
    }catch(err){
      resumeStatus.textContent = `Prediction failed: ${err.message}`;
    }
  }

  function renderResumePredictions(data){
    resumePredictions.innerHTML='';
    const skills = (data.resume_skills||[]).slice(0,15).join(', ');
    resumeStatus.textContent = `Resume skills detected: ${skills || 'none'}`;
    (data.predictions||[]).forEach(p=>{
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `<strong>${p.company}</strong> — ${p.selection_probability}%<br><span class='muted'>Matched: ${(p.matched_from_resume||[]).join(', ')}</span>`;
      resumePredictions.appendChild(div);
    });
  }

  // event bindings
  if(adviceBtn) adviceBtn.addEventListener('click', fetchAdvice);
  if(refreshAdvice) refreshAdvice.addEventListener('click', fetchAdvice);

  loadAll();
})();
