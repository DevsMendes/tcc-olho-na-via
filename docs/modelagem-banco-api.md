# Modelagem do Banco e Integracao Open311

Este documento descreve a parte pratica do projeto Buraco Alerta: aplicativo mobile, API 311 local e banco SQLite.

## Fluxo principal

1. O cidadao cria cadastro ou entra no aplicativo.
2. O app solicita permissao de localizacao em tempo real.
3. O cidadao seleciona o ponto do buraco no mapa ou usa a localizacao atual.
4. O cidadao informa rua, bairro, referencia, descricao, prioridade e foto.
5. O app envia a ocorrencia e a imagem em base64 para a API 311.
6. A API salva a foto em `api3111/uploads`, salva a solicitacao no SQLite e devolve um `service_request_id`.
7. O app exibe o protocolo na lista de ocorrencias.
8. Ao alterar o status, a API atualiza a solicitacao e grava um item no historico.

## Banco SQLite

Arquivo do banco:

```text
api3111/open311.db
```

Pasta das imagens:

```text
api3111/uploads
```

### Tabela `users`

Armazena os cidadaos cadastrados no prototipo.

| Campo | Tipo | Descricao |
| --- | --- | --- |
| `id` | INTEGER | Identificador do usuario |
| `name` | TEXT | Nome do cidadao |
| `email` | TEXT | Email unico |
| `password_hash` | TEXT | Senha em hash para o prototipo |
| `created_at` | TEXT | Data de criacao em ISO |

### Tabela `requests`

Armazena as solicitacoes de buracos em vias publicas.

| Campo | Tipo | Descricao |
| --- | --- | --- |
| `service_request_id` | TEXT | Protocolo Open311 da solicitacao |
| `service_code` | TEXT | Codigo do servico |
| `service_name` | TEXT | Nome do servico urbano |
| `status` | TEXT | Status no formato Open311 |
| `status_notes` | TEXT | Observacao do status atual |
| `description` | TEXT | Descricao enviada pelo cidadao |
| `requested_datetime` | TEXT | Data de abertura |
| `updated_datetime` | TEXT | Ultima atualizacao |
| `address` | TEXT | Rua e bairro |
| `lat` | TEXT | Latitude |
| `long` | TEXT | Longitude |
| `media_url` | TEXT | URI da foto anexada |
| `attributes_json` | TEXT | Prioridade e referencia em JSON |
| `user_id` | INTEGER | Usuario que abriu a ocorrencia |

### Tabela `request_history`

Armazena a timeline de alteracoes.

| Campo | Tipo | Descricao |
| --- | --- | --- |
| `id` | INTEGER | Identificador do item |
| `service_request_id` | TEXT | Protocolo relacionado |
| `status` | TEXT | Status registrado |
| `status_notes` | TEXT | Observacao da alteracao |
| `created_at` | TEXT | Data da alteracao |

## Status

| App | API |
| --- | --- |
| Aberto | `open` |
| Em analise | `acknowledged` |
| Em andamento | `in_progress` |
| Concluido | `closed` |
| Cancelado | `canceled` |

## Endpoints

| Metodo | Rota | Funcao |
| --- | --- | --- |
| GET | `/health.json` | Verifica API, banco e contadores |
| GET | `/services.json` | Lista o servico Open311 disponivel |
| POST | `/users.json` | Cria cadastro de cidadao |
| POST | `/sessions.json` | Realiza login |
| GET | `/requests.json` | Lista ocorrencias salvas |
| POST | `/requests.json` | Registra nova ocorrencia |
| GET | `/requests/:id.json` | Busca uma ocorrencia com historico |
| PATCH | `/requests/:id.json` | Atualiza status da ocorrencia |
| GET | `/requests/:id/history.json` | Lista historico da ocorrencia |
| GET | `/uploads/:filename` | Exibe uma foto salva pela API |

## Observacao de seguranca

A autenticacao foi implementada para fins academicos e demonstrativos. Antes de uso real, recomenda-se trocar o hash simples por autenticacao segura com bcrypt ou Argon2, tokens de sessao e HTTPS.
