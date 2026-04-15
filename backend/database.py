from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, DATABASE_NAME

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.progress.create_index([("user_id", 1), ("course_id", 1)], unique=True)
    print(f"[OK] Connected to MongoDB: {DATABASE_NAME}")


async def close_db():
    global client
    if client:
        client.close()
        print("[OK] MongoDB connection closed")


def get_db():
    return db
