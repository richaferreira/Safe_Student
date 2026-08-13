const test=require('node:test');const assert=require('node:assert/strict');
const {normalizeToken,canRegisterAttendance,allowedStudentIds,validateAttendanceSequence,attendanceRate}=require('../lib/domain');
test('normaliza token',()=>assert.equal(normalizeToken(' ss-alu001 '),'SS-ALU001'));
test('RBAC de presença',()=>{assert.equal(canRegisterAttendance('PORTARIA'),true);assert.equal(canRegisterAttendance('GESTAO'),true);assert.equal(canRegisterAttendance('RESPONSAVEL'),false)});
test('responsável vê somente vinculados',()=>{const db={students:[{id:'s1',status:'ATIVO'},{id:'s2',status:'ATIVO'}]};assert.deepEqual(allowedStudentIds({role:'RESPONSAVEL',studentIds:['s2']},db),['s2'])});
test('bloqueia saída sem entrada',()=>assert.equal(validateAttendanceSequence([],'SAIDA').ok,false));
test('bloqueia segunda entrada',()=>assert.equal(validateAttendanceSequence([{type:'ENTRADA',timestamp:'2026-08-12T10:00:00Z'}],'ENTRADA').ok,false));
test('permite saída depois de entrada',()=>assert.equal(validateAttendanceSequence([{type:'ENTRADA',timestamp:'2026-08-12T10:00:00Z'}],'SAIDA').ok,true));
test('taxa de apresentação',()=>{const rows=[{type:'ENTRADA',timestamp:'2026-08-01T10:00:00Z'},{type:'ENTRADA',timestamp:'2026-08-02T10:00:00Z'}];assert.equal(attendanceRate(rows,20),10)});
