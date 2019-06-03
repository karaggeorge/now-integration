# now-integration

[![npm](https://badgen.net/npm/v/now-integration)](https://www.npmjs.com/package/now-integration) [![install size](https://badgen.net/packagephobia/install/now-integration)](https://packagephobia.now.sh/result?p=now-integration)

A simple framework to simplify writting ZEIT [integrations](https://zeit.co/docs/integrations).<br/>

I found myself using the same logic between integrations, along with having a ton of information and logic in that one `withUIHook` call. So, I created a small framework to help with some of the routing/actions

This is very much WIP. I use it in a few personal projects. Feel free to submit Issues/PRs if anything doesn't work as expected or if you have other ideas to expand it

## Install

```
yarn add now-integration
```

## Usage

The most basic usage is as follows:

```js
import Integration from 'now-integration';
import {htm} from '@zeit/integration-utils';

const app = new Integration({defaultRoute: htm`<Page>My Main Page</Page>`});

export default app.handler;
```

`defaultRoute` is the default `htm` element that will be returned for every route that doesn't match. Think about it as your main view (when `action` is `view`)

#### Adding routes

```js
app.render('login', async ({payload, zeitClient, utils}) => { ... });
```

The route will match against the `action` field of the `payload`

Every handler will receive the same payload as `withUIHook` along with an extra `utils` object which is described below

These routes should return a `htm` element that will be returned from the call

### Adding middleware

```js
app.use(({payload, zeitClient}, next) => {
  zeitClient.doSomething();
  next();
});

// or

app.use('action', handler);
```

The route will match against the `action` field of the `payload`. If no route is provided, the middleware will run for every route.

This is similar to the routes above, however it doesn't have to return a markup at the end. It can call `next` which will keep the logic going.

If for some reason you want to stop there and end the call, you can return a `htm` element.

These are most often used to perform calls for specific actions, add context for subsequent handlers or stop flow and render something different (like a login page if there is no token yet)

### Using extensions

```js
import requireProject from './require-project';

app.extend(requireProject());
```

You can write small extensions for behavior that you use very often. `app.extend` expects a function that it will call with the `app` instance. The function can add routes or middlewares.

Two such extensions are included in the package:

- `requireProject`
Renders a project switcher and asks the user to select a project before they proceed to any views
- `requireTokenLogin`
Will render a page asking for a token instead of any views until the user provides one

Both of these accept a couple of options. You can look in the files to see how they work. Documentation for them coming soon.
