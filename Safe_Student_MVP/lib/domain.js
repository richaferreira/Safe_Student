function normalizeToken(value){ return String(value || '').trim().toUpperCase(); }
function canRegisterAttendance(role){ return ['PORTARIA','GESTAO','ADMIN'].includes(role); }
function canManageSchool(role){ return ['GESTAO','ADMIN'].includes(role); }
function canViewAudit(role){ return ['GESTAO','ADMIN'].includes(role); }
function allowedStudentIds(user, db){
  if (!user) return [];
  if (user.role === 'RESPONSAVEL') return user.studentIds || [];
  if (['PORTARIA','GESTAO','ADMIN'].includes(user.role)) return db.students.filter(s=>s.status==='ATIVO').map(s=>s.id);
  return [];
}
function validateAttendanceSequence(records, type){
  const sorted=[...records].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const last=sorted[sorted.length-1];
  if(type==='ENTRADA' && last && last.type==='ENTRADA') return {ok:false,error:'Já existe entrada pendente para este aluno hoje.'};
  if(type==='SAIDA' && (!last || last.type!=='ENTRADA')) return {ok:false,error:'Não há entrada válida para registrar saída.'};
  return {ok:true};
}
function attendanceRate(records, schoolDays=20){
  const uniqueDays=new Set(records.filter(r=>r.type==='ENTRADA').map(r=>r.timestamp.slice(0,10)));
  return schoolDays > 0 ? Math.min(100, Math.round((uniqueDays.size/schoolDays)*100)) : 0;
}
module.exports={normalizeToken,canRegisterAttendance,canManageSchool,canViewAudit,allowedStudentIds,validateAttendanceSequence,attendanceRate};
