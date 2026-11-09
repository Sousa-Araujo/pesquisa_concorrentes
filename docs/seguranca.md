# Segurança dos dados

Situação e plano de reforço do sistema de Market Share (análise de 2026-10-23,
atualizada em 2026-11-05). Cada item tem o responsável e o estado.

## O que já protege o sistema

- Login sem senha: código de 6 dígitos por e-mail, 10 minutos, uso único,
  5 tentativas, limite de pedidos por e-mail; no banco fica só o HMAC.
- Sessão em cookie `httpOnly`, `secure` em produção e `SameSite=Lax`, guardada
  no banco: inativar alguém ou vencer o acesso derruba a entrada na hora.
- Permissões conferidas no servidor (avaliador só vê as próprias avaliações,
  fotos com a mesma regra da avaliação).
- SQL sempre parametrizado e validação das entradas (Zod).
- Banco da produção nova sem endereço público; saída para o CV por IP fixo.
- Dependências sem vulnerabilidade conhecida (`npm audit`).
- Cabeçalhos de segurança em todas as respostas (`next.config.mjs`, v1.3.0):
  política de conteúdo (CSP) só com o próprio sistema e a fonte Fontshare,
  HSTS, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy` e
  `Permissions-Policy`; o cabeçalho `X-Powered-By` deixou de ser enviado.

## Plano de reforço

| # | Risco | O que fazer | Quem | Estado |
|---|---|---|---|---|
| 1 | O sistema lê o CV com o usuário `postgres` (administrador do banco do CV) | Criar o usuário só de leitura `market_share_leitura`, restrito às 4 visões do BI ([cv-usuario-leitura.sql](seguranca/cv-usuario-leitura.sql)), e trocar o `CV_DATABASE_URL` no teste e na produção | TI + quem cuida do Railway | Script pronto, falta rodar |
| 2 | Dados reais fora da produção: teste com cópia da base, backups locais sem criptografia, `.env.local` no OneDrive | Anonimizar o teste; apagar ou criptografar `backups-market-share` depois da virada; tirar o repositório do OneDrive | Desenvolvimento | Pendente |
| 3 | CPF, chave PIX e assinatura dos avaliadores em texto puro | Criptografar esses campos e mostrar o CPF mascarado | Desenvolvimento | Pendente |
| 4 | 9 administradores, um com e-mail pessoal | Revisar na tela **Usuários** quem precisa ser administrador; admin só com e-mail da empresa; revisão a cada trimestre | Administrador | Pendente (decisão do admin) |
| 5 | Faltavam cabeçalhos de segurança | Configurados | Desenvolvimento | Feito (v1.3.0) |
| 6 | Limite de login só por e-mail | Limite também por IP e aviso de muitas tentativas | Desenvolvimento | Pendente |
| 7 | Pouca trilha de auditoria | Registrar entradas, mudança de perfil, pagamento de recibo, exportações e "Ver o sistema como" | Desenvolvimento | Pendente |
| 8 | Backups da produção nova | Backups automáticos do Postgres no Railway + cópia semanal criptografada fora dele; testar restauração a cada trimestre | Quem cuida do Railway | Pendente |
| 9 | Tabelas enviadas à IA (Gemini gratuito pode usar dados) | Usar o Gemini pago ou remover a reserva | Decisão do negócio | Pendente |
| 10 | Acesso ao Railway abre o terminal do banco de produção | 2FA para todos, mínimo de pessoas no workspace, troca de chaves quando alguém sai | Dono da conta Railway | Pendente |
| 11 | Sessão de 7 dias para todos | Sessão menor para administrador; derrubar sessões quando o perfil muda | Desenvolvimento | Pendente |

## Como trocar o acesso ao CV (item 1)

1. A TI roda [cv-usuario-leitura.sql](seguranca/cv-usuario-leitura.sql) no banco do CV, com uma senha forte nova.
2. No Railway, nos serviços do Market Share (teste e produção nova), trocar o
   usuário e a senha no `CV_DATABASE_URL`:
   `postgresql://market_share_leitura:<senha>@cvcrm-db.c4xqm66y6n13.us-east-1.rds.amazonaws.com:5432/postgres`
3. Conferir em **Administração → Integrações → Dados do CV** que a sincronização
   continua funcionando ("Sincronizar agora").
4. Só então a TI pode deixar de compartilhar a senha do `postgres`.
