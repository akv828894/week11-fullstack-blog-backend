const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { connectToDatabase, disconnectDatabase } = require('../lib/database');
const Post = require('../models/Post');
const User = require('../models/User');

const STORE_MODE = {
  MEMORY: 'memory',
  MONGO: 'mongo',
};

let activeMode = null;
let memoryPosts = [];
let memoryUsers = [];

function normalizeStoreMode(mode) {
  return String(mode || '').trim().toLowerCase() === STORE_MODE.MONGO
    ? STORE_MODE.MONGO
    : STORE_MODE.MEMORY;
}

function getStoreMode() {
  if (activeMode) {
    return activeMode;
  }

  if (process.env.DATA_STORE_MODE) {
    return normalizeStoreMode(process.env.DATA_STORE_MODE);
  }

  return process.env.MONGO_URI ? STORE_MODE.MONGO : STORE_MODE.MEMORY;
}

function createStoreError(status, message, details = []) {
  const error = new Error(message);
  error.status = status;

  if (details.length > 0) {
    error.details = details;
  }

  return error;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id || user._id?.toString() || null,
    name: user.name,
    email: user.email || null,
    createdAt: toIsoString(user.createdAt),
  };
}

function extractAuthorId(post) {
  if (!post?.authorId) {
    return null;
  }

  if (typeof post.authorId === 'string') {
    return post.authorId;
  }

  if (post.authorId._id) {
    return post.authorId._id.toString();
  }

  if (typeof post.authorId.toString === 'function') {
    return post.authorId.toString();
  }

  return null;
}

function formatPost(post) {
  if (!post) {
    return null;
  }

  const authorRecord =
    post.authorId && typeof post.authorId === 'object' && ('name' in post.authorId || post.authorId._id)
      ? post.authorId
      : null;
  const authorDetails = formatUser(authorRecord);

  return {
    id: post.id || post._id?.toString() || null,
    title: post.title,
    content: post.content,
    author: authorDetails?.name || post.authorName || 'Anonymous',
    authorId: authorDetails?.id || post.authorIdString || extractAuthorId(post),
    authorDetails,
    createdAt: toIsoString(post.createdAt),
    updatedAt: toIsoString(post.updatedAt),
  };
}

function findMemoryUserById(userId) {
  return memoryUsers.find((user) => user.id === userId) || null;
}

function findMemoryUserByName(name) {
  return (
    memoryUsers.find(
      (user) => user.name.trim().toLowerCase() === name.trim().toLowerCase(),
    ) || null
  );
}

function createMemoryUserRecord({ name, email }) {
  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: email?.trim().toLowerCase() || null,
    createdAt: new Date().toISOString(),
  };

  memoryUsers.unshift(user);
  return user;
}

async function initializeDataStore() {
  const mode = getStoreMode();
  activeMode = mode;

  if (mode === STORE_MODE.MONGO) {
    await connectToDatabase();
  }

  return mode;
}

async function closeDataStore() {
  if (getStoreMode() === STORE_MODE.MONGO) {
    await disconnectDatabase();
  }

  activeMode = null;
}

async function listUsers() {
  if (getStoreMode() === STORE_MODE.MONGO) {
    const users = await User.find().sort({ createdAt: -1 });
    return users.map(formatUser);
  }

  return [...memoryUsers].map(formatUser);
}

async function createUser({ name, email }) {
  const normalizedName = name.trim();
  const normalizedEmail = email?.trim().toLowerCase() || undefined;

  if (getStoreMode() === STORE_MODE.MONGO) {
    try {
      const user = await User.create({
        name: normalizedName,
        email: normalizedEmail,
      });

      return formatUser(user);
    } catch (error) {
      if (error?.code === 11000) {
        throw createStoreError(409, 'User email already exists');
      }

      throw error;
    }
  }

  const duplicateEmail =
    normalizedEmail &&
    memoryUsers.some((user) => user.email && user.email.toLowerCase() === normalizedEmail);

  if (duplicateEmail) {
    throw createStoreError(409, 'User email already exists');
  }

  return formatUser(
    createMemoryUserRecord({
      name: normalizedName,
      email: normalizedEmail,
    }),
  );
}

async function resolveMemoryAuthor({ authorId, author }) {
  if (typeof authorId === 'string' && authorId.trim()) {
    const existingUser = findMemoryUserById(authorId.trim());

    if (!existingUser) {
      throw createStoreError(400, 'Unable to save post', [
        'authorId does not match any existing user',
      ]);
    }

    return existingUser;
  }

  if (typeof author === 'string' && author.trim()) {
    return findMemoryUserByName(author) || createMemoryUserRecord({ name: author });
  }

  return null;
}

async function resolveMongoAuthor({ authorId, author }) {
  if (typeof authorId === 'string' && authorId.trim()) {
    const normalizedAuthorId = authorId.trim();

    if (!mongoose.isValidObjectId(normalizedAuthorId)) {
      throw createStoreError(400, 'Unable to save post', [
        'authorId must be a valid MongoDB ObjectId',
      ]);
    }

    const existingUser = await User.findById(normalizedAuthorId);

    if (!existingUser) {
      throw createStoreError(400, 'Unable to save post', [
        'authorId does not match any existing user',
      ]);
    }

    return existingUser;
  }

  if (typeof author === 'string' && author.trim()) {
    const normalizedAuthor = author.trim();
    const existingUser = await User.findOne({ name: normalizedAuthor });

    if (existingUser) {
      return existingUser;
    }

    return User.create({ name: normalizedAuthor });
  }

  return null;
}

async function listPosts() {
  if (getStoreMode() === STORE_MODE.MONGO) {
    const posts = await Post.find().sort({ createdAt: -1 }).populate('authorId');
    return posts.map(formatPost);
  }

  return [...memoryPosts].map((post) =>
    formatPost({
      ...post,
      authorId: findMemoryUserById(post.authorId),
    }),
  );
}

async function getPostById(id) {
  if (getStoreMode() === STORE_MODE.MONGO) {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const post = await Post.findById(id).populate('authorId');
    return formatPost(post);
  }

  const post = memoryPosts.find((entry) => entry.id === id);

  if (!post) {
    return null;
  }

  return formatPost({
    ...post,
    authorId: findMemoryUserById(post.authorId),
  });
}

async function createPost({ title, content, authorId, author }) {
  if (getStoreMode() === STORE_MODE.MONGO) {
    const resolvedAuthor = await resolveMongoAuthor({ authorId, author });
    const post = await Post.create({
      title: title.trim(),
      content: content.trim(),
      authorId: resolvedAuthor?._id || null,
    });
    const savedPost = await Post.findById(post._id).populate('authorId');

    return formatPost(savedPost);
  }

  const resolvedAuthor = await resolveMemoryAuthor({ authorId, author });
  const timestamp = new Date().toISOString();
  const post = {
    id: randomUUID(),
    title: title.trim(),
    content: content.trim(),
    authorId: resolvedAuthor?.id || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  memoryPosts.unshift(post);

  return formatPost({
    ...post,
    authorId: resolvedAuthor,
  });
}

async function updatePost(id, updates) {
  if (getStoreMode() === STORE_MODE.MONGO) {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const post = await Post.findById(id);

    if (!post) {
      return null;
    }

    if (typeof updates.title === 'string') {
      post.title = updates.title.trim();
    }

    if (typeof updates.content === 'string') {
      post.content = updates.content.trim();
    }

    if (updates.authorId !== undefined || updates.author !== undefined) {
      const resolvedAuthor = await resolveMongoAuthor({
        authorId: updates.authorId,
        author: updates.author,
      });

      post.authorId = resolvedAuthor?._id || null;
    }

    await post.save();
    await post.populate('authorId');

    return formatPost(post);
  }

  const post = memoryPosts.find((entry) => entry.id === id);

  if (!post) {
    return null;
  }

  if (typeof updates.title === 'string') {
    post.title = updates.title.trim();
  }

  if (typeof updates.content === 'string') {
    post.content = updates.content.trim();
  }

  if (updates.authorId !== undefined || updates.author !== undefined) {
    const resolvedAuthor = await resolveMemoryAuthor({
      authorId: updates.authorId,
      author: updates.author,
    });

    post.authorId = resolvedAuthor?.id || null;
  }

  post.updatedAt = new Date().toISOString();

  return formatPost({
    ...post,
    authorId: findMemoryUserById(post.authorId),
  });
}

async function deletePost(id) {
  if (getStoreMode() === STORE_MODE.MONGO) {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const deletedPost = await Post.findByIdAndDelete(id).populate('authorId');
    return formatPost(deletedPost);
  }

  const index = memoryPosts.findIndex((post) => post.id === id);

  if (index === -1) {
    return null;
  }

  const [removedPost] = memoryPosts.splice(index, 1);

  return formatPost({
    ...removedPost,
    authorId: findMemoryUserById(removedPost.authorId),
  });
}

async function listRecentPosts(limit = 3) {
  if (getStoreMode() === STORE_MODE.MONGO) {
    const posts = await Post.aggregate([
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'authorId',
          foreignField: '_id',
          as: 'authorDetails',
        },
      },
      {
        $unwind: {
          path: '$authorDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          title: 1,
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          authorName: {
            $ifNull: ['$authorDetails.name', 'Anonymous'],
          },
          authorIdString: {
            $cond: [
              {
                $ifNull: ['$authorDetails._id', false],
              },
              {
                $toString: '$authorDetails._id',
              },
              null,
            ],
          },
          authorEmail: '$authorDetails.email',
          authorCreatedAt: '$authorDetails.createdAt',
        },
      },
    ]);

    return posts.map((post) => ({
      id: post._id.toString(),
      title: post.title,
      content: post.content,
      author: post.authorName,
      authorId: post.authorIdString,
      authorDetails: post.authorIdString
        ? {
            id: post.authorIdString,
            name: post.authorName,
            email: post.authorEmail || null,
            createdAt: toIsoString(post.authorCreatedAt),
          }
        : null,
      createdAt: toIsoString(post.createdAt),
      updatedAt: toIsoString(post.updatedAt),
    }));
  }

  return [...memoryPosts]
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .slice(0, limit)
    .map((post) =>
      formatPost({
        ...post,
        authorId: findMemoryUserById(post.authorId),
      }),
    );
}

async function resetPosts() {
  if (getStoreMode() === STORE_MODE.MONGO) {
    await Post.deleteMany({});
    await User.deleteMany({});
    return;
  }

  memoryPosts = [];
  memoryUsers = [];
}

module.exports = {
  initializeDataStore,
  closeDataStore,
  listUsers,
  createUser,
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  listRecentPosts,
  resetPosts,
};
