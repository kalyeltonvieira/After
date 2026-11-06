# Plano de Implementação: Plataforma Inteligente AFTER - Módulo de Arquitetura, Relatórios & Busca Avançada

Plano detalhado para a implementação do Comparador Visual de Arquitetura entre Branches/Tags, Exportação de Relatórios Executivos de Integridade (PDF e JSON), e Filtros Avançados de Busca Pública de Repositórios GitHub no AFTER.

## Decisões Confirmadas pelo Usuário

> [!IMPORTANT]
> As escolhas abaixo foram explicitamente confirmadas pelo usuário na etapa de alinhamento interativo (Fase 1):

- **Funcionalidades Prioritárias**: Comparador de arquitetura entre branches/tags e exportação de relatórios executivos de integridade em múltiplos formatos.
- **Formatos de Exportação**: Ambos PDF interativo (com layout de relatório executivo e opções de impressão/download) e JSON estruturado (para pipeline e documentação técnica).
- **Filtros Avançados de Busca Pública**: Filtros combinados por contagem mínima de estrelas, linguagem principal, licença do repositório (MIT, Apache-2.0, GPL-3.0, etc.) e busca contextual por tópicos.

---

## 1. Visão Geral & Conceito do Produto

O **AFTER** é a camada de inteligência contínua que compreende a evolução do código ao longo do tempo. Nesta iteração, completamos os recursos fundamentais de análise comparativa, inteligência executiva e navegação avançada:

1. **Comparador Visual de Arquitetura (Branch/Tag Diff Engine)**:
   - Permite comparar grafos de dependência e nós de arquitetura entre duas branches (ex: `main` vs `dev`) ou tags/releases.
   - Destaca nós adicionados, removidos ou modificados no Product Graph com código de cores suíço elegante e estatísticas de impacto.

2. **Relatório Executivo de Integridade do Software (Executive Integrity Report)**:
   - Geração de relatórios com diagnósticos de saúde arquitetural, métricas de complexidade, evidências conhecidas/inferidas/desconhecidas e análise de risco de dependências.
   - Exportação em **PDF Interativo** (com layout limpo pronto para impressão) e **JSON Estruturado** completo.

3. **Filtros Avançados de Busca no Diretório Público**:
   - Painel de filtros retrátil em `ProjectsPage.tsx` permitindo filtrar por intervalo de estrelas, linguagem (TypeScript, Rust, Python, Go, etc.), licenças de código livre e tags de tópicos.

---

## 2. Experiência do Usuário & Design Visual (Vercel / Linear Minimal Swiss)

- **Estética Visual**: Suíça minimalista, tipografia nítida (Plus Jakarta Sans / JetBrains Mono), paleta monocromática com acentos semânticos de baixo contraste (Verde nominal, Âmbar aviso, Carmim risco, Azul alteração).
- **Comparador de Arquitetura**:
  - Modal/View fluida com seletores sincronizados para `Branch Base` vs `Branch Comparada`.
  - Visualização gráfica em modo Split ou Overlay com contagem de delta (`+X nós adicionados`, `-Y nós removidos`, `~Z conexões alteradas`).
- **Relatório Executivo**:
  - Painel de visualização prévia com métricas executivas (Índice de Saúde Arquitetural, Cobertura de Evidências, Densidade de Dependências).
  - Ações diretas de exportação: `Exportar PDF` e `Exportar JSON`.
- **Filtros de Busca**:
  - Barra de controle minimalista com seletores de filtro em segmented control, dropdown de licenças e badge-tags limpas sem pílulas excessivas.

---

## 3. Arquitetura Técnica & Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AFTER FRONTEND (React)                          │
├───────────────────────────────────┬─────────────────────────────────────────┤
│          ProjectsPage             │            RepositoryPage               │
│  - Advanced Filters Bar           │  - Architecture Compare View            │
│  - GitHub Public Search Hook      │  - Executive Integrity Report Panel     │
└─────────────────┬─────────────────┴────────────────────┬────────────────────┘
                  │                                      │
                  ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             EXPRESS BACKEND SERVER                          │
├───────────────────────────────────┬─────────────────────────────────────────┤
│   /api/projects/github-search     │    /api/projects/:id/compare-branches │
│   - Star ranges, language,        │    - Git tree diff & node graph diff    │
│     license, topic filters        │    - Impact & dependency matrix         │
├───────────────────────────────────┼─────────────────────────────────────────┤
│   /api/projects/:id/report        │    /api/projects/:id/export-pdf         │
│   - Integrity report JSON builder │    - Executive HTML-to-PDF print layout │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 4. Tarefas de Implementação

### Etapa 1: Comparador Visual de Arquitetura (`ArchitectureCompareModal.tsx` & Backend Diff)
- Criar endpoint no Express `/api/projects/:id/compare-branches?base=:base&head=:head` para computar a diferença de árvore de código, dependências e nós do Product Graph entre branches/tags.
- Desenvolver componente React `ArchitectureCompareModal.tsx` integrado à página do repositório (`RepositoryPage.tsx`), com seletores de branches e visualização de nós modificados.

### Etapa 2: Gerador e Exportador de Relatório Executivo de Integridade (`ExecutiveReportModal.tsx`)
- Implementar construtor de dados do relatório integrando métricas reais de código, dependências, histórico de commits, dados de PII/segurança e evidências (Known, Inferred, Unknown).
- Desenvolver modal de relatório com pré-visualização executiva e botões de download:
  - **JSON**: Download imediato do arquivo `.json` com o esquema completo de integridade.
  - **PDF**: Layout formatado com `@media print` CSS ou gerador PDF limpo sem dependências externas quebradas.

### Etapa 3: Filtros Avançados na Busca Pública de Repositórios (`ProjectsPage.tsx`)
- Expandir o endpoint `/api/projects/github-search` para aceitar parâmetros `language`, `stars`, `license` e `topic`.
- Adicionar barra de filtros interativa no `ProjectsPage.tsx` com estado reativo e integração com o Infinite Scroll.

---

## 5. Plano de Verificação & Testes

1. **Compilação e Linting**: Executar `compile_applet` e `lint_applet` simultaneamente para garantir ausência de erros de build ou TypeScript.
2. **Testes Unitários**: Garantir a execução de `npm test` para todos os fluxos do backend e frontend.
3. **Verificação Visual**: Confirmar a coerência do estilo minimalista Vercel/Linear e fluidez das animações com Motion.
