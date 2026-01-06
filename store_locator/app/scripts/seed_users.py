
from ..database import SessionLocal
from ..models import User, Role
from ..auth_utils import get_password_hash

def seed_users():
    db = SessionLocal()
    try:
        # 1. Create Roles
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(name="admin")
            db.add(admin_role)

        marketer_role = db.query(Role).filter(Role.name == "marketer").first()
        if not marketer_role:
            marketer_role = Role(name="marketer")
            db.add(marketer_role)

        db.commit()

        # 2. Create Admin User
        admin_user = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin_user:
            print("Creating admin user...")
            admin_user = User(
                email="admin@example.com",
                password_hash=get_password_hash("admin123"), # YOUR PASSWORD
                role_id=admin_role.id,
                is_active=True
            )
            db.add(admin_user)

        db.commit()
        print("✅ Success: User 'admin@example.com' created with password 'admin123'")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()