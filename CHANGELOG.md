# Histórico de versões

Todas as mudanças relevantes do sistema de Market Share Sousa Araujo ficam
registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e a numeração segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/).
Como versionar e publicar: [docs/versionamento.md](docs/versionamento.md).

## [Não publicado]

Mudanças já feitas que ainda não entraram em uma versão.

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

[Não publicado]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Sousa-Araujo/pesquisa_concorrentes/releases/tag/v1.0.0
