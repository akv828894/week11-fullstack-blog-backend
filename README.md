# Week 11 Fullstack Blog Backend

Express + Mongoose API for the Week 11 fullstack blog project.

## Features

- Blog post CRUD routes
- User and post relationship support
- CORS enabled for frontend integration
- MongoDB Atlas support through Mongoose
- Memory-mode test flow for quick local verification

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file:

```bash
copy .env.example .env
```

3. Start the API:

```bash
npm run dev
```

The API runs on `http://localhost:5000`.

## Important Environment Variables

```env
PORT=5000
DATA_STORE_MODE=mongo
MONGO_URI=mongodb+srv://username:password@cluster-url/week11FullstackBlog?retryWrites=true&w=majority&appName=Week11FullstackBlog
```

If you want quick local testing without Atlas, set:

```env
DATA_STORE_MODE=memory
```

## Main Routes

- `GET /`
- `GET /users`
- `POST /users`
- `GET /posts`
- `GET /posts/:id`
- `POST /posts`
- `PUT /posts/:id`
- `DELETE /posts/:id`
- `GET /posts/recent/top-3`
- `POST /login`

## Render Deployment

This project includes [render.yaml](A:/company projects/week11-fullstack-blog-backend/render.yaml) for Render deployment.

Required Render env values:

- `DATA_STORE_MODE=mongo`
- `MONGO_URI=<your atlas uri>`

## Verification

- `npm test` runs the local API checks
- `npm run check:mongo` verifies the Atlas connection string
