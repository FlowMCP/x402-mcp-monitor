import { writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { Validation } from '../task/Validation.mjs'


class DashboardBuilder {
    static buildDashboardData( { endpointsData } ) {
        const { status, messages } = Validation.validationBuildDashboardData( { endpointsData } )
        if( !status ) { Validation.error( { messages } ) }

        const { stats, endpoints, updatedAt } = endpointsData

        const dashboardEndpoints = endpoints
            .map( ( ep ) => {
                const { id, url, protocol, sources, probe } = ep

                const sourceTypes = sources
                    .map( ( s ) => s[ 'type' ] )

                const entry = {
                    id,
                    url,
                    protocol,
                    sourceTypes,
                    sourceCount: sources.length,
                    sources,
                    isReachable: false,
                    supportsX402: false,
                    probe: null
                }

                if( probe !== null ) {
                    const { categories, summary, timestamp, status: probeStatus, messages: probeMessages } = probe
                    entry[ 'isReachable' ] = categories[ 'isReachable' ] === true
                    entry[ 'supportsX402' ] = categories[ 'supportsX402' ] === true
                    entry[ 'probe' ] = {
                        timestamp,
                        status: probeStatus,
                        categories,
                        summary,
                        messages: probeMessages
                    }
                }

                return entry
            } )

        // Sort: x402-enabled first, then by reachability, then by source count
        const sortedEndpoints = dashboardEndpoints
            .sort( ( a, b ) => {
                if( a.supportsX402 !== b.supportsX402 ) {
                    return a.supportsX402 ? -1 : 1
                }

                if( a.isReachable !== b.isReachable ) {
                    return a.isReachable ? -1 : 1
                }

                return b.sourceCount - a.sourceCount
            } )

        const dashboardData = {
            updatedAt,
            stats,
            endpoints: sortedEndpoints
        }

        return { dashboardData }
    }


    static async writeDashboardData( { docsPath, dashboardData } ) {
        const filePath = join( docsPath, 'data.json' )
        const tmpPath = `${filePath}.tmp`

        await mkdir( docsPath, { recursive: true } )
        await writeFile( tmpPath, JSON.stringify( dashboardData, null, 4 ), 'utf-8' )
        await rename( tmpPath, filePath )

        return { written: true }
    }
}


export { DashboardBuilder }
