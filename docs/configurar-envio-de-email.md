# Configurar o envio de e-mail (Resend)

O sistema de Market Share manda e-mails em dois momentos: o **convite** quando
alguém é cadastrado e o **código de acesso** a cada login. Sem esta
configuração ninguém consegue entrar em produção — no ambiente de teste os
e-mails só aparecem no log do servidor.

Remetente escolhido: **Market Share Sousa Araujo &lt;nao-responda@sousaaraujo.com.br&gt;**.

## 1. Criar a conta no Resend

1. Acesse <https://resend.com> e crie a conta com um e-mail da empresa
   (de preferência uma caixa da área, não pessoal).
2. O plano gratuito envia até 3.000 e-mails por mês (100 por dia), suficiente
   para começar.

## 2. Cadastrar o domínio sousaaraujo.com.br

1. No Resend, abra **Domains → Add Domain**, digite `sousaaraujo.com.br` e
   escolha a região **São Paulo (sa-east-1)**.
2. O Resend mostra alguns registros de DNS (normalmente um TXT de DKIM em
   `resend._domainkey`, e um MX e um TXT de SPF no subdomínio `send`).
3. Envie esses registros para quem cuida do DNS da Sousa Araujo (TI ou o
   provedor do site). Eles **não mexem nos e-mails da empresa**: ficam em
   nomes próprios do Resend.
4. Depois que a TI cadastrar, clique em **Verify** no Resend. Pode levar de
   alguns minutos a algumas horas.

## 3. Criar a chave de envio

1. Em **API Keys → Create API Key**, dê o nome `Market Share`, permissão
   **Sending access** e restrinja ao domínio `sousaaraujo.com.br`.
2. Copie a chave (ela só aparece uma vez). **Não mande a chave por e-mail ou
   chat** — ela vai direto para o Railway no próximo passo.

## 4. Colocar a chave no Railway

No projeto **pesquisa-concorrentes**, ambiente **teste**, serviço do sistema →
**Variables**:

| Variável | Valor |
|---|---|
| `RESEND_API_KEY` | a chave copiada no passo 3 |
| `EMAIL_REMETENTE` | `Market Share Sousa Araujo <nao-responda@sousaaraujo.com.br>` |
| `ENVIO_SIMULADO` | apagar a variável (ela faz os e-mails irem só para o log) |

O Railway reinicia o sistema sozinho depois de salvar.

## 5. Testar

1. Entre no sistema como administrador e abra **Administração → Usuários**.
2. Clique em **Testar envio de e-mail**. O sistema manda um e-mail para você.
3. Confira a caixa de entrada (e o spam). Se a mensagem disser "Envio
   simulado", a variável `ENVIO_SIMULADO` ainda está ligada ou a chave não foi
   salva.

Quando for criado o projeto de produção, as mesmas três variáveis entram lá
(com `ENVIO_SIMULADO` ausente).
