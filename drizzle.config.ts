import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
    dialect: "singlestore",
    schema: "./src/server/db/schema.ts",
    dbCredentials: {
        host: "svc-3482219c-a389-4079-b18b-d50662524e8a-shared-dml.aws-virginia-6.svc.singlestore.com",
        user: "niels-e5fa1",
        password: env.DB_PASSWORD,
        port: 3333,
        database: "db_niels_42e07",
        ssl: {},
    },
});