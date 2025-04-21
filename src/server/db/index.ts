import { drizzle } from "drizzle-orm/singlestore";
import mysql from "mysql2/promise";
import { env } from "~/env";
import * as schema from "./schema";

// Create a connection pool using environment variables for SingleStore
const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  database: env.DB_NAME,
  ssl: {},
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Debug database connection
console.log(`[DB] Connecting to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME} as ${env.DB_USER}`);

// Export the database using SingleStore driver with simple configuration
export const db = drizzle({ client: pool });
