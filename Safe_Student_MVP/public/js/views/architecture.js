/**
 * Visualizador de Arquitetura, Modelagem UML e DER - Safe Student
 * Documentação viva e interativa em conformidade com as exigências da banca acadêmica.
 */

function loadArchitectureView() {
  const container = $('architectureContent');
  if (!container) return;

  container.innerHTML = `
    <div class="architecture-layout">
      <!-- Seção 1: Guia Rápido de Defesa para a Banca -->
      <article class="panel defense-card">
        <div class="section-title">
          <div>
            <span class="section-kicker">Preparação para a Banca</span>
            <h2>Como Responder às Perguntas do Professor</h2>
          </div>
          <span class="badge-role">Roteiro de Demonstração</span>
        </div>
        <div class="defense-grid">
          <div class="defense-item">
            <strong>1. Onde e como as turmas são cadastradas?</strong>
            <p>
              As turmas <b>não</b> aparecem por mágica. Elas são gerenciadas no módulo <code>Turmas</code> pela <b>Gestão Escolar</b>, gravadas na tabela relacional <code>classes</code> do SQLite (com atributos <code>id</code>, <code>name</code>, <code>shift</code> e <code>status</code>). O aluno só pode ser matriculado se a turma já existir e estiver com status <code>ATIVO</code>.
            </p>
          </div>
          <div class="defense-item">
            <strong>2. Como funciona o relacionamento de Caso de Uso (UML)?</strong>
            <p>
              Caso de uso <b>nunca</b> se comunica diretamente com outro sem estereótipo formal:
              <br>• <code>&lt;&lt;include&gt;&gt;</code>: obrigatório (linha tracejada com seta apontando para o caso incluído, ex.: Cadastrar Aluno inclui Selecionar Turma).
              <br>• <code>&lt;&lt;extend&gt;&gt;</code>: opcional/condicional (linha tracejada com seta apontando para o caso base, ex.: Emitir Convite estende Vincular Responsável se o responsável não tiver conta).
              <br>• <b>Generalização</b>: herança/especialização (seta com triângulo vazado, ex.: Registrar Presença generaliza para Leitura de QR Code e Digitação Manual de Token).
            </p>
          </div>
          <div class="defense-item">
            <strong>3. Como alterar um atributo ao vivo no SQLite e no Sistema?</strong>
            <p>
              Se o professor pedir para adicionar um campo (ex.: <code>sala</code> ou <code>status</code>):
              <br><b>Passo 1 (Banco SQLite):</b> Criar migration SQL <code>ALTER TABLE classes ADD COLUMN sala TEXT;</code>.
              <br><b>Passo 2 (Repositório):</b> Em <code>databaseRepository.js</code>, incluir o campo no <code>SELECT</code> de <code>loadAggregate</code> e no <code>INSERT</code> de <code>replaceAggregate</code>.
              <br><b>Passo 3 (API Node.js):</b> Em <code>src/app.js</code>, receber o campo no payload de <code>POST/PATCH /api/classes</code>.
              <br><b>Passo 4 (Frontend):</b> Adicionar a coluna na tabela e o input no formulário em <code>public/js/views/classes.js</code>.
            </p>
          </div>
          <div class="defense-item">
            <strong>4. Onde está a integridade relacional (PKs e FKs)?</strong>
            <p>
              O banco utiliza <code>node:sqlite</code> com <code>PRAGMA foreign_keys = ON;</code> habilitado. A tabela <code>students</code> possui <code>FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT</code>. Se tentar excluir uma turma que possui alunos, o SQLite bloqueia a operação, garantindo integridade.
            </p>
          </div>
        </div>
      </article>

      <!-- Seção 2: Diagrama de Casos de Uso (UML) Corrigido -->
      <article class="panel">
        <div class="section-title">
          <div>
            <span class="section-kicker">Engenharia de Software (UML 2.5)</span>
            <h2>Diagrama de Casos de Uso com &lt;&lt;include&gt;&gt; e &lt;&lt;extend&gt;&gt;</h2>
          </div>
        </div>
        <p class="section-helper">
          Mapeamento formal dos casos de uso, atores e restrições de obrigatoriedade e condicionalidade.
        </p>
        <div class="usecase-diagram-box">
          <pre class="uml-spec">
+---------------------------------------------------------------------------------------------------+
|                                 SISTEMA SAFE STUDENT                                             |
|                                                                                                   |
|  [ Gestão Escolar ]                                                                               |
|       |                                                                                           |
|       +-----> ( UC01: Cadastrar / Gerenciar Turmas )                                             |
|       |                                                                                           |
|       +-----> ( UC02: Cadastrar Aluno )                                                          |
|                    |                                                                              |
|                    +--- &lt;&lt;include&gt;&gt; ---> ( UC01: Selecionar Turma Ativa ) [Obrigatório]           |
|                    |                                                                              |
|                    +--- &lt;&lt;include&gt;&gt; ---> ( UC03: Vincular Responsável ) [Mínimo 1 responsável]    |
|                                                |                                                  |
|                                                +<--- &lt;&lt;extend&gt;&gt; --- ( UC04: Emitir Convite )       |
|                                                                      [Condição: sem conta ativa]  |
|                                                                                                   |
|  [ Operador de Portaria ]                                                                         |
|       |                                                                                           |
|       +-----> ( UC05: Registrar Presença ) [Caso Base]                                            |
|                    |                                                                              |
|                    +--- &lt;&lt;include&gt;&gt; ---> ( UC06: Validar Próxima Ação Válida ) [Entrada/Saída]    |
|                    |                                                                              |
|                    +--- &lt;&lt;include&gt;&gt; ---> ( UC07: Disparar Notificação Interna ) [Automático]     |
|                    |                                                                              |
|                    ^  [Generalização / Especialização - Triângulo Aberto]                         |
|                   / \\                                                                            |
|                  /   \\                                                                           |
|   ( UC05a: Por Leitura de QR )   ( UC05b: Por Digitação de Token Manual )                        |
|                                                                                                   |
|  [ Responsável ]                                                                                  |
|       |                                                                                           |
|       +-----> ( UC08: Acompanhar Presença dos Filhos )                                           |
|       +-----> ( UC09: Consultar Notificações Recebidas )                                          |
|       +-----> ( UC10: Trocar Mensagens com a Escola )                                             |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
          </pre>
        </div>
      </article>

      <!-- Seção 3: Modelo Entidade-Relacionamento e Dicionário de Dados do SQLite -->
      <article class="panel">
        <div class="section-title">
          <div>
            <span class="section-kicker">Banco de Dados Relacional</span>
            <h2>Dicionário de Tabelas, Chaves Primárias (PK) e Chaves Estrangeiras (FK)</h2>
          </div>
        </div>
        <div class="schema-tables-grid">
          <div class="schema-table-card">
            <div class="schema-table-head">
              <strong>classes</strong>
              <small>Turmas escolares</small>
            </div>
            <ul>
              <li><span class="pk">PK</span> <code>id</code>: TEXT</li>
              <li><code>name</code>: TEXT NOT NULL UNIQUE</li>
              <li><code>shift</code>: TEXT (Manhã, Tarde, Noite, Integral)</li>
              <li><span class="tag-status">NOVO</span> <code>status</code>: TEXT CHECK (status IN ('ATIVO','INATIVO'))</li>
            </ul>
          </div>

          <div class="schema-table-card">
            <div class="schema-table-head">
              <strong>students</strong>
              <small>Estudantes cadastrados</small>
            </div>
            <ul>
              <li><span class="pk">PK</span> <code>id</code>: TEXT</li>
              <li><code>name</code>: TEXT NOT NULL</li>
              <li><code>enrollment</code>: TEXT UNIQUE</li>
              <li><span class="fk">FK</span> <code>class_id</code> &rarr; <code>classes(id)</code> (RESTRICT)</li>
              <li><code>token</code>: TEXT UNIQUE</li>
              <li><code>status</code>: TEXT CHECK ('ATIVO','INATIVO')</li>
            </ul>
          </div>

          <div class="schema-table-card">
            <div class="schema-table-head">
              <strong>users</strong>
              <small>Usuários e perfis de acesso</small>
            </div>
            <ul>
              <li><span class="pk">PK</span> <code>id</code>: TEXT</li>
              <li><code>name</code>: TEXT NOT NULL</li>
              <li><code>email</code>: TEXT UNIQUE COLLATE NOCASE</li>
              <li><code>cpf</code>: TEXT UNIQUE</li>
              <li><code>password_hash</code>: TEXT</li>
              <li><code>role</code>: TEXT CHECK ('GESTAO','PORTARIA','RESPONSAVEL')</li>
              <li><code>status</code>: TEXT CHECK ('ATIVO','INATIVO')</li>
            </ul>
          </div>

          <div class="schema-table-card">
            <div class="schema-table-head">
              <strong>guardian_students</strong>
              <small>Associação N:N Responsável &harr; Aluno</small>
            </div>
            <ul>
              <li><span class="pk">PK</span><span class="fk">FK</span> <code>guardian_id</code> &rarr; <code>users(id)</code></li>
              <li><span class="pk">PK</span><span class="fk">FK</span> <code>student_id</code> &rarr; <code>students(id)</code></li>
            </ul>
          </div>

          <div class="schema-table-card">
            <div class="schema-table-head">
              <strong>attendance</strong>
              <small>Movimentações de Portaria</small>
            </div>
            <ul>
              <li><span class="pk">PK</span> <code>id</code>: TEXT</li>
              <li><span class="fk">FK</span> <code>student_id</code> &rarr; <code>students(id)</code> (RESTRICT)</li>
              <li><code>type</code>: TEXT CHECK ('ENTRADA','SAIDA')</li>
              <li><code>method</code>: TEXT (TOKEN_MANUAL, QR_CAMERA)</li>
              <li><code>timestamp</code>: TEXT (ISO-8601 UTC)</li>
              <li><span class="fk">FK</span> <code>registered_by</code> &rarr; <code>users(id)</code></li>
            </ul>
          </div>

          <div class="schema-table-card">
            <div class="schema-table-head">
              <strong>guardian_invitations</strong>
              <small>Convites de ativação de responsáveis</small>
            </div>
            <ul>
              <li><span class="pk">PK</span> <code>id</code>: TEXT</li>
              <li><code>email</code>: TEXT COLLATE NOCASE</li>
              <li><code>code_hash</code>: TEXT (SHA-256)</li>
              <li><code>status</code>: TEXT CHECK ('PENDENTE','UTILIZADO','REVOGADO')</li>
              <li><code>expires_at</code>: TEXT</li>
            </ul>
          </div>
        </div>
      </article>
    </div>
  `;
}
