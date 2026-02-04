import { join } from 'node:path'

import { Monitor } from './Monitor.mjs'


const run = async () => {
    const alchemyApiKey = process.env[ 'ALCHEMY_API_KEY' ]

    if( alchemyApiKey === undefined || alchemyApiKey.trim().length === 0 ) {
        console.error( 'Error: ALCHEMY_API_KEY environment variable is required' )
        process.exit( 1 )
    }

    const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
    const dataPath = join( new URL( '.', import.meta.url ).pathname, '..', 'data' )

    const probeMaxConcurrency = Number( process.env[ 'PROBE_MAX_CONCURRENCY' ] || '5' )
    const probeTimeoutMs = Number( process.env[ 'PROBE_TIMEOUT_MS' ] || '15000' )
    const probeMaxAgeDays = Number( process.env[ 'PROBE_MAX_AGE_DAYS' ] || '7' )

    console.log( 'x402 MCP Monitor - Collection Run' )
    console.log( '==================================' )
    console.log( '' )

    const { status, stats, newEndpoints, probedCount, log } = await Monitor.collect( {
        dataPath,
        alchemyUrl,
        probeMaxConcurrency,
        probeTimeoutMs,
        probeMaxAgeDays
    } )

    log
        .forEach( ( line ) => {
            console.log( line )
        } )

    console.log( '' )
    console.log( `Summary: ${stats[ 'total' ]} total, ${stats[ 'reachable' ]} reachable, ${stats[ 'withX402' ]} x402, ${newEndpoints} new, ${probedCount} probed` )

    if( !status ) {
        process.exit( 1 )
    }
}


run().catch( ( error ) => {
    console.error( `Fatal error: ${error.message}` )
    process.exit( 1 )
} )
