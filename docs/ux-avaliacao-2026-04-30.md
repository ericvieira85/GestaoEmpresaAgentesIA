# Avaliação de Usabilidade — Paperclip (UI)

**Data:** 2026-04-30
**Escopo:** `ui/src/` — Dashboard, Sidebar, NewAgent, OnboardingWizard, atalhos, navegação, padrões de UX.
**Método:** Inspeção heurística (Nielsen) + leitura de páginas-chave + auditoria de sinais (a11y, loading, empty, toast, atalhos).

---

## 1. Sumário Executivo

Paperclip é um SPA React 19 maduro: **66 páginas**, **223 componentes**, roteamento bem estruturado por escopo (instance/board/company), atalhos de teclado básicos (`/`, `?`, `c`, `[`, `]`), command palette (`⌘K`), wizard de onboarding em 4 passos, EmptyState e PageSkeleton consistentes. A base de UX é sólida.

**Os maiores gaps:**

1. **Acessibilidade fraca** — apenas ~223 ocorrências de `aria-*`/`role=` em 223 componentes (≈1 por componente). Para um app desse porte deveria ser 5–10×.
2. **Sem i18n** — strings hard-coded em inglês; o projeto é brasileiro (CLAUDE.md em pt-BR), mas a UI não tem camada de tradução.
3. **Atalhos de teclado pobres** — apenas 5 globais. Faltam `g d` (go dashboard), `g i` (issues), navegação j/k em listas, `Esc` consistente.
4. **Formulário NewAgent é denso** — 335 linhas, sem progressão guiada, sem preview, mistura "Advanced" como rótulo mas é a única rota.
5. **Dashboard sobrecarregado** — 4 MetricCards + 4 charts + 2 listas + plugin slot em uma única tela, sem priorização visual nem personalização.
6. **Mobile é segunda classe** — existe `MobileBottomNav` mas o Sidebar de 240px é fixo; Dashboard usa `grid-cols-2 xl:grid-cols-4` (sem mobile-first claro em todos os pontos).
7. **Feedback de erros inline** — `formError` em string simples, não usa toast/banner padronizado em todas as páginas (apenas 5 arquivos usam `toast`).
8. **Rotas duplicadas Board/Company** — 20+ redirects `UnprefixedBoardRedirect`. Indica débito de migração que confunde links/bookmarks.

---

## 2. Pontos Fortes (manter)

- ✅ **EmptyState reutilizável** com ícone + ação (Dashboard L177-187 é exemplar).
- ✅ **PageSkeleton** por variante evita flicker.
- ✅ **CommandPalette** (`⌘K`) cobre busca cross-entity.
- ✅ **Breadcrumbs via context** (`useBreadcrumbs`) — single source of truth.
- ✅ **Banner contextual** quando `hasNoAgents` no Dashboard linka direto pro onboarding step 2.
- ✅ **OnboardingWizard** em 4 passos (Company → Adapter/Agent → Goal → Launch) com AsciiArt — onboarding deliberado.
- ✅ **Activity row animation** (entrada animada de eventos novos no Dashboard) — feedback "vivo".

---

## 3. Achados por Página

### 3.1 Dashboard ([Dashboard.tsx:37](ui/src/pages/Dashboard.tsx#L37))

**Problemas:**
- 6 `useQuery` independentes em paralelo — sem skeleton parcial; espera o `dashboardApi.summary` para renderizar tudo. Usuários com latência veem tela vazia.
- `recentIssues` e `recentActivity` lado a lado: redundância visual (Issue updates já aparecem em Activity).
- Charts `Last 14 days` não têm seletor de período.
- "Pending Approvals" mistura approval + budgetApproval no mesmo número — perde granularidade.
- Sem CTA personalizada baseada em estado (ex: "3 agentes em erro — investigar").

**Melhorias propostas:**
- **Renderização incremental:** mostrar MetricCards assim que `data` chegar; charts e listas hidratam depois com skeleton individual.
- **Period selector** (`7d / 14d / 30d`) compartilhado entre charts.
- **Hero alert** unificado no topo: incidents > erros > approvals pendentes > healthy (já existe parcialmente em L222-237, generalizar).
- **Personalização por papel:** board vê approvals/cost; operator vê runs/issues.

### 3.2 NewAgent ([NewAgent.tsx:53](ui/src/pages/NewAgent.tsx#L53))

**Problemas:**
- Subtítulo "Advanced agent configuration" sugere existir uma versão "Basic", mas não há alternativa. Confunde.
- Form linear de ~130 linhas de JSX num só `<div>`: Name → Title → Role → ReportsTo → AgentConfigForm → Skills → Footer. Sem agrupamento visual claro além de bordas.
- `effectiveRole = isFirstAgent ? "ceo" : role` — força CEO no primeiro, mas o picker fica `disabled` sem tooltip explicativo (apenas texto no rodapé "This will be the CEO").
- Validação só ocorre no submit (`opencode_local` model check em L143-170). Usuário só descobre erro depois de clicar.
- Campo "Title" é placeholder "(e.g. VP of Engineering)" mas não há sugestões/autocomplete.
- Sem preview do agent antes de criar (custo/mês estimado, capabilities, herança de skills).

**Melhorias propostas:**
- **Wizard horizontal de 3 steps**: 1) Identidade (name/title/role), 2) Adapter & Model, 3) Skills & Hierarquia — com indicador de progresso.
- **Validação ao vivo** por campo (debounced) para campos com regra externa (model availability).
- **Tooltip "?"** ao lado do role disabled explicando o porquê.
- **Estimativa de custo mensal** abaixo do botão "Create agent" baseado no model + budget.
- **Botão "Use template"** (CEO, Engineer, PM, Designer) que pré-popula campos.

### 3.3 Sidebar ([Sidebar.tsx:31](ui/src/components/Sidebar.tsx#L31))

**Problemas:**
- Hack para abrir search: dispara KeyboardEvent sintético (L48-50). Frágil — quebra se o handler do CommandPalette mudar.
- "New Issue" como botão sem `aria-label` específico (depende do texto). Tá ok, mas o `<button>` não está identificado como ação primária visualmente (mesmo estilo de NavItem).
- Largura fixa `w-60` (240px) — não é colapsável (existe `[` shortcut, mas estado de colapso global não foi auditado aqui; verificar Layout).
- `liveRunCount` poll a cada 10s mesmo sem foco — drena bateria mobile.

**Melhorias propostas:**
- Substituir `dispatchEvent` por chamada direta ao `useDialogActions().openCommandPalette`.
- Pausar `refetchInterval` quando `document.hidden` (já há helpers de visibility em React Query).
- Ação "New Issue" com cor/peso diferenciado (primária com ícone preenchido).
- Persistir estado de colapso por usuário (já existe `useCompanyOrder`, replicar pattern).

### 3.4 Onboarding ([OnboardingWizard.tsx](ui/src/components/OnboardingWizard.tsx))

**Problemas observados (parciais):**
- DEFAULT_TASK_DESCRIPTION é um texto hard-coded em inglês — usuário brasileiro vê texto fora de contexto.
- Steps 1–4 num único componente grande (não dividido por step files); difícil manter.

**Melhorias:**
- Internacionalizar via i18n.
- Quebrar em `OnboardingStep1Company.tsx`, `OnboardingStep2Adapter.tsx`, etc.
- "Skip onboarding" sempre visível (não só "X" no canto), gerando empresa demo populada para exploração.

---

## 4. Acessibilidade (a11y)

| Sinal | Resultado | Alvo |
|---|---|---|
| `aria-*` / `role=` | ~223 ocorrências em 223 componentes | 5–10× isso |
| Foco visível | Não auditado — verificar `:focus-visible` no Tailwind config | Todos botões/links |
| Skip-to-content | Não detectado | Adicionar |
| Trap de foco em Dialog | shadcn/ui herda Radix — provavelmente OK | Validar |
| Contraste tema escuro | Banner amber em L201 — `bg-amber-50` em dark `bg-amber-950/60` — verificar 4.5:1 | WCAG AA |

**Ações:**
- Auditoria com `axe-core` no Playwright — adicionar suite a11y por página principal.
- Linter `eslint-plugin-jsx-a11y` em `nivel: error`.
- Adicionar `aria-live="polite"` no ToastViewport e em ActivityRow novo (já tem animação, falta anúncio).
- Skip link `<a href="#main">` no Layout.

---

## 5. Internacionalização

**Estado:** zero. `grep i18n` retorna nada relevante.
**Impacto:** projeto pt-BR cuja UI é 100% em inglês — mismatch com público interno (memory diz "user é brasileiro").

**Proposta:**
- `react-i18next` + namespace por página.
- Extrair strings com codemod (`@formatjs/cli` ou similar).
- Locale switcher em `ProfileSettings`.
- Defaults: `pt-BR` e `en` num primeiro momento.

---

## 6. Atalhos de Teclado

**Atual** ([useKeyboardShortcuts.ts](ui/src/hooks/useKeyboardShortcuts.ts)): `/`, `?`, `c` (new issue), `[` (sidebar), `]` (panel).

**Faltam (padrão Linear/GitHub):**
- `g d` → Dashboard, `g i` → Issues, `g a` → Agents, `g p` → Projects, `g r` → Routines.
- `j` / `k` em listas (Issues, Agents, Activity).
- `Esc` em todo Dialog/Popover (validar em Radix).
- `⌘ Enter` para submeter forms (NewAgent, NewIssue).
- `e` → editar item focado.

**Cheatsheet** ([KeyboardShortcutsCheatsheet.tsx]) — manter atualizado quando adicionar.

---

## 7. Padronização de Feedback

**Toast usage**: apenas 5 arquivos (`ExecutionWorkspaceCloseDialog`, `IssueRunLedger`, `NewIssueDialog`, `SidebarAgents` + 1 test).

**NewAgent.tsx:131** usa `setFormError(string)` — não usa toast.
**NewAgent.tsx:316** mostra erro inline em `<p className="text-xs text-destructive">`.

**Inconsistência:** sucesso/erro em mutations não segue um único padrão (toast vs inline vs banner).

**Proposta:**
- Hook `useMutationToast(mutation, { successMessage, errorMessage })` que padroniza.
- Erros de validação **inline** (no campo).
- Erros de servidor / mutation → **toast**.
- Eventos persistentes (run failed, budget exceeded) → **banner** no topo.

---

## 8. Roteamento

**Achado:** 20+ rotas `UnprefixedBoardRedirect` em [App.tsx:91-115](ui/src/App.tsx#L91). Indica que existem dois modelos: `/agents` e `/:companyPrefix/agents`. A duplicação:
- Polui a tabela de rotas.
- Bookmarks antigos quebram silenciosamente (redirect vs 404).
- Telemetria por path fica ambígua.

**Proposta:**
- Decidir um modelo canônico (recomendo `/:companyPrefix/...` para multi-empresa).
- Manter redirects por 1 release com header `X-Deprecated-Route` em logs.
- Remover após período de graça.

---

## 9. Performance percebida

- **Dashboard**: 6 queries paralelas — bom. Mas `isLoading` só do `summary` bloqueia a tela inteira (L190-192). Skeleton parcial recomendado.
- **Sidebar**: poll de `liveRuns` a cada 10s mesmo com tab oculta.
- **PageSkeleton** existe e é usado — manter padrão.
- Sem code-splitting evidente por rota (verificar `vite.config.ts`); 66 páginas em bundle único é caro.

**Ações:**
- `React.lazy` por rota (especialmente DesignGuide, UxLab pages — só dev).
- `refetchInterval` condicional a `document.visibilityState`.

---

## 10. Plano Priorizado (RICE rápido)

| # | Melhoria | Impacto | Esforço | Quando |
|---|---|---|---|---|
| 1 | Skeleton parcial no Dashboard + period selector | Alto | M | Sprint 1 |
| 2 | NewAgent: wizard 3 steps + preview de custo | Alto | M-G | Sprint 1-2 |
| 3 | Atalhos `g d / g i / g a` + `j/k` em listas | Médio | P | Sprint 1 |
| 4 | Padronizar feedback (`useMutationToast` hook) | Médio | P | Sprint 1 |
| 5 | i18n (pt-BR + en) | Alto | G | Sprint 2-3 |
| 6 | Auditoria a11y + axe-core + skip link | Alto | M | Sprint 2 |
| 7 | Pausar polls em tab oculta | Médio | P | Sprint 1 |
| 8 | Code-splitting por rota | Médio | P | Sprint 1 |
| 9 | Consolidar rotas Board/Company | Baixo | M | Sprint 3 |
| 10 | Mobile: Sidebar colapsável + revisão grids | Médio | M | Sprint 2 |

**Quick wins (1 dia cada):** #3, #4, #7, #8.
**High-value medium effort:** #1, #2, #6.
**Estratégicos:** #5, #9, #10.

---

## 11. Próximos Passos

1. Validar prioridades com stakeholders (CEO/Board do Paperclip).
2. Criar issues no próprio Paperclip a partir desta lista (dogfooding).
3. Adicionar `axe-core` ao Playwright como gate de CI.
4. Decidir lib de i18n (recomendo `react-i18next`).
5. Spike de NewAgent wizard (1 dia) para validar UX antes de implementar.
