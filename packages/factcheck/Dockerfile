FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy project files
COPY pyproject.toml .
COPY src/ src/

# Install only runtime dependencies (not dev extras)
RUN uv pip install --system -e "."

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "factcheck.main:app", "--host", "0.0.0.0", "--port", "8000"]
