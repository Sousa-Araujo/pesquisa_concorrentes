# Versionamento

O sistema segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/):
**MAIOR.MENOR.CORREÇÃO** (ex.: `1.4.2`).

| Parte | Quando sobe | Exemplo |
| --- | --- | --- |
| MAIOR | Mudança que quebra o jeito de usar ou exige ação de todos (nova forma de login, troca de regra que muda números históricos) | `1.4.2` → `2.0.0` |
| MENOR | Função nova ou melhoria visível, sem quebrar nada | `1.4.2` → `1.5.0` |
| CORREÇÃO | Correção de erro ou ajuste pequeno | `1.4.2` → `1.4.3` |

## Onde a versão aparece

- `package.json` (campo `version`) é a fonte única.
- O rodapé de todas as telas mostra "Versão: x.y.z" (React em
  `src/components/AppShell.tsx` e Cliente Oculto em `public/design/shell.js`,
  que lê a versão de `/api/menu`).
- `/api/health` também devolve a versão, para conferir o que está no ar.
- Cada versão publicada tem uma tag no Git (`v1.0.0`, `v1.1.0`...).

## Como publicar uma versão nova

1. Durante o trabalho, anote cada mudança na seção **[Não publicado]** do
   [CHANGELOG.md](../CHANGELOG.md), nos grupos Adicionado, Alterado,
   Corrigido ou Removido, em linguagem de quem usa o sistema.
2. Na hora de publicar, escolha o número novo (tabela acima) e troque o
   título **[Não publicado]** por `[x.y.z] - AAAA-MM-DD`, deixando uma seção
   **[Não publicado]** vazia em cima. Atualize os links do fim do arquivo.
3. Suba o número no `package.json` e crie a tag (o comando faz os dois e o
   commit):

   ```bash
   npm version minor -m "Versão %s"
   ```

   Use `patch` para correção, `minor` para função nova e `major` para mudança
   que quebra. Para um número exato: `npm version 1.2.0 -m "Versão %s"`.
4. Envie o commit e a tag:

   ```bash
   git push --follow-tags
   ```

5. Confira no rodapé (ou em `/api/health`) que a versão nova está no ar.

## Ambientes

- **Teste:** projeto `pesquisa-concorrentes`, ambiente `teste`.
- **Produção nova:** projeto `market-share`, ambiente `production`.
- Os dois publicam a partir da branch configurada no Railway. Só publique
  uma versão em produção depois de testada no ambiente de teste.
