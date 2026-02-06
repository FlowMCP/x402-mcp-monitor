#!/usr/bin/env node

/**
 * Dune Analytics Import Script
 *
 * Fetches ERC-8004 Register events from Dune Analytics (Base chain)
 * and saves them to data/dune-erc8004.json for use by the collector.
 *
 * Prerequisites:
 *   1. Dune Query ID 6661439 already exists:
 *      SELECT block_time, block_number, tx_hash as transaction_hash,
 *             contract_address, data, topic0, topic1, topic2, topic3
 *      FROM base.logs
 *      WHERE contract_address = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *        AND topic0 = 0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a
 *      ORDER BY block_number ASC
 *
 *   2. Set DUNE_QUERY_ID=6661439 in your .env
 *
 * Usage:
 *   DUNE_API_KEY=xxx DUNE_QUERY_ID=123456 node scripts/import-dune.mjs
 *
 * Environment Variables:
 *   DUNE_API_KEY  - Required. Your Dune Analytics API key.
 *   DUNE_QUERY_ID - Required. The Dune Query ID to execute.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Erc8004RegistryParser } from 'erc8004-registry-parser'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const DATA_PATH = join( __dirname, '..', 'data' )

const DUNE_API_BASE = 'https://api.dune.com/api/v1'

// ERC-8004 Registry Contract on Base
const ERC8004_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'


class DuneImporter {
    #apiKey


    constructor( { apiKey } ) {
        this.#apiKey = apiKey
    }


    async executeQuery( { queryId } ) {
        const executeUrl = `${DUNE_API_BASE}/query/${queryId}/execute`

        const response = await fetch( executeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Dune-API-Key': this.#apiKey
            },
            body: JSON.stringify( {
                query_parameters: {},
                performance: 'medium'
            } )
        } )

        if( !response.ok ) {
            const errorText = await response.text()
            throw new Error( `Dune execute failed: ${response.status} - ${errorText}` )
        }

        const data = await response.json()
        const { execution_id: executionId } = data

        return { executionId }
    }


    async getLatestResults( { queryId } ) {
        const resultsUrl = `${DUNE_API_BASE}/query/${queryId}/results`

        const response = await fetch( resultsUrl, {
            headers: { 'X-Dune-API-Key': this.#apiKey }
        } )

        if( !response.ok ) {
            return { rows: null, hasResults: false }
        }

        const data = await response.json()
        const { result } = data

        if( result === undefined || result === null ) {
            return { rows: null, hasResults: false }
        }

        return { rows: result.rows || [], hasResults: true }
    }


    async waitForResults( { executionId, maxWaitMs = 120000 } ) {
        const statusUrl = `${DUNE_API_BASE}/execution/${executionId}/status`
        const resultsUrl = `${DUNE_API_BASE}/execution/${executionId}/results`

        const startTime = Date.now()

        while( Date.now() - startTime < maxWaitMs ) {
            const statusResponse = await fetch( statusUrl, {
                headers: { 'X-Dune-API-Key': this.#apiKey }
            } )

            if( !statusResponse.ok ) {
                throw new Error( `Dune status check failed: ${statusResponse.status}` )
            }

            const statusData = await statusResponse.json()
            const { state } = statusData

            if( state === 'QUERY_STATE_COMPLETED' ) {
                const resultsResponse = await fetch( resultsUrl, {
                    headers: { 'X-Dune-API-Key': this.#apiKey }
                } )

                if( !resultsResponse.ok ) {
                    throw new Error( `Dune results fetch failed: ${resultsResponse.status}` )
                }

                const resultsData = await resultsResponse.json()
                const { result } = resultsData

                return { rows: result.rows || [] }
            }

            if( state === 'QUERY_STATE_FAILED' ) {
                throw new Error( `Dune query failed: ${statusData.error || 'Unknown error'}` )
            }

            // Wait 2 seconds before next poll
            await DuneImporter.#sleep( 2000 )
        }

        throw new Error( 'Dune query timed out' )
    }


    static #sleep( ms ) {
        return new Promise( ( resolve ) => setTimeout( resolve, ms ) )
    }
}


const parseEvents = ( { rows } ) => {
    const events = []

    rows
        .forEach( ( row ) => {
            try {
                const eventLog = {
                    topics: [
                        row[ 'topic0' ],
                        row[ 'topic1' ],
                        row[ 'topic2' ],
                        row[ 'topic3' ]
                    ].filter( ( t ) => t !== null ),
                    data: row[ 'data' ]
                }

                const { status, categories, entries } = Erc8004RegistryParser.start( { eventLog } )

                if( status && entries !== null ) {
                    events.push( {
                        blockNumber: Number( row[ 'block_number' ] ),
                        blockTime: row[ 'block_time' ],
                        transactionHash: row[ 'transaction_hash' ],
                        agentId: entries[ 'agentId' ],
                        ownerAddress: entries[ 'ownerAddress' ],
                        agentName: entries[ 'name' ] || null,
                        uriAgentType: entries[ 'uriAgentType' ],
                        mcpEndpoint: entries[ 'mcpEndpoint' ],
                        a2aEndpoint: entries[ 'a2aEndpoint' ],
                        isSpecCompliant: categories[ 'isSpecCompliant' ] || false
                    } )
                }
            } catch( _e ) {
                // Skip unparseable events
            }
        } )

    return { events }
}


const run = async () => {
    const apiKey = process.env[ 'DUNE_API_KEY' ]
    const queryId = process.env[ 'DUNE_QUERY_ID' ]

    if( apiKey === undefined || apiKey.trim().length === 0 ) {
        console.error( 'Error: DUNE_API_KEY environment variable is required' )
        process.exit( 1 )
    }

    if( queryId === undefined || queryId.trim().length === 0 ) {
        console.error( 'Error: DUNE_QUERY_ID environment variable is required' )
        console.error( '' )
        console.error( 'Set DUNE_QUERY_ID=6661439 (Dune Query: [ERC-8004 Base] Register Events)' )
        process.exit( 1 )
    }

    console.log( 'Dune ERC-8004 Import' )
    console.log( '====================' )
    console.log( '' )
    console.log( `Query ID: ${queryId}` )
    console.log( '' )

    const importer = new DuneImporter( { apiKey } )

    // Try to get cached results first
    console.log( 'Checking for cached results...' )
    const { rows: cachedRows, hasResults } = await importer.getLatestResults( { queryId } )

    let rows

    if( hasResults && cachedRows.length > 0 ) {
        console.log( `  Found ${cachedRows.length} cached results` )
        rows = cachedRows
    } else {
        // Execute fresh query
        console.log( '  No cached results, executing fresh query...' )
        const { executionId } = await importer.executeQuery( { queryId } )
        console.log( `  Execution ID: ${executionId}` )

        // Wait for results
        console.log( 'Waiting for results...' )
        const { rows: freshRows } = await importer.waitForResults( { executionId } )
        rows = freshRows
    }

    console.log( `  Fetched ${rows.length} raw events` )

    // Parse events
    console.log( 'Parsing events...' )
    const { events } = parseEvents( { rows } )
    console.log( `  Parsed ${events.length} valid events` )

    // Count by type
    const mcpCount = events.filter( ( e ) => e.mcpEndpoint !== null ).length
    const a2aCount = events.filter( ( e ) => e.a2aEndpoint !== null ).length
    console.log( `  MCP endpoints: ${mcpCount}` )
    console.log( `  A2A endpoints: ${a2aCount}` )

    // Write to file
    const outputPath = join( DATA_PATH, 'dune-erc8004.json' )
    const outputData = {
        version: 1,
        fetchedAt: new Date().toISOString(),
        source: 'dune-analytics',
        contract: ERC8004_CONTRACT,
        eventCount: events.length,
        events
    }

    await mkdir( DATA_PATH, { recursive: true } )
    await writeFile( outputPath, JSON.stringify( outputData, null, 4 ), 'utf-8' )

    console.log( '' )
    console.log( `Written: ${outputPath}` )
    console.log( 'Done.' )
}


run().catch( ( error ) => {
    console.error( `Fatal error: ${error.message}` )
    process.exit( 1 )
} )
