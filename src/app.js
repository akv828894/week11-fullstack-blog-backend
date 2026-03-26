const express = require('express');
const cors = require('cors');
const {
  listUsers,
  createUser,
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  listRecentPosts,
} = require('./data/blogStore');
const requestLogger = require('./middleware/requestLogger');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildValidationError(message, details) {
  return details?.length ? { message, details } : { message };
}

function asyncRoute(handler) {
  return function wrappedRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function validateUserCreation(body = {}) {
  const details = [];

  if (!isNonEmptyString(body.name)) {
    details.push('name is required');
  }

  if (body.email !== undefined && !isNonEmptyString(body.email)) {
    details.push('email must be a non-empty string when provided');
  }

  return details;
}

function validatePostCreation(body = {}) {
  const details = [];

  if (!isNonEmptyString(body.title)) {
    details.push('title is required');
  }

  if (!isNonEmptyString(body.content)) {
    details.push('content is required');
  }

  if (body.author !== undefined && !isNonEmptyString(body.author)) {
    details.push('author must be a non-empty string when provided');
  }

  if (body.authorId !== undefined && !isNonEmptyString(body.authorId)) {
    details.push('authorId must be a non-empty string when provided');
  }

  return details;
}

function validatePostUpdate(body = {}) {
  const details = [];
  const allowedFields = ['title', 'content', 'author', 'authorId'];
  const providedFields = Object.keys(body);
  const unexpectedFields = providedFields.filter((field) => !allowedFields.includes(field));

  if (providedFields.length === 0) {
    details.push('at least one field is required');
    return details;
  }

  if (unexpectedFields.length > 0) {
    details.push(`unknown fields: ${unexpectedFields.join(', ')}`);
  }

  if (body.title !== undefined && !isNonEmptyString(body.title)) {
    details.push('title must be a non-empty string');
  }

  if (body.content !== undefined && !isNonEmptyString(body.content)) {
    details.push('content must be a non-empty string');
  }

  if (body.author !== undefined && !isNonEmptyString(body.author)) {
    details.push('author must be a non-empty string');
  }

  if (body.authorId !== undefined && !isNonEmptyString(body.authorId)) {
    details.push('authorId must be a non-empty string');
  }

  return details;
}

function createMockToken(username) {
  const payload = {
    sub: username,
    scope: 'intern',
    issuedAt: Date.now(),
  };

  return `mock-jwt.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

app.get('/', (req, res) => {
  res.status(200).json({
    project: 'Week 11 Fullstack Blog API',
    status: 'running',
    endpoints: [
      'GET /users',
      'POST /users',
      'GET /posts',
      'GET /posts/recent/top-3',
      'GET /posts/:id',
      'POST /posts',
      'PUT /posts/:id',
      'DELETE /posts/:id',
      'POST /login',
    ],
  });
});

app.get(
  '/users',
  asyncRoute(async (req, res) => {
    const users = await listUsers();

    res.status(200).json({
      count: users.length,
      data: users,
    });
  }),
);

app.post(
  '/users',
  asyncRoute(async (req, res) => {
    const payload = req.body ?? {};
    const validationErrors = validateUserCreation(payload);

    if (validationErrors.length > 0) {
      return res.status(400).json(buildValidationError('Unable to create user', validationErrors));
    }

    const user = await createUser(payload);

    return res.status(201).json({
      message: 'User created successfully',
      data: user,
    });
  }),
);

app.get(
  '/posts/recent/top-3',
  asyncRoute(async (req, res) => {
    const posts = await listRecentPosts(3);

    res.status(200).json({
      count: posts.length,
      data: posts,
    });
  }),
);

app.get(
  '/posts',
  asyncRoute(async (req, res) => {
    const posts = await listPosts();

    res.status(200).json({
      count: posts.length,
      data: posts,
    });
  }),
);

app.get(
  '/posts/:id',
  asyncRoute(async (req, res) => {
    const post = await getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.status(200).json({ data: post });
  }),
);

app.post(
  '/posts',
  asyncRoute(async (req, res) => {
    const payload = req.body ?? {};
    const validationErrors = validatePostCreation(payload);

    if (validationErrors.length > 0) {
      return res.status(400).json(buildValidationError('Unable to create post', validationErrors));
    }

    const post = await createPost(payload);

    return res.status(201).json({
      message: 'Post created successfully',
      data: post,
    });
  }),
);

app.put(
  '/posts/:id',
  asyncRoute(async (req, res) => {
    const payload = req.body ?? {};
    const validationErrors = validatePostUpdate(payload);

    if (validationErrors.length > 0) {
      return res.status(400).json(buildValidationError('Unable to update post', validationErrors));
    }

    const post = await updatePost(req.params.id, payload);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.status(200).json({
      message: 'Post updated successfully',
      data: post,
    });
  }),
);

app.delete(
  '/posts/:id',
  asyncRoute(async (req, res) => {
    const deletedPost = await deletePost(req.params.id);

    if (!deletedPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.status(200).json({
      message: 'Post deleted successfully',
      data: deletedPost,
    });
  }),
);

app.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const details = [];

  if (!isNonEmptyString(username)) {
    details.push('username is required');
  }

  if (!isNonEmptyString(password)) {
    details.push('password is required');
  }

  if (details.length > 0) {
    return res.status(400).json(buildValidationError('Login failed', details));
  }

  return res.status(200).json({
    message: 'Login successful',
    token: createMockToken(username.trim()),
    user: {
      username: username.trim(),
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  if (err.status) {
    return res.status(err.status).json(buildValidationError(err.message, err.details));
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value detected' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
