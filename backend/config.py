import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "skillsync")
JWT_SECRET = os.getenv("JWT_SECRET", "skillsync-super-secret-key-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60 * 24  # 24 hours
