import {htm} from '@zeit/integration-utils';
import Integration from './integration';

export interface Token {
  key: string;
  name: string;
}

export interface RequireTokenOptions {
  projectScoped?: boolean,
  tokens?: Token[],
  testTokens?: (tokens: {[key: string]: string}) => Promise<string | false> | string | false;
  LoginView?: (props: LoginViewProps) => any
}

export interface LoginViewProps {
  error?: string,
  message?: string,
  tokens?: (Token & {value: string})[]
}

export const DefaultLoginView = ({
  error = '',
  message = '',
  tokens = []
}: LoginViewProps) => htm`
  <Page>
    <Box>${message}</Box>
    <Fieldset>
      <FsContent>
        <FsSubtitle>Please enter the following information</FsSubtitle>
        ${
          tokens.map(token => htm`
            <Input label=${token.name} name=${token.key} width="100%" value=${token.value || ''} />
          `)
        }
      </FsContent>
      <FsFooter>
        <Box width="100%" display="flex" justifyContent="space-between">
          <Box>${error}</Box>
          <Button small action="setToken">Connect</Button>
        </Box>
      </FsFooter>
    </Fieldset>
  </Page>
`;

export const requireTokenLogin = ({
  projectScoped = false,
  tokens = [],
  testTokens = () => false,
  LoginView = DefaultLoginView
}: RequireTokenOptions = {}) => (app: Integration) => {
  if (tokens.length === 0) {
    tokens.push({
      key: 'token',
      name: 'API Token',
    });
  }

  app.use('setToken', async ({utils}, next) => {
    const tokensWithValues = tokens.map(token => ({...token, value: utils.get(token.key)}));

    if (tokensWithValues.some(token => !token.value)) {
      return htm`<${LoginView} error="All fields are required" tokens=${tokensWithValues}/>`
    }

    const error = await testTokens(tokensWithValues.reduce((acc, token) => ({...acc, [token.key]: token.value}), {}));

    if (error) {
      return htm`<${LoginView} error=${error} tokens=${tokensWithValues}/>`;
    }

    for (const token of tokensWithValues) {
      if (projectScoped && utils.projectStore) {
        utils.projectStore[token.key] = token.value;
      } else {
        utils.store[token.key] = token.value;
      }
    }

    await utils.saveStore();

    next();
  });

  app.use('logout', async ({utils}) => {
    for (const token of tokens) {
      if (projectScoped && utils.projectStore) {
        delete utils.projectStore[token.key];
      } else {
        delete utils.store[token.key];
      }
    }

    await utils.saveStore();

    return htm`<${LoginView} message="You have logged out successfully"/>`;
  });

  app.use(async ({utils}, next) => {
    const tokenStore = projectScoped ? utils.projectStore : utils.store;

    if (tokenStore && tokens.every(token => Boolean(tokenStore[token.key]))) {
      next();
    } else {
      return htm`<${LoginView} tokens=${tokens}/>`;
    }
  });
};
