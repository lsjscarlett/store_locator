# 1. Use an official lightweight Python image
FROM python:3.11-slim

# 2. Set environment variables
# Prevents Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
# Keeps Python from buffering stdout/stderr (logs appear immediately)
ENV PYTHONUNBUFFERED=1

# 3. Set work directory
WORKDIR /app

# 4. Install system dependencies (needed for some python packages)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 5. Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# 6. Copy application code
COPY . .

# 7. Expose the port the app runs on
EXPOSE 8000

# 8. Command to run the application using Uvicorn
# "0.0.0.0" means listen on all network interfaces (required for Docker)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]