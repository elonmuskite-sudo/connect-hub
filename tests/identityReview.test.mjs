import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const sql = fs.readFileSync(new URL('../docs/supabase-schema.sql', import.meta.url), 'utf8')
const fn = sql.slice(sql.indexOf('function public.review_identity_verification'))
test('only admins can review ID checks', () => assert.match(fn, /has_role\(auth\.uid\(\),'admin'\)\) then raise exception/))
test('only pending ID checks can be reviewed', () => assert.match(fn, /where id = _id and status = 'pending'/))
test('anonymous users cannot call ID review', () => assert.match(sql, /review_identity_verification\(uuid,boolean,text\) from public, anon/))
