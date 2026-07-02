# Relatorio de Implementacao do Projeto Buraco Alerta

## 1. Visao geral

O projeto Buraco Alerta foi implementado como um aplicativo mobile em React Native com Expo, integrado a uma API local baseada no padrao Open311. A solucao permite que um cidadao registre ocorrencias de buracos em vias publicas, informe a localizacao, adicione uma foto, acompanhe o status da solicitacao e visualize o historico de alteracoes.

A parte pratica do sistema foi estruturada em tres camadas principais:

- Aplicativo mobile em React Native + Expo.
- API local 3111 baseada em rotas REST inspiradas no Open311.
- Banco de dados SQLite para persistencia dos dados.

## 2. Banco de dados

Foi adicionado um banco de dados SQLite ao projeto, localizado em:

```text
api3111/open311.db
```

Esse banco e criado e utilizado automaticamente pela API quando o servidor e iniciado. A escolha do SQLite atende bem ao prototipo academico, pois permite persistencia local dos dados sem exigir instalacao de um servidor de banco separado.

### 2.1 Tabelas implementadas

O banco possui tres tabelas principais.

### users

Armazena os dados dos usuarios cadastrados no aplicativo.

Campos principais:

- `id`: identificador do usuario.
- `name`: nome do cidadao.
- `email`: email do cidadao.
- `password_hash`: senha armazenada em formato hash para o prototipo.
- `created_at`: data de criacao do cadastro.

### requests

Armazena as solicitacoes de buracos registradas pelo aplicativo.

Campos principais:

- `service_request_id`: protocolo da solicitacao no formato da API.
- `service_code`: codigo do servico urbano.
- `service_name`: nome do servico.
- `status`: status da solicitacao.
- `description`: descricao informada pelo usuario.
- `requested_datetime`: data de abertura da solicitacao.
- `updated_datetime`: data da ultima atualizacao.
- `address`: rua e bairro informados.
- `lat`: latitude da ocorrencia.
- `long`: longitude da ocorrencia.
- `media_url`: URL da foto salva pela API.
- `attributes_json`: dados complementares, como prioridade e ponto de referencia.
- `user_id`: usuario responsavel pelo registro.

### request_history

Armazena o historico de alteracoes de status.

Campos principais:

- `id`: identificador do item de historico.
- `service_request_id`: protocolo relacionado.
- `status`: status registrado.
- `status_notes`: observacao da alteracao.
- `created_at`: data da alteracao.

## 3. API 3111 / Open311

Foi implementada uma API local em Node.js no arquivo:

```text
api3111/server.js
```

Essa API segue uma estrutura REST inspirada no padrao Open311, permitindo cadastro de usuarios, abertura de solicitacoes, listagem de ocorrencias, consulta de detalhes, atualizacao de status e recuperacao do historico.

### 3.1 Endpoints implementados

```text
GET /health.json
```

Verifica se a API esta online e informa os contadores de usuarios e solicitacoes.

```text
GET /services.json
```

Lista o servico disponivel na API, neste caso "Buraco em via publica".

```text
POST /users.json
```

Cria um novo cadastro de cidadao.

```text
POST /sessions.json
```

Realiza login do usuario.

```text
GET /requests.json
```

Lista todas as ocorrencias registradas no banco de dados.

```text
POST /requests.json
```

Registra uma nova ocorrencia de buraco.

```text
GET /requests/:id.json
```

Busca os detalhes de uma ocorrencia especifica.

```text
PATCH /requests/:id.json
```

Atualiza o status de uma ocorrencia.

```text
GET /requests/:id/history.json
```

Lista o historico de alteracoes de uma ocorrencia.

```text
GET /uploads/:filename
```

Exibe uma foto salva pela API.

## 4. Integracao entre aplicativo e API

A integracao do aplicativo com a API foi centralizada no arquivo:

```text
src/open311Api.ts
```

Esse arquivo contem as funcoes responsaveis por:

- Verificar se a API esta disponivel.
- Criar usuario.
- Realizar login.
- Enviar uma nova solicitacao.
- Buscar ocorrencias ja salvas no banco.
- Atualizar status de uma ocorrencia.

O aplicativo utiliza a variavel de ambiente:

```text
EXPO_PUBLIC_OPEN311_API_URL
```

No projeto, essa variavel esta configurada no arquivo `.env`, apontando para o IP do Mac na rede local. Dessa forma, o celular consegue se comunicar com a API que esta rodando no computador.

## 5. Fluxo de funcionamento

O funcionamento completo ocorre da seguinte forma:

1. O usuario abre o aplicativo no celular.
2. O aplicativo verifica se a API 311 esta disponivel.
3. O usuario cria cadastro ou realiza login.
4. O aplicativo solicita permissao para usar a localizacao do aparelho.
5. O usuario seleciona o local do buraco no mapa ou usa a localizacao atual.
6. O usuario preenche rua, bairro, ponto de referencia, descricao e prioridade.
7. O usuario pode tirar uma foto ou anexar uma imagem da galeria.
8. Ao enviar, o aplicativo manda os dados para `POST /requests.json`.
9. A API salva a ocorrencia no banco SQLite.
10. A API salva a foto na pasta `api3111/uploads`.
11. A API retorna um `service_request_id`, que funciona como protocolo.
12. O aplicativo exibe a ocorrencia na lista de protocolos.
13. Quando o status e alterado, o aplicativo chama `PATCH /requests/:id.json`.
14. A API atualiza a ocorrencia e grava um novo registro na tabela `request_history`.

## 6. Armazenamento das fotos

Inicialmente, a foto tirada no celular ficava apenas como caminho local do aparelho, o que impedia sua visualizacao em outro dispositivo. Esse problema foi corrigido.

Atualmente, o aplicativo envia a imagem em base64 para a API. A API salva o arquivo na pasta:

```text
api3111/uploads
```

Depois disso, a API grava no banco uma URL publica dentro da rede local, por exemplo:

```text
http://IP_DO_MAC:3111/uploads/3110002.jpg
```

Assim, a foto enviada pelo celular tambem pode ser exibida em outro dispositivo conectado a mesma API, como o computador.

## 7. Status das solicitacoes

O sistema trabalha com os seguintes status:

| Status no app | Status na API |
| --- | --- |
| Aberto | `open` |
| Em analise | `acknowledged` |
| Em andamento | `in_progress` |
| Concluido | `closed` |
| Cancelado | `canceled` |

Sempre que o status e alterado, a API registra a mudanca no historico, permitindo acompanhar a evolucao da solicitacao.

## 8. Persistencia dos dados

Os dados nao ficam apenas na memoria do aplicativo. Eles sao enviados para a API e persistidos no SQLite. Isso permite que uma ocorrencia criada pelo celular apareca tambem no computador, desde que ambos estejam conectados a mesma API.

Essa persistencia inclui:

- Dados do usuario.
- Dados da ocorrencia.
- Coordenadas geograficas.
- Prioridade e ponto de referencia.
- Foto da ocorrencia.
- Status atual.
- Historico de alteracoes.

## 9. Como executar

Para iniciar a API:

```bash
cd "/Users/davidmendes/Documents/New project/buraco-alerta"
./start-api3111.sh
```

Para iniciar o aplicativo:

```bash
cd "/Users/davidmendes/Documents/New project/buraco-alerta"
./start-expo.sh --clear
```

## 10. Como verificar se gravou no banco

Com a API ligada, rode:

```bash
curl -s http://127.0.0.1:3111/health.json
```

Esse comando mostra quantos usuarios e solicitacoes existem no banco.

Para listar as ocorrencias:

```bash
curl -s http://127.0.0.1:3111/requests.json
```

Se aparecer um item com `service_request_id`, `description`, `lat`, `long`, `user`, `history` e `media_url`, significa que a ocorrencia foi salva corretamente no banco e a foto foi armazenada pela API.

## 11. Resultado da implementacao

Com a implementacao realizada, o projeto passou a contar com uma solucao funcional composta por aplicativo mobile, API REST e banco de dados. O sistema permite registrar buracos em vias publicas, salvar os dados de forma persistente, vincular cada solicitacao a um usuario, armazenar foto da ocorrencia, acompanhar status e manter um historico de alteracoes.

Essa estrutura atende a proposta do trabalho ao utilizar conceitos de participacao cidada, crowdsourcing, geolocalizacao, interoperabilidade baseada em Open311 e gestao digital de solicitacoes urbanas.
