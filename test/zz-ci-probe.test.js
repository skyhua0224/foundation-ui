import test from 'node:test'
import assert from 'node:assert/strict'

test('CI failure summary probe: the assertion fails on purpose', () => { assert.fail('intentional failure for the CI probe') })
test('CI failure summary probe: the values differ', () => { assert.equal(1, 2) })
