import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
W,H=960,1070
fig,ax=plt.subplots(figsize=(9.6,9.6*H/W),dpi=110)
ax.set_xlim(0,W); ax.set_ylim(H,0); ax.axis("off")
INK="#1f2937"; EDGE="#374151"; GRID="#9ca3af"
X={"a":95,"t":295,"p":495,"d":695,"b":875}
names={"a":("Portaria ou","Gestão Escolar"),"t":("Tela de presença","presence.js"),"p":("API HTTP","src/app.js"),"d":("Regras de domínio","services/domain.js"),"b":("Banco SQLite","repository.js")}
cols={"a":"#dcf5ea","t":"#dbeafe","p":"#ffefd5","d":"#f3e8ff","b":"#eef2f7"}
ax.text(30,28,"Diagrama de sequência: registrar presença",fontsize=14,fontweight="bold",color=INK,va="center")
BWID=150
for k,x in X.items():
    ax.plot([x,x],[110,H-60],color=GRID,lw=1.1,ls=(0,(4,4)),zorder=1)
    ax.add_patch(FancyBboxPatch((x-BWID/2,60),BWID,46,boxstyle="round,pad=0,rounding_size=6",fc=cols[k],ec=EDGE,lw=1.4,zorder=3))
    ax.text(x,76,names[k][0],ha="center",va="center",fontsize=8.8,fontweight="bold",color=INK,zorder=4)
    ax.text(x,94,names[k][1],ha="center",va="center",fontsize=8.6,color="#4b5563",zorder=4)
def msg(y,a,b,text,ret=False,bold=False):
    xa,xb=X[a],X[b]
    ax.annotate("",xy=(xb,y),xytext=(xa,y),arrowprops=dict(arrowstyle=("->" if ret else "-|>"),mutation_scale=18,color="#1d4ed8" if bold else "#111827",lw=2.4 if bold else 1.7,ls=(0,(4,2.5)) if ret else "-",shrinkA=0,shrinkB=0),zorder=3)
    ax.text((xa+xb)/2,y-7,text,ha="center",va="bottom",fontsize=9,color=INK,fontweight="bold" if bold else "normal",zorder=5,bbox=dict(fc="white",ec="none",pad=0.8))
def selfmsg(y,a,text,right=True):
    x=X[a]; 
    ax.plot([x,x+34,x+34],[y,y,y+22],color="#111827",lw=1.7,zorder=3)
    ax.annotate("",xy=(x,y+22),xytext=(x+34,y+22),arrowprops=dict(arrowstyle="-|>",mutation_scale=18,color="#111827",lw=1.7),zorder=3)
    ax.text(x+42,y+11,text,ha="left",va="center",fontsize=9,color=INK,zorder=5,bbox=dict(fc="white",ec="none",pad=0.8))
y=140
msg(y,"a","t","digita o token ou lê o QR Code");y+=40
msg(y,"t","p","GET /api/attendance/lookup");y+=40
selfmsg(y,"p","verifica perfil (canRegisterAttendance)");y+=56
msg(y,"p","b","lê o banco (readDb)");y+=36
msg(y,"b","p","aluno ativo e presenças do dia",ret=True);y+=40
msg(y,"p","t","aluno, estado do dia e próxima ação",ret=True);y+=40
msg(y,"t","a","exibe o aluno e o botão registrar",ret=True);y+=44
msg(y,"a","t","confirma o registro",bold=True);y+=40
msg(y,"t","p","POST /api/attendance");y+=40
selfmsg(y,"p","verifica perfil e tipo");y+=56
msg(y,"p","b","lê o banco (readDb)");y+=36
msg(y,"b","p","aluno ativo e presenças do dia",ret=True);y+=40
msg(y,"p","d","validateAttendanceSequence");y+=36
msg(y,"d","p","válida ou inválida",ret=True);y+=44
top=y-10
ax.add_patch(Rectangle((140,top),780,200,fc="none",ec=EDGE,lw=1.1,zorder=2))
ax.add_patch(Rectangle((140,top),44,18,fc="white",ec=EDGE,lw=1.1,zorder=2))
ax.text(162,top+9,"alt",ha="center",va="center",fontsize=9,fontweight="bold",color=INK)
ax.text(192,top+9,"[sequência válida]",ha="left",va="center",fontsize=9,color="#4b5563")
y=top+50
msg(y,"p","b","writeDb: presença, notificações e auditoria");y+=40
msg(y,"p","t","201: registro e nº de responsáveis notificados",ret=True)
div=y+28
ax.plot([140,920],[div,div],color=EDGE,lw=1.1,ls=(0,(5,3)))
ax.text(150,div+12,"[sequência inválida]",ha="left",va="center",fontsize=9,color="#4b5563")
y=div+48
msg(y,"p","t","409: erro de sequência, nada é gravado",ret=True)
y=top+200+36
msg(y,"t","a","exibe o resultado",ret=True)
y+=50
ax.add_patch(Rectangle((40,y),880,34,fc="#fff8dc",ec="#c9a227",lw=1,zorder=2))
ax.text(52,y+17,"Nota: perfil sem permissão (403) ou token inexistente (404) encerram antes da validação, sem gravar nada.",ha="left",va="center",fontsize=8.6,color="#5b4a00",zorder=3)
fig.savefig("fig4_sequencia.png",bbox_inches="tight",pad_inches=0.15,facecolor="white")
print(y)
