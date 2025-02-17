import axios from 'axios';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createSchema, createYoga } from 'graphql-yoga';
// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { useHive } from '../src/yoga.js';

beforeAll(() => {
  nock.cleanAll();
});

it('reports usage', async () => {
  const graphqlScope = nock('http://localhost')
    .post('/graphql')
    .reply(200, {
      data: {
        __typename: 'Query',
        tokenInfo: {
          __typename: 'TokenInfo',
          token: {
            name: 'brrrt',
          },
          organization: {
            name: 'mom',
            cleanId: 'ur-mom',
          },
          project: {
            name: 'projecto',
            type: 'FEDERATION',
            cleanId: 'projecto',
          },
          target: {
            name: 'projecto',
            cleanId: 'projecto',
          },
          canReportSchema: true,
          canCollectUsage: true,
          canReadOperations: true,
        },
      },
    })
    .post('/usage', body => {
      expect(body.map).toMatchInlineSnapshot(`
        {
          0063ba7bf2695b896c464057aef29cdc: {
            fields: [
              Query.hi,
            ],
            operation: {hi},
            operationName: anonymous,
          },
        }
      `);

      return true;
    })
    .reply(200);
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useHive({
        enabled: true,
        debug: true,
        token: 'brrrt',
        selfHosting: {
          applicationUrl: 'http://localhost/foo',
          graphqlEndpoint: 'http://localhost/graphql',
          usageEndpoint: 'http://localhost/usage',
        },
        usage: {
          endpoint: 'http://localhost/usage',
          clientInfo() {
            return {
              name: 'brrr',
              version: '1',
            };
          },
        },
        agent: {
          maxSize: 1,
        },
      }),
    ],
  });

  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async resolve => {
    const res = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{ hi }`,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toMatchInlineSnapshot('{"data":{"hi":null}}');

    setTimeout(() => {
      graphqlScope.done();
      resolve();
    }, 1000);
  });
});

it('reports usage with response cache', async () => {
  axios.interceptors.request.use(config => {
    console.log(config.url);
    return config;
  });
  let usageCount = 0;
  const graphqlScope = nock('http://localhost')
    .post('/graphql')
    .reply(200, {
      data: {
        __typename: 'Query',
        tokenInfo: {
          __typename: 'TokenInfo',
          token: {
            name: 'brrrt',
          },
          organization: {
            name: 'mom',
            cleanId: 'ur-mom',
          },
          project: {
            name: 'projecto',
            type: 'FEDERATION',
            cleanId: 'projecto',
          },
          target: {
            name: 'projecto',
            cleanId: 'projecto',
          },
          canReportSchema: true,
          canCollectUsage: true,
          canReadOperations: true,
        },
      },
    })
    .post('/usage', body => {
      usageCount++;
      expect(body.map).toMatchInlineSnapshot(`
        {
          a34a5dbc613e150fe56a725d23879557: {
            fields: [
              Query.__typename,
              Query.hi,
            ],
            operation: {__typename hi},
            operationName: anonymous,
          },
        }
      `);

      return true;
    })
    .thrice()
    .reply(200);
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          hi: String
        }
      `,
    }),
    plugins: [
      useResponseCache({
        session: () => null,
        ttl: Infinity,
      }),
      useHive({
        enabled: true,
        debug: true,
        token: 'brrrt',
        selfHosting: {
          applicationUrl: 'http://localhost/foo',
          graphqlEndpoint: 'http://localhost/graphql',
          usageEndpoint: 'http://localhost/usage',
        },
        usage: {
          endpoint: 'http://localhost/usage',
          clientInfo() {
            return {
              name: 'brrr',
              version: '1',
            };
          },
        },
        agent: {
          maxSize: 1,
        },
      }),
    ],
  });
  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async resolve => {
    for (const _ of [1, 2, 3]) {
      const res = await yoga.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{ hi }`,
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toEqual('{"data":{"hi":null}}');
    }

    setTimeout(() => {
      graphqlScope.done();
      expect(usageCount).toEqual(3);
      resolve();
    }, 1000);
  });
});
