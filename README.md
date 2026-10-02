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

- **Campos:** link da vaga, plataforma, status, data da aplicação, localização, modelo de trabalho, empresa/cargo e salário (opcionais), contato, notas, data de follow-up, tecnologias, responsabilidades, descrição completa e **CV enviado** (arquivo da pasta `cv/`, aberto pelo 📄 na tabela).
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

## Sobre mim

Em `/sobre-mim` (botão no topo do dashboard): blocos livres de título + texto (pitch, pontos fortes, respostas para perguntas comuns...), salvos automaticamente, com botão de copiar.

Cada bloco tem **"Usar no CV adaptado"** (marcado por padrão): marcado, o texto vira **fato** que a IA pode usar ao adaptar o CV; desmarcado (borda tracejada), é anotação pessoal e a IA não vê. Escreva nos blocos marcados só o que é verdade — é por eles que algo que você aprendeu (ex.: um projeto com MongoDB) passa a poder entrar no CV.

## CV adaptado por vaga

Em cada aplicação, o botão **CV** abre `/aplicacoes/:id/cv`:

1. **Compatibilidade (sem IA):** compara as tecnologias da vaga com as suas e separa o que você tem, o que está só no CV do outro idioma ou no "Sobre mim" (a IA vai incluir) e o que você não tem (nunca entra no CV).
2. **Adaptar com IA:** o [Gemini CLI](https://github.com/google-gemini/gemini-cli) reescreve resumo, ordem de skills e bullets com o vocabulário da vaga, no idioma da vaga. Para cada tecnologia que falta, escreve uma nota (fora do CV) de como sua experiência ajuda a aprendê-la, com um plano de estudo.
3. **Progresso ao vivo:** cada etapa aparece na página com cronômetro (e no terminal do `pnpm dev` como `[cv #id] ...`).
4. **Validação anti-invenção** (`src/lib/cv/validate.ts`):
   - **bloqueia** o CV (a IA recebe a lista e tenta mais uma vez; se insistir, nada é salvo) se tiver tecnologia, número/métrica, experiência ou termo da vaga que não esteja nos seus fatos;
   - **avisa** ("Confira antes de enviar") sobre palavras da vaga que a IA usou e não estão nos seus fatos — podem descrever algo que você fez, só você sabe;
   - roda de novo a cada visualização e antes de baixar o PDF.
5. **PDF** no mesmo layout de uma coluna do CV original (`wkhtmltopdf`), salvo em `cv/aplicacoes/<id>-<empresa>.pdf` e registrado como o CV enviado da aplicação. Gerar de novo substitui o arquivo.

**Fatos** = `cv/cv-en.md` + `cv/cv-pt.md` + blocos do "Sobre mim" marcados. A pasta `cv/` fica fora do git.

**Modelos:** `gemini-3.5-flash-lite` primeiro (de 30s a ~1,5 min); se falhar ou passar de 3 min, o modelo padrão do CLI (mais forte, mas costuma estar sobrecarregado e levar minutos). No plano gratuito cada modelo tem cota diária: quando acaba (erro 429), o app avisa "cota diária esgotada" e pula aquele modelo por 1 hora.

### Configuração

```bash
npm i -g @google/gemini-cli   # depois rode `gemini` uma vez para logar (ou use GEMINI_API_KEY)
cp .env.example .env.local     # segredos e opções; .env.local fica fora do git
```

Precisa também do `wkhtmltopdf` no PATH e dos CVs em markdown em `cv/cv-en.md` e `cv/cv-pt.md`. Variáveis em `.env.example`: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_TIMEOUT_MS`, `CV_DIR`, `WKHTMLTOPDF_BIN`.

## API

| Método | Rota | |
| --- | --- | --- |
| GET | `/api/applications?status=applied,interview&from=2026-01-01&to=…&location=…&platform=…&workModel=remote&q=…&followUp=due\|stale` | Lista com filtros |
| POST | `/api/applications` | Cria |
| GET / PATCH / DELETE | `/api/applications/:id` | Lê / atualiza parcialmente / remove |
| GET | `/api/stats?<mesmos filtros>` | Métricas |
| POST | `/api/scrape` `{ "url": "..." }` | Extrai dados de uma vaga |
| GET / POST | `/api/profile-notes`, PATCH / DELETE `/api/profile-notes/:id` | Blocos do "Sobre mim" |
| POST | `/api/applications/:id/tailored-cv` | Gera o CV adaptado (Gemini CLI); resposta em NDJSON com o progresso |
| GET | `/api/applications/:id/tailored-cv/pdf` | Baixa o CV adaptado em PDF (409 se não passar na validação) |
| GET | `/api/applications/:id/cv-file` | Abre o arquivo do CV enviado (`cvPath`) |
