from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "supersecretkey"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Add these lines to read Redis config from Docker
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    class Config:
        env_file = ".env"


settings = Settings()