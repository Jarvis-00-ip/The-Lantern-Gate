/**
 * Minimal test harness. The project has no dependencies and this keeps it that
 * way — `npm test` must work on a clean clone with nothing installed.
 */
const suites = [];
let current = null;

export function describe(name, fn) {
    current = { name, tests: [] };
    suites.push(current);
    fn();
    current = null;
}

export function it(name, fn) {
    if (!current) throw new Error('it() outside describe()');
    current.tests.push({ name, fn });
}

export function assert(cond, message) {
    if (!cond) throw new Error(message || 'assertion failed');
}

export function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'not equal'}\n      atteso: ${expected}\n      trovato: ${actual}`);
    }
}

export function deepEqual(actual, expected, message) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${message || 'not deep equal'}\n      atteso: ${b}\n      trovato: ${a}`);
}

export function closeTo(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message || 'not close'}\n      atteso: ${expected} ±${tolerance}\n      trovato: ${actual}`);
    }
}

/** Runs every registered suite. Resolves to the number of failures. */
export async function run() {
    let passed = 0, failed = 0;

    for (const suite of suites) {
        console.log(`\n  ${suite.name}`);
        for (const test of suite.tests) {
            try {
                await test.fn();
                console.log(`    \x1b[32m✓\x1b[0m ${test.name}`);
                passed++;
            } catch (err) {
                console.log(`    \x1b[31m✗\x1b[0m ${test.name}`);
                console.log(`      \x1b[31m${err.message}\x1b[0m`);
                failed++;
            }
        }
    }

    console.log(`\n  ${passed} passati, ${failed} falliti\n`);
    return failed;
}
