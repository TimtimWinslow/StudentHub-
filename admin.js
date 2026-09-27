/* STUDENTHUB ADMIN */
async function loadAdminStatus(){
 if(!supabaseClient||!state.user){state.isAdmin=false;return false;}
 const {data,error}=await supabaseClient.from('admin_users').select('user_id,active').eq('user_id',state.user.id).eq('active',true).maybeSingle();
 if(error){console.error('Admin status error:',error);state.isAdmin=false;return false;}
 state.isAdmin=!!data; return state.isAdmin;
}
async function adminAudit(action,targetType,targetId,details={}){
 if(!state.isAdmin||!state.user)return;
 const {error}=await supabaseClient.from('admin_audit_log').insert({admin_user_id:state.user.id,action,target_type:targetType||null,target_id:targetId||null,details});
 if(error)console.error('Admin audit error:',error);
}
async function loadAdminData(){
 if(!state.isAdmin)return;
 const results=await Promise.all([
  supabaseClient.from('profiles').select('id,display_name,full_name,bio,avatar_url,account_status,created_at').order('display_name'),
  supabaseClient.from('classes').select('id,name,invite_code,created_by,created_at').order('created_at'),
  supabaseClient.from('chapters').select('*').order('chapter_number'),
  supabaseClient.from('admin_audit_log').select('*').order('created_at',{ascending:false}).limit(100),
  supabaseClient.from('enrollments').select('id,student_id,class_id,role,enrolled_at').order('enrolled_at',{ascending:false}),
  supabaseClient.from('admin_users').select('user_id,active,created_at').order('created_at'),
  supabaseClient.from('messages').select('id,user_id,content,message,created_at,conversation_id').order('created_at',{ascending:false}).limit(50),
  supabaseClient.from('feed_posts').select('id,user_id,content,pinned,created_at').order('created_at',{ascending:false}).limit(50)
 ]);
 const bad=results.find(x=>x.error); if(bad)throw bad.error;
 state.adminStudents=results[0].data||[]; state.adminClasses=results[1].data||[]; state.adminChapters=results[2].data||[]; state.adminAuditLog=results[3].data||[];
 state.adminEnrollments=results[4].data||[]; state.adminAdmins=results[5].data||[]; state.adminMessages=results[6].data||[]; state.adminFeedPosts=results[7].data||[];
}
function renderAdmin(){
 if(!state.isAdmin)return '<section class="page"><div class="panel admin-denied"><div class="empty-icon">🔒</div><h2>Admin access required</h2><p>This area is restricted to StudentHub administrators.</p></div></section>';
 const sections=[['dashboard','📊','Dashboard'],['students','👥','Students'],['classes','🏫','Class'],['chapters','📖','Chapters'],['announcements','📢','Announcements'],['moderation','🛡️','Moderation'],['admins','👑','Administrators'],['audit','🧾','Audit Log'],['settings','⚙️','Settings']];
 let content=renderAdminDashboard();
 if(state.adminSection==='students')content=renderAdminStudents(); if(state.adminSection==='classes')content=renderAdminClasses(); if(state.adminSection==='chapters')content=renderAdminChapters(); if(state.adminSection==='announcements')content=renderAdminAnnouncements(); if(state.adminSection==='moderation')content=renderAdminModeration(); if(state.adminSection==='admins')content=renderAdminAdmins(); if(state.adminSection==='audit')content=renderAdminAudit(); if(state.adminSection==='settings')content=renderAdminSettings();
 return '<section class="page"><div class="page-header admin-page-header"><div><p class="eyebrow">ADMINISTRATOR</p><h1>StudentHub Admin</h1><p>Full administrative control for the class hub.</p></div><span class="admin-badge">🛡️ ADMIN</span></div><div class="admin-nav">'+sections.map(x=>'<button class="admin-nav-button '+(state.adminSection===x[0]?'active':'')+'" data-admin-section="'+x[0]+'">'+x[1]+' '+x[2]+'</button>').join('')+'</div><div id="admin-content">'+content+'</div></section>';
}
function renderAdminDashboard(){
 const stats=[['👥',state.adminStudents.length,'Students'],['🏫',state.adminClasses.length,'Classes'],['📖',state.adminChapters.length,'Chapters'],['🧾',state.adminAuditLog.length,'Audit Events']];
 const controls=[['students','Manage Students'],['classes','Manage Class'],['chapters','Manage Chapters'],['announcements','Announcements'],['moderation','Moderate Content'],['admins','Manage Administrators'],['audit','View Audit Log'],['settings','Admin Settings']];
 return '<div class="admin-stat-grid">'+stats.map(x=>'<div class="panel admin-stat-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('')+'</div><div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🛡️</span><h2>Admin Controls</h2></div></div><div class="admin-control-list">'+controls.map(x=>'<button class="secondary-button" data-admin-section="'+x[0]+'">'+x[1]+'</button>').join('')+'</div></section><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Admin Rules</h2></div></div><ul class="admin-rule-list"><li>Admin-only information is restricted from regular students.</li><li>Administrative actions are recorded in the audit log.</li><li>The Care Team remains the class group chat.</li></ul></section></div>';
}
function renderAdminStudents(){
 const className=id=>{const x=state.adminClasses.find(c=>String(c.id)===String(id));return x?.name||'No class';};
 const studentName=id=>{const x=state.adminStudents.find(s=>String(s.id)===String(id));return x?.display_name||x?.full_name||'Student';};
 const enrolledFor=studentId=>state.adminEnrollments.filter(e=>String(e.student_id)===String(studentId));
 return '<div class="admin-student-tools"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">➕</span><h2>Manage Enrollment</h2></div></div><p class="admin-note">Assign a student to a class or remove their class enrollment. This does not delete their StudentHub account.</p><div class="admin-form-row admin-enrollment-form"><select id="admin-enroll-student" class="text-input"><option value="">Select student</option>'+state.adminStudents.map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.display_name||s.full_name||'Student')+'</option>').join('')+'</select><select id="admin-enroll-class" class="text-input"><option value="">Select class</option>'+state.adminClasses.map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.name)+'</option>').join('')+'</select><button class="primary-button" id="admin-enroll-student-button">Assign</button></div><div id="admin-enrollment-status" class="form-error"></div></section></div><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">👥</span><h2>Students</h2></div><span class="admin-count">'+state.adminStudents.length+'</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Student</th><th>Status</th><th>Class Enrollment</th><th>Profile</th><th>Joined</th></tr></thead><tbody>'+(state.adminStudents.map(s=>'<tr><td><strong>'+escapeHtml(s.display_name||s.full_name||'Student')+'</strong><br><small>'+escapeHtml(s.full_name||'')+'</small></td><td><span class="admin-status '+(s.account_status==='suspended'?'suspended':'active')+'">'+(s.account_status==='suspended'?'Suspended':'Active')+'</span> <button class="secondary-button small-button" data-admin-toggle-student-status="'+escapeHtml(s.id)+'">'+(s.account_status==='suspended'?'Activate':'Suspend')+'</button></td><td>'+(enrolledFor(s.id).map(e=>'<div class="admin-enrollment-chip"><span>'+escapeHtml(className(e.class_id))+'</span><button class="danger-button small-button" data-admin-remove-enrollment="'+escapeHtml(e.id)+'" title="Remove enrollment">Remove</button></div>').join('')||'<span class="admin-muted">Not enrolled</span>')+'</td><td>'+(s.avatar_url?'Photo':'No photo')+'</td><td>'+formatDate(s.created_at)+'</td></tr>').join('')||'<tr><td colspan="5">No students found.</td></tr>')+'</tbody></table></div></section>';
}
function renderAdminModeration(){
 const name=id=>{const s=state.adminStudents.find(x=>String(x.id)===String(id));return s?.display_name||s?.full_name||'Student';};
 return '<div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">💬</span><h2>Recent Messages</h2></div></div><p class="admin-note">Administrators can remove inappropriate class or direct messages.</p><div class="admin-list">'+(state.adminMessages.map(m=>'<div class="admin-list-row"><div><strong>'+escapeHtml(name(m.user_id))+'</strong><small>'+escapeHtml(m.content||m.message||'')+' · '+formatDateTime(m.created_at)+'</small></div><button class="danger-button small-button" data-admin-delete-message="'+escapeHtml(m.id)+'">Delete</button></div>').join('')||'<div class="empty-state compact">No messages found.</div>')+'</div></section><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Feed Moderation</h2></div></div><div class="admin-list">'+(state.adminFeedPosts.map(p=>'<div class="admin-list-row"><div><strong>'+escapeHtml(name(p.user_id))+(p.pinned?' · 📌 Pinned':'')+'</strong><small>'+escapeHtml(p.content||'')+' · '+formatDateTime(p.created_at)+'</small></div><div class="admin-row-actions"><button class="secondary-button small-button" data-admin-toggle-feed-pin="'+escapeHtml(p.id)+'">'+(p.pinned?'Unpin':'Pin')+'</button><button class="danger-button small-button" data-admin-delete-feed="'+escapeHtml(p.id)+'">Delete</button></div></div>').join('')||'<div class="empty-state compact">No feed posts found.</div>')+'</div></section></div>';
}
function renderAdminAdmins(){
 const adminIds=new Set(state.adminAdmins.filter(a=>a.active).map(a=>String(a.user_id)));
 return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">👑</span><h2>Administrator Management</h2></div></div><p class="admin-note">Grant or revoke administrator access. You cannot revoke your own active admin access from this screen.</p><div class="admin-list">'+state.adminStudents.map(s=>{const active=adminIds.has(String(s.id));return '<div class="admin-list-row"><div><strong>'+escapeHtml(s.display_name||s.full_name||'Student')+'</strong><small>'+escapeHtml(s.full_name||'')+'</small></div><button class="'+(active?'danger-button':'secondary-button')+' small-button" data-admin-toggle-role="'+escapeHtml(s.id)+'">'+(active?'Remove Admin':'Make Admin')+'</button></div>';}).join('')+'</div></section>';
}
async function toggleAdminStudentStatus(id){
 const student=state.adminStudents.find(s=>String(s.id)===String(id)); if(!student)return;
 const next=student.account_status==='suspended'?'active':'suspended';
 if(!confirm(next==='suspended'?'Suspend this student account?':'Reactivate this student account?'))return;
 const {error}=await supabaseClient.from('profiles').update({account_status:next}).eq('id',id);
 if(error)return showToast(error.message,'error');
 await adminAudit(next==='suspended'?'suspend_student':'activate_student','profile',id,{account_status:next});
 await loadAdminData(); rerenderAdminContent(); showToast(next==='suspended'?'Student suspended.':'Student activated.','success');
}
async function toggleAdminRole(id){
 if(String(id)===String(state.user.id))return showToast('You cannot remove your own administrator access here.','error');
 const existing=state.adminAdmins.find(a=>String(a.user_id)===String(id));
 if(existing?.active){
  if(!confirm('Remove administrator access from this user?'))return;
  const {error}=await supabaseClient.from('admin_users').update({active:false}).eq('user_id',id);
  if(error)return showToast(error.message,'error');
  await adminAudit('remove_admin','admin_user',id);
 }else{
  if(!confirm('Grant administrator access to this user?'))return;
  const {error}=await supabaseClient.from('admin_users').upsert({user_id:id,active:true},{onConflict:'user_id'});
  if(error)return showToast(error.message,'error');
  await adminAudit('grant_admin','admin_user',id);
 }
 await loadAdminData(); rerenderAdminContent();
}
async function adminDeleteMessage(id){
 if(!confirm('Delete this message as an administrator?'))return;
 const {error}=await supabaseClient.from('messages').delete().eq('id',id);
 if(error)return showToast(error.message,'error');
 await adminAudit('moderate_delete_message','message',id);
 await loadAdminData(); rerenderAdminContent(); showToast('Message deleted.','success');
}
async function adminToggleFeedPin(id){
 const post=state.adminFeedPosts.find(p=>String(p.id)===String(id)); if(!post)return;
 const {error}=await supabaseClient.from('feed_posts').update({pinned:!post.pinned}).eq('id',id);
 if(error)return showToast(error.message,'error');
 await adminAudit(post.pinned?'unpin_feed_post':'pin_feed_post','feed_post',id,{pinned:!post.pinned});
 await loadAdminData(); rerenderAdminContent();
}
async function adminDeleteFeed(id){
 if(!confirm('Delete this feed post as an administrator?'))return;
 const {error}=await supabaseClient.from('feed_posts').delete().eq('id',id);
 if(error)return showToast(error.message,'error');
 await adminAudit('moderate_delete_feed_post','feed_post',id);
 await loadAdminData(); rerenderAdminContent(); showToast('Feed post deleted.','success');
}
function renderAdminClasses(){return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🏫</span><h2>Class Management</h2></div></div><div class="admin-form-row"><input id="admin-class-name" class="text-input" placeholder="Class name (example: CNA)"><input id="admin-class-invite" class="text-input" placeholder="Invite code"><button class="primary-button" id="admin-create-class">Create Class</button></div><div class="admin-list">'+(state.adminClasses.map(x=>'<div class="admin-list-row"><div><strong>'+escapeHtml(x.name)+'</strong><small>Invite: '+escapeHtml(x.invite_code||'—')+'</small></div><button class="danger-button small-button" data-admin-delete-class="'+x.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No classes found.</div>')+'</div></section>';}
function renderAdminChapters(){return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📖</span><h2>Chapter Management</h2></div></div><div class="admin-form-row"><input id="admin-chapter-number" class="text-input" type="number" min="1" placeholder="Chapter #"><input id="admin-chapter-title" class="text-input" placeholder="Chapter title"><button class="primary-button" id="admin-create-chapter">Add Chapter</button></div><div class="admin-list">'+(state.adminChapters.map(x=>'<div class="admin-list-row"><div><strong>Chapter '+escapeHtml(x.chapter_number)+' — '+escapeHtml(x.title)+'</strong></div><button class="danger-button small-button" data-admin-delete-chapter="'+x.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No chapters found.</div>')+'</div></section>';}
function renderAdminAnnouncements(){return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📢</span><h2>Announcements</h2></div></div><p class="admin-note">Broadcast a notification to every StudentHub account.</p><input id="admin-announcement-title" class="text-input" placeholder="Announcement title"><textarea id="admin-announcement-body" class="text-input admin-textarea" placeholder="Write your announcement..."></textarea><button class="primary-button" id="admin-send-announcement">Send to Class</button><div id="admin-announcement-status" class="form-error"></div></section>';}
function renderAdminAudit(){return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🧾</span><h2>Admin Audit Log</h2></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>'+(state.adminAuditLog.map(x=>'<tr><td>'+formatDateTime(x.created_at)+'</td><td><strong>'+escapeHtml(x.action)+'</strong></td><td>'+escapeHtml(x.target_type||'—')+'</td><td><code>'+escapeHtml(JSON.stringify(x.details||{}))+'</code></td></tr>').join('')||'<tr><td colspan="4">No audit events yet.</td></tr>')+'</tbody></table></div></section>';}
function renderAdminSettings(){return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">⚙️</span><h2>Admin Settings</h2></div></div><div class="admin-settings-grid"><div><strong>Administrator</strong><span>'+escapeHtml(getDisplayName())+'</span></div><div><strong>Role</strong><span>Administrator</span></div><div><strong>Class</strong><span>CNA</span></div><div><strong>Audit Logging</strong><span>Enabled</span></div></div></section>';}
async function createAdminEnrollment(){
 const studentId=$('#admin-enroll-student')?.value;
 const classId=$('#admin-enroll-class')?.value;
 const status=$('#admin-enrollment-status');
 if(status) status.textContent='';
 if(!studentId||!classId){if(status)status.textContent='Select a student and class.';return;}
 const existing=state.adminEnrollments.find(e=>String(e.student_id)===String(studentId)&&String(e.class_id)===String(classId));
 if(existing){if(status)status.textContent='That student is already enrolled in this class.';return;}
 const {data,error}=await supabaseClient.from('enrollments').insert({student_id:studentId,class_id:classId,role:'student'}).select('*').single();
 if(error){if(status)status.textContent=error.message;return;}
 const student=state.adminStudents.find(s=>String(s.id)===String(studentId));
 const klass=state.adminClasses.find(x=>String(x.id)===String(classId));
 await adminAudit('enroll_student','enrollment',data.id,{student_id:studentId,class_id:classId,student_name:student?.display_name||student?.full_name||'Student',class_name:klass?.name||'Class'});
 await loadAdminData(); rerenderAdminContent();
 showToast('Student enrolled successfully.','success');
}

async function removeAdminEnrollment(id){
 const enrollment=state.adminEnrollments.find(e=>String(e.id)===String(id));
 if(!enrollment)return;
 const student=state.adminStudents.find(s=>String(s.id)===String(enrollment.student_id));
 const klass=state.adminClasses.find(x=>String(x.id)===String(enrollment.class_id));
 if(!confirm('Remove '+(student?.display_name||student?.full_name||'this student')+' from '+(klass?.name||'this class')+'?'))return;
 const {error}=await supabaseClient.from('enrollments').delete().eq('id',id);
 if(error)return showToast(error.message,'error');
 await adminAudit('remove_student_enrollment','enrollment',id,{student_id:enrollment.student_id,class_id:enrollment.class_id,student_name:student?.display_name||student?.full_name||'Student',class_name:klass?.name||'Class'});
 await loadAdminData(); rerenderAdminContent();
 showToast('Student removed from the class.','success');
}

async function createAdminClass(){const name=$('#admin-class-name')?.value.trim();const invite=$('#admin-class-invite')?.value.trim()||null;if(!name)return showToast('Enter a class name.','error');const {data,error}=await supabaseClient.from('classes').insert({name,invite_code:invite,created_by:state.user.id}).select('*').single();if(error)return showToast(error.message,'error');await adminAudit('create_class','class',data.id,{name});await loadAdminData();rerenderAdminContent();}
async function deleteAdminClass(id){if(!confirm('Delete this class? This may affect enrollments and scores.'))return;const {error}=await supabaseClient.from('classes').delete().eq('id',id);if(error)return showToast(error.message,'error');await adminAudit('delete_class','class',id);await loadAdminData();rerenderAdminContent();}
async function createAdminChapter(){const number=Number($('#admin-chapter-number')?.value);const title=$('#admin-chapter-title')?.value.trim();if(!number||!title)return showToast('Enter a chapter number and title.','error');const {data,error}=await supabaseClient.from('chapters').insert({chapter_number:number,title}).select('*').single();if(error)return showToast(error.message,'error');await adminAudit('create_chapter','chapter',data.id,{chapter_number:number,title});await loadAdminData();rerenderAdminContent();}
async function deleteAdminChapter(id){if(!confirm('Delete this chapter? Existing score records may be affected.'))return;const {error}=await supabaseClient.from('chapters').delete().eq('id',id);if(error)return showToast(error.message,'error');await adminAudit('delete_chapter','chapter',id);await loadAdminData();rerenderAdminContent();}
async function sendAdminAnnouncement(){const title=$('#admin-announcement-title')?.value.trim();const body=$('#admin-announcement-body')?.value.trim();const status=$('#admin-announcement-status');if(!title||!body){if(status)status.textContent='Enter a title and message.';return;}const {data:users,error:ue}=await supabaseClient.from('profiles').select('id');if(ue){if(status)status.textContent=ue.message;return;}const rows=(users||[]).map(u=>({user_id:u.id,title,message:body,notification_type:'announcement',metadata:{admin_user_id:state.user.id}}));const {error}=await supabaseClient.from('notifications').insert(rows);if(error){if(status)status.textContent=error.message;return;}await adminAudit('send_announcement','notification',null,{title,recipient_count:rows.length});if(status){status.className='form-success';status.textContent='Announcement sent to the class.';}}
function rerenderAdminContent(){const c=$('#admin-content');if(!c)return;let content=renderAdminDashboard();if(state.adminSection==='students')content=renderAdminStudents();if(state.adminSection==='classes')content=renderAdminClasses();if(state.adminSection==='chapters')content=renderAdminChapters();if(state.adminSection==='announcements')content=renderAdminAnnouncements();if(state.adminSection==='moderation')content=renderAdminModeration();if(state.adminSection==='admins')content=renderAdminAdmins();if(state.adminSection==='audit')content=renderAdminAudit();if(state.adminSection==='settings')content=renderAdminSettings();c.innerHTML=content;attachAdminEvents();}
function attachAdminEvents(){document.querySelectorAll('[data-admin-section]').forEach(b=>b.addEventListener('click',()=>{state.adminSection=b.dataset.adminSection||'dashboard';rerenderAdminContent();}));$('#admin-create-class')?.addEventListener('click',createAdminClass);
 $('#admin-enroll-student-button')?.addEventListener('click',createAdminEnrollment);
 document.querySelectorAll('[data-admin-remove-enrollment]').forEach(b=>b.addEventListener('click',()=>removeAdminEnrollment(b.dataset.adminRemoveEnrollment)));$('#admin-create-chapter')?.addEventListener('click',createAdminChapter);$('#admin-send-announcement')?.addEventListener('click',sendAdminAnnouncement);document.querySelectorAll('[data-admin-delete-class]').forEach(b=>b.addEventListener('click',()=>deleteAdminClass(b.dataset.adminDeleteClass)));document.querySelectorAll('[data-admin-delete-chapter]').forEach(b=>b.addEventListener('click',()=>deleteAdminChapter(b.dataset.adminDeleteChapter)));
 document.querySelectorAll('[data-admin-toggle-student-status]').forEach(b=>b.addEventListener('click',()=>toggleAdminStudentStatus(b.dataset.adminToggleStudentStatus)));
 document.querySelectorAll('[data-admin-toggle-role]').forEach(b=>b.addEventListener('click',()=>toggleAdminRole(b.dataset.adminToggleRole)));
 document.querySelectorAll('[data-admin-delete-message]').forEach(b=>b.addEventListener('click',()=>adminDeleteMessage(b.dataset.adminDeleteMessage)));
 document.querySelectorAll('[data-admin-toggle-feed-pin]').forEach(b=>b.addEventListener('click',()=>adminToggleFeedPin(b.dataset.adminToggleFeedPin)));
 document.querySelectorAll('[data-admin-delete-feed]').forEach(b=>b.addEventListener('click',()=>adminDeleteFeed(b.dataset.adminDeleteFeed)));
}
async function hydrateAdmin(){if(!state.isAdmin)return;try{await loadAdminData();attachAdminEvents();}catch(error){console.error('Admin load error:',error);showToast(error?.message||'Unable to load admin data.','error');}}

/* =========================================================
   STUDENTHUB ADMIN — COMPLETE CONTROL CENTER
   ========================================================= */

async function adminSafeQuery(queryPromise, fallback = []) {
  try {
    const result = await queryPromise;
    if (result.error) {
      console.warn("Admin optional data load:", result.error.message);
      return fallback;
    }
    return result.data || fallback;
  } catch (error) {
    console.warn("Admin optional data load:", error);
    return fallback;
  }
}

async function loadAdminData() {
  if (!state.isAdmin) return;

  const [
    students,
    classes,
    chapters,
    audit,
    enrollments,
    admins,
    messages,
    feedPosts,
    scores,
    assignments,
    calendarEvents
  ] = await Promise.all([
    adminSafeQuery(supabaseClient.from("profiles").select("id,display_name,full_name,bio,avatar_url,account_status,created_at").order("display_name")),
    adminSafeQuery(supabaseClient.from("classes").select("id,name,invite_code,created_by,created_at").order("created_at")),
    adminSafeQuery(supabaseClient.from("chapters").select("*").order("chapter_number")),
    adminSafeQuery(supabaseClient.from("admin_audit_log").select("*").order("created_at",{ascending:false}).limit(250)),
    adminSafeQuery(supabaseClient.from("enrollments").select("id,student_id,class_id,role,enrolled_at").order("enrolled_at",{ascending:false})),
    adminSafeQuery(supabaseClient.from("admin_users").select("user_id,active,created_at").order("created_at")),
    adminSafeQuery(supabaseClient.from("messages").select("id,user_id,content,message,created_at,conversation_id").order("created_at",{ascending:false}).limit(100)),
    adminSafeQuery(supabaseClient.from("feed_posts").select("id,user_id,content,pinned,created_at").order("created_at",{ascending:false}).limit(100)),
    adminSafeQuery(supabaseClient.from("scores").select("id,user_id,class_id,chapter_id,score,test_date").order("test_date",{ascending:false}).limit(200)),
    adminSafeQuery(supabaseClient.from("assignments").select("id,user_id,title,description,due_date,priority,status,created_at,updated_at").order("due_date",{ascending:true}).limit(200)),
    adminSafeQuery(supabaseClient.from("calendar_events").select("id,user_id,title,description,start_time,end_time,location,event_type,all_day,created_by").order("start_time",{ascending:true}).limit(200))
  ]);

  state.adminStudents = students;
  state.adminClasses = classes;
  state.adminChapters = chapters;
  state.adminAuditLog = audit;
  state.adminEnrollments = enrollments;
  state.adminAdmins = admins;
  state.adminMessages = messages;
  state.adminFeedPosts = feedPosts;
  state.adminScores = scores;
  state.adminAssignments = assignments;
  state.adminCalendarEvents = calendarEvents;
}

function adminStudentName(id) {
  const student = (state.adminStudents || []).find(s => String(s.id) === String(id));
  return student?.display_name || student?.full_name || "Student";
}

function adminClassName(id) {
  const klass = (state.adminClasses || []).find(c => String(c.id) === String(id));
  return klass?.name || "Class";
}

function adminChapterName(id) {
  const chapter = (state.adminChapters || []).find(c => String(c.id) === String(id));
  return chapter ? `Chapter ${chapter.chapter_number} — ${chapter.title}` : "Chapter";
}

function adminDownload(filename, content, type="application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function adminExportAllData() {
  const payload = {
    exported_at: new Date().toISOString(),
    exported_by: state.user?.id || null,
    students: state.adminStudents || [],
    classes: state.adminClasses || [],
    chapters: state.adminChapters || [],
    enrollments: state.adminEnrollments || [],
    administrators: state.adminAdmins || [],
    scores: state.adminScores || [],
    assignments: state.adminAssignments || [],
    calendar_events: state.adminCalendarEvents || [],
    audit_log: state.adminAuditLog || []
  };
  adminDownload(`studenthub-admin-export-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
  adminAudit("export_admin_data", "system", null, { record_groups: Object.keys(payload).length });
  showToast("Admin data export downloaded.", "success");
}

function renderAdmin() {
  if (!state.isAdmin) {
    return '<section class="page"><div class="panel admin-denied"><div class="empty-icon">🔒</div><h2>Admin access required</h2><p>This area is restricted to StudentHub administrators.</p></div></section>';
  }

  const sections = [
    ["dashboard","📊","Dashboard"],
    ["students","👥","Students"],
    ["classes","🏫","Classes"],
    ["chapters","📖","Chapters"],
    ["academic","🎓","Academic"],
    ["calendar","📅","Calendar"],
    ["assignments","📝","Assignments"],
    ["announcements","📢","Announcements"],
    ["moderation","🛡️","Moderation"],
    ["admins","👑","Administrators"],
    ["audit","🧾","Audit Log"],
    ["export","📤","Data Export"],
    ["settings","⚙️","Settings"]
  ];

  let content = renderAdminDashboard();
  const renderers = {
    students: renderAdminStudents,
    classes: renderAdminClasses,
    chapters: renderAdminChapters,
    academic: renderAdminAcademic,
    calendar: renderAdminCalendarControl,
    assignments: renderAdminAssignmentsControl,
    announcements: renderAdminAnnouncements,
    moderation: renderAdminModeration,
    admins: renderAdminAdmins,
    audit: renderAdminAudit,
    export: renderAdminExport,
    settings: renderAdminSettings
  };
  if (renderers[state.adminSection]) content = renderers[state.adminSection]();

  return '<section class="page"><div class="page-header admin-page-header"><div><p class="eyebrow">ADMINISTRATOR</p><h1>StudentHub Admin</h1><p>Full administrative control for the class hub.</p></div><span class="admin-badge">🛡️ ADMIN</span></div><div class="admin-nav">'+sections.map(x => '<button class="admin-nav-button '+(state.adminSection===x[0]?'active':'')+'" data-admin-section="'+x[0]+'">'+x[1]+' '+x[2]+'</button>').join('')+'</div><div id="admin-content">'+content+'</div></section>';
}

function renderAdminDashboard() {
  const students = state.adminStudents || [];
  const active = students.filter(s => s.account_status !== "suspended").length;
  const suspended = students.filter(s => s.account_status === "suspended").length;
  const admins = (state.adminAdmins || []).filter(a => a.active).length;
  const pending = (state.adminAssignments || []).filter(a => a.status !== "completed").length;
  const pinned = (state.adminFeedPosts || []).filter(p => p.pinned).length;

  const stats = [
    ["👥", students.length, "Students"],
    ["🟢", active, "Active"],
    ["⛔", suspended, "Suspended"],
    ["👑", admins, "Administrators"],
    ["📝", pending, "Open Assignments"],
    ["📌", pinned, "Pinned Feed Posts"],
    ["🧾", (state.adminAuditLog || []).length, "Audit Events"]
  ];

  return '<div class="admin-stat-grid">'+stats.map(x => '<div class="panel admin-stat-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('')+
    '</div><div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🛡️</span><h2>Control Center</h2></div></div><div class="admin-control-list">'+
    [["students","Manage Students"],["academic","Academic Records"],["calendar","Calendar"],["assignments","Assignments"],["moderation","Moderation"],["admins","Administrators"],["audit","Audit Log"],["export","Export Data"]].map(x => '<button class="secondary-button" data-admin-section="'+x[0]+'">'+x[1]+'</button>').join('')+
    '</div></section><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">⚡</span><h2>System Status</h2></div></div><div class="admin-settings-grid"><div><strong>Authentication</strong><span>Supabase Auth</span></div><div><strong>Admin Security</strong><span>RLS protected</span></div><div><strong>Audit Logging</strong><span>Enabled</span></div><div><strong>Account</strong><span>Administrator</span></div></div></section></div>';
}

function renderAdminStudents() {
  const query = String(state.adminStudentSearch || "").trim().toLowerCase();
  const students = (state.adminStudents || []).filter(s => {
    if (!query) return true;
    return [s.display_name,s.full_name,s.bio].some(v => String(v || "").toLowerCase().includes(query));
  });
  const enrolledFor = studentId => (state.adminEnrollments || []).filter(e => String(e.student_id) === String(studentId));

  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">👥</span><h2>Student Management</h2></div><span class="admin-count">'+students.length+'</span></div>'+
    '<div class="admin-form-row"><input id="admin-student-search" class="text-input" placeholder="Search students..." value="'+escapeHtml(state.adminStudentSearch || "")+'"></div>'+
    '<div class="admin-student-tools"><div class="admin-form-row admin-enrollment-form"><select id="admin-enroll-student" class="text-input"><option value="">Select student</option>'+
    (state.adminStudents || []).map(s => '<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.display_name||s.full_name||"Student")+'</option>').join('')+
    '</select><select id="admin-enroll-class" class="text-input"><option value="">Select class</option>'+
    (state.adminClasses || []).map(c => '<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</option>').join('')+
    '</select><button class="primary-button" id="admin-enroll-student-button">Assign</button></div><div id="admin-enrollment-status" class="form-error"></div></div>'+
    '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Student</th><th>Status</th><th>Enrollment</th><th>Profile</th><th>Joined</th></tr></thead><tbody>'+
    (students.map(s => '<tr><td><strong>'+escapeHtml(s.display_name||s.full_name||"Student")+'</strong><br><small>'+escapeHtml(s.full_name||"")+'</small></td>'+
      '<td><span class="admin-status '+(s.account_status==="suspended"?"suspended":"active")+'">'+(s.account_status==="suspended"?"Suspended":"Active")+'</span> <button class="secondary-button small-button" data-admin-toggle-student-status="'+escapeHtml(s.id)+'">'+(s.account_status==="suspended"?"Activate":"Suspend")+'</button></td>'+
      '<td>'+(enrolledFor(s.id).map(e => '<div class="admin-enrollment-chip"><span>'+escapeHtml(adminClassName(e.class_id))+'</span><button class="danger-button small-button" data-admin-remove-enrollment="'+escapeHtml(e.id)+'">Remove</button></div>').join('') || '<span class="admin-muted">Not enrolled</span>')+
      '</td><td>'+escapeHtml(s.bio || (s.avatar_url ? "Photo uploaded" : "No photo"))+'</td><td>'+formatDate(s.created_at)+'</td></tr>').join('') || '<tr><td colspan="5">No matching students.</td></tr>')+
    '</tbody></table></div></section>';
}

function renderAdminAcademic() {
  return '<div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🎓</span><h2>Score Management</h2></div></div>'+
    '<p class="admin-note">Administrators can record or correct chapter scores for any student.</p>'+
    '<div class="admin-form-stack"><select id="admin-score-student" class="text-input"><option value="">Student</option>'+(state.adminStudents||[]).map(s=>'<option value="'+s.id+'">'+escapeHtml(s.display_name||s.full_name||"Student")+'</option>').join('')+
    '</select><select id="admin-score-class" class="text-input"><option value="">Class</option>'+(state.adminClasses||[]).map(c=>'<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>').join('')+
    '</select><select id="admin-score-chapter" class="text-input"><option value="">Chapter</option>'+(state.adminChapters||[]).map(c=>'<option value="'+c.id+'">'+escapeHtml("Chapter "+c.chapter_number+" — "+c.title)+'</option>').join('')+
    '</select><input id="admin-score-value" class="text-input" type="number" min="0" max="100" placeholder="Score (0–100)"><input id="admin-score-date" class="text-input" type="date"><button id="admin-save-score" class="primary-button">Save Score</button></div></section>'+
    '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📚</span><h2>Recent Scores</h2></div></div><div class="admin-list">'+
    ((state.adminScores||[]).slice(0,50).map(s=>'<div class="admin-list-row"><div><strong>'+escapeHtml(adminStudentName(s.user_id))+'</strong><small>'+escapeHtml(adminChapterName(s.chapter_id))+' · '+escapeHtml(adminClassName(s.class_id))+' · '+escapeHtml(String(s.score))+'% · '+escapeHtml(s.test_date||"")+'</small></div><button class="danger-button small-button" data-admin-delete-score="'+s.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No scores found.</div>')+
    '</div></section></div>';
}

function renderAdminAssignmentsControl() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📝</span><h2>Assignment Management</h2></div></div>'+
    '<p class="admin-note">Review and remove assignments across the class. Students retain ownership of their records.</p><div class="admin-list">'+
    ((state.adminAssignments||[]).slice(0,100).map(a=>'<div class="admin-list-row"><div><strong>'+escapeHtml(a.title||"Assignment")+'</strong><small>'+escapeHtml(adminStudentName(a.user_id))+' · Due '+escapeHtml(a.due_date||"No date")+' · '+escapeHtml(a.status||"")+'</small></div><button class="danger-button small-button" data-admin-delete-assignment="'+a.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No assignments found.</div>')+
    '</div></section>';
}

function renderAdminCalendarControl() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📅</span><h2>Calendar Management</h2></div></div>'+
    '<p class="admin-note">Create an event for a specific student or the administrator account. Existing calendar visibility rules still apply.</p>'+
    '<div class="admin-form-stack"><input id="admin-event-title" class="text-input" placeholder="Event title"><input id="admin-event-date" class="text-input" type="date"><input id="admin-event-location" class="text-input" placeholder="Location (optional)"><label class="admin-check-row"><input id="admin-event-classwide" type="checkbox" checked><span>Show this event to the whole class</span></label><select id="admin-event-type" class="text-input"><option value="class">Class</option><option value="test">Test</option><option value="clinical">Clinical</option><option value="assignment">Assignment</option><option value="study">Study</option><option value="other">Other</option></select><button id="admin-create-event" class="primary-button">Create Event</button></div>'+
    '<div class="admin-list">'+((state.adminCalendarEvents||[]).slice(0,100).map(e=>'<div class="admin-list-row"><div><strong>'+escapeHtml(e.title||"Event")+'</strong><small>'+escapeHtml(e.start_time||"")+' · '+escapeHtml(e.location||"")+' · Owner: '+escapeHtml(adminStudentName(e.user_id||e.created_by))+'</small></div><button class="danger-button small-button" data-admin-delete-event="'+e.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No events found.</div>')+'</div></section>';
}

function renderAdminModeration() {
  const name = adminStudentName;
  return '<div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">💬</span><h2>Messages</h2></div></div><p class="admin-note">Moderate recent Care Team and direct messages.</p><div class="admin-list">'+((state.adminMessages||[]).map(m=>'<div class="admin-list-row"><div><strong>'+escapeHtml(name(m.user_id))+'</strong><small>'+escapeHtml(m.content||m.message||"")+' · '+formatDateTime(m.created_at)+'</small></div><button class="danger-button small-button" data-admin-delete-message="'+m.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No messages found.</div>')+'</div></section>'+
  '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Feed</h2></div></div><div class="admin-list">'+((state.adminFeedPosts||[]).map(p=>'<div class="admin-list-row"><div><strong>'+escapeHtml(name(p.user_id))+(p.pinned?" · 📌 Pinned":"")+'</strong><small>'+escapeHtml(p.content||"")+' · '+formatDateTime(p.created_at)+'</small></div><div class="admin-row-actions"><button class="secondary-button small-button" data-admin-toggle-feed-pin="'+p.id+'">'+(p.pinned?"Unpin":"Pin")+'</button><button class="danger-button small-button" data-admin-delete-feed="'+p.id+'">Delete</button></div></div>').join('')||'<div class="empty-state compact">No feed posts found.</div>')+'</div></section></div>'+
  '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Pinned Care Team Messages</h2></div></div><div class="admin-list" id="admin-pinned-message-list"><div class="empty-state compact">Use the database moderation controls to manage pins.</div></div></section>';
}

function renderAdminAudit() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🧾</span><h2>Audit Log</h2></div><button class="secondary-button small-button" id="admin-export-audit">Export</button></div>'+
    '<div class="admin-form-row"><input id="admin-audit-search" class="text-input" placeholder="Search action, target, or details..." value="'+escapeHtml(state.adminAuditSearch||"")+'"></div>'+
    '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>'+
    ((state.adminAuditLog||[]).filter(x=>{const q=String(state.adminAuditSearch||"").toLowerCase();return !q||JSON.stringify(x).toLowerCase().includes(q);}).map(x=>'<tr><td>'+formatDateTime(x.created_at)+'</td><td><strong>'+escapeHtml(x.action)+'</strong></td><td>'+escapeHtml(x.target_type||"—")+'</td><td><code>'+escapeHtml(JSON.stringify(x.details||{}))+'</code></td></tr>').join('')||'<tr><td colspan="4">No matching audit events.</td></tr>')+
    '</tbody></table></div></section>';
}

function renderAdminExport() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📤</span><h2>Data Export</h2></div></div><p class="admin-note">Download the administrative data currently loaded in StudentHub as a JSON file. This does not create a database backup.</p><button class="primary-button" id="admin-export-all">Download Admin Export</button></section>';
}

function renderAdminSettings() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">⚙️</span><h2>Admin Settings</h2></div></div><div class="admin-settings-grid"><div><strong>Administrator</strong><span>'+escapeHtml(getDisplayName())+'</span></div><div><strong>Role</strong><span>Administrator</span></div><div><strong>Class</strong><span>CNA</span></div><div><strong>Authentication</strong><span>Supabase Auth</span></div><div><strong>Database Security</strong><span>Row Level Security</span></div><div><strong>Audit Logging</strong><span>Enabled</span></div></div><p class="admin-note">Account deletion is intentionally not exposed in the browser. Supabase Auth account deletion requires a trusted server-side administrative action rather than exposing a service-role secret to the app.</p></section>';
}

async function adminSaveScore() {
  const userId = $("#admin-score-student")?.value;
  const classId = $("#admin-score-class")?.value;
  const chapterId = $("#admin-score-chapter")?.value;
  const score = Number($("#admin-score-value")?.value);
  const testDate = $("#admin-score-date")?.value || new Date().toISOString().slice(0,10);
  if (!userId || !classId || !chapterId || Number.isNaN(score) || score < 0 || score > 100) return showToast("Choose a student, class, chapter, and score from 0–100.","error");
  const {data,error}=await supabaseClient.from("scores").insert({user_id:userId,class_id:classId,chapter_id:Number(chapterId),score,test_date:testDate}).select("*").single();
  if(error)return showToast(error.message,"error");
  await adminAudit("admin_create_score","score",data.id,{student_id:userId,class_id:classId,chapter_id:Number(chapterId),score,test_date:testDate});
  await loadAdminData(); rerenderAdminContent(); showToast("Score saved.","success");
}

async function adminDeleteScore(id) {
  if(!confirm("Delete this score record?"))return;
  const {error}=await supabaseClient.from("scores").delete().eq("id",id);
  if(error)return showToast(error.message,"error");
  await adminAudit("admin_delete_score","score",id);
  await loadAdminData(); rerenderAdminContent(); showToast("Score deleted.","success");
}

async function adminDeleteAssignment(id) {
  if(!confirm("Delete this assignment as an administrator?"))return;
  const {error}=await supabaseClient.from("assignments").delete().eq("id",id);
  if(error)return showToast(error.message,"error");
  await adminAudit("admin_delete_assignment","assignment",id);
  await loadAdminData(); rerenderAdminContent(); showToast("Assignment deleted.","success");
}

async function adminCreateEvent() {
  const title=$("#admin-event-title")?.value.trim();
  const date=$("#admin-event-date")?.value;
  const location=$("#admin-event-location")?.value.trim() || null;
  const eventType=$("#admin-event-type")?.value || "class";
  const classWide=!!$("#admin-event-classwide")?.checked;
  if(!title||!date)return showToast("Enter an event title and date.","error");
  const payload={user_id:classWide?null:state.user.id,title,description:null,start_time:`${date}T12:00:00`,location,event_type:eventType,created_by:state.user.id,is_class_wide:classWide};
  const {data,error}=await supabaseClient.from("calendar_events").insert(payload).select("*").single();
  if(error)return showToast(error.message,"error");
  await adminAudit("admin_create_calendar_event","calendar_event",data.id,{title,event_type:eventType,start_time:payload.start_time});
  await loadAdminData(); rerenderAdminContent(); showToast("Calendar event created.","success");
}

async function adminDeleteEvent(id) {
  if(!confirm("Delete this calendar event?"))return;
  const {error}=await supabaseClient.from("calendar_events").delete().eq("id",id);
  if(error)return showToast(error.message,"error");
  await adminAudit("admin_delete_calendar_event","calendar_event",id);
  await loadAdminData(); rerenderAdminContent(); showToast("Calendar event deleted.","success");
}

function attachAdminEvents() {
  document.querySelectorAll("[data-admin-section]").forEach(b => b.addEventListener("click", () => {
    state.adminSection=b.dataset.adminSection||"dashboard";
    rerenderAdminContent();
  }));
  $("#admin-create-class")?.addEventListener("click",createAdminClass);
  $("#admin-enroll-student-button")?.addEventListener("click",createAdminEnrollment);
  $("#admin-create-chapter")?.addEventListener("click",createAdminChapter);
  $("#admin-send-announcement")?.addEventListener("click",sendAdminAnnouncement);
  $("#admin-save-score")?.addEventListener("click",adminSaveScore);
  $("#admin-create-event")?.addEventListener("click",adminCreateEvent);
  $("#admin-export-all")?.addEventListener("click",adminExportAllData);
  $("#admin-export-audit")?.addEventListener("click",() => adminDownload(`studenthub-audit-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state.adminAuditLog||[],null,2)));
  $("#admin-student-search")?.addEventListener("input",e=>{state.adminStudentSearch=e.target.value; rerenderAdminContent();});
  $("#admin-audit-search")?.addEventListener("input",e=>{state.adminAuditSearch=e.target.value; rerenderAdminContent();});
  document.querySelectorAll("[data-admin-remove-enrollment]").forEach(b=>b.addEventListener("click",()=>removeAdminEnrollment(b.dataset.adminRemoveEnrollment)));
  document.querySelectorAll("[data-admin-delete-class]").forEach(b=>b.addEventListener("click",()=>deleteAdminClass(b.dataset.adminDeleteClass)));
  document.querySelectorAll("[data-admin-delete-chapter]").forEach(b=>b.addEventListener("click",()=>deleteAdminChapter(b.dataset.adminDeleteChapter)));
  document.querySelectorAll("[data-admin-toggle-student-status]").forEach(b=>b.addEventListener("click",()=>toggleAdminStudentStatus(b.dataset.adminToggleStudentStatus)));
  document.querySelectorAll("[data-admin-toggle-role]").forEach(b=>b.addEventListener("click",()=>toggleAdminRole(b.dataset.adminToggleRole)));
  document.querySelectorAll("[data-admin-delete-message]").forEach(b=>b.addEventListener("click",()=>adminDeleteMessage(b.dataset.adminDeleteMessage)));
  document.querySelectorAll("[data-admin-toggle-feed-pin]").forEach(b=>b.addEventListener("click",()=>adminToggleFeedPin(b.dataset.adminToggleFeedPin)));
  document.querySelectorAll("[data-admin-delete-feed]").forEach(b=>b.addEventListener("click",()=>adminDeleteFeed(b.dataset.adminDeleteFeed)));
  document.querySelectorAll("[data-admin-delete-score]").forEach(b=>b.addEventListener("click",()=>adminDeleteScore(b.dataset.adminDeleteScore)));
  document.querySelectorAll("[data-admin-delete-assignment]").forEach(b=>b.addEventListener("click",()=>adminDeleteAssignment(b.dataset.adminDeleteAssignment)));
  document.querySelectorAll("[data-admin-delete-event]").forEach(b=>b.addEventListener("click",()=>adminDeleteEvent(b.dataset.adminDeleteEvent)));
}

async function hydrateAdmin() {
  if(!state.isAdmin)return;
  try {
    await loadAdminData();
    attachAdminEvents();
  } catch(error) {
    console.error("Admin load error:",error);
    showToast(error?.message||"Unable to load admin data.","error");
  }
}


/* Final admin controls: class/chapter editing + Care Team pin moderation */

const __adminLoadDataBase = loadAdminData;
loadAdminData = async function() {
  await __adminLoadDataBase();
  state.adminPinnedMessages = await adminSafeQuery(
    supabaseClient.from("pinned_messages").select("id,message_id,pinned_by,created_at").order("created_at",{ascending:false}).limit(100)
  );
};

async function adminEditClass(id) {
  const klass=(state.adminClasses||[]).find(x=>String(x.id)===String(id));
  if(!klass)return;
  const name=prompt("Class name:",klass.name||"");
  if(!name?.trim())return;
  const invite=prompt("Invite code:",klass.invite_code||"");
  const {error}=await supabaseClient.from("classes").update({name:name.trim(),invite_code:invite?.trim()||null}).eq("id",id);
  if(error)return showToast(error.message,"error");
  await adminAudit("edit_class","class",id,{name:name.trim()});
  await loadAdminData(); rerenderAdminContent(); showToast("Class updated.","success");
}

async function adminEditChapter(id) {
  const chapter=(state.adminChapters||[]).find(x=>String(x.id)===String(id));
  if(!chapter)return;
  const title=prompt("Chapter title:",chapter.title||"");
  if(!title?.trim())return;
  const number=Number(prompt("Chapter number:",chapter.chapter_number));
  if(!number||number<1)return showToast("Invalid chapter number.","error");
  const {error}=await supabaseClient.from("chapters").update({chapter_number:number,title:title.trim()}).eq("id",id);
  if(error)return showToast(error.message,"error");
  await adminAudit("edit_chapter","chapter",id,{chapter_number:number,title:title.trim()});
  await loadAdminData(); rerenderAdminContent(); showToast("Chapter updated.","success");
}

async function adminUnpinMessage(pinId,messageId) {
  if(!confirm("Unpin this Care Team message?"))return;
  const {error}=await supabaseClient.from("pinned_messages").delete().eq("id",pinId);
  if(error)return showToast(error.message,"error");
  await adminAudit("admin_unpin_message","pinned_message",pinId,{message_id:messageId});
  await loadAdminData(); rerenderAdminContent(); showToast("Message unpinned.","success");
}

function renderAdminClasses() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🏫</span><h2>Class Management</h2></div></div><div class="admin-form-row"><input id="admin-class-name" class="text-input" placeholder="Class name (example: CNA)"><input id="admin-class-invite" class="text-input" placeholder="Invite code"><button class="primary-button" id="admin-create-class">Create Class</button></div><div class="admin-list">'+
    ((state.adminClasses||[]).map(x=>'<div class="admin-list-row"><div><strong>'+escapeHtml(x.name)+'</strong><small>Invite: '+escapeHtml(x.invite_code||"—")+'</small></div><div class="admin-row-actions"><button class="secondary-button small-button" data-admin-edit-class="'+x.id+'">Edit</button><button class="danger-button small-button" data-admin-delete-class="'+x.id+'">Delete</button></div></div>').join('')||'<div class="empty-state compact">No classes found.</div>')+
    '</div></section>';
}

function renderAdminChapters() {
  return '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📖</span><h2>Chapter Management</h2></div></div><div class="admin-form-row"><input id="admin-chapter-number" class="text-input" type="number" min="1" placeholder="Chapter #"><input id="admin-chapter-title" class="text-input" placeholder="Chapter title"><button class="primary-button" id="admin-create-chapter">Add Chapter</button></div><div class="admin-list">'+
    ((state.adminChapters||[]).map(x=>'<div class="admin-list-row"><div><strong>Chapter '+escapeHtml(x.chapter_number)+' — '+escapeHtml(x.title)+'</strong></div><div class="admin-row-actions"><button class="secondary-button small-button" data-admin-edit-chapter="'+x.id+'">Edit</button><button class="danger-button small-button" data-admin-delete-chapter="'+x.id+'">Delete</button></div></div>').join('')||'<div class="empty-state compact">No chapters found.</div>')+
    '</div></section>';
}

function renderAdminModeration() {
  const pins=state.adminPinnedMessages||[];
  const msgById=id=>(state.adminMessages||[]).find(m=>String(m.id)===String(id));
  return '<div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">💬</span><h2>Messages</h2></div></div><p class="admin-note">Moderate recent Care Team and direct messages.</p><div class="admin-list">'+((state.adminMessages||[]).map(m=>'<div class="admin-list-row"><div><strong>'+escapeHtml(adminStudentName(m.user_id))+'</strong><small>'+escapeHtml(m.content||m.message||"")+' · '+formatDateTime(m.created_at)+'</small></div><button class="danger-button small-button" data-admin-delete-message="'+m.id+'">Delete</button></div>').join('')||'<div class="empty-state compact">No messages found.</div>')+'</div></section>'+
  '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Feed</h2></div></div><div class="admin-list">'+((state.adminFeedPosts||[]).map(p=>'<div class="admin-list-row"><div><strong>'+escapeHtml(adminStudentName(p.user_id))+(p.pinned?" · 📌 Pinned":"")+'</strong><small>'+escapeHtml(p.content||"")+' · '+formatDateTime(p.created_at)+'</small></div><div class="admin-row-actions"><button class="secondary-button small-button" data-admin-toggle-feed-pin="'+p.id+'">'+(p.pinned?"Unpin":"Pin")+'</button><button class="danger-button small-button" data-admin-delete-feed="'+p.id+'">Delete</button></div></div>').join('')||'<div class="empty-state compact">No feed posts found.</div>')+'</div></section></div>'+
  '<section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Pinned Care Team Messages</h2></div><span class="admin-count">'+pins.length+'</span></div><div class="admin-list">'+
  (pins.map(p=>{const m=msgById(p.message_id);return '<div class="admin-list-row"><div><strong>'+escapeHtml(adminStudentName(m?.user_id||p.pinned_by))+'</strong><small>'+escapeHtml(m?.content||m?.message||"Pinned message")+' · '+formatDateTime(p.created_at)+'</small></div><button class="danger-button small-button" data-admin-unpin-message="'+p.id+'" data-message-id="'+p.message_id+'">Unpin</button></div>';}).join('')||'<div class="empty-state compact">No pinned Care Team messages.</div>')+
  '</div></section>';
}

const __adminAttachBase = attachAdminEvents;
attachAdminEvents = function() {
  __adminAttachBase();
  document.querySelectorAll("[data-admin-edit-class]").forEach(b=>b.addEventListener("click",()=>adminEditClass(b.dataset.adminEditClass)));
  document.querySelectorAll("[data-admin-edit-chapter]").forEach(b=>b.addEventListener("click",()=>adminEditChapter(b.dataset.adminEditChapter)));
  document.querySelectorAll("[data-admin-unpin-message]").forEach(b=>b.addEventListener("click",()=>adminUnpinMessage(b.dataset.adminUnpinMessage,b.dataset.messageId)));
};


function rerenderAdminContent() {
  const c=$("#admin-content");
  if(!c)return;
  const renderers={
    dashboard:renderAdminDashboard,
    students:renderAdminStudents,
    classes:renderAdminClasses,
    chapters:renderAdminChapters,
    academic:renderAdminAcademic,
    calendar:renderAdminCalendarControl,
    assignments:renderAdminAssignmentsControl,
    announcements:renderAdminAnnouncements,
    moderation:renderAdminModeration,
    admins:renderAdminAdmins,
    audit:renderAdminAudit,
    export:renderAdminExport,
    settings:renderAdminSettings
  };
  c.innerHTML=(renderers[state.adminSection]||renderAdminDashboard)();
  attachAdminEvents();
}
