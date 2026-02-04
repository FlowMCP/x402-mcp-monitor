import { join } from 'node:path'

import { StateManager } from './state/StateManager.mjs'
import { McpRegistryCollector } from './collector/McpRegistryCollector.mjs'
import { Erc8004Collector } from './collector/Erc8004Collector.mjs'
import { BazaarCollector } from './collector/BazaarCollector.mjs'
import { EndpointRegistry } from './registry/EndpointRegistry.mjs'
import { EndpointProber } from './prober/EndpointProber.mjs'
import { DataWriter } from './writer/DataWriter.mjs'
import { DashboardBuilder } from './writer/DashboardBuilder.mjs'
import { Validation } from './task/Validation.mjs'


class Monitor {
    static async collect( { dataPath, alchemyUrl, probeMaxConcurrency = 5, probeTimeoutMs = 15000, probeMaxAgeDays = 7 } ) {
        const { status, messages } = Validation.validationCollectAll( { dataPath, alchemyUrl, probeMaxConcurrency, probeTimeoutMs, probeMaxAgeDays } )
        if( !status ) { Validation.error( { messages } ) }

        const docsPath = join( dataPath, '..', 'docs' )
        const log = []

        // Phase 1: Load State
        log.push( 'Phase 1: Loading state...' )
        const { state } = await StateManager.loadState( { dataPath } )
        const { endpointsData: existingData } = await StateManager.loadEndpoints( { dataPath } )
        const existingEndpoints = existingData[ 'endpoints' ] || []
        log.push( `  Loaded ${existingEndpoints.length} existing endpoints` )

        // Phase 2: Collect from 3 sources in parallel
        log.push( 'Phase 2: Collecting from registries...' )
        const { erc8004Cursors } = Monitor.#getErc8004Config( { state } )

        const collectResults = await Promise.allSettled( [
            McpRegistryCollector.collect( {} ),
            Erc8004Collector.collect( {
                alchemyUrl,
                fromBlock: erc8004Cursors[ 'lastProcessedBlock' ],
                contract: erc8004Cursors[ 'contract' ]
            } ),
            BazaarCollector.collect( {} )
        ] )

        const allDiscoveries = []
        const collectorLogs = []

        const [ mcpResult, erc8004Result, bazaarResult ] = collectResults

        if( mcpResult[ 'status' ] === 'fulfilled' && mcpResult[ 'value' ][ 'status' ] ) {
            const { discoveries, totalFetched, cursor } = mcpResult[ 'value' ]
            allDiscoveries.push( ...discoveries )
            state[ 'cursors' ][ 'mcp-registry' ][ 'lastFetchedAt' ] = new Date().toISOString()
            state[ 'cursors' ][ 'mcp-registry' ][ 'totalFetched' ] = totalFetched
            state[ 'cursors' ][ 'mcp-registry' ][ 'lastCursor' ] = cursor
            collectorLogs.push( `  MCP Registry: ${discoveries.length} endpoints from ${totalFetched} servers` )
        } else {
            const errorMsg = mcpResult[ 'status' ] === 'fulfilled' ? mcpResult[ 'value' ][ 'error' ] : mcpResult[ 'reason' ]?.message
            collectorLogs.push( `  MCP Registry: FAILED - ${errorMsg}` )
        }

        if( erc8004Result[ 'status' ] === 'fulfilled' && erc8004Result[ 'value' ][ 'status' ] ) {
            const { discoveries, lastProcessedBlock } = erc8004Result[ 'value' ]
            allDiscoveries.push( ...discoveries )
            state[ 'cursors' ][ 'erc8004' ][ 'lastProcessedBlock' ] = lastProcessedBlock
            state[ 'cursors' ][ 'erc8004' ][ 'lastFetchedAt' ] = new Date().toISOString()
            collectorLogs.push( `  ERC-8004: ${discoveries.length} endpoints up to block ${lastProcessedBlock}` )
        } else {
            const errorMsg = erc8004Result[ 'status' ] === 'fulfilled' ? erc8004Result[ 'value' ][ 'error' ] : erc8004Result[ 'reason' ]?.message
            collectorLogs.push( `  ERC-8004: FAILED - ${errorMsg}` )
        }

        if( bazaarResult[ 'status' ] === 'fulfilled' && bazaarResult[ 'value' ][ 'status' ] ) {
            const { discoveries, totalFetched } = bazaarResult[ 'value' ]
            allDiscoveries.push( ...discoveries )
            state[ 'cursors' ][ 'bazaar' ][ 'lastFetchedAt' ] = new Date().toISOString()
            state[ 'cursors' ][ 'bazaar' ][ 'totalFetched' ] = totalFetched
            collectorLogs.push( `  Bazaar: ${discoveries.length} endpoints from ${totalFetched} resources` )
        } else {
            const errorMsg = bazaarResult[ 'status' ] === 'fulfilled' ? bazaarResult[ 'value' ][ 'error' ] : bazaarResult[ 'reason' ]?.message
            collectorLogs.push( `  Bazaar: FAILED - ${errorMsg}` )
        }

        log.push( ...collectorLogs )
        log.push( `  Total discoveries: ${allDiscoveries.length}` )

        // Phase 3: Merge into unified list
        log.push( 'Phase 3: Merging into unified list...' )
        const previousCount = existingEndpoints.length
        const { endpoints: mergedEndpoints } = EndpointRegistry.merge( {
            existingEndpoints,
            newDiscoveries: allDiscoveries
        } )
        const newEndpointsCount = mergedEndpoints.length - previousCount
        log.push( `  Merged: ${mergedEndpoints.length} total (${newEndpointsCount} new)` )

        // Phase 4: Probe endpoints
        log.push( 'Phase 4: Probing endpoints...' )
        const { endpoints: probedEndpoints, probedCount } = await EndpointProber.probeAll( {
            endpoints: mergedEndpoints,
            maxConcurrency: probeMaxConcurrency,
            timeout: probeTimeoutMs,
            probeMaxAgeDays
        } )
        log.push( `  Probed: ${probedCount} endpoints` )

        // Phase 5: Write data
        log.push( 'Phase 5: Writing data...' )
        const { stats } = EndpointRegistry.computeStats( { endpoints: probedEndpoints } )
        const now = new Date()
        const updatedEndpointsData = {
            version: 1,
            updatedAt: now.toISOString(),
            stats,
            endpoints: probedEndpoints
        }

        await DataWriter.writeEndpoints( { dataPath, endpointsData: updatedEndpointsData } )
        await StateManager.saveState( { dataPath, state } )

        const dateString = now.toISOString().slice( 0, 10 )
        const historyEntry = {
            date: dateString,
            total: stats[ 'total' ],
            reachable: stats[ 'reachable' ],
            withX402: stats[ 'withX402' ],
            bySource: stats[ 'bySource' ],
            newEndpoints: newEndpointsCount,
            probedThisRun: probedCount
        }

        await DataWriter.writeHistory( { dataPath, historyEntry } )
        log.push( `  Written: endpoints.json, state.json, history/${dateString}.json` )

        // Phase 6: Generate dashboard
        log.push( 'Phase 6: Generating dashboard data...' )
        const { dashboardData } = DashboardBuilder.buildDashboardData( { endpointsData: updatedEndpointsData } )
        await DashboardBuilder.writeDashboardData( { docsPath, dashboardData } )
        log.push( '  Written: docs/data.json' )

        log.push( 'Done.' )

        return {
            status: true,
            stats,
            newEndpoints: newEndpointsCount,
            probedCount,
            log
        }
    }


    static #getErc8004Config( { state } ) {
        const erc8004Cursors = state[ 'cursors' ][ 'erc8004' ]

        return { erc8004Cursors }
    }
}


export { Monitor }
