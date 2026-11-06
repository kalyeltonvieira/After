# Mega Plano de Implementação: Product Graph Interativo, Simulação de Impacto & Observação ao Vivo

Plano abrangente para evolução do **Product Graph**, **Simulador de Impacto Arquitetural** e **Feed de Atividade ao Vivo** no AFTER.

## Decisões Confirmadas pelo Usuário

> [!IMPORTANT]
> As escolhas abaixo foram explicitamente confirmadas pelo usuário na etapa de alinhamento interativo (Fase 1):

- **Foco de Funcionalidades**: Mapeamento interativo de alto desempenho do Product Graph e motor de simulação de impacto em tempo real.
- **Evolução da Visualização Gráfica**: Canvas interativo 2D/3D com agrupamento por pastas, filtros de nós, zoom/pan e simulação física de forças (force-directed layout).
- **Observação Contínua**: Feed de atividade ao vivo em tempo real com estado de sincronização contínua e raio de impacto de cada alteração.

---

## 1. Visão Geral do Produto

O **AFTER** é a camada de inteligência contínua sobre o código. Este **Mega Plano** transforma a exploração do código de uma tabela estática em um ecossistema vivo e interativo:

1. **Product Graph 2.0 (Canvas Interativo com Física de Forças)**:
   - Visualização do mapa completo de nós (Páginas, Componentes, APIs, Serviços, Configurações, Dependências) com motor de física de forças.
   - Agrupamento visual por diretórios e pastas do projeto, permitindo expandir/recolher módulos com animações fluida de transição.
   - Seleção contextual de nós para inspeção imediata com o assistente Ask AFTER.

2. **Simulador de Impacto Arquitetural ("What Happens If I Change This?")**:
   - Ferramenta interativa onde o usuário seleciona qualquer elemento do grafo e simula o raio de impacto de uma alteração (dependentes diretos, dependentes transitivos e APIs/testes potencialmente afetados).
   - Cálculo visual com cadeia de impacto destacada em cores semânticas.

3. **Feed de Atividade ao Vivo & Observação Contínua (`WatchPage.tsx`)**:
   - Feed dinâmico ao vivo com indicadores de status de sincronização (Online / Observando), rastreamento de commits, PRs e issues.
   - Painel de alvos observados ("Watched Targets") com alertas instantâneos de alteração de arquitetura.

---

## 2. Design Visual & Experiência do Usuário (Vercel / Linear Minimal Swiss)

- **Canvas do Grafo**: Fundo neutro com grade sutil, nós em superfícies lisas com bordas hairline (`1px border-zinc-200 dark:border-zinc-800`), cores de linguagem de programação oficiais e indicadores semânticos.
- **Física de Forças**: Repulsão suave de nós e atração por dependência para evitar sobreposição de texto, com suporte a drag & drop de nós.
- **Painel de Simulação de Impacto**: Visualização em arborescência da cadeia de impacto com destaque para os arquivos em risco e nível de confiança.

---

## 3. Arquitetura Técnica & Componentes

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AFTER FRONTEND (React)                          │
├───────────────────────────────────┬─────────────────────────────────────────┤
│         ProductGraphPage          │               WatchPage                 │
│  - Interactive Force Canvas       │  - Live Activity Stream                 │
│  - Folder Grouping Controls       │  - Continuous Observation Status        │
│  - Node Inspection Modal          │  - Watched Targets Manager              │
├───────────────────────────────────┴─────────────────────────────────────────┤
│                       ImpactSimulator Component                             │
│  - Interactive Node Picker & Chain Calculation                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS BACKEND SERVER                            │
├───────────────────────────────────┬─────────────────────────────────────────┤
│   /api/projects/impact            │   /api/projects/graph-topology          │
│   - Transitive dependent graph    │   - Complete graph nodes & edges        │
│     calculator                    │     hierarchical tree                   │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 4. Etapas de Implementação

### Etapa 1: Product Graph 2.0 (`ProductGraphPage.tsx` / `ProductGraphView.tsx`)
- Implementar canvas interativo baseado em física de forças (force simulation) com SVG/Canvas.
- Adicionar suporte a agrupamento por pastas e nós colapsáveis por módulo.
- Integrar busca e filtros por tipo de nó (Páginas, Componentes, APIs, Lógica, Configs).

### Etapa 2: Motor de Simulação de Impacto (`ImpactSimulator.tsx` + Endpoint `/api/projects/impact`)
- Criar visualizador dedicado para simulação de impacto quando o usuário clica em "O que acontece se eu mudar isso?".
- Destacar dependentes diretos e indiretos com matriz de evidências (Known, Inferred, Unknown).

### Etapa 3: Feed de Atividade ao Vivo & Status de Observação (`WatchPage.tsx`)
- Aprimorar o feed de observação contínua com atualização em tempo real, status da conexão com GitHub e lista interativa de alvos monitorados.

---

## 5. Plano de Verificação

1. **Compilação e Linting**: Co-executar `compile_applet` e `lint_applet` para garantir 0 erros de build ou TypeScript.
2. **Suíte de Testes**: Executar `npm test` para assegurar que todas as suítes passam.
