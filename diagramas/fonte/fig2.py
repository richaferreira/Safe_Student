import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
W,H = 1100, 940
fig, ax = plt.subplots(figsize=(9.6, 9.6*H/W), dpi=130)
ax.set_xlim(0,W); ax.set_ylim(H,0); ax.axis("off")
INK="#1f2937"; EDGE="#374151"; QUIET="#4b5563"
BW=230
def cls(x,y,name,attrs,fc,stereo=None,main=False,bw=None):
    bw=bw or BW; rowh=18; head=40 if stereo else 28
    h=head+rowh*len(attrs)+8
    ax.add_patch(FancyBboxPatch((x,y),bw,h,boxstyle="round,pad=0,rounding_size=6",fc="white",ec=EDGE if not main else "#1d6f42",lw=2.2 if main else 1.4,zorder=3))
    ax.add_patch(Rectangle((x+1,y+1),bw-2,head-1,fc=fc,ec="none",zorder=4))
    ax.plot([x,x+bw],[y+head,y+head],color=EDGE,lw=1,zorder=5)
    if stereo:
        ax.text(x+bw/2,y+12,f"«{stereo}»",ha="center",va="center",fontsize=8.6,color=INK,zorder=6)
        ax.text(x+bw/2,y+29,name,ha="center",va="center",fontsize=9.6,fontweight="bold",color=INK,zorder=6)
    else:
        ax.text(x+bw/2,y+14,name,ha="center",va="center",fontsize=9.8,fontweight="bold",color=INK,zorder=6)
    for i,a in enumerate(attrs):
        ax.text(x+10,y+head+13+rowh*i,a,ha="left",va="center",fontsize=8.8,color=INK,zorder=6)
def ln(pts,dash=False):
    ax.plot([p[0] for p in pts],[p[1] for p in pts],color=EDGE,lw=1.2,zorder=2,solid_joinstyle="miter")
def t(x,y,s,ha="left",it=False,fs=8.4):
    ax.text(x,y,s,ha=ha,va="center",fontsize=fs,color=QUIET,style="italic" if it else "normal",zorder=7)
C1,C2,C3=30,375,815
ax.text(30,24,"Diagrama de classes conceitual",fontsize=13,fontweight="bold",color=INK,va="center")
ax.text(30,44,"Somente classes de negócio e enumerações; * lê-se 0..*",fontsize=8.6,color=QUIET,va="center")
cls(C1,70,"Turma",["id: String","nome: String","turno: TurnoTurma","status: StatusAtivo"],"#ffefd5")
cls(C2,70,"Aluno",["id: String","nome: String","matricula: String","token: String","status: StatusAtivo"],"#e6f4ea",main=True)
cls(C3,70,"Notificacao",["id: String","titulo: String","mensagem: String","lida: Boolean","severidade: String","dataHora: DateTime"],"#ffe1e1")
cls(C1,290,"ConviteResponsavel",["id: String","nome: String","email: String","telefone: String","cpf: String","parentesco: String","codigoHash: String","validade: DateTime","status: StatusConvite"],"#fde7f3")
cls(C2,290,"RegistroPresenca",["id: String","tipo: TipoRegistro","metodo: MetodoRegistro","dataHora: DateTime","origem: String"],"#dff4f1")
cls(C3,290,"Usuario",["id: String","nome: String","email: String","telefone: String","cpf: String","senhaHash: String","perfil: PerfilUsuario","status: StatusAtivo"],"#dbeafe")
cls(C1,540,"FeedbackValidacao",["id: String","perfil: String","cenario: String","sucesso: Boolean","tempoSegundos: Integer","nota: Integer (1 a 5)","comentario: String","fonte: String","dataHora: DateTime"],"#e8e4ff")
cls(C2,540,"EventoAuditoria",["id: String","usuarioId: String [0..1]","acao: String","entidade: String","entidadeId: String","detalhes: String","dataHora: DateTime"],"#eef2f7")
cls(C3,540,"Mensagem",["id: String","texto: String","dataHora: DateTime"],"#fff3c4")
# Turma - Aluno
ln([(260,110),(375,110)]); t(266,102,"1"); t(360,102,"*"); t(318,126,"possui",ha="center",it=True)
# Convite - Aluno
ln([(260,420),(285,420),(285,160),(375,160)]); t(266,434,"*"); t(360,153,"*"); t(291,300,"convida",it=True); t(291,314,"para",it=True)
# Notificacao - Aluno
ln([(605,110),(815,110)]); t(611,102,"0..1"); t(796,102,"*"); t(710,102,"refere-se a",ha="center",it=True)
# Aluno - Usuario
ln([(605,170),(700,170),(700,330),(815,330)]); t(611,162,"*"); t(796,323,"*"); t(708,236,"acompanha",it=True); t(708,250,"(perfil RESPONSAVEL)",it=True)
# Aluno - Presenca
ln([(490,196),(490,290)]); t(484,212,"1",ha="right"); t(484,278,"*",ha="right"); t(498,244,"tem",it=True)
# Presenca - Usuario
ln([(605,370),(815,370)]); t(611,362,"*"); t(780,362,"0..1"); t(710,362,"registrada por",ha="center",it=True)
# Usuario - Notificacao
ln([(930,290),(930,214)]); t(924,274,"1",ha="right"); t(924,226,"*",ha="right"); t(938,252,"recebe",it=True)
# Usuario - Mensagem
ln([(880,470),(880,540)]); ln([(980,470),(980,540)])
t(874,484,"1",ha="right"); t(874,526,"*",ha="right"); t(888,504,"remetente",it=True)
t(974,484,"1",ha="right"); t(974,526,"*",ha="right"); t(988,504,"destinatário",it=True)
# FeedbackValidacao nao tem associacao: o sistema nao grava o autor (feedback anonimo)
# enumeracoes
ax.text(30,772,"Enumerações",fontsize=9.6,fontweight="bold",color=INK,va="center")
ey=790; EW=165
for x,name,vals in [(30,"PerfilUsuario",["RESPONSAVEL","PORTARIA","GESTAO"]),(207,"StatusAtivo",["ATIVO","INATIVO"]),(384,"TipoRegistro",["ENTRADA","SAIDA"]),(561,"MetodoRegistro",["TOKEN_MANUAL","QR_CAMERA","QR_TOKEN"]),(738,"StatusConvite",["PENDENTE","UTILIZADO","REVOGADO"]),(915,"TurnoTurma",["Manhã","Tarde","Noite","Integral"])]:
    cls(x,ey,name,vals,"#f3e8ff",stereo="enumeration",bw=EW)
fig.savefig("fig2_classes.png",bbox_inches="tight",pad_inches=0.12,facecolor="white")
