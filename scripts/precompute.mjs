#!/usr/bin/env node

/**
 * Pre-Compute Script
 *
 * Orchestrates data collection from all sources including pre-computed Dune data.
 * This script can be run locally or in CI to update the dashboard data.
 *
 * Usage:
 *   ALCHEMY_API_KEY=xxx node scripts/precompute.mjs
 *
 * Optional Environment Variables:
 *   DUNE_API_KEY - If set, will also fetch fresh Dune data
 *   PROBE_MAX_CONCURRENCY - Max parallel probes (default: 5)
 *   PROBE_TIMEOUT_MS - Probe timeout in ms (default: 15000)
 *   PROBE_MAX_AGE_DAYS - Max age before re-probing (default: 7)
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Monitor } from '../src/Monitor.mjs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const ROOT_PATH = join( __dirname, '..' )
const DATA_PATH = join( ROOT_PATH, 'data' )
const DUNE_CACHE_PATH = join( DATA_PATH, 'dune-erc8004.json' )


const fileExists = async ( { filePath } ) => {
    try {
        await access( filePath )

        return true
    } catch {
        return false
    }
}


const loadDuneCache = async () => {
    const exists = await fileExists( { filePath: DUNE_CACHE_PATH } )

    if( !exists ) {
        return { events: [], hasCache: false }
    }

    try {
        const content = await readFile( DUNE_CACHE_PATH, 'utf-8' )
        const data = JSON.parse( content )
        const { events = [] } = data

        return { events, hasCache: true }
    } catch( error ) {
        console.warn( `Warning: Could not read Dune cache: ${error.message}` )

        return { events: [], hasCache: false }
    }
}


const convertDuneEventsToDiscoveries = ( { events } ) => {
    const discoveries = []

    events
        .forEach( ( event ) => {
            const { agentId, ownerAddress, agentName, uriAgentType, mcpEndpoint, a2aEndpoint, isSpecCompliant } = event

            if( mcpEndpoint !== null && mcpEndpoint !== undefined ) {
                discoveries.push( {
                    url: mcpEndpoint,
                    protocol: 'mcp',
                    sourceData: {
                        type: 'erc8004',
                        agentId,
                        ownerAddress,
                        agentName: agentName || null,
                        uriType: uriAgentType,
                        isSpecCompliant: isSpecCompliant || false,
                        discoveredAt: new Date().toISOString(),
                        fromDuneCache: true
                    }
                } )
            }

            if( a2aEndpoint !== null && a2aEndpoint !== undefined ) {
                discoveries.push( {
                    url: a2aEndpoint,
                    protocol: 'a2a',
                    sourceData: {
                        type: 'erc8004',
                        agentId,
                        ownerAddress,
                        agentName: agentName || null,
                        uriType: uriAgentType,
                        isSpecCompliant: isSpecCompliant || false,
                        discoveredAt: new Date().toISOString(),
                        fromDuneCache: true
                    }
                } )
            }
        } )

    return { discoveries }
}


const run = async () => {
    const alchemyApiKey = process.env[ 'ALCHEMY_API_KEY' ]

    if( alchemyApiKey === undefined || alchemyApiKey.trim().length === 0 ) {
        console.error( 'Error: ALCHEMY_API_KEY environment variable is required' )
        process.exit( 1 )
    }

    const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
    const probeMaxConcurrency = Number( process.env[ 'PROBE_MAX_CONCURRENCY' ] || '5' )
    const probeTimeoutMs = Number( process.env[ 'PROBE_TIMEOUT_MS' ] || '15000' )
    const probeMaxAgeDays = Number( process.env[ 'PROBE_MAX_AGE_DAYS' ] || '7' )

    console.log( 'x402 MCP Monitor - Pre-Compute' )
    console.log( '==============================' )
    console.log( '' )

    // Check for Dune cache
    console.log( 'Checking Dune cache...' )
    const { events: duneEvents, hasCache } = await loadDuneCache()

    if( hasCache ) {
        console.log( `  Found ${duneEvents.length} events in Dune cache` )
        const { discoveries: duneDiscoveries } = convertDuneEventsToDiscoveries( { events: duneEvents } )
        console.log( `  Converted to ${duneDiscoveries.length} discoveries` )
    } else {
        console.log( '  No Dune cache found (run import-dune.mjs first)' )
    }

    console.log( '' )

    // Run standard collection
    console.log( 'Running standard collection...' )
    const { status, stats, newEndpoints, probedCount, log } = await Monitor.collect( {
        dataPath: DATA_PATH,
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
    console.log( '==============================' )
    console.log( 'Summary' )
    console.log( '==============================' )
    console.log( `Total endpoints: ${stats[ 'total' ]}` )
    console.log( `Reachable: ${stats[ 'reachable' ]}` )
    console.log( `x402-enabled: ${stats[ 'withX402' ]}` )
    console.log( `New this run: ${newEndpoints}` )
    console.log( `Probed this run: ${probedCount}` )
    console.log( '' )
    console.log( 'By source:' )

    Object.entries( stats[ 'bySource' ] || {} )
        .forEach( ( [ source, count ] ) => {
            console.log( `  ${source}: ${count}` )
        } )

    console.log( '' )

    if( !status ) {
        console.error( 'Collection completed with errors' )
        process.exit( 1 )
    }

    console.log( 'Pre-compute completed successfully.' )
}


run().catch( ( error ) => {
    console.error( `Fatal error: ${error.message}` )
    process.exit( 1 )
} )
