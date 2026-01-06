from sqlalchemy import create_engine, text
from store_locator.app.config import settings

# Use your Railway DATABASE_URL from your .env
engine = create_engine(settings.DATABASE_URL)

def truncate_stores():
    with engine.connect() as conn:
        print("Truncating stores table...")
        conn.execute(text("TRUNCATE TABLE stores RESTART IDENTITY CASCADE;"))
        conn.commit()
        print("Database cleared!")

if __name__ == "__main__":
    truncate_stores()