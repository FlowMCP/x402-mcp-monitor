#!/usr/bin/env node

/**
 * Probe Endpoints Script
 *
 * Reads existing endpoints from endpoints.json and probes all entries
 * that have probe === null or stale probes. Writes verified results
 * back to endpoints.json and rebuilds docs/data.json.
 *
 * Requires NO external API keys - only direct HTTP probing.
 *
 * Usage:
 *   node scripts/probe-endpoints.mjs
 *
 * Optional Environment Variables:
 *   PROBE_MAX_CONCURRENCY - Max parallel probes (default: 5)
 *   PROBE_TIMEOUT_MS      - Probe timeout in ms (default: 15000)
 *   PROBE_MAX_AGE_DAYS    - Max age before re-probing (default: 7)
 *   FORCE_REPROBE         - Set to "true" to re-probe all endpoints
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EndpointProber } from '../src/prober/EndpointProber.mjs'
import { EndpointRegistry } from '../src/registry/EndpointRegistry.mjs'
import { DashboardBuilder } from '../src/writer/DashboardBuilder.mjs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const ROOT_PATH = join( __dirname, '..' )
const DATA_PATH = join( ROOT_PATH, 'data' )
const ENDPOINTS_PATH = join( DATA_PATH, 'endpoints.json' )
const DOCS_PATH = join( ROOT_PATH, 'docs' )


const run = async () => {
    const maxConcurrency = Number( process.env[ 'PROBE_MAX_CONCURRENCY' ] || '5' )
    const timeout = Number( process.env[ 'PROBE_TIMEOUT_MS' ] || '15000' )
    const probeMaxAgeDays = Number( process.env[ 'PROBE_MAX_AGE_DAYS' ] || '7' )
    const forceReprobe = process.env[ 'FORCE_REPROBE' ] === 'true'

    console.log( 'x402 MCP Monitor - Probe Endpoints' )
    console.log( '===================================' )
    console.log( '' )

    // Phase 1: Read existing endpoints
    console.log( 'Phase 1: Reading endpoints.json...' )
    const raw = await readFile( ENDPOINTS_PATH, 'utf-8' )
    const endpointsData = JSON.parse( raw )
    const { endpoints } = endpointsData
    console.log( `  Found ${endpoints.length} endpoints` )

    // Phase 2: Force re-probe if requested
    if( forceReprobe ) {
        console.log( '  FORCE_REPROBE=true: Clearing all existing probes' )
        endpoints
            .forEach( ( ep ) => {
                ep[ 'probe' ] = null
            } )
    }

    const needsProbe = endpoints.filter( ( ep ) => ep[ 'probe' ] === null ).length
    const hasProbe = endpoints.length - needsProbe
    console.log( `  ${needsProbe} need probing, ${hasProbe} already probed` )

    if( needsProbe === 0 ) {
        console.log( '' )
        console.log( 'Nothing to probe. All endpoints have valid probes.' )
        console.log( 'Use FORCE_REPROBE=true to re-probe all.' )

        return
    }

    // Phase 3: Probe endpoints
    console.log( '' )
    console.log( `Phase 2: Probing ${needsProbe} endpoints (concurrency: ${maxConcurrency}, timeout: ${timeout}ms)...` )
    const { endpoints: probedEndpoints, probedCount } = await EndpointProber.probeAll( {
        endpoints,
        maxConcurrency,
        timeout,
        probeMaxAgeDays
    } )
    console.log( `  Probed: ${probedCount} endpoints` )

    // Phase 4: Log probe results
    console.log( '' )
    console.log( 'Probe Results:' )
    probedEndpoints
        .forEach( ( ep ) => {
            const { url, probe } = ep
            const reachable = probe && probe[ 'categories' ] && probe[ 'categories' ][ 'isReachable' ] === true
            const mcp = probe && probe[ 'categories' ] && probe[ 'categories' ][ 'supportsMcp' ] === true
            const x402 = probe && probe[ 'categories' ] && probe[ 'categories' ][ 'supportsX402' ] === true

            console.log( `  ${url}` )
            console.log( `    Reachable: ${reachable}, MCP: ${mcp}, x402: ${x402}` )

            if( probe && probe[ 'messages' ] && probe[ 'messages' ].length > 0 ) {
                probe[ 'messages' ]
                    .forEach( ( msg ) => {
                        console.log( `    - ${msg}` )
                    } )
            }
        } )

    // Phase 5: Recompute stats
    console.log( '' )
    console.log( 'Phase 3: Recomputing stats...' )
    const { stats } = EndpointRegistry.computeStats( { endpoints: probedEndpoints } )
    console.log( `  Total: ${stats[ 'total' ]}, Reachable: ${stats[ 'reachable' ]}, x402: ${stats[ 'withX402' ]}` )

    // Phase 6: Write endpoints.json
    console.log( '' )
    console.log( 'Phase 4: Writing endpoints.json...' )
    const updatedData = {
        version: endpointsData[ 'version' ] || 1,
        updatedAt: new Date().toISOString(),
        stats,
        endpoints: probedEndpoints
    }

    await writeFile( ENDPOINTS_PATH, JSON.stringify( updatedData, null, 4 ), 'utf-8' )
    console.log( '  Written.' )

    // Phase 7: Rebuild docs/data.json
    console.log( '' )
    console.log( 'Phase 5: Rebuilding docs/data.json...' )
    const { dashboardData } = DashboardBuilder.buildDashboardData( { endpointsData: updatedData } )
    await DashboardBuilder.writeDashboardData( { docsPath: DOCS_PATH, dashboardData } )
    console.log( '  Written.' )

    // Summary
    console.log( '' )
    console.log( '===================================' )
    console.log( 'Done.' )
    console.log( `  Probed: ${probedCount} endpoints` )
    console.log( `  Reachable: ${stats[ 'reachable' ]} / ${stats[ 'total' ]}` )
    console.log( `  x402: ${stats[ 'withX402' ]}` )
    console.log( `  With Tools: ${stats[ 'withTools' ]}` )
}


run().catch( ( error ) => {
    console.error( `Fatal error: ${error.message}` )
    process.exit( 1 )
} )
