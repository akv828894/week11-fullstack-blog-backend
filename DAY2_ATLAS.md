# Week 11 Atlas Setup

Use this file when you are ready to switch the Week 11 API from memory mode to MongoDB Atlas.

## `.env` example

```env
PORT=5000
DATA_STORE_MODE=mongo
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER_URL/week11FullstackBlog?retryWrites=true&w=majority&appName=Week11FullstackBlog
```

## Quick Check

```bash
npm run check:mongo
```

If that passes, start the API and use the Week 11 frontend to create, refresh, and delete a post.
