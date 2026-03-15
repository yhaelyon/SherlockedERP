// Must be imported first in index.ts — loads root .env before any other module
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../../../.env') })
