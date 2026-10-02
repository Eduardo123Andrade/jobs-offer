# Jobs Offer — dashboard de aplicações

Dashboard local (sem login) para acompanhar candidaturas a vagas. Next.js (App Router) com frontend e API REST no mesmo projeto, PostgreSQL via Docker e Drizzle ORM.

## Rodando

```bash
pnpm install
pnpm dev     # banco de DEV + next dev   → http://localhost:3000
pnpm prod    # banco de PROD + build/start → http://localhost:3002
```

Cada comando sobe o container do seu banco, aplica as migrations e inicia o Next. **Ctrl+C** encerra o Next e para o container daquele ambiente (os dados ficam no volume).

| | Dev | Prod |
| --- | --- | --- |
| Container | `jobs-offer-db-dev` (porta 5434) | `jobs-offer-db-prod` (porta 5435) |
| Banco | `jobs_offer_dev` | `jobs_offer_prod` |
| Env | `.env.development` | `.env.production` |
| Dados fake | 40 aplicações inseridas automaticamente se o banco estiver vazio | nunca |
| Reset | `pnpm db:reset` | bloqueado |

O banco de prod usa um volume Docker **externo** (`jobs-offer-pgdata-prod`): nem `docker compose down -v` o apaga. Os scripts de seed/reset recusam rodar em qualquer banco que não seja `jobs_offer_dev`.

| Script | O que faz |
| --- | --- |
| `pnpm db:generate` | Gera migration após alterar `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica migrations no dev (`pnpm dev`/`pnpm prod` já fazem isso sozinhos) |
| `pnpm db:seed` | Substitui os dados do dev por dados fake |
| `pnpm db:reset` | Recria o schema do dev do zero + seed |
| `pnpm db:studio` | Drizzle Studio no banco de dev (com o container rodando) |

## Funcionalidades

- **Campos:** link da vaga, plataforma, status, data da aplicação, localização, modelo de trabalho, empresa/cargo e salário (opcionais), contato, notas, data de follow-up.
- **Filtros (na URL):** status (múltiplos), período, localização, plataforma, modelo, busca textual, follow-up pendente / paradas.
- **Métricas:** totais, taxa de resposta, % que chegou à entrevista, gráficos por semana / status / plataforma — refletem os filtros ativos.
- **Follow-up:** destaque para follow-ups vencidos e aplicações abertas sem mudança de status há 14+ dias (`STALE_AFTER_DAYS` em `src/lib/constants.ts`).

## Preenchimento automático

Ao colar o link da vaga no formulário (ou clicar em **Buscar dados**), o servidor baixa a página e preenche **só os campos vazios**: plataforma, empresa, cargo, localização, modelo de trabalho, salário, tecnologias, resumo das responsabilidades e a descrição completa (guardada para quando a vaga sair do ar).

| Fonte | Como |
| --- | --- |
| LinkedIn | endpoint público `jobs-guest` (sem login) |
| Gupy | dados estruturados da página (`__NEXT_DATA__`), incl. responsabilidades separadas |
| Outros (Greenhouse, Lever, sites de carreira...) | JSON-LD `JobPosting`, depois Open Graph |
| Indeed / Glassdoor | geralmente bloqueiam robôs → só a plataforma é preenchida |

Tecnologias são detectadas por dicionário (`src/lib/scrape/extract.ts`, lista `TECHS`) e responsabilidades pela seção "Responsabilidades / Atividades / O que você vai fazer" da descrição. Tudo é editável antes de salvar.

## API

| Método | Rota | |
| --- | --- | --- |
| GET | `/api/applications?status=applied,interview&from=2026-01-01&to=…&location=…&platform=…&workModel=remote&q=…&followUp=due\|stale` | Lista com filtros |
| POST | `/api/applications` | Cria |
| GET / PATCH / DELETE | `/api/applications/:id` | Lê / atualiza parcialmente / remove |
| GET | `/api/stats?<mesmos filtros>` | Métricas |
| POST | `/api/scrape` `{ "url": "..." }` | Extrai dados de uma vaga |
