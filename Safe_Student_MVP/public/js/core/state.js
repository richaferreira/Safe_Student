/**
 * Estado compartilhado do frontend e metadados das telas.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
let currentUser=null;
let dashboard=null;
let students=[];
let classCatalog=[];
let guardianCatalog=[];
let guardianData={
  guardians:[],invitations:[]
};
let guardianDrafts=[];
let editingStudentId=null;
let reportData={
  rows:[],events:[],summary:{
  }
};
let reportMode='events';
let activeConversationPeer='';
let presenceSelection=null;
let presenceMethod='TOKEN_MANUAL';
let schoolTimeZone='America/Sao_Paulo';
let qrStream=null;
let qrTimer=null;
let currentView='dashboard';
let activeStudentProfileId='';
let studentProfileReturn={
  view:'students',scrollY:0
};
let studentProfileData=null;
let studentProfileTab='timeline';
const $=id=>document.getElementById(id);
const qsa=s=>Array.from(document.querySelectorAll(s));
const isManager=()=>['GESTAO','ADMIN'].includes(currentUser?.role);
const isOperator=()=>['PORTARIA','GESTAO','ADMIN'].includes(currentUser?.role);
const viewMeta={
  dashboard:['Painel','Visão geral','O que precisa de atenção na rotina escolar.'], presence:['Operação','Portaria','Consulte o estudante e execute somente a próxima movimentação válida.'], students:['Cadastros','Alunos e vínculos','Matrículas, situação operacional e responsáveis autorizados.'], 'student-profile':['Aluno','Histórico individual','Perfil, movimentações e eventos organizados conforme sua permissão.'], guardians:['Famílias','Central de responsáveis','Contas, filhos vinculados e convites de ativação.'], notifications:['Comunicação','Notificações','Avisos internos gerados para a sua conta.'], reports:['Indicadores','Relatórios','Movimentações filtradas e exportação consistente em CSV.'], messages:['Relacionamento','Comunicação','Conversas entre os perfis permitidos.'], audit:['Governança','Auditoria','Eventos críticos pesquisáveis e rastreáveis.'], feedback:['Demonstração','Validação acadêmica','Evidências de teste sem dados pessoais do participante.'], privacy:['Informações','Privacidade','Controles existentes e limites desta demonstração.']
};
