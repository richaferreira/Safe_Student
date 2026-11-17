import subprocess
def table(name, cols, color="#e6f4ea"):
    rows="".join(f'<TR><TD ALIGN="LEFT" PORT="{p}_l"><FONT POINT-SIZE="13"><B>{k or "&nbsp;"}</B></FONT></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="13">{n}</FONT></TD><TD ALIGN="LEFT" PORT="{p}_r"><FONT POINT-SIZE="11" COLOR="#4b5563">{d or "&nbsp;"}</FONT></TD></TR>' for p,k,n,d in cols)
    return f'<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2" COLOR="#374151"><TR><TD COLSPAN="3" BGCOLOR="{color}"><B><FONT POINT-SIZE="14">{name}</FONT></B></TD></TR><HR/>{rows}</TABLE>>'
T = {
 "school": ("#eef2f7",[("id","PK","id",""),("name","","name",""),("city","","city",""),("mode","","mode","")]),
 "users": ("#dbeafe",[("id","PK","id",""),("name","","name",""),("email","UQ","email",""),("phone","","phone",""),("cpf","UQ","cpf",""),("pw","","password_hash",""),("role","","role","GESTAO, PORTARIA, RESPONSAVEL"),("status","","status","ATIVO, INATIVO")]),
 "classes": ("#ffefd5",[("id","PK","id",""),("name","","name",""),("shift","","shift",""),("status","","status","ATIVO, INATIVO")]),
 "students": ("#e6f4ea",[("id","PK","id",""),("name","","name",""),("enr","UQ","enrollment",""),("class_id","FK","class_id","NOT NULL"),("token","UQ","token",""),("status","","status","ATIVO, INATIVO")]),
 "guardian_students": ("#e6f4ea",[("g","PK, FK","guardian_id","→ users.id"),("s","PK, FK","student_id","→ students.id")]),
 "attendance": ("#dff4f1",[("id","PK","id",""),("s","FK","student_id","→ students.id"),("type","","type","ENTRADA, SAIDA"),("method","","method",""),("ts","","timestamp",""),("rb","FK","registered_by","→ users.id (nulo)"),("origin","","origin","")]),
 "notifications": ("#ffe1e1",[("id","PK","id",""),("u","FK","user_id","→ users.id"),("s","FK","student_id","→ students.id (nulo)"),("title","","title",""),("msg","","message",""),("created","","created_at",""),("read","","is_read",""),("sev","","severity","")]),
 "messages": ("#fff3c4",[("id","PK","id",""),("f","FK","from_user_id","→ users.id"),("t","FK","to_user_id","→ users.id"),("text","","text",""),("created","","created_at","")]),
 "audit_log": ("#eef2f7",[("id","PK","id",""),("user","","user_id","sem FK"),("action","","action",""),("entity","","entity",""),("eid","","entity_id",""),("det","","details",""),("created","","created_at","")]),
 "feedback": ("#e8e4ff",[("id","PK","id",""),("u","FK","user_id","→ users.id (nulo)"),("profile","","profile",""),("scenario","","scenario",""),("success","","success",""),("time","","time_seconds",""),("score","","score","1 a 5"),("comment","","comment",""),("source","","source",""),("created","","created_at","")]),
 "guardian_invitations": ("#fde7f3",[("id","PK","id",""),("name","","name",""),("email","","email",""),("phone","","phone",""),("cpf","","cpf",""),("rel","","relationship",""),("status","","status","PENDENTE, UTILIZADO, REVOGADO"),("code","","code_hash",""),("exp","","expires_at","")]),
 "guardian_invitation_students": ("#fde7f3",[("i","PK, FK","invitation_id","→ guardian_invitations.id"),("s","PK, FK","student_id","→ students.id")]),
}
d=['digraph G {','graph [label="Notação pé de galinha, no lado do pai:  ||  exatamente um     o|  zero ou um     (lado da chave estrangeira:  o<  zero ou muitos)", labelloc=b, fontsize=15, rankdir=LR, nodesep=0.25, ranksep=1.1, splines=spline, fontname="DejaVu Sans", bgcolor="white", pad=0.2];',
   'node [shape=plain, fontname="DejaVu Sans"];','edge [color="#374151", arrowhead=normal, arrowsize=0.8, penwidth=1.2];']
for n,(c,cols) in T.items(): d.append(f'{n} [label={table(n,cols,c)}];')
fk=[("students","class_id","classes","id"),("guardian_students","g","users","id"),("guardian_students","s","students","id"),
    ("attendance","s","students","id"),("attendance","rb","users","id"),("notifications","u","users","id"),("notifications","s","students","id"),
    ("messages","f","users","id"),("messages","t","users","id"),("feedback","u","users","id"),
    ("guardian_invitation_students","i","guardian_invitations","id"),("guardian_invitation_students","s","students","id")]
for a,pa,b,pb in fk:
    info=[c for c in T[a][1] if c[0]==pa][0][3]
    parent="teeodot" if "nulo" in info else "teetee"
    d.append(f'{a}:{pa}_r:e -> {b} [dir=both, arrowtail=crowodot, arrowhead={parent}, arrowsize=1.5, penwidth=1.8];')
d.append('}')
open("fig3.dot","w").write("\n".join(d))
r=subprocess.run(["dot","-Tpng","-Gdpi=120","fig3.dot","-o","fig3_er.png"],capture_output=True,text=True)
print(r.stderr[:400])
