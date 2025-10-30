FROM apache/spark:3.5.0

# Install curl first
USER root
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Download MySQL JDBC driver
RUN curl -L https://repo1.maven.org/maven2/mysql/mysql-connector-java/8.0.33/mysql-connector-java-8.0.33.jar \
    -o /opt/spark/jars/mysql-connector-java.jar

# Switch back to non-root user
USER 185