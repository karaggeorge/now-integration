# now-integration

[![npm](https://badgen.net/npm/v/now-integration)](https://www.npmjs.com/package/now-integration) [![install size](https://badgen.net/packagephobia/install/now-integration)](https://packagephobia.now.sh/result?p=now-integration)

A framework that allows better code structure and routing for ZEIT [integrations](https://zeit.co/docs/integrations).<br/>

## Inspiration

After reading the code of a bunch of integrations and trying write some myself, I noticed that the main body of the `withUiHook` handler had a ton of logic and it became hard to read. Also there was logic that was repeated between actions and even between integrations. Therefore, as I was working on my first integration, I started abstacting some of that logic. After seeing how well it worked for me, I decided to make it a package so I can use it to develop future integration.

NOTE: This is very much WIP. I started developing it during the [ZEIT Hackathon](https://zeit.co/hackathon), so I had limited time. There's full TypeScript support but cleaner code and better docs coming soon

## Install

```
$ yarn add now-integration
```

or

```
$ npm install now-integration
```

## Usage

The main part of the package is the `Integration` class. This class is the backbone of the application.

```js
import Integration, {requireProject} from 'now-integration';
import {htm} from '@zeit/integration-utils';

const app = new Integration({
  defaultRoute: ({utils}) => htm`<Page>You are logged in! Your token is ${utils.projectStore.token}</Page>`
});

app.extend(requireProject());

app.use('login/:method', async ({utils, zeitClient, payload}, next) => {
  if (utils.params.method === 'token') {
    const token = utils.get('token');

    utils.projectStore.token = token;
    await utils.saveStore();

    next();
  } else {
    // Login some other way
  }
});

app.use(async ({utils}, next) => {
  if (utils.projectStore.token) {
    next();
  } else {
    return utils.renderRoute('view/login');
  }
});

app.render('view/login', async ({payload, zeitClient, utils}) => {
  return htm`
    <Page>
      <H2>Please login to continue</H2>
      <Input name="token" label="token"/>
      <Button action="login/token">Save Token</Button>
    </Page>
  `;
});

export default app.handler;
```

## API

#### new Integration(options)

##### options
Type: `object`

###### defaultRoute
Type: `[handler](#handler)`

A handler that will be called if no other route matches. Can be used as the default `view` route.

#### integration.use([pattern], ...handlers)

Adds middleware handler(s) to be ran. These usually don't end the call, but handle actions and provide context. If needed they can intercept the flow and end the call.

##### pattern
Type: `string | string[]` _Optional_

A pattern or a list of patterns to match against the `action` string. The handler(s) will only be called if at least one pattern matches.

If the pattern includes a parameter `login/:method`, the parameters will be included in the [utils](#utils) object under [params](#params)

If no pattern is provided, the handler(s) will be called on every action

##### handlers
Type: `[handler](#handler)`

The handler(s) that will be called.

The middleware handlers receive an extra parameter `next`, which they can call to pass the rendering to the next handler. If the handler needs to stop the flow, it can return the `htm` element instead of calling `next()`. That will end the call without any other handler being called.

#### integration.render(pattern, ...handlers)

Adds view handlers. These handlers need to return a valid `htm` element. That element will be returned from the call.

##### pattern
Type: `string | string[]`

A pattern or a list of patterns to match against the `action` string. The handler(s) will only be called if at least one pattern matches.

If the pattern includes a parameter `login/:method`, the parameters will be included in the [utils](#utils) object under [params](#params)

**Note:** at least one pattern is required for these handlers

##### handlers
Type: `[handler](#handler)`

The handler(s) that will be called.

Unlike middleware handlers, these handlers have to returna valid `htm` element that will be return from to the UI hook.

#### integration.extend(plugin)

Extend the funcionality of the integration by adding a plugin. All this does is group some middleware and view handlers based on the purpose they serve for cleaner code

##### plugin
Type: `(app: Integration) => void`

A function that will be called with the integration instance. In this function, the plugin can add middleware or view handlers.

#### integration.handler
Type: `(req, res) => void`

This is a regular http server handler that can be exported from the main file. It includes the `withUiHook` helper provided by [@zeit/integration-utils](https://github.com/zeit/)integration-utils).

<br/>

#### handler
Type: `(options) => Promise<any>`

A handler that returns a valid `htm` element

Middleware handlers receive an extra parameter `next` that they can call instead of returning a value: `(options, next) => Promise<any | void>`

Handlers are called in the order they were added. First all the middleware ones and then the view ones until one matches. Be mindful about the order in which you add them.

##### optons
Type: `object`

###### zeitClient
Type: `ZeitClient`

The client provided by `withUiHook` of [@zeit/integration-utils](https://github.com/zeit/)

###### payload
Type: `object`

The payload provided by `withUiHook` of [@zeit/integration-utils](https://github.com/zeit/)

###### utils
Type: `[utils](#utils)`

A class with various utilities described below


#### utils

The `utils` class available to every handler

##### utils.context
Type: `object`

An object that starts empty at the start of the call and will be passed to every handler

Can be used to pass information downstream

##### utils.params
Type: `object` _Optional_

An object that contains key/value pairs for all params matched in the handler's pattern

For example an `action` `view/login/token` matched by the pattern `view/login/:method` would yield:

```js
console.log(utils.params);

// => {method: 'token'}
```

##### utils.renderRoute
Type: `(route) => Promise<any>`

A method that will render the provided route and return the result. This can be used when handlers want to terminate the flow early or redirect it:

```js
if (!token) {
  return utils.renderRoute('login');
} else {
  // Render the regular view
  next();
}
```

###### route
Type: `string`

The exact route to render

**Note:** The route will try to match a view handler exactly. Won't match middleware handlers

##### utils.store
Type: `object`

The result of `await zeitClient.getMetadata()`.
Will be passed to every handler

##### utils.projectStore
Type: `object`

Equivalent to `store[projectId]`.
A convenient way to save project-scoped data

##### utils.saveStore
Type: `() => Promise<object>`

Equivalent of calling `await zeitClient.saveMetadata(utils.store)`
There is no need to set the result of the call back to the store

```js
utils.store.token = 'my-token';
utils.projectStore.token = 'my-project-token';
await utils.saveStore();

// ...
```

##### utils.get
Type: `(key) => string`

Equivalent to `payload.clientState[key]`

##### utils.projectId
Type: `string` _Optional_

Equivalent to `payload.projectId`

##### utils.action
Type: `string`

Equivalent to `payload.action`



The package also includes two plugins for very common functionalities:

#### requireProject([options])

```js
  import Integration, {requireProject} from 'now-integration';

  const app = new Integration({defaultRoute});

  app.extend(requireProject());

  export default app.handler;
```

Adds middleware that will ensure the integration is scoped to a project. If it is not, it will render a view including a project switcher.

##### options
Type: `object` _Optional_

###### SwitchProjectView
Type: `htm Component`

View to render when the user is not scoped to a project instead of the default one

Takes no props

#### requireTokenLogin([options])

```js
  import Integration, {requireTokenLogin} from 'now-integration';

  const app = new Integration({defaultRoute});

  app.extend(requireTokenLogin({
    projectScoped: true,
    tokens: [{
      key: 'appKey',
      name: 'You application key'
    }, {
      key: 'appSecret',
      name: 'Your application secret'
    }],
    testTokens: async (tokens) => {
      try {
        await myClient.ensureValidTokens(tokens.appKey, tokens.appSecret);
        return false;
      } catch (error) {
        return 'Something went wrong';
      }
    }
  }));

  export default app.handler;
```

Adds middleware that will ensure the user has logged in by providing some token(s) before letting them access any of the routes.

##### options
Type: `object` _Optional_

###### projectScoped
Type: `boolean`
Default: `false`

Wether or not the plugin should require a different token for each project.

Usually used together with `[requireProject](#requireProject)`

##### tokens
Type: `{ key: string, name: string }[]`
Default: `[{ key: 'token', name: 'API Token' }]`

A list of tokens to request from the user

###### key
Type: `string`

The key to use when saving the token in the store

###### name
Type: `string`

The label to display for the `<Input/>` element when requesting the token

##### testTokens
Type: `(tokens) => Promise<false | string>`
Default: `() => false`

A function that will be called with the tokens when the user submits the form.

It should return `false` if the tokens are valid, or a `string` with a message to be displayed to the user when asking for the tokens again.

The tokens will not be saved until `testTokens` returns `false`

###### tokens
Type: `{[key: string]: string}`

An object containing all the tokens. The keys used are the ones provided in the `[tokens](#tokens)` object and the values are the user's inputs

##### LoginView
Type: `htm Component`

View to render if the user doesn't have all the required tokens instead of the default one.

###### props

- `error` (`string`) - An error message
- `message` (`string`) - A informational message (`You have logged out successfully` when the user logs out)
- `title` (`string`) - A title to appear above the form
- `tokens` (`object`) - The tokens to display

#### Actions
This plugin provides the following action:

`logout` - Use this to erase the user's token and bring them back to the login screen

```js
htm`<Button action="logout">Logout</Button>`
```

## Maintainers
- [George Karagkiaouris](https://github.com/karaggeorge)
