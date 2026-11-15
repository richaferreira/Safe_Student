import subprocess
d='''digraph G {
graph [rankdir=TB, nodesep=0.3, ranksep=0.5, fontname="DejaVu Sans", bgcolor="white", splines=polyline, pad=0.2, compound=true];
node [shape=box, style="rounded,filled", fontname="DejaVu Sans", fontsize=13, color="#374151", penwidth=1.3];
edge [color="#374151", fontname="DejaVu Sans", fontsize=11, arrowsize=0.8];

subgraph cluster_web { label="Frontend Web (public/)"; style="rounded,filled"; fillcolor="#f0f7ff"; color="#1f5f8b"; fontname="DejaVu Sans"; fontsize=13.5;
  views [label="Views (public/js/views)\\ndashboard, presence, students,\\nclasses, guardians, messages,\\nreports, feedback, audit", fillcolor="#dbeafe"];
  core [label="Núcleo (public/js/core)\\nestado e chamadas à API", fillcolor="#dbeafe"];
}
subgraph cluster_api { label="API HTTP (Node.js)"; style="rounded,filled"; fillcolor="#fff8ec"; color="#b8651b"; fontname="DejaVu Sans"; fontsize=13.5;
  app [label="src/app.js\\nrotas /api/*, sessão e autorização", fillcolor="#ffefd5"];
  svc [label="Serviços (src/services)\\ndomain, security, accessService,\\nstudent, guardian, audit,\\nfeedback, filter", fillcolor="#f3e8ff"];
  infra [label="HTTP, configuração e utilitários\\nsrc/http, src/config, src/utils", fillcolor="#e0f2fe"];
  sec [label="Sessão (src/auth)\\nsessões e tentativas em memória", fillcolor="#f3e8ff"];
}
subgraph cluster_db { label="Persistência (src/database)"; style="rounded,filled"; fillcolor="#f2f4f7"; color="#4b5563"; fontname="DejaVu Sans"; fontsize=13.5;
  repo [label="repository.js e databaseRepository.js\\nreadDatabase / replaceAggregate", fillcolor="#e6f4ea"];
  conn [label="connection.js\\nnode:sqlite, foreign_keys = ON", fillcolor="#e6f4ea"];
  mig [label="migrationRunner.js\\nmigrations 001 e 002", fillcolor="#e6f4ea"];
  sqlite [label="Arquivo SQLite\\n12 tabelas + schema_migrations", shape=cylinder, fillcolor="#eef2f7"];
}
scripts [label="Scripts npm\\ndb:migrate, db:seed, db:reset,\\ndb:status e db:import-json", fillcolor="#fff3c4"];
tests [label="Testes (node:test)\\nunit e integration", fillcolor="#fde7f3"];

views -> core;
core -> app [label="HTTP / JSON"];
app -> svc;
app -> sec;
app -> infra;
svc -> sec [style=invis];
sec -> infra [style=invis];
app -> repo;
repo -> conn;
conn -> sqlite;
mig -> sqlite [label="aplica .sql"];
conn -> mig [style=dashed];
scripts -> mig [style=dashed];
tests -> app [style=dashed, label="exercita"];
}'''
open("fig5.dot","w").write(d)
r=subprocess.run(["dot","-Tpng","-Gdpi=130","fig5.dot","-o","fig5_componentes.png"],capture_output=True,text=True)
print(r.stderr[:300])
