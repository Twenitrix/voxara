# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom first — allows Docker to cache the dependency layer
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build (skip tests for faster image builds)
COPY src ./src
RUN mvn package -DskipTests -B

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

# Create upload directory inside the container
RUN mkdir -p /app/uploads/audio

# Copy the fat JAR produced by Spring Boot Maven plugin
COPY --from=builder /app/target/voxara-hub-*.jar app.jar

# Expose Spring Boot port
EXPOSE 8080

# Environment variable overrides (supply via docker run -e or Render env vars)
ENV SPRING_PROFILES_ACTIVE=prod \
    DB_USERNAME=postgres \
    DB_PASSWORD=postgres \
    JWT_SECRET=ChangeThisInProductionToSomethingVeryLong!! \
    PYTHON_URL=http://localhost:8000 \
    UPLOAD_DIR=/app/uploads/audio

ENTRYPOINT ["java", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-Xmx512m", \
    "-jar", "app.jar"]
