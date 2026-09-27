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
  supabaseClient.from('profiles').select('id,display_name,full_name,bio,avatar_url,created_at').order('display_name'),
  supabaseClient.from('classes').select('id,name,invite_code,created_by,created_at').order('created_at'),
  supabaseClient.from('chapters').select('*').order('chapter_number'),
  supabaseClient.from('admin_audit_log').select('*').order('created_at',{ascending:false}).limit(100),
  supabaseClient.from('enrollments').select('id,student_id,class_id,role,enrolled_at').order('enrolled_at',{ascending:false})
 ]);
 const bad=results.find(x=>x.error); if(bad)throw bad.error;
 state.adminStudents=results[0].data||[]; state.adminClasses=results[1].data||[]; state.adminChapters=results[2].data||[]; state.adminAuditLog=results[3].data||[];
}
function renderAdmin(){
 if(!state.isAdmin)return '<section class="page"><div class="panel admin-denied"><div class="empty-icon">🔒</div><h2>Admin access required</h2><p>This area is restricted to StudentHub administrators.</p></div></section>';
 const sections=[['dashboard','📊','Dashboard'],['students','👥','Students'],['classes','🏫','Class'],['chapters','📖','Chapters'],['announcements','📢','Announcements'],['audit','🧾','Audit Log'],['settings','⚙️','Settings']];
 let content=renderAdminDashboard();
 if(state.adminSection==='students')content=renderAdminStudents(); if(state.adminSection==='classes')content=renderAdminClasses(); if(state.adminSection==='chapters')content=renderAdminChapters(); if(state.adminSection==='announcements')content=renderAdminAnnouncements(); if(state.adminSection==='audit')content=renderAdminAudit(); if(state.adminSection==='settings')content=renderAdminSettings();
 return '<section class="page"><div class="page-header admin-page-header"><div><p class="eyebrow">ADMINISTRATOR</p><h1>StudentHub Admin</h1><p>Full administrative control for the class hub.</p></div><span class="admin-badge">🛡️ ADMIN</span></div><div class="admin-nav">'+sections.map(x=>'<button class="admin-nav-button '+(state.adminSection===x[0]?'active':'')+'" data-admin-section="'+x[0]+'">'+x[1]+' '+x[2]+'</button>').join('')+'</div><div id="admin-content">'+content+'</div></section>';
}
function renderAdminDashboard(){
 const stats=[['👥',state.adminStudents.length,'Students'],['🏫',state.adminClasses.length,'Classes'],['📖',state.adminChapters.length,'Chapters'],['🧾',state.adminAuditLog.length,'Audit Events']];
 const controls=[['students','Manage Students'],['classes','Manage Class'],['chapters','Manage Chapters'],['announcements','Announcements'],['audit','View Audit Log'],['settings','Admin Settings']];
 return '<div class="admin-stat-grid">'+stats.map(x=>'<div class="panel admin-stat-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('')+'</div><div class="admin-grid"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">🛡️</span><h2>Admin Controls</h2></div></div><div class="admin-control-list">'+controls.map(x=>'<button class="secondary-button" data-admin-section="'+x[0]+'">'+x[1]+'</button>').join('')+'</div></section><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">📌</span><h2>Admin Rules</h2></div></div><ul class="admin-rule-list"><li>Admin-only information is restricted from regular students.</li><li>Administrative actions are recorded in the audit log.</li><li>The Care Team remains the class group chat.</li></ul></section></div>';
}
function renderAdminStudents(){
 const className=id=>{const x=state.adminClasses.find(c=>String(c.id)===String(id));return x?.name||'No class';};
 const studentName=id=>{const x=state.adminStudents.find(s=>String(s.id)===String(id));return x?.display_name||x?.full_name||'Student';};
 const enrolledFor=studentId=>state.adminEnrollments.filter(e=>String(e.student_id)===String(studentId));
 return '<div class="admin-student-tools"><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">➕</span><h2>Manage Enrollment</h2></div></div><p class="admin-note">Assign a student to a class or remove their class enrollment. This does not delete their StudentHub account.</p><div class="admin-form-row admin-enrollment-form"><select id="admin-enroll-student" class="text-input"><option value="">Select student</option>'+state.adminStudents.map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.display_name||s.full_name||'Student')+'</option>').join('')+'</select><select id="admin-enroll-class" class="text-input"><option value="">Select class</option>'+state.adminClasses.map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.name)+'</option>').join('')+'</select><button class="primary-button" id="admin-enroll-student-button">Assign</button></div><div id="admin-enrollment-status" class="form-error"></div></section></div><section class="panel admin-panel"><div class="panel-header"><div><span class="panel-icon">👥</span><h2>Students</h2></div><span class="admin-count">'+state.adminStudents.length+'</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Student</th><th>Class Enrollment</th><th>Profile</th><th>Joined</th></tr></thead><tbody>'+(state.adminStudents.map(s=>'<tr><td><strong>'+escapeHtml(s.display_name||s.full_name||'Student')+'</strong><br><small>'+escapeHtml(s.full_name||'')+'</small></td><td>'+(enrolledFor(s.id).map(e=>'<div class="admin-enrollment-chip"><span>'+escapeHtml(className(e.class_id))+'</span><button class="danger-button small-button" data-admin-remove-enrollment="'+escapeHtml(e.id)+'" title="Remove enrollment">Remove</button></div>').join('')||'<span class="admin-muted">Not enrolled</span>')+'</td><td>'+(s.avatar_url?'Photo':'No photo')+'</td><td>'+formatDate(s.created_at)+'</td></tr>').join('')||'<tr><td colspan="4">No students found.</td></tr>')+'</tbody></table></div></section>';
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
function rerenderAdminContent(){const c=$('#admin-content');if(!c)return;let content=renderAdminDashboard();if(state.adminSection==='students')content=renderAdminStudents();if(state.adminSection==='classes')content=renderAdminClasses();if(state.adminSection==='chapters')content=renderAdminChapters();if(state.adminSection==='announcements')content=renderAdminAnnouncements();if(state.adminSection==='audit')content=renderAdminAudit();if(state.adminSection==='settings')content=renderAdminSettings();c.innerHTML=content;attachAdminEvents();}
function attachAdminEvents(){document.querySelectorAll('[data-admin-section]').forEach(b=>b.addEventListener('click',()=>{state.adminSection=b.dataset.adminSection||'dashboard';rerenderAdminContent();}));$('#admin-create-class')?.addEventListener('click',createAdminClass);
 $('#admin-enroll-student-button')?.addEventListener('click',createAdminEnrollment);
 document.querySelectorAll('[data-admin-remove-enrollment]').forEach(b=>b.addEventListener('click',()=>removeAdminEnrollment(b.dataset.adminRemoveEnrollment)));$('#admin-create-chapter')?.addEventListener('click',createAdminChapter);$('#admin-send-announcement')?.addEventListener('click',sendAdminAnnouncement);document.querySelectorAll('[data-admin-delete-class]').forEach(b=>b.addEventListener('click',()=>deleteAdminClass(b.dataset.adminDeleteClass)));document.querySelectorAll('[data-admin-delete-chapter]').forEach(b=>b.addEventListener('click',()=>deleteAdminChapter(b.dataset.adminDeleteChapter)));}
async function hydrateAdmin(){if(!state.isAdmin)return;try{await loadAdminData();attachAdminEvents();}catch(error){console.error('Admin load error:',error);showToast(error?.message||'Unable to load admin data.','error');}}