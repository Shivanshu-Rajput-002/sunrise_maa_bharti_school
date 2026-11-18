// Used by sequelize-cli for migrations & seeders (reads the same .env)
require('dotenv').config();

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mysql',
  timezone: '+05:30',
};

module.exports = { development: base, test: base, production: base };
