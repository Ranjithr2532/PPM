import os
from dotenv import load_dotenv

load_dotenv()

# Secret key used to sign JWT tokens
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set in .env")

# Secret key used to sign JWT refresh tokens
REFRESH_SECRET_KEY = os.getenv("REFRESH_SECRET_KEY")
if not REFRESH_SECRET_KEY:
    raise RuntimeError("REFRESH_SECRET_KEY environment variable is not set in .env")

# JWT signing algorithm
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# Access token validity (minutes)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Refresh token validity (days)
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# JWT Claims
JWT_ISSUER = os.getenv("JWT_ISSUER", "ppm-backend-api")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "ppm-app-clients")

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL")

# Enable detailed errors while developing
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
