import math, itertools
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Circle

W, H = 1200, 1385
INK = "#1f2937"
C = {"R": "#1f5f8b", "P": "#12805c", "G": "#b8651b", "T": "#8a1c1c"}
FILL = {"R": "#dbeafe", "P": "#dcf5ea", "G": "#ffefd5", "S": "#f3e8ff", "N": "#f8fafc", "A": "#fff3c4"}

# (key, label, cx, cy, rx, ry, fill, edge)
UC = {}
def uc(key, label, cx, cy, rx=125, ry=27, fill="N", edge="#374151", lw=1.6):
    rx = rx*1.30
    UC[key] = dict(label=label, cx=cx, cy=cy, rx=rx, ry=ry, fill=FILL.get(fill, fill), edge=edge, lw=lw)

CX = 570
ys = {"auth":95,"senha":175,"ativar":255,"acomp":325,"csv":405,"notif":475,"msg":545,"feed":615}
uc("auth", "Autenticar-se", CX, ys["auth"])
uc("senha", "Recuperar senha", CX, ys["senha"], 105, 22)
uc("ativar", "Ativar conta de responsável", CX, ys["ativar"])
uc("acomp", "Acompanhar presença", CX, ys["acomp"])
uc("csv", "Exportar relatório CSV", CX, ys["csv"], 115, 22)
uc("notif", "Consultar notificações", CX, ys["notif"])
uc("msg", "Trocar mensagens", CX, ys["msg"])
uc("feed", "Registrar feedback acadêmico", CX, ys["feed"])
uc("alunos_c", "Consultar alunos", CX, 705)
uc("pres", "Registrar presença", CX, 780)
uc("loc", "Localizar aluno\npor token ou QR", CX-125, 875, 88, 28)
uc("not", "Notificar\nresponsáveis", CX+125, 875, 88, 28)
uc("gal", "Gerenciar alunos e vínculos", CX, 970, 135, 27)
uc("sel", "Selecionar\nturma ativa", CX-125, 1060, 88, 28)
uc("vin", "Vincular\nresponsável", CX+125, 1060, 88, 28)
uc("tur", "Gerenciar turmas", CX, 1150, 125, 27, "A", "#b8651b", 2.6)
uc("aud", "Consultar auditoria", CX, 1220)
uc("val", "Consultar validação acadêmica", CX, 1290, 145, 27)

ACT = {"R": (64, 360), "P": (64, 800), "G": (1115, 985)}
assoc = {
 "R": ["auth","ativar","acomp","notif","msg","feed"],
 "P": ["auth","acomp","msg","feed","alunos_c","pres"],
 "G": ["auth","acomp","msg","feed","alunos_c","pres","gal","tur","aud","val"],
}

def edge_point(k, toward):
    u = UC[k]; ax, ay = toward
    if toward[0] < u["cx"]-u["rx"]-5 and toward[1] is not None and toward[2:]==():
        pass
    dx, dy = ax-u["cx"], ay-u["cy"]
    side = -1 if dx < 0 else 1
    if abs(dx) > u["rx"]*1.6:
        return u["cx"]+side*u["rx"], u["cy"]
    t = 1/math.sqrt((dx/u["rx"])**2 + (dy/u["ry"])**2)
    return u["cx"]+dx*t, u["cy"]+dy*t

def seg_hits(p, q, skip):
    n=0
    for k,u in UC.items():
        if k==skip: continue
        for i in range(2,98):
            x = p[0]+(q[0]-p[0])*i/100; y = p[1]+(q[1]-p[1])*i/100
            if ((x-u["cx"])/(u["rx"]+4))**2 + ((y-u["cy"])/(u["ry"]+4))**2 < 1:
                n+=1; break
    return n

bad=0
for a,ks in assoc.items():
    ax,ay = ACT[a]
    start = (ax+16 if a!="G" else ax-16, ay-10)
    for k in ks:
        q = edge_point(k, start); h = seg_hits(start,q,k)
        if h: print("CRUZA", a, k, h); bad+=h
print("cruzamentos linha/elipse:", bad)

fig, ax = plt.subplots(figsize=(10.2, 10.2*H/W), dpi=110)
ax.set_xlim(0,W); ax.set_ylim(H,0); ax.axis("off")
ax.add_patch(FancyBboxPatch((172,48),850,1310,boxstyle="round,pad=0,rounding_size=14",fc="white",ec="#2b4a5e",lw=2.6))
ax.text(197,84,"Safe Student",fontsize=13.5,fontweight="bold",color="#1b2536",va="center")
ax.text(197,106,"Casos de uso",fontsize=9,color="#5b6b82",va="center")

def draw_man(x,y,color,label):
    ax.add_patch(Circle((x,y-34),12,fc="white",ec=color,lw=2.6))
    ax.plot([x,x],[y-22,y+14],color=color,lw=2.6)
    ax.plot([x-20,x+20],[y-10,y-10],color=color,lw=2.6)
    ax.plot([x,x-16],[y+14,y+40],color=color,lw=2.6)
    ax.plot([x,x+16],[y+14,y+40],color=color,lw=2.6)
    ax.text(x,y+62,label,ha="center",fontsize=11,fontweight="bold",color=color,zorder=9,bbox=dict(fc="white",ec="none",pad=1.5))
draw_man(*ACT["R"],C["R"],"Responsável")
draw_man(*ACT["P"],C["P"],"Portaria")
draw_man(*ACT["G"],C["G"],"Gestão Escolar")

for a,ks in assoc.items():
    ax_, ay_ = ACT[a]; start=(ax_+16 if a!="G" else ax_-16, ay_-10)
    for k in ks:
        q = edge_point(k,start)
        ax.plot([start[0],q[0]],[start[1],q[1]],color=C[a],lw=1.2,alpha=.9,zorder=1)

for k,u in UC.items():
    ax.add_patch(Ellipse((u["cx"],u["cy"]),2*u["rx"],2*u["ry"],fc=u["fill"],ec=u["edge"],lw=u["lw"],zorder=3))
    ax.text(u["cx"],u["cy"],u["label"],ha="center",va="center",fontsize=9.4,fontweight="bold",color=INK,zorder=4,linespacing=1.15)

def dep(a,b,label,dx=0,dy=0,ha="left"):
    A=UC[a]; B=UC[b]
    p=edge_point(a,(B["cx"],B["cy"])); q=edge_point(b,(A["cx"],A["cy"]))
    ax.annotate("",xy=q,xytext=p,arrowprops=dict(arrowstyle="->,head_length=0.8,head_width=0.4",ls=(0,(2.5,2)),color="#374151",lw=1.5,shrinkA=0,shrinkB=0),zorder=2)
    mx,my=(p[0]+q[0])/2+dx,(p[1]+q[1])/2+dy
    ax.text(mx,my,label,fontsize=9.5,style="italic",color="#374151",ha=ha,va="center",zorder=5,
            bbox=dict(fc="white",ec="none",pad=1.2))
dep("senha","auth","«extend»",14,0)
dep("csv","acomp","«extend»",14,0)
dep("pres","loc","«include»",-8,0,"right")
dep("pres","not","«include»",8,0,"left")
dep("gal","sel","«include»",-8,0,"right")
dep("gal","vin","«include»",8,0,"left")

ax.text(197,1338,"«include»: etapa obrigatória  ·  «extend»: etapa opcional  ·  destaque: caso de uso novo",
        fontsize=9.2,color="#6b5b1f",va="center")
fig.savefig("fig1_casos_de_uso.png",bbox_inches="tight",pad_inches=0.15,facecolor="white")
