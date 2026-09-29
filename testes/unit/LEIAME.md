# Testes unitários

Testam as regras de negócio do sistema (js/) sem navegador, sem internet e sem banco de dados,
com o executor de testes que já vem no Node (versão 20 ou mais nova). Não há dependência para instalar.

    npm test                 # roda todos os testes
    npm run test:cobertura   # roda e mostra a cobertura por arquivo

`ambiente.js` cria um navegador falso e vazio para cada teste (localStorage, document, FormData e
IndexedDB substituídos), então um teste nunca depende de outro. O modo demonstração (js/api-demo.js)
é testado como o espelho das regras do banco; as regras do banco em si têm os testes de supabase/tests.
