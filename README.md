# Market Share Sousa Araujo — Pesquisa de Concorrentes + Cliente Oculto

Sistema único de Market Share da Sousa Araujo. Hoje traz a **Pesquisa de
Concorrentes** (agentes de campo registram estoque e vendas dos
concorrentes; coordenação acompanha por dashboards) e a base do módulo
**Cliente Oculto** (tabelas já criadas; telas em migração a partir do app
antigo `Sousa-Araujo/hidden`).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · PostgreSQL
(driver `pg`, SQL direto — sem ORM) · Zod (validação) · Vitest (testes) ·
Resend (e-mails de convite e código). Regras de negócio e cálculos ficam na
camada de domínio (`src/lib/domain`) e de acesso (`src/lib/auth`), isoladas
de UI e acesso a dados.

## Acesso (sem senha)

| Quem | Como entra |
| --- | --- |
| Agente de campo (`/agente`) | Telefone cadastrado + código de 6 dígitos (no e-mail do agente; SMS ainda não configurado) |
| Demais perfis (`/entrar`) | Convite por e-mail com link → tela com o e-mail preenchido → **Enviar código** → código no e-mail |

- Perfis: Administrador, Coordenador de Produto, Supervisor de Parcerias,
  Coordenador de Market Share, Cliente Oculto (Avaliador) e Diretoria
  (consulta). Uma pessoa pode ter mais de um. O que cada um pode fazer está
  em `src/lib/auth/perfis.ts`.
- Código: vale 10 minutos, uso único, 5 tentativas; no máximo 1 pedido por
  minuto e 5 a cada 15 minutos. No banco fica só o HMAC.
- Sessão: token opaco em cookie httpOnly, hash no banco (`sessoes`), dura
  `SESSAO_DIAS` (padrão 7). Inativar alguém ou vencer um acesso temporário
  derruba o acesso na hora.
- Acesso temporário (avaliadores contratados para uma visita): data limite
  no cadastro; depois dela o acesso expira sozinho.
- O link do convite só preenche o e-mail — sozinho não dá acesso.

## Estrutura

```
db/migrations/          0001–0005 Pesquisa · 0006 usuários, perfis e acesso · 0007 Cliente Oculto
src/lib/auth/            perfis e permissões, código/sessão/convite (acesso.ts)
src/lib/notificacoes/   envio de e-mail (Resend) e SMS, modelos dos e-mails
src/lib/domain/          telefone, competência, cálculos do dashboard
src/lib/data/             acesso a dados — SQL direto
src/lib/validation/     schemas Zod
src/app/entrar/           login por código (todos os perfis, exceto agente)
src/app/inicio/           tela inicial com os módulos do perfil
src/app/agente/           fluxo do agente de campo
src/app/gestor/            painel da Pesquisa (dashboard, cadastros, usuários)
src/middleware.ts         barreira rápida: sem cookie, áreas internas vão para /entrar
scripts/                    migrate.mjs (migrations + primeiro administrador)
tests/                        testes de domínio, dashboard e acesso
```

## Instalação

Requisitos: Node.js 18+ e um PostgreSQL (local, Docker ou o Postgres do
Railway).

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL, SESSION_SECRET etc.
```

Variáveis (ver `.env.example` para a lista completa e comentada):

- `DATABASE_URL` — connection string do Postgres.
- `SESSION_SECRET` — **secreto**, protege os códigos de acesso.
- `APP_URL` — endereço público, usado no link do convite.
- `RESEND_API_KEY` / `EMAIL_REMETENTE` — envio de e-mail. Sem a chave, em
  desenvolvimento o e-mail (com o código) só aparece no log do servidor.
- `ADMIN_EMAIL` / `ADMIN_NOME` — criam o primeiro Administrador.

## Banco de dados (migrations + primeiro administrador)

Não há passo manual: `npm run migrate` (ou `npm start`, que já roda a
migração antes de subir o servidor) aplica os arquivos de `db/migrations/`
em ordem — de forma idempotente, controlada por uma tabela `_migrations` — e,
se `ADMIN_EMAIL` estiver definido e ainda não existir um usuário com esse
e-mail, cria o primeiro Administrador.

```bash
DATABASE_URL="postgres://..." ADMIN_EMAIL="voce@empresa.com" ADMIN_NOME="Seu Nome" npm run migrate
```

A migração `0006` transforma a antiga tabela `gestores` em `usuarios`; os
gestores existentes viram Administradores e continuam entrando pelo mesmo
e-mail, agora com código.

`0003_seed.sql` carrega os cadastros mestres da planilha: 4 regionais, 12
cidades, 18 empreendimentos e 35 concorrentes.

Depois, entre em `/entrar` com o e-mail do administrador e cadastre as
pessoas pela tela **Usuários** (cada uma recebe um convite). Cadastre os
agentes de campo pela tela **Agentes** (telefone normalizado e único;
e-mail opcional, para onde vai o código) — ou use `npm run seed:agentes` para
alguns agentes de exemplo em ambiente local. Empreendimentos e concorrentes
adicionais podem ser cadastrados pelas telas **Empreendimentos** e
**Concorrentes** (o concorrente também pode ser criado inline pelo Agente
durante a coleta — seção 13 da especificação).

## Executar

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run start      # roda a migração e serve o build
```

## Deploy no Railway

1. Adicione um serviço **PostgreSQL** ao projeto Railway e conecte o
   repositório (New Project → Deploy from GitHub repo). O builder é
   detectado automaticamente (Railpack); `railway.json` já define `build`,
   `start` e o healthcheck (`/api/health`).
2. Cadastre em **Service → Variables**, antes do primeiro deploy:
   - `DATABASE_URL` → referencie o Postgres do projeto: `${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET` (marque como *sealed*) — gere com
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
   - `APP_URL`, `RESEND_API_KEY` (sealed) e `EMAIL_REMETENTE`
   - `ADMIN_EMAIL`, `ADMIN_NOME` — primeiro Administrador
3. Dispare o deploy. O `start` do serviço já roda `node scripts/migrate.mjs`
   antes do `next start`: schema, seed de dados mestres e o primeiro administrador
   sobem juntos, sem SQL Editor nem shell manual.
4. O Railway define `PORT` automaticamente; o `next start` já lê essa
   variável nativamente (e escuta em `0.0.0.0` por padrão). Não defina `PORT`
   manualmente.
5. Gere o domínio público em Service → Settings → Networking, ou rode
   `railway domain`.

Nenhum outro passo manual é necessário após o deploy — em redeploys
seguintes, o `migrate.mjs` roda de novo e só aplica o que ainda não foi
aplicado (é seguro rodar em todo boot).

## Qualidade

```bash
npm run test       # testes das fórmulas, do domínio e das regras de acesso
npm run typecheck  # TypeScript sem emissão
npm run lint       # ESLint (next)
```

Os testes cobrem os exemplos canônicos da especificação: Oferta = 733,
Vendas totais = 70, VSO individual (11/100 = 11,00%, 15/122 ≈ 12,30% …) e o
ranking de VSO (C→1º, D→2º, próprio→3º, E→4º, B→5º).

## Métricas do dashboard

Implementadas: Oferta/estoque total, estoque e vendas individuais, vendas totais,
representatividade (estoque do item / estoque total), VSO individual
(vendas / estoque, com tratamento de divisão por zero) e ranking de VSO
(decrescente, empates na mesma posição).

**Não implementadas por decisão de especificação:** o "VSO consolidado" de 15,71%
e o indicador de 1,50% não têm regra confirmada e ficam pendentes de definição —
não devem ser codificados até que a regra seja esclarecida.

## Segurança

- Validação no backend com Zod; nunca confiar apenas no frontend.
- Sem RLS: a única credencial de banco (`DATABASE_URL`) nunca chega ao
  navegador — toda a autorização por perfil é feita na camada de aplicação:
  páginas usam `exigirPagina(...)` e Server Actions usam
  `exigirPermissao(...)` / `exigirAgente()` (`src/lib/auth/acesso.ts`).
- A coleta é sempre gravada em nome do agente da sessão — nunca de um id
  vindo do navegador. Cadastro de concorrente pelo agente exige sessão.
- Login sem senha por código (ver **Acesso**); só hashes de código, sessão e
  convite ficam no banco.
- Telefone normalizado e único.
- Geração do ID de concorrente no backend, com lock contra condição de corrida.
