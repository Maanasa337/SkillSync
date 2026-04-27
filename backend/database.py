from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, DATABASE_NAME
import pymongo

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.progress.create_index([("user_id", 1), ("course_id", 1)], unique=True)
    # Chatbot indexes
    await db.chatbot_conversations.create_index("conversation_id", unique=True, background=True)
    await db.chatbot_conversations.create_index("user_id", background=True)
    # Rate limit index
    await db.chatbot_rate_limits.create_index("user_id", unique=True, background=True)
    # AI TTL indexes
    await db.ai_recommendations.create_index("user_id", unique=True, background=True)
    await db.ai_recommendations.create_index("expires_at", expireAfterSeconds=0, background=True)
    await db.ai_insights.create_index("user_id", unique=True, background=True)
    await db.ai_insights.create_index("expires_at", expireAfterSeconds=0, background=True)
    await db.ai_summaries.create_index("cache_key", unique=True, background=True)
    await db.ai_summaries.create_index("expires_at", expireAfterSeconds=0, background=True)
    print(f"[OK] Connected to MongoDB: {DATABASE_NAME}")


async def close_db():
    global client
    if client:
        client.close()
        print("[OK] MongoDB connection closed")


def get_db():
    return db
