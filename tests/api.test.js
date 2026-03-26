const assert = require('node:assert/strict');
process.env.DATA_STORE_MODE = 'memory';

const app = require('../src/app');
const {
  initializeDataStore,
  closeDataStore,
  resetPosts,
} = require('../src/data/blogStore');

let server;
let baseUrl;

async function startServer() {
  await initializeDataStore();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

async function stopServer() {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await closeDataStore();
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const json = await response.json();

  return {
    response,
    json,
  };
}

async function pause(milliseconds) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const checks = [
  {
    name: 'GET /posts returns an empty collection at startup',
    run: async () => {
      const { response, json } = await request('/posts');

      assert.equal(response.status, 200);
      assert.equal(json.count, 0);
      assert.deepEqual(json.data, []);
    },
  },
  {
    name: 'GET /posts includes CORS headers for frontend requests',
    run: async () => {
      const response = await fetch(`${baseUrl}/posts`, {
        headers: {
          Origin: 'http://localhost:5173',
        },
      });
      const json = await response.json();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      assert.equal(json.count, 0);
    },
  },
  {
    name: 'POST /posts creates a new post and GET /posts/:id returns it',
    run: async () => {
      const createResult = await request('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Build The API',
          content: 'Express routes are working correctly.',
          author: 'Aman',
        }),
      });

      assert.equal(createResult.response.status, 201);
      assert.equal(createResult.json.data.title, 'Build The API');

      const postId = createResult.json.data.id;
      const fetchResult = await request(`/posts/${postId}`);

      assert.equal(fetchResult.response.status, 200);
      assert.equal(fetchResult.json.data.id, postId);
      assert.equal(fetchResult.json.data.author, 'Aman');
    },
  },
  {
    name: 'POST /users creates a user and authorId links a post to that user',
    run: async () => {
      const userResult = await request('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Nakul',
          email: 'nakul@example.com',
        }),
      });

      assert.equal(userResult.response.status, 201);

      const createPostResult = await request('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Mongo Relationships',
          content: 'Posts should reference users.',
          authorId: userResult.json.data.id,
        }),
      });

      assert.equal(createPostResult.response.status, 201);
      assert.equal(createPostResult.json.data.author, 'Nakul');
      assert.equal(createPostResult.json.data.authorId, userResult.json.data.id);
      assert.equal(createPostResult.json.data.authorDetails.email, 'nakul@example.com');
    },
  },
  {
    name: 'PUT /posts/:id updates an existing post',
    run: async () => {
      const createResult = await request('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'First Draft',
          content: 'Original content',
          author: 'Intern',
        }),
      });

      const updateResult = await request(`/posts/${createResult.json.data.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Final Draft',
          content: 'Updated content',
        }),
      });

      assert.equal(updateResult.response.status, 200);
      assert.equal(updateResult.json.data.title, 'Final Draft');
      assert.equal(updateResult.json.data.content, 'Updated content');
      assert.equal(updateResult.json.data.author, 'Intern');
    },
  },
  {
    name: 'GET /posts/recent/top-3 returns the newest three posts',
    run: async () => {
      const titles = ['First', 'Second', 'Third', 'Fourth'];

      for (const title of titles) {
        await request('/posts', {
          method: 'POST',
          body: JSON.stringify({
            title,
            content: `${title} content`,
            author: 'Timeline Tester',
          }),
        });

        await pause(5);
      }

      const { response, json } = await request('/posts/recent/top-3');

      assert.equal(response.status, 200);
      assert.equal(json.count, 3);
      assert.deepEqual(
        json.data.map((post) => post.title),
        ['Fourth', 'Third', 'Second'],
      );
    },
  },
  {
    name: 'DELETE /posts/:id removes the post from the store',
    run: async () => {
      const createResult = await request('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Delete Me',
          content: 'This post should be removed.',
          author: 'Cleaner',
        }),
      });

      const deleteResult = await request(`/posts/${createResult.json.data.id}`, {
        method: 'DELETE',
      });

      assert.equal(deleteResult.response.status, 200);
      assert.equal(deleteResult.json.message, 'Post deleted successfully');

      const fetchResult = await request('/posts');

      assert.equal(fetchResult.json.count, 0);
    },
  },
  {
    name: 'POST /login returns a mock token for valid credentials',
    run: async () => {
      const { response, json } = await request('/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'aman.dev',
          password: 'secure-password',
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(json.message, 'Login successful');
      assert.match(json.token, /^mock-jwt\..+\.signature$/);
      assert.equal(json.user.username, 'aman.dev');
    },
  },
  {
    name: 'GET /posts/:id returns 404 for an unknown post',
    run: async () => {
      const { response, json } = await request('/posts/missing-post-id');

      assert.equal(response.status, 404);
      assert.equal(json.message, 'Post not found');
    },
  },
  {
    name: 'POST /posts rejects invalid payloads',
    run: async () => {
      const { response, json } = await request('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: '',
          content: '',
        }),
      });

      assert.equal(response.status, 400);
      assert.equal(json.message, 'Unable to create post');
      assert.deepEqual(json.details, ['title is required', 'content is required']);
    },
  },
  {
    name: 'PUT /posts/:id rejects an empty update payload',
    run: async () => {
      const createResult = await request('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Needs Update',
          content: 'This post exists before the update check.',
          author: 'Verifier',
        }),
      });

      const { response, json } = await request(`/posts/${createResult.json.data.id}`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 400);
      assert.equal(json.message, 'Unable to update post');
      assert.deepEqual(json.details, ['at least one field is required']);
    },
  },
  {
    name: 'POST /posts rejects malformed JSON',
    run: async () => {
      const response = await fetch(`${baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"title":"Broken JSON"',
      });
      const json = await response.json();

      assert.equal(response.status, 400);
      assert.equal(json.message, 'Invalid JSON payload');
    },
  },
];

async function main() {
  let failures = 0;

  await startServer();

  for (const check of checks) {
    await resetPosts();

    try {
      await check.run();
      console.log(`PASS ${check.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${check.name}`);
      console.error(error);
    }
  }

  await stopServer();

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`All ${checks.length} API checks passed.`);
}

main().catch((error) => {
  console.error('Test runner crashed.');
  console.error(error);
  process.exitCode = 1;
});
