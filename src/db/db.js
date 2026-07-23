import { MongoClient } from "mongodb";

// Configure your MongoDB Connection
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "linkedin_scraper";
const JOB_COLLECTION_NAME = "jobs";
const POSTS_COLLECTION_NAME = "posts";

let client;
let jobCollection;
let postCollection;

const connectToDatabase = async () => {
  client = new MongoClient(MONGO_URI);
  await client.connect();

  const db = client.db(DB_NAME);
  jobCollection = db.collection(JOB_COLLECTION_NAME);
  postCollection = db.collection(POSTS_COLLECTION_NAME);

  // Create a unique index on the job ID to prevent duplicates
  await jobCollection.createIndex({ id: 1 }, { unique: true });
  await postCollection.createIndex({ id: 1 }, { unique: true });
  console.log("Connected to MongoDB. Unique index verified.");
};

const saveJobToDatabase = async ({ job, log, scraperType = "CRAWLEE" }) => {
  if (!log) log = console;
  try {
    await jobCollection.updateOne(
      { id: job.id },
      {
        $set: {
          ...job,
          scraperType,
          updatedAt: new Date(),
        },
        $setOnInsert: { scrapedAt: new Date() },
      },
      { upsert: true },
    );
    log.info(`Successfully upserted job ID ${job.id} to MongoDB.`);
  } catch (err) {
    log.error(`Failed to save job ID ${job.id} to MongoDB: ${err.message}`);
  }
};

const savePostToDatabase = async ({ post, log, scraperType = "CUSTOM" }) => {
  if (!log) log = console;
  try {
    // Use post URL as unique identifier (or generate one)
    const postId =
      post.url ||
      `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await postCollection.updateOne(
      { id: postId },
      {
        $set: {
          ...post,
          id: postId,
          scraperType,
          scrapedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    log.info(`Successfully saved post to MongoDB.`);
  } catch (err) {
    log.error(`Failed to save post to MongoDB: ${err.message}`);
  }
};

export { client, connectToDatabase, saveJobToDatabase, savePostToDatabase };
