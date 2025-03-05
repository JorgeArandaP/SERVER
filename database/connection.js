import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  user: "marketplace_c1a8_user",
  host: "dpg-cv43813qf0us73b4vt6g-a.oregon-postgres.render.com",
  database: "marketplace_c1a8",
  password: "BgEGHKnfSdS0aVDReHC5eS6rVhkJ9b5Z",
  allowExitOnIdle: true,
  ssl: true,
});

try {
  await pool.query("SELECT NOW()");
  console.log("Database connected");
} catch (error) {
  console.log(error);
}
