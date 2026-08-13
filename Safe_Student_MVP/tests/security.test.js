const test=require('node:test');const assert=require('node:assert/strict');const {hashPassword,verifyPassword}=require('../lib/security');
test('hash e verificação de senha',()=>{const h=hashPassword('demo123','0123456789abcdef');assert.equal(verifyPassword('demo123',h),true);assert.equal(verifyPassword('errada',h),false)});
