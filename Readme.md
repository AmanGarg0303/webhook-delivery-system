### Tech

Backend: Node.js, Express.js \
Database: PostgreSQL (with UUIDs, pgcrypto, indexing, constraints) \
Caching & Queues: Redis (lists, Streams, consumer groups, TTL) \
Security: HMAC signing & verification for webhooks \
DevOps / Tools: Docker, dotenv, Axios for HTTP requests \
Testing / Simulation: Dummy webhook server for failure simulation

### Feature

Designed and implemented a multi-tenant webhook delivery system that allows multiple applications to subscribe to events and receive reliable webhook notifications with fault tolerance and retry guarantees. \

✔ Multi-tenant webhook fan-out \
✔ Subscription stored in postgres \
✔ Redis cache \
✔ Redis Streams for delivery queue \
✔ Consumer group based workers \
✔ Dummy webhook server ready \
✔ HTTP delivery with retries \
✔ Failure simulation \
✔ DLQ after max retries \
✔ HMAC signing + verification \
✔ Sender-side idempotency via delivery_id \
✔ Redis-based sender-side dedupe with TTL \
✔ Exponential backoff + jitter

### Steps to start the things:

-> npm i // if node_modules are not present in server and dummyServer \
-> docker-compose up - d \
-> /server -> nodemon server.js \
-> /server -> node .\workers\delivery.worker.js \
-> /dummyServer -> nodemon server.js
