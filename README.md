# Olho na Via

Aplicativo mobile em React Native + Expo para registro colaborativo de buracos em vias publicas. O prototipo usa mapa, GPS em tempo real, foto da ocorrencia, cadastro/login, lista de protocolos, alteracao de status, historico e uma API local compatível com o fluxo do padrao Open311.

## O que existe no projeto

- App mobile em React Native + Expo.
- Mapa na primeira tela para selecionar o local do buraco.
- Uso da localizacao atual do celular.
- Registro de ocorrencia com descricao, endereco, bairro, referencia, prioridade e coordenadas.
- Foto tirada pela camera ou anexada da galeria.
- Lista de buracos/protocolos cadastrados.
- Tela de detalhes com status e historico.
- Cadastro e login de cidadao.
- API local na porta `3111`.
- Banco SQLite criado automaticamente pela API.
- Upload e exibicao de fotos salvas pela API.
- Documentacao tecnica em `docs/`.

## Requisitos

Antes de baixar o projeto, instale:

- Git: https://git-scm.com/downloads
- Node.js 22 ou superior: https://nodejs.org/en/download
- VS Code: https://code.visualstudio.com/
- Expo Go no celular:
  - iPhone: App Store
  - Android: Google Play

Depois de instalar o Node.js, feche e abra o Terminal novamente e teste:

```bash
node -v
npm -v
npx -v
```

## Como baixar o projeto em outra maquina

Substitua `URL_DO_REPOSITORIO` pela URL do GitHub do projeto.

```bash
cd ~/Documents
git clone URL_DO_REPOSITORIO
cd buraco-alerta
npm install
```

Para abrir no VS Code:

```bash
code .
```

Se o comando `code .` nao funcionar, abra o VS Code manualmente e use `File > Open Folder`.

## Como configurar a API no celular

O app precisa saber o IP do computador que esta rodando a API. No Mac, descubra o IP da rede Wi-Fi:

```bash
ipconfig getifaddr en0
```

Se nao aparecer nada, tente:

```bash
ipconfig getifaddr en1
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Abra o arquivo `.env` e coloque o IP do computador:

```bash
EXPO_PUBLIC_OPEN311_API_URL=http://SEU_IP_DO_COMPUTADOR:3111
```

Exemplo:

```bash
EXPO_PUBLIC_OPEN311_API_URL=http://192.168.100.246:3111
```

Importante: o celular e o computador precisam estar na mesma rede Wi-Fi.

## Como rodar a API

Abra um Terminal dentro da pasta do projeto:

```bash
cd ~/Documents/buraco-alerta
./start-api3111.sh
```

Se preferir rodar manualmente:

```bash
node api3111/server.js
```

A API ficara disponivel em:

```text
http://SEU_IP_DO_COMPUTADOR:3111
```

Para testar:

```bash
curl -s http://127.0.0.1:3111/health.json
```

Ou abra no navegador do celular:

```text
http://SEU_IP_DO_COMPUTADOR:3111/health.json
```

## Como rodar o aplicativo

Abra outro Terminal dentro da pasta do projeto:

```bash
cd ~/Documents/buraco-alerta
./start-expo.sh --clear
```

Se preferir rodar manualmente:

```bash
npm start -- --clear
```

Depois, escaneie o QR Code com o app Expo Go.

## Banco de dados

A API cria o banco automaticamente quando ela inicia. O arquivo fica em:

```text
api3111/open311.db
```

As fotos enviadas pelo app ficam em:

```text
api3111/uploads
```

Esses arquivos sao locais e nao devem ser enviados ao GitHub. Cada maquina cria seu proprio banco ao iniciar a API.

Para confirmar se uma ocorrencia foi gravada:

```bash
curl -s http://127.0.0.1:3111/requests.json
```

Se aparecer um item com `service_request_id`, `description`, `lat`, `long`, `status`, `history` e `media_url`, a ocorrencia foi salva corretamente.

## Endpoints da API local

- `GET /health.json`
- `GET /services.json`
- `GET /requests.json`
- `POST /requests.json`
- `GET /requests/:service_request_id.json`
- `PATCH /requests/:service_request_id.json`
- `GET /requests/:service_request_id/history.json`
- `GET /uploads/:filename`
- `POST /users.json`
- `POST /sessions.json`

## Observacao sobre Open311

O Open311 e um padrao aberto de interoperabilidade, nao uma API unica centralizada. Como nao foi localizada uma API Open311 publica oficial da Prefeitura de Belo Horizonte, este projeto usa uma API local propria, inspirada no fluxo Open311/GeoReport, preparada para futura adaptacao caso uma prefeitura forneca URL, API key e `service_code`.

## Problemas comuns

Se o celular mostrar modo local ou nao carregar dados da API:

1. Confira se a API esta ligada.
2. Confira se o IP no `.env` e o IP atual do computador.
3. Abra `http://SEU_IP_DO_COMPUTADOR:3111/health.json` no navegador do celular.
4. Reinicie o Expo com cache limpo:

```bash
./start-expo.sh --clear
```

Se aparecer erro de versao do Expo Go:

1. Atualize o Expo Go pela loja do celular.
2. Rode novamente:

```bash
npm install
./start-expo.sh --clear
```

## Documentacao do projeto

- `docs/modelagem-banco-api.md`: modelagem do banco SQLite e endpoints.
- `docs/relatorio-implementacao.md`: relatorio do que foi implementado na parte pratica.
