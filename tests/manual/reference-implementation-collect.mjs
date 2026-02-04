/**
 * Reference Implementation: Run a full collection cycle.
 *
 * Usage:
 *   ALCHEMY_API_KEY=your_key node tests/manual/reference-implementation-collect.mjs
 *
 * This script runs the Monitor.collect() pipeline and prints the results.
 */

import { join } from 'node:path'
import { Monitor } from '../../src/Monitor.mjs'


const alchemyApiKey = process.env[ 'ALCHEMY_API_KEY' ]

if( alchemyApiKey === undefined || alchemyApiKey.trim().length === 0 ) {
    console.error( 'Error: ALCHEMY_API_KEY environment variable is required' )
    process.exit( 1 )
}

const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
const dataPath = join( new URL( '.', import.meta.url ).pathname, '..', '..', 'data' )

console.log( 'Running collection...' )
console.log( `Data path: ${dataPath}` )
console.log( '' )

const { status, stats, newEndpoints, probedCount, log } = await Monitor.collect( {
    dataPath,
    alchemyUrl,
    probeMaxConcurrency: 3,
    probeTimeoutMs: 10000,
    probeMaxAgeDays: 7
} )

log
    .forEach( ( line ) => {
        console.log( line )
    } )

console.log( '' )
console.log( `Status: ${status ? 'OK' : 'FAILED'}` )
console.log( `Total: ${stats[ 'total' ]}` )
console.log( `Reachable: ${stats[ 'reachable' ]}` )
console.log( `x402: ${stats[ 'withX402' ]}` )
console.log( `New: ${newEndpoints}` )
console.log( `Probed: ${probedCount}` )
