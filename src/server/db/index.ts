import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "~/env";
import * as schema from "./schema";

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
  host: env.DB_HOST ?? "",
  user: env.DB_USER ?? "",
  password: env.DB_PASSWORD ?? "",
  port: env.DB_PORT ?? 3333,
  database: env.DB_NAME ?? "",
  ssl: {},
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Export the database with proper typing
export const db = drizzle(pool, { schema, mode: 'default' });
