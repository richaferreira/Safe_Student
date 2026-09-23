# Safe Student MVP 2.1.0 — evolução funcional

MVP acadêmico de movimentação escolar, comunicação família–escola e rastreabilidade. A entrega preserva os três perfis da especificação: **Responsável, Portaria e Gestão Escolar**.

## Executar

```powershell
npm test
npm run benchmark
npm start
```

Abra `http://localhost:3000`.

## Principais fluxos

- cadastro em etapas de aluno + um ou mais responsáveis;
- vínculo imediato com conta ativa ou convite para nova conta;
- responsável ativado visualiza automaticamente todos os filhos vinculados;
- Portaria por token ou leitura de QR compatível com navegador;
- estado operacional DENTRO*/FORA*/SEM REGISTRO e próxima ação válida;
- notificações internas restritas ao vínculo atual;
- comunicação organizada em conversas permitidas por perfil;
- relatórios filtrados e CSV usando a mesma fonte de dados;
- auditoria pesquisável pela Gestão;
- sessão da interface por cookie HttpOnly/SameSite.

`DENTRO*` e `FORA*` são inferidos do último evento de portaria do dia. Não representam geolocalização em tempo real nem frequência pedagógica.

## Demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Gestão | `gestor@demo.com` | `demo123` |
| Portaria | `portaria@demo.com` | `demo123` |
| Responsável | `responsavel@demo.com` | `demo123` |

## Testes

A suíte final desta entrega contém **57 testes**, todos aprovados no ambiente de revisão. Consulte `../test-results.txt`.

## Benchmark

`npm run benchmark` mede as principais leituras em ambiente local e compara p95 com a meta de 2 s do RNF-05. O resultado local não deve ser confundido com teste de carga de produção.

## Limites

Persistência JSON, sessões em memória do processo, dados fictícios e sem serviço externo de e-mail/push. O MVP não é homologado para uso com dados reais de estudantes.
