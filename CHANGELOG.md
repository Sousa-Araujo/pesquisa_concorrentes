# Histórico de versões

Todas as mudanças relevantes do sistema de Market Share Sousa Araujo ficam
registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e a numeração segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/).
Como versionar e publicar: [docs/versionamento.md](docs/versionamento.md).

## [Não publicado]

Mudanças já feitas que ainda não entraram em uma versão.

## [1.5.4] - 2026-11-11

### Alterado
- Cliente Oculto: "Empreendimento Sousa comparado" mostra só o nome do empreendimento, sem a data da visita (migração 0027 limpa os rótulos já gravados).

## [1.5.3] - 2026-11-11

### Corrigido
- Cliente Oculto › Correções (administrador): o campo "Empreendimento Sousa comparado" passa a ser uma lista de escolha, com "Sem vínculo" e as visitas Sousa do mês, em vez de um campo digitado (o autocompletar do navegador só mostrava o valor já preenchido). Se a regional da visita não tiver nenhuma visita Sousa no mês, a lista mostra todas as do mês.

## [1.5.2] - 2026-11-11

### Alterado
- Pesquisa › Cadastros: o Coordenador de Market Share também pode cadastrar e corrigir os dados dos empreendimentos e dos concorrentes (antes só o Coordenador de Produto e o administrador).

### Corrigido
- Cliente Oculto › Correções (administrador): os campos valor da unidade, valor do ato e valor de entrada passam a ter a mesma máscara da tela Nova avaliação e a gravar o texto e o número juntos. Antes, corrigir o valor mudava só o texto, e o Quadro Comparativo seguia com o número antigo (ex.: R$ 347.000 aparecendo como R$ 3.470.000).

## [1.5.1] - 2026-11-10

### Adicionado
- Dados do CV › "Preencher mês anterior com os dados do CV" (só administrador): mostra uma prévia e, ao confirmar, cria as linhas de Dados próprios que faltam num mês já fechado. Vendas e ticket com desconto vêm exatos do CV; o estoque é estimado (estoque de hoje mais as vendas feitas depois do mês) e fica marcado; o ticket de tabela só entra quando a tabela vigente já valia no mês. O que foi digitado à mão não é alterado, e as diferenças aparecem só para conferência.

## [1.5.0] - 2026-11-10

### Adicionado
- Tabelas e espelhos › Comitê de vendas (só administrador): envio do PDF mensal do comitê com a vigência das condições. A IA lê, por produto, o desconto máximo, as parcelas pré-chaves (Ato + Parc.), as parcelas pós-chaves (Pré-soluto) e a previsão de entrega; o administrador confere, liga cada produto ao empreendimento do cadastro (o sistema aprende os nomes para os meses seguintes) e aprova.
- Quadro Comparativo: na coluna da Sousa, desconto (%), parcelas pré e pós-chaves, prazo até a entrega e entrega passam a vir do Comitê de vendas aprovado que cobre a competência. Sem comitê, continua valendo a visita do Cliente Oculto.
- Concorrentes: campo opcional "Link do Google Maps" no cadastro (só aceita links do Google Maps). O link aparece como "Localização" no card de cada concorrente em Estoque e velocidade de vendas, no Comparativo.
- Tabelas e espelhos: depois de aprovada, o administrador pode corrigir a data de referência, o estoque e as vendas da leitura. A Pesquisa e o Comparativo passam a usar os valores corrigidos; mudar o mês é recusado se o mês de destino já tem outro dado do concorrente, e cada correção fica registrada (quem, quando, antes e depois).
- Quadro Comparativo: preço, ato, área, parcelas, prazo, entrega, desconto dos concorrentes e atendimento passam a vir só das visitas do Cliente Oculto feitas no mês escolhido; sem visita no mês, aparece "n/i" (antes valia a última visita de meses anteriores). Estoque e vendas continuam usando o último mês com dado, indicado no card.

## [1.4.0] - 2026-11-06

### Adicionado
- Tabelas e espelhos: botão "Enviar manualmente" (liberado depois de escolher concorrente e mês) para informar a quantidade em estoque e as vendas do período sem arquivo. O envio passa pela mesma conferência do Coordenador de Market Share e, aprovado, vale na Pesquisa como a tabela.

### Corrigido
- Aprovar uma leitura sem preços não apaga mais os preços que o mês já tinha.

## [1.3.1] - 2026-11-05

### Segurança
- Cliente Oculto: evidências e justificativas da calibragem passam a ser tratadas antes de entrar na tela de calibragem e na de correções do administrador (um texto malicioso não roda mais como código).

### Corrigido
- Lista de Tabelas e espelhos não carrega mais o arquivo inteiro de cada tabela só para montar a lista (tela mais leve e rápida).
- Sessões vencidas e códigos de acesso antigos são apagados automaticamente a cada 6 horas.

## [1.3.0] - 2026-11-05

### Adicionado
- Cliente Oculto: campo "Valor de entrada" nas condições comerciais, também no relatório, na comparação entre visitas, na exportação e nas correções do administrador.

### Alterado
- Cliente Oculto: valor da unidade, valor do ato, valor de entrada e desconto passam a ser obrigatórios para finalizar a avaliação (exceto "só prévia").

### Segurança
- Cabeçalhos de segurança em todas as telas: política de conteúdo (só o próprio sistema e a fonte), HSTS, proteção contra a tela ser embutida em outro site, `nosniff`, `Referrer-Policy` e `Permissions-Policy`; o sistema não informa mais a tecnologia usada (`X-Powered-By`).
- Script para a TI criar um usuário só de leitura no CV (`docs/seguranca/cv-usuario-leitura.sql`) e plano de reforço em `docs/seguranca.md`.

## [1.2.1] - 2026-10-23

### Alterado
- Tela de entrada: sem a frase explicativa no painel da marca.

## [1.2.0] - 2026-10-23

### Adicionado
- Logo da Sousa Araujo na aba do navegador, em todas as telas.
- Logo da Sousa Araujo na tela de entrada, no lugar das letras "SA".

### Corrigido
- Na troca de tela, a coluna do menu não aparece mais aberta por um instante quando o menu está recolhido.

## [1.1.0] - 2026-10-23

### Alterado
- Entrada única no sistema: equipe e agentes de campo entram pela mesma tela, só com o e-mail. O sistema reconhece o tipo de acesso e abre a tela certa; se o e-mail estiver nos dois cadastros, a pessoa escolhe por onde entrar.
- A página inicial deixa de pedir "Sou agente de campo / Equipe" e leva direto para a entrada.

## [1.0.0] - 2026-10-23

Primeira versão do sistema unificado de Market Share: Pesquisa de
Concorrentes e Cliente Oculto no mesmo sistema, com um único cadastro de
usuários.

### Acesso e usuários
- Login sem senha: convite por e-mail e código de 6 dígitos enviado por e-mail.
- Perfis Administrador, Coordenador de Produto, Supervisor de Parcerias,
  Coordenador de Market Share, Cliente Oculto (Avaliador) e Diretoria; uma
  pessoa pode ter mais de um.
- Acesso temporário com data limite para avaliadores contratados por visita.
- Administrador pode "Ver o sistema como" outro perfil.
- Agente de campo entra com e-mail e código (sem SMS); e-mail obrigatório no cadastro.
- Exclusão de agente de campo mantendo as coletas que ele já fez.

### Pesquisa de Concorrentes
- Coleta mensal de estoque e vendas dos concorrentes pelo agente de campo.
- Cadastros de empreendimentos, concorrentes (com data de lançamento),
  agentes de campo e dados próprios.
- Dados próprios com as vendas do mês vindas do CV.

### Tabelas e espelhos
- Leitura das tabelas das construtoras por IA (Claude Haiku 5.5, com Gemini de reserva).
- Conferência das leituras antes de valerem na pesquisa; vendas do mês
  calculadas pela comparação com a tabela anterior.

### Cliente Oculto
- Registro da visita em etapas: atendimento prévio online, condições,
  6 pilares e jornada comercial.
- Formulário por critérios: 4 itens por pilar com nota de 0 a 10 e evidência
  obrigatória, "Não se aplica" fora da média e popup de instruções.
- Fotos com identificação automática (avaliação, etapa, empreendimento e data/hora).
- Calibragem pelo Coordenador de Market Share, já preenchida com as notas do avaliador.
- Relatório da visita com prévia ampliada das fotos, exportação em HTML
  (com as fotos) e PDF.
- Recibo único por avaliador, com aprovação, devolução e pagamento pelo coordenador.

### Dashboards
- Visão geral e comparativo Sousa x concorrentes para a Diretoria.
- VSO único em todo o sistema: vendas ÷ (estoque no fim do mês + vendas).
- Quando o mês escolhido não tem dado, o comparativo mostra o último mês disponível.
- Dados dos empreendimentos Sousa sincronizados com o BI do CV a cada 30 minutos.

[Não publicado]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.5.4...HEAD
[1.5.4]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.5.3...v1.5.4
[1.5.3]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/releases/tag/v1.0.0
