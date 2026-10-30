FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for image processing (libgl1 for OpenCV/easyocr, libglib2.0-0)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8001/docs || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]
