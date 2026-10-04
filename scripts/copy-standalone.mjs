// Next's standalone output needs public/ and .next/static next to server.js.
// Runs after `next build` (npm "postbuild") so `npm start` and Docker work.
import { cpSync, existsSync } from 'node:fs'

if (existsSync('.next/standalone')) {
  cpSync('public', '.next/standalone/public', { recursive: true })
  cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
  console.log('Copied public/ and .next/static into .next/standalone')
}
