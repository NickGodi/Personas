# Cadastro compartilhado e publicação

## Supabase Auth e perfis

1. Crie um projeto Supabase e rode `supabase/schema.sql` no SQL Editor.
2. Antes de abrir o cadastro, configure o e-mail do criador na tabela privada:

   ```sql
   update private.site_settings
   set creator_email = lower('SEU_EMAIL_DE_LOGIN'), creator_handle = '@nick'
   where singleton = true;
   ```

   O cadastro feito com esse e-mail e `@nick` recebe o cargo de criador. Os demais recebem o cargo de jogador. Os `@` e Riot IDs iniciais ficam reservados para impedir que alguém assuma um perfil já existente.

3. Em **Authentication → URL Configuration**, configure o endereço público do site como Site URL e adicione também `http://localhost:3000` e a URL de produção na lista de Redirect URLs.
4. Configure na Vercel as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` usando a URL do projeto e a chave pública anon/publishable. Nunca coloque a chave `service_role` no front-end.
5. As contas são criadas pelo Supabase Auth. Quando a confirmação de e-mail estiver ativa, a pessoa confirma o endereço e depois entra no site. O e-mail não é publicado nos perfis.

Para desenvolvimento local, copie `.env.example` para `.env.local` e preencha as mesmas duas variáveis.

## Estado do torneio

O cadastro e a lista de perfis são compartilhados via Supabase. O estado de partidas e temporadas ainda usa a API Express/arquivo local do modo de desenvolvimento. Antes de operar um torneio em produção na Vercel, esse estado também precisa ser migrado para armazenamento persistente compartilhado.

