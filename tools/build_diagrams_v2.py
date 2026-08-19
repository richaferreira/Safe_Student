from pathlib import Path
import html
import cairosvg

OUT = Path('docs/diagramas')
OUT.mkdir(parents=True, exist_ok=True)
FONT = 'Arial, Helvetica, sans-serif'


def esc(value):
    return html.escape(str(value))


def head(w, h, title):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<style>
text{{font-family:{FONT};fill:#111}}
.title{{font-size:20px;font-weight:700}}
.label{{font-size:13px;font-weight:400}}
.small{{font-size:11px;font-weight:400}}
.boxTitle{{font-size:13px;font-weight:700}}
.attr{{font-size:10.5px;font-weight:400}}
</style>
<rect width="100%" height="100%" fill="white"/>
<text x="{w/2}" y="35" text-anchor="middle" class="title">{esc(title)}</text>'''


def foot():
    return '</svg>'


def actor(x, y, name):
    return f'''<circle cx="{x}" cy="{y}" r="11" fill="white" stroke="#111" stroke-width="1.2"/>
<line x1="{x}" y1="{y+11}" x2="{x}" y2="{y+47}" stroke="#111" stroke-width="1.2"/>
<line x1="{x-20}" y1="{y+26}" x2="{x+20}" y2="{y+26}" stroke="#111" stroke-width="1.2"/>
<line x1="{x}" y1="{y+47}" x2="{x-18}" y2="{y+73}" stroke="#111" stroke-width="1.2"/>
<line x1="{x}" y1="{y+47}" x2="{x+18}" y2="{y+73}" stroke="#111" stroke-width="1.2"/>
<text x="{x}" y="{y+94}" text-anchor="middle" class="label">{esc(name)}</text>'''


def ellipse(cx, cy, rx, label_text):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="34" fill="white" stroke="#111" stroke-width="1.2"/><text x="{cx}" y="{cy+5}" text-anchor="middle" class="label">{esc(label_text)}</text>'


def line(x1, y1, x2, y2, dash=False):
    d = ' stroke-dasharray="5 4"' if dash else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#222" stroke-width="1"{d}/>'


def poly(points, dash=False):
    d = ' stroke-dasharray="5 4"' if dash else ''
    pts = ' '.join(f'{x},{y}' for x, y in points)
    return f'<polyline points="{pts}" fill="none" stroke="#222" stroke-width="1"{d}/>'


def label(x, y, text, anchor='middle'):
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="small">{esc(text)}</text>'


def save_svg(name, content, width):
    path = OUT / name
    path.write_text(content, encoding='utf-8')
    cairosvg.svg2png(bytestring=content.encode('utf-8'), write_to=str(path.with_suffix('.png')), output_width=width)


def usecase(actor_name, cases, filename, note):
    w, h = 1100, 720
    s = [head(w, h, f'Diagrama de casos de uso - {actor_name}'),
         '<rect x="260" y="70" width="760" height="580" fill="none" stroke="#111" stroke-width="1.2"/>',
         '<text x="280" y="98" class="label">Safe Student - MVP acadêmico</text>',
         actor(120, 300, actor_name)]
    ys = [145 + i * 90 for i in range(len(cases))]
    for y, case in zip(ys, cases):
        s.append(ellipse(650, y, 220, case))
        s.append(line(150, 325, 430, y))
    s.append(label(550, 690, note))
    s.append(foot())
    save_svg(filename, ''.join(s), w)


def class_box(x, y, w, title, attrs):
    rh = 18
    h = 32 + len(attrs) * rh + 10
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="#111" stroke-width="1.2"/>',
         f'<line x1="{x}" y1="{y+32}" x2="{x+w}" y2="{y+32}" stroke="#111" stroke-width="1"/>',
         f'<text x="{x+w/2}" y="{y+21}" text-anchor="middle" class="boxTitle">{esc(title)}</text>']
    for i, attr in enumerate(attrs):
        s.append(f'<text x="{x+10}" y="{y+51+i*rh}" class="attr">{esc(attr)}</text>')
    return ''.join(s), h


def classes_core():
    w, h = 1500, 850
    s = [head(w, h, 'Diagrama de classes conceitual - núcleo de presença')]
    specs = {
        'Usuario': (70, 100, 280, ['id: string/UUID', 'nome: string', 'email: string', 'passwordHash: string', 'perfil: PerfilUsuario', 'status: string']),
        'Aluno': (600, 100, 280, ['id: string/UUID', 'nome: string', 'matricula: string', 'token: string', 'status: string', 'classId: string']),
        'Turma': (1110, 100, 260, ['id: string', 'nome: string', 'turno: string']),
        'RegistroPresenca': (390, 500, 320, ['id: string/UUID', 'studentId: string', 'tipo: ENTRADA | SAIDA', 'metodo: QR_TOKEN', 'timestamp: datetime', 'registeredBy: userId', 'origem: string']),
        'Notificacao': (850, 500, 330, ['id: string/UUID', 'userId: string', 'studentId: string', 'titulo: string', 'mensagem: string', 'createdAt: datetime', 'lida: boolean', 'severidade: string']),
    }
    boxes = {}
    for name, (x, y, bw, attrs) in specs.items():
        box, bh = class_box(x, y, bw, name, attrs)
        s.append(box)
        boxes[name] = (x, y, bw, bh)
    ux, uy, uw, uh = boxes['Usuario']; ax, ay, aw, ah = boxes['Aluno']; tx, ty, tw, th = boxes['Turma']
    px, py, pw, ph = boxes['RegistroPresenca']; nx, ny, nw, nh = boxes['Notificacao']
    s.append(line(ux+uw, uy+110, ax, ay+110)); s += [label(ux+uw+10, uy+98, '0..*', 'start'), label(ax-10, ay+98, '0..*', 'end'), label((ux+uw+ax)/2, uy+95, 'acompanha (Responsável)')]
    s.append(line(ax+aw, ay+75, tx, ty+75)); s += [label(ax+aw+10, ay+63, '0..*', 'start'), label(tx-10, ty+63, '1', 'end'), label((ax+aw+tx)/2, ay+60, 'pertence a')]
    s.append(line(ax+aw/2, ay+ah, ax+aw/2, 390)); s.append(poly([(ax+aw/2, 390), (px+pw/2, 390), (px+pw/2, py)])); s += [label(ax+aw/2+10, ay+ah+18, '1', 'start'), label(px+pw/2+12, py-8, '0..*', 'start'), label(760, 380, 'possui')]
    s.append(poly([(ux+uw/2, uy+uh), (ux+uw/2, 440), (px, 440), (px, py+75)])); s += [label(ux+uw/2+10, uy+uh+18, '1', 'start'), label(px-8, py+68, '0..*', 'end'), label(300, 430, 'registra')]
    s.append(poly([(ax+aw, ay+ah-30), (1030, ay+ah-30), (1030, py), (nx+nw/2, py)])); s += [label(ax+aw+8, ay+ah-38, '1', 'start'), label(nx+nw/2, py-8, '0..*'), label(1030, 365, 'refere-se a')]
    s.append(poly([(ux+uw, uy+uh-20), (330, uy+uh-20), (330, 780), (nx, 780), (nx, ny+130)])); s += [label(ux+uw+8, uy+uh-28, '1', 'start'), label(nx-8, ny+125, '0..*', 'end'), label(610, 772, 'recebe')]
    s.append(label(w/2, 825, 'Associações são linhas sólidas sem seta; as multiplicidades estão indicadas nas extremidades.'))
    s.append(foot())
    return ''.join(s), w


def classes_support():
    w, h = 1400, 760
    s = [head(w, h, 'Diagrama de classes conceitual - comunicação, auditoria e validação')]
    specs = {
        'Usuario': (520, 90, 300, ['id: string/UUID', 'nome: string', 'email: string', 'perfil: PerfilUsuario', 'status: string']),
        'Mensagem': (70, 430, 330, ['id: string/UUID', 'fromUserId: string', 'toUserId: string', 'texto: string', 'createdAt: datetime']),
        'EventoAuditoria': (535, 430, 330, ['id: string/UUID', 'userId: string', 'acao: string', 'entidade: string', 'entityId: string', 'detalhes: string', 'createdAt: datetime']),
        'FeedbackValidacao': (1000, 430, 340, ['id: string/UUID', 'userId: string', 'perfil: string', 'cenario: string', 'sucesso: boolean', 'tempoSegundos: number?', 'nota: 1..5', 'comentario: string', 'fonte: DEMO_SEED | APRESENTACAO', 'createdAt: datetime']),
    }
    boxes = {}
    for name, (x, y, bw, attrs) in specs.items():
        box, bh = class_box(x, y, bw, name, attrs); s.append(box); boxes[name] = (x, y, bw, bh)
    ux, uy, uw, uh = boxes['Usuario']
    for name, rel in [('Mensagem', 'participa como remetente/destinatário'), ('EventoAuditoria', 'origina'), ('FeedbackValidacao', 'registra')]:
        x, y, bw, bh = boxes[name]; x1, y1, x2, y2 = ux+uw/2, uy+uh, x+bw/2, y
        s.append(line(x1, y1, x2, y2)); s += [label(x1+8, y1+18, '1', 'start'), label(x2+8, y2-8, '0..*', 'start'), label((x1+x2)/2, (y1+y2)/2-7, rel)]
    s.append(label(w/2, 730, 'Não foram criadas subclasses Responsável/Portaria/Gestão, pois o código usa um único Usuario com atributo perfil.'))
    s.append(foot())
    return ''.join(s), w


def erd_box(x, y, w, name, fields):
    rh = 20; h = 34 + len(fields) * rh + 8
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="#111" stroke-width="1.2"/>',
         f'<rect x="{x}" y="{y}" width="{w}" height="34" fill="#f3f4f6" stroke="#111" stroke-width="1.2"/>',
         f'<text x="{x+w/2}" y="{y+23}" text-anchor="middle" class="boxTitle">{esc(name)}</text>']
    for i, (kind, field) in enumerate(fields):
        yy = y + 55 + i * rh
        s.append(f'<text x="{x+9}" y="{yy}" class="small" font-weight="700">{esc(kind)}</text>')
        s.append(f'<text x="{x+55}" y="{yy}" class="attr">{esc(field)}</text>')
    return ''.join(s), h


def erd_core():
    w, h = 1700, 900; s = [head(w, h, 'DER lógico - núcleo de usuários, alunos e presença')]
    specs = {
        'users': (60, 100, 290, [('PK','id'),('UQ','email'),('','name'),('','password_hash'),('','role'),('','status')]),
        'guardian_students': (420, 100, 360, [('PK/FK','guardian_id -> users.id'),('PK/FK','student_id -> students.id')]),
        'students': (850, 100, 330, [('PK','id'),('UQ','enrollment'),('UQ','token'),('FK','class_id -> classes.id'),('','name'),('','status')]),
        'classes': (1260, 100, 280, [('PK','id'),('','name'),('','shift')]),
        'notifications': (430, 520, 360, [('PK','id'),('FK','user_id -> users.id'),('FK','student_id -> students.id'),('','title'),('','message'),('','created_at'),('','read'),('','severity')]),
        'attendance': (900, 520, 360, [('PK','id'),('FK','student_id -> students.id'),('FK','registered_by -> users.id'),('','type'),('','method'),('','timestamp'),('','origin')]),
    }
    boxes = {}
    for name, (x, y, bw, fields) in specs.items():
        box, bh = erd_box(x, y, bw, name, fields); s.append(box); boxes[name] = (x, y, bw, bh)
    ux, uy, uw, uh = boxes['users']; gx, gy, gw, gh = boxes['guardian_students']; ax, ay, aw, ah = boxes['students']; cx, cy, cw, ch = boxes['classes']; nx, ny, nw, nh = boxes['notifications']; px, py, pw, ph = boxes['attendance']
    for x1, y1, x2, y2, c1, c2 in [(ux+uw,uy+75,gx,gy+75,'1','0..*'),(gx+gw,gy+75,ax,ay+75,'0..*','1'),(ax+aw,ay+85,cx,cy+85,'0..*','1')]:
        s.append(line(x1,y1,x2,y2)); s.append(label(x1+8,y1+18,c1,'start')); s.append(label(x2-8,y2+18,c2,'end'))
    s.append(line(ax+aw/2,ay+ah,px+pw/2,py)); s += [label(ax+aw/2+8,ay+ah+18,'1','start'),label(px+pw/2+8,py-8,'0..*','start'),label(1040,430,'presenças')]
    s.append(poly([(ax,ay+ah-25),(760,ay+ah-25),(760,ny),(nx+nw,ny)])); s += [label(ax-8,ay+ah-33,'1','end'),label(nx+nw-8,ny-8,'0..*','end'),label(760,445,'notificações do aluno')]
    s.append(poly([(ux+uw/2,uy+uh),(ux+uw/2,455),(nx,455),(nx,ny+80)])); s += [label(ux+uw/2+8,uy+uh+17,'1','start'),label(nx-8,ny+73,'0..*','end'),label(250,445,'recebe')]
    s.append(poly([(ux+uw,uy+uh-20),(380,uy+uh-20),(380,830),(px,830),(px,py+100)])); s += [label(ux+uw+8,uy+uh-28,'1','start'),label(px-8,py+93,'0..*','end'),label(640,820,'registered_by')]
    s.append(label(w/2,875,'Cardinalidades indicam relacionamentos; não há setas. guardian_students resolve a associação N:N entre responsáveis e alunos.'))
    s.append(foot())
    return ''.join(s), w


def erd_support():
    w, h = 1400, 760; s = [head(w, h, 'DER lógico - comunicação, auditoria e validação')]
    specs = {
        'users': (520, 90, 330, [('PK','id'),('UQ','email'),('','name'),('','role'),('','status')]),
        'messages': (50, 430, 350, [('PK','id'),('FK','from_user_id -> users.id'),('FK','to_user_id -> users.id'),('','text'),('','created_at')]),
        'audit_events': (520, 430, 350, [('PK','id'),('FK','user_id -> users.id'),('','action'),('','entity'),('','entity_id'),('','details'),('','created_at')]),
        'feedback': (990, 430, 360, [('PK','id'),('FK','user_id -> users.id'),('','profile'),('','scenario'),('','success'),('','time_seconds'),('','score'),('','comment'),('','source'),('','created_at')]),
    }
    boxes = {}
    for name, (x, y, bw, fields) in specs.items():
        box, bh = erd_box(x,y,bw,name,fields); s.append(box); boxes[name]=(x,y,bw,bh)
    ux,uy,uw,uh=boxes['users']
    for name,rel in [('messages','remetente/destinatário'),('audit_events','origina'),('feedback','registra')]:
        x,y,bw,bh=boxes[name]; x1,y1,x2,y2=ux+uw/2,uy+uh,x+bw/2,y
        s.append(line(x1,y1,x2,y2)); s += [label(x1+8,y1+18,'1','start'),label(x2+8,y2-8,'0..*','start'),label((x1+x2)/2,(y1+y2)/2-7,rel)]
    s.append(label(w/2,730,'Este quadro complementa o DER principal e compartilha a mesma tabela users.'))
    s.append(foot())
    return ''.join(s), w


def sequence():
    w,h=1550,900; s=[head(w,h,'Diagrama de sequência - registrar entrada/saída')]
    participants=[('Portaria',120),('Interface web',380),('API Node.js',670),('Regras de domínio',970),('Persistência JSON',1260)]; top=90; life=820
    for name,x in participants:
        s += [f'<rect x="{x-75}" y="{top}" width="150" height="42" fill="white" stroke="#111" stroke-width="1.2"/>',f'<text x="{x}" y="{top+26}" text-anchor="middle" class="label">{esc(name)}</text>',f'<line x1="{x}" y1="{top+42}" x2="{x}" y2="{life}" stroke="#777" stroke-width="1" stroke-dasharray="5 5"/>']
    def msg(x1,y,x2,text,ret=False):
        s.append(line(x1,y,x2,y,ret)); direction=1 if x2>x1 else -1
        s.append(f'<polyline points="{x2-direction*10},{y-5} {x2},{y} {x2-direction*10},{y+5}" fill="none" stroke="#111" stroke-width="1"/>')
        s.append(label((x1+x2)/2,y-8,text))
    ys=[175,225,275,325,380,435,490,545,600,655,710,765]
    data=[(120,380,'Seleciona tipo e informa token',False),(380,670,'POST /api/attendance',False),(670,970,'normalizar token + validar perfil',False),(970,670,'token normalizado',True),(670,1260,'localizar aluno e registros do dia',False),(1260,670,'aluno + registros',True),(670,970,'validar sequência entrada/saída',False),(970,670,'ok | erro de regra',True),(670,1260,'gravar presença + notificação + auditoria',False),(1260,670,'persistência concluída',True),(670,380,'201 + registro + quantidade notificada',True),(380,120,'exibir confirmação',True)]
    for y,(x1,x2,text,ret) in zip(ys,data): msg(x1,y,x2,text,ret)
    s.append(label(w/2,855,'Setas são usadas somente porque este é um diagrama de sequência e representam mensagens direcionadas.'))
    s.append(foot())
    return ''.join(s), w


def architecture():
    w,h=1350,700; s=[head(w,h,'Diagrama de componentes - arquitetura implementada no MVP')]
    comps=[('Navegador / Frontend\nHTML + CSS + JavaScript',70,250,280),('API HTTP\nserver.js',390,250,220),('Domínio\nlib/domain.js',690,160,220),('Segurança\nlib/security.js',690,370,220),('Persistência local\nJSON de demonstração',1010,250,270)]
    for text,x,y,bw in comps:
        s.append(f'<rect x="{x}" y="{y}" width="{bw}" height="90" rx="4" fill="white" stroke="#111" stroke-width="1.2"/>')
        for i,t in enumerate(text.split('\n')): s.append(f'<text x="{x+bw/2}" y="{y+35+i*24}" text-anchor="middle" class="label">{esc(t)}</text>')
    def dep(x1,y1,x2,y2,text):
        s.append(line(x1,y1,x2,y2,True)); direction=1 if x2>x1 else -1
        s.append(f'<polyline points="{x2-direction*10},{y2-5} {x2},{y2} {x2-direction*10},{y2+5}" fill="none" stroke="#111" stroke-width="1"/>'); s.append(label((x1+x2)/2,(y1+y2)/2-7,text))
    dep(350,295,390,295,'HTTP/JSON'); dep(610,280,690,205,'usa'); dep(610,315,690,415,'usa'); dep(610,295,1010,295,'lê/grava')
    s.append(label(w/2,655,'Banco transacional, HTTPS e serviços externos são evolução futura e não são desenhados como se já existissem.'))
    s.append(foot())
    return ''.join(s), w


usecase('Responsável', ['Autenticar-se','Consultar histórico do aluno vinculado','Consultar e marcar notificações','Gerar/baixar relatório do próprio escopo','Enviar mensagem autorizada','Registrar feedback da validação'], '01_uc_responsavel.svg', 'Associação ator-caso de uso: linha sólida simples, sem seta.')
usecase('Portaria', ['Autenticar-se','Registrar entrada','Registrar saída','Consultar alunos ativos necessários à operação','Enviar mensagem autorizada','Registrar feedback da validação'], '02_uc_portaria.svg', 'A Portaria não cadastra aluno, não cria vínculo e não consulta auditoria.')
usecase('Gestão escolar', ['Autenticar-se','Cadastrar aluno','Vincular responsável ao aluno','Registrar entrada/saída','Gerar e exportar relatório','Consultar auditoria','Enviar mensagem autorizada','Exportar validação / restaurar demo'], '03_uc_gestao.svg', 'Casos complementares de demonstração são mantidos separados do núcleo de presença.')
for filename, builder in [('04_classes_nucleo.svg',classes_core),('05_classes_suporte.svg',classes_support),('06_der_nucleo.svg',erd_core),('07_der_suporte.svg',erd_support),('08_sequencia_presenca.svg',sequence),('09_arquitetura_componentes.svg',architecture)]:
    content,width=builder(); save_svg(filename,content,width)

print('Diagramas V2 gerados em docs/diagramas.')
