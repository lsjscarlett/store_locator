from datetime import datetime
import pytz
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from . import models

# --- PASSWORD HASHING SETUP ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


# --- TIMEZONE / OPEN CHECKER ---
def check_is_open(store_obj) -> bool:
    """
    Checks if the store is open RIGHT NOW based on the Store's Local Time.
    """
    # 1. Determine the Store's Timezone
    tz_name = getattr(store_obj, 'timezone', 'UTC')
    if not tz_name:
        tz_name = 'UTC'

    try:
        store_tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        store_tz = pytz.UTC

    # 2. Get the current time inside THAT timezone
    store_now = datetime.now(store_tz)

    current_time = store_now.time()
    weekday = store_now.weekday()  # 0=Monday, 6=Sunday

    # 3. Map day to column
    day_map = {
        0: 'hours_mon', 1: 'hours_tue', 2: 'hours_wed',
        3: 'hours_thu', 4: 'hours_fri', 5: 'hours_sat', 6: 'hours_sun'
    }

    # 4. Fetch hours string
    hours_str = getattr(store_obj, day_map[weekday], None)

    if not hours_str or hours_str.lower() == "closed":
        return False

    try:
        start_str, end_str = hours_str.split('-')
        start_time = datetime.strptime(start_str.strip(), "%H:%M").time()
        end_time = datetime.strptime(end_str.strip(), "%H:%M").time()

        # 5. Check range
        if start_time <= current_time <= end_time:
            return True

    except ValueError:
        return False

    return False


def process_services(db: Session, services_input):
    """
    Parses "wifi|coffee" string OR ["wifi", "coffee"] list
    Returns list of Service DB Objects
    """
    if not services_input:
        return []

    # 1. Normalize input to list
    service_names = []
    if isinstance(services_input, str):
        # The CSV uses pipes "|"
        service_names = services_input.split("|")
    elif isinstance(services_input, list):
        service_names = services_input

    # 2. Find or Create Services
    service_objs = []
    for name in service_names:
        name = name.strip().lower()  # Normalize text
        if not name: continue

        # Check if exists
        service = db.query(models.Service).filter(models.Service.name == name).first()
        if not service:
            service = models.Service(name=name)
            db.add(service)
            db.commit()
            db.refresh(service)
        service_objs.append(service)

    return service_objs