import {Pool} from 'pg'

process.loadEnvFile()

export const   pool = new Pool({ connectionString: process.env.DATABASE_URL })